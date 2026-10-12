// Zuri System · the gate: an invite code before practice, the training copy and the Testers' List · v2 · 2026-10-01
// v2: the code can ride in the link (…/testers/?code=ZURI-TEST) so testers just tap — no typing.
// Codes live on the training database (Admin → Access codes). This phone remembers its code and re-checks it once a day,
// so weak signal doesn't lock anyone out. The real app keeps its ordinary login; this is for everything without one.
(function () {
  const C = window.ZURI_CONFIG && window.ZURI_CONFIG.training;
  const BUILD_EXPIRES = '2026-12-31';                     // this build of practice stops on this day unless the server extends it
  const ALLOWED = ['jerrywins1.github.io', 'localhost', '127.0.0.1'];
  const here = location.pathname.includes('/testers/') ? 'testers' : /[?&]training\b/.test(location.search) ? 'training' : /[?&]practice\b/.test(location.search) ? 'practice' : '';
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const get = () => { try { return JSON.parse(localStorage.getItem('zuri_gate') || 'null'); } catch (e) { return null; } };
  const put = (v) => { try { localStorage.setItem('zuri_gate', JSON.stringify(v)); } catch (e) {} };
  const device = (() => { try { let d = localStorage.getItem('zuri_device'); if (!d) { d = 'd' + Math.random().toString(36).slice(2, 12); localStorage.setItem('zuri_device', d); } return d; } catch (e) { return 'd' + Date.now(); } })();

  async function ask(code, extra = {}) {
    const r = await fetch(C.supabaseUrl + '/rest/v1/rpc/check_code', { method: 'POST', headers: { apikey: C.supabaseKey, Authorization: 'Bearer ' + C.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: code, p_device: device, p_name: extra.name || null, p_role: extra.role || null, p_app: here || extra.app || null, p_progress: extra.progress || null }) });
    if (!r.ok) throw new Error('check failed ' + r.status);
    return r.json();
  }
  const WORDS = { unknown: 'That code is not known. Check the letters, or ask Jerry.', revoked: 'That code has been switched off. Ask Jerry for a new one.', expired: 'That code has run out. Ask Jerry for a new one.', full: 'That code has been used on too many phones. Ask Jerry for a new one.' };

  let resolve; const ready = new Promise((r) => (resolve = r));
  window.ZG = { ready, code: () => (get() || {}).code || null, device, here,
    // the Testers' List and practice tell the gate who this is, so the code's use list has a name on it
    report: (extra) => { const g = get(); if (g && g.code && navigator.onLine) ask(g.code, extra).then((j) => { if (j && j.ok) put({ ...g, until: j.until, checked: today() }); }).catch(() => {}); } };
  if (!here || !C) { resolve(true); return; }

  if (!ALLOWED.includes(location.hostname)) { block('This copy of Zuri is not allowed to run here.', false); return; }

  // a link with ?code=XXXX carries the invite: check it, remember it, then take it out of the address bar
  const linked = (new URLSearchParams(location.search).get('code') || '').trim().toUpperCase();
  if (linked) {
    try { const u = new URL(location.href); u.searchParams.delete('code'); history.replaceState(null, '', u.pathname + (u.search.replace(/=(&|$)/g, '$1')) + u.hash); } catch (e) {}
    const had = get();
    if (!had || had.code !== linked) {
      ask(linked).then((j) => { if (j.ok) { put({ code: linked, until: j.until, label: j.label, checked: today() }); resolve(true); } else if (had && had.code) { start(); } else block(WORDS[j.reason] || 'This code does not work.', true); })
        .catch(() => start());
      return;
    }
  }
  start();

  function start() {
  const g = get();
  const fresh = g && g.code && g.checked === today() && g.until >= today();
  if (fresh) { resolve(true); return; }
  if (g && g.code) {
    // remembered code: re-check quietly; no signal → trust what we had if it hasn't run out
    ask(g.code).then((j) => { if (j.ok) { put({ code: g.code, until: j.until, label: j.label, checked: today() }); resolve(true); } else { put(null); block(WORDS[j.reason] || 'This code no longer works.', true); } })
      .catch(() => { if (g.until >= today() && today() <= BUILD_EXPIRES) resolve(true); else block('Zuri needs a connection to check your code. Try again when you have signal.', true); });
    return;
  }
  block(null, true);
  }

  function block(msg, canEnter) {
    document.addEventListener('DOMContentLoaded', () => draw(msg, canEnter));
    if (document.readyState !== 'loading') draw(msg, canEnter);
  }
  function draw(msg, canEnter) {
    try { window.ZSC && ZSC.report('gate', 'Stopped at the invite-code screen' + (msg ? ': ' + msg : ' (no code on this phone)')); } catch (e) {}
    if (document.getElementById('zgate')) { const m = document.getElementById('zgate-msg'); if (m && msg) m.textContent = msg; return; }
    const w = document.createElement('div'); w.id = 'zgate';
    w.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#F4F6F5;color:#152322;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;font:16px/1.45 -apple-system,"Segoe UI",Roboto,system-ui,sans-serif;overflow:auto';
    w.innerHTML = `<div style="width:100%;max-width:420px;background:#fff;border:1px solid #D8DFDC;border-radius:16px;padding:18px">
      <div style="font-size:26px;font-weight:800;color:#0F6E5C;margin-bottom:2px">Zuri System</div>
      <div style="color:#56645F;margin-bottom:14px">${here === 'testers' ? "The Testers' List" : here === 'training' ? 'The training copy' : 'Practice'} is by invitation.</div>
      ${canEnter ? `<label style="display:block;font-size:13px;font-weight:700;color:#3F4F4C;margin:10px 0 4px">Your invite code</label>
      <input id="zgate-in" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="e.g. ZURI-TEST" style="width:100%;box-sizing:border-box;font:inherit;font-size:20px;letter-spacing:.08em;text-transform:uppercase;padding:12px;border:1.5px solid #B9C4C0;border-radius:10px;background:#fff;color:#152322;color-scheme:light">
      <button id="zgate-go" style="width:100%;margin-top:10px;font:inherit;font-weight:800;font-size:16px;padding:13px;border:0;border-radius:10px;background:#0F6E5C;color:#fff;min-height:48px;cursor:pointer">Open Zuri</button>` : ''}
      <p id="zgate-msg" style="margin:12px 0 0;font-size:14px;color:${msg ? '#C0392B' : '#56645F'};font-weight:${msg ? '700' : '500'}">${msg || 'Jerry or a partner gives you the code. It is tied to this phone and runs out on a date.'}</p>
      <p style="margin:12px 0 0;font-size:13px;color:#56645F"><a href="https://jerrywins1.github.io/zuri-system/" style="color:#0F6E5C">Staff with an account: sign in here</a></p></div>`;
    document.body.appendChild(w);
    const go = document.getElementById('zgate-go'), inp = document.getElementById('zgate-in');
    if (!go) return;
    const submit = async () => {
      const code = (inp.value || '').trim().toUpperCase(); if (!code) return;
      go.disabled = true; go.textContent = 'Checking…';
      try {
        const j = await ask(code);
        if (j.ok) { put({ code, until: j.until, label: j.label, checked: today() }); w.remove(); resolve(true); }
        else { document.getElementById('zgate-msg').textContent = WORDS[j.reason] || 'This code does not work.'; document.getElementById('zgate-msg').style.color = '#C0392B'; }
      } catch (e) { document.getElementById('zgate-msg').textContent = 'Could not check the code — is there signal?'; }
      go.disabled = false; go.textContent = 'Open Zuri';
    };
    go.onclick = submit; inp.onkeydown = (e) => { if (e.key === 'Enter') submit(); }; setTimeout(() => inp.focus(), 200);
  }
})();
