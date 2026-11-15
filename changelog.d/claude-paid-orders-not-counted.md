## 2026-11-14 · fix(admin): a paid order is not counted as waiting · the Focus | Full toggle meets its spec

- **Walk RW-308a:** an order already paid kept a pending payment row, so it was counted under Work and Focus › Reply
  while its card said "Already paid — nothing to confirm here". The payments queue count (`queue-counts.ts`, now its
  own `digest`) and the payments read behind the cards (`readPaymentLights`) both go through the order (inner join —
  `payments.order_id` is NOT NULL, so no payment is lost) and leave out orders whose status is `paid`. Count, badge and
  cards agree. The payments desk itself is unchanged and still lists the stray row to settle.
- **Toggle spec (design session, specs 51e2f43b):** each half is a button with `aria-pressed` and `aria-label` (Focus /
  Full), at least 44 × 44; the chosen half is filled with the accent and its words in the on-accent colour; Focus wears
  the prototype's search-bar icon, Full the stacked rows; icons only on a phone, icon + word from 1024.

SPEC IMPACT: None.
