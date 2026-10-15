// Zuri System · ⏱ Time savers — narrated lessons on the real screens (practice), one per feature · v1 · 2026-10-10 (app v2.33)
// Each chapter has its own "Your turn" when watched alone; ▶ Play all on the Learn page chains them (✕ stops).
(function () {
  const Z = window.Z;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const find = (sel) => { if (typeof sel === 'function') return sel(); const [css, text] = sel.split('::'); const all = [...document.querySelectorAll(css)]; return (text ? all.filter((e) => e.textContent.toLowerCase().includes(text.toLowerCase())) : all).find((e) => e.offsetParent !== null || e.getClientRects().length) || null; };
  const waitFor = async (sel, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = find(sel); if (e) return e; await sleep(120); } return null; };
  const tap = (sel) => async () => { const e = await waitFor(sel); if (e) e.click(); await sleep(600); };
  const type = (sel, text) => async () => { const e = await waitFor(sel); if (!e) return; e.focus(); e.value = ''; for (const ch of text) { e.value += ch; await sleep(text.length > 40 ? 8 : 40); } e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); e.blur(); await sleep(300); };
  const choose = (sel, value) => async () => { const e = await waitFor(sel); if (!e) return; const o = [...e.options].find((x) => x.value === value) || [...e.options].find((x) => x.textContent.includes(value)) || e.options[1]; e.value = o.value; e.dispatchEvent(new Event('change', { bubbles: true })); await sleep(400); };
  const seq = (...fns) => async () => { for (const f of fns) await f(); };
  // Tap a Text / WhatsApp link the way a person does — Zuri writes it down — but in a training video don't really open the
  // phone's SMS app or WhatsApp.
  const tapLink = (sel) => async () => { const a = await waitFor(sel); if (!a) return; a.addEventListener('click', (e) => e.preventDefault(), { once: true }); a.click(); await sleep(800); };
  const inside = (itemSel, btnSel) => () => { const it = find(itemSel); return it ? it.querySelector(btnSel) : null; };
  const G = '⏱ Time savers';
  const C = (id, title, mins, role, next, steps, turn, more = {}) => ({ id, group: G, title, mins, role, next, steps, turn, ...more });
  let made = null; // a job a chapter makes for itself

  const CH = [
    C('ts-texts', '1 · Today\'s texts — the after-cutoff path in one list', 4, 'callcenter', 'ts-friday', [
      { pre: async () => { Z.set('jobs_filter', { show: 'active', tech: '', q: '' }); }, go: 'jobs', el: '#j-texts', say: 'This is Mary at the call center. Billnasi texts every customer three days before the package runs out, and then switches them off. Our part starts after the cutoff. Today\'s texts puts everyone due today in one list. Tap it.', do: tap('#j-texts') },
      { el: '#tx-head', say: 'One customer at a time, with the message already written. No more opening each job and looking for which step it is on.' },
      { el: '#tx-count', say: 'Up here: how many she has done, out of everyone due today.' },
      { el: '#tx-name', say: 'The customer: their area, account, package and price, and how many days ago they were switched off.' },
      { el: '#tx-steps', say: 'Where they are on the path: day one, help them reconnect. Day three, is anything wrong? Day seven, we miss you. Day fourteen, a last check-in. Day thirty, a kind goodbye.' },
      { el: '#tx-msg', say: 'Today\'s words, written for this step, with their name, the price and how to pay with the Zuri Paybill.' },
      { el: '#tx-sms', say: 'Tap Text. The phone\'s own messages app opens with the number and the words. She presses send there. It works without data. Zuri never sends anything by itself.', do: tapLink('#tx-sms') },
      { el: '#tx-ok', say: 'Zuri wrote it on the customer\'s job, and moved the job to the day of the next step. If they pay, the billing refresh closes it by itself.' },
      { el: '#tx-next', say: 'Then Next.', do: tap('#tx-next') },
      { el: () => find('#tx-callfirst') || find('#tx-msg'), say: 'On day three and day fourteen the card says: call first. Ask how the service was. If it was not working, open the job and tap Service problem, so a technician goes.' },
      { el: '#tx-wa', say: 'Some customers answer WhatsApp faster. Tap WhatsApp instead: it opens WhatsApp with the same words.', do: tapLink('#tx-wa') },
      { el: '#tx-next', say: 'Next.', do: tap('#tx-next') },
      { el: '#tx-skip', say: 'Can\'t reach someone today, or the number is wrong? Skip for today. They come back tomorrow.', do: tap('#tx-skip') },
      { el: '#tx-list', say: 'The whole list for today: sent, skipped, and still to send. Tap any name to jump to them.' },
      { go: 'tasks/mine', el: '#tk-body .item::Today\'s texts', say: 'Every morning the Zuri manager puts one task on her list: Today\'s texts and calls. The old list of customers to remind the day before is gone, because Billnasi already reminds them.' },
    ], ['Open Jobs → 📩 Today\'s texts', 'Send one text (to your own number in training) and tap Next', 'Skip one for today and find it in the list']),

    C('ts-friday', '2 · The Friday report writes itself', 4, 'finance', 'ts-expired', [
      { go: 'money/report', el: '#fr-head', say: 'Friday. Before, Mary and Vero gathered numbers on WhatsApp and Kelvin typed the report. Now Zuri writes it from the week\'s real work. This is Kelvin.' },
      { el: '#fr-stale', say: 'First, a check. The cash count is three days old, and the money part starts from it. So Zuri asks for a fresh count before anything else.' },
      { el: '#fr-appr', say: 'Payments recorded but still waiting for a second person\'s OK are listed, so nothing slips past the partners.' },
      { el: '#fr-jobs', say: 'Service this week: new faults, how many were fixed and how fast, what is still open, installs, and any outage.' },
      { el: '#fr-follow', say: 'Payment follow-ups: how many customers are cut off now, how many renewed this week, and how many texts went out.' },
      { el: '#fr-staff', say: 'The team: what each person did in Zuri this week. Jobs finished, texts sent, tasks ticked, receipts snapped. Good work is seen.' },
      { el: '#mr-rc-h', say: 'Receipts this week, from the receipts videos: spent, with receipts, and missing.' },
      { el: '#fr-ai', say: 'And on Fridays the Zuri manager writes its own summary from the real numbers: what happened, and three decisions for the partners, each with the why.' },
      { el: '#view pre.report', say: 'All of it becomes one message, ready for WhatsApp: the money for each area first, then service, follow-ups, the team, receipts, payments waiting, and the manager\'s summary.' },
      { el: '#mr-copy', say: 'Tap Copy for WhatsApp, open the partners\' group, and paste. That is the whole Friday job now.' },
      { el: '#mr-printview', say: 'Need it on paper, or as a PDF for the bank? Tap Printable view.', do: tap('#mr-printview') },
      { el: '#fr-print-head', say: 'A clean page, without the app\'s buttons and tabs.' },
      { el: '#mr-print', say: 'Tap Print, or save as PDF from the print screen.' },
    ], ['Open Money → 📊 Report and read each part', 'Copy it for WhatsApp', 'Open the printable view']),

    C('ts-expired', '3 · A fault call — but the package expired', 3, 'callcenter', 'ts-pins', [
      { go: 'jobs/new', el: '#nj-q', say: 'A customer calls: my internet is not working. Mary starts a new job and finds her.', do: type('#nj-q', 'njeri') },
      { el: '#nj-res .item', say: 'Grace Njeri. Tap her.', do: tap('#nj-res .item') },
      { el: '#nj-expired', say: 'Zuri warns straight away: her package expired, nine days ago. This is probably not a fault. The billing website switched her off. A technician\'s visit costs a boda fare and an hour, and paying fixes it in minutes.' },
      { el: '#nj-tofollow', say: 'So Mary tells her how to pay, and taps Turn this into a payment follow-up. No technician is sent.', do: tap('#nj-tofollow') },
      { el: '#jd-msgtext', say: 'She already had a payment follow-up, so Zuri opened it instead of making a second one. The words for her step are ready to send.' },
      { el: '.timeline', say: 'The note says why: she called about no internet, the package had expired, help her pay first.' },
      { pre: async () => {
          const cs = (await Z.sb.from('v_customers').select('id,full_name,area,paid_until,status').eq('status', 'active')).data || [];
          const c = cs.find((x) => x.paid_until && new Date(x.paid_until) < new Date() && !/njeri/i.test(x.full_name));
          const r = c ? await Z.sb.from('tickets').insert({ id: Z.uuid(), customer_id: c.id, area: c.area, kind: 'fault', priority: 'normal', summary: 'No internet since yesterday', opened_by: 'p-dickson', scheduled_for: Z.ymd() }).select() : null;
          made = r && r.data && r.data[0] ? r.data[0].id : null;
        }, go: 'jobs', el: '#j-list', say: 'It can also happen the other way: a fault job made before anyone checked. Here is one Dickson made this morning.', do: async () => { if (made) { location.hash = 'jobs/' + made; await sleep(700); } } },
      { el: '#jd-expired', say: 'The job itself shows the same warning, at the top, before anyone sends a technician.' },
      { el: '#jd-tofollow', say: 'One tap. If the customer already has a follow-up, Zuri closes this fault job with a note and opens the follow-up. If not, this job becomes the follow-up. Either way, nobody drives out for nothing.', do: tap('#jd-tofollow') },
      { el: () => find('#jd-msgtext') || find('h2'), say: 'And the call center carries on from the follow-up. It is a warning, never a wall: if the customer really has a fault, just save the job.' },
    ], ['Make a new fault job for Grace Njeri and read the warning', 'Tap “Turn this into a payment follow-up”', 'Make a fault job for John Mwangi (he has paid) — no warning']),

    C('ts-pins', '4 · Map pins and nearest-first', 4, 'field', 'ts-outage', [
      { pre: async () => { Z.set('jobs_filter', { show: 'active', tech: '', q: '' }); Z.set('jobs_near', false); }, go: 'jobs', el: '#j-near', say: 'This is Peter, a field technician, with several jobs today. Tap Nearest first. Zuri uses where the phone is and puts the closest job at the top.', do: tap('#j-near') },
      { el: '#j-list .j-dist::📍', say: 'Each job now shows how far away it is. Urgent jobs still stay on top.' },
      { el: '#j-near-hint', say: 'If location is switched off on the phone, nothing breaks: the list stays urgent first, then by day, and Zuri says how to switch location on.' },
      { el: '#j-list .item::slow', say: 'This customer has no map pin yet. Peter phoned for directions. Open the job.', do: tap('#j-list .item::slow') },
      { el: '#jd-pin', say: 'No map pin. Before, Peter had to remember to drop one.' },
      { el: 'button[data-status=in_progress]', say: 'Now, when he arrives and taps I\'m starting now…', do: tap('button[data-status=in_progress]') },
      { el: '#pn-acc', say: 'Zuri offers it by itself: save where you are standing as the customer\'s pin. It checks how accurate the phone is: twelve metres, good.' },
      { el: '#pn-yes', say: 'Yes, save the pin. One tap.', do: tap('#pn-yes') },
      { el: 'a[href*="maps.google"]', say: 'Now the next technician taps Open map and drives straight there.' },
      { go: 'jobs', el: '#j-list .item::Move router', say: 'Some pins were saved indoors, far from the gate. This customer\'s pin is a hundred and twenty metres off. Open the job.', do: tap('#j-list .item::Move router') },
      { el: '#jd-rough', say: 'Zuri marks it rough. When Peter starts this job, Zuri offers to replace it. If the phone itself is only accurate to more than fifty metres, Zuri says so: step outside, wait a minute and try again. The same guard as always.' },
    ], ['Jobs → 📍 Nearest first (allow location when the phone asks)', 'Start a job at a customer with no pin and save the pin', 'Find a rough pin and replace it from outside']),

    C('ts-outage', '5 · Outage spotting', 4, 'admin', 'ts-approve', [
      { pre: async () => { if (window.ZP && window.ZP.addFault) { window.ZP.addFault('B', 'No internet since 10 o\'clock', 50); window.ZP.addFault('B', 'Router red light, no internet', 25); } },
        go: 'jobs', el: '#j-list', say: 'Something is wrong in Zuri B. In the last hour, two customers there called: no internet. This is Jerry, a partner, looking at Jobs.' },
      { go: 'jobs/new', el: '#nj-area', say: 'A third call comes in, also from Zuri B.', do: choose('#nj-area', 'B') },
      { el: 'textarea[name=summary]', say: 'Mary writes what the caller says.', do: type('textarea[name=summary]', 'No internet, all the lights are red') },
      { el: '#nj button[type=submit]', say: 'Save job.', do: tap('#nj button[type=submit]') },
      { go: 'jobs', el: '.ou-card', say: 'Three fault calls in one area within two hours. Zuri says: possible outage in Zuri B. It is probably the cabinet, the OLT or the backhaul, not three separate houses.' },
      { go: 'tasks/team', el: '#tk-body .item::Possible outage', say: 'And it put one urgent task on the technical team\'s list, instead of three separate visits. Dickson checks the equipment for Zuri B first.' },
      { go: 'home', el: '#ou-notice', say: 'For the partners, Home shows the outage with a short notice to the customers, drafted by Zuri. Nothing goes to customers by itself.' },
      { el: '.ou-words', say: 'Jerry can change the words. Then Yes, or No.' },
      { el: '.ou-yes', say: 'Yes, use this notice.', do: tap('.ou-yes') },
      { el: '.ou-copy', say: 'Now the office copies it into a WhatsApp broadcast to the Zuri B customers. Fewer calls, calmer customers.' },
      { go: 'jobs/new', el: '#nj-area', say: 'While the outage lasts, a new call from Zuri B shows it right on the job form.', do: choose('#nj-area', 'B') },
      { el: '#nj-outage .ou-card', say: 'So whoever answers can tell the caller: we know, the technicians are on it. The new job joins the outage by itself.' },
      { go: 'jobs', el: '.ou-close', say: 'When the service is back, technical or a partner taps Service is back. The outage closes, and so does its task.', do: tap('.ou-close') },
      { el: '#j-list', say: 'Then each fault job from that area is checked and finished as usual.' },
    ], ['Make three fault jobs in Zuri B within a few minutes', 'Find the outage task on the technical list', 'Say yes to the customer notice and copy it (partner)', 'Close the outage when service is back']),

    C('ts-approve', '6 · Two people for every payment — recording', 4, 'finance', 'ts-approve2', [
      { go: 'money/bills', el: () => find('#m-body .bill-wait') || find('#m-body .bill-table td::waiting'), say: 'Zuri\'s rule: money out always needs two people. Now the database enforces it. This is Kelvin. Yesterday he paid the Bayobab backhaul: it says waiting for a second OK. The bill does not count it as paid yet.' }, // v2.36 (15 Oct): a computer shows the bills as a table, not cards
      { el: '[data-pay]', say: 'Today KPLC is due. He taps Pay.', do: tap('[data-pay]') },
      { el: '#pb-two', say: 'The sheet says how it works: after he records it, someone else approves it. Best: ask first, send after the OK, then add the code.' },
      { el: '.sheet input[name=ref]', say: 'He already sent this one, so he types the M-Pesa code.', do: type('.sheet input[name=ref]', 'UJ8KPLC123') },
      { el: '.sheet button.block', say: 'Pay and record it.', do: tap('.sheet button.block') },
      { go: 'money/approvals', el: '#ap-mine', say: 'Approvals, under Bills. These are Kelvin\'s own payments. There is no Approve button for him: someone else must approve them.' },
      { el: '#ap-mine .ap-back', say: 'If he made a mistake, he can withdraw it, with a reason.' },
      { el: '#ap-rule', say: 'What if someone tried to approve their own payment some other way? The database itself refuses.', do: async () => { const mine = (await Z.sb.from('expenses').select('id').eq('approval', 'waiting').eq('created_by', Z.me.id)).data || []; if (mine[0]) { const r = await Z.sb.rpc('approve_money', { p_expense: mine[0].id }); if (r.error) Z.toast(r.error.message); } await sleep(1500); } },
      { el: '#ap-forme', say: 'Waiting for his OK: payments other people recorded. Field technicians\' receipts are here too. They are expenses, and finance confirms them: finance is the second person.' },
      { el: '#ap-forme .ap-ok', say: 'He checks the amount, the person and the receipt, and taps Approve.', do: tap('#ap-forme .ap-ok') },
      { el: '#ap-done', say: 'Approved this week shows it, with his name and the time.' },
      { el: '#ap-switch', say: 'In practice you can play the second person: switch to Jerry. In real life, it is Jerry\'s own phone and his own login. The next chapter does exactly that.' },
    ], ['Pay a bill and see “waiting for a second OK”', 'Try to approve your own — read why not', 'Approve a payment someone else recorded']),

    C('ts-approve2', '6b · Two people for every payment — approving', 3, 'admin', 'ts-turn', [
      { go: 'home', el: '#h-appr', say: 'This is Jerry, a partner, on his own phone. Home says: payments waiting for your OK.', do: tap('#h-appr') },
      { el: '#ap-forme', say: 'Kelvin\'s payments are here, with what they were for, the amount, the code and the time.' },
      { el: inside('#ap-forme .ap-item::Bayobab', '.ap-ok'), say: 'The Bayobab backhaul looks right. Approve.', do: tap(inside('#ap-forme .ap-item::Bayobab', '.ap-ok')) },
      { go: 'money/bills', el: () => find('#m-body .bill-cards .item::Bayobab') || find('#m-body .bill-table tr::Bayobab'), say: 'Only now does the Bayobab bill count it as paid.' }, // v2.36 (15 Oct): a computer shows the bills as a table, not cards
      { go: 'money/approvals', el: () => find('#ap-forme .ap-no') || find('#ap-forme'), say: 'Something wrong? A wrong number, or not a Zuri cost? Decline it and say why. The request is removed, the bill is not touched, and the log keeps it.' },
      { go: 'money/payrun', el: '#pr-build', say: 'The pay run works the same way: Sent puts the line on waiting, and a second person approves it.' },
      { go: 'admin/settings', el: '#st-appr-card', say: 'The rule lives in Admin, Settings. On means two people for every payment above this amount. Zero means every payment.' },
      { el: '#st-appr [data-v=off]', say: 'Off is only for while just one person has an account. It shows a red warning. When Kelvin has his own login, it stays On.' },
    ], ['Approve a payment someone else recorded', 'Decline one with a reason', 'Find the rule in Admin → Settings'], { keep: true }),

    C('ts-turn', '7 · Your turn — try every time saver', 2, 'admin', null, [
      { go: 'jobs', el: '#j-texts', say: 'That is the time savers. Now try them yourself, in practice. Nothing here is real.' },
      { go: 'money/report', el: '#fr-head', say: 'The Friday report is under Money, Report.' },
      { go: 'money/approvals', el: '#ap-rule', say: 'Approvals are under Money, Bills. To try both people, use the practice switch, or Me, Try another job.' },
      { go: 'me', el: 'a[href="#learn"]', say: 'Every chapter is on the Learn page, to watch again any time.' },
    ], ['Send today\'s texts (Call center)', 'Copy the Friday report (Finance)', 'Turn an expired customer\'s fault call into a follow-up (Call center)', 'Save a pin at “I\'m starting now” (Field tech)', 'Make an outage in Zuri B and close it (Partner)', 'Pay a bill as Kelvin, approve it as Jerry']),
  ];
  if (Z.lessons) Z.lessons.push(...CH);
})();
