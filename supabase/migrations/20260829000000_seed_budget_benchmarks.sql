-- Seed PH-sourced benchmark prices into budget_leaf_benchmarks.
-- Owner-confirmed 2026-06-05 ("apply this to our website").
--
-- Source: storia.ph "Wedding Cost Breakdown: Philippines 2026" (per-category PHP
-- ranges) cross-checked against eventnest.ph "Filipino Wedding Cost Guide" (PH %
-- shape). Mid-range ~150-pax Metro Manila wedding. These are owner/admin-set
-- market figures, NOT invented — and the admin can override any line in
-- /admin/budget-planner at any time.
--
-- Mapping into the engine: benchmark_php = typical midpoint; floor_php + p25_php
-- = the low (cheapest seen / band floor); p75_php = the high (band top). The
-- engine shows "₱floor–₱high" as the shopping range and warns below floor_php.
--
-- ⚠ Pax-driven leaves (catering, venue, florals) assume ~150 pax — they over/
-- under-state for very different headcounts until pax-axis normalization lands.
-- The 12 leaves the sources do not price (ceremony_venue, stylist, cake,
-- photobooth, led_background, cocktail_booths, dance_instructor,
-- after_party_music, bridal_car, guest_shuttle, accommodation, logistics) are
-- left NULL on purpose — owner to seed when PH figures are confirmed.
--
-- This is a DATA seed only; no schema change. budget_leaf_benchmarks rows already
-- exist (created + labelled in 20260826000000), so these are UPDATEs by PK.

UPDATE public.budget_leaf_benchmarks SET benchmark_php=100000, floor_php=50000,  p25_php=50000,  p75_php=150000, updated_at=NOW() WHERE plan_group_id='reception_venue';
UPDATE public.budget_leaf_benchmarks SET benchmark_php=450000, floor_php=375000, p25_php=375000, p75_php=600000, updated_at=NOW() WHERE plan_group_id='catering';
UPDATE public.budget_leaf_benchmarks SET benchmark_php=90000,  floor_php=30000,  p25_php=30000,  p75_php=120000, updated_at=NOW() WHERE plan_group_id='photography';
UPDATE public.budget_leaf_benchmarks SET benchmark_php=70000,  floor_php=30000,  p25_php=30000,  p75_php=120000, updated_at=NOW() WHERE plan_group_id='florals_decor';
UPDATE public.budget_leaf_benchmarks SET benchmark_php=50000,  floor_php=25000,  p25_php=25000,  p75_php=80000,  updated_at=NOW() WHERE plan_group_id='coordinator';
UPDATE public.budget_leaf_benchmarks SET benchmark_php=45000,  floor_php=25000,  p25_php=25000,  p75_php=80000,  updated_at=NOW() WHERE plan_group_id='live_band';
UPDATE public.budget_leaf_benchmarks SET benchmark_php=40000,  floor_php=10000,  p25_php=10000,  p75_php=80000,  updated_at=NOW() WHERE plan_group_id='music_entertainment';
UPDATE public.budget_leaf_benchmarks SET benchmark_php=40000,  floor_php=15000,  p25_php=15000,  p75_php=80000,  updated_at=NOW() WHERE plan_group_id='attire';
UPDATE public.budget_leaf_benchmarks SET benchmark_php=40000,  floor_php=10000,  p25_php=10000,  p75_php=100000, updated_at=NOW() WHERE plan_group_id='rings';
UPDATE public.budget_leaf_benchmarks SET benchmark_php=25000,  floor_php=15000,  p25_php=15000,  p75_php=40000,  updated_at=NOW() WHERE plan_group_id='host_mc';
UPDATE public.budget_leaf_benchmarks SET benchmark_php=15000,  floor_php=8000,   p25_php=8000,   p75_php=25000,  updated_at=NOW() WHERE plan_group_id='hair_makeup';
UPDATE public.budget_leaf_benchmarks SET benchmark_php=15000,  floor_php=5000,   p25_php=5000,   p75_php=45000,  updated_at=NOW() WHERE plan_group_id='officiant';
UPDATE public.budget_leaf_benchmarks SET benchmark_php=14000,  floor_php=8000,   p25_php=8000,   p75_php=20000,  updated_at=NOW() WHERE plan_group_id='lights_sound';
UPDATE public.budget_leaf_benchmarks SET benchmark_php=12000,  floor_php=5000,   p25_php=5000,   p75_php=20000,  updated_at=NOW() WHERE plan_group_id='invitations_stationery';
