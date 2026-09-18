## 2026-09-19 · fix(vendor-client): a customer page shows the money received and the balance (AREA-VENDOR)

On Rosa & Ben's customer page, after Saysay confirmed a ₱2,000 deposit on a ₱10,170 booking, Payments said "No payments to confirm yet" and Quote said "No formal payment schedule on this booking yet." Both tabs read only `event_vendor_payment_plan`, which production has never held.

For a booking with no plan, both tabs now show `BookingMoneySummary` — "₱2,000 received of ₱10,170", Deposit · Received, Balance · Not yet — cut from `vendor_payday_installments()` (the same timeline Today and /payday read; its no-plan arm lands in #5672) by the new pure `bookingMoney(rows, eventId, eventVendorId)`. Until #5672 is applied the tabs read as before; a refused read is logged, never shown as money.

Test: `app/vendor-dashboard/clients/[eventId]/the-customer-page-shows-money-received.test.ts` (cut · render · wiring in both tabs). Sabotages — drop the booking filter, drop either mount — each turn it red.

SPEC IMPACT: None.
