## 2026-07-04 · feat(admin): HQ Custom-tier composer — sliders + discount + composition-first quote + provision-on-approval

Stacked on #2787 (Custom-tier schema + caps + pricing lib). Adds the admin-side
half of the Custom vendor tier (VENDOR_TIERS_AND_BENEFITS.md §11):

- **New surface `/admin/custom-plans`** (System Settings nav, next to Pricing).
  Org picker (any claimed vendor_profiles) → the SAME 7 composition knobs the
  vendor configurator exposes (branches · reach±nationwide · seats · slots ·
  photos · tokens/cycle · domain), all driving `computeCustomQuote` live.
- **Per-quote unit-price overrides** — the admin may nudge any of the 9 unit
  prices for the preview/quote only. Catalog prices are read SERVER-SIDE from
  the admin-managed `vendor_billing_catalog` (`lib/vendor-custom-catalog.ts`);
  overrides are in-memory and NEVER persist a catalog row (that stays at
  /admin/pricing).
- **Partner discount** — ₱-amount or %-rate per cycle, passed straight through to
  `computeCustomQuote` (the lib owns the charm-round + floor-at-base + discounted-
  annual math; the surface never recomputes it).
- **Composition-first quote panel** — what the vendor GETS in plain words
  (everything in Enterprise + each dialed line), THEN the price block (per 28
  days + annual, 3-free-cycles note), the discount line, and the assurances
  (0% commission · pay via BDO/GCash · nothing charged until approval).
- **Send quote** (`sendCustomQuote`, admin-gated) → upsert `vendor_custom_plans`
  (composition + discount + quoted_28d_php, status 'quoted') + open the apply-
  then-pay `orders`+`payments` (service_key `vendor_custom_plan__{id}`,
  reference `SN`+8hex) so it lands in /admin/payments. Mirrors the branch/seat
  buy flow. Quote is recomputed server-side from the catalog — client price is
  never trusted.
- **Provisioning wired at the sku-activation seam** (`lib/sku-activation.ts`): a
  new prefix hook for `vendor_custom_plan__{id}` fires on payment approval —
  demotes any other active plan (one-active unique-index guard), promotes the
  org's target plan to 'active', flips `vendor_profiles.tier_state='custom'`,
  stamps a 28-day order window, appends a ledger row. Idempotent + non-fatal per
  the dispatcher contract. Plus an explicit **"Mark active"** admin lever
  (`activateCustomPlan`) for comp / off-platform-settled deals that skip the pay
  round-trip.

No migration (reuses #2787's schema). No catalog writes here.

SPEC IMPACT: None — implements VENDOR_TIERS_AND_BENEFITS.md §11
