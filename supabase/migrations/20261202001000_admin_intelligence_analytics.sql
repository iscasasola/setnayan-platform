-- ============================================================================
-- 20261202000000_admin_intelligence_analytics.sql
-- Admin Intelligence surface (/admin/intelligence) — local-DB analytics only.
--
-- Three SECURITY DEFINER aggregation RPCs (no external AI/API spend):
--   1. admin_churn_risk_events(p_stale_days, p_limit)
--        Future-dated, non-archived events whose couple shows ZERO activity
--        (login · guest change · budget change · seating change · event edit)
--        inside the stale window. Powers the "Churn radar" table.
--   2. admin_market_analytics()
--        One-round-trip JSONB: planned-budget aggregates
--        (events.estimated_budget_centavos), top-5 regions, event-type mix.
--   3. admin_lead_scores(p_limit)
--        Per-event engagement score (0–100) from feature-adoption signals;
--        tiers high_value / engaged / early. "Auto-arrange used + budget set"
--        is the strongest paid-conversion signal per the owner's brief.
--
-- Guard: every function raises unless is_admin() OR the caller is the
-- service_role (the Next.js admin lib fetches via createAdminClient and the
-- /admin layout already 404s non-admins). EXECUTE revoked from anon.
--
-- Also adds events.auto_seat_last_used_at — stamped by the autoSeatGuests
-- server action so lead scoring can read Auto-arrange adoption directly
-- (seat-assignment volume is only a proxy for events predating this column).
--
-- Internal/team accounts (users.is_internal) are excluded from churn + lead
-- output so test events never pollute ops decisions.
--
-- Performance: all per-event subqueries ride existing (event_id) indexes;
-- a new partial index covers the future-active event scan. App-side results
-- are additionally cached for 10 minutes via Next unstable_cache, so these
-- run at most ~6×/hour regardless of admin traffic.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Auto-arrange usage stamp
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS auto_seat_last_used_at TIMESTAMPTZ;

COMMENT ON COLUMN public.events.auto_seat_last_used_at IS
  'Last time the couple ran seating Auto-arrange (autoSeatGuests action). Read by admin_lead_scores() as a high-intent engagement signal. NULL = never used (or last use predates 2026-12-02 migration).';

-- Future-active event scan for the churn radar.
CREATE INDEX IF NOT EXISTS events_future_active_date_idx
  ON public.events(event_date)
  WHERE archived = FALSE;

