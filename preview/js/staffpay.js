// Zuri System · Staff & pay: the staff list (Admin) and the daily Pay run (Money → Bills) · v1 · 2026-10-01
// Finance and partners only. The pay run never moves money: a person sends it in M-Pesa, then records it here.
(function () {
  const Z = window.Z;
  const must = (r) => { if (r.error) throw r.error; return r.data; };
  // 7 Oct deep check #41: the pay run only builds monthly salaries, so say plainly how the others get paid.
  const PAY_TYPES = [['monthly', 'Monthly salary (on the Pay run)'], ['daily', 'Paid per day — pay by hand in Money out'], ['per_job', 'Paid per job — pay by hand in Money out'], ['none', 'Not paid through Zuri']];
  const ord = (n) => n + ([11, 12, 13].includes(n % 100) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));

  // ---------- Admin → Staff & pay ----------
  Z.adminSubs.push(['staff', 'Staff & pay']);
  Z.adminViews.staff = async (el) => {
    if (!Z.isFinance()) { el.innerHTML = '<div class="card">Only finance and the partners can see staff pay details.</div>'; return; }
    const rows = must(await Z.sb.from('staff').select('*').order('active', { ascending: false }).order('full_name'));
    el.innerHTML = `
      <p class="hint" style="margin-top:0">Everyone Zuri pays: their M-Pesa number, what they earn and when. This feeds the <a href="#money/payrun">Pay run</a>. Only finance and the partners see this page.</p>
      <div class="row" style="margin-bottom:10px"><button class="btn" id="sf-add">＋ Add a staff member</button></div>
      <div class="card list">${rows.length ? rows.map((s) => `<div class="item" data-id="${s.id}" style="cursor:pointer"><div class="grow">
          <div class="t">${Z.esc(s.full_name)} ${s.active ? '' : '<span class="pill">not working now</span>'}</div>
          <div class="m">${Z.esc([s.job_title, s.area ? Z.areaName(s.area) : '', s.mpesa_number ? '📱 ' + s.mpesa_number : '⚠️ no M-Pesa number'].filter(Boolean).join(' · '))}</div>
          <div class="m">${s.pay_type === 'monthly' ? `KES ${Z.fmt(s.salary)} a month · paid on the ${ord(s.pay_day)}` : (PAY_TYPES.find((p) => p[0] === s.pay_type) || [])[1]}${s.profile_id ? ' · has a Zuri login' : ''}</div>
        </div><span>›</span></div>`).join('') : '<div class="empty">No staff yet. Add the first one.</div>'}</div>`;
    Z.$('#sf-add', el).onclick = () => editStaff(null);
    Z.$$('[data-id]', el).forEach((r) => (r.onclick = () => editStaff(rows.find((x) => x.id === r.dataset.id))));
  };

  function editStaff(s) {
    s = s || { pay_type: 'monthly', pay_day: 28, salary: 0, active: true, area: Z.area || '' };
    const people = Z.ref.people.filter((p) => p.active);
    const sh = Z.sheet(s.id ? '✏️ ' + s.full_name : '＋ New staff member', `
      <form id="sf">
        <div class="grid2">
          <div><label>Full name</label><input name="full_name" required value="${Z.esc(s.full_name || '')}"></div>
          <div><label>Job</label><input name="job_title" value="${Z.esc(s.job_title || '')}" placeholder="e.g. Field technician"></div>
          <div><label>Area</label><select name="area"><option value="">Any area</option>${Z.opts(Z.ref.areas.map((a) => [a.code, a.name]), s.area || '')}</select></div>
          <div><label>Zuri login (if they have one)</label><select name="profile_id"><option value="">— none —</option>${Z.opts(people.map((p) => [p.id, p.full_name]), s.profile_id || '')}</select></div>
          <div><label>Phone</label><input name="phone" type="tel" value="${Z.esc(s.phone || '')}"></div>
          <div><label>M-Pesa number (we pay this)</label><input name="mpesa_number" type="tel" value="${Z.esc(s.mpesa_number || '')}" placeholder="07…"></div>
          <div><label>Name M-Pesa shows</label><input name="mpesa_name" value="${Z.esc(s.mpesa_name || '')}" placeholder="Check it matches before sending"></div>
          <div><label>National ID</label><input name="national_id" value="${Z.esc(s.national_id || '')}"></div>
          <div><label>KRA PIN</label><input name="kra_pin" value="${Z.esc(s.kra_pin || '')}" autocapitalize="characters"></div>
          <div><label>NSSF number</label><input name="nssf_no" value="${Z.esc(s.nssf_no || '')}"></div>
          <div><label>SHA number</label><input name="sha_no" value="${Z.esc(s.sha_no || '')}"></div>
          <div><label>How they are paid</label><select name="pay_type">${Z.opts(PAY_TYPES, s.pay_type)}</select></div>
          <div><label>Pay (KES, per month / day / job)</label><input name="salary" inputmode="numeric" value="${Z.esc(s.salary || '')}"></div>
          <div><label>Pay day of the month</label><input name="pay_day" type="number" min="1" max="31" value="${Z.esc(s.pay_day || 28)}"></div>
          <div><label>Start date</label><input name="start_date" type="date" value="${Z.esc(s.start_date || '')}"></div>
          <div><label>Next of kin</label><input name="next_of_kin" value="${Z.esc(s.next_of_kin || '')}"></div>
          <div><label>Next of kin phone</label><input name="next_of_kin_phone" type="tel" value="${Z.esc(s.next_of_kin_phone || '')}"></div>
          <div style="grid-column:1/-1"><label>Notes</label><textarea name="notes">${Z.esc(s.notes || '')}</textarea></div>
        </div>
        <label class="row" style="gap:8px"><input type="checkbox" name="active" ${s.active ? 'checked' : ''}> Working for Zuri now</label>
        <div style="height:12px"></div><button class="btn block">Save</button>
      </form>`);
    Z.$('#sf', sh.el).onsubmit = async (e) => {
      e.preventDefault();
      const d = Z.formData(e.target);
      const row = { full_name: d.full_name.trim(), job_title: d.job_title.trim() || null, area: d.area || null, profile_id: d.profile_id || null,
        phone: d.phone.trim() || null, mpesa_number: d.mpesa_number.trim() || null, mpesa_name: d.mpesa_name.trim() || null, national_id: d.national_id.trim() || null,
        kra_pin: d.kra_pin.trim().toUpperCase() || null, nssf_no: d.nssf_no.trim() || null, sha_no: d.sha_no.trim() || null, pay_type: d.pay_type,
        salary: Z.num(d.salary) || 0, pay_day: Math.min(31, Math.max(1, parseInt(d.pay_day, 10) || 28)), start_date: d.start_date || null,
        next_of_kin: d.next_of_kin.trim() || null, next_of_kin_phone: d.next_of_kin_phone.trim() || null, notes: d.notes.trim() || null, active: !!d.active, updated_at: new Date().toISOString() };
      const q = s.id ? Z.sb.from('staff').update(row).eq('id', s.id) : Z.sb.from('staff').insert(row);
      const { error } = await q;
      if (error) return Z.fail(error);
      sh.close(); Z.toast('Saved.'); Z.route();
    };
  }

  // 7 Oct deep check #7: Staff & pay also lives under Money → Bills, so a finance clerk (not an admin) can open it.
  Z.moneySubs.push(['staff', 'Staff & pay']);
  Z.moneyViews.staff = (el) => Z.adminViews.staff(el);

  // ---------- Money → Bills → Pay run ----------
  Z.moneySubs.push(['payrun', 'Pay run']);
  Z.moneyViews.payrun = async (el) => {
    const period = Z.ym();
    // 7 Oct deep check #5: anything from an earlier month that is still unpaid stays on the list (it used to vanish on the 1st).
    // ⏱ v2.33: 'waiting' = recorded, waiting for a second person's OK (25_time_savers.sql)
    const [items, waitExp] = await Promise.all([
      Z.sb.from('pay_items').select('*').or(`period.eq.${period},and(status.eq.due,period.lt.${period}),and(status.eq.waiting,period.lt.${period})`).order('due_date').order('name').then(must),
      Z.ts && Z.ts.ok ? Z.ts.ok().then((ok) => (ok ? Z.sb.from('expenses').select('id,bill_id,amount,created_by,recorded_by').eq('approval', 'waiting').then(must).catch(() => []) : [])) : Promise.resolve([]),
    ]);
    // v2.36 (15 Oct): a bill paid in Bills or Money out after the list was built stayed "due" here at its old amount, and
    //       "Record it" paid it a second time. Bill lines now follow the bill: paid → off the list; part-paid → what's still owing.
    const billIds = [...new Set(items.filter((i) => i.kind === 'bill' && i.ref_id).map((i) => i.ref_id))];
    const billRows = billIds.length ? await Z.sb.from('bills').select('id,amount,paid_amount').in('id', billIds).then(must).catch(() => []) : [];
    const owingOf = {}; billRows.forEach((b) => (owingOf[b.id] = Math.max(0, Number(b.amount) - Number(b.paid_amount || 0))));
    let paidElsewhere = 0;
    for (let k = items.length - 1; k >= 0; k--) {
      const i = items[k];
      if (i.kind !== 'bill' || i.status !== 'due' || !(i.ref_id in owingOf)) continue;
      if (owingOf[i.ref_id] <= 0) { items.splice(k, 1); paidElsewhere++; }
      else if (owingOf[i.ref_id] < Number(i.amount)) i.amount = owingOf[i.ref_id];
    }
    const today = Z.ymd();
    const billWait = (i) => (i.kind === 'bill' ? waitExp.filter((e) => e.bill_id === i.ref_id).reduce((t, e) => t + Number(e.amount || 0), 0) : 0);
    const waiting = items.filter((i) => i.status === 'waiting');
    const due = items.filter((i) => i.status === 'due');
    const now = due.filter((i) => i.due_date <= today), soon = due.filter((i) => i.due_date > today);
    const sent = items.filter((i) => i.status === 'sent' && i.period === period);
    const sum = (a) => a.reduce((t, i) => t + Number(i.amount), 0);
    // v2.36 (15 Oct): “To pay now” counted money already recorded and waiting for a second OK (it can't be sent again).
    const sumDue = (a) => a.reduce((t, i) => t + Math.max(0, Number(i.amount) - billWait(i)), 0);
    const row = (i) => `<div class="item" data-id="${i.id}" style="align-items:flex-start;flex-wrap:wrap">
        <span style="font-size:22px">${i.kind === 'staff' ? '👤' : '📋'}</span>
        <div class="grow" style="min-width:200px"><div class="t">${Z.esc(i.name)}</div>
          <div class="m">${i.period < period ? '<span class="pill bad">from ' + Z.esc(new Date(i.period + '-01T12:00:00').toLocaleDateString('en-GB', { month: 'long' })) + '</span> ' : ''}${i.due_date < today ? '<span class="pill bad">overdue</span> ' :i.due_date === today ? '<span class="pill warn">today</span> ' : 'due ' + Z.day(i.due_date) + ' · '}${i.area ? Z.esc(Z.areaName(i.area)) + ' · ' : ''}${i.pay_to ? '📱 ' + Z.esc(i.pay_to) : '<span style="color:var(--warn-ink)">no number — add it to the ' + (i.kind === 'staff' ? 'staff member' : 'bill') + '</span>'}</div>
          ${billWait(i) ? `<div class="m"><span class="pill warn" style="white-space:normal">⏳ KES ${Z.fmt(billWait(i))} already recorded for this bill — waiting for a second OK</span></div>` : ''}
          <div class="row" style="margin-top:6px">${billWait(i) >= Number(i.amount) ? '<a class="btn sec small" href="#money/approvals">👥 See it in Approvals</a>' : `${i.pay_to ? `<button class="btn sec small pr-copy" data-copy="${Z.esc(i.pay_to)}">📋 Copy number</button>` : ''}<button class="btn small pr-sent">✅ Sent — record it</button><button class="btn sec small pr-skip">⏭ Skip</button>`}</div>
        </div><b class="num">KES ${Z.fmt(i.amount)}</b></div>`;
    el.innerHTML = `
      <div class="card" style="border-left:4px solid var(--brand)"><div class="row" style="justify-content:space-between"><div class="grow"><b>Today's pay run</b><div class="hint" style="margin:2px 0 0">Bills that are due and staff whose pay day it is. Send each one in the M-Pesa app, then tap <b>Sent</b> and type the code. Zuri records it as an expense.</div></div><button class="btn small" id="pr-build">🔄 Build today's list</button></div></div>
      <div class="kpis">
        <div class="kpi"><div class="k">To pay now</div><div class="v num ${now.length ? 'bad' : 'ok'}">${Z.fmt(sumDue(now))}</div><div class="f">${now.length} item${now.length === 1 ? '' : 's'}</div></div>
        <div class="kpi"><div class="k">Coming in 3 days</div><div class="v num">${Z.fmt(sumDue(soon))}</div><div class="f">${soon.length} item${soon.length === 1 ? '' : 's'}</div></div>
        <div class="kpi"><div class="k">Sent this month</div><div class="v num ok">${Z.fmt(sum(sent))}</div><div class="f">${sent.length} payment${sent.length === 1 ? '' : 's'}</div></div>
      </div>
      ${paidElsewhere ? `<p class="hint">✅ ${paidElsewhere} bill${paidElsewhere === 1 ? ' was' : 's were'} already paid in Bills, so ${paidElsewhere === 1 ? 'it is' : 'they are'} off this list.</p>` : ''}
      <h3>Pay now · ${now.length}</h3><div class="card list">${now.map(row).join('') || '<div class="muted">Nothing due today. 🎉 Tap Build today\'s list if you expected something.</div>'}</div>
      ${waiting.length ? `<h3>⏳ Waiting for a second OK · ${waiting.length}</h3><div class="card list" id="pr-waiting">${waiting.map((i) => `<div class="item"><span style="font-size:22px">${i.kind === 'staff' ? '👤' : '📋'}</span><div class="grow"><div class="t">${Z.esc(i.name)}</div><div class="m">Recorded by ${Z.esc(Z.personName(i.sent_by) || 'someone')}${i.ref_code ? ' · ' + Z.esc(i.ref_code) : ''} · ${i.sent_by === Z.me.id ? 'someone else must approve it' : '<a href="#money/approvals">approve it in 👥 Approvals</a>'}</div></div><b class="num">KES ${Z.fmt(i.amount)}</b></div>`).join('')}</div>` : ''}
      ${soon.length ? `<h3>Coming up</h3><div class="card list">${soon.map(row).join('')}</div>` : ''}
      <h3>Sent this month</h3><div class="card list">${sent.map((i) => `<div class="item"><div class="grow"><div class="t">${Z.esc(i.name)}</div><div class="m">${Z.when(i.sent_at)} · ${Z.esc(i.paid_from || '')}${i.ref_code ? ' · ' + Z.esc(i.ref_code) : ''} · by ${Z.esc(Z.personName(i.sent_by) || '')}</div></div><b class="num">KES ${Z.fmt(i.amount)}</b></div>`).join('') || '<div class="muted">None yet this month.</div>'}</div>
      ${waitExp.length || waiting.length ? '<p class="hint">👥 Two people: what you record here counts as Sent only after a second finance person or partner approves it.</p>' : ''}
      <p class="hint">Staff and their M-Pesa numbers: <a href="#money/staff">Bills → Staff & pay</a>. Bills' paybill numbers: <a href="#money/bills">Bills → ✏️</a>. Casual staff paid per day or per job are not on the Pay run: pay them, then record it in <a href="#money/expense">Money out</a>.</p>`;
    Z.$('#pr-build', el).onclick = async () => {
      const b = Z.$('#pr-build', el); b.disabled = true;
      const { data, error } = await Z.sb.rpc('build_pay_run');
      b.disabled = false;
      if (error) return Z.fail(error);
      Z.toast(`${data.bills} bill${data.bills === 1 ? '' : 's'} and ${data.staff} staff on the list${data.earlier ? ` · ${data.earlier} from last month` : ''} · ${data.due} to pay.`); Z.route();
    };
    Z.$$('.pr-copy', el).forEach((b) => (b.onclick = () => navigator.clipboard.writeText(b.dataset.copy.replace(/^.*?(\d[\d ]{6,}\d).*$/, '$1')).then(() => Z.toast('Number copied — paste it in M-Pesa.'), () => Z.toast(b.dataset.copy))));
    Z.$$('.pr-skip', el).forEach((b) => (b.onclick = async () => {
      const id = b.closest('[data-id]').dataset.id;
      if (!confirm('Skip this one for now? It comes back when you build the list again.')) return;
      const { error } = await Z.sb.from('pay_items').update({ status: 'skipped' }).eq('id', id);
      if (error) return Z.fail(error);
      Z.route();
    }));
    Z.$$('.pr-sent', el).forEach((b) => (b.onclick = () => {
      const it = items.find((x) => x.id === b.closest('[data-id]').dataset.id);
      const sh = Z.sheet('✅ Record: ' + it.name, `
        <form id="prs">
          <label>How much did you send? (KES)</label><input name="amount" inputmode="numeric" value="${Z.esc(Math.max(0, Number(it.amount) - billWait(it)))}" required>
          <label>Paid from</label><div class="seg" id="prs-from">${['M-Pesa', 'Bank', 'Cash'].map((k, i) => `<button type="button" data-v="${k}" class="${i ? '' : 'on'}">${k === 'M-Pesa' ? '📱' : k === 'Bank' ? '🏦' : '💵'} ${k}</button>`).join('')}</div>
          <label>M-Pesa / bank code</label><input name="ref" autocapitalize="characters" placeholder="e.g. SJK3X9ABCD">
          <div style="height:12px"></div><button class="btn block">Record it</button>
        </form>`);
      let from = 'M-Pesa';
      Z.$$('#prs-from [data-v]', sh.el).forEach((x) => (x.onclick = () => { from = x.dataset.v; Z.$$('#prs-from button', sh.el).forEach((y) => y.classList.toggle('on', y === x)); }));
      Z.$('#prs', sh.el).onsubmit = async (e) => {
        e.preventDefault();
        const amt = Z.num(e.target.amount.value);
        if (!amt || amt <= 0) return Z.toast('Enter the amount.');
        if (it.kind === 'bill' && amt > Number(it.amount) - billWait(it) && !confirm(`That is more than the KES ${Z.fmt(Number(it.amount) - billWait(it))} still owing on this bill. Record it anyway?`)) return;
        const btn = Z.$('button.block', e.target); if (btn.disabled) return; btn.disabled = true;
        const { data, error } = await Z.sb.rpc('record_pay_item', { p_item: it.id, p_from: from, p_ref: e.target.ref.value.trim() || null, p_amount: amt });
        btn.disabled = false;
        if (error) return Z.fail(error);
        sh.close(); Z.toast(data && data.waiting ? 'Recorded — waiting for a second person\'s OK (👥 Approvals).' : 'Recorded as an expense.'); Z.route();
      };
    }));
  };
})();
