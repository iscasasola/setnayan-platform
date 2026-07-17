-- ============================================================================
-- 20270821110000_papic_v3_tier_vocab_config_points.sql
--
-- Papic v3 — capture-POINTS ledger + tier vocabulary + admin-editable tier
-- config (owner-locked 2026-07-17 · 0012_papic/Papic_Good_Better_Best_Pricing_
-- 2026-07-17.md + Papic_Build_Brief_2026-07-17.md · PR-1 of 12).
--
-- WHAT CHANGES
--   1. paparazzi_seats.tier CHECK widens ('free','roll','unlimited') ->
--      ('free','roll','unlimited','mini','ltd'). KEEP legacy values (never-
--      rename-technical-ids lock); ADD 'mini'/'ltd'. Do NOT rename to unli/lite.
--   2. NEW public.papic_tier_config — the single, admin-editable source of truth
--      for each tier's daily POINT budget, rate SKU, free-seats, and wedding
--      day-cap. Pattern H (static reference): RLS at CREATE TABLE, public SELECT,
--      no write policy (service-role/admin only, mirrors platform_retail_catalog_v2).
--   3. Rate SKUs PAPIC_CAMERA_MINI_DAY (₱30) + PAPIC_CAMERA_LTD_DAY (₱50) seeded
--      into platform_retail_catalog_v2 BEFORE papic_tier_config (rate_service_code FK).
--   4. papic_seat_day_usage gains a single points_used counter (photo=1, clip=3).
--      photos_used/videos_used are KEPT for lineage (not dropped) and backfilled.
--
-- CAPTURE-POINTS MODEL: 1 photo = 1 point · 1 five-second clip = 3 points ·
-- one per-camera-per-day counter. Budgets: free/mini 20 pts · ltd 70 pts ·
-- unlimited ∞ (NULL). Legacy 'roll' (the old ₱30 tier) aliases to MINI economics
-- (owner rec 2026-07-17: roll->Mini, matches what ₱30 roll buyers actually paid).
--
-- ADDITIVE + IDEMPOTENT. No drops of data columns. Enforcement code + the points
-- RPCs land in 20270821110100 (PR-1) and app wiring in PR-3.
--
-- ⚠ PRE-APPLY VERIFY ON PROD (build brief · cannot be checked from the corpus):
--   • \d+ public.paparazzi_seats — confirm the tier CHECK constraint is named
--     paparazzi_seats_tier_check before the DROP/ADD below (auto-named inline
--     constraint; the DROP IF EXISTS no-ops silently if the real name differs,
--     which would then REJECT 'mini'/'ltd' inserts — verify it actually swapped).
--   • SELECT max(version) FROM supabase_migrations.schema_migrations — confirm
--     this 20270821 prefix sorts AFTER the latest applied (20270820100000).
-- ============================================================================

BEGIN;

-- ---- 1. widen the per-camera tier vocabulary ------------------------------
-- Keep 'free'/'roll'/'unlimited' (existing prod rows + guest-list Limited path);
-- ADD 'mini' and 'ltd'. The buy flow writes these explicitly (PR-8).

ALTER TABLE public.paparazzi_seats
  DROP CONSTRAINT IF EXISTS paparazzi_seats_tier_check;
ALTER TABLE public.paparazzi_seats
  ADD CONSTRAINT paparazzi_seats_tier_check
  CHECK (tier IN ('free', 'roll', 'unlimited', 'mini', 'ltd'));

COMMENT ON COLUMN public.paparazzi_seats.tier IS
  'Per-camera tier (Papic v3 · owner 2026-07-17). Values: free (3 free seats/'
  'event · 20 pts) | mini (₱30 · 20 pts) | ltd (₱50 · 70 pts) | unlimited '
  '(₱100 · ∞) | roll (LEGACY ₱30 · aliases to Mini economics · kept for prod '
  'rows + guest-list Limited path per never-rename-technical-ids). Budgets + '
  'caps live in papic_tier_config, never hardcoded.';

-- ---- 2. rate SKUs FIRST (papic_tier_config.rate_service_code FK) -----------
-- PAPIC_CAMERA_ROLL_DAY (₱30) + _UNLIMITED_DAY (₱100) already exist. ADD Mini
-- (₱30) + Ltd (₱50). Prices stay admin-managed in the catalog.

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able)
VALUES
  ('PAPIC_CAMERA_MINI_DAY', 'Papic Mini (per camera, per day)', 30.00, 0.00, FALSE),
  ('PAPIC_CAMERA_LTD_DAY',  'Papic Ltd (per camera, per day)',  50.00, 0.00, FALSE)
ON CONFLICT (service_code) DO UPDATE SET
  title                  = EXCLUDED.title,
  retail_price_php       = EXCLUDED.retail_price_php,
  saas_overhead_cost_php = EXCLUDED.saas_overhead_cost_php,
  is_token_able          = EXCLUDED.is_token_able;

