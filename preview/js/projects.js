// Zuri System · 📈 Projects — plan a new area, decide, then track it · v1 · 2026-10-12 (app v2.34)
// Finance and partners only. One project goes through three stages:
//   1 PLAN  — start-up costs, monthly running costs, customers and money in → payback, break-even, what-ifs, compare, loan, share.
//   2 GO    — "✅ We're doing it": one partner asks, a SECOND finance person / partner approves (unless the two-person rule is
//             switched off in Admin → Settings). The approved plan is locked as the BASELINE. After that, partners update the
//             CURRENT FORECAST (it needs a reason); every change is logged with date, who and why. The baseline never changes.
//   3 TRACK — actual vs expected each month: start-up money spent, running costs paid, customers connected, money collected.
//             Pulled from Zuri where it can be (expenses and bills tagged to the project, payments / billing figures for the
//             project's area); typed in by hand for anything else.
// Reached from Home (a one-line status card) and the 📈 Projects button on Money. Route: #projects.
// Database: supabase/27_area_planner.sql. Before it is run, projects are kept on this phone (and moved with one tap later).
// The maths lives in planner_math.js (window.ZPlan), with hand-checked tests in tools/planner_tests.js.
(function () {
  const Z = window.Z, M = window.ZPlan;
  if (!Z || !M) return;
  const must = (r) => { if (r.error) throw r.error; return r.data; };
  const N = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const NO_TABLE = /does not exist|could not find the table|schema cache|PGRST205|42P01|relation .*projects/i;
  const kShort = (n) => { const a = Math.abs(n), s = n < 0 ? '−' : ''; return a >= 1e6 ? s + (a / 1e6).toFixed(a >= 1e8 ? 0 : 1) + 'M' : a >= 1e4 ? s + Math.round(a / 1e3) + 'k' : s + Math.round(a).toLocaleString('en-KE'); };
  const kes = (n) => 'KES ' + Z.fmt(n);
  const kesS = (n) => 'KES ' + kShort(n);
  const monthName = (ym) => { if (!ym) return ''; const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }); };
  const nextMonthStart = () => { const d = new Date(); d.setMonth(d.getMonth() + 1, 1); return Z.ymd(d); };
  // "month 19 (May 2028)" when the launch month is known
  const mWord = (m, p) => (m == null ? 'not within 10 years' : m === 0 ? 'from the start' : `month ${m}${p && p.launch_date ? ' (' + monthName(M.ymAdd(p.launch_date.slice(0, 7), m - 1)) + ')' : ''}`);
  const STAGE = { plan: ['📝 Planning', 'brand'], waiting: ['⏳ Waiting for OK', 'warn'], live: ['🚀 Live', 'ok'], closed: ['📦 Closed', ''] };
  const STATE = { 'on track': ['🟢', 'On track', 'ok'], ahead: ['🔵', 'Ahead of plan', 'ok'], behind: ['🟠', 'Behind plan', 'warn'], red: ['🔴', 'Well behind plan', 'bad'] };
  const BH_PRESETS = [
    ['', 'Type my own amount'],
    ['bayobab100', 'Bayobab 100 Mbps · KES 14,000 a month', 14000],
    ['bayobab200', 'Bayobab 200 Mbps · KES 28,000 a month', 28000],
    ['saf100', 'Safaricom 100 Mbps · KES 26,600 a month', 26600],
    ['saf200', 'Safaricom 200 Mbps · KES 53,200 a month', 53200],
    ['starlink', 'Starlink Local Priority · KES 4,200 a month (+ KES 49,900 kit)', 4200],
  ];

  // ---------- storage: the database, or this phone until 27_area_planner.sql is run ----------
  const LOCAL = 'projects_local';
  // Read through a phone copy: with no signal, the last copy is shown (the Track page still opens in the field).
  async function cq(key, fn) {
    try { const r = await fn(); if (r.error) throw r.error; Z.set('pjc_' + key, r.data || []); return r.data || []; }
    catch (e) { if (Z.isNet(e)) return Z.get('pjc_' + key, []); throw e; }
  }
  const pendingActuals = (id) => (Z.queue || []).filter((q) => q.op === 'project_actual' && q.data.row.project_id === id).map((q) => Object.assign({ pending: true }, q.data.row));
  const S = {
    mode: null, at: 0,
    async detect(force) {
      if (!force && S.mode && Date.now() - S.at < 300e3) return S.mode;
      if (!Z.online()) { if (S.mode) return S.mode; const m = Z.get('pj_mode', null); if (m) return (S.mode = m); }
      const r = await Z.sb.from('projects').select('id').limit(1);
      if (r.error && Z.isNet(r.error)) { if (S.mode) return S.mode; const m = Z.get('pj_mode', null); if (m) return (S.mode = m); throw r.error; }
      S.mode = r.error && NO_TABLE.test(String(r.error.message || r.error.code || '')) ? 'local' : r.error ? (() => { throw r.error; })() : 'db';
      S.at = Date.now(); Z.set('pj_mode', S.mode);
      return S.mode;
    },
    loc: () => { const d = Z.get(LOCAL, null) || {}; return { projects: d.projects || [], revisions: d.revisions || [], actuals: d.actuals || [] }; },
    put: (d) => { if (!Z.set(LOCAL, d)) throw new Error('This phone could not save — its storage is full.'); },
    async list() {
      if ((await S.detect()) === 'local') return S.loc().projects.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      return cq('list', () => Z.sb.from('projects').select('*').order('created_at'));
    },
    async get(id) { return (await S.list()).find((p) => p.id === id) || null; },
    async log(id, kind, why, changes) {
      const row = { id: Z.uuid(), project_id: id, at: new Date().toISOString(), by: Z.me.id, by_name: Z.me.full_name, kind, why: why || null, changes: changes || null };
      if (S.mode === 'local') { const d = S.loc(); d.revisions.push(row); S.put(d); return; }
      const r = await Z.sb.from('project_revisions').insert(row); if (r.error) console.warn('project log', r.error);
    },
    async create(o) {
      const row = { id: Z.uuid(), name: o.name, area: o.area || null, notes: o.notes || null, status: 'plan', plan: o.plan || M.blank(), baseline: null, launch_date: null, created_by: Z.me.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      if ((await S.detect()) === 'local') { const d = S.loc(); d.projects.push(row); S.put(d); }
      else must(await Z.sb.from('projects').insert(row));
      await S.log(row.id, 'created', o.from ? 'Copied from ' + o.from : null);
      return row;
    },
    async savePlan(id, fields) {
      const f = Object.assign({}, fields, { updated_at: new Date().toISOString(), updated_by: Z.me.id });
      if ((await S.detect()) === 'local') { const d = S.loc(); const p = d.projects.find((x) => x.id === id); if (!p) throw new Error('Project not found.'); if (p.status !== 'plan' && 'plan' in f) throw new Error('This plan is locked — use Update the forecast.'); Object.assign(p, f); S.put(d); return; }
      const r = await Z.sb.from('projects').update(f).eq('id', id).select('id');
      if (r.error) throw r.error; if (!r.data.length) throw new Error('This project was changed or removed by someone else.');
    },
    async remove(id) {
      if ((await S.detect()) === 'local') { const d = S.loc(); d.projects = d.projects.filter((p) => p.id !== id); d.revisions = d.revisions.filter((x) => x.project_id !== id); d.actuals = d.actuals.filter((x) => x.project_id !== id); S.put(d); return; }
      must(await Z.sb.from('projects').delete().eq('id', id));
    },
    // the life-cycle steps run inside the database (27_area_planner.sql) so nobody can skip the second OK
    async rpc(name, args, localFn) {
      if ((await S.detect()) === 'local') { const d = S.loc(); const p = d.projects.find((x) => x.id === args.p_project); if (!p) throw new Error('Project not found.'); const out = localFn(p, d); S.put(d); return out; }
      return must(await Z.sb.rpc(name, args));
    },
    requestGo: (id, launch) => S.rpc('project_request_go', { p_project: id, p_launch: launch }, (p, d) => {
      if (p.status !== 'plan') throw new Error('Only a plan can be sent for the go-ahead.');
      // on this phone there is only one person, so the plan goes live straight away
      Object.assign(p, { status: 'live', launch_date: launch, go_requested_by: Z.me.id, go_requested_name: Z.me.full_name, go_requested_at: new Date().toISOString(), approved_by: Z.me.id, approved_name: Z.me.full_name, approved_at: new Date().toISOString(), baseline: clone(p.plan) });
      d.revisions.push({ id: Z.uuid(), project_id: p.id, at: new Date().toISOString(), by: Z.me.id, by_name: Z.me.full_name, kind: 'go_approved', why: 'Saved on this phone — one person (no second OK until the database step is done). Launch ' + launch });
      return { status: 'live' };
    }),
    withdrawGo: (id, why) => S.rpc('project_withdraw_go', { p_project: id, p_why: why }, (p) => { p.status = 'plan'; return { status: 'plan' }; }),
    approveGo: (id) => S.rpc('project_approve_go', { p_project: id }, () => ({ status: 'live' })),
    revise: (id, plan, why, changes, launch) => S.rpc('project_revise', { p_project: id, p_plan: plan, p_why: why, p_changes: changes, p_launch: launch || null }, (p, d) => {
      if (p.status !== 'live') throw new Error('Only a live project has a forecast to update.');
      p.plan = plan; if (launch) p.launch_date = launch; p.updated_at = new Date().toISOString();
      d.revisions.push({ id: Z.uuid(), project_id: p.id, at: new Date().toISOString(), by: Z.me.id, by_name: Z.me.full_name, kind: 'forecast', why, changes });
      return { status: 'live' };
    }),
    close: (id, why) => S.rpc('project_close', { p_project: id, p_why: why }, (p, d) => {
      p.status = 'closed'; d.revisions.push({ id: Z.uuid(), project_id: p.id, at: new Date().toISOString(), by: Z.me.id, by_name: Z.me.full_name, kind: 'closed', why }); return { status: 'closed' };
    }),
    async revisions(id) {
      if ((await S.detect()) === 'local') return S.loc().revisions.filter((x) => x.project_id === id).sort((a, b) => String(b.at).localeCompare(String(a.at)));
      return cq('rev_' + id, () => Z.sb.from('project_revisions').select('*').eq('project_id', id).order('at', { ascending: false }));
    },
    async actuals(id) {
      if ((await S.detect()) === 'local') return S.loc().actuals.filter((x) => x.project_id === id);
      const got = await cq('act_' + id, () => Z.sb.from('project_actuals').select('*').eq('project_id', id).order('period'));
      return got.concat(pendingActuals(id).filter((x) => !got.some((g) => g.id === x.id)));
    },
    // returns 'queued' when there is no signal: the entry waits on the phone and sends by itself (Me → Waiting to send)
    async addActual(row) {
      row = Object.assign({ id: Z.uuid(), created_by: Z.me.id, created_at: new Date().toISOString() }, row);
      const log = { id: Z.uuid(), project_id: row.project_id, at: row.created_at, by: Z.me.id, by_name: Z.me.full_name, kind: 'actual', why: null, changes: [{ label: `${KIND_WORD[row.kind]} · ${monthName(row.period)}${row.line ? ' · ' + lineLabel(row) : ''}`, from: null, to: row.amount }] };
      if ((await S.detect()) === 'local') { const d = S.loc(); d.actuals.push(Object.assign({ by_name: Z.me.full_name }, row)); d.revisions.push(log); S.put(d); return 'saved'; }
      if (!Z.online()) { if (!Z.enqueue('project_actual', { row, log })) throw new Error('This phone could not save — its storage is full.'); return 'queued'; }
      must(await Z.sb.from('project_actuals').insert(row));
      const r = await Z.sb.from('project_revisions').insert(log); if (r.error) console.warn('project log', r.error);
      return 'saved';
    },
    async delActual(a) {
      if ((await S.detect()) === 'local') { const d = S.loc(); d.actuals = d.actuals.filter((x) => x.id !== a.id); S.put(d); }
      else must(await Z.sb.from('project_actuals').delete().eq('id', a.id));
      await S.log(a.project_id, 'actual', 'Removed an entry', [{ label: `${KIND_WORD[a.kind]} · ${monthName(a.period)}`, from: a.amount, to: null }]);
    },
    // Move what this phone kept into the database (after 27 is run): one tap, then the phone copy is cleared.
    async moveToDb() {
      const d = S.loc(); let n = 0;
      for (const p of d.projects) {
        const r = await Z.sb.rpc('project_import', { p: { project: p, revisions: d.revisions.filter((x) => x.project_id === p.id), actuals: d.actuals.filter((x) => x.project_id === p.id) } });
        if (r.error) throw r.error; n++;
      }
      Z.set(LOCAL, { projects: [], revisions: [], actuals: [] });
      return n;
    },
    async selfOk() {
      if (S.mode === 'local') return true;
      try { const { data } = await Z.sb.from('settings').select('value').eq('key', 'money_approval').maybeSingle(); return !!(data && data.value && data.value.on === false); } catch (e) { return false; }
    },
  };
  Z.projectsStore = S;
  const KIND_WORD = { startup: 'Start-up spent', running: 'Running costs paid', customers: 'Customers connected', revenue: 'Money collected' };
  const lineLabel = (a) => ((a.kind === 'startup' ? M.START_LINES : M.RUN_LINES).find(([k]) => k === a.line) || [a.line, a.line])[1];

  // ---------- money from Zuri: the "from Zuri A today" monthly bill ----------
  async function zuriArpu() {
    try {
      const [snaps, cust] = await Promise.all([
        Z.sb.from('billing_snapshots').select('*').then((r) => r.data || []).catch(() => []),
        Z.sb.from('v_customers').select('area,status,monthly_rate').eq('status', 'active').then((r) => r.data || []).catch(() => []),
      ]);
      const area = 'A';
      const active = cust.filter((c) => c.area === area);
      const s = snaps.filter((x) => (x.area || 'A') === area).sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];
      // the billing website's own count of paying subscribers; without it, the packages of active customers (dividing a sales
      // total by Zuri's customer list mixes two sources and can be far off)
      const sales = s ? N(s.fixed_sales) : 0, subs = s ? N(s.fixed_subs) : 0;
      if (sales && subs && sales / subs >= 300 && sales / subs <= 30000) return { v: Math.round(sales / subs), how: `${monthName(s.period)} fixed sales ${kes(sales)} ÷ ${Z.fmt(subs)} customers` };
      const rated = active.filter((c) => N(c.monthly_rate) > 0);
      if (rated.length) return { v: Math.round(rated.reduce((t, c) => t + N(c.monthly_rate), 0) / rated.length), how: `average package of ${rated.length} active customers` };
    } catch (e) { /* no figure: the person types it */ }
    return null;
  }
  async function zuriBackhaul() {
    try { const b = (await Z.sb.from('bills').select('name,amount,area,month').eq('area', 'A').order('month', { ascending: false }).limit(60)).data || [];
      const x = b.find((r) => /backhaul|bandwidth|bayobab|safaricom|liquid|telkom|jamii|faiba/i.test(r.name)); return x ? { v: N(x.amount), how: `${x.name} (${monthName(x.month)})` } : null; } catch (e) { return null; }
  }

  // ---------- actuals: what really happened, month by month ----------
  async function loadActual(p) {
    const launch = p.launch_date;
    if (!launch) return null;
    const lym = launch.slice(0, 7);
    const K = Math.max(0, Math.min(M.HORIZON, M.monthIndex(lym, Z.ym()) - 1)); // complete months since launch
    const since = M.ymAdd(lym, -24) + '-01';
    const q = (key, fn) => cq(key + '_' + p.id, fn).catch(() => []); // a missing column (before 27) or no permission → nothing
    const [manual, tagged, pays, cin, snaps] = await Promise.all([
      S.actuals(p.id),
      S.mode === 'db' ? q('tag', () => Z.sb.from('expenses').select('id,date,amount,category,payee,approval,bill_id').eq('project_id', p.id)) : Promise.resolve([]),
      p.area ? q('pay', () => Z.sb.from('payments').select('date,amount').eq('area', p.area).gte('date', lym + '-01')) : Promise.resolve([]),
      p.area ? q('cin', () => Z.sb.from('cash_in').select('date,amount').eq('area', p.area).gte('date', lym + '-01')) : Promise.resolve([]),
      p.area ? q('snap', () => Z.sb.from('billing_snapshots').select('*').eq('area', p.area)) : Promise.resolve([]),
    ]);
    const inYm = (ym) => (r) => String(r.date || '').slice(0, 7) === ym;
    const sum = (a) => a.reduce((t, r) => t + N(r.amount), 0);
    const before = tagged.filter((e) => e.date < launch && e.date >= since);
    const months = [];
    const startBefore = manual.filter((a) => a.kind === 'startup' && a.period < lym);
    for (let m = 1; m <= K + 1; m++) {
      const ym = M.ymAdd(lym, m - 1);
      const man = manual.filter((a) => a.period === ym);
      const mc = man.filter((a) => a.kind === 'customers').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      const mr = man.filter((a) => a.kind === 'revenue');
      const snap = snaps.find((s) => s.period === ym);
      const zIn = sum(pays.filter(inYm(ym))) + sum(cin.filter(inYm(ym)));
      const snapIn = snap ? N(snap.fixed_sales) + N(snap.hotspot_sales) : 0;
      const revenue = mr.length ? sum(mr) : zIn > 0 ? zIn : snapIn;
      const revSrc = mr.length ? 'typed' : zIn > 0 ? 'payments in Zuri' : snapIn ? 'billing website' : 'nothing yet';
      const customers = mc ? N(mc.amount) : snap && snap.fixed_subs != null ? N(snap.fixed_subs) : null;
      const custSrc = mc ? 'typed' : snap && snap.fixed_subs != null ? 'billing website' : '';
      const tg = tagged.filter((e) => e.date >= launch && inYm(ym)(e));
      const costs = sum(tg) + sum(man.filter((a) => a.kind === 'running'));
      const startup = sum(man.filter((a) => a.kind === 'startup'));
      months.push({ m, ym, customers, custSrc, revenue, revSrc, costs, startup, tagged: tg, confirmed: !!mc && mr.length > 0, partial: m === K + 1 });
    }
    const cur = months.pop(); // this month, still going
    return { K, lym, months, cur, start0: sum(before) + sum(startBefore), before, startBefore, manual, tagged };
  }
  async function trackOf(p) {
    const a = await loadActual(p);
    if (!a) return null;
    const t = M.track(p.baseline || p.plan, p.plan, { start0: a.start0, months: a.months });
    return { a, t };
  }
  Z.projectsTrack = trackOf;

  // one plain line for a project (Home, the list, the Friday report)
  async function statusLine(p) {
    if (p.status === 'live') {
      const r = await trackOf(p).catch(() => null);
      if (!r) return { short: 'live', text: 'live — launch date missing' };
      const { a, t } = r;
      if (!a.K) return a.lym > Z.ym() ? { short: 'starts ' + monthName(a.lym), text: `🚀 approved — starts ${monthName(a.lym)}; plan pays back in ${mWord(t.B.payback, p)}` }
        : { short: 'just launched', text: `launched ${monthName(a.lym)} — first full month not finished yet; plan pays back in ${mWord(t.B.payback, p)}` };
      const s = STATE[t.state];
      const last = a.months[a.K - 1], plannedCust = t.B.rows[a.K - 1].customers;
      return { short: s[1].toLowerCase(), state: t.state, text: `${s[0]} ${s[1].toLowerCase()} — month ${a.K}: ${last.customers != null ? Z.fmt(last.customers) + ' customers (plan ' + Z.fmt(plannedCust) + ')' : 'customers not entered'}, cash ${kesS(t.rows[a.K - 1].cum)} vs plan ${kesS(t.B.rows[a.K - 1].cum)}; pays back ${mWord(t.J.payback, p)} (plan ${mWord(t.B.payback, p)})` };
    }
    const r = M.model(p.plan);
    if (p.status === 'closed') return { short: 'closed', text: 'closed' };
    return { short: p.status === 'waiting' ? 'waiting for a second OK' : 'being planned', text: `${p.status === 'waiting' ? '⏳ waiting for a second OK' : '📝 being planned'} — start-up ${kesS(r.startup)}, pays back ${mWord(r.payback)}` };
  }

  // ---------- the cash chart (no libraries) ----------
  function chartSvg(series, o = {}) {
    const W = 420, H = 230, L = 46, R = 10, T = 16, B = 24;
    const months = o.months || 36;
    const pts = series.flatMap((s) => s.points.filter(([m]) => m <= months));
    if (!pts.length) return '';
    let lo = Math.min(0, ...pts.map((x) => x[1])), hi = Math.max(0, ...pts.map((x) => x[1]));
    if (hi - lo < 1) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const x = (m) => L + (m / months) * (W - L - R), y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const step = months <= 12 ? 3 : months <= 36 ? 6 : 12;
    const ticks = []; for (let m = 0; m <= months; m += step) ticks.push(m);
    const yt = [lo + pad, 0, hi - pad].filter((v, i, a) => a.findIndex((w) => Math.abs(w - v) < (hi - lo) * 0.08) === i);
    const line = (s) => { const p = s.points.filter(([m]) => m <= months); return p.length ? `<path d="${p.map(([m, v], i) => (i ? 'L' : 'M') + x(m).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ')}" style="fill:none;stroke:${s.color};stroke-width:${s.width || 3};${s.dash ? 'stroke-dasharray:7 5;' : ''}stroke-linejoin:round;stroke-linecap:round"/>` : ''; };
    const marks = (o.marks || []).filter((k) => k.m != null && k.m <= months).map((k) => `<line x1="${x(k.m)}" x2="${x(k.m)}" y1="${T}" y2="${H - B}" style="stroke:${k.color};stroke-width:1.5;stroke-dasharray:3 4"/><text x="${Math.min(W - R - 4, x(k.m) + 4)}" y="${T + 12}" style="fill:${k.color};font-size:13px;font-weight:700" text-anchor="${x(k.m) > W - 90 ? 'end' : 'start'}">${Z.esc(k.label)}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${Z.esc(o.label || 'Cash over time')}" style="display:block;max-width:680px;margin:0 auto">
      <rect x="${L}" y="${y(0)}" width="${W - L - R}" height="${Math.max(0, H - B - y(0))}" style="fill:var(--bad-soft)"/>
      ${yt.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" style="stroke:${Math.abs(v) < 1e-6 ? 'var(--ink-faint)' : 'var(--line)'};stroke-width:${Math.abs(v) < 1e-6 ? 1.5 : 1}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" style="fill:var(--ink-faint);font-size:13px">${Math.abs(v) < 1e-6 ? '0' : kShort(v)}</text>`).join('')}
      ${ticks.map((m) => `<text x="${x(m)}" y="${H - 10}" text-anchor="middle" style="fill:var(--ink-faint);font-size:13px">${m === 0 ? 'start' : m}</text>`).join('')}
      ${marks}${series.map(line).join('')}
    </svg>
    <div class="row" style="gap:12px;margin-top:4px">${series.map((s) => `<span class="hint" style="margin:0;display:inline-flex;align-items:center;gap:6px"><i style="display:inline-block;width:18px;height:0;border-top:3px ${s.dash ? 'dashed' : 'solid'} ${s.color}"></i>${Z.esc(s.name)}</span>`).join('')}<span class="hint" style="margin:0">Months along the bottom · pink = cash still in the hole</span></div>`;
  }
  const cumPoints = (res, months) => [[0, res.cum0]].concat(res.rows.slice(0, months).map((r) => [r.m, r.cum]));

  // ---------- the list ----------
  Z.routes.projects = async (args, el) => {
    if (!Z.isFinance()) { el.innerHTML = '<div class="card">Projects are for finance and partners.</div>'; return; }
    const mode = await S.detect(true);
    const id = args[0];
    if (id === 'new') return newPage(el, args[1]);
    if (id === 'compare') return comparePage(el);
    if (id) {
      const p = await S.get(id);
      if (!p) { el.innerHTML = '<div class="card"><b>This project isn\'t here.</b><p class="hint">It may have been removed, or it was saved on another phone.</p><a class="btn sec" href="#projects">← All projects</a></div>'; return; }
      const sub = args[1] || (p.status === 'live' || p.status === 'closed' ? 'track' : 'plan');
      if (sub === 'print') return printPage(el, p);
      if (sub === 'log') return logPage(el, p);
      if (sub === 'track' && p.launch_date) return trackPage(el, p);
      return planPage(el, p);
    }
    const all = await S.list();
    const localLeft = mode === 'db' ? S.loc().projects.length : 0;
    const lines = await Promise.all(all.map((p) => statusLine(p).catch(() => ({ text: '' }))));
    const card = (p, i) => {
      const st = STAGE[p.status] || STAGE.plan, r = M.model(p.status === 'live' ? p.plan : p.plan);
      return `<a class="card pj-card" href="#projects/${p.id}" data-name="${Z.esc(p.name)}" style="display:block;text-decoration:none;color:inherit;border-left:4px solid var(--${st[1] || 'line'})">
        <div class="row" style="justify-content:space-between"><b style="font-size:17px">${Z.esc(p.name)}</b><span class="pill ${st[1]}">${st[0]}</span></div>
        <div class="hint" style="margin:2px 0">${p.area ? Z.esc(Z.areaName(p.area)) : 'New area — not in Zuri yet'}${p.launch_date ? ' · launch ' + monthName(p.launch_date.slice(0, 7)) : ''} · start-up ${kesS(r.startup)}</div>
        <div style="margin-top:4px">${Z.esc(lines[i].text || '')}</div></a>`;
    };
    const group = (title, ps, empty) => `<h3>${title} · ${ps.length}</h3>${ps.length ? ps.map((p) => card(p, all.indexOf(p))).join('') : `<div class="card muted">${empty}</div>`}`;
    el.innerHTML = `
      <a class="back" href="#money">← Money</a>
      <h2>📈 Projects</h2>
      <div class="card" id="pj-intro" style="border-left:4px solid var(--brand)">
        <b>Plan a new area, decide together, then watch it against the plan.</b>
        <p class="hint" style="margin:4px 0 0">Every project goes <b>📝 Plan</b> → <b>✅ Go</b> (two partners agree, the plan is locked as the yardstick) → <b>📊 Track</b> (what really happened, month by month, against the plan). The numbers are explained in plain words on each screen.</p>
      </div>
      ${mode === 'local' ? `<div class="alert warn" id="pj-local">📱 Saved on this phone until the database step is done (Jerry runs <b>27_area_planner.sql</b> once). Then one tap moves them into Zuri for everyone.</div>` : ''}
      ${localLeft ? `<div class="card row" id="pj-move" style="border-left:4px solid var(--accent)"><div class="grow"><b>${localLeft} project${localLeft > 1 ? 's' : ''} saved on this phone</b><div class="hint" style="margin:0">The database is ready now. Move them in so the other partners see them.</div></div><button class="btn" id="pj-move-btn">⬆️ Move to the database</button></div>` : ''}
      <div class="row" style="margin-bottom:6px"><a class="btn" id="pj-new" href="#projects/new">＋ New project</a>${all.filter((p) => p.status !== 'closed').length >= 2 ? '<a class="btn sec" id="pj-compare" href="#projects/compare">⚖️ Compare</a>' : ''}</div>
      ${group('📝 Planning', all.filter((p) => p.status === 'plan' || p.status === 'waiting'), 'Nothing being planned. Tap ＋ New project to start one.')}
      ${group('🚀 Live', all.filter((p) => p.status === 'live'), 'No project has gone live yet.')}
      ${all.some((p) => p.status === 'closed') ? group('📦 Closed', all.filter((p) => p.status === 'closed'), '') : ''}`;
    const mv = Z.$('#pj-move-btn', el);
    if (mv) mv.onclick = async () => { mv.disabled = true; try { const n = await S.moveToDb(); Z.toast(`Moved ${n} project${n === 1 ? '' : 's'} into the database.`); Z.route(); } catch (e) { mv.disabled = false; Z.fail(e); } };
  };

  // ---------- new project ----------
  async function newPage(el, copyId) {
    const all = await S.list();
    el.innerHTML = `<a class="back" href="#projects">← Projects</a><h2>＋ New project</h2>
      <form class="card" id="pn-form">
        <label for="pn-name">Name</label><input id="pn-name" name="name" required maxlength="80" placeholder="e.g. Suswa">
        <label for="pn-area">Service area</label><select id="pn-area" name="area"><option value="">A new area — not in Zuri yet</option>${Z.opts(Z.ref.areas.map((a) => [a.code, a.name + (a.active ? '' : ' (not active)')]))}</select>
        <p class="hint">Pick its area if it already exists in Admin → Areas (e.g. a new "Zuri D · Suswa"). Zuri then pulls the real customers and payments for tracking by itself.</p>
        <label for="pn-notes">Notes about the area (optional)</label><textarea id="pn-notes" name="notes" placeholder="e.g. ~80 km from Nairobi on the B8; farms and the Mt Suswa visitors; no ISP with fiber yet"></textarea>
        <label for="pn-from">Start from</label><select id="pn-from" name="from"><option value="">An empty plan</option>${Z.opts(all.map((p) => [p.id, 'A copy of ' + p.name]), copyId || '')}</select>
        <div style="height:12px"></div><button class="btn block" type="submit" id="pn-save">Create and fill in the plan</button>
      </form>`;
    Z.$('#pn-form', el).onsubmit = async (e) => {
      e.preventDefault();
      const d = Z.formData(e.target);
      if (!d.name.trim()) return Z.toast('Give the project a name.');
      const src = all.find((p) => p.id === d.from);
      try {
        const p = await S.create({ name: d.name.trim(), area: d.area || null, notes: d.notes.trim(), plan: src ? clone(src.plan) : M.blank(), from: src ? src.name : null });
        Z.toast('Project created — fill in the three parts.'); Z.go('projects/' + p.id + '/plan');
      } catch (err) { Z.fail(err); }
    };
  }

  // ---------- the plan (and, after Go, the forecast) ----------
  const F = (k, label, unit, help, o = {}) => ({ k, label, unit, help, ...o });
  const START_F = [
    F('start.fiber_km', 'Fiber cable to lay', 'km', 'Kilometres of fiber from the backbone to the homes. Ask Dickson to walk the route.'),
    F('start.fiber_rate', 'Fiber cost per km (laid)', 'KES/km', 'Cable plus fitting, per kilometre. Use a real quote when you have one.'),
    F('start.poles', 'Poles & ducting', 'KES', 'Poles, ducts, brackets — or pole rent paid up front.'),
    F('start.olt', 'OLT & core equipment', 'KES', 'The equipment at the hub: OLT, switches, splitters, batteries, the cabinet.'),
    F('start.labour', 'Labour', 'KES', 'Casuals and technicians to build it.'),
    F('start.permits', 'Permits & wayleaves', 'KES', 'County and KeNHA permits, landowners\' wayleaves.'),
    F('start.office', 'Office / shop setup', 'KES', 'A small shop or office where customers can pay and ask.'),
    F('start.launch', 'Launch marketing', 'KES', 'Posters, a roadshow, the first offers.'),
    F('start.cont_pct', 'Contingency', '%', 'Extra on top for surprises. Builds almost always cost more than planned — 10–15% is normal.'),
  ];
  const RUN_F = [
    F('run.backhaul', 'Backhaul / bandwidth', 'KES/month', 'The internet you buy for this area. Pick a quote above or type your own.'),
    F('run.staff_n', 'Staff', 'people', 'People working only for this area (technicians, a shop attendant).'),
    F('run.salary', 'Salary each', 'KES/month', 'Average monthly pay per person.'),
    F('run.rent', 'Rent', 'KES/month', 'Shop, hub site, pole rent.'),
    F('run.power', 'Power / generator fuel', 'KES/month', 'KPLC tokens and fuel for the hub.'),
    F('run.transport', 'Transport', 'KES/month', 'Boda and fuel for jobs.'),
    F('run.maint_pct', 'Maintenance', '% of start-up a year', 'Cable cuts, spares, replacements. 5% of the build a year is a fair start.'),
    F('run.marketing', 'Marketing', 'KES/month', 'Keeping customers coming after the launch.'),
  ];
  const REV_F = [
    F('rev.homes', 'Homes & businesses passed', 'homes', 'How many places the fiber goes past — the most customers you could ever have.'),
    F('rev.c1', 'Sign-ups by month 1', 'customers', '', { mode: 'curve' }), F('rev.c3', 'Sign-ups by month 3', 'customers', '', { mode: 'curve' }),
    F('rev.c6', 'Sign-ups by month 6', 'customers', '', { mode: 'curve' }), F('rev.c12', 'Sign-ups by month 12', 'customers', '', { mode: 'curve' }),
    F('rev.c24', 'Sign-ups by month 24', 'customers', 'Count everyone who joins, including those who later leave. Zuri takes the leavers off below.', { mode: 'curve' }),
    F('rev.pct', 'Share of homes passed who sign up (before people leave)', '%', '', { mode: 'pct' }), F('rev.pct_month', '…reached by month', 'month', 'Zuri spreads the sign-ups evenly until that month.', { mode: 'pct' }),
    F('rev.arpu', 'Average monthly bill (ARPU)', 'KES/month', 'What an average customer pays each month.'),
    F('rev.install_fee', 'Install fee per new customer', 'KES', 'Paid once by each new customer.'),
    F('rev.churn_pct', 'Customers who leave each month', '%', 'Out of every 100 customers, how many stop each month. 2–3% is common.'),
    F('rev.price_pct', 'Price change', '%', 'Raise (or cut) the monthly bill later? e.g. 10 = 10% more.'),
    F('rev.price_month', '…from month', 'month', 'Leave 0 for no price change.'),
  ];
  const LOAN_F = [F('loan.amount', 'Loan amount', 'KES', ''), F('loan.rate', 'Interest a year', '%', ''), F('loan.months', 'Paid back over', 'months', '')];
  const getK = (p, k) => { const [a, b] = k.split('.'); return p[a] ? p[a][b] : ''; };
  const setK = (p, k, v) => { const [a, b] = k.split('.'); p[a][b] = v; };
  const fid = (k) => 'pj-' + k.replace('.', '-');
  const input = (p, f, dis) => `<div class="pj-f" ${f.mode ? `data-mode="${f.mode}"` : ''}><label for="${fid(f.k)}">${Z.esc(f.label)} <span class="muted" style="font-weight:500">· ${Z.esc(f.unit)}</span></label>
    <input id="${fid(f.k)}" data-k="${f.k}" inputmode="decimal" value="${Z.esc(getK(p, f.k) === 0 ? '' : getK(p, f.k) ?? '')}" placeholder="0" ${dis ? 'disabled' : ''}>${f.help ? `<div class="hint" style="margin:3px 0 0">${Z.esc(f.help)}</div>` : ''}</div>`;
  const others = (p, sec, dis) => `<div class="pj-others" data-sec="${sec}">${p[sec].other.map((o, i) => `<div class="row pj-other" style="margin-top:8px;flex-wrap:nowrap">
      <input aria-label="What it is" data-o="${sec}.${i}.label" value="${Z.esc(o.label || '')}" placeholder="What" style="flex:2;min-width:0" ${dis ? 'disabled' : ''}>
      <input aria-label="Amount (KES)" data-o="${sec}.${i}.amount" inputmode="decimal" value="${Z.esc(o.amount || '')}" placeholder="KES" style="flex:1;min-width:0" ${dis ? 'disabled' : ''}>
      ${dis ? '' : `<button type="button" class="btn sec small" data-orm="${sec}.${i}" aria-label="Remove ${Z.esc(o.label || 'line')}">✕</button>`}</div>`).join('')}
    ${dis ? '' : `<button type="button" class="btn sec small" data-oadd="${sec}" id="pj-add-${sec}" style="margin-top:8px">＋ Add a line</button>`}</div>`;

  function editorHtml(p, dis, extra) {
    const pl = p.plan;
    return `
      <details class="card" id="pj-start" ${extra.open === 'start' ? 'open' : ''}><summary style="cursor:pointer;font-weight:800;font-size:16px;min-height:44px;display:flex;align-items:center;gap:8px">🏗️ A · Start-up costs (one time) <span class="num" id="pj-start-total" style="margin-left:auto;white-space:nowrap;font-size:15px;color:var(--brand)"></span></summary>
        <p class="hint">Everything you pay <b>once</b>, before the first customer is connected. This is the money you need to get back.</p>
        <div class="grid2">${START_F.map((f) => input(pl, f, dis)).join('')}</div>
        <b style="display:block;margin-top:12px">Other start-up lines</b>${others(pl, 'start', dis)}
        <b style="display:block;margin-top:14px">Router for each new customer</b>
        <div class="grid2">${input(pl, F('cpe.each', 'Router (CPE) per customer', 'KES', 'The box in each home.'), dis)}
          <div><label>Who pays for it?</label><div class="seg" id="pj-cpe-who">${[['zuri', 'Zuri pays (a cost per sign-up)'], ['customer', 'In the install fee']].map(([k, t]) => `<button type="button" data-who="${k}" class="${pl.cpe.who === k ? 'on' : ''}" ${dis ? 'disabled' : ''}>${t}</button>`).join('')}</div>
          <div class="hint" style="margin:3px 0 0">If Zuri pays, every new customer costs a router in the month they join.</div></div></div>
      </details>
      <details class="card" id="pj-run" ${extra.open === 'run' ? 'open' : ''}><summary style="cursor:pointer;font-weight:800;font-size:16px;min-height:44px;display:flex;align-items:center;gap:8px">🔁 B · Running costs (every month) <span class="num" id="pj-run-total" style="margin-left:auto;white-space:nowrap;font-size:15px;color:var(--brand)"></span></summary>
        <p class="hint">What the area costs <b>every month</b>, with or without customers. The money coming in has to beat this before you make a profit.</p>
        <label for="pj-bh-preset">Backhaul quote</label><select id="pj-bh-preset" ${dis ? 'disabled' : ''}>${Z.opts(BH_PRESETS.map((x) => [x[0], x[1]]), pl.run.backhaul_preset || '')}</select>
        <div class="hint" id="pj-bh-zuri" style="margin:3px 0 0"></div>
        <div class="grid2">${RUN_F.map((f) => input(pl, f, dis)).join('')}</div>
        <b style="display:block;margin-top:12px">Other monthly costs</b>${others(pl, 'run', dis)}
      </details>
      <details class="card" id="pj-rev" ${extra.open === 'rev' ? 'open' : ''}><summary style="cursor:pointer;font-weight:800;font-size:16px;min-height:44px;display:flex;align-items:center;gap:8px">💰 C · Customers & money in <span class="num" id="pj-rev-total" style="margin-left:auto;white-space:nowrap;font-size:15px;color:var(--brand)"></span></summary>
        <p class="hint">How fast people join, what they pay, and how many leave. This is the part to argue about — small changes here move the payback month the most.</p>
        ${input(pl, REV_F[0], dis)}
        <label>How do you want to say the take-up?</label>
        <div class="seg" id="pj-mode">${[['curve', 'Sign-ups by month 1, 3, 6, 12, 24'], ['pct', 'A % of homes by month N']].map(([k, t]) => `<button type="button" data-mode="${k}" class="${pl.rev.mode === k ? 'on' : ''}" ${dis ? 'disabled' : ''}>${t}</button>`).join('')}</div>
        <div class="grid2" id="pj-takeup">${REV_F.slice(1, 8).map((f) => input(pl, f, dis)).join('')}</div>
        <div class="hint" id="pj-have" style="font-weight:600;color:var(--ink-soft)"></div>
        <div class="grid2">${REV_F.slice(8).map((f) => input(pl, f, dis)).join('')}</div>
        <div class="card" id="pj-arpu-zuri" style="background:var(--surface-2);margin:10px 0 0" hidden></div>
      </details>
      <details class="card" id="pj-loan" ${extra.open === 'loan' ? 'open' : ''}><summary style="cursor:pointer;font-weight:800;font-size:16px;min-height:44px;display:flex;align-items:center;gap:8px">🏦 D · A loan? (optional) <span class="num" id="pj-loan-total" style="margin-left:auto;white-space:nowrap;font-size:15px;color:var(--brand)"></span></summary>
        <p class="hint">Borrowing part of the start-up means less of your own money at the start — but the monthly repayment comes out of the profit, and the interest is a real cost.</p>
        <label class="row" style="gap:10px;font-weight:700;min-height:44px"><input type="checkbox" id="pj-loan-on" ${pl.loan.on ? 'checked' : ''} ${dis ? 'disabled' : ''}> Include a loan</label>
        <div class="grid3" id="pj-loan-f" ${pl.loan.on ? '' : 'hidden'}>${LOAN_F.map((f) => input(pl, f, dis)).join('')}</div>
        <div class="hint" id="pj-loan-pay"></div>
      </details>`;
  }

  // the results: big answer, chart, what-ifs, table
  function resultsHtml(p, r, o) {
    const H = o.months;
    const cmp = o.baseline ? M.model(o.baseline) : null;
    const be = r.breakEven, pb = r.payback;
    const own = r.loanAmt ? r.own : r.startup;
    const big = !r.startup ? 'Fill in <b>part A, the start-up costs</b>, first — then Zuri can say when the money comes back.'
      : pb == null ? `With these numbers you <b>do not get the KES ${kShort(own)} back</b> within 10 years.`
      : pb === 0 ? `The loan covers the whole start-up, and the cash never goes below zero.`
      : r.loanAmt ? `You get your own <b>${kesS(own)}</b> back in <b>${mWord(pb, p)}</b> <span class="hint" style="margin:0">(start-up ${kesS(r.startup)} − loan ${kesS(r.loanAmt)})</span>.`
      : `You get your <b>${kesS(r.startup)}</b> back in <b>${mWord(pb, p)}</b>.`;
    const owed = r.loanAmt && pb ? r.loanLeft(pb) : 0;
    const rows = r.rows.slice(0, H);
    const wi = M.whatIfs(p.plan);
    const cell = (c) => `<td class="r num" style="${c.t === 1 && c.a === 1 ? 'font-weight:800;background:var(--brand-soft)' : ''}">${c.payback == null ? '<span style="color:var(--bad)">never</span>' : c.payback === 0 ? 'start' : 'm ' + c.payback}</td>`;
    const roi = r.roi(36);
    return `
      <div class="card" id="pj-answer" style="border-left:4px solid var(--${pb == null ? 'bad' : 'ok'})">
        <div style="font-size:19px;line-height:1.35">${big}</div>
        ${cmp ? `<div class="hint" style="margin:4px 0 0">This is the forecast on its own. The locked plan said ${mWord(cmp.payback, p)}.${o.real ? ` With the real results so far: <b>${mWord(o.real, p)}</b> (see 📊 Actual vs plan).` : ''}</div>` : ''}
        <ul style="margin:8px 0 0;padding-left:20px;line-height:1.5">
          <li><b>Break-even:</b> ${be == null ? 'the monthly profit never stays above zero.' : `from ${mWord(be, p)} the money coming in each month is more than the money going out.`}</li>
          <li><b>Payback:</b> ${!r.startup ? 'nothing to work out yet.' : pb == null ? 'the start-up money is never recovered.' : pb === 0 ? 'nothing of your own to recover — the loan paid for the start-up.' : `by ${mWord(pb, p)} all the money left each month, added together, has paid back ${r.loanAmt ? 'your own part of ' : ''}the start-up.`} <span class="muted">Break-even comes first; payback is later, because the early losses and the start-up have to be earned back.</span></li>
          ${owed ? `<li><b>The loan:</b> the monthly repayments are already taken off every month. At payback, KES ${Z.fmt(owed)} of the loan is still owed — paid from the following months.</li>` : ''}
          <li><b>Most money tied up:</b> ${kes(-Math.min(0, r.low.v))}${r.low.m ? ' in month ' + r.low.m : ' at the start'}${r.loanAmt && r.low.m ? ` — your own ${kesS(r.own)} plus the early months' losses` : ''}. Have at least this much ready.</li>
        </ul>
      </div>
      <div class="kpis" id="pj-kpis">
        <div class="kpi"><div class="k">Start-up</div><div class="v num">${kShort(r.startup)}</div><div class="f">${r.loanAmt ? 'loan ' + kShort(r.loanAmt) + ' · yours ' + kShort(Math.max(0, r.startup - r.loanAmt)) : 'one time'}</div></div>
        <div class="kpi"><div class="k">Running costs a month</div><div class="v num">${kShort(r.run.total)}</div><div class="f">+ routers for new customers${r.loanPay ? ' · + loan ' + kShort(r.loanPay) + ' for ' + r.loanN + ' months' : ''}</div></div>
        ${[12, 24, 36].map((k) => `<div class="kpi"><div class="k">${r.loanAmt ? 'Left after costs & loan' : 'Profit'} · first ${k} months</div><div class="v num ${r.profitN(k) < 0 ? 'bad' : 'ok'}">${kShort(r.profitN(k))}</div><div class="f">after the start-up${r.loanAmt ? ' (own part)' : ''}: ${kShort(r.cashN(k))}</div></div>`).join('')}
        <div class="kpi"><div class="k">3-year return (ROI)</div><div class="v num ${roi == null ? '' : roi < 0 ? 'bad' : 'ok'}">${roi == null ? '—' : Math.round(roi) + '%'}</div><div class="f">${roi == null ? 'no start-up cost' : roi >= 0 ? `every KES 100 of start-up earns KES ${Math.round(roi)} more` : `every KES 100 of start-up loses KES ${Math.round(-roi)}`}</div></div>
      </div>
      <div class="card" id="pj-chart"><b>Cash, month by month</b>
        ${chartSvg([{ name: o.baseline ? 'Current forecast' : 'Cash so far', color: 'var(--brand)', points: cumPoints(r, H) }].concat(cmp ? [{ name: 'Locked plan', color: 'var(--ink-faint)', dash: true, width: 2, points: cumPoints(cmp, H) }] : []), { months: H, marks: [{ m: be, label: 'break-even', color: 'var(--warn-ink)' }, { m: pb || null, label: 'payback', color: 'var(--ok)' }], label: 'Cumulative cash over ' + H + ' months' })}
        <p class="hint">The line starts below zero: that is the start-up money going out. It keeps falling while the months lose money, turns up at <b>break-even</b>, and crosses zero at <b>payback</b>.</p></div>
      <div class="card" id="pj-whatif"><b>What if?</b>
        <p class="hint" style="margin:2px 0 6px">The payback month if fewer or more people join (take-up) and if the monthly bill is 10% lower or higher. The bold one is your plan.</p>
        <div class="scroll-x"><table class="t"><tr><th>Take-up</th><th class="r">Bill −10%</th><th class="r">As planned</th><th class="r">Bill +10%</th></tr>
          ${wi.map((row, i) => `<tr><td>${['Low (70%)', 'Expected', 'High (130%)'][i]}</td>${row.map(cell).join('')}</tr>`).join('')}</table></div>
        <p class="hint">If “Low” still pays back in a time you can live with, the plan is safe. If it says never, decide what you would do if sign-ups are slow.</p></div>
      <div class="card" id="pj-table"><div class="row" style="justify-content:space-between"><b>Month by month</b>
        <div class="seg" id="pj-h">${[12, 24, 36, 60].map((k) => `<button type="button" data-h="${k}" class="${k === H ? 'on' : ''}" aria-label="Show ${k} months">${k}</button>`).join('')}</div></div>
        <div class="hint pj-swipe" style="margin:6px 0 0">↔ Swipe the table sideways to see every column.</div><div class="scroll-x" style="margin-top:4px"><table class="t" style="min-width:520px"><tr><th>Month</th><th class="r">Customers</th><th class="r">Money in</th><th class="r">Costs</th><th class="r">Profit</th><th class="r">Cash so far</th></tr>
          <tr><td>Start</td><td></td><td></td><td class="r num">${Z.fmt(r.startup)}</td><td class="r num">${Z.fmt(-r.startup)}</td><td class="r num" style="color:var(--bad)">${Z.fmt(r.cum0)}</td></tr>
          ${rows.map((x) => `<tr style="${x.m === be || x.m === pb ? 'background:var(--ok-soft)' : ''}"><td>${x.m}${x.m === be ? ' · break-even' : ''}${x.m === pb ? ' · payback' : ''}</td><td class="r num">${Z.fmt(x.customers)}</td><td class="r num">${Z.fmt(x.revenue)}</td><td class="r num">${Z.fmt(x.costs)}</td>
            <td class="r num" style="color:var(--${x.profit < 0 ? 'bad' : 'ok'})">${Z.fmt(x.profit)}</td><td class="r num" style="color:var(--${x.cum < 0 ? 'bad' : 'ok'})">${Z.fmt(x.cum)}</td></tr>`).join('')}</table></div>
        <p class="hint">Money in = customers × monthly bill + install fees. Costs = running costs + routers for new customers${r.loanPay ? ' + the loan payment' : ''}.</p></div>`;
  }

  async function planPage(el, p) {
    const forecast = p.status === 'live';
    const locked = p.status === 'waiting' || p.status === 'closed';
    const work = { plan: M.norm(clone(p.plan)), launch: p.launch_date };
    let H = Z.get('pj_h', 36);
    const tabs = tabsHtml(p, forecast ? 'forecast' : 'plan');
    el.innerHTML = `
      <a class="back" href="#projects">← Projects</a>
      <div class="row" style="justify-content:space-between;align-items:baseline"><h2 style="margin-bottom:4px" id="pj-title">${Z.esc(p.name)}</h2><span class="pill ${STAGE[p.status][1]}">${STAGE[p.status][0]}</span></div>
      <p class="hint" style="margin-top:0">${p.area ? Z.esc(Z.areaName(p.area)) : 'New area — not in Zuri yet'}${p.notes ? ' · ' + Z.esc(p.notes) : ''} <button type="button" class="btn sec small" id="pj-edit-head" aria-label="Change the name, area or notes" style="padding:4px 12px">✏️ Name & area</button></p>
      ${tabs}
      ${forecast ? `<div class="card" id="pj-fc-head" style="border-left:4px solid var(--accent)"><b>📝 Current forecast</b><p class="hint" style="margin:4px 0 0">The plan you approved on ${Z.esc(Z.day((p.approved_at || '').slice(0, 10)))} is locked as the yardstick and never changes. Here you update what you now <b>expect</b> — a new quote, a later launch, slower sign-ups. Saving asks <b>why</b>, and the log keeps every change.</p>
        <label for="pj-launch">Launch month (month 1)</label><input type="date" id="pj-launch" value="${Z.esc(p.launch_date || '')}"></div>` : ''}
      ${p.status === 'plan' ? `<div class="hint" id="pj-saved" style="text-align:right;margin:0 0 6px">Saves by itself as you type.</div>` : ''}
      <a class="card row" id="pj-top" href="#" style="text-decoration:none;color:inherit;border-left:4px solid var(--ok);flex-wrap:nowrap"><div class="grow" id="pj-top-t"></div><span class="hint" style="margin:0;white-space:nowrap">the answer ↓</span></a>
      <div id="pj-ed">${editorHtml({ plan: work.plan }, locked, { open: Z.get('pj_open', 'start') })}</div>
      ${forecast ? '<div class="row" style="margin-bottom:12px"><button type="button" class="btn" id="pj-fc-save">💾 Save the forecast…</button><span class="hint" id="pj-fc-n" style="margin:0"></span></div>' : ''}
      <h3>The answer</h3>
      <div id="pj-res"></div>
      <div id="pj-decide"></div>
      <h3>Share with the partners</h3>
      <div class="card row" id="pj-share"><button type="button" class="btn" id="pj-copy">📋 Copy for WhatsApp</button><a class="btn sec" id="pj-print" href="#projects/${p.id}/print">🖨 One-page report</a><a class="btn sec" href="#projects/new/${p.id}">📄 Copy as a new project</a></div>`;
    const ed = Z.$('#pj-ed', el), res = Z.$('#pj-res', el);
    const zArpu = await zuriArpu(), zBh = await zuriBackhaul();
    const realPb = forecast && p.launch_date ? await trackOf(p).then((x) => (x && x.a.K ? x.t.J.payback : null)).catch(() => null) : null;
    const totals = () => {
      const r = M.model(work.plan);
      Z.$('#pj-start-total', el).textContent = kesS(r.startup);
      Z.$('#pj-run-total', el).textContent = kesS(r.run.total) + '/mo';
      Z.$('#pj-rev-total', el).textContent = (work.plan.rev.arpu ? kesS(work.plan.rev.arpu) + ' bill' : '');
      Z.$('#pj-loan-total', el).textContent = work.plan.loan.on && r.loanAmt ? kesS(r.loanPay) + '/mo' : '';
      Z.$('#pj-loan-pay', el).innerHTML = work.plan.loan.on && r.loanAmt ? `Monthly repayment <b>${kes(r.loanPay)}</b> for ${r.loanN} months — total interest ${kes(r.loanPay * r.loanN - r.loanAmt)}. It is counted in the costs below.` : '';
      Z.$$('.pj-f[data-mode]', el).forEach((x) => (x.hidden = x.dataset.mode !== work.plan.rev.mode));
      const at = (m) => r.rows[m - 1] ? Math.round(r.rows[m - 1].customers) : 0;
      Z.$('#pj-have', el).textContent = `→ With ${work.plan.rev.churn_pct || 0}% leaving each month you will have about ${Z.fmt(at(6))} customers at month 6, ${Z.fmt(at(12))} at month 12 and ${Z.fmt(at(24))} at month 24${N(work.plan.rev.homes) ? ` (out of ${Z.fmt(work.plan.rev.homes)} homes passed)` : ''}.`;
      Z.$('#pj-top-t', el).innerHTML = `Start-up <b>${kesS(r.startup)}</b> · ${r.payback == null ? '<b style="color:var(--bad)">never pays back</b>' : r.payback === 0 ? '<b>no money to recover</b>' : `pays back in <b>month ${r.payback}</b>`}${r.breakEven ? ` · break-even month ${r.breakEven}` : ''}`;
      res.innerHTML = resultsHtml({ ...p, plan: work.plan, launch_date: work.launch || p.launch_date }, r, { months: H, baseline: forecast ? p.baseline : null, real: realPb });
      Z.$$('#pj-h [data-h]', res).forEach((b) => (b.onclick = () => { H = +b.dataset.h; Z.set('pj_h', H); totals(); }));
      if (forecast) { const n = M.diff(p.plan, work.plan).length + (work.launch !== p.launch_date ? 1 : 0); Z.$('#pj-fc-n', el).textContent = n ? `${n} change${n > 1 ? 's' : ''} not saved yet` : 'No changes yet.'; }
    };
    const az = Z.$('#pj-arpu-zuri', el);
    if (zArpu && az) { az.hidden = false; az.innerHTML = `<div class="row"><div class="grow"><b>From Zuri A today: ${kes(zArpu.v)} a month</b><div class="hint" style="margin:0">${Z.esc(zArpu.how)}</div></div>${locked ? '' : '<button type="button" class="btn sec small" id="pj-arpu-use">Use it</button>'}</div>`; }
    const bz = Z.$('#pj-bh-zuri', el);
    if (zBh && bz) bz.innerHTML = `Zuri A pays ${kes(zBh.v)} a month today (${Z.esc(zBh.how)}). ${locked ? '' : '<a href="#" id="pj-bh-use">Use it</a>'}`;
    let saveT = null;
    const saveNow = async () => { saveT = null; try { await S.savePlan(p.id, { plan: work.plan }); p.plan = clone(work.plan); const s = Z.$('#pj-saved', el); if (s) s.textContent = '✓ Saved'; } catch (e) { Z.fail(e); const s = Z.$('#pj-saved', el); if (s) s.textContent = '⚠️ Not saved'; } };
    const autosave = () => {
      if (p.status !== 'plan') return;
      clearTimeout(saveT);
      Z.$('#pj-saved', el).textContent = 'Saving…';
      saveT = setTimeout(saveNow, 400);
    };
    // leaving the page (another screen, closing the tab, the phone locking) saves a pending change straight away
    const leave = () => { if (saveT) { clearTimeout(saveT); saveNow(); } };
    window.addEventListener('hashchange', leave, { once: true });
    window.addEventListener('pagehide', leave, { once: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); });
    const changed = () => { totals(); autosave(); };
    const wire = () => {
      Z.$$('input[data-k]', ed).forEach((i) => (i.oninput = () => { const v = Z.num(i.value); setK(work.plan, i.dataset.k, v == null ? 0 : v); if (i.dataset.k === 'run.backhaul') { work.plan.run.backhaul_preset = ''; Z.$('#pj-bh-preset', el).value = ''; } changed(); }));
      Z.$$('input[data-o]', ed).forEach((i) => (i.oninput = () => { const [sec, idx, f] = i.dataset.o.split('.'); work.plan[sec].other[+idx][f] = f === 'amount' ? (Z.num(i.value) || 0) : i.value; changed(); }));
      Z.$$('[data-oadd]', ed).forEach((b) => (b.onclick = () => { work.plan[b.dataset.oadd].other.push({ label: '', amount: 0 }); redraw(b.dataset.oadd === 'start' ? 'start' : 'run'); changed(); const ins = Z.$$(`.pj-others[data-sec="${b.dataset.oadd}"] input[data-o$=".label"]`, el); if (ins.length) ins[ins.length - 1].focus(); }));
      Z.$$('[data-orm]', ed).forEach((b) => (b.onclick = () => { const [sec, idx] = b.dataset.orm.split('.'); work.plan[sec].other.splice(+idx, 1); redraw(sec === 'start' ? 'start' : 'run'); changed(); }));
      Z.$$('#pj-cpe-who [data-who]', ed).forEach((b) => (b.onclick = () => { work.plan.cpe.who = b.dataset.who; Z.$$('#pj-cpe-who [data-who]', ed).forEach((x) => x.classList.toggle('on', x === b)); changed(); }));
      Z.$$('#pj-mode [data-mode]', ed).forEach((b) => (b.onclick = () => { work.plan.rev.mode = b.dataset.mode; Z.$$('#pj-mode [data-mode]', ed).forEach((x) => x.classList.toggle('on', x === b)); changed(); }));
      const lo = Z.$('#pj-loan-on', ed); if (lo) lo.onchange = () => { work.plan.loan.on = lo.checked; Z.$('#pj-loan-f', ed).hidden = !lo.checked; changed(); };
      const bp = Z.$('#pj-bh-preset', ed); if (bp) bp.onchange = () => {
        const pr = BH_PRESETS.find((x) => x[0] === bp.value); work.plan.run.backhaul_preset = bp.value;
        if (pr && pr[2] != null) { work.plan.run.backhaul = pr[2]; Z.$('#pj-run-backhaul', ed).value = pr[2]; }
        if (bp.value === 'starlink' && !work.plan.start.other.some((o) => /starlink/i.test(o.label))) { work.plan.start.other.push({ label: 'Starlink kit', amount: 49900 }); redraw('run'); }
        changed();
      };
      Z.$$('details', ed).forEach((d) => (d.ontoggle = () => { if (d.open) Z.set('pj_open', d.id.replace('pj-', '')); }));
    };
    const redraw = (open) => { ed.innerHTML = editorHtml({ plan: work.plan }, locked, { open }); wire(); };
    wire();
    const au = Z.$('#pj-arpu-use', el); if (au) au.onclick = () => { work.plan.rev.arpu = zArpu.v; const i = Z.$('#pj-rev-arpu', el); if (i) i.value = zArpu.v; changed(); Z.toast('Monthly bill set to ' + kes(zArpu.v) + '.'); };
    const bu = Z.$('#pj-bh-use', el); if (bu) bu.onclick = (e) => { e.preventDefault(); work.plan.run.backhaul = zBh.v; work.plan.run.backhaul_preset = ''; Z.$('#pj-run-backhaul', el).value = zBh.v; Z.$('#pj-bh-preset', el).value = ''; changed(); };
    const ln = Z.$('#pj-launch', el); if (ln) ln.onchange = () => { work.launch = ln.value || p.launch_date; totals(); };
    totals();
    Z.$('#pj-top', el).onclick = (e) => { e.preventDefault(); Z.$('#pj-answer', el).scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    Z.$('#pj-edit-head', el).onclick = () => headSheet(p);
    Z.$('#pj-copy', el).onclick = () => copyText(planText({ ...p, plan: work.plan }));
    const fs = Z.$('#pj-fc-save', el); if (fs) fs.onclick = () => forecastSheet(p, work);
    await decideBox(Z.$('#pj-decide', el), p);
  }

  function tabsHtml(p, on) {
    const t = p.status === 'live' || p.status === 'closed'
      ? [['track', '📊 Actual vs plan'], ['forecast', '📝 Forecast'], ['log', '📜 Log']]
      : [['plan', '📝 Plan'], ['log', '📜 Log']];
    return `<div class="seg" id="pj-tabs" style="margin-bottom:12px">${t.map(([k, l]) => `<a href="#projects/${p.id}/${k === 'forecast' ? 'plan' : k}" data-tab="${k}" class="${k === on ? 'on' : ''}">${l}</a>`).join('')}</div>`;
  }

  function headSheet(p) {
    const sh = Z.sheet('✏️ ' + p.name, `<form id="ph-f"><label for="ph-name">Name</label><input id="ph-name" name="name" value="${Z.esc(p.name)}" required maxlength="80">
      <label for="ph-area">Service area</label><select id="ph-area" name="area"><option value="">A new area — not in Zuri yet</option>${Z.opts(Z.ref.areas.map((a) => [a.code, a.name]), p.area || '')}</select>
      <label for="ph-notes">Notes</label><textarea id="ph-notes" name="notes">${Z.esc(p.notes || '')}</textarea>
      <div style="height:12px"></div><button class="btn block">Save</button></form>
      ${p.status === 'plan' ? '<div style="height:10px"></div><button type="button" class="btn sec block" id="ph-del">🗑️ Delete this plan</button>' : ''}
      ${p.status === 'live' ? '<div style="height:10px"></div><button type="button" class="btn sec block" id="ph-close">📦 Close this project…</button>' : ''}`);
    Z.$('#ph-f', sh.el).onsubmit = async (e) => {
      e.preventDefault(); const d = Z.formData(e.target);
      if (!d.name.trim()) return Z.toast('Give it a name.');
      try { await S.savePlan(p.id, { name: d.name.trim(), area: d.area || null, notes: d.notes.trim() || null }); await S.log(p.id, 'details', null, M.diff({}, {}).concat(d.name.trim() !== p.name ? [{ label: 'Name', from: p.name, to: d.name.trim() }] : []).concat((d.area || null) !== (p.area || null) ? [{ label: 'Area', from: p.area, to: d.area || null }] : [])); sh.close(); Z.toast('Saved.'); Z.route(); } catch (err) { Z.fail(err); }
    };
    const del = Z.$('#ph-del', sh.el); if (del) del.onclick = async () => { if (!confirm(`Delete the plan "${p.name}"? This cannot be undone.`)) return; try { await S.remove(p.id); sh.close(); Z.toast('Deleted.'); Z.go('projects'); } catch (err) { Z.fail(err); } };
    const cl = Z.$('#ph-close', sh.el); if (cl) cl.onclick = async () => { const why = prompt('Why close it? (e.g. finished — part of Zuri now; or stopped)'); if (!why || why.trim().length < 3) return; try { await S.close(p.id, why.trim()); sh.close(); Z.toast('Closed. It stays in the list under Closed.'); Z.route(); } catch (err) { Z.fail(err); } };
  }

  function forecastSheet(p, work) {
    const ch = M.diff(p.plan, work.plan);
    if (work.launch && work.launch !== p.launch_date) ch.push({ path: 'launch_date', label: 'Launch month', from: p.launch_date, to: work.launch });
    if (!ch.length) return Z.toast('Nothing changed yet — change a number first.');
    const sh = Z.sheet('💾 Save the forecast', `<p class="hint" style="margin-top:0">These changes go into the current forecast. The locked plan stays as it was, so you can always compare.</p>
      <div class="list" id="pf-changes">${ch.map((c) => `<div class="item"><div class="grow"><div class="t">${Z.esc(c.label)}</div><div class="m">${Z.esc(nf(c.from))} → <b>${Z.esc(nf(c.to))}</b></div></div></div>`).join('')}</div>
      <label for="pf-why">Why? (the partners will read this)</label><textarea id="pf-why" maxlength="400" placeholder="e.g. Kamau Hardware's fiber quote went up to 310,000 a km"></textarea>
      <div style="height:12px"></div><button type="button" class="btn block" id="pf-go">Save the forecast</button>`);
    Z.$('#pf-go', sh.el).onclick = async () => {
      const why = Z.$('#pf-why', sh.el).value.trim();
      if (why.length < 3) return Z.toast('Say why in a few words — the partners will read it.');
      try { await S.revise(p.id, work.plan, why, ch, work.launch !== p.launch_date ? work.launch : null); sh.close(); Z.toast('Forecast saved and logged.'); Z.go('projects/' + p.id + '/track'); } catch (e) { Z.fail(e); }
    };
  }

  // ---------- GO: "We're doing it" and the second OK ----------
  async function decideBox(box, p) {
    if (!box) return;
    if (p.status === 'plan') {
      box.innerHTML = `<h3>The decision</h3><div class="card" id="pj-go-card" style="border-left:4px solid var(--ok)">
        <b>Agreed with the partners?</b>
        <p class="hint" style="margin:4px 0 8px">Tap <b>✅ We're doing it</b> when you have decided. A <b>second</b> partner or finance person then approves it on their own phone. The plan is then <b>locked</b> as the yardstick (the baseline): later you update a forecast and record what really happens, and Zuri compares them every month.</p>
        <button type="button" class="btn" id="pj-go">✅ We're doing it</button></div>`;
      Z.$('#pj-go', box).onclick = () => goSheet(p);
      return;
    }
    if (p.status === 'waiting') {
      const mine = p.go_requested_by === Z.me.id, selfOk = await S.selfOk();
      const who = p.go_requested_name || Z.personName(p.go_requested_by) || 'someone';
      const switchTo = Z.practice ? (Z.me.id === 'p-jerry' ? ['finance', 'Kelvin'] : ['admin', 'Jerry']) : null;
      box.innerHTML = `<h3>The decision</h3><div class="card" id="pj-wait" style="border-left:4px solid var(--warn)">
        <b>⏳ Waiting for a second OK</b>
        <p class="hint" style="margin:4px 0 8px">${Z.esc(who)} said “we're doing it” on ${Z.esc(Z.when(p.go_requested_at))}, launching ${Z.esc(monthName((p.launch_date || '').slice(0, 7)))}. ${mine && !selfOk ? 'Someone else must approve it — the same rule as money out.' : 'Check the numbers above, then approve to lock the plan.'} The plan can't be changed while it waits.</p>
        <div class="row">${!mine || selfOk ? '<button type="button" class="btn" id="pj-approve">✅ Approve — lock the plan</button>' : ''}<button type="button" class="btn sec" id="pj-withdraw">↩ ${mine ? 'Withdraw' : 'Not yet — send it back'}</button></div>
        ${switchTo && mine ? `<div class="row" style="margin-top:8px"><button type="button" class="btn sec small" id="pj-switch">🎭 Practice: switch to ${switchTo[1]} to approve</button><span class="hint" style="margin:0;align-self:center">In real life: a second phone and a second login.</span></div>` : ''}</div>`;
      const ap = Z.$('#pj-approve', box); if (ap) ap.onclick = async () => { ap.disabled = true; try { await S.approveGo(p.id); Z.toast('🚀 Approved — the plan is locked. Record what happens each month.'); Z.go('projects/' + p.id + '/track'); } catch (e) { ap.disabled = false; Z.fail(e); } };
      Z.$('#pj-withdraw', box).onclick = async () => { const why = prompt(mine ? 'Why withdraw? (optional)' : 'Why send it back? (the partner will read this)') ; if (why === null) return; try { await S.withdrawGo(p.id, why.trim() || null); Z.toast('Back to planning.'); Z.route(); } catch (e) { Z.fail(e); } };
      const sw = Z.$('#pj-switch', box); if (sw) sw.onclick = () => { window.ZP.pickRole(switchTo[0]); history.replaceState(null, '', location.pathname + '?practice#projects/' + p.id); location.reload(); };
    }
  }
  function goSheet(p) {
    const r = M.model(p.plan);
    const sh = Z.sheet("✅ We're doing it", `<p class="hint" style="margin-top:0">${Z.esc(p.name)}: start-up ${kes(r.startup)}, pays back in ${mWord(r.payback)}.</p>
      <label for="pj-go-launch">Launch month (month 1 — the first month with customers)</label><input type="date" id="pj-go-launch" value="${nextMonthStart()}">
      <p class="hint">After this, a second partner approves on their own phone. Then this plan is locked as the yardstick. You can still update a forecast later — with a reason, and logged.</p>
      <button type="button" class="btn block" id="pj-go-ok">Send for the second OK</button>`);
    Z.$('#pj-go-ok', sh.el).onclick = async () => {
      const d = Z.$('#pj-go-launch', sh.el).value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return Z.toast('Pick the launch month.');
      try { const out = await S.requestGo(p.id, d.slice(0, 7) + '-01'); sh.close(); Z.toast(out && out.status === 'live' ? '🚀 Locked as the plan — it is live.' : 'Sent — a second partner now approves it.'); Z.route(); } catch (e) { Z.fail(e); }
    };
  }

  // ---------- TRACK: actual vs expected ----------
  async function trackPage(el, p) {
    const r = await trackOf(p);
    const { a, t } = r;
    const B = t.B, F2 = t.F, K = a.K;
    const st = STATE[t.state];
    const last = K ? a.months[K - 1] : null;
    const unconfirmed = a.months.filter((x) => !x.confirmed);
    const lastYm = K ? a.months[K - 1].ym : null;
    const pct = (x, y) => (y ? Math.round(((x - y) / Math.abs(y)) * 100) : null);
    // words, not + / −: for money in and cash "above / below plan", for costs "over / under plan"
    const vpill = (act, pl, hb, scale) => { if (!K && !(hb === false && act)) return ''; const c = M.rag(act, pl, hb, scale); const d = act - pl, pc = pct(act, pl); const w = hb === false ? (d > 0 ? 'over' : 'under') : (d >= 0 ? 'above' : 'below');
      return `<span class="pill ${c}">${kShort(Math.abs(d))} ${w}${pc != null ? ` · ${Math.abs(pc)}%` : ''}</span>`; };
    const sum = (arr, k) => arr.reduce((s, x) => s + N(x[k]), 0);
    const bRows = B.rows.slice(0, K), fRows = F2.rows.slice(0, K);
    const actStart = t.actualStart, planStart = B.startup;
    const H = Math.max(24, Math.min(60, (t.J.payback || 36) + 6, K + 24));
    el.innerHTML = `
      <a class="back" href="#projects">← Projects</a>
      <div class="row" style="justify-content:space-between;align-items:baseline"><h2 style="margin-bottom:4px">${Z.esc(p.name)}</h2><span class="pill ${STAGE[p.status][1]}">${STAGE[p.status][0]}</span></div>
      <p class="hint" style="margin-top:0">${p.area ? Z.esc(Z.areaName(p.area)) : 'New area'} · ${a.lym > Z.ym() ? 'starts' : 'launched'} ${Z.esc(monthName(a.lym))} · plan locked ${Z.esc(Z.day((p.approved_at || '').slice(0, 10)))}${p.approved_name || p.approved_by ? ' by ' + Z.esc(p.approved_name || Z.personName(p.approved_by)) : ''}</p>
      ${tabsHtml(p, 'track')}
      ${!K ? `<div class="card" id="pt-status"><b>🚀 ${a.lym > Z.ym() ? 'Approved — starts ' : 'Launched '}${Z.esc(monthName(a.lym))}</b><p class="hint" style="margin:4px 0 0">${a.lym > Z.ym() ? 'Month 1 has not started yet.' : 'The first full month isn\'t finished yet.'} Start recording what you spend on the build (start-up), and at the end of the month the customers and money collected. Plan: pays back in ${mWord(B.payback, p)}.</p></div>`
      : `<div class="card" id="pt-status" style="border-left:5px solid var(--${st[2]})">
        <div style="font-size:21px;font-weight:800">${st[0]} ${st[1]}</div>
        <p style="margin:6px 0 0;line-height:1.45">After <b>${K} month${K > 1 ? 's' : ''}</b>, ${Z.esc(p.name)} has ${t.diff >= 0 ? `<b>${kes(t.diff)} more</b>` : `<b>${kes(-t.diff)} less</b>`} cash than the plan expected (${kesS(t.rows[K - 1].cum)} against ${kesS(B.rows[K - 1].cum)}).
          ${last.customers != null ? ` Customers: <b>${Z.fmt(last.customers)}</b>, plan ${Z.fmt(bRows[K - 1].customers)}.` : ''}</p>
        <p style="margin:6px 0 0" id="pt-payback">With what really happened so far and the current forecast for the rest, you get your money back in <b>${mWord(t.J.payback, p)}</b> — the plan said ${mWord(B.payback, p)}.</p>
        <p class="hint" style="margin:6px 0 0">${t.state === 'on track' ? 'Within 5% of the start-up cost either way counts as on track.' : t.state === 'ahead' ? 'More cash than planned. Check it is real (all costs recorded?) before celebrating.' : 'Look at the months below: is it fewer customers, lower bills, or higher costs? Then decide what to change — and update the forecast so the payback month stays honest.'}</p></div>`}
      ${unconfirmed.length ? `<a class="alert warn" id="pt-nudge" href="#" style="display:block;text-decoration:none">📅 ${unconfirmed.length === 1 ? Z.esc(monthName(unconfirmed[0].ym)) + "'s" : unconfirmed.length + ' months\''} customers and money collected aren't confirmed yet${unconfirmed.some((x) => x.custSrc || x.revSrc !== 'nothing yet') ? ' (Zuri filled in what it found)' : ''}. Tap to confirm →</a>` : ''}
      <div class="kpis" id="pt-kpis">
        <div class="kpi"><div class="k">Start-up spent</div><div class="v num ${M.rag(actStart, planStart, false)}">${kShort(actStart)}</div><div class="f">plan ${kShort(planStart)} ${actStart ? vpill(actStart, planStart, false) : ''}</div></div>
        <div class="kpi"><div class="k">Customers now</div><div class="v num">${last && last.customers != null ? Z.fmt(last.customers) : '—'}</div><div class="f">plan ${K ? Z.fmt(bRows[K - 1].customers) : '—'} · forecast ${K ? Z.fmt(fRows[K - 1].customers) : '—'}</div></div>
        <div class="kpi"><div class="k">Money in so far</div><div class="v num">${kShort(sum(t.rows, 'revenue'))}</div><div class="f">plan ${kShort(sum(bRows, 'revenue'))} ${K ? vpill(sum(t.rows, 'revenue'), sum(bRows, 'revenue'), true) : ''}</div></div>
        <div class="kpi"><div class="k">Running costs so far</div><div class="v num">${kShort(sum(a.months, 'costs'))}</div><div class="f">${B.run.lines.find((l) => l.k === 'maint' && l.amount) && !a.manual.some((x) => x.kind === 'running' && x.line === 'maint') ? `<span style="display:block">⚠️ plan has maintenance ${kShort(B.run.lines.find((l) => l.k === 'maint').amount)}/mo — none recorded yet</span>` : ''}plan ${kShort(bRows.reduce((s, x) => s + x.running + x.routers, 0))} ${K ? vpill(sum(a.months, 'costs'), bRows.reduce((s, x) => s + x.running + x.routers, 0), false) : ''}</div></div>
      </div>
      <div class="card" id="pt-chart"><b>Cash: plan, forecast and what really happened</b>
        ${chartSvg([
          { name: 'Plan (locked)', color: 'var(--ink-faint)', dash: true, width: 2, points: cumPoints(B, H) },
          { name: 'Forecast (actual so far + forecast)', color: 'var(--accent)', width: 2.5, points: [[0, t.J.cum0]].concat(t.J.rows.slice(0, H).map((x) => [x.m, x.cum])) },
          { name: 'Actual', color: 'var(--brand)', width: 4, points: [[0, t.J.cum0]].concat(t.rows.map((x) => [x.m, x.cum])) },
        ], { months: H, marks: [{ m: K || null, label: 'today', color: 'var(--ink-soft)' }, { m: t.J.payback || null, label: 'payback', color: 'var(--ok)' }], label: 'Plan, forecast and actual cumulative cash' })}
        <p class="hint">Grey dashes: the plan you approved. Green: what really happened. Orange: where it is heading now — today's real cash plus the current forecast for the months ahead.</p></div>
      <div class="card" id="pt-table"><b>Month by month — actual against the plan</b>
        <div class="hint pj-swipe" style="margin:6px 0 0">↔ Swipe the table sideways to see every column.</div><div class="scroll-x" style="margin-top:4px"><table class="t" style="min-width:520px"><tr><th>Month</th><th class="r">Customers</th><th class="r">Money in</th><th class="r">Costs</th><th class="r">Profit</th><th class="r">Cash so far</th><th class="r">vs plan</th></tr>
          <tr><td>Start-up</td><td></td><td></td><td class="r num">${Z.fmt(a.start0)}<div class="hint" style="margin:0">plan ${Z.fmt(B.startup)}</div></td><td></td><td class="r num">${Z.fmt(t.J.cum0)}<div class="hint" style="margin:0">plan ${Z.fmt(B.cum0)}</div></td><td class="r">${vpill(t.J.cum0, B.cum0, true, B.startup)}</td></tr>
          ${t.rows.map((x, i) => { const b = bRows[i], am = a.months[i]; return `<tr><td>${x.m} · ${Z.esc(monthName(am.ym))}${am.confirmed ? '' : ' <span class="pill warn" title="not confirmed">?</span>'}</td>
            <td class="r num">${x.customers != null ? Z.fmt(x.customers) : '—'}<div class="hint" style="margin:0">plan ${Z.fmt(b.customers)}</div></td>
            <td class="r num">${Z.fmt(x.revenue)}<div class="hint" style="margin:0">plan ${Z.fmt(b.revenue)}</div></td>
            <td class="r num">${Z.fmt(x.costs)}<div class="hint" style="margin:0">plan ${Z.fmt(b.costs)}</div></td>
            <td class="r num" style="color:var(--${x.profit < 0 ? 'bad' : 'ok'})">${Z.fmt(x.profit)}<div class="hint" style="margin:0">plan ${Z.fmt(b.profit)}</div></td>
            <td class="r num">${Z.fmt(x.cum)}<div class="hint" style="margin:0">plan ${Z.fmt(b.cum)} · fc ${Z.fmt(fRows[i].cum)}</div></td>
            <td class="r">${vpill(x.cum, b.cum, true, B.startup)}</td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">No complete month yet.</td></tr>'}
        </table></div>
        <p class="hint">Green: on plan or better · orange: up to 15% worse · red: more than 15% worse (cash is measured against the start-up cost). “?” = not confirmed yet.</p></div>
      <div class="card" id="pt-lines"><b>Start-up: plan against spent, line by line</b>
        <table class="t">${startupLines(B, a).map((l) => `<tr><td>${Z.esc(l.label)}${l.k === 'cont' ? '<div class="hint" style="margin:0">a buffer, not a bill — it covers the lines that cost more</div>' : ''}</td><td class="r num">${l.k === 'cont' ? '' : Z.fmt(l.act)}<div class="hint" style="margin:0">plan ${Z.fmt(l.plan)}</div></td><td class="r">${l.k !== 'cont' && (l.plan || l.act) ? vpill(l.act, l.plan, false) : ''}</td></tr>`).join('')}
          <tr><td><b>Total</b></td><td class="r num"><b>${Z.fmt(actStart)}</b><div class="hint" style="margin:0">plan ${Z.fmt(planStart)} (with the buffer)</div></td><td class="r">${actStart ? vpill(actStart, planStart, false) : ''}</td></tr></table></div>
      <h3>What Zuri has for ${Z.esc(p.name)}</h3>
      <div class="card" id="pt-entries">
        <div class="row" style="justify-content:space-between"><b>Actuals</b><button type="button" class="btn" id="pt-add">＋ Record actuals</button></div>
        <p class="hint">Zuri pulls these by itself: <b>expenses and bills tagged to this project</b> (Money out → Project)${p.area ? `, and the <b>payments, other cash in and billing-website figures for ${Z.esc(Z.areaName(p.area))}</b>` : ''}. Type anything else here — and confirm each month's customers and money collected.</p>
        <div class="list" id="pt-list">${a.manual.slice().sort((x, y) => String(y.period).localeCompare(String(x.period)) || String(y.created_at).localeCompare(String(x.created_at))).map((x, i) => `<div class="item pt-entry" ${i >= 8 ? 'hidden' : ''}><div class="grow"><div class="t">${Z.esc(KIND_WORD[x.kind])}${x.line ? ' · ' + Z.esc(lineLabel(x)) : ''} · ${Z.esc(monthName(x.period))}</div><div class="m">${x.kind === 'customers' ? Z.fmt(x.amount) + ' customers' : kes(x.amount)}${x.note ? ' · ' + Z.esc(x.note) : ''} · ${Z.esc(x.by_name || Z.personName(x.created_by) || '')}${x.pending ? ' · <span class="pill warn">⏳ waiting to send</span>' : ''}</div></div>${x.pending ? '' : `<button type="button" class="btn sec small" data-adel="${Z.esc(x.id)}" aria-label="Remove this entry">✕</button>`}</div>`).join('') || '<div class="muted">Nothing typed yet.</div>'}</div>${a.manual.length > 8 ? `<button type="button" class="btn sec small" id="pt-more">Show all ${a.manual.length} entries</button>` : ''}
        ${a.tagged.length ? `<b style="display:block;margin-top:10px">From Money out (tagged to this project) · ${a.tagged.length}</b><div class="list">${a.tagged.slice().sort((x, y) => String(y.date).localeCompare(String(x.date))).slice(0, 12).map((e) => `<div class="item"><div class="grow"><div class="t">${Z.esc(e.payee)}</div><div class="m">${Z.esc(Z.day(e.date))} · ${Z.esc(e.category || '')} · ${e.date < p.launch_date ? 'start-up' : 'running'}${e.approval === 'waiting' ? ' · ⏳ waiting for OK' : ''}</div></div><b class="num">${Z.fmt(e.amount)}</b></div>`).join('')}</div>` : ''}
        ${a.cur ? `<p class="hint" id="pt-now">This month so far (${Z.esc(monthName(a.cur.ym))}): money in ${kes(a.cur.revenue)} · costs ${kes(a.cur.costs + a.cur.startup)} — it joins the table when the month ends.</p>` : ''}
      </div>
      <div class="card row" id="pt-share"><a class="btn sec" href="#projects/${p.id}/plan" id="pt-fc">📝 Update the forecast</a><button type="button" class="btn" id="pt-copy">📋 Copy for WhatsApp</button><a class="btn sec" href="#projects/${p.id}/print" id="pt-print">🖨 One-page report</a></div>`;
    Z.$('#pt-add', el).onclick = () => actualSheet(p, a, lastYm);
    const more = Z.$('#pt-more', el); if (more) more.onclick = () => { Z.$$('#pt-list .pt-entry', el).forEach((x) => (x.hidden = false)); more.remove(); };
    const ng = Z.$('#pt-nudge', el); if (ng) ng.onclick = (e) => { e.preventDefault(); actualSheet(p, a, unconfirmed[unconfirmed.length - 1].ym, unconfirmed[unconfirmed.length - 1]); };
    Z.$$('[data-adel]', el).forEach((b) => (b.onclick = async () => { const x = a.manual.find((m) => m.id === b.dataset.adel); if (!x || !confirm('Remove this entry?')) return; try { await S.delActual(x); Z.toast('Removed.'); Z.route(); } catch (e) { Z.fail(e); } }));
    Z.$('#pt-copy', el).onclick = () => copyText(trackText(p, a, t));
  }
  function startupLines(B, a) {
    const out = B.start.lines.map((l) => ({ k: l.k, label: l.label, plan: l.amount, act: 0 }));
    out.push({ k: 'cont', label: 'Contingency', plan: B.start.contingency, act: 0 });
    a.manual.filter((x) => x.kind === 'startup').forEach((x) => { const l = out.find((o) => o.k === (x.line || '')) || out.find((o) => o.k === 'other' && o.extra) || (() => { const o = { k: 'other', extra: true, label: 'Other start-up', plan: 0, act: 0 }; out.push(o); return o; })(); l.act += N(x.amount); });
    const tg = a.before.reduce((t, e) => t + N(e.amount), 0) + a.tagged.filter((e) => false).length;
    if (tg) out.push({ k: 'tagged', label: 'From Money out (before launch)', plan: 0, act: tg });
    return out.filter((l) => l.plan || l.act);
  }

  function actualSheet(p, a, ym, prefill) {
    const lym = a.lym;
    const periods = []; for (let k = -2; k <= a.K + 1; k++) periods.push(M.ymAdd(lym, k - 1));
    const def = ym || M.ymAdd(lym, -1);
    const sh = Z.sheet('＋ Record actuals', `<form id="pa-f">
      <label for="pa-month">Which month</label><select id="pa-month" name="period">${Z.opts(periods.map((x) => [x, monthName(x) + (x < lym ? ' · before launch' : ' · month ' + M.monthIndex(lym, x))]).reverse(), def)}</select>
      <label>What</label><div class="seg" id="pa-kind">${Object.entries(KIND_WORD).map(([k, t]) => `<button type="button" data-kind="${k}">${t}</button>`).join('')}</div>
      <div id="pa-line-box" hidden><label for="pa-line">Which line</label><select id="pa-line" name="line"></select></div>
      <div id="pa-step" style="font-weight:800;font-size:17px;margin:12px 0 0;color:var(--brand)"></div>
      <label for="pa-amount" id="pa-amount-l">Amount (KES)</label><input id="pa-amount" name="amount" inputmode="decimal" required>
      <div class="hint" id="pa-hint"></div>
      <label for="pa-note">Note (optional)</label><input id="pa-note" name="note" maxlength="200" placeholder="e.g. from the Billnasi report for Zuri D">
      <div style="height:12px"></div><button class="btn block" id="pa-save">Save</button></form>`);
    let kind = prefill ? 'customers' : 'startup';
    const setKind = (k) => {
      kind = k;
      Z.$$('#pa-kind [data-kind]', sh.el).forEach((b) => b.classList.toggle('on', b.dataset.kind === k));
      const lines = k === 'startup' ? M.START_LINES.concat([['other', 'Other']]) : k === 'running' ? M.RUN_LINES.concat([['other', 'Other']]) : null;
      Z.$('#pa-line-box', sh.el).hidden = !lines;
      if (lines) Z.$('#pa-line', sh.el).innerHTML = Z.opts(lines);
      Z.$('#pa-amount-l', sh.el).textContent = k === 'customers' ? 'Customers connected at the end of the month (a number of people)' : k === 'revenue' ? 'Money collected in the month (KES)' : 'Amount (KES)';
      Z.$('#pa-step', sh.el).textContent = prefill && k === 'customers' ? 'Step 1 of 2 · 👥 Customers' : prefill && k === 'revenue' ? 'Step 2 of 2 · 💰 Money collected (KES)' : '';
      const cur = prefill || a.months.find((x) => x.ym === Z.$('#pa-month', sh.el).value) || a.cur;
      Z.$('#pa-hint', sh.el).textContent = k === 'customers' ? (cur && cur.customers != null ? `Zuri found ${Z.fmt(cur.customers)} (${cur.custSrc}). Check the number, then Save.` : 'From the billing website: active customers in this area at month end.')
        : k === 'revenue' ? (cur && cur.revenue ? `Zuri found ${kes(cur.revenue)} (${cur.revSrc}). Check it (or type the real total), then Save — it replaces Zuri's figure for that month.` : 'Everything collected in the month: monthly bills, install fees, hotspot.')
        : k === 'running' ? 'Only costs NOT already in Money out (tagged expenses count by themselves).' : 'Build money spent — only what is NOT already in Money out tagged to this project.';
      if (prefill && (k === 'customers' || k === 'revenue')) { const v = k === 'customers' ? prefill.customers : prefill.revenue; Z.$('#pa-amount', sh.el).value = v != null && v !== 0 ? Math.round(v) : ''; }
    };
    Z.$$('#pa-kind [data-kind]', sh.el).forEach((b) => (b.onclick = () => setKind(b.dataset.kind)));
    Z.$('#pa-month', sh.el).onchange = () => setKind(kind);
    setKind(kind);
    Z.$('#pa-f', sh.el).onsubmit = async (e) => {
      e.preventDefault();
      const d = Z.formData(e.target), amt = Z.num(d.amount);
      if (amt == null || amt < 0) return Z.toast(kind === 'customers' ? 'Type how many customers.' : 'Type the amount.');
      // a number of customers typed into the money box (or the other way round) — ask before saving
      if (kind === 'revenue' && amt > 0 && amt < 1000 && !confirm(`Money collected: KES ${Z.fmt(amt)} for the whole month? That looks like a number of customers. Save it anyway?`)) return;
      if (kind === 'customers' && amt > 20000 && !confirm(`${Z.fmt(amt)} customers? That looks like an amount of money. Save it anyway?`)) return;
      try {
        const how = await S.addActual({ project_id: p.id, period: d.period, kind, line: kind === 'startup' || kind === 'running' ? d.line : null, amount: amt, note: d.note.trim() || null });
        Z.toast((how === 'queued' ? '📴 Saved on this phone — it sends when there is signal.' : 'Saved.') + (prefill && kind === 'customers' ? ' Now the money collected.' : ''));
        if (prefill && kind === 'customers') { Z.$('#pa-amount', sh.el).value = ''; Z.$('#pa-note', sh.el).value = ''; setKind('revenue'); return; }
        sh.close(); Z.route();
      } catch (err) { Z.fail(err); }
    };
  }

  // ---------- the log ----------
  const nf = (v) => (v == null || v === '' ? '—' : typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)) ? Number(v).toLocaleString('en-KE') : v);
  async function logPage(el, p) {
    const rev = await S.revisions(p.id);
    const word = { created: '🆕 Created', details: '✏️ Name / area', go_requested: '✅ We\'re doing it — sent for a second OK', go_withdrawn: '↩ Sent back to planning', go_approved: '🔒 Approved — plan locked', forecast: '📝 Forecast updated', actual: '📊 Actuals', closed: '📦 Closed', imported: '⬆️ Moved from a phone into the database' };
    el.innerHTML = `<a class="back" href="#projects">← Projects</a><h2>${Z.esc(p.name)}</h2>${tabsHtml(p, 'log')}
      <div class="card" id="pl-head"><b>📜 Every change, with who, when and why</b><p class="hint" style="margin:4px 0 0">${p.baseline ? 'The locked plan (baseline) never changes; forecast updates and actuals are listed here.' : 'While it is a plan, the numbers save as you type; the big steps are listed here.'}</p></div>
      <div class="card list" id="pl-list">${rev.map((r) => `<div class="item" style="align-items:flex-start"><div class="grow"><div class="t">${word[r.kind] || Z.esc(r.kind)}</div>
        <div class="m">${Z.esc(Z.when(r.at))} · ${Z.esc(r.by_name || Z.personName(r.by) || 'someone')}${r.why ? ' · “' + Z.esc(r.why) + '”' : ''}</div>
        ${(r.changes || []).length ? `<div class="m" style="margin-top:2px">${(r.changes || []).slice(0, 12).map((c) => `${Z.esc(c.label)}: ${Z.esc(nf(c.from))} → <b>${Z.esc(nf(c.to))}</b>`).join('<br>')}</div>` : ''}</div></div>`).join('') || '<div class="muted">Nothing logged yet.</div>'}</div>`;
  }

  // ---------- compare ----------
  async function comparePage(el) {
    const all = (await S.list()).filter((p) => p.status !== 'closed');
    const ms = all.map((p) => M.model(p.plan));
    const real = await Promise.all(all.map((p) => (p.status === 'live' && p.launch_date ? trackOf(p).then((x) => (x && x.a.K ? x.t.J.payback : undefined)).catch(() => undefined) : undefined)));
    const row = (label, f, cls) => `<tr><td><b>${label}</b></td>${ms.map((r, i) => `<td class="r num" ${cls ? `style="color:var(--${cls(r) })"` : ''}>${f(r, all[i])}</td>`).join('')}</tr>`;
    const best = (vals, low) => { const v = vals.filter((x) => x != null); return v.length ? (low ? Math.min(...v) : Math.max(...v)) : null; };
    const bestPb = best(ms.map((r) => r.payback), true);
    const colors = ['var(--brand)', 'var(--accent)', 'var(--bad)', 'var(--ok)', 'var(--ink-faint)'];
    el.innerHTML = `<a class="back" href="#projects">← Projects</a><h2>⚖️ Compare projects</h2>
      <p class="hint">Side by side, from each plan (live projects: the current forecast; the row “with real results so far” mixes in what really happened). Which area gives the money back sooner, for how much risk?</p>
      <div class="card scroll-x" id="pc-table"><table class="t"><tr><th></th>${all.map((p) => `<th class="r">${Z.esc(p.name)}<div class="hint" style="margin:0;text-transform:none">${STAGE[p.status][0]}</div></th>`).join('')}</tr>
        ${row('Start-up', (r) => kShort(r.startup))}
        ${row('Running a month', (r) => kShort(r.run.total))}
        ${row('Customers at month 24', (r) => Z.fmt(r.rows[23].customers))}
        ${row('Break-even', (r) => (r.breakEven == null ? 'never' : 'month ' + r.breakEven))}
        ${row('Payback', (r) => (r.payback == null ? 'never' : r.payback === 0 ? 'start' : 'month ' + r.payback) + (r.payback != null && r.payback === bestPb && all.length > 1 ? ' ⭐' : ''))}
        ${all.some((p, i) => real[i] !== undefined) ? row('Payback with real results so far', (r, p) => { const x = real[all.indexOf(p)]; return x === undefined ? '—' : x == null ? 'never' : 'month ' + x; }) : ''}
        ${row('Own money in (start-up − loan)', (r) => kShort(r.loanAmt ? r.own : r.startup))}
        ${row('Most money tied up', (r) => kShort(-Math.min(0, r.low.v)))}
        ${row('Profit in 3 years', (r) => kShort(r.profitN(36)), (r) => (r.profitN(36) < 0 ? 'bad' : 'ok'))}
        ${row('Cash after 3 years', (r) => kShort(r.cashN(36)), (r) => (r.cashN(36) < 0 ? 'bad' : 'ok'))}
        ${row('3-year ROI', (r) => (r.roi(36) == null ? '—' : Math.round(r.roi(36)) + '%'))}
        ${row('Payback if take-up is low (70%)', (r, p) => { const x = M.model(p.plan, { takeup: 0.7 }).payback; return x == null ? 'never' : 'month ' + x; })}
      </table></div>
      <div class="card" id="pc-chart"><b>Cash over 5 years</b>${chartSvg(ms.map((r, i) => ({ name: all[i].name, color: colors[i % colors.length], points: cumPoints(r, 60) })), { months: 60, label: 'Cumulative cash of each project' })}
        <p class="hint">A smaller project can pay back sooner even if a bigger one makes more money in the end. Look at both: payback (how long your money is at risk) and cash after 3 years (how much it makes).</p></div>
      <div class="card row"><button type="button" class="btn" id="pc-copy">📋 Copy for WhatsApp</button></div>`;
    Z.$('#pc-copy', el).onclick = () => copyText(['*📈 Zuri — comparing new areas*', ...all.map((p, i) => { const r = ms[i]; return `*${p.name}*: start-up KES ${kShort(r.startup)} · pays back ${r.payback == null ? 'never (10 yrs)' : 'month ' + r.payback} · 3-yr profit KES ${kShort(r.profitN(36))} · low take-up: ${(() => { const x = M.model(p.plan, { takeup: 0.7 }).payback; return x == null ? 'never' : 'month ' + x; })()}`; }), '', '_From Zuri System → 📈 Projects_'].join('\n'));
  }

  // ---------- share: WhatsApp text and the one-page report ----------
  function copyText(text) { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => Z.toast('Copied — paste it into the partners\' WhatsApp group.'), () => { Z.sheet('Copy this', `<textarea style="min-height:240px" readonly>${Z.esc(text)}</textarea>`); }); }
  Z.projectsCopy = copyText;
  function planText(p) {
    const r = M.model(p.plan), pl = M.norm(p.plan);
    const low = M.model(p.plan, { takeup: 0.7 }), high = M.model(p.plan, { takeup: 1.3 });
    return [
      `*📈 ${p.name} — new area plan*`, p.notes ? '_' + p.notes + '_' : '', '',
      `*The answer:* ${r.payback == null ? `with these numbers the KES ${kShort(r.startup)} start-up is NOT paid back within 10 years.` : r.payback === 0 ? 'the loan covers the start-up and cash never goes below zero.' : r.loanAmt ? `we get our own KES ${kShort(r.own)} back in month ${r.payback} (start-up KES ${kShort(r.startup)} − loan KES ${kShort(r.loanAmt)}; the loan repayments are counted every month${r.loanLeft(r.payback) ? `, KES ${kShort(r.loanLeft(r.payback))} still owed then` : ''}).` : `we get the KES ${kShort(r.startup)} back in month ${r.payback}.`}`,
      `• Monthly profit turns positive (break-even): ${r.breakEven == null ? 'never' : 'month ' + r.breakEven}`,
      `• Most money tied up: KES ${kShort(-Math.min(0, r.low.v))}${r.low.m ? ' in month ' + r.low.m : ''}`,
      `• ${r.loanAmt ? 'Money left after costs and loan payments' : 'Profit'} in the first 12 / 24 / 36 months: KES ${kShort(r.profitN(12))} / ${kShort(r.profitN(24))} / ${kShort(r.profitN(36))}`,
      `• 3-year return: ${r.roi(36) == null ? '—' : Math.round(r.roi(36)) + '%'}`, '',
      `*Start-up (one time): KES ${Z.fmt(r.startup)}*`, ...r.start.lines.filter((l) => l.amount).map((l) => `– ${l.label}: ${Z.fmt(l.amount)}${l.how ? ' (' + l.how + ')' : ''}`), r.start.contingency ? `– Contingency ${pl.start.cont_pct}%: ${Z.fmt(r.start.contingency)}` : '', '',
      `*Running costs: KES ${Z.fmt(r.run.total)} a month*`, ...r.run.lines.filter((l) => l.amount).map((l) => `– ${l.label}: ${Z.fmt(l.amount)}${l.how ? ' (' + l.how + ')' : ''}`), '',
      `*Customers:* ${pl.rev.mode === 'pct' ? `${pl.rev.pct}% of ${Z.fmt(pl.rev.homes)} homes by month ${pl.rev.pct_month}` : `sign-ups ${[1, 3, 6, 12, 24].map((m) => Z.fmt(pl.rev['c' + m]) + ' by m' + m).join(', ')}`}; ${pl.rev.churn_pct || 0}% leave a month → about ${Z.fmt(r.rows[11].customers)} at month 12, ${Z.fmt(r.rows[23].customers)} at month 24`,
      `*Bill:* KES ${Z.fmt(pl.rev.arpu)} a month · install fee KES ${Z.fmt(pl.rev.install_fee)}${pl.cpe.who === 'zuri' && pl.cpe.each ? ` · router KES ${Z.fmt(pl.cpe.each)} paid by Zuri` : ''}`,
      r.loanAmt ? `*Loan:* KES ${Z.fmt(r.loanAmt)} at ${pl.loan.rate}% over ${pl.loan.months} months → KES ${Z.fmt(r.loanPay)} a month` : '', '',
      `*What if?* Fewer sign-ups (70%): ${low.payback == null ? 'never pays back' : 'month ' + low.payback} · more (130%): ${high.payback == null ? 'never' : 'month ' + high.payback}`, '',
      '_Break-even = the month money in beats money out. Payback = the month all the profits have paid back the start-up. From Zuri System → 📈 Projects._',
    ].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
  }
  function trackText(p, a, t) {
    const K = a.K, st = STATE[t.state];
    if (!K) return `*📈 ${p.name}* — launched ${monthName(a.lym)}; first month not finished yet.`;
    const last = a.months[K - 1], b = t.B.rows[K - 1];
    return [`*📈 ${p.name} — month ${K} (${monthName(last.ym)})*`, `${st[0]} *${st[1]}*: cash KES ${kShort(t.rows[K - 1].cum)} vs plan KES ${kShort(b.cum)} (${t.diff >= 0 ? '+' : '−'}KES ${kShort(Math.abs(t.diff))})`,
      `Customers ${last.customers != null ? Z.fmt(last.customers) : '—'} (plan ${Z.fmt(b.customers)}) · money in last month KES ${Z.fmt(last.revenue)} (plan ${Z.fmt(b.revenue)}) · costs KES ${Z.fmt(t.rows[K - 1].costs)} (plan ${Z.fmt(b.costs)})`,
      `Start-up spent KES ${kShort(t.actualStart)} (plan ${kShort(t.B.startup)})`,
      `Pays back: month ${t.J.payback == null ? '— (not within 10 yrs)' : t.J.payback} now · plan said month ${t.B.payback == null ? '—' : t.B.payback}`,
      '', '_From Zuri System → 📈 Projects_'].join('\n');
  }

  if (!document.getElementById('pj-css')) { const c = document.createElement('style'); c.id = 'pj-css'; c.textContent = '@media (min-width: 700px) { .pj-swipe { display:none; } }'; document.head.appendChild(c); }
  function printMode(on) {
    if (!document.getElementById('pj-print-css')) {
      const s = document.createElement('style'); s.id = 'pj-print-css';
      s.textContent = 'body.pj-print #hdr, body.pj-print #nav, body.pj-print footer.ver { display:none !important; } body.pj-print main { max-width:820px; }'
        + ' @media print { body.pj-print .no-print, body.pj-print #toast { display:none !important; } body.pj-print, body.pj-print #view { background:#fff !important; color:#000 !important; } body.pj-print .card { break-inside:avoid; border-color:#bbb; } body.pj-print main { padding:0 !important; } }';
      document.head.appendChild(s);
    }
    document.body.classList.toggle('pj-print', on);
    if (on) window.addEventListener('hashchange', () => document.body.classList.remove('pj-print'), { once: true });
  }
  async function printPage(el, p) {
    const pl = p.plan, r = M.model(pl), wi = M.whatIfs(pl);
    const tr = p.status === 'live' && p.launch_date ? await trackOf(p).catch(() => null) : null;
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    el.innerHTML = `
      <div class="row no-print" style="margin-bottom:10px"><button type="button" class="btn" id="pp-print">🖨 Print / save as PDF</button><a class="btn sec" href="#projects/${p.id}">← Back</a></div>
      <div class="card" id="pp-head"><div style="font-size:22px;font-weight:800">Zuri Fiber — ${Z.esc(p.name)}: ${tr ? 'how the new area is doing' : 'should we build it?'}</div>
        <div class="hint" style="margin:2px 0 0">${Z.esc(today)} · ${p.area ? Z.esc(Z.areaName(p.area)) : 'new area'} · ${STAGE[p.status][0]} · for Dickson, Kelvin and Jerry · Zuri System ${Z.esc(Z.version)}</div>
        ${p.notes ? `<p style="margin:6px 0 0">${Z.esc(p.notes)}</p>` : ''}</div>
      ${tr && tr.a.K ? `<div class="card" id="pp-track"><b>${STATE[tr.t.state][0]} ${STATE[tr.t.state][1]} after ${tr.a.K} months.</b> Cash ${kes(tr.t.rows[tr.a.K - 1].cum)} against the plan's ${kes(tr.t.B.rows[tr.a.K - 1].cum)}. Pays back in ${mWord(tr.t.J.payback, p)} now (plan: ${mWord(tr.t.B.payback, p)}).
        ${chartSvg([{ name: 'Plan', color: '#888', dash: true, width: 2, points: cumPoints(tr.t.B, 36) }, { name: 'Forecast', color: '#D98A1B', width: 2.5, points: [[0, tr.t.J.cum0]].concat(tr.t.J.rows.slice(0, 36).map((x) => [x.m, x.cum])) }, { name: 'Actual', color: '#0F6E5C', width: 4, points: [[0, tr.t.J.cum0]].concat(tr.t.rows.map((x) => [x.m, x.cum])) }], { months: 36 })}</div>` : ''}
      <div class="card"><b style="font-size:17px">1 · The answer${tr ? ' (current forecast)' : ''}</b>
        <p style="margin:6px 0">${r.payback == null ? `With these numbers we <b>do not</b> get the ${kes(r.startup)} start-up back within 10 years.` : r.payback === 0 ? 'The loan covers the start-up and the cash never goes below zero.' : r.loanAmt ? `We spend <b>${kes(r.startup)}</b> to start — <b>${kes(r.loanAmt)}</b> borrowed and <b>${kes(r.own)}</b> of our own — and get our own money back in <b>month ${r.payback}</b>${r.loanLeft(r.payback) ? ` (the loan is repaid from the monthly figures; ${kes(r.loanLeft(r.payback))} of it is still owed then)` : ''}.` : `We spend <b>${kes(r.startup)}</b> to start, and get it back in <b>month ${r.payback}</b>.`}
          The monthly profit turns positive (break-even) in ${r.breakEven == null ? '— never' : '<b>month ' + r.breakEven + '</b>'}. At the worst point we are <b>${kes(-Math.min(0, r.low.v))}</b> down${r.low.m ? ' (month ' + r.low.m + ')' : ''}, so that is the money we must have ready. Over 3 years the money left each month adds up to ${kes(r.profitN(36))}${r.loanAmt ? ' (after the loan payments)' : ''}; after paying back ${r.loanAmt ? 'our own part of ' : ''}the start-up, ${kes(r.cashN(36))} is left.</p>
        ${chartSvg([{ name: 'Cash so far', color: '#0F6E5C', points: cumPoints(r, 36) }], { months: 36, marks: [{ m: r.breakEven, label: 'break-even', color: '#8F4C00' }, { m: r.payback || null, label: 'payback', color: '#2E8B57' }] })}
        <p class="hint"><b>Why two months?</b> Break-even is when one month's money in beats that month's money out. Payback comes later, because first the losses of the early months and the whole start-up have to be earned back.</p></div>
      <div class="grid2">
        <div class="card"><b>2 · Start-up (one time)</b><table class="t">${r.start.lines.filter((l) => l.amount).map((l) => `<tr><td>${Z.esc(l.label)}${l.how ? `<div class="hint" style="margin:0">${Z.esc(l.how)}</div>` : ''}</td><td class="r num">${Z.fmt(l.amount)}</td></tr>`).join('')}
          ${r.start.contingency ? `<tr><td>Contingency ${pl.start.cont_pct}%<div class="hint" style="margin:0">builds cost more than planned</div></td><td class="r num">${Z.fmt(r.start.contingency)}</td></tr>` : ''}<tr><td><b>Total</b></td><td class="r num"><b>${Z.fmt(r.startup)}</b></td></tr></table></div>
        <div class="card"><b>3 · Running costs (a month)</b><table class="t">${r.run.lines.filter((l) => l.amount).map((l) => `<tr><td>${Z.esc(l.label)}${l.how ? `<div class="hint" style="margin:0">${Z.esc(l.how)}</div>` : ''}</td><td class="r num">${Z.fmt(l.amount)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="r num"><b>${Z.fmt(r.run.total)}</b></td></tr></table>
          ${r.loanAmt ? `<p class="hint">Plus the loan: ${kes(r.loanPay)} a month for ${r.loanN} months (${kes(r.loanAmt)} at ${pl.loan.rate}%).</p>` : ''}</div>
      </div>
      <div class="card"><b>4 · Customers and money in</b>
        <p style="margin:6px 0">${pl.rev.mode === 'pct' ? `${pl.rev.pct}% of the ${Z.fmt(pl.rev.homes)} homes passed sign up by month ${pl.rev.pct_month}` : `Sign-ups: ${[1, 3, 6, 12, 24].map((m) => Z.fmt(pl.rev['c' + m]) + ' by month ' + m).join(', ')}`}. ${pl.rev.churn_pct || 0}% of customers leave each month, so we expect about <b>${Z.fmt(r.rows[11].customers)}</b> customers at month 12 and <b>${Z.fmt(r.rows[23].customers)}</b> at month 24.
          Each pays <b>${kes(pl.rev.arpu)}</b> a month${pl.rev.install_fee ? `, plus ${kes(pl.rev.install_fee)} to install` : ''}${pl.cpe.each ? `; the router (${kes(pl.cpe.each)}) is ${pl.cpe.who === 'zuri' ? 'paid by Zuri' : 'in the install fee'}` : ''}${N(pl.rev.price_pct) && N(pl.rev.price_month) ? `; the bill changes by ${pl.rev.price_pct}% from month ${pl.rev.price_month}` : ''}.</p>
        <p class="hint"><b>Why this matters most:</b> the start-up is fairly certain once you have quotes; how fast people join is a guess. That is why the table below asks “what if?”.</p></div>
      <div class="card"><b>5 · What if we are wrong?</b> Payback month:
        <table class="t"><tr><th>Take-up</th><th class="r">Bill −10%</th><th class="r">As planned</th><th class="r">Bill +10%</th></tr>${wi.map((row, i) => `<tr><td>${['Low (70%)', 'Expected', 'High (130%)'][i]}</td>${row.map((c) => `<td class="r num" style="${c.t === 1 && c.a === 1 ? 'font-weight:800' : ''}">${c.payback == null ? 'never' : c.payback === 0 ? 'start' : 'month ' + c.payback}</td>`).join('')}</tr>`).join('')}</table>
        <p class="hint">If the low row is still acceptable, the plan is safe. If it says never, agree now what you would do if sign-ups are slow (more marketing, a cheaper package, slower building).</p></div>
      <div class="card"><b>6 · First 12 months</b><div class="scroll-x"><table class="t"><tr><th>Month</th><th class="r">Customers</th><th class="r">Money in</th><th class="r">Costs</th><th class="r">Profit</th><th class="r">Cash so far</th></tr>
        ${r.rows.slice(0, 12).map((x) => `<tr><td>${x.m}</td><td class="r num">${Z.fmt(x.customers)}</td><td class="r num">${Z.fmt(x.revenue)}</td><td class="r num">${Z.fmt(x.costs)}</td><td class="r num">${Z.fmt(x.profit)}</td><td class="r num">${Z.fmt(x.cum)}</td></tr>`).join('')}</table></div></div>
      <div class="card"><b>Questions to agree on</b><ol style="margin:6px 0 0;padding-left:20px;line-height:1.5"><li>Are the start-up numbers real quotes, or guesses? Which ones still need a quote?</li><li>Who sells in the area, and is the take-up realistic for this town?</li><li>Where does the ${kes(-Math.min(0, r.low.v))} come from, and when?</li><li>What will we do if after 6 months we are behind the plan?</li></ol></div>`;
    printMode(true);
    Z.$('#pp-print', el).onclick = () => window.print();
  }

  // ---------- Home card, the Friday report, Money out / bills tags ----------
  Z.projectsHomeCard = async () => {
    if (!Z.isFinance()) return '';
    let all = [];
    try { all = (await S.list()).filter((p) => p.status !== 'closed'); } catch (e) { return ''; }
    const parts = await Promise.all(all.slice(0, 4).map(async (p) => `${p.name} ${(await statusLine(p).catch(() => ({ short: '' }))).short}`));
    return `<a class="card" id="h-proj" href="#projects" style="display:block;text-decoration:none;color:inherit;border-left:4px solid var(--accent)">
      <b>📈 Projects:</b> ${all.length ? Z.esc(parts.join(' · ')) : 'plan a new area — start-up, payback, then track it'} <span style="float:right">›</span></a>`;
  };
  Z.projectsFriday = async () => {
    if (!Z.isFinance()) return [];
    let all = [];
    try { all = (await S.list()).filter((p) => p.status !== 'closed'); } catch (e) { return []; }
    if (!all.length) return [];
    const lines = await Promise.all(all.map(async (p) => `${p.name}: ${(await statusLine(p).catch(() => ({ text: '' }))).text}`));
    return ['*📈 Projects*', ...lines];
  };
  // Live projects for the tag pickers in Money out and Bills (empty before 27 is run: no column to tag yet).
  Z.liveProjects = async () => { try { if ((await S.detect()) !== 'db') return []; return (await S.list()).filter((p) => p.status === 'live'); } catch (e) { return []; } };
  Z.projectPick = (live, area, sel) => !live.length ? '' : `<div><label for="pj-tag">Project</label><select name="project_id" id="pj-tag"><option value="">— not a project</option>${Z.opts(live.map((p) => [p.id, '📈 ' + p.name]), sel !== undefined ? sel : (live.find((p) => p.area && p.area === area) || {}).id || '')}</select></div>`;
  Z.projectTagFields = (d) => (d.project_id === undefined ? {} : d.project_id ? { project_id: d.project_id, no_project: false } : { project_id: null, no_project: true });
})();
