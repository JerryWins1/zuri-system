// Zuri System · Money: cash, expenses, bills, collections, cash projection, Friday report · v2 · 2026-09-30
// Carries over everything zuri_ops.html did, on one shared database.
(function () {
  const Z = window.Z;
  const SUBS = [['today', 'Cash today'], ['count', 'Count the cash'], ['expense', 'Money out'], ['in', 'Money in'], ['bills', 'Bills'],
    ['collections', 'Who paid'], ['projection', 'Next 30 days'], ['report', 'Friday report']];
  // Six sections on top; a section with more than one page shows a second small row.
  const SECTIONS = [
    ['💵 Today', ['today', 'count']],
    ['✍️ Record', ['expense', 'in']],
    ['📋 Bills', ['bills', 'payrun', 'staff']], // 7 Oct deep check #7: Staff & pay here too (finance can't open Admin)
    ['👥 Customers', ['collections', 'projection']],
    ['🏦 Statements', ['statements', 'sort', 'books', 'import']],
    ['📊 Report', ['report']],
  ];
  const RECEIPTS = ['Digital / M-Pesa msg', 'Paper receipt — filed', 'No — chase it'];
  const IN_CATS = ['Hotspot', 'Installation fee', 'Reconnection fee', 'Equipment sale', 'Other'];
  const monthStart = (ym = Z.ym()) => ym + '-01';
  const nextMonth = (ym, k = 1) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + k, 1); return Z.ym(d); };
  const monthName = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); };
  const scopeAreas = () => (Z.area ? Z.ref.areas.filter((a) => a.code === Z.area) : Z.ref.areas.filter((a) => a.active));
  const areaSelect = (name = 'area', sel) => `<select name="${name}" required>${Z.opts(Z.ref.areas.filter((a) => a.active).map((a) => [a.code, a.name]), sel || Z.area || Z.me.area || (Z.ref.areas[0] || {}).code)}</select>`;
  const inArea = (q, col = 'area') => (Z.area ? q.eq(col, Z.area) : q);
  const must = (r) => { if (r.error) throw r.error; return r.data; };
  const ord = (n) => n + ([11, 12, 13].includes(n % 100) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));

  const label = (k) => (k === 'import' ? '📥 Bring in a file' : (SUBS.find((x) => x[0] === k) || [k, k])[1]);
  const href = (k) => (k === 'import' ? '#import' : '#money/' + k);
  Z.moneyNav = (sub) => {
    const sec = SECTIONS.find(([, ks]) => ks.includes(sub)) || SECTIONS[0];
    return `<div class="subtabs wrap">${SECTIONS.map(([t, ks]) => `<a href="${href(ks[0])}" class="${sec[0] === t ? 'on' : ''}">${t}</a>`).join('')}</div>
      ${sec[1].length > 1 ? `<div class="seg" style="margin-bottom:14px">${sec[1].map((k) => `<a href="${href(k)}" class="${k === sub ? 'on' : ''}">${label(k)}</a>`).join('')}</div>` : ''}`;
  };
  Z.routes.money = async (args, el) => {
    const sub = SUBS.some(([k]) => k === args[0]) ? args[0] : 'today';
    el.innerHTML = `<h2>Money${Z.area ? ' · ' + Z.esc(Z.areaName(Z.area)) : ' · all areas'}</h2>
      ${Z.moneyNav(sub)}<div id="m-body"><div class="loading">Loading…</div></div>`;
    await VIEWS[sub](Z.$('#m-body', el), args.slice(1));
  };

  // Latest cash count per area.
  async function latestCounts() {
    const rows = must(await inArea(Z.sb.from('cash_counts').select('*')).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(200));
    const out = {};
    for (const r of rows) if (!out[r.area]) out[r.area] = r;
    return out;
  }

  const VIEWS = {};
  // Other files (statements.js) add their own Money sub-tabs here.
  Z.moneySubs = SUBS;
  Z.moneyViews = VIEWS;

  // ---------- Today ----------
  VIEWS.today = async (el) => {
    const ym = Z.ym(), m0 = monthStart(ym), m1 = monthStart(nextMonth(ym));
    const [counts, bills, exp, cin, pays] = await Promise.all([
      latestCounts(),
      inArea(Z.sb.from('bills').select('*').eq('month', ym)).then(must),
      inArea(Z.sb.from('expenses').select('area,amount,receipt,date,payee,category').gte('date', m0).lt('date', m1)).then(must),
      inArea(Z.sb.from('cash_in').select('area,amount,date,category,from_name').gte('date', m0).lt('date', m1)).then(must),
      inArea(Z.sb.from('payments').select('area,amount').gte('date', m0).lt('date', m1)).then(must),
    ]);
    const today = new Date(), dom = today.getDate();
    const sum = (a) => a.reduce((t, r) => t + Number(r.amount || 0), 0);
    const blocks = scopeAreas().map((a) => {
      const lc = counts[a.code];
      const ab = bills.filter((b) => b.area === a.code);
      const unpaid = ab.reduce((t, b) => t + Math.max(0, Number(b.amount) - Number(b.paid_amount)), 0);
      const after = lc ? Number(lc.bank) + Number(lc.mpesa) - unpaid : null;
      const al = [];
      const mp = lc ? Number(lc.mpesa) : null, target = Number(a.float_target);
      if (mp != null && mp < target * 0.5) al.push(['bad', `🚨 M-Pesa float is more than half below the ${Z.fmt(target)} target — top up today and tell Jerry.`]);
      else if (mp != null && mp < target) al.push(['warn', `⚠️ M-Pesa float below the ${Z.fmt(target)} target — flag it, don't wait for Friday.`]);
      if (after != null && after < 0) al.push(['bad', '🚨 Cash after bills is NEGATIVE — stop and tell Jerry before paying anything else.']);
      const dueToday = ab.filter((b) => !b.paid && b.due_day <= dom);
      if (dueToday.length) al.push(['warn', `📅 ${dueToday.length} bill${dueToday.length > 1 ? 's' : ''} due or overdue: ${dueToday.map((b) => b.name).join(', ')}.`]);
      if (today.getDay() === 5 && !(lc && lc.date === Z.ymd())) al.push(['warn', '📊 It\'s Friday — do the cash count, then the Friday report.']);
      if (!lc) al.push(['warn', 'No cash count yet for this area — start with one.']);
      else { const age = Math.floor((Date.now() - new Date(lc.date + 'T12:00:00')) / 864e5); if (age > (Z.CASH_STALE_DAYS || 7)) al.push( // 7 Oct deep check #29: same 7 days as Home
['warn', `⏰ Last cash count was ${age} days ago.`]); }
      const chase = exp.filter((e) => e.area === a.code && e.receipt === 'No — chase it').length;
      if (chase) al.push(['warn', `🧾 ${chase} expense${chase > 1 ? 's' : ''} this month still missing a receipt.`]);
      if (!al.length) al.push(['ok', `✅ Nothing flagged for ${a.name}. Keep it that way.`]);
      return `<h3>${Z.esc(a.name)}</h3>
        <div class="kpis">
          <div class="kpi"><div class="k">Bank</div><div class="v num">${lc ? Z.fmt(lc.bank) : '—'}</div><div class="f">${lc ? 'counted ' + Z.day(lc.date) : 'no count yet'}</div></div>
          <div class="kpi"><div class="k">M-Pesa float</div><div class="v num ${mp == null ? '' : mp < target * 0.5 ? 'bad' : mp < target ? 'warn' : 'ok'}">${lc ? Z.fmt(lc.mpesa) : '—'}</div><div class="f">target ${Z.fmt(target)}</div></div>
          <div class="kpi"><div class="k">Bills still owing</div><div class="v num">${Z.fmt(unpaid)}</div><div class="f">${ab.filter((b) => !b.paid).length} of ${ab.length} bills</div></div>
          <div class="kpi"><div class="k">Cash after bills</div><div class="v num ${after == null ? '' : after < 0 ? 'bad' : 'ok'}">${after == null ? '—' : Z.fmt(after)}</div><div class="f">bank + M-Pesa − owing</div></div>
        </div>${al.map(([k, t]) => `<div class="alert ${k}">${Z.esc(t)}</div>`).join('')}`;
    }).join('');
    el.innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="k">Customer payments · ${monthName(ym)}</div><div class="v num ok">${Z.fmt(sum(pays))}</div><div class="f"><a href="#money/collections" class="tap44" style="min-width:0;min-height:36px">who paid →</a></div></div>
        <div class="kpi"><div class="k">Other cash in</div><div class="v num">${Z.fmt(sum(cin))}</div><div class="f">hotspot, fees…</div></div>
        <div class="kpi"><div class="k">Expenses logged</div><div class="v num">${Z.fmt(sum(exp))}</div><div class="f">this month</div></div>
      </div>
      ${blocks}
      <div class="row" style="margin-top:14px"><a class="btn" href="#money/count">Cash count</a><a class="btn sec" href="#money/expense">Log expense</a><a class="btn sec" href="#money/projection">Cash ahead</a></div>`;
  };

  // ---------- Cash count ----------
  VIEWS.count = async (el) => {
    const rows = must(await inArea(Z.sb.from('cash_counts').select('*')).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(20));
    el.innerHTML = `
      <form class="card" id="mc">
        <p class="hint" style="margin-top:0">Look at the bank app and the M-Pesa business account, then type what each says right now. Leave one empty and it keeps the last count's figure.</p>
        <div class="grid2">
          <div><label>Area</label>${areaSelect()}</div>
          <div><label>Date</label><input type="date" name="date" value="${Z.ymd()}" required></div>
          <div><label>Bank balance (KES)</label><input name="bank" inputmode="numeric" placeholder="e.g. 180,000"></div>
          <div><label>M-Pesa balance (KES)</label><input name="mpesa" inputmode="numeric" placeholder="e.g. 52,000"></div>
          <div><label>Counted by</label><input name="counted_by" value="${Z.esc(Z.me.full_name)}"></div>
          <div><label>Note for Jerry (optional)</label><input name="note"></div>
        </div>
        <div style="height:12px"></div><button class="btn block" type="submit">Save cash count</button>
      </form>
      <h3>Recent counts</h3>
      <div class="card list">${rows.map((r) => `<div class="item"><div class="grow"><div class="t">${Z.esc(Z.areaName(r.area))} · ${Z.day(r.date)}</div><div class="m">Bank ${Z.fmt(r.bank)} · M-Pesa ${Z.fmt(r.mpesa)} · ${Z.esc(r.counted_by || '')}${r.note ? ' · ' + Z.esc(r.note) : ''}</div></div><button class="btn sec small" data-del="${r.id}">×</button></div>`).join('') || '<div class="muted">No counts yet.</div>'}</div>`;
    Z.$('#mc', el).onsubmit = async (e) => {
      e.preventDefault();
      const d = Z.formData(e.target);
      if (d.bank === '' && d.mpesa === '') return Z.toast('Enter at least one balance.');
      // 7 Oct deep check #1: a box left empty keeps the last count's figure (it used to be saved as 0).
      const lc = (d.bank === '' || d.mpesa === '') ? (await latestCounts())[d.area] : null;
      const keep = (v, k) => (v === '' ? (lc ? Number(lc[k]) || 0 : 0) : Z.num(v) || 0);
      const kept = [d.bank === '' && lc ? 'bank' : '', d.mpesa === '' && lc ? 'M-Pesa' : ''].filter(Boolean);
      const note = [d.note.trim(), kept.length ? kept.join(' and ') + ' carried from the ' + lc.date + ' count' : ''].filter(Boolean).join(' · ');
      const { error } = await Z.sb.from('cash_counts').insert({ area: d.area, date: d.date, bank: keep(d.bank, 'bank'), mpesa: keep(d.mpesa, 'mpesa'), counted_by: d.counted_by.trim() || null, note: note || null });
      if (error) return Z.fail(error);
      Z.toast('Cash count saved.'); Z.go('money/today');
    };
    delButtons(el, 'cash_counts');
  };

  function delButtons(el, table, extra) {
    Z.$$('[data-del]', el).forEach((b) => (b.onclick = async () => {
      if (!confirm('Delete this record?')) return;
      const { error } = await Z.sb.from(table).delete().eq('id', b.dataset.del);
      if (error) return Z.fail(error);
      if (extra) await extra(b.dataset.del);
      Z.toast('Deleted.'); Z.route();
    }));
  }

  // ---------- Expense ----------
  // Reads a pasted M-Pesa confirmation message (same rules as zuri_ops.html).
  function parseMpesa(text) {
    const t = text.replace(/\s+/g, ' ').trim();
    const g = (re) => (t.match(re) || [])[1];
    const money = (s) => (s ? Math.round(parseFloat(s.replace(/,/g, ''))) : null);
    const out = {};
    const code = g(/\b([A-Z0-9]{10})\b/); if (code) out.ref = code;
    const amt = g(/Ksh\.?\s?([\d,]+(?:\.\d{2})?)/i); if (amt) out.amount = money(amt);
    const bal = g(/balance is Ksh\.?\s?([\d,]+(?:\.\d{2})?)/i); if (bal) out.balance = money(bal);
    const who = g(/(?:sent to|paid to|to)\s+([A-Z][A-Z0-9 .&'-]+?)(?:\s+\d{7,}|\s+for account|\s+on\s+\d)/i);
    if (who) out.payee = who.trim().replace(/\s+/g, ' ').replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase());
    const dm = t.match(/on\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (dm) out.date = (dm[3].length === 2 ? '20' + dm[3] : dm[3]) + '-' + dm[2].padStart(2, '0') + '-' + dm[1].padStart(2, '0');
    const cost = g(/Transaction cost,?\s*Ksh\.?\s?([\d,]+(?:\.\d{2})?)/i); if (cost) out.fee = money(cost);
    return out;
  }
  Z.parseMpesa = parseMpesa;

  VIEWS.expense = async (el) => {
    const ym = Z.ym();
    const [cats, payees, rows, openBills] = await Promise.all([
      Z.sb.from('expense_categories').select('*').order('sort').then(must),
      Z.sb.from('payees').select('*').order('name').then(must),
      inArea(Z.sb.from('expenses').select('*').gte('date', monthStart(ym)).lt('date', monthStart(nextMonth(ym)))).order('date', { ascending: false }).then(must),
      Z.sb.from('bills').select('*').eq('month', ym).eq('paid', false).then(must),
    ]);
    const approvers = Z.ref.people.filter((p) => p.role === 'admin').map((p) => p.full_name);
    el.innerHTML = `
      <form class="card" id="me">
        <label>Paste the M-Pesa message (optional)</label>
        <textarea id="me-sms" placeholder="e.g. SJK3X9ABCD Confirmed. Ksh2,500.00 paid to KPLC PREPAID…"></textarea>
        <div class="row"><button class="btn sec small" type="button" id="me-read">Read the message</button><span class="hint" id="me-hint">Fills the code, amount, payee and date — and the M-Pesa balance.</span></div>
        <div class="grid2">
          <div><label>Area</label>${areaSelect()}</div>
          <div><label>Date</label><input type="date" name="date" value="${Z.ymd()}" required></div>
          <div><label>Paid to</label><input name="payee" list="me-payees" required autocomplete="off"><datalist id="me-payees">${payees.map((p) => `<option value="${Z.esc(p.name)}">`).join('')}</datalist></div>
          <div><label>Category</label><select name="category" required>${Z.opts(cats.map((c) => c.name))}</select></div>
          <div><label>Amount (KES)</label><input name="amount" inputmode="numeric" required></div>
          <div><label>Paid from</label><select name="paid_from">${Z.opts(['M-Pesa', 'Bank', 'Cash'])}</select></div>
          <div><label>M-Pesa / bank code</label><input name="ref" autocapitalize="characters"></div>
          <div><label>Receipt</label><select name="receipt">${Z.opts(RECEIPTS)}</select></div>
        </div>
        <label class="row" id="me-billrow" style="gap:8px;font-weight:600" hidden><input type="checkbox" name="as_bill" checked> <span id="me-billtxt"></span></label>
        <details style="margin-top:10px"><summary class="hint" style="cursor:pointer;font-weight:600">More details — approval, VAT, note</summary>
        <div class="grid2">
          <div><label>Approved by</label><input name="approved_by" list="me-appr"><datalist id="me-appr">${approvers.map((n) => `<option value="${Z.esc(n)}">`).join('')}</datalist></div>
          <div><label>VAT included (KES, if on the receipt)</label><input name="vat_amount" inputmode="numeric" placeholder="0"></div>
          <div><label>Supplier KRA PIN (for VAT)</label><input name="supplier_pin" autocapitalize="characters" placeholder="e.g. P051234567X"></div>
          <div><label>Note</label><input name="note"></div>
        </div></details>
        <div style="height:12px"></div><button class="btn block" type="submit">Save expense</button>
      </form>
      <h3>${monthName(ym)} · ${Z.kes(rows.reduce((t, r) => t + Number(r.amount), 0))}</h3>
      <div class="card list">${rows.map((r) => `<div class="item"><div class="grow"><div class="t">${Z.esc(r.payee)} <span class="pill ${r.receipt === 'No — chase it' ? 'bad' : 'ok'}">${r.receipt === 'No — chase it' ? 'no receipt' : 'receipt'}</span></div>
        <div class="m">${Z.day(r.date)} · ${Z.esc(Z.areaName(r.area))} · ${Z.esc(r.category || '')} · ${Z.esc(r.paid_from)}${r.ref ? ' · ' + Z.esc(r.ref) : ''}${r.approved_by ? ' · ok ' + Z.esc(r.approved_by) : ''}</div></div>
        <b class="num">−${Z.fmt(r.amount)}</b><button class="btn sec small" data-del="${r.id}">×</button></div>`).join('') || '<div class="muted">No expenses this month.</div>'}</div>`;

    const f = Z.$('#me', el);
    let parsedBalance = null;
    // Is this payment one of this month's unpaid bills? Then it should count against the bill.
    let matchedBill = null;
    const findBill = () => {
      const name = f.payee.value.trim().toLowerCase();
      matchedBill = name.length >= 3 ? openBills.find((b) => b.area === f.area.value && (b.name.toLowerCase().includes(name) || name.includes(b.name.toLowerCase()))) || null : null;
      Z.$('#me-billrow', el).hidden = !matchedBill;
      if (matchedBill) Z.$('#me-billtxt', el).textContent = `This pays the ${matchedBill.name} bill (still owing ${Z.kes(Number(matchedBill.amount) - Number(matchedBill.paid_amount))}) — tick it off the bill list too`;
    };
    f.payee.onchange = () => { const p = payees.find((x) => x.name.toLowerCase() === f.payee.value.trim().toLowerCase()); if (p && p.category) f.category.value = p.category; findBill(); };
    f.payee.oninput = findBill;
    f.area.onchange = findBill;
    Z.$('#me-read', el).onclick = () => {
      const p = parseMpesa(Z.$('#me-sms', el).value);
      const n = Object.keys(p).length;
      if (p.ref) f.ref.value = p.ref;
      if (p.amount) f.amount.value = p.amount;
      if (p.payee) { const known = payees.find((x) => x.name.toLowerCase() === p.payee.toLowerCase()); f.payee.value = known ? known.name : p.payee; f.payee.onchange(); }
      if (p.date) f.date.value = p.date;
      f.paid_from.value = 'M-Pesa'; f.receipt.value = 'Digital / M-Pesa msg';
      if (p.fee) f.note.value = (f.note.value ? f.note.value + ' · ' : '') + 'M-Pesa fee ' + p.fee;
      parsedBalance = p.balance ?? null;
      Z.$('#me-hint', el).textContent = n ? `Filled ${n} field${n > 1 ? 's' : ''}${parsedBalance != null ? ' · M-Pesa balance ' + Z.fmt(parsedBalance) + ' will be saved too' : ''}. Check, then Save.` : 'Could not read that message — fill in by hand.';
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Z.formData(f);
      const row = { area: d.area, date: d.date, payee: d.payee.trim(), category: d.category, amount: Z.num(d.amount), paid_from: d.paid_from,
        ref: d.ref.trim().toUpperCase() || null, approved_by: d.approved_by.trim() || null, receipt: d.receipt, note: d.note.trim() || null,
        vat_amount: Z.num(d.vat_amount) || 0, supplier_pin: d.supplier_pin.trim().toUpperCase() || null, recorded_by: Z.me.full_name };
      if (!row.amount || row.amount <= 0) return Z.toast('Enter the amount.');
      if (matchedBill && d.as_bill) {
        // 7 Oct deep check #2: the bill payment keeps the typed date, approval, VAT, PIN, note and receipt.
        const { error } = await Z.payBill(matchedBill.id, row.amount, row.paid_from, row.ref,
          { p_date: row.date, p_approved_by: row.approved_by, p_vat: row.vat_amount, p_pin: row.supplier_pin, p_note: row.note, p_receipt: row.receipt });
        if (error) return Z.fail(error);
        await saveBalance(row.area, row.date);
        Z.toast(`Saved and counted against the ${matchedBill.name} bill.`); return Z.route();
      }
      const { error } = await Z.sb.from('expenses').insert(row);
      if (error) return Z.fail(error);
      if (!payees.some((p) => p.name.toLowerCase() === row.payee.toLowerCase())) await Z.sb.from('payees').insert({ name: row.payee, category: row.category });
      await saveBalance(row.area, row.date);
      Z.toast('Expense saved.'); Z.route();
    };
    // The M-Pesa message says the new balance — keep it as a fresh M-Pesa count.
    // 7 Oct deep check #8: dated the day of the message (not today), and skipped when a newer count already exists.
    async function saveBalance(area, date) {
      if (parsedBalance == null) return;
      const day = date || Z.ymd();
      const lc = (await latestCounts())[area];
      if (lc && lc.date > day) return;
      await Z.sb.from('cash_counts').insert({ area, date: day, bank: lc ? lc.bank : 0, mpesa: parsedBalance, counted_by: 'M-Pesa message', note: 'M-Pesa balance from confirmation message' });
    }
    delButtons(el, 'expenses');
  };

  // ---------- Cash in (non-customer money: hotspot, fees) ----------
  VIEWS.in = async (el) => {
    const ym = Z.ym();
    const rows = must(await inArea(Z.sb.from('cash_in').select('*').gte('date', monthStart(ym)).lt('date', monthStart(nextMonth(ym)))).order('date', { ascending: false }));
    el.innerHTML = `
      <form class="card" id="mi">
        <p class="hint" style="margin-top:0">Money that isn't a customer's monthly payment (those come from the billing-website import). Hotspot takings, installation fees, equipment sales.</p>
        <div class="grid2">
          <div><label>Area</label>${areaSelect()}</div>
          <div><label>Date</label><input type="date" name="date" value="${Z.ymd()}" required></div>
          <div><label>What for</label><select name="category">${Z.opts(IN_CATS)}</select></div>
          <div><label>Amount (KES)</label><input name="amount" inputmode="numeric" required></div>
          <div><label>Received into</label><select name="received_to">${Z.opts(['M-Pesa', 'Bank', 'Cash'])}</select></div>
          <div><label>From</label><input name="from_name"></div>
          <div><label>Ref / M-Pesa code</label><input name="ref" autocapitalize="characters"></div>
          <div><label>Note</label><input name="note"></div>
        </div>
        <div style="height:12px"></div><button class="btn block" type="submit">Save cash in</button>
      </form>
      <h3>${monthName(ym)} · ${Z.kes(rows.reduce((t, r) => t + Number(r.amount), 0))}</h3>
      <div class="card list">${rows.map((r) => `<div class="item"><div class="grow"><div class="t">${Z.esc(r.category)}</div><div class="m">${Z.day(r.date)} · ${Z.esc(Z.areaName(r.area))} · ${Z.esc(r.received_to)}${r.from_name ? ' · ' + Z.esc(r.from_name) : ''}${r.ref ? ' · ' + Z.esc(r.ref) : ''}</div></div><b class="num" style="color:var(--ok)">+${Z.fmt(r.amount)}</b><button class="btn sec small" data-del="${r.id}">×</button></div>`).join('') || '<div class="muted">Nothing yet this month.</div>'}</div>`;
    Z.$('#mi', el).onsubmit = async (e) => {
      e.preventDefault();
      const d = Z.formData(e.target);
      const amount = Z.num(d.amount);
      if (!amount || amount <= 0) return Z.toast('Enter the amount.');
      const { error } = await Z.sb.from('cash_in').insert({ area: d.area, date: d.date, category: d.category, amount, received_to: d.received_to, from_name: d.from_name.trim() || null, ref: d.ref.trim().toUpperCase() || null, note: d.note.trim() || null, recorded_by: Z.me.full_name });
      if (error) return Z.fail(error);
      Z.toast('Saved.'); Z.route();
    };
    delButtons(el, 'cash_in');
  };

  // ---------- Bills ----------
  VIEWS.bills = async (el, args) => {
    const ym = /^\d{4}-\d{2}$/.test(args[0] || '') ? args[0] : Z.ym();
    const [cats, bills, counts] = await Promise.all([
      Z.sb.from('expense_categories').select('name').order('sort').then(must),
      inArea(Z.sb.from('bills').select('*').eq('month', ym)).order('due_day').order('name').then(must),
      latestCounts(),
    ]);
    const owing = (b) => Math.max(0, Number(b.amount) - Number(b.paid_amount));
    const areas = scopeAreas();
    el.innerHTML = `
      <div class="row" style="justify-content:space-between;margin-bottom:8px">
        <a class="btn sec small" href="#money/bills/${nextMonth(ym, -1)}">←</a><b>${monthName(ym)}</b><a class="btn sec small" href="#money/bills/${nextMonth(ym)}">→</a>
      </div>
      <p class="hint">Pay a bill here and it's logged as an expense automatically. Part-payments are fine: what's still owing stays on the list.</p>
      ${areas.map((a) => {
        const ab = bills.filter((b) => b.area === a.code);
        const lc = counts[a.code];
        const totalOwing = ab.reduce((t, b) => t + owing(b), 0);
        const after = lc ? Number(lc.bank) + Number(lc.mpesa) - totalOwing : null;
        return `<h3>${Z.esc(a.name)} · owing ${Z.kes(totalOwing)}${after != null ? ` · <span style="color:var(--${after < 0 ? 'bad' : 'ok'})">cash after bills ${Z.fmt(after)}</span>` : ''}</h3>
        <div class="card">${ab.length ? `<div class="bill-cards list">${ab.map((b) => `<div class="item" style="flex-wrap:wrap;${b.paid ? 'opacity:.55' : ''}"><div class="grow" style="min-width:150px"><div class="t" style="${b.paid ? 'text-decoration:line-through' : ''}">${Z.esc(b.name)}</div>
            <div class="m">Due the ${ord(b.due_day)} · ${Z.esc(b.category || '')}</div><div class="m">Amount ${Z.fmt(b.amount)} · paid ${Z.fmt(b.paid_amount)}</div></div>
            <div style="text-align:right"><div class="hint" style="margin:0">owing</div><b class="num">${Z.fmt(owing(b))}</b></div>
            <div class="row" style="width:100%;justify-content:flex-end">${b.paid ? '✅ Paid' : `<button class="btn small" data-pay="${b.id}">💸 Pay</button>`}<button class="btn sec small" data-edit="${b.id}" aria-label="Change ${Z.esc(b.name)}">✏️ Change</button></div></div>`).join('')}</div>
          <!-- 7 Oct deep check #10: on a phone the cards above show instead of this six-column table -->
          <div class="scroll-x bill-table"><table class="t"><tr><th>Bill</th><th>Due</th><th class="r">Amount</th><th class="r">Paid</th><th class="r">Owing</th><th></th></tr>
          ${ab.map((b) => `<tr style="${b.paid ? 'opacity:.55;text-decoration:line-through' : ''}"><td>${Z.esc(b.name)}<div class="hint" style="margin:0">${Z.esc(b.category || '')}</div></td><td>${ord(b.due_day)}</td>
            <td class="r num">${Z.fmt(b.amount)}</td><td class="r num">${Z.fmt(b.paid_amount)}</td><td class="r num"><b>${Z.fmt(owing(b))}</b></td>
            <td style="white-space:nowrap">${b.paid ? '✅' : `<button class="btn small" data-pay="${b.id}">Pay</button>`} <button class="btn sec small" data-edit="${b.id}">✏️</button></td></tr>`).join('')}</table></div>`
          : `<div class="muted">No bills for ${monthName(ym)}.</div>`}
          <div class="row" style="margin-top:10px"><button class="btn sec small" data-copy="${a.code}">Copy last month's bills</button></div></div>`;
      }).join('')}
      <h3>Add a bill</h3>
      <form class="card" id="mb">
        <div class="grid3">
          <div><label>Area</label>${areaSelect()}</div>
          <div><label>Bill</label><input name="name" required placeholder="e.g. Safaricom backhaul"></div>
          <div><label>Amount (KES)</label><input name="amount" inputmode="numeric" required></div>
          <div><label>Due day of month</label><input name="due_day" type="number" min="1" max="31" value="1" required></div>
          <div><label>Category</label><select name="category">${Z.opts(cats.map((c) => c.name))}</select></div>
          <div><label>Pay to (paybill · account, or phone)</label><input name="pay_to" placeholder="e.g. Paybill 888880 · Acc 5412"></div>
          <div style="align-self:end"><button class="btn block" type="submit">Add bill</button></div>
        </div>
      </form>`;

    Z.$('#mb', el).onsubmit = async (e) => {
      e.preventDefault();
      const d = Z.formData(e.target);
      const { error } = await Z.sb.from('bills').insert({ area: d.area, month: ym, name: d.name.trim(), amount: Z.num(d.amount), due_day: Math.min(31, Math.max(1, parseInt(d.due_day, 10) || 1)), category: d.category, pay_to: d.pay_to.trim() || null });
      if (error) return Z.toast(/unique|duplicate/i.test(error.message) ? 'That bill is already on this month\'s list.' : Z.errText(error));
      Z.toast('Bill added.'); Z.route();
    };
    Z.$$('[data-copy]', el).forEach((b) => (b.onclick = async () => {
      const prev = must(await Z.sb.from('bills').select('*').eq('area', b.dataset.copy).eq('month', nextMonth(ym, -1)));
      if (!prev.length) return Z.toast('No bills found for last month.');
      const { error } = await Z.sb.from('bills').upsert(prev.map((p) => ({ area: p.area, month: ym, name: p.name, amount: p.amount, due_day: p.due_day, category: p.category, pay_to: p.pay_to })), { onConflict: 'area,month,name', ignoreDuplicates: true });
      if (error) return Z.fail(error);
      Z.toast(`Copied ${prev.length} bills.`); Z.route();
    }));
    Z.$$('[data-pay]', el).forEach((btn) => (btn.onclick = () => payBillSheet(bills.find((x) => x.id === btn.dataset.pay), bills, counts)));
    Z.$$('[data-edit]', el).forEach((btn) => (btn.onclick = () => {
      const b = bills.find((x) => x.id === btn.dataset.edit);
      const sh = Z.sheet(`✏️ ${b.name} · ${monthName(ym)}`, `
        <form id="be"><label>Amount for this month (KES)</label><input name="amount" inputmode="numeric" value="${Z.esc(b.amount)}" required>
          <label>Due day of the month</label><input name="due_day" type="number" min="1" max="31" value="${Z.esc(b.due_day)}" required>
          <label>Pay to (paybill · account, or phone)</label><input name="pay_to" value="${Z.esc(b.pay_to || '')}" placeholder="e.g. Paybill 888880 · Acc 5412">
          <div style="height:14px"></div><button class="btn block">Save</button></form>
        <div style="height:10px"></div><button class="btn sec block" id="be-del">🗑️ Remove this bill from ${monthName(ym)}</button>
        <p class="hint">Payments already made stay in Money out.</p>`);
      Z.$('#be', sh.el).onsubmit = async (e) => {
        e.preventDefault();
        const amt = Z.num(e.target.amount.value);
        if (amt == null || amt < 0) return Z.toast('Enter an amount.');
        const { error } = await Z.sb.from('bills').update({ amount: amt, due_day: Math.min(31, Math.max(1, parseInt(e.target.due_day.value, 10) || 1)), pay_to: e.target.pay_to.value.trim() || null }).eq('id', b.id);
        if (error) return Z.fail(error);
        sh.close(); Z.toast('Bill updated.'); Z.route();
      };
      Z.$('#be-del', sh.el).onclick = async () => {
        if (!confirm(`Remove ${b.name} from ${monthName(ym)}?`)) return;
        const { error } = await Z.sb.from('bills').delete().eq('id', b.id);
        if (error) return Z.fail(error);
        sh.close(); Z.toast('Removed.'); Z.route();
      };
    }));
  };

  // 7 Oct deep check #2: pay a bill and keep the details typed in Money out. Uses the new pay_bill
  // (supabase/21_deep_check_fixes.sql); until that is run, falls back to the old pay_bill and then
  // corrects the expense it made, so nothing typed is lost either way.
  const NO_FN = /could not find the function|function .*does not exist|PGRST202|schema cache/i;
  Z.payBill = async (bill, amount, from, ref, extra = {}) => {
    const clean = Object.fromEntries(Object.entries(extra).filter(([, v]) => v != null && v !== ''));
    const base = { p_bill: bill, p_amount: amount, p_from: from, p_ref: ref || null };
    let r = Object.keys(clean).length ? await Z.sb.rpc('pay_bill', { ...base, ...clean }) : await Z.sb.rpc('pay_bill', base);
    if (!r.error || !Object.keys(clean).length || !NO_FN.test(String(r.error.message || r.error.code || ''))) return r;
    r = await Z.sb.rpc('pay_bill', base);
    if (r.error || !r.data || !r.data.expense) return r;
    const fix = {};
    if (clean.p_date) fix.date = clean.p_date;
    if (clean.p_approved_by) fix.approved_by = clean.p_approved_by;
    if (clean.p_vat) fix.vat_amount = clean.p_vat;
    if (clean.p_pin) fix.supplier_pin = clean.p_pin;
    if (clean.p_note) fix.note = 'Bill payment · ' + clean.p_note;
    if (clean.p_receipt) fix.receipt = clean.p_receipt;
    if (Object.keys(fix).length) {
      const u = await Z.sb.from('expenses').update(fix).eq('id', r.data.expense);
      if (u.error) Z.toast('Paid, but the extra details did not save: ' + Z.errText(u.error));
      if (fix.date) await Z.sb.from('bills').update({ paid_date: fix.date }).eq('id', bill);
    }
    return r;
  };

  // One sheet for paying a bill: how much, from where, the code. The database does the sum (no lost updates).
  function payBillSheet(b, bills, counts) {
    const owing = (x) => Math.max(0, Number(x.amount) - Number(x.paid_amount));
    const lc = counts[b.area];
    const areaOwing = bills.filter((x) => x.area === b.area).reduce((t, x) => t + owing(x), 0);
    const short = lc && Number(lc.bank) + Number(lc.mpesa) - areaOwing < 0;
    const sh = Z.sheet(`💸 Pay ${b.name}`, `
      ${short ? '<div class="alert bad">Cash after bills is below zero for this area. The rule: stop and tell Jerry before paying.</div>' : ''}
      <form id="pb">
        <label>How much are you sending now? (KES)</label>
        <input name="amount" inputmode="numeric" value="${owing(b)}" required>
        <p class="hint">Still owing ${Z.kes(owing(b))} of ${Z.kes(b.amount)}. Part-payments are fine.</p>
        <label>Paid from</label>
        <div class="seg" id="pb-from">${['M-Pesa', 'Bank', 'Cash'].map((k, i) => `<button type="button" data-v="${k}" class="${i ? '' : 'on'}">${k === 'M-Pesa' ? '📱' : k === 'Bank' ? '🏦' : '💵'} ${k}</button>`).join('')}</div>
        <label>M-Pesa or bank code (if any)</label><input name="ref" autocapitalize="characters" placeholder="e.g. SJK3X9ABCD">
        <div style="height:14px"></div>
        <button class="btn block">${short ? 'Pay anyway' : 'Pay and record it'}</button>
      </form>`);
    let from = 'M-Pesa';
    Z.$$('#pb-from [data-v]', sh.el).forEach((x) => (x.onclick = () => { from = x.dataset.v; Z.$$('#pb-from button', sh.el).forEach((y) => y.classList.toggle('on', y === x)); }));
    Z.$('#pb', sh.el).onsubmit = async (e) => {
      e.preventDefault();
      const amt = Z.num(e.target.amount.value);
      if (!amt || amt <= 0) return Z.toast('Enter an amount.');
      const btn = Z.$('button.block', e.target); btn.disabled = true;
      const { data, error } = await Z.sb.rpc('pay_bill', { p_bill: b.id, p_amount: amt, p_from: from, p_ref: e.target.ref.value.trim() || null });
      btn.disabled = false;
      if (error) return Z.fail(error);
      sh.close();
      const left = bills.filter((x) => x.area === b.area && x.id !== b.id && !x.paid).length;
      Z.toast(Number(data.paid_amount) >= Number(data.amount) && !left ? '✅ Every bill paid. The books are clean.' : 'Paid and recorded in Money out.');
      Z.route();
    };
  }
  Z.payBillSheet = payBillSheet;

  // ---------- Who paid ----------
  const STATE = { late: ['Late', 'bad'], unpaid: ['Not paid (no history)', 'warn'], part: ['Part paid', 'warn'], due_later: ['Not due yet', ''], paid: ['Paid', 'ok'] };
  const waPhone = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '254' + d.slice(1); else if (d.length === 9) d = '254' + d; return d; };
  VIEWS.collections = async (el, args) => {
    const ym = /^\d{4}-\d{2}$/.test(args[0] || '') ? args[0] : Z.ym();
    const show = args[1] || 'late';
    let rows = must(await Z.sb.rpc('collections_month', { p_month: ym }));
    if (Z.area) rows = rows.filter((r) => r.area === Z.area);
    const by = (s) => rows.filter((r) => r.state === s);
    const expected = rows.reduce((t, r) => t + Number(r.monthly_rate || 0), 0);
    const got = rows.reduce((t, r) => t + Number(r.paid_this_month || 0), 0);
    const lateOwed = by('late').concat(by('part')).reduce((t, r) => t + Math.max(0, Number(r.monthly_rate || 0) - Number(r.paid_this_month || 0)), 0);
    const list = show === 'all' ? rows : by(show);
    const mName = monthName(ym).split(' ')[0];
    el.innerHTML = `
      <div class="row" style="justify-content:space-between;margin-bottom:8px">
        <a class="btn sec small" href="#money/collections/${nextMonth(ym, -1)}/${show}">←</a><b>${monthName(ym)}</b><a class="btn sec small" href="#money/collections/${nextMonth(ym)}/${show}">→</a>
      </div>
      <div class="kpis">
        <div class="kpi"><div class="k">Collected</div><div class="v num ok">${Z.fmt(got)}</div><div class="f">of about ${Z.fmt(expected)} expected</div></div>
        <div class="kpi"><div class="k">Paid in full</div><div class="v num">${by('paid').length}</div><div class="f">of ${rows.length} active customers</div></div>
        <div class="kpi"><div class="k">Late or part-paid</div><div class="v num bad">${by('late').length + by('part').length}</div><div class="f">still owe ${Z.fmt(lateOwed)}</div></div>
        <div class="kpi"><div class="k">Not due yet</div><div class="v num">${by('due_later').length}</div><div class="f">usually pay later in the month</div></div>
      </div>
      <div class="subtabs">${[['late', 'Late'], ['part', 'Part paid'], ['unpaid', 'No history'], ['due_later', 'Not due yet'], ['paid', 'Paid'], ['all', 'All']].map(([k, t]) => `<a href="#money/collections/${ym}/${k}" class="${k === show ? 'on' : ''}">${t} (${k === 'all' ? rows.length : by(k).length})</a>`).join('')}</div>
      <p class="hint">Billnasi texts everyone 3 days before their package runs out. 📩 and 💬 appear once someone has been switched off — the message fits how many days it has been (day 1 reconnect help · day 3 anything wrong? · day 7 we miss you · day 14 last check-in · day 30 goodbye). "Usual day" is learned from each customer's last 6 months of payments. Import the billing websites' exports to keep it accurate.</p>
      <div class="card list">${list.length ? list.map((r) => {
        const owe = Math.max(0, Number(r.monthly_rate || 0) - Number(r.paid_this_month || 0));
        /* 8 Oct (Jerry): Billnasi texts everyone 3 days before the package runs out — we don't send "it's due" reminders.
           Once they're cut off, the text is the after-cutoff step for how many days it has been. */
        const cutDays = r.paid_until && new Date(r.paid_until) < new Date() ? Math.floor((Date.now() - new Date(r.paid_until)) / 864e5) : null;
        const cutStep = cutDays == null || !Z.AFTER_CUTOFF ? null : (Z.AFTER_CUTOFF.find((x) => cutDays >= x.from && cutDays <= x.to) || null);
        const msg = cutStep ? cutStep.msg({ full_name: r.full_name, account_no: r.account_no, monthly_rate: owe || r.monthly_rate }) : '';
        return `<div class="item"><div class="grow"><a class="t" href="#customers/${r.customer_id}" style="text-decoration:none;color:inherit">${Z.esc(r.full_name)}</a>
          <div class="m">${Z.esc(Z.areaName(r.area))}${r.monthly_rate != null ? ' · rate ' + Z.fmt(r.monthly_rate) : ''}${Number(r.paid_this_month) ? ' · paid ' + Z.fmt(r.paid_this_month) : ''}${r.paid_until ? (new Date(r.paid_until) < new Date() ? ' · ran out ' : ' · renews ') + Z.day(r.paid_until) : r.usual_day ? ' · usually pays ~' + ord(r.usual_day) : ''}${r.reliability != null ? ' · pays ' + Math.round(r.reliability * 100) + '% of months' : ''}</div></div>
          <span class="pill ${STATE[r.state][1]}">${STATE[r.state][0]}</span>
          ${r.phone && ['late', 'part', 'unpaid'].includes(r.state) ? `<a class="btn sec small" href="tel:${Z.esc(r.phone)}" aria-label="Call">📞</a>${msg ? `<a class="btn sec small" href="${Z.esc(Z.smsHref(r.phone, msg))}" aria-label="Text: ${Z.esc(cutStep.name)}">📩</a><a class="btn sec small" target="_blank" rel="noopener" href="https://wa.me/${waPhone(r.phone)}?text=${encodeURIComponent(msg)}" aria-label="WhatsApp: ${Z.esc(cutStep.name)}">💬</a>` : ''}` : ''}</div>`;
      }).join('') : '<div class="empty">Nobody in this group.</div>'}</div>`;
  };

  // ---------- Cash ahead (projection) ----------
  VIEWS.projection = async (el) => {
    const extras = Z.get('proj_extras', []).filter((x) => x.date >= Z.ymd());
    Z.set('proj_extras', extras);
    const start = Z.get('proj_start', '');
    const counts = await latestCounts();
    const areas = scopeAreas();
    const countNote = areas.map((a) => counts[a.code] ? `${a.name}: counted ${Z.day(counts[a.code].date)}` : `${a.name}: no count`).join(' · ');
    const stale = areas.some((a) => !counts[a.code] || counts[a.code].date < Z.ymd());
    const [proj, coll] = await Promise.all([
      // 7 Oct deep check #6: ask for 30 days like Home does (the database default stops at month end).
      Z.sb.rpc('cash_projection', { p_area: Z.area || null, p_start: Z.num(start), p_extra: extras, p_until: Z.ymd(new Date(Date.now() + 29 * 864e5)) }).then(must),
      Z.sb.rpc('collections_month', { p_month: Z.ym() }).then(must),
    ]);
    const late = coll.filter((r) => (!Z.area || r.area === Z.area) && ['late', 'part'].includes(r.state));
    const upside = late.reduce((t, r) => t + Math.max(0, Number(r.monthly_rate || 0) - Number(r.paid_this_month || 0)), 0);
    const low = proj.reduce((m, r) => (Number(r.balance) < Number(m.balance) ? r : m), proj[0] || { balance: 0 });
    const short = proj.find((r) => Number(r.balance) < 0);
    const end = proj[proj.length - 1] || { balance: 0 };
    const totIn = proj.reduce((t, r) => t + Number(r.customers_in) + Number(r.other_in), 0);
    const totOut = proj.reduce((t, r) => t + Number(r.bills_out), 0);

    el.innerHTML = `
      ${short ? `<div class="alert bad">🚨 Cash runs short on ${Z.day(short.day)} (${Z.fmt(short.balance)}). ${short.note ? Z.esc(short.note) + '.' : ''} Tell Jerry now, not on the day.</div>` : proj.length ? '<div class="alert ok">✅ Cash stays above zero for the next 30 days.</div>' : ''}
      <div class="kpis">
        <div class="kpi"><div class="k">Lowest point</div><div class="v num ${Number(low.balance) < 0 ? 'bad' : 'ok'}">${Z.fmt(low.balance)}</div><div class="f">${low.day ? Z.day(low.day) : ''}</div></div>
        <div class="kpi"><div class="k">In 30 days</div><div class="v num">${Z.fmt(end.balance)}</div><div class="f">${end.day ? Z.day(end.day) : ''}</div></div>
        <div class="kpi"><div class="k">Expected in</div><div class="v num ok">${Z.fmt(totIn)}</div><div class="f">customers + hotspot etc.</div></div>
        <div class="kpi"><div class="k">Bills still to pay</div><div class="v num">${Z.fmt(totOut)}</div><div class="f">next 30 days</div></div>
        <div class="kpi"><div class="k">Upside if late payers pay</div><div class="v num">${Z.fmt(upside)}</div><div class="f">${late.length} customer${late.length === 1 ? '' : 's'} · <a href="#money/collections">chase →</a></div></div>
      </div>
      <div class="card"><div class="chart-box"><canvas id="mp-chart" aria-label="Cash balance by day"></canvas></div></div>
      <div class="card">
        <label>Start from today's balance (KES)</label>
        <div class="row"><input id="mp-start" inputmode="numeric" value="${Z.esc(start)}" placeholder="Blank = latest cash count" style="flex:1"><button class="btn sec" id="mp-go">Update</button></div>
        <p class="hint">${Z.esc(countNote)}${stale && !start ? ' — do a fresh cash count (or type today\'s balance) for a truer picture.' : ''}</p>
        <label>One-off money in or out</label>
        <div class="list">${extras.map((x, i) => `<div class="item"><div class="grow">${Z.day(x.date)} · ${Z.esc(x.label)}</div><b class="num" style="color:var(--${x.amount < 0 ? 'bad' : 'ok'})">${x.amount < 0 ? '−' : '+'}${Z.fmt(Math.abs(x.amount))}</b><button class="btn sec small" data-rm="${i}">×</button></div>`).join('') || '<div class="muted">None. e.g. funding from Jerry, a generator repair.</div>'}</div>
        <form id="mp-x" class="grid3" style="margin-top:8px;align-items:end">
          <div><label>Day</label><input type="date" name="date" min="${Z.ymd()}" value="${Z.ymd()}" required></div>
          <div><label>Amount (use − for money out)</label><input name="amount" inputmode="numeric" required placeholder="50000 or -12000"></div>
          <div class="row"><div class="grow"><label>What</label><input name="label" required placeholder="Funding from Jerry"></div><button class="btn sec" type="submit">Add</button></div>
        </form>
      </div>
      <h3>Day by day</h3>
      <div class="card scroll-x"><table class="t"><tr><th>Day</th><th class="r">Customers</th><th class="r">Other in</th><th class="r">Bills out</th><th class="r">One-off</th><th class="r">Balance</th><th>Note</th></tr>
        ${proj.map((r) => `<tr><td>${Z.day(r.day)}</td><td class="r num">${Z.fmt(r.customers_in)}</td><td class="r num">${Z.fmt(r.other_in)}</td><td class="r num">${Number(r.bills_out) ? '−' + Z.fmt(r.bills_out) : ''}</td><td class="r num">${Number(r.extra) ? Z.fmt(r.extra) : ''}</td>
          <td class="r num" style="font-weight:700;color:var(--${Number(r.balance) < 0 ? 'bad' : 'ink'})">${Z.fmt(r.balance)}</td><td class="hint">${Z.esc(r.note || '')}</td></tr>`).join('')}</table></div>
      <p class="hint">How it works: each customer who hasn't paid yet is expected on their usual pay day, counted at their rate × how reliably they pay. Customers who are already late are left out (that's the "upside" above). Hotspot and other income use last month's daily average. Bills land on their due day.</p>`;

    Z.$('#mp-go', el).onclick = () => { Z.set('proj_start', Z.$('#mp-start', el).value.trim()); Z.route(); };
    Z.$('#mp-x', el).onsubmit = (e) => {
      e.preventDefault();
      const d = Z.formData(e.target);
      const amount = Z.num(d.amount);
      if (!amount) return Z.toast('Enter an amount.');
      extras.push({ date: d.date, amount, label: d.label.trim() }); Z.set('proj_extras', extras); Z.route();
    };
    Z.$$('[data-rm]', el).forEach((b) => (b.onclick = () => { extras.splice(+b.dataset.rm, 1); Z.set('proj_extras', extras); Z.route(); }));

    try {
      await Z.chartLib();
      const css = getComputedStyle(document.documentElement);
      const col = (v) => css.getPropertyValue(v).trim();
      new Chart(Z.$('#mp-chart', el), {
        data: {
          labels: proj.map((r) => new Date(r.day + 'T12:00:00').getDate()),
          datasets: [
            { type: 'line', label: 'Balance', data: proj.map((r) => Number(r.balance)), borderColor: col('--brand'), backgroundColor: col('--brand'), tension: 0.25, pointRadius: 2, yAxisID: 'y' },
            { type: 'bar', label: 'Money in', data: proj.map((r) => Number(r.customers_in) + Number(r.other_in) + Math.max(0, Number(r.extra))), backgroundColor: col('--ok') + '88', yAxisID: 'y' },
            { type: 'bar', label: 'Money out', data: proj.map((r) => -(Number(r.bills_out) + Math.max(0, -Number(r.extra)))), backgroundColor: col('--bad') + '88', yAxisID: 'y' },
          ],
        },
        options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { color: col('--ink-soft'), boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: KES ${Z.fmt(c.raw)}` } } },
          scales: { x: { ticks: { color: col('--ink-faint') }, grid: { display: false }, title: { display: true, text: 'Day', color: col('--ink-faint') } },
                    y: { ticks: { color: col('--ink-faint'), callback: (v) => Z.fmt(v) }, grid: { color: col('--line') } } } },
      });
    } catch (e) { Z.$('#mp-chart', el).replaceWith(Object.assign(document.createElement('p'), { className: 'hint', textContent: 'Chart needs a connection the first time.' })); }
  };

  // ---------- Friday report + month export ----------
  VIEWS.report = async (el) => {
    const ym = Z.ym(), m0 = monthStart(ym), m1 = monthStart(nextMonth(ym));
    const [counts, bills, exp, cin, pays, coll] = await Promise.all([
      latestCounts(),
      Z.sb.from('bills').select('*').eq('month', ym).then(must),
      Z.sb.from('expenses').select('area,amount,receipt').gte('date', m0).lt('date', m1).then(must),
      Z.sb.from('cash_in').select('area,amount').gte('date', m0).lt('date', m1).then(must),
      Z.sb.from('payments').select('area,amount').gte('date', m0).lt('date', m1).then(must),
      Z.sb.rpc('collections_month', { p_month: ym }).then(must),
    ]);
    const sum = (a, area) => a.filter((r) => r.area === area).reduce((t, r) => t + Number(r.amount), 0);
    const L = [];
    L.push(`*ZURI FIBER — FRIDAY REPORT — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}*`, '');
    for (const a of Z.ref.areas.filter((x) => x.active)) {
      const lc = counts[a.code];
      const ab = bills.filter((b) => b.area === a.code);
      const unpaid = ab.reduce((t, b) => t + Math.max(0, Number(b.amount) - Number(b.paid_amount)), 0);
      const late = coll.filter((r) => r.area === a.code && ['late', 'part'].includes(r.state));
      L.push(`*${a.name}*`);
      // 7 Oct deep check #28: an old count is flagged, not passed off as this week's.
      const age = lc ? Math.floor((Date.now() - new Date(lc.date + 'T12:00:00')) / 864e5) : null;
      L.push(lc ? `Bank: KES ${Z.fmt(lc.bank)} | M-Pesa: KES ${Z.fmt(lc.mpesa)}${Number(lc.mpesa) < Number(a.float_target) ? ' ⚠️ below target' : ' ✅'} (counted ${lc.date} by ${lc.counted_by || '—'})${age > (Z.CASH_STALE_DAYS || 7) ? ` ⚠️ ${age} days old — no count this week` : ''}` : 'Bank / M-Pesa: no count this week ⚠️');
      L.push(`Bills owing: KES ${Z.fmt(unpaid)} (${ab.filter((b) => !b.paid).length} of ${ab.length})`);
      if (lc) { const after = Number(lc.bank) + Number(lc.mpesa) - unpaid; L.push(`Cash after bills: KES ${Z.fmt(after)}${after < 0 ? ' 🚨 NEGATIVE' : ''}`); }
      L.push(`Month to date — customer payments: KES ${Z.fmt(sum(pays, a.code))} | other cash in: KES ${Z.fmt(sum(cin, a.code))} | expenses: KES ${Z.fmt(sum(exp, a.code))}`);
      if (late.length) L.push(`Late / part-paid customers: ${late.length}`);
      const chase = exp.filter((r) => r.area === a.code && r.receipt === 'No — chase it').length;
      if (chase) L.push(`Receipts missing: ${chase}`);
      L.push('');
    }
    L.push('_Escalation: anything red above → Jerry same day. >48h stuck items escalate._', '_Generated by Zuri System_');
    const text = L.join('\n');
    el.innerHTML = `<div class="card"><pre class="report">${Z.esc(text)}</pre>
      <div class="row"><button class="btn" id="mr-copy">Copy for WhatsApp</button><button class="btn sec" id="mr-csv">Export ${monthName(ym)} to CSV</button></div></div>`;
    Z.$('#mr-copy', el).onclick = () => navigator.clipboard.writeText(text).then(() => Z.toast('Copied — paste into the partners\' WhatsApp group.'), () => Z.toast('Select the text and copy it by hand.'));
    Z.$('#mr-csv', el).onclick = () => exportMonth(ym);
  };

  async function exportMonth(ym) {
    const m0 = monthStart(ym), m1 = monthStart(nextMonth(ym));
    const [exp, cin, cc, pays] = await Promise.all([
      Z.sb.from('expenses').select('*').gte('date', m0).lt('date', m1).order('date').then(must),
      Z.sb.from('cash_in').select('*').gte('date', m0).lt('date', m1).order('date').then(must),
      Z.sb.from('cash_counts').select('*').gte('date', m0).lt('date', m1).order('date').then(must),
      Z.sb.from('payments').select('*').gte('date', m0).lt('date', m1).order('date').then(must),
    ]);
    const rows = [['Type', 'Area', 'Date', 'Category', 'Payee/From', 'Amount KES', 'Method', 'Ref', 'Approved by', 'Receipt', 'VAT KES', 'Supplier PIN', 'Note', 'Recorded by']];
    exp.forEach((r) => rows.push(['Expense', Z.areaName(r.area), r.date, r.category, r.payee, -Math.abs(r.amount), r.paid_from, r.ref, r.approved_by, r.receipt, r.vat_amount, r.supplier_pin, r.note, r.recorded_by]));
    cin.forEach((r) => rows.push(['Other income', Z.areaName(r.area), r.date, r.category, r.from_name, r.amount, r.received_to, r.ref, '', '', '', '', r.note, r.recorded_by]));
    pays.forEach((r) => rows.push(['Customer payment', Z.areaName(r.area), r.date, r.source, r.payer_name, r.amount, r.method, r.mpesa_ref, '', '', '', '', '', '']));
    cc.forEach((r) => rows.push(['Cash count', Z.areaName(r.area), r.date, `Bank=${r.bank}; MPesa=${r.mpesa}`, '', '', '', '', '', '', '', '', r.note, r.counted_by]));
    // A cell starting with = + - @ would run as a formula in Excel — unless it's just a number.
    const cellText = (v) => { const t = String(v ?? ''); return /^[=+\-@\t\r]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t) ? "'" + t : t; };
    const csv = rows.map((r) => r.map((v) => '"' + cellText(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `zuri-${ym}-transactions.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    Z.toast('CSV downloaded.');
  }
})();
