// Zuri System · Admin → Access codes: make, watch and revoke invite codes · v2 · 2026-10-01
// Codes live on the training database, so this page works on the training copy (partners only).
(function () {
  const Z = window.Z;
  const must = (r) => { if (r.error) throw r.error; return r.data; };
  const KINDS = [['tester', 'Tester'], ['demo', 'Demo / trial'], ['staff', 'Staff']];
  const mk = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return 'ZURI-' + s; };
  Z.adminSubs.push(['codes', 'Access codes']);
  Z.adminViews.codes = async (el) => {
    if (!Z.isAdmin()) { el.innerHTML = '<div class="card">Only partners can manage access codes.</div>'; return; }
    if (!Z.training && !Z.practice) { el.innerHTML = `<div class="card"><b>Access codes are managed on the training copy.</b><p class="hint">Codes gate practice, the Testers' List and the training copy; the real app keeps its logins.</p><a class="btn" href="${location.pathname}?training#admin/codes">Open the training copy</a></div>`; return; }
    const [codes, uses] = await Promise.all([must(await Z.sb.from('access_codes').select('*').order('created_at', { ascending: false })), must(await Z.sb.from('code_uses').select('*').order('last_seen', { ascending: false }))]);
    const today = Z.ymd();
    const usesOf = (c) => uses.filter((u) => u.code === c);
    el.innerHTML = `
      <p class="hint" style="margin-top:0">A code lets a phone into practice, the Testers' List and the training copy. Each code has a label, an end date and a limit of phones. Revoke it and those phones stop the next time they open Zuri.</p>
      <form class="card" id="ac"><div class="grid3">
        <div><label>Code</label><input name="code" value="${mk()}" autocapitalize="characters" required></div>
        <div><label>Label (who it's for)</label><input name="label" required placeholder="e.g. October testers"></div>
        <div><label>Kind</label><select name="kind">${Z.opts(KINDS)}</select></div>
        <div><label>Valid for (days)</label><input name="days" type="number" min="1" max="730" value="30"></div>
        <div><label>Phones allowed</label><input name="max_uses" type="number" min="1" max="1000" value="10"></div>
        <div style="align-self:end"><button class="btn block">＋ Make the code</button></div></div></form>
      <div class="card list">${codes.map((c) => { const u = usesOf(c.code); const dead = !c.active || c.expires_at < today; return `
        <div class="item" style="align-items:flex-start;flex-wrap:wrap" data-code="${c.code}">
          <div class="grow" style="min-width:200px"><div class="t" style="font-family:ui-monospace,Menlo,monospace;letter-spacing:.06em">${Z.esc(c.code)} ${dead ? '<span class="pill bad">' + (c.active ? 'ran out' : 'revoked') + '</span>' : '<span class="pill ok">live</span>'}</div>
            <div class="m">${Z.esc(c.label)} · ${(KINDS.find((k) => k[0] === c.kind) || [])[1]} · until ${Z.day(c.expires_at)} · ${u.length} of ${c.max_uses} phones</div>
            ${u.length ? `<div class="hint" style="margin:4px 0 0">${u.map((x) => `${Z.esc(x.name || 'no name yet')}${x.role ? ' · ' + Z.esc(x.role) : ''}${x.app ? ' · ' + Z.esc(x.app) : ''} · last ${Z.when(x.last_seen)}`).join('<br>')}</div>` : ''}</div>
          <div class="row">${c.active ? `<button class="btn sec small" data-share="${c.code}">📋 Copy</button><button class="btn sec small" data-extend="${c.code}">＋30 days</button><button class="btn sec small" data-revoke="${c.code}">Revoke</button>` : `<button class="btn sec small" data-restore="${c.code}">Switch on</button>`}</div></div>`; }).join('') || '<div class="empty">No codes yet.</div>'}</div>`;
    Z.$('#ac', el).onsubmit = async (e) => {
      e.preventDefault(); const d = Z.formData(e.target);
      const code = d.code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      const until = new Date(); until.setDate(until.getDate() + (parseInt(d.days, 10) || 30));
      const { error } = await Z.sb.from('access_codes').insert({ code, label: d.label.trim(), kind: d.kind, expires_at: Z.ymd(until), max_uses: parseInt(d.max_uses, 10) || 10, created_by: Z.me.full_name });
      if (error) return Z.toast(/duplicate|unique/i.test(error.message) ? 'That code already exists — make another.' : Z.errText(error));
      Z.toast('Code made: ' + code); Z.route();
    };
    const upd = async (code, patch, msg) => { const { error } = await Z.sb.from('access_codes').update(patch).eq('code', code); if (error) return Z.fail(error); Z.toast(msg); Z.route(); };
    Z.$$('[data-revoke]', el).forEach((b) => (b.onclick = () => { if (confirm('Switch off ' + b.dataset.revoke + '? Those phones stop next time they open Zuri.')) upd(b.dataset.revoke, { active: false }, 'Revoked.'); }));
    Z.$$('[data-restore]', el).forEach((b) => (b.onclick = () => { const u = new Date(); u.setDate(u.getDate() + 30); upd(b.dataset.restore, { active: true, expires_at: Z.ymd(u) }, 'Switched on for 30 days.'); }));
    Z.$$('[data-extend]', el).forEach((b) => (b.onclick = () => { const c = codes.find((x) => x.code === b.dataset.extend); const u = new Date(c.expires_at + 'T12:00:00'); u.setDate(u.getDate() + 30); upd(c.code, { expires_at: Z.ymd(u) }, 'Extended to ' + Z.day(Z.ymd(u)) + '.'); }));
    Z.$$('[data-share]', el).forEach((b) => (b.onclick = () => navigator.clipboard.writeText(`Karibu to Zuri! Tap this link — your invite code ${b.dataset.share} is already inside it: https://jerrywins1.github.io/zuri-system/testers/?code=${b.dataset.share}`).then(() => Z.toast('Copied — paste it into WhatsApp.'), () => Z.toast(b.dataset.share))));
  };
})();
