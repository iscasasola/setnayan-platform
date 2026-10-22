## 2026-10-22 · feat(supplier): the supplier's rows are the one thumb row — no band

- `SupplierThumbRow` takes `row={<ThumbRow …/>}`: it keeps only the plumbing (portal, slide, the column's edges) and
  draws no band; each control is its own glass (owner 2026-10-22, "One thumb row").
- Customers › People: "Search customers" (was "Search a customer") · ＋ Add a booking from outside, the round at the
  right. Dates (with a schedule): "Check a date" in the field seat · ＋. A day: ＋ alone at the right. Money: ✓ Log a
  payment alone at the right (was a lone pill at the LEFT of an empty band). Shop › Page: 👁 View my page · ✓ Apply
  (grey while nothing changed), both at the right.
- `ThumbRow` gains `ThumbNode` seats (a shipped component — the Search box, Check a date, Add, Log a payment — keeps its
  sheet and address; the row gives it the seat's shape) and `target` on a link round.
- Guard: `lib/every-thumb-row-is-the-one-row.test.ts` covers the supplier rows.

SPEC IMPACT: None beyond the 2026-10-22 DECISION_LOG row "ONE THUMB ROW" (PR1).
