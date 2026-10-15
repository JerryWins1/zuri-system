// Zuri System · 📈 Projects — narrated lessons on the real screens (practice): plan → go → update → track · v1 · 2026-10-12 (app v2.34)
// Each chapter has its own "Your turn" when watched alone; ▶ Play all on the Learn page chains them (✕ stops).
// The practice company has two examples: Narok (example) is still a plan; Suswa (example) went live 5 months ago.
(function () {
  const Z = window.Z;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const find = (sel) => { if (typeof sel === 'function') return sel(); const [css, text] = sel.split('::'); const all = [...document.querySelectorAll(css)]; return (text ? all.filter((e) => e.textContent.toLowerCase().includes(text.toLowerCase())) : all).find((e) => e.offsetParent !== null || e.getClientRects().length) || null; };
  const waitFor = async (sel, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = find(sel); if (e) return e; await sleep(120); } return null; };
  const tap = (sel) => async () => { const e = await waitFor(sel); if (e) e.click(); await sleep(600); };
  const type = (sel, text) => async () => { const e = await waitFor(sel); if (!e) return; e.focus(); e.value = ''; for (const ch of String(text)) { e.value += ch; await sleep(String(text).length > 30 ? 8 : 45); } e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); e.blur(); await sleep(350); };
  const choose = (sel, value) => async () => { const e = await waitFor(sel); if (!e) return; const o = [...e.options].find((x) => x.value === value) || [...e.options].find((x) => x.textContent.includes(value)) || e.options[1]; e.value = o.value; e.dispatchEvent(new Event('change', { bubbles: true })); await sleep(400); };
  const open = (id) => async () => { const d = await waitFor('#' + id); if (d && !d.open) { d.open = true; await sleep(300); } };
  const seq = (...fns) => async () => { for (const f of fns) await f(); };
  const G = '📈 Projects';
  const C = (id, title, mins, role, next, steps, turn, more = {}) => ({ id, group: G, title, mins, role, next, steps, turn, ...more });
  const prep = async () => { Z.set('pj_open', 'start'); Z.set('pj_h', 36); };

  const CH = [
    C('pj-why', '1 · Payback and break-even — what they mean', 3, 'admin', 'pj-plan', [
      { pre: prep, go: 'home', el: '#h-proj', say: 'This is Jerry, a partner. Zuri can plan a new area before a shilling is spent, and then watch it against the plan. Home shows one line per project. Tap it.', do: tap('#h-proj') },
      { el: '#pj-intro', say: 'Projects. Every project goes three steps: plan it, decide together, then track what really happens.' },
      { el: '.pj-card::Narok', say: 'Narok is still a plan. Open it.', do: tap('.pj-card::Narok') },
      { el: '#pj-answer', say: 'The answer comes first, in plain words: how much it costs to start, and the month you get it back.' },
      { el: '#pj-answer li', say: 'Two different months matter. Break-even is the first month when the money coming in is more than the money going out that month.' },
      { el: () => find('#pj-answer li:nth-child(2)'), say: 'Payback comes later. By then, all the profits added together have paid back the start-up money, and the losses of the early months.' },
      { el: () => find('#pj-answer li::Most money tied up'), say: 'And the most money tied up: the deepest the cash goes. That is how much the partners must have ready, or borrow.' },
      { el: '#pj-chart', say: 'The chart shows it. The line starts below zero: the start-up money going out. It falls while the months lose money, turns up at break-even, and crosses zero at payback.' },
    ], ['Open 📈 Projects from Home', 'Open Narok (example) and read the answer', 'Find break-even and payback on the chart']),

    C('pj-plan', '2 · Plan a new area: the three parts', 5, 'finance', 'pj-read', [
      { pre: prep, go: 'money', el: '#m-projects', say: 'This is Kelvin in finance. Projects also opens from the Money screen. Tap Projects.', do: tap('#m-projects') },
      { el: '#pj-new', say: 'A new area to think about. Tap New project.', do: tap('#pj-new') },
      { el: '#pn-name', say: 'Give it a name.', do: type('#pn-name', 'Kijabe (practice)') },
      { el: '#pn-area', say: 'If the area already exists in Zuri, pick it here. Zuri then pulls the real customers and payments for tracking by itself. Kijabe is new, so we leave it.' },
      { el: '#pn-notes', say: 'A note about the area helps the partners remember why.', do: type('#pn-notes', 'On the old Nairobi road; schools and the mission hospital') },
      { el: '#pn-save', say: 'Create.', do: tap('#pn-save') },
      { el: '#pj-start', say: 'Part A: the start-up costs. Everything paid once, before the first customer. This is the money you need to get back.', do: open('pj-start') },
      { el: '#pj-start-fiber_km', say: 'Four kilometres of fiber…', do: type('#pj-start-fiber_km', '4') },
      { el: '#pj-start-fiber_rate', say: 'at two hundred and ninety thousand shillings a kilometre, laid. Zuri multiplies them.', do: type('#pj-start-fiber_rate', '290000') },
      { el: '#pj-start-olt', say: 'The equipment at the hub.', do: type('#pj-start-olt', '600000') },
      { el: '#pj-start-labour', say: 'Labour.', do: type('#pj-start-labour', '350000') },
      { el: '#pj-start-cont_pct', say: 'And contingency: extra for surprises. Builds almost always cost more than planned. Ten to fifteen percent is normal.' },
      { el: '#pj-cpe-who', say: 'Routers: Zuri pays one for every new customer, in the month they join, unless it is in the install fee.' },
      { el: '#pj-run', say: 'Part B: the running costs, every month, with or without customers.', do: open('pj-run') },
      { el: '#pj-bh-preset', say: 'Backhaul: pick a real quote. Bayobab, one hundred megabits, fourteen thousand a month.', do: choose('#pj-bh-preset', 'bayobab100') },
      { el: '#pj-run-staff_n', say: 'Two staff…', do: type('#pj-run-staff_n', '2') },
      { el: '#pj-run-salary', say: 'at twenty-two thousand each.', do: type('#pj-run-salary', '22000') },
      { el: '#pj-run-rent', say: 'Rent for a small shop.', do: type('#pj-run-rent', '10000') },
      { el: '#pj-rev', say: 'Part C: customers and money in. This is the part to argue about: small changes here move the payback month the most.', do: open('pj-rev') },
      { el: '#pj-rev-homes', say: 'How many homes and businesses the fiber passes.', do: type('#pj-rev-homes', '700') },
      { el: '#pj-rev-c1', say: 'Sign-ups by month one, three, six, twelve and twenty-four.', do: seq(type('#pj-rev-c1', '15'), type('#pj-rev-c3', '40'), type('#pj-rev-c6', '80'), type('#pj-rev-c12', '140'), type('#pj-rev-c24', '220')) },
      { el: '#pj-arpu-zuri', say: 'What does a customer pay? Zuri already knows Zuri A\'s average from the billing website. Tap Use it.', do: tap('#pj-arpu-use') },
      { el: '#pj-rev-install_fee', say: 'The install fee.', do: type('#pj-rev-install_fee', '2500') },
      { el: '#pj-rev-churn_pct', say: 'And how many leave each month, out of every hundred.', do: type('#pj-rev-churn_pct', '2') },
      { el: '#pj-have', say: 'Zuri says how many customers you will really have, after the leavers.' },
      { el: '#pj-answer', say: 'And the answer updates as you type. It saves by itself.' },
    ], ['Make a new project and fill in the three parts', 'Pick a backhaul quote', 'Use Zuri A\'s monthly bill for the ARPU']),

    C('pj-read', '3 · Reading the chart, the what-ifs and the table', 3, 'finance', 'pj-compare', [
      { pre: prep, go: 'projects/pj-narok/plan', el: '#pj-kpis', say: 'Back on Narok. Under the answer: the start-up, the running costs, the profit in the first twelve, twenty-four and thirty-six months, and the three-year return.' },
      { el: '#pj-whatif', say: 'What if we are wrong? This grid gives the payback month if fewer people join, or more, and if the monthly bill is ten percent lower or higher. The bold one is the plan.' },
      { el: '#pj-whatif td::Low', say: 'Read the low row first. If it still pays back in a time you can live with, the plan is safe. If it says never, agree now what you would do if sign-ups are slow.' },
      { el: '#pj-table', say: 'Month by month: customers, money in, costs, profit, and the cash so far. Break-even and payback are marked in green.' },
      { el: '#pj-h', say: 'Show twelve, twenty-four, thirty-six or sixty months.', do: tap('#pj-h [data-h="60"]') },
    ], ['Read the what-if grid for Narok', 'Find the payback row in the table', 'Switch the table to 60 months']),

    C('pj-compare', '4 · A loan, comparing two areas, and sharing', 4, 'admin', 'pj-go', [
      { pre: prep, go: 'projects/pj-narok/plan', el: '#pj-loan', say: 'Narok is big, so the plan includes a loan. Open part D.', do: open('pj-loan') },
      { el: '#pj-loan-pay', say: 'Five million at sixteen percent over three years. Zuri works out the monthly repayment and the interest, and counts the repayment as a cost.' },
      { el: '#pj-kpis', say: 'So the partners see the payback with the loan: less of their own money at the start, but less profit each month while it is repaid.' },
      { go: 'projects', el: '#pj-compare', say: 'Two areas? Compare them side by side.', do: tap('#pj-compare') },
      { el: '#pc-table', say: 'Start-up, payback, the most money tied up, profit and cash after three years, and the payback if take-up is low. The star marks the faster payback.' },
      { el: '#pc-chart', say: 'A smaller area can pay back sooner, even if a bigger one makes more in the end. Look at both.' },
      { go: 'projects/pj-narok/plan', el: '#pj-copy', say: 'To share: Copy for WhatsApp gives a short summary with the why, ready for the partners\' group.' },
      { el: '#pj-print', say: 'And the one-page report, for a meeting or as a PDF.', do: tap('#pj-print') },
      { el: '#pp-head', say: 'It explains every number in plain words, with the questions the partners should agree on.' },
    ], ['Turn the loan off and on — watch the payback move', 'Compare Suswa and Narok', 'Copy a project for WhatsApp and open the one-page report']),

    C('pj-go', '5 · We\'re doing it — asking for the go-ahead', 3, 'finance', 'pj-go2', [
      { pre: prep, go: 'projects/pj-narok/plan', el: '#pj-go-card', say: 'The partners agreed on Narok. Kelvin taps We\'re doing it.', do: tap('#pj-go') },
      { el: '#pj-go-launch', say: 'He picks the launch month: month one, the first month with customers.' },
      { el: '#pj-go-ok', say: 'Send it for the second OK.', do: tap('#pj-go-ok') },
      { el: '#pj-wait', say: 'Now it waits. The same rule as money out: a second partner or finance person must approve, never the person who asked. While it waits, the numbers can\'t change.' },
      { el: '#pj-switch', say: 'In practice you can play the second person. In real life it is Jerry\'s own phone. The next chapter does that.' },
    ], ['Tap ✅ We\'re doing it on a plan', 'Try to approve your own — read why not']),

    C('pj-go2', '5b · The second OK — the plan is locked', 2, 'admin', 'pj-forecast', [
      { pre: async () => { await prep(); const r = await Z.sb.from('projects').select('id,status').eq('id', 'pj-narok').maybeSingle(); if (r.data && r.data.status === 'plan' && window.ZP && window.ZP.projectAsk) window.ZP.projectAsk('pj-narok', 'p-kelvin'); },
        go: 'projects', el: '.pj-card::Narok', say: 'This is Jerry. Narok is waiting for his OK. Open it.', do: tap('.pj-card::Narok') },
      { el: '#pj-approve', say: 'He checks the numbers, then taps Approve.', do: tap('#pj-approve') },
      { el: '#pt-status', say: 'The plan is now locked as the baseline: the yardstick. It never changes. From now on Zuri compares what really happens against it, every month.' },
      { go: 'projects/pj-narok/log', el: '#pl-list', say: 'The log keeps every step: who asked, who approved, and when.' },
    ], ['Approve a project someone else asked for', 'Open its 📜 Log'], { keep: true }),

    C('pj-forecast', '6 · Things change — update the forecast', 3, 'admin', 'pj-track', [
      { pre: prep, go: 'projects/pj-suswa/plan', el: '#pj-fc-head', say: 'Suswa went live five months ago. The approved plan is locked, but what we expect can change: a new quote, slower sign-ups. That is the forecast.' },
      { el: '#pj-rev', say: 'Jerry hears the monthly bill in Suswa is lower than planned. Open part C.', do: open('pj-rev') },
      { el: '#pj-rev-arpu', say: 'Seventeen hundred, not eighteen hundred.', do: type('#pj-rev-arpu', '1700') },
      { el: '#pj-answer', say: 'The answer shows the new payback, and what the locked plan said.' },
      { el: '#pj-fc-save', say: 'Save the forecast.', do: tap('#pj-fc-save') },
      { el: '#pf-changes', say: 'Zuri lists exactly what changed.' },
      { el: '#pf-why', say: 'And asks why. The partners will read it.', do: type('#pf-why', 'Most Suswa customers took the 1,500 package') },
      { el: '#pf-go', say: 'Save.', do: tap('#pf-go') },
      { go: 'projects/pj-suswa/log', el: '#pl-list', say: 'The log: the new forecast, who, when and why, and the earlier change Kelvin made when the fiber quote went up.' },
    ], ['Change one number in Suswa\'s forecast and save it with a reason', 'Find your change in the 📜 Log']),

    C('pj-track', '7 · Actual against the plan', 5, 'finance', 'pj-friday', [
      { pre: prep, go: 'projects/pj-suswa/track', el: '#pt-status', say: 'Every month, Zuri compares Suswa with the plan. First, in plain words: on track, behind or ahead, and by how much cash.' },
      { el: '#pt-payback', say: 'And the payback month now: what really happened so far, plus the forecast for the rest, against what the plan said.' },
      { el: '#pt-nudge', say: 'Last month is not confirmed yet. Zuri already filled in what it found on the billing website. Kelvin taps to confirm.', do: tap('#pt-nudge') },
      { el: '#pa-amount', say: 'Customers connected at the end of the month: Zuri found eighty-six. He confirms.', do: type('#pa-amount', '86') },
      { el: '#pa-save', say: 'Save.', do: tap('#pa-save') },
      { el: '#pa-amount', say: 'Then the money collected that month.', do: type('#pa-amount', '163800') },
      { el: '#pa-save', say: 'Save.', do: tap('#pa-save') },
      { el: '#pt-kpis', say: 'Start-up spent against the plan, customers, money in and running costs so far. Green is on plan or better, orange up to fifteen percent worse, red more.' },
      { el: '#pt-chart', say: 'Three lines. Grey dashes: the plan. Green: what really happened. Orange: where it is heading now.' },
      { el: '#pt-table', say: 'Month by month, actual against the plan, with the difference in shillings and percent.' },
      { el: '#pt-lines', say: 'The build, line by line: fiber cost more than planned, the rest was close.' },
      { el: '#pt-entries', say: 'Where the numbers come from. Zuri pulls expenses tagged to the project, and the payments and billing figures for Zuri D, by itself. Anything else, Kelvin types here.' },
      { go: 'money/expense', el: '#pj-tag', say: 'In Money out, spending in Zuri D is tagged to Suswa by itself. Change it if it is not a project cost.', do: choose('#me select[name=area]', 'D') },
    ], ['Confirm last month\'s customers and money for Suswa', 'Record a running cost that is not in Money out', 'Find a tagged expense in the Actuals list']),

    C('pj-friday', '8 · Projects in the Friday report and on Home', 2, 'finance', 'pj-turn', [
      { pre: prep, go: 'home', el: '#h-proj', say: 'Home shows every project in one line: Suswa\'s state, and Narok being planned.' },
      { go: 'money/report', el: '#view pre.report', say: 'And the Friday report has one line per project, so the partners see it every week without asking.' },
      { go: 'tasks/mine', el: '#tk-body .item::Confirm Suswa', say: 'At the start of each month, the Zuri manager puts a task on finance\'s list: confirm last month\'s actuals for each live project.' },
    ], ['Find the Projects line on Home', 'Find the 📈 Projects part of the Friday report']),

    C('pj-turn', '9 · Your turn — plan, go, track', 2, 'admin', null, [
      { pre: prep, go: 'projects', el: '#pj-new', say: 'That is Projects. Now try it yourself, in practice. Nothing here is real.' },
      { go: 'me', el: 'a[href="#learn"]', say: 'Every chapter is on the Learn page, to watch again any time.' },
    ], ['Plan a new area from an empty project', 'Compare it with Suswa and Narok', 'Say “we\'re doing it” as Kelvin, approve it as Jerry', 'Update a forecast with a reason', 'Confirm a month of actuals for Suswa', 'Copy a project for WhatsApp']),
  ];
  if (Z.lessons) Z.lessons.push(...CH);
})();
