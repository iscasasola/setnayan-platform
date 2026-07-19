## 2026-07-01 · fix(vendor): per-metric min-N guard on category benchmarks (privacy)

Fix-forward for the HIGH finding from the Wave-1 adversarial review of #2511.
`recompute_market_funnel_bands()` enforced the ≥3-distinct-vendor floor only on
the bucket's `sample_n`. Because each funnel metric's percentile carries its own
`FILTER (WHERE metric IS NOT NULL)`, a bucket could clear the floor while a single
metric had only ONE non-null peer — `percentile_cont` over one value returns
p25=p50=p75 equal to that vendor's exact raw number, surfaced to every other Pro+
vendor as the "peer median" and de-anonymizing a single competitor (RA 10173 /
the migration's own "never expose a single peer" contract).

- `supabase/migrations/20270414231500_*.sql` — `CREATE OR REPLACE` of the
  recompute function wrapping every percentile in a per-metric guard
  (`CASE WHEN COUNT(DISTINCT vendor_profile_id) FILTER (WHERE metric IS NOT NULL)
  >= v_floor THEN percentile … END`); below the floor the edge is NULL and the
  existing TS reader renders "not enough peer data yet". Also clears any already-
  materialized bands so a previously-leaked single-peer edge can't linger. All
  other logic (peers CTE, region/pax resolution, bucket-level `min_n_ok`, admin
  gate, pinned `search_path`) is byte-identical.

No UI change — the reader already treats null band edges as no-data. The feature
stays flag-dark (VENDOR_TIER_FEATURE_GATE) and founder-only until real peers exist.

SPEC IMPACT: none — a de-identification hardening on an unlaunched flag-dark
surface; no schema/SKU/price/public-copy change.
