-- ============================================================================
-- 20260727000000_drive_oauth_consolidation.sql
--
-- Phase 0 of the Drive-copy build plan (Storage_and_Drive_Copy_Architecture_2026-06-03.md).
-- Collapses the two per-event Google Drive connections into ONE.
--
-- Before: an event could hold two oauth_grants rows —
--   provider='drive'                (Papic connect · /api/oauth/drive/*)
--   provider='drive_photo_delivery' (Photo Delivery connect)
-- Each was its own Google consent + redirect URI + folder. The Phase-1
-- drive-copy layer reads provider='drive', so a couple who connected only via
-- Photo Delivery was invisible to it.
--
-- After: ONE grant per event, provider='drive'. The code in this PR routes the
-- Photo Delivery connect through the canonical Drive consent + callback and
-- makes the release worker + disconnect read provider='drive'. This migration
-- is the DATA backfill for any pre-existing 'drive_photo_delivery' rows — a
-- safety net (Photo Delivery OAuth was gated on the pending Google verified-app
-- review, so in practice ~zero real grants exist yet). No schema change; the
-- code does not depend on this migration having run.
--
-- Conflict rule: if an event already has a 'drive' grant, the redundant
-- 'drive_photo_delivery' row is dropped (the 'drive' grant wins); otherwise the
-- 'drive_photo_delivery' row is renamed to 'drive'. Idempotent.
--
-- The provider CHECK on oauth_grants / oauth_state is left permissive (it still
-- allows 'drive_photo_delivery') — oauth_state continues to use that value as a
-- transient return-page marker in the consolidated start route.
-- ============================================================================

BEGIN;

-- 1. Rename photo-delivery grants to the canonical provider where the event has
--    no existing 'drive' grant (avoids the UNIQUE(event_id, provider) clash).
UPDATE public.oauth_grants g
   SET provider = 'drive'
 WHERE g.provider = 'drive_photo_delivery'
   AND NOT EXISTS (
     SELECT 1 FROM public.oauth_grants d
      WHERE d.event_id = g.event_id AND d.provider = 'drive'
   );

-- 2. Any 'drive_photo_delivery' rows that remain are redundant (the event
--    already had a 'drive' grant) — drop them.
DELETE FROM public.oauth_grants WHERE provider = 'drive_photo_delivery';

-- 3. Clean up stale single-use CSRF state nonces for old in-flight consents.
DELETE FROM public.oauth_state WHERE provider = 'drive_photo_delivery';

COMMIT;
