// Zuri System · Import: billing-website exports (Excel or CSV) · v2 · 2026-09-30
(function () {
  const Z = window.Z;
  // M-Pesa and bank statements come in under Money → Statements, not here.
  const SOURCES = [['billnasi', 'Billnasi'], ['portal', 'Second billing website']];
  const TARGETS = {
    customers: [
      ['full_name', 'Customer name', true, ['name', 'names', 'customer name', 'full name', 'client name', 'customer', 'client', 'subscriber']],
      ['billnasi_id', 'Customer ID / username on the website', true, ['customer id', 'client id', 'user id', 'username', 'user name', 'id', 'account', 'account no']],
      ['phone', 'Phone', false, ['phone', 'phone number', 'mobile', 'msisdn', 'contact', 'tel']],
      ['account_no', 'Account number (if different)', false, ['account number', 'account no', 'acc no']],
      ['email', 'Email', false, ['email', 'e-mail']],
      ['plan', 'Package / plan', false, ['plan', 'package', 'profile', 'service', 'bandwidth']],
      ['monthly_rate', 'Monthly price', false, ['price', 'monthly', 'rate', 'fee', 'amount', 'cost']],
      ['status', 'Status', false, ['status', 'state']],
      ['paid_until', 'Paid until / expiry date', false, ['expiry', 'expiry date', 'expires', 'paid until', 'valid until', 'expiration']],
      ['area', 'Area / site', false, ['area', 'site', 'zone', 'region']],
      ['landmark', 'Address / directions', false, ['address', 'landmark', 'location', 'directions']],
      ['lat', 'Latitude', false, ['lat', 'latitude']],
      ['lng', 'Longitude', false, ['lng', 'lon', 'long', 'longitude']],
    ],
    payments: [
      ['date', 'Date paid', true, ['completion time', 'payment date', 'transaction date', 'paid on', 'date', 'time', 'created']],
      ['amount', 'Amount paid', true, ['paid in', 'amount paid', 'amount', 'paid', 'credit']],
      ['mpesa_ref', 'M-Pesa code / receipt', false, ['receipt no', 'receipt', 'mpesa code', 'transaction code', 'trans id', 'trxcode', 'trx code', 'mpesa ref', 'code', 'reference']],
      ['payer_phone', 'Payer phone', false, ['phone', 'msisdn', 'mobile', 'sender phone']],
      ['account_ref', 'Account / customer ID paid for', false, ['account', 'account no', 'bill ref', 'bill reference', 'account reference', 'username', 'customer id']],
      ['payer_name', 'Payer name', false, ['name', 'customer', 'payer', 'client', 'sender', 'details']],
      ['external_id', 'Transaction ID on the website', false, ['transaction id', 'payment id', 'id']],
    ],
  };
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  function guess(targets, headers) {
    const used = new Set(), out = {};
    for (const [key, , , syn] of targets) {
      let idx = -1;
      for (const s of syn) { idx = headers.findIndex((h, i) => !used.has(i) && norm(h) === s); if (idx >= 0) break; }
      if (idx < 0) for (const s of syn) { idx = headers.findIndex((h, i) => !used.has(i) && norm(h).includes(s)); if (idx >= 0) break; }
      if (idx >= 0) { out[key] = idx; used.add(idx); }
    }
    return out;
  }

  // Dates arrive as real dates, Excel serial numbers, or text like 30/09/2026 14:22 (Kenya writes day first).
  function toDate(v) {
    if (v instanceof Date && !isNaN(v)) return Z.ymd(v);
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
    const s = String(v || '').trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
    if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
    const d = new Date(s);
    return isNaN(d) ? null : Z.ymd(d);
  }
  Z.toDate = toDate;
  // Billnasi writes expiry like "29 Oct 2026 06:38 pm" — Kenya time.
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function toDateTime(v) {
    if (v instanceof Date && !isNaN(v)) return v.toISOString();
    const s = String(v || '').trim();
    if (!s) return null;
    const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i);
    if (m) {
      const mon = MONTHS.indexOf(m[2].toLowerCase());
      if (mon >= 0) {
        let h = +(m[4] || 0);
        if (m[7]) h = (h % 12) + (m[7].toLowerCase() === 'pm' ? 12 : 0);
        return `${m[3]}-${String(mon + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}T${String(h).padStart(2, '0')}:${m[5] || '00'}:${m[6] || '00'}+03:00`;
      }
    }
    const d = toDate(v);
    return d ? d + 'T23:59:00+03:00' : null;
  }
  function toArea(v, fallback) {
    const s = String(v || '').trim();
    if (s) {
      const a = Z.ref.areas.find((x) => x.code === s.toUpperCase() || x.name.toLowerCase() === s.toLowerCase() || new RegExp('\\b' + x.code + '$', 'i').test(s));
      if (a) return a.code;
    }
    return fallback || null;
  }
  function toStatus(v) {
    const s = norm(v);
    if (!s || /active|paid|online|current/.test(s) && !/inactive/.test(s)) return 'active';
    if (/suspend|expir|overdue|blocked/.test(s)) return 'suspended';
    if (/disconn|inactive|terminat|closed|cancel/.test(s)) return 'disconnected';
    if (/lead|pending|new/.test(s)) return 'lead';
    return 'active';
  }
  const cell = (row, idx) => (idx == null || idx === '' ? '' : row[idx] ?? '');
  const str = (v) => (v instanceof Date ? Z.ymd(v) : String(v ?? '').trim());

  function mapRows(kind, source, rows, map, defArea) {
    const good = [], bad = [];
    const seen = new Set();
    for (const r of rows) {
      if (!r.some((v) => String(v).trim() !== '')) continue;
      if (kind === 'customers') {
        const rawStatus = map.status != null ? str(cell(r, map.status)) : '';
        const paidUntil = map.paid_until != null ? toDateTime(cell(r, map.paid_until)) : null;
        const o = {
          full_name: str(cell(r, map.full_name)), billnasi_id: str(cell(r, map.billnasi_id)) || null,
          phone: str(cell(r, map.phone)) || null, account_no: str(cell(r, map.account_no)) || null, email: str(cell(r, map.email)) || null,
          plan: str(cell(r, map.plan)) || null, monthly_rate: Z.num(cell(r, map.monthly_rate)),
          status: map.status != null ? toStatus(cell(r, map.status)) : null, // no column → keep what's saved
          area: toArea(cell(r, map.area), defArea), landmark: str(cell(r, map.landmark)).replace(/[\s,]+$/, '') || null,
          lat: Z.num(cell(r, map.lat)), lng: Z.num(cell(r, map.lng)),
          paid_until: paidUntil, billing_status: rawStatus || null,
        };
        // Prepaid "Expired" just means late — unless it ran out over 60 days ago, then they've likely left.
        if (/expir/i.test(rawStatus)) o.status = paidUntil && Date.parse(paidUntil) < Date.now() - 60 * 864e5 ? 'disconnected' : 'active';
        if (!o.full_name) { bad.push([r, 'no name']); continue; }
        if (!o.billnasi_id) { bad.push([r, 'no customer ID']); continue; }
        if (!o.area) { bad.push([r, 'no area — pick a default area']); continue; }
        if (seen.has(o.billnasi_id)) { bad.push([r, 'same ID twice in this file']); continue; }
        seen.add(o.billnasi_id);
        good.push(o);
      } else {
        const o = {
          source, date: toDate(cell(r, map.date)), amount: Z.num(cell(r, map.amount)),
          mpesa_ref: str(cell(r, map.mpesa_ref)).toUpperCase() || null, payer_phone: str(cell(r, map.payer_phone)) || null,
          account_ref: str(cell(r, map.account_ref)) || null, payer_name: str(cell(r, map.payer_name)) || null,
          external_id: str(cell(r, map.external_id)) || null, area: defArea || null, method: 'mpesa',
        };
        if (!o.amount || o.amount <= 0) continue; // withdrawals, charges, blank lines
        if (!o.date) { bad.push([r, 'date not readable']); continue; }
        if (o.mpesa_ref && !/^[A-Z0-9]{8,12}$/.test(o.mpesa_ref)) o.mpesa_ref = null;
        // No code and no ID: a stable fingerprint stops a re-import counting the same payment twice.
        if (!o.external_id) o.external_id = 'auto:' + [o.date, o.amount, o.mpesa_ref, o.payer_phone, o.account_ref, o.payer_name].join('|');
        const key = o.mpesa_ref || o.external_id;
        if (seen.has(key)) continue;
        seen.add(key);
        o.raw = null;
        good.push(o);
      }
    }
    return { good, bad };
  }

  Z.routes.import = async (args, el) => {
    const kinds = [['payments', 'Customer payments'], ['customers', 'Customer list']].filter(([k]) => (k === 'payments' ? Z.isFinance() : Z.isStaff()));
    const st = Z.get('import_last', { kind: kinds[0][0], source: 'billnasi' });
    if (!kinds.some(([k]) => k === st.kind)) st.kind = kinds[0][0];
    if (!SOURCES.some(([k]) => k === st.source)) st.source = 'billnasi';

    let unmatched = [];
    if (Z.isFinance()) {
      const r = await Z.sb.from('payments').select('id,date,amount,mpesa_ref,payer_name,payer_phone,account_ref,source').is('customer_id', null).order('date', { ascending: false }).limit(50);
      if (r.error) throw r.error;
      unmatched = r.data;
    }

    el.innerHTML = `
      ${Z.isFinance() ? `<h2>Money</h2>${Z.moneyNav('import')}` : '<h2>Bring in a file</h2>'}
      <div class="card">
        <p class="hint" style="margin-top:0">At month end, download the export from each billing website (Excel or CSV) and bring it in here. Bringing in the same file twice is safe — repeats are skipped.</p>
        <div class="grid2">
          <div><label>What's in the file</label><select id="im-kind">${Z.opts(kinds, st.kind)}</select></div>
          <div><label>Where it came from</label><select id="im-src">${Z.opts(SOURCES, st.source)}</select></div>
          <div><label>Area for these rows (if the file doesn't say)</label><select id="im-area"><option value="">— let the file / customer decide —</option>${Z.opts(Z.ref.areas.map((a) => [a.code, a.name]), st.area)}</select></div>
          <div><label>File</label><input type="file" id="im-file" accept=".xlsx,.xls,.csv"></div>
        </div>
      </div>
      <div id="im-work"></div>
      ${Z.isFinance() ? `<h3>Payments not matched to a customer (${unmatched.length}${unmatched.length === 50 ? '+' : ''})</h3>
      <div class="card list">${unmatched.map((p) => `<div class="item"><div class="grow"><div class="t">${Z.kes(p.amount)} · ${Z.day(p.date)}</div><div class="m">${Z.esc([p.payer_name, p.payer_phone, p.account_ref, p.mpesa_ref].filter(Boolean).join(' · '))}</div></div><button class="btn sec small" data-link="${p.id}">Link</button></div>`).join('') || '<div class="muted">Every payment is matched. 👍</div>'}</div>` : ''}`;

    const save = () => Z.set('import_last', st);
    Z.$('#im-kind', el).onchange = (e) => { st.kind = e.target.value; save(); Z.route(); };
    Z.$('#im-src', el).onchange = (e) => { st.source = e.target.value; save(); };
    Z.$('#im-area', el).onchange = (e) => { st.area = e.target.value; save(); };
    Z.$('#im-file', el).onchange = (e) => { if (e.target.files[0]) readFile(e.target.files[0], st, Z.$('#im-work', el)).catch(Z.fail); };

    Z.$$('[data-link]', el).forEach((b) => (b.onclick = async () => {
      const p = unmatched.find((x) => x.id === b.dataset.link);
      const q = prompt('Type the customer\'s name or phone', p.payer_name || p.payer_phone || '');
      if (!q) return;
      const res = await Z.searchCustomers(q, 9);
      if (!res.length) return Z.toast('No customer found.');
      const pick = res.length === 1 ? (confirm(`Link to ${res[0].full_name} (${res[0].phone || ''})?`) ? 0 : -1)
        : parseInt(prompt(res.map((c, i) => `${i + 1}. ${c.full_name} · ${c.phone || ''} · ${Z.areaName(c.area)}`).join('\n') + '\n\nType the number:'), 10) - 1;
      if (!(pick >= 0 && res[pick])) return;
      const { error } = await Z.sb.from('payments').update({ customer_id: res[pick].id, area: res[pick].area }).eq('id', p.id);
      if (error) return Z.fail(error);
      Z.toast('Linked.'); Z.route();
    }));
  };

  async function readFile(file, st, box) {
    box.innerHTML = '<div class="loading">Reading the file…</div>';
    await Z.xlsxLib();
    // raw: text files keep "0728…" as text (numbers would lose the leading zero and collide).
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, raw: true });
    let sheet = wb.SheetNames[0];
    const render = () => {
      const all = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, defval: '' });
      let hr = all.findIndex((r, i) => i < 20 && r.filter((v) => typeof v === 'string' && v.trim()).length >= 3);
      if (hr < 0) hr = 0;
      draw(all, hr);
    };
    const draw = (all, hr) => {
      const headers = (all[hr] || []).map((h, i) => String(h).trim() || `Column ${i + 1}`);
      const data = all.slice(hr + 1);
      const targets = TARGETS[st.kind];
      const memKey = 'map_' + st.kind + '_' + st.source;
      const mem = Z.get(memKey, null);
      const map = mem && mem.sig === headers.join('|') ? mem.map : guess(targets, headers);
      const colOpts = (sel) => '<option value="">— not in this file —</option>' + headers.map((h, i) => `<option value="${i}"${sel === i ? ' selected' : ''}>${Z.esc(h)}</option>`).join('');
      box.innerHTML = `
        <div class="card">
          <div class="grid2">
            ${wb.SheetNames.length > 1 ? `<div><label>Sheet</label><select id="im-sheet">${Z.opts(wb.SheetNames, sheet)}</select></div>` : ''}
            <div><label>Headings are on row</label><input id="im-hr" type="number" min="1" value="${hr + 1}"></div>
          </div>
          <h3>Which column is which?</h3>
          <p class="hint">I guessed from the headings — check them. Your choices are remembered for next month's file from ${Z.esc((SOURCES.find((s) => s[0] === st.source) || [])[1])}.</p>
          <div class="grid2">${targets.map(([k, label, req]) => `<div><label>${label}${req ? ' *' : ''}</label><select data-map="${k}">${colOpts(map[k])}</select></div>`).join('')}</div>
        </div>
        <div id="im-prev"></div>`;
      const sh = Z.$('#im-sheet', box); if (sh) sh.onchange = () => { sheet = sh.value; render(); };
      Z.$('#im-hr', box).onchange = (e) => draw(all, Math.max(0, (parseInt(e.target.value, 10) || 1) - 1));
      const preview = () => {
        Z.$$('[data-map]', box).forEach((s) => { if (s.value === '') delete map[s.dataset.map]; else map[s.dataset.map] = +s.value; });
        Z.set(memKey, { sig: headers.join('|'), map });
        const missing = targets.filter(([k, , req]) => req && map[k] == null).map(([, l]) => l);
        const { good, bad } = mapRows(st.kind, st.source, data, map, st.area);
        const cols = st.kind === 'customers' ? ['full_name', 'billnasi_id', 'phone', 'plan', 'status', 'paid_until', 'area'] :['date', 'amount', 'mpesa_ref', 'payer_phone', 'account_ref', 'payer_name'];
        Z.$('#im-prev', box).innerHTML = missing.length ? `<div class="alert warn">Pick a column for: ${missing.map(Z.esc).join(', ')}.</div>` : `
          <div class="card">
            <b>${Z.fmt(good.length)} ${st.kind === 'customers' ? 'customers' : 'payments'} ready</b>${bad.length ? ` · <span style="color:var(--warn)">${bad.length} rows skipped</span>` : ''}
            ${st.kind === 'payments' ? ` · total ${Z.kes(good.reduce((t, r) => t + r.amount, 0))}` : ''}
            <div class="scroll-x" style="margin-top:8px"><table class="t"><tr>${cols.map((c) => `<th>${Z.esc((targets.find((t) => t[0] === c) || [c, c])[1])}</th>`).join('')}</tr>
              ${good.slice(0, 8).map((r) => `<tr>${cols.map((c) => `<td>${Z.esc(c === 'amount' || c === 'monthly_rate' ? Z.fmt(r[c]) : c === 'paid_until' ? (r[c] ? Z.day(r[c]) : '') : c === 'area' ? Z.areaName(r[c]) : r[c] ?? '')}</td>`).join('')}</tr>`).join('')}</table></div>
            ${bad.length ? `<details style="margin-top:8px"><summary class="hint">Why rows were skipped</summary><div class="hint">${bad.slice(0, 15).map(([r, why]) => Z.esc(why + ': ' + r.filter(Boolean).slice(0, 4).join(' · '))).join('<br>')}</div></details>` : ''}
            <div style="height:10px"></div>
            <button class="btn block" id="im-go" ${good.length ? '' : 'disabled'}>Import ${Z.fmt(good.length)} ${st.kind === 'customers' ? 'customers' : 'payments'}</button>
          </div>`;
        const go = Z.$('#im-go', box);
        if (go) go.onclick = () => run(st.kind, good, go);
      };
      Z.$$('[data-map]', box).forEach((s) => (s.onchange = preview));
      preview();
    };
    render();
  }

  async function run(kind, rows, btn) {
    btn.disabled = true;
    const tot = { rows: 0, added: 0, skipped: 0, matched: 0 };
    try {
      for (let i = 0; i < rows.length; i += 500) {
        btn.textContent = `Importing… ${Math.min(i + 500, rows.length)} of ${rows.length}`;
        const chunk = rows.slice(i, i + 500);
        const { data, error } = await Z.sb.rpc(kind === 'customers' ? 'import_customers' : 'import_payments', { rows: chunk });
        if (error) throw error;
        if (kind === 'customers') tot.added += data;
        else for (const k of Object.keys(tot)) tot[k] += data[k] || 0;
      }
      btn.textContent = 'Done';
      if (kind === 'customers') Z.toast(`${Z.fmt(tot.added)} customers added or updated.`);
      else Z.toast(`${Z.fmt(tot.added)} new payments · ${Z.fmt(tot.rows - tot.added)} already in · ${Z.fmt(tot.matched)} matched to customers.`);
      setTimeout(Z.route, 1500);
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Try again';
      Z.toast(/unique|duplicate/i.test(e.message || '') ? 'Some account numbers are already used by other customers — check the Account number column.' : Z.errText(e));
    }
  }
})();
