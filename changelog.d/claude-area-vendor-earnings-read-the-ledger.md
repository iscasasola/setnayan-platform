## 2026-09-19 · fix(vendor-earnings): a supplier's earnings are the payments couples made to that supplier (AREA-VENDOR)

"Earned · this year" (Today) and the Earnings ledger (My Shop → Earnings) read ₱0 / "No bookings logged yet" for Saysay, who had confirmed a ₱2,000 deposit. `fetchVendorEarnings` read Setnayan's own platform `payments`/`orders` and kept rows whose `orders.service_key` equalled a supplier *category*; prod's keys are SKUs (`ONBOARDING_SERVICES`, `SETNAYAN_AI`), so it never matched — and a category is not an owner, so any match would have shown one shop's orders to every shop in the category.

Replaced by `fetchVendorLedgerEarnings(admin, vendorProfileId)`: `event_vendor_payments` on this shop's own `event_vendors` rows (`marketplace_vendor_id`), counting only money the supplier confirmed or a dispute ruled stands; throws on a refused read instead of returning ₱0. The platform-orders reader is deleted. Copy now says "payments confirmed" / "Paid {date}".

Test: `lib/vendor-earnings-read-the-ledger.test.ts` (rule · scoped read via a recording fake client · wiring of both screens). Sabotages — drop the shop filter, count unconfirmed money, drop the booking scope — each turn it red.

SPEC IMPACT: None.

**FIX-5680 · refused and disputed money is not earned.** The payments read now
selects the canonical `LEDGER_DISPUTE_COLUMNS` and the bookings read the
`DEPOSIT_DISPUTE_COLUMNS`, and `isEarnedPayment` decides through
`readPaymentDispute` (lib/payment-refusal.ts) — the same rule as
`isOpenDispute` / `vendor_payday_installments()` arm 2: a settled
`payment_stands` counts; an open refusal or a `not_received` ruling does not;
otherwise only a supplier-confirmed payment counts. Before, a deposit declined
on the booking row (where a deposit's refusal lives) and a half-written
`payment_stands` without `payment_dispute_settled_at` were both counted.
