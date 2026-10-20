// Zuri System · 🚀 Getting ready: the partners' go-live list, one step at a time · v1 · 2026-10-20 (app v2.48)
// Jerry (20 Oct): Dickson thinks "we can just start running it" — but first a true database, the money starting point,
// both billing websites, WhatsApp groups and a home for files. "Present them the whole list, but then give them a list one
// by one … be patient with the boys."
// The steps live in golive_data.js (the printable guide reads the same list). Ticks are shared between the partners:
// they are kept in settings → 'golive' (one row Jerry copies across when the live database is rebuilt). If this phone
// can't save there, the tick is kept on this phone and the screen says so.
// #golive → your next step · #golive/all → the whole list · #golive/s/<id> → one step.
(function () {
  const Z = window.Z;
  const G = () => window.ZURI_GOLIVE;
  const KEY = 'golive';
  const blank = () => ({ done: {}, later: {}, stuck: {}, who: {} });
  const CHEER = ['Nice work 🙌 One more down.', 'Done ✅ No rush on the next one.', 'Good. Small steps get there.', 'That is one less thing to carry. Well done.', 'Asante! The list just got shorter.'];
  const can = () => Z.isStaff();

  // ---------- shared state ----------
  let S = null, localOnly = false;
  async function load() {
    try {
      const { data, error } = await Z.sb.from('settings').select('value').eq('key', KEY).maybeSingle();
      if (error) throw error;
      S = { ...blank(), ...((data && data.value) || {}) };
      const mine = Z.get('golive_local', null); // ticks this phone could not share last time: keep them
      if (mine) { ['done', 'later', 'stuck', 'who'].forEach((k) => (S[k] = { ...S[k], ...(mine[k] || {}) }));
        // …and try to share them now that Zuri answers
        const { error: e2 } = await Z.sb.from('settings').upsert({ key: KEY, value: S }, { onConflict: 'key' });
        if (!e2) { Z.set('golive_local', null); localOnly = false; } }
      Z.set('golive_cache', S);
    } catch (e) { S = { ...blank(), ...Z.get('golive_cache', {}), ...(Z.get('golive_local', {}) || {}) }; }
    return S;
  }
  // Read the newest copy, change one thing, write it back — so two partners ticking on two phones don't undo each other.
  async function change(fn) {
    let cur = null;
    try { const { data, error } = await Z.sb.from('settings').select('value').eq('key', KEY).maybeSingle(); if (error) throw error; cur = { ...blank(), ...((data && data.value) || {}) }; } catch (e) { cur = null; }
    const base = cur || S || blank();
    fn(base);
    S = base; Z.set('golive_cache', S);
    try {
      if (!cur) throw new Error('offline');
      const { error } = await Z.sb.from('settings').upsert({ key: KEY, value: base }, { onConflict: 'key' });
      if (error) throw error;
      localOnly = false; Z.set('golive_local', null);
    } catch (e) { localOnly = true; Z.set('golive_local', base); }
  }

  // ---------- helpers ----------
  const step = (id) => G().steps.find((s) => s.id === id);
  const part = (n) => G().parts.find((p) => p.n === n);
  const ownerOf = (s) => (S.who && S.who[s.id]) || s.who;
  const nameOf = (w) => G().people[w] || w;
  const isMine = (s, me) => me === 'all' || ownerOf(s) === me || (ownerOf(s) === 'DK' && (me === 'D' || me === 'K'));
  const needs = (s) => (G().after[s.id] || []).filter((x) => !S.done[x]);
  const ready = (s) => !needs(s).length;
  const meGuess = () => {
    const n = String((Z.me && Z.me.full_name) || '').toLowerCase();
    return /dickson/.test(n) ? 'D' : /kelvin/.test(n) ? 'K' : /jerry/.test(n) ? 'J' : 'all';
  };
  const meNow = () => Z.get('golive_me', '') || meGuess();
  // My line: ready steps in list order, then the ones put off (oldest "later" first). Stuck and waiting ones are listed apart.
  function queue(me) {
    const open = G().steps.filter((s) => !S.done[s.id] && isMine(s, me));
    const go = open.filter((s) => ready(s) && !S.stuck[s.id]);
    const now = go.filter((s) => !S.later[s.id]);
    const later = go.filter((s) => S.later[s.id]).sort((a, b) => String(S.later[a.id]).localeCompare(String(S.later[b.id])));
    return { line: now.concat(later), stuck: open.filter((s) => S.stuck[s.id]), waiting: open.filter((s) => !ready(s) && !S.stuck[s.id]) };
  }
  const counts = (me) => { const all = G().steps.filter((s) => isMine(s, me)); return { done: all.filter((s) => S.done[s.id]).length, all: all.length }; };
  const bar = (d, a) => `<div style="height:10px;border-radius:99px;background:var(--line);overflow:hidden;margin:6px 0"><div style="height:100%;width:${a ? Math.round((d / a) * 100) : 0}%;background:var(--brand)"></div></div>`;
  const whoChip = (s) => `<span class="pill ${ownerOf(s) === 'J' ? 'warn' : 'brand'}">👤 ${Z.esc(nameOf(ownerOf(s)))}</span>`;
  const minsTxt = (m) => (!m ? '' : m >= 120 ? `about ${Math.round(m / 60)} hours` : m >= 60 ? `about ${m === 60 ? 'an hour' : Math.round(m / 60 * 2) / 2 + ' hours'}` : `about ${m} min`);
  const ic = (s) => (S.done[s.id] ? '✅' : S.stuck[s.id] ? '🆘' : !ready(s) ? '⏳' : S.later[s.id] ? '⏭' : '⬜');

  // ---------- one step, in full ----------
  function stepCard(s, opts = {}) {
    const p = part(s.part), d = S.done[s.id], st = S.stuck[s.id], wait = needs(s);
    return `<div class="card" id="gl-step" style="border-left:5px solid ${d ? 'var(--ok)' : st ? 'var(--bad)' : 'var(--brand)'}">
      <div class="row" style="justify-content:space-between;gap:6px"><span class="hint" style="margin:0">${p.ic} Part ${p.n} · ${Z.esc(p.title)}</span><span class="hint" style="margin:0">Step ${Z.esc(s.id)}</span></div>
      <h3 style="margin:6px 0 4px;text-transform:none;letter-spacing:0;font-size:20px" id="gl-title">${Z.esc(s.t)}</h3>
      <div class="row" style="gap:6px">${whoChip(s)}${s.mins ? `<span class="pill">⏱ ${minsTxt(s.mins)}</span>` : ''}${s.gate ? '<span class="pill warn">🚦 check before going on</span>' : ''}</div>
      ${d ? `<div class="alert ok" style="margin-top:8px">✅ Done by ${Z.esc(d.by || '')} · ${Z.esc(Z.when(d.at))}${d.note ? `<br>📝 ${Z.esc(d.note)}` : ''}</div>` : ''}
      ${st && !d ? `<div class="alert bad" style="margin-top:8px">🆘 Stuck · ${Z.esc(st.by || '')} · ${Z.esc(Z.when(st.at))}<br>${Z.esc(st.note || '')}</div>` : ''}
      ${wait.length && !d ? `<div class="alert warn" style="margin-top:8px">⏳ This one waits for ${wait.map((x) => `<a href="#golive/s/${x}">${x} ${Z.esc(step(x).t)}</a> (${Z.esc(nameOf(ownerOf(step(x))))})`).join(', ')}.</div>` : ''}
      <p id="gl-why" style="margin:10px 0 4px"><b>Why:</b> ${Z.esc(s.why)}</p>
      <div id="gl-how"><b>How:</b><ol style="margin:4px 0 4px 20px;padding:0">${s.how.map((h) => `<li style="margin:4px 0">${Z.esc(h)}</li>`).join('')}</ol></div>
      ${s.copy ? `<div class="card" style="background:var(--brand-soft);white-space:pre-wrap;font-size:14px" id="gl-copytext">${Z.esc(s.copy)}</div><button class="btn sec small" id="gl-copy">📋 Copy the message</button>` : ''}
      ${s.link ? `<a class="btn sec small" href="${Z.esc(s.link)}" id="gl-open">Open it in Zuri →</a>` : ''}
      <p id="gl-donewhen" style="margin:10px 0 4px"><b>Done when:</b> ${Z.esc(s.done)}</p>
      ${opts.buttons === false ? '' : d ? `<div class="row" style="margin-top:10px"><button class="btn sec small" id="gl-undo">↩ Not done after all</button></div>` : `
      <div class="row" style="margin-top:12px;gap:8px">
        <button class="btn" id="gl-done" ${wait.length ? 'disabled' : ''}>✅ Done</button>
        ${opts.line ? '<button class="btn sec" id="gl-later">⏭ Later</button>' : ''}
        <button class="btn sec" id="gl-stuck">${st ? '🆘 Update / unstick' : '🆘 I\'m stuck'}</button>
        <button class="btn sec small" id="gl-task">📌 Put it in Tasks</button>
      </div>`}
      ${opts.who !== false ? `<details style="margin-top:10px"><summary class="hint" style="cursor:pointer">👤 Change who does this step</summary>
        <select id="gl-who" style="margin-top:6px">${Z.opts(['D', 'K', 'DK', 'J'].map((k) => [k, nameOf(k)]), ownerOf(s))}</select></details>` : ''}
    </div>`;
  }

  function wire(el, s, after) {
    const b = (id) => Z.$('#' + id, el);
    if (b('gl-copy')) b('gl-copy').onclick = async () => { try { await navigator.clipboard.writeText(s.copy); Z.toast('Copied — paste it in WhatsApp.'); } catch (e) { Z.toast('Could not copy on this phone — press and hold the message to copy it.'); } };
    if (b('gl-done')) b('gl-done').onclick = () => noteSheet('✅ ' + s.t, 'Anything to remember? (optional — a date, a number, a name)', 'Save as done', async (note) => {
      await change((x) => { x.done[s.id] = { by: whoAmI(), at: new Date().toISOString(), note: note || null }; delete x.stuck[s.id]; delete x.later[s.id]; });
      Z.toast((localOnly ? '📱 Saved on this phone only — it shares when the signal is back. ' : '') + CHEER[Math.floor(Math.random() * CHEER.length)]);
      after();
    });
    if (b('gl-later')) b('gl-later').onclick = async () => { await change((x) => { x.later[s.id] = new Date().toISOString(); }); Z.toast('⏭ Moved to the back of your line. That is fine.'); after(); };
    if (b('gl-stuck')) b('gl-stuck').onclick = () => noteSheet('🆘 ' + s.t, 'What is in the way? One line is enough. Jerry sees it on 🏢 HQ.', S.stuck[s.id] ? 'Save' : 'Ask for help', async (note) => {
      if (!note && S.stuck[s.id]) { await change((x) => { delete x.stuck[s.id]; }); Z.toast('Unstuck. 👍'); return after(); }
      if (!note) return Z.toast('Write one line about what is in the way.');
      await change((x) => { x.stuck[s.id] = { by: whoAmI(), at: new Date().toISOString(), note }; });
      Z.toast('🆘 Noted. You can carry on with your next step meanwhile.'); after();
    }, S.stuck[s.id] ? S.stuck[s.id].note : '', S.stuck[s.id] ? 'Empty the box and Save to say it is solved.' : '');
    if (b('gl-undo')) b('gl-undo').onclick = async () => { await change((x) => { delete x.done[s.id]; }); Z.toast('Back on the list.'); after(); };
    if (b('gl-who')) b('gl-who').onchange = async (e) => { const v = e.target.value; await change((x) => { if (v === s.who) delete x.who[s.id]; else x.who[s.id] = v; }); Z.toast('This step is now ' + nameOf(v) + '\'s.'); after(); };
    if (b('gl-task')) b('gl-task').onclick = () => toTasks(s);
  }
  const whoAmI = () => (Z.me && String(Z.me.full_name || '').split(/\s+/)[0]) || 'someone';

  function noteSheet(title, ask, go, fn, value = '', hint = '') {
    const sh = Z.sheet(title, `<label for="gl-note">${Z.esc(ask)}</label><textarea id="gl-note" rows="3">${Z.esc(value || '')}</textarea>${hint ? `<p class="hint">${Z.esc(hint)}</p>` : ''}
      <div style="height:10px"></div><button class="btn block" id="gl-note-go">${Z.esc(go)}</button>`);
    Z.$('#gl-note-go', sh.el).onclick = async () => { const v = Z.$('#gl-note', sh.el).value.trim(); sh.close(); await fn(v); };
  }

  // 📌 the step becomes a normal task (due in a week) for whoever owns it — it links back here.
  function toTasks(s) {
    const own = ownerOf(s), ppl = Z.ref.people || [];
    const pick = (re) => (ppl.find((p) => p.active !== false && re.test(p.full_name || '')) || {}).id;
    const to = own === 'D' ? pick(/dickson/i) : own === 'K' ? pick(/kelvin/i) : own === 'J' ? pick(/jerry/i) : Z.me.id;
    const row = { id: Z.uuid(), title: `🚀 ${s.id} ${s.t}`.slice(0, 200), details: `${s.why}\nDone when: ${s.done}`, priority: 'normal', visibility: 'team', created_by: Z.me.id,
      assigned_to: to || Z.me.id, due_date: Z.ymd(new Date(Date.now() + 7 * 864e5)), link_type: 'page', link_ref: 'golive/s/' + s.id };
    if (!Z.enqueue('task_insert', { row })) return;
    Z.toast(`📌 In ${to && to !== Z.me.id ? nameOf(own) + '\'s' : 'your'} Tasks, due in a week.`);
  }

  // ---------- the pages ----------
  Z.routes.golive = async (args, el) => {
    if (!can()) { el.innerHTML = '<div class="card">🚀 Getting ready is for the partners and the office.</div>'; return; }
    if (!G()) { el.innerHTML = '<div class="card">The list did not load. Refresh the page.</div>'; return; }
    el.innerHTML = '<div class="card muted">Loading…</div>';
    await load();
    const view = args[0] === 'all' ? 'all' : args[0] === 's' && step(args[1]) ? 'step' : 'next';
    const me = meNow();
    const tot = { done: G().steps.filter((s) => S.done[s.id]).length, all: G().steps.length };
    const head = `
      <div class="row" style="justify-content:space-between;align-items:baseline"><h2 style="margin-bottom:0">🚀 Getting ready</h2>
        <a class="hint" href="guides/golive.html" target="_blank" rel="noopener" id="gl-print">🖨 Print the list</a></div>
      <div class="card" id="gl-head" style="padding:10px 12px"><div class="row" style="justify-content:space-between"><b>${tot.done} of ${tot.all} steps done</b><span class="hint" style="margin:0">${Z.practice ? 'practice · ' : ''}${G().version}</span></div>${bar(tot.done, tot.all)}
        <div class="hint" style="margin:0">${Z.esc(G().pace)}</div></div>
      ${localOnly || Z.get('golive_local', null) ? '<div class="alert warn">📱 Some ticks are saved on this phone only. They share with the other partner when this phone can reach Zuri again.</div>' : ''}
      <div class="row" style="gap:6px;margin:8px 0" id="gl-tabs">
        <a class="btn ${view === 'next' ? '' : 'sec'} small" href="#golive" id="gl-tab-next">👣 One step at a time</a>
        <a class="btn ${view === 'all' ? '' : 'sec'} small" href="#golive/all" id="gl-tab-all">📋 The whole list</a></div>`;

    if (view === 'step') {
      const s = step(args[1]);
      el.innerHTML = head + stepCard(s) + `<a href="#golive/all" class="hint">← The whole list</a>`;
      return wire(el, s, () => Z.route());
    }

    if (view === 'all') {
      el.innerHTML = head + `
        <details class="card" id="gl-rules"><summary style="cursor:pointer"><b>How this list works</b> (7 short rules)</summary><ol style="margin:6px 0 0 20px;padding:0">${G().rules.map((r) => `<li style="margin:4px 0">${Z.esc(r)}</li>`).join('')}</ol></details>
        <div class="hint">✅ done · ⬜ ready · ⏳ waits for another step · ⏭ put off · 🆘 stuck. Tap a step to open it.</div>
        ${G().parts.map((p) => {
          const ss = G().steps.filter((s) => s.part === p.n), dn = ss.filter((s) => S.done[s.id]).length;
          return `<div class="card list" id="gl-part-${p.n}"><div class="row" style="justify-content:space-between;gap:6px"><b>${p.ic} ${p.n} · ${Z.esc(p.title)}</b><span class="pill ${dn === ss.length ? 'ok' : ''}">${dn}/${ss.length}</span></div>
            <div class="hint" style="margin:2px 0 4px">${Z.esc(p.aim)} · ${Z.esc(p.blurb)}</div>
            ${ss.map((s) => `<a class="item" href="#golive/s/${s.id}" data-step="${s.id}"><span style="font-size:20px">${ic(s)}</span><div class="grow"><div class="t" style="${S.done[s.id] ? 'text-decoration:line-through;opacity:.7' : ''}">${s.id} · ${Z.esc(s.t)}</div>
              <div class="m">${Z.esc(nameOf(ownerOf(s)))}${s.mins ? ' · ' + minsTxt(s.mins) : ''}${S.done[s.id] ? ' · done by ' + Z.esc(S.done[s.id].by || '') : ''}${S.stuck[s.id] ? ' · 🆘 ' + Z.esc(S.stuck[s.id].note || '') : ''}</div></div><span>›</span></a>`).join('')}</div>`;
        }).join('')}`;
      return;
    }

    // 👣 one step at a time, for one person
    const q = queue(me), c = counts(me), s = q.line[0];
    el.innerHTML = head + `
      <label for="gl-me" style="margin-top:0">Whose list?</label>
      <select id="gl-me">${Z.opts([['D', '🔧 Dickson'], ['K', '💰 Kelvin'], ['J', '🧑‍💻 Jerry'], ['all', '👥 Everyone\'s steps']], me)}</select>
      <div class="hint" id="gl-mine">${me === 'all' ? 'All steps' : Z.esc(nameOf(me)) + '\'s steps (and the ones you do together)'}: <b>${c.done} of ${c.all} done</b>.</div>
      ${s ? `<h3>Your next step</h3>${stepCard(s, { line: true, who: false })}` : `<div class="alert ok" id="gl-clear">🎉 ${q.stuck.length || q.waiting.length ? 'Nothing for you to do right now — the rest waits for someone else.' : 'Every step on this list is done. Well done!'}</div>`}
      ${q.line.length > 1 ? `<h3>After that</h3><div class="card list" id="gl-after">${q.line.slice(1, 3).map((x) => `<a class="item" href="#golive/s/${x.id}"><span>${ic(x)}</span><div class="grow"><div class="t">${x.id} · ${Z.esc(x.t)}</div><div class="m">${minsTxt(x.mins)}</div></div></a>`).join('')}
        ${q.line.length > 3 ? `<div class="hint" style="margin:6px">…and ${q.line.length - 3} more. No need to look at them yet.</div>` : ''}</div>` : ''}
      ${q.stuck.length ? `<h3>Waiting for help</h3><div class="card list" id="gl-stucklist">${q.stuck.map((x) => `<a class="item" href="#golive/s/${x.id}"><span>🆘</span><div class="grow"><div class="t">${x.id} · ${Z.esc(x.t)}</div><div class="m">${Z.esc(S.stuck[x.id].note || '')}</div></div></a>`).join('')}</div>` : ''}
      ${q.waiting.length ? `<details class="card" id="gl-waiting"><summary style="cursor:pointer">⏳ ${q.waiting.length} of your steps wait for another step first</summary><div class="list">${q.waiting.slice(0, 8).map((x) => `<a class="item" href="#golive/s/${x.id}"><div class="grow"><div class="t">${x.id} · ${Z.esc(x.t)}</div><div class="m">needs ${needs(x).join(', ')}</div></div></a>`).join('')}</div></details>` : ''}`;
    Z.$('#gl-me', el).onchange = (e) => { Z.set('golive_me', e.target.value); Z.route(); };
    if (s) wire(el, s, () => Z.route());
  };

  // ---------- the HQ / Home card ----------
  // A short line for HQ and Home: how far along, each partner's next step, anything stuck.
  Z.goliveCard = async () => {
    if (!can() || !G()) return '';
    await load().catch(() => null);
    if (!S) return '';
    const tot = G().steps.length, dn = G().steps.filter((s) => S.done[s.id]).length;
    if (dn === tot) return '';
    const nx = (m) => queue(m).line[0];
    const stuck = G().steps.filter((s) => S.stuck[s.id] && !S.done[s.id]);
    return `<a class="card" href="#golive" id="gl-card" style="display:block;text-decoration:none;color:inherit;border-left:4px solid var(--brand)">
      <div class="row" style="justify-content:space-between"><b>🚀 Getting ready · ${dn} of ${tot} steps</b><span>›</span></div>${bar(dn, tot)}
      <div class="hint" style="margin:0">${['D', 'K'].map((m) => { const x = nx(m); return `${nameOf(m)} next: ${x ? Z.esc(x.id + ' ' + x.t) : '—'}`; }).join('<br>')}
      ${stuck.length ? `<br><span style="color:var(--bad)">🆘 ${stuck.length} stuck: ${Z.esc(stuck[0].id + ' ' + stuck[0].t)}${stuck[0] && S.stuck[stuck[0].id].note ? ' — “' + Z.esc(S.stuck[stuck[0].id].note) + '”' : ''}</span>` : ''}</div></a>`;
  };
})();
