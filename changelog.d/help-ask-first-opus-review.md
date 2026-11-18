## 2026-11-18 · fix(help): team Yes / No uses the admin gate's own predicate; a slug never becomes a "People ask" chip

- `recordAnswered` (app/help/actions.ts) gated team votes with the SQL `is_admin()`, which reads only
  `account_type = 'admin'` — every internal and team-member admin's Yes / No on the team's Help was dropped silently.
  It now uses `isAdminProfile`, the same predicate as `requireAdmin`.
- A Yes pressed on a topic row has no question, so its words fall back to the answer's slug; two such presses made the
  slug a "People ask" chip on /help. `groupPeopleAsk` now skips a row whose words are its own article slug.
- The answer row's chevron turns on Quick (200 ms) with the Settle easing.

SPEC IMPACT: None
