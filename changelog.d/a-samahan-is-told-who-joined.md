## 2026-09-17 · feat(samahan): a samahan is told who joined

A samahan announced what was POSTED and never who ARRIVED. Somebody redeemed the
standing invite link, landed in the group, and nobody already there was told.

The mechanism was never missing — `lib/samahan-notify.ts` ships the service-role
roster fan-out, the collapse window reasoned from the group's own
one-story-per-hour limit, the pure recipient rules split into
`lib/samahan-notice-rules.ts`, and a documented fail-toward-ringing posture on the
collapse read. Its kind enum was `{ story, message }`. **Joining was simply not one
of the cases**, which is why a reader of that file comes away certain it is finished.

- `samahan_join` joins the `notification_type` enum (its own migration, no
  transaction — a new enum value may not be used in the transaction that adds it);
- `join` joins `SamahanNoticeKind`, with its own type, its own words, and the
  samahan page as its destination;
- the invite-accept action defers the fan-out through `after()`, **above** its
  `redirect` — `redirect()` throws, so a call below it never registers at all — and
  below the already-a-member branch, so re-opening a standing group link cannot
  announce the same person twice.

The body says "See everyone in the samahan" rather than repeating the name: two
arrivals inside the collapse window produce one notice, so the title names the
person it can vouch for and the body points at the list, which is complete. Same
rule as this feature's no-message-preview decision — never copy into a notification
a fact the notification cannot keep true.

Guarded by `apps/web/lib/a-samahan-is-told-who-joined.test.ts`: the pure rules are
EXERCISED; the two things a unit test cannot execute (a `server-only` module and a
`'use server'` action that redirects) are PARSED, including that the fan-out sits
above the redirect and that the collapse read still narrows on `type` as well as
`related_url` — `join` and `story` share a URL on purpose, and the type predicate is
the only thing stopping one from silencing the other. Sabotage-checked five ways,
each still parsing and typechecking, with the subtest count printed before the colour.

SPEC IMPACT: None. `WHATS_NEXT_Samahan_2026-08-24.md` § 3.2 still governs quiet
hours; `samahan_join` stays off the email and push allowlists with its two siblings,
so the in-app tray rings and no phone buzzes.
