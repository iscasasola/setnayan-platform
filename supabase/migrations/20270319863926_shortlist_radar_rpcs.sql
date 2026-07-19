-- ============================================================================
-- Shortlist Radar (Wave 2) — vendor-facing demand RPCs
-- ============================================================================
-- Two SECURITY DEFINER getters that power the vendor dashboard's "Shortlist
-- Radar" card. Both are born-used by the getShortlistRadar() server action.
--
-- LOCKS honored:
--   • Behavioral data = first-party, min-N de-identified. rival_signals never
--     emits a couple identity (no user_id, no event_id, no names) — only a
--     (month, region, count) rollup, and every bucket clears the admin-managed
--     min-N floor via public.min_n_ok() before it surfaces.
--   • guest_saved_vendors stays owner-only. Its RLS is untouched. Vendors read
--     ONLY an aggregate COUNT through count_saves_for_vendor() (SECURITY
--     DEFINER), never a user_id and never a row.
--   • Admin-managed thresholds, never hardcoded. The min-N floor + on/off
--     toggle are read live from public.platform_settings (id=1). No literal
--     floor or enable flag appears below.
--   • Ownership gate on BOTH functions: a caller can only read signals for a
--     vendor_profile_id they own (current_vendor_profile_ids()) or as admin.
--
-- DEFENSIVE: the substrate migration (radar_min_n_floor / radar_enabled /
-- min_n_ok) is sequenced BEFORE this file in ledger order, so the helper +
-- columns exist at apply time. Reads of the floor still COALESCE to 1 so a
-- NULL/absent value can never disable suppression.
--
-- Idempotent: CREATE OR REPLACE FUNCTION throughout.
-- ----------------------------------------------------------------------------

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. count_saves_for_vendor — live "N couples saved you" tally.
--    Distinct-saver count across the two save surfaces that point at a vendor
--    profile: vendor_follows (account-level follow) + guest_saved_vendors
--    (guest bookmark from an event they attended). Returns ONLY the integer —
--    no user_ids ever leave this function. Owner/admin gate enforced inside.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_saves_for_vendor(p_vendor_profile_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  -- Ownership gate: only the vendor who owns this profile (or an admin) may
  -- read its save tally.
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Distinct savers across both surfaces. A user who BOTH follows and bookmarks
  -- the vendor counts once (UNION dedupes on the saver id). Only the count
  -- escapes the function.
  SELECT COUNT(*)::INTEGER
    INTO v_total
  FROM (
    SELECT follower_user_id AS saver
    FROM public.vendor_follows
    WHERE vendor_profile_id = p_vendor_profile_id
    UNION
    SELECT user_id AS saver
    FROM public.guest_saved_vendors
    WHERE vendor_profile_id = p_vendor_profile_id
  ) AS savers;

  RETURN COALESCE(v_total, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.count_saves_for_vendor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_saves_for_vendor(UUID) TO authenticated;

COMMENT ON FUNCTION public.count_saves_for_vendor(UUID) IS
  'Shortlist Radar (Wave 2): distinct-saver COUNT for a vendor profile, across vendor_follows + guest_saved_vendors. SECURITY DEFINER + owner/admin gate; returns only the integer, never user_ids — so guest_saved_vendors stays owner-only at the RLS layer.';

-- ----------------------------------------------------------------------------
-- 2. rival_signals_for_vendor — de-identified "rival on your date / in your
--    area" demand feed.
--    Aggregates couple demand activity in the calling vendor's OWN hq_region,
--    bucketed by month + region_code, counting:
--      • event_vendors rows (a couple added a vendor to their plan), and
--      • chat_threads rows (a couple opened an inquiry to a vendor),
--    where the host event's region matches the caller's vendor hq_region.
--
--    REGION-ONLY SCOPE (intentional, noted per spec): vendor_profiles.services
--    is a free-form TEXT[] with no reliable join key onto the event_vendors
--    fixed `vendor_category` enum, so a precise *category* match across the two
--    surfaces isn't sound. We therefore scope the rollup by hq_region alone —
--    correct + de-identified — and label the card copy as area-scoped rather
--    than category-scoped. Category narrowing can layer on later once the
--    taxonomy key is dual-written on both sides.
--
--    Respects the master toggle (radar_enabled=false → zero rows) and applies
--    min-N suppression via public.min_n_ok() against the admin-managed floor.
--    Output is ONLY (month_bucket, region_code, signal_count) — no couple
--    identity.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rival_signals_for_vendor(p_vendor_profile_id UUID)
RETURNS TABLE(month_bucket DATE, region_code TEXT, signal_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_floor   INTEGER;
  v_region  TEXT;
BEGIN
  -- Ownership gate (same as above).
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Admin-managed config. Defensive COALESCE so an absent/NULL row degrades
  -- to "enabled, floor=1" rather than crashing or leaking below floor.
  SELECT COALESCE(ps.radar_enabled, TRUE),
         COALESCE(ps.radar_min_n_floor, 1)
    INTO v_enabled, v_floor
  FROM public.platform_settings ps
  WHERE ps.id = 1;

  -- Master switch off → no signals.
  IF NOT COALESCE(v_enabled, TRUE) THEN
    RETURN;
  END IF;

  -- The caller's region, derived server-side from their own profile row.
  SELECT vp.hq_region
    INTO v_region
  FROM public.vendor_profiles vp
  WHERE vp.vendor_profile_id = p_vendor_profile_id;

  -- No region on file → nothing region-scoped to surface.
  IF v_region IS NULL OR btrim(v_region) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH demand AS (
    -- Couples adding a vendor to their plan, in the caller's region.
    SELECT date_trunc('month', ev.created_at)::date AS m,
           e.region                                  AS r
    FROM public.event_vendors ev
    JOIN public.events e ON e.event_id = ev.event_id
    WHERE e.region = v_region

    UNION ALL

    -- Couples opening an inquiry to a vendor, in the caller's region.
    SELECT date_trunc('month', ct.created_at)::date AS m,
           e.region                                  AS r
    FROM public.chat_threads ct
    JOIN public.events e ON e.event_id = ct.event_id
    WHERE e.region = v_region
  ),
  rolled AS (
    SELECT d.m AS month_bucket,
           d.r AS region_code,
           COUNT(*)::INTEGER AS signal_count
    FROM demand d
    GROUP BY d.m, d.r
  )
  SELECT rl.month_bucket, rl.region_code, rl.signal_count
  FROM rolled rl
  -- min-N suppression: only surface buckets that clear the admin-managed floor,
  -- so a small cell can't re-identify a single couple.
  WHERE public.min_n_ok(rl.signal_count, v_floor)
  ORDER BY rl.month_bucket DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.rival_signals_for_vendor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rival_signals_for_vendor(UUID) TO authenticated;

COMMENT ON FUNCTION public.rival_signals_for_vendor(UUID) IS
  'Shortlist Radar (Wave 2): de-identified (month, region, count) demand rollup for the caller vendor''s hq_region, from event_vendors + chat_threads activity. SECURITY DEFINER + owner/admin gate; respects platform_settings.radar_enabled and suppresses buckets below platform_settings.radar_min_n_floor via min_n_ok(). No couple identity in the output. Region-scoped (not category-scoped) — services TEXT[] has no sound join onto the event_vendors category enum.';

COMMIT;
