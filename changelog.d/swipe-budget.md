## 2026-11-03 · feat(budget): the budget's rows delete by their swipe — no ✕ on a row, Undo on every delete

Owner 2026-11-03 (DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"), the Budget slice,
on the shared `SwipeToDelete` + `deleteWithUndo`:

- **Budget › Your expenses:** an expense's Remove was only inside its sheet; the row GAINS the swipe — the same
  `deleteEventCost`, after the Undo window. The sheet keeps its own Remove.
- **A supplier's budget (vendor-itemization-card.tsx) — your own line items and logged payments:** the trash
  (`ConfirmForm`) left each row; the row is the swipe (`ConfirmSwipe`, new), which asks the SAME question in the shared
  confirm dialog, then writes through the same `deleteLineItem` / `deletePayment` after the Undo window.
- Kept (editor kinds, moved to the guard's `ALLOWED`): the expense sheet's own Remove; a payment being typed in the
  payment-plan editor (payment-plan-rows.tsx).

SPEC IMPACT: None — implements the 2026-11-03 DECISION_LOG row; no spec text changes.
