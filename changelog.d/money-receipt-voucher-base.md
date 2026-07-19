## 2026-06-26 · fix(tax): BIR receipt must reflect net paid, not the pre-voucher base (#3)

Money bug-hunt finding #3 (HIGH, 3/3 verified). `issueReceiptForOrder`
(admin/payments/actions.ts) built the BIR Official Receipt's pre-VAT / VAT /
gross figures from `requested_total_php` when `confirmed_total_php` was still
NULL — but `requested_total_php` is the **pre-voucher** base, so a
voucher-discounted order got a receipt OVERSTATING the amounts (overstated output
VAT / revenue on money never collected). Now nets the voucher off the requested
base when not yet confirmed, mirroring the canonical `orderGrossOwed`:
`base = confirmed_total_php ?? max(0, requested_total_php − voucher_discount)`.
Matches the documented intent ("BIR receipt shows net paid").

SPEC IMPACT: None — corrects a tax-document amount to the net actually paid; no
SKU/price/flow change.
