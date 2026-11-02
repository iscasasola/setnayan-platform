## 2026-10-21 · fix(copy): the app says "event", and says when things open in plain words

**The supplier Hub's empty day** said *"Your day-of console opens here on each
event's day (T-1h → T+8h)."* — jargon, and untrue: the Hub's gate is a booking
dated today in the Philippine calendar (`phTodayIso` / `hasDayToday`), midnight
to midnight, with no hour offset anywhere. All four Hub sentences now read
`HUB_OPEN_WINDOW_PLAIN` ("midnight to midnight, Philippine time"), which lives
beside the gate in `lib/vendor-day-picker.ts`; the page's own copy of the clock
now calls `phTodayIso`. Same disease elsewhere: /features, help and the tour
said "T-1h" for day-of mode, which starts at noon the day before
(`LIVE_WINDOW_START_MS`) — now `DAY_OF_STARTS_PLAIN` / `DAY_OF_ENDS_PLAIN` in
`lib/day-of-mode.ts`. Planning tips in `lib/wizard.ts` lose "T-3mo"-style notation.

**"Celebration" → "event"** (owner 2026-10-04, DECISION_LOG "ONE WORD: EVENT"):
~320 customer-facing strings in ~145 files, rewritten inside string literals and
JSX text only (never identifiers, comments or data keys), including the Events
board's *"your celebration moves up here"*. **The tagline changes too** — owner, 2026-10-22,
choosing "Change to 'every event'" (DECISION_LOG "TAGLINE SAYS EVENT"): *"Plan,
share and relive every event"* in the site title (`app/layout.tsx`), both email
footers (`EMAIL_TAGLINE`, `ADMIN_EMAIL_TAGLINE`), the draft reminder and the install
manifest; its three pinning tests cite the ruling. Kept, with reasons in the
guard's allow-list: legal pages, owner console,
editorial/cultural prose, the event TYPE named "Celebration", and one-word data
keys (the `occasionNoun` default is translated at output by `watchLiveOccasion`).

Guard: `apps/web/lib/the-app-says-event-in-plain-words.test.ts` — AST read of
every app/ lib/ components/ string; no "celebration(s)" noun outside the
allow-list, no "T-1h"-style notation, every allow entry must still match, and
the plain words are checked against the real gates (`hasDayToday`,
`getDayOfPhase`). 12 sabotage runs, all as expected.

SPEC IMPACT: DECISION_LOG.md row "TAGLINE SAYS EVENT" (2026-10-22) — the owner's
2026-09-30 tagline now reads "every event". Everything else follows the existing
2026-10-04 "ONE WORD: EVENT" ruling.
