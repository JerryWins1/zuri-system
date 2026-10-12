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
    const sum = await Z.testerSummary().catch(() => null);
    el.innerHTML = `
      <h2>🧪 Testing Zuri</h2>
      <div class="card" style="border-left:4px solid var(--accent)" id="test-head">
        <b>Your Testers' List is one page, one step at a time.</b>
        <p class="hint" style="margin:4px 0 10px">It walks you through the videos, the things to try for your job, joining the training copy, and how to tell us what you found. Tick each step there; your ticks and notes reach Jerry and Claude straight away.</p>
        <div class="row"><a class="btn" href="testers/" id="test-open">🧪 Open my Testers' List</a><button class="btn sec small" id="test-video">▶ How to test (2 min)</button>${Z.isAdmin() ? '<a class="btn sec small" href="testers/?board" target="_blank" rel="noopener">📊 Everyone\'s progress</a>' : ''}</div>
      </div>
      <div class="card" id="test-fs"><b>🎙 Talking is the best report.</b><p class="hint" style="margin:4px 0 0">Open Zuri inside <b>Feedback Studio</b> (the Testers' List has the link), press the red button and say what you think as you go. Point at anything wrong. At the end: <b>I'm done → Send to Claude</b>.</p></div>
      ${sum && sum.total ? `<p class="hint">Earlier ticks on this phone: ${sum.done} of ${sum.total}. The Testers' List keeps its own count.</p>` : ''}`;
    Z.$('#test-video', el).onclick = () => Z.learn('howtest');
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
