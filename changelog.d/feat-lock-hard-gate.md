## 2026-07-11 · feat(vendors): payment-gated lock — HARD server gate + vendor reject

Turns the soft payment-gated lock (#3090) into a server-enforced gate and adds the
vendor "didn't receive it" path. Behind `NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED` (OFF).

- **Hard gate in `finalizeVendor`:** after every couple-interaction gate passes, a
  marketplace vendor with PUBLISHED methods must supply the downpayment BEFORE the lock
  commits. Enforced at BOTH commit points (before `acquire_service_time_slot` on the slot
  path, and at the top of the `if (!slotPathLocked)` generic write) via a new
  `downpayment_required` result. A submitted downpayment is validated PRE-commit (method
  belongs to the vendor, amount > 0, proof present) and persisted AFTER commit. Off-platform
  / no-published-methods / flag-off all no-op through (lock unchanged). Cancel commits
  nothing (the gate is pre-commit — no revert needed).
- **Client:** `AccordionLockButton` handles `downpayment_required` → the downpayment modal
  re-calls `finalizeVendor` with the payment + the preserved slot/date/terms context, which
  commits. Removed the old post-lock modal path.
- **Vendor reject:** new `reject_vendor_deposit(uuid, text)` SECURITY DEFINER RPC
  (migration `20270722461308`) — single-winner, vendor-gated, cannot reject a confirmed
  deposit, clears the deposit markers so the couple re-submits, and **voids the orphaned
  un-acknowledged deposit ledger row** so a re-submit never double-logs the budget. Vendor
  UI adds a "Didn't receive it?" disclosure (optional reason) beside the confirm button;
  couple is notified (`payment_rejected`).
- **Ledger integrity (from adversarial review):** the post-commit persist is now
  **single-winner** (`.is('deposit_recorded_at', null)` stamp → only the winner logs the
  ledger + notifies) so concurrent finalizes can't double-log, and the ledger-insert error
  is logged (never silent). Removed the now-dead `getLockDownpaymentContext` /
  `recordLockDownpayment` exports.
- Adversarially verified (5 dimensions): gate-bypass ✓, context-threading ✓; the 4
  ledger/idempotency findings fixed here.

SPEC IMPACT: Hardens the payment-gated lock (Vendor_Customer_* plans) to a server-enforced,
non-bypassable gate + a vendor-reject path. Migration `20270722461308` applied to prod.
Gated by `NEXT_PUBLIC_PAYMENT_GATED_LOCK_ENABLED` (OFF). Logged in DECISION_LOG.md 2026-07-11.
