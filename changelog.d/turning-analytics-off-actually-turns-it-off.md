## 2026-08-25 · fix(privacy): turning analytics off actually turns analytics off

W6 item 4b. **RULE 0: the control already existed** — `lib/cookie-consent.ts`, a
server-set first-party cookie that survives Safari's 7-day purge, a site-wide
banner and "Cookie settings" links. It was not built again. What was measured on
`origin/main` a8f8601 is that the choice was honoured on the way IN and ignored
on the way OUT, on both paths:

1. **Browser.** `PostHogProvider` gated INITIALIZATION on consent; every capture
   site then asked `isLoaded(client)`, which stays true forever once analytics
   were ever accepted. Accept → open Cookie settings → switch off ⇒ the SDK kept
   capturing `$pageview` on every navigation, plus autocapture and
   `capture_pageleave`, for the rest of the session. Nothing ever called
   `opt_out_capturing()`. And `identify()` keyed on the user id alone, so
   declining and then signing in attached the user id to the refused session.
2. **Server.** `lib/analytics.ts` captured events keyed to the Supabase user_id
   from **15** call sites — signup, login, onboarding, event creation, payments —
   with no consent check at all.
3. **Reachability.** "Cookie settings" lives in the marketing and legal footers;
   `app/dashboard`, `app/admin` and `app/vendor-dashboard` mount no footer —
   measured, zero occurrences in all three.

Fixed: withdrawal calls `opt_out_capturing()` + `reset()` and a re-grant calls
`opt_in_capturing()`, live, no reload; the page tracker and the identify effect
ask the choice rather than the SDK; **one** server gate in `lib/analytics.ts`
(15 call sites would be 15 chances to forget); and an "Analytics cookies" row in
the profile's Privacy & data section that REPORTS the one answer and OPENS the
one panel — it deliberately stores nothing of its own.

⚖ Per-device and anonymous, unchanged. No schema, no migration, no account key —
keying consent to a user would create an RA 10173 proof-of-consent record, which
is a DPO decision the owner has not made.
⚠ NAMED, NOT SOLVED: the cookie belongs to the browser making the request while
`distinctId` names the subject. Identical for 14 of 15 call sites; the admin
payment action captures against a couple's id from an admin's session, so it is
gated on the admin's choice — strictly more private than today, never less.

Guard `app/_components/turning-analytics-off-turns-it-off.test.ts` — 6
assertions, capture-site list DERIVED from the provider and floored, all six
mutation-checked by occurrence count and all RED.

SPEC IMPACT: None — this closes the gap the owner's 2026-08-24 ruling opened when
the "opt-out available in your profile" sentence came off `/privacy` (#4776).
The sentence is now true again, so the corpus needs no change.
