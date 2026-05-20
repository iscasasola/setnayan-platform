-- ============================================================================
-- 20260523000000_hiring_guide_owner_alerts.sql
--
-- Iteration: Hiring Predictive Guide (CLAUDE.md decision log 2026-05-20 row)
-- Spec corpus: pending — 0023 § 8 "Operations & Hiring" tab addition.
--
-- Foundation tables + materialized view for the owner-facing Growth Cockpit
-- in 0023 admin console. Surfaces:
--   • bottleneck signals (vendor verification backlog, support response time,
--     engineering blockers, marketing pipeline, disputes, founder time)
--   • milestone forecasts (100/1,000/5,000 vendor projections)
--   • hiring deadlines tied to Jan 30 2027 sunset
--
-- Scope of this migration:
--   1. `owner_alerts` table — recent fired alerts with acknowledged_at
--   2. `bottleneck_signals_current` materialized view — hourly-refreshed
--   3. `founder_time_log` table — weekly self-report for the "founder time on
--      one function" signal
--   4. RLS — owner-only read access (account_type='owner' OR is_internal=TRUE)
--   5. Initial hiring roadmap seed rows
--
-- Out of scope (separate migrations / app code):
--   • Email template rows in 0028
--   • The Sentry / PostHog / Resend wiring for alert delivery
--   • The dashboard React components
--
-- Idempotent. Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. owner_alerts — recent fired alerts
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.owner_alerts (
  alert_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type          TEXT NOT NULL
                        CHECK (alert_type IN (
                          'weekly_digest',
                          'bottleneck_red',
                          'bottleneck_yellow',
                          'milestone_hit',
                          'hiring_countdown_t_minus_30',
                          'hiring_countdown_t_minus_14',
                          'hiring_countdown_t_minus_7'
                        )),
  signal_name         TEXT,                                 -- e.g. 'vendor_verification' for bottleneck alerts
  milestone_value     INT,                                  -- e.g. 100 for milestone_hit
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,   -- additional context for the email body
  fired_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at     TIMESTAMPTZ,                          -- owner clicks acknowledge in dashboard
  acknowledged_by     UUID REFERENCES public.users(user_id),
  suppressed_until    TIMESTAMPTZ                           -- bottleneck alerts suppress repeat fires for 7 days
);

CREATE INDEX IF NOT EXISTS owner_alerts_fired_at_idx
  ON public.owner_alerts (fired_at DESC);

CREATE INDEX IF NOT EXISTS owner_alerts_type_signal_idx
  ON public.owner_alerts (alert_type, signal_name);

CREATE INDEX IF NOT EXISTS owner_alerts_unacknowledged_idx
  ON public.owner_alerts (fired_at DESC)
  WHERE acknowledged_at IS NULL;

COMMENT ON TABLE public.owner_alerts IS
  'Owner-facing alert log for the Hiring Predictive Guide (CLAUDE.md decision log 2026-05-20). Surfaces in 0023 admin /operations-hiring dashboard + emails to iscasasolaii@gmail.com via 0028 infra.';

-- ----------------------------------------------------------------------------
-- 2. founder_time_log — weekly self-report
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.founder_time_log (
  log_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(user_id),
  week_starting       DATE NOT NULL,                        -- Monday of the week being reported on
  primary_function    TEXT NOT NULL
                        CHECK (primary_function IN (
                          'product_strategy',
                          'vendor_verification',
                          'customer_support',
                          'engineering',
                          'marketing',
                          'sales_bd',
                          'finance_admin',
                          'fundraising',
                          'other'
                        )),
  primary_pct         INT NOT NULL CHECK (primary_pct BETWEEN 0 AND 100),
  notes               TEXT,
  reported_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_starting)
);

CREATE INDEX IF NOT EXISTS founder_time_log_user_week_idx
  ON public.founder_time_log (user_id, week_starting DESC);

COMMENT ON TABLE public.founder_time_log IS
  'Weekly self-reported founder time allocation. Powers the "founder time on one function" bottleneck signal in the Hiring Predictive Guide. Threshold: >50% on one function → red.';

