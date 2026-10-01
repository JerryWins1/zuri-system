// Zuri System · "A day in the life" — one working day through four people, on the real screens · v1 · 2026-10-01
// Five chapters that chain. The practice data carries from one chapter to the next, so the job Mary makes is the job Peter does.
(function () {
  const Z = window.Z;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const find = (sel) => { const [css, text] = sel.split('::'); const all = [...document.querySelectorAll(css)]; return (text ? all.filter((e) => e.textContent.toLowerCase().includes(text.toLowerCase())) : all).find((e) => e.offsetParent !== null || e.getClientRects().length) || null; };
  const waitFor = async (sel, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = find(sel); if (e) return e; await sleep(120); } return null; };
  const tap = (sel) => async () => { const e = await waitFor(sel); if (e) e.click(); await sleep(600); };
  const type = (sel, text) => async () => { const e = await waitFor(sel); if (!e) return; e.focus(); e.value = ''; for (const ch of text) { e.value += ch; await sleep(text.length > 40 ? 10 : 40); } e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); e.blur(); await sleep(300); };
  const choose = (sel, value) => async () => { const e = await waitFor(sel); if (!e) return; const o = [...e.options].find((x) => x.value === value) || [...e.options].find((x) => x.textContent.includes(value)) || e.options[1]; e.value = o.value; e.dispatchEvent(new Event('change', { bubbles: true })); await sleep(400); };
  const seq = (...fns) => async () => { for (const f of fns) await f(); };
  const G = 'A day in the life';
  const C = (id, title, mins, role, next, steps, extra = {}) => ({ id, group: G, title, mins, role, next, steps, turn: [], keep: true, ...extra });

  const CH = [
    C('day-1', '1 · 6:45 am — Kelvin opens the day', 4, 'finance', 'day-2', [
      { go: 'home', el: '#view a.card', say: 'It is a quarter to seven in Maai Mahiu. Kelvin opens Zuri with his tea. The Zuri manager ran at half past six: here is what it noticed overnight.' },
      { el: '#view .alert', say: 'Needs attention. Two things today: the Zuri B float is below target, and ten customers have run out of paid time.' },
      { go: 'tasks/mine', el: '#tk-body .item', say: 'His own list for the day, already written: a cash count, a bill to pay, statements to sort. He will tick them as he goes.' },
      { go: 'money/today', el: '#m-body .kpis', say: 'Money, Cash today. The bank, the M-Pesa float, bills owing, and cash after bills, for each area. The float warning is here too.' },
      { go: 'money/count', el: 'input[name=bank]', say: 'First job: a cash count. He opens the bank app and the M-Pesa account on his phone, and types what each one says.', do: seq(type('input[name=bank]', '186500'), type('input[name=mpesa]', '39800')) },
      { el: '#mc button[type=submit]', say: 'Save. Now the forecast for the next thirty days starts from a true number.', do: tap('#mc button[type=submit]') },
      { go: 'money/payrun', el: '#pr-build', say: 'Next, the pay run. Build today\'s list collects every bill that is due and every salary whose day has come.', do: tap('#pr-build') },
      { el: '#m-body .list .item', say: 'KPLC is due today, and so is Mary\'s salary. He copies the number, sends each one in the M-Pesa app, and comes back.' },
      { el: '.pr-sent', say: 'Then Sent, and the code from the M-Pesa message. Zuri records it as an expense, with his name and the time.', do: seq(tap('.pr-sent'), type('.sheet input[name=ref]', 'SJK3X9ABCD'), tap('.sheet button.block')) },
      { go: 'money/expense', el: '#me-sms', say: 'Dickson forwards an M-Pesa message: cable clips from the hardware shop. Kelvin pastes it in and taps Read the message.', do: seq(type('#me-sms', 'SJK4Q1ZTYU Confirmed. Ksh2,400.00 paid to MAMA NJERI HARDWARE on 1/10/26 at 11:02 AM New M-PESA balance is Ksh37,400.00. Transaction cost, Ksh0.00.'), tap('#me-read')) },
      { el: '#me button[type=submit]', say: 'The code, the amount, the shop, the date, even the new M-Pesa balance: filled in. He checks the category and saves.', do: tap('#me button[type=submit]') },
      { go: 'money/statements', el: '#m-body .list', say: 'The bank statement came in yesterday; twelve lines still to sort. That is an afternoon job. For now, the phones are starting to ring.' },
    ], { keep: false }),

    C('day-2', '2 · 8:30 am — Mary at the call center', 3, 'callcenter', 'day-3', [
      { go: 'jobs', el: '#j-list .item::Payment follow-up', say: 'Half past eight. Mary opens Jobs. Overnight, Zuri opened a payment follow-up for every customer whose internet ran out. These are her calls for the morning.' },
      { el: '#j-list .item::Payment follow-up', say: 'She opens the first one.', do: tap('#j-list .item::Payment follow-up') },
      { el: 'a[href^="tel:"]', say: 'The package ran out nine days ago. She taps Call. The customer says: Friday, when the salary comes.' },
      { el: '[data-out=promise]', say: 'So: Will pay, in three days. The job comes back on Friday to be checked.', do: seq(tap('[data-out=promise]'), tap('.sheet [data-d="3"]'), tap('#pp-ok')) },
      { go: 'jobs/new', el: '#nj-q', say: 'The phone rings. John Mwangi, near the market: no internet since morning, the router light is red. Mary starts a new job and finds him.', do: seq(type('#nj-q', 'mwangi'), tap('#nj-res .item')) },
      { el: 'textarea[name=summary]', say: 'Fault. She writes what he said, in his words.', do: seq(choose('select[name=kind]', 'fault'), type('textarea[name=summary]', 'No internet since morning, router light red'), choose('select[name=priority]', 'urgent')) },
      { el: '#nj-tech', say: 'Peter covers the market. She sends it to him for today, and saves.', do: seq(choose('#nj-tech', 'p-peter'), tap('#nj button[type=submit]')) },
      { el: 'a.btn::on WhatsApp', say: 'One more tap: Tell Peter on WhatsApp. The message has the customer, the problem and the map. He sees it before he has finished his tea.' },
    ]),

    C('day-3', '3 · 9:15 am — Peter on the road', 4, 'field', 'day-4', [
      { go: 'jobs', el: '#j-list .item::Mwangi', say: 'Quarter past nine. Peter checks his list on the motorbike. The new job from Mary is at the top, marked urgent.' },
      { el: '#j-list .item::Mwangi', say: 'He opens it.', do: tap('#j-list .item::Mwangi') },
      { el: 'a[href^="tel:"]', say: 'He calls John to say he is ten minutes away, and opens the map.' },
      { el: 'button[data-status=in_progress]', say: 'At the gate: I\'m starting now. Back at the office, Mary sees the job turn to In progress.', do: tap('button[data-status=in_progress]') },
      { el: '.chips[data-for=findings]', say: 'Twenty minutes later it is fixed. He taps what he found: a bad connector.', do: tap('.chips[data-for=findings] button::Bad connector') },
      { el: '.chips[data-for=work_done]', say: 'And what he did: replaced the connector, tested.', do: seq(tap('.chips[data-for=work_done] button::Replaced connector'), tap('.chips[data-for=work_done] button::Tested')) },
      { el: '#jd-paid', say: 'John pays this month\'s two thousand on the spot, by M-Pesa. Peter taps M-Pesa, the amount, and the code from John\'s message.', do: seq(tap('#jd-paid [data-v=mpesa]'), type('input[name=amount_collected]', '2000'), type('input[name=collection_ref]', 'SJK5M2PQRS')) },
      { el: 'button[data-status=done]', say: 'Job finished. The payment goes straight to the books, and Kelvin never has to chase it.', do: tap('button[data-status=done]') },
      { go: 'jobs', el: '#j-list', say: 'The job leaves his list. Next one. If the signal drops in the valley, the phone keeps everything and sends it later.' },
    ]),

    C('day-4', '4 · 2:00 pm — Kelvin\'s afternoon', 3, 'finance', 'day-5', [
      { go: 'money/sort', el: '#view .so-cat', say: 'Two o\'clock. The phones are quiet. Kelvin sorts the statement lines from yesterday\'s bank statement. This one is a customer payment.', do: choose('#view .so-cat', 'Customer payment') },
      { el: '.so-always', say: 'A KPLC line: he ticks Always, so every KPLC line sorts itself from now on. Twelve lines take five minutes.' },
      { go: 'money/collections', el: '#m-body .subtabs', say: 'Who paid. Late: the customers who have run out. Each one has a Call button and a ready-made WhatsApp reminder.' },
      { el: '#m-body .list .item a[href*="wa.me"]', say: 'He sends one reminder to a customer who always pays after a nudge.' },
      { go: 'money/projection', el: '#m-body .kpis', say: 'The next thirty days. The lowest point is above zero: good. If it were not, he would tell Jerry today, not on the day it bites.' },
      { go: 'tasks/mine', el: '.tk-done', say: 'Back to his list. Cash count, done. Pay run, done. Statements, done. Three ticks.', do: tap('.tk-done') },
    ]),

    C('day-5', '5 · 5:00 pm — the partners close the day', 3, 'admin', null, [
      { go: 'home', el: '#view .kpis', say: 'Five o\'clock. Dickson looks at Home before he leaves. Faults fixed today, installs waiting, the late count down by one, cash still fine.' },
      { go: 'tasks/team', el: '#tk-body', say: 'Team: what is still open across everyone. Nothing stuck more than two days, so nothing has escalated.' },
      { go: 'tasks/add', el: 'input[name=title]', say: 'He gives Peter a task for tomorrow: check the splitter at the market, two customers say it is slow at night.', do: seq(type('input[name=title]', 'Check the splitter box at the market'), choose('select[name=for]', 'p-peter'), tap('#tk-add button[type=submit]')) },
      { go: 'money/report', el: '#mr-copy', say: 'On Friday there is one more step: the report writes itself. Copy, paste into the partners\' WhatsApp group. Jerry reads it in Chicago over breakfast.' },
      { go: 'tasks/nudges', el: '#tk-body .item', say: 'And tomorrow at half past six it starts again: the manager writes everyone\'s list, and a WhatsApp nudge for each person. That is a day with Zuri.' },
    ], { turn: ['Do Kelvin\'s morning: a cash count, the pay run, one expense from a message', 'Do Mary\'s: one follow-up call, one new fault job sent to a tech', 'Do Peter\'s: start a job, finish it with an M-Pesa payment', 'Do the partner\'s: give someone a task, copy the Friday report'] }),
  ];
  if (Z.lessons) Z.lessons.push(...CH);
})();
