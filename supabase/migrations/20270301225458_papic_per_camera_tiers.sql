-- ============================================================================
-- 20270301000000_papic_per_camera_tiers.sql
--
-- Papic per-CAMERA pricing model (owner-locked 2026-06-26 ·
-- 0012_papic/Papic_v2_Pricing_and_Funnel_Strategy_2026-06-26.md).
--
-- A "camera" IS a paparazzi seat. This migration extends the existing
-- paparazzi_seats table (the canonical per-shooter slot, already shipped in
-- 20260520015000) with a per-camera TIER + validity window + paid-order link,
-- adds a per-camera per-day usage tracker for Free/Roll quota enforcement at
-- presign time, adds an admin-adjustable per-event cost cap, and seeds the two
-- per-camera rate SKUs into the live v2 catalog.
--
-- Model (per camera, per day):
--   • free       — first 5 cameras · 5 photos + 1 video / day
--   • roll       — PAPIC_CAMERA_ROLL_DAY · ₱30/day · 30 photos + 10 videos / day
--   • unlimited  — PAPIC_CAMERA_UNLIMITED_DAY · ₱100/day · no cap
--   • 5-camera minimum paid order · event cost cap default ₱6,999
--
-- ADDITIVE + IDEMPOTENT. Does NOT touch the retired seat-pack SKUs
-- (paparazzi_3_seats / paparazzi_5_seats in the dead service_catalog) or the
-- v2 PAPIC_SEATS flat SKU — those are deactivated in a later PR once the
-- per-camera buy flow is proven live. No drops, no destructive ALTERs.
-- Prices stay admin-managed in platform_retail_catalog_v2 (never hardcoded).
-- ============================================================================

BEGIN;

-- ---- 1. paparazzi_seats: a camera is a seat WITH a tier + window -----------

ALTER TABLE public.paparazzi_seats
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'roll', 'unlimited')),
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS paid_order_id UUID
    REFERENCES public.orders(order_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.paparazzi_seats.tier IS
  'Per-camera pricing tier (per-camera model 2026-06-26): free (first 5 · 5 '
  'photos + 1 video/day) | roll (₱30/camera/day · 30 photos + 10 videos/day) | '
  'unlimited (₱100/camera/day · no cap). The buy flow sets this explicitly; '
  'free is the default for the funnel taste. Legacy PAPIC_SEATS-provisioned '
  'rows predate this column and default to free pending seat-pack retirement.';

COMMENT ON COLUMN public.paparazzi_seats.paid_order_id IS
  'The orders row whose payment provisioned this camera at a paid tier '
  '(NULL for free funnel cameras). One paid order may provision many cameras.';

-- ---- 2. per-camera per-day usage (Free/Roll quota source of truth) ---------
-- Written server-side by the presign/upload path; read by the couple dashboard
-- + the camera holder. The 5-sec clip cap and tier quotas are enforced here.

CREATE TABLE IF NOT EXISTS public.papic_seat_day_usage (
  id           BIGSERIAL PRIMARY KEY,
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  seat_id      UUID NOT NULL REFERENCES public.paparazzi_seats(seat_id) ON DELETE CASCADE,
  usage_date   DATE NOT NULL,
  photos_used  INTEGER NOT NULL DEFAULT 0 CHECK (photos_used >= 0),
  videos_used  INTEGER NOT NULL DEFAULT 0 CHECK (videos_used >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seat_id, usage_date)
);

CREATE INDEX IF NOT EXISTS papic_seat_day_usage_event_idx
  ON public.papic_seat_day_usage(event_id);
CREATE INDEX IF NOT EXISTS papic_seat_day_usage_seat_idx
  ON public.papic_seat_day_usage(seat_id);

COMMENT ON TABLE public.papic_seat_day_usage IS
  'Per-camera (seat) per-day capture counts. One row per (seat, day). The '
  'presign path upserts + increments before issuing an upload URL, enforcing '
  'Free (5 photos + 1 video) and Roll (30 + 10) daily quotas; Unlimited skips '
  'the quota check. Per-camera model 2026-06-26.';

-- ---- 3. admin-adjustable per-event cost cap (default ₱6,999) ---------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_cost_cap_php NUMERIC(10, 2) NOT NULL
    DEFAULT 6999.00 CHECK (papic_cost_cap_php >= 0);

COMMENT ON COLUMN public.events.papic_cost_cap_php IS
  'Soft ceiling on the combined Papic per-camera bill for this event '
  '(default ₱6,999). The buy flow caps the order total here; admin-adjustable.';

-- ---- 4. RLS on the new usage table (mirrors papic_photos) ------------------

ALTER TABLE public.papic_seat_day_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS papic_seat_day_usage_couple_full ON public.papic_seat_day_usage;
CREATE POLICY papic_seat_day_usage_couple_full ON public.papic_seat_day_usage
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = papic_seat_day_usage.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = papic_seat_day_usage.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'
    )
  );

DROP POLICY IF EXISTS papic_seat_day_usage_claimer_read ON public.papic_seat_day_usage;
CREATE POLICY papic_seat_day_usage_claimer_read ON public.papic_seat_day_usage
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.paparazzi_seats ps
      WHERE ps.seat_id = papic_seat_day_usage.seat_id
        AND ps.claimer_user_id = auth.uid()
    )
  );

-- ---- 5. per-camera rate SKUs (live v2 catalog · admin-managed prices) ------

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able)
VALUES
  ('PAPIC_CAMERA_ROLL_DAY',
   'Papic Camera — Roll (per camera, per day)',
   30.00, 0.00, FALSE),
  ('PAPIC_CAMERA_UNLIMITED_DAY',
   'Papic Camera — Unlimited (per camera, per day)',
   100.00, 0.00, FALSE)
ON CONFLICT (service_code) DO UPDATE SET
  title                  = EXCLUDED.title,
  retail_price_php       = EXCLUDED.retail_price_php,
  saas_overhead_cost_php = EXCLUDED.saas_overhead_cost_php,
  is_token_able          = EXCLUDED.is_token_able;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase SQL editor):
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='paparazzi_seats' AND column_name IN
--       ('tier','valid_from','valid_until','paid_order_id');   -- 4 rows
--   SELECT * FROM public.platform_retail_catalog_v2
--     WHERE service_code LIKE 'PAPIC_CAMERA_%';                -- 2 rows, 30/100
--   SELECT rowsecurity FROM pg_tables
--     WHERE tablename='papic_seat_day_usage';                  -- true
-- ============================================================================