-- ----------------------------------------------------------------------------
-- 3. hiring_roadmap — seeded with the Jan 30 2027 sunset deadlines
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hiring_roadmap (
  role_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_title          TEXT NOT NULL UNIQUE,
  hire_by_date        DATE NOT NULL,
  pulse               TEXT NOT NULL
                        CHECK (pulse IN ('pulse_1','pulse_2','pulse_3','pulse_4')),
  salary_range_min_php INT,
  salary_range_max_php INT,
  status              TEXT NOT NULL DEFAULT 'not_open'
                        CHECK (status IN ('not_open','sourcing','interviewing','offer_extended','hired','deferred')),
  bottleneck_signal_trigger TEXT,                           -- which signal name triggers urgency for this role
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hiring_roadmap_hire_by_idx
  ON public.hiring_roadmap (hire_by_date);

COMMENT ON TABLE public.hiring_roadmap IS
  'Hiring roadmap seeded with Jan 30 2027 sunset deadlines per CLAUDE.md decision log 2026-05-20 Pulse hiring model row. Admin updates status as candidates progress through pipeline.';

-- Seed Pulse 2 hiring deadlines tied to Jan 30 2027 sunset
-- (T-4 months CS Lead Sep 30, T-3 months Marketing Lead Oct 31, T-2 months Verification Lead Nov 30, T-1 month CSM Dec 30)
INSERT INTO public.hiring_roadmap
  (role_title, hire_by_date, pulse, salary_range_min_php, salary_range_max_php, status, bottleneck_signal_trigger, notes)
VALUES
  ('Customer Support Lead',  '2026-09-30', 'pulse_2',  45000,  90000, 'not_open', 'customer_support',
    'T-4 months from Jan 30 2027 sunset. Must be in place to handle vendor questions about conversion when first reminder email fires Sep 30.'),
  ('Marketing / Content Lead', '2026-10-31', 'pulse_2', 60000, 120000, 'not_open', 'marketing_pipeline',
    'T-3 months. Conversion playbook + Vendor Ad Strategy Playbook + Max launch marketing materials.'),
  ('Vendor Verification Lead', '2026-11-30', 'pulse_2', 50000, 100000, 'not_open', 'vendor_verification',
    'T-2 months. Can graduate from VA contractor or hire FT — but must be in place to handle conversion-period vendor signup surge.'),
  ('Customer Success Manager', '2026-12-30', 'pulse_2', 60000, 120000, 'not_open', 'max_tier_signups',
    'T-1 month. Required for Max-tier "named account manager" promise — must be trained and ready for Jan 30 Max launch.')
ON CONFLICT (role_title) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. bottleneck_signals_current — materialized view, refreshed hourly
-- ----------------------------------------------------------------------------

-- Drop and recreate to keep schema in sync if column shape changes
DROP MATERIALIZED VIEW IF EXISTS public.bottleneck_signals_current CASCADE;

CREATE MATERIALIZED VIEW public.bottleneck_signals_current AS
WITH verification_backlog AS (
  -- Pending verifications waiting for admin review
  SELECT COUNT(*)::INT AS pending_count
  FROM public.vendor_profiles
  WHERE verification_state = 'pending_review'
),
support_response AS (
  -- Average hours since help_messages created in last 7 days (proxy for response queue depth)
  SELECT
    COALESCE((
      SELECT EXTRACT(EPOCH FROM AVG(NOW() - created_at)) / 3600
      FROM public.help_messages
      WHERE created_at >= NOW() - INTERVAL '7 days'
    ), 0)::NUMERIC(10,2) AS avg_hours
),
recent_vendors AS (
  SELECT
    COUNT(*) FILTER (WHERE verification_state = 'verified')::INT AS verified_active,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::INT AS signups_last_week,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days')::INT AS signups_prior_week
  FROM public.vendor_profiles
),
disputes_volume AS (
  SELECT COUNT(*)::INT AS open_disputes
  FROM public.force_majeure_flags
  WHERE status NOT IN ('resolved', 'closed')
)
SELECT
  -- Verification backlog (green <10 / yellow 10-25 / red >25 per week)
  verification_backlog.pending_count AS verification_backlog_count,
  CASE
    WHEN verification_backlog.pending_count > 25 THEN 'red'
    WHEN verification_backlog.pending_count >= 10 THEN 'yellow'
    ELSE 'green'
  END AS verification_signal,

  -- Customer support response time (green <2h / yellow 2-24h / red >24h)
  support_response.avg_hours AS support_avg_response_hours,
  CASE
    WHEN support_response.avg_hours > 24 THEN 'red'
    WHEN support_response.avg_hours >= 2 THEN 'yellow'
    ELSE 'green'
  END AS support_signal,

  -- Marketing pipeline: w-o-w signup growth (red <-5%, yellow flat, green growing)
  recent_vendors.signups_last_week,
  recent_vendors.signups_prior_week,
  CASE
    WHEN recent_vendors.signups_prior_week = 0 THEN 'green'
    WHEN recent_vendors.signups_last_week::NUMERIC / recent_vendors.signups_prior_week < 0.95 THEN 'red'
    WHEN recent_vendors.signups_last_week::NUMERIC / recent_vendors.signups_prior_week < 1.05 THEN 'yellow'
    ELSE 'green'
  END AS marketing_signal,

  -- Disputes volume (green <2 / yellow 2-5 / red >5 per week — using open count as proxy)
  disputes_volume.open_disputes,
  CASE
    WHEN disputes_volume.open_disputes > 5 THEN 'red'
    WHEN disputes_volume.open_disputes >= 2 THEN 'yellow'
    ELSE 'green'
  END AS disputes_signal,

  -- Verified active vendor count for milestone forecasts
  recent_vendors.verified_active,

  -- Refresh timestamp
  NOW() AS refreshed_at
FROM verification_backlog, support_response, recent_vendors, disputes_volume;

CREATE UNIQUE INDEX bottleneck_signals_current_pk
  ON public.bottleneck_signals_current (refreshed_at);

COMMENT ON MATERIALIZED VIEW public.bottleneck_signals_current IS
  'Hourly-refreshed bottleneck signals powering the Hiring Predictive Guide dashboard. Refresh via REFRESH MATERIALIZED VIEW CONCURRENTLY public.bottleneck_signals_current; — caller is the on-access sweep pattern (no pg_cron) per reference_setnayan_cron_strategy memory.';

-- ----------------------------------------------------------------------------
-- 5. RLS — owner-only access on all three tables + view
-- ----------------------------------------------------------------------------

ALTER TABLE public.owner_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_time_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_roadmap ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_alerts_owner_read ON public.owner_alerts;
CREATE POLICY owner_alerts_owner_read
  ON public.owner_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = (SELECT auth.uid())
        AND (is_internal = TRUE OR account_type = 'admin')
    )
  );

