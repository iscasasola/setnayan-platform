## 2026-10-27 · feat(card-checks): the checks before Create, as one pure evaluator — words · its service · one photo

Owner 2026-10-26: *"when there is something they need to change, they must fix it before the service card is
created … they resolve it by themselves."* PR 2 of the v2 PLAN's order (corpus
`prototypes/service_card_checks_2026-10-26/` PLAN §2, §4, §6 step 2). Not mounted yet — the maker (PR 4) and the
save's re-check (PR 4) call it.

- `lib/service-card-checks.ts` — browser-safe, no imports: `evaluateCardChecks(input, ctx, photoAnswer)` → the
  problems, each under the maker row it concerns (words under Name / What's included / Add-ons; "reads like" under
  What you offer; photos under Photos), and whether Create is blocked. Whole-phrase matching without lookbehind
  (older iPhone Safari cannot parse it). A key the taxonomy does not know is never judged for a service mismatch.
  `readCardCheckInput(fd)` reads the save's own field names. **No price anything.**
- `lib/service-card-check-copy.ts` — the drawn words (title + one short line), the status line ("2 things to fix
  before you can create"), and `refusalSentence` so the save says what the maker says. Never "flag/fraud/scam/
  violation"; another shop is never named.
- `lib/service-card-checks.server.ts` — the reads (service role): the admin word list and the service words from
  Admin › Categories' own tables (display names, reviewed search words, merges, tier-1 folders). Fail-closed: a
  part that cannot be read is `null` and blocks.
- Tests: `service-card-checks.test.ts` (13) · `service-card-check-copy.test.ts` (4) ·
  `the-card-check-fails-closed.test.ts` (5, sabotaged red → restored).

SPEC IMPACT: None new — implements DECISION_LOG 2026-10-26 "SERVICE CARD CHECKS — FIX BEFORE CREATE", "CARD CHECKS —
NO PRICE BAND; ONE PHOTO, ONE SERVICE CARD", "NO PRICE CHECK ON SERVICE CARDS AT ALL"; prototype
`prototypes/service_card_checks_2026-10-26/`.
