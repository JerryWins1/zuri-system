// Zuri System · PRACTICE MODE: the whole app on pretend data, on this phone only · v1 · 2026-09-30
// Loaded instead of the real database when the address has ?practice. Nothing here is sent anywhere.
// Anyone can pick a role (no account), try every screen, make mistakes, and start over.
(function () {
  const KEY = 'zuri_practice_db_v1', ROLE_KEY = 'zuri_practice_role';
  const DAY = 864e5;
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => ymd(new Date());
  const dayOff = (n) => ymd(new Date(Date.now() + n * DAY));
  const tsOff = (n, h = 10) => { const d = new Date(Date.now() + n * DAY); d.setHours(h, 0, 0, 0); return d.toISOString(); };
  const ym = () => today().slice(0, 7);
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'p' + Math.random().toString(16).slice(2) + Date.now().toString(16));
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  // ---------- the pretend company ----------
  const PEOPLE = [
    { id: 'p-jerry', full_name: 'Jerry (owner)', role: 'admin', dept: null, area: null, phone: '0700100100' },
    { id: 'p-kelvin', full_name: 'Kelvin', role: 'internal', dept: 'finance', area: null, phone: '0700200200' },
    { id: 'p-dickson', full_name: 'Dickson', role: 'internal', dept: 'technical', area: null, phone: '0700300300' },
    { id: 'p-mary', full_name: 'Mary Wanjiku', role: 'callcenter', dept: null, area: null, phone: '0711400400' },
    { id: 'p-peter', full_name: 'Peter Kamau', role: 'field', dept: null, area: 'A', phone: '0722500500' },
    { id: 'p-brian', full_name: 'Brian Otieno', role: 'field', dept: null, area: 'A', phone: '0733600600' },
    { id: 'p-faith', full_name: 'Faith Achieng', role: 'field', dept: null, area: 'B', phone: '0744700700' },
  ];
  const ROLES = {
    admin: { id: 'p-jerry', label: '⭐ Partner / admin', who: 'Jerry', does: 'Set up staff and areas · sees everything' },
    finance: { id: 'p-kelvin', label: '💰 Finance', who: 'Kelvin', does: 'Cash, bills, statements, the Friday report' },
    technical: { id: 'p-dickson', label: '🔧 Technical office', who: 'Dickson', does: 'Jobs, customers, sending techs out' },
    callcenter: { id: 'p-mary', label: '📞 Call center', who: 'Mary', does: 'Customer calls, new jobs, payment calls' },
    field: { id: 'p-peter', label: '🛠️ Field tech', who: 'Peter', does: 'Jobs at customers\' houses' },
  };
  // Every fresh open starts at "who are you today?" — practice is for trying different jobs.
  // (A training video switching person keeps its choice, so it can carry on playing.)
  try {
    if (!sessionStorage.getItem('zp_open') && !localStorage.getItem('zuri_learn_autoplay')) {
      const last = localStorage.getItem(ROLE_KEY); if (last) localStorage.setItem('zuri_practice_last', last);
      localStorage.removeItem(ROLE_KEY);
    }
    sessionStorage.setItem('zp_open', '1');
  } catch (e) { /* storage blocked: the picker shows anyway */ }
  const FIRST = ['Grace', 'John', 'Mercy', 'Joseph', 'Faith', 'Samuel', 'Esther', 'David', 'Lucy', 'Peter', 'Ann', 'James', 'Mary', 'Daniel', 'Ruth', 'Paul', 'Jane', 'Stephen', 'Naomi', 'Moses', 'Susan', 'Isaac', 'Purity', 'Kevin', 'Beatrice'];
  const LAST = ['Njeri', 'Mwangi', 'Wanjiru', 'Kariuki', 'Otieno', 'Chebet', 'Mutua', 'Wambui', 'Kamau', 'Achieng', 'Kiprono', 'Nyambura', 'Odhiambo', 'Gitau', 'Muthoni', 'Kibet', 'Atieno', 'Ndungu', 'Wairimu', 'Omondi'];
  const PLACES = ['Behind the Total petrol station', 'Near Maai Mahiu market', 'Opposite St. Mary\'s church', 'Satellite estate, blue gate', 'Near the matatu stage', 'Kamuyu road, after the posho mill', 'Next to the primary school', 'Above the M-Pesa shop', 'Green house near the water tank', 'Off the old Naivasha road', 'Near the health centre', 'Behind the police post'];
  const PLANS = [['5 Mbps', 1500], ['10 Mbps', 2000], ['10 Mbps', 2000], ['20 Mbps', 3000], ['20 Mbps', 3000], ['30 Mbps Business', 4500]];

  // mode 'empty': a brand-new company — only the areas, the seed lists and the staff. You enter everything else.
  function build(mode) {
    seed = 7;
    const D = {};
    D._mode = mode || 'running';
    D.areas = [{ code: 'A', name: 'Zuri A', float_target: 50000, active: true }, { code: 'B', name: 'Zuri B', float_target: 30000, active: true }, { code: 'C', name: 'Zuri C (coming)', float_target: 30000, active: false }];
    D.profiles = PEOPLE.map((p) => ({ ...p, active: true, created_at: tsOff(-60) }))
      .concat([{ id: 'p-samuel', full_name: 'Samuel Kiprono', role: 'field', dept: null, area: null, phone: '0755800800', active: false, created_at: tsOff(-1) }]);
    D.field_visibility = [{ entity: 'customer', field: 'national_id', role: 'field', can_see: false }, { entity: 'customer', field: 'monthly_rate', role: 'field', can_see: true }];
    D.custom_field_defs = [{ id: 'cf1', entity: 'customer', key: 'router_model', label: 'Router model', kind: 'choice', choices: ['Huawei HG8145', 'ZTE F660', 'TP-Link'], sort: 1 }];

    // customers: most pay on time, some ran out (the follow-ups), a few with no pin
    D.v_customers = [];
    for (let i = 0; i < 46; i++) {
      const [plan, rate] = pick(PLANS);
      const area = i < 34 ? 'A' : 'B';
      const late = i % 7 === 3 || i % 11 === 5;
      const off = late ? -(2 + Math.floor(rnd() * 15)) : 1 + Math.floor(rnd() * 28);
      const status = i === 40 || i === 41 ? 'disconnected' : i === 44 || i === 45 ? 'lead' : 'active';
      D.v_customers.push({
        id: 'c' + (i + 1), full_name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
        phone: '07' + String(10000000 + Math.floor(rnd() * 89999999)).slice(0, 8), phone2: null, email: null, national_id: String(20000000 + i * 37171),
        area, landmark: pick(PLACES), lat: i % 5 === 2 ? null : -0.996 + rnd() * 0.022, lng: i % 5 === 2 ? null : 36.575 + rnd() * 0.03, /* around Maai Mahiu town */
        status, account_no: `Z${area}-${String(101 + i).padStart(4, '0')}`, plan: status === 'lead' ? null : plan, monthly_rate: status === 'lead' ? null : rate,
        billnasi_id: status === 'lead' ? null : String(5000 + i), install_date: status === 'lead' ? null : dayOff(-200 + i * 3),
        paid_until: status === 'active' ? tsOff(off, 23) : status === 'disconnected' ? tsOff(-70) : null,
        billing_status: null, notes: null, custom: { router_model: pick(['Huawei HG8145', 'ZTE F660']) }, created_at: tsOff(-200), updated_at: tsOff(-1),
      });
    }
    D.v_customers[0] = { ...D.v_customers[0], full_name: 'Grace Njeri', paid_until: tsOff(-9, 23), landmark: 'Behind the Total petrol station', lat: null, lng: null };
    D.v_customers[1] = { ...D.v_customers[1], full_name: 'John Mwangi', paid_until: tsOff(12, 23), landmark: 'Near Maai Mahiu market' };
    const cust = (id) => D.v_customers.find((c) => c.id === id);

    // payments this month for customers who renewed
    D.payments = [];
    D.v_customers.filter((c) => c.status === 'active' && new Date(c.paid_until) > new Date()).forEach((c, i) => {
      if (i % 3 === 0) return; // renew later this month
      D.payments.push({ id: uuid(), source: 'billnasi', date: dayOff(-(1 + (i % 20))), amount: c.monthly_rate, method: 'mpesa', mpesa_ref: 'UJ' + (100000 + i * 7919).toString(36).toUpperCase().padStart(8, 'X'), payer_name: c.full_name, payer_phone: c.phone, account_ref: c.account_no, customer_id: c.id, area: c.area });
    });

    // jobs
    let no = 100;
    const T = (o) => ({ id: uuid(), ticket_no: ++no, opened_by: 'p-mary', opened_at: tsOff(-1, 9), priority: 'normal', status: 'open', scheduled_for: today(), findings: null, work_done: null, amount_collected: 0, collection_method: null, collection_ref: null, closed_at: null, site_lat: null, site_lng: null, caller: null, assigned_to: null, ...o });
    D.tickets = [
      T({ customer_id: 'c2', area: 'A', kind: 'fault', priority: 'urgent', status: 'assigned', assigned_to: 'p-peter', summary: 'No internet since morning — router light is red' }),
      T({ customer_id: 'c6', area: 'A', kind: 'fault', status: 'assigned', assigned_to: 'p-peter', summary: 'Internet very slow in the evening' }),
      T({ customer_id: 'c9', area: 'A', kind: 'relocation', status: 'assigned', assigned_to: 'p-peter', scheduled_for: dayOff(2), summary: 'Move router from the house to the new shop next door' }),
      T({ customer_id: 'c13', area: 'A', kind: 'fault', status: 'assigned', assigned_to: 'p-brian', summary: 'Cable cut by the road works' }),
      T({ customer_id: null, caller: 'Wanjiku, 0712 345 678', area: 'A', kind: 'install', status: 'open', scheduled_for: dayOff(1), summary: 'New install enquiry — wants 10 Mbps for a salon' }),
      T({ customer_id: 'c37', area: 'B', kind: 'fault', status: 'assigned', assigned_to: 'p-faith', scheduled_for: dayOff(-2), summary: 'Router keeps restarting' }),
      T({ customer_id: 'c3', area: 'A', kind: 'fault', status: 'done', assigned_to: 'p-peter', opened_at: tsOff(-6), closed_at: tsOff(-5), scheduled_for: dayOff(-6), summary: 'No internet', findings: 'Bad connector', work_done: 'Replaced connector · Tested — working', amount_collected: 0 }),
      T({ customer_id: 'c8', area: 'A', kind: 'install', status: 'done', assigned_to: 'p-brian', opened_at: tsOff(-10), closed_at: tsOff(-8), scheduled_for: dayOff(-9), summary: 'New install', work_done: 'Ran new cable · Tested — working', amount_collected: 3500, collection_method: 'mpesa', collection_ref: 'UJ8KD02MXQ' }),
    ];
    // payment follow-ups for customers whose time ran out
    D.v_customers.filter((c) => c.status === 'active' && new Date(c.paid_until) < new Date()).forEach((c) => {
      D.tickets.push(T({ customer_id: c.id, area: c.area, kind: 'billing', opened_by: null, status: 'open', opened_at: c.paid_until, scheduled_for: today(),
        priority: (Date.now() - new Date(c.paid_until)) / DAY > 7 ? 'urgent' : 'normal', summary: `Package ran out ${Math.round((Date.now() - new Date(c.paid_until)) / DAY)} days ago — call to renew (KES ${c.monthly_rate})` }));
    });
    D.ticket_events = D.tickets.filter((t) => t.status === 'done').map((t) => ({ id: uuid(), ticket_id: t.id, by: t.assigned_to, kind: 'status', body: 'Job done', at: t.closed_at }));
    D.ticket_parts = [{ id: uuid(), ticket_id: D.tickets[7].id, item: 'ONT router (Huawei)', serial: 'HW48575443A1', qty: 1, added_by: 'p-brian', added_at: tsOff(-8) }];

    // tasks the manager wrote, and some people wrote for each other
    const K = (o) => ({ id: uuid(), details: null, assigned_to: null, assigned_group: null, created_by: null, source: 'agent', kind: 'todo', priority: 'normal', due_date: today(), status: 'open', visibility: 'team', link_type: null, link_ref: null, ref_key: null, opened_at: tsOff(-1, 6), updated_at: tsOff(-1, 6), escalation_level: 0, ...o });
    const lateN = D.tickets.filter((t) => t.kind === 'billing').length;
    D.tasks = [
      K({ title: 'Do this week\'s cash count (bank + M-Pesa)', assigned_group: 'finance', visibility: 'finance', priority: 'high', link_type: 'page', link_ref: 'money/count', details: 'Look at the bank app and the M-Pesa account and type both balances. The cash forecast starts from this number.' }),
      K({ title: 'Pay KPLC prepaid before the 20th', assigned_group: 'finance', visibility: 'finance', link_type: 'page', link_ref: 'money/bills' }),
      K({ title: 'Sort 12 bank / M-Pesa transactions', assigned_group: 'finance', visibility: 'finance', link_type: 'page', link_ref: 'money/sort', priority: 'low' }),
      K({ title: `Call ${lateN} customers whose internet ran out — urgent ones first`, assigned_group: 'callcenter', visibility: 'office', priority: 'high', link_type: 'page', link_ref: 'jobs', details: 'Each one is a Payment follow-up job. Tap what happened after each call.' }),
      K({ title: 'Drop map pins for 8 customers with no pin', assigned_group: 'technical', link_type: 'page', link_ref: 'customers', priority: 'low' }),
      K({ title: 'Check the splitter box at the market', assigned_to: 'p-peter', source: 'person', created_by: 'p-dickson', details: 'Two customers near the market say it is slow at night.', due_date: dayOff(1) }),
      K({ title: 'Send me the Friday report by 4pm', assigned_to: 'p-kelvin', source: 'person', created_by: 'p-jerry', visibility: 'finance', due_date: dayOff(2) }),
      K({ title: 'Bring 2 spare routers to Zuri B', assigned_to: 'p-faith', source: 'person', created_by: 'p-dickson', due_date: dayOff(3), priority: 'low' }),
    ];
    D.task_comments = [{ id: uuid(), task_id: D.tasks[5].id, by: 'p-dickson', body: 'Take the light meter.', at: tsOff(-1, 8), from_agent: false }];
    D.agent_runs = [{ id: uuid(), mode: 'morning', window_key: 'morning:' + today(), started_at: tsOff(0, 6), status: 'done', used_ai: true,
      warnings: [{ level: 'bad', text: `${lateN} customers ran out of paid time — about KES ${Math.round(lateN * 2400 / 1000)}k a month waiting. The urgent ones are over a week late; call them first.` },
        { level: 'warn', text: 'Zuri B M-Pesa float is below its 30,000 target. Top up before the weekend.' }],
      stats: { rules: 9, new_tasks: 5, closed: 2, escalated: 0, nudges: 4 } }];
    D.nudges = PEOPLE.filter((p) => p.phone && p.role !== 'admin').slice(0, 4).map((p) => ({ id: uuid(), day: new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10) /* Kenya's day */, profile_id: p.id, phone: p.phone, sent_at: null,
      message: `Good morning ${p.full_name.split(' ')[0]} 👋\nYour Zuri list today:\n${D.tasks.filter((t) => t.assigned_to === p.id || (t.assigned_group === ({ field: 'field', callcenter: 'callcenter', internal: p.dept }[p.role]))).slice(0, 3).map((t) => '• ' + t.title).join('\n') || '• Check your jobs'}\nOpen Zuri → Tasks` }));

    // money
    const m = ym();
    D.bills = [
      ['A', 'Safaricom backhaul', 45000, 45000, 5, 'Internet / backhaul'], ['A', 'Office rent', 15000, 15000, 1, 'Rent'], ['A', 'KPLC prepaid', 3500, 0, new Date().getDate(), 'Power'] /* always due today, so the Pay run has something to show */,
      ['A', 'Staff transport', 6000, 2000, 25, 'Transport'], ['B', 'Bayobab backhaul', 28000, 0, 10, 'Internet / backhaul'], ['B', 'Pole rent', 4000, 0, 28, 'Rent'],
    ].map(([area, name, amount, paid_amount, due_day, category]) => ({ id: uuid(), area, month: m, name, amount, paid_amount, paid: paid_amount >= amount, due_day, category, paid_date: paid_amount ? dayOff(-3) : null,
      pay_to: /KPLC/.test(name) ? 'Paybill 888880 · Acc 54123456' : /Safaricom|Bayobab/.test(name) ? 'Paybill 100100 · Acc ZF-' + area : /rent/i.test(name) ? '0711 222 333' : null }));
    D.cash_counts = [
      { id: uuid(), area: 'A', date: dayOff(-3), bank: 182000, mpesa: 41000, counted_by: 'Kelvin', note: null, created_at: tsOff(-3) },
      { id: uuid(), area: 'B', date: dayOff(-3), bank: 64000, mpesa: 21000, counted_by: 'Kelvin', note: null, created_at: tsOff(-3) },
    ];
    D.expenses = [
      { id: uuid(), area: 'A', date: dayOff(-3), payee: 'Safaricom backhaul', category: 'Internet / backhaul', amount: 45000, paid_from: 'Bank', ref: 'FT26273XK', approved_by: 'Pre-approved (bill)', receipt: 'Digital / M-Pesa msg', note: 'Bill payment', recorded_by: 'Kelvin', vat_amount: 0, supplier_pin: null },
      { id: uuid(), area: 'A', date: dayOff(-2), payee: 'Mama Njeri Hardware', category: 'Materials', amount: 2400, paid_from: 'Cash', ref: null, approved_by: 'Dickson', receipt: 'No — chase it', note: 'Cable clips', recorded_by: 'Kelvin', vat_amount: 0, supplier_pin: null },
    ];
    D.cash_in = [
      { id: uuid(), area: 'A', date: dayOff(-1), category: 'Hotspot', amount: 4300, received_to: 'M-Pesa', from_name: 'Hotspot sales', ref: null, note: null, recorded_by: 'Kelvin' },
      { id: uuid(), area: 'A', date: dayOff(-4), category: 'Installation fee', amount: 3500, received_to: 'M-Pesa', from_name: 'Daniel Ndungu', ref: 'UJ4MZ81QPA', note: null, recorded_by: 'Kelvin' },
    ];
    D.expense_categories = ['Internet / backhaul', 'Power', 'Rent', 'Salaries', 'Transport', 'Materials', 'Equipment', 'Airtime & data', 'Bank & M-Pesa fees', 'Other'].map((name, i) => ({ name, sort: i }));
    D.staff = [
      { id: 's-peter', profile_id: 'p-peter', full_name: 'Peter Kamau', job_title: 'Field technician', area: 'A', phone: '0722500500', mpesa_number: '0722500500', mpesa_name: 'PETER KAMAU', pay_type: 'monthly', salary: 25000, pay_day: 28, active: true, start_date: dayOff(-400) },
      { id: 's-brian', profile_id: 'p-brian', full_name: 'Brian Otieno', job_title: 'Field technician', area: 'A', phone: '0733600600', mpesa_number: '0733600600', mpesa_name: 'BRIAN OTIENO', pay_type: 'monthly', salary: 22000, pay_day: 28, active: true, start_date: dayOff(-200) },
      { id: 's-faith', profile_id: 'p-faith', full_name: 'Faith Achieng', job_title: 'Field technician', area: 'B', phone: '0744700700', mpesa_number: '0744700700', mpesa_name: 'FAITH ACHIENG', pay_type: 'monthly', salary: 22000, pay_day: 28, active: true, start_date: dayOff(-150) },
      { id: 's-mary', profile_id: 'p-mary', full_name: 'Mary Wanjiku', job_title: 'Call center', area: null, phone: '0711400400', mpesa_number: '0711400400', mpesa_name: 'MARY WANJIKU', pay_type: 'monthly', salary: 18000, pay_day: new Date().getDate(), active: true, start_date: dayOff(-90) },
      { id: 's-casual', profile_id: null, full_name: 'Joseph Mutua', job_title: 'Casual (pole work)', area: 'A', phone: '0755900900', mpesa_number: '0755900900', mpesa_name: 'JOSEPH MUTUA', pay_type: 'daily', salary: 800, pay_day: 28, active: true, start_date: null },
    ];
    D.pay_items = [];
    D.payees = [{ name: 'KPLC prepaid', category: 'Power' }, { name: 'Safaricom backhaul', category: 'Internet / backhaul' }, { name: 'Mama Njeri Hardware', category: 'Materials' }];

    // statements
    D.categories = [
      ['Customer payment', 'income'], ['Subscription collections', 'income'], ['Hotspot', 'income'], ['Installation fees', 'income'],
      ['Internet / backhaul', 'expense'], ['Power', 'expense'], ['Rent', 'expense'], ['Salaries', 'expense'], ['Transport', 'expense'], ['Materials', 'expense'], ['Bank & M-Pesa fees', 'expense'],
      ['Between Zuri accounts', 'transfer'], ['Partner / owner money', 'owner'], ['Not Zuri money', 'ignore'],
    ].map(([name, flow], i) => ({ name, flow, sort: i }));
    D.money_accounts = [{ id: 'acct-a-bank', name: 'Zuri A · KCB bank', kind: 'bank', area: 'A', owner: null, active: true }, { id: 'acct-a-mpesa', name: 'Zuri A · M-Pesa till', kind: 'mpesa', area: 'A', owner: null, active: true }];
    const L = (acct, n, details, inn, out, cat) => ({ id: uuid(), account_id: acct, date: dayOff(-n), time: '10:' + pad(n), ref: 'UJ' + (n * 104729).toString(36).toUpperCase(), details, money_in: inn, money_out: out, balance: null, category: cat, imported_at: tsOff(-1), customer_id: null, payment_id: null, expense_id: null });
    D.statement_lines = [
      L('acct-a-mpesa', 2, 'Customer Payment to Small Business - 0722XXX145 GRACE NJERI', 2000, 0, null),
      L('acct-a-mpesa', 3, 'Customer Payment to Small Business - 0733XXX908 JOSEPH KARIUKI', 3000, 0, null),
      L('acct-a-mpesa', 3, 'Pay Bill to 888880 - KPLC PREPAID Acc. 5412XXXX', 0, 1500, null),
      L('acct-a-mpesa', 4, 'Customer Transfer to - 0700XXX200 KELVIN', 0, 10000, null),
      L('acct-a-mpesa', 5, 'Merchant Payment to 5512XX - MAMA NJERI HARDWARE', 0, 2400, null),
      L('acct-a-mpesa', 5, 'Customer Payment to Small Business - 0711XXX332 MERCY WANJIRU', 2000, 0, null),
      L('acct-a-mpesa', 6, 'Withdrawal Charge', 0, 33, null),
      L('acct-a-mpesa', 6, 'Business Payment from 4021XX - HOTSPOT VOUCHERS', 4300, 0, null),
      L('acct-a-bank', 7, 'FUNDS TRANSFER - SAFARICOM LTD BACKHAUL SEP', 0, 45000, null),
      L('acct-a-bank', 8, 'MPESA C2B SETTLEMENT 4021XX', 58500, 0, null),
      L('acct-a-bank', 9, 'LEDGER FEE', 0, 450, null),
      L('acct-a-bank', 10, 'CASH DEPOSIT - DICKSON', 20000, 0, null),
      L('acct-a-mpesa', 12, 'Customer Payment to Small Business - 0745XXX771 DAVID MUTUA', 3000, 0, 'Customer payment'),
      L('acct-a-mpesa', 14, 'Pay Bill to 888880 - KPLC PREPAID', 0, 2000, 'Power'),
    ];
    D.sort_rules = [{ id: uuid(), match: 'KPLC', direction: 'out', category: 'Power' }];
    const months = [-3, -2, -1, 0].map((k) => { const d = new Date(); d.setMonth(d.getMonth() + k, 1); return ymd(d); });
    D.v_books = [];
    months.forEach((mo, i) => {
      const grow = 1 + i * 0.05;
      [['income', 'Subscription collections', 690000 * grow], ['income', 'Hotspot', 120000 * grow], ['income', 'Installation fees', 21000 + i * 3500],
       ['expense', 'Internet / backhaul', 73000], ['expense', 'Salaries', 180000], ['expense', 'Rent', 19000], ['expense', 'Power', 7000 + i * 300], ['expense', 'Transport', 14000], ['expense', 'Materials', 26000 - i * 2000], ['expense', 'Bank & M-Pesa fees', 4100]]
        .forEach(([flow, category, v]) => D.v_books.push({ month: mo, area: 'A', flow, category, money_in: flow === 'income' ? Math.round(v * (i === 3 ? 0.55 : 1)) : 0, money_out: flow === 'expense' ? Math.round(v * (i === 3 ? 0.55 : 1)) : 0, lines: 20 }));
    });
    D.v_books.push({ month: months[3], area: 'A', flow: 'unsorted', category: null, money_in: 0, money_out: 0, lines: 12 });
    D.billing_snapshots = months.slice(0, 3).map((mo, i) => ({ period: mo.slice(0, 7), fixed: 760000 + i * 12000, hotspot: 140000 + i * 4000 }));
    D.v_people = D.profiles.map(({ id, full_name, role, dept, area, active, phone }) => ({ id, full_name, role, dept, area, active, phone }));
    D._ticket_no = no;
    if (mode === 'empty') {
      Object.assign(D, { v_customers: [], payments: [], tickets: [], ticket_events: [], ticket_parts: [], tasks: [], task_comments: [], agent_runs: [], nudges: [],
        bills: [], cash_counts: [], expenses: [], cash_in: [], money_accounts: [], statement_lines: [], sort_rules: [], v_books: [], billing_snapshots: [], custom_field_defs: [], staff: [], pay_items: [] });
      D.profiles = D.profiles.map((p) => ({ ...p, active: p.role === 'admin' })); // only the partner is switched on; you switch the others on
      D._ticket_no = 100;
    }
    return D;
  }

  let D;
  try { D = JSON.parse(localStorage.getItem(KEY)); } catch (e) { D = null; }
  const wantMode = (() => { try { return localStorage.getItem('zuri_practice_mode') || 'running'; } catch (e) { return 'running'; } })();
  if (!D || !D.v_customers || (D._mode || 'running') !== wantMode) D = build(wantMode);
  let saveT;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { /* full: practice still works this visit */ } }, 150); };
  save();

  const meId = () => (ROLES[localStorage.getItem(ROLE_KEY)] || {}).id || null;
  const me = () => D.profiles.find((p) => p.id === meId()) || {};
  const isFinance = (p = me()) => p.role === 'admin' || (p.role === 'internal' && p.dept === 'finance');
  const isOffice = (p = me()) => ['admin', 'internal', 'callcenter'].includes(p.role);
  const inGroup = (p, g) => ({ everyone: true, partners: p.role === 'admin', finance: isFinance(p), technical: p.role === 'admin' || (p.role === 'internal' && p.dept === 'technical'), callcenter: p.role === 'callcenter', field: p.role === 'field' }[g] || false);

  // What each role may see — the same rules the real database enforces.
  const RULES = {
    tickets: (r) => isOffice() || r.assigned_to === meId() || r.opened_by === meId(),
    tasks: (r) => r.visibility === 'team' || (r.visibility === 'office' && isOffice()) || isFinance(),
    nudges: () => isFinance(), agent_runs: () => isFinance(),
    staff: () => isFinance(), pay_items: () => isFinance(),
    bills: () => isFinance(), expenses: () => isFinance(), cash_in: () => isFinance(), cash_counts: () => isFinance(), payments: () => isOffice(),
    statement_lines: () => isFinance(), money_accounts: () => isFinance(), v_books: () => isFinance(),
  };

  // ---------- a small stand-in for the database's query language ----------
  const val = (v) => (v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v);
  const cmp = (a, b) => (a == null && b == null ? 0 : a == null ? 1 : b == null ? -1 : typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)));
  const like = (s, pat, ci) => new RegExp('^' + String(pat).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', ci ? 'i' : '').test(String(s ?? ''));
  const test = (r, col, op, v) => {
    if (op.startsWith('not_')) return !test(r, col, op.slice(4), v);
    const x = r[col];
    switch (op) {
      case 'eq': return String(x) === String(v);
      case 'neq': return String(x) !== String(v);
      case 'gt': return x != null && cmp(x, v) > 0;
      case 'gte': return x != null && cmp(x, v) >= 0;
      case 'lt': return x != null && cmp(x, v) < 0;
      case 'lte': return x != null && cmp(x, v) <= 0;
      case 'is': return (x ?? null) === val(v);
      case 'in': return v.map(String).includes(String(x));
      case 'like': return like(x, v, false);
      case 'ilike': return like(x, v, true);
      default: return true;
    }
  };
  function splitTop(s) { const out = []; let depth = 0, cur = ''; for (const ch of s) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; }
  function orTerm(r, term) {
    term = term.trim();
    const m = term.match(/^(and|or)\((.*)\)$/);
    if (m) { const parts = splitTop(m[2]); return m[1] === 'and' ? parts.every((p) => orTerm(r, p)) : parts.some((p) => orTerm(r, p)); }
    const [col, op, ...rest] = term.split('.');
    return test(r, col, op, rest.join('.'));
  }
  const DEFAULTS = {
    tickets: () => ({ ticket_no: ++D._ticket_no, opened_at: new Date().toISOString(), status: 'open', priority: 'normal', amount_collected: 0 }),
    tasks: () => ({ status: 'open', priority: 'normal', source: 'person', kind: 'todo', visibility: 'team', opened_at: new Date().toISOString(), updated_at: new Date().toISOString(), escalation_level: 0 }),
    task_comments: () => ({ at: new Date().toISOString(), from_agent: false }),
    ticket_events: () => ({ at: new Date().toISOString() }), ticket_parts: () => ({ added_at: new Date().toISOString(), added_by: meId() }),
    cash_counts: () => ({ created_at: new Date().toISOString() }), money_accounts: () => ({ active: true }),
    bills: () => ({ paid_amount: 0, paid: false }),
  };
  function afterWrite(table, row, before) {
    if (table === 'tickets') {
      if (row.assigned_to && row.status === 'open') row.status = 'assigned';
      if (row.status === 'done' && (!before || before.status !== 'done')) {
        row.closed_at = new Date().toISOString();
        if (Number(row.amount_collected) > 0 && !D.payments.some((p) => p.ticket_id === row.id)) {
          const c = D.v_customers.find((x) => x.id === row.customer_id);
          D.payments.push({ id: uuid(), source: 'field', date: today(), amount: Number(row.amount_collected), method: row.collection_method, mpesa_ref: row.collection_ref, payer_name: c ? c.full_name : row.caller, customer_id: row.customer_id, area: row.area, ticket_id: row.id });
        }
      }
    }
    if (table === 'tasks') {
      row.updated_at = new Date().toISOString();
      if (row.status === 'done' && (!before || before.status !== 'done')) { row.done_at = row.updated_at; row.done_by = meId(); }
    }
    if (table === 'bills') row.paid = Number(row.paid_amount) >= Number(row.amount);
    if (table === 'profiles') { const v = D.v_people.find((p) => p.id === row.id); if (v) Object.assign(v, row); else D.v_people.push({ ...row }); }
  }

  function query(table) {
    const st = { filters: [], ors: [], orders: [], limit: null, range: null, single: false, op: 'select', payload: null, opts: {}, conflict: null, ignoreDup: false, returning: false };
    const b = {
      select(_c, opts) { if (st.op !== 'select') st.returning = true; else st.opts = opts || {}; return b; },
      eq(c, v) { st.filters.push([c, 'eq', v]); return b; }, neq(c, v) { st.filters.push([c, 'neq', v]); return b; },
      gt(c, v) { st.filters.push([c, 'gt', v]); return b; }, gte(c, v) { st.filters.push([c, 'gte', v]); return b; },
      lt(c, v) { st.filters.push([c, 'lt', v]); return b; }, lte(c, v) { st.filters.push([c, 'lte', v]); return b; },
      is(c, v) { st.filters.push([c, 'is', v]); return b; }, in(c, v) { st.filters.push([c, 'in', v]); return b; },
      like(c, v) { st.filters.push([c, 'like', v]); return b; }, ilike(c, v) { st.filters.push([c, 'ilike', v]); return b; },
      not(c, op, v) { st.filters.push([c, 'not_' + op, v]); return b; }, or(s) { st.ors.push(s); return b; },
      order(c, o = {}) { st.orders.push([c, o.ascending !== false]); return b; },
      limit(n) { st.limit = n; return b; }, range(a, z) { st.range = [a, z]; return b; },
      maybeSingle() { st.single = true; return b; }, single() { st.single = true; return b; },
      insert(p) { st.op = 'insert'; st.payload = p; return b; },
      upsert(p, o = {}) { st.op = 'upsert'; st.payload = p; st.conflict = (o.onConflict || 'id').split(','); st.ignoreDup = !!o.ignoreDuplicates; return b; },
      update(p) { st.op = 'update'; st.payload = p; return b; }, delete() { st.op = 'delete'; return b; },
      then(ok, no) { return new Promise((res) => setTimeout(() => res(run(table, st)), 120)).then(ok, no); },
    };
    return b;
  }
  function run(table, st) {
    const all = D[table] || (D[table] = []);
    const rule = RULES[table] || (() => true);
    const match = (r) => rule(r) && st.filters.every(([c, op, v]) => test(r, c, op, v)) && st.ors.every((s) => splitTop(s).some((t) => orTerm(r, t)));
    if (st.op === 'select') {
      let rows = all.filter(match);
      st.orders.slice().reverse().forEach(([c, asc]) => rows.sort((x, y) => (asc ? 1 : -1) * cmp(x[c], y[c])));
      const count = rows.length;
      if (st.range) rows = rows.slice(st.range[0], st.range[1] + 1);
      if (st.limit != null) rows = rows.slice(0, st.limit);
      rows = rows.map((r) => JSON.parse(JSON.stringify(r)));
      return { data: st.opts.head ? null : st.single ? rows[0] || null : rows, count, error: null };
    }
    if (Object.keys(RULES).includes(table) && !rule({}) && st.op !== 'select' && !['tickets', 'tasks'].includes(table)) return { data: null, error: { message: 'new row violates row-level security policy' } };
    const touched = [];
    if (st.op === 'insert' || st.op === 'upsert') {
      for (const p of [].concat(st.payload)) {
        const ex = st.op === 'upsert' ? all.find((r) => st.conflict.every((c) => String(r[c]) === String(p[c]))) : null;
        if (ex) { if (st.ignoreDup) continue; const before = { ...ex }; Object.assign(ex, p); afterWrite(table, ex, before); touched.push(ex); continue; }
        const row = { id: uuid(), created_at: new Date().toISOString(), ...(DEFAULTS[table] ? DEFAULTS[table]() : {}), ...p };
        all.push(row); afterWrite(table, row, null); touched.push(row);
      }
    } else if (st.op === 'update') {
      all.filter(match).forEach((r) => { const before = { ...r }; Object.assign(r, st.payload); afterWrite(table, r, before); touched.push(r); });
    } else if (st.op === 'delete') {
      const gone = all.filter(match); D[table] = all.filter((r) => !gone.includes(r)); touched.push(...gone);
    }
    save();
    return { data: st.returning || st.single ? (st.single ? touched[0] || null : touched.map((r) => ({ ...r }))) : null, error: null };
  }

  // ---------- the database's built-in jobs ----------
  const paidThisMonth = (c) => D.payments.filter((p) => p.customer_id === c.id && p.date.slice(0, 7) === ym()).reduce((t, p) => t + Number(p.amount), 0);
  function collections() {
    return D.v_customers.filter((c) => c.status === 'active').map((c) => {
      const paid = paidThisMonth(c), late = c.paid_until && new Date(c.paid_until) < new Date();
      const state = late ? (paid > 0 ? 'part' : 'late') : paid >= Number(c.monthly_rate) ? 'paid' : paid > 0 ? 'part' : c.paid_until ? 'due_later' : 'unpaid';
      return { customer_id: c.id, full_name: c.full_name, phone: c.phone, area: c.area, monthly_rate: c.monthly_rate, paid_this_month: paid, state, paid_until: c.paid_until, usual_day: new Date(c.paid_until || Date.now()).getDate(), reliability: late ? 0.6 : 0.95 };
    });
  }
  function latestCounts() { const out = {}; [...D.cash_counts].sort((a, b) => cmp(b.date, a.date)).forEach((c) => { if (!out[c.area]) out[c.area] = c; }); return out; }
  function projection(area, start, extras) {
    const lc = latestCounts();
    let bal = start != null ? Number(start) : Object.values(lc).filter((c) => !area || c.area === area).reduce((t, c) => t + Number(c.bank) + Number(c.mpesa), 0);
    const now = new Date(), end = new Date(Date.now() + 29 * DAY); // always 30 days ahead
    const rows = [];
    for (let d = new Date(now); d <= end; d = new Date(d.getTime() + DAY)) {
      const day = ymd(d), dom = d.getDate(), first = day === today();
      const custIn = D.v_customers.filter((c) => c.status === 'active' && (!area || c.area === area) && c.paid_until && ymd(new Date(c.paid_until)) === day).reduce((t, c) => t + Number(c.monthly_rate) * 0.9, 0);
      const otherIn = 1400;
      // This month: what's still owing, on its due day (overdue ones today). Next month: every bill again, in full.
      const thisMonth = day.slice(0, 7) === ym();
      const due = D.bills.filter((b) => b.month === ym() && (!area || b.area === area) && (thisMonth ? !b.paid && (first ? b.due_day <= dom : b.due_day === dom) : b.due_day === dom));
      const billsOut = due.reduce((t, b) => t + (thisMonth ? Number(b.amount) - Number(b.paid_amount) : Number(b.amount)), 0);
      const extra = (extras || []).filter((x) => x.date === day).reduce((t, x) => t + Number(x.amount), 0);
      bal += custIn + otherIn - billsOut + extra;
      const names = due.map((b) => b.name);
      rows.push({ day, customers_in: Math.round(custIn), other_in: otherIn, bills_out: billsOut, extra, balance: Math.round(bal), note: names.join(', ') });
    }
    return rows;
  }
  function snapshot(area) {
    const inA = (x) => !area || x.area === area;
    const cs = D.v_customers.filter(inA), act = cs.filter((c) => c.status === 'active');
    const late = act.filter((c) => c.paid_until && new Date(c.paid_until) < new Date());
    const plans = {}; act.forEach((c) => { const p = plans[c.plan] || (plans[c.plan] = { plan: c.plan, n: 0, kes: 0 }); p.n++; p.kes += Number(c.monthly_rate); });
    const ren = (n) => act.filter((c) => { const d = (new Date(c.paid_until) - Date.now()) / DAY; return d >= 0 && d <= n; });
    const tk = D.tickets.filter(inA), open = tk.filter((t) => ['open', 'assigned', 'in_progress'].includes(t.status));
    const thisMonth = (t) => t.closed_at && t.closed_at.slice(0, 7) === ym();
    const lc = latestCounts(), counts = Object.values(lc).filter(inA);
    const bills = D.bills.filter((b) => b.month === ym() && inA(b));
    const owing = (b) => Math.max(0, Number(b.amount) - Number(b.paid_amount));
    const next = bills.filter((b) => !b.paid).sort((a, b) => a.due_day - b.due_day)[0];
    const proj = projection(area, null, []);
    const low = proj.reduce((m, r) => (r.balance < m.balance ? r : m), proj[0]);
    const booksBy = {}; D.v_books.filter((r) => r.flow === 'income' || r.flow === 'expense').forEach((r) => { const b = booksBy[r.month] || (booksBy[r.month] = { month: r.month, income: 0, expense: 0 }); b[r.flow] += r.flow === 'income' ? r.money_in : r.money_out; });
    const s = {
      as_of: new Date().toISOString(),
      customers: { active: act.length, disconnected: cs.filter((c) => c.status === 'disconnected').length, leads: cs.filter((c) => c.status === 'lead').length,
        paid_up: act.length - late.length, late: late.length, late_owe: late.reduce((t, c) => t + Number(c.monthly_rate), 0), mrr: act.reduce((t, c) => t + Number(c.monthly_rate), 0),
        renew_7: ren(7).length, renew_7_kes: ren(7).reduce((t, c) => t + Number(c.monthly_rate), 0), renew_30_kes: ren(30).reduce((t, c) => t + Number(c.monthly_rate), 0),
        no_pin: act.filter((c) => c.lat == null).length, plans: Object.values(plans).sort((a, b) => b.n - a.n), last_update: tsOff(-1, 6) },
      jobs: { open_faults: open.filter((t) => t.kind === 'fault').length, faults_done: tk.filter((t) => t.kind === 'fault' && thisMonth(t)).length, fault_hours: 19,
        open_installs: open.filter((t) => t.kind === 'install').length, installs_done: tk.filter((t) => t.kind === 'install' && thisMonth(t)).length,
        today: open.filter((t) => t.kind !== 'billing' && t.scheduled_for === today()).length, week: open.filter((t) => t.kind !== 'billing').length,
        overdue: open.filter((t) => t.kind !== 'billing' && t.scheduled_for && t.scheduled_for < today()).length, unassigned: open.filter((t) => t.kind !== 'billing' && !t.assigned_to).length,
        followups: open.filter((t) => t.kind === 'billing').length, followups_paid: 3, followups_urgent: open.filter((t) => t.kind === 'billing' && t.priority === 'urgent').length },
      upcoming: open.filter((t) => t.kind !== 'billing').slice(0, 8).map((t) => ({ id: t.id, no: t.ticket_no, kind: t.kind, priority: t.priority, summary: t.summary, day: t.scheduled_for,
        customer: (D.v_customers.find((c) => c.id === t.customer_id) || {}).full_name || t.caller, tech: (D.profiles.find((p) => p.id === t.assigned_to) || {}).full_name })),
      money: isFinance() ? {
        cash_now: counts.reduce((t, c) => t + Number(c.bank) + Number(c.mpesa), 0), bank: counts.reduce((t, c) => t + Number(c.bank), 0), mpesa: counts.reduce((t, c) => t + Number(c.mpesa), 0),
        oldest_count: counts.length ? counts.map((c) => c.date).sort()[0] + 'T12:00:00' : null,
        floats: counts.map((c) => ({ area: c.area, mpesa: c.mpesa, target: (D.areas.find((a) => a.code === c.area) || {}).float_target })),
        bills: { total: bills.length, owing: bills.reduce((t, b) => t + owing(b), 0), next: next ? { name: next.name, owing: owing(next), due_day: next.due_day } : null },
        unsorted: D.statement_lines.filter((l) => !l.category).length, last_statement: dayOff(-2),
        books: Object.values(booksBy).sort((a, b) => cmp(a.month, b.month)), billing: D.billing_snapshots,
        proj_low: low.balance, proj_low_day: low.day, proj_end: proj[proj.length - 1].balance, proj_in: proj.reduce((t, r) => t + r.customers_in + r.other_in, 0), proj_out: proj.reduce((t, r) => t + r.bills_out, 0),
        proj_short_day: (proj.find((r) => r.balance < 0) || {}).day || null, proj_series: proj.map((r) => ({ d: r.day, b: r.balance, i: r.customers_in + r.other_in, o: r.bills_out })),
      } : null,
    };
    return s;
  }
  const RPC = {
    dashboard_snapshot: (a) => snapshot(a.p_area),
    collections_month: () => collections(),
    cash_projection: (a) => projection(a.p_area, a.p_start, a.p_extra),
    pay_bill: (a) => {
      if (!isFinance()) throw new Error('Only finance can pay bills.');
      const b = D.bills.find((x) => x.id === a.p_bill);
      D.expenses.push({ id: uuid(), area: b.area, date: today(), category: b.category, payee: b.name, amount: a.p_amount, paid_from: a.p_from, ref: a.p_ref ? String(a.p_ref).toUpperCase() : null, approved_by: 'Pre-approved (bill)', receipt: a.p_from === 'Cash' ? 'Paper receipt — filed' : 'Digital / M-Pesa msg', note: 'Bill payment', recorded_by: me().full_name, bill_id: b.id, vat_amount: 0 });
      b.paid_amount = Number(b.paid_amount) + Number(a.p_amount); b.paid_date = today(); b.paid = b.paid_amount >= b.amount;
      return { paid_amount: b.paid_amount, amount: b.amount, name: b.name };
    },
    save_customer: (a) => {
      const p = a.p; let c = p.id && D.v_customers.find((x) => x.id === p.id);
      if (c) Object.assign(c, p, { custom: { ...(c.custom || {}), ...(p.custom || {}) }, updated_at: new Date().toISOString() });
      else { c = { id: uuid(), status: 'active', custom: {}, created_at: new Date().toISOString(), ...p }; D.v_customers.push(c); }
      return c.id;
    },
    refresh_payment_followups: () => ({ opened: 0, closed: 0 }),
    build_pay_run: () => {
      if (!isFinance()) throw new Error('Only finance can build the pay run.');
      const period = ym(), now = new Date(), until = dayOff(3), last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dueOn = (d) => ymd(new Date(now.getFullYear(), now.getMonth(), Math.min(d, last)));
      let nb = 0, ns = 0;
      const put = (kind, ref_id, name, pay_to, amount, area, due_date) => {
        const ex = D.pay_items.find((p) => p.kind === kind && p.ref_id === ref_id && p.period === period);
        if (ex) { if (ex.status === 'due') Object.assign(ex, { amount, pay_to }); return; }
        D.pay_items.push({ id: uuid(), period, due_date, kind, ref_id, name, pay_to, amount, area, status: 'due', created_at: new Date().toISOString() });
      };
      D.bills.filter((b) => b.month === period && !b.paid && b.amount - b.paid_amount > 0 && dueOn(b.due_day) <= until).forEach((b) => { put('bill', b.id, b.name, b.pay_to, b.amount - b.paid_amount, b.area, dueOn(b.due_day)); nb++; });
      D.staff.filter((s) => s.active && s.pay_type === 'monthly' && s.salary > 0 && dueOn(s.pay_day) <= until).forEach((s) => { put('staff', s.id, s.full_name + ' · salary ' + now.toLocaleDateString('en-GB', { month: 'short' }), s.mpesa_number || s.phone, s.salary, s.area, dueOn(s.pay_day)); ns++; });
      return { bills: nb, staff: ns, due: D.pay_items.filter((p) => p.period === period && p.status === 'due').length };
    },
    record_pay_item: (a) => {
      if (!isFinance()) throw new Error('Only finance can record payments.');
      const it = D.pay_items.find((p) => p.id === a.p_item); if (!it) throw new Error('Not on the pay run.');
      if (it.status === 'sent') throw new Error('Already recorded.');
      const amt = Number(a.p_amount || it.amount);
      if (it.kind === 'bill') RPC.pay_bill({ p_bill: it.ref_id, p_amount: amt, p_from: a.p_from, p_ref: a.p_ref });
      else D.expenses.push({ id: uuid(), area: it.area || 'A', date: today(), category: 'Salaries', payee: it.name, amount: amt, paid_from: a.p_from, ref: a.p_ref ? String(a.p_ref).toUpperCase() : null, approved_by: me().full_name, receipt: 'Digital / M-Pesa msg', note: 'Pay run ' + it.period, recorded_by: me().full_name, vat_amount: 0 });
      Object.assign(it, { status: 'sent', paid_from: a.p_from, ref_code: a.p_ref ? String(a.p_ref).toUpperCase() : null, amount: amt, sent_at: new Date().toISOString(), sent_by: meId() });
      return { ok: true, name: it.name, amount: amt };
    },
    manager_run: () => ({ run: uuid(), rules: 9, new_tasks: 0, closed: 0, escalated: 0, nudges: 0, note: 'Practice: the manager looked and everything is already on the list.' }),
    match_payments: () => ({ matched: 0 }),
    apply_sort_rules: () => {
      let n = 0;
      D.statement_lines.filter((l) => !l.category).forEach((l) => { const r = D.sort_rules.find((x) => (x.direction === 'in' ? l.money_in > 0 : l.money_out > 0) && l.details.toUpperCase().includes(String(x.match).toUpperCase())); if (r) { l.category = r.category; n++; } });
      return n;
    },
    import_statement: (a) => {
      let added = 0, skipped = 0;
      a.rows.forEach((r) => { if (D.statement_lines.some((l) => l.account_id === a.p_account && l.fingerprint === r.fingerprint)) skipped++; else { D.statement_lines.push({ id: uuid(), account_id: a.p_account, category: null, imported_at: new Date().toISOString(), ...r }); added++; } });
      return { added, skipped, auto_sorted: RPC.apply_sort_rules(), linked: 0, matched: 0 };
    },
    import_customers: (a) => { a.rows.forEach((r) => RPC.save_customer({ p: { ...r, id: (D.v_customers.find((c) => r.billnasi_id && c.billnasi_id === r.billnasi_id) || {}).id } })); return a.rows.length; },
    import_payments: (a) => ({ rows: a.rows.length, added: a.rows.length, matched: 0 }),
  };
  const blobs = new Map();
  const client = {
    auth: {
      getSession: async () => ({ data: { session: meId() ? { user: { id: meId() } } : null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => { localStorage.removeItem(ROLE_KEY); return {}; },
      signInWithPassword: async () => ({ error: { message: 'In practice you pick a role instead of signing in.' } }),
      signUp: async () => ({ error: { message: 'In practice you pick a role instead of making an account.' } }),
      resetPasswordForEmail: async () => ({ error: { message: 'Not needed in practice.' } }),
      updateUser: async () => ({ error: { message: 'Not needed in practice.' } }),
    },
    from: query,
    rpc: (name, args) => new Promise((res) => setTimeout(() => {
      try { const data = RPC[name] ? RPC[name](args || {}) : null; save(); res({ data, error: null }); } catch (e) { res({ data: null, error: { message: e.message } }); }
    }, 150)),
    storage: { from: () => ({
      upload: async (path, blob) => { blobs.set(path, URL.createObjectURL(blob)); return { error: null }; },
      createSignedUrls: async (paths) => ({ data: paths.map((p) => ({ path: p, signedUrl: blobs.get(p) || 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#0F6E5C"/><text x="48" y="54" font-size="12" fill="#fff" text-anchor="middle">practice photo</text></svg>') })) }),
    }) },
  };

  window.supabase = { createClient: () => client };
  // Used by the sign-in screen and Me page in practice.
  window.ZP = {
    roles: ROLES,
    last: () => { try { return localStorage.getItem('zuri_practice_last'); } catch (e) { return null; } },
    role: () => localStorage.getItem(ROLE_KEY),
    pickRole: (r) => localStorage.setItem(ROLE_KEY, r),
    session: () => (meId() ? { user: { id: meId() } } : null),
    fresh: (mode) => { D = build(mode || 'running'); try { localStorage.setItem('zuri_practice_mode', mode || 'running'); } catch (e) {} save(); },
    mode: () => D._mode || 'running',
    reset: () => { localStorage.removeItem(KEY); Object.keys(localStorage).filter((k) => k.startsWith('zuri_practice_') && k !== ROLE_KEY).forEach((k) => localStorage.removeItem(k)); },
  };
})();
