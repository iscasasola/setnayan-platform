## 2026-06-25 · fix(payments): charge VAT-inclusive gross at checkout (owner ruling — couples pay +12%)

The high-stakes audit found the live inline checkout RECORDED + INSTRUCTED the PRE-VAT catalog price while `computeOrderTotals`, the admin queue, the BIR receipt, and payouts all gross that base by +12% — so every inline order under-collected 12% and showed a phantom 'remaining'. Owner ruling (2026-06-25): catalog prices are **pre-VAT; +12% added at checkout** (couples pay the gross). This aligns the checkout charge with the already-correct downstream.

- **`app/dashboard/[eventId]/checkout/actions.ts`** (`submitOrderAction`) — `finalAmountForPayment` (the `payments.amount_php`, the confirmation email amount, and the admin reconciliation notice) is now `computeVatFromBase(voucherFinalBase).gross`, not the bare pre-VAT base. `requested_total_php` stays the pre-VAT base (computeOrderTotals grosses it; the voucher reconciles to gross when approval sets `confirmed_total_php`). Net for a no-voucher order: paid gross == owed gross → no under-collection, no phantom 'remaining', and the receipt's base×0.12 VAT now matches cash received.
- **`_components/inline-checkout-drawer.tsx`** — the collapsed CTA, the drawer header total, and the voucher final now show the **gross** (new `formatGrossCentavos`, using the SAME `computeVatFromBase` as the server → no drift, couples can't underpay what they're shown), plus an "incl. 12% VAT" caption. Covers bundle + Panood checkout (both render this drawer).
- **`lib/receipts.test.ts`** (new, 7 cases) — pins `computeVatFromBase` (now load-bearing for the charge): 12% gross, 2dp rounding (₱3,999→₱4,478.88), zero base, the `gross === preVat + vat` invariant, explicit rate.

Coverage: the inline path (`submitOrderAction`) is the couple-facing checkout — bundle/Panood/drawer all route through it. The legacy `/orders/new` `createOrder` is redirected to `/studio` (unreachable for couple checkout; retained only for self-comp/admin edge paths). ⏭ Follow-ups to confirm: the onboarding `submitOrderAction` caller's price display (charge already gross via the server) + grossing the legacy `createOrder` email if it's ever re-enabled.

Verified: tsc clean; 489/489 lib tests (7 new); no lint errors; **production `next build` succeeds** (client drawer imports the client-safe `lib/receipts`).

SPEC IMPACT: Payments / BIR — catalog prices are PRE-VAT, gross (+12%) charged at checkout. Logged in `DECISION_LOG.md`.
