// Zuri System · Receipts: snap a receipt, paste an M-Pesa message, check, save · v1 · 2026-10-10
// One screen: 📸 photo (or 📩 message, or ✍️ type) → the boxes fill → check → Save. Works with no signal:
// the expense and its photo wait on the phone (offline queue + IndexedDB) and send later.
// Reading the photo with AI is a SETTING (Admin → Settings, off by default). Off, offline or failed = the person types it.
(function () {
  const Z = window.Z;
  const must = (r) => { if (r.error) throw r.error; return r.data; };
  const PHOTO = 'Photo saved', DIGITAL = 'Digital / M-Pesa msg', PAPER = 'Paper receipt — filed', CHASE = 'No — chase it';
  Z.RECEIPT_PHOTO = PHOTO;
  const NO_FN = /could not find the function|function .*does not exist|PGRST202|schema cache/i;
  // Pretend "no signal" switch, so the training video can show what happens with no signal (practice only).
  if (!Z.online) Z.online = () => navigator.onLine && !Z.pretendOffline;

  // How each receipt state shows on screen.
  Z.receiptPill = (r) => {
    const s = r && r.receipt;
    const [t, c] = s === PHOTO ? ['📷 photo', 'ok'] : s === DIGITAL ? ['📱 M-Pesa msg', 'ok'] : s === PAPER ? ['🧾 paper filed', 'ok'] : s === CHASE ? ['❌ no receipt', 'bad'] : ['receipt?', 'warn'];
    return `<span class="pill ${c}">${t}</span>`;
  };

  // ======================================================================================
  // M-Pesa confirmation messages → fields. Free, on the phone, no signal needed.
  // Safaricom wording seen in real messages (2023–2026), all handled below:
  //   sent    "UJ41AB2CDE Confirmed. Ksh1,500.00 sent to JOHN KAMAU 0712345678 on 5/10/26 at 3:45 PM. New M-PESA balance is Ksh2,345.67. Transaction cost, Ksh23.00. …"
  //   pochi   "… Ksh200.00 sent to MAMA WANJIKU on 5/10/26 at 9:02 AM. …"          (Pochi la Biashara: a name, no number)
  //   paybill "… Ksh2,500.00 sent to KPLC PREPAID for account 54123456789 on 5/10/26 at 10:12 AM New M-PESA balance is …"
  //   till    "… Ksh350.00 paid to NAIVAS MAAI MAHIU. on 5/10/26 at 1:15 PM.New M-PESA balance is Ksh884.00. Transaction cost, Ksh0.00. …"
  //   withdraw"UJ… Confirmed.on 5/10/26 at 4:20 PMWithdraw Ksh3,000.00 from 123456 - KAMUYU AGENTS Maai Mahiu New M-PESA balance is …"
  //   airtime "UJ… confirmed.You bought Ksh100.00 of airtime on 5/10/26 at 9:00 AM.New M-PESA balance is …"
  //   fuliza  "UJ… Confirmed. Fuliza M-PESA amount is Ksh 500.00. Access Fee charged Ksh 5.00. Total Fuliza M-PESA outstanding amount is Ksh505.00 due on 04/11/26. …"
  //   received"UJ… Confirmed.You have received Ksh1,000.00 from JANE DOE 0712345678 on 5/10/26 at 2:00 PM New M-PESA balance is …"  (money IN — not an expense)
  // Several messages pasted together (e.g. the payment + its Fuliza message) are split by their codes.
  // ======================================================================================
  const AMT = 'K(?:sh|ES)\\.?\\s?([\\d,]+(?:\\.\\d{1,2})?)';
  const money = (s) => (s == null ? null : Math.round(parseFloat(String(s).replace(/,/g, '')) * 100) / 100);
  const title = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/[.\s]+$/, '').toLowerCase().replace(/(^|[\s\-/&(])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const CODE_RE = /\b(?=[A-Z0-9]{10}\b)(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])([A-Z0-9]{10})\b/;
  function splitMessages(text) {
    const t = String(text || '').replace(/\u00a0/g, ' ');
    const re = /\b(?=[A-Z0-9]{10}\s+[Cc]onfirmed)(?=[A-Z0-9]*\d)[A-Z0-9]{10}\b/g;
    const idx = []; let m;
    while ((m = re.exec(t))) idx.push(m.index);
    if (idx.length < 2) return [t];
    return idx.map((s, i) => t.slice(s, idx[i + 1] ?? t.length));
  }
  function parseOne(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    const g = (re) => { const m = t.match(re); return m ? m : null; };
    const out = { kind: 'unknown' };
    const lead = g(/^\W*([A-Z0-9]{10})\s+[Cc]onfirmed/) || g(CODE_RE);
    if (lead && /\d/.test(lead[1]) && /[A-Z]/.test(lead[1])) out.ref = lead[1];
    const bal = g(new RegExp('balance is ' + AMT, 'i')); if (bal) out.balance = money(bal[1]);
    const cost = g(new RegExp('Transaction cost,?\\s*' + AMT, 'i')); if (cost) out.fee = money(cost[1]);
    const dm = g(/\bon (\d{1,2})\/(\d{1,2})\/(\d{2,4})(?: at (\d{1,2}):(\d{2}) ?([AP]M))?/i);
    if (dm) {
      out.date = (dm[3].length === 2 ? '20' + dm[3] : dm[3]) + '-' + dm[2].padStart(2, '0') + '-' + dm[1].padStart(2, '0');
      if (dm[4]) out.time = dm[4] + ':' + dm[5] + ' ' + dm[6].toUpperCase();
    }
    let m;
    if ((m = g(new RegExp('Fuliza M-?PESA amount is ' + AMT, 'i')))) {
      out.kind = 'fuliza'; out.amount = money(m[1]);
      const fee = g(new RegExp('Access Fee charged ' + AMT, 'i')); if (fee) out.fee = money(fee[1]);
      const owe = g(new RegExp('outstanding amount is ' + AMT, 'i')); if (owe) out.fuliza_owed = money(owe[1]);
      delete out.date; // the "due on" date is not the payment date
      return out;
    }
    if ((m = g(new RegExp('(?:you have )?received ' + AMT + ' from (.+?)(?: (\\+?\\d[\\d*]{8,12}))? on \\d', 'i')))) {
      out.kind = 'received'; out.amount = money(m[1]); out.payee = title(m[2]); if (m[3]) out.payee_no = m[3];
      return out;
    }
    if ((m = g(new RegExp('Withdraw ' + AMT + ' from (\\d+) ?- ?(.+?)(?: New M-?PESA| *$)', 'i')))) {
      out.kind = 'withdraw'; out.amount = money(m[1]); out.payee_no = m[2]; out.payee = 'Cash withdrawal · ' + title(m[3]);
      return out;
    }
    if ((m = g(new RegExp('bought ' + AMT + ' of airtime(?: for (\\d{9,12}))?', 'i')))) {
      out.kind = 'airtime'; out.amount = money(m[1]); out.payee = 'Safaricom airtime'; if (m[2]) out.payee_no = m[2];
      return out;
    }
    if ((m = g(new RegExp(AMT + ' sent to (.+?) for account (.+?) on \\d{1,2}/', 'i')))) {
      out.kind = 'paybill'; out.amount = money(m[1]); out.payee = title(m[2]); out.account = m[3].trim();
      return out;
    }
    if ((m = g(new RegExp(AMT + ' paid to (.+?)\\.? on \\d{1,2}/', 'i')))) {
      out.kind = 'till'; out.amount = money(m[1]); out.payee = title(m[2]);
      return out;
    }
    if ((m = g(new RegExp(AMT + ' sent to (.+?) on \\d{1,2}/', 'i')))) {
      out.kind = 'sent'; out.amount = money(m[1]);
      const who = m[2].trim();
      const ph = who.match(/^(.*?)\s+(\+?\d[\d* ]{7,13}\d)$/);
      if (ph) { out.payee = title(ph[1]); out.payee_no = ph[2].replace(/\s/g, ''); } else { out.payee = title(who); out.pochi = true; }
      return out;
    }
    // Something else (a reversal, a statement line): take what we can.
    const a = g(new RegExp(AMT, 'i')); if (a) out.amount = money(a[1]);
    return out;
  }
  // Main entry: returns the expense-like message, with a Fuliza message (if pasted too) folded in.
  function parse(text) {
    const parts = splitMessages(text).map(parseOne);
    const main = parts.find((p) => !['fuliza', 'unknown'].includes(p.kind)) || parts.find((p) => p.kind === 'fuliza') || parts[0] || { kind: 'unknown' };
    const fz = parts.find((p) => p.kind === 'fuliza' && p !== main);
    if (fz) { main.fuliza = fz.amount; main.fuliza_fee = fz.fee; main.fuliza_ref = fz.ref; }
    return main;
  }
  Z.mpesa = { parse, parseOne, split: splitMessages };
  // The old Money → Money out reader used these names; keep them working.
  Z.mpesaToForm = (p) => ({ ref: p.ref, amount: p.amount, payee: p.payee, date: p.date, balance: p.balance, fee: p.fee });

  // ======================================================================================
  // Small helpers shared by the screens
  // ======================================================================================
  // Phone photos are 3–8 MB. 1400 px, JPEG 0.7 ≈ 150–300 KB: readable, and uploads on weak signal.
  // Open the photo three ways, most direct first (some phones can't load a picture "address" with no signal).
  const loadImg = (src) => new Promise((ok, no) => { const img = new Image(); img.onload = () => ok(img); img.onerror = () => no(new Error('Could not read the photo')); img.src = src; });
  async function decode(file) {
    if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* try the next way */ } }
    const url = URL.createObjectURL(file);
    try { return await loadImg(url); } catch (e) { /* try the next way */ } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(r.error); r.readAsDataURL(file); });
    return loadImg(data);
  }
  async function shrink(file, max = 1400, q = 0.7) {
    const img = await decode(file);
    const w = img.width, h = img.height;
    if (!w || !h) throw new Error('Could not read the photo');
    const k = Math.min(1, max / Math.max(w, h));
    const cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
    if (img.close) img.close();
    return new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('Could not read the photo'))), 'image/jpeg', q));
  }
  Z.shrinkReceipt = shrink;
  const toB64 = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => no(r.error); r.readAsDataURL(blob); });
  Z.receiptPath = (area, date, id) => `${area}/${String(date || Z.ymd()).slice(0, 7)}/${id}.jpg`;

  // The AI setting lives in the database (settings key receipts_ai) and is remembered on the phone for no-signal days.
  Z.receiptAI = async () => {
    try {
      const { data, error } = await Z.sb.from('settings').select('value').eq('key', 'receipts_ai').maybeSingle();
      if (error) throw error;
      const on = !!(data && data.value && data.value.on);
      Z.set('rc_ai', on); return on;
    } catch (e) { return Z.get('rc_ai', false); }
  };

  // Categories: from the database, remembered for no-signal days.
  async function categories() {
    try {
      const rows = must(await Z.sb.from('expense_categories').select('name,sort').order('sort'));
      const names = rows.map((c) => c.name);
      if (names.length) Z.set('rc_cats', names);
      return names.length ? names : Z.get('rc_cats', []);
    } catch (e) { return Z.get('rc_cats', ['Transport / Fuel', 'Equipment / Inventory', 'Rent & Utilities', 'Telecom / Network', 'Other']); }
  }
  // Words on a receipt or in a payee's name that point to a category (works offline, no history needed).
  const HINTS = [
    [/total ?energies|\bshell\b|rubis|\bola\b|ola energy|petrol|diesel|fuel|\bgulf\b|hass petroleum|vivo energy|\bastrol\b|matatu|boda|fare|parking/i, /fuel|transport/i],
    [/hardware|cable|fibre|fiber|connector|splitter|router|onu|ont|clips|tools?\b|electrical|timber|cement|nails/i, /equipment|inventory/i],
    [/kplc|kenya power|token|prepaid|water|rent|landlord/i, /rent|utilit/i],
    [/safaricom|airtel|telkom|airtime|bundles?|backhaul|bayobab|liquid/i, /telecom|network/i],
    [/charge|fee\b|excise|ledger/i, /fee/i],
    [/printing|posters?|flyers?|banner|radio|advert/i, /marketing/i],
  ];
  const hintFor = (text, cats) => { for (const [re, cre] of HINTS) if (re.test(text || '')) { const c = cats.find((x) => cre.test(x)); if (c) return c; } return null; };
  Z.receiptHint = hintFor;

  // "What do we usually call payments to this payee?" — the database looks at past expenses and the
  // statements' always-rules (receipt_suggest, 22_receipts.sql). No signal: what this phone has seen before.
  async function suggest(payee) {
    const key = String(payee || '').trim().toLowerCase();
    if (key.length < 3) return null;
    const hist = Z.get('rc_hist', {});
    if (Z.online()) {
      try {
        const { data, error } = await Z.sb.rpc('receipt_suggest', { p_payee: payee });
        if (error) throw error;
        if (data && data.category) { hist[key] = data.category; Z.set('rc_hist', hist); return data; }
        return null;
      } catch (e) { if (!Z.isNet(e) && !NO_FN.test(String(e.message || e))) console.warn('receipt_suggest', e); }
    }
    return hist[key] ? { category: hist[key], source: 'phone', n: 1 } : null;
  }

  // Is this M-Pesa / bank code already in Zuri? Statement line → "matched"; expense → "duplicate".
  async function checkCode(code, exclude) {
    code = String(code || '').trim().toUpperCase();
    if (code.length < 6) return null;
    if (!Z.online()) return { offline: true };
    try {
      const { data, error } = await Z.sb.rpc('receipt_code_check', { p_code: code, p_exclude: exclude || null });
      if (error) throw error;
      return data || null;
    } catch (e) { if (!Z.isNet(e) && !NO_FN.test(String(e.message || e))) console.warn('receipt_code_check', e); return null; }
  }
  const matchHtml = (res) => {
    if (!res) return '';
    if (res.offline) return '<div class="alert warn">📴 No signal — Zuri checks this code for repeats when it sends.</div>';
    const ex = (res.expenses || [])[0], st = (res.statement || [])[0];
    let h = '';
    if (ex) h += `<div class="alert bad">⚠️ Already recorded: ${Z.esc(Z.kes(ex.amount))} to ${Z.esc(ex.payee)} on ${Z.esc(Z.day(ex.date))}${ex.recorded_by ? ' (by ' + Z.esc(ex.recorded_by) + ')' : ''}. Saving again would count it twice.</div>`;
    if (st) h += `<div class="alert ok">✅ Already in the ${Z.esc(st.kind === 'bank' ? 'bank' : 'M-Pesa')} statement — matched (${Z.esc(st.account || '')}, ${Z.esc(Z.day(st.date))}, ${Z.esc(Z.kes(st.amount))}). Saving links them, so the money is counted once.</div>`;
    return h;
  };
  Z.receiptCheckCode = checkCode; Z.receiptMatchHtml = matchHtml;

  // Open the photo of an expense (a short-lived private link). Anyone who can see the expense can open it.
  Z.receiptPhoto = async (path, label) => {
    if (!path) return;
    const sh = Z.sheet('🧾 ' + (label || 'Receipt'), '<div id="rp-box" class="loading">Opening the photo…</div>');
    const box = Z.$('#rp-box', sh.el);
    // Still on this phone, waiting to upload?
    const q = Z.queue.find((x) => (x.op === 'expense_insert' && x.data.row.receipt_path === path) || (x.op === 'receipt_attach' && x.data.path === path));
    let url = null;
    if (q && q.data.key) { const b = await Z.idb.getBlob(q.data.key).catch(() => null); if (b) url = URL.createObjectURL(b); }
    if (!url) {
      if (!Z.online()) { box.className = ''; box.innerHTML = '<p class="hint">📴 The photo opens when you have signal.</p>'; return; }
      const { data, error } = await Z.sb.storage.from('receipts').createSignedUrl(path, 3600);
      if (error || !data || !data.signedUrl) { box.className = ''; box.innerHTML = `<p class="hint">${Z.esc(error ? Z.errText(error) : 'The photo has not uploaded yet.')}</p>`; return; }
      url = data.signedUrl;
    }
    box.className = '';
    box.innerHTML = `<img src="${Z.esc(url)}" alt="Receipt photo" style="width:100%;border-radius:10px;border:1px solid var(--line)">
      <p class="hint">${q ? '⏳ Still on this phone — it uploads when there is signal.' : 'Pinch to zoom. The link works for one hour.'}</p>`;
  };

  // ======================================================================================
  // The Friday "Receipts this week" numbers (used by Money → Friday report; the database has the same
  // in receipts_week() for the Zuri manager's report).
  // ======================================================================================
  Z.receiptsWeek = (rows, end = Z.ymd()) => {
    const endD = new Date(end + 'T12:00:00');
    const from = Z.ymd(new Date(endD.getTime() - 6 * 864e5));
    const w = rows.filter((r) => r.date >= from && r.date <= end);
    const by = {};
    w.forEach((r) => { const k = r.category || '(no category)'; by[k] = (by[k] || 0) + Number(r.amount || 0); });
    const missing = w.filter((r) => r.receipt === CHASE || !r.receipt).sort((a, b) => Number(b.amount) - Number(a.amount));
    return {
      from, to: end, count: w.length, total: w.reduce((t, r) => t + Number(r.amount || 0), 0),
      byCat: Object.entries(by).sort((a, b) => b[1] - a[1]),
      top: [...w].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5),
      photo: w.filter((r) => r.receipt === PHOTO).length, digital: w.filter((r) => r.receipt === DIGITAL).length,
      paper: w.filter((r) => r.receipt === PAPER).length, missingCount: missing.length, missing,
    };
  };
  Z.receiptsWeekText = (wk) => {
    const L = [];
    L.push(`*🧾 Receipts this week* (${Z.day(wk.from)} – ${Z.day(wk.to)})`);
    if (!wk.count) { L.push('No expenses recorded this week.'); return L; }
    L.push(`Spent: KES ${Z.fmt(wk.total)} in ${wk.count} payment${wk.count === 1 ? '' : 's'}`);
    L.push('By category: ' + wk.byCat.map(([c, v]) => `${c} KES ${Z.fmt(v)}`).join(' · '));
    L.push('Top 5:');
    wk.top.forEach((r, i) => L.push(`${i + 1}. ${r.payee} — KES ${Z.fmt(r.amount)} (${Z.day(r.date)}${r.recorded_by ? ', ' + r.recorded_by : ''})`));
    L.push(`Receipts: 📷 photo ${wk.photo} · 📱 M-Pesa msg ${wk.digital} · 🧾 paper ${wk.paper} · ❌ missing ${wk.missingCount}`);
    if (wk.missing.length) {
      L.push('Missing receipts — please find them:');
      wk.missing.slice(0, 15).forEach((r) => L.push(`• ${r.payee} KES ${Z.fmt(r.amount)} (${Z.day(r.date)}) — recorded by ${r.recorded_by || 'unknown'}`));
      if (wk.missing.length > 15) L.push(`• …and ${wk.missing.length - 15} more`);
    } else L.push('✅ Every expense this week has its receipt.');
    return L;
  };

  // ======================================================================================
  // The screen: #receipt · #receipt/job/<ticket> · #receipt/paste · #receipt/mine · #receipt/attach/<expense>
  // ======================================================================================
  Z.routes.receipt = async (args, el) => {
    if (args[0] === 'mine') return mineView(el);
    if (args[0] === 'attach' && args[1]) return attachView(el, args[1]);
    const jobId = args[0] === 'job' && /^[0-9a-zA-Z-]{6,}$/.test(args[1] || '') ? args[1] : null;
    return snapView(el, { jobId, paste: args[0] === 'paste' });
  };

  // My receipts: what I recorded, with the status of each receipt and a "snap it now" for the missing ones.
  async function myRows() {
    let rows = [], offline = false;
    try {
      rows = must(await Z.sb.from('expenses').select('*').eq('created_by', Z.me.id).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(30));
      Z.set('rc_mine', rows);
    } catch (e) { if (!Z.isNet(e)) throw e; rows = Z.get('rc_mine', []); offline = true; }
    const local = Z.queue.filter((q) => q.op === 'expense_insert').map((q) => ({ ...q.data.row, _local: true }));
    const attach = new Map(Z.queue.filter((q) => q.op === 'receipt_attach').map((q) => [q.data.id, q.data.path]));
    rows = local.filter((l) => !rows.some((r) => r.id === l.id)).concat(rows).map((r) => (attach.has(r.id) ? { ...r, receipt: PHOTO, receipt_path: attach.get(r.id), _local: true } : r));
    rows.offline = offline;
    return rows;
  }
  function listHtml(rows) {
    if (!rows.length) return '<div class="muted">Nothing yet. Spent Zuri money? Snap the receipt above.</div>';
    return rows.map((r) => `<div class="item rc-item" style="flex-wrap:wrap">
        <div class="grow" style="min-width:170px"><div class="t">${Z.esc(r.payee)} ${Z.receiptPill(r)}${Z.approvalPill ? ' ' + Z.approvalPill(r) : ''}${r._local ? ' <span class="m">⏳ not sent</span>' : ''}</div>
          <div class="m">${Z.esc(Z.day(r.date))} · ${Z.esc(r.category || '')} · ${Z.esc(r.paid_from || '')}${r.ref ? ' · ' + Z.esc(r.ref) : ''}</div></div>
        <b class="num">${Z.esc(Z.fmt(r.amount))}</b>
        <div class="row" style="width:100%;justify-content:flex-end">
          ${r.receipt_path ? `<button class="btn sec small rc-view" data-path="${Z.esc(r.receipt_path)}" data-label="${Z.esc(r.payee)}">📷 See photo</button>` : ''}
          ${r.receipt === CHASE && !r._local ? `<a class="btn small rc-snap" href="#receipt/attach/${Z.esc(r.id)}">📸 Snap it now</a>` : ''}
        </div></div>`).join('');
  }
  function wireList(el) {
    Z.$$('.rc-view', el).forEach((b) => (b.onclick = () => Z.receiptPhoto(b.dataset.path, b.dataset.label)));
  }

  async function mineView(el) {
    const rows = await myRows();
    const chase = rows.filter((r) => r.receipt === CHASE);
    el.innerHTML = `<p style="margin:0 0 6px"><a class="back" href="#me">← Me</a></p>
      <div class="row" style="justify-content:space-between"><h2 id="rc-head">🧾 My receipts</h2><a class="btn" href="#receipt" id="rc-new">📸 Snap a receipt</a></div>
      ${rows.offline ? '<div class="alert warn">📴 No signal — showing what this phone saved.</div>' : ''}
      ${chase.length ? `<div class="alert warn" id="rc-chase">❌ ${chase.length} still need${chase.length === 1 ? 's' : ''} a receipt (${Z.esc(Z.kes(chase.reduce((t, r) => t + Number(r.amount), 0)))}). Ask the shop, then tap 📸 Snap it now.</div>` : ''}
      <div class="card list" id="rc-list">${listHtml(rows)}</div>
      <p class="hint">Only you and the finance team see your receipts.${rows.some((r) => r.approval === 'waiting') ? ' ⏳ “waiting for OK” means finance still has to confirm it — the second person for every Zuri payment.' : ''}</p>`;
    wireList(el);
    Z.onSynced = () => { if (location.hash.startsWith('#receipt')) Z.route(); };
  }

  // Attach a photo to an expense that was saved with "No — chase it".
  async function attachView(el, id) {
    let r = null;
    try { r = must(await Z.sb.from('expenses').select('*').eq('id', id).maybeSingle()); } catch (e) { if (!Z.isNet(e)) throw e; r = Z.get('rc_mine', []).find((x) => x.id === id) || null; }
    if (!r) { el.innerHTML = '<div class="card">This expense isn\'t available.</div>'; return; }
    el.innerHTML = `<p style="margin:0 0 6px"><a class="back" href="#receipt/mine">← My receipts</a></p>
      <h2 id="rc-head">📸 Add the receipt</h2>
      <div class="card"><div class="t"><b>${Z.esc(r.payee)}</b> · ${Z.esc(Z.kes(r.amount))}</div><div class="hint" style="margin:2px 0 0">${Z.esc(Z.day(r.date))} · ${Z.esc(r.category || '')}${r.ref ? ' · ' + Z.esc(r.ref) : ''} · ${Z.receiptPill(r)}</div></div>
      <div class="card">
        <label class="btn block" id="rc-cam" style="min-height:56px;font-size:17px">📸 Take a photo of the receipt<input type="file" accept="image/*" capture="environment" id="rc-cam-in" hidden></label>
        <div style="height:8px"></div>
        <label class="btn sec block" id="rc-lib">🖼️ Choose from my photos<input type="file" accept="image/*" id="rc-lib-in" hidden></label>
        <p class="hint">Lay it flat, in good light, the whole receipt in the picture.</p>
      </div>`;
    const go = async (file) => {
      if (!file) return;
      try {
        const blob = await shrink(file);
        const key = 'rc_' + Z.uuid();
        await Z.idb.putBlob(key, blob);
        const path = Z.receiptPath(r.area, r.date, r.id);
        if (!Z.enqueue('receipt_attach', { id: r.id, key, path })) { Z.idb.del(key).catch(() => {}); return; }
        Z.toast(Z.online() ? '📷 Receipt saved — uploading.' : '📷 Receipt saved on this phone — it uploads when you have signal.');
        Z.go('receipt/mine');
      } catch (e) { console.error(e); Z.toast('This phone couldn\'t keep the photo (storage may be full).'); }
    };
    Z.$('#rc-cam-in', el).onchange = (e) => go(e.target.files[0]);
    Z.$('#rc-lib-in', el).onchange = (e) => go(e.target.files[0]);
    Z.receipt.usePhoto = go;
  }

  // ---------- the main screen ----------
  async function snapView(el, { jobId, paste }) {
    const [cats, aiOn, job] = await Promise.all([
      categories(),
      Z.receiptAI(),
      jobId ? Z.sb.from('tickets').select('id,ticket_no,area,summary,customer_id,caller').eq('id', jobId).maybeSingle().then((r) => r.data).catch(() => null) : null,
    ]);
    let jobName = '';
    if (job && job.customer_id) { try { const c = await Z.sb.from('v_customers').select('full_name').eq('id', job.customer_id).maybeSingle(); jobName = (c.data && c.data.full_name) || ''; } catch (e) {} }
    const jobCached = !job && jobId ? (Z.get('job_' + jobId, null) || {}).t : null;
    const tk = job || jobCached || null;
    const fin = Z.isFinance();
    let payees = [];
    if (fin) { try { payees = must(await Z.sb.from('payees').select('name,category').order('name')); } catch (e) { /* offline */ } }
    let bills = [];
    if (fin && Z.online()) { try { bills = must(await Z.sb.from('bills').select('*').eq('month', Z.ym()).eq('paid', false)); } catch (e) { /* offline */ } }
    const mine = await myRows().catch(() => []);
    const areas = Z.ref.areas.filter((a) => a.active);
    const area0 = (tk && tk.area) || Z.me.area || Z.area || (areas[0] || {}).code || '';
    const from0 = Z.get('rc_from', 'M-Pesa');
    const back = tk ? `#jobs/${tk.id}` : fin ? '#money/expense' : '#tasks/mine';

    el.innerHTML = `<p style="margin:0 0 6px"><a class="back" href="${Z.esc(back)}">← ${tk ? 'Back to the job' : fin ? 'Money out' : 'My day'}</a></p>
      <h2 id="rc-head">🧾 Snap a receipt</h2>
      ${tk ? `<div class="card" id="rc-job" style="border-left:4px solid var(--brand)"><b>For job #${Z.esc(tk.ticket_no ?? '…')}</b>${jobName || tk.caller ? ' · ' + Z.esc(jobName || tk.caller) : ''}<div class="hint" style="margin:2px 0 0">${Z.esc(tk.summary || '')}</div></div>` : ''}
      <div class="card" id="rc-start">
        <label class="btn block" id="rc-cam" style="min-height:56px;font-size:17px">📸 Take a photo of the receipt<input type="file" accept="image/*" capture="environment" id="rc-cam-in" hidden></label>
        <div class="row" style="margin-top:8px">
          <label class="btn sec" id="rc-lib" style="flex:1 1 140px">🖼️ From my photos<input type="file" accept="image/*" id="rc-lib-in" hidden></label>
          <button class="btn sec" type="button" id="rc-paste-b" style="flex:1 1 140px">📩 Paste M-Pesa message</button>
        </div>
        <div id="rc-pastebox" ${paste ? '' : 'hidden'} style="margin-top:10px">
          <label for="rc-sms">Paste the M-Pesa message</label>
          <textarea id="rc-sms" placeholder="Long-press here → Paste. e.g. UJ41AB2CDE Confirmed. Ksh2,500.00 paid to KAMAU HARDWARE…"></textarea>
          <button class="btn sec block" type="button" id="rc-read">Read the message</button>
        </div>
        <div id="rc-prev" class="photos" style="margin-top:10px"></div>
        <div id="rc-status" aria-live="polite"></div>
        <p class="hint" style="margin:8px 0 0">${aiOn ? '🤖 Zuri reads the photo for you, then you check it.' : 'Snap the receipt, then type what it says. The photo is kept with the expense.'} No receipt? Just fill in the boxes below.</p>
      </div>

      <form class="card" id="rc-form" novalidate>
        <div class="grid2">
          <div><label for="rc-payee">Paid to (shop or person)</label><input id="rc-payee" name="payee" list="rc-payees" autocomplete="off" required placeholder="e.g. Kamau Hardware">
            <datalist id="rc-payees">${payees.map((p) => `<option value="${Z.esc(p.name)}">`).join('')}</datalist></div>
          <div><label for="rc-amount">Amount (KES)</label><input id="rc-amount" name="amount" inputmode="decimal" required placeholder="e.g. 2,400"></div>
        </div>
        <label for="rc-cat">What was it for?</label>
        <div class="chips" id="rc-chips"></div>
        <select id="rc-cat" name="category" required><option value="">— choose —</option>${Z.opts(cats)}</select>
        <div class="grid2">
          <div><label for="rc-date">Date</label><input id="rc-date" type="date" name="date" value="${Z.ymd()}" max="${Z.ymd()}" required></div>
          <div><label for="rc-area">Area</label><select id="rc-area" name="area" required>${Z.opts(areas.map((a) => [a.code, a.name]), area0)}</select></div>
        </div>
        <label>Paid with</label>
        <div class="seg" id="rc-from">${['M-Pesa', 'Cash', 'Bank'].map((k) => `<button type="button" data-v="${k}" class="${k === from0 ? 'on' : ''}">${k === 'M-Pesa' ? '📱' : k === 'Bank' ? '🏦' : '💵'} ${k}</button>`).join('')}</div>
        <label for="rc-ref">M-Pesa or bank code (if any)</label>
        <input id="rc-ref" name="ref" autocapitalize="characters" autocomplete="off" placeholder="e.g. UJ41AB2CDE">
        <div id="rc-match"></div>
        <div id="rc-rcpt-row"><label for="rc-receipt">Receipt</label>
          <select id="rc-receipt" name="receipt">${Z.opts([[CHASE, 'No receipt yet — chase it'], [PAPER, 'Paper receipt — I will file it'], [DIGITAL, 'M-Pesa message is the receipt']], CHASE)}</select></div>
        <label class="row" id="rc-billrow" style="gap:8px;font-weight:600" hidden><input type="checkbox" name="as_bill" checked> <span id="rc-billtxt"></span></label>
        <details id="rc-more" style="margin-top:10px"><summary class="hint" style="cursor:pointer;font-weight:600;min-height:44px;display:flex;align-items:center">More — VAT, supplier PIN, what was bought</summary>
          <div class="grid2">
            <div><label for="rc-vat">VAT included (KES)</label><input id="rc-vat" name="vat_amount" inputmode="decimal" placeholder="0"></div>
            <div><label for="rc-pin">Supplier KRA PIN</label><input id="rc-pin" name="supplier_pin" autocapitalize="characters" placeholder="e.g. P051234567X"></div>
          </div>
          <label for="rc-note">What was bought / note</label><input id="rc-note" name="note" placeholder="e.g. 2 connectors, 50 m drop cable">
        </details>
        <div style="height:14px"></div>
        <button class="btn block" type="submit" id="rc-save" style="min-height:54px;font-size:17px">✅ Save</button>
        <button class="btn bad block" type="button" id="rc-anyway" hidden style="margin-top:8px">It's a different payment — save anyway</button>
      </form>

      <h3>My recent receipts</h3>
      <div class="card list" id="rc-list">${listHtml(mine.slice(0, 8))}</div>
      ${mine.length > 8 ? '<a class="btn sec small" href="#receipt/mine">See all my receipts</a>' : ''}`;
    wireList(el);

    const f = Z.$('#rc-form', el);
    const st = Z.$('#rc-status', el);
    const say = (cls, text) => { st.innerHTML = text ? `<div class="alert ${cls}" style="margin:10px 0 0">${Z.esc(text)}</div>` : ''; };
    const S = { blob: null, key: null, read: null, from: from0, dup: false, checkSeq: 0, matchedBill: null };
    const mark = (input) => { if (input) { input.style.outline = '3px solid var(--accent)'; input.addEventListener('input', () => { input.style.outline = ''; }, { once: true }); } };

    // ---- paid with ----
    Z.$$('#rc-from [data-v]', el).forEach((b) => (b.onclick = () => setFrom(b.dataset.v)));
    function setFrom(v) { S.from = v; Z.$$('#rc-from [data-v]', el).forEach((x) => x.classList.toggle('on', x.dataset.v === v)); }

    // ---- category chips: history (no AI needed), words on the receipt, and the AI's guess ----
    const chips = { ai: null, hist: null, hint: null };
    function drawChips() {
      const list = [];
      if (chips.ai) list.push(['ai', chips.ai, '🤖 ' + chips.ai]);
      if (chips.hist && chips.hist !== chips.ai) list.push(['hist', chips.hist, '🕘 Usually: ' + chips.hist]);
      if (chips.hint && chips.hint !== chips.ai && chips.hint !== chips.hist) list.push(['hint', chips.hint, '💡 Looks like: ' + chips.hint]);
      Z.$('#rc-chips', el).innerHTML = list.map(([k, v, t]) => `<button type="button" data-k="${k}" data-v="${Z.esc(v)}" class="${f.category.value === v ? 'on' : ''}">${Z.esc(t)}</button>`).join('');
      Z.$$('#rc-chips button', el).forEach((b) => (b.onclick = () => { f.category.value = b.dataset.v; drawChips(); }));
    }
    f.category.onchange = drawChips;
    let sugSeq = 0;
    async function onPayee(autoPick) {
      const name = f.payee.value.trim();
      const known = payees.find((p) => p.name.toLowerCase() === name.toLowerCase());
      chips.hint = hintFor(name + ' ' + (f.note.value || ''), cats);
      const my = ++sugSeq;
      const s = await suggest(name);
      if (my !== sugSeq) return;
      chips.hist = (s && cats.includes(s.category) && s.category) || (known && known.category) || null;
      if (autoPick && !f.category.value) f.category.value = chips.ai || chips.hist || '';
      drawChips(); findBill();
    }
    f.payee.addEventListener('change', () => onPayee(true));
    f.payee.addEventListener('input', () => { clearTimeout(f._t); f._t = setTimeout(() => onPayee(false), 500); findBill(); });

    // ---- this month's bills (finance): count the payment against the bill ----
    function findBill() {
      const name = f.payee.value.trim().toLowerCase();
      S.matchedBill = fin && name.length >= 3 ? bills.find((b) => b.area === f.area.value && (b.name.toLowerCase().includes(name) || name.includes(b.name.toLowerCase()))) || null : null;
      Z.$('#rc-billrow', el).hidden = !S.matchedBill;
      if (S.matchedBill) Z.$('#rc-billtxt', el).textContent = `This pays the ${S.matchedBill.name} bill (still owing ${Z.kes(Number(S.matchedBill.amount) - Number(S.matchedBill.paid_amount))}) — tick it off the bill list too`;
    }
    f.area.onchange = findBill;

    // ---- the code: already in the statement (matched) or already an expense (duplicate)? ----
    async function onCode() {
      const my = ++S.checkSeq;
      const res = await checkCode(f.ref.value);
      if (my !== S.checkSeq) return;
      Z.$('#rc-match', el).innerHTML = matchHtml(res);
      S.dup = !!(res && res.expenses && res.expenses.length);
      Z.$('#rc-anyway', el).hidden = !S.dup;
      Z.$('#rc-save', el).disabled = S.dup;
    }
    f.ref.addEventListener('change', onCode);
    f.ref.addEventListener('input', () => { clearTimeout(f._c); f._c = setTimeout(onCode, 700); });

    // ---- the receipt line: a photo says "Photo saved" by itself ----
    function photoMode() {
      Z.$('#rc-rcpt-row', el).innerHTML = '<label>Receipt</label><div><span class="pill ok" id="rc-photo-pill" style="font-size:14px;padding:6px 12px">📷 Photo saved with this expense</span></div>';
    }

    // ---- fill the boxes from a reading (AI or message) ----
    function fill(p, src) {
      const n = [];
      if (p.payee) { const known = payees.find((x) => x.name.toLowerCase() === String(p.payee).toLowerCase()); f.payee.value = known ? known.name : p.payee; mark(f.payee); n.push('who'); }
      if (p.amount != null && Number(p.amount) > 0) { f.amount.value = String(p.amount); mark(f.amount); n.push('amount'); }
      if (p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.date <= Z.ymd() && p.date >= '2020-01-01') { f.date.value = p.date; mark(f.date); n.push('date'); }
      if (p.ref) { f.ref.value = String(p.ref).toUpperCase(); mark(f.ref); n.push('code'); setFrom('M-Pesa'); }
      if (p.vat_amount != null && Number(p.vat_amount) > 0) { f.vat_amount.value = String(p.vat_amount); mark(f.vat_amount); n.push('VAT'); }
      if (p.supplier_pin) { f.supplier_pin.value = String(p.supplier_pin).toUpperCase(); mark(f.supplier_pin); }
      const notes = [];
      if (p.items_summary) notes.push(p.items_summary);
      if (p.fee) notes.push('M-Pesa fee ' + p.fee);
      if (p.fuliza) notes.push(`Paid with Fuliza ${p.fuliza}${p.fuliza_fee ? ' (fee ' + p.fuliza_fee + ')' : ''}`);
      if (p.account) notes.push('Account ' + p.account);
      if (p.payee_no && src === 'msg') notes.push(p.kind === 'sent' ? 'Phone ' + p.payee_no : 'No. ' + p.payee_no);
      if (notes.length && !f.note.value) { f.note.value = notes.join(' · ').slice(0, 200); }
      if ((p.vat_amount || p.supplier_pin) && !Z.$('#rc-more', el).open) Z.$('#rc-more', el).open = true;
      return n;
    }

    // ---- 📩 message ----
    Z.$('#rc-paste-b', el).onclick = () => { const b = Z.$('#rc-pastebox', el); b.hidden = !b.hidden; if (!b.hidden) Z.$('#rc-sms', el).focus(); };
    Z.$('#rc-read', el).onclick = async () => {
      const p = parse(Z.$('#rc-sms', el).value);
      if (p.kind === 'received') return say('warn', `This message is money IN (${Z.kes(p.amount)} from ${p.payee || 'someone'}), not money spent. Customer payments come from the billing website; other money in goes in Money → Money in.`);
      if (!p.amount && !p.ref) return say('warn', 'Could not read that message — check it is the whole M-Pesa message, or type the details below.');
      const got = fill(p, 'msg');
      setFrom('M-Pesa');
      if (!S.blob) { f.receipt.value = DIGITAL; }
      if (p.kind === 'withdraw') f.category.value = '';
      chips.hint = hintFor(p.payee || '', cats) || (p.kind === 'airtime' ? cats.find((c) => /telecom/i.test(c)) : null) || (p.kind === 'fuliza' ? cats.find((c) => /fee/i.test(c)) : null);
      await onPayee(true);
      const kind = { sent: 'sent to a person', paybill: 'paid to a Paybill', till: 'paid to a till', withdraw: 'cash withdrawal', airtime: 'airtime', fuliza: 'Fuliza (overdraft) fee' }[p.kind] || 'payment';
      say('ok', `Read it: ${kind}${p.amount ? ', ' + Z.kes(p.amount) : ''}${p.payee ? ' to ' + p.payee : ''}. Check the yellow boxes, choose what it was for, then Save.` + (p.kind === 'withdraw' ? ' A withdrawal is cash moving, not spending — record what the cash was spent on instead, if you can.' : '') + (p.kind === 'fuliza' ? ' Only the Fuliza fee is a cost; the payment itself is in the other M-Pesa message.' : ''));
      if (p.kind === 'fuliza' && p.fee) f.amount.value = String(p.fee);
      if (got.includes('code')) onCode();
    };

    // ---- 📸 photo ----
    async function usePhoto(file) {
      if (!file) return;
      let blob;
      try { blob = await shrink(file); } catch (e) { return say('bad', 'Could not read that photo. Try again, or choose another one.'); }
      S.blob = blob;
      const url = URL.createObjectURL(blob);
      Z.$('#rc-prev', el).innerHTML = `<button type="button" class="rc-thumb" aria-label="See the photo bigger" style="padding:0;border:0;background:none;cursor:pointer"><img src="${url}" alt="Your receipt photo"></button><div class="hint" style="align-self:center">📷 Photo ready (${Math.round(blob.size / 1024)} KB).<br>Tap Save and it is kept with the expense.</div>`;
      Z.$('.rc-thumb', el).onclick = () => { const sh = Z.sheet('🧾 Your photo', `<img src="${url}" alt="Receipt photo" style="width:100%;border-radius:10px">`); return sh; };
      photoMode();
      if (!Z.online()) return say('warn', 'No signal — type it, the photo will upload later.');
      if (!aiOn) return say('warn', 'Type the details — reading is switched off.');
      say('ok', '🔎 Reading the receipt…');
      Z.$('#rc-save', el).disabled = true;
      try {
        const b64 = await toB64(blob);
        const call = Z.sb.functions.invoke('zuri-receipt', { body: { image: b64, media_type: 'image/jpeg', categories: cats, today: Z.ymd() } });
        const timeout = new Promise((_, no) => setTimeout(() => no(new Error('timed out')), 40000));
        const { data, error } = await Promise.race([call, timeout]);
        if (error || !data || !data.ok) {
          const why = data && data.reason;
          say('warn', why === 'off' ? 'Type the details — reading is switched off.' : why === 'limit' ? 'Zuri has read a lot of receipts today — type this one. The photo is kept.' : 'Could not read this photo — type the details. The photo is kept.');
        } else {
          const r = data.fields || {};
          S.read = r;
          const got = fill({ payee: r.payee, amount: r.amount, date: r.date, ref: r.mpesa_code, vat_amount: r.vat_amount, supplier_pin: r.supplier_pin, items_summary: r.items_summary }, 'ai');
          if (r.suggested_category && cats.includes(r.suggested_category)) { chips.ai = r.suggested_category; f.category.value = r.suggested_category; }
          await onPayee(true);
          const low = typeof r.confidence === 'number' ? r.confidence < 0.6 : r.confidence === 'low';
          say(low ? 'warn' : 'ok', got.length ? (low ? '🤖 Read it, but not sure — check every yellow box carefully, then Save.' : '🤖 Read it. Check the yellow boxes, then Save.') : '🤖 Could not find the details on this photo — type them. The photo is kept.');
          if (got.includes('code')) onCode();
        }
      } catch (e) {
        say('warn', Z.isNet(e) || /timed out/.test(String(e.message)) ? 'No signal — type it, the photo will upload later.' : 'Could not read this photo — type the details. The photo is kept.');
      } finally { Z.$('#rc-save', el).disabled = S.dup; }
    }
    Z.$('#rc-cam-in', el).onchange = (e) => usePhoto(e.target.files[0]);
    Z.$('#rc-lib-in', el).onchange = (e) => usePhoto(e.target.files[0]);
    Z.receipt.usePhoto = usePhoto; // the training videos hand it a pretend photo

    // ---- save ----
    async function save(force) {
      const d = Z.formData(f);
      const amount = Z.num(d.amount);
      if (!d.payee.trim()) { f.payee.focus(); return Z.toast('Who was paid? Type the shop or person.'); }
      if (!amount || amount <= 0) { f.amount.focus(); return Z.toast('Type the amount.'); }
      if (!d.category) { f.category.focus(); return Z.toast('Choose what it was for.'); }
      if (!d.area) return Z.toast('Choose the area.');
      if (S.dup && !force) return Z.toast('This code is already recorded — check above.');
      const id = Z.uuid();
      const receipt = S.blob ? PHOTO : d.receipt || CHASE;
      const row = {
        id, area: d.area, date: d.date || Z.ymd(), payee: d.payee.trim().slice(0, 120), category: d.category, amount,
        paid_from: S.from, ref: d.ref.trim().toUpperCase() || null, receipt,
        note: (d.note || '').trim() || null, vat_amount: Z.num(d.vat_amount) || 0, supplier_pin: (d.supplier_pin || '').trim().toUpperCase() || null,
        recorded_by: Z.me.full_name, created_by: Z.me.id, ticket_id: tk ? tk.id : null,
        receipt_path: S.blob ? Z.receiptPath(d.area, d.date, id) : null,
        receipt_read: S.read ? { ...S.read, read_at: new Date().toISOString() } : null,
      };
      Z.set('rc_from', S.from);
      const hist = Z.get('rc_hist', {}); hist[row.payee.toLowerCase()] = row.category; Z.set('rc_hist', hist);
      const btn = Z.$('#rc-save', el); btn.disabled = true;
      // Finance paying one of this month's bills: count it against the bill (needs signal), then attach the photo.
      if (S.matchedBill && d.as_bill && Z.online()) {
        const { data, error } = await Z.payBill(S.matchedBill.id, amount, row.paid_from, row.ref,
          { p_date: row.date, p_vat: row.vat_amount, p_pin: row.supplier_pin, p_note: row.note, p_receipt: receipt });
        if (error) { btn.disabled = false; return Z.fail(error); }
        if (S.blob && data && data.expense) {
          const key = 'rc_' + Z.uuid();
          await Z.idb.putBlob(key, S.blob);
          Z.enqueue('receipt_attach', { id: data.expense, key, path: Z.receiptPath(row.area, row.date, data.expense) });
        }
        // v2.36 (15 Oct): with two people for money out on, the payment waits for an OK — don't say the bill is settled.
        Z.toast(data && data.waiting ? `Saved for the ${S.matchedBill.name} bill — waiting for a second person's OK (👥 Approvals).` : `Saved and counted against the ${S.matchedBill.name} bill.`);
        return tk ? Z.go('jobs/' + tk.id) : Z.route();
      }
      let key = null;
      if (S.blob) {
        key = 'rc_' + id;
        try { await Z.idb.putBlob(key, S.blob); } catch (e) { btn.disabled = false; return Z.toast('This phone couldn\'t keep the photo (storage may be full).'); }
      }
      const newPayee = fin && !payees.some((p) => p.name.toLowerCase() === row.payee.toLowerCase());
      if (!Z.enqueue('expense_insert', { row, key, newPayee })) { if (key) Z.idb.del(key).catch(() => {}); btn.disabled = false; return; }
      Z.toast(Z.online() ? (S.blob ? '✅ Saved — the photo is uploading.' : '✅ Saved.') : '✅ Saved on this phone — it sends when you have signal.');
      if (tk) Z.go('jobs/' + tk.id); else Z.route();
    }
    f.onsubmit = (e) => { e.preventDefault(); save(false); };
    Z.$('#rc-anyway', el).onclick = () => save(true);
    Z.onSynced = () => { if (location.hash === '#receipt' || location.hash.startsWith('#receipt/mine')) { const box = Z.$('#rc-list', el); if (box) myRows().then((rows) => { box.innerHTML = listHtml(rows.slice(0, 8)); wireList(el); }).catch(() => {}); } };
  }
  Z.receipt = { parse, usePhoto: null, PHOTO, DIGITAL, PAPER, CHASE };

  // ======================================================================================
  // Admin → Settings: "Read receipts with AI" (partners only; stored in the database settings table)
  // ======================================================================================
  if (Z.adminSubs) {
    Z.adminSubs.push(['settings', 'Settings']);
    Z.adminViews.settings = async (el) => {
      const { data, error } = await Z.sb.from('settings').select('value').eq('key', 'receipts_ai').maybeSingle();
      if (error) throw error;
      const v = (data && data.value) || {};
      const on = !!v.on;
      el.innerHTML = `
        <div class="card" id="st-ai-card">
          <b style="font-size:17px">🤖 Read receipts with AI</b>
          <p class="hint">When this is <b>On</b>, a snapped receipt photo is sent to Zuri's reading helper (Claude, by Anthropic), which fills in the shop, amount, date, M-Pesa code, VAT and PIN — the person still checks every box and taps Save. When it is <b>Off</b>, the photo is still kept with the expense; the person types the details.</p>
          <div class="seg" id="st-ai" role="group" aria-label="Read receipts with AI">
            <button type="button" data-v="off" class="${on ? '' : 'on'}">Off — people type it</button>
            <button type="button" data-v="on" class="${on ? 'on' : ''}">On — AI fills it in</button>
          </div>
          <p class="hint" id="st-ai-who">${v.by ? `Last changed by ${Z.esc(v.by)}${v.at ? ' · ' + Z.esc(Z.when(v.at)) : ''}.` : 'Starts Off.'}</p>
          <div class="alert warn" style="margin-top:8px">💰 Cost: about <b>KES 3–5 per receipt</b> (US$0.02–0.04), paid from Jerry's Anthropic account. 100 receipts a month ≈ KES 400. Each person can read up to 40 a day.</div>
          <p class="hint">Needs the <b>zuri-receipt</b> function and the Anthropic key in Supabase first (see “22_receipts — how to switch on”). Until then, On simply falls back to typing.</p>
        </div>
        <div class="card"><b>🧾 Missing receipts — automatic</b>
          <p class="hint" style="margin-bottom:0">Every morning the Zuri manager gives a task to whoever saved an expense with “No — chase it” more than 2 days ago, and it shows in their WhatsApp nudge. Money that left a bank or M-Pesa statement with no matching expense after 3 days becomes a task for finance: “Snap the receipt for KES X to Y”. No AI needed; nothing to switch on.</p></div>`;
      Z.$$('#st-ai [data-v]', el).forEach((b) => (b.onclick = async () => {
        const want = b.dataset.v === 'on';
        const value = { on: want, by: Z.me.full_name, at: new Date().toISOString() };
        const { error: e2 } = await Z.sb.from('settings').upsert({ key: 'receipts_ai', value }, { onConflict: 'key' });
        if (e2) return Z.fail(e2);
        Z.set('rc_ai', want);
        Z.toast(want ? '🤖 AI reading is ON.' : 'AI reading is OFF — people type the details.');
        Z.route();
      }));
    };
  }
})();
