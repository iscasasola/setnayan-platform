## 2026-11-03 · chore(date-selection): the date finder's ✕ is an editor field — moved to ALLOWED

Owner 2026-11-03 (DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"). Swept the date
finder's four-question flow for list rows with a visible ✕: there are none. Its one mark, "Remove this date" in step 3,
sits beside a meaningful date's own date / kind / note inputs inside the form — a field inside an editor, one of the
kinds the ruling keeps. `four-question-flow.tsx` moves from the shrink-only baseline to `ALLOWED` in
`lib/no-delete-x-on-list-rows.test.ts`. No UI change.

SPEC IMPACT: None
