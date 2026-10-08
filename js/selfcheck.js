// Zuri System · self-check: problems report themselves to the testers' board · v1 · 2026-10-06
// Jerry: "How can you check on your own if there is an issue?" Until now Claude only heard about a problem when a
// tester wrote. Now any crash, any file that fails to load, the "Zuri didn't finish loading" card and the invite-code
// screen each post one line to tester_log (kind 'note', step 'auto:…', note starts with 🤖), with the phone type and version.
// Same problem once per phone per day, at most five a visit. Long numbers and emails are blanked out. No signal → saved, sent later.
(function () {
  const C = window.ZURI_CONFIG && window.ZURI_CONFIG.training; if (!C) return;
  const PAGE = location.pathname.includes('/testers/') ? 'testers' : /[?&]training\b/.test(location.search) ? 'training' : /[?&]practice\b/.test(location.search) ? 'practice' : 'app';
  const ls = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const json = (k, d) => { try { return JSON.parse(ls(k) || 'null') || d; } catch (e) { return d; } };
  const ROLES = ['field', 'callcenter', 'finance', 'admin'];

  function who() {
    const me = json('zt_me', null), prof = json('zuri_me', null) || json('zuri_training_me', null);
    let role = (me && me.role) || (prof && prof.role) || ls('zuri_practice_role') || '';
    if (role === 'internal') role = 'finance';
    if (!ROLES.includes(role)) role = 'admin';
    return { name: String((me && me.name) || (prof && prof.full_name) || 'Unknown phone').slice(0, 60), role };
  }
  function phone() {
    const u = navigator.userAgent;
    const os = /iPhone|iPad/.test(u) ? 'iPhone/iPad iOS ' + ((u.match(/OS (\d+)_/) || [])[1] || '?')
      : /Android/.test(u) ? 'Android ' + ((u.match(/Android (\d+)/) || [])[1] || '?')
      : /Macintosh/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'other';
    const br = /FBAN|FBAV|Instagram|WhatsApp|; wv\)/.test(u) ? 'in-app browser'
      : /CriOS|Chrome\//.test(u) ? 'Chrome ' + ((u.match(/(?:CriOS|Chrome)\/(\d+)/) || [])[1] || '')
      : /Firefox|FxiOS/.test(u) ? 'Firefox' : /Safari/.test(u) ? 'Safari' : 'browser';
    return os + ' · ' + br + (navigator.onLine ? '' : ' · offline') + ' · ' + innerWidth + 'px';
  }
  const clean = (s) => String(s == null ? '' : s).replace(/\d{6,}/g, '#').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '@').slice(0, 500);

  let busy = false; // one send at a time, so a report never goes twice
  function flush() {
    const q = json('zsc_q', []); if (busy || !q.length || !navigator.onLine) return; busy = true;
    fetch(C.supabaseUrl + '/rest/v1/tester_log', { method: 'POST', keepalive: true, body: JSON.stringify(q),
      headers: { apikey: C.supabaseKey, Authorization: 'Bearer ' + C.supabaseKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' } })
      .then((r) => { if (r.ok) put('zsc_q', JSON.stringify(json('zsc_q', []).slice(q.length))); }).catch(() => {}).then(() => { busy = false; });
  }
  let sent = 0; const mem = new Set(); // memory too, in case this phone won't store anything
  function report(where, msg) {
    msg = clean(msg); if (!msg || /ResizeObserver loop/i.test(msg)) return;
    /* 8 Oct: Veronica's Firefox (iPhone) injects its own scripts into every page and they throw on their own — not Zuri's fault, not worth a report */
    if (/window\.ethereum|selectedAddress|__firefox__|user-script:|webkit-masked-url|^Script error\.?$/i.test(msg)) return;
    const day = new Date().toISOString().slice(0, 10), key = day + '|' + where + '|' + msg.slice(0, 120);
    const seen = json('zsc_seen', {}); if (seen[key] || mem.has(key) || sent >= 5) return; mem.add(key);
    Object.keys(seen).forEach((k) => { if (k.slice(0, 10) !== day) delete seen[k]; }); seen[key] = 1; put('zsc_seen', JSON.stringify(seen)); sent++;
    const w = who();
    const at = location.pathname.replace(/.*zuri-system/, '') + location.search.replace(/code=[^&]*/, 'code=…') + location.hash;
    const q = json('zsc_q', []);
    q.push({ tester: w.name, role: w.role, device: ls('zuri_device') || 'none', step: ('auto:' + PAGE + ':' + where).slice(0, 60), kind: 'note',
      note: ('🤖 Reported by Zuri itself — ' + msg + ' · ' + phone() + ' · ' + at).slice(0, 1000),
      version: String((window.Z && window.Z.version) || 'Zuri ' + PAGE).slice(0, 40) });
    put('zsc_q', JSON.stringify(q.slice(-20))); flush();
  }
  window.ZSC = { report };
  // capture phase: also sees a <script> or stylesheet that failed to arrive (those don't bubble)
  addEventListener('error', (e) => {
    const t = e.target;
    if (t && t !== window && (t.src || t.href)) { report('load', 'A file did not arrive: ' + String(t.src || t.href).split('?')[0].replace(/.*\//, '')); return; } 
    report('error', (e.message || 'error') + (e.filename ? ' @ ' + e.filename.replace(/.*\//, '') + ':' + e.lineno : ''));
  }, true);
  addEventListener('unhandledrejection', (e) => { const r = e.reason; report('error', 'Unhandled: ' + ((r && (r.message || r.error_description)) || r)); });
  addEventListener('online', flush); setTimeout(flush, 4000);
})();
