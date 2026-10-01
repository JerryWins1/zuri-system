// Zuri System · Tester checklist: everything to try, tick it, say what was wrong · v1 · 2026-10-01
// Ticks are shared (tester_checks) so the partners see everyone's progress; in practice they stay on the phone.
(function () {
  const Z = window.Z;
  const LIST = () => window.ZURI_CHECKLIST || [];
  const must = (r) => { if (r.error) throw r.error; return r.data; };
  const forPerson = (g, p) => (g.roles.includes(p.role)) && (!g.dept || p.role === 'admin' || p.dept === g.dept);
  const mine = () => LIST().filter((g) => forPerson(g, Z.me));
  const total = (groups) => groups.reduce((t, g) => t + g.items.length, 0);

  async function loadTicks() {
    if (Z.practice) return Z.get('ticks', {});
    try {
      const rows = must(await Z.sb.from('tester_checks').select('item,done,note,at').eq('profile_id', Z.me.id));
      const o = {}; rows.forEach((r) => (o[r.item] = r)); Z.set('ticks_cache', o); return o;
    } catch (e) { if (Z.isNet(e)) return Z.get('ticks_cache', {}); throw e; }
  }
  async function saveTick(item, done, note) {
    const row = { item, done, note: note || null, at: new Date().toISOString() };
    if (Z.practice) { const t = Z.get('ticks', {}); t[item] = row; Z.set('ticks', t); return; }
    const { error } = await Z.sb.from('tester_checks').upsert({ profile_id: Z.me.id, ...row }, { onConflict: 'profile_id,item' });
    if (error) throw error;
    const c = Z.get('ticks_cache', {}); c[item] = row; Z.set('ticks_cache', c);
  }
  // Used by the My day card.
  Z.testerSummary = async () => { const g = mine(); const t = await loadTicks(); return { done: g.reduce((n, x) => n + x.items.filter((i) => t[i.id] && t[i.id].done).length, 0), total: total(g) }; };

  Z.routes.test = async (args, el) => {
    if (args[0] === 'board' && Z.isAdmin()) return board(el);
    const ticks = await loadTicks();
    const groups = mine();
    const done = groups.reduce((n, g) => n + g.items.filter((i) => ticks[i.id] && ticks[i.id].done).length, 0);
    const all = total(groups);
    el.innerHTML = `
      <h2>🧪 Tester checklist</h2>
      <div class="card" style="border-left:4px solid var(--accent)" id="test-head">
        <div class="row" style="justify-content:space-between"><b>Try every line for your job. Tick it. Say what was wrong.</b><span class="pill ${done === all ? 'ok' : 'brand'}" id="test-progress">${done} of ${all}</span></div>
        <div class="bar" style="height:8px;background:var(--surface-2);border-radius:99px;overflow:hidden;margin:8px 0"><i style="display:block;height:100%;width:${all ? Math.round((done / all) * 100) : 0}%;background:var(--ok)"></i></div>
        <div class="row"><button class="btn small" id="test-video">▶ How to test (2 min)</button><a class="btn sec small" href="guides/testers.html" target="_blank" rel="noopener">🖨 Print the list</a>${Z.isAdmin() ? '<a class="btn sec small" href="#test/board">📊 Everyone\'s progress</a>' : ''}</div>
      </div>
      <div class="card" id="test-fs"><b>🎙 Talking is the best report.</b><p class="hint" style="margin:4px 0 0">If you opened Zuri inside <b>Feedback Studio</b>, press the red button and say what you think as you go. Point at anything wrong. At the end: <b>I'm done → Send to Claude</b>. Not in Feedback Studio? Use the 📝 Note on each line.</p></div>
      <div id="test-list">${groups.map((g) => `<h3>${Z.esc(g.label)} · ${g.items.filter((i) => ticks[i.id] && ticks[i.id].done).length} of ${g.items.length}</h3>
        <div class="card list">${g.items.map((i) => { const t = ticks[i.id] || {}; return `
          <div class="item" data-item="${i.id}" style="align-items:flex-start;flex-wrap:wrap">
            <input type="checkbox" class="tk-tick" aria-label="Done: ${Z.esc(i.t)}" ${t.done ? 'checked' : ''} style="margin-top:4px">
            <div class="grow" style="min-width:220px"><div class="t" style="${t.done ? 'opacity:.6' : ''}">${Z.esc(i.t)}</div><div class="m">${Z.esc(i.how)}</div>
              <div class="row" style="margin-top:6px">${i.lesson ? `<button class="btn sec small tk-show" data-lesson="${i.lesson}">▶ Show me</button>` : ''}<button class="btn sec small tk-note">📝 ${t.note ? 'Edit note' : 'Note'}</button></div>
              ${t.note ? `<div class="hint" style="margin:4px 0 0">📝 ${Z.esc(t.note)}</div>` : ''}
              <div class="tk-notebox" hidden><textarea rows="2" placeholder="What was wrong, confusing or slow?">${Z.esc(t.note || '')}</textarea><div class="row" style="margin-top:6px"><button class="btn small tk-save">Save note</button></div></div>
            </div></div>`; }).join('')}</div>`).join('')}</div>`;
    Z.$('#test-video', el).onclick = () => Z.learn('howtest');
    Z.$$('.tk-show', el).forEach((b) => (b.onclick = () => Z.learn(b.dataset.lesson)));
    Z.$$('.tk-tick', el).forEach((cb) => (cb.onchange = async () => {
      const box = cb.closest('[data-item]'); const id = box.dataset.item;
      try { await saveTick(id, cb.checked, (ticks[id] || {}).note); ticks[id] = { ...(ticks[id] || {}), done: cb.checked }; Z.toast(cb.checked ? 'Ticked ✓' : 'Unticked.'); Z.route(); }
      catch (e) { cb.checked = !cb.checked; Z.fail(e); }
    }));
    Z.$$('.tk-note', el).forEach((b) => (b.onclick = () => { const nb = Z.$('.tk-notebox', b.closest('[data-item]')); nb.hidden = !nb.hidden; if (!nb.hidden) Z.$('textarea', nb).focus(); }));
    Z.$$('.tk-save', el).forEach((b) => (b.onclick = async () => {
      const box = b.closest('[data-item]'); const id = box.dataset.item; const note = Z.$('textarea', box).value.trim();
      try { await saveTick(id, !!(ticks[id] && ticks[id].done), note); Z.toast('Note saved — thank you.'); Z.route(); } catch (e) { Z.fail(e); }
    }));
  };

  // The partners' view: who has done what, and every note.
  async function board(el) {
    const [rows, people] = await Promise.all([must(await Z.sb.from('tester_checks').select('*').order('at', { ascending: false })), Promise.resolve(Z.ref.people.filter((p) => p.active))]);
    const byP = {}; rows.forEach((r) => ((byP[r.profile_id] = byP[r.profile_id] || {})[r.item] = r));
    const title = (id) => { for (const g of LIST()) for (const i of g.items) if (i.id === id) return i.t; return id; };
    el.innerHTML = `
      <p style="margin:0 0 6px"><a href="#test">← Checklist</a></p><h2>📊 Testers' progress</h2>
      <div class="card list">${people.map((p) => { const g = LIST().filter((x) => forPerson(x, p)); const all = total(g); const d = g.reduce((n, x) => n + x.items.filter((i) => byP[p.id] && byP[p.id][i.id] && byP[p.id][i.id].done).length, 0);
        return `<div class="item"><div class="grow"><div class="t">${Z.esc(p.full_name)}</div><div class="m">${Z.ROLE_NAMES[p.role]}${p.dept ? ' · ' + Z.esc(p.dept) : ''} · ${d} of ${all}</div></div><span class="pill ${d === all && all ? 'ok' : d ? 'brand' : ''}">${all ? Math.round((d / all) * 100) : 0}%</span></div>`; }).join('')}</div>
      <h3>Notes from testers · ${rows.filter((r) => r.note).length}</h3>
      <div class="card list">${rows.filter((r) => r.note).map((r) => `<div class="item"><div class="grow"><div class="t">${Z.esc(r.note)}</div><div class="m">${Z.esc(Z.personName(r.profile_id) || 'Someone')} · ${Z.esc(title(r.item))} · ${Z.when(r.at)}</div></div></div>`).join('') || '<div class="muted">No notes yet.</div>'}</div>`;
  }
})();
