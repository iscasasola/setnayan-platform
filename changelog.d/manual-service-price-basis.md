## 2026-11-13 · feat(suppliers): a self-added supplier records what was agreed — One price · Per guest · Per hour (v2)

Owner-approved v2 (`prototypes/manual_service_price_basis_2026-11-13/v2.html`; DECISION_LOG 2026-11-13 "SELF-ADDED
PRICE: THE COUPLE RECORDS WHAT WAS AGREED" · "AFTER THE CLAIM, THE SUPPLIER'S PRICE FOLLOWS THE GUEST LIST" · "PRICE
BASIS v2 AGREED — BUILT WITH THE SHIPPED BOXES AND THE SHIPPED PAYMENT PLAN"). Replaces the v1 rate × live-count build.

- **The couple's Add-a-supplier sheet + record card** (`price-basis-rows.tsx`): How the price works ▾ (house PickMenu),
  then house `TypedRow`s — One price: Price ("One payment for the whole day"); Per guest: Total agreed + Guests agreed;
  Per hour: Total agreed + Hours agreed. Both numbers typed; nothing reads the schedule or the guest list. T17: every
  explanation, including "Works out to ₱X a guest", lives in the row's ⓘ. The shipped payment-plan maker is reused.
- **How to pay them** (`pay-ways-editor.tsx`, `self-added-pay-ways.ts`): the supplier's own shape (`PAYMENT_PROVIDERS`
  Account type ▾ · Account name · Account number) and/or their QR (existing private R2 upload). At least one way is
  required only when the plan has payments. Inert; stored on `event_manual_vendors.pay_ways` (host RLS). The record card
  shows them in the `VendorDirectPay` look.
- **Schema (migration `20271342032145`, not yet on main — rewritten):** `event_vendors.pricing_basis`
  ('per_pax' | 'per_hour', NULL = One price) + `agreed_hours NUMERIC(5,2)`; guests agreed reuse `pax_quote_base`
  (Rule 0). CHECKs tie each count to its basis. `event_vendor_counts_per_head` also counts a per-guest booking. All v1
  rate/terms/follow/schedule-trigger objects removed. `total_cost_php` stays the one total via `updateVendorCosts`.
- **Record card:** "₱162,000 · 120 guests agreed" / "₱30,000 · 5 hours agreed", plus "After they claim: …".
- **Claim door** (`claim-door.tsx`, `claim-actions.ts`): the card slide shows a read-only How the price works row, then
  the Card Maker's fields pre-filled (per guest = total ÷ guests, rounded and said; min guests; min hours, From, required
  Each extra hour; One price From + Extras) and a band saying the couple's total stays as their booking; written through
  `createVendorService` (now also saving add-ons). A new "Your payment details" slide lets the supplier confirm or fix
  what the couple recorded; kept ways go through the shipped `addPaymentMethod` (its QR decode + moderation gate
  unchanged; the QR is copied into `vendor-payment-qr/<shop>/` by `claim-door-pay.server.ts`).

Tests: `tests/db/a-self-added-price-says-how-it-works.db.test.ts`, `lib/self-added-price-basis.test.ts`,
`lib/the-claim-door-prices-what-was-agreed.test.ts`, `lib/how-to-pay-them-keeps-what-was-typed.test.ts`; guards updated:
`agreed-total-and-its-changes`, `open-shop/the-claim-door` (pay slide in the order). Exposure baseline + ugat screens
regenerated with the repo scripts. Shots: `build-sessions/shots-7565-v2/`.

Follow-up (not built): the post-claim "price follows the guest list" — the quote-follow works on proposal line items,
not a small hook.

SPEC IMPACT: None — implements the three 2026-11-13 DECISION_LOG rows already recorded.
