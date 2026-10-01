// Zuri System · Customers: search, profile, add/edit, pin, history · v1 · 2026-09-30
(function () {
  const Z = window.Z;
  const COLS = 'id,full_name,area,landmark,lat,lng,status,account_no,phone,phone2,email,national_id,plan,monthly_rate,billnasi_id,install_date,notes,custom,created_at,updated_at,paid_until';
  const STATUSES = [['active', 'Active'], ['lead', 'Lead (not installed yet)'], ['suspended', 'Suspended'], ['disconnected', 'Disconnected']];
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
  Z.searchCustomers = async (q, limit = 30) => {
    q = clean(q);
    if (!q) return [];
    const { data, error } = await Z.sb.from('v_customers').select('id,full_name,phone,account_no,area,landmark,status')
      .or(`full_name.ilike.*${q}*,phone.ilike.*${q}*,account_no.ilike.*${q}*`).order('full_name').limit(limit);
    if (error) throw error;
    return data;
  };

  Z.routes.customers = async (args, el) => {
    if (args[0] === 'new') return edit(null, el);
    if (args[0] && args[1] === 'edit') return edit(args[0], el);
    if (args[0]) return profile(args[0], el);

    const f = Z.get('cust_filter', { q: '', status: 'active', page: 0 });
    const per = 50;
    let q = Z.sb.from('v_customers').select('id,full_name,phone,account_no,area,landmark,status,plan,lat', { count: 'exact' });
    if (clean(f.q)) q = q.or(`full_name.ilike.*${clean(f.q)}*,phone.ilike.*${clean(f.q)}*,account_no.ilike.*${clean(f.q)}*`);
    if (f.status) q = q.eq('status', f.status);
    if (Z.area) q = q.eq('area', Z.area);
    const { data, count, error } = await q.order('full_name').range(f.page * per, f.page * per + per - 1);
    if (error) throw error;
    const pages = Math.max(1, Math.ceil((count || 0) / per));

    el.innerHTML = `
      <div class="row" style="justify-content:space-between"><h2>Customers${Z.area ? ' · ' + Z.esc(Z.areaName(Z.area)) : ''} <span class="muted" style="font-size:15px">${Z.fmt(count)}</span></h2>
        <a class="btn" href="#customers/new">＋ New customer</a></div>
      <div class="row" style="margin-bottom:10px">
        <input id="c-q" placeholder="Search name, phone, account" value="${Z.esc(f.q)}" style="flex:1">
        <select id="c-st" style="width:auto"><option value="">Any status</option>${Z.opts(STATUSES.map(([k, t]) => [k, t.split(' (')[0]]), f.status)}</select>
      </div>
      <div class="card list">${data.length ? data.map((c) => `<a class="item" href="#customers/${c.id}"><div class="grow">
          <div class="t">${Z.esc(c.full_name)}</div>
          <div class="m">${Z.esc([c.phone, c.account_no, c.plan].filter(Boolean).join(' · '))}</div>
          <div class="m">${Z.esc(Z.areaName(c.area))}${c.landmark ? ' · ' + Z.esc(c.landmark) : ''}${c.lat == null ? ' · <span style="color:var(--warn)">no pin</span>' : ''}</div>
        </div>${statusPill(c.status)}</a>`).join('') : '<div class="empty">No customers found. Import your billing list under <a href="#import">Import</a>, or add one.</div>'}</div>
      ${pages > 1 ? `<div class="row" style="justify-content:center"><button class="btn sec small" id="c-prev" ${f.page ? '' : 'disabled'}>← Prev</button><span class="hint">Page ${f.page + 1} of ${pages}</span><button class="btn sec small" id="c-next" ${f.page + 1 < pages ? '' : 'disabled'}>Next →</button></div>` : ''}`;

    const qi = Z.$('#c-q', el); let tmr;
    qi.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => { f.q = qi.value; f.page = 0; Z.set('cust_filter', f); Z.route().then(() => { const n = Z.$('#c-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); }, 400); };
    Z.$('#c-st', el).onchange = (e) => { f.status = e.target.value; f.page = 0; Z.set('cust_filter', f); Z.route(); };
    const pv = Z.$('#c-prev', el), nx = Z.$('#c-next', el);
    if (pv) pv.onclick = () => { f.page--; Z.set('cust_filter', f); Z.route(); };
    if (nx) nx.onclick = () => { f.page++; Z.set('cust_filter', f); Z.route(); };
  };

  async function profile(id, el) {
    const [cr, tr, pr] = await Promise.all([
      Z.sb.from('v_customers').select(COLS).eq('id', id).maybeSingle(),
      Z.sb.from('tickets').select('id,ticket_no,kind,status,summary,opened_at,closed_at,amount_collected').eq('customer_id', id).order('opened_at', { ascending: false }).limit(30),
      Z.sb.from('payments').select('date,amount,method,source,mpesa_ref').eq('customer_id', id).order('date', { ascending: false }).limit(24),
    ]);
    if (cr.error) throw cr.error;
    const c = cr.data;
    if (!c) { el.innerHTML = '<div class="card">Customer not found.</div>'; return; }
    const tickets = tr.data || [], pays = pr.data || [];
    const shown = FIELDS.filter(([k]) => visible(k) && !['full_name', 'landmark'].includes(k) && c[k] != null && c[k] !== '');
    const custom = Z.ref.cfd.filter((d) => d.entity === 'customer' && c.custom && c.custom[d.key] != null && c.custom[d.key] !== '');
    const pin = c.lat != null ? `https://maps.google.com/?q=${c.lat},${c.lng}` : null;

    el.innerHTML = `
      <p style="margin:0 0 6px"><a href="#customers">← Customers</a></p>
      <div class="row" style="justify-content:space-between"><h2 style="margin-bottom:2px">${Z.esc(c.full_name)}</h2>${statusPill(c.status)}</div>
      <p class="hint" style="margin-top:0">${Z.esc(Z.areaName(c.area))}${c.landmark ? ' · 📍 ' + Z.esc(c.landmark) : ''}</p>
      <div class="row" style="margin-bottom:12px">
        ${c.phone ? `<a class="btn sec" href="tel:${Z.esc(c.phone)}">📞 Call</a>` : ''}
        ${pin ? `<a class="btn sec" href="${pin}" target="_blank" rel="noopener">🗺️ Map</a><button class="btn sec" id="cp-send">📤 Send pin</button>` : ''}
        <button class="btn sec" id="cp-pin">📍 ${pin ? 'Move pin to here' : 'Drop pin here'}</button>
        <a class="btn" href="#jobs/new/${c.id}">＋ New job</a>
        <a class="btn sec" href="#customers/${c.id}/edit">✏️ Edit</a>
      </div>
      <div class="card"><table class="t">${shown.map(([k, label, type]) => `<tr><th style="width:40%">${label}</th><td>${type === 'number' ? Z.kes(c[k]) : type === 'date' ? Z.day(c[k]) : type === 'readonly' ? Z.when(c[k]) + (new Date(c[k]) < new Date() ? ' <span class="pill bad">ran out</span>' : '') : Z.esc(c[k])}</td></tr>`).join('')}
        ${custom.map((d) => `<tr><th>${Z.esc(d.label)}</th><td>${d.kind === 'yesno' ? (c.custom[d.key] ? 'Yes' : 'No') : Z.esc(c.custom[d.key])}</td></tr>`).join('')}
        ${!shown.length && !custom.length ? '<tr><td class="muted">No other details yet.</td></tr>' : ''}</table></div>

      <h3>Payments</h3>
      <div class="card">${pays.length ? `<table class="t"><tr><th>Date</th><th class="r">KES</th><th>How</th><th>Ref</th></tr>${pays.map((p) => `<tr><td>${Z.day(p.date)}</td><td class="r num">${Z.fmt(p.amount)}</td><td>${Z.esc(p.method)}${p.source === 'field' ? ' (on a job)' : ''}</td><td>${Z.esc(p.mpesa_ref || '')}</td></tr>`).join('')}</table>` : '<div class="muted">No payments recorded yet.</div>'}</div>

      <h3>Jobs</h3>
      <div class="card list">${tickets.length ? tickets.map((t) => `<a class="item" href="#jobs/${t.id}"><div class="grow"><div class="t">#${t.ticket_no} · ${Z.esc(t.summary)}</div><div class="m">${Z.when(t.opened_at)}${t.closed_at ? ' → done ' + Z.when(t.closed_at) : ''}</div></div><span class="pill ${t.status === 'done' ? 'ok' : t.status === 'cancelled' ? '' : 'warn'}">${Z.esc(t.status.replace('_', ' '))}</span></a>`).join('') : '<div class="muted">No jobs yet.</div>'}</div>`;

    Z.$('#cp-pin', el).onclick = (e) => {
      const b = e.currentTarget;
      if (!navigator.geolocation) return Z.toast('This device can\'t share its location.');
      if (!confirm('Only do this while standing at the customer\'s house. Use this spot as their pin?')) return;
      b.disabled = true;
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { error } = await Z.sb.rpc('save_customer', { p: { id, lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) } });
        if (error) { b.disabled = false; return Z.fail(error); }
        Z.toast('Pin saved.'); Z.route();
      }, () => { b.disabled = false; Z.toast('Couldn\'t get a location.'); }, { enableHighAccuracy: true, timeout: 25000 });
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
    const input = ([k, label, type, req]) => {
      const v = c[k] ?? '';
      if (type === 'textarea') return `<div style="grid-column:1/-1"><label>${label}</label><textarea name="${k}">${Z.esc(v)}</textarea></div>`;
      return `<div><label>${label}</label><input name="${k}" type="${type === 'number' ? 'text' : type}" ${type === 'number' ? 'inputmode="decimal"' : ''} value="${Z.esc(v)}" ${req ? 'required' : ''}></div>`;
    };
    const customInput = (d) => {
      const v = (c.custom || {})[d.key] ?? '';
      const name = 'cf__' + d.key;
      if (d.kind === 'yesno') return `<div><label>${Z.esc(d.label)}</label><select name="${name}">${Z.opts([['', '—'], ['yes', 'Yes'], ['no', 'No']], v === true ? 'yes' : v === false ? 'no' : '')}</select></div>`;
      if (d.kind === 'choice') return `<div><label>${Z.esc(d.label)}</label><select name="${name}"><option value="">—</option>${Z.opts(d.choices || [], v)}</select></div>`;
      return `<div><label>${Z.esc(d.label)}</label><input name="${name}" type="${d.kind === 'date' ? 'date' : 'text'}" ${d.kind === 'number' ? 'inputmode="decimal"' : ''} value="${Z.esc(v)}"></div>`;
    };
    el.innerHTML = `
      <p style="margin:0 0 6px"><a href="#customers${id ? '/' + id : ''}">← Back</a></p>
      <h2>${id ? 'Edit ' + Z.esc(c.full_name) : 'New customer'}</h2>
      <form class="card" id="ce">
        <div class="grid2">
          ${input(FIELDS[0])}
          <div><label>Area</label><select name="area">${Z.opts(Z.ref.areas.filter((a) => a.active || a.code === c.area).map((a) => [a.code, a.name]), c.area)}</select></div>
          <div><label>Status</label><select name="status">${Z.opts(STATUSES, c.status)}</select></div>
          ${FIELDS.slice(1).filter(([k, , type]) => visible(k) && type !== 'readonly').map(input).join('')}
          ${defs.map(customInput).join('')}
        </div>
        <p class="hint">GPS pin: use "Drop pin here" on the customer's page while standing at the house.</p>
        <button class="btn block" type="submit">Save customer</button>
      </form>`;

    Z.$('#ce', el).onsubmit = async (e) => {
      e.preventDefault();
      const d = Z.formData(e.target);
      const p = { custom: {} };
      if (id) p.id = id;
      for (const [k, v] of Object.entries(d)) {
        if (k.startsWith('cf__')) {
          const def = defs.find((x) => x.key === k.slice(4));
          p.custom[def.key] = v === '' ? null : def.kind === 'yesno' ? v === 'yes' : def.kind === 'number' ? Z.num(v) : v;
        } else if (k === 'monthly_rate') p[k] = Z.num(v);
        else p[k] = v.trim() === '' ? null : v.trim();
      }
      const btn = e.submitter; btn.disabled = true;
      const { data, error } = await Z.sb.rpc('save_customer', { p });
      btn.disabled = false;
      if (error) return Z.toast(/unique/i.test(error.message) ? 'That account number or billing ID is already used by another customer.' : Z.errText(error));
      Z.toast('Customer saved.');
      Z.go('customers/' + data);
    };
  }
})();
