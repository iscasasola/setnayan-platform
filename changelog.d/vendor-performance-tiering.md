## 2026-07-01 · feat(vendor): My Performance tiering (Solo/Pro/Enterprise) + Daily plot

Applies the owner's My Performance tiering decision (design conversation
2026-07-01) to the live `/vendor-dashboard/performance` cockpit, and adds a
Daily view to the Momentum card. All gating is **flag-dark** behind
`VENDOR_TIER_FEATURE_GATE` (default OFF → every tier still sees every card, so
today's all-`free` founder + demo/test vendors are unchanged; owner flips the
flag once paid vendors exist in prod).

**Tier ladder (the decision):**
- **Free / Verified** — no My Performance (full-page `VendorTierGate` upsell).
- **Solo** — own-shop glance: Health composite · Grow recs · basic Momentum
  (count only, Monthly/Annual). `MomentumCard variant='basic'`.
- **Pro** — full own-business analytics: + revenue & **Daily** Momentum · ROI
  (Setnayan vs your book) · booking Funnel.
- **Enterprise** — + cross-business **market intelligence** (Demand Radar ·
  Price-Position), de-identified + min-N, nationwide totals only.

**Data-governance rule honored (owner: "only your own business; nationwide
totals OK"):** own-business cards are SECURITY DEFINER RPCs ownership-gated to
`current_vendor_profile_ids()`; market-intel cards are de-identified + min-N
floored. No card exposes another business's rows. Daily granularity is added
ONLY to own-business Momentum — the market-intel surface stays at month
granularity (a single-day region/style bucket could re-identify one couple).

**Caps (`lib/vendor-tier-caps.ts`):**
- `marketIntel` moved **Pro+ → Enterprise-only** (the only cross-business class).
- New `performanceAdvanced` cap (**Pro+**) + `canSeePerformanceAdvanced()` helper
  for ROI / Funnel / daily+revenue Momentum. `performanceTrends` (**Solo+**)
  keeps gating My Performance access + basic Momentum.

**Migration** `20270420213000_vendor_booking_daily_series_rpc.sql` — new
`public.vendor_booking_daily_series(p_vendor_profile_id UUID, p_days INTEGER)`
SECURITY DEFINER, STABLE, ownership-gated RPC. One row/day (zero-filled via
`generate_series`, clamped 1..90) with `booking_count` + `SUM(total_cost_php)`
over the caller's BOOKED `event_vendors` rows, bucketed Asia/Manila. Mirrors the
monthly-series RPC exactly, day buckets. Idempotent; no table, no policy.

**Surfaces realigned to the Enterprise-only market-intel line:**
- `/vendor-dashboard/demand` gate → `requiredTier="enterprise"` (was pro).
- `/vendor-dashboard/funnel` gate → `canSeePerformanceAdvanced` / Pro (was
  `performanceTrends` / Solo).
- Home `vendor-stats-panel` Category Benchmarks upsell copy → Enterprise.

**Components:** `MomentumCard` gains `variant` (basic/full) + a Daily toggle;
`momentum-chart` generalized to a granularity-agnostic `ChartPoint[]` + `unit`
(sparse bar labels for the 30-day view); new inline `VendorTierTeaser` (compact
per-section upsell) alongside the existing full-page `VendorTierGate`;
`performance/page.tsx` reorganized into Overview / Your business / Market
intelligence sections with tier-gated teasers.

SPEC IMPACT: DECISION_LOG.md row appended (2026-07-01 My Performance tiering) +
new design doc `03_Strategy/Vendor_My_Performance_Tiering_2026-07-01.md`
capturing the full discussion→design→build 1-1 mapping. Phase B/C/D analytics
families (inquiry-handling / conversion / catalog / reputation detail) are
scoped in that doc as sequenced follow-up PRs.
