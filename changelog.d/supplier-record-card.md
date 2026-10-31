## 2026-10-29 · feat(suppliers): the couple's supplier record is a card like the guest card; a price change re-plots the unpaid payments

The record a couple keeps for a supplier THEY ADDED (`new-manual-vendor-modal.tsx`, edit mode) is reorganized
as the approved Booked prototype v4 draws it (owner OK 2026-10-29 ~19:20): the head is the supplier's name,
category and "Your record, not a booking" ⓘ (the heads-up line moved into it), then their claim link drawn like the
guest ticket (`SupplierConnectPanel layout="top"`: QR · Download · Copy link · Share, "Create their link" when none);
then the guest card's folds, one open at a time — Contact · Price (+ Inclusions) · Payment plan · How to pay them ·
Place · Services. One form, one Save, every live field and control kept.

- **Payment plan rows are name · due date · amount** (`PaymentPlanRows dated`), ✕, ＋ Add a payment, and the honest
  "Adds up to … · matches / ₱X not in a payment yet / ₱X more than the price" line. The STORED rule does not change:
  `lib/record-card-plan.ts` maps a typed day to `before_event`/`on_lock` + days and back exactly, and an untouched
  row posts its own rule (a 50 % row stays 50 %). Each row now posts its own `plan_seq` and `buildCouplePaymentPlan`
  keeps it (`assignPlanSeqs`), so a payment logged against an instalment stays on it. No ↑↓ (dated rows order
  themselves). The add sheet keeps the percent/anchor rows.
- **How to pay them** — several ways, each Method ▾ (GCash · Maya · Bank transfer · InstaPay / QR Ph · Cash ·
  Check · Other) + their QR photo (private, `payment-proof/events/<event>/supplier-pay-qr`) and/or details. Stored in
  `event_manual_vendors.pay_ways`, written by `saveSelfAddedServiceCard`; the older note shows as one "Other" way
  until replaced. The Pay sheet lists them for a self-added supplier (QR full size, Copy details) above the payment
  card that records "I paid". Inert: `the-payment-note-is-inert.test.ts` now holds `pay_ways` too.
- **An accepted price change always re-plots the unpaid payments** (owner 2026-10-29, "replot the payments always").
  In the database, so no door can forget it: an accepted change line, or a self-added supplier's price edit, re-splits
  the unpaid instalments by their own proportions (paid ones never move; whole pesos, rounding on the last unpaid;
  all paid + price up → one Balance), and keeps the plan before in `event_vendor_payment_plan.replot_history`. The
  record card and the Pay sheet say "Price changed ₱A → ₱B · plan updated". `plan_replot_instances` (SQL) is held
  equal to `lib/plan-replot.ts` by `a-price-change-replots-the-unpaid-payments.db.test.ts`.

- **Their claim link is automatic** (owner 2026-10-30, verbatim: "no need to wait to create link. create an automatic
  link"). Every add makes it (`addManualSupplier` step 7, no longer only when the walk asks for it back); a supplier
  added before this gets theirs the first time the record card opens — through the ONE idempotent writer
  (`createManualVendorInvite` → `ensureAutoShareInvite`, one live link per supplier), so opening twice makes one link.
  The card's head always shows it ready (QR · Copy · Share); "No link yet / Create their link" is gone, and a link
  that could not be made is said in place with Try again. Guards: `their-claim-link-is-automatic.test.ts` + the db test.

- **A peso amount gets its commas as it is typed** (owner 2026-10-30: "cannot place commas because it only shows number
  pad now with period"). The plan rows' amounts (record card and add sheet) and every `TypedRow amount` (the price)
  format 100000 → 100,000 while typing, the caret kept after the digit just typed; the number pad stays; what is saved
  is the plain number (`lib/peso-as-you-type.ts`, guard `a-peso-amount-gets-its-commas-as-typed.test.ts`). The record
  card's rows take pesos only; the add sheet's ₱ / % choice is its PickMenu, never a typed sign.

Migration: `20271297090101_a_price_change_replots_the_unpaid_payments.sql` (two JSONB columns, four functions, three
triggers — one keeps the kept plans written only by the re-plot) — not applied by hand.

SPEC IMPACT: None — implements the DECISION_LOG rows of 2026-10-29 "THE SUPPLIER RECORD CARD IS REORGANIZED LIKE THE
GUEST CARD" and "AN ACCEPTED PRICE CHANGE ALWAYS RE-PLOTS THE UNPAID PAYMENTS" as ruled. Open owner calls are in the PR.
