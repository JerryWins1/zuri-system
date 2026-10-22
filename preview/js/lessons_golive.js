// Zuri System · 🚀 Getting ready — narrated lessons on the real screens (practice): why we don't just switch it on,
// the ten parts, one step at a time, and who does what · v1 · 2026-10-20 (app v2.48)
// Each chapter starts from the same pretend progress (Part 1 done, 2.1 done, Dickson stuck on 3.1), so it plays on its own.
(function () {
  const Z = window.Z;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const find = (sel) => { if (typeof sel === 'function') return sel(); const [css, text] = sel.split('::'); const all = [...document.querySelectorAll(css)]; return (text ? all.filter((e) => e.textContent.toLowerCase().includes(text.toLowerCase())) : all).find((e) => e.offsetParent !== null || e.tagName === 'DETAILS') || null; };
  const waitFor = async (sel, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = find(sel); if (e) return e; await sleep(120); } return null; };
  const tap = (sel) => async () => { const e = await waitFor(sel); if (e) e.click(); await sleep(700); };
  const type = (sel, text) => async () => { const e = await waitFor(sel); if (!e) return; e.focus(); e.value = ''; for (const ch of String(text)) { e.value += ch; await sleep(String(text).length > 30 ? 8 : 45); } e.dispatchEvent(new Event('input', { bubbles: true })); };
  const choose = (sel, value) => async () => { const e = await waitFor(sel); if (!e) return; e.value = value; e.dispatchEvent(new Event('change', { bubbles: true })); await sleep(900); };
  const open = (sel) => async () => { const d = await waitFor(sel); if (d && !d.open) { d.open = true; await sleep(300); } };
  const G = '🚀 Getting ready';
  const C = (id, title, mins, role, next, steps, turn, more = {}) => ({ id, group: G, title, mins, role, next, steps, turn, ...more });
  const at = (d) => new Date(Date.now() + d * 864e5).toISOString();
  // The same pretend progress as practice.js starts with.
  const SEED = () => ({ done: { '1.1': { by: 'Dickson', at: at(-6), note: 'Did it at the office, both of us.' }, '1.2': { by: 'Kelvin', at: at(-6), note: 'Mondays 8:00' }, '1.3': { by: 'Dickson', at: at(-5) }, '1.4': { by: 'Kelvin', at: at(-5), note: 'Aim: Monday 11 January' }, '2.1': { by: 'Kelvin', at: at(-3), note: 'Google Drive' } },
    later: {}, stuck: { '3.1': { by: 'Dickson', at: at(-1), note: 'We have no spare phone for the company SIM yet.' } }, who: {} });
  const prep = async () => { try { await Z.sb.from('settings').upsert({ key: 'golive', value: SEED() }, { onConflict: 'key' }); } catch (e) {} Z.set('golive_me', ''); Z.set('golive_local', null); Z.set('golive_cache', null); };

  const CH = [
    C('gl-why', '1 · Why we don\'t just switch it on', 3, 'technical', 'gl-parts', [
      { pre: prep, go: 'home', el: '#gl-card', say: 'This is Dickson. Zuri is nearly ready, and the team is keen to start. So why not just switch it on next Monday? This card on Home is the answer. It is called Getting ready.' },
      { el: '#gl-card', say: 'First, the good news. The team can start learning today. Practice uses pretend customers, so nobody can break anything. Training the techs does not have to wait.' },
      { el: '#gl-card', say: 'But using Zuri for real is different. Zuri is only as true as what we put in it. If the customer list is wrong on day one, the techs stop trusting it by day three. And trust is hard to win back.' },
      { el: '#gl-card', say: 'So before the real start, a few things must be true. Tap the card.', do: tap('#gl-card') },
      { el: '#gl-head', say: 'Fifty-seven steps. That sounds like a lot. But most take under an hour, and you only ever look at one at a time.' },
      { el: '#gl-head > .hint', say: 'Aim for about ten weeks. In a busy business, maybe twelve or fourteen. That is OK. The order matters more than the speed.' },
      { el: '#gl-title', say: 'This is my next step. Just one. When I tick it, the next one appears.' },
    ], ['Open 🚀 Getting ready from Home', 'Read your next step']),

    C('gl-parts', '2 · The whole list, in ten parts', 4, 'technical', 'gl-one', [
      { pre: prep, go: 'golive/all', el: '#gl-tab-all', say: 'Here is the whole list, once, so you can see its shape. Then you can forget it and go one step at a time.' },
      { el: '#gl-part-1', say: 'Part one: agree the plan. One sit-down together, a weekly check-in, a kind message to the team, and a start month with room to spare. These are done already.' },
      { el: '#gl-part-2', say: 'Part two: one home for files and passwords. Google Drive or Microsoft 365, one, not both, owned by the company, not by one person.' },
      { el: '#gl-part-3', say: 'Part three: WhatsApp. A company number, the right team groups with pinned rules, and broadcast lists for customers. Not groups. In a group every customer sees every other customer\'s number.' },
      { el: '#gl-part-4', say: 'Part four: write down what is true. Areas, every OLT, cabinet and tower with its GPS, the packages in both billing websites, the staff, and the monthly bills. If you are not sure, write check. A blank is better than a wrong number.' },
      { el: '#gl-part-5', say: 'Part five: the money starting point. One start date, and on that day: the bank, M-Pesa, the cash in each area, what we owe and what is owed to us.' },
      { el: '#gl-part-6', say: 'Part six: the customers. Export from Billnasi and from the second billing website, clean out repeats and test accounts, fix the phone numbers, and then phone twenty customers to prove the list is true.' },
      { el: '#gl-part-7', say: 'Part seven is the big one. The live Zuri starts fresh and empty. Jerry builds it, and you fill it only with the lists you checked. Nothing from testing comes across.' },
      { el: '#gl-part-8', say: 'Part eight: training. Partners first, then the techs and the office, then one practice day all together. This part can start any time.' },
      { el: '#gl-part-9', say: 'Part nine: go live, gently. Both partners say yes. One area first. The old way and Zuri side by side for a week. Then one more area each week.' },
      { el: '#gl-part-10', say: 'And part ten, after we are running: map pins, customer emails, paid messages if we need them, and a monthly look after the system. No rush.' },
    ], ['Open 📋 The whole list', 'Find the part you own most of', 'Find Part 7: the fresh database']),

    C('gl-one', '3 · One step at a time', 4, 'finance', 'gl-who', [
      { pre: prep, go: 'golive', el: '#gl-me', say: 'This is Kelvin. The list opens on one step: mine. I can also look at Dickson\'s, or everyone\'s.' },
      { el: '#gl-title', say: 'My next step: make one company account. Only this one. The rest can wait.' },
      { el: '#gl-why', say: 'Every step says why it matters,' },
      { el: '#gl-how', say: 'how to do it, in a few short lines,' },
      { el: '#gl-donewhen', say: 'and when it counts as done. No guessing.' },
      { el: '#gl-after', say: 'Below it, only the next two. There is no need to look further.' },
      { el: '#gl-done', say: 'Finished? Tap Done.', do: tap('#gl-done') },
      { el: '#gl-note', say: 'I can add a note: a date, a number, a name. Dickson sees it too.', do: type('#gl-note', 'Zuri office account, both our phones for recovery') },
      { el: '#gl-note-go', say: 'Save.', do: tap('#gl-note-go') },
      { el: '#gl-title', say: 'And the next step appears by itself: make the folders.' },
      { el: '#gl-later', say: 'Not today? Tap Later. It goes to the back of my line. Nothing is lost.', do: tap('#gl-later') },
      { el: '#gl-title', say: 'So the next one comes up instead.' },
      { el: '#gl-stuck', say: 'And if something is in the way, tap I am stuck, and write one line.', do: tap('#gl-stuck') },
      { el: '#gl-note', say: 'For example: the bank login is on the old phone.', do: type('#gl-note', 'The bank login is on the old office phone. I need a day to find it.') },
      { el: '#gl-note-go', say: 'Ask for help.', do: tap('#gl-note-go') },
      { el: '#gl-stucklist', say: 'It shows here, under waiting for help, and on Jerry\'s HQ screen. Being stuck is not failing. It tells Jerry where to help. Meanwhile, I carry on with my next step.' },
      { el: '#gl-task', say: 'One more button: put it in Tasks. The step becomes a normal task, due in a week, so it shows in My day with everything else.' },
    ], ['Tick a step as done, with a note', 'Put one off with ⏭ Later', 'Say 🆘 I\'m stuck on one, then unstick it']),

    C('gl-who', '4 · Who does what, and the weekly check-in', 3, 'admin', null, [
      { pre: prep, go: 'hq', el: '#gl-card', say: 'This is Jerry. On HQ, the Getting ready card shows how far along we are, each partner\'s next step, and anything stuck.' },
      { el: '#gl-card', say: 'Dickson is stuck on the company phone. That is my cue to help, not to push.', do: tap('#gl-card') },
      { el: '#gl-me', say: 'I can open anyone\'s list. Dickson\'s.', do: choose('#gl-me', 'D') },
      { el: '#gl-stucklist', say: 'Here is his stuck step. Open it.', do: tap('#gl-stucklist .item') },
      { el: '#gl-step', say: 'Every step has its own page, with the note about what is in the way.' },
      { el: '#gl-step details', say: 'If a step suits someone else better, change who does it, right here. Nobody has to carry a step that is not theirs.', do: open('#gl-step details') },
      { go: 'golive/all', el: '#gl-rules', say: 'The whole list starts with seven short rules. The most important: meet for thirty minutes once a week, same day, same time, and look at this list together.', do: open('#gl-rules') },
      { el: '#gl-print', say: 'And the whole list prints on paper, with tick boxes, for the office wall.' },
      { el: '#gl-head', say: 'One step at a time, a little each week, and Zuri starts on a true foundation. Be patient with each other. You will get there.' },
    ], ['Open HQ and read the 🚀 card', 'Change who does one step', 'Open 🖨 Print the list']),
  ];
  if (Z.lessons) Z.lessons.push(...CH);
})();
