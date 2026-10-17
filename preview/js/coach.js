// Zuri System · 🧪 Test Coach: Business Week challenges inside the app · v1.1 · 2026-10-17
// v1.1 (17 Oct, Jerry: "make sure everything gets tested … let us know if information in fields are correct … give a
//       tester a specific thing … a questionnaire every session"): after "How easy?" the coach asks ✅ Is everything on
//       the screen right? (and, on message steps, did WhatsApp/SMS open with the right number and words); each role has a
//       🎯 special job for the week (business_week.json roles[].focus); and each day ends with 📝 5 quick questions.
// Jerry (15 Oct): testers get each step INSIDE Zuri (no bouncing to the Testers' List), and we learn where they went,
// how long it took and how easy it felt. The Testers' List (testers/?bw) and this coach share the same phone storage:
//   zt_bw_me {name, role} · zt_bw_state {challenge id: 'done'|'fail'} · zt_device · zt_queue (rows waiting for signal).
// On when: the TRAINING copy and this phone has zt_bw_me (set by the tester's link), or practice with ?coach / ?bw.
// ?bw&r=<ROLE>&n=<Name> on the app address sets zt_bw_me, so one link opens Zuri with the coach.
// Rows go to tester_log on the TRAINING database through its own client (never Z.sb), kinds hello/done/undone/note only.
(function () {
  const Z = window.Z;
  if (!Z) return;
  const VER = 'coach v1.1';
  const QS = new URLSearchParams(location.search);
  const ROLES = ['P', 'F', 'C1', 'C2', 'T1', 'T2', 'T3', 'V'];
  const get = (k, d) => { try { const v = localStorage.getItem('zt_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem('zt_' + k, JSON.stringify(v)); } catch (e) {} };
  const esc = (s) => Z.esc(s);

  // ---------- one link sets who this tester is ----------
  (function linkMe() {
    const n = (QS.get('n') || '').trim().replace(/\s+/g, ' ').slice(0, 60), r = (QS.get('r') || '').toUpperCase();
    if (QS.has('bw') && n && ROLES.includes(r)) { set('bw_me', { name: n, role: r }); try { localStorage.removeItem('zt_coach_off'); } catch (e) {} }
  })();
  const asked = QS.has('coach') || QS.has('bw');
  if (asked) { try { localStorage.removeItem('zt_coach_off'); } catch (e) {} }
  const wanted = () => !get('coach_off', false) && ((Z.training && !!get('bw_me', null)) || (Z.practice && asked));
  if (!wanted()) return;

  // ---------- small helpers ----------
  const kenyaDay = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  const dayNo = (bw, ymd) => Math.round((Date.parse(ymd) - Date.parse(bw.start)) / 864e5) + 1;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname) || QS.get('local') === '1';
  const bwStep = (n, role, id) => ('bw:d' + n + ':' + role + ':' + id).slice(0, 60);
  const appV = () => String(Z.version || '').split(' ')[0];
  const rowVer = () => VER + ' · app ' + appV() + (Z.practice ? ' · practice' : '');
  const device = get('device', null) || (() => { const d = 'd' + Math.random().toString(36).slice(2, 10); set('device', d); return d; })();
  // A route as the coverage list knows it: ids, uuids and dates become ':id' / ':date'.
  const norm = (hash) => {
    let raw = String(hash || '').replace(/^#/, '');
    try { raw = decodeURIComponent(raw); } catch (e) {}
    raw = raw.split('?')[0];
    if (/access_token|type=recovery/.test(raw)) return '';
    const parts = raw.split('/').filter((x, i) => i === 0 || x !== '');
    if (!parts[0]) parts[0] = Z.me ? (Z.isOffice() ? 'home' : 'jobs') : 'home';
    return parts.map((p, i) => (i === 0 ? p.toLowerCase() : /^\d{4}-\d{2}(-\d{2})?$/.test(p) ? ':date'
      : /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(p) || (/\d/.test(p) && p.length >= 5) || p.length > 24 ? ':id' : p.toLowerCase())).join('/').slice(0, 60);
  };
  const reached = (route, target) => { if (!target) return false; const t = norm(target); return route === t || route.startsWith(t + '/'); };

  // ---------- the training database, its own quiet client ----------
  // Practice (?coach) is our own testing: rows stay on this phone (zt_coach_dry) unless ?coach=send, so the
  // Business Week board never fills with practice rows. The training copy always sends.
  const live = Z.training || QS.get('coach') === 'send';
  let sbT = null;
  const db = () => {
    if (sbT) return sbT;
    const T = (window.ZURI_CONFIG || {}).training;
    if (!T) return null;
    if (!Z.practice && window.supabase && window.supabase.createClient) {
      sbT = window.supabase.createClient(T.supabaseUrl, T.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'zt-coach-auth' } });
    } else {
      // practice.js replaces window.supabase with its pretend database, so practice talks to the REST address directly.
      sbT = { from: () => ({ insert: async (rows) => {
        const r = await fetch(T.supabaseUrl + '/rest/v1/tester_log', { method: 'POST', headers: { apikey: T.supabaseKey, Authorization: 'Bearer ' + T.supabaseKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
        if (r.ok) return { error: null };
        let e = {}; try { e = await r.json(); } catch (x) {}
        return { error: { message: e.message || 'HTTP ' + r.status, code: e.code } };
      } }) };
    }
    return sbT;
  };
  const online = () => navigator.onLine && !Z.pretendOffline;
  const queue = (rows) => { const q = get('queue', []); set('queue', q.concat(rows)); };
  async function send(rows) {
    if (!live) { set('coach_dry', get('coach_dry', []).concat(rows).slice(-200)); console.info('[coach] practice row (not sent)', rows); return true; }
    const c = db();
    if (!c || !online()) { queue(rows); return false; }
    try {
      const { error } = await c.from('tester_log').insert(rows);
      if (error) {
        if (/check constraint|23514/i.test(String(error.message) + (error.code || ''))) { console.warn('[coach] row refused', error.message); return false; }
        throw error;
      }
      return true;
    } catch (e) { queue(rows); return false; }
  }
  let flushing = false;
  async function flush() {
    if (flushing || !online() || !live) return;
    const q = get('queue', []);
    if (!q.length) return;
    flushing = true;
    set('queue', []); // taken now, so the Testers' List in another tab doesn't send the same rows
    try { await send(q); } finally { flushing = false; }
  }

  // ---------- state ----------
  let bw = null, RL = {}, me = null, today = 0, mine = [], dayObj = null;
  // v2.37 (16 Oct): "Go there" opens the page part of a route ("customers/:id/edit" → "customers"); and a real-world
  //       problem keeps its screen hidden until 💡 Show me how — showing it would give the answer away.
  const goTo = (r) => { const out = []; for (const seg of String(r || '').split('/')) { if (!seg || seg.startsWith(':')) break; out.push(seg); } return out.join('/'); };
  // v2.37 (16 Oct, Jerry: "I think this should run on Feedback Studio. How else will you know about any issues"):
  //       inside Feedback Studio the coach keeps its card short (the studio's talk / point / screenshot bar is below it),
  //       says "✅ Step done" (the studio's own ✅ Done ends the session) and ends the day by pointing at 📨 Send to Claude.
  let inFS = false; try { inFS = window.self !== window.top && /feedback-studio/.test(window.top.location.pathname); } catch (e) { inFS = window.self !== window.top; }
  let ui = { open: get('coach_open', true), mode: 'card', showHint: false, showEnd: false, ease: null, self: null, said: '', right: null, wrong: '', msg: null, focus: false, svLater: false, sv: { good: '', hard: '', wrong: null, what: '', tried: [], broke: '', day: null } };
  const st = () => get('bw_state', {});
  const writeState = (id, v) => { const s = st(); if (v) s[id] = v; else delete s[id]; set('bw_state', s); };
  const meas = () => get('coach_m', {});
  const later = () => { const l = get('coach_later', {}); return l.day === kenyaDay() ? l.ids || [] : []; };
  const setLater = (ids) => set('coach_later', { day: kenyaDay(), ids });

  function current() {
    const s = st();
    const open = mine.filter((c) => !s[c.id]);
    if (!open.length) return null;
    const pick = get('coach_pick', null);
    if (pick && open.find((c) => c.id === pick)) return open.find((c) => c.id === pick);
    const l = later();
    return open.find((c) => !l.includes(c.id)) || open[0];
  }

  // The running measurement of the challenge on screen, kept on the phone so a reload doesn't reset it.
  let lastTick = Date.now();
  function m(c) {
    const all = meas();
    if (!all[c.id]) { all[c.id] = { s: 0, n: 0, p: [], hit: 0, hint: 0 }; set('coach_m', all); visit(norm(location.hash), c); }
    return meas()[c.id];
  }
  function saveM(id, x) { const all = meas(); all[id] = x; set('coach_m', all); }
  function tick() {
    const now = Date.now(), dt = Math.min(30, Math.max(0, (now - lastTick) / 1000));
    lastTick = now;
    if (document.hidden || !Z.me) return;
    const c = current(); if (!c || today < 1 || today > bw.days.length) return;
    const x = m(c); x.s = Math.round((x.s + dt) * 10) / 10; saveM(c.id, x);
  }
  function visit(route, c) {
    if (!route) return;
    if (c) {
      const x = meas()[c.id] || { s: 0, n: 0, p: [], hit: 0, hint: 0 };
      if (x.p[x.p.length - 1] !== route) { x.n++; x.p.push(route); if (x.p.length > 12) x.p = x.p.slice(-12); }
      if (reached(route, c.route)) x.hit = 1;
      saveM(c.id, x);
    }
    const cov = get('coach_cov', { sent: [], pending: [], at: 0 });
    if (!cov.sent.includes(route) && !cov.pending.includes(route)) { cov.pending.push(route); set('coach_cov', cov); }
  }
  async function sendCover(force) {
    const cov = get('coach_cov', { sent: [], pending: [], at: 0 });
    if (!cov.pending.length || !me || (!force && Date.now() - cov.at < 60e3)) return;
    const head = 'app ' + appV() + '|';
    const take = []; let len = head.length;
    for (const r of cov.pending) { if (len + r.length + 1 > 900) break; take.push(r); len += r.length + 1; }
    cov.pending = cov.pending.filter((r) => !take.includes(r)); cov.sent = cov.sent.concat(take).slice(-400); cov.at = Date.now();
    set('coach_cov', cov);
    await send([row('note', 'auto:cover', head + take.join(','))]);
  }
  const row = (kind, step, note) => ({ tester: me.name, role: (RL[me.role] || {}).log || me.role, device, step: String(step).slice(0, 60), kind, note: note == null ? null : String(note).slice(0, 1000), version: rowVer() });

  function payLine() {
    const s = st(), confirmed = get('bw_conf', []);
    let days = 0, probs = 0;
    bw.days.forEach((d) => { const my = d.ch.filter((c) => c.role === me.role); const done = my.filter((c) => s[c.id] === 'done').length; if (done >= bw.pay.min_done_for_day) days++;
      probs += Math.min(bw.pay.problems_cap_day, my.filter((c) => confirmed.includes(c.id)).length); });
    return `💵 So far: ${days} day${days === 1 ? '' : 's'} × ${bw.pay.day} + ${probs} confirmed problem${probs === 1 ? '' : 's'} × ${bw.pay.problem} = KES ${(days * bw.pay.day + probs * bw.pay.problem).toLocaleString('en-GB')} (Jerry checks it)`;
  }

  // ---------- look ----------
  const css = document.createElement('style');
  css.textContent = `
  #zcoach { position:fixed; left:8px; right:8px; bottom:calc(var(--zc-nav, 60px) + 6px); z-index:30; max-width:560px; margin:0 auto; color:var(--ink); font-size:15px; }
  #zcoach.fs .zc-body { max-height:38vh; }
  #zcoach .zc-box { background:var(--surface); border:2px solid var(--accent); border-radius:16px; box-shadow:0 6px 24px rgba(0,0,0,.22); overflow:hidden; }
  #zcoach .zc-bar { display:flex; align-items:center; gap:8px; width:100%; min-height:48px; padding:6px 12px; background:var(--accent-soft); border:0; color:var(--ink); font:inherit; font-weight:700; text-align:left; cursor:pointer; }
  #zcoach .zc-bar .zc-t { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #zcoach .zc-body { padding:10px 14px 14px; max-height:calc(100vh - var(--zc-nav, 60px) - 140px); max-height:calc(100dvh - var(--zc-nav, 60px) - 140px); overflow:auto; overscroll-behavior:contain; }
  #zcoach h4 { margin:2px 0 6px; font-size:17px; line-height:1.3; }
  #zcoach .zc-lbl { font-size:12.5px; font-weight:700; color:var(--ink-faint); text-transform:uppercase; letter-spacing:.3px; margin:10px 0 2px; }
  #zcoach p { margin:2px 0 6px; line-height:1.45; }
  #zcoach .zc-time { font-size:13px; color:var(--ink-soft); font-weight:600; }
  #zcoach .zc-hint { background:var(--brand-soft); border-radius:10px; padding:8px 10px; margin:6px 0; white-space:pre-line; }
  #zcoach .zc-end { background:var(--ok-soft); border-radius:10px; padding:8px 10px; margin:6px 0; }
  #zcoach .zc-copy { display:flex; gap:8px; align-items:center; background:var(--surface-2); border-radius:10px; padding:6px 8px; margin:6px 0; font-size:13.5px; }
  #zcoach .zc-copy span { flex:1; min-width:0; overflow-wrap:anywhere; }
  #zcoach button.zc-b, #zcoach a.zc-b { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:44px; padding:8px 12px; border-radius:10px; border:1px solid var(--line-strong); background:var(--surface-2); color:var(--ink); font:inherit; font-weight:700; font-size:14.5px; cursor:pointer; text-decoration:none; }
  #zcoach .zc-b.go { background:var(--brand); color:var(--on-brand); border-color:transparent; }
  #zcoach .zc-b.ok { background:var(--ok); color:var(--on-brand); border-color:transparent; }
  #zcoach .zc-b.bad { color:var(--bad); }
  #zcoach .zc-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
  #zcoach .zc-grid .wide { grid-column:1 / -1; }
  #zcoach .zc-faces { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; margin:8px 0; }
  #zcoach .zc-faces button { flex-direction:column; gap:2px; min-height:64px; padding:6px 2px; font-size:11.5px; font-weight:600; }
  #zcoach .zc-faces button span { font-size:26px; line-height:1; }
  #zcoach textarea { min-height:70px; font-size:16px; }
  #zcoach .zc-li { display:flex; gap:8px; align-items:center; padding:8px 0; border-bottom:1px solid var(--line); }
  #zcoach .zc-li:last-child { border-bottom:0; }
  #zcoach .zc-li .grow { flex:1; min-width:0; }
  #zcoach .zc-li .zc-b { min-height:44px; padding:6px 10px; font-size:13.5px; }
  #zcoach .zc-pay { background:var(--accent-soft); border-radius:10px; padding:8px 10px; font-weight:700; font-size:14px; margin:8px 0; }
  #zcoach .zc-small { font-size:12.5px; color:var(--ink-faint); }
  #zcoach .zc-focus { display:block; width:100%; text-align:left; background:var(--brand-soft); border:0; border-radius:10px; padding:6px 10px; margin:4px 0 6px; color:var(--ink); font:inherit; font-size:13.5px; cursor:pointer; }
  #zcoach .zc-b.on { outline:3px solid var(--brand); outline-offset:1px; font-weight:800; }
  #zcoach .zc-chips { display:flex; flex-wrap:wrap; gap:6px; margin:6px 0; }
  #zcoach .zc-chips .zc-b { min-height:40px; padding:6px 10px; font-size:13.5px; }
  #zcoach .zc-chips .zc-b.on { background:var(--brand); color:var(--on-brand); border-color:transparent; }
  #zcoach .zc-x { flex:none; width:44px; height:44px; border-radius:10px; border:0; background:transparent; color:var(--ink); font-size:20px; cursor:pointer; }
  body.zc-on main { padding-bottom:calc(100px + 70px); }
  body.zc-on .toast { bottom:calc(var(--zc-nav, 60px) + 66px); }
  @media (min-width: 900px) {
    #zcoach { left:auto; right:16px; bottom:16px; width:380px; margin:0; }
    #zcoach .zc-body { max-height:calc(100vh - 200px); }
    body.zc-on main { padding-bottom:120px; }
  }`;

  let root = null;
  function mount() {
    if (root) return root;
    document.head.appendChild(css);
    root = document.createElement('div');
    root.id = 'zcoach'; if (inFS) root.classList.add('fs');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Test coach');
    document.body.appendChild(root);
    document.body.classList.add('zc-on');
    placeNav();
    window.addEventListener('resize', placeNav);
    return root;
  }
  function placeNav() {
    const nav = document.getElementById('nav');
    const fixed = nav && !nav.hidden && getComputedStyle(nav).position === 'fixed';
    document.documentElement.style.setProperty('--zc-nav', (fixed ? nav.offsetHeight : 0) + 'px');
  }

  // ---------- drawing ----------
  function render() {
    if (root && root.querySelector('#zs-good')) keepSv(); // v1.1: keep the day's answers when the screen redraws
    if (!bw || !me || !Z.me || !document.body.classList.contains('app')) { if (root) root.hidden = true; return; }
    mount(); root.hidden = false; placeNav();
    const s = st();
    const done = mine.filter((c) => s[c.id] === 'done').length;
    const c = current();
    const count = `${done}/${mine.length}`;
    let title, body;
    if (today < 1) {
      title = '🧪 Business Week starts ' + new Date(bw.start + 'T09:00:00+03:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      body = `<p>Your challenges start on day 1. You can read them now in your Testers' List.</p><div class="zc-grid"><a class="zc-b wide" href="testers/?bw">📋 Open my Testers' List</a>${offBtn()}</div>`;
    } else if (today > bw.days.length) {
      title = '🧪 Business Week is over — asante sana!';
      body = `<div class="zc-pay">${esc(payLine())}</div><div class="zc-grid"><a class="zc-b wide" href="testers/?bw">📋 Open my Testers' List</a>${offBtn()}</div>`;
    } else if (ui.mode === 'survey' || (!c && !surveyDone() && ui.mode !== 'list' && !ui.svLater)) {
      title = `📝 Day ${today} · 5 quick questions`;
      body = surveyHtml();
    } else if (ui.mode === 'list') {
      title = `🧪 ${count} · Today's challenges`;
      body = listHtml(s);
    } else if (!c) {
      title = `🧪 ${count} · All done for today 🎉`;
      body = `<h4>All done for today 🎉</h4><p>Thank you, ${esc(me.name.split(' ')[0])}! Jerry reads every answer tonight.</p>${inFS ? '<p><b>Last step:</b> tap the green <b>✅ Done</b> at the very bottom (Feedback Studio), then <b>📨 Send to Claude</b> — that sends your talking and pictures.</p>' : ''}<div class="zc-pay">${esc(payLine())}</div>
        <div class="zc-grid"><button class="zc-b" data-a="list">☰ All today</button><a class="zc-b" href="testers/?bw">📋 Testers' List</a></div>`;
    } else {
      title = `🧪 ${count} · ${c.t}`;
      body = cardHtml(c);
    }
    const open = ui.open || ui.mode !== 'card';
    root.innerHTML = `<div class="zc-box"><div style="display:flex;align-items:stretch"><button class="zc-bar" data-a="toggle" aria-expanded="${open}"><span class="zc-t">${esc(title)}</span><span aria-hidden="true">${open ? '▾' : '▴'}</span></button></div>
      ${open ? `<div class="zc-body">${body}</div>` : ''}</div>`;
    wire(c);
  }
  const offBtn = () => `<button class="zc-b wide" data-a="off">Hide the coach on this phone</button>`;
  // v1.1: a step that sends a message or makes a call also asks whether it opened right.
  const isMsg = (c) => (c.feat || []).some((f) => /message|text|send|share|call|wa|sms|remind/.test(f)) || /WhatsApp|📩|💬|Text it|SMS|📞/.test((c.do || '') + ' ' + (c.end || ''));
  const focusOf = () => (RL[me.role] || {}).focus || null;
  const focusHtml = (open) => { const f = focusOf(); if (!f) return '';
    return (open || ui.focus) ? `<button class="zc-focus" data-a="focus" aria-expanded="true">🎯 <b>Your special job this week: ${esc(f.t)}</b><br>${esc(f.how)}</button>`
      : `<button class="zc-focus" data-a="focus" aria-expanded="false">🎯 Your special job: <b>${esc(f.t)}</b> ▸</button>`; };
  // v1.1: 📝 5 quick questions at the end of each day (also from ☰ All today).
  const surveyDone = () => !!get('bw_survey', {})[today];
  const TRIED = ['📞 Call', '💬 WhatsApp', '📩 Text (SMS)', '🗺️ Map', '📍 Pin', '📷 Photo', '🧾 Receipt', '📤 Share / send'];
  function surveyHtml() {
    const v = ui.sv;
    return `<div class="zc-time">📝 Day ${today} · 5 quick questions</div><h4>How did today go?</h4>
      <div class="zc-lbl">1 · What worked well?</div><textarea id="zs-good" maxlength="300" placeholder="(🎤 tap the microphone on your keyboard to talk)">${esc(v.good)}</textarea>
      <div class="zc-lbl">2 · What was confusing or slow?</div><textarea id="zs-hard" maxlength="300">${esc(v.hard)}</textarea>
      <div class="zc-lbl">3 · Did anything look wrong? A name, address, phone number, amount, date or equipment detail</div>
      <div class="zc-grid"><button class="zc-b${v.wrong === 'no' ? ' on ok' : ''}" data-sv="wrong:no">No, all right</button><button class="zc-b${v.wrong === 'yes' ? ' on bad' : ''}" data-sv="wrong:yes">Yes</button></div>
      ${v.wrong === 'yes' ? `<textarea id="zs-what" maxlength="300" placeholder="What was wrong, and where?">${esc(v.what)}</textarea>` : ''}
      <div class="zc-lbl">4 · Which buttons did you try today? Tap each one</div>
      <div class="zc-chips">${TRIED.map((t) => `<button class="zc-b${v.tried.includes(t) ? ' on' : ''}" data-tried="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <textarea id="zs-broke" maxlength="200" placeholder="Did any of them NOT work? Which one, what happened?">${esc(v.broke)}</textarea>
      <div class="zc-lbl">5 · Today, overall</div><div class="zc-faces">
      ${[['😫', 'Very bad'], ['🙁', 'Bad'], ['😐', 'OK'], ['🙂', 'Good'], ['😄', 'Very good']].map(([f, w], i) => `<button class="zc-b${v.day === i + 1 ? ' on' : ''}" data-sv="day:${i + 1}" aria-label="${i + 1} — ${w}"><span>${f}</span>${w}</button>`).join('')}</div>
      <div class="zc-grid"><button class="zc-b go wide" data-a="sv-send">📨 Send my answers</button><button class="zc-b" data-a="back">Later</button></div>`;
  }
  const isScen = (c) => c.kind === 'scenario';
  // The Testers' List keeps zt_bw_hint for hints opened there: count those here too (map or list of ids).
  const pageHint = (id) => { const h = get('bw_hint', null); return !!h && (Array.isArray(h) ? h.includes(id) : !!h[id]); };
  function cardHtml(c) {
    const x = m(c);
    const head = `<div class="zc-time">⏰ ${esc(c.at || '')} · Day ${today} · ${esc((RL[me.role] || {}).short || me.role)}</div><h4>${esc(c.t)}</h4>`;
    if (ui.mode === 'right') {
      const msg = isMsg(c);
      return head + `<div class="zc-lbl">Is everything on the screen right?</div>
      <p class="zc-small">Names and spelling, address and directions, phone numbers (07xx xxx xxx or +254…), amounts, dates, equipment and serial numbers.</p>
      <div class="zc-grid"><button class="zc-b ok${ui.right === 'yes' ? ' on' : ''}" data-right="yes">✅ All correct</button><button class="zc-b bad${ui.right === 'no' ? ' on' : ''}" data-right="no">✏️ Something's wrong</button></div>
      ${ui.right === 'no' ? `<textarea id="zc-wrong" maxlength="400" placeholder="What is wrong? e.g. phone shows 712345678, missing the 0">${esc(ui.wrong)}</textarea>` : ''}
      ${msg ? `<div class="zc-lbl">💬 Did WhatsApp / SMS / Call open with the right number and the right words?</div>
      <div class="zc-grid" style="grid-template-columns:1fr 1fr 1fr"><button class="zc-b${ui.msg === 'yes' ? ' on ok' : ''}" data-msg="yes">Yes</button><button class="zc-b${ui.msg === 'no' ? ' on bad' : ''}" data-msg="no">No</button><button class="zc-b${ui.msg === 'na' ? ' on' : ''}" data-msg="na">Didn't try</button></div>` : ''}
      <div class="zc-grid">${ui.right ? '<button class="zc-b go wide" data-a="right-next">Next →</button>' : ''}<button class="zc-b wide" data-a="right-skip">Skip</button></div>`;
    }
    if (ui.mode === 'what') return head + `<div class="zc-lbl">What did you do?</div><p class="zc-small">A few words is plenty — or skip.</p>
      <textarea id="zc-said" maxlength="200" placeholder="e.g. I found her in Customers and opened a Repair job">${esc(ui.said)}</textarea>
      <div class="zc-grid"><button class="zc-b go wide" data-a="what-next">Next →</button><button class="zc-b" data-a="back">← Back</button><button class="zc-b" data-a="what-skip">Skip</button></div>`;
    if (ui.mode === 'self') return head + `<div class="zc-lbl">A good ending looks like…</div><div class="zc-end">${esc(c.end || '')}</div>
      <div class="zc-lbl">Did you end the same way?</div>
      <div class="zc-grid" style="grid-template-columns:1fr 1fr 1fr"><button class="zc-b ok" data-self="yes">Yes</button><button class="zc-b" data-self="partly">Partly</button><button class="zc-b bad" data-self="no">No</button></div>
      <div class="zc-grid"><button class="zc-b wide" data-self="">Skip</button></div>`;
    if (ui.mode === 'ease') return head + `<div class="zc-lbl">How easy was that?</div><div class="zc-faces">
      ${[['😫', 'Very hard'], ['🙁', 'Hard'], ['😐', 'OK'], ['🙂', 'Easy'], ['😄', 'Very easy']].map(([f, w], i) => `<button class="zc-b" data-ease="${i + 1}" aria-label="${i + 1} — ${w}"><span>${f}</span>${w}</button>`).join('')}</div>
      <div class="zc-grid"><button class="zc-b wide" data-ease="">Skip</button></div>`;
    if (ui.mode === 'problem') return head + `<div class="zc-lbl">What went wrong?</div>
      <textarea id="zc-prob" maxlength="900" placeholder="What happened? What did you expect? (🎤 tap the microphone on your keyboard to talk)"></textarea>
      <div class="zc-grid"><button class="zc-b go" data-a="prob-send">Send the problem</button><button class="zc-b" data-a="back">Cancel</button></div>`;
    const scen = isScen(c);
    const call = c.kind === 'scenario-call';
    const say = call ? (Array.isArray(c.say) ? c.say : c.say ? [c.say] : []) : [];
    if (scen && !x.hint && pageHint(c.id)) { x.hint = 1; saveM(c.id, x); }
    const hintOpen = ui.showHint || (scen && x.hint);
    return head + focusHtml() + `
      <div class="zc-lbl">${scen ? 'The situation' : 'Do this'}</div><p>${esc(c.do)}</p>
      ${call && say.length ? `<div class="zc-lbl">📞 Say this</div><div class="zc-hint">${say.map((l) => esc(l)).join('<br>')}</div>` : ''}
      ${c.copy ? `<div class="zc-copy"><span>${esc(c.copy)}</span><button class="zc-b" data-a="copy">Copy</button></div>` : ''}
      ${c.file ? `<p><a class="zc-b" href="${esc('testers/' + c.file)}" download>⬇️ ${esc(c.file.split('/').pop())}</a></p>` : ''}
      ${scen && c.hint ? (hintOpen ? `<div class="zc-lbl">💡 How</div><div class="zc-hint">${esc(c.hint)}</div>` : `<button class="zc-b" data-a="hint">💡 Show me how</button>`) : ''}
      ${(!scen || hintOpen) && (c.where || goTo(c.route)) ? `<div class="zc-lbl">📍 Where</div><div class="row" style="gap:8px"><span class="grow">${esc(c.where || goTo(c.route))}</span>${goTo(c.route) ? `<button class="zc-b go" data-a="go">Go there →</button>` : ''}</div>` : ''}
      ${!scen && (call ? c.check || c.end : c.end) ? `<div class="zc-lbl">${call ? 'Check that…' : 'You should end with…'}</div><div class="zc-end">${esc(call ? c.check || c.end : c.end)}</div>` : ''}
      <div class="zc-grid">
        <button class="zc-b ok wide" data-a="done">✅ Step done</button>
        <button class="zc-b bad" data-a="problem">❌ Problem</button><button class="zc-b" data-a="stuck">🆘 I'm stuck</button>
        <button class="zc-b" data-a="later">⏭ Later</button><button class="zc-b" data-a="list">☰ All today</button>
      </div>`;
  }
  function listHtml(s) {
    const cur = current();
    return `<div>${mine.map((c) => `<div class="zc-li"><div class="grow"><div class="zc-time">⏰ ${esc(c.at || '')}${s[c.id] === 'done' ? ' · ✅ done' : s[c.id] === 'fail' ? ' · ❌ problem sent' : cur && cur.id === c.id ? ' · ▶ now' : ''}</div><div style="font-weight:700">${esc(c.t)}</div></div>
        ${s[c.id] === 'done' ? `<button class="zc-b" data-undo="${esc(c.id)}">Undo</button>` : s[c.id] === 'fail' ? `<button class="zc-b" data-reopen="${esc(c.id)}">Try again</button>` : `<button class="zc-b go" data-pick="${esc(c.id)}">Do this</button>`}</div>`).join('') || '<p>Nothing for you today.</p>'}</div>
      <div class="zc-pay">${esc(payLine())}</div>
      ${focusHtml(true)}
      <div class="zc-grid"><button class="zc-b wide${surveyDone() ? '' : ' ok'}" data-a="survey">📝 Today's 5 questions${surveyDone() ? ' ✓ sent' : ''}</button><button class="zc-b go" data-a="back">← Back</button><a class="zc-b" href="testers/?bw">📋 Testers' List</a>${offBtn()}</div>`;
  }

  function wire(c) {
    const on = (sel, fn) => root.querySelectorAll(sel).forEach((b) => (b.onclick = (e) => { e.preventDefault(); fn(b); }));
    on('[data-a]', (b) => act(b.dataset.a, c));
    on('[data-ease]', (b) => { ui.ease = b.dataset.ease ? +b.dataset.ease : null; ui.right = null; ui.wrong = ''; ui.msg = null; ui.mode = 'right'; render(); });
    on('[data-right]', (b) => { ui.right = b.dataset.right; render(); const t = root.querySelector('#zc-wrong'); if (t) t.focus(); });
    on('[data-msg]', (b) => { ui.msg = b.dataset.msg; render(); });
    on('[data-sv]', (b) => { const [k, v] = b.dataset.sv.split(':'); keepSv(); ui.sv[k] = k === 'day' ? +v : v; render(); });
    on('[data-tried]', (b) => { keepSv(); const t = b.dataset.tried, a = ui.sv.tried; ui.sv.tried = a.includes(t) ? a.filter((x) => x !== t) : a.concat(t); render(); });
    const wr = root.querySelector('#zc-wrong'); if (wr) wr.oninput = () => (ui.wrong = wr.value);
    on('[data-self]', (b) => { ui.self = b.dataset.self || null; ui.mode = 'ease'; render(); });
    on('[data-pick]', (b) => { set('coach_pick', b.dataset.pick); setLater(later().filter((x) => x !== b.dataset.pick)); ui.mode = 'card'; ui.open = true; ui.showHint = false; render(); });
    on('[data-undo]', async (b) => { const id = b.dataset.undo; writeState(id, null); render(); await send([row('undone', bwStep(today, me.role, id), null)]); Z.toast('Unticked.'); });
    on('[data-reopen]', (b) => { writeState(b.dataset.reopen, null); set('coach_pick', b.dataset.reopen); ui.mode = 'card'; ui.open = true; render(); });
    const said = root.querySelector('#zc-said'); if (said) said.oninput = () => (ui.said = said.value);
  }
  async function act(a, c) {
    if (a === 'toggle') { if (ui.mode !== 'card') { ui.mode = 'card'; ui.open = true; } else ui.open = !ui.open; set('coach_open', ui.open); return render(); }
    if (a === 'list') { ui.mode = 'list'; return render(); }
    if (a === 'back') { if (ui.mode === 'survey' || (!c && !surveyDone())) { keepSv(); ui.svLater = true; } ui.mode = 'card'; return render(); }
    if (a === 'focus') { ui.focus = !ui.focus; return render(); }
    if (a === 'survey') { ui.mode = 'survey'; ui.open = true; return render(); }
    if (a === 'sv-send') return sendSurvey();
    if (a === 'off') { set('coach_off', true); if (root) root.remove(); root = null; document.body.classList.remove('zc-on'); Z.toast('Coach hidden. Your Business Week link brings it back.'); return; }
    if (!c) return;
    if (a === 'go') { tick(); ui.open = false; set('coach_open', false); if (goTo(c.route)) Z.go(goTo(c.route)); return render(); }
    if (a === 'hint') { const x = m(c); x.hint = 1; saveM(c.id, x); ui.showHint = true; return render(); }
    if (a === 'copy') { (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(c.copy) : Promise.reject()).then(() => Z.toast('Copied — paste it in Zuri.'), () => Z.toast('Press and hold the words to copy them.')); return; }
    if (a === 'later') { const l = later().filter((x) => x !== c.id); l.push(c.id); setLater(l); set('coach_pick', null); ui.showHint = false; ui.open = true; Z.toast('Moved to the end of today.'); return render(); }
    if (a === 'done') { ui.ease = null; ui.self = null; ui.said = ''; ui.mode = isScen(c) ? 'what' : 'ease'; return render(); }
    if (a === 'what-next' || a === 'what-skip') { if (a === 'what-skip') ui.said = ''; else { const t = root.querySelector('#zc-said'); ui.said = t ? t.value.trim() : ''; } ui.mode = 'self'; return render(); }
    if (a === 'right-next' || a === 'right-skip') { if (a === 'right-skip') { ui.right = null; ui.wrong = ''; ui.msg = null; } else { const t = root.querySelector('#zc-wrong'); ui.wrong = t ? t.value.trim() : ui.wrong; } return finish(c); }
    if (a === 'problem') { ui.mode = 'problem'; render(); const t = root.querySelector('#zc-prob'); if (t) t.focus(); return; }
    if (a === 'prob-send') {
      const t = (root.querySelector('#zc-prob') || {}).value; const words = String(t || '').trim();
      if (!words) return Z.toast('Write a few words first.');
      writeState(c.id, 'fail'); set('coach_pick', null); ui.mode = 'card'; ui.open = true; ui.showHint = false;
      render();
      const ok = await send([row('note', bwStep(today, me.role, c.id), ('❌ ' + c.t + ' — ' + words).slice(0, 1000))]);
      hq('problem', `ZURI-BW|day ${today}|${me.role}|${me.name}|app ${appV()}|device ${phone()}\n❌ ${c.t}\n${words}`);
      Z.toast(ok ? 'Sent — thank you! Jerry checks it tonight.' : 'Saved — sends when you have signal.');
      return;
    }
    if (a === 'stuck') {
      const x = m(c);
      if (isScen(c)) { x.hint = 1; saveM(c.id, x); }
      ui.showHint = true; ui.open = true; ui.mode = 'card'; render();
      send([row('note', ('auto:stuck:' + c.id), 'secs=' + Math.round(x.s) + '|route=' + norm(location.hash))]);
      Z.toast(c.route ? 'Here is how — tap “Go there”. Still stuck? Tap ❌ Problem.' : 'Read the steps again. Still stuck? Tap ❌ Problem.');
    }
  }
  // v2.37 (16 Oct): Claude reads the Jerry HQ mailbox every night, so the coach also sends it each ❌ problem at once and
  //       one summary per tester when the day is finished (the board keeps the full detail). Training only; practice dry-runs.
  const MAILBOX = 'https://script.google.com/macros/s/AKfycbw1hgXVj5E8x8Ampm1fYK9po07pmSh9zrHfyVn3RvEYOR15_xb2jNPdlgzUuariPPrp/exec';
  function hq(kind, text) {
    const body = { action: 'report', kind, who: '', name: (me.name + ' (Zuri BW)').slice(0, 60), app: 'zuri-bw', contact: '', text: String(text).slice(0, 3000) };
    if (!live) { console.info('[coach] mailbox (practice, not sent)', body); return; }
    const q = get('hq_q', []); q.push(body); set('hq_q', q.slice(-50)); flushHQ();
  }
  async function flushHQ() {
    const q = get('hq_q', []); if (!q.length || !navigator.onLine) return;
    set('hq_q', []);
    const left = [];
    for (const b of q) { try { await fetch(MAILBOX, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(b) }); } catch (e) { left.push(b); } }
    if (left.length) set('hq_q', left.concat(get('hq_q', [])).slice(-50));
  }
  window.addEventListener('online', flushHQ); setTimeout(flushHQ, 4000);
  const stMap = () => st();
  // v2.38 (16 Oct, Jerry: "do we know the size of phone the testers have?"): every mailbox report says the phone.
  const phone = () => {
    const ua = navigator.userAgent || '';
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(ua) ? 'Android ' + ((ua.match(/Android ([\d.]+)/) || [])[1] || '') : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Other';
    const br = /SamsungBrowser/.test(ua) ? 'Samsung' : /OPR|Opera/.test(ua) ? 'Opera' : /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome/.test(ua) ? 'Chrome' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Browser';
    return `${os.trim()}·${br}·${screen.width}x${screen.height}@${Math.round((window.devicePixelRatio || 1) * 10) / 10}`;
  };
  function daySummary() {
    const res = get('coach_res', {})[today] || {}, st = stMap();
    const done = mine.filter((c) => st[c.id] === 'done').length, fail = mine.filter((c) => st[c.id] === 'fail').length;
    const eases = Object.values(res).map((r) => r.ease).filter((e) => e), avg = eases.length ? (eases.reduce((t, e) => t + e, 0) / eases.length).toFixed(1) : '–';
    const lines = [`ZURI-BW|day ${today}|${me.role}|${me.name}|app ${appV()}|done ${done}/${mine.length}|problems ${fail}|ease ${avg}|device ${phone()}`];
    mine.forEach((c) => { const r = res[c.id]; lines.push(`${st[c.id] === 'done' ? '✅' : st[c.id] === 'fail' ? '❌' : '·'} ${c.t}${r ? ` — ${r.s}s, ease ${r.ease || '–'}${r.hint ? ', hint' : ''}${r.hit === 0 ? ', missed screen' : ''}${r.self ? ', ended same: ' + r.self : ''}${r.said ? ' — “' + r.said + '”' : ''}` : ''}`); });
    return lines.join('\n');
  }
  function noteResult(c, note) {
    const all = get('coach_res', {}); all[today] = all[today] || {}; all[today][c.id] = { s: note.s, ease: note.ease, hint: note.hint, hit: note.hit, self: note.self, said: note.said }; set('coach_res', all);
    const st = stMap(), sent = get('hq_day_sent', {});
    if (mine.length && mine.every((x) => st[x.id] === 'done' || st[x.id] === 'fail') && !sent[today]) { sent[today] = 1; set('hq_day_sent', sent); hq('daily', daySummary()); }
  }
  async function finish(c) {
    tick();
    const x = meas()[c.id] || { s: 0, n: 0, p: [], hit: 0, hint: 0 };
    const note = { v: 1, via: 'coach', s: Math.round(x.s), n: x.n, p: x.p.slice(-12).join('>'), hit: c.route ? (x.hit ? 1 : 0) : null, ease: ui.ease, hint: x.hint ? 1 : 0, self: isScen(c) ? ui.self : null, said: (ui.said || '').slice(0, 200),
      right: ui.right, msg: isMsg(c) ? ui.msg : null }; // v1.1: the data check (the words of a ✏️ go in their own row below)
    const wrong = ui.right === 'no' ? (ui.wrong || '').trim() : '';
    let txt = JSON.stringify(note);
    while (txt.length > 900 && note.p) { note.p = note.p.split('>').slice(1).join('>'); txt = JSON.stringify(note); }
    if (txt.length > 900) { note.said = note.said.slice(0, 60); txt = JSON.stringify(note); }
    writeState(c.id, 'done');
    const all = meas(); delete all[c.id]; set('coach_m', all);
    set('coach_pick', null); setLater(later().filter((i) => i !== c.id));
    ui.mode = 'card'; ui.open = true; ui.showHint = false; ui.said = ''; ui.ease = null; ui.self = null; ui.right = null; ui.wrong = ''; ui.msg = null;
    render();
    noteResult(c, note);
    const rows = [row('done', bwStep(today, me.role, c.id), txt)];
    if (wrong || note.right === 'no' || note.msg === 'no') {
      const w = '✏️ Data check — ' + c.t + ' — ' + (note.right === 'no' ? (wrong || 'something on the screen is wrong (no words)') : 'screen OK') + (note.msg === 'no' ? ' · 💬 message/call did NOT open right' : '');
      rows.push(row('note', ('check:' + c.id).slice(0, 60), w.slice(0, 1000)));
      hq('problem', `ZURI-BW|day ${today}|${me.role}|${me.name}|app ${appV()}|device ${phone()}\n${w}`);
    }
    const ok = await send(rows);
    Z.toast(ok ? 'Done ✓ — next one is up.' : 'Done ✓ (saved on the phone — sends when you have signal)');
  }

  function keepSv() { const g = (id) => { const t = root && root.querySelector(id); return t ? t.value.trim() : null; };
    [['good', '#zs-good'], ['hard', '#zs-hard'], ['what', '#zs-what'], ['broke', '#zs-broke']].forEach(([k, id]) => { const v = g(id); if (v != null) ui.sv[k] = v; }); }
  async function sendSurvey() {
    keepSv(); const v = ui.sv;
    if (!v.good && !v.hard && !v.wrong && !v.tried.length && !v.broke && !v.day) return Z.toast('Answer at least one question first.');
    const ans = { v: 1, day: today, good: v.good.slice(0, 300), hard: v.hard.slice(0, 300), wrong: v.wrong, what: v.what.slice(0, 300), tried: v.tried, broke: v.broke.slice(0, 200), rate: v.day };
    let txt = JSON.stringify(ans); if (txt.length > 1000) { ans.good = ans.good.slice(0, 150); ans.hard = ans.hard.slice(0, 150); ans.what = ans.what.slice(0, 150); txt = JSON.stringify(ans).slice(0, 1000); }
    const sd = get('bw_survey', {}); sd[today] = 1; set('bw_survey', sd);
    ui.mode = 'card'; ui.svLater = false; ui.sv = { good: '', hard: '', wrong: null, what: '', tried: [], broke: '', day: null }; render();
    const ok = await send([row('note', ('survey:d' + today + ':' + me.role).slice(0, 60), '📝 ' + txt)]);
    hq('daily', `ZURI-BW SURVEY|day ${today}|${me.role}|${me.name}|app ${appV()}|device ${phone()}\n` +
      `rate ${ans.rate || '–'}/5\n✅ worked: ${ans.good || '–'}\n🤔 confusing: ${ans.hard || '–'}\n✏️ wrong: ${ans.wrong === 'yes' ? ans.what || 'yes (no words)' : ans.wrong || '–'}\n🔘 tried: ${ans.tried.join(', ') || '–'}\n❌ didn't work: ${ans.broke || '–'}`);
    Z.toast(ok ? 'Thank you! Sent to Jerry.' : 'Saved — sends when you have signal.');
  }

  // ---------- start ----------
  async function load() {
    const cached = get('bw_json', null);
    try {
      const r = await fetch('testers/scripts/business_week.json?v=' + encodeURIComponent(((cached && cached.version) || '').split(' ')[0] + '-' + kenyaDay()), { cache: 'no-cache' });
      if (!r.ok) throw new Error('json ' + r.status);
      const j = await r.json(); set('bw_json', j); return j;
    } catch (e) { return cached; }
  }
  function setup() {
    RL = Object.fromEntries((bw.roles || []).map((r) => [r.id, r]));
    me = get('bw_me', null);
    if (!me || !RL[me.role]) {
      // Practice with ?coach and no tester link yet: be the tester for this practice job.
      const r = (QS.get('r') || '').toUpperCase();
      const map = { admin: 'P', internal: 'F', callcenter: 'C1', field: 'T1' };
      const role = RL[r] ? r : Z.me ? map[Z.me.role] || 'C1' : 'C1';
      me = Z.practice ? { name: (QS.get('n') || 'Practice tester').slice(0, 60), role } : null;
    }
    if (!me) return false;
    today = local && QS.get('today') ? +QS.get('today') : dayNo(bw, kenyaDay());
    dayObj = bw.days[today - 1] || null;
    mine = dayObj ? dayObj.ch.filter((c) => c.role === me.role) : [];
    // Keep only today's measurements.
    const all = meas(); const ids = mine.map((c) => c.id); let changed = false;
    Object.keys(all).forEach((k) => { if (!ids.includes(k)) { delete all[k]; changed = true; } });
    if (changed) set('coach_m', all);
    return true;
  }
  let started = false;
  async function start() {
    if (started) return; started = true;
    bw = await load();
    if (!bw || !setup()) { started = false; bw = bw || null; return; }
    visit(norm(location.hash), null);
    render();
    flush();
    setInterval(() => { tick(); sendCover(false); }, 5000);
    document.addEventListener('visibilitychange', () => { lastTick = Date.now(); if (!document.hidden) refresh(); });
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', (e) => { if (/^zt_(bw_state|bw_me|bw_conf)$/.test(e.key || '')) refresh(); });
    window.addEventListener('online', () => { flush(); sendCover(true); });
    window.addEventListener('pagehide', tick);
  }
  function refresh() { if (!bw) return; if (['what', 'problem', 'right', 'survey'].includes(ui.mode)) return; setup(); render(); } // v1.1: never wipe words being typed

  // Hook the app's page changes: every visit is a screen seen (and starts the coach once someone is signed in).
  const route0 = Z.route;
  Z.route = function () {
    const p = route0.apply(this, arguments);
    if (Z.me) {
      if (!started) start();
      else if (bw && me) { tick(); const c = today >= 1 && today <= bw.days.length ? current() : null; visit(norm(location.hash), c); if (ui.mode === 'card' || ui.mode === 'list') render(); }
    }
    return p;
  };
  Z.coach = { refresh, flush, norm, state: () => ({ me, today, mine: mine.map((c) => c.id), current: (current() || {}).id, m: meas() }) };
})();
