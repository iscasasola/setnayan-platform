-- ============================================================================
-- Iteration 0017 — Patiktok · RETIREMENT (drop product tables + SKUs;
-- KEEP the owned-AI music catalogue, rehomed off the Patiktok name)
-- ============================================================================
-- Created via `pnpm migration:new` (prefix auto-allocated to sort last + avoid
-- the round-prefix collision the pre-push guard rejects). IDEMPOTENT — every
-- statement is DROP ... IF EXISTS / ALTER ... IF EXISTS / a delete predicate.
--
-- Owner directive 2026-06-29: "remove patiktok ... just remove them entirely."
-- Patiktok the PRODUCT (the TikTok-format booth + vertical-reel pipeline) is CUT
-- from V1. This migration drops the 5 genuinely Patiktok-only tables and clears
-- the Patiktok catalog rows. The matching app code (routes, studio surface, lib
-- engine wiring, catalogs) is removed in the same PR.
--
-- EXCEPTION — the owned-AI music catalogue is KEPT, not dropped. The 6th table,
-- `patiktok_music_tracks`, is the Setnayan-owned AI music catalogue that the
-- KEPT Guest Stories feature reads (lib/guest-stories.ts pickMusic) to back the
-- free personal reels. Dropping it would silently break a kept feature (Stories
-- would render music-less). The owner wants the Patiktok product gone, NOT the
-- music catalogue. So this migration RENAMEs that table to a neutral
-- `reel_music_tracks` (mirrors lib/patiktok-render.ts → lib/reel-render.ts).
-- RENAME preserves its 30 seed rows + RLS + indexes + grants + the beat_grid
-- column — no re-seed, no data loss. The reader is repointed in the same PR.
--
-- FK-SAFETY AUDIT (run against prod 2026-06-29 before writing this):
--   • Row counts:
--       patiktok_oauth_state       0   (dropped)
--       patiktok_oauth_grants      0   (dropped)
--       patiktok_source_clips      0   (dropped)
--       patiktok_render_jobs       0   (dropped)
--       patiktok_render_job_clips  0   (dropped)
--       patiktok_music_tracks      30  (RENAMED to reel_music_tracks — kept)
--   • Inbound FK references — ALL Patiktok-internal:
--       patiktok_render_jobs.music_track_slug  -> patiktok_music_tracks
--       patiktok_render_job_clips.job_id       -> patiktok_render_jobs
--       patiktok_render_job_clips.clip_id      -> patiktok_source_clips
--     The ONLY inbound FK on the music table came from patiktok_render_jobs,
--     which is dropped in step 5 BEFORE the rename in step 6 — so by the time we
--     rename, NO inbound FK remains. Safe.
--   • No Patiktok-only functions, no Patiktok enum values, no other Patiktok
--     tables/views structurally depend on these. (The vendor_market_stats view
--     mentions the literal string 'setnayan_patiktok' only inside an
--     is_setnayan_service array-membership check on vendor_profiles.services —
--     it does NOT reference any patiktok table, so it is untouched here.)
--
-- ORDER — FK-safe, children first (each DROP also removes that table's RLS
-- policies + indexes + outbound FK constraints automatically):
--   1. patiktok_render_job_clips  (references render_jobs + source_clips) — DROP
--   2. patiktok_oauth_state       (standalone)                            — DROP
--   3. patiktok_oauth_grants      (standalone)                            — DROP
--   4. patiktok_source_clips      (now unreferenced)                      — DROP
--   5. patiktok_render_jobs       (now unreferenced; held the only FK into
--                                  the music table)                       — DROP
--   6. patiktok_music_tracks      (now FK-free)              — RENAME → reel_music_tracks
-- ============================================================================

-- 1) Junction first (depends on render_jobs + source_clips).
DROP TABLE IF EXISTS public.patiktok_render_job_clips;

-- 2-3) OAuth tables (standalone).
DROP TABLE IF EXISTS public.patiktok_oauth_state;
DROP TABLE IF EXISTS public.patiktok_oauth_grants;

-- 4) Source clips (now unreferenced).
DROP TABLE IF EXISTS public.patiktok_source_clips;

-- 5) Render jobs (now unreferenced; this dropped the only inbound FK on the
--    music table, so the rename below is FK-free).
DROP TABLE IF EXISTS public.patiktok_render_jobs;

-- 6) Music catalogue — KEEP, rehomed off the Patiktok name. RENAME preserves
--    the 30 seed rows + beat_grid column + RLS + indexes + grants (Postgres
--    carries policies/indexes/constraints through a table rename). Guarded so
--    re-apply is a no-op once renamed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'patiktok_music_tracks'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'reel_music_tracks'
  ) THEN
    ALTER TABLE public.patiktok_music_tracks RENAME TO reel_music_tracks;
  END IF;
END $$;

COMMENT ON TABLE public.reel_music_tracks IS
  'Setnayan-owned AI music catalogue (formerly patiktok_music_tracks; rehomed 2026-06-29 when the Patiktok product was retired). Read by Guest Stories (lib/guest-stories.ts pickMusic) to back free personal reels. ~400-track target across 6 categories; the seed holds 30 representative rows. beat_grid JSONB powers beat-aware cut snapping.';

