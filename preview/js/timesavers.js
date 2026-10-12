// Zuri System · ⏱ Time savers · v1 · 2026-10-10 (app v2.33)
//   1 📩 Today's texts (#texts): everyone whose after-cutoff step is due today, one at a time, words written, tap → send → Next
//   2 📊 The Friday report's new parts: service, follow-ups, the team, payments waiting, the manager's summary (money.js shows them)
//   3 💳 A fault call from a customer whose package expired: "probably not a fault — help them pay first"
//   4 📍 Pins at "I'm starting now" (with the accuracy guard) + the tech's jobs nearest-first (jobs.js)
//   5 📡 Outage spotting: 3+ fault calls in one area within 2 hours → one outage, a banner, a notice for the partners' yes
// NOTHING here sends anything to a customer by itself: a text or WhatsApp opens in the person's own phone and they press send.
// Needs supabase/25_time_savers.sql for: outages (before it, the banner is worked out on the phone from the jobs) and the
// approvals (approvals.js). Everything else works without it.
(function () {
  const Z = window.Z;
  const must = (r) => { if (r.error) throw r.error; return r.data; };
  const DAY = 864e5;
  const ACTIVE = ['open', 'assigned', 'in_progress'];

  // ---------- has 25_time_savers.sql been run? (asked once; a "no" is asked again after 5 minutes) ----------
  let tsOk = null, tsAt = 0;
  Z.ts = {
    ok: async () => {
      if (tsOk === true || (tsOk === false && Date.now() - tsAt < 300e3)) return tsOk;
      try { const r = await Z.sb.rpc('time_savers_version'); if (r.error && Z.isNet(r.error)) return false; tsOk = !r.error && Number(r.data) >= 1; }
      catch (e) { return false; }
      tsAt = Date.now(); return tsOk;
    },
  };

  // ---------- small shared helpers ----------
  Z.cutDays = (paidUntil) => (paidUntil ? Math.max(0, Math.floor((Date.now() - new Date(paidUntil)) / DAY)) : null);
  Z.cutStep = (days) => (days == null || !Z.AFTER_CUTOFF ? null : Z.AFTER_CUTOFF.find((x) => days >= x.from && days <= x.to) || null);
  Z.waHref = (phone, text) => 'https://wa.me/' + Z.phone254(phone) + '?text=' + encodeURIComponent(text);
  // Where am I? {lat, lng, acc}. During a practice training video the phone "stands" at a pretend spot, so videos never need GPS.
  Z.here = (o = {}) => new Promise((ok, no) => {
    if (Z.practice && window.ZP_LESSON && window.ZP && window.ZP.pretendHere) return setTimeout(() => ok(window.ZP.pretendHere()), window.ZURI_LEARN_FAST ? 50 : 900);
    if (!navigator.geolocation) return no({ code: 2, message: 'This phone cannot share its location.' });
    navigator.geolocation.getCurrentPosition((p) => ok({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) }),
      (e) => no(e), { enableHighAccuracy: true, timeout: o.timeout || 20000, maximumAge: o.maxAge || 0 });
  });
  async function vCustomers(ids) {
    ids = [...new Set(ids.filter(Boolean))];
    const out = {};
    for (let i = 0; i < ids.length; i += 100) {
      const data = must(await Z.sb.from('v_customers').select('id,full_name,phone,area,landmark,account_no,plan,monthly_rate,paid_until,lat,lng').in('id', ids.slice(i, i + 100)));
      data.forEach((c) => (out[c.id] = c));
    }
    return out;
  }
  const ago = (d) => (d === 0 ? 'today' : d === 1 ? '1 day ago' : d + ' days ago');

  // =====================================================================================================
  // 1 · 📩 Today's texts
  // =====================================================================================================
  Z.routes.texts = async (args, el) => {
    const today = Z.ymd();
    let tickets = [], custs = {}, offline = false, at = Date.now();
    try {
      let q = Z.sb.from('tickets').select('*').eq('kind', 'billing').in('status', ACTIVE).limit(600);
      if (Z.area) q = q.eq('area', Z.area);
      tickets = must(await q);
      custs = await vCustomers(tickets.map((t) => t.customer_id));
      Z.set('texts_cache', { tickets, custs, at });
    } catch (e) {
      if (!Z.isNet(e)) throw e;
      const c = Z.get('texts_cache', null);
      if (!c) { el.innerHTML = '<p style="margin:0 0 6px"><a class="back" href="#jobs">← Jobs</a></p><div class="card">📴 No signal, and this phone has no saved list yet. Open Today\'s texts once with signal.</div>'; return; }
      ({ tickets, custs, at } = c); offline = true;
    }
    // What this phone did and hasn't sent yet (a text sent with no signal already moved its job's day).
    const byId = new Map(tickets.map((t) => [t.id, { ...t }]));
    Z.queue.forEach((q) => { if (q.op === 'ticket_update' && byId.has(q.data.id)) Object.assign(byId.get(q.data.id), q.data.fields); });
    const handled = Z.get('texts_done_' + today, {}); // ticket id → 'sms' | 'wa' | 'skip' | 'closed'
    const rows = [...byId.values()]
      .filter((t) => t.kind === 'billing' && (ACTIVE.includes(t.status) || handled[t.id]) && (!t.scheduled_for || t.scheduled_for <= today || handled[t.id]))
      .map((t) => { const c = custs[t.customer_id]; if (!c || !c.paid_until || new Date(c.paid_until) > new Date()) return null; const days = Z.cutDays(c.paid_until); return { t, c, days, step: Z.cutStep(days) }; })
      .filter((x) => x && x.step);
    const si = (x) => Z.AFTER_CUTOFF.indexOf(x.step);
    rows.sort((a, b) => si(a) - si(b) || b.days - a.days || String(a.c.full_name).localeCompare(String(b.c.full_name)));
    const list = rows.filter((x) => x.c.phone), nophone = rows.filter((x) => !x.c.phone);
    let cur = list.findIndex((x) => !handled[x.t.id]);

    el.innerHTML = `<p style="margin:0 0 6px"><a class="back" href="#jobs">← Jobs</a></p>
      <div class="row" style="justify-content:space-between"><h2 id="tx-head" style="margin-bottom:4px">📩 Today's texts</h2><span class="pill brand" id="tx-count"></span></div>
      ${offline ? `<div class="alert warn">📴 No signal — the list as of ${Z.esc(Z.when(at))}. Texts still work (they use your phone's own SMS). What you tap is saved and sends later.</div>` : ''}
      <p class="hint" style="margin-top:0">Everyone whose after-cutoff step is due today, one at a time. The words are written for you: tap <b>Text</b> or <b>WhatsApp</b>, press send in your phone, then <b>Next</b>. Zuri writes it on the job and brings the customer back on the next step's day. <b>Nothing is sent by itself.</b></p>
      <div style="background:var(--surface-2);border-radius:6px;height:8px;margin:0 0 10px;overflow:hidden"><i id="tx-bar" style="display:block;height:100%;background:var(--brand);width:0;transition:width .3s"></i></div>
      <div id="tx-card"></div>
      <h3>Today's list · ${list.length}</h3><div class="card list" id="tx-list"></div>
      ${nophone.length ? `<h3>No phone number · ${nophone.length}</h3><div class="card list" id="tx-nophone">${nophone.map((x) => `<a class="item" href="#jobs/${Z.esc(x.t.id)}"><div class="grow"><div class="t">${Z.esc(x.c.full_name)}</div><div class="m">${Z.esc(x.step.short)} · add a phone number on their page</div></div><span>›</span></a>`).join('')}</div>` : ''}`;

    const sentHtml = (x) => {
      const how = handled[x.t.id];
      if (!how || how === 'skip') return '';
      if (how === 'closed') return '<div class="alert ok" style="margin-top:8px">👋 Goodbye sent and the follow-up is closed. They are welcome back any time.</div>';
      const back = x.step.next != null ? Z.ymd(new Date(new Date(x.c.paid_until).getTime() + x.step.next * DAY)) : null;
      return `<div class="alert ok" style="margin-top:8px" id="tx-ok">✅ ${how === 'sms' ? 'Text' : 'WhatsApp'} opened — written on the job${back ? ` · they come back on ${Z.esc(Z.day(back))} for the next step` : ''}.</div>
        ${x.step.key === 'd30' ? '<button type="button" class="btn sec block" id="tx-close" style="margin-top:6px">👋 Goodbye sent — close this follow-up</button>' : ''}`;
    };
    const card = (x) => {
      const { t, c, days, step } = x;
      const msg = step.msg(c, days);
      const call = step.key === 'd3' || step.key === 'd14';
      const tl = Z.AFTER_CUTOFF.map((s) => `<span class="pill ${s === step ? 'brand' : days > s.to ? 'ok' : ''}" style="${s === step ? 'font-weight:800' : ''}">${Z.esc(s.short)}</span>`).join(' ');
      return `<div class="card" id="tx-now" style="border-left:4px solid var(--brand)">
        <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap"><div class="grow" style="min-width:0"><b style="font-size:18px" id="tx-name">${Z.esc(c.full_name)}</b>
          <div class="hint" style="margin:0">${Z.esc([Z.areaName(c.area), c.account_no, c.plan, c.monthly_rate ? Z.kes(c.monthly_rate) : ''].filter(Boolean).join(' · '))}</div>
          <div class="hint" style="margin:2px 0 0">Switched off ${Z.esc(Z.day(String(c.paid_until).slice(0, 10)))} — <b>${ago(days)}</b></div></div>
          <a class="btn sec small" href="#jobs/${Z.esc(t.id)}" id="tx-job">Open job</a></div>
        <div class="row" id="tx-steps" style="gap:4px;flex-wrap:wrap;margin:8px 0">${tl}</div>
        <b id="tx-step">${Z.esc(step.name)}</b><p class="hint" style="margin:2px 0 8px">${Z.esc(step.how)}</p>
        ${call ? '<div class="alert warn" id="tx-callfirst">📞 Call first today — ask how the service was going. Then send the text.</div>' : ''}
        <div class="card" id="tx-msg" style="background:var(--surface-2);font-size:15px;margin:0 0 8px">${Z.esc(msg)}</div>
        <div class="row" id="tx-btns">
          <a class="btn" id="tx-sms" href="${Z.esc(Z.smsHref(c.phone, msg))}">📩 Text</a>
          <a class="btn sec" id="tx-wa" target="_blank" rel="noopener" href="${Z.esc(Z.waHref(c.phone, msg))}">💬 WhatsApp</a>
          <a class="btn sec" id="tx-call" href="tel:${Z.esc(c.phone)}">📞 Call</a></div>
        <div id="tx-sent">${sentHtml(x)}</div>
        <div class="row" style="margin-top:10px;justify-content:space-between"><button type="button" class="btn sec" id="tx-skip">⏭ Skip for today</button><button type="button" class="btn" id="tx-next">Next ▶</button></div>
      </div>`;
    };
    const status = (x) => { const h = handled[x.t.id]; return h === 'sms' || h === 'wa' ? '<span class="pill ok">✅ sent</span>' : h === 'closed' ? '<span class="pill ok">👋 closed</span>' : h === 'skip' ? '<span class="pill">⏭ skipped</span>' : '<span class="pill warn">to send</span>'; };
    const nextOpen = (from) => { for (let k = 1; k <= list.length; k++) { const i = (from + k) % list.length; if (!handled[list[i].t.id]) return i; } return -1; };

    const draw = () => {
      const done = list.filter((x) => handled[x.t.id] && handled[x.t.id] !== 'skip').length, skipped = list.filter((x) => handled[x.t.id] === 'skip').length;
      Z.$('#tx-count', el).textContent = `${done + skipped} of ${list.length} done`;
      Z.$('#tx-bar', el).style.width = (list.length ? Math.round(((done + skipped) / list.length) * 100) : 100) + '%';
      Z.$('#tx-list', el).innerHTML = list.map((x, i) => `<a href="#" class="item tx-row" data-i="${i}" style="${i === cur ? 'background:var(--brand-soft)' : ''}"><div class="grow"><div class="t">${Z.esc(x.c.full_name)}</div><div class="m">${Z.esc(x.step.short)} · ${ago(x.days)}</div></div>${status(x)}</a>`).join('')
        || '<div class="muted">Nobody is due today. 🎉 Follow-ups come back on their next step\'s day.</div>';
      Z.$$('.tx-row', el).forEach((a) => (a.onclick = (e) => { e.preventDefault(); cur = +a.dataset.i; draw(); Z.$('#tx-card', el).scrollIntoView({ block: 'start', behavior: 'smooth' }); }));
      const box = Z.$('#tx-card', el);
      if (cur < 0 || !list[cur]) {
        box.innerHTML = list.length ? `<div class="card" id="tx-done" style="border-left:4px solid var(--ok)"><b style="font-size:18px">🎉 Today's texts are done</b>
            <p class="hint">${done} sent${skipped ? ` · ${skipped} skipped (they come back tomorrow)` : ''}. Customers who pay are closed by the next billing refresh — nothing to do.</p>
            <div class="row"><a class="btn sec" href="#jobs">← Back to Jobs</a>${skipped ? '<button type="button" class="btn sec" id="tx-again">↺ Go through the skipped ones</button>' : ''}</div></div>`
          : '<div class="card" id="tx-done"><b>Nobody is due today. 🎉</b><p class="hint" style="margin-bottom:0">When a customer\'s next step comes round (day 1, 3, 7, 14, 30 after the cutoff), they appear here by themselves.</p></div>';
        const again = Z.$('#tx-again', el); if (again) again.onclick = () => { list.forEach((x) => { if (handled[x.t.id] === 'skip') delete handled[x.t.id]; }); Z.set('texts_done_' + today, handled); cur = nextOpen(-1); draw(); };
        return;
      }
      const x = list[cur];
      box.innerHTML = card(x);
      // The tap itself opens the phone's SMS / WhatsApp (a real link, so phones never block it). We only write it down.
      Z.$('#tx-sms', box).addEventListener('click', () => markSent(x, 'sms'));
      Z.$('#tx-wa', box).addEventListener('click', () => markSent(x, 'wa'));
      Z.$('#tx-skip', box).onclick = () => { if (!handled[x.t.id]) { handled[x.t.id] = 'skip'; Z.set('texts_done_' + today, handled); } cur = nextOpen(cur); draw(); };
      Z.$('#tx-next', box).onclick = () => { cur = nextOpen(cur); draw(); };
      const cl = Z.$('#tx-close', box);
      if (cl) cl.onclick = () => {
        Z.enqueue('event', { row: { id: Z.uuid(), ticket_id: x.t.id, by: Z.me.id, kind: 'note', body: '👋 Day-30 goodbye sent — follow-up closed for this time', at: new Date().toISOString() } });
        if (!Z.enqueue('ticket_update', { id: x.t.id, fields: { status: 'done', work_done: 'Not renewed after 30 days — kind goodbye sent' } })) return;
        handled[x.t.id] = 'closed'; Z.set('texts_done_' + today, handled); Z.toast('Closed. They are welcome back any time.'); draw();
      };
    };
    const markSent = (x, how) => {
      const { t, c, step } = x;
      const first = !handled[t.id] || handled[t.id] === 'skip';
      if (!Z.enqueue('event', { row: { id: Z.uuid(), ticket_id: t.id, by: Z.me.id, kind: 'note', body: (how === 'sms' ? '📩 ' : '💬 ') + step.name + ' — ' + (how === 'sms' ? 'text sent' : 'WhatsApp sent') + " (Today's texts)", at: new Date().toISOString() } })) return;
      if (first && step.next != null) Z.enqueue('ticket_update', { id: t.id, fields: { scheduled_for: Z.ymd(new Date(new Date(c.paid_until).getTime() + step.next * DAY)) } });
      handled[t.id] = how; Z.set('texts_done_' + today, handled);
      // Redraw a moment later: the phone opens SMS / WhatsApp first (moving the button now would cancel the tap).
      setTimeout(() => { if (location.hash === '#texts') { draw(); const n = Z.$('#tx-next', el); if (n) n.focus({ preventScroll: true }); } }, 400);
    };
    draw();
  };
  // How many are due today (for the Jobs page button). Quiet on failure.
  Z.textsDueCount = async () => {
    try {
      const today = Z.ymd();
      let q = Z.sb.from('tickets').select('id,customer_id,scheduled_for,status').eq('kind', 'billing').in('status', ACTIVE).limit(600);
      if (Z.area) q = q.eq('area', Z.area);
      const ts = must(await q).filter((t) => !t.scheduled_for || t.scheduled_for <= today);
      return ts.length;
    } catch (e) { return null; }
  };

  // =====================================================================================================
  // 2 · 📊 The Friday report's new parts (Money → Report shows them, with the money and receipts parts)
  // =====================================================================================================
  Z.fridayExtras = async (week) => {
    const since = Z.ymd(new Date(Date.now() - 6 * DAY));
    const has = await Z.ts.ok();
    const safe = (p, d) => p.then(must).catch(() => d);
    const [snap, tk, ev, tasks, runs, waiting, outs] = await Promise.all([
      safe(Z.sb.rpc('dashboard_snapshot', { p_area: null }), null),
      safe(Z.sb.from('tickets').select('id,ticket_no,kind,status,area,assigned_to,opened_at,closed_at,work_done').or(`opened_at.gte.${since},closed_at.gte.${since}`).limit(3000), []),
      safe(Z.sb.from('ticket_events').select('ticket_id,by,kind,body,at').gte('at', since).limit(5000), []),
      safe(Z.sb.from('tasks').select('id,status,done_by,done_at').eq('status', 'done').gte('done_at', since).limit(3000), []),
      safe(Z.sb.from('agent_runs').select('mode,started_at,report').eq('mode', 'weekly').order('started_at', { ascending: false }).limit(1), []),
      has ? safe(Z.sb.from('expenses').select('id,amount,payee').eq('approval', 'waiting').limit(500), null) : Promise.resolve(null),
      has ? safe(Z.sb.from('outages').select('*').gte('started_at', since).limit(50), []) : Promise.resolve([]),
    ]);
    const inWk = (ts) => !!ts && String(ts).slice(0, 10) >= since;
    const j = (snap && snap.jobs) || {};
    const faults = tk.filter((t) => t.kind === 'fault');
    const fNew = faults.filter((t) => inWk(t.opened_at)).length;
    const fFixed = faults.filter((t) => t.status === 'done' && inWk(t.closed_at));
    const hrs = fFixed.length ? Math.round(fFixed.reduce((s, t) => s + Math.max(0, new Date(t.closed_at) - new Date(t.opened_at)) / 36e5, 0) / fFixed.length) : null;
    const iDone = tk.filter((t) => t.kind === 'install' && t.status === 'done' && inWk(t.closed_at)).length;
    const otherDone = tk.filter((t) => !['fault', 'install', 'billing'].includes(t.kind) && t.status === 'done' && inWk(t.closed_at)).length;
    const bill = tk.filter((t) => t.kind === 'billing' && t.status === 'done' && inWk(t.closed_at));
    const goodbyes = bill.filter((t) => /^Not renewed/i.test(t.work_done || '')).length, renewed = bill.length - goodbyes;
    const cnt = (re) => ev.filter((e) => re.test(e.body || '')).length;
    const texts = cnt(/^(📩|💬)/), promises = cnt(/^🤝/), noAnswer = cnt(/^📵/), stops = cnt(/^✋/), fixes = cnt(/^🛠/);
    // the team: what each person did this week
    const P = {};
    const add = (id, k) => { if (!id) return; (P[id] = P[id] || { jobs: 0, texts: 0, notes: 0, tasks: 0, receipts: 0 })[k]++; };
    tk.filter((t) => t.kind !== 'billing' && t.status === 'done' && inWk(t.closed_at)).forEach((t) => add(t.assigned_to, 'jobs'));
    ev.forEach((e) => { if (/^(📩|💬)/.test(e.body || '')) add(e.by, 'texts'); else if (e.kind === 'note') add(e.by, 'notes'); });
    tasks.forEach((t) => add(t.done_by, 'tasks'));
    (week || []).forEach((e) => add(e.created_by, 'receipts'));
    const team = Object.entries(P).map(([id, v]) => ({ id, name: Z.personName(id) || 'Someone', ...v, total: v.jobs + v.texts + v.notes + v.tasks + v.receipts })).sort((a, b) => b.total - a.total);
    const say = (v) => [v.jobs && `${v.jobs} job${v.jobs > 1 ? 's' : ''} done`, v.texts && `${v.texts} text${v.texts > 1 ? 's' : ''} sent`, v.notes && `${v.notes} note${v.notes > 1 ? 's' : ''}`, v.tasks && `${v.tasks} task${v.tasks > 1 ? 's' : ''} ticked`, v.receipts && `${v.receipts} receipt${v.receipts > 1 ? 's' : ''}`].filter(Boolean).join(', ');
    const run = runs[0] && runs[0].report && Date.now() - new Date(runs[0].started_at) < 8 * DAY ? runs[0] : null;
    const wait = waiting ? { n: waiting.length, kes: waiting.reduce((t, e) => t + Number(e.amount || 0), 0) } : null;
    const outTxt = outs.map((o) => `${Z.areaName(o.area)} ${Z.day(String(o.started_at).slice(0, 10))} (${(o.fault_ids || []).length} calls${o.status === 'closed' ? ', fixed' : ', still open'})`).join('; ');

    const service = ['*🛠 Service this week*',
      `Faults: ${fNew} new · ${fFixed.length} fixed${hrs != null ? ` (about ${hrs} h each)` : ''} · ${j.open_faults ?? '—'} still open`,
      `Installs: ${iDone} done · ${j.open_installs ?? '—'} waiting${otherDone ? ` · ${otherDone} other job${otherDone > 1 ? 's' : ''} done` : ''}`]
      .concat(Number(j.overdue) ? [`Visits past their day: ${j.overdue}${Number(j.unassigned) ? ` · ${j.unassigned} with no tech` : ''}`] : [])
      .concat(outs.length ? [`📡 Outages: ${outTxt}`] : []);
    const follow = ['*💳 Payment follow-ups (after the cutoff)*',
      `Open now: ${j.followups ?? '—'} · renewed this week: ${renewed} · texts sent: ${texts}`,
      `Calls: ${noAnswer} no answer · ${promises} promised to pay${fixes ? ` · ${fixes} said it wasn't working (fault job opened)` : ''}${stops ? ` · ${stops} want to stop` : ''}${goodbyes ? ` · ${goodbyes} goodbye${goodbyes > 1 ? 's' : ''} (day 30)` : ''}`];
    const teamL = ['*👥 The team this week*'].concat(team.length ? team.slice(0, 12).map((p) => `• ${p.name} — ${say(p)}`) : ['Nothing recorded in Zuri this week.']);
    const waitL = wait ? (wait.n ? [`*⏳ Waiting for a second OK:* ${wait.n} payment${wait.n > 1 ? 's' : ''}, KES ${Z.fmt(wait.kes)}`] : ['*⏳ Waiting for a second OK:* none ✅']) : [];
    const aiL = run ? ['*🤖 The Zuri manager\'s summary*', String(run.report).trim()] : [];

    const k = (label, v, f, cls = '') => `<div class="kpi"><div class="k">${label}</div><div class="v num ${cls}">${v}</div>${f ? `<div class="f">${f}</div>` : ''}</div>`;
    const html = {
      service: `<h3 id="fr-jobs-h">🛠 Service this week</h3><div class="kpis" id="fr-jobs">
          ${k('Faults', `${fNew} new`, `${fFixed.length} fixed${hrs != null ? ` · about ${hrs} h each` : ''}`)}
          ${k('Still open', Z.fmt(j.open_faults), `${Z.fmt(j.overdue)} past their day`, Number(j.overdue) ? 'warn' : '')}
          ${k('Installs', `${iDone} done`, `${Z.fmt(j.open_installs)} waiting`)}
          ${outs.length ? k('📡 Outages', outs.length, Z.esc(outTxt), outs.some((o) => o.status === 'open') ? 'bad' : '') : ''}
        </div>`,
      follow: `<h3>💳 Payment follow-ups</h3><div class="kpis" id="fr-follow">
          ${k('Open now', Z.fmt(j.followups), 'cut off, after-cutoff path')}
          ${k('Renewed this week', renewed, `${goodbyes} goodbye${goodbyes === 1 ? '' : 's'} at day 30`, 'ok')}
          ${k('Texts sent', texts, `${promises} promised · ${noAnswer} no answer`)}
        </div>`,
      team: `<div class="card list" id="fr-staff"><b>👥 The team this week</b>${team.length ? team.slice(0, 12).map((p) => `<div class="item"><div class="grow"><div class="t">${Z.esc(p.name)}</div><div class="m">${Z.esc(say(p))}</div></div></div>`).join('') : '<div class="muted">Nothing recorded in Zuri this week.</div>'}</div>`,
      wait: wait ? `<a class="alert ${wait.n ? 'warn' : 'ok'}" id="fr-appr" href="#money/approvals" style="display:block;text-decoration:none">${wait.n ? `⏳ ${wait.n} payment${wait.n > 1 ? 's' : ''} (KES ${Z.fmt(wait.kes)}) waiting for a second person's OK →` : '✅ No payment is waiting for a second OK.'}</a>` : '',
      ai: run ? `<div class="card" id="fr-ai" style="border-left:4px solid var(--brand)"><b>🤖 The Zuri manager's summary</b><div class="hint" style="margin:2px 0 6px">Written ${Z.esc(Z.when(run.started_at))} from the real numbers. It goes into the copy below.</div><div style="white-space:pre-wrap;font-size:14.5px">${Z.esc(String(run.report).trim())}</div></div>`
        : '<div class="card" id="fr-ai"><b>🤖 The Zuri manager\'s summary</b><p class="hint" style="margin-bottom:0">Not this week yet — it is written on Fridays at 4 pm Kenya time once the manager\'s AI key is on. The rest of the report works without it.</p></div>',
    };
    return { html, lines: { service, follow, team: teamL, wait: waitL, ai: aiL } };
  };

  // =====================================================================================================
  // 3 · 💳 Fault call from a customer whose package expired
  // =====================================================================================================
  Z.expiredOn = (c) => (c && c.paid_until && new Date(c.paid_until) < new Date() ? String(c.paid_until).slice(0, 10) : null);
  Z.expiredHtml = (c, where) => {
    const d = Z.expiredOn(c); if (!d) return '';
    const days = Z.cutDays(c.paid_until);
    return `<div class="alert warn" id="${where === 'form' ? 'nj-expired' : 'jd-expired'}" style="font-size:15px">
      <div style="font-size:16px;font-weight:800">💳 Package expired on ${Z.esc(Z.day(d))} — this is probably not a fault. Help them pay first.</div>
      <div style="font-weight:500;margin:4px 0 8px">${Z.esc(c.full_name)}'s internet was switched off by the billing website ${ago(days)}${c.monthly_rate ? ` (${Z.esc(Z.kes(c.monthly_rate))} a month)` : ''}. A tech visit won't fix it — paying will. Tell them how to pay, then it comes back within minutes.</div>
      ${Z.isOffice() ? `<button type="button" class="btn block" id="${where === 'form' ? 'nj-tofollow' : 'jd-tofollow'}">💳 Turn this into a payment follow-up</button>
      <div class="hint" style="margin:6px 0 0">${where === 'form' ? 'Sure it really is a fault (they paid, or it was off before the date)? Save the job anyway.' : 'No tech is sent; the call center gets the payment follow-up with the words written.'}</div>`
        : '<div class="hint" style="margin:0">Call the office before you go: it may only need paying.</div>'}
    </div>`;
  };
  // Make (or reuse) the payment follow-up. From the new-job form (t = null) or an existing fault job (t).
  Z.turnIntoFollowup = async (c, t) => {
    let open = null;
    try {
      const r = must(await Z.sb.from('tickets').select('id,status').eq('customer_id', c.id).eq('kind', 'billing').in('status', ACTIVE).limit(1));
      open = r[0] || null;
    } catch (e) { if (!Z.isNet(e)) throw e; }
    const note = (tid, body) => Z.enqueue('event', { row: { id: Z.uuid(), ticket_id: tid, by: Z.me.id, kind: 'note', body, at: new Date().toISOString() } });
    const why = `💳 Called about no internet — the package had expired on ${Z.day(Z.expiredOn(c))}. Help them pay first (no tech sent).`;
    if (open) {
      if (t) { note(t.id, why + ' Closed: the payment follow-up already exists.'); Z.enqueue('ticket_update', { id: t.id, fields: { status: 'cancelled' } }); }
      note(open.id, why);
      Z.toast('They already have a payment follow-up — opened it, with a note.');
      return Z.go('jobs/' + open.id);
    }
    if (t) {
      note(t.id, why + ' Turned into a payment follow-up.');
      if (!Z.enqueue('ticket_update', { id: t.id, fields: { kind: 'billing', assigned_to: null, status: 'open', scheduled_for: Z.ymd(), summary: `Payment follow-up: called in about no internet — package ran out ${Z.day(Z.expiredOn(c))}` } })) return;
      Z.toast('Now a payment follow-up — no tech is sent.');
      return Z.route();
    }
    const row = { id: Z.uuid(), customer_id: c.id, area: c.area, kind: 'billing', priority: 'normal', summary: `Payment follow-up: called in about no internet — package ran out ${Z.day(Z.expiredOn(c))}`, caller: null, assigned_to: null, scheduled_for: Z.ymd(), opened_by: Z.me.id };
    if (!Z.enqueue('ticket_insert', { row })) return;
    note(row.id, why);
    Z.toast('Payment follow-up made — no tech is sent.');
    Z.go('jobs/' + row.id);
  };

  // =====================================================================================================
  // 4 · 📍 Pins: offered at "I'm starting now" (with the accuracy guard); rough pins are replaced
  // =====================================================================================================
  Z.pinRough = (c) => !!(c && c.lat != null && c.custom && Number(c.custom.pin_accuracy) > 50);
  Z.savePin = (c, ticketId, pos) => {
    if (c) Z.enqueue('customer_save', { p: { id: c.id, lat: pos.lat, lng: pos.lng, custom: { pin_accuracy: pos.acc } } });
    Z.enqueue('ticket_update', { id: ticketId, fields: { site_lat: pos.lat, site_lng: pos.lng } });
    if (c) { const cache = Z.get('job_' + ticketId, null); if (cache && cache.c) { cache.c.lat = pos.lat; cache.c.lng = pos.lng; cache.c.custom = { ...(cache.c.custom || {}), pin_accuracy: pos.acc }; Z.set('job_' + ticketId, cache); } }
  };
  Z.offerPin = async (c, ticketId) => {
    if (!c || !(c.lat == null || Z.pinRough(c))) return;
    const first = String(c.full_name || 'the customer').split(' ')[0];
    let pos;
    try { pos = await Z.here(); }
    catch (e) { Z.toast(e && e.code === 1 ? 'Location is off for Zuri, so the pin wasn\'t offered. Add it later with 📍 Drop pin here.' : 'Couldn\'t get a location for the pin — step outside and use 📍 Drop pin here.'); return; }
    const sh = Z.sheet('📍 Save ' + first + '\'s pin?', `<div id="pn-body"></div>`);
    const body = Z.$('#pn-body', sh.el);
    const paint = () => {
      const rough = pos.acc > 50;
      body.innerHTML = `<p style="margin-top:0">${c.lat == null ? `${Z.esc(c.full_name)} has <b>no map pin</b> yet.` : `${Z.esc(c.full_name)}'s pin is <b>rough</b> (±${Z.esc(c.custom.pin_accuracy)} m).`} You are at the house now. Save where you are standing as their pin? The next tech drives straight there.</p>
        <div class="alert ${rough ? 'warn' : 'ok'}" id="pn-acc">${rough ? `Your location is only accurate to about ${pos.acc} m. Step outside, wait a minute and tap ↻ Try again for a better pin.` : `Accurate to about ${pos.acc} m — good enough.`}</div>
        <div class="row"><button type="button" class="btn" id="pn-yes">${rough ? 'Save this rough pin anyway' : '📍 Yes, save the pin'}</button>${rough ? '<button type="button" class="btn sec" id="pn-again">↻ Try again</button>' : ''}<button type="button" class="btn sec" id="pn-no">Not now</button></div>`;
      Z.$('#pn-yes', body).onclick = () => { Z.savePin(c, ticketId, pos); sh.close(); Z.toast(`Pin saved (accurate to about ${pos.acc} m).`); Z.route(); };
      Z.$('#pn-no', body).onclick = () => sh.close();
      const ag = Z.$('#pn-again', body);
      if (ag) ag.onclick = async () => { ag.disabled = true; ag.textContent = '📍 Finding you…'; try { pos = await Z.here(); } catch (e) { Z.toast('Still no good location — try again outside.'); } paint(); };
    };
    paint();
  };

  // =====================================================================================================
  // 5 · 📡 Outages
  // =====================================================================================================
  // Open outages. With 25_time_savers.sql they come from the database (with the task and the notice); before it, the phone
  // works them out from the jobs it can see (office only), so the banner still shows.
  Z.outagesOpen = async () => {
    if (await Z.ts.ok()) { try { return must(await Z.sb.from('outages').select('*').eq('status', 'open').order('started_at')); } catch (e) { return []; } }
    if (!Z.isOffice()) return [];
    try {
      const since = new Date(Date.now() - 2 * 3600e3).toISOString();
      const ts = must(await Z.sb.from('tickets').select('id,area,kind,status,opened_at').eq('kind', 'fault').gte('opened_at', since).limit(300)).filter((t) => t.status !== 'cancelled');
      const by = {}; ts.forEach((t) => (by[t.area] = by[t.area] || []).push(t));
      return Object.entries(by).filter(([, l]) => l.length >= 3).map(([area, l]) => ({ id: null, area, started_at: l.map((t) => t.opened_at).sort()[0], fault_ids: l.map((t) => t.id), status: 'open', local: true }));
    } catch (e) { return []; }
  };
  const canClose = () => Z.isAdmin() || (Z.me.role === 'internal' && Z.me.dept === 'technical');
  Z.outageHtml = (list, where) => list.map((o) => {
    const an = Z.areaName(o.area), n = (o.fault_ids || []).length, t = new Date(o.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const notice = !o.local && o.notice && Z.isOffice() ? (o.notice_status === 'approved'
      ? `<div style="margin-top:8px"><b>✅ Customer notice — yes from a partner</b><div class="card" style="background:var(--surface-2);margin:4px 0;font-weight:500" id="ou-text-${o.id}">${Z.esc(o.notice)}</div><button type="button" class="btn sec small ou-copy" data-id="${o.id}">📋 Copy the notice</button> <span class="hint">Paste it into a WhatsApp broadcast to the ${Z.esc(an)} customers. Zuri never sends it.</span></div>`
      : o.notice_status === 'declined' ? '<div class="hint" style="margin-top:6px">A partner said no customer notice for this one.</div>'
      : Z.isAdmin() ? `<div style="margin-top:8px" id="ou-notice"><b>✉️ Customer notice — drafted, waiting for your yes</b><textarea class="ou-words" data-id="${o.id}" aria-label="Customer notice words" style="margin:4px 0;min-height:96px">${Z.esc(o.notice)}</textarea>
          <div class="row"><button type="button" class="btn small ou-yes" data-id="${o.id}">✅ Yes, use this notice</button><button type="button" class="btn sec small ou-no" data-id="${o.id}">✋ No notice</button></div><div class="hint" style="margin:4px 0 0">Nothing is sent by Zuri. After your yes, the office copies it into a WhatsApp broadcast.</div></div>`
      : '<div class="hint" style="margin-top:6px">✉️ A customer notice is drafted and waiting for a partner\'s yes.</div>') : '';
    return `<div class="card ou-card" data-area="${Z.esc(o.area)}" style="border-left:5px solid var(--bad);background:var(--bad-soft)">
      <div style="font-size:16px;font-weight:800;color:var(--bad)">📡 Possible outage in ${Z.esc(an)}</div>
      <div style="font-weight:600;margin:2px 0">${n} fault call${n === 1 ? '' : 's'} since ${Z.esc(t)}${o.local ? ' (worked out on this phone)' : ''}.</div>
      <div class="hint" style="margin:0">${where === 'form' ? `New fault calls from ${Z.esc(an)} join the outage by themselves. Tell the caller: we know, the technicians are on it — no visit needed.` : o.local ? 'Check the cabinet / OLT for the area before sending techs house by house.' : `One task went to the technical team. New fault calls from ${Z.esc(an)} join this outage by themselves.`}</div>
      ${notice}
      ${!o.local && canClose() && where !== 'form' ? `<div class="row" style="margin-top:8px"><button type="button" class="btn small ou-close" data-id="${o.id}">✅ Service is back — close it</button></div>` : ''}
    </div>`;
  }).join('');
  Z.wireOutages = (el) => {
    Z.$$('.ou-close', el).forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      const { error } = await Z.sb.rpc('close_outage', { p_id: b.dataset.id, p_note: null });
      if (error) { b.disabled = false; return Z.fail(error); }
      Z.toast('Outage closed. Check the fault jobs from that area — most will be fixed now.'); Z.route();
    }));
    const decide = async (b, yes) => {
      const words = Z.$(`.ou-words[data-id="${b.dataset.id}"]`, el);
      b.disabled = true;
      const { error } = await Z.sb.rpc('outage_notice', { p_id: b.dataset.id, p_yes: yes, p_text: words ? words.value : null });
      if (error) { b.disabled = false; return Z.fail(error); }
      Z.toast(yes ? 'Yes saved. The office can copy the notice now — Zuri does not send it.' : 'No notice for this outage.'); Z.route();
    };
    Z.$$('.ou-yes', el).forEach((b) => (b.onclick = () => decide(b, true)));
    Z.$$('.ou-no', el).forEach((b) => (b.onclick = () => decide(b, false)));
    Z.$$('.ou-copy', el).forEach((b) => (b.onclick = () => {
      const t = (Z.$('#ou-text-' + b.dataset.id, el) || {}).textContent || '';
      navigator.clipboard.writeText(t).then(() => Z.toast('Copied — paste it into the WhatsApp broadcast.'), () => Z.toast('Press and hold the words to copy them.'));
    }));
  };
  // A box that fills itself (used by Jobs, Home and the new-job form). area = only that area.
  Z.outageBox = async (box, where, area) => {
    if (!box) return;
    const list = (await Z.outagesOpen()).filter((o) => !area || o.area === area);
    if (!box.isConnected) return;
    box.innerHTML = Z.outageHtml(list, where);
    Z.wireOutages(box);
  };
})();
