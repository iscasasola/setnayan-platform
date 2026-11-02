## 2026-09-11 · security(payments): the AI receipt reader opens only the payment's own proof folder (N5 · part B)

Found by N4 (#5432 "found, not fixed"): `readPaymentReceiptFromR2` fetched the bytes of
whatever bucket/key `payments.screenshot_url` named (admin R2 credentials) and showed
them to a model whose summary reaches the admin; and `authenticated` holds UPDATE on
that column.

- **Re-measured first (N5, replay as a real `authenticated` buyer):** the UPDATE grant is
  real but `payments` has RLS on and NO UPDATE policy — a buyer's UPDATE of their own
  payment's screenshot matches **0 rows** (the same session reads the row: 1), and
  INSERT is **not granted** (`permission denied`). Every server writer already binds the
  ref to the order's own folder. So the "buyers can edit that column" half is **not
  real**; no migration was needed for it.
- **The reader now holds the line itself:** `proofPolicy` is a REQUIRED argument;
  `parseClientRef(ref, proofPolicy)` runs before any byte is fetched and a ref outside it
  is not read (`null`, "carry on"). The pay page passes `orderPaymentProofPolicy(order)`
  (the policy the ref was just admitted under); the admin "Read it again" passes
  `paymentProofPolicy({ order, order's event, buyer })` built from the ORDER row — the same
  scope the admin screen signs the picture with.
- Guards: `lib/the-receipt-reader-reads-only-its-own-folder.test.ts` (4) ·
  `tests/db/a-buyer-cannot-repoint-a-payment-screenshot.db.test.ts` (6 — keeps the column
  closed to the browser, with a neutralisation: an UPDATE policy in a rolled-back
  transaction makes the same write land).

SPEC IMPACT: None
