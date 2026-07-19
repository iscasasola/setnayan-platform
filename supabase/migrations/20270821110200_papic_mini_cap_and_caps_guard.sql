-- ============================================================================
-- 20270821110200_papic_mini_cap_and_caps_guard.sql
--
-- Papic v3 — Mini per-event cap column + caps money-integrity guard
-- (owner 2026-07-17 · PR-2 of 12).
--
-- TWO pieces, both safe to land ahead of the billing code:
--   1. events.papic_mini_cap_php (default ₱6,000) — the Mini/legacy-roll tier's
--      per-event WEDDING cap. ADDITIVE + unused until the quote code reads it
--      (that lands with the roll->Mini remap in a later PR, so the migration and
--      the code that repurposes papic_ltd_cap_php stay atomic — this PR does NOT
--      backfill papic_ltd_cap_php, so existing roll billing is unchanged).
--   2. events_papic_caps_admin_only — a BEFORE UPDATE guard that blocks an
--      AUTHENTICATED NON-ADMIN from changing ANY papic_*_cap_php value. Today
--      couple_can_update_event grants couples an unrestricted row UPDATE, so a
--      couple could self-discount by lowering their own price cap. Safe by
--      construction: service-role writes (auth.uid() IS NULL) and admins
--      (is_admin()) pass — only an authenticated non-admin CHANGING a cap raises.
--      Normal couple edits (caps unchanged) never trip it (IS DISTINCT FROM).
--
-- ADDITIVE + IDEMPOTENT. No data backfill, no billing behavior change.
-- ============================================================================

BEGIN;

-- ---- 1. Mini per-event cap (additive; unused until the quote code reads it) --

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_mini_cap_php INTEGER NOT NULL DEFAULT 6000;

COMMENT ON COLUMN public.events.papic_mini_cap_php IS
  'Papic Mini (and legacy roll->Mini) per-event WEDDING price cap in PHP '
  '(owner 2026-07-17 · default 6000). Read by the per-camera quote for the '
  'Mini/roll tier; WEDDINGS ONLY (uncapped for other event types, enforced in '
  'app). papic_ltd_cap_php (Ltd) / papic_unli_cap_php (Unli) are the siblings. '
  'Admin-editable; protected by events_papic_caps_admin_only.';

-- ---- 2. money-integrity guard: caps are admin-only to change -----------------

CREATE OR REPLACE FUNCTION public.papic_caps_admin_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin()
     AND (
          NEW.papic_mini_cap_php IS DISTINCT FROM OLD.papic_mini_cap_php
       OR NEW.papic_ltd_cap_php  IS DISTINCT FROM OLD.papic_ltd_cap_php
       OR NEW.papic_unli_cap_php IS DISTINCT FROM OLD.papic_unli_cap_php
     )
  THEN
    RAISE EXCEPTION 'Papic price caps can only be changed by an admin (event %).',
      OLD.event_id
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.papic_caps_admin_only() IS
  'BEFORE UPDATE guard on events: blocks an authenticated non-admin from '
  'changing any papic_*_cap_php (self-discount prevention). Service-role '
  '(auth.uid() IS NULL) + admins pass; caps unchanged never trip it.';

DROP TRIGGER IF EXISTS events_papic_caps_admin_only ON public.events;
CREATE TRIGGER events_papic_caps_admin_only
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.papic_caps_admin_only();

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='events' AND column_name='papic_mini_cap_php';   -- 1 row
--   SELECT tgname FROM pg_trigger
--     WHERE tgrelid='public.events'::regclass
--       AND tgname='events_papic_caps_admin_only';                      -- 1 row
--   -- As a couple (authenticated non-admin): UPDATE events SET papic_ltd_cap_php=1
--   --   WHERE event_id='<own>';  -> ERROR 42501 (blocked)
--   -- Caps unchanged couple UPDATE (e.g. event name) -> succeeds.
-- ============================================================================
