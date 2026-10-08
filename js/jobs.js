// Zuri System · Jobs (service tickets): intake, dispatch, field work, offline · v2 · 2026-09-30
(function () {
  const Z = window.Z;
  const KINDS = [['fault', 'Fault / no internet'], ['install', 'New install'], ['billing', 'Payment follow-up'], ['relocation', 'Move connection'], ['disconnect', 'Disconnect'], ['survey', 'Site survey'], ['other', 'Other']];
  const STATUS = { open: ['Waiting for a tech', 'warn'], assigned: ['Assigned', 'brand'], in_progress: ['In progress', 'brand'], done: ['Done', 'ok'], cancelled: ['Cancelled', ''] };
  // 7 Oct deep check #26: a payment follow-up is a phone call for the office, not a tech visit.
  const BILLING_STATUS = { open: ['To call', 'warn'], assigned: ['To call', 'warn'], in_progress: ['Calling', 'brand'], done: ['Renewed', 'ok'], cancelled: ['Closed', ''] };
  const ACTIVE = ['open', 'assigned', 'in_progress'];
  const kindName = (k) => (KINDS.find((x) => x[0] === k) || [k, k])[1];
  const statusPill = (s, kind) => { const M = kind === 'billing' ? BILLING_STATUS : STATUS; return `<span class="pill ${M[s] ? M[s][1] : ''}">${M[s] ? M[s][0] : Z.esc(s)}</span>`; };
  const mapLink = (lat, lng) => `https://maps.google.com/?q=${lat},${lng}`;
  const waPhone = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '254' + d.slice(1); else if (d.length === 9) d = '254' + d; return d; };
  const wa = (phone, text) => `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`;
  // Tap to add — most jobs are one of these, and tapping beats typing on a phone in the sun.
  const FOUND = ['Fibre cut', 'Bad connector', 'Router off / faulty', 'No power at the house', 'Package expired (not paid)', 'Cable damaged', 'Wrong settings / password', 'Nothing wrong found'];
  const DID = ['Re-spliced the fibre', 'Replaced connector', 'Replaced router', 'Restarted router', 'Fixed settings', 'Ran new cable', 'Showed customer how to pay', 'Tested — working'];
  const chips = (name, items) => `<div class="chips" data-for="${name}">${items.map((x) => `<button type="button">${Z.esc(x)}</button>`).join('')}</div>`;

  // Apply changes still waiting in the queue on top of what the server returned.
  function overlay(tickets) {
    const byId = new Map(tickets.map((t) => [t.id, { ...t }]));
    for (const q of Z.queue) {
      if (q.op === 'ticket_insert' && !byId.has(q.data.row.id)) byId.set(q.data.row.id, { ...q.data.row, ticket_no: '…', opened_at: new Date(q.at).toISOString(), _local: true });
      if (q.op === 'ticket_update' && byId.has(q.data.id)) Object.assign(byId.get(q.data.id), q.data.fields, { _local: true });
    }
    return [...byId.values()];
  }
  function queuedChildren(op, ticketId) {
    return Z.queue.filter((q) => q.op === op && q.data.row.ticket_id === ticketId).map((q) => ({ ...q.data.row, _local: true }));
  }

  async function customersFor(ids) {
    ids = [...new Set(ids.filter(Boolean))];
    if (!ids.length) return {};
    // 100 at a time — a long list of ids makes the web address too long and the request fails.
    const out = {};
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await Z.sb.from('v_customers').select('id,full_name,phone,phone2,area,landmark,lat,lng,status,account_no,plan,monthly_rate,paid_until').in('id', ids.slice(i, i + 100));
      if (error) throw error;
      data.forEach((c) => (out[c.id] = c));
    }
    return out;
  }

  // ---------- list ----------
  Z.routes.jobs = async (args, el) => {
    if (args[0] === 'new') return newJob(args[1], el);
    if (args[0]) return jobDetail(args[0], el);

    const f = Z.get('jobs_filter', { show: 'active', tech: '', q: '' });
    let tickets = [], custs = {}, offline = false;
    try {
      let q = Z.sb.from('tickets').select('*').limit(300);
      if (f.show === 'active') q = q.in('status', ACTIVE);
      else if (f.show === 'done') q = q.eq('status', 'done').order('closed_at', { ascending: false });
      if (Z.area && !Z.isField()) q = q.eq('area', Z.area);
      if (f.tech && !Z.isField()) q = q.eq('assigned_to', f.tech);
      const r = await q.order('opened_at', { ascending: false });
      if (r.error) throw r.error;
      tickets = r.data;
      custs = await customersFor(tickets.map((t) => t.customer_id));
      if (f.show === 'active') Z.set('jobs_cache', { tickets, custs, at: Date.now() });
    } catch (e) {
      if (!Z.isNet(e)) throw e;
      const c = Z.get('jobs_cache', { tickets: [], custs: {} });
      tickets = c.tickets; custs = c.custs; offline = true;
    }
    tickets = overlay(tickets).filter((t) => f.show === 'all' || (f.show === 'active' ? ACTIVE.includes(t.status) : t.status === 'done'));
    const pr = { urgent: 0, normal: 1, low: 2 };
    if (f.show === 'active') tickets.sort((a, b) => pr[a.priority] - pr[b.priority] || String(a.scheduled_for || '9').localeCompare(String(b.scheduled_for || '9')) || String(b.opened_at).localeCompare(String(a.opened_at)));

    const techOpts = Z.ref.people.filter((p) => p.role === 'field' && p.active).map((p) => [p.id, p.full_name]);
    const row = (t) => {
      const c = custs[t.customer_id] || {};
      return `<a class="item" href="#jobs/${t.id}"><div class="grow">
          <div class="t">${t.priority === 'urgent' ? '🔴 ' : ''}${Z.esc(c.full_name || t.caller || (t.customer_id ? 'Customer' : 'No customer yet'))} <span class="m">#${t.ticket_no ?? '…'}</span></div>
          <div class="m">${kindName(t.kind)} · ${Z.esc(t.summary)}</div>
          <div class="m">${Z.esc(Z.areaName(t.area))}${c.landmark ? ' · ' + Z.esc(c.landmark) : ''}${t.assigned_to && !Z.isField() ? ' · 👷 ' + Z.esc(Z.personName(t.assigned_to)) : ''}${t.scheduled_for ? ' · 📅 ' + Z.day(t.scheduled_for) : ''}</div>
        </div><div style="text-align:right">${statusPill(t.status, t.kind)}${t._local ? '<div class="m">⏳ not sent</div>' : ''}</div></a>`;
    };
    const today = Z.ymd();
    const draw = () => {
      const ql = f.q.trim().toLowerCase();
      const list = ql ? tickets.filter((t) => [t.summary, t.caller, String(t.ticket_no), (custs[t.customer_id] || {}).full_name, (custs[t.customer_id] || {}).phone].join(' ').toLowerCase().includes(ql)) : tickets;
      const box = Z.$('#j-list', el);
      if (!list.length) { box.innerHTML = `<div class="card"><div class="empty">${ql ? 'No job matches “' + Z.esc(f.q) + '”.' : f.show === 'active' ? (Z.isField() ? 'No jobs for you right now. 🎉' : 'No open jobs. 🎉') : 'Nothing here.'}</div></div>`; return; }
      if (f.show !== 'active') { box.innerHTML = `<div class="card list">${list.map(row).join('')}</div>`; return; }
      const now = list.filter((t) => t.priority === 'urgent' || !t.scheduled_for || t.scheduled_for <= today);
      const later = list.filter((t) => !now.includes(t));
      box.innerHTML = (now.length ? `<h3>Today · ${now.length}</h3><div class="card list">${now.map(row).join('')}</div>` : '')
        + (later.length ? `<h3>Later · ${later.length}</h3><div class="card list">${later.map(row).join('')}</div>` : '');
    };
    el.innerHTML = `
      <div class="row" style="justify-content:space-between"><h2>${Z.isField() ? 'My jobs' : 'Jobs'}${Z.area && !Z.isField() ? ' · ' + Z.esc(Z.areaName(Z.area)) : ''}</h2>
        <a class="btn" href="#jobs/new">＋ ${Z.isField() ? 'Log a job' : 'New job'}</a></div>
      ${offline ? `<div class="alert warn">📴 No signal — showing your jobs as of ${Z.when(Z.get('jobs_cache', {}).at)}. Changes you make will send later.</div>` : ''}
      <div class="subtabs">${[['active', 'To do'], ['done', 'Done'], ['all', 'All']].map(([k, t]) => `<a href="#" data-show="${k}" class="${f.show === k ? 'on' : ''}">${t}</a>`).join('')}</div>
      <div class="row" style="margin-bottom:10px">
        <input type="search" id="j-q" placeholder="🔎 Name, phone or job #" value="${Z.esc(f.q)}" style="flex:1;min-width:160px">
        ${Z.isField() ? '' : `<select id="j-tech" aria-label="Show jobs for one technician" style="width:auto"><option value="">All techs</option>${Z.opts(techOpts, f.tech)}</select>`}
      </div>
      <div id="j-list"></div>
      ${Z.isOffice() ? `<div class="card" style="margin-top:12px"><div class="row"><div class="grow"><b>💳 Payment follow-ups</b><div class="hint" style="margin:2px 0 0">Open by themselves every morning for customers whose time ran out, and close when they renew.</div></div><button class="btn sec small" id="j-follow">Check now</button></div></div>` : ''}`;
    draw();

    Z.$$('[data-show]', el).forEach((a) => (a.onclick = (e) => { e.preventDefault(); f.show = a.dataset.show; Z.set('jobs_filter', f); Z.route(); }));
    const qi = Z.$('#j-q', el);
    qi.oninput = () => { f.q = qi.value; Z.set('jobs_filter', f); draw(); };
    const ts = Z.$('#j-tech', el); if (ts) ts.onchange = () => { f.tech = ts.value; Z.set('jobs_filter', f); Z.route(); };
    const fb = Z.$('#j-follow', el);
    if (fb) fb.onclick = async () => {
      fb.disabled = true;
      const { data, error } = await Z.sb.rpc('refresh_payment_followups');
      if (error) { fb.disabled = false; return Z.fail(error); }
      Z.toast(`${data.opened} new payment follow-up${data.opened === 1 ? '' : 's'} · ${data.closed} closed (renewed).`);
      Z.route();
    };
    Z.onSynced = () => { if (location.hash.startsWith('#jobs')) Z.route(); };
  };

  // ---------- new job ----------
  async function newJob(customerId, el) {
    let cust = null;
    if (customerId) { const m = await customersFor([customerId]); cust = m[customerId] || null; }
    const area = (cust && cust.area) || Z.area || Z.me.area || (Z.ref.areas[0] || {}).code;
    el.innerHTML = `
      <h2>${Z.isField() ? 'Log a job' : 'New job'}</h2>
      <form class="card" id="nj">
        ${Z.isField() ? '' : `
        <label>Customer</label>
        <div id="nj-cust">${cust ? custChip(cust) : ''}</div>
        <div id="nj-find" ${cust ? 'hidden' : ''}>
          <input id="nj-q" placeholder="Type a name, phone or account number" autocomplete="off">
          <div class="list" id="nj-res"></div>
          <p class="hint">No customer yet (new install enquiry)? Leave this empty and fill in the caller.</p>
        </div>`}
        <div class="grid2">
          <div><label>Area</label><select name="area" id="nj-area" ${Z.isField() && Z.me.area ? 'disabled' : ''}>${Z.opts(Z.ref.areas.filter((a) => a.active).map((a) => [a.code, a.name]), area)}</select></div>
          <div><label>Type of job</label><select name="kind">${Z.opts(KINDS, 'fault')}</select></div>
        </div>
        <label>What's wrong / what's needed</label>
        <textarea name="summary" required placeholder="e.g. No internet since morning, router lights red"></textarea>
        <div class="grid2">
          <div><label>Caller name & phone</label><input name="caller" placeholder="If different from the customer"></div>
          <div><label>Priority</label><select name="priority">${Z.opts([['normal', 'Normal'], ['urgent', 'Urgent'], ['low', 'Low']], 'normal')}</select></div>
        </div>
        ${Z.isField() ? '' : `<div class="grid2">
          <div><label>Send to tech</label><select name="assigned_to" id="nj-tech"></select></div>
          <div><label>Visit day</label><input type="date" name="scheduled_for" value="${Z.ymd()}"></div>
        </div>`}
        <div style="height:14px"></div>
        <button class="btn block" type="submit">Save job</button>
      </form>`;

    let chosen = cust;
    const fillTechs = () => { const s = Z.$('#nj-tech', el); if (!s) return; const a = Z.$('#nj-area', el).value; s.innerHTML = '<option value="">Not yet — decide later</option>' + Z.opts(Z.techs(a).map((p) => [p.id, p.full_name])); };
    fillTechs();
    Z.$('#nj-area', el).onchange = fillTechs;

    const qi = Z.$('#nj-q', el);
    if (qi) {
      let tmr;
      qi.oninput = () => {
        clearTimeout(tmr);
        tmr = setTimeout(async () => {
          const res = await Z.searchCustomers(qi.value, 8);
          Z.$('#nj-res', el).innerHTML = res.map((c) => `<a href="#" class="item" data-id="${c.id}"><div class="grow"><div class="t">${Z.esc(c.full_name)}</div><div class="m">${Z.esc([c.phone, c.account_no, Z.areaName(c.area), c.landmark].filter(Boolean).join(' · '))}</div></div></a>`).join('') || (qi.value.trim() ? '<div class="muted">No match.</div>' : '');
          Z.$$('#nj-res [data-id]', el).forEach((a) => (a.onclick = (e) => {
            e.preventDefault();
            chosen = res.find((c) => c.id === a.dataset.id);
            Z.$('#nj-cust', el).innerHTML = custChip(chosen);
            Z.$('#nj-find', el).hidden = true;
            Z.$('#nj-area', el).value = chosen.area; fillTechs();
            Z.$('#nj-clear', el).onclick = (ev) => { ev.preventDefault(); chosen = null; Z.$('#nj-cust', el).innerHTML = ''; Z.$('#nj-find', el).hidden = false; };
          }));
        }, 300);
      };
    }
    const clr = Z.$('#nj-clear', el); if (clr) clr.onclick = (e) => { e.preventDefault(); chosen = null; Z.$('#nj-cust', el).innerHTML = ''; Z.$('#nj-find', el).hidden = false; };

    Z.$('#nj', el).onsubmit = (e) => {
      e.preventDefault();
      const d = Z.formData(e.target);
      const row = {
        id: Z.uuid(),
        customer_id: chosen ? chosen.id : null,
        area: Z.isField() ? (Z.me.area || d.area || area) : d.area,
        kind: d.kind, priority: d.priority,
        summary: d.summary.trim(),
        caller: d.caller.trim() || null,
        assigned_to: Z.isField() ? Z.me.id : d.assigned_to || null,
        scheduled_for: Z.isField() ? Z.ymd() : d.scheduled_for || null,
        opened_by: Z.me.id,
      };
      if (!Z.enqueue('ticket_insert', { row })) return; // 7 Oct deep check #39: the phone couldn't keep it — never say "saved"
      Z.toast(navigator.onLine ? 'Job saved.' : 'Job saved on this phone — it sends when you have signal.');
      Z.go('jobs/' + row.id);
    };
  }
  const custChip = (c) => `<div class="row card" style="margin:0;padding:10px"><div class="grow"><b>${Z.esc(c.full_name)}</b><div class="hint" style="margin:0">${Z.esc([c.phone, c.account_no, Z.areaName(c.area)].filter(Boolean).join(' · '))}</div></div><a href="#" id="nj-clear" class="btn sec small">Change</a></div>`;

  // 7 Oct deep check #3: the person already on the job is always a choice, even if they moved area or were
  // switched off — otherwise the box shows "Nobody yet" and saving a new date silently takes the job off them.
  function techChoices(t) {
    const list = Z.techs(t.area).map((p) => [p.id, p.full_name]);
    if (t.assigned_to && !list.some(([id]) => id === t.assigned_to)) {
      const p = Z.ref.people.find((x) => x.id === t.assigned_to) || {};
      list.unshift([t.assigned_to, (p.full_name || Z.personName(t.assigned_to) || 'Current tech') + (p.active === false ? ' (switched off)' : p.role && p.role !== 'field' ? '' : ' (other area)')]);
    }
    return list;
  }

  // ---------- one job ----------
  async function jobDetail(id, el) {
    let t = null, c = null, events = [], parts = [], offline = false;
    try {
      const r = await Z.sb.from('tickets').select('*').eq('id', id).maybeSingle();
      if (r.error) throw r.error;
      t = r.data;
      if (t) {
        const [ev, pa, cm] = await Promise.all([
          Z.sb.from('ticket_events').select('*').eq('ticket_id', id).order('at'),
          Z.sb.from('ticket_parts').select('*').eq('ticket_id', id).order('added_at'),
          customersFor([t.customer_id]),
        ]);
        if (ev.error) throw ev.error;
        if (pa.error) throw pa.error;
        events = ev.data; parts = pa.data; c = cm[t.customer_id] || null;
        Z.set('job_' + id, { t, c, events, parts, at: Date.now() });
      }
    } catch (e) {
      if (!Z.isNet(e)) throw e;
      offline = true;
      const cached = Z.get('job_' + id, null);
      if (cached) ({ t, c, events, parts } = cached);
      else {
        const lc = Z.get('jobs_cache', { tickets: [], custs: {} });
        t = lc.tickets.find((x) => x.id === id) || null;
        c = t ? lc.custs[t.customer_id] || null : null;
      }
    }
    t = overlay(t ? [t] : []).find((x) => x.id === id) || null;
    if (!t) { el.innerHTML = '<div class="card">This job isn\'t available. It may have been reassigned.</div>'; return; }
    events = events.concat(queuedChildren('event', id).filter((e) => !events.some((x) => x.id === e.id)));
    const deleted = new Set(Z.queue.filter((q) => q.op === 'part_delete').map((q) => q.data.id));
    parts = parts.concat(queuedChildren('part', id).filter((p) => !parts.some((x) => x.id === p.id))).filter((p) => !deleted.has(p.id));

    const mine = t.assigned_to === Z.me.id;
    const canWork = mine || Z.isOffice();
    // 7 Oct deep check #4: the database only takes a field tech's pin while the job is open, so don't offer it after.
    const canPin = canWork && (Z.isOffice() || ACTIVE.includes(t.status));
    const lat = (c && c.lat) || t.site_lat, lng = (c && c.lng) || t.site_lng;
    const techPhone = t.assigned_to ? ((Z.ref.people.find((p) => p.id === t.assigned_to) || {}).phone || '') : '';
    const techText = `Zuri job #${t.ticket_no} — ${kindName(t.kind)}${t.scheduled_for ? ' · ' + Z.day(t.scheduled_for) : ''}${t.priority === 'urgent' ? ' · URGENT' : ''}\n${c ? c.full_name + (c.phone ? ' (' + c.phone + ')' : '') : t.caller || ''}\n${t.summary}${c && c.landmark ? '\n📍 ' + c.landmark : ''}${lat != null ? '\n' + mapLink(lat, lng) : ''}\nOpen Zuri → Jobs for details.`;
    const photos = events.filter((e) => e.kind === 'photo' && !e._local);
    const localPhotos = Z.queue.filter((q) => q.op === 'photo' && q.data.row.ticket_id === id);

    el.innerHTML = `
      <p style="margin:0 0 6px"><a class="back" href="#jobs">← Jobs</a></p><!-- 7 Oct deep check #37: 44 px back link -->
      ${offline ? '<div class="alert warn">📴 No signal — showing what this phone has saved. Your changes send later.</div>' : ''}
      <div class="row" style="justify-content:space-between"><h2 style="margin-bottom:4px">Job #${t.ticket_no ?? '…'} · ${kindName(t.kind)}</h2>${statusPill(t.status, t.kind)}</div>
      <p class="hint" style="margin-top:0">${t.priority === 'urgent' ? '🔴 Urgent · ' : ''}Opened ${Z.when(t.opened_at)}${t.caller ? ' · caller: ' + Z.esc(t.caller) : ''}${t.closed_at ? ' · closed ' + Z.when(t.closed_at) : ''}</p>
      <div class="card"><b>Problem</b><p style="margin:4px 0 0">${Z.esc(t.summary)}</p></div>

      <div class="card">
        ${c ? `<div class="row"><div class="grow"><b style="font-size:17px">${Z.esc(c.full_name)}</b><div class="hint" style="margin:0">${Z.esc(Z.areaName(t.area))}${c.account_no ? ' · ' + Z.esc(c.account_no) : ''}${c.plan ? ' · ' + Z.esc(c.plan) : ''}${c.monthly_rate ? ' · ' + Z.kes(c.monthly_rate) : ''}</div>
            ${c.paid_until ? `<div class="hint" style="margin:2px 0 0">${new Date(c.paid_until) < new Date() ? '<span class="pill bad">Service ran out</span> ' : 'Paid until '}${Z.when(c.paid_until)}</div>` : ''}</div>
            ${Z.isOffice() ? `<a class="btn sec small" href="#customers/${c.id}">Profile</a>` : ''}</div>
          ${c.landmark ? `<p style="margin:8px 0 0">📍 ${Z.esc(c.landmark)}</p>` : ''}
          <div class="row" style="margin-top:10px">
            ${c.phone ? `<a class="btn sec" href="tel:${Z.esc(c.phone)}">📞 Call ${Z.esc(c.phone)}</a>` : ''}
            ${c.phone2 ? `<a class="btn sec" href="tel:${Z.esc(c.phone2)}">📞 ${Z.esc(c.phone2)}</a>` : ''}
          </div>`
        : `<b>No customer linked</b><div class="hint">${Z.esc(Z.areaName(t.area))}</div>`}
        <div class="row" style="margin-top:10px">
          ${lat != null ? `<a class="btn sec" href="${mapLink(lat, lng)}" target="_blank" rel="noopener">🗺️ Open map</a><button class="btn sec" id="jd-send">📤 Send pin</button>` : `<span class="hint">No map pin yet.</span>${c && c.phone ? `<a class="btn sec" target="_blank" rel="noopener" href="${Z.esc(wa(c.phone, `Hello ${c.full_name.split(' ')[0]}, this is ${Z.co ? Z.co().name : 'Zuri Fiber'}. So our technician can find you, please send us your location: in WhatsApp tap 📎 → Location → Send your current location. Thank you!`))}">💬 Ask customer for location</a>` : ''}`}
          ${canPin ? `<button class="btn sec" id="jd-pin">📍 ${lat != null ? 'Move pin to here' : 'Drop pin here'}</button>` : canWork && Z.isField() ? '<span class="hint">Pins are dropped before the job is finished — ask the office to move it.</span>' : ''}
        </div>
      </div>

      ${t.kind === 'billing' && Z.isOffice() && ACTIVE.includes(t.status) ? `
      <h3>Payment follow-up</h3>
      <div class="card">
        <p class="hint" style="margin-top:0">Call the customer, then tap what happened. It closes by itself once they renew.</p>
        <div class="seg" id="jd-out">
          <button type="button" data-out="noanswer">📵 No answer</button>
          <button type="button" data-out="promise">🤝 Will pay</button>
          <button type="button" data-out="paid">✅ Says paid</button>
          <button type="button" data-out="stop">✋ Wants to stop</button>
        </div>
        ${c ? (() => {
          /* 8 Oct (Jerry): Billnasi already texts every customer 3 days before the package runs out, then switches them off.
             So our part starts AFTER the cutoff: the right words for each day since, then a kind goodbye at day 30. */
          const days = c.paid_until ? Math.max(0, Math.floor((Date.now() - new Date(c.paid_until)) / 864e5)) : 0;
          const step = Z.AFTER_CUTOFF.find((x) => days >= x.from && days <= x.to) || Z.AFTER_CUTOFF[0];
          const msg = step.msg(c, days);
          const tl = Z.AFTER_CUTOFF.map((x) => `<span class="pill ${x === step ? 'brand' : days > x.to ? 'ok' : ''}" style="${x === step ? 'font-weight:800' : ''}">${x.short}</span>`).join(' ');
          return `<div style="margin-top:12px;border-top:1px solid var(--line);padding-top:10px">
            <div class="hint" style="margin:0 0 6px">Billnasi already texted them 3 days before and switched them off ${c.paid_until ? 'on ' + Z.day(c.paid_until.slice(0, 10)) : ''} — <b>${days === 0 ? 'today' : days === 1 ? '1 day ago' : days + ' days ago'}</b>. Our part starts now.</div>
            <div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:8px">${tl}</div>
            <b>${Z.esc(step.name)}</b>
            <p class="hint" style="margin:2px 0 8px">${Z.esc(step.how)}</p>
            <div class="card" style="background:var(--surface-2,#f3f1ec);font-size:14.5px;margin:0 0 8px" id="jd-msgtext">${Z.esc(msg)}</div>
            ${c.phone ? `<div class="row"><a class="btn sec" id="jd-sms" href="${Z.esc(Z.smsHref(c.phone, msg))}">📩 Text it</a><a class="btn sec" id="jd-wa" target="_blank" rel="noopener" href="${Z.esc(wa(c.phone, msg))}">💬 WhatsApp it</a><a class="btn sec" href="tel:${Z.esc(c.phone)}">📞 Call</a></div>` : '<p class="hint">No phone number for this customer — add one on their page.</p>'}
            <p class="hint" style="margin:6px 0 0">The message is written for you — just press send. ${step.next != null ? 'After you send it, this follow-up comes back on day ' + step.next + ' for the next step.' : ''}</p>
            <div class="row" style="margin-top:8px;flex-wrap:wrap">
              <button type="button" class="btn sec small" id="jd-fault">🛠 Service problem — open a fault job</button>
              ${step.key === 'd30' ? '<button type="button" class="btn small" id="jd-lapse">👋 Goodbye sent — close for this time</button>' : ''}
            </div></div>`; })() : ''}
      </div>` : ''}
      ${Z.isOffice() ? `
      <h3>Who's going, and when</h3>
      <form class="card" id="jd-disp">
        <div class="grid3">
          <div><label>Tech</label><select name="assigned_to"><option value="">Nobody yet</option>${Z.opts(techChoices(t), t.assigned_to)}</select></div>
          <div><label>Visit day</label><input type="date" name="scheduled_for" value="${Z.esc(t.scheduled_for || '')}"></div>
          <div><label>Priority</label><select name="priority">${Z.opts([['normal', 'Normal'], ['urgent', 'Urgent'], ['low', 'Low']], t.priority)}</select></div>
        </div>
        <div class="row" style="margin-top:12px"><button class="btn" type="submit">Save</button>
          ${t.assigned_to && techPhone ? `<a class="btn sec" target="_blank" rel="noopener" href="${Z.esc(wa(techPhone, techText))}">💬 Tell ${Z.esc(Z.personName(t.assigned_to).split(' ')[0])} on WhatsApp</a>` : ''}
          ${t.status !== 'cancelled' && t.status !== 'done' ? '<button class="btn sec" type="button" id="jd-cancel">Cancel job</button>' : ''}
          ${t.status === 'done' || t.status === 'cancelled' ? '<button class="btn sec" type="button" id="jd-reopen">Reopen</button>' : ''}</div>
      </form>` : ''}

      ${canWork ? `
      <h3>The work</h3>
      <form class="card" id="jd-work">
        <button type="submit" data-status="" aria-hidden="true" tabindex="-1" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"></button><!-- Enter key = save, never "finished" -->
        <label>What did you find?</label>
        ${chips('findings', FOUND)}
        <textarea name="findings" placeholder="Tap above, or type">${Z.esc(t.findings || '')}</textarea>
        <label>What did you do?</label>
        ${chips('work_done', DID)}
        <textarea name="work_done" placeholder="Tap above, or type">${Z.esc(t.work_done || '')}</textarea>
        <label>Did the customer pay you?</label>
        <div class="seg" id="jd-paid">${[['', '🙅 No'], ['cash', '💵 Cash'], ['mpesa', '📱 M-Pesa']].map(([k, l]) => `<button type="button" data-v="${k}" class="${(t.collection_method || '') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <input type="hidden" name="collection_method" value="${Z.esc(t.collection_method || '')}">
        <div class="grid2" id="jd-money" ${t.collection_method ? '' : 'hidden'}>
          <div><label>How much? (KES)</label><input name="amount_collected" inputmode="numeric" value="${t.amount_collected ? Z.esc(t.amount_collected) : ''}" placeholder="0"></div>
          <div id="jd-code" ${t.collection_method === 'mpesa' ? '' : 'hidden'}><label>M-Pesa code</label><input name="collection_ref" value="${Z.esc(t.collection_ref || '')}" placeholder="e.g. SJK3X9ABCD" autocapitalize="characters"></div>
        </div>
        <div style="height:14px"></div>
        ${ACTIVE.includes(t.status) ? '<button class="btn block" type="submit" data-status="done" style="min-height:52px;font-size:17px">✅ Job finished</button>' : ''}<!-- 7 Oct deep check #25: not on a cancelled job (Reopen it first) -->
        <div class="row" style="margin-top:8px">
          ${['open', 'assigned'].includes(t.status) ? '<button class="btn sec" type="submit" data-status="in_progress">▶ I\'m starting now</button>' : ''}
          <button class="btn sec" type="submit" data-status="">💾 Save for later</button>
        </div>
      </form>

      <h3>Parts & equipment used</h3>
      <div class="card">
        <div class="list">${parts.length ? parts.map((p) => `<div class="item"><div class="grow"><div class="t">${Z.esc(p.item)} × ${Z.esc(p.qty)}</div><div class="m">${p.serial ? 'Serial ' + Z.esc(p.serial) : ''}${p._local ? ' ⏳ not sent' : ''}</div></div>${p.added_by === Z.me.id || Z.isAdmin() ? `<button class="btn sec small" data-delpart="${p.id}">Remove</button>` : ''}</div>`).join('') : '<div class="muted">None recorded.</div>'}</div>
        <form id="jd-part" class="grid3" style="margin-top:8px;align-items:end">
          <div><label>Item</label><input name="item" required placeholder="e.g. ONT router, 50m drop cable"></div>
          <div><label>Serial (if any)</label><input name="serial" autocapitalize="characters"></div>
          <div class="row"><div class="grow"><label>Qty</label><input name="qty" inputmode="decimal" value="1"></div><button class="btn sec" type="submit">Add</button></div>
        </form>
      </div>` : ''}

      <h3>Photos</h3>
      <div class="card">
        <div class="photos" id="jd-photos">${photos.length ? '<span class="muted">Loading photos…</span>' : localPhotos.length ? '' : '<span class="muted">No photos yet.</span>'}</div>
        <div class="photos" id="jd-lphotos"></div>
        ${canWork ? `<label class="btn sec" style="margin-top:10px">📷 Add photo<input type="file" accept="image/*" capture="environment" id="jd-photo" hidden></label>` : ''}
      </div>

      <h3>Notes</h3>
      <div class="card">
        <div class="timeline">${events.filter((e) => e.kind !== 'photo').map((e) => `<div class="ev"><div>${Z.esc(e.body)}</div><div class="m">${Z.esc(Z.personName(e.by) || '')} · ${Z.when(e.at)}${e._local ? ' · ⏳ not sent' : ''}</div></div>`).join('') || '<div class="muted">No notes yet.</div>'}</div>
        <form id="jd-note" class="row" style="margin-top:8px"><input class="grow" name="body" required placeholder="Add a note" style="flex:1"><button class="btn sec" type="submit">Add</button></form>
      </div>`;

    const note = (body, kind = 'note') => Z.enqueue('event', { row: { id: Z.uuid(), ticket_id: id, by: Z.me.id, kind, body, at: new Date().toISOString() } });
    // 7 Oct deep check #39: only say "saved" when the phone really kept it (Z.enqueue already showed "storage is full").
    const update = (fields, msg) => { if (!Z.enqueue('ticket_update', { id, fields })) return false; if (msg) Z.toast(msg); Z.route(); return true; };

    const disp = Z.$('#jd-disp', el);
    if (disp) {
      disp.onsubmit = (e) => {
        e.preventDefault();
        const d = Z.formData(disp);
        const fields = { assigned_to: d.assigned_to || null, scheduled_for: d.scheduled_for || null, priority: d.priority };
        if (fields.assigned_to && t.status === 'open') fields.status = 'assigned';
        if (!fields.assigned_to && t.status === 'assigned') fields.status = 'open';
        if (fields.assigned_to !== t.assigned_to) note(fields.assigned_to ? 'Sent to ' + Z.personName(fields.assigned_to) : 'Taken off ' + Z.personName(t.assigned_to), 'assign');
        update(fields, 'Dispatch saved.');
      };
      const cx = Z.$('#jd-cancel', el); if (cx) cx.onclick = () => { if (!confirm('Cancel this job?')) return; note('Job cancelled', 'status'); update({ status: 'cancelled' }, 'Job cancelled.'); };
      const ro = Z.$('#jd-reopen', el); if (ro) ro.onclick = () => { note('Job reopened', 'status'); update({ status: t.assigned_to ? 'assigned' : 'open' }, 'Job reopened.'); };
    }

    const work = Z.$('#jd-work', el);
    if (work) {
      Z.$$('.chips', work).forEach((box) => Z.$$('button', box).forEach((b) => (b.onclick = () => {
        const ta = work[box.dataset.for];
        const parts = ta.value.split(/\s*·\s*/).filter(Boolean);
        const i = parts.indexOf(b.textContent);
        if (i >= 0) parts.splice(i, 1); else parts.push(b.textContent);
        ta.value = parts.join(' · ');
        b.classList.toggle('on', i < 0);
      })));
      Z.$$('.chips', work).forEach((box) => { const v = work[box.dataset.for].value.split(/\s*·\s*/); Z.$$('button', box).forEach((b) => b.classList.toggle('on', v.includes(b.textContent))); });
      Z.$$('#jd-paid [data-v]', work).forEach((b) => (b.onclick = () => {
        work.collection_method.value = b.dataset.v;
        Z.$$('#jd-paid button', work).forEach((x) => x.classList.toggle('on', x === b));
        Z.$('#jd-money', work).hidden = !b.dataset.v;
        Z.$('#jd-code', work).hidden = b.dataset.v !== 'mpesa';
        if (b.dataset.v) work.amount_collected.focus();
      }));
      work.onsubmit = (e) => {
        e.preventDefault();
        const d = Z.formData(work);
        const status = e.submitter ? e.submitter.dataset.status : '';
        const amt = d.collection_method ? Z.num(d.amount_collected) || 0 : 0;
        if (d.collection_method && amt <= 0) return Z.toast('How much did they pay? Type the amount.');
        if (amt > 0 && d.collection_method === 'mpesa' && !(d.collection_ref || '').trim()) return Z.toast('Add the M-Pesa code from the customer\'s message so the payment can be matched.');
        if (status === 'done' && !d.work_done.trim()) return Z.toast('Tap or write what you did, then press Job finished.');
        const ref = (d.collection_ref || '').trim();
        const fields = {
          findings: d.findings.trim() || null, work_done: d.work_done.trim() || null,
          amount_collected: amt, collection_method: amt > 0 ? d.collection_method : null,
          collection_ref: amt > 0 && d.collection_method === 'mpesa' && ref ? ref.toUpperCase() : null,
        };
        if (status) { fields.status = status; note(status === 'done' ? 'Job done' + (amt ? ` · collected ${Z.kes(amt)} (${d.collection_method})` : '') : 'Job started', 'status'); }
        update(fields, navigator.onLine ? 'Saved.' : 'Saved on this phone — sends when you have signal.');
      };
    }

    const partF = Z.$('#jd-part', el);
    if (partF) partF.onsubmit = (e) => {
      e.preventDefault();
      const d = Z.formData(partF);
      if (!Z.enqueue('part', { row: { id: Z.uuid(), ticket_id: id, item: d.item.trim(), serial: d.serial.trim().toUpperCase() || null, qty: Z.num(d.qty) || 1, added_by: Z.me.id } })) return; // #39
      Z.route();
    };
    Z.$$('[data-delpart]', el).forEach((b) => (b.onclick = () => {
      const pid = b.dataset.delpart;
      const queued = Z.queue.find((q) => q.op === 'part' && q.data.row.id === pid);
      if (queued) { Z.queue = Z.queue.filter((q) => q !== queued); Z.saveQueue(); Z.syncBadge(); }
      else Z.enqueue('part_delete', { id: pid });
      Z.route();
    }));

    Z.$('#jd-note', el).onsubmit = (e) => { e.preventDefault(); if (!note(e.target.body.value.trim())) return; Z.route(); }; // #39

    // A reminder sent is part of the story of this job.
    // 8 Oct: each text belongs to a step of the after-cutoff path; once sent, the job comes back on the next step's day.
    const cutStep = () => { if (!c || !c.paid_until) return null; const days = Math.max(0, Math.floor((Date.now() - new Date(c.paid_until)) / 864e5)); return Z.AFTER_CUTOFF.find((x) => days >= x.from && days <= x.to) || null; };
    const sentVia = (how) => { const st = cutStep(); note((how === 'sms' ? '📩 ' : '💬 ') + (st ? st.name + ' — ' : '') + (how === 'sms' ? 'text sent' : 'WhatsApp sent'));
      if (st && st.next != null) { const back = new Date(new Date(c.paid_until).getTime() + st.next * 864e5); setTimeout(() => update({ scheduled_for: Z.ymd(back) }, 'Sent. It comes back on ' + Z.day(Z.ymd(back)) + ' for the next step.'), 1200); }
      else setTimeout(Z.route, 1500); };
    const smsB = Z.$('#jd-sms', el); if (smsB) smsB.onclick = () => sentVia('sms');
    const waB = Z.$('#jd-wa', el); if (waB) waB.onclick = () => sentVia('wa');
    const faultB = Z.$('#jd-fault', el); if (faultB && c) faultB.onclick = () => { note('🛠 Customer reports a service problem — fault job opened'); Z.go('jobs/new/' + c.id); };
    const lapseB = Z.$('#jd-lapse', el); if (lapseB) lapseB.onclick = () => {
      if (!confirm('Close this follow-up? The customer stays in Zuri, and a new follow-up only opens if they pay and run out again.')) return;
      note('👋 Day-30 goodbye sent — follow-up closed for this time'); update({ status: 'done', work_done: 'Not renewed after 30 days — kind goodbye sent' }, 'Closed. They are welcome back any time.'); };
    Z.$$('#jd-out [data-out]', el).forEach((b) => (b.onclick = () => {
      const k = b.dataset.out;
      if (k === 'noanswer') { note('📵 Called — no answer'); return update({ scheduled_for: Z.ymd(new Date(Date.now() + 864e5)) }, 'Noted. It comes back tomorrow.'); }
      if (k === 'paid') { note('✅ Customer says they paid — check the next billing import'); Z.toast('Noted. It closes itself when the payment shows.'); return Z.route(); }
      if (k === 'stop') {
        if (!confirm('Close this follow-up because the customer wants to stop?')) return;
        note('✋ Customer wants to stop the service'); return update({ status: 'cancelled' }, 'Closed. Office can disconnect on the billing website.');
      }
      const sh = Z.sheet('🤝 When will they pay?', `<div class="seg">${[[1, 'Tomorrow'], [3, 'In 3 days'], [7, 'Next week']].map(([n, l]) => `<button type="button" data-d="${n}">${l}</button>`).join('')}</div>
        <label>Or pick a day</label><input type="date" id="pp-day" min="${Z.ymd()}">
        <div style="height:12px"></div><button class="btn block" id="pp-ok">Save</button>`);
      const day = Z.$('#pp-day', sh.el);
      Z.$$('[data-d]', sh.el).forEach((x) => (x.onclick = () => { day.value = Z.ymd(new Date(Date.now() + x.dataset.d * 864e5)); Z.$$('[data-d]', sh.el).forEach((y) => y.classList.toggle('on', y === x)); }));
      Z.$('#pp-ok', sh.el).onclick = () => {
        if (!day.value) return Z.toast('Pick a day.');
        sh.close(); note('🤝 Promised to pay by ' + Z.day(day.value)); update({ scheduled_for: day.value }, 'Saved. We\'ll check again on ' + Z.day(day.value) + '.');
      };
    }));

    const pinB = Z.$('#jd-pin', el);
    if (pinB) pinB.onclick = () => {
      if (!navigator.geolocation) return Z.toast('This phone can\'t share its location.');
      pinB.disabled = true; pinB.textContent = '📍 Finding you…';
      if (lat != null && !confirm('Move this customer\'s pin to where you are standing now?')) { pinB.disabled = false; pinB.textContent = '📍 Move pin to here'; return; }
      navigator.geolocation.getCurrentPosition((pos) => {
        const acc = Math.round(pos.coords.accuracy);
        // A phone indoors can be 100 m+ off — that sends the next tech to the wrong house.
        if (acc > 50 && !confirm(`Your location is only accurate to about ${acc} m. Step outside, wait a minute and try again for a better pin.\n\nSave this rough pin anyway?`)) { pinB.disabled = false; pinB.textContent = '📍 Try the pin again'; return; }
        const la = +pos.coords.latitude.toFixed(6), ln = +pos.coords.longitude.toFixed(6);
        if (c) Z.enqueue('customer_save', { p: { id: c.id, lat: la, lng: ln } });
        Z.enqueue('ticket_update', { id, fields: { site_lat: la, site_lng: ln } });
        if (c) { const cache = Z.get('job_' + id, null); if (cache && cache.c) { cache.c.lat = la; cache.c.lng = ln; Z.set('job_' + id, cache); } }
        Z.toast(`Pin saved (accurate to about ${Math.round(pos.coords.accuracy)} m).`);
        Z.route();
      }, (err) => { pinB.disabled = false; pinB.textContent = '📍 Drop pin here'; Z.toast(err.code === 1 ? 'Allow location for this app in the phone settings.' : 'Couldn\'t get a location — step outside and try again.'); },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
    };
    const sendB = Z.$('#jd-send', el);
    if (sendB) sendB.onclick = async () => {
      const text = `Zuri job #${t.ticket_no} — ${c ? c.full_name : t.caller || ''}${c && c.phone ? ' (' + c.phone + ')' : ''}\n${t.summary}${c && c.landmark ? '\n📍 ' + c.landmark : ''}\n${mapLink(lat, lng)}`;
      if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    };

    const ph = Z.$('#jd-photo', el);
    // Photos wait on the phone (no signal is fine) and upload with the rest of the queue.
    if (ph) ph.onchange = async () => {
      const file = ph.files[0]; if (!file) return;
      try {
        const blob = await shrink(file);
        const key = 'photo_' + Z.uuid();
        await Z.idb.put(key, blob);
        const row = { id: Z.uuid(), ticket_id: id, by: Z.me.id, kind: 'photo', body: `${id}/${Z.uuid()}.jpg`, at: new Date().toISOString() };
        if (!Z.enqueue('photo', { key, row })) { Z.idb.del(key).catch(() => {}); return; }
        Z.toast(navigator.onLine ? 'Photo saved — uploading.' : 'Photo saved on this phone — it uploads when you have signal.');
        Z.route();
      } catch (e) { Z.toast('This phone couldn\'t keep the photo (storage may be full).'); console.error(e); }
    };
    if (localPhotos.length) {
      const box = Z.$('#jd-lphotos', el);
      const urls = await Promise.all(localPhotos.map((q) => Z.idb.get(q.data.key).then((b) => (b ? URL.createObjectURL(b) : null)).catch(() => null)));
      if (box) box.innerHTML = urls.filter(Boolean).map((u) => `<div style="position:relative"><img src="${u}" alt="Photo waiting to upload"><span class="pill warn" style="position:absolute;left:4px;bottom:4px">⏳</span></div>`).join('');
    }
    if (photos.length && navigator.onLine) {
      const { data } = await Z.sb.storage.from('ticket-photos').createSignedUrls(photos.map((p) => p.body), 3600);
      const box = Z.$('#jd-photos', el);
      if (box && data) box.innerHTML = data.filter((d) => d.signedUrl).map((d) => `<a href="${Z.esc(d.signedUrl)}" target="_blank" rel="noopener"><img src="${Z.esc(d.signedUrl)}" alt="Job photo"></a>`).join('');
    } else if (photos.length) Z.$('#jd-photos', el).innerHTML = '<span class="muted">Photos show when you have signal.</span>';
  }

  // Phone photos are 3–8 MB; 1600 px JPEG is plenty and uploads on weak signal.
  function shrink(file) {
    return new Promise((ok, no) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        cv.toBlob((b) => (b ? ok(b) : no(new Error('Could not read the photo'))), 'image/jpeg', 0.8);
      };
      img.onerror = () => no(new Error('Could not read the photo'));
      img.src = URL.createObjectURL(file);
    });
  }
})();
