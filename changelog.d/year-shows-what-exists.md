## 2026-08-20 · feat(year): every row on Your Year says whether it is already an event

Owner ask, from the page itself: *"here we want to show if an event is existing
or they still need to create one"*, then *"maybe add a button — start planning,
and when there is existing, open plan"*, then *"when we create, we already know
that it is for me and this is a specific time of event, so these information
don't need to be filled."*

Before this, every moment on `/dashboard/year` rendered as the same card. A
wedding you are organising and Christmas — which nobody has planned anything for
— were visually identical; the only difference was where the tap happened to
land. The page's whole job is to show what is coming, and it could not say which
of those you had already done something about.

- **Each row now carries its state as a button.** An event-backed moment shows
  **Open plan** and opens that event; a derived moment (a holiday, your own
  birthday) shows **Start planning** in the primary CTA colour and opens the
  create flow. Both branches always render — a card with no marker would read as
  "unknown", the one thing this line must never say. They are styled `<span>`s
  because the card itself is the link; a real `<button>` inside an `<a>` is
  invalid markup and would split one tap target into two.
- **The create flow stops re-asking what the row already knew.** The event
  TYPE rides in the href (`?event_type=`, the param the create page already
  validates for the QR fast-lane — which also skips the "para kanino ito?" step
  on the way through). The DAY, and the fact that the moment is yours, ride in a
  new single-read sessionStorage carry consumed by the onboarding wizard, which
  then seeds the date and says *"This one's yours"* instead of asking who is
  being celebrated.
- **Only the self birthday claims to be yours or to know its kind.** Christmas
  is a date, not a fact about you, so a holiday carries its day and nothing else
  — the plain picker is the honest link. Asserted in both directions.

⚠ **The date is personal data and does NOT go in the URL.** A birthday in a
query string lands in browser history, in the Referer header of every subsequent
request, and in access logs. `lib/onboarding/moment-handoff.ts` mirrors the
shipped `honoree-handoff.ts` — same 10-minute TTL, same read-once semantics,
same reasoning — rather than inventing a second set of rules.

🔒 **Nothing was removed from the wizard's screen sequence, deliberately.**
Dropping the "who" screen would shift every later index, and `?resume=1`
navigates BY index — a resumed draft would land on the wrong screen. The
questions are pre-answered and still visible and changeable, never hidden.

🛡 `lib/year-page-answers-created-or-not.test.ts` — 4 assertions, plus the
derivation pinned in `year-moments.test.ts`. **10 sabotages, every one measured
as landed, all 10 RED.**

🪤 **Two of my own guards were caught by that run, not by review.** The
`forSelf` flag — the one that decides whether the wizard re-asks who — had NO
test at all: deleting it left the suite fully green. And the harness itself
measured with `grep -c`, which counts LINES, so a sabotage putting two hrefs on
one line reported as "did not land" and its (real) RED result was discarded as
meaningless. **Count occurrences, not lines.**

⚠ **Not observed on the live site.** `/dashboard/year` sits behind a login, so
this is proved by tests (8821 unit pass, green under Asia/Manila,
America/New_York and Pacific/Kiritimati), typecheck, `next lint`, and 8 repo
guards including `lint-port-no-lost-controls` and `lint-label-on-fill-contrast`
— not by a screenshot. Do not upgrade that to "verified live".

Measured, not assumed: `/onboarding/birthday` returns a real "Plan your event"
page in production, so `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED` is ON and a
birthday tap lands in the generic wizard, not the inline create form. That is
why the carry is consumed there.

SPEC IMPACT: None. No schema, no pricing, no locked decision touched — the
`recurs`-has-no-update-path gap noted in the Year work of 2026-08-15 is
unchanged and still open.
