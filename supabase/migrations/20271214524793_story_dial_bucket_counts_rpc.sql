-- story_dial_bucket_counts
-- ============================================================================
-- Per-time-bucket capture COUNTS for the Story's dial (03 §3 · 08 steps 0.2 +
-- 0.4 · Design_Editorial_By_The_Minute_2026-09-07).
--
-- WHY: the dial's bar heights must never be built from the timeline's ≤48-row
-- READ (apps/web/app/[slug]/_components/editorial/data.ts,
-- EDITORIAL_TIMELINE_PHOTO_CAP) — a heavily-shot day would need the bar heights
-- to represent hundreds of captures while only 48 rows are ever fetched. The
-- same file already records why that read stays capped: "presigning 300 URLs
-- to throw 276 away is the shape that made the gallery slow." So bar heights
-- come from a COUNT-BY-BUCKET aggregate instead — no rows, no presign, just a
-- number per bucket — and the reader's tap into ONE bucket is a separate,
-- later query that presigns only that bin.
--
-- No generate_series bucket-count RPC existed anywhere in this repo before
-- this migration.
--
-- BUCKETING: caller supplies a real-instant [p_window_start, p_window_end)
-- range (the event's own Manila-day window — see lib/story-day-window.ts,
-- which computes it from events.event_date / event_end_date) and a bucket
-- width in minutes. generate_series zero-fills every bucket so a silent gap in
-- the day (nobody shooting from midnight to 6am) still renders a zero-height
-- bar rather than being skipped. `bucket_start` is a real timestamptz, not a
-- day — the caller decides how it maps to Manila wall-clock for the label.
--
-- SCOPE: photo_type='photo' + not hidden + moderation_state='clean' — the SAME
-- fail-closed allowlist data.ts already uses for the public timeline read
-- (PUBLIC_SAFE_MODERATION_STATE). This does NOT yet apply the RA 10173 consent
-- veto (consent-veto.ts / loadConsentVetoedPapicIds) — that resolve lives in
-- TypeScript against the per-guest opt-out list, and duplicating it in SQL here
-- would be the second shape data.ts's own header warns against. Design doc 09
-- session S3 owns the pre-publish guest-layer/consent gate for the dial; until
-- that lands, callers of this RPC must treat its counts as A ceiling, not a
-- guest-safe final count, and must not surface them on a public page ahead of
-- that gate.
--
-- SECURITY: /[slug] renders with the admin (service_role) client — the app-side
-- gate is the whole fence there (per this repo's standing rule: "EVENT CONTENT
-- NEVER" uses a session-proved id for that surface). This function is plain
-- SQL (not SECURITY DEFINER — it needs no elevated privilege beyond reading
-- papic_photos, which service_role already has), narrow-granted to
-- authenticated + service_role only, and takes only an event_id — no guest
-- identity leaves the aggregate.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + REVOKE/GRANT. No table, no policy.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.story_dial_bucket_counts(
  p_event_id      UUID,
  p_window_start  TIMESTAMPTZ,
  p_window_end    TIMESTAMPTZ,
  p_bucket_minutes INTEGER DEFAULT 30
)
RETURNS TABLE(
  bucket_start   TIMESTAMPTZ,
  capture_count  INTEGER
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      p_window_start AS win_start,
      -- end is EXCLUSIVE on the bucket spine; a capture at exactly the window
      -- end still needs a bucket to land in, so pad the spine by one bucket.
      p_window_end AS win_end,
      -- Clamp the bucket width to a sane 1..180 minutes. A caller-controlled
      -- bucket width of 0 would make generate_series loop forever; the CI
      -- suite has caught exactly that class of bug before in this repo.
      GREATEST(1, LEAST(COALESCE(p_bucket_minutes, 30), 180)) AS bucket_min
  ),
  spine AS (
    SELECT generate_series(
      (SELECT win_start FROM bounds),
      (SELECT win_end FROM bounds),
      (SELECT (bucket_min || ' minutes')::interval FROM bounds)
    ) AS bucket_start
  ),
  captures AS (
    SELECT
      (SELECT win_start FROM bounds)
        + floor(
            extract(epoch FROM (pp.captured_at - (SELECT win_start FROM bounds)))
            / (60 * (SELECT bucket_min FROM bounds))
          ) * ((SELECT bucket_min FROM bounds) || ' minutes')::interval
        AS bucket_start
    FROM public.papic_photos pp
    WHERE pp.event_id = p_event_id
      AND pp.photo_type = 'photo'
      AND pp.hidden_at IS NULL
      AND pp.moderation_state = 'clean'
      AND pp.captured_at >= (SELECT win_start FROM bounds)
      AND pp.captured_at <  (SELECT win_end FROM bounds)
  )
  SELECT
    spine.bucket_start,
    COUNT(c.bucket_start)::INTEGER AS capture_count
  FROM spine
  LEFT JOIN captures c ON c.bucket_start = spine.bucket_start
  WHERE spine.bucket_start < (SELECT win_end FROM bounds)
  GROUP BY spine.bucket_start
  ORDER BY spine.bucket_start;
$$;

REVOKE ALL ON FUNCTION public.story_dial_bucket_counts(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.story_dial_bucket_counts(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated, service_role;

COMMENT ON FUNCTION public.story_dial_bucket_counts(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) IS
  'Zero-filled per-bucket clean-photo COUNTs for the Story dial, bounded to a caller-supplied real-instant window (the event''s own Manila days — see lib/story-day-window.ts). Bar heights must be built from this, never from the ≤48-row timeline read. Does not yet apply the RA 10173 consent veto — 09 session S3 owns that gate.';

COMMIT;
