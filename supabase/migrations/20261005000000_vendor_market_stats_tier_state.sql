-- ============================================================================
-- 20261005000000_vendor_market_stats_tier_state.sql
-- (renamed off 20260929000000 → 20260930000000 → 20261005000000: each earlier
--  prefix collided with an already-merged migration — 20260929000000 with
--  budget_builds_rls_couple_only, 20260930000000 with admin_approval_requests.
--  Bumped to a unique later timestamp clear of in-flight parallel sessions.)
--
-- Phase C searchability gate (vendor-tier-caps · FLAG-DARK). Appends
-- `tier_state` to the `vendor_market_stats` view so the marketplace query in
-- apps/web/app/vendors/page.tsx can apply a FREE-exclusion filter
-- (`.neq('tier_state','free')`) when the `VENDOR_TIER_SEARCH_GATE` env flag is
-- ON. The flag defaults OFF, so without this migration applied the query is
-- unchanged and prod behavior is identical; this migration only makes the
-- column available for when the owner flips the gate on (once paid tiers exist
-- in prod — today the lone real founder vendor + all demo vendors are
-- tier_state='free', so an active gate would empty the marketplace).
--
-- `tier_state` is a NOT NULL DEFAULT 'free' enum column on vendor_profiles
-- (public.vendor_tier_state · free | verified | pro | enterprise), added in
-- migration 20260714000000_v2_screen_name_reveal_mechanic.sql.
--
-- The view body below is COPIED VERBATIM from the current definition in
-- 20260620000000_iteration_0006_vendor_profiles_hq_region.sql (the most recent
-- migration that defines vendor_market_stats — it appended vp.hq_region at the
-- tail). The ONLY change is `vp.tier_state` appended as the new last column.
-- Postgres CREATE OR REPLACE VIEW disallows inserting columns mid-list, so the
-- new column goes strictly at the END of the SELECT list. Every downstream
-- consumer reads by column name (not index), so appending is safe. The view
-- keeps `security_invoker = true` and re-grants SELECT (CREATE OR REPLACE
-- preserves existing grants, but the explicit GRANT mirrors the source
-- migration's pattern).
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.vendor_market_stats
WITH (security_invoker = true) AS
SELECT
  vp.vendor_profile_id,
  vp.public_id,
  vp.business_name,
  vp.business_slug,
  vp.tagline,
  vp.logo_url,
  vp.services,
  vp.location_city,
  vp.hq_latitude,
  vp.hq_longitude,
  vp.contact_email,
  vp.public_visibility,
  vp.event_types,
  vp.compatible_ceremony_types,
  vp.compatible_venue_settings,
  vp.created_at,
  COALESCE(vrs.avg_rating_overall, 0)::NUMERIC(3,2) AS avg_rating_overall,
  COALESCE(vrs.total_count, 0)::INT                 AS review_count,
  CASE
    WHEN vaa.tier = 'sponsored' THEN 2
    WHEN vaa.tier = 'boosted'   THEN 1
    ELSE 0
  END::INT                                           AS ad_rank,
  vaa.tier        AS ad_tier,
  vaa.sku_code    AS ad_sku_code,
  vaa.radius_km   AS ad_radius_km,
  vaa.expires_at  AS ad_expires_at,
  -- 2026-05-22 PM Setnayan-first sort key (from migration
  -- 20260607020000_vendor_market_stats_setnayan_first.sql) · TRUE when
  -- the vendor carries any first-party Setnayan canonical_service.
  -- MUST be preserved at column position 24 because Postgres CREATE OR
  -- REPLACE VIEW rejects column-position changes ("cannot change name of
  -- view column 'is_setnayan_service' to ...").
  (vp.services && ARRAY[
    'setnayan_concierge',
    'setnayan_papic',
    'setnayan_panood',
    'setnayan_patiktok',
    'setnayan_pakanta',
    'setnayan_pailaw',
    'setnayan_custom_monogram',
    'setnayan_save_the_date_mp4',
    'setnayan_ai_edited_highlight',
    'setnayan_ai_video_highlight'
  ]::TEXT[]) AS is_setnayan_service,
  -- 2026-05-24 · hq_region appended at position 25. Postgres CREATE OR
  -- REPLACE VIEW disallows inserting new columns mid-list, so new columns
  -- MUST go at the END of the SELECT list. Every existing downstream
  -- consumer reads by column name not index, so appending is safe.
  vp.hq_region,
  -- 2026-09-29 · Phase C tier gate · tier_state appended at position 26
  -- (truly last). Drives the FLAG-DARK FREE-exclusion search filter in
  -- /vendors/page.tsx (gated on VENDOR_TIER_SEARCH_GATE, default OFF).
  vp.tier_state
FROM public.vendor_profiles vp
LEFT JOIN public.vendor_review_stats vrs USING (vendor_profile_id)
LEFT JOIN public.vendor_active_ads   vaa USING (vendor_profile_id);

GRANT SELECT ON public.vendor_market_stats TO anon, authenticated, service_role;

COMMENT ON VIEW public.vendor_market_stats IS
  'Marketplace read-path consolidation: vendor_profiles + vendor_review_stats '
  '+ vendor_active_ads with precomputed ad_rank for SQL-side sort. Adds '
  'hq_region 2026-05-24 for wizard Card 02 Region → City cascade + tier_state '
  '2026-09-29 for the Phase C flag-dark searchability gate. Used by /vendors '
  '+ Concierge wizard vendor-pick cards.';

COMMIT;
