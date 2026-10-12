// Zuri System · Admin: people, who-sees-what, custom fields, areas · v1 · 2026-09-30
(function () {
  const Z = window.Z;
  const SUBS = [['people', 'People'], ['visibility', 'Who sees what'], ['fields', 'Custom fields'], ['areas', 'Areas'], ['prices', '💲 Price list']]; // 💲 v2.35
  const ROLES = [['field', 'Field tech'], ['callcenter', 'Call center'], ['internal', 'Office staff'], ['admin', 'Admin (partner)']];
  const must = (r) => { if (r.error) throw r.error; return r.data; };

  Z.routes.admin = async (args, el) => {
    const sub = SUBS.some(([k]) => k === args[0]) ? args[0] : 'people';
    const subs = SUBS.filter(([k]) => k !== 'staff' || Z.isFinance());
    el.innerHTML = `<h2>Admin</h2><div class="subtabs">${subs.map(([k, t]) => `<a href="#admin/${k}" class="${k === sub ? 'on' : ''}">${t}</a>`).join('')}</div><div id="a-body"><div class="loading">Loading…</div></div>`;
    await VIEWS[sub](Z.$('#a-body', el));
  };
  const VIEWS = {};
  // Other files (staffpay.js) add their own Admin tabs here.
  Z.adminSubs = SUBS; Z.adminViews = VIEWS;

  VIEWS.people = async (el) => {
    const people = must(await Z.sb.from('profiles').select('*').order('active').order('full_name'));
    const waiting = people.filter((p) => !p.active);
    el.innerHTML = `
      <p class="hint" style="margin-top:0">New staff create their own account on the sign-in page. They appear here switched off — pick their role and switch them on.</p>
      ${waiting.length ? `<div class="alert warn">${waiting.length} ${waiting.length > 1 ? 'people are' : 'person is'} waiting to be switched on.</div>` : ''}
      <div class="card list">${people.map((p) => `
        <form class="item" data-id="${p.id}" style="flex-wrap:wrap">
          <div class="grow" style="min-width:180px"><div class="t">${Z.esc(p.full_name)}${p.id === Z.me.id ? ' (you)' : ''}</div><div class="m">${Z.esc(p.phone || '')} · joined ${Z.day(p.created_at)}</div></div>
          <select name="role" aria-label="Role for ${Z.esc(p.full_name)}" style="width:auto">${Z.opts(ROLES, p.role)}</select>
          <select name="dept" aria-label="Department for ${Z.esc(p.full_name)}" style="width:auto" ${p.role === 'internal' ? '' : 'hidden'}>${Z.opts([['', 'No dept'], ['finance', 'Finance'], ['technical', 'Technical']], p.dept || '')}</select>
          <select name="area" aria-label="Area for ${Z.esc(p.full_name)}" style="width:auto"><option value="">Any area</option>${Z.opts(Z.ref.areas.map((a) => [a.code, a.name]), p.area || '')}</select>
          <label class="row" style="margin:0;gap:6px"><input type="checkbox" name="active" aria-label="Switched on: ${Z.esc(p.full_name)}" ${p.active ? 'checked' : ''}> On</label>
          <button class="btn small" type="submit">Save</button>
        </form>`).join('')}</div>
      <p class="hint">Office staff in <b>Finance</b> see all the money screens. Office staff in <b>Technical</b> see jobs and customers but not money. Field techs only see their own jobs.</p>`;
    Z.$$('form[data-id]', el).forEach((f) => {
      f.role.onchange = () => (f.dept.hidden = f.role.value !== 'internal');
      f.onsubmit = async (e) => {
        e.preventDefault();
        const id = f.dataset.id;
        const row = { role: f.role.value, dept: f.role.value === 'internal' ? f.dept.value || null : null, area: f.area.value || null, active: f.active.checked };
        if (id === Z.me.id && (row.role !== 'admin' || !row.active) && !confirm('This removes your own admin access. Continue?')) return;
        const { error } = await Z.sb.from('profiles').update(row).eq('id', id);
        if (error) return Z.fail(error);
        await Z.loadRef();
        Z.toast('Saved.');
      };
    });
  };

  VIEWS.visibility = async (el) => {
    const roles = [['internal', 'Office'], ['callcenter', 'Call center'], ['field', 'Field tech']];
    const core = Z.CUSTOMER_FIELDS.filter(([k]) => !['full_name', 'landmark'].includes(k)).map(([k, label]) => [k, label]);
    const custom = Z.ref.cfd.filter((d) => d.entity === 'customer').map((d) => [d.key, d.label + ' (custom)']);
    const cur = (field, role) => { const v = Z.ref.vis.find((x) => x.entity === 'customer' && x.field === field && x.role === role); return v ? v.can_see : role !== 'field'; };
    el.innerHTML = `
      <p class="hint" style="margin-top:0">Tick what each role can see on a customer. The database enforces this — unticked details never reach that person's phone. Name, area, directions and map pin are always shown so the job can be done. Admins see everything.</p>
      <div class="card scroll-x"><table class="t"><tr><th>Customer detail</th>${roles.map(([, t]) => `<th style="text-align:center">${t}</th>`).join('')}</tr>
        ${core.concat(custom).map(([k, label]) => `<tr><td>${Z.esc(label)}</td>${roles.map(([r, rt]) => `<td style="text-align:center"><input type="checkbox" aria-label="${Z.esc(label)} — visible to ${rt}" data-f="${Z.esc(k)}" data-r="${r}" ${cur(k, r) ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}</table></div>`;
    Z.$$('input[data-f]', el).forEach((cb) => (cb.onchange = async () => {
      const { error } = await Z.sb.from('field_visibility').upsert({ entity: 'customer', field: cb.dataset.f, role: cb.dataset.r, can_see: cb.checked });
      if (error) { cb.checked = !cb.checked; return Z.fail(error); }
      await Z.loadRef();
      Z.toast('Saved.');
    }));
  };

  VIEWS.fields = async (el) => {
    const defs = Z.ref.cfd.filter((d) => d.entity === 'customer');
    const kinds = [['text', 'Text'], ['number', 'Number'], ['date', 'Date'], ['yesno', 'Yes / No'], ['choice', 'Pick from a list']];
    el.innerHTML = `
      <p class="hint" style="margin-top:0">Add your own details to every customer, e.g. "Router location", "Pole number", "Referred by". New fields are hidden from field techs until you tick them under Who sees what.</p>
      <div class="card list">${defs.map((d) => `<div class="item"><div class="grow"><div class="t">${Z.esc(d.label)}</div><div class="m">${Z.esc((kinds.find((k) => k[0] === d.kind) || [])[1])}${d.choices && d.choices.length ? ': ' + Z.esc(d.choices.join(', ')) : ''}</div></div><button class="btn sec small" data-del="${d.id}">Remove</button></div>`).join('') || '<div class="muted">No custom fields yet.</div>'}</div>
      <form class="card" id="af">
        <div class="grid3">
          <div><label>Field name</label><input name="label" required placeholder="e.g. Pole number"></div>
          <div><label>Kind</label><select name="kind" aria-label="What kind of detail">${Z.opts(kinds)}</select></div>
          <div><label>Choices (for "pick from a list", comma separated)</label><input name="choices" placeholder="Indoor, Outdoor"></div>
        </div>
        <div style="height:12px"></div><button class="btn" type="submit">Add field</button>
      </form>`;
    Z.$('#af', el).onsubmit = async (e) => {
      e.preventDefault();
      const d = Z.formData(e.target);
      let key = d.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 38);
      if (!/^[a-z]/.test(key)) key = 'f_' + key;
      const choices = d.kind === 'choice' ? d.choices.split(',').map((s) => s.trim()).filter(Boolean) : null;
      if (d.kind === 'choice' && !choices.length) return Z.toast('Type the choices, separated by commas.');
      const { error } = await Z.sb.from('custom_field_defs').insert({ entity: 'customer', key, label: d.label.trim(), kind: d.kind, choices, sort: defs.length });
      if (error) return Z.toast(/unique|duplicate/i.test(error.message) ? 'A field with that name already exists.' : Z.errText(error));
      await Z.loadRef(); Z.toast('Field added.'); Z.route();
    };
    Z.$$('[data-del]', el).forEach((b) => (b.onclick = async () => {
      if (!confirm('Remove this field? Details already typed in stay saved but stop showing.')) return;
      const { error } = await Z.sb.from('custom_field_defs').delete().eq('id', b.dataset.del);
      if (error) return Z.fail(error);
      await Z.loadRef(); Z.route();
    }));
  };

  // v2.35: the area picker at the top follows a new or renamed area at once (it used to need a page refresh)
  const pickerAreas = () => { const sel = Z.$('#h-area'); if (!sel) return; sel.innerHTML = '<option value="">All areas</option>' + Z.opts(Z.ref.areas.filter((a) => a.active).map((a) => [a.code, a.name]), Z.area); };

  VIEWS.areas = async (el) => {
    el.innerHTML = `
      <div class="card list">${Z.ref.areas.map((a) => `
        <form class="item" data-code="${a.code}" style="flex-wrap:wrap">
          <b style="width:32px">${Z.esc(a.code)}</b>
          <input name="name" aria-label="Name of area ${Z.esc(a.code)}" value="${Z.esc(a.name)}" style="flex:1;min-width:120px">
          <label class="hint" style="margin:0">M-Pesa float target</label><input name="float_target" aria-label="M-Pesa float target for ${Z.esc(a.name)}" inputmode="numeric" value="${Z.esc(a.float_target)}" style="width:110px">
          <label class="row" style="margin:0;gap:6px"><input type="checkbox" name="active" ${a.active ? 'checked' : ''}> In use</label>
          <button class="btn small" type="submit">Save</button>
        </form>`).join('')}</div>
      <form class="card" id="aa"><div class="grid3">
        <div><label>New area code</label><input name="code" required maxlength="3" placeholder="D" style="text-transform:uppercase"></div>
        <div><label>Name</label><input name="name" required placeholder="Zuri D"></div>
        <div><label>M-Pesa float target</label><input name="float_target" aria-label="M-Pesa float target for the new area" inputmode="numeric" value="50000"></div>
      </div><div style="height:12px"></div><button class="btn" type="submit">Add area</button></form>`;
    Z.$$('form[data-code]', el).forEach((f) => (f.onsubmit = async (e) => {
      e.preventDefault();
      const { error } = await Z.sb.from('areas').update({ name: f.name.value.trim(), float_target: Z.num(f.float_target.value) || 0, active: f.active.checked }).eq('code', f.dataset.code);
      if (error) return Z.fail(error);
      await Z.loadRef(); pickerAreas(); Z.toast('Saved.');
    }));
    Z.$('#aa', el).onsubmit = async (e) => {
      e.preventDefault();
      const d = Z.formData(e.target);
      const code = d.code.trim().toUpperCase();
      if (!/^[A-Z]{1,3}$/.test(code)) return Z.toast('Code must be 1–3 letters.');
      const { error } = await Z.sb.from('areas').insert({ code, name: d.name.trim(), float_target: Z.num(d.float_target) || 50000 });
      if (error) return Z.fail(error);
      await Z.loadRef(); pickerAreas(); Z.toast('Area added.'); Z.route();
    };
  };
  // 💲 v2.35 (Business Week): the price list — the packages Zuri sells and their monthly price (packages table,
  // 9_billnasi_followups.sql; partners and office staff may change it). The call center picks from it on a customer.
  VIEWS.prices = async (el) => {
    const r = await Z.sb.from('packages').select('*').order('monthly_rate');
    if (r.error) { el.innerHTML = `<div class="card">${Z.esc(Z.errText ? Z.errText(r.error) : r.error.message)}</div>`; return; }
    const rows = r.data || [];
    el.innerHTML = `
      <p class="hint" style="margin-top:0">The packages you sell and their monthly price. When someone types a package on a customer, Zuri offers these and fills in the monthly rate. To change a price, save the same name again with the new price.</p>
      <div class="card list" id="pl-list">${rows.map((p) => `<div class="item"><div class="grow"><div class="t">${Z.esc(p.name)}</div><div class="m">${p.kind === 'hotspot' ? 'Hotspot' : 'Fixed'} · KES ${Z.fmt(p.monthly_rate)} a month</div></div><button class="btn sec small" data-del="${Z.esc(p.name)}" aria-label="Remove ${Z.esc(p.name)}">Remove</button></div>`).join('') || '<div class="muted">No packages yet. Add the first one below.</div>'}</div>
      <form class="card" id="pl-add"><div class="grid3">
        <div><label for="pl-name">Package name</label><input id="pl-name" name="name" required maxlength="60" placeholder="e.g. Home 10 Mbps"></div>
        <div><label for="pl-rate">Monthly price (KES)</label><input id="pl-rate" name="monthly_rate" inputmode="numeric" required placeholder="2000"></div>
        <div><label for="pl-kind">Kind</label><select id="pl-kind" name="kind">${Z.opts([['fixed', 'Fixed (fibre to the home)'], ['hotspot', 'Hotspot']])}</select></div>
      </div><div style="height:12px"></div><button class="btn" type="submit">Save package</button></form>`;
    Z.$('#pl-add', el).onsubmit = async (e) => {
      e.preventDefault();
      const d = Z.formData(e.target); const amt = Z.num(d.monthly_rate);
      if (!d.name.trim()) return Z.toast('Type the package name.');
      if (!(amt >= 0)) return Z.toast('Type the monthly price.');
      const { error } = await Z.sb.from('packages').upsert({ name: d.name.trim(), monthly_rate: amt, kind: d.kind }, { onConflict: 'name' });
      if (error) return Z.fail(error);
      Z.toast('Package saved.'); Z.route();
    };
    Z.$$('[data-del]', el).forEach((b) => (b.onclick = async () => {
      if (!confirm(`Remove ${b.dataset.del} from the price list? Customers who already have it keep it.`)) return;
      const { error } = await Z.sb.from('packages').delete().eq('name', b.dataset.del);
      if (error) return Z.fail(error);
      Z.toast('Removed.'); Z.route();
    }));
  };
})();
