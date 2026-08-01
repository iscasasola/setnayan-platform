-- ============================================================================
-- Retire the PER-USER Setnayan AI path. Setnayan AI is PER EVENT.
--
-- OWNER DECISION 2026-08-01, asked whether one purchase should ever unlock a
-- person's other events: "it is per event".
--
-- This drops the two objects that made the opposite model expressible:
--
--   1. `public.user_ai_subscription` — one window per USER. While
--      `active_until` was in the future, Setnayan AI was on for EVERY event that
--      user hosted or co-hosted (the read-side fan-out in
--      lib/setnayan-ai-server.ts · getEventHostAiSubscription).
--   2. `public.platform_settings.setnayan_ai_per_user_enabled` — the tri-state
--      flag that gated it.
--
-- ── WHY THIS IS SAFE TO DROP (verified against prod njrupjnvkjkitfctetvi on
--    2026-08-01, immediately before writing this migration) ──────────────────
--   • user_ai_subscription                         →  0 rows
--   • setnayan_ai_per_user_enabled                 →  NULL (never TRUE)
--   • orders WHERE service_key='SETNAYAN_AI_SUB'   →  0
--   • orders (ALL)                                 →  0  (prod is pre-launch)
--   • platform_retail_catalog_v2 'SETNAYAN_AI_SUB' →  0  (never purchasable)
--   • views/rules depending on the table           →  none (pg_depend)
--
-- So nothing is migrated, nothing is stranded mid-refund, and no entitlement
-- changes for any event. The application-side writers (the activation handler
-- and its refund reversal) are removed in the SAME change, so an order can
-- never activate without a matching rollback.
--
-- ⚠ DELIBERATELY NOT TOUCHED — the PER-EVENT path, which is the model being
--   kept: events.setnayan_ai_active, events.setnayan_ai_active_until,
--   events.setnayan_ai_tier_at_purchase, platform_settings
--   .setnayan_ai_paywall_enabled and .setnayan_ai_per_event_pricing_enabled
--   (both TRUE in prod). This migration must not change what any event is
--   charged or shown.
--
-- No new objects are created, so there is no grant to REVOKE here.
-- ============================================================================

DROP TABLE IF EXISTS public.user_ai_subscription;

ALTER TABLE public.platform_settings
  DROP COLUMN IF EXISTS setnayan_ai_per_user_enabled;

-- ── Post-conditions — RAISE if the end state is not true ────────────────────
DO $$
BEGIN
  IF to_regclass('public.user_ai_subscription') IS NOT NULL THEN
    RAISE EXCEPTION
      'post-condition failed: public.user_ai_subscription still exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'platform_settings'
       AND column_name  = 'setnayan_ai_per_user_enabled'
  ) THEN
    RAISE EXCEPTION
      'post-condition failed: platform_settings.setnayan_ai_per_user_enabled still exists';
  END IF;

  -- The per-EVENT path must have survived intact. If any of these went missing,
  -- this migration did more than it was allowed to.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events'
       AND column_name = 'setnayan_ai_active'
  ) THEN
    RAISE EXCEPTION 'post-condition failed: events.setnayan_ai_active was removed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events'
       AND column_name = 'setnayan_ai_active_until'
  ) THEN
    RAISE EXCEPTION 'post-condition failed: events.setnayan_ai_active_until was removed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'platform_settings'
       AND column_name = 'setnayan_ai_paywall_enabled'
  ) THEN
    RAISE EXCEPTION
      'post-condition failed: platform_settings.setnayan_ai_paywall_enabled was removed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'platform_settings'
       AND column_name = 'setnayan_ai_per_event_pricing_enabled'
  ) THEN
    RAISE EXCEPTION
      'post-condition failed: platform_settings.setnayan_ai_per_event_pricing_enabled was removed';
  END IF;
END $$;