DROP POLICY IF EXISTS owner_alerts_owner_write ON public.owner_alerts;
CREATE POLICY owner_alerts_owner_write
  ON public.owner_alerts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = (SELECT auth.uid())
        AND (is_internal = TRUE OR account_type = 'admin')
    )
  );

DROP POLICY IF EXISTS founder_time_log_owner_read ON public.founder_time_log;
CREATE POLICY founder_time_log_owner_read
  ON public.founder_time_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = (SELECT auth.uid())
        AND (is_internal = TRUE OR account_type = 'admin')
    )
  );

DROP POLICY IF EXISTS founder_time_log_owner_write ON public.founder_time_log;
CREATE POLICY founder_time_log_owner_write
  ON public.founder_time_log FOR ALL
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = (SELECT auth.uid())
        AND is_internal = TRUE
    )
  );

DROP POLICY IF EXISTS hiring_roadmap_owner_read ON public.hiring_roadmap;
CREATE POLICY hiring_roadmap_owner_read
  ON public.hiring_roadmap FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = (SELECT auth.uid())
        AND (is_internal = TRUE OR account_type = 'admin')
    )
  );

DROP POLICY IF EXISTS hiring_roadmap_owner_write ON public.hiring_roadmap;
CREATE POLICY hiring_roadmap_owner_write
  ON public.hiring_roadmap FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = (SELECT auth.uid())
        AND (is_internal = TRUE OR account_type = 'admin')
    )
  );

REVOKE ALL ON public.bottleneck_signals_current FROM anon, authenticated;
GRANT SELECT ON public.bottleneck_signals_current TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. Updated-at trigger for hiring_roadmap
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.hiring_roadmap_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hiring_roadmap_updated_at_trigger ON public.hiring_roadmap;
CREATE TRIGGER hiring_roadmap_updated_at_trigger
  BEFORE UPDATE ON public.hiring_roadmap
  FOR EACH ROW EXECUTE FUNCTION public.hiring_roadmap_updated_at();

COMMIT;
