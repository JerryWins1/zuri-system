// Zuri System · Tasks: my day, the team list, WhatsApp nudges, manager run log · v2 · 2026-09-30
(function () {
  const Z = window.Z;
  const must = (r) => { if (r.error) throw r.error; return r.data; };
  const GROUPS = [['partners', 'Partners'], ['finance', 'Finance'], ['technical', 'Technical'], ['callcenter', 'Call center'], ['field', 'Field techs'], ['everyone', 'Everyone']];
  const groupName = (g) => (GROUPS.find((x) => x[0] === g) || [g, g])[1];
  const PRI = { urgent: ['Urgent', 'bad', 0], high: ['High', 'warn', 1], normal: ['', '', 2], low: ['Low', '', 3] };
  const kenyaToday = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  const waPhone = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '254' + d.slice(1); else if (d.length === 9) d = '254' + d; return d; };

  Z.myGroups = () => {
    const r = Z.me.role, d = Z.me.dept, g = ['everyone'];
    if (r === 'admin') g.push('partners', 'finance', 'technical');
    if (r === 'internal' && d === 'finance') g.push('finance');
    if (r === 'internal' && d === 'technical') g.push('technical');
    if (r === 'callcenter') g.push('callcenter');
    if (r === 'field') g.push('field');
    return g;
  };
  const isMine = (t) => t.assigned_to === Z.me.id || (t.assigned_group && Z.myGroups().includes(t.assigned_group));
  const canTick = (t) => Z.isAdmin() || t.created_by === Z.me.id || isMine(t);
  const who = (t) => (t.assigned_to ? Z.personName(t.assigned_to) || 'Someone' : groupName(t.assigned_group));
  // Only plain in-app links (letters, digits, / _ : . -) — anything else is dropped, never put in the page.
  const linkHref = (t) => {
    const base = { page: '#', customer: '#customers/', ticket: '#jobs/' }[t.link_type];
    return base && /^[A-Za-z0-9/_:.-]{1,80}$/.test(t.link_ref || '') ? base + t.link_ref : '';
  };
  const sortTasks = (a, b) => PRI[a.priority][2] - PRI[b.priority][2] || String(a.due_date || '9').localeCompare(String(b.due_date || '9')) || String(a.opened_at).localeCompare(String(b.opened_at));

  Z.routes.tasks = async (args, el) => {
    const subs = [['mine', 'My day'], ['team', 'Team'], ['add', '＋ Add a task']];
    if (Z.isFinance()) subs.push(['nudges', 'WhatsApp nudges']);
    if (Z.isOffice()) subs.push(['runs', 'Manager log']);
    const sub = subs.some(([k]) => k === args[0]) ? args[0] : 'mine';
    el.innerHTML = `<div class="row" style="justify-content:space-between"><h2>Tasks</h2>
        ${Z.isAdmin() ? '<button class="btn sec small" id="tk-run">🤖 Run the manager now</button>' : ''}</div>
      <div class="subtabs">${subs.map(([k, t]) => `<a href="#tasks/${k}" class="${k === sub ? 'on' : ''}">${t}</a>`).join('')}</div><div id="tk-body"><div class="loading">Loading…</div></div>`;
    const rb = Z.$('#tk-run', el);
    if (rb) rb.onclick = async () => {
      const mode = new Date(Date.now() + 3 * 3600e3).getUTCHours() < 12 ? 'morning' : 'chase';
      rb.disabled = true; rb.textContent = '🤖 Working…';
      const { data, error } = await Z.sb.rpc('manager_run', { p_mode: mode, p_force: true });
      rb.disabled = false; rb.textContent = '🤖 Run the manager now';
      if (error || (data && data.error)) return Z.toast(Z.errText(error || data.error));
      Z.toast(`Manager (${mode}): ${data.new_tasks} new · ${data.closed} closed · ${data.escalated} escalated.`);
      Z.route();
    };
    await VIEWS[sub](Z.$('#tk-body', el), args.slice(1));
  };
  const VIEWS = {};

  // Open tasks (plus the last week's done ones if asked). Saved on the phone, and changes waiting to send are shown on top.
  async function loadTasks(showDone) {
    let rows, offline = false;
    try {
      let q = Z.sb.from('tasks').select('*');
      q = showDone ? q.or(`status.eq.open,and(status.eq.done,updated_at.gte.${new Date(Date.now() - 7 * 864e5).toISOString()})`) : q.eq('status', 'open');
      rows = must(await q.limit(500));
      if (!showDone) Z.set('tasks_cache', { rows, at: Date.now() });
    } catch (e) {
      if (!Z.isNet(e)) throw e;
      rows = Z.get('tasks_cache', { rows: [] }).rows; offline = true;
    }
    const byId = new Map(rows.map((t) => [t.id, { ...t }]));
    for (const q of Z.queue) {
      if (q.op === 'task_insert' && !byId.has(q.data.row.id)) byId.set(q.data.row.id, { status: 'open', priority: 'normal', visibility: 'team', source: 'person', kind: 'todo', opened_at: new Date(q.at).toISOString(), ...q.data.row, _local: true });
      if (q.op === 'task_update' && byId.has(q.data.id)) Object.assign(byId.get(q.data.id), q.data.fields, { _local: true });
    }
    const out = [...byId.values()];
    out.offline = offline;
    return out;
  }
  const offlineNote = (list) => (list.offline ? `<div class="alert warn">📴 No signal — showing tasks saved on this phone (${Z.when(Z.get('tasks_cache', {}).at)}). Ticks and new tasks send later.</div>` : '');

  function card(t) {
    const [pLabel, pCls] = PRI[t.priority];
    const href = linkHref(t);
    return `<div class="item" data-id="${t.id}" style="align-items:flex-start;flex-wrap:wrap">
      <input type="checkbox" class="tk-done" aria-label="Done: ${Z.esc(t.title)}" value="${Z.esc(t.title)}" ${t.status === 'done' ? 'checked' : ''} ${canTick(t) ? '' : 'disabled title="Only the person or group it\'s for can tick this"'} style="margin-top:4px">
      <div class="grow" style="min-width:220px">
        <div class="t" style="${t.status === 'done' ? 'text-decoration:line-through;opacity:.6' : ''}">${t.kind === 'escalation' ? '⏫ ' : ''}${Z.esc(t.title)}${t._local ? ' <span class="m">⏳ not sent</span>' : ''}</div>
        <div class="m">${pLabel ? `<span class="pill ${pCls}">${pLabel}</span> ` : ''}${Z.esc(who(t))}${t.source === 'agent' ? ' · 🤖 Zuri manager' : t.created_by ? ' · from ' + Z.esc(Z.personName(t.created_by) || 'someone') : ''}${t.due_date ? ' · due ' + Z.day(t.due_date) : ''}${t.visibility === 'finance' ? ' · 🔒 finance' : ''}</div>
        ${t.details ? `<div class="hint" style="margin:4px 0 0">${Z.esc(t.details)}</div>` : ''}
        <div class="row" style="margin-top:6px">
          ${href ? `<a class="btn sec small" href="${Z.esc(href)}">Open →</a>` : ''}
          <button class="btn sec small tk-cm">💬 Notes</button>
        </div>
        <div class="tk-thread" hidden></div>
      </div></div>`;
  }

  function wire(el, tasks) {
    Z.$$('.tk-done', el).forEach((cb) => (cb.onchange = async () => {
      const id = cb.closest('[data-id]').dataset.id;
      if (!Z.enqueue('task_update', { id, fields: { status: cb.checked ? 'done' : 'open' } })) { cb.checked = !cb.checked; return; }
      Z.toast(cb.checked ? (navigator.onLine ? 'Done ✓' : 'Done ✓ — sends when you have signal.') : 'Reopened.');
      const t = cb.closest('[data-id]').querySelector('.t'); t.style.textDecoration = cb.checked ? 'line-through' : ''; t.style.opacity = cb.checked ? '.6' : '';
    }));
    Z.$$('.tk-cm', el).forEach((b) => (b.onclick = async () => {
      const box = b.closest('[data-id]');
      const th = Z.$('.tk-thread', box);
      if (!th.hidden) { th.hidden = true; return; }
      const id = box.dataset.id;
      let notes = [];
      try { notes = must(await Z.sb.from('task_comments').select('*').eq('task_id', id).order('at')); }
      catch (e) { if (!Z.isNet(e)) return Z.fail(e); }
      notes = notes.concat(Z.queue.filter((q) => q.op === 'task_comment' && q.data.row.task_id === id && !notes.some((n) => n.id === q.data.row.id)).map((q) => ({ ...q.data.row, at: new Date(q.at).toISOString(), _local: true })));
      th.innerHTML = `<div class="timeline" style="margin-top:8px">${notes.map((n) => `<div class="ev"><div>${Z.esc(n.body)}</div><div class="m">${n.from_agent ? '🤖 Zuri manager' : Z.esc(Z.personName(n.by) || '')} · ${Z.when(n.at)}${n._local ? ' · ⏳ not sent' : ''}</div></div>`).join('') || '<div class="muted">No notes yet.</div>'}</div>
        <form class="row" style="margin-top:6px"><input name="body" required placeholder="Add a note" style="flex:1"><button class="btn sec small">Add</button></form>`;
      th.hidden = false;
      Z.$('form', th).onsubmit = async (e) => {
        e.preventDefault();
        if (!Z.enqueue('task_comment', { row: { id: Z.uuid(), task_id: id, by: Z.me.id, body: e.target.body.value.trim() } })) return;
        if (!navigator.onLine) { Z.toast('Note saved — it sends when you have signal.'); th.hidden = true; return; }
        setTimeout(() => { th.hidden = true; b.click(); }, 600);
      };
    }));
  }

  VIEWS.mine = async (el) => {
    const all = await loadTasks(false);
    const mine = all.filter(isMine).sort(sortTasks);
    const today = kenyaToday();
    const now = mine.filter((t) => t.priority === 'urgent' || t.priority === 'high' || (t.due_date && t.due_date <= today));
    const later = mine.filter((t) => !now.includes(t));
    // New people see the training videos first, until they've watched one or closed this.
    const learnNudge = !Z.get('learn_hide', false) && !Object.keys(Z.get('learn_done', {})).length;
    el.innerHTML = `${offlineNote(all)}
      ${Z.training ? `<div class="card row" style="border-left:4px solid #B5651D"><span style="font-size:26px">🧪</span><div class="grow"><b>Testing Zuri?</b><div class="hint" style="margin:0">Watch “How to test” (2 min), then work through your checklist.</div></div><button class="btn small" onclick="Z.learn('howtest')">▶ How to test</button><a class="btn sec small" href="testers/">My list</a></div>`
        : learnNudge ? `<div class="card row" id="tk-learn" style="border-left:4px solid var(--accent)"><span style="font-size:26px">🎓</span><div class="grow"><b>New to Zuri?</b><div class="hint" style="margin:0">Start with the 5-minute tour, then the videos for your job.</div></div><button class="btn small" onclick="Z.learn('tour')">▶ Watch</button><button class="btn sec small" id="tk-learn-x" aria-label="Hide">✕</button></div>` : ''}
      <p class="hint" style="margin-top:0">Hi ${Z.esc(Z.me.full_name.split(' ')[0])} — ${mine.length ? `${mine.length} thing${mine.length > 1 ? 's' : ''} for you. Tick them off as you go; add a note if you're stuck.` : 'nothing on your list right now. 🎉'}</p>
      ${now.length ? `<h3>Today</h3><div class="card list">${now.map(card).join('')}</div>` : ''}
      ${later.length ? `<h3>When you can</h3><div class="card list">${later.map(card).join('')}</div>` : ''}`;
    wire(el, mine);
    const lx = Z.$('#tk-learn-x', el); if (lx) lx.onclick = () => { Z.set('learn_hide', true); Z.$('#tk-learn', el).remove(); };
  };

  VIEWS.team = async (el, args) => {
    const f = Z.get('tasks_team', { who: '', done: false });
    const all = (await loadTasks(f.done)).sort(sortTasks);
    const list = f.who ? all.filter((t) => (f.who.startsWith('g:') ? t.assigned_group === f.who.slice(2) : t.assigned_to === f.who)) : all;
    const buckets = {};
    list.forEach((t) => { const k = who(t); (buckets[k] = buckets[k] || []).push(t); });
    const people = Z.ref.people.filter((p) => p.active);
    el.innerHTML = `${offlineNote(all)}
      <div class="row" style="margin-bottom:10px">
        <select id="tk-who" style="flex:1"><option value="">Everyone's tasks</option>
          <optgroup label="Groups">${Z.opts(GROUPS.map(([k, t]) => ['g:' + k, t]), f.who)}</optgroup>
          <optgroup label="People">${Z.opts(people.map((p) => [p.id, p.full_name]), f.who)}</optgroup></select>
        <label class="row" style="margin:0;gap:6px"><input type="checkbox" id="tk-showdone" ${f.done ? 'checked' : ''}> show done (7 days)</label>
      </div>
      ${Object.keys(buckets).length ? Object.entries(buckets).map(([k, ts]) => `<h3>${Z.esc(k)} · ${ts.filter((t) => t.status === 'open').length} open</h3><div class="card list">${ts.map(card).join('')}</div>`).join('') : '<div class="empty">No tasks here.</div>'}`;
    Z.$('#tk-who', el).onchange = (e) => { f.who = e.target.value; Z.set('tasks_team', f); Z.route(); };
    Z.$('#tk-showdone', el).onchange = (e) => { f.done = e.target.checked; Z.set('tasks_team', f); Z.route(); };
    wire(el, list);
  };

  VIEWS.add = async (el) => {
    const people = Z.ref.people.filter((p) => p.active);
    el.innerHTML = `
      <form class="card" id="tk-add">
        <label>What needs doing?</label><input name="title" required maxlength="200" placeholder="e.g. Call Mama Wanjiru back about her router">
        <label>Details (optional)</label><textarea name="details" placeholder="Anything that helps them do it"></textarea>
        <div class="grid3">
          <div><label>Who should do it?</label><select name="for" required>
            <option value="">— choose —</option>
            <option value="${Z.me.id}">🙋 Me</option>
            <optgroup label="A person">${Z.opts(people.filter((p) => p.id !== Z.me.id).map((p) => [p.id, p.full_name]))}</optgroup>
            <optgroup label="A group">${Z.opts(GROUPS.map(([k, t]) => ['g:' + k, t]))}</optgroup></select></div>
          <div><label>Due</label><input type="date" name="due_date"></div>
          <div><label>Priority</label><select name="priority">${Z.opts([['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent'], ['low', 'Low']])}</select></div>
        </div>
        ${Z.isFinance() ? '<label class="row" style="gap:6px"><input type="checkbox" name="finance"> 🔒 Money task — only finance can see it</label>' : ''}
        <div style="height:12px"></div><button class="btn block" type="submit">Add task</button>
      </form>`;
    Z.$('#tk-add', el).onsubmit = async (e) => {
      e.preventDefault();
      const d = Z.formData(e.target);
      const row = { title: d.title.trim(), details: d.details.trim() || null, due_date: d.due_date || null, priority: d.priority,
        visibility: d.finance ? 'finance' : 'team', created_by: Z.me.id };
      if (d.for.startsWith('g:')) row.assigned_group = d.for.slice(2); else row.assigned_to = d.for;
      row.id = Z.uuid();
      if (!Z.enqueue('task_insert', { row })) return;
      Z.toast(navigator.onLine ? 'Task added.' : 'Task saved — it sends when you have signal.');
      Z.go(row.assigned_to === Z.me.id ? 'tasks/mine' : 'tasks/team');
    };
  };

  VIEWS.nudges = async (el) => {
    const day = kenyaToday();
    const rows = must(await Z.sb.from('nudges').select('*').eq('day', day));
    el.innerHTML = `
      <p class="hint" style="margin-top:0">Each morning the Zuri manager writes a short WhatsApp for everyone with a phone number on their account. Tap to open it in WhatsApp, press send, then mark it sent.</p>
      <div class="card list">${rows.length ? rows.map((n) => `<div class="item" style="align-items:flex-start;flex-wrap:wrap"><div class="grow" style="min-width:220px">
          <div class="t">${Z.esc(Z.personName(n.profile_id) || 'Staff')} <span class="m">${Z.esc(n.phone)}</span></div>
          <pre class="report" style="margin:6px 0">${Z.esc(n.message)}</pre></div>
          <div class="row">${n.sent_at ? `<span class="pill ok">Sent ${Z.when(n.sent_at)}</span>` : `<a class="btn small" target="_blank" rel="noopener" href="https://wa.me/${waPhone(n.phone)}?text=${encodeURIComponent(n.message)}">💬 Open WhatsApp</a><button class="btn sec small" data-sent="${n.id}">Mark sent</button>`}</div></div>`).join('')
        : '<div class="empty">No nudges for today yet. They\'re written at 6:30am Kenya time for staff who have a phone number on their account.</div>'}</div>`;
    Z.$$('[data-sent]', el).forEach((b) => (b.onclick = async () => {
      const { error } = await Z.sb.from('nudges').update({ sent_at: new Date().toISOString(), sent_by: Z.me.id }).eq('id', b.dataset.sent);
      if (error) return Z.fail(error);
      Z.route();
    }));
  };

  VIEWS.runs = async (el) => {
    const runs = must(await Z.sb.from('agent_runs').select('*').order('started_at', { ascending: false }).limit(20));
    const MODE = { morning: '🌅 Morning', chase: '⏰ Afternoon chase', weekly: '📊 Friday' };
    el.innerHTML = `
      <p class="hint" style="margin-top:0">Everything the Zuri manager did. It runs at 6:30am and 3pm Kenya time, and writes the Friday report at 4pm on Fridays. It only writes tasks, notes, nudges and reports — never money, customer records or messages to customers.</p>
      <div class="card list">${runs.map((r) => `<div class="item" style="align-items:flex-start;flex-wrap:wrap"><div class="grow" style="min-width:220px">
          <div class="t">${MODE[r.mode] || r.mode} · ${Z.when(r.started_at)} ${r.status === 'done' ? '<span class="pill ok">done</span>' : r.status === 'error' ? '<span class="pill bad">error</span>' : '<span class="pill warn">running</span>'}${r.used_ai ? ' <span class="pill brand">AI</span>' : ''}</div>
          <div class="m">${r.stats && r.stats.rules != null ? `${r.stats.new_tasks} new tasks · ${r.stats.closed} closed · ${r.stats.escalated} escalated · ${r.stats.nudges} nudges` : ''}${r.error ? ' · ' + Z.esc(r.error) : ''}</div>
          ${(r.warnings || []).map((w) => `<div class="alert ${w.level === 'bad' ? 'bad' : 'warn'}" style="margin:6px 0 0">${Z.esc(w.text)}</div>`).join('')}
        </div></div>`).join('') || '<div class="empty">The manager hasn\'t run yet.</div>'}</div>`;
  };

  // Used by Home: latest run + how many tasks are mine.
  Z.managerSummary = async () => {
    const [runs, tasks] = await Promise.all([
      Z.sb.from('agent_runs').select('mode,started_at,status,warnings,used_ai').eq('status', 'done').order('started_at', { ascending: false }).limit(1),
      Z.sb.from('tasks').select('assigned_to,assigned_group,priority').eq('status', 'open').limit(500),
    ]);
    const mine = (tasks.data || []).filter(isMine);
    return { run: (runs.data || [])[0] || null, mine: mine.length, urgent: mine.filter((t) => t.priority === 'urgent' || t.priority === 'high').length };
  };
})();
