// Zuri System · 📣 Alerts: one message to many customers, by area or by cabinet · v1 · 2026-10-16 (app v2.39)
//   #alerts                 the list: waiting for a partner, ready to send, sent
//   #alerts/new/CODE/...    write one (CODE = OUT, FIX, MAINT…; then area:A, hub:<id>, outage:<id>, parent:<alert id>)
//   #alerts/<id>            one alert: the words, the people, approve, send, the follow-up
//   #alerts/codes           the ready-made messages (partners change the words)
//   #alerts/setup           SMS price, sender name, quiet hours (partners)
//   Z.alertPrefsBox(box, c) on the customer page: which cabinet serves the home, language, what they agreed to get
//   Z.alertLink(o, where)   the "📣 Alert customers" button on the outage card (timesavers.js)
// NOTHING here sends by itself. An approved alert is downloaded as a list for the bulk-SMS service (or copied for a WhatsApp
// broadcast) and marked sent. Later the Daraja server sends it straight from here; the screens stay the same.
// Needs supabase/28_alerts.sql. Before it, the page says so and nothing else changes.
(function () {
  const Z = window.Z;
  const must = (r) => { if (r.error) throw r.error; return r.data; };
  const PURPOSE = { service: ['Service', 'brand'], reminder: ['Reminder', 'warn'], offer: ['Offer', 'ok'] };
  const STATUS = { draft: ['Waiting for a partner', 'warn'], approved: ['Approved · ready to send', 'brand'], sent: ['Sent', 'ok'], cancelled: ['Cancelled', ''] };
  const CUST_STATUSES = [['active', 'Active'], ['suspended', 'Suspended'], ['disconnected', 'Disconnected'], ['lead', 'Leads']];
  const SERVING = ['hub', 'tower']; // the places a home is wired to (the OLT and the office serve everyone behind them)
  // The words people type. Everything else ({name}, {zone}…) fills itself in for each customer.
  const BLANKS = { eta: ['Expected back by', 'e.g. 4pm today'], date: ['Date', 'e.g. Saturday 18 Oct'], time: ['Start time', 'e.g. 10am'], duration: ['How long', 'e.g. 2 hours'],
    offer: ['The offer', 'e.g. 20 Mbps for KES 3,000 a month'], message: ['Your message', ''], minutes: ['Minutes late', 'e.g. 30'] };
  const SW_HINT = { eta: 'e.g. saa 10 jioni', date: 'e.g. Jumamosi 18 Okt', time: 'e.g. saa 4 asubuhi', duration: 'e.g. saa 2', offer: 'e.g. 20 Mbps kwa KES 3,000 kwa mwezi', minutes: 'e.g. dakika 30' };
  // Same as 28_alerts.sql. Practice starts with these; the real database gets them from the file.
  const DEFAULT_CODES = [
    { code: 'OUT', name: 'Outage', purpose: 'service', urgent: true, follow_up: 'FIX', sort: 10, active: true, hint: 'Send when a cabinet, tower or the backhaul is down. Then send FIX to the same people.',
      msg_en: '{company}: Internet is down in {zone}. Technicians are on it. Expected back by {eta}. No need to call, we will text you when it is fixed.',
      msg_sw: '{company}: Mtandao umekatika {zone}. Mafundi wanashughulikia. Utarudi kufikia {eta}. Usipige simu, tutakutumia ujumbe ukirudi.' },
    { code: 'FIX', name: 'Service is back', purpose: 'service', urgent: true, follow_up: null, sort: 20, active: true, hint: 'Goes to exactly the people who got the outage message.',
      msg_en: '{company}: Internet is back in {zone}. Thanks for your patience. Still offline? Restart your router, then call or WhatsApp {support}.',
      msg_sw: '{company}: Mtandao umerudi {zone}. Asante kwa uvumilivu. Bado hauna mtandao? Zima na uwashe router, kisha tupigie au WhatsApp {support}.' },
    { code: 'MAINT', name: 'Planned work', purpose: 'service', urgent: false, follow_up: null, sort: 30, active: true, hint: 'Send the day before.',
      msg_en: '{company}: Planned work in {zone} on {date} from {time}. Internet may be off for about {duration}. Sorry for the trouble.',
      msg_sw: '{company}: Kazi iliyopangwa {zone} tarehe {date} kuanzia {time}. Mtandao unaweza kukatika kwa {duration}. Samahani kwa usumbufu.' },
    { code: 'POWER', name: 'Power cut (not us)', purpose: 'service', urgent: true, follow_up: null, sort: 40, active: true, hint: 'Saves a flood of fault calls when KPLC power is out.',
      msg_en: '{company}: Electricity is off in {zone}. Your internet will come back when the power returns. Our network is working.',
      msg_sw: '{company}: Umeme umekatika {zone}. Mtandao wako utarudi umeme ukirudi. Mtandao wetu unafanya kazi.' },
    { code: 'SLOW', name: 'Slow internet', purpose: 'service', urgent: false, follow_up: null, sort: 50, active: true, hint: null,
      msg_en: '{company}: Internet may be slow in {zone} until {eta} while we fix a fault. Sorry for the trouble.',
      msg_sw: '{company}: Mtandao unaweza kuwa wa polepole {zone} hadi {eta} tunaporekebisha hitilafu. Samahani kwa usumbufu.' },
    { code: 'NOTICE', name: 'General notice', purpose: 'service', urgent: false, follow_up: null, sort: 60, active: true, hint: 'Type the whole message yourself, in both languages if you can.',
      msg_en: '{company}: {message}', msg_sw: '{company}: {message}' },
    { code: 'UPGRADE', name: 'Upgrade offer', purpose: 'offer', urgent: false, follow_up: null, sort: 70, active: true, hint: 'Only goes to customers who said yes to offers.',
      msg_en: 'Hi {name}, faster {company} packages are now available in {zone}: {offer}. Call or WhatsApp {support} to upgrade.',
      msg_sw: 'Habari {name}, vifurushi vya kasi zaidi vya {company} sasa vipo {zone}: {offer}. Tupigie au WhatsApp {support} kuboresha.' },
    { code: 'RENEW', name: 'Package ending', purpose: 'reminder', urgent: false, follow_up: null, sort: 80, active: false, hint: 'OFF by default: Billnasi already texts customers 3 days before their package ends. Switch on only if Billnasi stops.',
      msg_en: 'Hi {name}, your {company} package ends on {paid_until}.{pay}', msg_sw: 'Habari {name}, kifurushi chako cha {company} kinaisha tarehe {paid_until}.{pay}' },
  ];
  const SETUP0 = { sms_price_kes: null, sender_id: null, quiet_from: '19:00', quiet_to: '07:00', approve_over: 0, server_on: false };

  // ---------- is 28_alerts.sql there? (asked once; a "no" is asked again after 5 minutes) ----------
  let ok = null, okAt = 0;
  Z.alertsOk = async () => {
    if (Z.practice) return true;
    if (ok === true || (ok === false && Date.now() - okAt < 300e3)) return ok;
    try { const r = await Z.sb.rpc('alerts_version'); if (r.error && Z.isNet(r.error)) return false; ok = !r.error && Number(r.data) >= 1; } catch (e) { return false; }
    okAt = Date.now(); return ok;
  };

  // ---------- data ----------
  async function codes() {
    let rows = must(await Z.sb.from('alert_codes').select('*').order('sort'));
    if (!rows.length && Z.practice) { must(await Z.sb.from('alert_codes').insert(DEFAULT_CODES.map((c) => ({ ...c, id: c.code })))); rows = must(await Z.sb.from('alert_codes').select('*').order('sort')); }
    return rows;
  }
  async function setup() {
    const r = await Z.sb.from('settings').select('value').eq('key', 'alerts_setup').maybeSingle();
    return { ...SETUP0, ...((r.data && r.data.value) || {}) };
  }
  // Every customer, a thousand at a time (the database hands out at most 1,000 rows per ask).
  async function everyone() {
    const out = [];
    for (let from = 0; from < 50000; from += 1000) {
      const rows = must(await Z.sb.from('v_customers').select('id,full_name,phone,phone2,area,status,plan,paid_until,account_no,lat,lng').order('id').range(from, from + 999));
      out.push(...rows); if (rows.length < 1000) break;
    }
    return out;
  }
  async function prefsMap() {
    const m = new Map();
    for (let from = 0; from < 50000; from += 1000) {
      const rows = must(await Z.sb.from('customer_alert_prefs').select('*').range(from, from + 999));
      rows.forEach((p) => m.set(String(p.customer_id), p)); if (rows.length < 1000) break;
    }
    return m;
  }
  const hubs = () => (Z.ref.hubs || []).filter((h) => h.active !== false);
  const hubName = (id) => (hubs().find((h) => String(h.id) === String(id)) || {}).name || 'a hub';
  const kindIcon = (k) => ((Z.HUB_KINDS || []).find((x) => x[0] === k) || [k, '📦'])[1];
  // Which cabinet/tower serves this home: what the office set, else the nearest one (in the same area when it has one).
  function servedBy(c, p) {
    if (p && p.served_by_hub) return { id: String(p.served_by_hub), how: 'set' };
    if (c.lat == null || !Z.nearestHub) return null;
    const serving = hubs().filter((h) => SERVING.includes(h.kind));
    const same = serving.filter((h) => !h.area || h.area === c.area);
    const n = Z.nearestHub(c.lat, c.lng, same.length ? same : serving);
    return n ? { id: String(n.h.id), how: 'nearest', d: n.d } : null;
  }

  // ---------- words ----------
  const first = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';
  const swOf = (b) => { const o = { ...b }; Object.keys(BLANKS).forEach((k) => { if (b[k + '_sw']) o[k] = b[k + '_sw']; }); return o; }; // what was typed in Kiswahili wins in the Kiswahili words
  const fill = (tpl, v) => String(tpl || '').replace(/\{([a-z_]+)\}/g, (m, k) => (v[k] != null && v[k] !== '' ? v[k] : m));
  const blanksIn = (code) => [...new Set(((code.msg_en || '') + ' ' + (code.msg_sw || '')).match(/\{([a-z_]+)\}/g) || [])].map((x) => x.slice(1, -1)).filter((k) => BLANKS[k]);
  const left = (s) => (String(s).match(/\{([a-z_]+)\}/g) || []).map((x) => x.slice(1, -1)).filter((k) => BLANKS[k]);
  const support = () => { const c = Z.co ? Z.co() : {}; return c.whatsapp || c.phone || 'the office'; };
  const company = () => (Z.co ? Z.co().name : '') || 'Zuri Fiber';
  // The words for one customer. zone = the cabinet's name when the alert is by cabinet, else the customer's area.
  function wordsFor(a, c, zone) {
    const lang = c.lang === 'en' ? 'en' : 'sw';
    return fill(lang === 'en' ? a.message_en : a.message_sw, {
      company: company(), support: support(), zone: zone || Z.areaName(c.area), name: first(c.full_name), account_no: c.account_no || '',
      plan: c.plan || '', paid_until: c.paid_until ? Z.day(String(c.paid_until).slice(0, 10)) : '', pay: Z.payLine ? Z.payLine(c.account_no) : '',
    });
  }
  // SMS: 160 letters fit in one; longer ones go in parts of 153. Emoji or unusual letters cut that to 70 / 67.
  const smsParts = (t) => { const uni = /[^\n\r -~£¥èéùìòÇØøÅåÆæßÉÄÖÑÜ§¿äöñüà€]/.test(t); const one = uni ? 70 : 160, part = uni ? 67 : 153; return t.length <= one ? 1 : Math.ceil(t.length / part); };

  // ---------- who gets it ----------
  // t = { mode: 'area'|'hub'|'same', areas:[], hubs:[], statuses:[], plans:[], within: days|null, phone2: bool, parent: alert|null }
  function audience(t, purpose, people, prefs) {
    const pick = [], skip = { no: 0, nophone: 0, dup: 0, unknown: [] }, seen = new Set();
    const hubSet = new Set((t.hubs || []).map(String)), wide = hubs().filter((h) => hubSet.has(String(h.id)) && !SERVING.includes(h.kind)); // an OLT / office = everyone in its area
    const parentIds = t.mode === 'same' && t.parent ? new Set((t.parent.recipient_ids || []).map(String)) : null;
    people.forEach((c) => {
      const p = prefs.get(String(c.id));
      let zone = null;
      if (parentIds) {
        if (!parentIds.has(String(c.id))) return;
        const ph = (t.parent.hubs || []).map(String);
        if (ph.length) { const s = servedBy(c, p); zone = s && ph.includes(s.id) ? hubName(s.id) : hubName(ph[0]); }
      }
      else {
        if (!(t.statuses || []).includes(c.status)) return;
        if (t.mode === 'area') { if (!(t.areas || []).includes(c.area)) return; }
        else {
          const s = servedBy(c, p);
          const viaWide = wide.find((h) => !h.area || h.area === c.area);
          if (s && hubSet.has(s.id)) zone = hubName(s.id); else if (viaWide) zone = viaWide.name;
          else { if (!s && hubs().some((h) => hubSet.has(String(h.id)) && (!h.area || h.area === c.area))) skip.unknown.push(c); return; } // no pin, no cabinet: we can't tell
        }
        if (purpose === 'offer' && (t.plans || []).length && !t.plans.includes(c.plan)) return;
        if (t.within != null && t.within !== '') { const d = c.paid_until ? (new Date(c.paid_until) - Date.now()) / 864e5 : null; if (d == null || d < 0 || d > Number(t.within)) return; }
      }
      const yes = purpose === 'offer' ? !!(p && p.ok_offers) : purpose === 'reminder' ? !(p && p.ok_reminders === false) : !(p && p.ok_service === false);
      if (!yes) { skip.no++; return; }
      const phones = [c.phone].concat(t.phone2 ? [c.phone2] : []).map((x) => Z.phone254(x)).filter((x) => x.length >= 12);
      if (!phones.length) { skip.nophone++; return; }
      const fresh = phones.filter((x) => !seen.has(x)); if (!fresh.length) { skip.dup++; return; }
      fresh.forEach((x) => seen.add(x));
      pick.push({ c: { ...c, lang: (p && p.lang) || 'sw' }, phones: fresh, zone });
    });
    return { pick, skip };
  }

  // ---------- small bits ----------
  const pill = ([t, k]) => `<span class="pill ${k}">${Z.esc(t)}</span>`;
  const argsOf = (args) => { const o = {}; args.forEach((a) => { const i = a.indexOf(':'); if (i > 0) o[a.slice(0, i)] = a.slice(i + 1); }); return o; };
  const quiet = (s) => { const n = new Date(), m = n.getHours() * 60 + n.getMinutes(), t = (x) => { const [h, mi] = String(x || '0:0').split(':').map(Number); return h * 60 + (mi || 0); }; const f = t(s.quiet_from), u = t(s.quiet_to); return f > u ? m >= f || m < u : m >= f && m < u; };
  const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const download = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
  const needSql = (el) => { el.innerHTML = `<div class="card"><b>📣 Alerts needs one more database file.</b><p class="hint">A partner runs <b>supabase/28_alerts.sql</b> on the database (test copy first). Until then this page stays empty and nothing else changes.</p></div>`; };
  const subtabs = (on) => `<div class="subtabs">${[['', 'Alerts'], ['new', '＋ New'], ['codes', 'Messages']].concat(Z.isAdmin() ? [['setup', 'Settings']] : []).map(([k, t]) => `<a href="#alerts${k ? '/' + k : ''}" class="${k === on ? 'on' : ''}">${t}</a>`).join('')}</div>`;

  // =====================================================================================================
  Z.routes.alerts = async (args, el) => {
    if (!(await Z.alertsOk())) return needSql(el);
    const a0 = args[0] || '';
    if (a0 === 'new') return compose(args.slice(1), el);
    if (a0 === 'codes') return codesView(el);
    if (a0 === 'setup') return setupView(el);
    if (a0) return detail(a0, el);
    return list(el);
  };

  // ---------- the list ----------
  async function list(el) {
    const rows = must(await Z.sb.from('alerts').select('id,code,purpose,areas,hubs,recipients,status,created_at,created_by,approved_at,sent_at,est_cost_kes').order('created_at', { ascending: false }).limit(100));
    const group = (st) => rows.filter((r) => st.includes(r.status));
    const where = (r) => (r.hubs || []).length ? r.hubs.map(hubName).join(', ') : (r.areas || []).length ? r.areas.map(Z.areaName).join(', ') : 'Same people as before';
    const item = (r) => `<a class="item" href="#alerts/${r.id}"><div class="grow"><div class="t"><b>${Z.esc(r.code)}</b> · ${Z.esc(where(r))}</div>
      <div class="m">${Z.fmt(r.recipients)} people · ${Z.when(r.sent_at || r.approved_at || r.created_at)}${r.created_by ? ' · by ' + Z.esc(Z.personName(r.created_by) || 'office') : ''}</div></div>${pill(STATUS[r.status] || [r.status, ''])}</a>`;
    const sec = (title, l, empty, id) => `<h3>${title}</h3><div class="card list" id="${id}">${l.length ? l.map(item).join('') : `<div class="empty">${empty}</div>`}</div>`;
    el.innerHTML = `<h2>📣 Alerts</h2>${subtabs('')}
      <p class="hint" style="margin-top:0">One message to many customers: an outage, planned work, a power cut, an offer. The office writes it, a partner says yes, then it goes out. Zuri never sends anything by itself.</p>
      <div class="row" id="al-quick" style="margin-bottom:8px">${['OUT', 'FIX', 'MAINT', 'POWER'].map((c) => `<a class="btn sec small" href="#alerts/new/${c}">${c === 'OUT' ? '📡' : c === 'FIX' ? '✅' : c === 'MAINT' ? '🛠️' : '⚡'} ${c}</a>`).join('')}<a class="btn small" href="#alerts/new">＋ New alert</a></div>
      ${sec('Waiting for a partner', group(['draft']), 'Nothing waiting.', 'al-l-wait')}
      ${sec('Ready to send', group(['approved']), 'Nothing approved and unsent.', 'al-l-ready')}
      ${sec('Sent and cancelled', group(['sent', 'cancelled']).slice(0, 30), 'No alerts yet.', 'al-l-done')}`;
  }

  // ---------- write one ----------
  async function compose(args, el) {
    const o = argsOf(args.slice(1));
    const [all, people, prefs, cfg] = await Promise.all([codes(), everyone(), prefsMap(), setup()]);
    const live = all.filter((c) => c.active);
    let code = live.find((c) => c.code === String(args[0] || '').toUpperCase()) || null;
    const parent = o.parent ? must(await Z.sb.from('alerts').select('*').eq('id', o.parent).maybeSingle()) : null;
    const areas = Z.ref.areas.filter((a) => a.active);
    const t = { mode: parent ? 'same' : o.hub ? 'hub' : 'area', areas: o.area ? [o.area] : Z.area ? [Z.area] : [], hubs: o.hub ? [o.hub] : [], statuses: ['active'], plans: [], within: null, phone2: false, parent };
    const blanks = {};
    const plans = [...new Set(people.map((c) => c.plan).filter(Boolean))].sort();
    let channel = 'sms';

    const draw = () => {
      if (!code) {
        el.innerHTML = `<h2>📣 New alert</h2>${subtabs('new')}<p class="hint" style="margin-top:0">Which message?</p>
          <div class="card list">${live.map((c) => `<a class="item" href="#alerts/new/${c.code}${args.slice(1).length ? '/' + args.slice(1).join('/') : ''}"><div class="grow"><div class="t"><b>${Z.esc(c.code)}</b> · ${Z.esc(c.name)}</div><div class="m">${Z.esc(c.hint || c.msg_en)}</div></div>${pill(PURPOSE[c.purpose])}</a>`).join('')}</div>`;
        return;
      }
      const bl = blanksIn(code);
      const wordsEn = fill(code.msg_en, blanks), wordsSw = fill(code.msg_sw, swOf(blanks));
      const res = audience(t, code.purpose, people, prefs);
      const sample = res.pick[0];
      const prev = (lang) => { const c = sample ? { ...sample.c, lang } : { full_name: 'Grace Njeri', area: t.areas[0] || 'A', account_no: 'ZA-0101', lang }; return wordsFor({ message_en: wordsEn, message_sw: wordsSw }, c, sample ? sample.zone : null); };
      const pEn = prev('en'), pSw = prev('sw');
      const nSw = res.pick.filter((x) => x.c.lang !== 'en').length, nEn = res.pick.length - nSw, msgs = res.pick.reduce((s, x) => s + x.phones.length, 0);
      const parts = Math.max(smsParts(pEn), smsParts(pSw)), cost = cfg.sms_price_kes && channel !== 'whatsapp' ? msgs * parts * Number(cfg.sms_price_kes) : null;
      const missing = [...new Set(left(wordsEn).concat(left(wordsSw)))];
      const servingHubs = hubs().filter((h) => SERVING.includes(h.kind) || h.kind === 'olt');
      el.innerHTML = `<p style="margin:0 0 6px"><a class="back" href="#alerts">← Alerts</a></p>
        <h2>📣 ${Z.esc(code.code)} · ${Z.esc(code.name)} ${pill(PURPOSE[code.purpose])}</h2>
        ${code.hint ? `<p class="hint" style="margin-top:0">${Z.esc(code.hint)}</p>` : ''}
        ${parent ? `<div class="alert ok">Going to the same <b>${Z.fmt((parent.recipient_ids || []).length)}</b> people who got <b>${Z.esc(parent.code)}</b> on ${Z.when(parent.sent_at || parent.created_at)}.</div>` : `
        <div class="card" id="al-who"><b>Who gets it</b>
          <div class="seg" style="margin:8px 0" id="al-mode"><a href="javascript:void 0" data-m="area" class="${t.mode === 'area' ? 'on' : ''}">By area</a><a href="javascript:void 0" data-m="hub" class="${t.mode === 'hub' ? 'on' : ''}">By cabinet / tower</a></div>
          ${t.mode === 'area' ? `<div class="chips" id="al-areas">${areas.map((a) => `<button type="button" data-a="${Z.esc(a.code)}" class="${t.areas.includes(a.code) ? 'on' : ''}">${Z.esc(a.name)}</button>`).join('')}</div>`
            : `<div class="chips" id="al-hubs">${servingHubs.map((h) => `<button type="button" data-h="${Z.esc(h.id)}" class="${t.hubs.includes(String(h.id)) ? 'on' : ''}">${kindIcon(h.kind)} ${Z.esc(h.name)}${h.area ? ' · ' + Z.esc(Z.areaName(h.area)) : ''}</button>`).join('') || '<span class="hint">No cabinets or towers yet. Add them in Admin → Company &amp; hubs.</span>'}</div>
              <p class="hint" style="margin:6px 0 0">Homes go to the cabinet the office set on the customer page, or else the nearest one. Pick the OLT to reach everyone behind it.</p>`}
          <div class="chips" id="al-st" style="margin-top:8px">${CUST_STATUSES.map(([k, n]) => `<button type="button" data-s="${k}" class="${t.statuses.includes(k) ? 'on' : ''}">${n}</button>`).join('')}</div>
          ${code.purpose === 'offer' && plans.length ? `<div style="margin-top:8px"><label>Only these packages (none picked = every package)</label><div class="chips" id="al-plans">${plans.map((p) => `<button type="button" data-p="${Z.esc(p)}" class="${t.plans.includes(p) ? 'on' : ''}">${Z.esc(p)}</button>`).join('')}</div></div>` : ''}
          ${code.purpose === 'reminder' ? `<div style="margin-top:8px"><label for="al-within">Only packages ending within (days)</label><input id="al-within" type="number" min="0" max="60" value="${t.within ?? ''}" style="max-width:120px"></div>` : ''}
          <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="al-p2" ${t.phone2 ? 'checked' : ''} style="width:auto"> Also send to second phone numbers</label>
        </div>`}
        ${bl.length ? `<div class="card" id="al-fill"><b>Fill in</b><div class="grid2" style="margin-top:6px">${bl.map((k) => ['', '_sw'].map((sx) => `<div><label for="al-b-${k}${sx}">${sx ? '🇰🇪 Kiswahili <span class="hint" style="margin:0">(if different)</span>' : BLANKS[k][0]}</label>${k === 'message' ? `<textarea id="al-b-${k}${sx}" data-b="${k}${sx}" placeholder="${Z.esc(sx ? '' : BLANKS[k][1])}">${Z.esc(blanks[k + sx] || '')}</textarea>` : `<input id="al-b-${k}${sx}" data-b="${k}${sx}" placeholder="${Z.esc(sx ? SW_HINT[k] || '' : BLANKS[k][1])}" value="${Z.esc(blanks[k + sx] || '')}">`}</div>`).join('')).join('')}</div></div>` : ''}
        <div class="card" id="al-read"><b>What they'll read</b> <span class="hint">(${sample ? 'for ' + Z.esc(sample.c.full_name) : 'example'})</span>
          <div style="margin-top:6px"><div class="hint" style="margin:0">🇰🇪 Kiswahili · ${pSw.length} letters · ${smsParts(pSw)} SMS</div><div class="card" style="background:var(--surface-2);margin:4px 0;font-weight:500;white-space:pre-wrap">${Z.esc(pSw)}</div>
          <div class="hint" style="margin:0">🇬🇧 English · ${pEn.length} letters · ${smsParts(pEn)} SMS</div><div class="card" style="background:var(--surface-2);margin:4px 0;font-weight:500;white-space:pre-wrap">${Z.esc(pEn)}</div></div>
          <div class="row" style="margin-top:6px"><label for="al-ch" style="margin:0">Send by</label><select id="al-ch" style="width:auto">${Z.opts([['sms', 'SMS'], ['whatsapp', 'WhatsApp'], ['both', 'SMS and WhatsApp']], channel)}</select></div>
        </div>
        <div class="card" id="al-sum" style="border-left:5px solid var(--brand)">
          <div style="font-size:18px;font-weight:800">${Z.fmt(res.pick.length)} customer${res.pick.length === 1 ? '' : 's'} · ${Z.fmt(msgs)} phone${msgs === 1 ? '' : 's'}</div>
          <div class="hint" style="margin:2px 0 0">Kiswahili ${Z.fmt(nSw)} · English ${Z.fmt(nEn)}${res.skip.no ? ` · ${Z.fmt(res.skip.no)} said no to ${code.purpose === 'offer' ? 'offers (or never said yes)' : 'these messages'}` : ''}${res.skip.nophone ? ` · ${Z.fmt(res.skip.nophone)} with no phone` : ''}${res.skip.dup ? ` · ${Z.fmt(res.skip.dup)} sharing a phone` : ''}</div>
          ${channel !== 'whatsapp' ? `<div class="hint" style="margin:2px 0 0">${cost != null ? `About <b>${Z.kes(cost)}</b> in SMS (${Z.fmt(msgs * parts)} SMS × KES ${Z.esc(cfg.sms_price_kes)}).` : 'Set the SMS price in Alerts → Settings to see the cost.'}</div>` : ''}
          ${code.purpose === 'offer' && quiet(cfg) ? `<div class="alert warn" style="margin:6px 0 0">It's quiet hours (${Z.esc(cfg.quiet_from)}–${Z.esc(cfg.quiet_to)}). Offers wait until morning.</div>` : ''}
          ${res.skip.unknown.length ? `<div class="alert warn" style="margin:6px 0 0">${Z.fmt(res.skip.unknown.length)} home${res.skip.unknown.length === 1 ? '' : 's'} in these areas have no map pin and no cabinet set, so they are left out: ${res.skip.unknown.slice(0, 5).map((c) => `<a href="#customers/${c.id}">${Z.esc(c.full_name)}</a>`).join(', ')}${res.skip.unknown.length > 5 ? '…' : ''}. Set their cabinet on the customer page, or send by area.</div>` : ''}
          ${missing.length ? `<div class="alert warn" style="margin:6px 0 0">Fill in: ${missing.map((k) => BLANKS[k][0]).join(', ')}.</div>` : ''}
          <div class="row" style="margin-top:8px"><button class="btn" id="al-save" ${!res.pick.length || missing.length ? 'disabled' : ''}>${Z.isAdmin() ? '✅ Save and approve' : '📨 Ask a partner for a yes'}</button>${Z.isAdmin() ? '<button class="btn sec" id="al-draft">Save as draft</button>' : ''}</div>
        </div>`;

      // wiring
      Z.$$('#al-mode a', el).forEach((a) => (a.onclick = () => { t.mode = a.dataset.m; draw(); }));
      Z.$$('#al-areas button', el).forEach((b) => (b.onclick = () => { const k = b.dataset.a; t.areas = t.areas.includes(k) ? t.areas.filter((x) => x !== k) : t.areas.concat(k); draw(); }));
      Z.$$('#al-hubs button', el).forEach((b) => (b.onclick = () => { const k = b.dataset.h; t.hubs = t.hubs.includes(k) ? t.hubs.filter((x) => x !== k) : t.hubs.concat(k); draw(); }));
      Z.$$('#al-st button', el).forEach((b) => (b.onclick = () => { const k = b.dataset.s; t.statuses = t.statuses.includes(k) ? t.statuses.filter((x) => x !== k) : t.statuses.concat(k); draw(); }));
      Z.$$('#al-plans button', el).forEach((b) => (b.onclick = () => { const k = b.dataset.p; t.plans = t.plans.includes(k) ? t.plans.filter((x) => x !== k) : t.plans.concat(k); draw(); }));
      const w = Z.$('#al-within', el); if (w) w.onchange = () => { t.within = w.value === '' ? null : Number(w.value); draw(); };
      const p2 = Z.$('#al-p2', el); if (p2) p2.onchange = () => { t.phone2 = p2.checked; draw(); };
      Z.$('#al-ch', el).onchange = (e) => { channel = e.target.value; draw(); };
      Z.$$('[data-b]', el).forEach((i) => (i.onchange = () => { blanks[i.dataset.b] = i.value.trim(); draw(); }));
      const save = async (approve, b) => {
        Z.$$('[data-b]', el).forEach((i) => (blanks[i.dataset.b] = i.value.trim()));
        const en = fill(code.msg_en, blanks), sw = fill(code.msg_sw, swOf(blanks));
        if (left(en).length || left(sw).length) { Z.toast('Fill in every box first.'); return draw(); }
        const r = audience(t, code.purpose, people, prefs);
        const msgsN = r.pick.reduce((s, x) => s + x.phones.length, 0);
        const row = { id: Z.uuid(), code: code.code, purpose: code.purpose, areas: t.mode === 'area' ? t.areas : t.mode === 'same' ? (parent.areas || []) : [], hubs: t.mode === 'hub' ? t.hubs.map(String) : t.mode === 'same' ? (parent.hubs || []).map(String) : [],
          filters: { statuses: t.statuses, plans: t.plans, within: t.within, phone2: t.phone2, mode: t.mode }, blanks, message_en: en, message_sw: sw,
          recipients: r.pick.length, recipient_ids: r.pick.map((x) => String(x.c.id)), est_cost_kes: cfg.sms_price_kes && channel !== 'whatsapp' ? msgsN * parts * Number(cfg.sms_price_kes) : null,
          outage_id: o.outage || null, parent_id: parent ? parent.id : null, channel, status: 'draft', created_by: Z.me.id };
        b.disabled = true;
        const { error } = await Z.sb.from('alerts').insert(row);
        if (error) { b.disabled = false; return Z.fail(error); }
        if (approve) { const e2 = (await Z.sb.from('alerts').update({ status: 'approved', approved_by: Z.me.id, approved_at: new Date().toISOString() }).eq('id', row.id)).error; if (e2) Z.fail(e2); }
        Z.toast(approve ? 'Approved. Now send it.' : Z.isAdmin() ? 'Saved as a draft.' : 'Sent to the partners for a yes.');
        Z.go('alerts/' + row.id);
      };
      const sb = Z.$('#al-save', el); if (sb) sb.onclick = () => save(Z.isAdmin(), sb);
      const db = Z.$('#al-draft', el); if (db) db.onclick = () => save(false, db);
    };
    draw();
  }

  // ---------- one alert ----------
  async function detail(id, el) {
    const a = must(await Z.sb.from('alerts').select('*').eq('id', id).maybeSingle());
    if (!a) { el.innerHTML = '<div class="card">This alert isn\'t here.</div>'; return; }
    const [all, cfg, kids] = await Promise.all([codes(), setup(), Z.sb.from('alerts').select('id,code,status').eq('parent_id', a.id)]);
    const code = all.find((c) => c.code === a.code) || { name: a.code };
    const follow = code.follow_up && all.find((c) => c.code === code.follow_up && c.active);
    const followDone = (kids.data || []).some((k) => k.code === (follow || {}).code && k.status !== 'cancelled');
    const where = ((a.hubs || []).length ? a.hubs.map(hubName).join(', ') : (a.areas || []).length ? a.areas.map(Z.areaName).join(', ') : 'the chosen customers') + (a.parent_id ? ' (the same people as before)' : '');
    const people = async () => {
      const ids = new Set((a.recipient_ids || []).map(String));
      const [list, prefs] = await Promise.all([everyone(), prefsMap()]);
      const hubSet = new Set((a.hubs || []).map(String));
      return list.filter((c) => ids.has(String(c.id))).map((c) => {
        const p = prefs.get(String(c.id)), s = hubSet.size ? servedBy(c, p) : null;
        const zone = s && hubSet.has(s.id) ? hubName(s.id) : hubSet.size ? hubName([...hubSet][0]) : null;
        const cc = { ...c, lang: (p && p.lang) || 'sw' };
        return { c: cc, zone, phones: [c.phone].concat(a.filters && a.filters.phone2 ? [c.phone2] : []).map(Z.phone254).filter((x) => x.length >= 12), text: wordsFor(a, cc, zone) };
      });
    };
    const isOut = a.code === 'OUT' && a.status === 'sent';
    const oneZone = (a.hubs || []).length === 1 ? hubName(a.hubs[0]) : (a.areas || []).length === 1 ? Z.areaName(a.areas[0]) : null;
    const shown = (t) => fill(t, { company: company(), support: support(), ...(oneZone ? { zone: oneZone } : {}) });
    el.innerHTML = `<p style="margin:0 0 6px"><a class="back" href="#alerts">← Alerts</a></p>
      <div class="row" style="justify-content:space-between"><h2 style="margin-bottom:2px">📣 ${Z.esc(a.code)} · ${Z.esc(code.name)}</h2>${pill(STATUS[a.status] || [a.status, ''])}</div>
      <p class="hint" style="margin-top:0">To ${Z.esc(where)} · <b>${Z.fmt(a.recipients)}</b> customers · by ${Z.esc(a.channel === 'both' ? 'SMS and WhatsApp' : a.channel === 'whatsapp' ? 'WhatsApp' : 'SMS')}${a.est_cost_kes != null ? ' · about ' + Z.kes(a.est_cost_kes) : ''}</p>
      <div class="card"><div class="hint" style="margin:0">🇰🇪 Kiswahili</div><div class="card" style="background:var(--surface-2);margin:4px 0;font-weight:500;white-space:pre-wrap" id="al-sw">${Z.esc(shown(a.message_sw))}</div>
        <div class="hint" style="margin:0">🇬🇧 English</div><div class="card" style="background:var(--surface-2);margin:4px 0;font-weight:500;white-space:pre-wrap" id="al-en">${Z.esc(shown(a.message_en))}</div>
        <p class="hint" style="margin:4px 0 0">Anything still in {curly brackets} fills in for each customer.</p></div>
      <div class="card timeline" id="al-tl">
        <div class="ev">✍️ Written by ${Z.esc(Z.personName(a.created_by) || 'the office')} <span class="m">${Z.when(a.created_at)}</span></div>
        ${a.approved_at ? `<div class="ev">✅ Approved by ${Z.esc(Z.personName(a.approved_by) || 'a partner')} <span class="m">${Z.when(a.approved_at)}</span></div>` : ''}
        ${a.sent_at ? `<div class="ev">📤 Sent by ${Z.esc(Z.personName(a.sent_by) || 'the office')} (${Z.esc(a.sent_how === 'server' ? 'Daraja server' : a.sent_how === 'copied' ? 'copied into WhatsApp' : 'bulk-SMS list')}) <span class="m">${Z.when(a.sent_at)}</span>${a.delivered != null ? ` · ${Z.fmt(a.delivered)} delivered, ${Z.fmt(a.failed || 0)} failed` : ''}</div>` : ''}
        ${a.status === 'cancelled' ? '<div class="ev">✖ Cancelled</div>' : ''}
      </div>
      <div id="al-act"></div>
      ${isOut && follow && !followDone ? `<div class="card" id="al-fix" style="border-left:5px solid var(--ok)"><b>Service back?</b><p class="hint" style="margin:2px 0 6px">Tell exactly these ${Z.fmt(a.recipients)} people.</p><a class="btn" href="#alerts/new/${follow.code}/parent:${a.id}">✅ Send ${Z.esc(follow.code)} to the same people</a></div>` : ''}
      <details class="card" id="al-ppl"><summary><b>The people</b> (${Z.fmt(a.recipients)})</summary><div id="al-people" class="list" style="margin-top:6px"><div class="loading">Loading…</div></div></details>`;

    const act = Z.$('#al-act', el);
    if (a.status === 'draft') {
      act.innerHTML = Z.isAdmin()
        ? `<div class="card" style="border-left:5px solid var(--warn)"><b>Your yes?</b><p class="hint" style="margin:2px 0 6px">Read both languages. After your yes the words can't change.</p><div class="row"><button class="btn" id="al-yes">✅ Yes, approve</button><button class="btn sec" id="al-no">✖ Cancel it</button></div></div>`
        : `<div class="card"><b>Waiting for a partner's yes.</b><p class="hint" style="margin:2px 0 6px">Call a partner if it's urgent. They approve it here, in 📣 Alerts.</p><button class="btn sec small" id="al-no">✖ Cancel it</button></div>`;
    } else if (a.status === 'approved') {
      const over = a.purpose === 'offer' && quiet(cfg);
      act.innerHTML = `<div class="card" style="border-left:5px solid var(--brand)"><b>Send it</b>
        ${over ? `<div class="alert warn" style="margin:6px 0">Quiet hours (${Z.esc(cfg.quiet_from)}–${Z.esc(cfg.quiet_to)}): send offers in the morning.</div>` : ''}
        ${cfg.server_on ? '<p class="hint">The Daraja server is switched on, but sending from here arrives with it. For now use the list.</p>' : ''}
        <ol class="hint" style="margin:6px 0 8px;padding-left:20px"><li><b>SMS:</b> download the list and upload it to the bulk-SMS website. Each row has the customer's own words.</li><li><b>WhatsApp:</b> copy the words into the broadcast list for the area.</li><li>Then tap <b>It went out</b>.</li></ol>
        <div class="row" id="al-send"><button class="btn" id="al-csv">📥 Download the list (CSV)</button><button class="btn sec" id="al-copy">📋 Copy the Kiswahili words</button><button class="btn sec" id="al-copy-en">📋 English</button><button class="btn sec" id="al-nums">📋 Copy the numbers</button></div>
        <div class="row" style="margin-top:8px"><button class="btn" id="al-sent">✅ It went out</button>${Z.isAdmin() ? '<button class="btn sec" id="al-no">✖ Cancel it</button>' : ''}</div></div>`;
    }
    const set = async (patch, msg, b) => {
      if (b) b.disabled = true;
      const { error } = await Z.sb.from('alerts').update(patch).eq('id', a.id);
      if (error) { if (b) b.disabled = false; return Z.fail(error); }
      Z.toast(msg); Z.route();
    };
    const yes = Z.$('#al-yes', el); if (yes) yes.onclick = () => set({ status: 'approved', approved_by: Z.me.id, approved_at: new Date().toISOString() }, 'Approved. The office can send it now.', yes);
    const ask = (q) => window.ZP_LESSON || confirm(q);
    const no = Z.$('#al-no', el); if (no) no.onclick = () => { if (ask('Cancel this alert? It stays in the history.')) set({ status: 'cancelled' }, 'Cancelled.', no); };
    let how = null;
    const sent = Z.$('#al-sent', el); if (sent) sent.onclick = () => { if (ask(`Did the ${Z.fmt(a.recipients)} messages go out?`)) set({ status: 'sent', sent_how: how || 'export', sent_by: Z.me.id, sent_at: new Date().toISOString() }, 'Marked as sent.', sent); };
    const copy = (t, m) => (window.ZP_LESSON ? Promise.resolve() : navigator.clipboard.writeText(t)).then(() => Z.toast(m), () => Z.toast('Press and hold the words to copy them.'));
    const c1 = Z.$('#al-copy', el); if (c1) c1.onclick = () => { how = how || 'copied'; copy(Z.$('#al-sw', el).textContent, 'Copied. Fill in {name}/{zone} if WhatsApp needs it, or use the list.'); };
    const c2 = Z.$('#al-copy-en', el); if (c2) c2.onclick = () => { how = how || 'copied'; copy(Z.$('#al-en', el).textContent, 'Copied.'); };
    const nums = Z.$('#al-nums', el); if (nums) nums.onclick = async () => { const ps = await people(); copy(ps.flatMap((p) => p.phones).join(', '), `Copied ${Z.fmt(ps.reduce((s, p) => s + p.phones.length, 0))} numbers.`); };
    const csv = Z.$('#al-csv', el); if (csv) csv.onclick = async () => {
      csv.disabled = true;
      try {
        const ps = await people();
        const lines = [['phone', 'name', 'account', 'language', 'message'].join(',')].concat(ps.flatMap((p) => p.phones.map((ph) => [ph, p.c.full_name, p.c.account_no || '', p.c.lang === 'en' ? 'English' : 'Kiswahili', p.text].map(csvCell).join(','))));
        download(`zuri-${a.code.toLowerCase()}-${Z.ymd()}.csv`, lines.join('\r\n'));
        how = 'export';
        Z.toast(`${Z.fmt(lines.length - 1)} rows ready. Upload them to the bulk-SMS website.`);
        if (ps.length !== a.recipients) Z.toast(`${Z.fmt(a.recipients - ps.length)} of the people are no longer on the customer list and were left out.`);
      } catch (e) { Z.fail(e); }
      csv.disabled = false;
    };
    Z.$('details', el).addEventListener('toggle', async (e) => {
      if (!e.target.open || e.target.dataset.done) return; e.target.dataset.done = 1;
      try {
        const ps = await people();
        Z.$('#al-people', el).innerHTML = ps.slice(0, 300).map((p) => `<a class="item" href="#customers/${p.c.id}"><div class="grow"><div class="t">${Z.esc(p.c.full_name)}</div><div class="m">${Z.esc(p.phones.join(', '))} · ${p.c.lang === 'en' ? 'English' : 'Kiswahili'}${p.zone ? ' · ' + Z.esc(p.zone) : ' · ' + Z.esc(Z.areaName(p.c.area))}</div></div></a>`).join('') + (ps.length > 300 ? `<div class="empty">…and ${Z.fmt(ps.length - 300)} more (all of them are in the downloaded list).</div>` : '') || '<div class="empty">No one.</div>';
      } catch (er) { Z.$('#al-people', el).innerHTML = `<div class="empty">${Z.esc(Z.errText(er))}</div>`; }
    });
  }

  // ---------- the ready-made messages ----------
  async function codesView(el) {
    const all = await codes();
    const can = Z.isAdmin();
    el.innerHTML = `<h2>📣 Messages</h2>${subtabs('codes')}
      <p class="hint" style="margin-top:0">The ready-made alerts. Words in {curly brackets} fill themselves in: {company} {zone} {name} {account_no} {paid_until} {plan} {pay} {support}. These are typed by the sender: ${Object.keys(BLANKS).map((k) => '{' + k + '}').join(' ')}.${can ? '' : ' Only a partner can change the words.'}</p>
      <div class="hint">⚠️ The Kiswahili is a first draft. A Swahili-speaking partner should read every message before real customers get it.</div>
      ${all.map((c) => `<form class="card" data-code="${Z.esc(c.code)}">
        <div class="row" style="justify-content:space-between"><b style="font-size:16px">${Z.esc(c.code)}</b><span>${pill(PURPOSE[c.purpose])} ${c.active ? '<span class="pill ok">on</span>' : '<span class="pill">off</span>'}</span></div>
        <div class="grid2"><div><label>Name</label><input name="name" value="${Z.esc(c.name)}" ${can ? '' : 'disabled'}></div>
          <div><label>Kind</label><select name="purpose" ${can ? '' : 'disabled'}>${Z.opts([['service', 'Service (outages, work)'], ['reminder', 'Reminder (payments)'], ['offer', 'Offer (needs their yes)']], c.purpose)}</select></div></div>
        <label>Kiswahili</label><textarea name="msg_sw" ${can ? '' : 'disabled'}>${Z.esc(c.msg_sw)}</textarea>
        <label>English</label><textarea name="msg_en" ${can ? '' : 'disabled'}>${Z.esc(c.msg_en)}</textarea>
        <label>Note for the office</label><input name="hint" value="${Z.esc(c.hint || '')}" ${can ? '' : 'disabled'}>
        ${can ? `<div class="row" style="margin-top:6px"><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" name="active" ${c.active ? 'checked' : ''} style="width:auto"> On</label><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" name="urgent" ${c.urgent ? 'checked' : ''} style="width:auto"> Urgent (may go out at night)</label><button class="btn small">Save</button></div>` : ''}
      </form>`).join('')}
      ${can ? `<form class="card" id="al-newcode"><b>＋ A new message</b><div class="grid3"><div><label>Code (capitals)</label><input name="code" required pattern="[A-Z][A-Z0-9_]{1,15}" placeholder="e.g. ROUTER"></div><div><label>Name</label><input name="name" required></div>
        <div><label>Kind</label><select name="purpose">${Z.opts([['service', 'Service'], ['reminder', 'Reminder'], ['offer', 'Offer']])}</select></div></div>
        <label>Kiswahili</label><textarea name="msg_sw" required>{company}: </textarea><label>English</label><textarea name="msg_en" required>{company}: </textarea><button class="btn small" style="margin-top:6px">Add</button></form>` : ''}`;
    if (!can) return;
    Z.$$('form[data-code]', el).forEach((f) => (f.onsubmit = async (e) => {
      e.preventDefault(); const d = Z.formData(f);
      const { error } = await Z.sb.from('alert_codes').update({ name: d.name.trim(), purpose: d.purpose, msg_sw: d.msg_sw.trim(), msg_en: d.msg_en.trim(), hint: d.hint.trim() || null, active: !!d.active, urgent: !!d.urgent }).eq('code', f.dataset.code);
      if (error) return Z.fail(error); Z.toast('Saved.'); Z.route();
    }));
    Z.$('#al-newcode', el).onsubmit = async (e) => {
      e.preventDefault(); const d = Z.formData(e.target); const code = d.code.trim().toUpperCase();
      if (!/^[A-Z][A-Z0-9_]{1,15}$/.test(code)) return Z.toast('A code is 2–16 capital letters or numbers, starting with a letter.');
      const { error } = await Z.sb.from('alert_codes').insert({ ...(Z.practice ? { id: code } : {}), code, name: d.name.trim(), purpose: d.purpose, msg_sw: d.msg_sw.trim(), msg_en: d.msg_en.trim(), sort: 200, active: true, urgent: false });
      if (error) return Z.toast(/duplicate|unique/i.test(error.message) ? 'That code already exists.' : Z.errText(error));
      Z.toast('Added.'); Z.route();
    };
  }

  // ---------- settings ----------
  async function setupView(el) {
    if (!Z.isAdmin()) { el.innerHTML = '<div class="card">Only partners can change the alert settings.</div>'; return; }
    const s = await setup();
    el.innerHTML = `<h2>📣 Alert settings</h2>${subtabs('setup')}
      <form class="card" id="al-set"><div class="grid2">
        <div><label>Price of one SMS (KES)</label><input name="sms_price_kes" inputmode="decimal" value="${Z.esc(s.sms_price_kes ?? '')}" placeholder="from your bulk-SMS bill"></div>
        <div><label>Sender name on the SMS</label><input name="sender_id" value="${Z.esc(s.sender_id || '')}" placeholder="e.g. ZURIFIBER (registered with the SMS company)"></div>
        <div><label>Quiet hours from</label><input name="quiet_from" type="time" value="${Z.esc(s.quiet_from)}"></div>
        <div><label>Quiet hours until</label><input name="quiet_to" type="time" value="${Z.esc(s.quiet_to)}"></div></div>
        <p class="hint">Offers never go out in quiet hours (Kenyan rules allow promotional SMS only 7am–7pm, so keep 19:00–07:00 or longer). Urgent alerts (outage, service back, power cut) may.</p>
        <button class="btn">Save</button></form>`;
    Z.$('#al-set', el).onsubmit = async (e) => {
      e.preventDefault(); const d = Z.formData(e.target);
      const v = { ...s, sms_price_kes: Z.num(d.sms_price_kes), sender_id: d.sender_id.trim() || null, quiet_from: d.quiet_from || '19:00', quiet_to: d.quiet_to || '07:00' };
      const { error } = await Z.sb.from('settings').upsert({ key: 'alerts_setup', value: v }, { onConflict: 'key' });
      if (error) return Z.fail(error); Z.toast('Saved.'); Z.route();
    };
  }

  // ---------- for the training videos: make an alert the way the screens do (practice only) ----------
  // Z.alertMake({ code: 'OUT', areas: ['B'] | hubs: [id] | parent: id, blanks: {...}, status: 'draft'|'approved'|'sent' }) → id
  Z.alertMake = async (o) => {
    if (!Z.practice) throw new Error('Only in practice.');
    const all = await codes(), code = all.find((c) => c.code === o.code);
    const [people, prefs] = await Promise.all([everyone(), prefsMap()]);
    const parent = o.parent ? must(await Z.sb.from('alerts').select('*').eq('id', o.parent).maybeSingle()) : null;
    const t = { mode: parent ? 'same' : (o.hubs || []).length ? 'hub' : 'area', areas: o.areas || [], hubs: (o.hubs || []).map(String), statuses: ['active'], plans: [], within: null, phone2: false, parent };
    const blanks = o.blanks || {}, r = audience(t, code.purpose, people, prefs);
    const row = { id: Z.uuid(), code: code.code, purpose: code.purpose, areas: parent ? parent.areas || [] : t.areas, hubs: parent ? (parent.hubs || []) : t.hubs, filters: { statuses: t.statuses, mode: t.mode },
      blanks, message_en: fill(code.msg_en, blanks), message_sw: fill(code.msg_sw, swOf(blanks)), recipients: r.pick.length, recipient_ids: r.pick.map((x) => String(x.c.id)),
      parent_id: parent ? parent.id : null, channel: 'sms', status: 'draft', created_by: o.by || 'p-mary', created_at: new Date(Date.now() - (o.minsAgo || 10) * 60e3).toISOString() };
    must(await Z.sb.from('alerts').insert(row));
    const now = new Date().toISOString();
    if (o.status === 'approved' || o.status === 'sent') must(await Z.sb.from('alerts').update({ status: 'approved', approved_by: 'p-jerry', approved_at: now }).eq('id', row.id));
    if (o.status === 'sent') must(await Z.sb.from('alerts').update({ status: 'sent', sent_how: 'export', sent_by: 'p-mary', sent_at: now }).eq('id', row.id));
    return row.id;
  };

  // ---------- on the customer page ----------
  Z.alertPrefsBox = async (box, c) => {
    if (!box || !Z.isOffice() || !(await Z.alertsOk())) return;
    let p = null;
    try { p = must(await Z.sb.from('customer_alert_prefs').select('*').eq('customer_id', c.id).maybeSingle()); } catch (e) { return; }
    if (!box.isConnected) return;
    const v = { served_by_hub: '', lang: 'sw', ok_service: true, ok_reminders: true, ok_offers: false, consent_note: '', ...(p || {}) };
    const serving = hubs().filter((h) => SERVING.includes(h.kind));
    const near = c.lat != null && Z.nearestHub ? Z.nearestHub(c.lat, c.lng, serving.filter((h) => !h.area || h.area === c.area).length ? serving.filter((h) => !h.area || h.area === c.area) : serving) : null;
    const dist = (d) => (d < 1 ? Math.round(d * 1000) + ' m' : d.toFixed(1) + ' km');
    box.innerHTML = `<h3>📣 Messages</h3><form class="card" id="cap-f">
      <div class="grid2"><div><label>Wired to (cabinet / tower)</label><select name="served_by_hub"><option value="">${near ? 'Nearest: ' + Z.esc(near.h.name) + ' (' + dist(near.d) + ')' : 'Not set'}</option>${Z.opts(serving.map((h) => [h.id, kindIcon(h.kind) + ' ' + h.name]), v.served_by_hub || '')}</select></div>
        <div><label>Language for messages</label><select name="lang">${Z.opts([['sw', 'Kiswahili'], ['en', 'English']], v.lang)}</select></div></div>
      <div style="margin:8px 0;display:grid;gap:4px">
        <label style="display:flex;gap:8px;align-items:center;margin:0"><input type="checkbox" name="ok_service" ${v.ok_service ? 'checked' : ''} style="width:auto"> Outages and planned work</label>
        <label style="display:flex;gap:8px;align-items:center;margin:0"><input type="checkbox" name="ok_reminders" ${v.ok_reminders ? 'checked' : ''} style="width:auto"> Payment reminders</label>
        <label style="display:flex;gap:8px;align-items:center;margin:0"><input type="checkbox" name="ok_offers" ${v.ok_offers ? 'checked' : ''} style="width:auto"> Offers and upgrades <span class="hint" style="margin:0">(only if they said yes)</span></label></div>
      <label>How and when they said yes or no</label><input name="consent_note" value="${Z.esc(v.consent_note || '')}" placeholder="e.g. Said yes to offers on the phone, 16 Oct">
      <button class="btn small" style="margin-top:6px">Save</button></form>`;
    Z.$('#cap-f', box).onsubmit = async (e) => {
      e.preventDefault(); const d = Z.formData(e.target);
      const row = { customer_id: c.id, served_by_hub: d.served_by_hub || null, lang: d.lang, ok_service: !!d.ok_service, ok_reminders: !!d.ok_reminders, ok_offers: !!d.ok_offers, consent_note: d.consent_note.trim() || null };
      if (row.ok_offers && !(v.ok_offers) && !row.consent_note) return Z.toast('Write how and when they said yes to offers.');
      const { error } = await Z.sb.from('customer_alert_prefs').upsert(row, { onConflict: 'customer_id' });
      if (error) return Z.fail(error); Z.toast('Saved.');
    };
  };

  // ---------- on the job page: the tech says which cabinet the home is wired to ----------
  Z.alertCabinetBox = async (box, c) => {
    if (!box || !navigator.onLine || !(await Z.alertsOk())) return;
    let p = null;
    try { p = must(await Z.sb.from('customer_alert_prefs').select('customer_id,served_by_hub').eq('customer_id', c.id).maybeSingle()); } catch (e) { return; }
    if (!box.isConnected) return;
    const serving = hubs().filter((h) => SERVING.includes(h.kind));
    if (!serving.length) return;
    const near = c.lat != null && Z.nearestHub ? Z.nearestHub(c.lat, c.lng, serving) : null;
    box.innerHTML = `<h3>📣 Wired to</h3><div class="card"><div class="row" style="align-items:end"><div class="grow"><label for="jd-cab-s">Which cabinet or tower is this home connected to?</label>
      <select id="jd-cab-s"><option value="">${near ? 'Not sure (nearest: ' + Z.esc(near.h.name) + ')' : 'Not sure'}</option>${Z.opts(serving.map((h) => [h.id, kindIcon(h.kind) + ' ' + h.name]), p && p.served_by_hub ? p.served_by_hub : '')}</select></div>
      <button class="btn sec" id="jd-cab-ok" type="button">Save</button></div><p class="hint" style="margin:4px 0 0">So an outage message reaches the right homes.</p></div>`;
    Z.$('#jd-cab-ok', box).onclick = async (e) => {
      const v = Z.$('#jd-cab-s', box).value || null;
      const { error } = await Z.sb.from('customer_alert_prefs').upsert({ customer_id: c.id, served_by_hub: v }, { onConflict: 'customer_id' });
      if (error) return Z.fail(error); e.target.textContent = '✓ Saved'; Z.toast('Saved.');
    };
  };

  // ---------- on the outage card (timesavers.js) ----------
  Z.alertLink = (o, where) => (!o.local && o.id && Z.isOffice() && where !== 'form' && Z.routes.alerts
    ? `<div class="row" style="margin-top:8px"><a class="btn sec small" href="#alerts/new/OUT/area:${encodeURIComponent(o.area)}/outage:${encodeURIComponent(o.id)}">📣 Text the ${Z.esc(Z.areaName(o.area))} customers</a></div>` : '');

  // ---------- on Home: alerts waiting for a partner ----------
  Z.alertsHome = async (box) => {
    if (!box || !Z.isOffice() || !(await Z.alertsOk())) return;
    let n = 0;
    try { n = must(await Z.sb.from('alerts').select('id').eq('status', Z.isAdmin() ? 'draft' : 'approved')).length; } catch (e) { return; }
    if (!n || !box.isConnected) return;
    box.innerHTML = `<a class="card" href="#alerts" style="display:block;border-left:5px solid var(--warn);text-decoration:none;color:inherit"><b>📣 ${n} alert${n === 1 ? '' : 's'} ${Z.isAdmin() ? 'waiting for your yes' : 'approved and ready to send'}</b></a>`;
  };
})();
