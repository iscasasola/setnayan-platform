## 2026-07-11 · feat(vendors): payment-gated lock — downpayment-to-confirm (flag-gated)

Reverses the "Lock-Free" deposit default behind `NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED`.
When the flag is on, locking a vendor opens a mandatory downpayment modal: the couple
records the downpayment paid through one of the vendor's **published** payment methods
(`vendor_payment_methods`) with a **required** screenshot, the instant the lock lands
and the date is held. The vendor confirms receipt via the existing
`acknowledge_vendor_deposit` path. Flag OFF (default) = today's exact behavior — deposit
stays optional/free-text on the workspace.

- Migration `20270521314207_payment_gated_lock_deposit_method.sql` — adds
  `event_vendors.deposit_method_id` (FK → `vendor_payment_methods`, ON DELETE SET NULL)
  + `deposit_method_label` (frozen provenance). Additive, idempotent, no RLS change.
- New couple actions `getLockDownpaymentContext` (read published methods, RLS-proven)
  + `recordLockDownpayment` (validates the chosen method is one of the vendor's published
  methods, requires proof, stamps the orthogonal deposit markers, logs the couple's
  ledger row, notifies the vendor to confirm). `finalizeVendor` is **untouched** — the
  modal runs after a successful lock (which already held the date).
- `AccordionLockButton` (the single lock injection point across all surfaces) opens the
  flag-gated `DownpaymentModal`; degrades straight through for off-platform/manual
  vendors (no published methods) and never undoes the lock.
- 0% commission unchanged — Setnayan never holds the money; couple pays the vendor
  directly off-platform and uploads proof.

SPEC IMPACT: Reverses the 2026-06 Lock-Free deposit default (Vendor_Customer_* build
plans + AS_BUILT deposit-reservation note) to a downpayment-to-confirm lock, gated by
`NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED` (OFF in prod until owner flips). Logged in
DECISION_LOG.md 2026-07-11.
