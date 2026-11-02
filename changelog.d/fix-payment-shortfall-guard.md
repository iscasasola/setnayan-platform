## 2026-06-25 · fix(payments): block marking an order 'paid' when the payment is short (the last face of the VAT/money finding)

The high-stakes audit's 3rd money finding: `approvePayment` promoted an order to `'paid'` (issuing a receipt + firing vendor payouts) whenever the admin ticked "promote to paid" — **without ever comparing the matched payments to the amount owed**, so a short/partial transfer silently passed on the happy path. Now unblocked by the VAT ruling (#2185), which fixes the comparison basis.

- **`lib/orders.ts`** — new pure `orderGrossOwed({requestedTotalPhp, confirmedTotalPhp, voucherDiscountPhp})`: gross owed = base + 12% VAT, base = `confirmed_total_php` once confirmed else `requested_total_php − voucher discount` (voucher-aware, so it never false-blocks a voucher order). + `lib/orders.test.ts` (5 cases).
- **`app/admin/payments/actions.ts` (`approvePayment`)** — in the `promoteOrder` branch, before flipping the order to `'paid'`: sum the order's MATCHED payments and, if they're short of `orderGrossOwed` (beyond a ₱1 centavo-rounding tolerance), throw a clear, actionable error. The payment is still matched (the admin acknowledged receipt); only the order→paid promotion (+ receipt + payout) is gated. Extended the order fetch to include the totals + voucher columns.

The admin records a partial by leaving "promote to paid" off; once the balance is matched, promoting succeeds (matched payments accumulate). No migration; no behaviour change for fully-paid orders.

SPEC IMPACT: Payments — server-side reconciliation gate on order promotion. Logged in `DECISION_LOG.md`.
