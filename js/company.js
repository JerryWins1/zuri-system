// Zuri System · Admin → Company & hubs: the company card and the network's places on the map · v1 · 2026-10-01
// The company card feeds the customer texts (name + Paybill). Hubs show on the customer map for everyone;
// partners add them by standing at the place (📍 Where I'm standing) or by tapping the map.
(function () {
  const Z = window.Z;
  const must = (r) => { if (r.error) throw r.error; return r.data; };
  const BASE = { name: 'Zuri Fiber', town: 'Maai Mahiu', phone: '', whatsapp: '', email: '', address: '', paybill: '', till: '', kra_pin: '', website: '' };

  // Company details and hubs ride along with the other reference data, so they work offline too.
  const loadRef = Z.loadRef;
  Z.loadRef = async () => {
    await loadRef();
    const [s, h] = await Promise.all([Z.sb.from('settings').select('value').eq('key', 'company_profile').maybeSingle(), Z.sb.from('hubs').select('*').order('name')]);
    if (s.error || h.error) return; // older database without file 20 — keep going with the defaults
    Z.ref.company = (s.data && s.data.value) || {};
    Z.ref.hubs = h.data || [];
    Z.set('ref', Z.ref);
  };
  Z.co = () => { const c = { ...BASE }; Object.entries(Z.ref.company || {}).forEach(([k, v]) => { if (v != null && v !== '') c[k] = v; }); return c; };
  // " Pay by M-Pesa Paybill 123456, account 0042." — or by Till, or nothing if neither is set yet
  Z.payLine = (account) => { const c = Z.co(); return c.paybill ? ` Pay by M-Pesa Paybill ${c.paybill}${account ? ', account ' + account : ''}.` : c.till ? ` Pay by M-Pesa Buy Goods, Till ${c.till}.` : ''; };

  // 8 Oct 2026 (Jerry): Billnasi texts every customer 3 days BEFORE the package runs out, then switches them off.
  // Zuri's part is what happens AFTER the cutoff: five steps, the right words for each, a kind goodbye at day 30.
  // Each step shows on the payment follow-up job; sending its text brings the job back on the next step's day.
  const first = (c) => String(c.full_name || '').trim().split(/\s+/)[0] || 'there';
  const coName = () => (Z.co ? Z.co().name : 'Zuri Fiber') || 'Zuri Fiber';
  const pay = (c) => { const p = Z.payLine ? Z.payLine(c.account_no) : ''; return p || (' Pay by M-Pesa' + (c.account_no ? ', account ' + c.account_no : '') + '.'); };
  const rate = (c) => (c.monthly_rate ? 'KES ' + Number(c.monthly_rate).toLocaleString('en-US') : 'your package');
  Z.AFTER_CUTOFF = [
    { key: 'd1', from: 0, to: 2, next: 3, short: 'Day 1 · reconnect',
      name: 'Day 1–2 · Help them reconnect', how: 'Send the text first — most people simply forgot. It tells them exactly how to get back online.',
      msg: (c) => `Hello ${first(c)}, this is ${coName()}. Your internet went off because the package ran out. To reconnect, pay ${rate(c)}.${pay(c)} You'll be back online within minutes. Asante!` },
    { key: 'd3', from: 3, to: 6, next: 7, short: 'Day 3 · anything wrong?',
      name: 'Day 3–6 · Is anything wrong?', how: 'Call first and ask if the service was working well. If it wasn’t, tap “Service problem” to open a fault job. Then send the text.',
      msg: (c) => `Hello ${first(c)}, this is ${coName()}. We noticed your internet is still off. Was everything okay with the service? If something wasn't working, reply and we'll send a technician. To reconnect, pay ${rate(c)}.${pay(c)}` },
    { key: 'd7', from: 7, to: 13, next: 14, short: 'Day 7 · we miss you',
      name: 'Day 7–13 · We miss you', how: 'Send the text. If they reply that they need a few days, tap “Will pay” and pick the day.',
      msg: (c) => `Hello ${first(c)}, ${coName()} here. We miss having you connected! Your account is ready: pay ${rate(c)}.${pay(c)} You'll be back online in minutes. Need a few more days? Just reply and tell us.` },
    { key: 'd14', from: 14, to: 29, next: 30, short: 'Day 14 · last check-in',
      name: 'Day 14–29 · Last check-in', how: 'Call. Ask why they stopped (moved, price, the service, something else) and write the answer in a note — it tells us what to fix.',
      msg: (c) => `Hello ${first(c)}, this is ${coName()}. It's been two weeks since your internet went off. Have you moved, or is there something we could do better? We'd love to have you back. ${pay(c).trim()}` },
    { key: 'd30', from: 30, to: 1e6, next: null, short: 'Day 30 · goodbye',
      name: 'Day 30 · A kind goodbye', how: 'Send the goodbye, then close the follow-up. It won’t open again unless they pay and run out another time.',
      msg: (c) => `Hello ${first(c)}, this is ${coName()}. We've paused your account for now — thank you for being with us. Whenever you're ready, pay ${rate(c)}.${pay(c)} We'll have you back online the same day.` },
  ];
  const FIELDS = [
    ['name', 'Company name (used in customer texts)', 'Zuri Fiber'], ['town', 'Town', 'Maai Mahiu'],
    ['phone', 'Office phone', '07…'], ['whatsapp', 'WhatsApp number', '07…'], ['email', 'Email', 'info@…'],
    ['address', 'Office address / landmark', 'e.g. Opposite the stage, above …'],
    ['paybill', 'M-Pesa Paybill number', 'e.g. 4012345'], ['till', 'M-Pesa Till (Buy Goods), if any', ''],
    ['kra_pin', 'KRA PIN', 'P05…'], ['website', 'Website', ''],
  ];

  Z.adminSubs.push(['company', 'Company & hubs']);
  Z.adminViews.company = async (el) => {
    if (!Z.isAdmin()) { el.innerHTML = '<div class="card">Only partners can change the company details and hubs.</div>'; return; }
    const hr = await Z.sb.from('hubs').select('*').order('active', { ascending: false }).order('name');
    if (hr.error) { el.innerHTML = '<div class="card"><b>One setup step first.</b><p class="hint">This database needs file 20 (company and hubs) run once in Supabase → SQL Editor. Then this page opens.</p></div>'; return; }
    const hubs = hr.data;
    const srow = must(await Z.sb.from('settings').select('value').eq('key', 'company_profile').maybeSingle());
    const c = { ...BASE, ...((srow && srow.value) || {}) };
    const kind = (k) => Z.HUB_KINDS.find((x) => x[0] === k) || Z.HUB_KINDS[2];
    el.innerHTML = `
      <form class="card" id="co"><h3 style="margin-top:0">🏢 The company</h3>
        <div class="grid3">${FIELDS.map(([k, label, ph]) => `<div><label>${label}</label><input name="${k}" value="${Z.esc(c[k] || '')}" placeholder="${Z.esc(ph)}" ${['phone', 'whatsapp', 'paybill', 'till'].includes(k) ? 'inputmode="numeric"' : ''}></div>`).join('')}</div>
        <p class="hint">The reminder texts say “this is ${Z.esc(c.name)}” and, once the Paybill is here, how to pay.</p>
        <button class="btn">Save the company</button></form>
      <div class="card"><h3 style="margin-top:0">📍 Hubs — the network's places</h3>
        <p class="hint" style="margin-top:0">The office, the OLT or server room, splitter cabinets, towers and the store. They show on the customer map, and each customer shows how far its nearest hub is.</p>
        <div class="list">${hubs.map((h) => `<div class="item" style="flex-wrap:wrap${h.active ? '' : ';opacity:.55'}">
          <div class="grow" style="min-width:180px"><div class="t">${kind(h.kind)[1]} ${Z.esc(h.name)} ${h.active ? '' : '<span class="pill">switched off</span>'}${h.lat == null ? ' <span class="pill bad">no pin</span>' : ''}</div>
            <div class="m">${Z.esc([kind(h.kind)[2], h.area ? Z.areaName(h.area) : 'All areas', h.landmark].filter(Boolean).join(' · '))}</div></div>
          <div class="row"><button class="btn sec small" data-edit="${h.id}">✏️ Edit</button><button class="btn sec small" data-onoff="${h.id}">${h.active ? 'Switch off' : 'Switch on'}</button></div></div>`).join('') || '<div class="empty">No hubs yet. Add the office first.</div>'}</div></div>
      <form class="card" id="hb"><h3 style="margin-top:0" id="hb-title">＋ Add a hub</h3><input type="hidden" name="id">
        <div class="grid3">
          <div><label>Name</label><input name="name" required placeholder="e.g. Main office, OLT room, Cabinet 3"></div>
          <div><label>What it is</label><select name="kind">${Z.opts(Z.HUB_KINDS.map(([k, e, t]) => [k, e + ' ' + t]), 'hub')}</select></div>
          <div><label>Area</label><select name="area"><option value="">All areas</option>${Z.opts(Z.ref.areas.map((a) => [a.code, a.name]))}</select></div>
          <div><label>Landmark</label><input name="landmark" placeholder="How to find it"></div>
          <div style="grid-column:1/-1"><label>Note (keys, contact, power…)</label><input name="note"></div></div>
        <label>Where it is</label>
        <div class="row" style="margin-bottom:6px"><button type="button" class="btn sec" id="hb-here">📍 Where I'm standing</button><span class="hint" id="hb-pos" style="margin:0">…or tap the map below.</span></div>
        <div style="border-radius:12px;overflow:hidden;border:1px solid var(--line, #D8DFDC)"><div id="hb-map" style="height:260px"></div></div>
        <input type="hidden" name="lat"><input type="hidden" name="lng">
        <div class="row" style="margin-top:10px"><button class="btn">Save the hub</button><button type="button" class="btn sec" id="hb-new" hidden>Cancel edit</button></div></form>`;

    Z.$('#co', el).onsubmit = async (e) => {
      e.preventDefault(); const d = Z.formData(e.target); const v = {};
      FIELDS.forEach(([k]) => (v[k] = (d[k] || '').trim() || null));
      if (!v.name) return Z.toast('The company needs a name.');
      const { error } = await Z.sb.from('settings').upsert({ key: 'company_profile', value: v }, { onConflict: 'key' });
      if (error) return Z.fail(error);
      await Z.loadRef(); Z.toast('Company saved.');
    };

    const f = Z.$('#hb', el), posT = Z.$('#hb-pos', el);
    let L, map, mark;
    const setPos = (la, ln, how) => {
      f.lat.value = la; f.lng.value = ln; posT.textContent = `${how} · ${(+la).toFixed(5)}, ${(+ln).toFixed(5)}`;
      if (map) { if (mark) mark.setLatLng([la, ln]); else mark = L.marker([la, ln], { icon: Z.hubIcon(L, { kind: f.kind.value, name: f.name.value || 'New hub' }) }).addTo(map); map.setView([la, ln], Math.max(map.getZoom(), 16)); }
    };
    try {
      L = await Z.leaflet();
      const placed = hubs.filter((h) => h.lat != null);
      map = L.map(Z.$('#hb-map', el)).setView(placed.length ? [placed[0].lat, placed[0].lng] : [-0.985, 36.59], 14);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      placed.forEach((h) => L.marker([h.lat, h.lng], { icon: Z.hubIcon(L, h), opacity: h.active ? 1 : 0.5 }).addTo(map));
      if (placed.length > 1) map.fitBounds(L.latLngBounds(placed.map((h) => [h.lat, h.lng])).pad(0.2), { maxZoom: 16 });
      map.on('click', (ev) => setPos(+ev.latlng.lat.toFixed(6), +ev.latlng.lng.toFixed(6), 'Pin from the map'));
      setTimeout(() => map.invalidateSize(), 300);
    } catch (e2) { Z.$('#hb-map', el).innerHTML = '<div class="empty">The map needs a connection. “Where I\'m standing” still works.</div>'; }

    Z.$('#hb-here', el).onclick = () => {
      const b = Z.$('#hb-here', el);
      if (!navigator.geolocation) return Z.toast('This phone cannot share its location.');
      b.disabled = true; b.textContent = '📍 Finding you…';
      navigator.geolocation.getCurrentPosition((pos) => {
        b.disabled = false; b.textContent = '📍 Where I\'m standing';
        const acc = Math.round(pos.coords.accuracy);
        if (acc > 50 && !confirm(`Your location is only accurate to about ${acc} m. Step outside, wait a minute and try again.\n\nUse this rough pin anyway?`)) return;
        setPos(+pos.coords.latitude.toFixed(6), +pos.coords.longitude.toFixed(6), `Where you're standing (±${acc} m)`);
      }, (err) => { b.disabled = false; b.textContent = '📍 Where I\'m standing'; Z.toast(err.code === 1 ? 'Allow location for this app in the phone settings.' : 'Couldn\'t get a location — step outside and try again.'); },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
    };

    Z.$$('[data-edit]', el).forEach((b) => (b.onclick = () => {
      const h = hubs.find((x) => x.id === b.dataset.edit);
      f.id.value = h.id; f.name.value = h.name; f.kind.value = h.kind; f.area.value = h.area || ''; f.landmark.value = h.landmark || ''; f.note.value = h.note || '';
      f.lat.value = h.lat ?? ''; f.lng.value = h.lng ?? ''; posT.textContent = h.lat != null ? `Pin saved · ${h.lat.toFixed(5)}, ${h.lng.toFixed(5)} — tap the map to move it` : 'No pin yet — stand there or tap the map.';
      Z.$('#hb-title', el).textContent = '✏️ Edit ' + h.name; Z.$('#hb-new', el).hidden = false;
      if (map && h.lat != null) { if (mark) mark.setLatLng([h.lat, h.lng]); else mark = L.marker([h.lat, h.lng]).addTo(map); map.setView([h.lat, h.lng], 17); }
      f.scrollIntoView({ behavior: 'smooth' });
    }));
    Z.$('#hb-new', el).onclick = () => Z.route();
    Z.$$('[data-onoff]', el).forEach((b) => (b.onclick = async () => {
      const h = hubs.find((x) => x.id === b.dataset.onoff);
      const { error } = await Z.sb.from('hubs').update({ active: !h.active, updated_at: new Date().toISOString() }).eq('id', h.id);
      if (error) return Z.fail(error);
      await Z.loadRef(); Z.toast(h.active ? 'Switched off — it leaves the map.' : 'Switched on.'); Z.route();
    }));

    f.onsubmit = async (e) => {
      e.preventDefault(); const d = Z.formData(f);
      const row = { name: d.name.trim(), kind: d.kind, area: d.area || null, landmark: d.landmark.trim() || null, note: d.note.trim() || null,
        lat: d.lat === '' ? null : +d.lat, lng: d.lng === '' ? null : +d.lng, updated_at: new Date().toISOString() };
      if (row.lat == null && !confirm('No pin yet — save it without a place on the map? You can add the pin later.')) return;
      const { error } = d.id ? await Z.sb.from('hubs').update(row).eq('id', d.id) : await Z.sb.from('hubs').insert(row);
      if (error) return Z.fail(error);
      await Z.loadRef(); Z.toast(d.id ? 'Hub saved.' : 'Hub added.'); Z.route();
    };
  };
})();
