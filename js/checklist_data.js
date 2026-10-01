// Zuri System · the tester checklist — everything a tester should try, by job · v1 · 2026-10-01
// Kept as plain JSON so the printable guide (tools/make_guides.py) reads the same list.
window.ZURI_CHECKLIST = [
  { "group": "everyone", "label": "Everyone — first", "roles": ["admin", "internal", "callcenter", "field"], "items": [
    { "id": "e-tour", "t": "Watch “What Zuri is” (5 min)", "how": "Me → 🎓 Learn → ⭐ What Zuri is. Sound on.", "lesson": "tour" },
    { "id": "e-home", "t": "Add Zuri to your phone's home screen", "how": "In Chrome: ⋮ → Add to Home screen. Open it from the icon." },
    { "id": "e-tabs", "t": "Find your tabs and open each one", "how": "The tabs are at the bottom. Open every one and read what is there.", "lesson": "start" },
    { "id": "e-task", "t": "Tick one task as done, and write a note on it", "how": "Tasks → My day → tick a box → 💬 Notes → type → Add.", "lesson": "tasks" },
    { "id": "e-give", "t": "Give a teammate a task", "how": "Tasks → ＋ Add a task → write it → choose the person → Add task. Ask them if it arrived.", "lesson": "tasks" },
    { "id": "e-offline", "t": "Try it with no signal", "how": "Turn on airplane mode. Tick a task or add a note. Turn signal back on — the yellow badge should clear." },
    { "id": "e-theme", "t": "Switch to Light and back", "how": "Me → Screen → ☀️ Light. Which is easier to read outside?" }
  ]},
  { "group": "field", "label": "Field techs", "roles": ["field", "internal", "admin"], "items": [
    { "id": "f-open", "t": "Open a job, call the customer, open the map", "how": "Jobs → tap a job → 📞 Call → 🗺️ Open map.", "lesson": "field-jobs" },
    { "id": "f-start", "t": "Start a job", "how": "In the job: ▶ I'm starting now. The office should see it change.", "lesson": "field-jobs" },
    { "id": "f-finish", "t": "Finish a job with a cash payment", "how": "Tap what you found and what you did → 💵 Cash → amount → ✅ Job finished.", "lesson": "field-jobs" },
    { "id": "f-mpesa", "t": "Finish a job with an M-Pesa payment", "how": "Same, but 📱 M-Pesa and type a code like UJ7K2M9PQR.", "lesson": "field-jobs" },
    { "id": "f-photo", "t": "Add a photo to a job", "how": "In the job: 📷 Add photo → take a picture. Does it show?", "lesson": "field-extras" },
    { "id": "f-part", "t": "Add a part you used", "how": "Parts & equipment → item, serial, qty → Add.", "lesson": "field-extras" },
    { "id": "f-pin", "t": "Drop a map pin (outside)", "how": "In the job: 📍 Drop pin here. Does it ask again if the signal is weak?", "lesson": "field-extras" },
    { "id": "f-new", "t": "Log a new job yourself", "how": "Jobs → ＋ Log a job → describe it → Save.", "lesson": "field-extras" }
  ]},
  { "group": "callcenter", "label": "Call center", "roles": ["callcenter", "internal", "admin"], "items": [
    { "id": "c-follow", "t": "Work a payment follow-up: No answer", "how": "Jobs → a Payment follow-up → 📵 No answer. It should come back tomorrow.", "lesson": "cc-followups" },
    { "id": "c-promise", "t": "Record a promise to pay", "how": "Another follow-up → 🤝 Will pay → pick a day → Save.", "lesson": "cc-followups" },
    { "id": "c-paid", "t": "Record “says paid” and “wants to stop”", "how": "✅ Says paid on one; ✋ Wants to stop on another.", "lesson": "cc-followups" },
    { "id": "c-remind", "t": "Send a WhatsApp reminder", "how": "In a follow-up: 💬 Send a reminder on WhatsApp. (Send it to yourself in training.)", "lesson": "cc-followups" },
    { "id": "c-newjob", "t": "Make a fault job from a customer call", "how": "Jobs → ＋ New job → find the customer → Fault → describe → tech + day → Save job.", "lesson": "cc-newjob" },
    { "id": "c-tell", "t": "Tell the tech on WhatsApp", "how": "In the job you made: 💬 Tell … on WhatsApp.", "lesson": "cc-newjob" },
    { "id": "c-find", "t": "Find a customer by phone number", "how": "Customers → type the number → open them → check Payments and Jobs.", "lesson": "customers" },
    { "id": "c-newcust", "t": "Add a new customer", "how": "Customers → ＋ New customer → fill in → Save." }
  ]},
  { "group": "finance", "label": "Finance", "roles": ["admin", "internal"], "dept": "finance", "items": [
    { "id": "m-today", "t": "Read Cash today and the warnings", "how": "Money → 💵 Today. What is each red or orange box telling you?", "lesson": "fin-daily" },
    { "id": "m-count", "t": "Do a cash count", "how": "Money → Count the cash → bank + M-Pesa → Save.", "lesson": "fin-daily" },
    { "id": "m-sms", "t": "Record an expense from a pasted M-Pesa message", "how": "Money → Record → Money out → paste a message → Read the message → Save.", "lesson": "fin-daily" },
    { "id": "m-in", "t": "Record hotspot money in", "how": "Money → Record → Money in → Hotspot → amount → Save.", "lesson": "fin-daily" },
    { "id": "m-bill", "t": "Pay part of a bill", "how": "Money → Bills → Pay → smaller amount → Bank → Pay.", "lesson": "fin-bills" },
    { "id": "m-copy", "t": "Copy last month's bills (next month)", "how": "Bills → → (next month) → Copy last month's bills.", "lesson": "fin-bills" },
    { "id": "m-sort", "t": "Sort five transactions, one with “always”", "how": "Money → Statements → Sort them → choose a category; tick always on one.", "lesson": "fin-statements" },
    { "id": "m-books", "t": "Read Profit by month", "how": "Money → Statements → Profit by month. Does last month make sense?", "lesson": "fin-statements" },
    { "id": "m-who", "t": "Chase a late payer from Who paid", "how": "Money → Customers → Who paid → Late → 📞 or 💬." },
    { "id": "m-report", "t": "Copy the Friday report", "how": "Money → Report → Copy for WhatsApp → paste it somewhere.", "lesson": "partners" },
    { "id": "m-staff", "t": "Add a staff member with an M-Pesa number", "how": "Me → ⚙️ Admin → Staff & pay → ＋ Add → name, M-Pesa number, salary, pay day → Save." },
    { "id": "m-payrun", "t": "Build the pay run and record one payment", "how": "Money → Bills → Pay run → 🔄 Build today's list → ✅ Sent on one → code → Record it.", "lesson": "fields-payrun" },
    { "id": "m-nudge", "t": "Send one morning nudge", "how": "Tasks → WhatsApp nudges → Open WhatsApp → send to yourself → Mark sent.", "lesson": "partners" }
  ]},
  { "group": "partners", "label": "Partners & admin", "roles": ["admin"], "items": [
    { "id": "p-home", "t": "Read Home: what needs attention, lowest cash day", "how": "Home → Needs attention → tap one. Find “Lowest in next 30 days”.", "lesson": "partners" },
    { "id": "p-staff", "t": "Switch on a new staff member", "how": "Me → ⚙️ Admin → People → role, area, On → Save.", "lesson": "admin" },
    { "id": "p-vis", "t": "Hide a field from field techs", "how": "Admin → Who sees what → untick something for Field tech → check as a tech." },
    { "id": "p-field", "t": "Add a custom customer field", "how": "Admin → Custom fields → add one → see it on a customer." },
    { "id": "p-area", "t": "Add Zuri C as an area", "how": "Admin → Areas → add → does it appear in the area picker?" },
    { "id": "p-manager", "t": "Run the manager and read the log", "how": "Tasks → 🤖 Run the manager now → Manager log." },
    { "id": "p-import", "t": "Bring in a customer file", "how": "Me → 📥 Bring in a file → the Billnasi Excel export → check the counts." }
  ]}
];
