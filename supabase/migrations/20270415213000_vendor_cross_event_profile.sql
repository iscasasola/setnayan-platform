-- ============================================================================
-- 20270415213000_vendor_cross_event_profile.sql
-- "One profile, every life event" — per-event-type vendor track record.
--
-- WHY: The substrate already surfaces a vendor's completed-events count + review
-- score as a SINGLE blended number (vendor_activity_stats, the public
-- /v/[slug] card). But `events.event_type` spans the whole life-event catalog
-- (wedding · birthday · christening · debut · gender_reveal · anniversary · …),
-- and a vendor's cross-life-event reputation is NEVER surfaced. A photographer
-- who has shot 12 weddings + 3 debuts + 2 christenings reads as one flat "17
-- completed" number, losing the story of WHICH kinds of events they're proven at.
--
-- This migration adds ONE read-only SECURITY DEFINER RPC that returns the
-- CALLING vendor's OWN completed events, grouped by events.event_type, with the
-- per-type count + average review rating. It is scoped to the caller via
-- current_vendor_ids() so a vendor can only read their own breakdown.
--
-- No new table (nothing to persist): the RPC composes two EXISTING, already-
-- exclusion-hardened sources —
--   • public.vendor_completed_events  (VIEW · 20270321252758) — one row per
--     delivered/complete LINKED booking, already excludes self-bookings, team,
--     internal, self-comp, and archived events. Reusing it means the per-type
--     counts can NEVER be padded by a vendor's own events — the same guarantee
--     the flat public count already carries.
--   • public.vendor_reviews          (TABLE · 20260514100000) — 1-5 overall
--     ratings, joined per (vendor_profile_id, event_id) so the average reflects
--     ONLY the completed events in each type bucket.
-- event_type_vocab (20261104000000) supplies the human label (label_en); an
-- unknown/retired slug falls back to the raw type so a bucket is never dropped.
--
-- SECURITY DEFINER + `SET search_path = public` (pinned) + owner-scoped via
-- current_vendor_ids('viewer') mirrors the demand_radar_for_vendor /
-- funnel_benchmark_for_vendor pattern in recent migrations. Read-only — no
-- writes, no PII in the output (aggregate counts + averages only).
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- vendor_track_record_by_event_type(p_vendor_profile_id UUID)
--
-- Returns one row per event_type the caller has at least one completed event
-- in, ordered by completed_count DESC then label. Empty result for a vendor
-- with no completed events (the component renders its own empty state).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_track_record_by_event_type(
  p_vendor_profile_id UUID
)
RETURNS TABLE(
  event_type       TEXT,
  event_type_label TEXT,
  completed_count  INTEGER,
  review_count     INTEGER,
  avg_rating       NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Ownership gate: the caller must be a team member (>= viewer) of the vendor
  -- profile they are asking about. current_vendor_ids() is itself a
  -- SECURITY DEFINER helper reading vendor_team_members for auth.uid().
  IF p_vendor_profile_id IS NULL
     OR p_vendor_profile_id NOT IN (SELECT public.current_vendor_ids('viewer')) THEN
    RETURN;  -- not authorized / no such membership → empty (no error leak)
  END IF;

  RETURN QUERY
  WITH completed AS (
    -- Row-per-completed-event for this vendor. The view already applies the
    -- self-booking / team / internal / self-comp / archived exclusions.
    SELECT
      vce.event_id,
      COALESCE(NULLIF(btrim(vce.event_type), ''), 'other') AS etype
    FROM public.vendor_completed_events vce
    WHERE vce.vendor_profile_id = p_vendor_profile_id
  ),
  -- Average of the OVERALL rating across reviews tied to those completed
  -- events for this vendor. LEFT-joined below so a type with completions but
  -- no reviews yet still returns (avg_rating NULL).
  reviews AS (
    SELECT
      c.etype,
      COUNT(vr.review_id)::INTEGER               AS review_count,
      ROUND(AVG(vr.rating_overall)::NUMERIC, 2)  AS avg_rating
    FROM completed c
    JOIN public.vendor_reviews vr
      ON vr.event_id = c.event_id
     AND vr.vendor_profile_id = p_vendor_profile_id
    GROUP BY c.etype
  )
  SELECT
    c.etype AS event_type,
    COALESCE(v.label_en, initcap(replace(c.etype, '_', ' '))) AS event_type_label,
    COUNT(*)::INTEGER                        AS completed_count,
    COALESCE(r.review_count, 0)              AS review_count,
    r.avg_rating                             AS avg_rating
  FROM completed c
  LEFT JOIN reviews r              ON r.etype = c.etype
  LEFT JOIN public.event_type_vocab v ON v.event_type = c.etype
  GROUP BY c.etype, v.label_en, r.review_count, r.avg_rating
  ORDER BY completed_count DESC, event_type_label ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_track_record_by_event_type(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_track_record_by_event_type(UUID) TO authenticated;

COMMENT ON FUNCTION public.vendor_track_record_by_event_type(UUID) IS
  'One profile, every life event: the CALLING vendor''s own completed events '
  'grouped by events.event_type, with per-type completed_count + review_count + '
  'avg_rating (of vendor_reviews.rating_overall). Read-only SECURITY DEFINER, '
  'owner-scoped via current_vendor_ids(''viewer''); returns empty for a '
  'non-member. Composes the exclusion-hardened public.vendor_completed_events '
  'view (no self-booking padding) + public.vendor_reviews + event_type_vocab '
  'labels. No PII in the output — aggregate counts + averages only.';

COMMIT;
