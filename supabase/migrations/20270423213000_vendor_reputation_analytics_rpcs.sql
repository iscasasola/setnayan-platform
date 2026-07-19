-- vendor_reputation_analytics_rpcs
-- ============================================================================
-- My Performance · Phase B family 3 — "Reputation" analytics (Pro tier).
--
-- Two own-business, ownership-gated readers over the vendor's own reviews.
-- Column set schema-discovery-mapped + adversarially verified against the
-- shipped migrations. Both SECURITY DEFINER + STABLE, gated exactly like the
-- other My Performance RPCs:
--   p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
--   OR public.is_console_admin()
--
-- OWN-BUSINESS ONLY: filtered to the caller's own vendor_profile_id.
--
--   1. vendor_review_coverage — overall rating + count, reply-to-review
--        coverage % (vendor_reply is a nullable column on vendor_reviews, one
--        reply per row), avg reply time, and the 5→1 star distribution.
--   2. vendor_review_monthly  — rating TREND + review VELOCITY: one row per
--        month (zero-filled) with review_count + avg rating (NULL for empty
--        months so a trend line breaks rather than dips to a false 0).
--
-- Review themes / sentiment is intentionally NOT built here: the free-text
-- (vendor_reviews.body) exists but no derived sentiment/theme column does —
-- that's a needs_capture AI pass, deferred.
--
-- Idempotent: CREATE OR REPLACE + REVOKE/GRANT. No tables, no policies.
-- ============================================================================

BEGIN;

-- 1 ── Rating summary + reply coverage + distribution -----------------------
CREATE OR REPLACE FUNCTION public.vendor_review_coverage(
  p_vendor_profile_id UUID,
  p_since             TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  total_reviews   INTEGER,
  replied_count   INTEGER,
  coverage_pct    NUMERIC,   -- replied / total, 0..100
  avg_reply_hours NUMERIC,   -- avg (vendor_reply_at − created_at)
  avg_rating      NUMERIC,   -- avg rating_overall
  five_star       INTEGER,
  four_star       INTEGER,
  three_star      INTEGER,
  two_star        INTEGER,
  one_star        INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH r AS (
    SELECT vr.rating_overall, vr.vendor_reply, vr.vendor_reply_at, vr.created_at
    FROM public.vendor_reviews vr
    WHERE vr.vendor_profile_id = p_vendor_profile_id
      AND (p_since IS NULL OR vr.created_at >= p_since)
  )
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE r.vendor_reply IS NOT NULL AND length(trim(r.vendor_reply)) > 0)::INTEGER,
    (100.0 * COUNT(*) FILTER (WHERE r.vendor_reply IS NOT NULL AND length(trim(r.vendor_reply)) > 0)
      / NULLIF(COUNT(*), 0))::NUMERIC,
    (AVG(EXTRACT(EPOCH FROM (r.vendor_reply_at - r.created_at)) / 3600.0)
      FILTER (WHERE r.vendor_reply_at IS NOT NULL AND r.vendor_reply_at >= r.created_at))::NUMERIC,
    (AVG(r.rating_overall))::NUMERIC,
    COUNT(*) FILTER (WHERE r.rating_overall = 5)::INTEGER,
    COUNT(*) FILTER (WHERE r.rating_overall = 4)::INTEGER,
    COUNT(*) FILTER (WHERE r.rating_overall = 3)::INTEGER,
    COUNT(*) FILTER (WHERE r.rating_overall = 2)::INTEGER,
    COUNT(*) FILTER (WHERE r.rating_overall = 1)::INTEGER
  FROM r;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_review_coverage(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_review_coverage(UUID, TIMESTAMPTZ) TO authenticated;

-- 2 ── Rating trend + review velocity (monthly, zero-filled) ----------------
CREATE OR REPLACE FUNCTION public.vendor_review_monthly(
  p_vendor_profile_id UUID,
  p_months            INTEGER DEFAULT 12
)
RETURNS TABLE(
  month_start  DATE,
  review_count INTEGER,
  avg_rating   NUMERIC   -- NULL for months with no reviews
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_months INTEGER := GREATEST(1, LEAST(COALESCE(p_months, 12), 24));
  v_first  DATE    := (date_trunc('month', (now() AT TIME ZONE 'Asia/Manila'))
                      - ((v_months - 1) || ' months')::interval)::date;
BEGIN
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      v_first,
      date_trunc('month', (now() AT TIME ZONE 'Asia/Manila'))::date,
      '1 month'::interval
    )::date AS m
  ),
  rev AS (
    SELECT
      date_trunc('month', (vr.created_at AT TIME ZONE 'Asia/Manila'))::date AS m,
      vr.rating_overall
    FROM public.vendor_reviews vr
    WHERE vr.vendor_profile_id = p_vendor_profile_id
      AND vr.created_at >= (v_first::timestamp AT TIME ZONE 'Asia/Manila')
  )
  SELECT
    months.m,
    COUNT(rev.rating_overall)::INTEGER,
    (AVG(rev.rating_overall))::NUMERIC
  FROM months
  LEFT JOIN rev ON rev.m = months.m
  GROUP BY months.m
  ORDER BY months.m;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_review_monthly(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_review_monthly(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.vendor_review_coverage(UUID, TIMESTAMPTZ) IS
  'My Performance · Reputation. Overall rating + count, reply-to-review coverage % (vendor_reviews.vendor_reply), avg reply time, and 5→1 star distribution. SECURITY DEFINER, ownership-gated. Own-business only.';
COMMENT ON FUNCTION public.vendor_review_monthly(UUID, INTEGER) IS
  'My Performance · Reputation. Monthly review velocity + avg rating trend (zero-filled via generate_series, Asia/Manila; avg NULL for empty months). SECURITY DEFINER, ownership-gated. Own-business only.';

COMMIT;
