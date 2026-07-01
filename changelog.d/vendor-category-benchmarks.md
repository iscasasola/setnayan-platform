## 2026-07-01 · feat(vendor): Category Benchmarks vs Peers — de-identified funnel percentiles

Replaced the static "Benchmark data coming soon" placeholder in the vendor
Performance panel with a real percentile reader that ranks the vendor's funnel
against anonymized peers in their EXACT (category, region, pax) bucket:
reply-rate, avg reply-time, and inquiry→booking conversion.

- **Migration `20270414204217_market_funnel_bands.sql`** — companion to
  `market_price_bands`:
  - `market_funnel_bands` cache table (p25/p50/p75 per metric + distinct-peer
    `sample_n`), RLS-enabled at CREATE with **zero policies** (deny-all direct
    reads) so the min-N gate can never be side-stepped.
  - `recompute_market_funnel_bands()` — `SECURITY DEFINER`, `is_console_admin()`
    -gated rollup from `vendor_activity_stats`, suppressing buckets below the
    admin-managed min-N floor (`platform_settings.radar_min_n_floor`, held ≥ 3)
    via `public.min_n_ok()`. Reuses the canonical `price_band_pax_bucket(INT)`.
  - `funnel_benchmark_for_vendor(uuid, text)` — `SECURITY DEFINER`, owner/admin
    -gated reader returning the caller's OWN metrics + the peer band + `has_band`
    (false → honest `no_data`, expected while founder-only).
- **`lib/funnel-benchmark.ts`** — client-agnostic reader + pure percentile math
  (piecewise-linear placement across the three quantile edges; reply-time is
  inverted so "higher percentile = better" is uniform). Degrades to
  `EMPTY_FUNNEL_BENCHMARK` on any RPC error.
- **`vendor-stats-panel.tsx`** — new `CategoryBenchmarkCard` with locked /
  no_data / ranked states. Surface gated on **Pro+** via the existing
  `canSeeMarketIntel(tier)` (no new cap), enforced flag-dark through
  `isVendorFeatureGateEnabled()` — same pattern as Demand Radar, so today's
  all-`free` founder/demo vendors aren't locked out until paid vendors exist.

Privacy: never exposes a single peer — only aggregated p25/p50/p75 past the
min-N floor; the band table is RLS-locked and only reachable through the
ownership-gated RPC.

SPEC IMPACT: None. Extends the existing Wave-6 market-intel surface (Demand
Radar + Price-Position Meter) with a funnel benchmark; no pricing, SKU, or
public-claim change. Admin "Run now" trigger for `recompute_market_funnel_bands`
can be wired into the existing `/admin/price-bands`-style ops surface as a
follow-up (owner).
