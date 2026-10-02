// Zuri System · the customer map: every customer with a pin, by area · v2 · 2026-10-01
// v2: hubs (office, OLT, cabinets, towers, store) drawn as labelled icons; the map centres on them; each customer shows its nearest hub.
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
  Z.leaflet = leaflet;
  Z.HUB_KINDS = [['office', '🏢', 'Office / HQ'], ['olt', '🗄️', 'OLT / server room'], ['hub', '📦', 'Splitter cabinet'], ['tower', '📡', 'Tower / wireless'], ['store', '🧰', 'Store']];
  Z.hubIcon = (L, h) => { const k = Z.HUB_KINDS.find((x) => x[0] === h.kind) || Z.HUB_KINDS[2];
    return L.divIcon({ className: 'zhub', iconSize: null, iconAnchor: [16, 16], html: `<div style="display:flex;align-items:center;gap:4px;white-space:nowrap"><span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;background:#fff;border:2px solid #0F6E5C;box-shadow:0 1px 4px #0005;font-size:18px">${k[1]}</span><b style="background:#fffd;border-radius:6px;padding:1px 5px;font-size:12px;color:#152322">${Z.esc(h.name)}</b></div>` }); };
  Z.km = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
  Z.nearestHub = (lat, lng, hubs) => { let best = null; (hubs || []).filter((h) => h.lat != null && h.active !== false).forEach((h) => { const d = Z.km(lat, lng, h.lat, h.lng); if (!best || d < best.d) best = { h, d }; }); return best; };
  const pin = (color) => ({ radius: 7, color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 0.95 });

  Z.customerMap = async (el) => {
    let q = Z.sb.from('v_customers').select('id,full_name,phone,area,landmark,lat,lng,status,plan,monthly_rate,paid_until').not('lat', 'is', null);
    if (Z.area) q = q.eq('area', Z.area);
    const rows = must(await q.limit(5000));
    const hr = await Z.sb.from('hubs').select('*').eq('active', true);
    const allHubs = hr.error ? [] : hr.data; // a database without file 20 yet: the map still works, just no hubs
    const hubs = allHubs.filter((h) => h.lat != null && (!Z.area || !h.area || h.area === Z.area));
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
      <div class="row" style="margin-bottom:8px"><span class="pill ok">● ${n.ok} paid up</span><span class="pill bad">● ${n.late} ran out</span><span class="pill">● ${n.off} not active</span>${hubs.length ? `<label class="row" style="margin:0;gap:5px;font-size:14px"><input type="checkbox" id="cm-hubs" checked> 🏢 Hubs (${hubs.length})</label>` : ''}<span class="hint" style="margin:0">${Z.fmt(rows.filter((c) => c.status === 'active').length)} of ${Z.fmt(total)} active customers have a pin</span></div>
      <div class="card" style="padding:0;overflow:hidden"><div id="cmap" style="height:62vh;min-height:360px"></div></div>
      <p class="hint">Change the area at the top to see one area. Tap a pin for the customer. Pins come from techs tapping <b>Drop pin here</b> at the house — ${Z.fmt(total - rows.filter((c) => c.status === 'active').length)} active customers still have none.${hubs.length ? '' : Z.isAdmin() ? ' <a href="#admin/company">Add your hubs</a> so the map knows where the network is.' : ''}</p>`;
    let L;
    try { L = await leaflet(); } catch (e) { Z.$('#cmap', el).innerHTML = '<div class="empty">The map needs a connection the first time.</div>'; return; }
    const hq = allHubs.find((h) => h.kind === 'office' && h.lat != null);
    const map = L.map(Z.$('#cmap', el), { zoomControl: true }).setView(hq ? [hq.lat, hq.lng] : MAAI_MAHIU, 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    const pts = [];
    rows.forEach((c) => {
      const s = state(c);
      const m = L.circleMarker([c.lat, c.lng], pin(COL[s])).addTo(map);
      m.bindPopup(`<b style="font-size:15px">${Z.esc(c.full_name)}</b><br>${Z.esc([c.plan, c.monthly_rate ? 'KES ' + Z.fmt(c.monthly_rate) : '', Z.areaName(c.area)].filter(Boolean).join(' · '))}
        ${c.landmark ? '<br>📍 ' + Z.esc(c.landmark) : ''}${(() => { const n = Z.nearestHub(c.lat, c.lng, allHubs); return n ? `<br>🏢 ${n.d < 1 ? Math.round(n.d * 1000) + ' m' : n.d.toFixed(1) + ' km'} from ${Z.esc(n.h.name)}` : ''; })()}${s === 'late' ? '<br><span style="color:#C0392B;font-weight:700">Ran out ' + Z.day(String(c.paid_until).slice(0, 10)) + '</span>' : ''}
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${c.phone ? `<a href="tel:${Z.esc(c.phone)}" class="btn sec small">📞 Call</a>` : ''}<a href="#customers/${c.id}" class="btn sec small">Profile</a><a href="#jobs/new/${c.id}" class="btn small">＋ Job</a><a href="https://maps.google.com/?q=${c.lat},${c.lng}" target="_blank" rel="noopener" class="btn sec small">Google Maps</a></div>`, { maxWidth: 280 });
      pts.push([c.lat, c.lng]);
    });
    const hubLayer = L.layerGroup().addTo(map);
    hubs.forEach((h) => {
      const k = Z.HUB_KINDS.find((x) => x[0] === h.kind) || Z.HUB_KINDS[2];
      L.marker([h.lat, h.lng], { icon: Z.hubIcon(L, h), zIndexOffset: 1000 }).addTo(hubLayer)
        .bindPopup(`<b style="font-size:15px">${k[1]} ${Z.esc(h.name)}</b><br>${Z.esc([k[2], h.area ? Z.areaName(h.area) : 'All areas'].join(' · '))}${h.landmark ? '<br>📍 ' + Z.esc(h.landmark) : ''}${h.note ? '<br>' + Z.esc(h.note) : ''}
          <div style="margin-top:6px"><a href="https://maps.google.com/?q=${h.lat},${h.lng}" target="_blank" rel="noopener" class="btn sec small">Directions</a></div>`, { maxWidth: 260 });
      pts.push([h.lat, h.lng]);
    });
    const hb = Z.$('#cm-hubs', el); if (hb) hb.onchange = () => (hb.checked ? hubLayer.addTo(map) : map.removeLayer(hubLayer));
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 16 });
    setTimeout(() => map.invalidateSize(), 300);
  };
})();
