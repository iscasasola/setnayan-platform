-- =====================================================================
-- A SHOP'S EMAIL AND PHONE ARE NOT ONE POSTGREST CALL AWAY.
--
-- Owner, 2026-09-10: "our goal is to let them integrate their event with the
-- vendor they find. not to let them communicate outside the app."
--
-- #5404 took every printed email/phone exit off the couple's pages. The
-- DATABASE still handed both out. Measured in production (read-only,
-- 2026-09-11) immediately before writing:
--
--   role           table SELECT   contact_email   contact_phone
--   anon           no (21 cols)   SELECT          -
--   authenticated  no (95 cols)   SELECT          SELECT
--
-- Both are COLUMN grants (20271014385411 took table SELECT off anon;
-- 20271217955839 took it off authenticated), so a column REVOKE is not inert
-- here -- it is the whole fence. `vendor_profiles_public_read` admits
-- {anon, authenticated} for every verified shop, and RLS filters rows, never
-- columns: any browser holding the public anon key could list every verified
-- shop's email, and any signed-in account its phone too.
--
-- 🚪 A SECOND DOOR THE BRIEF DID NOT NAME: public.vendor_market_stats.
-- It is `security_invoker = true`, SELECT-granted to anon and authenticated,
-- and it PROJECTS vp.contact_email (read from the live view body). So even a
-- column revoke on the table would have left the email one
-- `/rest/v1/vendor_market_stats?select=contact_email` away -- or, worse, it
-- would have made EVERY read of the marketplace view fail 42501, because a
-- security_invoker view checks the invoker's privilege on every base column
-- its own definition names, not only the ones the outer query asks for.
-- Nothing in apps/web selects contact_email from this view (every
-- `.from('vendor_market_stats')` select was read, literal and constant), so
-- the column is dropped from it rather than kept.
--
-- ── WHO STILL READS THEM, AND HOW ─────────────────────────────────────
--   * The shop itself and its team: through public.vendor_profiles_self
--     (definer view, 20271217955839), which projects EVERY column and is not
--     touched here. lib/vendor-profile.ts reads it; the My Shop page, the
--     open-shop wizard and the vendor-dashboard editor all read through it.
--   * Admin, the API, the RA 10173 export, the claim flow, the verify desk,
--     the ghost-listing detector, activity stats, email triggers: every one
--     reads on the service-role client (checked by client, not by name).
--   * The shop WRITING its own contact: INSERT/UPDATE are untouched. REVOKE
--     SELECT only -- never REVOKE ALL.
--
-- The three user-session readers that would otherwise fail WHOLE (PostgREST
-- refuses the statement, not the field) are moved in the same PR:
--   * app/dashboard/[eventId]/messages/actions.ts   filter .ilike('contact_email')
--   * lib/vendor-invites.ts lookupExistingVendorByEmail   same filter
--   * app/dashboard/[eventId]/vendors/packages/actions.ts   select — see the
--     PR body: that file belongs to another session and must change BEFORE
--     this migration merges.
-- A source guard (lib/security/shop-contact-is-not-session-readable.test.ts)
-- fails if a session-client read names either column again.
--
-- IDEMPOTENT: REVOKE is a no-op when not held; DROP VIEW IF EXISTS + CREATE.
-- REVERSIBLE:
--   GRANT SELECT (contact_email) ON public.vendor_profiles TO anon;
--   GRANT SELECT (contact_email, contact_phone) ON public.vendor_profiles TO authenticated;
--   (and re-create vendor_market_stats from 20270331400000)
-- =====================================================================

BEGIN;

-- ANTI-VACUITY: the columns must exist, or every post-condition passes on nothing.
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
         AND column_name IN ('contact_email', 'contact_phone')) <> 2 THEN
    RAISE EXCEPTION 'ANTI-VACUITY FAILED: vendor_profiles.contact_email/contact_phone are not both present';
  END IF;
END $$;

-- 1 -- the column grants.
REVOKE SELECT (contact_email, contact_phone) ON public.vendor_profiles FROM anon;
REVOKE SELECT (contact_email, contact_phone) ON public.vendor_profiles FROM authenticated;
REVOKE SELECT (contact_email, contact_phone) ON public.vendor_profiles FROM PUBLIC;

-- 2 -- the marketplace view, rebuilt without contact_email. DROP + CREATE:
--      CREATE OR REPLACE refuses to drop a column. No object depends on this
--      view (pg_depend read in production). Every other column, its order,
--      security_invoker and the grants are kept exactly.
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
  vp.verification_state
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
  '(a shop is reached through Setnayan, never around it). Used by /vendors + '
  'Explore + Concierge wizard vendor-pick cards.';

-- ── POST-CONDITIONS ───────────────────────────────────────────────────
DO $$
DECLARE
  held text[];
BEGIN
  SELECT array_agg(r || '.' || c) INTO held
    FROM unnest(ARRAY['anon', 'authenticated']) AS r,
         unnest(ARRAY['contact_email', 'contact_phone']) AS c
   WHERE has_column_privilege(r, 'public.vendor_profiles', c, 'SELECT');
  IF held IS NOT NULL THEN
    RAISE EXCEPTION 'POST-CONDITION 1 FAILED: still SELECT-able: % (a table-level grant makes a column revoke inert)', held;
  END IF;

  -- Writes survive: the shop editor updates its own contact on the session.
  IF NOT has_column_privilege('authenticated', 'public.vendor_profiles', 'contact_email', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.vendor_profiles', 'contact_phone', 'UPDATE') THEN
    RAISE EXCEPTION 'POST-CONDITION 2 FAILED: authenticated lost UPDATE on its contact columns -- the shop editor is broken';
  END IF;

  IF NOT has_column_privilege('service_role', 'public.vendor_profiles', 'contact_email', 'SELECT') THEN
    RAISE EXCEPTION 'POST-CONDITION 3 FAILED: service_role lost contact_email -- every admin surface reads it';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'vendor_market_stats'
                AND column_name IN ('contact_email', 'contact_phone')) THEN
    RAISE EXCEPTION 'POST-CONDITION 4 FAILED: vendor_market_stats still projects a contact column';
  END IF;

  IF NOT has_table_privilege('anon', 'public.vendor_market_stats', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.vendor_market_stats', 'SELECT') THEN
    RAISE EXCEPTION 'POST-CONDITION 5 FAILED: the marketplace view lost its public SELECT -- Explore is broken';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class
                  WHERE oid = 'public.vendor_market_stats'::regclass
                    AND COALESCE(reloptions::text, '') LIKE '%security_invoker=true%') THEN
    RAISE EXCEPTION 'POST-CONDITION 6 FAILED: vendor_market_stats is no longer security_invoker';
  END IF;

  -- The shop's own read path still carries both columns.
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'vendor_profiles_self'
         AND column_name IN ('contact_email', 'contact_phone')) <> 2 THEN
    RAISE EXCEPTION 'POST-CONDITION 7 FAILED: vendor_profiles_self lost a contact column -- My Shop would go blank';
  END IF;
END $$;

COMMIT;
