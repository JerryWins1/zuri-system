// Zuri System · 👥 Two people for money out · v1.1 · 2026-10-17 (v1: 2026-10-10, app v2.33)
// Paying a bill, a pay-run line, or any money-out expense above the setting (default KES 0 = every one) is RECORDED by one
// person and then waits: a SECOND signed-in finance person or partner taps ✅ Approve — never the person who recorded it.
// Only then does the bill count it as paid / the pay-run line say Sent. The database enforces this (25_time_savers.sql:
// approve_money, decline_money, guards on expenses, bills and pay_items) — the screens below only make it easy.
// Field techs' receipts are expenses too: they wait for finance to confirm (finance is the second person).
// Before 25 is run, this page says so and everything else works as before (one person).
(function () {
  const Z = window.Z;
  const must = (r) => { if (r.error) throw r.error; return r.data; };
  const getSetting = async () => { try { const { data } = await Z.sb.from('settings').select('value').eq('key', 'money_approval').maybeSingle(); return (data && data.value) || { on: true, over: 0 }; } catch (e) { return { on: true, over: 0 }; } };
  Z.approvalSetting = getSetting;
  const first = (n) => String(n || '').split(' ')[0];

  // How the state shows next to an expense (Money out, My receipts, the pay run).
  Z.approvalPill = (r) => (!r ? '' : r.approval === 'waiting' ? '<span class="pill warn">⏳ waiting for OK</span>'
    : r.approval === 'approved' ? `<span class="pill ok">✅ OK${r.approved_by ? ' · ' + Z.esc(first(r.approved_by)) : ''}</span>` : '');
  const kindOf = (r) => {
    if (r.bill_id) return '📋 Bill payment';
    if (/^Pay run/.test(r.note || '')) return '👤 Pay run';
    const p = Z.ref.people.find((x) => x.id === r.created_by);
    if (p && !(p.role === 'admin' || (p.role === 'internal' && p.dept === 'finance'))) return '🧾 Receipt from ' + first(p.full_name);
    return '✍️ Money out';
  };

  // ---------- Money → 📋 Bills → 👥 Approvals ----------
  Z.moneySubs.push(['approvals', '👥 Approvals']);
  Z.moneyViews.approvals = async (el) => {
    if (!(await Z.ts.ok())) {
      el.innerHTML = '<div class="card" id="ap-setup"><b>One setup step first.</b><p class="hint" style="margin-bottom:0">Two-person approval needs the database file <b>25_time_savers.sql</b> run once in Supabase → SQL Editor (after 22). Until then, payments are recorded by one person, as before.</p></div>';
      return;
    }
    const wk = new Date(Date.now() - 7 * 864e5).toISOString();
    const [rows, recent, st, log] = await Promise.all([
      Z.sb.from('expenses').select('*').eq('approval', 'waiting').order('created_at').limit(300).then(must),
      Z.sb.from('expenses').select('*').eq('approval', 'approved').gte('approved_at', wk).order('approved_at', { ascending: false }).limit(40).then(must),
      getSetting(),
      Z.sb.from('money_approval_log').select('*').neq('action', 'approved').order('at', { ascending: false }).limit(8).then(must).catch(() => []),
    ]);
    const forMe = rows.filter((r) => r.created_by !== Z.me.id), mine = rows.filter((r) => r.created_by === Z.me.id);
    const sum = (a) => a.reduce((t, r) => t + Number(r.amount || 0), 0);
    const item = (r, mode) => `<div class="item ap-item" data-id="${Z.esc(r.id)}" style="flex-wrap:wrap;align-items:flex-start">
        <div class="grow" style="min-width:180px"><div class="t">${Z.esc(r.payee)} ${Z.receiptPill ? Z.receiptPill(r) : ''}</div>
          <div class="m">${Z.esc(kindOf(r))} · ${Z.esc(Z.day(r.date))} · ${Z.esc(Z.areaName(r.area))} · ${Z.esc(r.paid_from || '')}${r.ref ? ' · ' + Z.esc(r.ref) : ' · no code yet'}</div>
          <div class="m">Recorded by ${Z.esc(r.recorded_by || Z.personName(r.created_by) || 'someone')} · ${Z.esc(Z.when(r.created_at))}${mode === 'done' && r.approved_by ? ' · ✅ OK by ' + Z.esc(r.approved_by) + ' ' + Z.esc(Z.when(r.approved_at)) : ''}${r.note && r.note !== 'Bill payment' ? ' · ' + Z.esc(r.note) : ''}</div></div>
        <b class="num">KES ${Z.fmt(r.amount)}</b>
        <div class="row" style="width:100%;justify-content:flex-end">
          ${r.receipt_path && Z.receiptPhoto ? `<button type="button" class="btn sec small ap-photo" data-path="${Z.esc(r.receipt_path)}" data-label="${Z.esc(r.payee)}">📷 Receipt</button>` : ''}
          ${mode === 'forme' ? '<button type="button" class="btn small ap-ok">✅ Approve</button><button type="button" class="btn sec small ap-no">✋ Decline</button>'
            : mode === 'mine' ? '<span class="hint" style="margin:0;align-self:center">🔒 Someone else must approve</span><button type="button" class="btn sec small ap-back">↩ Withdraw</button>'
            : !r.ref && r.paid_from !== 'Cash' ? '<button type="button" class="btn sec small ap-code">＋ Add the code</button>' : ''}
        </div></div>`;
    const switchTo = Z.practice ? (Z.me.id === 'p-jerry' ? ['finance', 'Kelvin'] : ['admin', 'Jerry']) : null;
    el.innerHTML = `
      <div class="card" id="ap-rule" style="border-left:4px solid ${st.on === false ? 'var(--bad)' : 'var(--brand)'}">
        <b>👥 Two people for every payment</b>
        <p class="hint" style="margin:4px 0 0">${st.on === false ? '⚠️ The rule is <b>switched off</b> (Admin → Settings): one person can record and pay alone.'
          : `Money out is recorded by one person and counts only after a <b>second</b> finance person or partner taps ✅ Approve${Number(st.over) > 0 ? ` (payments above KES ${Z.fmt(st.over)})` : ' (every payment)'}. Nobody can approve their own. Ask before you send money — send it after the OK.`}</p>
        ${switchTo ? `<div class="row" style="margin-top:8px"><button type="button" class="btn sec small" id="ap-switch">🎭 Practice: switch to ${switchTo[1]} to approve</button><span class="hint" style="margin:0;align-self:center">In real life this is a second phone and a second login.</span></div>` : ''}
      </div>
      <h3>Waiting for your OK · ${forMe.length}${forMe.length ? ' · KES ' + Z.fmt(sum(forMe)) : ''}</h3>
      <div class="card list" id="ap-forme">${forMe.map((r) => item(r, 'forme')).join('') || '<div class="muted">Nothing is waiting for you. 🎉</div>'}</div>
      <h3>You recorded — waiting for someone else · ${mine.length}</h3>
      <div class="card list" id="ap-mine">${mine.map((r) => item(r, 'mine')).join('') || '<div class="muted">None of yours is waiting.</div>'}</div>
      <h3>Approved this week · ${recent.length}</h3>
      <div class="card list" id="ap-done">${recent.map((r) => item(r, 'done')).join('') || '<div class="muted">Nothing approved in the last 7 days.</div>'}</div>
      ${log.length ? `<h3>Declined or withdrawn</h3><div class="card list" id="ap-log">${log.map((l) => `<div class="item"><div class="grow"><div class="t">${Z.esc((l.row && l.row.payee) || '')} · KES ${Z.fmt(l.row && l.row.amount)}</div><div class="m">${l.action === 'withdrawn' ? '↩ Withdrawn' : '✋ Declined'} by ${Z.esc(Z.personName(l.by) || 'someone')} · ${Z.esc(Z.when(l.at))}${l.reason ? ' · “' + Z.esc(l.reason) + '”' : ''}</div></div></div>`).join('')}</div>` : ''}`;
    const byId = (b) => rows.concat(recent).find((r) => r.id === b.closest('[data-id]').dataset.id);
    Z.$$('.ap-photo', el).forEach((b) => (b.onclick = () => Z.receiptPhoto(b.dataset.path, b.dataset.label)));
    const approve = async (b, r) => {
      b.disabled = true;
      const { error } = await Z.sb.rpc('approve_money', { p_expense: r.id, p_ref: null });
      if (error) { b.disabled = false; return Z.fail(error); }
      Z.toast(`✅ Approved: ${r.payee}, KES ${Z.fmt(r.amount)}${r.bill_id ? ' — the bill now counts it as paid.' : '.'}`); Z.route();
    };
    // v1.1 (17 Oct, Jerry: "warn and ask approve anyway?"): a payment saved as ❌ no receipt asks first. Not blocked —
    // some real costs never get a receipt — but the approver has to choose it on purpose.
    Z.$$('.ap-ok', el).forEach((b) => (b.onclick = () => {
      const r = byId(b);
      if (r.receipt !== 'No — chase it' || r.receipt_path) return approve(b, r);
      const sh = Z.sheet('❌ No receipt', `<p style="margin-top:0"><b>${Z.esc(r.payee)} · KES ${Z.fmt(r.amount)}</b> was saved with <b>no receipt</b>${r.recorded_by ? ' by ' + Z.esc(r.recorded_by) : ''}.</p>
        <p class="hint">Best: ask them to get the receipt from the shop and snap it first. Approve anyway?</p>
        <div class="row"><button type="button" class="btn sec" id="ap-nr-wait">Not now</button><button type="button" class="btn" id="ap-nr-ok">✅ Approve anyway</button></div>`);
      Z.$('#ap-nr-wait', sh.el).onclick = sh.close;
      Z.$('#ap-nr-ok', sh.el).onclick = () => { sh.close(); approve(b, r); };
    }));
    const ask = (r, title, words, btn, rpc, done) => {
      const sh = Z.sheet(title, `<p class="hint" style="margin-top:0">${Z.esc(r.payee)} · KES ${Z.fmt(r.amount)} · recorded by ${Z.esc(r.recorded_by || 'someone')}</p>
        <label>${words}</label><input id="ap-why" maxlength="300" placeholder="e.g. Wrong account number">
        <div style="height:12px"></div><button type="button" class="btn block" id="ap-go">${btn}</button>
        <p class="hint">The request is removed and kept in the log. A bill is not touched (it never counted it); a pay-run line goes back on the list.</p>`);
      Z.$('#ap-go', sh.el).onclick = async () => {
        const { error } = await Z.sb.rpc(rpc, { p_expense: r.id, p_reason: Z.$('#ap-why', sh.el).value.trim() || null });
        if (error) return Z.fail(error);
        sh.close(); Z.toast(done); Z.route();
      };
    };
    Z.$$('.ap-no', el).forEach((b) => (b.onclick = () => ask(byId(b), '✋ Decline this payment?', 'Why? (they will see it)', '✋ Decline it', 'decline_money', 'Declined. The person who recorded it can see why.')));
    Z.$$('.ap-back', el).forEach((b) => (b.onclick = () => ask(byId(b), '↩ Withdraw your request?', 'Why? (optional)', '↩ Withdraw it', 'decline_money', 'Withdrawn.')));
    Z.$$('.ap-code', el).forEach((b) => (b.onclick = () => {
      const r = byId(b);
      const sh = Z.sheet('＋ The M-Pesa / bank code', `<p class="hint" style="margin-top:0">${Z.esc(r.payee)} · KES ${Z.fmt(r.amount)}. Sent it after the OK? Type the code from the message, so the statement matches it.</p>
        <input id="ap-ref" autocapitalize="characters" placeholder="e.g. UJ7K2M9PQR"><div style="height:12px"></div><button type="button" class="btn block" id="ap-save">Save the code</button>`);
      Z.$('#ap-save', sh.el).onclick = async () => {
        const ref = Z.$('#ap-ref', sh.el).value.trim().toUpperCase();
        if (ref.length < 6) return Z.toast('Type the whole code (10 letters and numbers).');
        const { error } = await Z.sb.from('expenses').update({ ref }).eq('id', r.id);
        if (error) return Z.fail(error);
        await Z.sb.from('pay_items').update({ ref_code: ref }).eq('expense_id', r.id).then(() => {}, () => {});
        sh.close(); Z.toast('Code saved.'); Z.route();
      };
    }));
    const sw = Z.$('#ap-switch', el);
    if (sw) sw.onclick = () => { window.ZP.pickRole(switchTo[0]); history.replaceState(null, '', location.pathname + '?practice#money/approvals'); location.reload(); };
  };

  // ---------- Home: "waiting for your OK" (finance and partners) ----------
  Z.approvalsHomeCard = async () => {
    if (!Z.isFinance() || !(await Z.ts.ok())) return '';
    let rows = [];
    try { rows = must(await Z.sb.from('expenses').select('id,amount,created_by').eq('approval', 'waiting').limit(300)); } catch (e) { return ''; }
    const forMe = rows.filter((r) => r.created_by !== Z.me.id), mine = rows.length - forMe.length;
    if (!rows.length) return '';
    const kes = forMe.reduce((t, r) => t + Number(r.amount || 0), 0);
    return `<a class="card" id="h-appr" href="#money/approvals" style="display:block;text-decoration:none;color:inherit;border-left:4px solid var(--warn)">
      <div class="row" style="justify-content:space-between"><b>👥 ${forMe.length ? `${forMe.length} payment${forMe.length > 1 ? 's' : ''} waiting for your OK` : 'Your payments are waiting for someone else'}</b><span class="pill warn">⏳</span></div>
      <p style="margin:6px 0 0">${forMe.length ? `KES ${Z.fmt(kes)} — recorded by someone else; they count only after a second person approves. Open →` : ''}${mine ? ` ${mine} you recorded wait${mine === 1 ? 's' : ''} for another finance person or partner.` : ''}</p></a>`;
  };

  // ---------- Admin → Settings: the switch and the amount ----------
  if (Z.adminViews && Z.adminViews.settings) {
    const before = Z.adminViews.settings;
    Z.adminViews.settings = async (el) => {
      await before(el);
      if (!(await Z.ts.ok())) {
        el.insertAdjacentHTML('beforeend', '<div class="card" id="st-appr-card"><b>👥 Two people for money out</b><p class="hint" style="margin-bottom:0">Needs <b>25_time_savers.sql</b> run once in Supabase. Until then one person records and pays, as before.</p></div>');
        return;
      }
      const st = await getSetting();
      const on = st.on !== false;
      el.insertAdjacentHTML('beforeend', `<div class="card" id="st-appr-card">
        <b style="font-size:17px">👥 Two people for money out</b>
        <p class="hint">When <b>On</b>, every bill payment, pay-run payment and money-out expense above the amount below is recorded by one person and counts only after a <b>second</b> signed-in finance person or partner approves it — never the one who recorded it. The database enforces it, not just the app. Field techs' receipts wait for finance to confirm.</p>
        <div class="seg" id="st-appr" role="group" aria-label="Two people for money out">
          <button type="button" data-v="on" class="${on ? 'on' : ''}">On — two people</button>
          <button type="button" data-v="off" class="${on ? '' : 'on'}">Off — one is enough</button>
        </div>
        <label for="st-appr-over">Needs a second person above (KES)</label>
        <div class="row"><input id="st-appr-over" inputmode="numeric" value="${Z.esc(st.over || 0)}" style="flex:1"><button type="button" class="btn sec" id="st-appr-save">Save</button></div>
        <p class="hint">0 = every payment (recommended). ${st.by ? `Last changed by ${Z.esc(st.by)}${st.at ? ' · ' + Z.esc(Z.when(st.at)) : ''}.` : ''}</p>
        ${on ? '' : '<div class="alert bad">⚠️ Off: one person can record and pay alone. Use it only while you are the only person with an account — switch it back On when Kelvin has his.</div>'}
      </div>`);
      const save = async (val) => {
        const { error } = await Z.sb.from('settings').upsert({ key: 'money_approval', value: { ...val, by: Z.me.full_name, at: new Date().toISOString() } }, { onConflict: 'key' });
        if (error) return Z.fail(error);
        Z.toast(val.on ? `👥 Two people for money out: ON${Number(val.over) > 0 ? ' above KES ' + Z.fmt(val.over) : ''}.` : '⚠️ Two-person approval is OFF.'); Z.route();
      };
      Z.$$('#st-appr [data-v]', el).forEach((b) => (b.onclick = () => save({ on: b.dataset.v === 'on', over: Number(st.over) || 0 })));
      Z.$('#st-appr-save', el).onclick = () => { const v = Z.num(Z.$('#st-appr-over', el).value); if (v == null || v < 0) return Z.toast('Type an amount (0 = every payment).'); save({ on, over: v }); };
    };
  }
})();