-- ---- 3. papic_tier_config — admin-editable single source of truth ----------
-- Pattern H (static reference): RLS ENABLE in the SAME migration, public SELECT,
-- NO write policy (admin/service-role only), mirroring platform_retail_catalog_v2.

CREATE TABLE IF NOT EXISTS public.papic_tier_config (
  tier_code          TEXT PRIMARY KEY
                       CHECK (tier_code IN ('free','mini','roll','ltd','unlimited')),
  display_title      TEXT NOT NULL,
  points_per_day     INTEGER CHECK (points_per_day IS NULL OR points_per_day >= 0), -- NULL = unlimited
  rate_service_code  TEXT REFERENCES public.platform_retail_catalog_v2(service_code),
  seats_per_event    INTEGER,          -- free-of-charge seats provisioned per event (free tier)
  wedding_day_cap_php INTEGER,         -- per-event WEDDING-only order-total cap default; NULL = no cap
  sort_order         INTEGER NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.papic_tier_config IS
  'Papic v3 tier definitions (owner 2026-07-17). Admin-editable single source '
  'for each tier''s daily POINT budget (points_per_day; NULL=unlimited), rate '
  'SKU, free seats, and the WEDDING-only per-event day-cap default. Read by the '
  'points RPCs + the buy/enforcement path — never hardcode. wedding_day_cap_php '
  'is the tier DEFAULT; events.papic_*_cap_php (PR-2) is the per-event override.';

ALTER TABLE public.papic_tier_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS papic_tier_config_public_read ON public.papic_tier_config;
CREATE POLICY papic_tier_config_public_read ON public.papic_tier_config
  FOR SELECT USING (TRUE);
-- No INSERT/UPDATE/DELETE policy: writes are service-role/admin only.

-- Seed (owner-locked 2026-07-17). roll = legacy alias to Mini economics.
INSERT INTO public.papic_tier_config
  (tier_code, display_title, points_per_day, rate_service_code, seats_per_event, wedding_day_cap_php, sort_order)
VALUES
  ('free',      'Free',       20,   NULL,                        3, NULL,  0),
  ('mini',      'Papic Mini', 20,   'PAPIC_CAMERA_MINI_DAY',     0, 6000,  1),
  ('roll',      'Papic Mini (legacy roll)', 20, 'PAPIC_CAMERA_ROLL_DAY', 0, 6000, 1),
  ('ltd',       'Papic Ltd',  70,   'PAPIC_CAMERA_LTD_DAY',      0, 10000, 2),
  ('unlimited', 'Papic Unli', NULL, 'PAPIC_CAMERA_UNLIMITED_DAY',0, 15000, 3)
ON CONFLICT (tier_code) DO UPDATE SET
  display_title       = EXCLUDED.display_title,
  points_per_day      = EXCLUDED.points_per_day,
  rate_service_code   = EXCLUDED.rate_service_code,
  seats_per_event     = EXCLUDED.seats_per_event,
  wedding_day_cap_php = EXCLUDED.wedding_day_cap_php,
  sort_order          = EXCLUDED.sort_order,
  updated_at          = NOW();

-- ---- 4. capture-points counter on the usage ledger ------------------------
-- Collapse the two per-kind counters into ONE points counter. Keep photos_used/
-- videos_used (deprecated, retained for lineage — do NOT drop). Backfill once.

ALTER TABLE public.papic_seat_day_usage
  ADD COLUMN IF NOT EXISTS points_used INTEGER NOT NULL DEFAULT 0
    CHECK (points_used >= 0);

UPDATE public.papic_seat_day_usage
   SET points_used = photos_used + videos_used * 3
 WHERE points_used = 0
   AND (photos_used > 0 OR videos_used > 0);

COMMENT ON COLUMN public.papic_seat_day_usage.points_used IS
  'Capture-POINTS spent by this camera today (Papic v3 · owner 2026-07-17). '
  '1 photo = 1 pt · 1 five-second clip = 3 pts. The points RPCs (20270821110100) '
  'atomically bump this; capture STOPS when points_used reaches the tier budget '
  '(papic_tier_config.points_per_day). photos_used/videos_used kept for lineage.';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase SQL editor):
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conname = 'paparazzi_seats_tier_check';          -- must list mini,ltd
--   SELECT tier_code, points_per_day, wedding_day_cap_php FROM public.papic_tier_config
--     ORDER BY sort_order;                                    -- 5 rows
--   SELECT service_code, retail_price_php FROM public.platform_retail_catalog_v2
--     WHERE service_code IN ('PAPIC_CAMERA_MINI_DAY','PAPIC_CAMERA_LTD_DAY');  -- 30, 50
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='papic_seat_day_usage' AND column_name='points_used';   -- 1 row
-- ============================================================================
