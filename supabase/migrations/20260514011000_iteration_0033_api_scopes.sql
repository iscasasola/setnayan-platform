-- ============================================================================
-- 20260514010000_iteration_0033_api_scopes.sql
-- Iteration 0033 — Phase A + C surface (read-only public API).
--
-- Per the 0033 spec the V1 gateway shipped tokens with no scopes (all-access).
-- This delta begins phasing in resource-scoped tokens:
--
--   • api_keys.scopes  — TEXT[] of scope strings. Default is the existing
--     all-access behavior, but new tokens that want read-only access can
--     opt in to a narrower set. Recognized strings (V1.5 phase A + C):
--       - me.read       (always implicit; lets a token call /api/v1/me)
--       - events.read   (list/detail; gates the events Phase A endpoints)
--       - guests.read   (event guest list; gates the guests endpoint)
--       - vendors.read  (browse; gates the vendors Phase C endpoints —
--                        currently those endpoints are public, but the
--                        scope is reserved for the V1.5 booking flow)
--
--   • vendor_profiles  — public SELECT policy so anon can browse published
--     vendor profiles. Owner-only write is unchanged. Anyone (anon or auth)
--     can read rows where is_published = TRUE. The public API routes use
--     the admin client and apply the is_published filter themselves; this
--     policy keeps a direct supabase-js read path open for V1.5 marketplace
--     pages.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. api_keys.scopes
-- ----------------------------------------------------------------------------

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT ARRAY['me.read']::TEXT[];

-- Existing tokens predate the scope split. To preserve their all-access
-- behavior, backfill them with every currently-recognised scope. New tokens
-- get the safer 'me.read' default above and opt in to more via the dashboard.
UPDATE public.api_keys
   SET scopes = ARRAY['me.read', 'events.read', 'guests.read', 'vendors.read']::TEXT[]
 WHERE scopes = ARRAY['me.read']::TEXT[]
   AND created_at < NOW();

-- A GIN index keeps `scopes @> ARRAY['events.read']` lookups fast even if the
-- table grows past a few thousand rows.
CREATE INDEX IF NOT EXISTS api_keys_scopes_idx
  ON public.api_keys USING GIN (scopes);

-- ----------------------------------------------------------------------------
-- 2. vendor_profiles — public SELECT for published profiles
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS vendor_profiles_public_read ON public.vendor_profiles;
CREATE POLICY vendor_profiles_public_read
  ON public.vendor_profiles FOR SELECT
  TO anon, authenticated
  USING (is_published = TRUE);

COMMIT;
