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
    // The Testers' List hands us the job (and a video) in the address, so the person never has to pick.
    const qp = new URLSearchParams(location.search);
    if (qp.get('role') && ROLES[qp.get('role')]) { localStorage.setItem(ROLE_KEY, qp.get('role')); sessionStorage.setItem('zp_open', '1'); }
    if (qp.get('play')) localStorage.setItem('zuri_learn_autoplay', qp.get('play').replace(/[^a-z0-9-]/gi, ''));
    // v2.34: &chain=projects plays the whole group from that video on (the Testers' List Projects script uses it); ✕ stops
    const CHAINS = { projects: '📈 Projects', receipts: '🧾 Receipts', timesavers: '⏱ Time savers', golive: '🚀 Getting ready', alerts: '📣 Alerts' };
    if (qp.get('play') && CHAINS[qp.get('chain')]) sessionStorage.setItem('zuri_learn_chain', CHAINS[qp.get('chain')]);
    if (!sessionStorage.getItem('zp_open') && !localStorage.getItem('zuri_learn_autoplay')) {
      const last = localStorage.getItem(ROLE_KEY); if (last) localStorage.setItem('zuri_practice_last', last);
      localStorage.removeItem(ROLE_KEY);
    }
    sessionStorage.setItem('zp_open', '1');
    // v2.32: use the link's role/video once, then take them out of the address, so a later reload can't switch person back.
    if (qp.get('role') || qp.get('play')) { qp.delete('role'); qp.delete('play'); qp.delete('chain'); const q = qp.toString().replace(/=(&|$)/g, '$1'); history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash); }
  } catch (e) { /* storage blocked: the picker shows anyway */ }
  const FIRST = ['Grace', 'John', 'Mercy', 'Joseph', 'Faith', 'Samuel', 'Esther', 'David', 'Lucy', 'Peter', 'Ann', 'James', 'Mary', 'Daniel', 'Ruth', 'Paul', 'Jane', 'Stephen', 'Naomi', 'Moses', 'Susan', 'Isaac', 'Purity', 'Kevin', 'Beatrice'];
  const LAST = ['Njeri', 'Mwangi', 'Wanjiru', 'Kariuki', 'Otieno', 'Chebet', 'Mutua', 'Wambui', 'Kamau', 'Achieng', 'Kiprono', 'Nyambura', 'Odhiambo', 'Gitau', 'Muthoni', 'Kibet', 'Atieno', 'Ndungu', 'Wairimu', 'Omondi'];
  const PLACES = ['Behind the Total petrol station', 'Near Maai Mahiu market', 'Opposite St. Mary\'s church', 'Satellite estate, blue gate', 'Near the matatu stage', 'Kamuyu road, after the posho mill', 'Next to the primary school', 'Above the M-Pesa shop', 'Green house near the water tank', 'Off the old Naivasha road', 'Near the health centre', 'Behind the police post'];
  const PKGS = () => [['5 Mbps', 1500], ['10 Mbps', 2000], ['20 Mbps', 3000], ['30 Mbps Business', 4500]].map(([name, monthly_rate]) => ({ name, monthly_rate, kind: 'fixed' }));
  const PLANS = [['5 Mbps', 1500], ['10 Mbps', 2000], ['10 Mbps', 2000], ['20 Mbps', 3000], ['20 Mbps', 3000], ['30 Mbps Business', 4500]];

  // mode 'empty': a brand-new company — only the areas, the seed lists and the staff. You enter everything else.
  // ✉️ v2.55: pretend emails (example.com, never real) for two in three customers; about half of those said yes to emails
  // (Grace and John, the first two, are left for the testers to say yes themselves.)
  function emSeed(D) {
    D._em = 1; if (D._mode === 'empty') return; D.customer_alert_prefs = D.customer_alert_prefs || [];
    D.v_customers.forEach((c, i) => { if (i % 3 === 2 || c.status === 'lead') return;
      if (!c.email) c.email = String(c.full_name).toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.') + '@example.com';
      if (i % 2 === 0 && i > 1) { const p = D.customer_alert_prefs.find((x) => String(x.customer_id) === String(c.id));
        if (p) { if (p.ok_email == null) p.ok_email = true; } else D.customer_alert_prefs.push({ customer_id: c.id, lang: i % 5 === 0 ? 'en' : 'sw', ok_service: true, ok_reminders: true, ok_offers: false, ok_email: true, consent_note: 'Said yes to emails at the install' }); } });
  }
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
    // ⏱ v2.33: Peter's "slow internet" customer has no pin yet, and the "move router" customer's pin is rough (±120 m)
    D.v_customers[5] = { ...D.v_customers[5], lat: null, lng: null };
    D.v_customers[8] = { ...D.v_customers[8], custom: { ...D.v_customers[8].custom, pin_accuracy: 120 } };
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
      T({ customer_id: null, caller: 'Halima, 0712 345 678', area: 'A', kind: 'install', status: 'open', scheduled_for: dayOff(1), summary: 'New install enquiry — wants 10 Mbps for a salon' }),
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
      K({ title: `Call ${lateN} customers whose internet ran out — urgent ones first`, assigned_group: 'callcenter', visibility: 'office', priority: 'high', link_type: 'page', link_ref: 'texts', ref_key: 'call-late', details: 'Jobs → 📩 Today\'s texts: everyone whose step is due today, the words already written — tap Text or WhatsApp, send, Next. Call first on day 3 and day 14.' }),
      K({ title: 'Drop map pins for 8 customers with no pin', assigned_group: 'technical', link_type: 'page', link_ref: 'customers', priority: 'low' }),
      K({ title: 'Check the splitter box at the market', assigned_to: 'p-peter', source: 'person', created_by: 'p-dickson', details: 'Two customers near the market say it is slow at night.', due_date: dayOff(1) }),
      K({ title: 'Send me the Friday report by 4pm', assigned_to: 'p-kelvin', source: 'person', created_by: 'p-jerry', visibility: 'finance', due_date: dayOff(2) }),
      K({ title: 'Bring 2 spare routers to Zuri B', assigned_to: 'p-faith', source: 'person', created_by: 'p-dickson', due_date: dayOff(3), priority: 'low' }),
    ];
    D.task_comments = [{ id: uuid(), task_id: D.tasks[5].id, by: 'p-dickson', body: 'Take the light meter.', at: tsOff(-1, 8), from_agent: false }];
    D.agent_runs = [{ id: uuid(), mode: 'morning', window_key: 'morning:' + today(), started_at: tsOff(0, 6), status: 'done', used_ai: true,
      warnings: [{ level: 'bad', text: `${lateN} customers ran out of paid time — about KES ${Math.round(lateN * 2400 / 1000)}k a month waiting. The urgent ones are over a week late; call them first.` },
        { level: 'warn', text: 'Zuri B M-Pesa float is below its 30,000 target. Top up before the weekend.' }],
      stats: { rules: 9, new_tasks: 5, closed: 2, escalated: 0, nudges: 4 } },
      { id: uuid(), mode: 'weekly', window_key: 'weekly:practice', started_at: tsOff(-1, 16), status: 'done', used_ai: true, warnings: [], stats: { rules: 12 },
        report: `*This week at Zuri (the manager's summary)*\nCollections held up: most customers renewed on time, but ${lateN} are cut off and about KES ${Math.round(lateN * 2400 / 1000)}k a month is waiting. The day-3 calls are where customers come back — keep them first each morning.\nService was calmer: faults were fixed in under a day on average; one cable cut by the road works took Brian most of Wednesday.\nMoney: bills are on track; Zuri B's M-Pesa float is below its 30,000 target.\n\n*Three decisions for the partners*\n1. Top up the Zuri B float before Monday — why: the Bayobab backhaul is due on the 10th and the float can't cover it.\n2. Ask the county about the road works on Kamuyu road — why: a second cut there would take 15 customers offline.\n3. Agree who approves payments when Jerry is travelling — why: money now needs a second person's OK, so payments wait without one.` }];
    D.nudges = PEOPLE.filter((p) => p.phone && p.role !== 'admin').slice(0, 4).map((p) => ({ id: uuid(), day: new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10) /* Kenya's day */, profile_id: p.id, phone: p.phone, sent_at: null,
      message: `Good morning ${p.full_name.split(' ')[0]} 👋\nYour Zuri list today:\n${D.tasks.filter((t) => t.assigned_to === p.id || (t.assigned_group === ({ field: 'field', callcenter: 'callcenter', internal: p.dept }[p.role]))).slice(0, 3).map((t) => '• ' + t.title).join('\n') || '• Check your jobs'}\nOpen Zuri → Tasks` }));

    // 7 Oct deep check #35: the same category names as the real database (supabase/4_seed.sql, 7_statements.sql).
    // money
    const m = ym();
    D.bills = [
      ['A', 'Safaricom backhaul', 45000, 45000, 5, 'Telecom / Network'], ['A', 'Office rent', 15000, 15000, 1, 'Rent & Utilities'], ['A', 'KPLC prepaid', 3500, 0, new Date().getDate(), 'Rent & Utilities'] /* always due today, so the Pay run has something to show */,
      ['A', 'Staff transport', 6000, 2000, 25, 'Transport / Fuel'], ['B', 'Bayobab backhaul', 28000, 0, 10, 'Telecom / Network'], ['B', 'Pole rent', 4000, 0, 28, 'Rent & Utilities'],
    ].map(([area, name, amount, paid_amount, due_day, category]) => ({ id: uuid(), area, month: m, name, amount, paid_amount, paid: paid_amount >= amount, due_day, category, paid_date: paid_amount ? dayOff(-3) : null,
      pay_to: /KPLC/.test(name) ? 'Paybill 888880 · Acc 54123456' : /Safaricom|Bayobab/.test(name) ? 'Paybill 100100 · Acc ZF-' + area : /rent/i.test(name) ? '0711 222 333' : null }));
    D.cash_counts = [
      { id: uuid(), area: 'A', date: dayOff(-3), bank: 182000, mpesa: 41000, counted_by: 'Kelvin', note: null, created_at: tsOff(-3) },
      { id: uuid(), area: 'B', date: dayOff(-3), bank: 64000, mpesa: 21000, counted_by: 'Kelvin', note: null, created_at: tsOff(-3) },
    ];
    D.expenses = [
      { id: uuid(), area: 'A', date: dayOff(-3), payee: 'Safaricom backhaul', category: 'Telecom / Network', amount: 45000, paid_from: 'Bank', ref: 'FT26273XK', approved_by: 'Pre-approved (bill)', receipt: 'Digital / M-Pesa msg', note: 'Bill payment', recorded_by: 'Kelvin', created_by: 'p-kelvin', vat_amount: 0, supplier_pin: null, created_at: tsOff(-3) },
      { id: uuid(), area: 'A', date: dayOff(-4), payee: 'Mama Njeri Hardware', category: 'Equipment / Inventory', amount: 2400, paid_from: 'Cash', ref: null, approved_by: 'Dickson', receipt: 'No — chase it', note: 'Cable clips', recorded_by: 'Kelvin', created_by: 'p-kelvin', vat_amount: 0, supplier_pin: null, created_at: tsOff(-4) },
    ].concat(receiptSeeds());
    D.cash_in = [
      { id: uuid(), area: 'A', date: dayOff(-1), category: 'Hotspot', amount: 4300, received_to: 'M-Pesa', from_name: 'Hotspot sales', ref: null, note: null, recorded_by: 'Kelvin' },
      { id: uuid(), area: 'A', date: dayOff(-4), category: 'Installation fee', amount: 3500, received_to: 'M-Pesa', from_name: 'Daniel Ndungu', ref: 'UJ4MZ81QPA', note: null, recorded_by: 'Kelvin' },
    ];
    D.expense_categories = ['Payroll', 'Rent & Utilities', 'Telecom / Network', 'Equipment / Inventory', 'Transport / Fuel', 'Bank & M-Pesa Fees', 'Marketing', 'Loan Repayment', 'Other'].map((name, i) => ({ name, sort: i }));
    D.staff = [
      { id: 's-peter', profile_id: 'p-peter', full_name: 'Peter Kamau', job_title: 'Field technician', area: 'A', phone: '0722500500', mpesa_number: '0722500500', mpesa_name: 'PETER KAMAU', pay_type: 'monthly', salary: 25000, pay_day: 28, active: true, start_date: dayOff(-400) },
      { id: 's-brian', profile_id: 'p-brian', full_name: 'Brian Otieno', job_title: 'Field technician', area: 'A', phone: '0733600600', mpesa_number: '0733600600', mpesa_name: 'BRIAN OTIENO', pay_type: 'monthly', salary: 22000, pay_day: 28, active: true, start_date: dayOff(-200) },
      { id: 's-faith', profile_id: 'p-faith', full_name: 'Faith Achieng', job_title: 'Field technician', area: 'B', phone: '0744700700', mpesa_number: '0744700700', mpesa_name: 'FAITH ACHIENG', pay_type: 'monthly', salary: 22000, pay_day: 28, active: true, start_date: dayOff(-150) },
      { id: 's-mary', profile_id: 'p-mary', full_name: 'Mary Wanjiku', job_title: 'Call center', area: null, phone: '0711400400', mpesa_number: '0711400400', mpesa_name: 'MARY WANJIKU', pay_type: 'monthly', salary: 18000, pay_day: new Date().getDate(), active: true, start_date: dayOff(-90) },
      { id: 's-casual', profile_id: null, full_name: 'Joseph Mutua', job_title: 'Casual (pole work)', area: 'A', phone: '0755900900', mpesa_number: '0755900900', mpesa_name: 'JOSEPH MUTUA', pay_type: 'daily', salary: 800, pay_day: 28, active: true, start_date: null },
    ];
    D.pay_items = [];
    D.payees = [{ name: 'KPLC prepaid', category: 'Rent & Utilities' }, { name: 'Safaricom backhaul', category: 'Telecom / Network' }, { name: 'Mama Njeri Hardware', category: 'Equipment / Inventory' }];

    // statements
    D.categories = [
      ['Customer payment', 'income'], ['Subscription collections', 'income'], ['Hotspot', 'income'], ['Installation fee', 'income'], ['Reconnection fee', 'income'], ['Equipment sale', 'income'], ['Other income', 'income'],
      ['Transfer between accounts', 'transfer'], ['Cash withdrawal', 'transfer'], ['Cash deposit', 'transfer'], ['Owner funding (Jerry)', 'owner'], ['Partner drawings', 'owner'], ['Ignore (personal / not Zuri)', 'ignore'],
    ].concat(D.expense_categories.map((c) => [c.name, 'expense'])).map(([name, flow], i) => ({ name, flow, sort: i }));
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
      L('acct-a-mpesa', 14, 'Pay Bill to 888880 - KPLC PREPAID', 0, 2000, 'Rent & Utilities'),
    ];
    D.sort_rules = [{ id: uuid(), match: 'KPLC', direction: 'out', category: 'Rent & Utilities' }];
    const months = [-3, -2, -1, 0].map((k) => { const d = new Date(); d.setMonth(d.getMonth() + k, 1); return ymd(d); });
    D.v_books = [];
    months.forEach((mo, i) => {
      const grow = 1 + i * 0.05;
      [['income', 'Subscription collections', 690000 * grow], ['income', 'Hotspot', 120000 * grow], ['income', 'Installation fee', 21000 + i * 3500],
       ['expense', 'Telecom / Network', 73000], ['expense', 'Payroll', 180000], ['expense', 'Rent & Utilities', 19000], ['expense', 'Rent & Utilities', 7000 + i * 300], ['expense', 'Transport / Fuel', 14000], ['expense', 'Equipment / Inventory', 26000 - i * 2000], ['expense', 'Bank & M-Pesa Fees', 4100]]
        .forEach(([flow, category, v]) => D.v_books.push({ month: mo, area: 'A', flow, category, money_in: flow === 'income' ? Math.round(v * (i === 3 ? 0.55 : 1)) : 0, money_out: flow === 'expense' ? Math.round(v * (i === 3 ? 0.55 : 1)) : 0, lines: 20 }));
    });
    D.v_books.push({ month: months[3], area: 'A', flow: 'unsorted', category: null, money_in: 0, money_out: 0, lines: 12 });
    D.billing_snapshots = months.slice(0, 3).map((mo, i) => ({ period: mo.slice(0, 7), fixed: 760000 + i * 12000, hotspot: 140000 + i * 4000 }));
    // company card + hubs (pretend places around Maai Mahiu town)
    D.settings = [{ key: 'company_profile', value: { name: 'Zuri Fiber', town: 'Maai Mahiu', phone: '0700 123 456', whatsapp: '0700 123 456', email: 'info@zurifiber.example', address: 'Main road, next to the stage', paybill: '4012345', till: null, kra_pin: 'P051234567X', website: null } }];
    D.hubs = [
      { id: 'h1', name: 'Main office', kind: 'office', area: null, lat: -0.9862, lng: 36.5885, landmark: 'Main road, next to the stage', note: 'Keys with Kelvin', active: true, created_at: tsOff(-90), updated_at: tsOff(-90) },
      { id: 'h2', name: 'OLT room', kind: 'olt', area: 'A', lat: -0.9878, lng: 36.5871, landmark: 'Behind the office', note: 'Battery backup 4 hours', active: true, created_at: tsOff(-90), updated_at: tsOff(-90) },
      { id: 'h3', name: 'Cabinet A-1', kind: 'hub', area: 'A', lat: -0.9915, lng: 36.5810, landmark: 'Near the market', note: null, active: true, created_at: tsOff(-60), updated_at: tsOff(-60) },
      { id: 'h4', name: 'Cabinet B-1', kind: 'hub', area: 'B', lat: -0.9790, lng: 36.5985, landmark: 'Railway crossing', note: null, active: true, created_at: tsOff(-40), updated_at: tsOff(-40) },
      { id: 'h5', name: 'Hill tower', kind: 'tower', area: 'B', lat: -0.9745, lng: 36.6040, landmark: 'On the escarpment road', note: 'Wireless link to B', active: true, created_at: tsOff(-30), updated_at: tsOff(-30) },
    ];
    D.settings.push({ key: 'receipts_ai', value: { on: false } });
    tsSeed(D);
    D.statement_lines.push(
      { ...L('acct-a-mpesa', 3, 'Merchant Payment to 5523XX - KAMAU HARDWARE', 0, 2600, 'Equipment / Inventory'), ref: 'UJ5K7PQ2LM', expense_id: 'e-kamau' },
      { ...L('acct-a-mpesa', 1, 'Merchant Payment to 7788XX - TOTAL ENERGIES MAAI MAHIU', 0, 2000, null), ref: 'UJ9T4R2WZE' });
    D._rc = 1;
    D.v_people = D.profiles.map(({ id, full_name, role, dept, area, active, phone }) => ({ id, full_name, role, dept, area, active, phone }));
    D._ticket_no = no;
    if (mode === 'empty') {
      Object.assign(D, { v_customers: [], payments: [], tickets: [], ticket_events: [], ticket_parts: [], tasks: [], task_comments: [], agent_runs: [], nudges: [],
        bills: [], cash_counts: [], expenses: [], cash_in: [], money_accounts: [], statement_lines: [], sort_rules: [], v_books: [], billing_snapshots: [], custom_field_defs: [], staff: [], pay_items: [], hubs: [] });
      D.settings = [{ key: 'company_profile', value: { name: 'Zuri Fiber', town: 'Maai Mahiu' } }, { key: 'receipts_ai', value: { on: false } }];
      tsSeed(D, true);
      D.profiles = D.profiles.map((p) => ({ ...p, active: p.role === 'admin' })); // only the partner is switched on; you switch the others on
      D._ticket_no = 100;
    }
    D.packages = mode === 'empty' ? [] : PKGS(); // 💲 v2.35: the price list (Admin → Price list)
    projSeed(D, mode === 'empty');
    if (mode !== 'empty') { receiptRules(D); tsRules(D); D.nudges.forEach((n) => { const t = D.tasks.find((x) => x.assigned_to === n.profile_id && String(x.ref_key || '').startsWith('rcpt-')); if (t) n.message = n.message.replace('\nOpen Zuri', '\n• ' + t.title + '\nOpen Zuri'); }); }
    emSeed(D);
    return D;
  }

  // ---------- 📈 projects (v2.34): Suswa went live 5 months ago (with actuals), Narok is still a plan. All numbers made up. ----------
  function projSeed(DB, empty) {
    DB._pj = 1;
    DB.projects = DB.projects || []; DB.project_revisions = DB.project_revisions || []; DB.project_actuals = DB.project_actuals || [];
    if (empty || DB.projects.some((x) => x.id === 'pj-suswa')) return;
    if (!DB.areas.some((a) => a.code === 'D')) DB.areas.push({ code: 'D', name: 'Zuri D · Suswa', float_target: 20000, active: true });
    const ymOff = (k) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + k); return ymd(d).slice(0, 7); };
    const launch = ymOff(-5) + '-01', approved = ymOff(-6) + '-20T09:00:00.000Z', asked = ymOff(-6) + '-18T15:00:00.000Z';
    const plan = (o) => {
      const b = { v: 1, start: { fiber_km: 0, fiber_rate: 0, poles: 0, olt: 0, labour: 0, permits: 0, office: 0, launch: 0, cont_pct: 10, other: [] }, cpe: { each: 0, who: 'zuri' },
        run: { backhaul: 0, backhaul_preset: '', staff_n: 0, salary: 0, rent: 0, power: 0, transport: 0, maint_pct: 0, marketing: 0, other: [] },
        rev: { homes: 0, mode: 'curve', c1: 0, c3: 0, c6: 0, c12: 0, c24: 0, pct: 0, pct_month: 12, arpu: 0, install_fee: 0, churn_pct: 0, price_pct: 0, price_month: 0 }, loan: { on: false, amount: 0, rate: 0, months: 0 } };
      Object.keys(o).forEach((k) => Object.assign(b[k], o[k])); return b;
    };
    const suswaBase = plan({ start: { fiber_km: 6, fiber_rate: 280000, poles: 350000, olt: 650000, labour: 420000, permits: 120000, office: 250000, launch: 150000, cont_pct: 10 }, cpe: { each: 3500, who: 'zuri' },
      run: { backhaul: 14000, backhaul_preset: 'bayobab100', staff_n: 2, salary: 22000, rent: 12000, power: 6000, transport: 8000, maint_pct: 5, marketing: 10000 },
      rev: { homes: 900, mode: 'curve', c1: 25, c3: 60, c6: 110, c12: 190, c24: 300, arpu: 1800, install_fee: 2500, churn_pct: 2 } });
    const suswaNow = JSON.parse(JSON.stringify(suswaBase)); suswaNow.start.fiber_rate = 310000; suswaNow.rev.c6 = 95; suswaNow.rev.c12 = 170;
    DB.projects.push(
      { id: 'pj-suswa', name: 'Suswa (example)', area: 'D', status: 'live', notes: 'EXAMPLE — made-up numbers. ~80 km from Nairobi on the B8; farms, traders and Mt Suswa visitors.', plan: suswaNow, baseline: suswaBase, launch_date: launch,
        go_requested_by: 'p-kelvin', go_requested_at: asked, approved_by: 'p-jerry', approved_at: approved, created_by: 'p-kelvin', created_at: ymOff(-7) + '-05T10:00:00.000Z', updated_at: ymOff(-2) + '-10T10:00:00.000Z' },
      { id: 'pj-narok', name: 'Narok (example)', area: null, status: 'plan', notes: 'EXAMPLE — made-up numbers. The bigger, later bet: gateway to the Mara, lodges and town homes.',
        plan: plan({ start: { fiber_km: 15, fiber_rate: 300000, poles: 900000, olt: 1200000, labour: 1100000, permits: 400000, office: 600000, launch: 400000, cont_pct: 15 }, cpe: { each: 3500, who: 'zuri' },
          run: { backhaul: 53200, backhaul_preset: 'saf200', staff_n: 4, salary: 25000, rent: 30000, power: 15000, transport: 20000, maint_pct: 5, marketing: 25000 },
          rev: { homes: 3000, mode: 'pct', pct: 25, pct_month: 24, arpu: 2200, install_fee: 3000, churn_pct: 2.5 }, loan: { on: true, amount: 5000000, rate: 16, months: 36 } }),
        baseline: null, launch_date: null, created_by: 'p-jerry', created_at: tsOff(-12), updated_at: tsOff(-2) });
    const R = (kind, at, by, why, changes) => ({ id: uuid(), project_id: kind[0], kind: kind[1], at, by, by_name: (PEOPLE.find((x) => x.id === by) || {}).full_name, why: why || null, changes: changes || null });
    DB.project_revisions.push(
      R(['pj-suswa', 'created'], ymOff(-7) + '-05T10:00:00.000Z', 'p-kelvin'),
      R(['pj-suswa', 'go_requested'], asked, 'p-kelvin', 'Launch ' + launch),
      R(['pj-suswa', 'go_approved'], approved, 'p-jerry', 'Plan locked as the baseline'),
      R(['pj-suswa', 'forecast'], ymOff(-2) + '-10T10:00:00.000Z', 'p-kelvin', 'Kamau Hardware\'s fiber quote went up to 310,000 a km, and sign-ups are slower than hoped', [{ label: 'Fiber KES per km', from: 280000, to: 310000 }, { label: 'Sign-ups by month 6', from: 110, to: 95 }, { label: 'Sign-ups by month 12', from: 190, to: 170 }]),
      R(['pj-narok', 'created'], tsOff(-12), 'p-jerry'));
    const A = (period, kind, amount, line, note, by = 'p-kelvin') => ({ id: uuid(), project_id: 'pj-suswa', period, kind, line: line || null, amount, note: note || null, created_by: by, by_name: by === 'p-kelvin' ? 'Kelvin' : 'Jerry (owner)', created_at: tsOff(-30) });
    const pre = ymOff(-6);
    [['fiber', 1950000], ['poles', 340000], ['olt', 640000], ['labour', 560000], ['permits', 150000], ['office', 260000], ['launch', 160000]].forEach(([l, v]) => DB.project_actuals.push(A(pre, 'startup', v, l, 'Example build cost')));
    DB.project_actuals.push(A(pre, 'startup', 180000, 'other', 'Extra poles — the county moved the route'));
    // months 1–4 confirmed; month 5 (last month) still waits for finance — Zuri fills it from the billing website
    [[18, 62400, 18], [41, 116300, 23], [58, 131900, 17], [72, 149600, 14]].forEach(([c, rv, n], i) => { const ym = ymOff(-5 + i); DB.project_actuals.push(A(ym, 'customers', c), A(ym, 'revenue', rv), A(ym, 'running', 44000, 'staff'), A(ym, 'running', 12000, 'rent'), A(ym, 'running', 7500, 'power'), A(ym, 'running', 9000, 'transport'), A(ym, 'running', 12000, 'marketing'), A(ym, 'running', n * 3500, 'other', `Routers for ${n} new customers`)); });
    DB.project_actuals.push(A(ymOff(-1), 'running', 44000, 'staff'), A(ymOff(-1), 'running', 12000, 'rent'), A(ymOff(-1), 'running', 49000, 'other', 'Routers for 14 new customers'));
    DB.billing_snapshots.push({ area: 'D', period: ymOff(-1), fixed_sales: 154800, fixed_subs: 86, hotspot_sales: 9000, hotspot_sessions: 610 });
    // the Bayobab line for Suswa, paid each month from Money out and tagged to the project
    for (let k = -5; k <= -1; k++) DB.expenses.push({ id: 'e-sus' + (k + 6), area: 'D', date: ymOff(k) + '-10', payee: 'Bayobab (Suswa)', category: 'Telecom / Network', amount: 14000, paid_from: 'M-Pesa', ref: 'UJSUS' + (k + 6) + 'BYB', approved_by: 'Jerry (owner)', approved_by_id: 'p-jerry', approval: 'approved', receipt: 'Digital / M-Pesa msg', note: 'Suswa backhaul', recorded_by: 'Kelvin', created_by: 'p-kelvin', vat_amount: 0, supplier_pin: null, project_id: 'pj-suswa', created_at: tsOff(30 * k) });
    if (DB.tasks) DB.tasks.push({ id: uuid(), title: `Confirm Suswa (example)'s customers and money for ${new Date(ymOff(-1) + '-15').toLocaleDateString('en-GB', { month: 'long' })}`, details: 'Each month: 📈 Projects → Suswa → confirm last month\'s customers connected and money collected (Zuri fills in what it found), and add any cost not in Money out.', assigned_to: null, assigned_group: 'finance', created_by: null, source: 'agent', kind: 'todo', priority: 'normal', due_date: today(), status: 'open', visibility: 'finance', link_type: 'page', link_ref: 'projects/pj-suswa/track', ref_key: 'project-actuals:pj-suswa:' + ymOff(-1), opened_at: tsOff(0, 6), updated_at: tsOff(0, 6), escalation_level: 0 });
  }

  // ---------- 🧾 receipts (v2.32): sample spends with photos, and the manager's missing-receipt rules ----------
  // Pretend receipts drawn on the phone (no real people; shops are typical Maai Mahiu ones).
  const RC = {
    total: { shop: 'TOTAL ENERGIES', sub: ['MAAI MAHIU SERVICE STATION', 'Naivasha Road, Maai Mahiu'], pin: 'P051470082K', items: [['Super Petrol 7.85 L @ 191.10', 1, 1500]], vat: 207, pay: 'CASH', till: null, code: null },
    naivas: { shop: 'NAIVAS', sub: ['Maai Mahiu Branch', 'Tel 0709 865 000'], pin: 'P051188453Q', items: [['A4 Paper Ream 500s', 1, 650], ['Biro Pens x10', 1, 240], ['Duct Tape 48mm', 2, 175]], vat: 171, pay: 'M-PESA', till: '5512XX', code: 'UJ8N2K4XQA' },
    kamau: { shop: 'KAMAU HARDWARE', sub: ['Opp. Matatu Stage, Maai Mahiu', 'Tel 0722 418 9XX'], pin: 'A009876543Z', items: [['SC/APC Connector', 10, 120], ['Drop Cable 1-core (m)', 50, 25], ['Cable Ties (pk)', 2, 75]], vat: 359, pay: 'M-PESA', till: '5523XX', code: 'UJ5K7PQ2LM' },
    'kamau-new': { shop: 'KAMAU HARDWARE', sub: ['Opp. Matatu Stage, Maai Mahiu', 'Tel 0722 418 9XX'], pin: 'A009876543Z', items: [['Fibre Splice Sleeves (pk)', 1, 450], ['SC/APC Connector', 6, 120], ['Insulation Tape', 2, 90]], vat: 172, pay: 'M-PESA', till: '5523XX', code: 'UJ7H3M9KDA' },
    'rubis-new': { shop: 'RUBIS ENERGY', sub: ['Maai Mahiu', 'Mai Mahiu–Narok Road'], pin: 'P051099120M', items: [['Unleaded 5.24 L @ 191.00', 1, 1000]], vat: 138, pay: 'CASH', till: null, code: null },
  };
  const total = (r) => r.items.reduce((t, [, q, p]) => t + q * p, 0);
  function receiptSeeds() {
    // Photo receipts stay inside this month, so Money out (this month only) always shows them in the videos.
    const inMonth = (d) => (d < ym() + '-01' ? ym() + '-01' : d);
    const E = (o) => ({ approved_by: null, note: null, vat_amount: 0, supplier_pin: null, ref: null, receipt_path: null, ticket_id: null, ...o, created_at: tsOff(-(o._d || 0), 15) });
    return [
      E({ id: 'e-total', approval: 'waiting', area: 'A', date: inMonth(dayOff(-1)), _d: 1, payee: 'Total Energies Maai Mahiu', category: 'Transport / Fuel', amount: 1500, paid_from: 'Cash', receipt: 'Photo saved', receipt_path: 'seed/total.jpg', recorded_by: 'Peter Kamau', created_by: 'p-peter', vat_amount: 207, supplier_pin: 'P051470082K', note: 'Motorbike fuel for the market jobs' }),
      E({ id: 'e-naivas', approval: 'approved', approved_by: 'Jerry (owner)', approved_by_id: 'p-jerry', area: 'A', date: inMonth(dayOff(-2)), _d: 2, payee: 'Naivas Maai Mahiu', category: 'Other', amount: 1240, paid_from: 'M-Pesa', ref: 'UJ8N2K4XQA', receipt: 'Photo saved', receipt_path: 'seed/naivas.jpg', recorded_by: 'Kelvin', created_by: 'p-kelvin', vat_amount: 171, supplier_pin: 'P051188453Q', note: 'Office paper, pens, tape' }),
      E({ id: 'e-kamau', approval: 'approved', approved_by: 'Kelvin', approved_by_id: 'p-kelvin', area: 'A', date: inMonth(dayOff(-3)), _d: 3, payee: 'Kamau Hardware', category: 'Equipment / Inventory', amount: 2600, paid_from: 'M-Pesa', ref: 'UJ5K7PQ2LM', receipt: 'Photo saved', receipt_path: 'seed/kamau.jpg', recorded_by: 'Brian Otieno', created_by: 'p-brian', vat_amount: 359, supplier_pin: 'A009876543Z', note: '10 connectors, 50 m drop cable' }),
      E({ id: 'e-chase', approval: 'waiting', area: 'A', date: dayOff(-4), _d: 4, payee: 'Kamau Hardware', category: 'Equipment / Inventory', amount: 3850, paid_from: 'Cash', receipt: 'No — chase it', recorded_by: 'Peter Kamau', created_by: 'p-peter', note: 'Splitter box and pigtails' }),
      E({ id: 'e-rubis', approval: 'approved', approved_by: 'Kelvin', approved_by_id: 'p-kelvin', area: 'B', date: dayOff(-5), _d: 5, payee: 'Rubis Maai Mahiu', category: 'Transport / Fuel', amount: 1000, paid_from: 'Cash', receipt: 'Paper receipt — filed', recorded_by: 'Faith Achieng', created_by: 'p-faith' }),
    ];
  }
  function drawReceipt(spec) {
    const W = 560, items = spec.items, H = 470 + items.length * 34 + (spec.code ? 34 : 0);
    const cv = document.createElement('canvas'); cv.width = W + 80; cv.height = H + 80;
    const c = cv.getContext('2d');
    c.fillStyle = '#6b6156'; c.fillRect(0, 0, cv.width, cv.height); // a wooden table
    c.save(); c.translate(40, 40); c.rotate(-0.012);
    c.fillStyle = '#fbfaf5'; c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 12; c.fillRect(0, 0, W, H); c.shadowBlur = 0;
    c.fillStyle = '#222'; c.textAlign = 'center';
    let y = 48;
    const line = (t, size = 20, bold = false, align = 'center', x = W / 2) => { c.font = `${bold ? 'bold ' : ''}${size}px "Courier New", monospace`; c.textAlign = align; c.fillText(t, x, y); y += size + 10; };
    line(spec.shop, 30, true); spec.sub.forEach((t) => line(t, 18)); line('PIN: ' + spec.pin, 18);
    line('-'.repeat(38), 18);
    const d = new Date(Date.now() - 864e5); line(`Date ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}  Time 10:42`, 18);
    line('-'.repeat(38), 18);
    items.forEach(([n, q, p]) => { c.font = '18px "Courier New", monospace'; c.textAlign = 'left'; c.fillText((q > 1 ? q + ' x ' : '') + n, 24, y); c.textAlign = 'right'; c.fillText((q * p).toLocaleString('en-KE') + '.00', W - 24, y); y += 34; });
    line('-'.repeat(38), 18);
    c.font = 'bold 24px "Courier New", monospace'; c.textAlign = 'left'; c.fillText('TOTAL KES', 24, y); c.textAlign = 'right'; c.fillText(total(spec).toLocaleString('en-KE') + '.00', W - 24, y); y += 38;
    line(`VAT 16% incl.  ${spec.vat.toLocaleString('en-KE')}.00`, 18, false, 'left', 24);
    line(`Paid: ${spec.pay}${spec.till ? '  Till ' + spec.till : ''}`, 18, false, 'left', 24);
    if (spec.code) line('M-PESA Ref: ' + spec.code, 18, true, 'left', 24);
    line('-'.repeat(38), 18); line('Asante! Karibu tena', 20, true); line('PRACTICE RECEIPT', 14);
    c.restore();
    return cv;
  }
  const seedUrls = {};
  const seedUrl = (path) => { const k = (path.match(/^seed\/([a-z-]+)\.jpg$/) || [])[1]; if (!k || !RC[k]) return null; return seedUrls[k] || (seedUrls[k] = drawReceipt(RC[k]).toDataURL('image/jpeg', 0.8)); };
  // Photos "uploaded" in practice stay in this phone's practice storage.
  const idb = () => new Promise((ok, no) => { const r = indexedDB.open('zuri_practice', 1); r.onupgradeneeded = () => r.result.createObjectStore('blobs'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const idbDo = async (mode, fn) => { const db = await idb(); return new Promise((ok, no) => { const tx = db.transaction('blobs', mode); const q = fn(tx.objectStore('blobs')); tx.oncomplete = () => ok(q && q.result); tx.onerror = () => no(tx.error); }); };
  async function practiceUrl(path) {
    const s = seedUrl(path); if (s) return s;
    if (blobs.has(path)) return blobs.get(path);
    try { const v = await idbDo('readonly', (st) => st.get('rcfile:' + path)); const b = !v ? null : v instanceof Blob ? v : v.buf ? new Blob([v.buf], { type: v.type || 'image/jpeg' }) : null; if (b) { const u = URL.createObjectURL(b); blobs.set(path, u); return u; } } catch (e) {}
    return null;
  }
  // The rules the real manager runs each morning (22_receipts.sql), on the pretend company.
  function receiptRules(DB) {
    const t0 = today(), dd = (a, b) => Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / DAY);
    const want = [];
    const chase = DB.expenses.filter((e) => e.receipt === 'No — chase it' && dd(t0, e.date) >= 2 && dd(t0, e.date) <= 90);
    const by = {};
    chase.forEach((e) => { const pr = DB.profiles.find((p) => p.id === e.created_by && p.active); const k = pr ? pr.id : 'finance'; (by[k] = by[k] || []).push(e); });
    Object.entries(by).forEach(([k, es]) => {
      const sum = es.reduce((t, e) => t + Number(e.amount), 0), pr = DB.profiles.find((p) => p.id === k);
      const fin = !pr || pr.role === 'admin' || (pr.role === 'internal' && pr.dept === 'finance');
      want.push({ ref_key: 'rcpt-chase:' + k, title: `Find ${es.length} missing receipt${es.length > 1 ? 's' : ''} — KES ${sum.toLocaleString('en-KE')}`,
        details: fin ? 'Saved with "No — chase it" more than 2 days ago: ' + es.slice(0, 5).map((e) => `${e.payee} KES ${Number(e.amount).toLocaleString('en-KE')} (${e.date.slice(8)}/${e.date.slice(5, 7)})`).join(', ') + '. Ask the shop for the receipt and snap it (Me → 🧾 My receipts → Snap it now), or file the paper copy.'
          : 'Saved with "No — chase it" more than 2 days ago. Open Me → 🧾 My receipts to see which, ask the shop, then tap 📸 Snap it now.',
        assigned_to: pr ? k : null, assigned_group: pr ? null : 'finance', visibility: fin ? 'finance' : 'team', priority: 'normal', link_type: 'page', link_ref: fin ? 'money/expense' : 'receipt/mine' });
    });
    const accts = Object.fromEntries(DB.money_accounts.map((a) => [a.id, a]));
    const flow = Object.fromEntries(DB.categories.map((c) => [c.name, c.flow]));
    DB.statement_lines.filter((l) => l.money_out >= 500 && !l.expense_id && dd(t0, l.date) >= 3 && dd(t0, l.date) <= 30 && (flow[l.category] || 'expense') === 'expense' && l.category !== 'Bank & M-Pesa Fees')
      .filter((l) => !DB.expenses.some((e) => (l.ref && String(e.ref || '').toUpperCase() === l.ref.toUpperCase()) || (Number(e.amount) === Number(l.money_out) && Math.abs(dd(e.date, l.date)) <= 2 && (!accts[l.account_id] || e.area === accts[l.account_id].area))))
      .sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 12)
      .forEach((l) => { const who = String(l.details).replace(/^.*\s-\s/, '').replace(/^[0-9*X]+\s*/, '').toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()); const a = accts[l.account_id] || {};
        want.push({ ref_key: 'rcpt-line:' + l.id, title: `Snap the receipt for KES ${Number(l.money_out).toLocaleString('en-KE')} to ${who} on ${l.date.slice(8)}/${l.date.slice(5, 7)}`,
          details: `Money left ${a.name || 'an account'} on ${l.date} (${l.ref || 'no code'}) but no expense in Zuri has this code. Find out what it was for, then Money out → 📸 Snap a receipt and type the code so they link. Not a Zuri cost? Sort it in Money → To sort.`,
          assigned_to: null, assigned_group: 'finance', visibility: 'finance', priority: 'normal', link_type: 'page', link_ref: 'money/expense', area: a.area || null }); });
    let n = 0, closed = 0;
    want.forEach((w) => { const ex = DB.tasks.find((t) => t.ref_key === w.ref_key);
      if (ex) { if (ex.status !== 'cancelled') Object.assign(ex, w, { status: 'open' }); }
      else { DB.tasks.push({ id: uuid(), source: 'agent', kind: 'todo', status: 'open', created_by: null, due_date: t0, opened_at: new Date().toISOString(), updated_at: new Date().toISOString(), escalation_level: 0, ...w }); n++; } });
    DB.tasks.filter((t) => String(t.ref_key || '').startsWith('rcpt-') && t.status === 'open' && !want.some((w) => w.ref_key === t.ref_key)).forEach((t) => { t.status = 'done'; closed++; });
    return { new_tasks: n, closed, rules: want.length };
  }
  // ---------- ⏱ time savers (v2.33): the same rules as supabase/25_time_savers.sql, on the pretend company ----------
  function tsSeed(DB, empty) {
    const set = (key, value) => { if (!DB.settings.some((x) => x.key === key)) DB.settings.push({ key, value }); };
    set('money_approval', { on: true, over: 0 }); set('outage_rule', { faults: 3, hours: 2 }); set('tax_reminders', { payroll: true, vat: true });
    DB.outages = DB.outages || []; DB.money_approval_log = DB.money_approval_log || [];
    DB._ts = 1;
    if (empty) return;
    // Kelvin paid the Bayobab backhaul yesterday; it waits for a second person (Jerry) before the bill counts it.
    const b = (DB.bills || []).find((x) => /Bayobab/.test(x.name));
    const day = dayOff(-1) < ym() + '-01' ? today() : dayOff(-1);
    if (b && !DB.expenses.some((e) => e.id === 'e-wait-bayobab')) DB.expenses.push({ id: 'e-wait-bayobab', area: b.area, date: day, category: b.category, payee: b.name, amount: b.amount, paid_from: 'M-Pesa', ref: 'UJ6W3PBAYB', approved_by: null, receipt: 'Digital / M-Pesa msg', note: 'Bill payment', recorded_by: 'Kelvin', created_by: 'p-kelvin', bill_id: b.id, vat_amount: 0, supplier_pin: null, approval: 'waiting', approved_by_id: null, approved_at: null, created_at: tsOff(-1, 11) });
  }
  // The manager's new rules: payments waiting for an OK, open outages, the outage notice, tax dates.
  function tsRules(DB) {
    const t0 = today(), want = [], now = Date.now();
    const wait = DB.expenses.filter((e) => e.approval === 'waiting');
    if (wait.length) {
      const kes = wait.reduce((t, e) => t + Number(e.amount), 0), oldest = Math.min(...wait.map((e) => new Date(e.created_at || now).getTime()));
      want.push({ ref_key: 'approvals-waiting', title: `OK ${wait.length} payment${wait.length > 1 ? 's' : ''} waiting for a second person — KES ${kes.toLocaleString('en-KE')}`,
        details: 'Money out counts only after someone OTHER than the person who recorded it taps ✅ Approve: Money → Bills → 👥 Approvals (also on Home). Field techs\' receipts wait here too, for finance to confirm.',
        assigned_to: null, assigned_group: 'finance', visibility: 'finance', priority: oldest < now - 864e5 ? 'high' : 'normal', link_type: 'page', link_ref: 'money/approvals', area: null });
    }
    (DB.outages || []).filter((o) => o.status === 'open').forEach((o) => {
      const an = (DB.areas.find((a) => a.code === o.area) || {}).name || 'Zuri ' + o.area;
      if (!DB.tasks.some((t) => t.ref_key === 'outage:' + o.id && t.status === 'done')) want.push({ ref_key: 'outage:' + o.id, title: `Possible outage in ${an} — ${o.fault_ids.length} fault calls since ${new Date(o.started_at).toTimeString().slice(0, 5)}`,
        details: `Customers in ${an} called with faults close together. Check the OLT, the cabinet and the backhaul before sending techs house by house. When service is back: Jobs → the outage card → ✅ Service is back.`,
        assigned_to: null, assigned_group: 'technical', visibility: 'team', priority: 'urgent', link_type: 'page', link_ref: 'jobs', area: o.area });
      if (o.notice_status === 'draft') want.push({ ref_key: 'outage-notice:' + o.id, title: `Customer notice for the ${an} outage — your yes?`,
        details: 'Home → the outage card → read the drafted notice, change the words if you like, then ✅ Yes or ✋ No. Nothing is sent by Zuri.',
        assigned_to: null, assigned_group: 'partners', visibility: 'office', priority: 'high', link_type: 'page', link_ref: 'home', area: o.area });
    });
    const tx = ((DB.settings.find((x) => x.key === 'tax_reminders') || {}).value) || {};
    const d = new Date(), dom = d.getDate(), prev = new Date(d.getFullYear(), d.getMonth() - 1, 1).toLocaleDateString('en-GB', { month: 'short' });
    [['tax-payroll', 9, tx.payroll !== false, `PAYE, NSSF, SHA and Housing Levy for ${prev} — due the 9th`, 'Pay and file by the 9th: PAYE and the Housing Levy on iTax, NSSF on the NSSF portal, SHA on the SHA portal. Late filing costs penalties. Tick this when it is done; tell Jerry early if cash is short.'],
     ['tax-vat', 20, tx.vat !== false, `VAT for ${prev} — file and pay by the 20th`, 'File the VAT return on iTax and pay by the 20th — a nil return must still be filed. The expenses with a supplier KRA PIN (receipts) are the VAT you can claim back.']]
      .forEach(([k, due, on, title, details]) => {
        const key = k + ':' + ym();
        if (!on || dom < due - 7 || DB.tasks.some((t) => t.ref_key === key && ['done', 'cancelled'].includes(t.status))) return;
        want.push({ ref_key: key, title, details, assigned_to: null, assigned_group: 'finance', visibility: 'finance', priority: dom >= due ? 'urgent' : dom >= due - 2 ? 'high' : 'normal', link_type: 'page', link_ref: 'money/report', area: null, due_date: ym() + '-' + pad(due) });
      });
    let n = 0, closed = 0;
    want.forEach((w) => { const ex = DB.tasks.find((t) => t.ref_key === w.ref_key);
      if (ex) { if (ex.status !== 'cancelled') Object.assign(ex, w, { status: 'open' }); }
      else { DB.tasks.push({ id: uuid(), source: 'agent', kind: 'todo', status: 'open', created_by: null, due_date: t0, opened_at: new Date().toISOString(), updated_at: new Date().toISOString(), escalation_level: 0, ...w }); n++; } });
    DB.tasks.filter((t) => /^(approvals-waiting|outage:|outage-notice:|tax-)/.test(String(t.ref_key || '')) && t.status === 'open' && !want.some((w) => w.ref_key === t.ref_key)).forEach((t) => { t.status = 'done'; closed++; });
    return { new_tasks: n, closed, rules: want.length };
  }
  // 3+ fault jobs in one area within 2 hours → one outage, one urgent task for technical, a drafted notice for the partners.
  function outageCheck(t) {
    const r = ((D.settings.find((x) => x.key === 'outage_rule') || {}).value) || {};
    const need = Math.max(2, Number(r.faults) || 3), hours = Math.max(0.5, Number(r.hours) || 2), nowIso = new Date().toISOString();
    D.outages = D.outages || [];
    const open = D.outages.find((o) => o.area === t.area && o.status === 'open');
    if (open) { if (!open.fault_ids.includes(t.id)) open.fault_ids.push(t.id); open.last_fault_at = nowIso; return; }
    const since = Date.now() - hours * 3600e3;
    const fs = D.tickets.filter((x) => x.area === t.area && x.kind === 'fault' && x.status !== 'cancelled' && new Date(x.opened_at).getTime() >= since).sort((a, b) => cmp(a.opened_at, b.opened_at));
    if (fs.length < need) return;
    const an = (D.areas.find((a) => a.code === t.area) || {}).name || 'Zuri ' + t.area;
    const co = (((D.settings.find((x) => x.key === 'company_profile') || {}).value) || {}).name || 'Zuri Fiber';
    const o = { id: uuid(), area: t.area, started_at: fs[0].opened_at, last_fault_at: nowIso, fault_ids: fs.map((x) => x.id), status: 'open', notice_status: 'draft', notice_by: null, notice_at: null, closed_by: null, closed_at: null, close_note: null, created_at: nowIso,
      notice: `Hello from ${co}. We know the internet is down in parts of ${an} since ${new Date(fs[0].opened_at).toTimeString().slice(0, 5)} today. Our technicians are working on it now. Sorry for the trouble — there is no need to call; we will tell you as soon as it is back. Asante!` };
    D.outages.push(o);
    const K = (w) => D.tasks.push({ id: uuid(), source: 'agent', kind: 'todo', status: 'open', created_by: null, assigned_to: null, due_date: today(), opened_at: nowIso, updated_at: nowIso, escalation_level: 0, link_type: 'page', area: t.area, ...w });
    K({ ref_key: 'outage:' + o.id, title: `Possible outage in ${an} — ${fs.length} fault calls in ${hours} hours`, assigned_group: 'technical', visibility: 'team', priority: 'urgent', link_ref: 'jobs',
      details: `Several customers in ${an} called with faults close together: ${fs.map((x) => '#' + x.ticket_no + ' ' + String(x.summary).slice(0, 60)).join('; ')}. Check the OLT, the cabinet and the backhaul for the area before sending techs house by house. New fault calls from ${an} join this outage by themselves. When service is back: Jobs → the outage card → ✅ Service is back.` });
    K({ ref_key: 'outage-notice:' + o.id, title: `Customer notice for the ${an} outage — your yes?`, assigned_group: 'partners', visibility: 'office', priority: 'high', link_ref: 'home',
      details: `Zuri drafted a short notice for the customers in ${an}. Home → the outage card → read it, change the words if you like, then ✅ Yes or ✋ No. Nothing is sent by Zuri: after your yes, the office copies it into a WhatsApp broadcast.` });
  }
  // Two people for money out: the setting, and the guards the database applies (25_time_savers.sql).
  const apprSetting = () => ((D.settings.find((x) => x.key === 'money_approval') || {}).value) || { on: true, over: 0 };
  const apprNeeded = (amt) => { const st = apprSetting(); return st.on !== false && Number(amt || 0) > Number(st.over || 0); };
  function moneyInsert(table, row) {
    // 📈 v2.34 (27_area_planner.sql): spending is tagged to the area's live project unless someone chose "not a project"
    if ((table === 'expenses' || table === 'bills') && !row.project_id && !row.no_project) {
      const b = table === 'expenses' && row.bill_id ? (D.bills || []).find((x) => x.id === row.bill_id) : null;
      const live = (D.projects || []).filter((x) => x.status === 'live' && x.area && x.area === row.area);
      row.project_id = (b && b.project_id) || (live.length === 1 ? live[0].id : null);
    }
    if (table === 'expenses') { row.created_by = meId(); row.approved_by_id = null; row.approved_at = null; if (apprNeeded(row.amount)) { row.approval = 'waiting'; row.approved_by = null; } else row.approval = 'not_needed'; }
    if (table === 'pay_items') { if (['waiting', 'sent'].includes(row.status)) row.status = 'due'; row.expense_id = null; }
    if (table === 'bills' && apprSetting().on !== false) { row.paid_amount = 0; row.paid_date = null; row.paid = false; }
  }
  function moneyGuard(table, pl, rows) {
    if (table === 'bills' && apprSetting().on !== false && 'paid_amount' in pl && rows.some((r) => Number(r.paid_amount) !== Number(pl.paid_amount))) return 'A bill is marked paid only through 💸 Pay, after a second person\'s OK.';
    if (table === 'pay_items' && 'status' in pl && rows.some((r) => r.status !== pl.status && (['waiting', 'sent'].includes(pl.status) || ['waiting', 'sent'].includes(r.status)))) return 'Use ✅ Sent — record it. A second person then approves it; it can\'t be marked by hand.';
    if (table === 'expenses' && 'amount' in pl && rows.some((r) => r.bill_id && Number(r.amount) !== Number(pl.amount))) return 'A bill payment\'s amount can\'t be changed. Delete it and pay the bill again.';
    return null;
  }
  function expensePayload(pl, r) {
    const p = { ...pl };
    ['approval', 'approved_by_id', 'approved_at', 'created_by'].forEach((k) => delete p[k]);
    if (['waiting', 'approved'].includes(r.approval)) delete p.approved_by;
    const changed = ['amount', 'payee', 'paid_from', 'area'].some((k) => k in p && String(p[k]) !== String(r[k]));
    if (!['waiting'].includes(r.approval) && changed && apprNeeded(p.amount != null ? p.amount : r.amount)) Object.assign(p, { approval: 'waiting', approved_by_id: null, approved_at: null, approved_by: null });
    return p;
  }
  function unpay(e) {
    if (e.bill_id && e.approval !== 'waiting') { const b = D.bills.find((x) => x.id === e.bill_id); if (b) { b.paid_amount = Math.max(0, Number(b.paid_amount) - Number(e.amount)); b.paid = b.paid_amount >= b.amount; } }
    D.pay_items.filter((x) => x.expense_id === e.id && ['waiting', 'sent'].includes(x.status)).forEach((x) => Object.assign(x, { status: 'due', expense_id: null, sent_at: null }));
    D.statement_lines.filter((l) => l.expense_id === e.id).forEach((l) => { l.expense_id = null; });
  }

  // A pretend photo for the training videos (and the pretend AI knows what is on it).
  let pendingRead = null;
  const SAMPLE_READS = ['kamau-new', 'rubis-new'];
  let sampleI = 0;
  function readFor(key) {
    const r = RC[key]; if (!r) return null;
    const name = r.shop.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()) + (/maai/i.test(r.sub.join(' ')) && !/hardware/i.test(r.shop) ? ' Maai Mahiu' : '');
    return { payee: name, date: dayOff(-1), amount: total(r), vat_amount: r.vat, supplier_pin: r.pin, mpesa_code: r.code, items_summary: r.items.map(([n, q]) => (q > 1 ? q + ' x ' : '') + n).join(', ').slice(0, 120),
      suggested_category: /petrol|unleaded|fuel/i.test(r.items[0][0]) ? 'Transport / Fuel' : /hardware/i.test(r.shop) ? 'Equipment / Inventory' : 'Other', confidence: 0.92 };
  }

  let D;
  try { D = JSON.parse(localStorage.getItem(KEY)); } catch (e) { D = null; }
  const wantMode = (() => { try { return localStorage.getItem('zuri_practice_mode') || 'running'; } catch (e) { return 'running'; } })();
  if (!D || !D.v_customers || (D._mode || 'running') !== wantMode) D = build(wantMode);
  if (!D.hubs) { const f = build(D._mode); D.hubs = f.hubs; D.settings = f.settings; } // phones that started practice before hubs existed
  if (!D._ts) { tsSeed(D, D._mode === 'empty'); }
  if (!D.packages) D.packages = D._mode === 'empty' ? [] : PKGS(); // 💲 v2.35: phones that started practice before the price list
  if (!D._em) emSeed(D); // ✉️ v2.55: phones that started practice before email
  // 🚀 v2.48: the go-live list (golive.js) — the pretend partners have done Part 1 and started Part 2; Dickson is stuck on 3.1.
  if (!D._gl) { D._gl = 1; if (D._mode !== 'empty' && !D.settings.some((x) => x.key === 'golive')) { const at = (d) => new Date(Date.now() + d * 864e5).toISOString();
    D.settings.push({ key: 'golive', value: { done: { '1.1': { by: 'Dickson', at: at(-6), note: 'Did it at the office, both of us.' }, '1.2': { by: 'Kelvin', at: at(-6), note: 'Mondays 8:00' }, '1.3': { by: 'Dickson', at: at(-5) }, '1.4': { by: 'Kelvin', at: at(-5), note: 'Aim: Monday 11 January' }, '2.1': { by: 'Kelvin', at: at(-3), note: 'Google Drive' } },
      later: {}, stuck: { '3.1': { by: 'Dickson', at: at(-1), note: 'We have no spare phone for the company SIM yet.' } }, who: {} } }); } }
  if (!D._pj) projSeed(D, D._mode === 'empty'); // v2.34 // v2.33: phones that started practice before the time savers
  if (!D._rc) { const f = build(D._mode); D.expenses = D.expenses.concat(f.expenses.filter((e) => String(e.id).startsWith('e-'))); if (!D.settings.some((x) => x.key === 'receipts_ai')) D.settings.push({ key: 'receipts_ai', value: { on: false } }); D._rc = 1; } // v2.32
  let saveT;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { /* full: practice still works this visit */ } }, 150); };
  // v2.34: a change made just before the page closes or reloads is written at once, not lost with the 150 ms wait
  const saveNowP = () => { if (!saveT) return; clearTimeout(saveT); saveT = null; try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} };
  window.addEventListener('pagehide', saveNowP); window.addEventListener('beforeunload', saveNowP);
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
    bills: () => isFinance(), expenses: (r) => isFinance() || (r.created_by != null && r.created_by === meId()), // v2.32: everyone sees the expenses they recorded
    expense_categories: () => !!me().role, cash_in: () => isFinance(), cash_counts: () => isFinance(), payments: () => isOffice(),
    statement_lines: () => isFinance(), money_accounts: () => isFinance(), v_books: () => isFinance(),
    outages: () => !!me().role, money_approval_log: () => isFinance(), // ⏱ v2.33 (25_time_savers.sql)
    projects: () => isFinance(), project_revisions: () => isFinance(), project_actuals: () => isFinance(), // 📈 v2.34 (27_area_planner.sql)
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
    areas: () => ({ active: true, float_target: 50000 }), // v2.35: like the database — a new area is in use (it was missing from every picker)
    packages: () => ({ kind: 'fixed' }),
    projects: () => ({ status: 'plan', updated_at: new Date().toISOString() }),
    access_codes: () => ({ active: true, kind: 'tester', max_uses: 10 }), hubs: () => ({ active: true, kind: 'hub' }), staff: () => ({ active: true, pay_type: 'monthly', salary: 0, pay_day: 28 }),
  };
  function afterWrite(table, row, before) {
    if (table === 'tickets') {
      if (row.assigned_to && row.status === 'open') row.status = 'assigned';
      if (row.status === 'done' && (!before || before.status !== 'done')) {
        row.closed_at = new Date().toISOString();
        // 17 Oct: a finished New install turns the Lead into an Active customer (same as supabase/30_install_activates.sql).
        if (row.kind === 'install') { const c = D.v_customers.find((x) => x.id === row.customer_id); if (c && c.status === 'lead') Object.assign(c, { status: 'active', install_date: c.install_date || today(), updated_at: row.closed_at }); }
        if (Number(row.amount_collected) > 0 && !D.payments.some((p) => p.ticket_id === row.id)) {
          const c = D.v_customers.find((x) => x.id === row.customer_id);
          D.payments.push({ id: uuid(), source: 'field', date: today(), amount: Number(row.amount_collected), method: row.collection_method, mpesa_ref: row.collection_ref, payer_name: c ? c.full_name : row.caller, customer_id: row.customer_id, area: row.area, ticket_id: row.id });
        }
      }
    }
    if (table === 'tickets' && !before && row.kind === 'fault' && row.status !== 'cancelled') outageCheck(row);
    if (table === 'tasks') {
      row.updated_at = new Date().toISOString();
      if (row.status === 'done' && (!before || before.status !== 'done')) { row.done_at = row.updated_at; row.done_by = meId(); }
      if (row.status === 'done' && (!before || before.status !== 'done') && String(row.ref_key || '').startsWith('outage:')) {
        const o = D.outages.find((x) => 'outage:' + x.id === row.ref_key && x.status === 'open'); if (o) Object.assign(o, { status: 'closed', closed_by: meId(), closed_at: row.updated_at, close_note: 'Task ticked done' });
      }
    }
    if (table === 'bills') row.paid = Number(row.paid_amount) >= Number(row.amount);
    // v2.32: an expense whose code is already in a statement links to that line, so the money counts once.
    if (table === 'expenses' && row.ref) { const l = D.statement_lines.find((x) => !x.expense_id && x.money_out > 0 && x.ref && x.ref.toUpperCase() === String(row.ref).toUpperCase()); if (l) { l.expense_id = row.id; if (!l.category) l.category = row.category; } }
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
      // v2.34: the change happens at once (so it can't be lost if the page closes); only the answer waits, like a network
      then(ok, no) { let r; try { r = run(table, st); } catch (e) { r = { data: null, error: { message: e.message } }; } return new Promise((res) => setTimeout(() => res(r), 120)).then(ok, no); },
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
    // v2.32: anyone may add an expense they record themselves, and attach its receipt later (same as 22_receipts.sql).
    const ownExpense = table === 'expenses' && !isFinance() && ((['insert', 'upsert'].includes(st.op) && [].concat(st.payload).every((x) => x.created_by === meId() && !x.bill_id)) || st.op === 'update');
    if (ownExpense && st.op === 'update') st.payload = Object.fromEntries(Object.entries(st.payload).filter(([k]) => ['receipt', 'receipt_path', 'note'].includes(k)));
    if (Object.keys(RULES).includes(table) && !rule({}) && st.op !== 'select' && !['tickets', 'tasks'].includes(table) && !ownExpense) return { data: null, error: { message: 'new row violates row-level security policy' } };
    const stop = st.op === 'update' ? moneyGuard(table, st.payload, all.filter(match)) : null; // ⏱ v2.33: the two-person rule
    if (stop) return { data: null, error: { message: stop } };
    const touched = [];
    if (st.op === 'insert' || st.op === 'upsert') {
      for (const p of [].concat(st.payload)) {
        const ex = st.op === 'upsert' ? all.find((r) => st.conflict.every((c) => String(r[c]) === String(p[c]))) : null;
        if (ex) { if (st.ignoreDup) continue; const before = { ...ex }; Object.assign(ex, table === 'expenses' ? expensePayload(p, ex) : p); afterWrite(table, ex, before); touched.push(ex); continue; }
        const row = { id: uuid(), created_at: new Date().toISOString(), ...(DEFAULTS[table] ? DEFAULTS[table]() : {}), ...p };
        moneyInsert(table, row);
        all.push(row); afterWrite(table, row, null); touched.push(row);
      }
    } else if (st.op === 'update') {
      all.filter(match).forEach((r) => { const before = { ...r }; Object.assign(r, table === 'expenses' ? expensePayload(st.payload, r) : st.payload); afterWrite(table, r, before); touched.push(r); });
    } else if (st.op === 'delete') {
      const gone = all.filter(match); D[table] = all.filter((r) => !gone.includes(r)); touched.push(...gone);
      if (table === 'expenses') gone.forEach(unpay);
    }
    if (!window.ZP_LESSON) D._dirty = true; // 7 Oct deep check #17: the person changed their practice company
    save();
    return { data: st.returning || st.single ? (st.single ? touched[0] || null : touched.map((r) => ({ ...r }))) : null, error: null };
  }

  // ---------- the database's built-in jobs ----------
  // v2.36 (15 Oct): Who paid's ← / → months showed this month's figures under last month's name; the month is passed through now.
  const paidThisMonth = (c, mo) => D.payments.filter((p) => p.customer_id === c.id && p.date.slice(0, 7) === (mo || ym())).reduce((t, p) => t + Number(p.amount), 0);
  function collections(mo) {
    return D.v_customers.filter((c) => c.status === 'active').map((c) => {
      const paid = paidThisMonth(c, mo), late = c.paid_until && new Date(c.paid_until) < new Date();
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
        books: Object.values(booksBy).sort((a, b) => cmp(a.month, b.month)), billing: D.billing_snapshots.filter((b) => !b.area), // per-area rows (Zuri D) are for 📈 Projects
        proj_low: low.balance, proj_low_day: low.day, proj_end: proj[proj.length - 1].balance, proj_in: proj.reduce((t, r) => t + r.customers_in + r.other_in, 0), proj_out: proj.reduce((t, r) => t + r.bills_out, 0),
        proj_short_day: (proj.find((r) => r.balance < 0) || {}).day || null, proj_series: proj.map((r) => ({ d: r.day, b: r.balance, i: r.customers_in + r.other_in, o: r.bills_out })),
      } : null,
    };
    return s;
  }
  const projFor = (id) => { if (!isFinance()) throw new Error('Projects are for finance and partners.'); const p = (D.projects || []).find((x) => x.id === id); if (!p) throw new Error('Project not found.'); return p; };
  const projLog = (id, kind, why, changes) => D.project_revisions.push({ id: uuid(), project_id: id, at: new Date().toISOString(), by: meId(), by_name: me().full_name, kind, why: why || null, changes: changes || null });
  const RPC = {
    dashboard_snapshot: (a) => snapshot(a.p_area),
    collections_month: (a) => collections(a && a.p_month ? String(a.p_month).slice(0, 7) : null),
    cash_projection: (a) => projection(a.p_area, a.p_start, a.p_extra),
    pay_bill: (a) => {
      if (!isFinance()) throw new Error('Only finance can pay bills.');
      const b = D.bills.find((x) => x.id === a.p_bill); if (!b) throw new Error('Bill not found.');
      const amt = Number(a.p_amount); if (!(amt > 0)) throw new Error('Enter an amount.');
      // ⏱ v2.33 (25_time_savers.sql): recorded now; the bill counts it only after a second person's OK
      const waitSum = D.expenses.filter((e) => e.bill_id === b.id && e.approval === 'waiting').reduce((t, e) => t + Number(e.amount), 0);
      if (waitSum > 0 && amt > Number(b.amount) - Number(b.paid_amount) - waitSum + 0.5) throw new Error(`KES ${waitSum.toLocaleString('en-KE')} for ${b.name} is already waiting for a second person's OK. Approve or withdraw that first (Money → Bills → 👥 Approvals).`);
      // 7 Oct deep check #2: like the fixed database — keeps the date, approval, VAT, PIN, note and receipt typed in Money out.
      const day = a.p_date && a.p_date <= today() ? a.p_date : today();
      const row = { id: uuid(), area: b.area, date: day, category: b.category, payee: b.name, amount: amt, paid_from: a.p_from || 'M-Pesa', ref: a.p_ref ? String(a.p_ref).toUpperCase() : null, approved_by: a.p_approved_by || 'Pre-approved (bill)', receipt: a.p_receipt || (a.p_from === 'Cash' ? 'Paper receipt — filed' : 'Digital / M-Pesa msg'), note: a.p_note ? 'Bill payment · ' + a.p_note : 'Bill payment', recorded_by: me().full_name, bill_id: b.id, vat_amount: Number(a.p_vat) || 0, supplier_pin: a.p_pin ? String(a.p_pin).toUpperCase() : null, created_at: new Date().toISOString() };
      moneyInsert('expenses', row); D.expenses.push(row); afterWrite('expenses', row, null);
      if (row.approval === 'waiting') return { expense: row.id, waiting: true, paid_amount: b.paid_amount, amount: b.amount, name: b.name };
      b.paid_amount = Number(b.paid_amount) + amt; b.paid_date = day; b.paid = b.paid_amount >= b.amount;
      return { expense: row.id, waiting: false, paid_amount: b.paid_amount, amount: b.amount, name: b.name };
    },
    save_customer: (a) => {
      const p = a.p; let c = p.id && D.v_customers.find((x) => x.id === p.id);
      // 7 Oct deep check #4: same rule as the database — a field tech may only pin customers on their own open jobs.
      if (me().role === 'field' && !(c && D.tickets.some((t) => t.customer_id === c.id && t.assigned_to === meId() && !['done', 'cancelled'].includes(t.status)))) throw new Error('Field techs can only update customers on their own open jobs.');
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
      // 7 Oct deep check #5: like the fixed database — last month's unpaid bills, and last month's salaries that never
      // made it onto a list (only for staff who were on the staff list by then), come onto this run.
      const pd = new Date(now.getFullYear(), now.getMonth() - 1, 1), prev = ymd(pd).slice(0, 7), plast = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      const pDue = (d) => ymd(new Date(pd.getFullYear(), pd.getMonth(), Math.min(d, plast)));
      let nOld = 0;
      const putOld = (kind, ref_id, name, pay_to, amount, area, due_date, update) => {
        const ex = D.pay_items.find((p) => p.kind === kind && p.ref_id === ref_id && p.period === prev);
        if (ex) { if (update && ex.status === 'due') Object.assign(ex, { amount, pay_to }); return; }
        D.pay_items.push({ id: uuid(), period: prev, due_date, kind, ref_id, name, pay_to, amount, area, status: 'due', created_at: new Date().toISOString() }); nOld++;
      };
      D.bills.filter((b) => b.month === prev && !b.paid && b.amount - b.paid_amount > 0).forEach((b) => putOld('bill', b.id, b.name, b.pay_to, b.amount - b.paid_amount, b.area, pDue(b.due_day), true));
      D.staff.filter((s) => s.active && s.pay_type === 'monthly' && s.salary > 0 && s.created_at && s.created_at.slice(0, 10) <= pDue(s.pay_day) && (!s.start_date || s.start_date <= pDue(s.pay_day))
        && !D.expenses.some((e) => String(e.payee).toLowerCase().startsWith(s.full_name.toLowerCase()) && e.date >= ymd(new Date(new Date(pDue(s.pay_day) + 'T12:00:00').getTime() - 7 * DAY))))
        .forEach((s) => putOld('staff', s.id, s.full_name + ' · salary ' + pd.toLocaleDateString('en-GB', { month: 'short' }), s.mpesa_number || s.phone, s.salary, s.area, pDue(s.pay_day), false));
      return { bills: nb, staff: ns, earlier: nOld, due: D.pay_items.filter((p) => p.period <= period && p.status === 'due').length };
    },
    record_pay_item: (a) => {
      if (!isFinance()) throw new Error('Only finance can record payments.');
      const it = D.pay_items.find((p) => p.id === a.p_item); if (!it) throw new Error('Not on the pay run.');
      if (it.status === 'sent') throw new Error('Already recorded.');
      if (it.status === 'waiting') throw new Error('Already recorded — it is waiting for a second person\'s OK.');
      const amt = Number(a.p_amount || it.amount);
      let eid, wait;
      if (it.kind === 'bill') { const r = RPC.pay_bill({ p_bill: it.ref_id, p_amount: amt, p_from: a.p_from, p_ref: a.p_ref }); eid = r.expense; wait = r.waiting; }
      else {
        const row = { id: uuid(), area: it.area || 'A', date: today(), category: 'Payroll', payee: it.name, amount: amt, paid_from: a.p_from || 'M-Pesa', ref: a.p_ref ? String(a.p_ref).toUpperCase() : null, approved_by: me().full_name, receipt: 'Digital / M-Pesa msg', note: 'Pay run ' + it.period, recorded_by: me().full_name, vat_amount: 0, created_at: new Date().toISOString() };
        moneyInsert('expenses', row); D.expenses.push(row); afterWrite('expenses', row, null); eid = row.id; wait = row.approval === 'waiting';
      }
      Object.assign(it, { status: wait ? 'waiting' : 'sent', expense_id: eid, paid_from: a.p_from, ref_code: a.p_ref ? String(a.p_ref).toUpperCase() : null, amount: amt, sent_at: wait ? null : new Date().toISOString(), sent_by: meId() });
      return { ok: true, waiting: wait, name: it.name, amount: amt, expense: eid };
    },
    // ⏱ v2.33 — the same rules as 25_time_savers.sql
    time_savers_version: () => 1,
    approve_money: (a) => {
      if (!isFinance()) throw new Error('Only finance or a partner can approve money out.');
      const e = D.expenses.find((x) => x.id === a.p_expense); if (!e) throw new Error('Not found — it may have been withdrawn.');
      if (e.approval !== 'waiting') throw new Error('This one isn\'t waiting for approval.');
      if (e.created_by === meId()) throw new Error('You recorded this one, so a second person must approve it. That is the rule for money out.');
      const now = new Date().toISOString(), before = { ...e };
      Object.assign(e, { approval: 'approved', approved_by_id: meId(), approved_at: now, approved_by: me().full_name, ref: e.ref || (a.p_ref ? String(a.p_ref).toUpperCase() : null) });
      afterWrite('expenses', e, before);
      if (e.bill_id) { const b = D.bills.find((x) => x.id === e.bill_id); if (b) { b.paid_amount = Number(b.paid_amount) + Number(e.amount); b.paid_date = e.date; b.paid = b.paid_amount >= b.amount; } }
      D.pay_items.filter((p) => p.expense_id === e.id && p.status === 'waiting').forEach((p) => Object.assign(p, { status: 'sent', sent_at: now, ref_code: p.ref_code || (a.p_ref ? String(a.p_ref).toUpperCase() : null) }));
      D.money_approval_log.push({ id: uuid(), expense_id: e.id, action: 'approved', reason: null, by: meId(), at: now, row: before });
      return { ok: true, payee: e.payee, amount: e.amount, bill: !!e.bill_id };
    },
    decline_money: (a) => {
      const e = D.expenses.find((x) => x.id === a.p_expense); if (!e) throw new Error('Not found — it may have been handled already.');
      if (e.approval !== 'waiting') throw new Error('Only payments still waiting can be declined.');
      if (!(isFinance() || e.created_by === meId())) throw new Error('Only finance can decline a payment.');
      const act = e.created_by === meId() ? 'withdrawn' : 'declined';
      D.money_approval_log.push({ id: uuid(), expense_id: e.id, action: act, reason: a.p_reason || null, by: meId(), at: new Date().toISOString(), row: { ...e } });
      D.expenses = D.expenses.filter((x) => x !== e); unpay(e);
      return { ok: true, action: act, payee: e.payee, amount: e.amount };
    },
    close_outage: (a) => {
      const p = me(); if (!(p.role === 'admin' || (p.role === 'internal' && p.dept === 'technical'))) throw new Error('Only the technical office or a partner can close an outage.');
      const o = D.outages.find((x) => x.id === a.p_id); if (!o) throw new Error('Outage not found.');
      if (o.status === 'closed') return { ok: true, already: true };
      Object.assign(o, { status: 'closed', closed_by: meId(), closed_at: new Date().toISOString(), close_note: a.p_note || null });
      D.tasks.filter((t) => ['outage:' + o.id, 'outage-notice:' + o.id].includes(t.ref_key) && t.status === 'open').forEach((t) => { const b = { ...t }; t.status = 'done'; afterWrite('tasks', t, b); });
      return { ok: true, area: o.area, faults: o.fault_ids.length };
    },
    outage_notice: (a) => {
      if (me().role !== 'admin') throw new Error('Only a partner can say yes or no to a customer notice.');
      const o = D.outages.find((x) => x.id === a.p_id); if (!o) throw new Error('Outage not found.');
      Object.assign(o, { notice: (a.p_text && String(a.p_text).trim().slice(0, 600)) || o.notice, notice_status: a.p_yes ? 'approved' : 'declined', notice_by: meId(), notice_at: new Date().toISOString() });
      D.tasks.filter((t) => t.ref_key === 'outage-notice:' + o.id && t.status === 'open').forEach((t) => { const b = { ...t }; t.status = 'done'; afterWrite('tasks', t, b); });
      return { ok: true, notice_status: o.notice_status };
    },
    manager_run: () => { const r = receiptRules(D), t = tsRules(D); return { run: uuid(), rules: 9 + r.rules + t.rules, new_tasks: r.new_tasks + t.new_tasks, closed: r.closed + t.closed, escalated: 0, nudges: 0, note: 'Practice: the manager looked and everything is already on the list.' }; },
    receipt_suggest: (a) => {
      const k = String(a.p_payee || '').trim().toLowerCase(); if (k.length < 3) return null;
      const n = {}; D.expenses.filter((e) => String(e.payee).trim().toLowerCase() === k && e.category).forEach((e) => { n[e.category] = (n[e.category] || 0) + 1; });
      const best = Object.entries(n).sort((x, y) => y[1] - x[1])[0];
      if (best) return { category: best[0], source: 'history', n: best[1] };
      const p = D.payees.find((x) => x.name.toLowerCase() === k && x.category); if (p) return { category: p.category, source: 'payee', n: 1 };
      const r = D.sort_rules.filter((x) => x.direction !== 'in' && k.toUpperCase().includes(String(x.match).toUpperCase()) && D.expense_categories.some((c) => c.name === x.category)).sort((x, y) => y.match.length - x.match.length)[0];
      return r ? { category: r.category, source: 'rule', n: 0 } : null;
    },
    receipt_code_check: (a) => {
      const c = String(a.p_code || '').trim().toUpperCase(); if (c.length < 6) return { statement: [], expenses: [] };
      const accts = Object.fromEntries(D.money_accounts.map((x) => [x.id, x]));
      return { statement: D.statement_lines.filter((l) => l.ref && l.ref.toUpperCase() === c).map((l) => ({ date: l.date, amount: l.money_out || l.money_in, account: (accts[l.account_id] || {}).name, kind: (accts[l.account_id] || {}).kind, linked: !!l.expense_id })),
        expenses: D.expenses.filter((e) => e.ref && String(e.ref).toUpperCase() === c && e.id !== a.p_exclude).map((e) => ({ id: e.id, date: e.date, payee: e.payee, amount: e.amount, recorded_by: e.recorded_by })) };
    },
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
    // 📈 v2.34: the life-cycle steps, same rules as 27_area_planner.sql
    project_request_go: (a) => {
      const p = projFor(a.p_project); if (p.status !== 'plan') throw new Error('Only a plan can be sent for the go-ahead.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a.p_launch || '')) throw new Error('Pick the launch month.');
      Object.assign(p, { status: 'waiting', launch_date: a.p_launch, go_requested_by: meId(), go_requested_at: new Date().toISOString() });
      projLog(p.id, 'go_requested', 'Launch ' + a.p_launch);
      if (apprSetting().on === false) return RPC.project_approve_go(a);
      return { status: 'waiting' };
    },
    project_withdraw_go: (a) => { const p = projFor(a.p_project); if (p.status !== 'waiting') throw new Error('Nothing is waiting.'); Object.assign(p, { status: 'plan', go_requested_by: null, go_requested_at: null }); projLog(p.id, 'go_withdrawn', a.p_why); return { status: 'plan' }; },
    project_approve_go: (a) => {
      const p = projFor(a.p_project); if (p.status !== 'waiting') throw new Error('This project is not waiting for an OK.');
      if (p.go_requested_by === meId() && apprSetting().on !== false) throw new Error('Someone else must approve it — not the person who asked.');
      Object.assign(p, { status: 'live', baseline: JSON.parse(JSON.stringify(p.plan)), approved_by: meId(), approved_at: new Date().toISOString() });
      projLog(p.id, 'go_approved', 'Plan locked as the baseline'); return { status: 'live' };
    },
    project_revise: (a) => {
      const p = projFor(a.p_project); if (p.status !== 'live') throw new Error('Only a live project has a forecast to update.');
      if (!a.p_why || String(a.p_why).trim().length < 3) throw new Error('Say why the forecast changed.');
      p.plan = a.p_plan; if (a.p_launch) p.launch_date = a.p_launch; p.updated_at = new Date().toISOString();
      projLog(p.id, 'forecast', a.p_why, a.p_changes); return { status: 'live' };
    },
    project_close: (a) => { const p = projFor(a.p_project); if (p.status !== 'live') throw new Error('Only a live project can be closed.'); p.status = 'closed'; projLog(p.id, 'closed', a.p_why); return { status: 'closed' }; },
    project_import: (a) => {
      if (!isFinance()) throw new Error('Only finance or a partner can move projects in.');
      const j = (a.p && a.p.project) || {}; if (!j.id) throw new Error('Nothing to move.');
      if (D.projects.some((x) => x.id === j.id)) return j.id;
      const st = ['plan', 'live', 'closed'].includes(j.status) ? j.status : 'plan';
      D.projects.push({ ...j, status: st, baseline: st === 'plan' ? null : j.baseline, created_by: j.created_by || meId() });
      ((a.p && a.p.revisions) || []).forEach((r) => D.project_revisions.push({ ...r, project_id: j.id }));
      ((a.p && a.p.actuals) || []).forEach((r) => D.project_actuals.push({ ...r, project_id: j.id }));
      projLog(j.id, 'imported', 'Moved from a phone into the database'); return j.id;
    },
    project_planner_version: () => 1,
    // v2.36 (15 Oct): imported payments are really stored (Who paid, the report and the unmatched list change), and a
    //       repeat import skips what is already there, like the real database.
    import_payments: (a) => {
      let added = 0, matched = 0;
      const seen = new Set(D.payments.map((p) => p.mpesa_ref || p.external_id || '').filter(Boolean));
      (a.rows || []).forEach((r) => {
        const k = r.mpesa_ref || r.external_id || ''; if (k && seen.has(k)) return; if (k) seen.add(k);
        const acc = String(r.account_ref || '').trim().toUpperCase(), ph = String(r.payer_phone || '').replace(/\D/g, '').slice(-9);
        const c = D.v_customers.find((x) => (acc && String(x.account_no || '').toUpperCase() === acc) || (ph && String(x.phone || '').replace(/\D/g, '').slice(-9) === ph));
        D.payments.push({ id: uuid(), ...r, customer_id: c ? c.id : null, area: c ? c.area : (r.area || null) }); added++; if (c) matched++;
      });
      save();
      return { rows: (a.rows || []).length, added, matched };
    },
  };
  const READ_ONLY = ['dashboard_snapshot', 'collections_month', 'cash_projection', 'receipt_suggest', 'receipt_code_check', 'time_savers_version']; // #17: these never change anything
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
      try { const data = RPC[name] ? RPC[name](args || {}) : null; if (!window.ZP_LESSON && !READ_ONLY.includes(name)) D._dirty = true; save(); res({ data, error: null }); } catch (e) { res({ data: null, error: { message: e.message } }); }
    }, 150)),
    storage: { from: (bucket) => ({
      upload: async (path, blob) => { blobs.set(path, URL.createObjectURL(blob)); if (bucket === 'receipts') { try { const buf = await blob.arrayBuffer(); await idbDo('readwrite', (st) => st.put({ type: blob.type || 'image/jpeg', buf }, 'rcfile:' + path)); } catch (e) {} } return { error: null }; },
      createSignedUrls: async (paths) => ({ data: await Promise.all(paths.map(async (p) => ({ path: p, signedUrl: (await practiceUrl(p)) || 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#0F6E5C"/><text x="48" y="54" font-size="12" fill="#fff" text-anchor="middle">practice photo</text></svg>') }))) }),
      createSignedUrl: async (p) => { const u = await practiceUrl(p); return u ? { data: { signedUrl: u }, error: null } : { data: null, error: { message: 'The photo has not uploaded yet.' } }; },
    }) },
    // The pretend "AI reading": only when Admin → Settings → Read receipts with AI is On (in practice), after a short think.
    functions: { invoke: (name, opts) => new Promise((res) => setTimeout(() => {
      if (name !== 'zuri-receipt') return res({ data: null, error: { message: 'Not in practice.' } });
      const on = ((D.settings.find((x) => x.key === 'receipts_ai') || {}).value || {}).on;
      if (!on) return res({ data: { ok: false, reason: 'off' }, error: null });
      if (!opts || !opts.body || !opts.body.image) return res({ data: { ok: false, reason: 'no image' }, error: null });
      const key = pendingRead || SAMPLE_READS[sampleI++ % SAMPLE_READS.length]; pendingRead = null;
      res({ data: { ok: true, fields: readFor(key), model: 'practice' }, error: null });
    }, window.ZURI_LEARN_FAST ? 150 : 1800)) },
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
    // 7 Oct deep check #17: has the person made their own changes since this practice company was fresh?
    dirty: () => !!D._dirty,
    // 🧾 training-video helpers (v2.32)
    receiptFile: (key) => new Promise((ok) => { pendingRead = key; drawReceipt(RC[key] || RC.kamau).toBlob((b) => ok(new File([b], key + '.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.85); }),
    setSetting: (key, value) => { const s = D.settings.find((x) => x.key === key); if (s) s.value = value; else D.settings.push({ key, value }); save(); },
    receiptRules: () => { const r = receiptRules(D); save(); return r; },
    // ⏱ time-saver helpers (v2.33)
    tsRules: () => { const r = tsRules(D); save(); return r; },
    // Where "the phone" stands during a training video (a pretend GPS fix outside a house near the market, ±12 m).
    pretendHere: () => ({ lat: -0.98912, lng: 36.58377, acc: 12 }),
    // A fault call that came in a few minutes ago, from somewhere in this area (for the outage video).
    addFault: (area, summary, minsAgo = 20) => {
      const c = D.v_customers.find((x) => x.area === area && x.status === 'active' && x.paid_until && new Date(x.paid_until) > new Date() && !D.tickets.some((t) => t.customer_id === x.id && t.kind === 'fault' && t.status !== 'done' && t.status !== 'cancelled'));
      const row = { id: uuid(), ticket_no: ++D._ticket_no, opened_by: 'p-mary', opened_at: new Date(Date.now() - minsAgo * 60e3).toISOString(), priority: 'normal', status: 'open', scheduled_for: today(), findings: null, work_done: null, amount_collected: 0, collection_method: null, collection_ref: null, closed_at: null, site_lat: null, site_lng: null, caller: null, assigned_to: null, customer_id: c ? c.id : null, area, kind: 'fault', summary };
      D.tickets.push(row); afterWrite('tickets', row, null); save(); return row.id;
    },
    // 📈 v2.34: Kelvin already said "we're doing it" (for the second-OK video when watched on its own)
    projectAsk: (id, by) => { const p = (D.projects || []).find((x) => x.id === id); if (!p || p.status !== 'plan') return; const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1); Object.assign(p, { status: 'waiting', launch_date: ymd(d), go_requested_by: by, go_requested_at: new Date().toISOString() }); D.project_revisions.push({ id: uuid(), project_id: id, at: new Date().toISOString(), by, by_name: (PEOPLE.find((x) => x.id === by) || {}).full_name, kind: 'go_requested', why: 'Launch ' + ymd(d), changes: null }); save(); },
    reset: () => { localStorage.removeItem(KEY); Object.keys(localStorage).filter((k) => k.startsWith('zuri_practice_') && k !== ROLE_KEY).forEach((k) => localStorage.removeItem(k)); },
  };
})();