-- Cosmetic: rename the two RLS policies whose generic names are fine but live on
-- the renamed table — recreate them under the same names on the new table so the
-- read/write guards are unambiguous and grep-clean. (Policies carried through the
-- rename automatically; these DROP/CREATE are idempotent and behavior-identical.)
DROP POLICY IF EXISTS anyone_reads_active_tracks ON public.reel_music_tracks;
CREATE POLICY anyone_reads_active_tracks ON public.reel_music_tracks
  FOR SELECT TO authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS admin_writes_tracks ON public.reel_music_tracks;
CREATE POLICY admin_writes_tracks ON public.reel_music_tracks
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- Catalog rows — remove every Patiktok SKU from service_catalog.
-- ----------------------------------------------------------------------------
-- All 6 patiktok* rows are already is_active=false (deactivated 2026-06-29 via
-- console before this PR). Hard-delete them now that the product is fully cut.
-- LIKE 'patiktok%' covers: patiktok_setnayan_daily, patiktok_personal_daily,
-- patiktok_video_overage, patiktok_setnayan_tiktok, patiktok_personal_tiktok,
-- patiktok_booth_5hr. No order rows reference these (transactional tables were
-- empty; orders has no patiktok purchases; vendor_tool_bundles +
-- vendor_ad_subscriptions — the only FKs to service_catalog.sku_code — hold
-- zero patiktok rows).
DELETE FROM public.service_catalog
  WHERE sku_code LIKE 'patiktok%';

-- ----------------------------------------------------------------------------
-- Bundle fan-out — re-declare bundles_granting_sku() WITHOUT the MEDIA_PACK
-- PATIKTOK_COMPILER child, so the DB function mirrors BUNDLE_CHILD_SKUS in
-- apps/web/lib/entitlements.ts (PATIKTOK_COMPILER removed there in this PR).
-- Keeps `lint:entitlement-gates` Guard 2 in sync. Verbatim from the latest
-- definer (20270316029217_remove_sde.sql) MINUS the single MEDIA_PACK
-- PATIKTOK_COMPILER row — GUIDED_PACK + PAPIC_UNLOCK pairs are byte-identical.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bundles_granting_sku(p_child TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(m.bundle_key ORDER BY m.bundle_key), ARRAY[]::text[])
  FROM (
    VALUES
      -- GUIDED_PACK · Essentials (BUNDLE_CHILD_SKUS.GUIDED_PACK · 7)
      ('GUIDED_PACK', 'SETNAYAN_AI'),
      ('GUIDED_PACK', 'ANIMATED_MONOGRAM'),
      ('GUIDED_PACK', 'CUSTOM_QR_GUEST'),
      ('GUIDED_PACK', 'PRO_RSVP'),
      ('GUIDED_PACK', 'PAPIC_GUEST'),
      ('GUIDED_PACK', 'EVENT_WEBSITE'),
      ('GUIDED_PACK', 'PRO_WEBSITE'),
      -- MEDIA_PACK · Complete (BUNDLE_CHILD_SKUS.MEDIA_PACK · 16 · Patiktok removed)
      ('MEDIA_PACK', 'SETNAYAN_AI'),
      ('MEDIA_PACK', 'ANIMATED_MONOGRAM'),
      ('MEDIA_PACK', 'CUSTOM_QR_GUEST'),
      ('MEDIA_PACK', 'PRO_RSVP'),
      ('MEDIA_PACK', 'EVENT_WEBSITE'),
      ('MEDIA_PACK', 'PRO_WEBSITE'),
      ('MEDIA_PACK', 'PAPIC_GUEST'),
      ('MEDIA_PACK', 'PAPIC_ADDON_STORIES'),
      ('MEDIA_PACK', 'PAPIC_SEATS'),
      ('MEDIA_PACK', 'CAMERA_BRIDGE'),
      ('MEDIA_PACK', 'PABATI'),
      ('MEDIA_PACK', 'PAPIC_ADDON_THANK_YOU'),
      ('MEDIA_PACK', 'LIVE_WALL'),
      ('MEDIA_PACK', 'LIVE_BACKGROUND'),
      ('MEDIA_PACK', 'PANOOD_SYSTEM'),
      ('MEDIA_PACK', 'PAKANTA'),
      -- PAPIC_UNLOCK · "Unlock all of Papic" umbrella (BUNDLE_CHILD_SKUS.PAPIC_UNLOCK · 6)
      ('PAPIC_UNLOCK', 'KWENTO'),
      ('PAPIC_UNLOCK', 'LIVE_WALL'),
      ('PAPIC_UNLOCK', 'PAPIC_ADDON_THANK_YOU'),
      ('PAPIC_UNLOCK', 'PAPIC_ADDON_STORIES'),
      ('PAPIC_UNLOCK', 'PABATI'),
      ('PAPIC_UNLOCK', 'CAMERA_BRIDGE')
  ) AS m(bundle_key, child_key)
  WHERE m.child_key = p_child
$$;

COMMENT ON FUNCTION public.bundles_granting_sku(TEXT) IS
  'Bundle service_keys (GUIDED_PACK/MEDIA_PACK/PAPIC_UNLOCK) that grant the given child SKU. Mirrors BUNDLE_CHILD_SKUS in apps/web/lib/entitlements.ts — keep in sync. Patiktok removed from MEDIA_PACK 2026-06-29.';

GRANT EXECUTE ON FUNCTION public.bundles_granting_sku(TEXT) TO authenticated, anon;
