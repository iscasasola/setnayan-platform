-- ============================================================================
-- 20270331400000_vendor_verification_visibility.sql
--
-- PR-B · Gate public vendor visibility on verification_state.
--
-- Two changes, both idempotent and safe to re-run:
--
-- (a) RECONCILE verification_state for any paid/founder vendor whose
--     tier_state is non-free but whose verification_state was never set to
--     'verified'. The founder-override migration set the founder's
--     tier_state='verified' WITHOUT flipping verification_state, so without
--     this reconcile the new ALWAYS-ON verification gate (added in app code in
--     this PR) would HIDE the lone real founder vendor + any paid vendor from
--     Explore / marketplace / their public website. This UPDATE guarantees the
--     gate can never empty the live marketplace: every non-free vendor is
--     marked verified.
--
-- (b) Append `verification_state` to the public.vendor_market_stats VIEW so the
--     marketplace read-path (Explore, /vendors, recommendations, OG, sitemap)
--     can filter `verification_state = 'verified'`. The view body is COPIED
--     VERBATIM from the latest definition in
--     20261005000000_vendor_market_stats_tier_state.sql (which appended
--     vp.tier_state as the trailing column). The ONLY change is
--     `vp.verification_state` appended as the new last column. Postgres
--     CREATE OR REPLACE VIEW disallows inserting columns mid-list, so the new
--     column goes strictly at the END of the SELECT list. Every downstream
--     consumer reads by column name (not index), so appending is safe and no
--     existing column is dropped or renamed.
--
-- `verification_state` is a public.vendor_verification_state enum column on
-- vendor_profiles with FIVE values
-- ('unverified' | 'pending_review' | 'verified' | 'demoted' | 'rejected',
-- NOT NULL DEFAULT 'unverified'). The app gate is allow-listed to the single
-- 'verified' value, so every other state (pending_review / demoted / rejected
-- included) is hidden from the public marketplace.
-- ============================================================================

BEGIN;

-- (a) Reconcile: any non-free vendor (founder + every paid tier) is verified.
UPDATE public.vendor_profiles
SET verification_state = 'verified'
WHERE tier_state <> 'free'
  AND verification_state <> 'verified';

-- (b) Append verification_state to the marketplace read-path view.
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
  -- 2026-09-29 · Phase C tier gate · tier_state appended at position 26.
  -- Drives the FLAG-DARK FREE-exclusion search filter in /vendors/page.tsx
  -- (gated on VENDOR_TIER_SEARCH_GATE, default OFF).
  vp.tier_state,
  -- 2027-03-31 · PR-B · verification_state appended at position 27 (truly
  -- last). Drives the ALWAYS-ON public-visibility gate, which is allow-listed
  -- to the single 'verified' value: every other state of the five-value
  -- vendor_verification_state enum (unverified | pending_review | verified |
  -- demoted | rejected) is hidden from Explore / marketplace / OG / sitemap /
  -- recommendations.
  vp.verification_state
FROM public.vendor_profiles vp
LEFT JOIN public.vendor_review_stats vrs USING (vendor_profile_id)
LEFT JOIN public.vendor_active_ads   vaa USING (vendor_profile_id);

GRANT SELECT ON public.vendor_market_stats TO anon, authenticated, service_role;

COMMENT ON VIEW public.vendor_market_stats IS
  'Marketplace read-path consolidation: vendor_profiles + vendor_review_stats '
  '+ vendor_active_ads with precomputed ad_rank for SQL-side sort. Adds '
  'hq_region 2026-05-24 for wizard Card 02 Region → City cascade + tier_state '
  '2026-09-29 for the Phase C flag-dark searchability gate + verification_state '
  '2027-03-31 for the always-on public-visibility verification gate. Used by '
  '/vendors + Explore + Concierge wizard vendor-pick cards.';

COMMIT;