-- ----------------------------------------------------------------------------
-- 2. Churn radar
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_churn_risk_events(
  p_stale_days INTEGER DEFAULT 14,
  p_limit      INTEGER DEFAULT 100
)
RETURNS TABLE (
  event_id             UUID,
  public_id            TEXT,
  event_name           TEXT,
  event_type           TEXT,
  event_date           DATE,
  days_to_event        INTEGER,
  owner_email          TEXT,
  owner_display_name   TEXT,
  last_sign_in_at      TIMESTAMPTZ,
  last_guest_change_at TIMESTAMPTZ,
  last_budget_change_at TIMESTAMPTZ,
  last_activity_at     TIMESTAMPTZ,
  days_inactive        INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'admin_churn_risk_events: admin only';
  END IF;

  RETURN QUERY
  WITH owners AS (
    -- Earliest couple member = the account that owns the event.
    SELECT DISTINCT ON (em.event_id) em.event_id, em.user_id
    FROM public.event_members em
    WHERE em.member_type = 'couple'
    ORDER BY em.event_id, em.joined_at ASC
  ),
  signals AS (
    SELECT
      e.event_id,
      e.public_id,
      e.display_name,
      e.event_type::TEXT AS event_type_text,
      e.event_date,
      u.email             AS owner_email,
      u.display_name      AS owner_display_name,
      au.last_sign_in_at,
      (SELECT MAX(GREATEST(g.created_at, g.updated_at))
         FROM public.guests g
        WHERE g.event_id = e.event_id)                       AS guest_at,
      GREATEST(
        (SELECT MAX(li.created_at)
           FROM public.event_vendor_line_items li
          WHERE li.event_id = e.event_id),
        (SELECT MAX(p.created_at)
           FROM public.event_vendor_payments p
          WHERE p.event_id = e.event_id)
      )                                                      AS budget_at,
      (SELECT MAX(sa.created_at)
         FROM public.event_seat_assignments sa
        WHERE sa.event_id = e.event_id)                      AS seat_at,
      e.updated_at                                           AS event_updated_at
    FROM public.events e
    LEFT JOIN owners o        ON o.event_id = e.event_id
    LEFT JOIN public.users u  ON u.user_id = o.user_id
    LEFT JOIN auth.users au   ON au.id = o.user_id
    WHERE e.archived = FALSE
      AND e.event_date IS NOT NULL
      AND e.event_date >= CURRENT_DATE
      AND COALESCE(u.is_internal, FALSE) = FALSE
  ),
  ranked AS (
    SELECT
      s.*,
      GREATEST(
        COALESCE(s.last_sign_in_at, 'epoch'::TIMESTAMPTZ),
        COALESCE(s.guest_at,        'epoch'::TIMESTAMPTZ),
        COALESCE(s.budget_at,       'epoch'::TIMESTAMPTZ),
        COALESCE(s.seat_at,         'epoch'::TIMESTAMPTZ),
        s.event_updated_at
      ) AS activity_at
    FROM signals s
  )
  SELECT
    r.event_id,
    r.public_id,
    r.display_name,
    r.event_type_text,
    r.event_date,
    (r.event_date - CURRENT_DATE),
    r.owner_email,
    r.owner_display_name,
    r.last_sign_in_at,
    r.guest_at,
    r.budget_at,
    r.activity_at,
    FLOOR(EXTRACT(EPOCH FROM (NOW() - r.activity_at)) / 86400)::INTEGER
  FROM ranked r
  WHERE r.activity_at < NOW() - make_interval(days => GREATEST(p_stale_days, 1))
  ORDER BY r.activity_at ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END;
$$;

COMMENT ON FUNCTION public.admin_churn_risk_events IS
  'Admin-only churn radar: future-dated non-archived events with zero couple activity (login / guest change / budget change / seating / event edit) in the stale window. Internal accounts excluded.';

-- ----------------------------------------------------------------------------
-- 3. Market analytics
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_market_analytics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'admin_market_analytics: admin only';
  END IF;

  SELECT jsonb_build_object(
    'budget', (
      SELECT jsonb_build_object(
        'events_total',       COUNT(*),
        'events_with_budget', COUNT(e.estimated_budget_centavos),
        'avg_centavos',       ROUND(AVG(e.estimated_budget_centavos)),
        'median_centavos',    ROUND((percentile_cont(0.5) WITHIN GROUP
                                (ORDER BY e.estimated_budget_centavos))::NUMERIC),
        'min_centavos',       MIN(e.estimated_budget_centavos),
        'max_centavos',       MAX(e.estimated_budget_centavos)
      )
      FROM public.events e
      WHERE e.archived = FALSE
    ),
    'top_regions', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('region', t.region, 'events', t.n)
                  ORDER BY t.n DESC, t.region ASC),
        '[]'::JSONB)
      FROM (
        SELECT e.region, COUNT(*) AS n
        FROM public.events e
        WHERE e.archived = FALSE AND e.region IS NOT NULL AND e.region <> ''
        GROUP BY e.region
        ORDER BY n DESC, e.region ASC
        LIMIT 5
      ) t
    ),
    'unlocated_events', (
      SELECT COUNT(*)
      FROM public.events e
      WHERE e.archived = FALSE AND (e.region IS NULL OR e.region = '')
    ),
    'event_types', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('event_type', t.event_type, 'events', t.n)
                  ORDER BY t.n DESC, t.event_type ASC),
        '[]'::JSONB)
      FROM (
        SELECT e.event_type::TEXT AS event_type, COUNT(*) AS n
        FROM public.events e
        WHERE e.archived = FALSE
        GROUP BY e.event_type
      ) t
    ),
    'generated_at', NOW()
  )
  INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.admin_market_analytics IS
  'Admin-only one-round-trip market aggregates: planned-budget stats (estimated_budget_centavos), top-5 regions, event-type breakdown. Non-archived events only.';

