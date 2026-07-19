-- phase2 trusted circle vendor signal fn
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- Person-spine · PHASE 2 · TRUSTED-CIRCLE VENDOR SIGNAL (owner "complete phase 2"
-- 2026-07-05 — STAGED / flag-off).
--
-- ⚠ PHASE 2 IS COUNSEL-GATED. This migration ships the SIGNAL COMPUTATION only —
-- an additive, read-only SQL function. Nothing calls it in production: the TS
-- wrapper (`apps/web/lib/trusted-circle-recs.ts`) is guarded by the SAME
-- `NEXT_PUBLIC_PEOPLE_CONNECTIONS` flag that gates the whole Phase-2 connections
-- flow (PR #2823), which defaults OFF. Relationship + commercial data together
-- is more sensitive than either alone, so no circle-based rec may surface in
-- prod until PH counsel signs off and the owner flips the env flag. Shipping the
-- function inert (never invoked, no data emitted) carries no exposure — same
-- posture as the empty Phase-2 `person_connections` table.
-- Plan: 03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md §11.
--
-- WHAT IT DOES — the graph's marketplace payoff: for a host (a person who claims
-- an account) planning an event, score a vendor as NEAR + TRUSTED + CONNECTED,
-- reading the graph the host already generated. Extends the existing engine
-- (vendor_recommendations = opt-in endorsements · vendor_reviews = explicit
-- reviews · vendor_coverages/hq_region = coverage). NOT a new system.
--
-- LOCKED CONSTRAINTS, ENFORCED IN THE QUERY (not just docs):
--   • TRUSTED = an EXPLICIT signal only — an opt-in endorsement
--     (`vendor_recommendations`) or an explicit review (`vendor_reviews`,
--     rating_overall >= 4). NEVER booking co-occurrence (`event_vendors` is
--     deliberately NOT read: hiring ≠ endorsing).
--   • DEGREE ≤ 2: 1st degree = attributed BY NAME only if the endorsement is an
--     opt-in vouch (the voucher consented to be named); everything else folds
--     into a min-N aggregate. 2nd degree = anonymized aggregate only, min-N.
--     3rd degree is NEVER traversed (weak signal + overreach).
--   • MIN-N: every AGGREGATE count is passed through public.min_n_ok(); a slice
--     below the floor returns 0 and never a name — so an aggregate can never
--     fingerprint one person. (Opt-in 1st-degree named vouches are exempt from
--     min-N because the person explicitly consented to be attributed.)
--   • TRUST IS NEVER PURCHASABLE: the computation reads ONLY host-authored
--     explicit signals (recommendations + reviews). It NEVER reads subscription
--     tier, boosts, ads, or any paid surface. No vendor can pay to appear
--     "trusted by your circle." (Same "zero fakes" line as the vendor value
--     prop — [[project_setnayan_vendor_value_proposition_reviews]].)
--   • PRIVATE TO THE HOST: SECURITY DEFINER, but the host person is derived from
--     auth.uid() and the caller must own/participate in the event. It returns
--     ONLY the host's own aggregates — never a browsable social graph. Never
--     emits another person's identity except an opt-in 1st-degree voucher.
-- ============================================================================

-- Floor for circle aggregates. Mirrors FUNNEL_MIN_N = 5 (vendor-funnel.ts) and
-- the shipped public.min_n_ok(count, floor). The function inlines 5. (No config
-- table — this is a locked privacy floor, not a tunable.)

