# Working agreement — Zuri system

Jerry owns Zuri Fiber (Maai Mahiu, Kenya) and runs a paid tester squad.
He does not read diffs. Agreed 30 Oct 2026, after a day in which four
pull requests each cost several rounds of asking and nothing was caught
by the asking.

## How to write to Jerry

One step at a time. Label them 1A, 1B, 1C. **One action per step.**

Not this:

> 1. Go to supabase.com, sign in with the account that owns zuri-test,
>    create a new project named zuri-prod, and pick a region near Kenya.

This:

> 1A. Open supabase.com
> 1B. Sign in with the account that owns zuri-test.
> 1C. Click New project.
> 1D. Name it zuri-prod.
> 1E. Choose region Frankfurt (eu-central-1).

Warnings get their own step, phrased as an action — "1F. Save the password
in your password manager. Do not send it to anyone." — not a paragraph
hung off the end of another step.

This is not about dumbing anything down. He is running testers in Kenya,
an accountant, a live app and several chats at once, and he reads these on
a phone between other things. A step he has to read twice is a step that
gets skipped or done wrong.

He has asked for this repeatedly across sessions and it kept getting lost,
which is why it is written here.

When you genuinely need him, ask for **one** thing, as one action, with one
copy-paste. Not a sequence.

## What Claude merges without asking

Bug fixes, script and wording changes, and anything else driven in a
real browser first. That is the great majority of the work.

## What Claude stops and asks about, every time

- **Access** — who can get into the app, or what a role can see.
- **Money** — pay, rates, VAT, the pay run, anything a tester is paid on.
- **Anything sent to the testers** — Claude cannot send WhatsApp and
  must never imply otherwise. Messages go in the Test Desk's "To send"
  box for Jerry to copy.
- **Anything Claude could not test.** This one matters most. On 30 Oct
  a crash reached the squad because the happy path was tested and the
  race was not. Untested waits for Jerry, however small it looks.

## How work gets verified

Serve `preview/` locally and drive it in Chromium with Playwright.
This container cannot reach `cdn.jsdelivr.net`, so intercept that and
serve `supabase-js` from the npm tarball instead. Test under a fake
name such as `ZZ Test`, and block `POST` to `tester_log` so test runs
never land in the testers' real log.

## Pull requests

Open them **not as drafts**. Jerry works from an iPad, where the
"Ready for review" button sits at the bottom of the conversation and is
repeatedly missed. A draft PR costs a round trip every time.

## Where the testers' work shows up

- `tester_log` and `script_answers` in the training Supabase project —
  what each tester ticked, what they said, and screenshots.
- A step starting `sx:` is a step marked failed or unsure, `say:` is a
  free comment, `auto:` is Zuri reporting its own failure. An `auto:`
  gate row means somebody is locked out right now: act on it first.
- Problems needing a ruling go on the Zuri Test Desk artifact, where
  Jerry and Emmanuel Koki (the squad lead) decide what counts.
