// Zuri System · 📈 Projects — the money maths (no screens, no database) · v1 · 2026-10-12 (app v2.34)
// One plan in → month-by-month numbers out. Used by projects.js, the practice samples and the tests
// (tools/planner_tests.js runs these with jsc). Pure functions only: safe with empty, zero or negative inputs.
//
// The model, in plain words:
//   Month 0 = before launch: the start-up money goes out (and a loan, if any, comes in).
//   Month 1 = the launch month. Each month: customers × monthly bill + install fees − running costs − routers − loan payment.
//   Customers: the plan says how many SIGN UP by month 1/3/6/12/24 (or "X% of homes passed by month N"). Each month a
//   share leaves (churn). After the last planned month the team keeps selling just enough to replace leavers.
//   Break-even = the first month from which the monthly profit stays above zero.
//   Payback    = the first month from which the cumulative cash stays at or above zero (start-up money recovered).
//   ROI        = cash at the end of the period ÷ start-up cost (net gain per shilling spent on start-up).
(function (root) {
  const N = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
  const P = (v) => Math.max(0, N(v)); // never negative (a typo like "-5 km" must not create money)
  const HORIZON = 120; // payback / break-even are searched over 10 years, whatever the table shows

  const START_LINES = [
    ['fiber', 'Fiber cable'], ['poles', 'Poles & ducting'], ['olt', 'OLT & core equipment'], ['labour', 'Labour'],
    ['permits', 'Permits & wayleaves'], ['office', 'Office / shop setup'], ['launch', 'Launch marketing'],
  ];
  const RUN_LINES = [
    ['backhaul', 'Backhaul / bandwidth'], ['staff', 'Staff'], ['rent', 'Rent'], ['power', 'Power / generator fuel'],
    ['transport', 'Transport'], ['marketing', 'Marketing'], ['maint', 'Maintenance'],
  ];

  function blank() {
    return {
      v: 1,
      start: { fiber_km: 0, fiber_rate: 0, poles: 0, olt: 0, labour: 0, permits: 0, office: 0, launch: 0, cont_pct: 10, other: [] },
      cpe: { each: 0, who: 'zuri' },
      run: { backhaul: 0, backhaul_preset: '', staff_n: 0, salary: 0, rent: 0, power: 0, transport: 0, maint_pct: 0, marketing: 0, other: [] },
      rev: { homes: 0, mode: 'curve', c1: 0, c3: 0, c6: 0, c12: 0, c24: 0, pct: 0, pct_month: 12, arpu: 0, install_fee: 0, churn_pct: 0, price_pct: 0, price_month: 0 },
      loan: { on: false, amount: 0, rate: 0, months: 0 },
    };
  }
  // Fill any missing part from a blank plan (older saves, half-typed forms).
  function norm(p) {
    const b = blank(); p = p && typeof p === 'object' ? p : {};
    const out = {};
    Object.keys(b).forEach((k) => { out[k] = typeof b[k] === 'object' ? Object.assign({}, b[k], p[k] && typeof p[k] === 'object' ? p[k] : {}) : (p[k] != null ? p[k] : b[k]); });
    out.start.other = Array.isArray(out.start.other) ? out.start.other : [];
    out.run.other = Array.isArray(out.run.other) ? out.run.other : [];
    return out;
  }

  function startup(p) {
    p = norm(p); const s = p.start;
    const lines = [
      ['fiber', 'Fiber cable', P(s.fiber_km) * P(s.fiber_rate), P(s.fiber_km) && P(s.fiber_rate) ? `${P(s.fiber_km)} km × KES ${Math.round(P(s.fiber_rate)).toLocaleString('en-KE')}` : ''],
      ['poles', 'Poles & ducting', P(s.poles)], ['olt', 'OLT & core equipment', P(s.olt)], ['labour', 'Labour', P(s.labour)],
      ['permits', 'Permits & wayleaves', P(s.permits)], ['office', 'Office / shop setup', P(s.office)], ['launch', 'Launch marketing', P(s.launch)],
    ].map(([k, label, amount, how]) => ({ k, label, amount, how: how || '' }));
    s.other.forEach((o, i) => lines.push({ k: 'other' + i, label: String((o && o.label) || 'Other'), amount: P(o && o.amount), how: '' }));
    const subtotal = lines.reduce((t, l) => t + l.amount, 0);
    const contingency = subtotal * Math.min(100, P(s.cont_pct)) / 100;
    return { lines, subtotal, contingency, total: subtotal + contingency };
  }

  function running(p, startTotal) {
    p = norm(p); const r = p.run;
    if (startTotal == null) startTotal = startup(p).total;
    const lines = [
      { k: 'backhaul', label: 'Backhaul / bandwidth', amount: P(r.backhaul) },
      { k: 'staff', label: 'Staff', amount: P(r.staff_n) * P(r.salary), how: P(r.staff_n) ? `${P(r.staff_n)} × KES ${Math.round(P(r.salary)).toLocaleString('en-KE')}` : '' },
      { k: 'rent', label: 'Rent', amount: P(r.rent) }, { k: 'power', label: 'Power / generator fuel', amount: P(r.power) },
      { k: 'transport', label: 'Transport', amount: P(r.transport) }, { k: 'marketing', label: 'Marketing', amount: P(r.marketing) },
      { k: 'maint', label: 'Maintenance', amount: startTotal * Math.min(100, P(r.maint_pct)) / 100 / 12, how: P(r.maint_pct) ? `${P(r.maint_pct)}% of start-up a year` : '' },
    ];
    r.other.forEach((o, i) => lines.push({ k: 'other' + i, label: String((o && o.label) || 'Other'), amount: P(o && o.amount) }));
    return { lines, total: lines.reduce((t, l) => t + l.amount, 0) };
  }

  // Equal monthly payments (interest per year, %). 0% → amount ÷ months.
  function loanPayment(amount, ratePct, months) {
    const A = P(amount), n = Math.round(P(months)), i = P(ratePct) / 100 / 12;
    if (!A || !n) return 0;
    if (!i) return A / n;
    return A * i / (1 - Math.pow(1 + i, -n));
  }

  // Planned sign-ups by month m (before anyone leaves), and the last planned month.
  function signupPlan(p) {
    const r = norm(p).rev;
    if (r.mode === 'pct') {
      const target = P(r.homes) * Math.min(100, P(r.pct)) / 100, Nm = Math.max(1, Math.round(P(r.pct_month)) || 1);
      return { at: (m) => target * Math.min(m, Nm) / Nm, last: Nm };
    }
    // the points must not go down: a later number smaller than an earlier one is read as "no new sign-ups"
    const pts = [[0, 0]]; let hi = 0;
    [[1, r.c1], [3, r.c3], [6, r.c6], [12, r.c12], [24, r.c24]].forEach(([m, v]) => { hi = Math.max(hi, P(v)); pts.push([m, hi]); });
    return {
      at: (m) => {
        if (m >= 24) return pts[5][1];
        for (let k = 1; k < pts.length; k++) if (m <= pts[k][0]) { const [m0, v0] = pts[k - 1], [m1, v1] = pts[k]; return v0 + (v1 - v0) * (m - m0) / (m1 - m0); }
        return hi;
      },
      last: 24,
    };
  }

  // The month-by-month model. o.takeup / o.arpu scale sign-ups and the monthly bill (what-ifs).
  function model(plan, o = {}) {
    const p = norm(plan), r = p.rev;
    const f = o.takeup == null ? 1 : P(o.takeup), af = o.arpu == null ? 1 : P(o.arpu);
    const months = Math.max(HORIZON, Math.round(P(o.months)) || 0);
    const st = startup(p), run = running(p, st.total);
    const plan0 = signupPlan(p);
    const churn = Math.min(100, P(r.churn_pct)) / 100;
    const cap = P(r.homes) > 0 ? P(r.homes) : Infinity;
    const loanOn = !!p.loan.on && P(p.loan.amount) > 0;
    const loanAmt = loanOn ? P(p.loan.amount) : 0;
    const pay = loanOn ? loanPayment(loanAmt, p.loan.rate, p.loan.months) : 0;
    const loanN = loanOn ? Math.round(P(p.loan.months)) : 0;
    const cpe = p.cpe.who === 'customer' ? 0 : P(p.cpe.each);
    const priceM = Math.round(P(r.price_month)), priceF = 1 + N(r.price_pct) / 100;
    const rows = [];
    let cust = 0, cum = -st.total + loanAmt;
    const cum0 = cum;
    for (let m = 1; m <= months; m++) {
      const leavers = cust * churn;
      const planned = m <= plan0.last ? Math.max(0, plan0.at(m) - plan0.at(m - 1)) * f : leavers; // after the plan: replace leavers
      const next = Math.min(cap, Math.max(0, cust - leavers + planned));
      const signups = Math.max(0, next - (cust - leavers));
      cust = next;
      const arpu = P(r.arpu) * af * (priceM && m >= priceM ? Math.max(0, priceF) : 1);
      const subs = cust * arpu, install = signups * P(r.install_fee);
      const routers = signups * cpe;
      const loan = loanOn && m <= loanN ? pay : 0;
      const revenue = subs + install, costs = run.total + routers + loan;
      const profit = revenue - costs;
      cum += profit;
      rows.push({ m, signups, leavers, customers: cust, arpu, subs, install, revenue, running: run.total, routers, loan, costs, profit, cum });
    }
    const iM = loanOn ? P(p.loan.rate) / 100 / 12 : 0;
    // what is still owed on the loan after m monthly payments
    const loanLeft = (m) => { if (!loanOn) return 0; const k = Math.min(Math.max(0, m), loanN); if (!iM) return Math.max(0, loanAmt - pay * k); const g = Math.pow(1 + iM, k); return Math.max(0, loanAmt * g - pay * (g - 1) / iM); };
    return finish({ startup: st.total, start: st, run, loanAmt, loanPay: pay, loanN, cum0, rows, loanLeft, own: Math.max(0, st.total - loanAmt) });
  }

  // Break-even, payback, lowest point — from a list of monthly profits and the starting cash (cum0).
  function finish(res) {
    const rows = res.rows, n = rows.length;
    let be = null;
    for (let k = n - 1; k >= 0; k--) { if (rows[k].profit > 0.0001) be = rows[k].m; else break; }
    let pb = null;
    if (n && rows[n - 1].cum >= -0.0001) {
      pb = 0;
      for (let k = n - 1; k >= 0; k--) { if (rows[k].cum < -0.0001) { pb = rows[k].m + 1; break; } }
      if (pb === 0 && res.cum0 < -0.0001) pb = 1;
    }
    let low = { m: 0, v: res.cum0 };
    rows.forEach((x) => { if (x.cum < low.v) low = { m: x.m, v: x.cum }; });
    res.breakEven = be; res.payback = pb; res.low = low;
    res.profitN = (k) => rows.slice(0, k).reduce((t, x) => t + x.profit, 0);
    res.cashN = (k) => (k <= 0 ? res.cum0 : (rows[Math.min(k, n) - 1] || { cum: res.cum0 }).cum);
    res.roi = (k) => (res.startup > 0 ? (res.cashN(k) / res.startup) * 100 : null);
    return res;
  }

  // The what-if grid: payback for take-up Low/Expected/High × monthly bill −10% / as planned / +10%.
  function whatIfs(plan, takeups = [0.7, 1, 1.3], arpus = [0.9, 1, 1.1]) {
    return takeups.map((t) => arpus.map((a) => { const r = model(plan, { takeup: t, arpu: a }); return { t, a, payback: r.payback, breakEven: r.breakEven, cash36: r.cashN(36) }; }));
  }

  // ---------- after Go: actuals so far + the current forecast for the rest ----------
  // actual = { start0: start-up spent before launch, months: [{m, customers|null, revenue, costs, startup}] } for months 1..K.
  // costs = running costs actually paid; startup = start-up money spent that month (late invoices). The forecast's loan is used.
  function track(baseline, forecast, actual) {
    const B = model(baseline), F = model(forecast);
    const K = actual.months.length;
    const loanAmt = F.loanAmt;
    let cum = -P(actual.start0) + loanAmt;
    const cum0 = cum;
    const rows = actual.months.map((a, i) => {
      const m = i + 1, loan = F.loanN && m <= F.loanN ? F.loanPay : 0;
      const profit = N(a.revenue) - N(a.costs) - N(a.startup) - loan;
      cum += profit;
      return { m, customers: a.customers, revenue: N(a.revenue), costs: N(a.costs) + N(a.startup) + loan, profit, cum, loan };
    });
    const joined = rows.concat(F.rows.slice(K).map((x) => ({ m: x.m, customers: x.customers, revenue: x.revenue, costs: x.costs, profit: x.profit, cum: 0, future: true })));
    let c = K ? rows[K - 1].cum : cum0;
    joined.forEach((x) => { if (x.future) { c += x.profit; x.cum = c; } });
    const J = finish({ startup: F.startup, cum0, rows: joined });
    const bK = K ? B.rows[K - 1].cum : B.cum0, aK = K ? rows[K - 1].cum : cum0;
    const scale = Math.max(1, B.startup);
    const diff = aK - bK;
    const state = diff > scale * 0.05 ? 'ahead' : diff < -scale * 0.15 ? 'red' : diff < -scale * 0.05 ? 'behind' : 'on track';
    return { B, F, J, rows, K, diff, state, actualStart: P(actual.start0) + rows.reduce((t, x, i) => t + N(actual.months[i].startup), 0) };
  }

  // Variance colour: is "actual vs plan" good, a worry, or bad? higherBetter=false for costs.
  function rag(actual, plan, higherBetter = true, scale) {
    if (actual == null || plan == null) return '';
    const base = Math.max(1, Math.abs(scale != null ? scale : plan));
    const worse = (higherBetter ? plan - actual : actual - plan) / base;
    return worse <= 0.05 ? 'ok' : worse <= 0.15 ? 'warn' : 'bad';
  }

  // What changed between two plans: [{path, label, from, to}] — for the revision log.
  function diff(a, b) {
    a = norm(a); b = norm(b);
    const L = { fiber_km: 'Fiber km', fiber_rate: 'Fiber KES per km', poles: 'Poles & ducting', olt: 'OLT & core', labour: 'Labour', permits: 'Permits & wayleaves', office: 'Office / shop', launch: 'Launch marketing', cont_pct: 'Contingency %',
      each: 'Router per customer', who: 'Who pays the router', backhaul: 'Backhaul a month', backhaul_preset: 'Backhaul choice', staff_n: 'Staff (people)', salary: 'Salary each', rent: 'Rent', power: 'Power / fuel', transport: 'Transport', maint_pct: 'Maintenance %', marketing: 'Marketing a month',
      homes: 'Homes passed', mode: 'Take-up way', c1: 'Sign-ups by month 1', c3: 'Sign-ups by month 3', c6: 'Sign-ups by month 6', c12: 'Sign-ups by month 12', c24: 'Sign-ups by month 24', pct: 'Take-up %', pct_month: 'Take-up reached by month',
      arpu: 'Monthly bill (ARPU)', install_fee: 'Install fee', churn_pct: 'Leaving % a month', price_pct: 'Price change %', price_month: 'Price change from month', on: 'Loan', amount: 'Loan amount', rate: 'Loan interest %', months: 'Loan months' };
    const out = [];
    Object.keys(a).forEach((sec) => {
      if (typeof a[sec] !== 'object') return;
      Object.keys(Object.assign({}, a[sec], b[sec])).forEach((k) => {
        const x = a[sec][k], y = b[sec][k];
        if (k === 'other') { const sx = JSON.stringify(x || []), sy = JSON.stringify(y || []); if (sx !== sy) out.push({ path: sec + '.other', label: sec === 'start' ? 'Other start-up lines' : 'Other monthly costs', from: (x || []).map((o) => `${o.label} ${o.amount}`).join(', '), to: (y || []).map((o) => `${o.label} ${o.amount}`).join(', ') }); return; }
        if (String(x ?? '') !== String(y ?? '')) out.push({ path: sec + '.' + k, label: L[k] || k, from: x, to: y });
      });
    });
    return out;
  }

  // Calendar helpers: project month m ↔ 'YYYY-MM' (month 1 = the launch month).
  const ymAdd = (ym, k) => { const [y, mo] = String(ym).split('-').map(Number); const d = new Date(y, mo - 1 + k, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const monthIndex = (launchYm, ym) => { const [y0, m0] = String(launchYm).split('-').map(Number), [y1, m1] = String(ym).split('-').map(Number); return (y1 - y0) * 12 + (m1 - m0) + 1; };

  root.ZPlan = { blank, norm, startup, running, loanPayment, signupPlan, model, finish, whatIfs, track, rag, diff, ymAdd, monthIndex, START_LINES, RUN_LINES, HORIZON };
})(typeof window !== 'undefined' ? window : this);
