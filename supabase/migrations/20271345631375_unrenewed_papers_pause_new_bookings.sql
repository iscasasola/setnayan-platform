-- unrenewed_papers_pause_new_bookings
-- ============================================================================
-- AFTER 30 MARCH, AN UNRENEWED SHOP DROPS OUT OF SEARCH AND DISCOVER — AND
-- KEEPS EVERYTHING ELSE. Owner rulings 2026-11-14 ("THE RENEWAL DAY IS 30
-- MARCH" · DECISION_LOG 481b9b6b, which CORRECTS "refuse every new request"):
-- no new couples FIND the shop; it can still import clients by hand, keep
-- working with events that already inquired, and every existing booking stays.
-- (The file keeps its first name: a migration's name is its identity.)
--
-- ── WHY A STAMP AND NOT verification_state (measured, PR #7624) ──────────────
-- `vendor_profiles_public_read` and `vendor_services_public_read` show a shop
-- only while it is verified, and NO policy lets a couple read a shop it has
-- booked. Flipping the state would blank the couple's schedule, contracts,
-- package booking and pay page for a shop they already booked. So the state
-- stays, and this stamp decides only "is the shop in the lists":
--
--   1. vendor_profiles.papers_lapsed_at — WHEN the papers lapsed. Written only by
--      the daily badge pass (service role, lib/papers-lapse.server.ts) and
--      cleared only by an approval (lib/verification-decision.server.ts).
--      Guarded below: a shop cannot clear (or set) its own.
--   2. vendor_profiles.papers_current — generated `papers_lapsed_at IS NULL`, so
--      every couple-facing list drops a lapsed shop with the same `.match()`
--      gate it already applies (lib/findable-shop.ts FINDABLE_SHOP_GATE).
--   3. vendor_market_stats — the 20271320303985 body VERBATIM, papers_current
--      appended (the lists read it there too).
--   4. vendor_profiles_self re-projected (its projection is frozen at CREATE).
--
-- ⛔ NOT TOUCHED: the booking trigger. Whether an event that inquired before
-- the lapse can still be booked after it is UNCONFIRMED by the owner
-- (481b9b6b), so that path stays exactly as it is today. ADD-ONLY: two
-- columns, one guard trigger, one view re-created with a column appended.
-- ============================================================================

-- ── 1 · the stamp, and the boolean the lists read ──────────────────────────
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS papers_lapsed_at TIMESTAMPTZ;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS papers_current BOOLEAN GENERATED ALWAYS AS (papers_lapsed_at IS NULL) STORED;

COMMENT ON COLUMN public.vendor_profiles.papers_lapsed_at IS
  'When this shop''s papers lapsed: its renewal day (next_renewal_due_at, 30 March) passed with no renewed approval. While set, the shop leaves search, Discover and every couple-facing list (papers_current); it keeps its existing bookings, its hand-imported clients and the events that already inquired (owner 2026-11-14, DECISION_LOG 481b9b6b). verification_state is NOT changed and the booking trigger does not read it. Written only by the daily badge pass (service role); cleared by an approval. A shop cannot write it (guard_vendor_papers_lapsed_at).';

COMMENT ON COLUMN public.vendor_profiles.papers_current IS
  'Generated: papers_lapsed_at IS NULL. Read with is_findable by every couple-facing list (lib/findable-shop.ts FINDABLE_SHOP_GATE).';

-- The lists read papers_current through the security_invoker view, so every
-- role that reads the view needs it; the shop's own booking gate reads the stamp.
GRANT SELECT (papers_current) ON public.vendor_profiles TO anon, authenticated;
GRANT SELECT (papers_lapsed_at) ON public.vendor_profiles TO authenticated;

-- ── 2 · a shop cannot clear (or set) its own stamp ─────────────────────────
-- `authenticated` holds table-level UPDATE on vendor_profiles and
-- vendor_profiles_owner is FOR ALL on the shop's own row, so a column grant
-- cannot protect this column — a trigger does, as the entitlement guard does
-- for the other trust columns.
CREATE OR REPLACE FUNCTION public.guard_vendor_papers_lapsed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' AND NEW.papers_lapsed_at IS NOT NULL THEN
      RAISE EXCEPTION 'papers_lapsed_at is set by Setnayan only' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.papers_lapsed_at IS DISTINCT FROM OLD.papers_lapsed_at THEN
      RAISE EXCEPTION 'papers_lapsed_at is set by Setnayan only' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_vendor_papers_lapsed_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_vendor_papers_lapsed_at() FROM anon;
REVOKE ALL ON FUNCTION public.guard_vendor_papers_lapsed_at() FROM authenticated;

DROP TRIGGER IF EXISTS guard_vendor_papers_lapsed_at ON public.vendor_profiles;
CREATE TRIGGER guard_vendor_papers_lapsed_at
  BEFORE INSERT OR UPDATE ON public.vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_papers_lapsed_at();

-- ── 3 · the marketplace view: verbatim + papers_current ─────────────────────
DROP VIEW IF EXISTS public.vendor_market_stats;

CREATE VIEW public.vendor_market_stats
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
  vp.hq_region,
  vp.tier_state,
  vp.verification_state,
  vp.is_findable,
  vp.papers_current
FROM public.vendor_profiles vp
LEFT JOIN public.vendor_review_stats vrs USING (vendor_profile_id)
LEFT JOIN public.vendor_active_ads   vaa USING (vendor_profile_id);


ALTER VIEW public.vendor_market_stats OWNER TO postgres;
REVOKE ALL ON public.vendor_market_stats FROM PUBLIC;
REVOKE ALL ON public.vendor_market_stats FROM anon, authenticated;
GRANT SELECT ON public.vendor_market_stats TO anon, authenticated;
GRANT ALL ON public.vendor_market_stats TO service_role;

COMMENT ON VIEW public.vendor_market_stats IS
  'Marketplace read-path consolidation: vendor_profiles + vendor_review_stats '
  '+ vendor_active_ads with precomputed ad_rank for SQL-side sort. '
  'security_invoker = true. Carries NO contact column since 20271221366210 '
  '(a shop is reached through Setnayan, never around it). Carries is_findable '
  'since 20271320303985 (the one listing rule) and papers_current since '
  '20271345631375 (a shop whose papers lapsed leaves the lists). Used by '
  '/vendors + Explore + Concierge wizard vendor-pick cards.';

-- ── 4 · the shop's own view re-projected (its projection is frozen at CREATE) ─
-- The 20271334860034 block verbatim, with the two new columns added to its
-- anti-vacuity check — so the shop's own dashboard can read its papers stamp.
DROP VIEW IF EXISTS public.vendor_profiles_self;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg('vp.' || quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'vendor_profiles';
  IF cols IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed vendor_profiles_self projection is empty';
  END IF;
  IF position('find_locked_at' IN cols) = 0 OR position('is_findable' IN cols) = 0
     OR position('gallery_video_titles' IN cols) = 0
     OR position('papers_lapsed_at' IN cols) = 0 OR position('papers_current' IN cols) = 0 THEN
    RAISE EXCEPTION 'ANTI-VACUITY FAILED: vendor_profiles_self would not carry the find-lock, video-title or papers columns';
  END IF;
  EXECUTE format($v$
    CREATE VIEW public.vendor_profiles_self
      WITH (security_invoker = false) AS
      SELECT %s
        FROM public.vendor_profiles vp
       WHERE vp.user_id = auth.uid()
          OR vp.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
  $v$, cols);
END $$;

ALTER VIEW public.vendor_profiles_self OWNER TO postgres;
REVOKE ALL ON public.vendor_profiles_self FROM PUBLIC;
REVOKE ALL ON public.vendor_profiles_self FROM anon;
REVOKE ALL ON public.vendor_profiles_self FROM authenticated;
GRANT SELECT ON public.vendor_profiles_self TO authenticated, service_role;

COMMENT ON VIEW public.vendor_profiles_self IS
  'Definer view: the caller''s OWN shops (owner via user_id = auth.uid(), or a '
  'team member via current_vendor_ids(''viewer'')), projecting every '
  'vendor_profiles column INCLUDING the eleven tax/registration/owner-identity '
  'columns that 20271217955839 revoked from `authenticated` at table level. '
  'Predicate mirrors policies vendor_profiles_owner + vendor_profiles_member_read '
  'exactly -- it widens nothing. SELECT ONLY: an auto-updatable definer view '
  'would let a teammate write past vendor_profiles_owner. Admin and public '
  'surfaces do NOT use this -- they read the table on the service-role client.';
