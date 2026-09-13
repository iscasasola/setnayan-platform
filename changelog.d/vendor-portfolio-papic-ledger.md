## 2026-09-05 · feat(papic): a supplier's Papic credits — 5% of the booking fee, cap 1,000, plus a ₱500/25 pack, landed on approval into their own ledger

Owner rulings 2026-09-05 (DECISION_LOG, verbatim): *"vendors get 5% of the amount
they paid for on booking fee. so if they paid 1000 pesos for the booking fee, they
get 50 papic credits for that event. if they import a user and get to sync with
them for free. they pay 500 pesos for 25 papic credits. since they did not pay for
booking fee, they only pay for the photo importation fee for their portfolio."* ·
cap *"minimum of 1000"* → confirmed the same day as the MAXIMUM (*"yes. that is the
maximum from booking fee."*) · *"when we approve the payment"* · of the 2026-08-26
₱5/point allowance: *"replace it."* · asked whether the host-visible lane survives
on the new credits: *"base it all from the supplier's shots per event not from
what the host gives them."*

**Retired (a REVERSAL of the 2026-08-26 "SUPPLIER LANE, RULED IN FIVE PARTS"
row, part 1):** `VENDOR_PAPIC_PHP_PER_POINT` (₱5/point), `VENDOR_PAPIC_BASE_GIFT_POINTS`
(the 50 floor), `VENDOR_PAPIC_MAX_POINTS` (the 2,000 ceiling),
`VENDOR_PAPIC_FEE_CEILING_PHP`, `vendorPapicPointsForBookingFee` in
`lib/vendor-papic-tier.ts`, and the live fee reader `fetchVendorBookingFeePaidPhp`
in `lib/vendor-papic-grants.ts`. Its two rules that were never about the rate
survive — a failed read is `null` and grants nothing; `waived_free5` /
`waived_import` mean they paid ₱0 — moved to the moment of writing.

**Added:**

- `lib/vendor-papic-credits.ts` — pure: `vendorPortfolioCreditsForFee(fee)` =
  `floor(fee ÷ ₱20)` (that is 5%, and also ₱500 ÷ 25 — the owner's two numbers
  agree), capped at 1,000, **no floor**, `null`/NaN/≤0 → 0; `offerPack(credits)`
  = under 25; the pack SKU code and its 25. Tests: `vendor-papic-credits.test.ts`.
- Migration `20271206612859_vendor_papic_portfolio_credits_ledger_and_pack_sku.sql`
  — `vendor_papic_portfolio_credit_grants` (per vendor × event, append-only,
  `credits > 0`, `source IN (booking_fee, pack_order, admin, comp, migration)` with
  NO default, `order_id → orders`, partial UNIQUE on `(order_id, source)`; vendor
  reads own / admin reads all / nobody writes from a session; anon revoked) and the
  `vendor_billing_catalog` row `vendor_papic_portfolio_pack` · ₱500.00 ·
  `vendor_addon_per_event` · price admin-managed, never overwritten on conflict.
  **A second table, deliberately:** `vendor_papic_capture_grants` is the tier row,
  UNIQUE on the pair — a second pack for one event has nowhere to land there.
- `lib/sku-activation.ts` — two doors, both *"when we approve the payment"*: inside
  the existing `vendor_booking_fee__{charge_id}` hook, after the charge settles,
  `grantVendorPapicCreditsForBookingFee` reads the CHARGE (only `status = 'paid'`
  earns; an unread charge grants nothing and is reported) and writes
  `floor(fee × 5%)`; a new exact hook for `vendor_papic_portfolio_pack` writes 25
  to the order's (vendor, event). Idempotent per (order, source) by the ledger's
  own unique index — a unique violation is "already granted". Non-fatal, per the
  dispatcher contract.
- `lib/vendor-papic-grants.ts` — `fetchVendorPapicCreditsGranted` (sums the
  ledger; `null` on a failed read) now feeds `allowancePointsFor` on all three
  supplier surfaces (capture route · capture screen · on-the-day badge) where the
  fee used to; and **what G3 calls**: `fetchVendorPapicPortfolioCredits` →
  `{ credits, spent, left, packSkuCode, packPricePhp (read from the table),
  packCredits, offerPack }`.
- `lib/vendor-papic-tier.ts` — `allowancePointsFor(tier, creditsGranted)`: MAX
  of the tier gift and the ledger (credits can only ever raise, never lower; a
  founder-comped Ltd keeps 70), `null` = unproven → tier number. One credit is one
  point — no rate lives in this module any more.
- Ugat map: joint **J49** (`TYPE-PAPIC ↔ TYPE-VENDORS`, chain 18) maps the new
  ledger together with the two older `vendor_papic_*` tables — the family sensor
  would otherwise have fired at three.
- DB test `tests/db/vendor-papic-credits-are-the-suppliers.db.test.ts`: a supplier
  grant is invisible to `papic_event_pool_status` and a host-side grant invisible
  to the supplier's ledger; positive-only; source required; idempotent per
  (order, source) and stacking across orders; RLS (own rows only, the couple reads
  none, no session writes); anon holds no grant; the SKU is seeded at ₱500.

**Not in this PR, stated rather than assumed:**

- **Video at 800** (2026-08-26 part 2) was priced against the retired rate (800
  points was a ₱4,000 fee; at 5% it is a ₱16,000 fee or 32 packs). *"Replace it"*
  did not say what happens to it. The threshold is UNCHANGED and now compared
  against the credit-fed allowance. **Owner question in the PR body.**
- **The 50-point Lite gift** (2026-07-22) is kept as the MAX floor of the
  on-the-day allowance. The owner's *"no floor"* was said of the 5% formula, which
  the ledger honours exactly (₱0 → 0 rows); whether the older gift should also go
  is the second owner question in the PR body.
- The **buy action** for the pack (minting an order with `service_key =
  vendor_papic_portfolio_pack`, `orders.event_id` and `orders.vendor_profile_id`
  set), the private portfolio album and the under-25 CTA are **G3's**; G2 leaves
  one reader and one pure rule for it.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — the
2026-09-05 📸 row already records the three rulings; this PR appends the two owner
answers of the same day (cap = maximum; *"base it all from the supplier's shots
per event"*) and the reversal as landed. Corpus mirror `0012_papic/0012_papic.md`
gains a "Supplier credits (2026-09-05)" section; `.docx` regenerated via pandoc.
