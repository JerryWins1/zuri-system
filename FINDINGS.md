# Zuri — things found and not yet fixed

Written down here because the chats that found them have closed or been disconnected,
and a finding that lives only in a chat is a finding that gets found again.

Each entry says what was **checked** and what is **reported but unverified**. Treat the
two differently.

---

## 1. The app shows a "TEST" badge over the real customer database

**Checked, 8 November 2026.** `preview/js/config.js` sets `env: 'test'` against project
`wlawjwowdmneatdffpsy`, and `preview/js/app.js:266` shows the test badge whenever that
is so. That is the project the live app talks to.

**Reported, not verified here.** The chat that imported the customers (31 October, 997
of them from two BillNasi exports, through the app's own Import screen in Jerry's
browser) says that project holds the real customer list, and checked it by searching a
real number in the live app and getting back a matching name, plan and area. This
container cannot confirm that: the publishable key sees zero customer rows, because the
database rules hide them from an anonymous reader — which is the right answer and also
means the claim cannot be re-checked from here. Anyone verifying it must do so signed in.

**Why it matters, if it is true.** Not exposure — Zuri is Jerry's own company and its
staff seeing customer records is ordinary. The problem is a label that lies. A screen
saying "test" invites people to treat the records as disposable: type rubbish into them,
delete them to see what happens, screenshot them. The testers have been working against
this app for weeks.

**Not fixed.** The fix is a judgement call about which database the testers should be
pointed at, which is Jerry's to make, not a code change to slip in.

## 2. The importer's column guesser (FIXED 8 November 2026)

**The claim handed over** was that the guesser maps Customer name from BillNasi's
USERNAME column, leaving the required Customer ID unmapped, so a default import rejects
every row — and that Jerry's 997 only imported because three dropdowns were corrected by
hand first.

**Checked: the claim as stated did not reproduce.** With a heading list containing a
plain `NAME` column, the exact-match pass claims it for Customer name and USERNAME goes
to Customer ID correctly. The bug is real but narrower:

| the file's headings | before | after |
| --- | --- | --- |
| `USERNAME`, `NAME` | correct | correct |
| `USERNAME`, `FULLNAME` | **Customer name takes USERNAME; Customer ID unmapped** | correct |
| `USERNAME`, `CLIENT` | correct | correct |

The cause: `guess()` ran both passes — exact, then "contains" — for each column in turn,
so an earlier column's loose match beat a later column's exact one. It now does every
exact match across all columns first, and only then the loose ones. That is a better fix
than reordering the list, which would only have moved the same collision elsewhere.

Changed in `preview/js/imports.js` and `js/imports.js`.

## 3. The import area persists between imports

**Checked.** `st.area` — the "Area for these rows" dropdown — is saved and restored with
the rest of the import state, so a second file inherits the area chosen for the first
one. If the second file is for a different area and does not name it in a column, every
row lands in the wrong place, with no error and nothing on screen to show it.

**Not fixed**, because the right behaviour is a question: should the area clear on a new
file, or should the screen simply say loudly which area is about to be applied? The
second is probably better — it is also useful when the two files really are for the same
area.

## 4. The database schema is not in version control

**Checked.** `supabase/` holds exactly two files, `28_alerts.sql` and
`29_alerts_email.sql`. Migrations 1 to 27 and the `import_customers` and
`import_payments` functions exist nowhere but inside the live Supabase project.

**That database is the only copy of its own structure.** If it is lost, corrupted, or
somebody runs the wrong statement in the SQL editor, there is nothing to rebuild from —
not the tables, not the rules that protect the customer rows, not the import functions
the app depends on.

Of everything on this page this is the one worth doing first, and it is not hard: dump
the schema out of Supabase and commit it. It needs the database password, so it is
Jerry's hands on the keyboard, not a Claude session's.

## 5. Alerts is built but never switched on

**Checked, 8 November 2026.** All the code is merged. The two files that create it,
`supabase/28_alerts.sql` and `supabase/29_alerts_email.sql`, have never been run on the
test database — it has no `alerts` table at all. Run them in that order in Supabase's SQL
editor, then `select alerts_version();` should return 2. Both are safe to run twice. The
training database needs the same two files whenever Alerts is wanted there.

No Claude session can do this: creating tables needs the database password or a Supabase
access token, and the only key anywhere is the app's publishable one.

Until then, Zuri staff cannot send outage, planned-work or offer messages by area or
cabinet, and the free email batches do not exist. Practice mode works without it.

## 6. The daily BillNasi refresh is stuck, and will stick again

The 6am "Zuri · daily BillNasi refresh" job sits on BillNasi's login page. Signing Chrome
back in fixes it until the cookie expires, which is a chore that returns rather than a
fix.

Worth asking BillNasi whether they offer an API key or a scheduled CSV export by email.
Zuri's importer already handles emailed exports, and a key lives in a secret store
instead of a browser cookie. That retires the job's failure mode instead of resetting it.
Somebody has to ask BillNasi; no Claude session can.
