// Zuri System · core: sign-in, roles, navigation, offline queue · v2 · 2026-09-30
(function () {
  const Z = (window.Z = {});
  const C = window.ZURI_CONFIG || {};
  Z.version = 'v2.5 · 2026-10-01';
  // Practice mode (?practice) runs on pretend data and keeps everything under its own names on the phone,
  // so practice work can never mix with — or be sent as — real work.
  Z.practice = !!window.ZURI_PRACTICE;
  // Training mode (?training): the same app on the Zuri Training database — pretend data, real shared teamwork.
  Z.training = !!window.ZURI_TRAINING && !!C.training;
  const PFX = Z.practice ? 'zuri_practice_' : Z.training ? 'zuri_training_' : 'zuri_';
  // Where "this app" lives, so emails and links come back to the same copy.
  Z.homeHref = () => location.origin + location.pathname + (Z.training ? '?training' : Z.practice ? '?practice' : '');
  const DB = Z.training ? C.training : C;
  Z.sb = supabase.createClient(DB.supabaseUrl, DB.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  // ---------- small helpers ----------
  // Saving must never fail silently (house rule), and a bad record must never white-screen the app.
  Z.get = (k, d) => { try { const v = localStorage.getItem(PFX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  Z.set = (k, v) => {
    try { localStorage.setItem(PFX + k, JSON.stringify(v)); return true; }
    catch (e) { Z.toast('This phone could not save — its storage is full.'); return false; }
  };
  // Local day, not UTC (toISOString is already "tomorrow" in the evening).
  Z.ymd = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  Z.ym = (d = new Date()) => Z.ymd(d).slice(0, 7);
  Z.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  Z.fmt = (n) => (n == null || n === '' ? '—' : Math.round(Number(n) || 0).toLocaleString('en-KE'));
  Z.kes = (n) => 'KES ' + Z.fmt(n);
  Z.num = (v) => { if (v == null || v === '') return null; const n = Number(String(v).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : null; };
  Z.uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
  Z.$ = (s, r = document) => r.querySelector(s);
  Z.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  Z.when = (ts) => { if (!ts) return ''; const d = new Date(ts); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
  Z.day = (s) => { if (!s) return ''; const d = new Date(s.length === 10 ? s + 'T12:00:00' : s); return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); };
  Z.formData = (form) => Object.fromEntries(new FormData(form).entries());
  Z.opts = (arr, sel) => arr.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${Z.esc(v)}"${String(v) === String(sel ?? '') ? ' selected' : ''}>${Z.esc(t)}</option>`; }).join('');
  let toastT;
  Z.toast = (msg) => { const t = Z.$('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); };
  Z.isNet = (err) => !navigator.onLine || /fetch|network|load failed|timed? ?out|ECONN/i.test(String((err && (err.message || err)) || ''));
  Z.isAuth = (err) => /jwt|refresh token|not authenticated|invalid claim|session.*(missing|expired)/i.test(String((err && (err.message || err)) || ''));
  // Database words → plain words. Our own database messages (raised on purpose) are already plain, so they pass through.
  const PLAIN = [
    [/invalid login credentials/i, 'Wrong email or password.'],
    [/email not confirmed/i, 'Open the confirmation email first, then sign in.'],
    [/row-level security|permission denied|violates row level/i, "You don't have permission to do that. Ask Kelvin or Dickson."],
    [/duplicate key|already exists|unique constraint/i, "That's already saved — no need to add it again."],
    [/violates not-null/i, 'A box that must be filled in is empty.'],
    [/violates check constraint|invalid input syntax/i, "Something in the form isn't allowed — check the numbers and dates."],
    [/violates foreign key/i, "That's linked to something that no longer exists. Refresh and try again."],
    [/payload too large|exceeded the maximum/i, 'That file is too big.'],
  ];
  Z.errText = (err) => {
    if (Z.isNet(err)) return 'No connection — try again when you have signal.';
    if (Z.isAuth(err)) return 'Please sign in again (Me → Sign out, then sign in).';
    const m = String((err && (err.message || err.error_description || err)) || 'Something went wrong.');
    const hit = PLAIN.find(([re]) => re.test(m));
    return hit ? hit[1] : m;
  };
  Z.fail = (err) => { console.error(err); Z.toast(Z.errText(err)); };
  window.addEventListener('error', (e) => Z.toast('Something went wrong: ' + (e.message || 'unknown')));
  window.addEventListener('unhandledrejection', (e) => Z.toast('Something went wrong: ' + Z.errText(e.reason)));

  // A panel that slides up from the bottom — instead of the phone's pop-up boxes, which are easy to mis-tap.
  Z.sheet = (title, html) => {
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${Z.esc(title)}"><div class="row" style="justify-content:space-between;margin-bottom:6px"><b style="font-size:17px">${Z.esc(title)}</b><button class="btn sec small" data-x aria-label="Close">✕</button></div>${html}</div>`;
    const close = () => { bg.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    bg.onclick = (e) => { if (e.target === bg) close(); };
    Z.$('[data-x]', bg).onclick = close;
    document.addEventListener('keydown', esc);
    window.addEventListener('hashchange', close, { once: true });
    document.body.appendChild(bg);
    const first = Z.$('input,select,textarea', bg); if (first && matchMedia('(min-width: 700px)').matches) first.focus();
    return { el: Z.$('.sheet', bg), close };
  };

  const loaded = {};
  Z.loadScript = (src) => loaded[src] || (loaded[src] = new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete loaded[src]; no(new Error('Could not load ' + src)); }; document.head.appendChild(s);
  }));
  Z.chartLib = () => Z.loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js');
  Z.xlsxLib = () => Z.loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');

  // ---------- who am I ----------
  Z.me = null;
  Z.isAdmin = () => Z.me && Z.me.role === 'admin';
  Z.isStaff = () => Z.me && ['admin', 'internal'].includes(Z.me.role);
  Z.isOffice = () => Z.me && ['admin', 'internal', 'callcenter'].includes(Z.me.role);
  Z.isFinance = () => Z.me && (Z.me.role === 'admin' || (Z.me.role === 'internal' && Z.me.dept === 'finance'));
  Z.isField = () => Z.me && Z.me.role === 'field';
  Z.ROLE_NAMES = { admin: 'Admin', internal: 'Office', callcenter: 'Call center', field: 'Field tech' };
  // Same rule the database uses (can_see): admin sees all; a tick decides; no tick = office yes, field no.
  Z.canSee = (entity, field) => {
    if (!Z.me) return false;
    if (Z.me.role === 'admin') return true;
    const v = (Z.ref.vis || []).find((x) => x.entity === entity && x.field === field && x.role === Z.me.role);
    return v ? v.can_see : Z.me.role !== 'field';
  };

  // Reference data, cached so the app still opens with no signal.
  Z.ref = Z.get('ref', { areas: [], people: [], vis: [], cfd: [] });
  Z.loadRef = async () => {
    const [a, p, v, c] = await Promise.all([
      Z.sb.from('areas').select('*').order('code'),
      Z.sb.from('v_people').select('*').order('full_name'),
      Z.sb.from('field_visibility').select('*'),
      Z.sb.from('custom_field_defs').select('*').order('sort'),
    ]);
    const err = a.error || p.error || v.error || c.error;
    if (err) { if (Z.isNet(err)) return; throw err; }
    Z.ref = { areas: a.data, people: p.data, vis: v.data, cfd: c.data };
    Z.set('ref', Z.ref);
  };
  Z.areaName = (code) => (Z.ref.areas.find((a) => a.code === code) || {}).name || (code ? 'Zuri ' + code : '');
  Z.personName = (id) => (Z.ref.people.find((p) => p.id === id) || {}).full_name || '';
  Z.techs = (area) => Z.ref.people.filter((p) => p.active && p.role === 'field' && (!area || !p.area || p.area === area));

  // ---------- screens ----------
  const SCREENS = ['login', 'pending', 'newpass'];
  function show(which) {
    SCREENS.forEach((s) => (Z.$('#scr-' + s).hidden = s !== which));
    const app = which === 'app';
    ['#hdr', '#nav', '#view'].forEach((s) => (Z.$(s).hidden = !app));
    document.body.classList.toggle('app', app);
  }

  const TABS = [
    { id: 'home', ic: '📊', label: 'Home', ok: () => Z.isOffice() },
    { id: 'tasks', ic: '✅', label: 'Tasks', ok: () => true },
    { id: 'jobs', ic: '🛠️', label: 'Jobs', ok: () => true },
    { id: 'customers', ic: '👥', label: 'Customers', ok: () => Z.isOffice() },
    { id: 'money', ic: '💰', label: 'Money', ok: () => Z.isFinance() },
    { id: 'import', ic: '📥', label: 'Import', ok: () => Z.isStaff(), nav: () => !Z.isFinance() },
    { id: 'admin', ic: '⚙️', label: 'Admin', ok: () => Z.isAdmin(), nav: () => false },
    { id: 'learn', ic: '🎓', label: 'Learn', ok: () => true, nav: () => false },
    { id: 'test', ic: '🧪', label: 'Testing', ok: () => true, nav: () => false },
    { id: 'me', ic: '🙂', label: 'Me', ok: () => true },
  ];
  // Field techs live in Jobs, so it comes first for them.
  const navTabs = () => {
    const t = TABS.filter((x) => x.ok() && (!x.nav || x.nav()));
    return Z.isField() ? ['jobs', 'tasks', 'me'].map((id) => t.find((x) => x.id === id)).filter(Boolean) : t;
  };
  // Which bottom tab lights up for a page that has no tab of its own.
  const PARENT = { import: 'money', admin: 'me', learn: 'me', test: 'me' };
  Z.routes = {};

  function buildChrome() {
    Z.$('#h-who').textContent = Z.me.full_name + ' · ' + Z.ROLE_NAMES[Z.me.role];
    Z.$('#nav').innerHTML = navTabs().map((t) => `<a href="#${t.id}" data-tab="${t.id}"><span class="ic">${t.ic}</span>${t.label}</a>`).join('');
    const sel = Z.$('#h-area');
    sel.hidden = Z.isField();
    sel.innerHTML = '<option value="">All areas</option>' + Z.opts(Z.ref.areas.filter((a) => a.active).map((a) => [a.code, a.name]), Z.area);
    sel.onchange = () => { Z.area = sel.value; Z.set('area', Z.area); Z.route(); };
    Z.$('#h-sync').onclick = () => Z.go('me');
  }

  Z.go = (hash) => { if (location.hash === '#' + hash) Z.route(); else location.hash = hash; };
  // Each visit draws into its own box. If the person taps elsewhere while a slow page loads,
  // that page keeps writing into a box that is no longer on screen — it can't overwrite the new one.
  let routeSeq = 0, lastHash = null;
  Z.route = async () => {
    if (!Z.me) return;
    const seq = ++routeSeq;
    let raw = location.hash.slice(1);
    try { raw = decodeURIComponent(raw); } catch (e) { /* a bad link — use it as typed */ }
    const parts = raw.split('/');
    const start = Z.isOffice() ? 'home' : 'jobs';
    let name = parts[0] || start;
    const tab = TABS.find((t) => t.id === name);
    if (!Z.routes[name] || (tab && !tab.ok())) name = start;
    Z.$$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (PARENT[name] || name)));
    const view = Z.$('#view');
    const samePage = lastHash === location.hash;
    lastHash = location.hash;
    const y = window.scrollY;
    const box = document.createElement('div');
    box.innerHTML = '<div class="loading">Loading…</div>';
    if (samePage) view.style.minHeight = view.offsetHeight + 'px'; // no jump while the same page refreshes
    view.replaceChildren(box);
    if (!samePage) window.scrollTo(0, 0);
    try {
      await Z.routes[name](parts.slice(1), box);
    } catch (e) {
      if (seq !== routeSeq) return;
      console.error(e);
      box.innerHTML = `<div class="card"><b>Couldn't load this page.</b><p class="hint">${Z.esc(Z.errText(e))}</p><button class="btn sec" onclick="Z.route()">Try again</button></div>`;
    } finally {
      if (seq === routeSeq) { if (samePage) window.scrollTo(0, y); view.style.minHeight = ''; }
      nameTicks(box);
    }
  };

  async function enter(session) {
    let prof = null;
    const { data, error } = await Z.sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (error) { if (Z.isNet(error)) prof = Z.get('me', null); else throw error; } else prof = data;
    if (!prof || !prof.active) {
      Z.$('#p-name').textContent = (prof && prof.full_name) || session.user.email;
      return show('pending');
    }
    Z.me = prof; Z.set('me', prof);
    loadQueue(prof.id);
    Z.pruneCache();
    Z.area = Z.get('area', prof.area || '');
    await Z.loadRef();
    buildChrome();
    show('app');
    Z.syncBadge();
    Z.route();
    Z.flush();
  }

  // Every tick box says what it is (screen readers, and Feedback Studio reports say "ticked: …" instead of "on").
  function nameTicks(root) {
    Z.$$('input[type=checkbox]:not([aria-label])', root).forEach((cb) => {
      const l = cb.closest('label') || (cb.id && Z.$('label[for="' + cb.id + '"]'));
      const t = ((l && l.textContent) || cb.name || '').replace(/\s+/g, ' ').trim();
      if (t) cb.setAttribute('aria-label', t);
    });
  }
  Z.applyTheme = () => { const t = Z.get('theme', 'auto'); if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t; };
  Z.start = async () => {
    Z.applyTheme();
    Z.$('#zver').textContent = 'Zuri System ' + Z.version + (Z.practice ? ' · practice' : Z.training ? ' · training' : '');
    Z.$('#h-test').hidden = C.env !== 'test' && !Z.practice && !Z.training;
    if (Z.training) {
      document.body.classList.add('training');
      Z.$('#h-test').textContent = 'TRAINING';
      Z.$('#login-sub').textContent = 'Zuri Fiber · TRAINING copy';
      Z.$('#training-note').hidden = false;
    }
    if (Z.practice) {
      Z.$('#h-test').textContent = 'PRACTICE';
      Z.$('#login-sub').textContent = 'Zuri Fiber · practice';
      Z.$$('.real-only').forEach((x) => (x.hidden = true));
      const pick = Z.$('#practice-pick');
      pick.hidden = false;
      const last = typeof window.ZP.last === 'function' ? window.ZP.last() : null; // an older cached practice.js has no last()
      Z.$('#practice-roles').innerHTML = Object.entries(window.ZP.roles).map(([k, r]) => `<button class="btn sec block" data-role="${k}" style="justify-content:flex-start;text-align:left;margin-bottom:8px;flex-wrap:wrap;${k === last ? 'border-color:var(--brand)' : ''}">
          <span style="flex:1 1 auto">${r.label} <span class="hint" style="margin:0">as ${Z.esc(r.who)}${k === last ? ' · last time' : ''}</span>${r.does ? `<br><span class="hint" style="margin:0;font-weight:500">${Z.esc(r.does)}</span>` : ''}</span></button>`).join('');
      Z.$$('[data-role]', pick).forEach((b) => (b.onclick = () => { window.ZP.pickRole(b.dataset.role); enter(window.ZP.session()).catch(Z.fail); }));
    }
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
    const recovering = /type=recovery/.test(location.hash);

    Z.$('#f-login').onsubmit = async (e) => {
      e.preventDefault();
      const { data, error } = await Z.sb.auth.signInWithPassword({ email: Z.$('#l-email').value.trim(), password: Z.$('#l-pass').value });
      if (error) return Z.toast(/confirm/i.test(error.message) ? 'Open the confirmation email first, then sign in.' : Z.errText(error));
      enter(data.session).catch(Z.fail);
    };
    Z.$('#f-signup').onsubmit = async (e) => {
      e.preventDefault();
      const { error } = await Z.sb.auth.signUp({
        email: Z.$('#s-email').value.trim(), password: Z.$('#s-pass').value,
        options: { data: { full_name: Z.$('#s-name').value.trim(), phone: Z.$('#s-phone').value.trim() }, emailRedirectTo: Z.homeHref() },
      });
      if (error) return Z.toast(Z.errText(error));
      e.target.reset();
      Z.toast('Account created — check your email to confirm it.');
    };
    Z.$('#a-forgot').onclick = async (e) => {
      e.preventDefault();
      const email = Z.$('#l-email').value.trim();
      if (!email) return Z.toast('Type your email above first.');
      const { error } = await Z.sb.auth.resetPasswordForEmail(email, { redirectTo: Z.homeHref() });
      Z.toast(error ? Z.errText(error) : 'Check your email for a reset link.');
    };
    Z.$('#f-newpass').onsubmit = async (e) => {
      e.preventDefault();
      const { data, error } = await Z.sb.auth.updateUser({ password: Z.$('#np').value });
      if (error) return Z.toast(Z.errText(error));
      Z.toast('Password saved.');
      history.replaceState(null, '', Z.homeHref());
      const { data: s } = await Z.sb.auth.getSession();
      if (s.session) enter(s.session).catch(Z.fail); else show('login');
    };
    const out = async () => { await Z.sb.auth.signOut(); Z.me = null; localStorage.removeItem(PFX + 'me'); show('login'); };
    Z.logout = out;
    Z.$('#b-logout2').onclick = out;
    Z.$('#b-recheck').onclick = async () => { const { data } = await Z.sb.auth.getSession(); if (data.session) enter(data.session).catch(Z.fail); };

    Z.sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') show('newpass'); });
    window.addEventListener('hashchange', Z.route);
    window.addEventListener('online', () => { Z.syncBadge(); Z.flush(); });
    window.addEventListener('offline', Z.syncBadge);
    setInterval(Z.flush, 60000);

    let data = { session: null }, sessErr = null;
    try { const r = await Z.sb.auth.getSession(); data = r.data || data; sessErr = r.error; } catch (e) { sessErr = e; }
    if (recovering) return show('newpass');
    if (/access_token|error_description/.test(location.hash)) history.replaceState(null, '', Z.homeHref());
    // No signal and the sign-in needs refreshing: open with what this phone already knows, so field work carries on.
    const cachedMe = Z.get('me', null);
    if (!data.session && cachedMe && (!navigator.onLine || Z.isNet(sessErr))) {
      Z.offlineStart = true;
      return enter({ user: { id: cachedMe.id } }).catch((e) => { Z.fail(e); show('login'); });
    }
    if (!data.session) return show('login');
    enter(data.session).catch((e) => { Z.fail(e); show('login'); });
  };

  // ---------- photo store (photos are too big for the queue; they wait here until they upload) ----------
  const idbOpen = () => new Promise((ok, no) => {
    const r = indexedDB.open(Z.practice ? 'zuri_practice' : Z.training ? 'zuri_training' : 'zuri', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('blobs');
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  const idbDo = async (mode, fn) => { const db = await idbOpen(); return new Promise((ok, no) => { const tx = db.transaction('blobs', mode); const req = fn(tx.objectStore('blobs')); tx.oncomplete = () => ok(req && req.result); tx.onerror = () => no(tx.error); }); };
  Z.idb = {
    put: (k, v) => idbDo('readwrite', (st) => st.put(v, k)),
    get: (k) => idbDo('readonly', (st) => st.get(k)),
    del: (k) => idbDo('readwrite', (st) => st.delete(k)),
  };

  // ---------- offline queue ----------
  // Every job change goes through here, so it works the same with or without signal.
  // Each person's queue is kept apart, so a shared phone never sends one person's work as another.
  let qKey = 'queue';
  Z.queue = [];
  function loadQueue(uid) {
    qKey = 'queue_' + uid;
    const old = Z.get('queue', null); // before v2 there was one queue per phone
    Z.queue = Z.get(qKey, []);
    if (old && old.length) { Z.queue = Z.queue.concat(old); if (Z.set(qKey, Z.queue)) localStorage.removeItem(PFX + 'queue'); }
  }
  Z.saveQueue = () => Z.set(qKey, Z.queue);
  // Returns false (and keeps nothing) if the phone couldn't save it — callers must not say "saved".
  Z.enqueue = (op, data) => {
    const it = { qid: Z.uuid(), op, data, at: Date.now() };
    Z.queue.push(it);
    if (!Z.saveQueue()) {
      Z.pruneCache();
      if (!Z.saveQueue()) { Z.queue = Z.queue.filter((q) => q !== it); return false; }
    }
    Z.syncBadge();
    Z.flush();
    return true;
  };
  // Saved copies of single jobs pile up; keep the newest 40 and nothing older than 3 weeks.
  Z.pruneCache = () => {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(PFX + 'job_'));
      const aged = keys.map((k) => { let at = 0; try { at = JSON.parse(localStorage.getItem(k)).at || 0; } catch (e) {} return [k, at]; }).sort((a, b) => b[1] - a[1]);
      const cutoff = Date.now() - 21 * 864e5;
      aged.forEach(([k, at], i) => { if (i >= 40 || at < cutoff) localStorage.removeItem(k); });
    } catch (e) { /* storage blocked */ }
  };
  Z.pending = () => Z.queue.filter((q) => !q.err);
  Z.failed = () => Z.queue.filter((q) => q.err);

  async function runOp(it) {
    const d = it.data;
    let r;
    switch (it.op) {
      case 'ticket_insert':
        r = await Z.sb.from('tickets').upsert(d.row, { onConflict: 'id', ignoreDuplicates: true });
        return r.error;
      case 'ticket_update':
        r = await Z.sb.from('tickets').update(d.fields).eq('id', d.id).select('id');
        if (r.error) return r.error;
        return r.data.length ? null : new Error('Not allowed to change this job (it may have been reassigned).');
      case 'event':
        r = await Z.sb.from('ticket_events').upsert(d.row, { onConflict: 'id', ignoreDuplicates: true });
        return r.error;
      case 'part':
        r = await Z.sb.from('ticket_parts').upsert(d.row, { onConflict: 'id', ignoreDuplicates: true });
        return r.error;
      case 'part_delete':
        r = await Z.sb.from('ticket_parts').delete().eq('id', d.id);
        return r.error;
      case 'customer_save':
        r = await Z.sb.rpc('save_customer', { p: d.p });
        return r.error;
      case 'photo': {
        const blob = await Z.idb.get(d.key);
        if (!blob) return new Error('This photo is no longer on the phone — take it again.');
        const up = await Z.sb.storage.from('ticket-photos').upload(d.row.body, blob, { contentType: 'image/jpeg' });
        if (up.error && !/exists|duplicate/i.test(up.error.message)) return up.error;
        r = await Z.sb.from('ticket_events').upsert(d.row, { onConflict: 'id', ignoreDuplicates: true });
        if (r.error) return r.error;
        Z.idb.del(d.key).catch(() => {});
        return null;
      }
      case 'task_insert':
        r = await Z.sb.from('tasks').upsert(d.row, { onConflict: 'id', ignoreDuplicates: true });
        return r.error;
      case 'task_update':
        r = await Z.sb.from('tasks').update(d.fields).eq('id', d.id).select('id');
        if (r.error) return r.error;
        return r.data.length ? null : new Error('This task was changed or removed by someone else.');
      case 'task_comment':
        r = await Z.sb.from('task_comments').upsert(d.row, { onConflict: 'id', ignoreDuplicates: true });
        return r.error;
      default:
        return new Error('Unknown change type ' + it.op);
    }
  }

  let flushing = false;
  Z.flush = async () => {
    if (flushing || !navigator.onLine || !Z.me || !Z.pending().length) return;
    flushing = true;
    let sent = 0;
    try {
      for (const it of Z.pending()) {
        let err;
        try { err = await runOp(it); } catch (e) { err = e; }
        if (!err) { Z.queue = Z.queue.filter((q) => q.qid !== it.qid); sent++; }
        else if (Z.isNet(err)) break;
        else if (Z.isAuth(err)) { Z.toast('Sign in again to send the work saved on this phone.'); break; }
        else it.err = Z.errText(err);
        Z.saveQueue();
      }
    } finally {
      flushing = false;
      Z.syncBadge();
      if (sent && Z.onSynced) Z.onSynced();
      // Something added while we were sending? Send it now rather than in a minute.
      if (sent && Z.pending().length) setTimeout(Z.flush, 0);
    }
  };
  Z.syncBadge = () => {
    const b = Z.$('#h-sync');
    const p = Z.pending().length, f = Z.failed().length;
    b.hidden = !p && !f && navigator.onLine;
    b.classList.toggle('bad', !!f);
    b.textContent = f ? `⚠️ ${f} didn't send` : p ? `⏳ ${p} waiting to send` : '📴 Offline';
  };

  // ---------- Me ----------
  Z.routes.me = async (_, el) => {
    const p = Z.pending(), f = Z.failed();
    const label = { ticket_insert: 'New job', ticket_update: 'Job update', event: 'Job note', part: 'Part used', part_delete: 'Part removed', customer_save: 'Customer location', task_insert: 'New task', task_update: 'Task ticked', task_comment: 'Task note', photo: 'Job photo' };
    el.innerHTML = `
      <h2>${Z.esc(Z.me.full_name)}</h2>
      <div class="card">
        <div class="row"><span class="pill brand">${Z.ROLE_NAMES[Z.me.role]}${Z.me.dept ? ' · ' + Z.esc(Z.me.dept) : ''}</span>${Z.me.area ? `<span class="pill">${Z.esc(Z.areaName(Z.me.area))}</span>` : ''}</div>
        <p class="hint">${navigator.onLine ? '🟢 Online' : '📴 Offline — your work is saved on this phone and sends when you have signal.'}</p>
      </div>
      <h3>Waiting to send (${p.length})</h3>
      <div class="card list">${p.length ? p.map((q) => `<div class="item"><div class="grow"><div class="t">${label[q.op] || q.op}</div><div class="m">${Z.when(q.at)}</div></div></div>`).join('') : '<div class="muted">Nothing waiting. Everything is sent.</div>'}
        ${p.length ? '<div style="margin-top:10px"><button class="btn sec small" id="me-send">Send now</button></div>' : ''}</div>
      ${f.length ? `<h3>Didn't send (${f.length})</h3><div class="card list">${f.map((q) => `<div class="item"><div class="grow"><div class="t">${label[q.op] || q.op} · ${Z.when(q.at)}</div><div class="m" style="color:var(--bad)">${Z.esc(q.err)}</div></div>
          <button class="btn sec small" data-retry="${q.qid}">Retry</button><button class="btn sec small" data-drop="${q.qid}">Discard</button></div>`).join('')}</div>` : ''}
      <h3>More</h3><div class="card list">
        <a class="item" href="#learn"><span style="font-size:22px">🎓</span><div class="grow"><div class="t">Learn Zuri</div><div class="m">Short videos for your job, and a practice area</div></div><span>›</span></a>
        <a class="item" href="#test"><span style="font-size:22px">🧪</span><div class="grow"><div class="t">Tester checklist</div><div class="m">Everything to try for your job — tick it, note what was wrong</div></div><span>›</span></a>
        ${Z.isAdmin() ? '<a class="item" href="#admin"><span style="font-size:22px">⚙️</span><div class="grow"><div class="t">Admin</div><div class="m">Switch people on, roles, areas, who sees what</div></div><span>›</span></a>' : ''}
        ${Z.isStaff() ? '<a class="item" href="#import"><span style="font-size:22px">📥</span><div class="grow"><div class="t">Bring in a file</div><div class="m">Customers or payments from the billing website (Excel)</div></div><span>›</span></a>' : ''}
      </div>
      <h3>Screen</h3>
      <div class="card"><div class="seg" id="me-theme">${[['auto', '📱 Like my phone'], ['light', '☀️ Light'], ['dark', '🌙 Dark']].map(([k, t]) => `<button type="button" data-theme="${k}" class="${Z.get('theme', 'auto') === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <p class="hint">Light is easiest to read in sunshine.</p></div>
      ${Z.practice ? `<h3>🎓 Practice mode</h3><div class="card">
        <p class="hint" style="margin-top:0">Everything here is pretend and stays on this phone. Break things — that's how you learn.</p>
        <div class="row"><button class="btn sec" id="pr-role">🔄 Try another job</button><button class="btn sec" id="pr-reset">🧹 Start over</button><a class="btn sec" href="${location.pathname}${(() => { try { return localStorage.getItem('zuri_from_training') ? '?training' : ''; } catch (e) { return ''; } })()}">🚪 Leave practice</a></div></div>` : ''}
      <div class="card"><button class="btn sec" id="me-out">Sign out</button> <span class="hint">Zuri System ${Z.version}</span></div>`;
    if (Z.practice) {
      Z.$('#pr-role', el).onclick = () => Z.logout();
      Z.$('#pr-reset', el).onclick = () => { if (!confirm('Throw away all practice changes and start again with fresh pretend data?')) return; window.ZP.reset(); location.reload(); };
    }
    Z.$$('#me-theme [data-theme]', el).forEach((b) => (b.onclick = () => { Z.set('theme', b.dataset.theme); Z.applyTheme(); Z.route(); }));
    const s = Z.$('#me-send', el); if (s) s.onclick = async () => { await Z.flush(); Z.route(); };
    Z.$('#me-out', el).onclick = () => {
      if (Z.pending().length && !confirm('Some work has not been sent yet. Signing out keeps it on this phone, but it only sends after you sign back in. Sign out?')) return;
      Z.logout();
    };
    Z.$$('[data-retry]', el).forEach((b) => (b.onclick = async () => { const it = Z.queue.find((q) => q.qid === b.dataset.retry); delete it.err; Z.saveQueue(); await Z.flush(); Z.route(); }));
    Z.$$('[data-drop]', el).forEach((b) => (b.onclick = () => {
      if (!confirm('Throw away this change? It will not be sent.')) return;
      const it = Z.queue.find((q) => q.qid === b.dataset.drop);
      if (it && it.op === 'photo') Z.idb.del(it.data.key).catch(() => {});
      Z.queue = Z.queue.filter((q) => q !== it); Z.saveQueue(); Z.syncBadge(); Z.route();
    }));
  };
})();