CREATE OR REPLACE FUNCTION public.trusted_circle_vendor_signal(
  p_event_id           UUID,
  p_vendor_profile_id  UUID
)
RETURNS TABLE (
  -- NEAR
  near_region_match      BOOLEAN,   -- vendor hq_region == event region
  near_covers_event_type BOOLEAN,   -- vendor covers this event_type (vendor_coverages)
  -- TRUSTED (vendor-wide explicit signal totals — context, not circle-scoped)
  trusted_endorsement_count INTEGER, -- DISTINCT events with an opt-in endorsement
  trusted_review_avg        NUMERIC, -- avg rating_overall across explicit reviews
  trusted_review_count      INTEGER, -- # explicit reviews (any rating)
  -- CONNECTED (circle-scoped, degree<=2, min-N gated aggregates)
  connected_1st_count    INTEGER,   -- # of host's 1st-degree circle who explicitly trusted this vendor (min-N; 0 if below floor)
  connected_2nd_count    INTEGER,   -- # of host's 2nd-degree circle who explicitly trusted this vendor (min-N; 0 if below floor)
  -- opt-in 1st-degree named vouchers (JSON array of {person_id, display_name});
  -- ONLY people who left an opt-in endorsement (vendor_recommendations) AND are
  -- 1st-degree confirmed connections. Empty array when none.
  vouched_by             JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_person UUID;
  v_min_n       CONSTANT INTEGER := 5;
BEGIN
  -- 0. Caller must be a claimed person AND own/participate in the event.
  --    (SECURITY DEFINER bypasses RLS, so we re-establish the trust boundary
  --    here: no host person, or not their event => empty result, never leak.)
  SELECT p.person_id INTO v_host_person
  FROM public.people p
  WHERE p.claimed_by_user_id = auth.uid()
    AND p.deleted_at IS NULL
  LIMIT 1;

  IF v_host_person IS NULL THEN
    RETURN;  -- anonymous / unclaimed caller: no circle, no signal
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.event_id = p_event_id
      AND (
        public.is_admin()
        -- owner or co-host of the event (event_members mirrors dashboard access)
        OR EXISTS (
          SELECT 1 FROM public.event_members em
          WHERE em.event_id = e.event_id AND em.user_id = auth.uid()
        )
      )
  ) THEN
    RETURN;  -- not this host's event: refuse to compute a circle signal for it
  END IF;

  RETURN QUERY
  WITH
  -- ── host's circle, degree<=2 (3rd is NEVER traversed) ────────────────────
  first_degree AS (
    -- confirmed edges in EITHER direction from the host person
    SELECT DISTINCT CASE
             WHEN pc.from_person_id = v_host_person THEN pc.to_person_id
             ELSE pc.from_person_id
           END AS person_id
    FROM public.person_connections pc
    WHERE pc.status = 'confirmed'
      AND pc.deleted_at IS NULL
      AND (pc.from_person_id = v_host_person OR pc.to_person_id = v_host_person)
  ),
  second_degree AS (
    -- neighbors of first-degree, minus self and minus first-degree (so each
    -- person is counted at its CLOSEST degree only). No third hop.
    SELECT DISTINCT nbr.person_id
    FROM (
      SELECT CASE
               WHEN pc.from_person_id = fd.person_id THEN pc.to_person_id
               ELSE pc.from_person_id
             END AS person_id
      FROM first_degree fd
      JOIN public.person_connections pc
        ON (pc.from_person_id = fd.person_id OR pc.to_person_id = fd.person_id)
      WHERE pc.status = 'confirmed'
        AND pc.deleted_at IS NULL
    ) nbr
    WHERE nbr.person_id <> v_host_person
      AND nbr.person_id NOT IN (SELECT person_id FROM first_degree)
  ),
  -- ── EXPLICIT trust signals for THIS vendor, mapped to the AUTHOR's person ──
  -- opt-in endorsements (vendor_recommendations): consented, name-attributable
  endorsers AS (
    SELECT DISTINCT pe.person_id, vr.endorsement
    FROM public.vendor_recommendations vr
    JOIN public.people pe
      ON pe.claimed_by_user_id = vr.recommended_by_user_id
     AND pe.deleted_at IS NULL
    WHERE vr.vendor_profile_id = p_vendor_profile_id
      AND vr.recommended_by_user_id IS NOT NULL
  ),
  -- explicit reviews (rating_overall >= 4): a trust signal, but NOT an opt-in to
  -- be NAMED to others, so reviewers only ever feed anonymized aggregates.
  reviewers AS (
    SELECT DISTINCT pr.person_id
    FROM public.vendor_reviews rev
    JOIN public.people pr
      ON pr.claimed_by_user_id = rev.couple_user_id
     AND pr.deleted_at IS NULL
    WHERE rev.vendor_profile_id = p_vendor_profile_id
      AND rev.couple_user_id IS NOT NULL
      AND rev.rating_overall >= 4
  ),
  -- union of everyone who EXPLICITLY trusted the vendor (endorse OR review>=4).
  -- NB: `event_vendors` (booking) is intentionally absent — hiring ≠ endorsing.
  trusters AS (
    SELECT person_id FROM endorsers
    UNION
    SELECT person_id FROM reviewers
  ),
  -- ── connected aggregates, degree-scoped ───────────────────────────────────
  conn_1st AS (
    SELECT count(*)::int AS c
    FROM trusters t WHERE t.person_id IN (SELECT person_id FROM first_degree)
  ),
  conn_2nd AS (
    SELECT count(*)::int AS c
    FROM trusters t WHERE t.person_id IN (SELECT person_id FROM second_degree)
  ),
  -- 1st-degree opt-in vouchers, name-attributable (min-N EXEMPT — explicit
  -- consent to be named). Reviewers are excluded here: a review is not a vouch.
  named_vouchers AS (
    SELECT DISTINCT e.person_id, pp.display_name
    FROM endorsers e
    JOIN first_degree fd ON fd.person_id = e.person_id
    JOIN public.people pp ON pp.person_id = e.person_id
  ),
  -- ── vendor-wide TRUSTED context (not circle-scoped) ───────────────────────
  trust_ctx AS (
    SELECT
      (SELECT count(DISTINCT event_id)::int
         FROM public.vendor_recommendations
        WHERE vendor_profile_id = p_vendor_profile_id) AS endorse_events,
      (SELECT count(*)::int
         FROM public.vendor_reviews
        WHERE vendor_profile_id = p_vendor_profile_id) AS review_n,
      (SELECT round(avg(rating_overall)::numeric, 2)
         FROM public.vendor_reviews
        WHERE vendor_profile_id = p_vendor_profile_id) AS review_avg
  ),
  -- ── NEAR facts ────────────────────────────────────────────────────────────
  near AS (
    SELECT
      (vp.hq_region IS NOT NULL AND vp.hq_region = ev.region) AS region_match,
      EXISTS (
        SELECT 1 FROM public.vendor_coverages vc
        WHERE vc.vendor_profile_id = p_vendor_profile_id
          AND (ev.event_type = ANY (vc.event_types) OR cardinality(vc.event_types) = 0)
      ) AS covers_type
    FROM public.vendor_profiles vp
    CROSS JOIN (SELECT region, event_type FROM public.events WHERE event_id = p_event_id) ev
    WHERE vp.vendor_profile_id = p_vendor_profile_id
  )
  SELECT
    COALESCE((SELECT region_match FROM near), FALSE),
    COALESCE((SELECT covers_type  FROM near), FALSE),
    (SELECT endorse_events FROM trust_ctx),
    (SELECT review_avg     FROM trust_ctx),
    (SELECT review_n       FROM trust_ctx),
    -- MIN-N GATE on every aggregate: below floor => 0 (never a fingerprint).
    CASE WHEN public.min_n_ok((SELECT c FROM conn_1st), v_min_n)
         THEN (SELECT c FROM conn_1st) ELSE 0 END,
    CASE WHEN public.min_n_ok((SELECT c FROM conn_2nd), v_min_n)
         THEN (SELECT c FROM conn_2nd) ELSE 0 END,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('person_id', person_id, 'display_name', display_name))
         FROM named_vouchers),
      '[]'::jsonb
    );
END;
$$;

COMMENT ON FUNCTION public.trusted_circle_vendor_signal(UUID, UUID) IS
  'Person-spine PHASE 2 (counsel-gated; flag-off in prod). Private trusted-circle vendor signal for a host: NEAR (coverage/region) + TRUSTED (explicit endorsement/review only, NEVER booking) + CONNECTED (degree<=2, min-N-gated aggregates; 3rd degree never traversed). Trust is never purchasable — reads no subscription/boost data. SECURITY DEFINER but scoped to the caller''s own claimed person + owned event; returns only the host''s aggregates, never a browsable graph. Names a person only when they left an opt-in 1st-degree endorsement.';

-- Callable by authenticated app users; the function itself enforces the
-- host/person/event trust boundary internally (deny-by-default on mismatch).
REVOKE ALL ON FUNCTION public.trusted_circle_vendor_signal(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trusted_circle_vendor_signal(UUID, UUID) TO authenticated;
