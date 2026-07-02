-- ============================================================================
-- 20270501704713_setnayan_ai_per_event_pricing.sql
--
-- Setnayan AI → PER-EVENT ₱499-intro / ₱799-renewal pricing (schema foundation,
-- fully INERT).
--
-- Owner-locked 2026-07-02 (corpus DECISION_LOG 2026-07-02 · Pricing.md §00.A):
-- Setnayan AI is priced PER EVENT — every event's FIRST 28-day cycle is the
-- ₱499 intro (a default; admin comps/grants still override), and every 28-day
-- cycle after is ₱799. The live model is already per-event (events.setnayan_ai_
-- active, flipped by a paid SETNAYAN_AI order); this migration adds the pieces a
-- LATER flag-gated PR needs to turn that permanent unlock into a 28-day window
-- with a renewal price. It changes NOTHING about live behaviour.
--
-- WHAT THIS MIGRATION ADDS (all additive · idempotent · dormant):
--   1. events.setnayan_ai_active_until — per-event subscription window (nullable;
--      lazily expired at read time, cron-free, mirroring user_ai_subscription).
--   2. events.setnayan_ai_intro_used — has this event consumed its ₱499 first
--      cycle? Drives intro-vs-renewal pricing (lib/setnayan-ai-pricing.ts).
--      Back-filled TRUE for events that already own AI (they've had a first
--      cycle → their next purchase is a ₱799 renewal, not a second ₱499 intro).
--   3. SETNAYAN_AI_RENEW — the ₱799 renewal catalog row, seeded is_active=FALSE
--      (dormant; the owner flips it live from /admin/pricing at go-live).
--      Admin-managed price, never hardcoded (the pricing helper reads it).
--   4. platform_settings.setnayan_ai_per_event_pricing_enabled — the tri-state
--      enabling flag (default NULL=OFF), mirroring setnayan_ai_per_user_enabled.
--
-- Buy-flow wiring, the intro/renewal charge, the window-lapse re-offer, the
-- public "₱499 first 28 days, then ₱799" copy, and flipping the flag land in
-- later PRs (where the ₱799 step-up is gated on the Wave-1 guard being live).
-- No drops, no destructive ALTERs. RLS on events / platform_retail_catalog_v2 /
-- platform_settings is untouched (new columns inherit each table's policies).
-- ============================================================================

BEGIN;

-- ---- 1. per-event AI subscription window (nullable · lazy expiry, no cron) ---
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS setnayan_ai_active_until TIMESTAMPTZ;

COMMENT ON COLUMN public.events.setnayan_ai_active_until IS
  'Per-EVENT Setnayan AI subscription expiry (owner 2026-07-02). AI is on for '
  'the event while NOW() < setnayan_ai_active_until; lazily checked at read time '
  '(cron-free), mirroring user_ai_subscription.active_until. NULL today for '
  'every event (the live model is the permanent setnayan_ai_active boolean); the '
  'window is stamped by a later flag-gated activation PR. Extended per 28-day '
  'cycle (see lib/setnayan-ai-pricing.ts AI_EVENT_CYCLE_DAYS).';

-- ---- 2. has this event used its ₱499 first-cycle intro? ---------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS setnayan_ai_intro_used BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.setnayan_ai_intro_used IS
  'TRUE once an event has consumed its ₱499 first-cycle intro. Drives '
  'intro-vs-renewal pricing (lib/setnayan-ai-pricing.ts resolveSetnayanAiOrder'
  'PricePhp): the first paid AI cycle for an event charges the ₱499 intro, every '
  'cycle after charges the ₱799 renewal. Server-authoritative (never trusted '
  'from the client). Inert until setnayan_ai_per_event_pricing_enabled is on.';

-- Back-fill: any event that already owns AI has already had a first cycle, so its
-- next purchase must be a ₱799 renewal, not a second ₱499 intro. Idempotent
-- (only touches rows not yet set). Safe + dormant — nothing reads this column
-- until the flag flips.
UPDATE public.events
   SET setnayan_ai_intro_used = true
 WHERE setnayan_ai_active = true
   AND setnayan_ai_intro_used = false;

-- ---- 3. the ₱799 renewal catalog SKU (dormant · admin-managed price) --------
-- Seeded is_active=FALSE so it never surfaces on any pricing/buy surface until
-- go-live. The owner flips is_active=true from /admin/pricing (admin-managed,
-- never hardcoded); the pricing helper reads this row for the renewal price.
-- Mirrors the SETNAYAN_AI_SUB seed pattern; ON CONFLICT never touches is_active
-- so a later owner activation is not reset by a re-apply.
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php,
   is_token_able, description, is_pax_priced, is_active, billing_period)
VALUES
  ('SETNAYAN_AI_RENEW', 'Setnayan AI (renewal)', 799, 0,
   false,
   'Setnayan AI — the ₱799 per-28-day renewal, charged after an event''s first 28-day cycle (the ₱499 intro). Same always-on assistant: finds and ranks vendors, watches your budget, deadlines and contracts, and flags risks.',
   false, false, 'per_28d')
ON CONFLICT (service_code) DO UPDATE
  SET retail_price_php = excluded.retail_price_php,
      title           = excluded.title,
      description      = excluded.description,
      billing_period  = excluded.billing_period,
      updated_at       = now();

-- ---- 4. the per-event pricing feature flag (tri-state, default OFF) ---------
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS setnayan_ai_per_event_pricing_enabled BOOLEAN;

COMMENT ON COLUMN public.platform_settings.setnayan_ai_per_event_pricing_enabled IS
  'Per-EVENT Setnayan AI intro/renewal pricing toggle (owner 2026-07-02). '
  'Tri-state mirroring setnayan_ai_per_user_enabled: NULL = OFF (today''s '
  'behaviour — the ₱499 flat per-event unlock) / TRUE = the ₱499-first-28-days '
  'then ₱799 per-28-day-cycle model is live / FALSE = off. Non-secret feature '
  'flag. Flip from /admin/integrations once the buy-flow wiring + public copy '
  'ship AND the Wave-1 market-intelligence guard is live (so ₱799 is earned). '
  'Default NULL.';

COMMIT;
