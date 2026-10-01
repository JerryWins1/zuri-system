// Zuri System · the customer map: every customer with a pin, by area · v1 · 2026-10-01
// Free map tiles (OpenStreetMap) through Leaflet — no account, no key. Pins follow the area picker at the top.
(function () {
  const Z = window.Z;
  const must = (r) => { if (r.error) throw r.error; return r.data; };
  const CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
  const JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
  const MAAI_MAHIU = [-0.985, 36.59];
  async function leaflet() {
    if (!document.querySelector(`link[href="${CSS}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; document.head.appendChild(l); }
    await Z.loadScript(JS);
    return window.L;
  }
  const pin = (color) => ({ radius: 7, color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 0.95 });

  Z.customerMap = async (el) => {
    let q = Z.sb.from('v_customers').select('id,full_name,phone,area,landmark,lat,lng,status,plan,monthly_rate,paid_until').not('lat', 'is', null);
    if (Z.area) q = q.eq('area', Z.area);
    const rows = must(await q.limit(5000));
    let cq = Z.sb.from('v_customers').select('id', { count: 'exact', head: true }).eq('status', 'active');
    if (Z.area) cq = cq.eq('area', Z.area);
    const total = (await cq).count || 0;
    const now = Date.now();
    const state = (c) => (c.status !== 'active' ? 'off' : c.paid_until && new Date(c.paid_until) < now ? 'late' : 'ok');
    const COL = { ok: '#2E8B57', late: '#C0392B', off: '#8C958F' };
    const n = { ok: 0, late: 0, off: 0 }; rows.forEach((c) => n[state(c)]++);
    el.innerHTML = `
      <p style="margin:0 0 6px"><a href="#customers">← Customers</a></p>
      <div class="row" style="justify-content:space-between"><h2 style="margin-bottom:4px">🗺️ Map${Z.area ? ' · ' + Z.esc(Z.areaName(Z.area)) : ' · all areas'}</h2></div>
      <div class="row" style="margin-bottom:8px"><span class="pill ok">● ${n.ok} paid up</span><span class="pill bad">● ${n.late} ran out</span><span class="pill">● ${n.off} not active</span><span class="hint" style="margin:0">${Z.fmt(rows.filter((c) => c.status === 'active').length)} of ${Z.fmt(total)} active customers have a pin</span></div>
      <div class="card" style="padding:0;overflow:hidden"><div id="cmap" style="height:62vh;min-height:360px"></div></div>
      <p class="hint">Change the area at the top to see one area. Tap a pin for the customer. Pins come from techs tapping <b>Drop pin here</b> at the house — ${Z.fmt(total - rows.filter((c) => c.status === 'active').length)} active customers still have none.</p>`;
    let L;
    try { L = await leaflet(); } catch (e) { Z.$('#cmap', el).innerHTML = '<div class="empty">The map needs a connection the first time.</div>'; return; }
    const map = L.map(Z.$('#cmap', el), { zoomControl: true }).setView(MAAI_MAHIU, 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    const pts = [];
    rows.forEach((c) => {
      const s = state(c);
      const m = L.circleMarker([c.lat, c.lng], pin(COL[s])).addTo(map);
      m.bindPopup(`<b style="font-size:15px">${Z.esc(c.full_name)}</b><br>${Z.esc([c.plan, c.monthly_rate ? 'KES ' + Z.fmt(c.monthly_rate) : '', Z.areaName(c.area)].filter(Boolean).join(' · '))}
        ${c.landmark ? '<br>📍 ' + Z.esc(c.landmark) : ''}${s === 'late' ? '<br><span style="color:#C0392B;font-weight:700">Ran out ' + Z.day(String(c.paid_until).slice(0, 10)) + '</span>' : ''}
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${c.phone ? `<a href="tel:${Z.esc(c.phone)}" class="btn sec small">📞 Call</a>` : ''}<a href="#customers/${c.id}" class="btn sec small">Profile</a><a href="#jobs/new/${c.id}" class="btn small">＋ Job</a><a href="https://maps.google.com/?q=${c.lat},${c.lng}" target="_blank" rel="noopener" class="btn sec small">Google Maps</a></div>`, { maxWidth: 280 });
      pts.push([c.lat, c.lng]);
    });
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 16 });
    setTimeout(() => map.invalidateSize(), 300);
  };
})();
