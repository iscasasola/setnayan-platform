## 2026-07-05 · fix(payments): treat vendor charm prices as VAT-inclusive (un-strand vendor orders)

Vendor-billing SKUs (branch add-ons, tiers, tokens — e.g. the ₱999/28d additional-branch fee) are quoted as **all-in "charm" prices**: the ₱999 a vendor sees and pays already includes 12% VAT (owner-locked 2026-07-05). But the order machinery treated the stored `requested_total_php` as a **pre-VAT base** and added 12% on top, so the payment-approval shortfall guard demanded ₱999 × 1.12 = ₱1,118.88 and **stranded every vendor order in "payment matched but never promoted to paid" limbo** (confirmed on the owner's own order `S89O-DSARC9A5P0`; 1 order affected at time of fix).

Fix — distinguish the two pricing conventions by the `vendor_` service-key prefix:

- `lib/orders.ts`: new `isVatInclusiveServiceKey(serviceKey)` (`vendor_` prefix); `orderGrossOwed` gains a `vatInclusive` flag — when set, the stored total IS the gross owed (no ×1.12). Customer SKUs (`UPPER_SNAKE`) are unchanged (base + 12%).
- `lib/receipts.ts`: new `computeVatFromGross(gross)` — VAT-inclusive back-out (`vat = gross × 12/112`, `preVat = gross − vat`), so a ₱999 order's receipt shows base + VAT summing to exactly ₱999, not ₱999 + ₱119.88.
- `app/admin/payments/actions.ts`: the shortfall guard passes `vatInclusive` for vendor keys, and `issueReceiptForOrder` decomposes vendor totals via `computeVatFromGross`. Customer flow byte-identical.
- 18 unit tests (orders + receipts) green, incl. the ₱999 stranding case + back-out invariant `preVat + vat === gross`.

No schema change; no vendor price change (₱999 stays ₱999). The pre-existing stuck order is un-stuck separately by re-approving it through the fixed flow.

SPEC IMPACT: Clarifies that vendor-billing charm prices are VAT-inclusive (vs customer SKUs which are pre-VAT + 12% at checkout). Surfaced to owner, who confirmed the VAT-inclusive direction 2026-07-05. Also flagged (out of scope): the BIR spec note "V1 launches non-VAT" conflicts with the code applying 12% VAT to all orders — owner to reconcile separately.
