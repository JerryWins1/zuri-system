// Zuri System · Customers: search, profile, add/edit, pin, history · v1.1 · 2026-10-17 (💬 Send a quote; v1: 2026-09-30)
(function () {
  const Z = window.Z;
  const COLS = 'id,full_name,area,landmark,lat,lng,status,account_no,phone,phone2,email,national_id,plan,monthly_rate,billnasi_id,install_date,notes,custom,created_at,updated_at,paid_until';
  const STATUSES = [['active', 'Active'], ['lead', 'Lead (not installed yet)'], ['suspended', 'Suspended'], ['disconnected', 'Disconnected']];
  const PAUSE_WHY = [['away', 'Away for a while'], ['unpaid', 'Has not paid'], ['other', 'Something else']];
  const statusPill = (s) => `<span class="pill ${s === 'active' ? 'ok' : s === 'suspended' ? 'warn' : s === 'disconnected' ? 'bad' : ''}">${Z.esc((STATUSES.find((x) => x[0] === s) || [s, s])[1].split(' (')[0])}</span>`;
  // Fields an admin can hide per role (the rest are always shown).
  const FIELDS = [
    ['full_name', 'Full name', 'text', true], ['phone', 'Phone', 'tel'], ['phone2', 'Second phone', 'tel'], ['email', 'Email', 'email'],
    ['account_no', 'Account number', 'text'], ['billnasi_id', 'Billing website ID', 'text'], ['national_id', 'National ID', 'text'],
    ['plan', 'Package / plan', 'text'], ['monthly_rate', 'Monthly rate (KES)', 'number'], ['paid_until', 'Paid until (from billing)', 'readonly'], ['install_date', 'Install date', 'date'],
    ['landmark', 'Directions / landmark', 'text', true], ['notes', 'Notes', 'textarea'],
  ];
  const ALWAYS = ['full_name', 'landmark', 'area', 'status', 'lat', 'lng'];
  Z.CUSTOMER_FIELDS = FIELDS;
  const visible = (f) => ALWAYS.includes(f) || Z.canSee('customer', f);

  const clean = (q) => String(q || '').replace(/[,()*%\\]/g, ' ').trim();
  // 7 Oct deep check #12: a phone number typed as +254 7.., 254 7.., 07.. or with spaces finds the same customer.
  // Numbers are matched on their last 9 digits, which every Kenyan format shares.
  const findOr = (q) => {
    const digits = q.replace(/\D/g, '');
    const isPhone = /^[+\d\s\-()]+$/.test(q) && digits.length >= 6;
    const ph = isPhone ? (digits.length >= 9 ? digits.slice(-9) : digits.replace(/^254/, '').replace(/^0/, '')) : q;
    return `full_name.ilike.*${q}*,phone.ilike.*${ph}*,phone2.ilike.*${ph}*,account_no.ilike.*${q}*`;
  };
  Z.searchCustomers = async (q, limit = 30) => {
    q = clean(q);
    if (!q) return [];
    const { data, error } = await Z.sb.from('v_customers').select('id,full_name,phone,account_no,area,landmark,status')
      .or(findOr(q)).order('full_name').limit(limit);
    if (error) throw error;
    return data;
  };

  Z.routes.customers = async (args, el) => {
    if (args[0] === 'new') return edit(null, el);
    if (args[0] === 'map') return Z.customerMap(el);
    if (args[0] && args[1] === 'edit') return edit(args[0], el);
    if (args[0]) return profile(args[0], el);

    const f = Z.get('cust_filter', { q: '', status: 'active', page: 0 });
    const per = 50;

    // v2.53 (Veronicah, 29 Oct: "when typing the customer name it kept disappearing, or if i wanted to
    //        delete the name so as to search another one"). Every keystroke used to re-run the whole route,
    //        which rebuilt this screen — the search box included. While it was being rebuilt nothing had
    //        focus, so keys pressed in that gap were dropped by the browser, and the caret was then forced
    //        to the end, which made correcting or clearing the box a fight. Typing "Grace" one key at a
    //        time gave "Gae". So the box and the heading are built ONCE here and never touched again;
    //        only the body below is repainted.
    el.innerHTML = `
      <div class="row" style="justify-content:space-between"><h2>Customers${Z.area ? ' · ' + Z.esc(Z.areaName(Z.area)) : ''} <span class="muted" id="c-count" style="font-size:15px"></span></h2>
        <div class="row"><a class="btn sec" href="#customers/map">🗺️ Map</a><a class="btn sec" href="#alerts">📣 Alerts</a><a class="btn" href="#customers/new">＋ New customer</a></div></div>
      <div class="row" style="margin-bottom:10px">
        <input id="c-q" placeholder="Search name, phone, account" value="${Z.esc(f.q)}" style="flex:1">
        <select id="c-st" aria-label="Show customers with this status" style="width:auto"><option value="">Any status</option>${Z.opts(STATUSES.map(([k, t]) => [k, t.split(' (')[0]]), f.status)}</select>
      </div>
      <div id="c-body"><div class="loading">Loading…</div></div>`;

    async function paint() {
      const body = Z.$('#c-body', el); if (!body) return;
      let q = Z.sb.from('v_customers').select('id,full_name,phone,account_no,area,landmark,status,plan,lat', { count: 'exact' });
      if (clean(f.q)) q = q.or(findOr(clean(f.q))); // #12
      // v2.36 (15 Oct): a search looks at EVERY status. The list opens on Active, so “search first” before a new customer
      //       missed Leads and switched-off customers, and the same person was added twice.
      if (f.status && !clean(f.q)) q = q.eq('status', f.status);
      if (Z.area) q = q.eq('area', Z.area);
      let data, count;
      try {
        const r = await q.order('full_name').range(f.page * per, f.page * per + per - 1);
        if (r.error) throw r.error;
        data = r.data; count = r.count;
      } catch (e) { body.innerHTML = `<div class="card">${Z.esc(Z.errText(e))}</div>`; return; }
      // v2.46 (19 Oct, Business Week day 2: Kevin saw "0 customers" while 6 Leads existed): the list opens on Active. If Active is
      //       empty but other customers exist, show them all and say so, instead of a bare "0" that looks like a fault.
      let hiddenNote = '';
      if (!clean(f.q) && f.status && !count) {
        let q2 = Z.sb.from('v_customers').select('id,full_name,phone,account_no,area,landmark,status,plan,lat', { count: 'exact' });
        if (Z.area) q2 = q2.eq('area', Z.area);
        const r2 = await q2.order('full_name').range(0, per - 1);
        if (!r2.error && r2.count) { data = r2.data; count = r2.count; hiddenNote = `<p class="hint" style="margin:-4px 0 8px">No customers are ${Z.esc((STATUSES.find((x) => x[0] === f.status) || [f.status, f.status])[1].split(' (')[0])} yet, so here is everyone (${Z.fmt(r2.count)}). Change the box above to filter.</p>`; }
      }
      const pages = Math.max(1, Math.ceil((count || 0) / per));
      const cnt = Z.$('#c-count', el); if (cnt) cnt.textContent = Z.fmt(count);
      body.innerHTML = `
      ${clean(f.q) && f.status ? '<p class="hint" style="margin:-4px 0 8px">Searching every status (Lead, Active, switched off…).</p>' : ''}
      ${hiddenNote}
      <div class="card list">${data.length ? data.map((c) => `<a class="item" href="#customers/${c.id}"><div class="grow">
          <div class="t">${Z.esc(c.full_name)}</div>
          <div class="m">${Z.esc([c.phone, c.account_no, c.plan].filter(Boolean).join(' · '))}</div>
          <div class="m">${Z.esc(Z.areaName(c.area))}${c.landmark ? ' · ' + Z.esc(c.landmark) : ''}${c.lat == null ? ' · <span style="color:var(--warn-ink)">no pin</span>' : ''}</div>
        </div>${statusPill(c.status)}</a>`).join('') : '<div class="empty">No customers found. Import your billing list under <a href="#import">Import</a>, or add one.</div>'}</div>
      ${pages > 1 ? `<div class="row" style="justify-content:center"><button class="btn sec small" id="c-prev" ${f.page ? '' : 'disabled'}>← Prev</button><span class="hint">Page ${f.page + 1} of ${pages}</span><button class="btn sec small" id="c-next" ${f.page + 1 < pages ? '' : 'disabled'}>Next →</button></div>` : ''}`;
      const pv = Z.$('#c-prev', body), nx = Z.$('#c-next', body);
      if (pv) pv.onclick = () => { f.page--; Z.set('cust_filter', f); paint(); };
      if (nx) nx.onclick = () => { f.page++; Z.set('cust_filter', f); paint(); };
    }

    const qi = Z.$('#c-q', el); let tmr;
    qi.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => { f.q = qi.value; f.page = 0; Z.set('cust_filter', f); if (!/^#customers/.test(location.hash)) return; /* v2.51: they already left this screen */ paint(); }, 400); };
    Z.$('#c-st', el).onchange = (e) => { f.status = e.target.value; f.page = 0; Z.set('cust_filter', f); paint(); };
    await paint();
  };

  async function profile(id, el) {
    const [cr, tr, pr, pkr] = await Promise.all([
      Z.sb.from('v_customers').select(COLS).eq('id', id).maybeSingle(),
      Z.sb.from('tickets').select('id,ticket_no,kind,status,summary,opened_at,closed_at,amount_collected').eq('customer_id', id).order('opened_at', { ascending: false }).limit(30),
      Z.sb.from('payments').select('date,amount,method,source,mpesa_ref').eq('customer_id', id).order('date', { ascending: false }).limit(400),
      Z.sb.from('packages').select('name,monthly_rate').then((r) => r.data || [], () => []),  // a phone whose copy has no price list still works
    ]);
    if (cr.error) throw cr.error;
    const c = cr.data;
    if (!c) { el.innerHTML = '<div class="card">Customer not found.</div>'; return; }
    const tickets = tr.data || [], pays = pr.data || [];
    const shown = FIELDS.filter(([k]) => visible(k) && !['full_name', 'landmark'].includes(k) && c[k] != null && c[k] !== '');
    const custom = Z.ref.cfd.filter((d) => d.entity === 'customer' && c.custom && c.custom[d.key] != null && c.custom[d.key] !== '');
    const pin = c.lat != null ? `https://maps.google.com/?q=${c.lat},${c.lng}` : null;

    // A customer past their paid date owes one month, which is exactly what Home and the Friday report count.
    const owingDays = c.paid_until ? Math.floor((Date.now() - new Date(c.paid_until).getTime()) / 864e5) : 0;
    // 💵 v2.68 (5 Nov, Jerry: "count it against what they owe"). Emmanuel, 30 Oct, d7-01: "A customer paid
    // wrong amount." Zuri recorded a payment and had nothing for one that was short or over — no part payment,
    // no credit. On M-Pesa people pay the wrong figure constantly. So what she has paid SINCE her paid-until date
    // is set against the month she owes: short and she still owes the difference, over and the rest is credit.
    // Everything dated before paid_until is what bought the time up to paid_until, so it is not counted again.
    const monthDue = c.status === 'active' && owingDays > 0 ? Number(c.monthly_rate || 0) : 0;
    const sinceDay = c.paid_until ? String(c.paid_until).slice(0, 10) : null;
    const paidSince = sinceDay ? pays.filter((x) => String(x.date || '').slice(0, 10) >= sinceDay).reduce((t, x) => t + Number(x.amount || 0), 0) : 0;
    // 🔁 v2.70 (5 Nov, Jerry: "credit, not cash"). Veronicah, 30 Oct, d7-01: "Incase a customer is not
    // satisfied with your internet service and wants their refund back mid-month, is that possible?" It was not.
    // A credit is money owed back that comes off what they pay next, and it follows the SAME boundary rule as a
    // payment: one dated before their paid-until date is already spent on the time they had, so it stops counting
    // on its own when billing moves the date. Nothing has to remember to use a credit up.
    const credits = Array.isArray((c.custom || {}).credits) ? (c.custom || {}).credits : [];
    const creditSince = sinceDay ? credits.filter((x) => String(x.date || '').slice(0, 10) >= sinceDay).reduce((t, x) => t + Number(x.amount || 0), 0) : credits.reduce((t, x) => t + Number(x.amount || 0), 0);
    const owingNow = Math.max(0, monthDue - paidSince - creditSince);
    const creditNow = monthDue > 0 ? Math.max(0, paidSince + creditSince - monthDue) : creditSince;
    // 💲 v2.67 (5 Nov, Jerry: "ask why, and show it"). Veronicah, 30 Oct, d5-05: "Grace is paying 2500 for
    // 10 mbps but on the price list it says 2000 for 10 mbps". Nothing on her record said why, so anyone looking
    // later just saw a customer being charged 500 more than the list with no reason given. Now the reason is asked
    // for when the rate is typed, and shown here beside the rate.
    const listed = (pkr || []).find((x) => x.name === c.plan);
    const offList = !!listed && c.monthly_rate != null && Number(c.monthly_rate) !== Number(listed.monthly_rate);
    const rateWhy = String((c.custom || {}).rate_why || '').trim();
    // ⏸ v2.69 (5 Nov, Jerry: "a reason and a return date"). Kevin, 31 Oct, d7-01: "Zuri should be able to freeze
    // temporarily a user's service for like 3-4 months while they are away without fully cancelling their contract."
    // Suspended existed and already stopped her owing — what was missing was WHY and WHEN SHE IS BACK. The billing
    // import also stamps Suspended for "overdue" and "unpaid", so a woman on holiday and a non-payer looked identical.
    const pauseWhy = String((c.custom || {}).pause_why || '');
    const pauseUntil = String((c.custom || {}).pause_until || '');
    const pauseLabel = (PAUSE_WHY.find((x) => x[0] === pauseWhy) || [])[1];
    const backDays = pauseUntil ? Math.ceil((new Date(pauseUntil + 'T00:00:00').getTime() - Date.now()) / 864e5) : null;
    el.innerHTML = `
      <p style="margin:0 0 6px"><a class="back" href="#customers">← Customers</a></p>
      <div class="row" style="justify-content:space-between"><h2 style="margin-bottom:2px">${Z.esc(c.full_name)}</h2>${statusPill(c.status)}</div>
      <p class="hint" style="margin-top:0">${Z.esc(Z.areaName(c.area))}${c.landmark ? ' · 📍 ' + Z.esc(c.landmark) : ''}</p>
      <div class="row" style="margin-bottom:12px">
        ${c.phone ? `<a class="btn sec" href="tel:${Z.esc(c.phone)}" title="On a computer this hands the number to whatever app handles calls there">📞 Call ${Z.esc(c.phone)}</a>` : ''}
        ${pin ? `<a class="btn sec" href="${pin}" target="_blank" rel="noopener">🗺️ Map</a><button class="btn sec" id="cp-send">📤 Send pin</button>` : ''}
        <button class="btn sec" id="cp-pin">📍 ${pin ? 'Move pin to here' : 'Drop pin here'}</button>
        <a class="btn" href="#jobs/new/${c.id}">＋ New job</a>
        <a class="btn sec" href="#customers/${c.id}/edit">✏️ Edit</a>
        ${c.phone && !Z.isField() ? '<button class="btn sec" id="cp-quote">💬 Send a quote</button>' : ''}
        ${Z.isFinance() ? '<button class="btn sec" id="cp-credit">🔁 Give credit</button>' : ''}
      </div>
      <div class="card"><table class="t">${shown.map(([k, label, type]) => `<tr><th style="width:40%">${label}</th><td>${type === 'number' ? Z.kes(c[k]) : type === 'date' ? Z.day(c[k]) : type === 'readonly' ? Z.when(c[k]) + (new Date(c[k]) < new Date() ? ' <span class="pill bad">ran out</span>' : '') : Z.esc(c[k])}</td></tr>`).join('')}
        ${custom.map((d) => `<tr><th>${Z.esc(d.label)}</th><td>${d.kind === 'yesno' ? (c.custom[d.key] ? 'Yes' : 'No') : Z.esc(c.custom[d.key])}</td></tr>`).join('')}
        ${!shown.length && !custom.length ? '<tr><td class="muted">No other details yet.</td></tr>' : ''}</table></div>

      <div id="cp-alerts"></div>
      ${/* 💳 v2.66 (5 Nov, Jerry: "build it on the customer's page"): there was nowhere in Zuri to see what ONE
           customer owes. Veronicah, Emmanuel and Kevin all went looking for it on the same step and all three
           were sent to Statements, which is the bank and M-Pesa import and cannot answer the question.
           The owing rule is NOT invented here: it is the one Home and the Friday report already use — a customer
           past their paid date owes one month's rate. Same rule, shown for one person instead of all of them. */ ''}
      <h3>Account</h3>
      <div class="card"><table class="t">
        <tr><th style="width:52%">Monthly rate</th><td>${c.monthly_rate ? Z.kes(c.monthly_rate) : '<span class="muted">not set</span>'}${offList ? `<div class="m" style="color:var(--warn-ink)">Not the price-list rate — ${Z.esc(listed.name)} is ${Z.kes(listed.monthly_rate)}. ${rateWhy ? Z.esc(rateWhy) : '<b>No reason was given.</b>'}</div>` : ''}</td></tr>
        <tr><th>Paid until</th><td>${c.paid_until ? Z.day(c.paid_until) + (owingDays > 0 ? ` <span class="pill bad">${owingDays} day${owingDays === 1 ? '' : 's'} ago</span>` : ` <span class="pill ok">${-owingDays} day${owingDays === -1 ? '' : 's'} left</span>`) : '<span class="muted">never paid</span>'}</td></tr>
        ${c.status === 'suspended' ? `<tr><th>Paused</th><td>${pauseLabel ? Z.esc(pauseLabel) : '<span class="muted">no reason was recorded</span>'}${pauseUntil ? ` · back on ${Z.day(pauseUntil)} ${backDays < 0 ? `<span class="pill bad">due back ${-backDays} day${backDays === -1 ? '' : 's'} ago</span>` : backDays === 0 ? '<span class="pill warn">due back today</span>' : `<span class="pill ok">in ${backDays} day${backDays === 1 ? '' : 's'}</span>`}` : ''}</td></tr>` : ''}
        <tr><th>Paid in, all time</th><td class="num">${Z.kes(pays.reduce((t, x) => t + Number(x.amount || 0), 0))}</td></tr>
        ${credits.length ? `<tr><th>Credit on account</th><td class="num"><b style="color:var(--ok)">${Z.kes(creditSince)}</b>${credits.map((x) => { const spent = sinceDay && String(x.date || '').slice(0, 10) < sinceDay;
          return `<div class="m"${spent ? ' style="opacity:.6"' : ''}>${Z.day(x.date)} ${Z.esc(x.by || '')}: ${Z.kes(x.amount)} — ${Z.esc(x.why || '')}${spent ? ' <i>(already used)</i>' : ''}</div>`; }).join('')}</td></tr>` : ''}
        <tr><th>Owing now</th><td class="num"><b style="color:var(--${owingNow > 0 ? 'bad' : 'ok'})">${Z.kes(owingNow)}</b>${creditNow > 0 ? ` <span class="pill ok">${Z.kes(creditNow)} in credit</span>` : ''}${
          owingNow > 0 && (paidSince > 0 || creditSince > 0) ? `<div class="m">One month is ${Z.kes(monthDue)}, less ${Z.kes(paidSince)} paid${creditSince > 0 ? ` and ${Z.kes(creditSince)} credit` : ''} since ${Z.day(c.paid_until)}. Home counts the whole month until billing is imported.</div>`
          : owingNow > 0 ? '<div class="m">one month’s rate — the same rule Home and the Friday report use</div>'
          : monthDue > 0 ? `<div class="m">${Z.kes(paidSince)} paid${creditSince > 0 ? ` and ${Z.kes(creditSince)} credit` : ''} since ${Z.day(c.paid_until)}${creditNow > 0 ? ` — ${Z.kes(monthDue)} for the month and ${Z.kes(creditNow)} over` : ' covers the month'}. Her paid-until date moves when billing is next imported.</div>`
          : ''}</td></tr>
      </table></div>

      <h3>Payments</h3>
      <div class="card">${pays.length ? `<table class="t"><tr><th>Date</th><th class="r">KES</th><th>How</th><th>Ref</th></tr>${pays.slice(0, 24).map((p) => `<tr><td>${Z.day(p.date)}</td><td class="r num">${Z.fmt(p.amount)}</td><td>${Z.esc(p.method)}${p.source === 'field' ? ' (on a job)' : ''}</td><td>${Z.esc(p.mpesa_ref || '')}</td></tr>`).join('')}</table>${pays.length > 24 ? `<div class="m">Showing the last 24 of ${pays.length} payments. The total above counts them all.</div>` : ''}` : '<div class="muted">No payments recorded yet.</div>'}</div>

      <h3>Jobs</h3>
      <div class="card list">${tickets.length ? tickets.map((t) => `<a class="item" href="#jobs/${t.id}"><div class="grow"><div class="t">#${t.ticket_no} · ${Z.esc(t.summary)}</div><div class="m">${Z.when(t.opened_at)}${t.closed_at ? ' → done ' + Z.when(t.closed_at) : ''}</div></div><span class="pill ${t.status === 'done' ? 'ok' : t.status === 'cancelled' ? '' : 'warn'}">${Z.esc(t.status.replace('_', ' '))}</span></a>`).join('') : '<div class="muted">No jobs yet.</div>'}</div>`;

    if (Z.alertPrefsBox) Z.alertPrefsBox(Z.$('#cp-alerts', el), c); // 📣 v2.39: cabinet, language, what they agreed to get
    Z.$('#cp-pin', el).onclick = (e) => {
      const b = e.currentTarget;
      if (!navigator.geolocation) return Z.toast('This device can\'t share its location.');
      if (!confirm('Only do this while standing at the customer\'s house. Use this spot as their pin?')) return;
      b.disabled = true; b.textContent = '📍 Finding you…';
      // 7 Oct deep check #20: same as the job page — warn when the phone's location is rough, and save through the
      // offline queue so it works with no signal.
      navigator.geolocation.getCurrentPosition((pos) => {
        const acc = Math.round(pos.coords.accuracy);
        if (acc > 50 && !confirm(`Your location is only accurate to about ${acc} m. Step outside, wait a minute and try again for a better pin.\n\nSave this rough pin anyway?`)) { b.disabled = false; b.textContent = '📍 Try the pin again'; return; }
        Z.onSynced = () => { if (location.hash === '#customers/' + id) Z.route(); }; // show the new pin once it has gone up
        if (!Z.enqueue('customer_save', { p: { id, lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) } })) { b.disabled = false; b.textContent = '📍 Drop pin here'; return; }
        Z.toast(navigator.onLine ? `Pin saved (accurate to about ${acc} m).` : 'Pin saved on this phone — it sends when you have signal.');
        setTimeout(Z.route, 400);
      }, (err) => { b.disabled = false; b.textContent = '📍 Drop pin here'; Z.toast(err && err.code === 1 ? 'Allow location for this app in the phone settings.' : 'Couldn\'t get a location — step outside and try again.'); }, { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
    };
    // 💬 v1.1 (17 Oct): a quote before the visit — package + one-time install fee, sent by WhatsApp or SMS from this phone.
    // Nothing is saved to the company's records; the install fee typed last time is remembered on this phone.
    const qb = Z.$('#cp-quote', el);
    if (qb) qb.onclick = async () => {
      const pk = await Z.sb.from('packages').select('name,monthly_rate').order('monthly_rate').then((r) => r.data || [], () => []);
      const sh = Z.sheet('💬 Send a quote', `<form id="cq" autocomplete="off">
          <label>Package</label><input name="plan" list="cq-pk" value="${Z.esc(c.plan || '')}" placeholder="e.g. 10 Mbps">
          ${pk.length ? `<datalist id="cq-pk">${pk.map((x) => `<option value="${Z.esc(x.name)}">KES ${Z.fmt(x.monthly_rate)}</option>`).join('')}</datalist>` : ''}
          <label>Monthly price (KES)</label><input name="rate" inputmode="numeric" value="${Z.esc(c.monthly_rate || '')}">
          <label>Install fee, one time (KES)</label><input name="fee" inputmode="numeric" value="${Z.esc(Z.get('quote_install_fee', ''))}" placeholder="e.g. 3,500">
          <label>The message</label><textarea name="msg" rows="7"></textarea>
          <p class="hint" style="margin:4px 0 8px">Check it, then send. You can change the words.</p>
          <div class="row"><a class="btn" id="cq-wa" target="_blank" rel="noopener">💬 WhatsApp it</a><a class="btn sec" id="cq-sms">📩 Text it</a></div></form>`);
      const f = Z.$('#cq', sh.el), first = String(c.full_name || '').split(/\s+/)[0];
      let typed = false;
      const words = () => { const r = Z.num(f.rate.value) || 0, fee = Z.num(f.fee.value) || 0;
        return `Habari ${first}! Here is your quote from Zuri Fiber:\n📶 ${f.plan.value.trim() || 'Internet'}: KES ${Z.fmt(r)} a month\n🔧 Installation (one time): KES ${Z.fmt(fee)}\n💰 To start: KES ${Z.fmt(r + fee)} (install + first month)\nReply here to book your install day. Asante!`; };
      const links = () => { if (!typed) f.msg.value = words(); Z.$('#cq-wa', sh.el).href = Z.waHref(c.phone, f.msg.value); Z.$('#cq-sms', sh.el).href = Z.smsHref(c.phone, f.msg.value); };
      f.plan.oninput = () => { const m = pk.find((x) => x.name.toLowerCase() === f.plan.value.trim().toLowerCase()); if (m) f.rate.value = m.monthly_rate; links(); };
      f.rate.oninput = f.fee.oninput = links;
      f.msg.oninput = () => { typed = true; links(); };
      f.onsubmit = (e) => e.preventDefault();
      Z.$$('#cq-wa, #cq-sms', sh.el).forEach((a) => a.addEventListener('click', () => { if (Z.num(f.fee.value)) Z.set('quote_install_fee', f.fee.value.trim()); Z.toast('Quote ready — press send in the message app.'); }));
      links();
    };
    // 🔁 v2.70: money owed back, recorded against the customer instead of taken out of the till. Every credit
    // is signed with the name and the day, and shows on this page, so one cannot be given quietly.
    const crb = Z.$('#cp-credit', el);
    if (crb) crb.onclick = () => {
      const sh = Z.sheet('🔁 Give credit to ' + c.full_name, `<form id="cc" autocomplete="off">
          <label>How much (KES)</label><input name="amount" inputmode="decimal" placeholder="e.g. 500">
          <label>Why</label><input name="why" maxlength="120" placeholder="e.g. three days with no internet in October">
          <p class="hint" style="margin:4px 0 8px">This is not cash out of the till. It comes off what ${Z.esc(String(c.full_name).split(/\s+/)[0])} owes next, and it shows on this page with your name on it.</p>
          <button class="btn block" type="submit">Give the credit</button></form>`);
      const f = Z.$('#cc', sh.el);
      f.onsubmit = async (e) => {
        e.preventDefault();
        const amount = Z.num(f.amount.value), why = String(f.why.value || '').trim();
        if (!amount || amount <= 0) return Z.toast('How much credit? Put an amount above zero.');
        if (!why) return Z.toast('Say why the credit is being given.');
        const btn = e.submitter; btn.disabled = true;
        const row = { date: new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10), by: Z.me.full_name, amount, why, at: new Date().toISOString() };
        const custom = { ...(c.custom || {}), credits: credits.concat([row]) };   // the whole object, so nothing else in it is lost
        const { error } = await Z.sb.rpc('save_customer', { p: { id, custom } });
        btn.disabled = false;
        if (error) return Z.toast(Z.errText(error));
        sh.close();
        Z.toast(Z.kes(amount) + ' credit given. It comes off what ' + String(c.full_name).split(/\s+/)[0] + ' owes next.');
        Z.route();
      };
    };

    const sb = Z.$('#cp-send', el);
    if (sb) sb.onclick = async () => {
      const text = `${c.full_name}${c.phone ? ' (' + c.phone + ')' : ''}${c.landmark ? '\n📍 ' + c.landmark : ''}\n${pin}`;
      if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    };
  }

  async function edit(id, el) {
    let c = { status: 'active', area: Z.area || Z.me.area || (Z.ref.areas[0] || {}).code, custom: {} };
    if (id) {
      const { data, error } = await Z.sb.from('v_customers').select(COLS).eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) { el.innerHTML = '<div class="card">Customer not found.</div>'; return; }
      c = data;
    }
    const defs = Z.ref.cfd.filter((d) => d.entity === 'customer' && Z.canSee('customer', d.key));
    // 💲 v2.35: the price list (Admin → Price list) as suggestions for Package / plan; picking one fills the monthly rate
    const pk = await Z.sb.from('packages').select('name,monthly_rate').order('monthly_rate').then((r) => r.data || [], () => []);
    const input = ([k, label, type, req]) => {
      const v = c[k] ?? '';
      if (type === 'textarea') return `<div style="grid-column:1/-1"><label>${label}</label><textarea name="${k}">${Z.esc(v)}</textarea></div>`;
      // 📦 v2.60 (5 Nov): Package was a text box with type-ahead suggestions. Suggestions only show what matches what
      // is already typed, so once a package was chosen the list had exactly one thing left to offer — the one already
      // chosen — and tapping it again looked frozen. You had to EMPTY the box before it would show the others.
      // Brian reported it that way on 30 Oct ("the drop-down becomes unresponsive once a package has been selected.
      // i must first delete the existing selection"). Emmanuel reported the same control from the other end the same
      // morning. Now it is a real dropdown: tap it, see all four, change your mind any time.
      // "Something else…" keeps the old free-typing for a customer who is not on the price list.
      if (k === 'plan' && pk.length) {
        const known = pk.some((x) => x.name === v);
        return `<div><label>${label}</label>
          <select id="plan-pick">${Z.opts([['', '—']].concat(pk.map((x) => [x.name, x.name + ' · KES ' + Z.fmt(x.monthly_rate)])).concat([['__other', 'Something else…']]), v ? (known ? v : '__other') : '')}</select>
          <input name="plan" id="plan-free" type="text" placeholder="Type the package" value="${Z.esc(v)}" ${known || !v ? 'hidden' : ''} style="margin-top:6px"></div>`;
      }
      return `<div><label>${label}</label><input name="${k}" type="${type === 'number' ? 'text' : type}" ${type === 'number' ? 'inputmode="decimal"' : ''} value="${Z.esc(v)}" ${req ? 'required' : ''}></div>`;
    };
    const customInput = (d) => {
      const v = (c.custom || {})[d.key] ?? '';
      const name = 'cf__' + d.key;
      if (d.kind === 'yesno') return `<div><label>${Z.esc(d.label)}</label><select name="${name}">${Z.opts([['', '—'], ['yes', 'Yes'], ['no', 'No']], v === true ? 'yes' : v === false ? 'no' : '')}</select></div>`;
      if (d.kind === 'choice') return `<div><label>${Z.esc(d.label)}</label><select name="${name}"><option value="">—</option>${Z.opts(d.choices || [], v)}</select></div>`;
      return `<div><label>${Z.esc(d.label)}</label><input name="${name}" type="${d.kind === 'date' ? 'date' : 'text'}" ${d.kind === 'number' ? 'inputmode="decimal"' : ''} value="${Z.esc(v)}"></div>`;
    };
    // 💲 v2.67: asked for right under the rate it is about, so it is seen the moment the rate is typed over.
    const whyHtml = `<div id="rate-why-box" style="grid-column:1/-1" hidden>
            <label>Why is this not the price-list rate?</label>
            <input name="rate_why" type="text" placeholder="e.g. old price, agreed before the rise" value="${Z.esc((c.custom || {}).rate_why || '')}">
            <p class="hint" id="rate-why-hint"></p>
          </div>`;
    el.innerHTML = `
      <p style="margin:0 0 6px"><a href="#customers${id ? '/' + id : ''}">← Back</a></p>
      <h2>${id ? 'Edit ' + Z.esc(c.full_name) : 'New customer'}</h2>
      <form class="card" id="ce">
        <div class="grid2">
          ${input(FIELDS[0])}
          <div><label>Area</label><select name="area">${Z.opts(Z.ref.areas.filter((a) => a.active || a.code === c.area).map((a) => [a.code, a.name]), c.area)}</select></div>
          <div><label>Status</label><select name="status">${Z.opts(STATUSES, c.status)}</select></div>
          <div id="pause-box" style="grid-column:1/-1" hidden>
            <label>Why is this customer suspended?</label>
            <select name="pause_why"><option value="">— choose —</option>${Z.opts(PAUSE_WHY, (c.custom || {}).pause_why || '')}</select>
            <p class="hint">Zuri needs this to tell someone who is away from someone who has not paid. The billing import cannot.</p>
            <div id="pause-back" hidden style="margin-top:8px">
              <label>Coming back on</label>
              <input name="pause_until" type="date" value="${Z.esc((c.custom || {}).pause_until || '')}">
              <p class="hint">A task goes to the call centre for that day, so nobody forgets to switch them on again.</p>
            </div>
          </div>
          ${FIELDS.slice(1).filter(([k, , type]) => visible(k) && type !== 'readonly').map((f) => input(f) + (f[0] === 'monthly_rate' ? whyHtml : '')).join('')}
          ${defs.map(customInput).join('')}
        </div>
        <p class="hint">GPS pin: use "Drop pin here" on the customer's page while standing at the house.</p>
        <button class="btn block" type="submit">Save customer</button>
      </form>`;
    const cf = Z.$('#ce', el);
    // Picking a package fills the monthly rate, as before. "Something else…" reveals the free-text box and leaves the
    // rate alone, because a customer off the price list has no price list rate to copy.
    const pick = Z.$('#plan-pick', el), free = Z.$('#plan-free', el);
    if (pick && free) {
      const sync = () => {
        const other = pick.value === '__other';
        free.hidden = !other;
        if (other) { if (pk.some((x) => x.name === free.value)) free.value = ''; free.focus(); }
        else { free.value = pick.value; const m = pk.find((x) => x.name === pick.value); if (m && cf.monthly_rate) cf.monthly_rate.value = m.monthly_rate; }
      };
      pick.addEventListener('change', sync);
    }
    if (cf.plan && cf.monthly_rate && pk.length) cf.plan.addEventListener('input', () => { const m = pk.find((x) => x.name.toLowerCase() === cf.plan.value.trim().toLowerCase()); if (m) cf.monthly_rate.value = m.monthly_rate; syncWhy(); });

    // The reason box only appears when the rate typed is not the package's price-list rate. A customer who is on
    // the list price, or on a package that is not on the list at all, is never asked to explain anything.
    const whyBox = Z.$('#rate-why-box', el), whyHint = Z.$('#rate-why-hint', el);
    const listedNow = () => (cf.plan ? pk.find((x) => x.name === String(cf.plan.value).trim()) : null);
    function syncWhy() {
      if (!whyBox || !cf.monthly_rate) return;
      const m = listedNow(), typed = String(cf.monthly_rate.value).trim();
      const off = !!m && typed !== '' && Number(Z.num(typed)) !== Number(m.monthly_rate);
      whyBox.hidden = !off;
      if (off && whyHint) whyHint.textContent = m.name + ' is KES ' + Z.fmt(m.monthly_rate) + ' on the price list. What you write here shows on the customer\u2019s page.';
    }
    const pauseBox = Z.$('#pause-box', el), pauseBack = Z.$('#pause-back', el);
    function syncPause() {
      if (!pauseBox || !cf.status) return;
      pauseBox.hidden = cf.status.value !== 'suspended';
      if (pauseBack) pauseBack.hidden = pauseBox.hidden || cf.pause_why.value !== 'away';
    }
    if (cf.status) cf.status.addEventListener('change', syncPause);
    if (cf.pause_why) cf.pause_why.addEventListener('change', syncPause);
    syncPause();

    if (cf.monthly_rate) cf.monthly_rate.addEventListener('input', syncWhy);
    if (pick) pick.addEventListener('change', syncWhy);
    syncWhy();

    Z.$('#ce', el).onsubmit = async (e) => {
      e.preventDefault();
      const d = Z.formData(e.target);
      const p = { custom: {} };
      if (id) p.id = id;
      for (const [k, v] of Object.entries(d)) {
        if (k === 'rate_why' || k === 'pause_why' || k === 'pause_until') continue;   // these live in custom, handled below — there are no such columns
        if (k.startsWith('cf__')) {
          const def = defs.find((x) => x.key === k.slice(4));
          p.custom[def.key] = v === '' ? null : def.kind === 'yesno' ? v === 'yes' : def.kind === 'number' ? Z.num(v) : v;
        } else if (k === 'monthly_rate') p[k] = Z.num(v);
        else p[k] = v.trim() === '' ? null : v.trim();
      }
      // 🛑 v2.61 (5 Nov): Zuri used to save whatever was typed. Kevin put letters in the phone box on 30 Oct and it
      // saved; Veronicah and Fredrick hit the same thing independently, and Emmanuel ruled it real AND SERIOUS —
      // the most-confirmed finding of that week. Jerry's call, 5 Nov: Kenyan mobile numbers only.
      // A negative monthly rate is refused too. Nobody had to rule on that one; a customer cannot be billed -500.
      for (const [k, label] of [['phone', 'Phone'], ['phone2', 'Second phone']]) {
        if (p[k] && !Z.isKePhone(p[k])) {
          return Z.toast(label + ': that does not look like a Kenyan phone number. Try 0722 456 789.');
        }
      }
      if (p.monthly_rate != null && p.monthly_rate < 0) return Z.toast('The monthly rate cannot be less than zero.');
      // 💲 v2.67: a rate that is not the price-list rate has to say why, and the reason travels with the customer.
      const listedP = pk.find((x) => x.name === (p.plan || ''));
      if (listedP && p.monthly_rate != null && Number(p.monthly_rate) !== Number(listedP.monthly_rate)) {
        const why = String(d.rate_why || '').trim();
        if (!why) return Z.toast('KES ' + Z.fmt(p.monthly_rate) + ' is not the price-list rate for ' + listedP.name + ' (KES ' + Z.fmt(listedP.monthly_rate) + '). Say why in one line.');
        p.custom.rate_why = why;
      } else if (listedP) p.custom.rate_why = null;   // back on the list price: there is nothing left to explain
      else p.custom.rate_why = String((c.custom || {}).rate_why || '') || null;   // off-list package: no list rate to differ from

      // ⏸ v2.69: a suspended customer has to say why, and a pause has to say when they are back.
      if (p.status === 'suspended') {
        const why = String(d.pause_why || '').trim();
        if (!why) return Z.toast('Say why this customer is suspended — away, or has not paid.');
        p.custom.pause_why = why;
        if (why === 'away') {
          const until = String(d.pause_until || '').trim();
          if (!until) return Z.toast('When is this customer coming back? Put the date.');
          p.custom.pause_until = until;
        } else p.custom.pause_until = null;
      } else { p.custom.pause_why = null; p.custom.pause_until = null; }
      const btn = e.submitter; btn.disabled = true;
      const { data, error } = await Z.sb.rpc('save_customer', { p });
      btn.disabled = false;
      if (error) return Z.toast(/unique/i.test(error.message) ? 'That account number or billing ID is already used by another customer.' : Z.errText(error));
      // The reminder is made once, when the pause is set or its date moved — not again on every later save.
      const wasWhy = String((c.custom || {}).pause_why || ''), wasUntil = String((c.custom || {}).pause_until || '');
      if (p.custom.pause_why === 'away' && p.custom.pause_until && (p.custom.pause_until !== wasUntil || wasWhy !== 'away')) {
        const who = p.full_name || c.full_name;
        Z.enqueue('task_insert', { row: { id: Z.uuid(), title: 'Switch ' + who + ' back on — the pause ends today',
          details: who + ' was paused because they are away. Set Status back to Active and check billing has restarted.',
          due_date: p.custom.pause_until, priority: 'normal', visibility: 'team', assigned_group: 'callcenter', created_by: Z.me.id } });
        Z.toast('Customer saved. The call centre has a task for ' + Z.day(p.custom.pause_until) + '.');
      } else Z.toast('Customer saved.');
      Z.go('customers/' + data);
    };
  }
})();
