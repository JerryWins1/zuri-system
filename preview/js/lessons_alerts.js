// Zuri System · 📣 Alerts — narrated lessons on the real screens (practice), one per job · v1.1 · 2026-10-27 (app v2.56: + 7 · Email)
// Each chapter sets its own scene (an outage, a waiting alert…), so it plays on its own; ▶ Play all chains them (✕ stops).
(function () {
  const Z = window.Z;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const find = (sel) => { if (typeof sel === 'function') return sel(); const [css, text] = sel.split('::'); const all = [...document.querySelectorAll(css)]; return (text ? all.filter((e) => e.textContent.toLowerCase().includes(text.toLowerCase())) : all).find((e) => e.offsetParent !== null || e.getClientRects().length) || null; };
  const waitFor = async (sel, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = find(sel); if (e) return e; await sleep(120); } return null; };
  const tap = (sel) => async () => { const e = await waitFor(sel); if (e) e.click(); await sleep(700); };
  const type = (sel, text) => async () => { const e = await waitFor(sel); if (!e) return; e.focus(); e.value = ''; for (const ch of text) { e.value += ch; await sleep(40); } e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); e.blur(); await sleep(450); };
  const choose = (sel, value) => async () => { const e = await waitFor(sel); if (!e) return; const o = [...e.options].find((x) => x.value === value) || [...e.options].find((x) => x.textContent.includes(value)) || e.options[1]; e.value = o.value; e.dispatchEvent(new Event('change', { bubbles: true })); await sleep(400); };
  const check = (sel) => async () => { const e = await waitFor(sel); if (e && !e.checked) e.click(); await sleep(400); };
  const seq = (...fns) => async () => { for (const f of fns) await f(); };
  const G = '📣 Alerts';
  const C = (id, title, mins, role, next, steps, turn, more = {}) => ({ id, group: G, title, mins, role, next, steps, turn, ...more });
  const OUT_B = { code: 'OUT', areas: ['B'], blanks: { eta: '4pm today', eta_sw: 'saa 10 jioni' } };
  let made = null, grace = null; // what a chapter set up for itself

  const CH = [
    C('al-outage', '1 · An outage: text the whole area', 3, 'callcenter', 'al-approve', [
      { pre: async () => { if (window.ZP && window.ZP.addFault) { window.ZP.addFault('B', 'No internet since 10 o\'clock', 50); window.ZP.addFault('B', 'Router red light, no internet', 25); window.ZP.addFault('B', 'All the lights are red', 5); } },
        go: 'jobs', el: '.ou-card', say: 'This is Mary at the call center. Three customers in Zuri B called with no internet. Zuri says: possible outage. Soon every phone in Zuri B will be ringing.' },
      { el: '.ou-card a[href^="#alerts/new/OUT"]', say: 'So she tells them all at once, before they call. Tap Text the Zuri B customers.', do: tap('.ou-card a[href^="#alerts/new/OUT"]') },
      { el: '#al-who', say: 'Who gets it: the Zuri B customers. Zuri picked the area from the outage.' },
      { el: '#al-st', say: 'Only Active customers. Someone who is switched off isn\'t affected by an outage.' },
      { el: '#al-b-eta', say: 'She fills in when it should be back, as the technicians told her.', do: type('#al-b-eta', '4pm today') },
      { el: '#al-b-eta_sw', say: 'And the same in Kiswahili, the way people say it: saa kumi jioni.', do: type('#al-b-eta_sw', 'saa 10 jioni') },
      { el: '#al-read', say: 'This is exactly what the customers will read, in Kiswahili and in English. Each customer gets their own language. It fits in one SMS.' },
      { el: '#al-sum', say: 'How many customers and phones, how many prefer each language, and anyone left out: people who said no to these messages, or have no phone number. On the free plan it goes by WhatsApp, so there is nothing to pay.' },
      { el: '#al-save', say: 'Mary can\'t send it on her own. She asks a partner for a yes.', do: tap('#al-save') },
      { el: '#al-act', say: 'Now it waits for a partner. If it\'s urgent, she phones Jerry: it\'s on his Home screen.' },
      { el: '#al-tl', say: 'Every step is written down: who wrote it, who said yes, who sent it, and when. Zuri never sends anything by itself.' },
    ], ['Make three fault jobs in Zuri B', 'Tap 📣 Text the Zuri B customers on the outage card', 'Fill in the time in English and Kiswahili, and ask a partner for a yes']),

    C('al-approve', '2 · A partner says yes, and it goes out', 3, 'admin', 'al-fix', [
      { pre: async () => { made = await Z.alertMake({ ...OUT_B, status: 'draft', minsAgo: 4 }); },
        go: 'home', el: '#h-alerts', say: 'This is Jerry, a partner. Home says: one alert waiting for your yes.', do: tap('#h-alerts a') },
      { el: '#al-l-wait', say: 'Waiting for a partner: Mary\'s outage message for Zuri B. He opens it.', do: tap('#al-l-wait a.item') },
      { el: '#al-sw', say: 'He reads the Kiswahili,' },
      { el: '#al-en', say: 'and the English. Once he says yes, nobody can change the words or the people. Not even a partner: the database refuses. To change it, cancel it and write a new one.' },
      { el: '#al-yes', say: 'It\'s right. Yes, approve.', do: tap('#al-yes') },
      { el: '#al-send', say: 'Now it can go out. Zuri doesn\'t send it by itself. On the free plan it goes by WhatsApp.' },
      { el: '#al-wa', say: 'The customers come in groups, by language, up to two hundred and fifty-six in each: the most one WhatsApp broadcast list can take.' },
      { el: '#al-wa [data-vcf]', say: 'Save contacts puts a whole group into the office phone\'s contacts in one go. Then in WhatsApp: New broadcast, pick them, and paste the words.', do: tap('#al-wa [data-vcf]') },
      { el: '#al-wa [data-words]', say: 'Copy the words for that group, paste them into the broadcast, and send. Customers only get broadcasts if they have saved Zuri\'s number, so ask them to.', do: tap('#al-wa [data-words]') },
      { el: '#al-sms-locked', say: 'To reach every phone, even without WhatsApp, there is Bulk SMS. It\'s an add-on: you pay only for the texts you send, and only after a partner switches it on.' },
      { el: '#al-sent', say: 'When it has gone out, tap It went out.', do: tap('#al-sent') },
      { el: '#al-tl', say: 'Written by Mary, approved by Jerry, sent, each with the time. That\'s the whole story of every message the customers got.' },
    ], ['Approve an alert from the Home card', 'Download the list and look at the rows', 'Tap It went out']),

    C('al-fix', '3 · Service is back: the same people hear it', 2, 'admin', 'al-cabinet', [
      { pre: async () => { made = await Z.alertMake({ ...OUT_B, status: 'sent', minsAgo: 120 }); },
        get go() { return 'alerts/' + made; }, el: '#al-tl', say: 'Two hours later the technicians fixed the cabinet. This outage message went to the Zuri B customers this morning.' },
      { el: '#al-fix', say: 'Now those same customers should hear that it\'s back.' },
      { el: '#al-fix a', say: 'Send FIX to the same people.', do: tap('#al-fix a') },
      { el: '#view .alert.ok', say: 'Exactly the people who got the outage message. Nobody missed, and nobody who wasn\'t affected.' },
      { el: '#al-read', say: 'Internet is back, thank you for your patience, and what to do if theirs is still off: restart the router, then call or WhatsApp us.' },
      { el: '#al-save', say: 'Jerry is a partner, so he can save and approve in one step.', do: tap('#al-save') },
      { el: '#al-send', say: 'Then the same as before: download the list, send it, and tap It went out.' },
    ], ['Open a sent outage alert', 'Tap ✅ Send FIX to the same people', 'Check the count is the same, then approve']),

    C('al-cabinet', '4 · By cabinet: only the homes on that cabinet', 3, 'technical', 'al-customer', [
      { go: 'alerts/new/MAINT', el: '#al-who', say: 'This is Dickson, technical. On Saturday he will work on cabinet A-1. Only the homes wired to that cabinet need to know.' },
      { el: '#al-mode a[data-m=hub]', say: 'By cabinet or tower.', do: tap('#al-mode a[data-m=hub]') },
      { el: '#al-hubs', say: 'Every cabinet, tower and OLT on the map. Choosing the OLT reaches everyone behind it.' },
      { el: '#al-hubs button::Cabinet A-1', say: 'Cabinet A-1.', do: tap('#al-hubs button::Cabinet A-1') },
      { el: '#al-sum', say: 'Each home goes with the cabinet set on the customer\'s page, or, if nobody set it, the nearest cabinet on the map.' },
      { el: () => find('#al-sum .alert.warn::no map pin') || find('#al-sum'), say: 'A home with no map pin and no cabinet can\'t be placed. Zuri names them, so someone can fix them before Saturday. Or send by area instead.' },
      { el: '#al-fill', say: 'Planned work needs the day, the time and how long, in English and in Kiswahili.',
        do: seq(type('#al-b-date', 'Sat 18 Oct'), type('#al-b-date_sw', 'Jumamosi 18 Okt'), type('#al-b-time', '10am'), type('#al-b-time_sw', 'saa 4 asubuhi'), type('#al-b-duration', '2 hours'), type('#al-b-duration_sw', 'saa 2')) },
      { el: '#al-read', say: 'Planned work in Cabinet A-1, on Saturday from ten, for about two hours. Sent the day before, it saves a morning of calls.' },
      { el: '#al-save', say: 'Ask a partner for a yes.', do: tap('#al-save') },
      { go: 'customers/map', el: '#cmap', say: 'It also starts from the map. Tap a cabinet or tower, then Text the homes on this cabinet.' },
      { go: 'alerts', el: '#al-quick', say: 'And from Customers, Alerts. The usual ones are one tap away: outage, service back, planned work, and power cut. Power cut tells customers it\'s KPLC, not us.' },
    ], ['Write a planned-work alert for one cabinet', 'Find the homes it says have no cabinet', 'Open the map and tap a cabinet']),

    C('al-customer', '5 · One customer: cabinet, language, and yes to offers', 2, 'callcenter', 'al-partner', [
      { pre: async () => { const r = await Z.sb.from('v_customers').select('id,full_name').eq('area', 'A').eq('status', 'active').order('full_name').limit(1); grace = r.data && r.data[0] ? r.data[0].id : null; },
        get go() { return 'customers/' + grace; }, el: '#cp-alerts', say: 'Every customer\'s page has a new box: Messages.' },
      { el: '#cap-f select[name=served_by_hub]', say: 'Which cabinet or tower the home is wired to. Field technicians set it on the job page at the install. Until then, Zuri uses the nearest one.', do: choose('#cap-f select[name=served_by_hub]', 'h3') },
      { el: '#cap-f select[name=lang]', say: 'The language they want. Most get Kiswahili; some prefer English.', do: choose('#cap-f select[name=lang]', 'en') },
      { el: '#cap-f input[name=ok_service]', say: 'Outages and planned work: on for everyone, unless they ask us to stop.' },
      { el: '#cap-f input[name=ok_offers]', say: 'Offers and upgrades: only when the customer says yes. Ask them on the phone.', do: check('#cap-f input[name=ok_offers]') },
      { el: '#cap-f input[name=consent_note]', say: 'Then write down how and when they said yes. Zuri won\'t save a yes to offers without it.', do: type('#cap-f input[name=consent_note]', 'Said yes on the phone, 16 Oct') },
      { el: '#cap-f button', say: 'Save.', do: tap('#cap-f button') },
    ], ['Set a customer\'s cabinet and language', 'Try to save a yes to offers without a note', 'Add the note and save']),

    C('al-partner', '6 · Partners: the words, the add-ons and quiet hours', 3, 'admin', 'al-email', [
      { go: 'alerts/codes', el: 'form[data-code=OUT]', say: 'The partners own the words. Messages lists every ready-made alert.' },
      { el: 'form[data-code=OUT] textarea[name=msg_sw]', say: 'Read every Kiswahili message and change anything that doesn\'t sound right. Keep them short: up to 160 letters is one SMS.' },
      { el: 'form[data-code=RENEW]', say: 'Package ending is off. Billnasi already texts customers three days before the cutoff, so we don\'t send it twice.' },
      { el: 'form[data-code=UPGRADE]', say: 'Offers go only to customers who said yes, and never during quiet hours.' },
      { el: '#al-newcode', say: 'Need another one? Add a new message with its own short code.' },
      { go: 'alerts/setup', el: '#al-plan', say: 'Plan and add-ons. Alerts works for free, with WhatsApp. Anything that costs money is a switch, and it stays off until Zuri needs it.' },
      { el: 'input[name=sms_list]', say: 'When Zuri grows, switch on Bulk SMS. There is no monthly fee: you pay the SMS company only for the texts you send.', do: check('input[name=sms_list]') },
      { el: 'input[name=sms_price_kes]', say: 'The price of one SMS, from the bulk-SMS bill. Then every alert shows its cost before anyone says yes.', do: type('input[name=sms_price_kes]', '0.80') },
      { el: 'input[name=sender_id]', say: 'The sender name registered with the SMS company, so customers see it\'s really Zuri.' },
      { el: () => find('#al-plan .item::Automatic'), say: 'Later, with the Daraja server, Zuri can send the texts itself, paid from M-Pesa credit with a monthly cap, so there is never a surprise bill.' },
      { el: 'input[name=quiet_from]', say: 'Quiet hours: offers never go out after seven in the evening. Kenyan rules allow promotional texts only from seven to seven. Outage messages can go any time.' },
      { el: '#al-set button', say: 'Save.', do: tap('#al-set button') },
    ], ['Read every Kiswahili message', 'Find Plan & add-ons and read what each costs', 'Check the quiet hours']),

    C('al-email', '7 · Email: free, to customers who said yes', 2, 'admin', 'al-turn', [
      { pre: async () => { made = await Z.alertMake({ code: 'MAINT', areas: ['B'], blanks: { date: 'Saturday', date_sw: 'Jumamosi', time: '10am', time_sw: 'saa 4 asubuhi', duration: '2 hours', duration_sw: 'saa 2' }, status: 'approved', minsAgo: 30 }); },
        get go() { return 'alerts/' + made; }, el: '#al-mail', say: 'Email is free too. Zuri has no email system of its own, so it uses the office email account: Gmail or Outlook.' },
      { el: '#al-mail-count', say: 'Only customers who have an email on their page and said yes to emails get one. Everyone else still gets WhatsApp.' },
      { el: '#al-mail [data-bcc]', say: 'Copy the addresses for one batch. In the office email, paste them into BCC. Never To or Cc, or every customer sees everyone else\'s address.', do: tap('#al-mail [data-bcc]') },
      { el: '#al-mail [data-mbody]', say: 'Then copy the subject and the words. The words end with one line telling the customer how to stop: reply STOP.', do: tap('#al-mail [data-mbody]') },
      { el: '#al-mail [data-mopen]', say: 'On a phone, Open email can fill in all three for you.' },
      { el: '#al-mail-csv', say: 'If a customer replies STOP, untick Emails on their page. That is all it takes.' },
      { pre: async () => { const r = await Z.sb.from('v_customers').select('id,email').eq('area', 'A').eq('status', 'active').order('full_name'); const c = (r.data || []).find((x) => x.email); grace = c ? c.id : null; },
        get go() { return 'customers/' + grace; }, el: '#cap-f input[name=ok_email]', say: 'On the customer page, in Messages: Emails too. Tick it only when the customer says yes.', do: check('#cap-f input[name=ok_email]') },
      { el: '#cap-f input[name=consent_note]', say: 'And write how and when they said yes. Zuri won\'t save a yes to emails without it.', do: type('#cap-f input[name=consent_note]', 'Said yes to emails on the phone') },
      { el: '#cap-f button', say: 'Save.', do: tap('#cap-f button') },
    ], ['Open an approved alert and find ✉️ Email', 'Copy the BCC addresses and the words', 'Tick Emails on a customer, with a note']),

    C('al-turn', '8 · Your turn: try every part of Alerts', 2, 'admin', null, [
      { pre: async () => { await Z.alertMake({ ...OUT_B, status: 'sent', minsAgo: 180 }); await Z.alertMake({ code: 'MAINT', areas: ['A'], blanks: { date: 'Sat 18 Oct', date_sw: 'Jumamosi 18 Okt', time: '10am', time_sw: 'saa 4 asubuhi', duration: '2 hours', duration_sw: 'saa 2' }, status: 'draft', minsAgo: 6 }); },
        go: 'alerts', el: '#al-quick', say: 'That\'s Alerts. Now try it yourself, in practice. Nothing here is real, and nothing is sent.' },
      { el: '#al-l-wait', say: 'Alerts waiting for a partner\'s yes are here, and on the partners\' Home screen.' },
      { el: '#al-l-done', say: 'Everything that went out stays here: who wrote it, who said yes, and when.' },
      { go: 'me', el: 'a[href="#learn"]', say: 'Every chapter is on the Learn page, to watch again any time.' },
    ], ['Text an outage to Zuri B (Call center)', 'Approve it and download the list (Partner)', 'Send FIX to the same people (Partner)', 'Planned work for one cabinet (Technical)', 'Set a customer\'s cabinet, language and offers (Call center)', 'Set the SMS price (Partner)', 'Email a batch of customers who said yes (Partner)']),
  ];
  if (Z.lessons) Z.lessons.push(...CH);
})();
