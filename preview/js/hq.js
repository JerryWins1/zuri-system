// Zuri System · 🏢 Headquarters: the whole company on one screen, for the partners · v1.1 · 2026-10-15
// v1.1 (15 Oct): "waiting for a partner's OK" opens Money → 👥 Approvals (it opened Cash today); Money in shows in the
//       feed; day-only payments sort at the start of their day; the feed's pickers are full-size taps.
// Jerry (14 Oct): "At some point we will have a corporate headquarters and many areas running and someone needs to be
// monitoring activity in the company. It needs to be able to message anyone in the company."
// Four parts: ① what needs a decision · ② every area side by side · ③ live activity (who did what, newest first)
// · ④ the team, with a message to anyone — one person, an area, a role, or everyone. Messages go by WhatsApp or SMS
// from this phone, one tap each (no WhatsApp Business account needed yet); ticks are kept on this phone.
// Reads only — nothing here changes the company's records. Each part loads on its own, so one slow table never blanks the page.
(function () {
  const Z = window.Z;
  const N = (v) => Number(v || 0);
  const pct = (a, b) => (N(b) ? Math.round((N(a) / N(b)) * 100) : 0);
  const safe = (p) => Promise.resolve(p).then((r) => (r && r.error ? [] : (r && r.data) || [])).catch(() => []);
  const ROLE = { admin: '⭐ Partner', internal: '🗂 Office', callcenter: '📞 Call center', field: '🛠️ Field tech' };
  const roleOf = (p) => (p.role === 'internal' && p.dept === 'finance' ? '💰 Finance' : ROLE[p.role] || p.role);
  const wa = (phone, text) => `https://wa.me/${Z.phone254(phone)}?text=${encodeURIComponent(text)}`;
  const agoTxt = (ts) => {
    const m = Math.round((Date.now() - new Date(ts)) / 6e4);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    return Z.when(ts);
  };
  const KIND = { fault: 'fault', install: 'install', relocation: 'move', disconnect: 'disconnect', survey: 'survey', billing: 'payment call', other: 'job' };

  // ---------- ② one row per area (plus the whole company) ----------
  async function areaRows() {
    const areas = (Z.ref.areas || []).filter((a) => a.active !== false);
    const list = [{ code: null, name: 'Whole company' }].concat(areas.map((a) => ({ code: a.code, name: a.name || Z.areaName(a.code) })));
    return Promise.all(list.map(async (a) => {
      try { const { data, error } = await Z.sb.rpc('dashboard_snapshot', { p_area: a.code }); return { ...a, s: error ? null : data }; }
      catch (e) { return { ...a, s: null }; }
    }));
  }

  // ---------- ③ what happened, newest first ----------
  async function activity(hours) {
    const since = new Date(Date.now() - hours * 3600e3).toISOString(), sinceDay = Z.ymd(new Date(Date.now() - hours * 3600e3));
    const [opened, closed, events, pays, exps, counts, outs, tasks, cins] = await Promise.all([
      safe(Z.sb.from('tickets').select('id,ticket_no,kind,status,area,summary,priority,opened_at,opened_by,assigned_to,closed_at').gte('opened_at', since).limit(300)),
      safe(Z.sb.from('tickets').select('id,ticket_no,kind,status,area,summary,priority,opened_at,opened_by,assigned_to,closed_at,amount_collected').gte('closed_at', since).limit(300)),
      safe(Z.sb.from('ticket_events').select('ticket_id,by,kind,body,at').gte('at', since).order('at', { ascending: false }).limit(400)),
      safe(Z.sb.from('payments').select('*').gte('date', sinceDay).limit(500)),
      safe(Z.sb.from('expenses').select('*').gte('created_at', since).limit(300)),
      safe(Z.sb.from('cash_counts').select('*').gte('created_at', since).limit(50)),
      safe(Z.sb.from('outages').select('*').gte('started_at', since).limit(50)),
      safe(Z.sb.from('tasks').select('id,title,status,area,assigned_to,updated_at,priority').eq('status', 'done').gte('updated_at', since).limit(200)),
      safe(Z.sb.from('cash_in').select('*').gte('date', sinceDay).limit(200)), // v1.1: Money in was missing from the feed
    ]);
    const T = {}; opened.concat(closed).forEach((t) => (T[t.id] = t));
    const who = (id) => Z.personName(id) || '';
    const job = (t) => (t ? `#${t.ticket_no} ${KIND[t.kind] || t.kind || 'job'}` : 'a job');
    const out = [];
    opened.forEach((t) => out.push({ at: t.opened_at, area: t.area, ic: t.priority === 'urgent' ? '🔴' : '🆕', by: t.opened_by, t: `New ${job(t)}`, m: t.summary || '', href: '#jobs/' + t.id }));
    closed.filter((t) => t.status === 'done').forEach((t) => out.push({ at: t.closed_at, area: t.area, ic: '✅', by: t.assigned_to, t: `Finished ${job(t)}`, m: (N(t.amount_collected) ? `collected ${Z.kes(t.amount_collected)} · ` : '') + (t.summary || ''), href: '#jobs/' + t.id }));
    // Job notes and status changes (skip the "done" ones — the finished job above already says it).
    events.filter((e) => !(e.kind === 'status' && /done/i.test(e.body || ''))).forEach((e) => { const t = T[e.ticket_id]; out.push({ at: e.at, area: t && t.area, ic: e.kind === 'status' ? '🔄' : '📝', by: e.by, t: `${t ? job(t) : 'Job'} · ${e.kind === 'status' ? 'status' : 'note'}`, m: e.body || '', href: '#jobs/' + e.ticket_id }); });
    // v1.1: a payment with only a day (no time) sorts at the START of that day, not above things that happened “just now”.
    pays.forEach((p) => { const at = p.created_at || (p.date + 'T00:00:00'); if (new Date(at) < new Date(since) && !p.created_at) return; out.push({ at, day: !p.created_at, area: p.area, ic: '💵', t: `Payment in · ${Z.kes(p.amount)}`, m: [p.payer_name, p.method, p.source === 'field' ? 'collected by a tech' : p.source].filter(Boolean).join(' · ') }); });
    exps.forEach((e) => out.push({ at: e.created_at, area: e.area, ic: e.approval === 'waiting' ? '⏳' : '💸', by: e.created_by, t: `${e.approval === 'waiting' ? 'Waiting for OK' : 'Money out'} · ${Z.kes(e.amount)}`, m: [e.payee, e.category].filter(Boolean).join(' · '), href: e.approval === 'waiting' ? '#money/approvals' : '' }));
    counts.forEach((c) => out.push({ at: c.created_at, area: c.area, ic: '🧮', t: `Cash counted · ${Z.kes(N(c.bank) + N(c.mpesa))}`, m: `bank ${Z.fmt(c.bank)} · M-Pesa ${Z.fmt(c.mpesa)}${c.counted_by ? ' · by ' + c.counted_by : ''}` }));
    outs.forEach((o) => out.push({ at: o.started_at, area: o.area, ic: '📡', t: `Possible outage${o.status === 'open' ? ' (still open)' : ''}`, m: `${(o.fault_ids || []).length || ''} fault calls close together`.trim(), href: '#home' }));
    cins.forEach((c) => out.push({ at: c.created_at || (c.date + 'T00:00:00'), day: !c.created_at, area: c.area, ic: '💰', t: `Money in · ${Z.kes(c.amount)}`, m: [c.category, c.from_name, c.received_to].filter(Boolean).join(' · ') }));
    tasks.forEach((k) => out.push({ at: k.updated_at, area: k.area, ic: '☑️', by: k.assigned_to, t: 'Task done', m: k.title || '' }));
    out.forEach((x) => (x.who = who(x.by)));
    return out.filter((x) => x.at).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }

  // ---------- ① what needs a decision ----------
  async function decisions() {
    const [waiting, outages, urgent] = await Promise.all([
      safe(Z.sb.from('expenses').select('id,amount,area').eq('approval', 'waiting').limit(300)),
      safe(Z.sb.from('outages').select('id,area,started_at').eq('status', 'open')),
      safe(Z.sb.from('tasks').select('id,title,area').eq('status', 'open').eq('priority', 'urgent').limit(100)),
    ]);
    const d = [];
    outages.forEach((o) => d.push(['bad', `📡 Possible outage in ${Z.areaName(o.area)} since ${Z.when(o.started_at)} — check the notice to customers.`, '#home']));
    if (waiting.length) d.push(['warn', `⏳ ${waiting.length} payment${waiting.length > 1 ? 's' : ''} waiting for a partner's OK · ${Z.kes(waiting.reduce((t, e) => t + N(e.amount), 0))}`, '#money/approvals']);
    if (urgent.length) d.push(['warn', `🔴 ${urgent.length} urgent task${urgent.length > 1 ? 's' : ''} still open${urgent[0].title ? ' — first: ' + urgent[0].title : ''}`, '#tasks']);
    return d;
  }

  // ---------- the page ----------
  Z.routes.hq = async (_, el) => {
    if (!Z.isAdmin()) { el.innerHTML = '<div class="card">Headquarters is for the partners.</div>'; return; }
    const hours = Z.get('hq_hours', 24);
    const areaPick = Z.get('hq_area', '');
    el.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:baseline">
        <h2 style="margin-bottom:0">🏢 Headquarters</h2>
        <span class="hint">${Z.training ? 'training copy · ' : Z.practice ? 'practice · ' : ''}<a href="#" id="hq-refresh" class="tap44" style="min-width:0;padding:0 6px">refresh</a></span>
      </div>
      <p class="hint" style="margin-top:4px">The whole company on one screen: what needs a decision, every area side by side, what everyone is doing, and a message to anyone.</p>
      <h3>Needs a decision</h3><div id="hq-dec"><div class="card muted">Loading…</div></div>
      <h3>Areas side by side</h3><div id="hq-areas"><div class="card muted">Loading…</div></div>
      <h3 style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">Live activity
        <span class="row" style="text-transform:none;letter-spacing:0;gap:6px">
          <select id="hq-area" aria-label="Area" style="width:auto;padding:6px 8px;font-size:14px;min-height:44px"><option value="">All areas</option>${Z.opts((Z.ref.areas || []).map((a) => [a.code, a.name || Z.areaName(a.code)]), areaPick)}</select>
          <select id="hq-hours" aria-label="How far back" style="width:auto;padding:6px 8px;font-size:14px;min-height:44px">${Z.opts([[6, 'Last 6 hours'], [24, 'Last 24 hours'], [72, 'Last 3 days'], [168, 'Last 7 days']], hours)}</select>
        </span></h3>
      <div id="hq-feed"><div class="card muted">Loading…</div></div>
      <h3 style="display:flex;justify-content:space-between;align-items:center">The team <button class="btn small" id="hq-msg-all" style="text-transform:none;letter-spacing:0">✉️ Message…</button></h3>
      <div id="hq-team"><div class="card muted">Loading…</div></div>`;
    Z.$('#hq-refresh', el).onclick = (e) => { e.preventDefault(); Z.route(); };
    Z.$('#hq-hours', el).onchange = (e) => { Z.set('hq_hours', Number(e.target.value)); Z.route(); };
    Z.$('#hq-area', el).onchange = (e) => { Z.set('hq_area', e.target.value); Z.route(); };
    Z.$('#hq-msg-all', el).onclick = () => composer({});

    // ① decisions
    decisions().then((d) => {
      Z.$('#hq-dec', el).innerHTML = d.length ? d.map(([k, t, h]) => `<a class="alert ${k}" href="${h}" style="display:block;text-decoration:none">${Z.esc(t)}</a>`).join('')
        : '<div class="alert ok">✅ Nothing waiting for a decision right now.</div>';
    });

    // ② areas
    areaRows().then((rows) => {
      const cell = (v, cls = '') => `<td class="num ${cls}" style="text-align:right;padding:8px 6px;white-space:nowrap">${v}</td>`;
      Z.$('#hq-areas', el).innerHTML = `<div class="card" style="overflow-x:auto;padding:8px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr style="color:var(--ink-faint);font-size:12px;text-align:right"><th style="text-align:left;padding:6px">Area</th><th style="padding:6px">Customers</th><th style="padding:6px">Paid up</th><th style="padding:6px">Late</th><th style="padding:6px">Open faults</th><th style="padding:6px">Installs waiting</th><th style="padding:6px">Overdue visits</th><th style="padding:6px">Cash now</th></tr></thead>
          <tbody>${rows.map((r, i) => {
            const s = r.s; if (!s) return `<tr style="border-top:1px solid var(--line)"><td style="padding:8px 6px"><b>${Z.esc(r.name)}</b></td><td colspan="7" class="hint" style="padding:8px 6px">couldn't load</td></tr>`;
            const c = s.customers || {}, j = s.jobs || {}, m = s.money || {};
            const pu = pct(c.paid_up, c.active);
            return `<tr style="border-top:1px solid var(--line)${i === 0 ? ';background:var(--surface-2)' : ''}">
              <td style="padding:8px 6px"><a href="#" data-area="${Z.esc(r.code || '')}" style="font-weight:700">${Z.esc(r.name)}</a></td>
              ${cell(Z.fmt(c.active))}${cell(pu + '%', pu >= 90 ? 'ok' : pu >= 75 ? 'warn' : 'bad')}${cell(Z.fmt(c.late), N(c.late) ? 'bad' : '')}
              ${cell(Z.fmt(j.open_faults), N(j.open_faults) > 10 ? 'warn' : '')}${cell(Z.fmt(j.open_installs))}${cell(Z.fmt(j.overdue), N(j.overdue) ? 'bad' : '')}
              ${cell(m.oldest_count ? Z.fmt(m.cash_now) : '—')}</tr>`;
          }).join('')}</tbody></table>
        <p class="hint" style="margin:6px">Tap an area to open its Home page. Cash is in KES, from the latest cash count.</p></div>`;
      Z.$$('[data-area]', el).forEach((a) => (a.onclick = (e) => { e.preventDefault(); Z.area = a.dataset.area; Z.set('area', Z.area); const s = Z.$('#h-area'); if (s) s.value = Z.area; Z.go('home'); }));
    });

    // ③ activity + ④ team (the team uses the activity to show who has been quiet)
    const feed = await activity(hours).catch(() => []);
    const shown = feed.filter((x) => !areaPick || x.area === areaPick).slice(0, 80);
    Z.$('#hq-feed', el).innerHTML = `<div class="card list">${shown.length ? shown.map((x) => {
      const inner = `<span style="font-size:22px">${x.ic}</span><div class="grow"><div class="t">${Z.esc(x.t)}</div>
        <div class="m">${[x.who && '👤 ' + Z.esc(x.who), x.area && Z.esc(Z.areaName(x.area)), x.m && Z.esc(String(x.m).slice(0, 120))].filter(Boolean).join(' · ')}</div></div>
        <div class="m" style="text-align:right;white-space:nowrap">${x.day ? Z.day(x.at.slice(0, 10)) : agoTxt(x.at)}</div>`;
      return x.href ? `<a class="item" href="${x.href}">${inner}</a>` : `<div class="item">${inner}</div>`;
    }).join('') : '<div class="muted">Nothing happened in this time. Try a longer time or another area.</div>'}</div>
      ${feed.length > 80 ? '<p class="hint">Showing the newest 80.</p>' : ''}`;

    const last = {}; feed.forEach((x) => { if (x.by && !last[x.by]) last[x.by] = x.at; });
    const people = (Z.ref.people || []).filter((p) => p.active !== false && p.id !== (Z.me && Z.me.id));
    const groups = {}; people.forEach((p) => { const g = p.area ? Z.areaName(p.area) : 'Head office'; (groups[g] = groups[g] || []).push(p); });
    Z.$('#hq-team', el).innerHTML = people.length ? Object.keys(groups).sort((a, b) => (a === 'Head office' ? -1 : b === 'Head office' ? 1 : a.localeCompare(b))).map((g) => `
      <div class="card list"><div class="row" style="justify-content:space-between"><b>${Z.esc(g)}</b><span class="hint" style="margin:0">${groups[g].length} ${groups[g].length === 1 ? 'person' : 'people'}</span></div>
      ${groups[g].map((p) => `<div class="item"><div class="grow"><div class="t">${Z.esc(p.full_name)}</div>
        <div class="m">${roleOf(p)} · ${last[p.id] ? 'last active ' + agoTxt(last[p.id]) : `<span style="color:var(--warn-ink)">nothing in the last ${hours < 48 ? hours + ' hours' : Math.round(hours / 24) + ' days'}</span>`}</div></div>
        ${p.phone ? `<button class="btn sec small" data-msg="${Z.esc(p.id)}" aria-label="Message ${Z.esc(p.full_name)}">✉️</button><a class="btn sec small" href="tel:${Z.esc(p.phone)}" aria-label="Call ${Z.esc(p.full_name)}">📞</a>` : '<span class="pill warn">no phone</span>'}</div>`).join('')}</div>`).join('')
      : '<div class="card muted">No one else is switched on yet. Admin → People.</div>';
    Z.$$('[data-msg]', el).forEach((b) => (b.onclick = () => composer({ ids: [b.dataset.msg] })));
  };

  // ---------- ✉️ message anyone ----------
  // Pick who (everyone · an area · a job · or tick people), write once, then send to each with one tap.
  function composer({ ids }) {
    const people = (Z.ref.people || []).filter((p) => p.active !== false && p.phone && p.id !== (Z.me && Z.me.id));
    const areas = [...new Set(people.map((p) => p.area).filter(Boolean))];
    const roles = [...new Set(people.map(roleOf))];
    let picked = new Set(ids || []);
    const draft = Z.get('hq_draft', '');
    const sh = Z.sheet('✉️ Message', `
      <label>Who</label>
      <div class="row" id="hq-who" style="gap:6px">
        <button class="btn sec small" data-g="all">Everyone (${people.length})</button>
        ${areas.map((a) => `<button class="btn sec small" data-g="area:${Z.esc(a)}">${Z.esc(Z.areaName(a))}</button>`).join('')}
        ${roles.map((r) => `<button class="btn sec small" data-g="role:${Z.esc(r)}">${Z.esc(r)}</button>`).join('')}
        <button class="btn sec small" data-g="none">Clear</button>
      </div>
      <div class="list" id="hq-pick" style="max-height:220px;overflow:auto;margin-top:6px">${people.map((p) => `
        <label class="item" style="margin:0;font-weight:400"><input type="checkbox" value="${Z.esc(p.id)}"><div class="grow"><div class="t">${Z.esc(p.full_name)}</div><div class="m">${roleOf(p)}${p.area ? ' · ' + Z.esc(Z.areaName(p.area)) : ''}</div></div></label>`).join('')}</div>
      <label for="hq-text">Message</label>
      <textarea id="hq-text" rows="4" placeholder="Habari team! …">${Z.esc(draft)}</textarea>
      <p class="hint">Each person gets their own copy. “{name}” becomes their first name.</p>
      <div class="row"><button class="btn" id="hq-go">Next: send →</button><button class="btn sec" id="hq-copy">📋 Copy for a group chat</button></div>
      <div id="hq-send"></div>`);
    const box = sh.el;
    const sync = () => Z.$$('#hq-pick input', box).forEach((c) => (c.checked = picked.has(c.value)));
    sync();
    Z.$$('#hq-pick input', box).forEach((c) => (c.onchange = () => { c.checked ? picked.add(c.value) : picked.delete(c.value); }));
    Z.$$('#hq-who [data-g]', box).forEach((b) => (b.onclick = () => {
      const g = b.dataset.g;
      if (g === 'none') picked = new Set();
      else people.filter((p) => g === 'all' || (g.startsWith('area:') && p.area === g.slice(5)) || (g.startsWith('role:') && roleOf(p) === g.slice(5))).forEach((p) => picked.add(p.id));
      sync();
    }));
    const txt = Z.$('#hq-text', box);
    txt.oninput = () => Z.set('hq_draft', txt.value);
    Z.$('#hq-copy', box).onclick = async () => {
      const t = txt.value.replace(/\{name\}/g, 'team').trim(); if (!t) return Z.toast('Write the message first.');
      try { await navigator.clipboard.writeText(t); Z.toast('Copied — paste it in the group chat.'); } catch (e) { Z.toast('Could not copy on this phone — press and hold the message to copy it.'); }
    };
    Z.$('#hq-go', box).onclick = () => {
      const t = txt.value.trim();
      if (!t) return Z.toast('Write the message first.');
      const to = people.filter((p) => picked.has(p.id));
      if (!to.length) return Z.toast('Pick who gets it.');
      const sent = Z.get('hq_sent', {}), key = t.slice(0, 60);
      const done = new Set(sent[key] || []);
      const first = (p) => String(p.full_name || '').split(/\s+/)[0];
      const each = (p) => t.replace(/\{name\}/g, first(p));
      const draw = () => {
        Z.$('#hq-send', box).innerHTML = `<h3 style="margin-top:14px">Send · ${done.size} of ${to.length} sent</h3><div class="list">${to.map((p) => `
          <div class="item"><div class="grow"><div class="t">${done.has(p.id) ? '✅ ' : ''}${Z.esc(p.full_name)}</div><div class="m">${Z.esc(p.phone)}</div></div>
            <a class="btn small" target="_blank" rel="noopener" data-s="${Z.esc(p.id)}" href="${Z.esc(wa(p.phone, each(p)))}">WhatsApp</a>
            <a class="btn sec small" data-s="${Z.esc(p.id)}" href="${Z.esc(Z.smsHref(p.phone, each(p)))}">SMS</a></div>`).join('')}</div>
          <p class="hint">Tap WhatsApp (or SMS), press Send there, come back here for the next one. The ✅ stays on this phone.</p>`;
        Z.$$('#hq-send [data-s]', box).forEach((a) => (a.onclick = () => { done.add(a.dataset.s); sent[key] = [...done]; Z.set('hq_sent', sent); setTimeout(draw, 300); }));
      };
      draw();
      Z.$('#hq-send', box).scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }
  Z.hqMessage = composer;
})();
