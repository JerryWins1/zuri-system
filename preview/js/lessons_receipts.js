// Zuri System · 🧾 Receipts — a chained series of narrated lessons on the real screens · v1 · 2026-10-10
// Ten chapters. Each starts from a fresh pretend company (practice), plays as the right person, and ends with its own
// "Your turn" when watched alone. ▶ Play all on the Learn page runs them one after another (✕ stops).
(function () {
  const Z = window.Z;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const find = (sel) => { const [css, text] = sel.split('::'); const all = [...document.querySelectorAll(css)]; return (text ? all.filter((e) => e.textContent.toLowerCase().includes(text.toLowerCase())) : all).find((e) => e.offsetParent !== null || e.getClientRects().length) || null; };
  const waitFor = async (sel, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = find(sel); if (e) return e; await sleep(120); } return null; };
  const tap = (sel) => async () => { const e = await waitFor(sel); if (e) e.click(); await sleep(600); };
  const type = (sel, text) => async () => { const e = await waitFor(sel); if (!e) return; e.focus(); e.value = ''; for (const ch of text) { e.value += ch; await sleep(text.length > 40 ? 8 : 40); } e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); e.blur(); await sleep(300); };
  const choose = (sel, value) => async () => { const e = await waitFor(sel); if (!e) return; const o = [...e.options].find((x) => x.value === value) || [...e.options].find((x) => x.textContent.includes(value)) || e.options[1]; e.value = o.value; e.dispatchEvent(new Event('change', { bubbles: true })); await sleep(400); };
  const seq = (...fns) => async () => { for (const f of fns) await f(); };
  // A pretend photo of a receipt, handed to the same code the camera button uses.
  const snap = (key) => async () => { await waitFor('#rc-cam'); const f = await window.ZP.receiptFile(key); if (Z.receipt && Z.receipt.usePhoto) await Z.receipt.usePhoto(f); await sleep(500); };
  const ai = (on) => async () => { if (window.ZP && window.ZP.setSetting) window.ZP.setSetting('receipts_ai', { on, by: 'Training video', at: new Date().toISOString() }); Z.set('rc_ai', on); };
  // Today's date the way Safaricom writes it: 10/10/26
  const mp = (n = 0) => { const d = new Date(Date.now() - n * 864e5); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2); };
  const closeSheet = async () => { const x = find('.sheet [data-x]'); if (x) x.click(); await sleep(400); };
  const G = '🧾 Receipts';
  const C = (id, title, mins, role, next, steps, turn) => ({ id, group: G, title, mins, role, next, steps, turn });

  const CH = [
    C('rc-why', '1 · Why receipts matter for Zuri', 3, 'finance', 'rc-snap', [
      { go: 'money/report', el: '#mr-rc-h', say: 'This series is about receipts: the small paper or message that proves where Zuri money went. First, why it matters. This is Kelvin, in finance, on Friday.' },
      { el: '#mr-rc', say: 'Every Friday, Zuri adds up the week: how much was spent, how many spends have a receipt, and how many are still missing.' },
      { el: '#mr-rc-cats', say: 'One: the tax office, KRA. When Zuri pays tax on its profit, every cost must be proven. A cost with no proper receipt can be refused, and then Zuri pays tax on money it never made.' },
      { el: '#mr-rc-top', say: 'Two: VAT. Zuri can only claim back the VAT on a receipt that shows the supplier\'s KRA PIN. No receipt, no claim. On a busy month that is thousands of shillings.' },
      { el: '#mr-rc-missing', say: 'Three: trust. Jerry is far away, and the partners share the profit. A receipt for every shilling means nobody has to wonder, and nobody is blamed by mistake.' },
      { go: 'money/expense', el: '#me-list', say: 'Four: the books. Every expense here is checked against the bank and M-Pesa statements. A receipt with the M-Pesa code makes that check automatic.' },
      { el: '.me-photo', say: 'Expenses with a camera button have the photo saved with them. Tap it, and the receipt opens, from anywhere, for anyone allowed to see that expense.', do: tap('.me-photo') },
      { el: '.sheet img', say: 'Here it is: the shop, the PIN, the items, the total. No more lost papers in a drawer.', do: closeSheet },
      { el: '#me-snapcard', say: 'So the rule is simple: spend Zuri money, get a receipt, snap it the same day. The next videos show exactly how. It takes less than a minute.' },
    ], ['Open Money → Friday report and find “Receipts this week”', 'Open one receipt photo from Money out', 'Say out loud the four reasons: KRA, VAT, trust, the books']),

    C('rc-snap', '2 · Snapping a receipt on a job, step by step', 4, 'field', 'rc-check', [
      { pre: ai(true), go: 'jobs', el: '#j-list .item', say: 'This is Peter, a field technician. He is at a customer\'s house and had to buy connectors on the way. Let\'s open the job.', do: tap('#j-list .item') },
      { el: '#jd-receipt-card', say: 'On every job there is this box: spent money on this job? Snap the receipt. Tap it.', do: tap('#jd-receipt') },
      { el: '#rc-job', say: 'The receipt page already knows which job this is for, so the office can see what each job really cost.' },
      { el: '#rc-cam', say: 'Lay the receipt flat, in good light, with the whole paper in the picture. Then tap Take a photo, and press the camera button.', do: snap('kamau-new') },
      { el: '#rc-status', say: 'Zuri makes the photo small enough for weak signal. Here, reading with AI is switched on, so Zuri reads the receipt and fills in the boxes.' },
      { el: '#rc-prev', say: 'The photo is kept. Tap it any time to see it bigger.' },
      { el: '#rc-payee', say: 'The boxes Zuri filled are marked yellow. The shop: Kamau Hardware.' },
      { el: '#rc-amount', say: 'The amount. Always look at the paper and check this number. It is the most important box.' },
      { el: '#rc-chips', say: 'What it was for: Zuri suggests it. Equipment, because Peter usually buys equipment at this shop. Tap a suggestion, or choose from the list.' },
      { el: '#rc-area', say: 'The area is filled from Peter\'s own area, and the date is today. Change them only if they are wrong.' },
      { el: '#rc-from', say: 'Paid with: M-Pesa, cash or bank. Zuri remembers what you used last time.' },
      { el: '#rc-ref', say: 'The M-Pesa code from the receipt. With the code, finance can match this spend to the M-Pesa statement automatically.' },
      { el: '#rc-photo-pill', say: 'And the receipt line says Photo saved. Nothing more to choose.' },
      { el: '#rc-save', say: 'Everything looks right. Tap Save. That\'s three taps: the button, the camera, and Save.', do: tap('#rc-save') },
      { el: '#jd-receipt-card', say: 'Zuri goes straight back to the job. The photo uploads by itself in the background.' },
      { go: 'receipt/mine', el: '#rc-list', say: 'Under Me, My receipts shows everything Peter recorded, with a photo button on each one. Only Peter and the finance team can see them.' },
    ], ['Open a job and tap 📸 Snap the receipt', 'Take a photo of any paper and save it as a receipt', 'Find it in Me → 🧾 My receipts']),

    C('rc-check', '3 · Checking and fixing what was read', 4, 'field', 'rc-mpesa', [
      { pre: ai(true), go: 'receipt', el: '#rc-head', say: 'Reading is a helper, not the boss. You are the boss. This video shows how to check, and fix, what Zuri read. Peter bought fuel for the motorbike.' },
      { el: '#rc-cam', say: 'He snaps the fuel receipt.', do: snap('rubis-new') },
      { el: '#rc-status', say: 'When Zuri is sure, it says: check the yellow boxes. When it is not sure, the message is orange: check every box carefully. Blurry or folded receipts are harder to read.' },
      { el: '#rc-amount', say: 'Look at the paper. The total is one thousand. If Zuri read a different number, tap the box and type the right one.', do: type('#rc-amount', '1000') },
      { el: '#rc-payee', say: 'The shop name. Write it the same way every time, like Rubis Maai Mahiu, so Zuri learns it.', do: type('#rc-payee', 'Rubis Maai Mahiu') },
      { el: '#rc-chips', say: 'The chips are suggestions. Usually means what this shop was called before. Looks like means words on the receipt, like petrol. The robot chip is the AI\'s guess.' },
      { el: '#rc-cat', say: 'If none is right, choose from the list. Fuel for work is Transport and Fuel.', do: choose('#rc-cat', 'Transport / Fuel') },
      { el: '#rc-area', say: 'Working in Zuri B today? Change the area, so the cost lands on the right area\'s books.', do: choose('#rc-area', 'B') },
      { el: '#rc-date', say: 'The date. If you forgot yesterday and snap it today, change the date to the day you paid.' },
      { el: '#rc-from', say: 'Paid with cash? Tap Cash.', do: tap('#rc-from [data-v=Cash]') },
      { el: '#rc-more', say: 'Under More are the VAT, the supplier\'s KRA PIN and what was bought. Zuri fills them from the receipt. Finance needs the PIN to claim the VAT back.', do: async () => { const d = find('#rc-more'); if (d) d.open = true; await sleep(400); } },
      { el: '#rc-pin', say: 'The PIN starts with a letter, has nine numbers, and ends with a letter. Check it against the paper.' },
      { el: '#rc-note', say: 'And a short note: what it was for. Fuel for the market jobs.', do: type('#rc-note', 'Fuel for the market jobs') },
      { el: '#rc-save', say: 'All checked. Save.', do: tap('#rc-save') },
      { el: '#rc-list', say: 'Saved, with the photo. If you find a mistake later, tell finance: they can correct it.' },
    ], ['Snap a receipt and change the amount before saving', 'Choose a different area and category', 'Open More and check the KRA PIN']),

    C('rc-mpesa', '4 · Pasting an M-Pesa message', 4, 'finance', 'rc-dupes', [
      { go: 'receipt', el: '#rc-paste-b', say: 'Many payments have no paper at all: just the M-Pesa message. The message is the receipt. Kelvin paid the hardware shop from the till. Tap Paste M-Pesa message.', do: tap('#rc-paste-b') },
      { el: '#rc-sms', say: 'In the Messages app, press and hold the M-Pesa message, tap Copy, come back, and paste it here.', do: type('#rc-sms', `UJ7H3M9KDB Confirmed. Ksh1,350.00 paid to KAMAU HARDWARE. on ${mp(0)} at 11:20 AM.New M-PESA balance is Ksh36,050.00. Transaction cost, Ksh0.00. Amount you can transact within the day is 498,650.00.`) },
      { el: '#rc-read', say: 'Tap Read the message. It works with no signal and costs nothing: Zuri reads it on the phone itself.', do: tap('#rc-read') },
      { el: '#rc-status', say: 'Zuri knows the kinds of M-Pesa message: paid to a till, sent to a Paybill with an account number, sent to a person, a cash withdrawal, airtime, and Fuliza.' },
      { el: '#rc-payee', say: 'It filled in the shop, the amount, the date and the code.' },
      { el: '#rc-chips', say: 'And the category, learned from history: payments to this shop were Equipment before. No AI needed for that.' },
      { el: '#rc-receipt', say: 'The receipt line says the M-Pesa message is the receipt. Save.', do: tap('#rc-save') },
      { el: '#rc-paste-b', say: 'Another one: a Paybill payment for the office electricity.', do: seq(tap('#rc-paste-b'), type('#rc-sms', `UJ8P2L5QRA Confirmed. Ksh2,000.00 sent to KPLC PREPAID for account 54123456 on ${mp(0)} at 9:05 AM New M-PESA balance is Ksh34,050.00. Transaction cost, Ksh0.00.`), tap('#rc-read')) },
      { el: '#rc-note', say: 'For a Paybill, the account number goes in the note. If the person was paid by Send money, their phone number goes there too, and the transaction cost.' },
      { el: () => find('#rc-billrow') && !find('#rc-billrow').hidden ? find('#rc-billrow') : find('#rc-cat'), say: 'For finance, Zuri also sees when a payment is one of this month\'s bills, like KPLC, and can tick it off the bill list at the same time.' },
      { el: '#rc-sms', say: 'One warning. If you paste a message where money came IN, Zuri tells you: that is not a spend.', do: seq(type('#rc-sms', `UJ9Q1W2ERT Confirmed.You have received Ksh1,000.00 from JANE WAMBUI 0712345678 on ${mp(0)} at 2:00 PM New M-PESA balance is Ksh35,050.00.`), tap('#rc-read')) },
      { el: '#rc-status', say: 'Money in goes in Money in, or comes from the billing website. Fuliza messages work too: only the Fuliza fee is a cost; the payment itself is in the other message.' },
    ], ['Paste a till message and save it', 'Paste a Paybill message and find the account number in the note', 'Paste a “You have received” message and read the warning']),

    C('rc-dupes', '5 · Repeats, and matching the statement', 3, 'finance', 'rc-offline', [
      { go: 'receipt', el: '#rc-head', say: 'Money must be counted once, never twice. Zuri checks every M-Pesa or bank code you type.' },
      { el: '#rc-paste-b', say: 'Peter forwarded this message: fuel at Total, two thousand. Kelvin pastes it.', do: seq(tap('#rc-paste-b'), type('#rc-sms', `UJ9T4R2WZE Confirmed. Ksh2,000.00 paid to TOTAL ENERGIES MAAI MAHIU. on ${mp(1)} at 5:40 PM.New M-PESA balance is Ksh33,950.00. Transaction cost, Ksh0.00.`), tap('#rc-read')) },
      { el: '#rc-match .alert', say: 'Green: already in the M-Pesa statement, matched. This payment came in with the statement import, but nobody had said what it was for. Saving links the two, so it is counted once, with its reason.' },
      { el: '#rc-cat', say: 'Fuel. Save.', do: seq(choose('#rc-cat', 'Transport / Fuel'), tap('#rc-save')) },
      { el: '#rc-paste-b', say: 'Now a message that was already recorded: Brian\'s hardware receipt from three days ago.', do: seq(tap('#rc-paste-b'), type('#rc-sms', `UJ5K7PQ2LM Confirmed. Ksh2,600.00 paid to KAMAU HARDWARE. on ${mp(3)} at 10:42 AM.New M-PESA balance is Ksh31,350.00. Transaction cost, Ksh0.00.`), tap('#rc-read')) },
      { el: '#rc-match .alert.bad', say: 'Red: already recorded, with who recorded it and when. Saving again would count it twice, so the Save button stops.' },
      { el: '#rc-anyway', say: 'Only if it really is a different payment with the same code, which almost never happens, tap Save anyway. Otherwise, just leave the page.' },
      { go: 'money/expense', el: '#me-list', say: 'In Money out, each expense shows its receipt. When statements are imported later, Zuri also links expenses by their code, so the books never count a payment twice.' },
    ], ['Paste a message whose code is already in the statement — see the green “matched”', 'Paste one that is already recorded — see the red warning']),

    C('rc-offline', '6 · No signal — what happens', 3, 'field', 'rc-ai', [
      { pre: async () => { Z.pretendOffline = true; Z.syncBadge(); }, go: 'receipt', el: '#hdr', say: 'Peter is in the valley, with no signal. For this video we switched the phone to no signal. Watch the badge at the top.' },
      { el: '#rc-cam', say: 'He snaps the receipt anyway.', do: snap('kamau-new') },
      { el: '#rc-status', say: 'Zuri says: no signal, type it, the photo will upload later. With no signal, Zuri cannot read the photo, so Peter types the few boxes himself.' },
      { el: '#rc-payee', say: 'The shop.', do: type('#rc-payee', 'Kamau Hardware') },
      { el: '#rc-amount', say: 'The amount.', do: type('#rc-amount', '1350') },
      { el: '#rc-cat', say: 'What it was for. The suggestions still work from what this phone remembers.', do: choose('#rc-cat', 'Equipment / Inventory') },
      { el: '#rc-save', say: 'Save.', do: tap('#rc-save') },
      { el: '#h-sync', say: 'The yellow badge: one thing waiting to send. The expense and the photo are kept safely on the phone, even if it is switched off.' },
      { go: 'receipt/mine', el: '#rc-list', say: 'In My receipts it shows: not sent yet. Peter can carry on working.' },
      { go: 'me', el: 'h3::Waiting', say: 'Under Me, Waiting to send lists it. Important: do not sign out while things are waiting.' },
      { el: '#view .card', say: 'Now the signal comes back.', do: async () => { Z.pretendOffline = false; Z.syncBadge(); await Z.flush(); await Z.route(); await sleep(500); } },
      { go: 'receipt/mine', el: '#rc-list', say: 'It sent by itself: the expense, and then the photo. Nothing to press. If something cannot send, a red badge appears; tap it, then Retry.' },
    ], ['Turn on airplane mode, snap a receipt, save it', 'See the yellow badge, then turn signal back on and watch it clear']),

    C('rc-ai', '7 · The AI setting (partners)', 3, 'admin', 'rc-missing', [
      { go: 'admin/settings', el: '#st-ai-card', say: 'Reading receipts with AI is a setting, and only the partners can change it. This is Jerry, under Me, Admin, Settings.' },
      { el: '#st-ai', say: 'It starts Off. Off means the photo is still kept with every expense, but people type the details themselves. Free.' },
      { el: '#st-ai [data-v=on]', say: 'On means the photo is sent to Zuri\'s reading helper, Claude, made by Anthropic. It reads the shop, amount, date, code, VAT and PIN, and suggests the category from Zuri\'s own list. It writes nothing by itself: the person checks and taps Save.', do: tap('#st-ai [data-v=on]') },
      { el: '#st-ai-card .alert', say: 'The cost: about three to five shillings per receipt, from Jerry\'s Anthropic account. A hundred receipts a month is about four hundred shillings. Each person can read up to forty a day.' },
      { el: '#st-ai-who', say: 'Zuri shows who changed it, and when.' },
      { go: 'receipt', el: '#rc-cam', say: 'With it On, a snapped receipt is read in a few seconds.', do: snap('kamau-new') },
      { el: '#rc-status', say: 'Like this. If the reading fails, or there is no signal, nobody sees an error: Zuri just asks them to type it, and the photo is kept.' },
      { go: 'admin/settings', el: '#st-ai [data-v=off]', say: 'To stop the cost at any time, tap Off. Everything keeps working; people type instead.', do: tap('#st-ai [data-v=off]') },
      { go: 'receipt', el: '#rc-cam', say: 'Now with it Off, the same photo…', do: snap('kamau-new') },
      { el: '#rc-status', say: 'Zuri says: type the details, reading is switched off. The partners decide. Jerry can switch it on when the boys are ready.' },
    ], ['Open Admin → Settings and switch AI reading On', 'Snap a receipt and see it read', 'Switch it Off and see the “type it” message']),

    C('rc-missing', '8 · Missing receipts: the nudge and the task', 3, 'field', 'rc-missing-fin', [
      { go: 'tasks/mine', el: '#tk-body .item::missing receipt', say: 'Sometimes there is no receipt at the time. Peter saved an expense with No receipt yet, chase it. Two days later, the Zuri manager put this on his list by itself.' },
      { el: '#tk-body .item::missing receipt', say: 'It is also in his morning WhatsApp nudge, so he sees it before he leaves home. No AI is needed for this: it is a simple rule that runs every morning.' },
      { go: 'receipt/mine', el: '#rc-chase', say: 'My receipts shows which one: the hardware shop, three thousand eight hundred and fifty. Peter goes back and asks the shop for the receipt.' },
      { el: '.rc-snap', say: 'Then he taps Snap it now.', do: tap('.rc-snap') },
      { el: '#rc-cam', say: 'And takes the photo. That is all.', do: snap('kamau') },
      { el: '#rc-list', say: 'The receipt is attached, and the expense now says photo.' },
      { go: 'tasks/mine', el: '#tk-snapcard', say: 'The next morning the manager sees the receipt is there and closes the task by itself. Nobody has to chase him.', do: async () => { if (window.ZP && window.ZP.receiptRules) window.ZP.receiptRules(); await Z.route(); } },
    ], ['Save an expense with “No receipt yet — chase it”', 'Find it in Me → 🧾 My receipts and tap 📸 Snap it now']),

    C('rc-missing-fin', '8b · Chasing receipts (finance)', 3, 'finance', 'rc-friday', [
      { go: 'tasks/mine', el: '#tk-body .item::Snap the receipt', say: 'Finance gets a second kind of task. Money left the M-Pesa or bank statement, and after three days there is still no expense with that code.' },
      { el: '#tk-body .item::Snap the receipt', say: 'The task says how much, to whom, and on which day. Kelvin finds out what it was, then records it with the code, so the two link and the task closes by itself.' },
      { el: '#tk-body .item::missing receipt', say: 'His own missing receipts come here too, just like Peter\'s.' },
      { go: 'tasks/nudges', el: '#tk-body .item', say: 'Every morning, the WhatsApp nudges include each person\'s missing receipts. Open WhatsApp, press send, mark it sent.' },
      { go: 'money/today', el: '#m-body .alert::receipt', say: 'Cash today also counts the expenses still missing a receipt this month, per area.' },
      { go: 'money/expense', el: '#me-list', say: 'And Money out shows every expense\'s receipt at a glance: photo, M-Pesa message, paper filed, or no receipt.' },
    ], ['Find a “Snap the receipt for KES…” task', 'Send one morning nudge that mentions a missing receipt']),

    C('rc-friday', '9 · Reading “Receipts this week” on Friday', 3, 'finance', 'rc-turn', [
      { go: 'money/report', el: '#mr-rc-h', say: 'Friday. The report for the partners now has a Receipts this week part. It covers the last seven days.' },
      { el: '#mr-rc', say: 'Spent: the total, and how many payments. With a receipt: photo, M-Pesa message, or paper filed. Missing: how many, and how much money that is.' },
      { el: '#mr-rc-cats', say: 'By category: where the money went. Fuel jumping, or equipment much higher than usual, is a question to ask.' },
      { el: '#mr-rc-top', say: 'The five biggest spends, with who recorded them. Tap the camera to see any receipt.', do: tap('.mr-photo') },
      { el: '.sheet img', say: 'Partners can look at the receipt right here.', do: closeSheet },
      { el: '#mr-rc-missing', say: 'And the missing list, with who recorded each one and the amount. Chase these before Monday.' },
      { el: '#view pre.report', say: 'The same part is in the report text. Copy for WhatsApp, and paste it in the partners\' group. The Zuri manager\'s own Friday report includes it too.' },
      { el: '#mr-csv', say: 'The month export to Excel now has a Receipt photo column, for the accountant.' },
    ], ['Open the Friday report and read the missing list', 'Open one receipt photo from the top 5', 'Copy the report for WhatsApp']),

    C('rc-turn', '10 · Your turn — try it all yourself', 2, 'field', null, [
      { go: 'receipt', el: '#rc-head', say: 'That is receipts in Zuri. Now try it yourself, in practice. Nothing here is real.' },
      { el: '#rc-cam', say: 'Take a photo of any paper, a shop receipt or even a page, and save it as a receipt.' },
      { el: '#rc-paste-b', say: 'Copy an old M-Pesa message from your own phone and paste it here. Zuri reads it on your phone; nothing is sent.' },
      { go: 'me', el: '#me-receipts', say: 'Your receipts are under Me. To try the finance and partner parts, use Me, Try another job.' },
    ], ['Snap a receipt on a job (Field tech)', 'Fix the amount and the category before saving', 'Paste an M-Pesa message (any job)', 'Paste one whose code is already recorded — see the warning (Finance)', 'Save one with airplane mode on, then watch it send', 'Switch AI reading On and Off (Partner: Admin → Settings)', 'Snap a missing receipt from My receipts', 'Read “Receipts this week” in the Friday report (Finance)']),
  ];
  if (Z.lessons) Z.lessons.push(...CH);
})();
