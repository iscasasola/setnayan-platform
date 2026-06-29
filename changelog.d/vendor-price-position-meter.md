## 2026-06-29 · feat(vendor): Price-Position Meter (Wave 6 · last "Soon" benefit)

Ships the Price-Position Meter end-to-end — a vendor sees where their own
starting price sits inside the published market for the same (category, region,
guest-count bucket): the low / median / high band and their percentile inside it.

- **Migration `20270324043850_market_price_bands.sql`** (RLS at CREATE):
  - `public.price_band_pax_bucket(INT)` — canonical pax bucket per the pax lock
    (100 floor · per-50 steps · '500+' ceiling · NULL → '__all__'). IMMUTABLE.
  - `public.market_price_bands(category, region_slug, pax_bucket, low_php,
    median_php, high_php, sample_n, computed_at)` — cached bands. RLS: any
    authenticated user SELECTs (de-identified aggregates, no peer identity);
    admin-only writes (mirrors `token_burn_bands`).
  - `public.recompute_market_price_bands()` — SECURITY DEFINER, `is_console_admin`
    -gated rollup that rebuilds the table from PUBLISHED `vendor_services` +
    `vendor_packages` prices. `sample_n` = DISTINCT vendors per bucket; buckets
    below the admin-managed min-N floor (`platform_settings.radar_min_n_floor`,
    held ≥3) are SUPPRESSED via `min_n_ok()` — a thin market reads "not enough
    data" rather than a fabricated range. Cron-free (admin "run now" / after()).
- **`lib/price-position.ts`** — resolves a vendor's (category, region, pax_bucket)
  + their own lowest active price → position (below/in/above band) + percentile.
  Honest empty-state: returns `no_data` when the band is suppressed/absent.
- **Vendor surface** — `PricePositionCard` ADDED beside the existing Peso card on
  `/vendor-dashboard/subscription` ("Nth percentile for {category} in {region}",
  with a low–median–high rail).
- **Admin surface** — NEW `/admin/price-bands` (clones `/admin/token-bands`):
  reviews computed bands + a "Recompute now" control. Linked from the admin
  sidebar + nav registry + `routes.ts`.

Band thresholds are admin-managed (computed, never hardcoded); min-N suppression
is enforced; RLS at create (public read / admin write); recompute is cron-free.
Founder-only today → prod dry-run confirms 1 priced row, 0 bands above floor →
every bucket correctly suppressed (expected). No couple surface in v1.

SPEC IMPACT: None. (New vendor-benefit feature; no locked decision, SKU, price,
schema rename, or retired-feature change. Pricing stays admin-managed — the meter
only reflects vendor-set prices, it never sets one.)
