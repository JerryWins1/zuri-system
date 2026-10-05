// Zuri System · Learn: talking training videos that play on the real screens (in practice mode) · v3 · 2026-10-05
// Each "video" is a list of steps: go to a page, light up one thing, say one or two short sentences, maybe tap it.
// It plays on pretend data, so it can tap real buttons safely. Captions always show, so it works with the sound off.
(function () {
  const Z = window.Z;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const AUTO = 'zuri_learn_autoplay'; // survives the switch into practice mode

  // ---------- small actions the videos use ----------
  const find = (sel) => {
    if (typeof sel === 'function') return sel();
    const [css, text] = sel.split('::');
    const all = Z.$$(css);
    return (text ? all.filter((e) => e.textContent.toLowerCase().includes(text.toLowerCase())) : all).find((e) => e.offsetParent !== null || e.getClientRects().length) || null;
  };
  async function waitFor(sel, ms = 7000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const e = find(sel); if (e) return e; await sleep(120); }
    return null;
  }
  const tap = (sel) => async () => { const e = await waitFor(sel); if (e) e.click(); await sleep(500); };
  const type = (sel, text) => async () => {
    const e = await waitFor(sel); if (!e) return;
    e.focus(); e.value = '';
    for (const ch of text) { e.value += ch; await sleep(text.length > 40 ? 12 : 45); }
    e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
    e.blur(); await sleep(350);
  };
  const choose = (sel, value) => async () => { const e = await waitFor(sel); if (!e) return; const o = [...e.options].find((x) => x.value === value) || [...e.options].find((x) => x.textContent.includes(value)) || e.options[1]; e.value = o.value; e.dispatchEvent(new Event('change', { bubbles: true })); await sleep(400); };
  const go = (hash) => async () => { location.hash = hash; await sleep(250); };

  // ---------- the lessons ----------
  // role = which pretend person the video plays as. el = what to light up. say = the words. do = what it taps after speaking.
  const LESSONS = [
    { id: 'howtest', group: 'Everyone', title: 'How to test Zuri (2 min)', mins: 2, role: null, star: true, safe: true, steps: [
      { go: 'test', el: '#test-head', say: 'Welcome, tester. Thank you for helping. This short video shows how we test Zuri, and what we need from you.' },
      { el: '#hdr', say: 'The orange bar means TRAINING. The customers and the money are pretend, so nothing you do is real. But it is shared: what you do here, your teammates see. Work like it is a real day.' },
      { el: '#test-open', say: 'Your Testers\' List is one page, one step at a time: the videos, the things to try for your job, joining the training copy. Do a step, tap Done, and the next one appears.' },
      { el: '#test-open', say: 'Under every step is a box: Tell Claude. Something wrong, confusing, or slow? Write it there. Short is fine: the button is too small, or I did not understand this word.' },
      { el: '#test-fs', say: 'If you opened Zuri inside Feedback Studio, even better: press the red button and talk while you work. Point at what is wrong. At the end, tap I\'m done, then Send to Claude.' },
      { el: '#zver', say: 'At the bottom is the version line. If you report a problem, say which version you had.' },
      { el: '#test-head', say: 'The count at the top of your list shows how far you are. Please finish every step for your job. That is how we know Zuri is ready for real customers.' },
      { go: 'learn', el: '#view .list .item', say: 'Before you start: watch What Zuri is, five minutes, then the videos for your own job. Then open the checklist and begin. Thank you!' },
    ], turn: ['Open your Testers\' List (Me → 🧪)', 'Tick the first step', 'Send one note to Claude'] },
    { id: 'tour', group: 'Everyone', title: 'What Zuri is — the whole system in 5 minutes', mins: 5, role: 'admin', star: true, steps: [
      { go: 'home', el: '#hdr', say: 'Welcome to Zuri. In the next few minutes you will see the whole system, so you know how everything fits together. After this, watch the short videos for your own job.' },
      { el: '#nav', say: 'Zuri is one app for the whole Zuri Fiber team: the partners, the office, the call center, and the technicians in the field. It works on any phone, in Chrome, and on the office computer.' },
      { el: '#view .kpis', say: 'Everyone works from the same information. This is Home. It shows the whole company on one page: our customers, who has paid, our service jobs, and our money.' },
      { el: '#view a.card', say: 'Every morning at half past six, the Zuri manager looks at everything and writes each person\'s list for the day. It also warns us early when something is going wrong, like customers who have not paid, or cash running low.' },
      { el: '#view .alert', say: 'Needs attention shows the most important problems first. Tap one, and it takes you straight there.' },
      { go: 'customers', el: '#view .list', say: 'Customers is everyone we serve: their package, their phone number, where they live, and when their payment runs out. The list comes from our billing website every morning.' },
      { el: 'a[href="#customers/map"]', say: 'And the map: every customer with a pin, by area. Green has paid, red has run out. A technician taps a pin and drives there.' },
      { go: 'jobs', el: '#j-list', say: 'Jobs is the work at customers\' houses: faults, new installs, moving a router, and payment calls. Each job goes to a technician, with a day to visit.' },
      { el: '#j-list .item::Payment follow-up', say: 'When a customer\'s internet runs out, Zuri opens a payment follow-up job by itself. The call center phones the customer, and writes down what they said.' },
      { el: '#j-list .item', say: 'Let\'s follow one job from start to finish. A customer called: no internet. The call center made this job, and sent it to Peter.', do: tap('#j-list .item') },
      { el: 'a[href^="tel:"]', say: 'Peter sees the job on his phone, with the customer\'s number, and a map to the house.' },
      { el: '#jd-work', say: 'At the house, he taps what he found, what he did, and whether the customer paid him. Then he taps Job finished. If there is no signal, the phone keeps it, and sends it later.' },
      { el: 'h3::Photos', say: 'He adds photos, and the parts he used, so the office knows what happened, and what stock is left.' },
      { go: 'tasks/mine', el: '.subtabs', say: 'Tasks is everyone\'s to-do list. Anyone can give anyone a task, and the Zuri manager adds tasks too. When you finish one, tick it, and the person who asked can see it is done.' },
      { go: 'money/today', el: '#m-body .kpis', say: 'Money is for the finance team and the partners only. It shows the cash in the bank and on M-Pesa, the bills still to pay, and what is left after the bills.' },
      { go: 'money/projection', el: '#mp-chart', say: 'Zuri also looks thirty days ahead: money coming in from renewals, and bills going out. If cash will run short, it warns us weeks before, not on the day.' },
      { go: 'money/payrun', el: '#pr-build', say: 'And each morning, the pay run: the bills that are due and the staff whose pay day it is, with the number to pay. Send it in M-Pesa, tap Sent, and it is recorded.' },
      { go: 'money/report', el: '#mr-copy', say: 'Every Friday, the report for the partners writes itself, ready to send on WhatsApp.' },
      { go: 'tasks/nudges', el: '#tk-body .item', say: 'Each morning, the manager also writes a short WhatsApp message for every staff member, with their most important jobs for the day.' },
      { go: 'me', el: '#view .card', say: 'Each person only sees what their job needs. A technician sees only their own jobs. The call center sees jobs and customers. Only finance and the partners see the money.' },
      { el: 'a[href="#learn"]', say: 'That is Zuri. Now watch the short videos for your own job, and try everything in practice. Practice uses pretend customers, so you cannot break anything.' },
    ], turn: ['Open Home and find how many customers are late', 'Open a job and find the customer\'s phone number', 'Watch the videos for your own job'] },
    { id: 'start', group: 'Everyone', title: 'Welcome to Zuri', mins: 2, role: null, steps: [
      { go: 'me', el: '#nav', say: 'Welcome to Zuri. This is the one app for the whole Zuri Fiber team. Your tabs are at the bottom. You only see the tabs your job needs.' },
      { el: '#nav a[data-tab=jobs]', say: 'Jobs is the work at customers\' houses: faults, new installs, and calls about payment.' },
      { el: '#nav a[data-tab=tasks]', say: 'Tasks is your to-do list. Anyone can give anyone a task. Every morning the Zuri manager adds what needs doing.' },
      { el: '#nav a[data-tab=me]', say: 'Me has your account, these videos, and anything waiting to send.' },
      { el: '#view .card', say: 'No signal? No problem. Zuri saves your work on the phone and sends it when signal comes back. A yellow badge at the top shows how many things are waiting.' },
      { el: '#me-theme', say: 'Working in bright sun? Choose Light. It is the easiest to read outside.' },
      { el: 'header', say: 'To put Zuri on your home screen: open it in Chrome, tap the three dots, then Add to Home screen. That\'s it. Now pick the video for your job.' },
    ], turn: ['Find your tabs at the bottom', 'Open Me and choose Light or Dark', 'Add Zuri to your home screen'] },

    { id: 'tasks', group: 'Everyone', title: 'Your task list', mins: 2, role: 'field', steps: [
      { go: 'tasks/mine', el: '.subtabs', say: 'This is Tasks. My day shows what is yours. Team shows everyone\'s list.' },
      { el: '#tk-body .item', say: 'Each task says who it is from and when it is due. High and urgent tasks come first.' },
      { el: '.tk-done', say: 'Finished? Tick the box. The person who gave it to you can see it is done.', do: tap('.tk-done') },
      { el: '.tk-cm', say: 'Stuck, or need to explain something? Tap Notes and write it. Everyone on the task sees your note.', do: tap('.tk-cm') },
      { el: '.tk-thread input[name=body]', say: 'Type your note and tap Add.', do: async () => { await type('.tk-thread input[name=body]', 'Done, the box needed a new splitter.')(); await tap('.tk-thread button::Add')(); } },
      { go: 'tasks/add', el: 'input[name=title]', say: 'To give someone a task, tap Add a task. Write what needs doing in a few words.', do: type('input[name=title]', 'Bring cable ties for the van') },
      { el: 'select[name=for]', say: 'Then choose who should do it: a person, or a whole group like Field techs.', do: choose('select[name=for]', 'p-peter') },
      { el: '#tk-add button[type=submit]', say: 'Tap Add task. It appears on their list straight away, even if you have no signal yet.', do: tap('#tk-add button[type=submit]') },
    ], turn: ['Tick one task as done', 'Write a note on a task', 'Add a task for yourself'] },

    { id: 'field-jobs', group: 'Field techs', title: 'Doing a job, start to finish', mins: 3, role: 'field', steps: [
      { pre: async () => { Z.set('jobs_filter', { show: 'active', tech: '', q: '' }); if (location.hash === '#jobs') Z.route(); }, go: 'jobs', el: '#j-list h3', say: 'These are your jobs. Today\'s jobs are at the top. A red dot means urgent. Do those first.' },
      { el: '#j-q', say: 'Looking for one job? Type a name, a phone number or the job number here.', do: async () => { await type('#j-q', 'mwangi')(); await sleep(900); await type('#j-q', '')(); } },
      { el: '#j-list .item', say: 'Tap a job to open it.', do: tap('#j-list .item') },
      { el: 'a[href^="tel:"]', say: 'Here is the customer. Tap Call to phone them before you go.' },
      { el: () => find('a[href*="maps.google"]') || find('#jd-pin'), say: 'Open map shows the way to the house. If there is no pin yet, you will drop one when you get there.' },
      { el: 'button[data-status=in_progress]', say: 'When you arrive, tap I\'m starting now. The office can see you are on site.', do: tap('button[data-status=in_progress]') },
      { el: '.chips[data-for=findings]', say: 'When the work is done, tap what you found. You can tap more than one, or type your own words.', do: tap('.chips[data-for=findings] button::Bad connector') },
      { el: '.chips[data-for=work_done]', say: 'Then tap what you did.', do: async () => { await tap('.chips[data-for=work_done] button::Replaced connector')(); await tap('.chips[data-for=work_done] button::Tested')(); } },
      { el: '#jd-paid', say: 'Did the customer pay you? Tap No, Cash, or M-Pesa.', do: tap('#jd-paid [data-v=mpesa]') },
      { el: '#jd-money', say: 'Type how much. For M-Pesa, type the code from the customer\'s message, so the office can match the payment.', do: async () => { await type('input[name=amount_collected]', '2000')(); await type('input[name=collection_ref]', 'UJ7K2M9PQR')(); } },
      { el: 'button[data-status=done]', say: 'Last, tap Job finished. Even with no signal it is saved, and it sends later.', do: tap('button[data-status=done]') },
      { go: 'jobs', el: '#j-list', say: 'The job leaves your list. On to the next one. Well done!' },
    ], turn: ['Open a job and tap I\'m starting now', 'Finish a job: tap what you found and what you did', 'Record a cash payment of 1500'] },

    { id: 'field-extras', group: 'Field techs', title: 'Photos, parts, map pins, new jobs', mins: 3, role: 'field', steps: [
      { go: 'jobs', el: '#j-list .item', say: 'Let\'s open a job.', do: tap('#j-list .item') },
      { el: 'label.btn::Add photo', say: 'Take a photo of the problem, and of your finished work. Tap Add photo. It works with no signal too: it uploads later.' },
      { el: '#jd-part', say: 'Write every part you use: routers, cable, connectors. Put the serial number for routers. This is how we keep track of stock.', do: async () => { await type('#jd-part input[name=item]', 'Drop cable 50m')(); await tap('#jd-part button[type=submit]')(); } },
      { el: '#jd-pin', say: 'Standing at the customer\'s house? Tap Drop pin here. Do it outside. If the phone says the location is not accurate, wait a minute and try again. A good pin saves the next tech an hour.' },
      { go: 'jobs', el: 'a[href="#jobs/new"]', say: 'Found a new problem while you are out? Tap Log a job.', do: tap('a[href="#jobs/new"]') },
      { el: 'textarea[name=summary]', say: 'Write what is wrong, in a few words.', do: type('textarea[name=summary]', 'Pole leaning near the market, cable is low') },
      { el: '#nj button[type=submit]', say: 'Tap Save job. It goes on your list, and the office sees it.', do: tap('#nj button[type=submit]') },
    ], turn: ['Add a part to a job', 'Log a new job of your own'] },

    { id: 'cc-followups', group: 'Call center', title: 'Payment follow-up calls', mins: 3, role: 'callcenter', steps: [
      { go: 'jobs', el: '#j-list .item::Payment follow-up', say: 'Every morning Zuri opens a Payment follow-up job for each customer whose internet ran out. These are your calls for the day.' },
      { el: '#j-list .item::Payment follow-up', say: 'Open one.', do: tap('#j-list .item::Payment follow-up') },
      { el: 'a[href^="tel:"]', say: 'You can see when their package ran out, and how much it costs. Tap Call.' },
      { el: '#jd-out', say: 'After the call, tap what happened. No answer: it comes back tomorrow. Says paid: we check the next billing import. Wants to stop: the job closes.' },
      { el: '[data-out=promise]', say: 'If they promise to pay, tap Will pay, and choose the day.', do: tap('[data-out=promise]') },
      { el: '.sheet [data-d="3"]', say: 'In three days, for example.', do: async () => { await tap('.sheet [data-d="3"]')(); await tap('#pp-ok')(); } },
      { el: '.timeline', say: 'Every call is written here, so anyone can see the whole story of this customer.' },
      { el: '#jd-sms', say: 'You can also send a friendly reminder: Text it for customers without WhatsApp, or WhatsApp it. The message is already written. Just press send.' },
      { el: '#nav a[data-tab=jobs]', say: 'When the customer pays, the job closes by itself. You never need to close it.' },
    ], turn: ['Open a follow-up and tap No answer', 'Record a promise to pay for Friday'] },

    { id: 'cc-newjob', group: 'Call center', title: 'A customer calls with a problem', mins: 2, role: 'callcenter', steps: [
      { go: 'jobs/new', el: '#nj-q', say: 'A customer calls: no internet. Start a new job. Type their name or phone number.', do: type('#nj-q', 'njeri') },
      { el: '#nj-res .item', say: 'Tap the right customer.', do: tap('#nj-res .item') },
      { el: 'select[name=kind]', say: 'Choose the type of job. Fault means no internet or slow internet.' },
      { el: 'textarea[name=summary]', say: 'Write what the customer says, in their words.', do: type('textarea[name=summary]', 'No internet since morning, router light red') },
      { el: '#nj-tech', say: 'Send it to a tech, and choose the visit day. Not sure who? Leave it, and the office decides.', do: choose('#nj-tech', 'p-peter') },
      { el: '#nj button[type=submit]', say: 'Tap Save job.', do: tap('#nj button[type=submit]') },
      { el: 'a.btn::on WhatsApp', say: 'Now tap to tell the tech on WhatsApp. The message has the customer, the problem and the map. Just press send.' },
    ], turn: ['Make a new fault job for John Mwangi', 'Send it to Brian'] },

    { id: 'customers', group: 'Call center', title: 'Finding a customer', mins: 2, role: 'callcenter', steps: [
      { go: 'customers', el: '#c-q', say: 'Customers holds everyone Zuri serves. Search by name, phone or account number.', do: type('#c-q', 'grace') },
      { el: '#view .list .item', say: 'Tap a customer to open them.', do: tap('#view .list .item') },
      { el: 'h2', say: 'Here is everything about them: package, phone, where they live, and when their payment runs out.' },
      { el: 'h3::Payments', say: 'Below are their payments, and every job we have done for them.' },
      { el: 'a[href^="#jobs/new/"]', say: 'To open a job for this customer, tap New job. Their details are filled in for you.' },
    ], turn: ['Find a customer by phone number', 'Open their payments'] },

    { id: 'fin-daily', group: 'Finance', title: 'Daily money: count, record, check', mins: 3, role: 'finance', steps: [
      { go: 'money/today', el: '#m-body .kpis', say: 'Money starts with Cash today: what is in the bank, the M-Pesa float, bills still owing, and cash left after bills.' },
      { el: '#m-body .alert', say: 'Red and orange boxes tell you what to do, like a float that is too low, or a bill that is due.' },
      { go: 'money/count', el: 'input[name=bank]', say: 'Count the cash at least once a week, and every Friday. Look at the bank app and the M-Pesa account, and type what each one says.', do: async () => { await type('input[name=bank]', '185000')(); await type('input[name=mpesa]', '39500')(); } },
      { el: '#mc button[type=submit]', say: 'Tap Save. The forecast for the next 30 days starts from this number.', do: tap('#mc button[type=submit]') },
      { go: 'money/expense', el: '#me-sms', say: 'Paid something by M-Pesa? Copy the confirmation message and paste it here.', do: type('#me-sms', 'UJ7K2M9PQR Confirmed. Ksh1,500.00 paid to KPLC PREPAID for account 5412 on 30/9/26 at 10:12 AM New M-PESA balance is Ksh38,000.00. Transaction cost, Ksh0.00.') },
      { el: '#me-read', say: 'Tap Read the message. Zuri fills in the code, the amount, who was paid, the date, and the new balance.', do: tap('#me-read') },
      { el: '#me-billrow', say: 'It even sees this is the KPLC bill, and ticks it off the bill list for you.' },
      { el: '#me button[type=submit]', say: 'Check the boxes, then tap Save expense.', do: tap('#me button[type=submit]') },
      { go: 'money/in', el: '#mi', say: 'Money that comes in, like hotspot sales or installation fees, goes in Money in. Customers\' monthly payments come from the billing website, so you don\'t type those.' },
    ], turn: ['Do a cash count', 'Record an expense from an M-Pesa message', 'Record 3,000 of hotspot money'] },

    { id: 'fin-bills', group: 'Finance', title: 'Paying the monthly bills', mins: 2, role: 'finance', steps: [
      { go: 'money/bills', el: '#m-body table', say: 'Every monthly bill is here: the due day, how much is paid, and how much is still owing.' },
      { el: '[data-pay]', say: 'When you send the money, tap Pay.', do: tap('[data-pay]') },
      { el: '#pb-from', say: 'Choose where the money came from: M-Pesa, bank or cash. Part payments are fine.', do: tap('#pb-from [data-v=Bank]') },
      { el: '.sheet input[name=ref]', say: 'Type the M-Pesa or bank code.', do: type('.sheet input[name=ref]', 'FT26274QX') },
      { el: '.sheet button.block', say: 'Tap Pay. It is recorded in Money out automatically, so you never type it twice.', do: tap('.sheet button.block') },
      { el: '[data-copy]', say: 'At the start of a new month, tap Copy last month\'s bills. Then change any amount that is different.' },
    ], turn: ['Pay part of a bill', 'Add a new bill for transport'] },

    { id: 'fin-statements', group: 'Finance', title: 'Bank & M-Pesa statements', mins: 3, role: 'finance', steps: [
      { go: 'money/statements', el: '#m-body .list', say: 'Every account Zuri money passes through is listed here: the bank, the business M-Pesa, and any phone customers pay into.' },
      { el: '#st-file', say: 'Once a month, bring in each statement. Excel, CSV or the M-Pesa PDF all work. Bringing the same one twice is safe: repeats are skipped.' },
      { go: 'money/sort', el: '#view .so-cat', say: 'Then sort the transactions. Choose what each one is: a customer payment, a bill, or money moving between our own accounts.', do: choose('#view .so-cat', 'Customer payment') },
      { el: '.so-always', say: 'Tick always to teach Zuri. Next time, every transaction like this one is sorted by itself.' },
      { el: '#so-all', say: 'Many the same? Tick them, choose once, and tap Sort ticked.' },
      { go: 'money/books', el: '#m-body .kpis', say: 'Profit by month adds it all up: income, expenses and profit, month by month. The more you sort, the truer it is.' },
    ], turn: ['Sort five transactions', 'Make one always rule', 'Read last month\'s profit'] },

    { id: 'partners', group: 'Partners & admin', title: 'Running the company from Home', mins: 3, role: 'admin', steps: [
      { go: 'home', el: '#view a.card', say: 'Home is the whole company on one page. At the top, the Zuri manager tells you what it noticed this morning.' },
      { el: '#view .alert', say: 'Needs attention lists the most important problems first. Tap one to go straight to it.' },
      { el: '#view .kpis', say: 'Customers: how many are active, how many have paid, and how much is late.' },
      { el: '#h-cash', say: 'This chart is our cash for the next 30 days: renewals coming in, bills going out. If it goes below zero, Zuri warns you weeks before.' },
      { go: 'money/collections', el: '#m-body .kpis', say: 'Who paid shows every customer this month: paid, late, or not due yet. Call or WhatsApp late payers from here.' },
      { go: 'money/report', el: '#mr-copy', say: 'On Friday, the report writes itself. Tap Copy, and paste it into the partners\' WhatsApp group.' },
      { go: 'tasks/nudges', el: '#tk-body .item', say: 'Every morning the manager writes a short WhatsApp for each staff member. Tap Open WhatsApp, press send, and mark it sent.' },
      { go: 'tasks/runs', el: '#tk-body .item', say: 'The Manager log shows everything the manager did. It only writes tasks, notes and reports. It never touches money or customers.' },
    ], turn: ['Find the day cash is lowest', 'Copy the Friday report', 'Send one nudge'] },

    { id: 'admin', group: 'Partners & admin', title: 'Adding a new staff member', mins: 2, role: 'admin', steps: [
      { go: 'admin/people', el: '#a-body .alert', say: 'New staff make their own account on the sign-in page, with their phone number. Then they wait here, switched off.' },
      { el: () => find('#a-body form[data-id="p-samuel"]'), say: 'Choose their job. A field tech sees only their own jobs. Call center sees jobs and customers. Office finance sees money too.', do: choose('#a-body form[data-id="p-samuel"] select[name=role]', 'field') },
      { el: () => find('#a-body form[data-id="p-samuel"] select[name=area]'), say: 'Choose their area.', do: choose('#a-body form[data-id="p-samuel"] select[name=area]', 'A') },
      { el: () => find('#a-body form[data-id="p-samuel"] input[name=active]'), say: 'Switch them on, and tap Save. They can now sign in.', do: async () => { const f = find('#a-body form[data-id="p-samuel"]'); if (f) { f.active.checked = true; f.requestSubmit(); } await sleep(600); } },
      { go: 'admin/visibility', el: '#a-body', say: 'Who sees what lets you hide private details, like a customer\'s ID number, from some jobs.' },
    ], turn: ['Switch on Samuel as a field tech in Zuri A'] },
  ];
  Z.lessons = LESSONS;

  // ---------- the player ----------
  // Softer voices first (Jerry: "that guy is too firm"). Names differ by phone, so this is a ranked wish-list.
  const SOFT = [/samantha/i, /karen/i, /moira/i, /tessa/i, /serena/i, /kate/i, /fiona/i, /google uk english female/i, /libby|sonia|aria|jenny|natasha|clara|emma/i, /female/i];
  const rank = (v) => { const i = SOFT.findIndex((re) => re.test(v.name)); return i < 0 ? 99 : i; };
  // Phones and Macs also carry joke and robot voices — never offer those for training.
  const SILLY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|fred|hysterical|deranged|grandma|grandpa|rocko|eddy|flo\b|reed|sandy|shelley/i;
  const englishVoices = () => ((window.speechSynthesis && speechSynthesis.getVoices()) || []).filter((v) => /^en/i.test(v.lang) && !SILLY.test(v.name))
    .sort((a, b) => rank(a) - rank(b) || (/en[-_](GB|KE|IE|AU)/i.test(b.lang) ? 1 : 0) - (/en[-_](GB|KE|IE|AU)/i.test(a.lang) ? 1 : 0));
  let voice = null;
  const pickVoice = () => {
    const vs = englishVoices();
    voice = vs.find((v) => v.name === Z.get('learn_voice', '')) || vs[0] || null;
  };
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  const muted = () => Z.get('learn_mute', false);
  function speak(text) {
    const min = Math.max(2600, text.split(/\s+/).length * 420); // reading time when sound is off
    if (window.ZURI_LEARN_FAST) return sleep(60); // checking every video quickly
    if (muted() || !window.speechSynthesis) return sleep(min);
    return new Promise((res) => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = 0.86; u.pitch = 1.05; // calm and a little slow: English is many people's second language
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      u.onend = fin; u.onerror = fin;
      setTimeout(fin, min * 2.5); // some phones never fire onend
      speechSynthesis.speak(u);
    });
  }

  let P = null; // the playing lesson
  async function play(lesson, from = 0) {
    stop(true);
    // Same starting point every time, so the jobs and bills the video taps are always there.
    if (Z.practice && window.ZP && from === 0 && !lesson.safe && !lesson.keep) { window.ZP.fresh(); Z.queue.length = 0; Z.saveQueue(); Z.syncBadge(); await Z.route(); }
    P = { lesson, i: from, paused: false, token: {} };
    const block = Object.assign(document.createElement('div'), { className: 'tour-block' });
    const ring = Object.assign(document.createElement('div'), { className: 'tour-ring' });
    const bar = Object.assign(document.createElement('div'), { className: 'tour-bar', role: 'dialog' });
    bar.innerHTML = `<div class="hint" style="margin:0 0 4px;color:inherit;opacity:.7">🎓 ${Z.esc(lesson.title)}</div><div class="cap" aria-live="polite"></div>
      <div class="ctl"><button data-a="back" aria-label="Back">⏮</button><button data-a="pause" aria-label="Pause">⏸</button><button data-a="next" aria-label="Next">⏭</button>
      <div class="prog"><i></i></div><button data-a="mute" aria-label="Sound">${muted() ? '🔇' : '🔊'}</button><button data-a="stop" aria-label="Close">✕</button></div>`;
    document.body.append(block, ring, bar);
    Object.assign(P, { block, ring, bar });
    bar.querySelector('[data-a=back]').onclick = () => jump(Math.max(0, P.i - 1));
    bar.querySelector('[data-a=next]').onclick = () => jump(P.i + 1);
    bar.querySelector('[data-a=stop]').onclick = () => stop();
    bar.querySelector('[data-a=mute]').onclick = (e) => { Z.set('learn_mute', !muted()); e.target.textContent = muted() ? '🔇' : '🔊'; if (muted() && window.speechSynthesis) speechSynthesis.cancel(); };
    bar.querySelector('[data-a=pause]').onclick = (e) => {
      P.paused = !P.paused; e.target.textContent = P.paused ? '▶' : '⏸';
      if (window.speechSynthesis) P.paused ? speechSynthesis.pause() : speechSynthesis.resume();
    };
    // Opened from a link (a new tab), the phone hasn't been tapped yet, and phones refuse to speak until it has.
    // So wait for one tap; otherwise the video races by in silence and looks like it "doesn't play" (v3, 5 Oct).
    const ua = navigator.userActivation;
    if (ua && !ua.hasBeenActive && !muted() && window.speechSynthesis && !window.ZURI_LEARN_FAST) {
      const go = Object.assign(document.createElement('button'), { className: 'btn block', textContent: '▶ Tap to start (sound on)' });
      go.style.cssText = 'margin:8px 0 2px;font-size:18px;min-height:52px';
      bar.querySelector('.cap').textContent = 'Turn your sound up, then tap the green button.';
      bar.querySelector('.ctl').before(go);
      const tok = P.token;
      go.onclick = () => { go.remove(); try { speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch (e) {} if (P && P.token === tok) run(tok); };
      return;
    }
    run(P.token);
  }
  function jump(i) { if (!P) return; if (window.speechSynthesis) speechSynthesis.cancel(); P.i = i; P.token = {}; P.paused = false; P.bar.querySelector('[data-a=pause]').textContent = '⏸'; run(P.token); }
  function stop(silent) {
    if (!P) return;
    if (window.speechSynthesis) speechSynthesis.cancel();
    [P.block, P.ring, P.bar].forEach((x) => x.remove());
    const lesson = P.lesson, finished = P.i >= lesson.steps.length;
    P = null;
    if (!silent && finished) yourTurn(lesson);
  }
  function placeRing(el) {
    if (!P) return;
    if (!el) { P.ring.style.cssText = 'left:50%;top:40%;width:0;height:0'; return; }
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(P.ring.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: Math.min(r.height + pad * 2, innerHeight * 0.6) + 'px' });
    P.bar.classList.toggle('top', r.top + r.height / 2 > innerHeight * 0.55);
  }
  async function run(token) {
    const L = P.lesson;
    while (P && P.token === token && P.i < L.steps.length) {
      const s = L.steps[P.i];
      P.bar.querySelector('.prog i').style.width = Math.round(((P.i + 1) / L.steps.length) * 100) + '%';
      if (s.pre) await s.pre();
      if (s.go && location.hash !== '#' + s.go) { await go(s.go)(); }
      const el = await waitFor(s.el, window.ZURI_LEARN_FAST ? 3500 : 7000);
      if (!P || P.token !== token) return;
      if (!el) console.warn(`[learn] ${L.id} step ${P.i + 1}: nothing to point at (${typeof s.el === 'string' ? s.el : 'custom'})`);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); await sleep(450); }
      if (!P || P.token !== token) return; // closed or skipped while scrolling
      placeRing(el);
      P.bar.querySelector('.cap').textContent = s.say;
      await speak(s.say);
      while (P && P.token === token && P.paused) await sleep(200);
      if (!P || P.token !== token) return;
      if (s.do) { P.block.style.pointerEvents = 'none'; try { await s.do(); } catch (e) { console.warn('lesson step', e); } if (P) P.block.style.pointerEvents = ''; }
      await sleep(500);
      if (P && P.token === token) P.i++;
    }
    if (P && P.token === token) {
      const done = Z.get('learn_done', {}); done[L.id] = new Date().toISOString(); Z.set('learn_done', done);
      stop();
    }
  }
  function yourTurn(lesson) {
    // Chapters of the long walkthrough chain straight on; ✕ on the bar stops them.
    if (!lesson.turn || !lesson.turn.length) {
      if (lesson.next) { Z.toast('Next chapter…'); setTimeout(() => start(lesson.next), 1200); return; }
      const sh = Z.sheet('✅ ' + lesson.title, `<p class="hint" style="margin-top:0">That was the whole walkthrough. Watch any chapter again from the Learn page.</p><button class="btn block" id="yt-ok">Done</button>`);
      Z.$('#yt-ok', sh.el).onclick = sh.close; return;
    }
    const next = LESSONS[LESSONS.indexOf(lesson) + 1];
    const sh = Z.sheet('✅ ' + lesson.title + ' — your turn', `
      <p class="hint" style="margin-top:0">Now try it yourself — this is practice, nothing is real. Tick each one when you've done it.</p>
      <div class="list">${lesson.turn.map((t, i) => `<label class="item" style="gap:12px"><input type="checkbox" data-t="${i}" aria-label="Done: ${Z.esc(t)}" value="${Z.esc(t)}" ${(Z.get('learn_turn', {})[lesson.id] || []).includes(i) ? 'checked' : ''}><span>${Z.esc(t)}</span></label>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button class="btn sec" id="yt-again">↺ Watch again</button>${next ? `<button class="btn" id="yt-next">Next: ${Z.esc(next.title)} ▶</button>` : ''}</div>`);
    Z.$$('[data-t]', sh.el).forEach((c) => (c.onchange = () => {
      const all = Z.get('learn_turn', {}); const s = new Set(all[lesson.id] || []);
      c.checked ? s.add(+c.dataset.t) : s.delete(+c.dataset.t); all[lesson.id] = [...s]; Z.set('learn_turn', all);
    }));
    Z.$('#yt-again', sh.el).onclick = () => { sh.close(); start(lesson.id); };
    const nb = Z.$('#yt-next', sh.el); if (nb) nb.onclick = () => { sh.close(); start(next.id); };
  }

  // Videos play in practice, as the right pretend person. Switching person (or into practice) needs a fresh start.
  function currentPracticeRole() { return window.ZP ? window.ZP.role() : null; }
  function start(id) {
    const lesson = LESSONS.find((l) => l.id === id); if (!lesson) return;
    const want = lesson.role || currentPracticeRole() || 'field';
    if (lesson.safe && !Z.practice) return play(lesson);             // only points, never taps: fine on real data
    if (Z.practice && currentPracticeRole() === want) return play(lesson);
    try { localStorage.setItem(AUTO, id); localStorage.setItem('zuri_practice_role', want); if (Z.training) localStorage.setItem('zuri_from_training', '1'); else localStorage.removeItem('zuri_from_training'); } catch (e) { /* storage blocked */ }
    location.href = location.pathname + '?practice#learn';
    if (Z.practice) location.reload();
  }
  Z.learn = start;
  Z.playLesson = (id) => play(LESSONS.find((l) => l.id === id));

  // ---------- the Learn page ----------
  const GROUP_FOR = () => (Z.isField() ? 'Field techs' : Z.me.role === 'callcenter' ? 'Call center' : Z.isFinance() && !Z.isAdmin() ? 'Finance' : Z.isAdmin() ? 'Partners & admin' : 'Everyone');
  // Pick the voice: hear a few, keep the one you like. Remembered on this phone.
  function chooseVoice() {
    pickVoice();
    const vs = englishVoices().slice(0, 6);
    if (!vs.length) return Z.toast('This phone has no voices to choose from — the captions still show.');
    const sh = Z.sheet('🔊 Choose the voice', `<p class="hint" style="margin-top:0">Tap ▶ to hear each one. Then tap the one you like.</p>
      <div class="list">${vs.map((v, i) => `<div class="item"><button class="btn sec small" data-hear="${i}" aria-label="Hear ${Z.esc(v.name)}">▶</button>
        <div class="grow"><div class="t">${Z.esc(v.name.replace(/\s*\(.*\)$/, ''))}${voice && v.name === voice.name ? ' <span class="pill ok">chosen</span>' : ''}</div><div class="m">${Z.esc(v.lang)}</div></div>
        <button class="btn small" data-use="${i}">Use this</button></div>`).join('')}</div>`);
    Z.$$('[data-hear]', sh.el).forEach((b) => (b.onclick = () => {
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance('Hello. I am the voice for your Zuri training videos.');
      u.voice = vs[+b.dataset.hear]; u.rate = 0.86; u.pitch = 1.05; speechSynthesis.speak(u);
    }));
    Z.$$('[data-use]', sh.el).forEach((b) => (b.onclick = () => { Z.set('learn_voice', vs[+b.dataset.use].name); pickVoice(); speechSynthesis.cancel(); sh.close(); Z.toast('Voice saved.'); }));
  }

  Z.routes.learn = async (_, el) => {
    const done = Z.get('learn_done', {});
    const mine = GROUP_FOR();
    const groups = ['Everyone', 'A day in the life', 'Field techs', 'Call center', 'Finance', 'Partners & admin', 'Every screen, every field'];
    const order = [ 'Everyone', mine, ...groups.filter((g) => g !== 'Everyone' && g !== mine)];
    const n = LESSONS.filter((l) => done[l.id]).length;
    el.innerHTML = `
      <h2>🎓 Learn Zuri</h2>
      <div class="card" style="border-left:4px solid var(--accent)">
        <b>Short talking videos that play on the real screens.</b>
        <p class="hint">New here? Start with <b>⭐ How to test</b>, then <b>⭐ What Zuri is</b>. Turn your sound on. Each one is 2–5 minutes and plays in <b>practice</b>, with pretend customers — so nothing real changes. After each video, try it yourself.</p>
        <div class="row"><span class="pill ${n === LESSONS.length ? 'ok' : 'brand'}">${n} of ${LESSONS.length} watched</span>
          ${window.speechSynthesis ? '<button class="btn sec small" id="ln-voice">🔊 Choose the voice</button>' : ''}
          ${Z.practice ? '<span class="pill warn">You are in practice</span>' : '<a class="btn sec small" href="?practice">Open practice without a video</a>'}</div>
      </div>
      ${order.map((g) => {
        const ls = LESSONS.filter((l) => l.group === g); if (!ls.length) return '';
        const blurb = { 'Every screen, every field': '📖 The whole system, one chapter per screen — explains every field.', 'A day in the life': '🌅 One working day through four people: Kelvin, Mary, Peter and a partner. The story carries from one chapter to the next.' }[g];
        const all = blurb ? `<div class="card row" style="border-left:4px solid var(--brand)"><div class="grow"><b>${blurb}</b><div class="hint" style="margin:0">About ${ls.reduce((n, l) => n + l.mins, 0)} minutes. Chapters play one after another; ✕ stops.</div></div><button class="btn small" data-learn="${ls[0].id}">▶ Play all</button></div>` : '';
        return `<h3>${g}${g === mine && g !== 'Everyone' ? ' · your job' : ''}</h3>${all}<div class="card list">${ls.map((l) => `
          <div class="item"><span style="font-size:24px">${done[l.id] ? '✅' : '▶️'}</span><div class="grow"><div class="t">${l.star ? '⭐ ' : ''}${Z.esc(l.title)}${l.star && !done[l.id] ? ' <span class="pill warn">start here</span>' : ''}</div><div class="m">${l.mins} min · ${l.steps.length} steps</div></div>
          <button class="btn small" data-learn="${l.id}">${done[l.id] ? 'Watch again' : '▶ Watch'}</button></div>`).join('')}</div>`;
      }).join('')}
      <h3>Print & keep</h3>
      <div class="card list">${[['field', '🛠️ Field tech — one-page guide'], ['callcenter', '📞 Call center — one-page guide'], ['finance', '💰 Finance — one-page guide'], ['partners', '⭐ Partners — one-page guide'], ['trainer', '🧑‍🏫 Trainer\'s guide: running a training day'], ['testers', '🧪 Tester checklist (printable)']].map(([k, t]) =>
        `<a class="item" href="guides/${k}.html" target="_blank" rel="noopener"><div class="grow"><div class="t">${t}</div><div class="m">One page · print it or keep it on your phone</div></div><span>›</span></a>`).join('')}</div>`;
    Z.$$('[data-learn]', el).forEach((b) => (b.onclick = () => start(b.dataset.learn)));
    const vb = Z.$('#ln-voice', el); if (vb) vb.onclick = chooseVoice;
    // Arrived here to play a video (just switched into practice / person)?
    let auto = null; try { auto = localStorage.getItem(AUTO); localStorage.removeItem(AUTO); } catch (e) {}
    if (auto && Z.practice) { const l = LESSONS.find((x) => x.id === auto); if (l) setTimeout(() => play(l), 400); }
  };
})();
