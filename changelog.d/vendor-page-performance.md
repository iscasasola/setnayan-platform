## 2026-07-01 · feat(vendor-dashboard): reskin My Performance to the finalized prototype

Ported `/vendor-dashboard/performance` to the finalized vendor-dashboard
prototype in the editorial (`--m-*`) palette. Heading "My Performance" /
"How your shop is doing." Four sections, all wired to LIVE per-vendor data —
no mockup numbers hardcoded:

- **Dark business-health card (signature)** — `--m-ink` card with a
  champagne-gold composite ring + five vendor-SAFE pillar bars
  (Responsiveness / Reputation / Demand / Conversion / Delivery), red<70 /
  amber 70–85 / green>85. Restructured `lib/vendor-health-composite.ts` to the
  prototype's five-pillar model built ONLY from the vendor's own
  `vendor_activity_stats` row (response_rate, review Bayesian min-N-gated,
  inquiry_to_booking, booking_completion) — never the HQ `platform_health_score`.
  Demand has no clean 0–100 vendor signal yet, so it renders as an explicit
  empty pillar pointing at Demand Radar rather than a fabricated number. The
  "+N this month" delta is omitted (no historical composite-snapshot table
  exists to diff against — left null, not invented).
- **Grow your business · highest impact first** — new
  `lib/vendor-growth-recs.ts` derives Reply-within-the-hour / Add-recent-photos /
  Ask-for-reviews cards from the vendor's own gaps (response rate, profile
  completeness, review count), each ranked with an impact chip + routed CTA;
  Open-more-Saturdays is a steady calendar prompt (no per-day open-slot signal
  wired yet, so it claims no number).
- **Setnayan vs your own book** — reuses `vendor_source_attribution()` RPC
  (migration 20270404069507). Headline peso + "~N× your annual plan" (plan cost
  read DB-authoritatively from `vendor_billing_catalog` via `fetchV2VendorCatalog`
  keyed off the vendor's `tier_state`, `TIER_PRICE_PHP` fallback), shown only
  when the vendor pays for a plan AND has confirmed Setnayan-sourced revenue.
  Two bars — Setnayan (gold) vs imported clients (gray). Partial-price honesty
  footer retained.
- **Momentum (Monthly/Annual toggle)** — URL-param toggle (`?momentum=`) over
  booked count + confirmed revenue from `vendor_source_attribution()` across the
  28-day and 365-day windows. Server-rendered, no client JS.

Registered `ArrowUpRight` + `HeartPulse` in `lib/nav-icons.ts` (curated Lucide
allowlist). Dropped the old amber/terracotta `VendorStatsPanel` composition from
this route (the detailed metric tiles remain on the vendor Home).

Verify: typecheck clean · `next lint` 0 errors on changed files · `lint:navicon`
+ `lint:retired` pass.

SPEC IMPACT: None — vendor-dashboard reskin + presentation rollups over existing
data sources; no schema, SKU, pricing, or flow change.
