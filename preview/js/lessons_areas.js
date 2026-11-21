// Zuri System · 🅰️🅱️ Three areas — Zuri A, Zuri B and Corporate, narrated on the real screens (practice) · v1 · 2026-11-21 (app v2.76)
// Four chapters that chain: Corporate sets people up, Anne (Zuri A) enters money, Baraka (Zuri B) enters money, Corporate sees both and pays a bill.
// Each chapter sets its own scene, so it plays on its own. ▶ Play all chains them (✕ stops).
(function () {
  const Z = window.Z;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const find = (sel) => { if (typeof sel === 'function') return sel(); const [css, text] = sel.split('::'); const all = [...document.querySelectorAll(css)]; return (text ? all.filter((e) => e.textContent.toLowerCase().includes(text.toLowerCase())) : all).find((e) => e.offsetParent !== null || e.getClientRects().length) || null; };
  const waitFor = async (sel, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = find(sel); if (e) return e; await sleep(120); } return null; };
  const tap = (sel) => async () => { const e = await waitFor(sel); if (e) e.click(); await sleep(700); };
  const type = (sel, text) => async () => { const e = await waitFor(sel); if (!e) return; e.focus(); e.value = ''; for (const ch of text) { e.value += ch; await sleep(40); } e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); e.blur(); await sleep(450); };
  const choose = (sel, value) => async () => { const e = await waitFor(sel); if (!e) return; const o = [...e.options].find((x) => x.value === value) || [...e.options].find((x) => x.textContent.includes(value)) || e.options[1]; e.value = o.value; e.dispatchEvent(new Event('change', { bubbles: true })); await sleep(400); };
  const payBtn = () => [...document.querySelectorAll('button')].find((b) => /Pay and record it|Pay anyway/.test(b.textContent) && (b.offsetParent !== null || b.getClientRects().length)) || null;
  const payFor = (name) => () => { const row = [...document.querySelectorAll('.item, tr')].find((r) => r.textContent.includes(name) && r.querySelector('[data-pay]')); return row ? row.querySelector('[data-pay]') : null; };
  const G = '🅰️🅱️ Three areas';
  const C = (id, title, mins, role, next, steps, turn, more = {}) => ({ id, group: G, title, mins, role, next, steps, turn, ...more });
  const day = () => Z.ymd();
  // the pretend books for both areas, so a chapter can stand on its own
  const books = async (which) => {
    const rows = { A: { cash: 12000, from: 'Hotspot takings', bill: 'Hardware shop A', amt: 5000 }, B: { cash: 9000, from: 'Installation fees', bill: 'Tower rent B', amt: 8000 } };
    for (const k of which) {
      const r = rows[k];
      await Z.sb.from('cash_in').insert({ area: k, date: day(), category: 'Other', amount: r.cash, received_to: 'M-Pesa', from_name: r.from, recorded_by: 'Practice' });
      await Z.sb.from('bills').insert({ area: k, month: Z.ym(), name: r.bill, amount: r.amt, due_day: 28, category: 'Rent & Utilities' });
    }
  };

  const CH = [
    C('ar-who', '1 · Three positions: A, B and Corporate', 2, 'admin', 'ar-a', [
      { go: 'admin', el: '#view', say: 'Zuri now runs as three positions. Zuri A and Zuri B are the two working areas. Corporate is the head office.' },
      { el: 'select[name=area]', say: 'This is Jerry, a partner, at the head office. Under Admin, People, every person has an area box.' },
      { el: 'select[name=area]', say: 'Anne works for Zuri A. So her area is Zuri A. Baraka works for Zuri B, so his is Zuri B.' },
      { el: '#view', say: 'A person with an area stays in that area. They cannot switch to the other one. Corporate is the partner with no area. Only Corporate sees all areas together.' },
    ], ['Open Admin, then People', 'Find the area box for each person']),

    C('ar-a', '2 · Zuri A: Anne enters the money', 3, 'officeA', 'ar-b', [
      { go: 'home', el: '#h-area', say: 'This is Anne, in the Zuri A office. Look at the area box at the top. It says Zuri A, and it is locked. She cannot switch to Zuri B.' },
      { go: 'money/in', el: '#mi', say: 'She records money that came in today. The Area box offers only Zuri A.' },
      { el: '#mi [name=amount]', say: 'Twelve thousand shillings, from hotspot takings.', do: type('#mi [name=amount]', '12000') },
      { el: '#mi [name=from_name]', say: 'She says who it came from.', do: type('#mi [name=from_name]', 'Hotspot takings') },
      { el: '#mi button[type=submit]', say: 'Save.', do: tap('#mi button[type=submit]') },
      { go: 'money/expense', el: '#me [name=payee]', say: 'Now an expense. Again only Zuri A is offered.', do: type('#me [name=payee]', 'Hardware shop') },
      { el: '#me [name=category]', say: 'She picks what it was for.', do: choose('#me [name=category]', 'Equipment / Inventory') },
      { el: '#me [name=amount]', say: 'Three thousand five hundred shillings.', do: type('#me [name=amount]', '3500') },
      { el: '#me button[type=submit]', say: 'Save.', do: tap('#me button[type=submit]') },
      { go: 'money', el: '#view h2', say: 'The Money page says Zuri A. These numbers are Zuri A\'s alone. Anne never sees Zuri B\'s.' },
    ], ['Record cash in for Zuri A', 'Record an expense for Zuri A', 'Check the area box is locked']),

    C('ar-b', '3 · Zuri B: Baraka sees only his own', 3, 'officeB', 'ar-corp', [
      { pre: async () => { await books(['A']); },
        go: 'home', el: '#h-area', say: 'This is Baraka, in the Zuri B office. His area box says Zuri B, and it is locked too.' },
      { go: 'money/bills', el: '#view', say: 'Zuri A has a bill: hardware shop. Baraka cannot see it. His list has only Zuri B\'s bills.' },
      { go: 'money/in', el: '#mi', say: 'He records his own money. Only Zuri B is offered.' },
      { el: '#mi [name=amount]', say: 'Nine thousand shillings from installation fees.', do: type('#mi [name=amount]', '9000') },
      { el: '#mi [name=from_name]', say: 'And who it came from.', do: type('#mi [name=from_name]', 'Installation fees') },
      { el: '#mi button[type=submit]', say: 'Save.', do: tap('#mi button[type=submit]') },
      { go: 'money', el: '#view h2', say: 'His Money page says Zuri B. It does not include the twelve thousand that Zuri A took in.' },
    ], ['Check that Zuri A\'s bill is not on your list', 'Record cash in for Zuri B']),

    C('ar-corp', '4 · Corporate: both areas, and pay a bill', 4, 'admin', null, [
      { pre: async () => { await books(['A', 'B']); },
        go: 'home', el: '#h-area', say: 'Now Corporate. This is Jerry, the head office. His area box offers All areas, Zuri A and Zuri B.' },
      { go: 'money', el: '#view h2', say: 'With All areas chosen, the Money page says all areas. Zuri A and Zuri B sit side by side, and the totals are the two added together.' },
      { go: 'money/bills', el: payFor('Hardware shop A'), say: 'Bills from both areas are in one list. Hardware shop is Zuri A\'s. Tower rent is Zuri B\'s. Corporate pays them from here.' },
      { el: payFor('Hardware shop A'), say: 'Tap Pay on the hardware shop.', do: tap(payFor('Hardware shop A')) },
      { el: payBtn, say: 'Pay and record it. Zuri wants two people for every payment, so now it waits for a second person to say yes, under Approvals. Then the bill counts as paid, in the right area.', do: tap(payBtn) },
      { go: 'money', el: '#view h2', say: 'That is the head office view: both areas, one dashboard, and the bills paid from one place. Zuri A and Zuri B only ever see their own.' },
    ], ['Choose All areas', 'Read the totals for A and B', 'Pay a bill for one of the areas']),
  ];
  if (Z.lessons) Z.lessons.push(...CH);
})();
