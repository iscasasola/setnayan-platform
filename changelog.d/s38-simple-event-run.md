## 2026-09-19 · fix(host): a birthday is not a wedding on the event home and the bench (S38)

Measured while writing the owner's run sheet for the first non-wedding end-to-end run
(a birthday on `testnayan3`, supplier Saysay Host and Band). Two host-facing lines still
said "wedding" to every celebration, outside the five that PR #5676 already covers:

- **event home, no date yet** — the nudge read "Set your wedding date" and promised "your
  Save-the-Date", a surface only the wedding profile carries. Now `Set your {eventNoun} date`;
  the non-wedding arm says the date opens the pages of the site that wait for it.
- **bench → budget accordion, empty folder** — "Nothing here yet for your wedding." Now
  `for your {eventNoun(eventType)}`.

Weddings read byte-identically. Both mounts pass the event's own type; a defaulted prop
nobody passes would change nothing, so the guard checks the mount too.

Guard: `lib/a-debut-is-not-a-wedding-on-the-home-and-bench.test.ts` — per surface: the fixed
phrase count is 0, the event's-word use count is 1, and the mounting page passes `eventType`.

Also carried by this session, not in the diff: `build-sessions/S38-RUN-SHEET.md` — the click
path for the birthday run with the SQL that confirms each step, and the pre-measured leak list
(the supplier's client page never reads `event_type` and says "Wrapped up this wedding?";
that file is held by open PRs #5677/#5651 and is reported, not edited).

SPEC IMPACT: None
