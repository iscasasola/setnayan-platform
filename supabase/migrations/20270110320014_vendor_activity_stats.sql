-- vendor_activity_stats — precomputed quality & health scores for vendor profiles.
--
-- Scores are written exclusively by the service role (background jobs / admin
-- actions). Vendors and couples have NO write access so scores cannot be
-- self-inflated. Public read is required so couples see quality signals
-- during vendor search without a round-trip through a guarded surface.
--
-- Score columns:
--   quality_score        — overall weighted composite (0–100)
--   couple_trust_score   — responsiveness + completion signals (0–100)
--   platform_health_score — policy compliance + activity recency (0–100)
--   review_avg_bayesian  — Bayesian-smoothed rating; more stable than raw avg

CREATE TABLE IF NOT EXISTS public.vendor_activity_stats (
  vendor_profile_id             UUID PRIMARY KEY
                                  REFERENCES public.vendor_profiles(vendor_profile_id)
                                  ON DELETE CASCADE,
  avg_response_minutes          integer,
  response_rate_pct             smallint CHECK (response_rate_pct BETWEEN 0 AND 100),
  booking_completion_rate_pct   smallint CHECK (booking_completion_rate_pct BETWEEN 0 AND 100),
  vendor_cancellation_count     smallint NOT NULL DEFAULT 0,
  inquiry_to_booking_pct        smallint CHECK (inquiry_to_booking_pct BETWEEN 0 AND 100),
  finalized_booking_count       integer  NOT NULL DEFAULT 0,
  review_avg_raw                numeric(3,2),
  review_avg_bayesian           numeric(3,2),
  review_count                  integer  NOT NULL DEFAULT 0,
  last_active_at                timestamptz,
  profile_completeness_pct      smallint CHECK (profile_completeness_pct BETWEEN 0 AND 100),
  quality_score                 smallint CHECK (quality_score BETWEEN 0 AND 100),
  couple_trust_score            smallint CHECK (couple_trust_score BETWEEN 0 AND 100),
  platform_health_score         smallint CHECK (platform_health_score BETWEEN 0 AND 100),
  updated_at                    timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vendor_activity_stats ENABLE ROW LEVEL SECURITY;

-- Public read — couples need quality scores during vendor search
DROP POLICY IF EXISTS "public read vendor activity stats" ON public.vendor_activity_stats;
CREATE POLICY "public read vendor activity stats"
  ON public.vendor_activity_stats
  FOR SELECT
  USING (true);

-- Only the platform (service role / admin) can write.
-- Vendors and couples cannot directly update their own scores.
DROP POLICY IF EXISTS "admins manage vendor activity stats" ON public.vendor_activity_stats;
CREATE POLICY "admins manage vendor activity stats"
  ON public.vendor_activity_stats
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