-- ----------------------------------------------------------------------------
-- 4. Lead scoring
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_lead_scores(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  event_id               UUID,
  public_id              TEXT,
  event_name             TEXT,
  event_type             TEXT,
  event_date             DATE,
  owner_email            TEXT,
  owner_display_name     TEXT,
  guest_count            INTEGER,
  vendor_count           INTEGER,
  table_count            INTEGER,
  seated_count           INTEGER,
  line_item_count        INTEGER,
  payment_count          INTEGER,
  budget_set             BOOLEAN,
  auto_arrange_used      BOOLEAN,
  website_configured     BOOLEAN,
  monogram_configured    BOOLEAN,
  signed_in_last_7d      BOOLEAN,
  profile_completion_pct INTEGER,
  score                  INTEGER,
  tier                   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'admin_lead_scores: admin only';
  END IF;

  RETURN QUERY
  WITH owners AS (
    SELECT DISTINCT ON (em.event_id) em.event_id, em.user_id
    FROM public.event_members em
    WHERE em.member_type = 'couple'
    ORDER BY em.event_id, em.joined_at ASC
  ),
  features AS (
    SELECT
      e.event_id,
      e.public_id,
      e.display_name,
      e.event_type::TEXT AS event_type_text,
      e.event_date,
      u.email        AS owner_email,
      u.display_name AS owner_display_name,
      au.last_sign_in_at,
      (e.estimated_budget_centavos IS NOT NULL)                    AS f_budget,
      (e.auto_seat_last_used_at IS NOT NULL)                       AS f_auto_seat_stamped,
      (e.slug IS NOT NULL OR e.landing_page_hero_image_url IS NOT NULL) AS f_website,
      (COALESCE(e.monogram_text, '') <> '')                        AS f_monogram,
      COALESCE((SELECT COUNT(*) FROM public.guests g
                 WHERE g.event_id = e.event_id AND g.deleted_at IS NULL), 0)::INTEGER AS guest_n,
      COALESCE((SELECT COUNT(*) FROM public.event_vendors v
                 WHERE v.event_id = e.event_id), 0)::INTEGER                          AS vendor_n,
      COALESCE((SELECT COUNT(*) FROM public.event_tables t
                 WHERE t.event_id = e.event_id), 0)::INTEGER                          AS table_n,
      COALESCE((SELECT COUNT(*) FROM public.event_seat_assignments sa
                 WHERE sa.event_id = e.event_id), 0)::INTEGER                         AS seat_n,
      COALESCE((SELECT COUNT(*) FROM public.event_vendor_line_items li
                 WHERE li.event_id = e.event_id), 0)::INTEGER                         AS li_n,
      COALESCE((SELECT COUNT(*) FROM public.event_vendor_payments p
                 WHERE p.event_id = e.event_id), 0)::INTEGER                          AS pay_n
    FROM public.events e
    LEFT JOIN owners o       ON o.event_id = e.event_id
    LEFT JOIN public.users u ON u.user_id = o.user_id
    LEFT JOIN auth.users au  ON au.id = o.user_id
    WHERE e.archived = FALSE
      AND (e.event_date IS NULL OR e.event_date >= CURRENT_DATE)
      AND COALESCE(u.is_internal, FALSE) = FALSE
  ),
  scored AS (
    SELECT
      f.*,
      -- Auto-arrange: direct stamp, or ≥10 seat assignments as the proxy for
      -- events that used the feature before the stamp column existed.
      (f.f_auto_seat_stamped OR f.seat_n >= 10)                    AS auto_arrange,
      (f.last_sign_in_at >= NOW() - INTERVAL '7 days')             AS recent_login,
      (
        (CASE WHEN f.f_budget THEN 15 ELSE 0 END) +
        (CASE WHEN f.li_n  > 0 THEN 10 ELSE 0 END) +
        (CASE WHEN f.pay_n > 0 THEN 10 ELSE 0 END) +
        (CASE WHEN f.f_auto_seat_stamped OR f.seat_n >= 10 THEN 15 ELSE 0 END) +
        (CASE WHEN f.table_n > 0 THEN 5 ELSE 0 END) +
        (CASE WHEN f.guest_n >= 10 THEN 10 ELSE 0 END) +
        (CASE WHEN f.guest_n >= 50 THEN 5 ELSE 0 END) +
        (CASE WHEN f.vendor_n > 0 THEN 10 ELSE 0 END) +
        (CASE WHEN f.vendor_n >= 3 THEN 5 ELSE 0 END) +
        (CASE WHEN f.f_website THEN 5 ELSE 0 END) +
        (CASE WHEN f.f_monogram THEN 5 ELSE 0 END) +
        (CASE WHEN f.last_sign_in_at >= NOW() - INTERVAL '7 days' THEN 5 ELSE 0 END)
      )::INTEGER                                                   AS lead_score,
      -- Profile completion = distinct planning features adopted, out of 9.
      (
        (CASE WHEN f.f_budget THEN 1 ELSE 0 END) +
        (CASE WHEN f.li_n  > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN f.pay_n > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN f.f_auto_seat_stamped OR f.seat_n >= 10 THEN 1 ELSE 0 END) +
        (CASE WHEN f.table_n  > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN f.guest_n  > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN f.vendor_n > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN f.f_website THEN 1 ELSE 0 END) +
        (CASE WHEN f.f_monogram THEN 1 ELSE 0 END)
      ) AS features_used
    FROM features f
  )
  SELECT
    s.event_id,
    s.public_id,
    s.display_name,
    s.event_type_text,
    s.event_date,
    s.owner_email,
    s.owner_display_name,
    s.guest_n,
    s.vendor_n,
    s.table_n,
    s.seat_n,
    s.li_n,
    s.pay_n,
    s.f_budget,
    s.auto_arrange,
    s.f_website,
    s.f_monogram,
    COALESCE(s.recent_login, FALSE),
    ROUND(s.features_used * 100.0 / 9)::INTEGER,
    s.lead_score,
    CASE
      WHEN s.lead_score >= 70 THEN 'high_value'
      WHEN s.lead_score >= 40 THEN 'engaged'
      ELSE 'early'
    END
  FROM scored s
  ORDER BY s.lead_score DESC, s.last_sign_in_at DESC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
END;
$$;

COMMENT ON FUNCTION public.admin_lead_scores IS
  'Admin-only lead scoring (0-100) from feature-adoption signals on non-archived future/undated events. Tier high_value >= 70 (Auto-arrange + budget adopters land here), engaged >= 40, else early. Internal accounts excluded.';

-- ----------------------------------------------------------------------------
-- 5. Grants — authenticated callers pass through the is_admin() guard;
--    anon is locked out entirely.
-- ----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.admin_churn_risk_events(INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_market_analytics() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_lead_scores(INTEGER) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_churn_risk_events(INTEGER, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_market_analytics() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_lead_scores(INTEGER) TO authenticated, service_role;

COMMIT;
