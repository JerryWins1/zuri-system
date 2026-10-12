// Zuri System · Money → Statements (import bank & M-Pesa), To sort, Books · v2 · 2026-09-30
(function () {
  const Z = window.Z;
  const must = (r) => { if (r.error) throw r.error; return r.data; };
  const KINDS = [['mpesa', 'M-Pesa'], ['bank', 'Bank'], ['cash', 'Cash box']];
  const FLOW_NAMES = { income: 'Money in (income)', expense: 'Money out (expenses)', transfer: 'Moving money between accounts', owner: 'Owner / partner money', ignore: 'Not Zuri money' };
  const monthName = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

  Z.moneySubs.push(['statements', 'Bank & M-Pesa'], ['sort', 'Sort them'], ['books', 'Profit by month']);

  async function categories() {
    const rows = must(await Z.sb.from('categories').select('*').order('sort'));
    return rows;
  }
  const catSelect = (cats, sel, attrs = '') => {
    const groups = ['income', 'expense', 'transfer', 'owner', 'ignore'];
    return `<select ${attrs}><option value="">— choose —</option>${groups.map((g) => `<optgroup label="${FLOW_NAMES[g]}">${Z.opts(cats.filter((c) => c.flow === g).map((c) => c.name), sel)}</optgroup>`).join('')}</select>`;
  };

  // ---------- reading statement files ----------
  const money = (s) => { const n = Z.num(s); return n == null ? 0 : n; };

  // Safaricom M-Pesa statement PDF: "RECEIPT 2026-06-12 14:02:11 Details… Completed -1,500.00 3,250.00"
  async function readMpesaPdf(file) {
    await Z.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    let pdf;
    try { pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise; }
    catch (e) { throw new Error(/password/i.test(e.message || e.name) ? 'This PDF is locked with a password. Open it once, "Print → Save as PDF" to unlock it, then try again.' : 'Could not read this PDF.'); }
    let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const tc = await (await pdf.getPage(p)).getTextContent();
      text += tc.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n';
    }
    text = text.replace(/Receipt No\.?\s*Completion Time\s*Details\s*Transaction Status\s*Paid In\s*Withdrawn\s*Balance/gi, ' ');
    const re = /\b([A-Z0-9]{10})\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s*([\s\S]*?)\s*\b(Completed|Failed|Cancelled|Pending|Declined|Reversed)\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})(?:\s+(-?[\d,]+\.\d{2}))?/g;
    const rows = [];
    let m;
    while ((m = re.exec(text))) {
      if (m[5] !== 'Completed') continue;
      let inAmt = 0, outAmt = 0, bal;
      if (m[8] !== undefined) { inAmt = Math.abs(money(m[6])); outAmt = Math.abs(money(m[7])); bal = money(m[8]); }
      else { const a = money(m[6]); if (a >= 0) inAmt = a; else outAmt = -a; bal = money(m[7]); }
      rows.push({ date: m[2], time: m[3], ref: m[1], details: m[4].replace(/\s+/g, ' ').trim(), money_in: inAmt, money_out: outAmt, balance: bal });
    }
    if (!rows.length) throw new Error('No M-Pesa transactions found in this PDF. Is it a Safaricom M-Pesa statement?');
    return { rows, how: 'M-Pesa statement PDF' };
  }

  const SYN = {
    date: ['transaction date', 'completion time', 'date', 'posting date', 'value date', 'trans date'],
    details: ['transaction details', 'description', 'details', 'narration', 'particulars', 'narrative'],
    ref: ['receipt no', 'receipt', 'bank reference number', 'reference', 'ref no', 'ref', 'cheque no', 'transaction id'],
    money_in: ['money in', 'paid in', 'credit', 'credits', 'deposits', 'deposit', 'cr'],
    money_out: ['money out', 'withdrawn', 'debit', 'debits', 'withdrawals', 'withdrawal', 'dr'],
    balance: ['ledger balance', 'running balance', 'balance', 'book balance'],
    amount: ['amount', 'transaction amount'],
    status: ['transaction status', 'status'],
  };
  const LABELS = { date: 'Date *', details: 'Description *', ref: 'Reference / receipt', money_in: 'Money in', money_out: 'Money out', balance: 'Balance', amount: 'Amount (one column, minus = out)', status: 'Status (only "Completed" kept)' };
  const norm = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  function guessCols(headers) {
    const used = new Set(), map = {};
    for (const key of Object.keys(SYN)) {
      let idx = -1;
      for (const s of SYN[key]) { idx = headers.findIndex((h, i) => !used.has(i) && norm(h) === s); if (idx >= 0) break; }
      if (idx < 0) for (const s of SYN[key]) { if (s.length < 4) continue; idx = headers.findIndex((h, i) => !used.has(i) && norm(h).includes(s)); if (idx >= 0) break; }
      if (idx >= 0) { map[key] = idx; used.add(idx); }
    }
    if (map.money_in != null || map.money_out != null) delete map.amount;
    return map;
  }
  function tableRows(all, hr, map) {
    const out = [], bad = [];
    for (const r of all.slice(hr + 1)) {
      if (!r.some((v) => String(v).trim() !== '')) continue;
      const g = (k) => (map[k] == null ? '' : r[map[k]] ?? '');
      if (map.status != null && g('status') && !/complete|success|posted/i.test(String(g('status')))) continue;
      const date = Z.toDate(g('date'));
      let inAmt = Math.abs(money(g('money_in'))), outAmt = Math.abs(money(g('money_out')));
      if (map.amount != null) { const a = money(g('amount')); if (a >= 0) inAmt = a; else outAmt = -a; }
      if (!inAmt && !outAmt) continue;
      if (!date) { bad.push(r); continue; }
      const t = g('date');
      const time = typeof t === 'string' && /\d{1,2}:\d{2}/.test(t) ? (t.match(/\d{1,2}:\d{2}(:\d{2})?/) || [''])[0] : '';
      out.push({ date, time, ref: String(g('ref')).trim(), details: String(g('details')).replace(/\s+/g, ' ').trim(), money_in: inAmt, money_out: outAmt, balance: g('balance') === '' ? null : money(g('balance')) });
    }
    return { rows: out, bad };
  }
  // Same statement brought in twice → same fingerprints → skipped by the database.
  // With a receipt code the key is date|code|in|out|balance — the same whether it came from the PDF or the Excel copy
  // (their times and descriptions differ). Matches the database's 14_review_fixes migration exactly.
  const fingerprint = (r) => (r.ref
    ? [r.date, r.ref, r.money_in, r.money_out, r.balance ?? ''].join('|')
    : [r.date, r.time || '', '', r.money_in, r.money_out, r.balance ?? '', r.details.slice(0, 60)].join('|'));

  // ---------- Statements ----------
  Z.moneyViews.statements = async (el) => {
    const accts = must(await Z.sb.from('money_accounts').select('*').order('name'));
    const stats = await Promise.all(accts.map(async (a) => {
      const [last, unsorted] = await Promise.all([
        Z.sb.from('statement_lines').select('date,balance').eq('account_id', a.id).order('date', { ascending: false }).order('imported_at', { ascending: false }).limit(1),
        Z.sb.from('statement_lines').select('id', { count: 'exact', head: true }).eq('account_id', a.id).is('category', null),
      ]);
      return { last: (last.data || [])[0], unsorted: unsorted.count || 0 };
    }));
    const st = Z.get('stmt_last', {});
    el.innerHTML = `
      <p class="hint" style="margin-top:0">Every account Zuri money passes through — bank accounts, the business M-Pesa, and any personal M-Pesa line customers pay into. Import each one's statement; repeats are skipped.</p>
      <div class="card list">${accts.length ? accts.map((a, i) => `<div class="item"><div class="grow"><div class="t">${Z.esc(a.name)} ${a.active ? '' : '<span class="pill">not in use</span>'}</div>
          <div class="m">${Z.esc((KINDS.find((k) => k[0] === a.kind) || [])[1])}${a.area ? ' · ' + Z.esc(Z.areaName(a.area)) : ''}${a.owner ? ' · ' + Z.esc(a.owner) : ''}${stats[i].last ? ' · statement up to ' + Z.day(stats[i].last.date) : ' · nothing imported yet'}</div></div>
          ${stats[i].last && stats[i].last.balance != null ? `<b class="num">${Z.fmt(stats[i].last.balance)}</b>` : ''}
          ${stats[i].unsorted ? `<a class="pill warn" href="#money/sort/${a.id}">${stats[i].unsorted} to sort</a>` : ''}</div>`).join('') : '<div class="muted">No accounts yet — add the first one below.</div>'}</div>

      ${accts.length ? `<h3>Import a statement</h3>
      <div class="card">
        <div class="grid2">
          <div><label>Which account is this statement for?</label><select id="st-acct">${Z.opts(accts.filter((a) => a.active).map((a) => [a.id, a.name]), st.acct)}</select></div>
          <div><label>Statement file (Excel, CSV, or M-Pesa PDF)</label><input type="file" id="st-file" accept=".xlsx,.xls,.csv,.pdf"></div>
        </div>
        <div id="st-work"></div>
      </div>` : ''}

      <h3>Add an account</h3>
      <form class="card" id="st-add"><div class="grid2">
        <div><label>Name</label><input name="name" required placeholder="e.g. Zuri A — Equity bank, or Dickson M-Pesa"></div>
        <div><label>Kind</label><select name="kind">${Z.opts(KINDS)}</select></div>
        <div><label>Area (if it belongs to one)</label><select name="area"><option value="">Whole company</option>${Z.opts(Z.ref.areas.map((a) => [a.code, a.name]))}</select></div>
        <div><label>Whose is it?</label><input name="owner" placeholder="e.g. Business account, or Dickson (personal line)"></div>
      </div><div style="height:12px"></div><button class="btn" type="submit">Add account</button></form>`;

    Z.$('#st-add', el).onsubmit = async (e) => {
      e.preventDefault();
      const d = Z.formData(e.target);
      const { error } = await Z.sb.from('money_accounts').insert({ name: d.name.trim(), kind: d.kind, area: d.area || null, owner: d.owner.trim() || null });
      if (error) return Z.toast(/unique|duplicate/i.test(error.message) ? 'An account with that name already exists.' : Z.errText(error));
      Z.toast('Account added.'); Z.route();
    };
    const acctSel = Z.$('#st-acct', el);
    if (acctSel) {
      acctSel.onchange = () => { st.acct = acctSel.value; Z.set('stmt_last', st); };
      Z.$('#st-file', el).onchange = (e) => {
        const f = e.target.files[0]; if (!f) return;
        st.acct = acctSel.value; Z.set('stmt_last', st);
        readStatement(f, accts.find((a) => a.id === acctSel.value), Z.$('#st-work', el)).catch((err) => { Z.$('#st-work', el).innerHTML = `<div class="alert bad" style="margin-top:10px">${Z.esc(err.message || Z.errText(err))}</div>`; });
      };
    }
  };

  async function readStatement(file, acct, box) {
    box.innerHTML = '<div class="loading">Reading the statement…</div>';
    if (/\.pdf$/i.test(file.name)) return preview((await readMpesaPdf(file)).rows, acct, box, 'M-Pesa statement PDF');
    await Z.xlsxLib();
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, raw: true });
    const sheetName = wb.SheetNames.find((n) => /transaction|statement/i.test(n)) || wb.SheetNames[0];
    const all = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' });
    let hr = all.findIndex((r, i) => i < 40 && Object.keys(guessCols(r.map(String))).length >= 3);
    if (hr < 0) hr = 0;
    const draw = () => {
      const headers = (all[hr] || []).map((h, i) => String(h).trim() || `Column ${i + 1}`);
      const memKey = 'stmap_' + acct.id;
      const mem = Z.get(memKey, null);
      const map = mem && mem.sig === headers.join('|') ? mem.map : guessCols(headers);
      const { rows, bad } = tableRows(all, hr, map);
      box.innerHTML = `
        <details style="margin-top:10px" ${map.date == null || map.details == null || (map.money_in == null && map.money_out == null && map.amount == null) ? 'open' : ''}>
          <summary class="hint">Columns (sheet "${Z.esc(sheetName)}", headings on row ${hr + 1}) — check if the preview looks wrong</summary>
          <div class="grid2">${Object.keys(LABELS).map((k) => `<div><label>${LABELS[k]}</label><select data-col="${k}"><option value="">— not in this file —</option>${headers.map((h, i) => `<option value="${i}"${map[k] === i ? ' selected' : ''}>${Z.esc(h)}</option>`).join('')}</select></div>`).join('')}</div>
        </details>
        <div id="st-prev"></div>`;
      Z.$$('[data-col]', box).forEach((s) => (s.onchange = () => {
        if (s.value === '') delete map[s.dataset.col]; else map[s.dataset.col] = +s.value;
        Z.set(memKey, { sig: headers.join('|'), map });
        const r2 = tableRows(all, hr, map);
        preview(r2.rows, acct, Z.$('#st-prev', box), 'Excel statement', r2.bad.length);
      }));
      preview(rows, acct, Z.$('#st-prev', box), 'Excel statement', bad.length);
    };
    draw();
  }

  function preview(rows, acct, box, how, badCount = 0) {
    if (!rows.length) { box.innerHTML = '<div class="alert warn" style="margin-top:10px">No transactions found. Check the columns above.</div>'; return; }
    const dates = rows.map((r) => r.date).sort();
    const tin = rows.reduce((t, r) => t + r.money_in, 0), tout = rows.reduce((t, r) => t + r.money_out, 0);
    box.innerHTML = `
      <div style="margin-top:12px"><b>${Z.fmt(rows.length)} transactions</b> · ${Z.day(dates[0])} → ${Z.day(dates[dates.length - 1])} · <span style="color:var(--ok)">in ${Z.fmt(tin)}</span> · <span style="color:var(--bad)">out ${Z.fmt(tout)}</span>${badCount ? ` · <span style="color:var(--warn-ink)">${badCount} rows with unreadable dates skipped</span>` : ''}
        <div class="hint">${Z.esc(how)} → ${Z.esc(acct.name)}</div></div>
      <div class="scroll-x"><table class="t"><tr><th>Date</th><th>Details</th><th>Ref</th><th class="r">In</th><th class="r">Out</th><th class="r">Balance</th></tr>
        ${rows.slice(0, 6).map((r) => `<tr><td>${Z.esc(r.date)}</td><td>${Z.esc(r.details.slice(0, 60))}</td><td>${Z.esc(r.ref)}</td><td class="r num">${r.money_in ? Z.fmt(r.money_in) : ''}</td><td class="r num">${r.money_out ? Z.fmt(r.money_out) : ''}</td><td class="r num">${Z.fmt(r.balance)}</td></tr>`).join('')}</table></div>
      <div style="height:10px"></div>
      <button class="btn block" id="st-go">Import ${Z.fmt(rows.length)} transactions into ${Z.esc(acct.name)}</button>`;
    Z.$('#st-go', box).onclick = async (e) => {
      const btn = e.currentTarget; btn.disabled = true;
      const tot = { rows: 0, added: 0, skipped: 0, linked: 0, auto_sorted: 0, matched: 0 };
      try {
        const payload = rows.map((r) => ({ ...r, fingerprint: fingerprint(r) }));
        for (let i = 0; i < payload.length; i += 500) {
          btn.textContent = `Importing… ${Math.min(i + 500, payload.length)} of ${payload.length}`;
          const d = must(await Z.sb.rpc('import_statement', { p_account: acct.id, rows: payload.slice(i, i + 500) }));
          for (const k of Object.keys(tot)) tot[k] += d[k] || 0;
        }
        box.innerHTML = `<div class="alert ok" style="margin-top:10px">✅ ${Z.fmt(tot.added)} new transactions${tot.skipped ? ` (${Z.fmt(tot.skipped)} were already in)` : ''} · ${Z.fmt(tot.auto_sorted)} sorted automatically · ${Z.fmt(tot.linked)} matched to expenses already logged${tot.matched ? ` · ${Z.fmt(tot.matched)} customer payments matched` : ''}.</div>
          <a class="btn" href="#money/sort/${acct.id}">Sort the rest →</a>`;
      } catch (err) { btn.disabled = false; btn.textContent = 'Try again'; Z.fail(err); }
    };
  }

  // ---------- To sort ----------
  // A good "always" keyword: the payee part after " - ", without phone numbers or account numbers.
  const keywordFor = (details) => {
    let s = details.replace(/^.*\s-\s/, '').replace(/^[0-9*]+\s*/, '').replace(/\s*Acc\..*$/i, '').trim();
    if (s.length < 3) s = details;
    return s.split(/\s+/).slice(0, 3).join(' ');
  };

  Z.moneyViews.sort = async (el, args) => {
    const accts = must(await Z.sb.from('money_accounts').select('id,name').order('name'));
    const f = Z.get('sort_filter', { acct: '', show: 'todo' });
    if (args[0]) f.acct = args[0];
    const cats = await categories();
    let q = Z.sb.from('statement_lines').select('*', { count: 'exact' });
    q = f.show === 'todo' ? q.is('category', null) : q.not('category', 'is', null);
    if (f.acct) q = q.eq('account_id', f.acct);
    const { data: lines, count, error } = await q.order('date', { ascending: false }).order('time', { ascending: false }).limit(150);
    if (error) throw error;
    const acctName = (id) => (accts.find((a) => a.id === id) || {}).name || '';

    el.innerHTML = `
      <div class="row" style="margin-bottom:10px">
        <select id="so-acct" style="flex:1"><option value="">All accounts</option>${Z.opts(accts.map((a) => [a.id, a.name]), f.acct)}</select>
        <select id="so-show" style="width:auto">${Z.opts([['todo', 'To sort'], ['done', 'Already sorted']], f.show)}</select>
      </div>
      <p class="hint">${f.show === 'todo' ? `${Z.fmt(count)} transaction${count === 1 ? '' : 's'} still to sort.` : 'Fix anything sorted wrongly.'} Pick a category; tick <b>always</b> to teach the app for next time. Personal transactions on a partner's line → "Ignore (personal / not Zuri)".</p>
      ${lines.length ? `
      <div class="card row" style="position:sticky;top:60px;z-index:5">
        <label class="row" style="margin:0;gap:6px"><input type="checkbox" id="so-all"> All</label>
        ${catSelect(cats, '', 'id="so-bulk" style="flex:1"')}
        <button class="btn small" id="so-apply">Sort ticked</button>
      </div>` : ''}
      <div class="card list">${lines.length ? lines.map((l) => `
        <div class="item" data-id="${l.id}" style="flex-wrap:wrap">
          <label class="tap44" aria-label="Select this line"><input type="checkbox" class="so-tick"></label>
          <div class="grow" style="min-width:200px"><div class="t">${Z.esc(l.details)}</div>
            <div class="m">${Z.day(l.date)}${l.time ? ' ' + Z.esc(l.time.slice(0, 5)) : ''} · ${Z.esc(acctName(l.account_id))}${l.ref ? ' · ' + Z.esc(l.ref) : ''}${l.expense_id ? ' · <span style="color:var(--ok)">matches a logged expense</span>' : ''}${l.payment_id ? ' · <span style="color:var(--ok)">customer payment' + (l.customer_id ? ' (matched)' : ' (not matched — link it under Import)') + '</span>' : ''}</div></div>
          <b class="num" style="color:var(--${l.money_in ? 'ok' : 'bad'});min-width:80px;text-align:right">${l.money_in ? '+' + Z.fmt(l.money_in) : '−' + Z.fmt(l.money_out)}</b>
          <div class="row" style="width:100%;justify-content:flex-end">
            <label class="row tap44" style="gap:4px;font-size:13px;padding-right:6px"><input type="checkbox" class="so-always"> always</label>
            ${catSelect(cats, l.category, 'class="so-cat" style="flex:1;max-width:320px"')}
          </div>
        </div>`).join('') : `<div class="empty">${f.show === 'todo' ? 'Nothing to sort. 🎉' : 'Nothing sorted yet.'}</div>`}</div>
      ${count > lines.length ? `<p class="hint">Showing the newest ${lines.length}. Sort these and the next batch appears.</p>` : ''}`;

    Z.$('#so-acct', el).onchange = (e) => { f.acct = e.target.value; Z.set('sort_filter', f); Z.go('money/sort'); };
    Z.$('#so-show', el).onchange = (e) => { f.show = e.target.value; Z.set('sort_filter', f); Z.route(); };

    // 7 Oct deep check #9: the "always" rule is its own step, so it also works AFTER the category is picked.
    const makeRule = async (l, cat) => {
        const kw = prompt('Always sort transactions containing this text the same way. Shorten it to the part that stays the same:', keywordFor(l.details));
        if (kw && kw.trim().length >= 3) {
          const { error: e2 } = await Z.sb.from('sort_rules').upsert({ match: kw.trim(), direction: l.money_in ? 'in' : 'out', category: cat }, { onConflict: 'match,direction' });
          if (e2) throw e2;
          const n = must(await Z.sb.rpc('apply_sort_rules', { p_account: null }));
          Z.toast(n ? `Rule saved — ${n} more transaction${n === 1 ? '' : 's'} sorted the same way.` : 'Rule saved — next time it sorts itself.');
          return true;
        }
        return false;
    };
    const sortLine = async (id, cat, always) => {
      const l = lines.find((x) => x.id === id);
      const { error: e1 } = await Z.sb.from('statement_lines').update({ category: cat || null, sorted_by: Z.me.id, sorted_at: new Date().toISOString() }).eq('id', id);
      if (e1) throw e1;
      if (cat === 'Customer payment') await Z.sb.rpc('match_payments');
      return always && cat ? makeRule(l, cat) : false;
    };

    Z.$$('.so-cat', el).forEach((s) => (s.onchange = async () => {
      const item = s.closest('[data-id]');
      try {
        const reloaded = await sortLine(item.dataset.id, s.value, Z.$('.so-always', item).checked);
        if (reloaded) return Z.route();
        if (f.show === 'todo' && s.value) {
          // Keep the line for a moment with an "always" offer, instead of it vanishing (#9).
          const l = lines.find((x) => x.id === item.dataset.id), cat = s.value;
          item.innerHTML = `<div class="grow"><div class="t">✓ ${Z.esc(cat)}</div><div class="m">${Z.esc(l.details)}</div></div><button class="btn sec small so-rule">Always sort like this?</button>`;
          item.style.opacity = '.75';
          Z.$('.so-rule', item).onclick = async () => { try { if (await makeRule(l, cat)) Z.route(); } catch (err) { Z.fail(err); } };
        }
        Z.toast('Sorted.');
      } catch (err) { Z.fail(err); }
    }));
    const all = Z.$('#so-all', el);
    if (all) {
      all.onchange = () => Z.$$('.so-tick', el).forEach((c) => (c.checked = all.checked));
      Z.$('#so-apply', el).onclick = async () => {
        const cat = Z.$('#so-bulk', el).value;
        const ids = Z.$$('.so-tick', el).filter((c) => c.checked).map((c) => c.closest('[data-id]').dataset.id);
        if (!cat || !ids.length) return Z.toast('Tick some transactions and pick a category.');
        const { error: e } = await Z.sb.from('statement_lines').update({ category: cat, sorted_by: Z.me.id, sorted_at: new Date().toISOString() }).in('id', ids);
        if (e) return Z.fail(e);
        if (cat === 'Customer payment') await Z.sb.rpc('match_payments');
        Z.toast(`${ids.length} sorted.`); Z.route();
      };
    }
  };

  // ---------- Books (from sorted statements) ----------
  Z.moneyViews.books = async (el) => {
    const since = new Date(); since.setMonth(since.getMonth() - 11, 1);
    let q = Z.sb.from('v_books').select('*').gte('month', Z.ymd(since));
    if (Z.area) q = q.eq('area', Z.area);
    const [rows, lastLine] = await Promise.all([q.then(must), Z.sb.from('statement_lines').select('date').order('date', { ascending: false }).limit(1).then(must)]);
    if (!rows.length) { el.innerHTML = '<div class="empty">No statements imported yet. Start under <a href="#money/statements">Statements</a>.</div>'; return; }
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const cell = (flow, cat, m) => rows.filter((r) => r.flow === flow && r.category === cat && r.month === m)
      .reduce((t, r) => t + (flow === 'income' ? Number(r.money_in) - Number(r.money_out) : Number(r.money_out) - Number(r.money_in)), 0);
    const catsOf = (flow) => [...new Set(rows.filter((r) => r.flow === flow).map((r) => r.category))].sort();
    const total = (flow, m) => catsOf(flow).reduce((t, c) => t + cell(flow, c, m), 0);
    const unsorted = rows.filter((r) => r.flow === 'unsorted').reduce((t, r) => t + Number(r.lines), 0);
    const block = (flow) => catsOf(flow).map((c) => `<tr><td>${Z.esc(c)}</td>${months.map((m) => `<td class="r num">${Z.fmt(cell(flow, c, m)) === '0' ? '' : Z.fmt(cell(flow, c, m))}</td>`).join('')}</tr>`).join('');
    // 7 Oct deep check #21: the top numbers use the latest month the statements fully cover (same rule as Home);
    // a month the statements only partly cover is marked "(so far)" instead of looking like a slump.
    const lastStmt = (lastLine[0] || {}).date || '';
    const monthEnd = (mo) => { const d = new Date(mo.slice(0, 7) + '-01T12:00:00'); d.setMonth(d.getMonth() + 1, 0); return Z.ymd(d); };
    const partial = (m) => !lastStmt || lastStmt < monthEnd(m);
    const last = [...months].reverse().find((m) => !partial(m)) || months[months.length - 1];
    const mLabel = (m) => monthName(m) + (partial(m) ? ' (so far)' : '');
    const pie = catsOf('expense').map((c) => [c, cell('expense', c, last)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

    el.innerHTML = `
      ${unsorted ? `<div class="alert warn">${Z.fmt(unsorted)} transactions aren't sorted yet, so these numbers are incomplete. <a href="#money/sort">Sort them →</a></div>` : ''}
      <div class="kpis">
        <div class="kpi"><div class="k">Income · ${mLabel(last)}</div><div class="v num ok">${Z.fmt(total('income', last))}</div></div>
        <div class="kpi"><div class="k">Expenses · ${mLabel(last)}</div><div class="v num">${Z.fmt(total('expense', last))}</div></div>
        <div class="kpi"><div class="k">Profit · ${mLabel(last)}</div><div class="v num ${total('income', last) - total('expense', last) < 0 ? 'bad' : 'ok'}">${Z.fmt(total('income', last) - total('expense', last))}</div></div>
      </div>
      <div class="card"><b>Where the money went · ${mLabel(last)}</b><div class="chart-box"><canvas id="bk-pie" aria-label="Expenses by category"></canvas></div></div>
      <div class="card scroll-x"><table class="t">
        <tr><th>KES</th>${months.map((m) => `<th class="r">${mLabel(m)}</th>`).join('')}</tr>
        <tr><th colspan="${months.length + 1}" style="color:var(--ok)">Income</th></tr>${block('income')}
        <tr style="font-weight:700"><td>Total income</td>${months.map((m) => `<td class="r num">${Z.fmt(total('income', m))}</td>`).join('')}</tr>
        <tr><th colspan="${months.length + 1}" style="color:var(--bad)">Expenses</th></tr>${block('expense')}
        <tr style="font-weight:700"><td>Total expenses</td>${months.map((m) => `<td class="r num">${Z.fmt(total('expense', m))}</td>`).join('')}</tr>
        <tr style="font-weight:800;font-size:15px"><td>Profit</td>${months.map((m) => { const p = total('income', m) - total('expense', m); return `<td class="r num" style="color:var(--${p < 0 ? 'bad' : 'ok'})">${Z.fmt(p)}</td>`; }).join('')}</tr>
      </table>
      <p class="hint">Not counted as income or expense: money moved between Zuri's own accounts, cash withdrawals/deposits, owner & partner money, and anything marked "not Zuri". Customer payments counted once even if they also came in from the billing website.</p></div>`;

    if (pie.length) {
      try {
        await Z.chartLib();
        const css = getComputedStyle(document.documentElement);
        const base = ['--brand', '--accent', '--ok', '--warn', '--bad', '--ink-soft', '--ink-faint'].map((v) => css.getPropertyValue(v).trim());
        new Chart(Z.$('#bk-pie', el), {
          type: 'doughnut',
          data: { labels: pie.map((p) => p[0]), datasets: [{ data: pie.map((p) => p[1]), backgroundColor: pie.map((_, i) => base[i % base.length] + (i >= base.length ? '99' : '')), borderColor: css.getPropertyValue('--surface').trim(), borderWidth: 2 }] },
          options: { maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: css.getPropertyValue('--ink-soft').trim(), boxWidth: 12 } },
            tooltip: { callbacks: { label: (c) => `${c.label}: KES ${Z.fmt(c.raw)} (${Math.round((c.raw / pie.reduce((t, p) => t + p[1], 0)) * 100)}%)` } } } },
        });
      } catch (e) { /* chart is a bonus; the table has the numbers */ }
    } else Z.$('#bk-pie', el).replaceWith(Object.assign(document.createElement('p'), { className: 'hint', textContent: 'No sorted expenses this month yet.' }));
  };

  Z.readMpesaPdf = readMpesaPdf;
})();
