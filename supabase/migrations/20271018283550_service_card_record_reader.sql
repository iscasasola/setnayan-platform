-- service_card_record_reader
-- ============================================================================
-- THE CARD RECORD — a service card compiles its own history.
--
-- Owner-locked 2026-07-28 (DECISION_LOG row 2819, "build it now, let's keep
-- everything simple"): the couple-facing service card grows a compiled record
-- of the work it has done — "Booked N× on Setnayan", the event-type mix, an
-- ANONYMIZED ledger of recent events served, and milestone medals. The vendor
-- sees the same record on their own card ("take care of your card").
--
-- This migration ships ONE reader plus TWO internal helpers whose only purpose
-- is to stop rules that already exist from being written down one more time.
--
-- ── WHY A NEW READER AT ALL (what already ships, and why it cannot answer) ──
--   • public.vendor_completed_events — the shipped /v/[slug] "Track record".
--     Right shape, WRONG GRAIN: per VENDOR PROFILE, no service_id, and hard-
--     restricted to status IN ('delivered','complete') joined via
--     linked_vendor_profile_id. The card record is per SERVICE CARD and counts
--     BOOKED work, so the view cannot answer it.
--   • public.vendor_booking_monthly_series / vendor_source_attribution — these
--     already segment by service_id and already encode the "booked" status set,
--     but both are OWNERSHIP-GATED to current_vendor_profile_ids(), and the
--     vendor is not the only reader here.
--
-- ── THE PRIVACY ENVELOPE (RA 10173 posture: disclose aggregates, never
--    identities) ──
--   The reader may NEVER emit, and does not select:
--     · any couple / user name or id       · any event_id or event_vendors id
--     · any exact date (month + year only) · any venue or location
--     · any price                          · any exact head-count
--   What it DOES emit, per card:
--     · booked_count — one integer
--     · type_mix     — {event_type → count}, an aggregate over all booked work
--     · ledger       — at most 6 rows of (event_type, 'YYYY-MM', pax BAND)
--
--   THREE GATES narrow that further, each closing a real inference path:
--
--   (a) MINIMUM-N FLOOR, K = 3 (v_min_n below). Below the floor the reader
--       emits booked_count ALONE — type_mix and ledger come back EMPTY. WHY:
--       with one booked event the "aggregates" ARE that single private event's
--       record, and on /v/[slug] they render feet away from a reviews section
--       that names the couple, so (type · month · size) becomes attributable by
--       simple adjacency. Pre-launch this is the NORMAL case, not an edge one —
--       every card in prod today sits at N ∈ {0..3}. The floor is applied HERE,
--       in SQL, because the envelope must not depend on any caller remembering
--       it. Reuses the shipped public.min_n_ok() gate rather than restating the
--       comparison. NOTE the count itself is NOT suppressed: "booked 1×" leaks
--       nothing about WHICH event, and suppressing it would make the medal
--       ladder unreadable.
--
--   (b) COMPLETED-MONTH LEDGER BOUNDARY (v_ledger_before below). A ledger row
--       appears only once its whole MONTH is history — never merely once the
--       day has passed. WHY: `event_date <= today` would publish a row from
--       midnight Manila ON the event day, so anyone polling this reader daily
--       learns the EXACT event_date from the day the row first appears —
--       recovering precisely the granularity the 'YYYY-MM' format exists to
--       withhold. With a month boundary the first possible appearance is the
--       1st of the following month for EVERY event in that month, so the
--       appearance date carries no information beyond the month already shown.
--
--   (c) PAST + BANDED + CAPPED. Future bookings count toward booked_count but
--       never become a ledger row (a forthcoming event's type/month/size for a
--       named vendor is a live, plannable fact about a private event, not
--       history). events.estimated_pax is host-provided and was implicated in
--       the 2026-07-26 security review, so it is collapsed to one of four
--       coarse bands IN SQL and returned as 'unknown' when NULL — the band
--       thresholds live HERE and only here; TypeScript owns the labels, so the
--       numbers are never restated across the wire. The ledger is capped at 6:
--       a long ledger is a timeline, a short one is a record.
--
-- ── ANTI-PADDING IS NOT OPTIONAL HERE ──
--   "Booked N× on Setnayan" is a public trust signal, which makes it exactly
--   the kind of number a vendor can inflate by booking themselves. The platform
--   already decided this: vendor_completed_events (20270321252758) and
--   vendor_trusted_review_stats (20270516500000) both gate their public numbers
--   behind the same owner / team / internal-account / self-comp exclusion set.
--   This reader honours that same rule — via helper (2) below rather than a
--   third hand-typed copy of it.
--
-- ── ONE BOOKING IS ONE EVENT, NOT ONE ROW ──
--   Counting event_vendors rows would be wrong by a multiple. `lockPackage`
--   cascades ONE row per kept package item (package_role='covered') alongside
--   the single money-carrying 'anchor' row, so a 9-line package books once and
--   writes ten rows. The platform's own answer is COUNT(DISTINCT event_id) —
--   stated as the free-tier cap rule in 20271009160000. This reader uses that
--   same grain, which is also the owner's framing: every EVENT this card
--   creates is documented on the card.
--
-- ── BATCHED BY DESIGN, AND CAPPED ──
--   The reader takes an ARRAY of card ids and returns one row per id. /v/[slug]
--   renders a whole gallery of cards on a force-dynamic page; a per-card
--   function would have meant one round-trip per card on every uncached public
--   request. The array is capped (v_max_ids) so a caller cannot turn one call
--   into an unbounded scan.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + REVOKE/GRANT. No table, no view,
-- no policy, no column, no index.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- (1) HELPER — the "booked" status set, given a name.
--
-- This exact four-value list is currently hand-typed in FOUR places:
-- vendor_source_attribution, vendor_booking_monthly_series and
-- vendor_booking_daily_series (SQL), plus BOOKED_EVENT_VENDOR_STATUSES in
-- lib/vendor-funnel.ts. This function is the single named home for it, so this
-- feature adds a USE rather than a fifth copy.
--
-- ⚠ The TypeScript constant additionally lists 'paid'. That is not a value of
-- the public.vendor_status enum (considering / shortlisted / contracted /
-- deposit_paid / delivered / complete), so every SQL copy has correctly
-- intersected it away. This function preserves that intersection exactly — it
-- is the SQL-side truth and changes no behaviour anywhere.
--
-- FOLLOW-UP (deliberately NOT done here): repoint the three shipped RPCs at
-- this function. Each would need its whole body replicated verbatim through a
-- CREATE OR REPLACE, which is a larger and riskier diff than this feature
-- warrants — and those RPCs are money-adjacent. Filed, not smuggled in.
--
-- No grant: internal only. It is reached exclusively from inside the SECURITY
-- DEFINER reader below, where privilege checks run as the function owner.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booked_event_vendor_statuses()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT ARRAY['contracted', 'deposit_paid', 'delivered', 'complete']::TEXT[];
$$;

REVOKE ALL ON FUNCTION public.booked_event_vendor_statuses()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.booked_event_vendor_statuses() IS
  'The "booked" event_vendors status set, given a name: contracted / deposit_paid / delivered / complete — a real commercial commitment, not a shortlist or a save. Mirrors BOOKED_EVENT_VENDOR_STATUSES in lib/vendor-funnel.ts intersected with the live public.vendor_status enum (the TS constant also lists ''paid'', which is not an enum value). Internal only — REVOKEd from every browser role; reachable solely from inside SECURITY DEFINER readers. Added 2026-07-28 so the Card Record uses this list instead of becoming its fifth hand-typed copy.';

-- ────────────────────────────────────────────────────────────────────────────
-- (2) HELPER — the arm's-length / anti-self-dealing exclusion set, given a name.
--
-- Extraction of the rule already enforced, inline, by BOTH
-- public.vendor_completed_events (20270321252758) and
-- public.vendor_trusted_review_stats (20270516500000). A booking is arm's
-- length unless the vendor is, in effect, on both sides of it:
--     (a) the vendor's OWNER sits on the event's couple roster;
--     (b) any of the vendor's TEAM sits on the event's couple roster;
--     (c) an INTERNAL account that owns or sits on this vendor's team sits on
--         the event's couple roster;
--     (d) an active vendor_self_comp grant flags this booking or its creator.
--
-- The union of the two shipped copies: (d) keeps the event-vendor branch
-- (cg.order_id = the event_vendors id) that vendor_completed_events carries and
-- the review copy has no row to match against. p_event_vendor_id is optional so
-- a caller without one still gets (a)-(c) plus the creator branch of (d).
--
-- FOLLOW-UP (deliberately NOT done here): repoint the view and the materialized
-- view at this helper so the rule is written down ONCE rather than three times.
-- Rewriting a live anon-readable view and a matview that two shipped surfaces
-- read is its own PR with its own blast radius; this migration takes on the
-- duplicate-rule debt only for the code it introduces.
--
-- SECURITY DEFINER because every table it touches is RLS-protected and the rule
-- must evaluate identically no matter who is asking — the same reason the
-- shipped view is declared security_invoker = false.
--
-- No grant: internal only.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_booking_is_arms_length(
  p_vendor_profile_id UUID,
  p_event_id          UUID,
  p_event_vendor_id   UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- (a) the vendor's owner is on the event's couple roster
    NOT EXISTS (
      SELECT 1
      FROM public.event_members em
      JOIN public.vendor_profiles vp
        ON vp.vendor_profile_id = p_vendor_profile_id
      WHERE em.event_id = p_event_id
        AND em.member_type = 'couple'
        AND em.user_id = vp.user_id
    )
    -- (b) any vendor team member is on the event's couple roster
    AND NOT EXISTS (
      SELECT 1
      FROM public.event_members em
      JOIN public.vendor_team_members vtm
        ON vtm.user_id = em.user_id
       AND vtm.vendor_profile_id = p_vendor_profile_id
      WHERE em.event_id = p_event_id
        AND em.member_type = 'couple'
    )
    -- (c) an internal account that owns or sits on this vendor's team is on the
    --     event's couple roster
    AND NOT EXISTS (
      SELECT 1
      FROM public.event_members em
      JOIN public.users u ON u.user_id = em.user_id
      WHERE em.event_id = p_event_id
        AND em.member_type = 'couple'
        AND u.is_internal = TRUE
        AND (
          EXISTS (
            SELECT 1 FROM public.vendor_profiles vp2
            WHERE vp2.vendor_profile_id = p_vendor_profile_id
              AND vp2.user_id = u.user_id
          )
          OR EXISTS (
            SELECT 1 FROM public.vendor_team_members vtm2
            WHERE vtm2.vendor_profile_id = p_vendor_profile_id
              AND vtm2.user_id = u.user_id
          )
        )
    )
    -- (d) an active vendor_self_comp grant flags this booking or its creator
    AND NOT EXISTS (
      SELECT 1
      FROM public.comp_grants cg
      WHERE cg.vendor_profile_id = p_vendor_profile_id
        AND cg.source = 'vendor_self_comp'
        AND (
          (p_event_vendor_id IS NOT NULL AND cg.order_id = p_event_vendor_id)
          OR EXISTS (
            SELECT 1 FROM public.event_members em3
            WHERE em3.event_id = p_event_id
              AND em3.member_type = 'couple'
              AND em3.user_id = cg.created_by_user_id
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.vendor_booking_is_arms_length(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.vendor_booking_is_arms_length(UUID, UUID, UUID) IS
  'TRUE when a booking is genuinely arm''s length — the vendor is not on both sides of it. Named extraction of the exclusion set already enforced inline by public.vendor_completed_events and public.vendor_trusted_review_stats: excludes events where the vendor owner (a), a team member (b), or an internal account tied to this vendor (c) sits on the couple roster, or where an active vendor_self_comp grant flags the booking or its creator (d). SECURITY DEFINER so the rule evaluates identically for every caller (same reason the shipped view is security_invoker=false). Internal only — REVOKEd from every browser role. Added 2026-07-28 for the Card Record; the view and the matview still carry their own inline copies (follow-up).';

-- ────────────────────────────────────────────────────────────────────────────
-- (3) THE READER — public.service_card_records(p_service_ids)
--
-- BATCHED: one row per requested card id, so a gallery page costs ONE call.
-- Unknown ids still come back, carrying the zero record — a probe cannot tell a
-- real card with no bookings from an id that does not exist.
--
-- Grain: each element is a vendor_services id. The vendor profile behind each
-- one is DERIVED, never passed in, so a caller cannot pair a card with someone
-- else's profile.
--
-- No is_active gate: the vendor's own services manager must be able to show the
-- record of a paused or draft card. Since every returned value is a
-- de-identified aggregate under the three gates described at the top — and the
-- function is not anon-callable — this discloses nothing a published card
-- would not.
--
-- Defensive DROP of the earlier single-card signature: this migration is the
-- only place that ever created it, but a worktree that applied an in-flight
-- copy would otherwise keep an ungranted stray around.
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.service_card_record(UUID);

CREATE OR REPLACE FUNCTION public.service_card_records(
  p_service_ids UUID[]
)
RETURNS TABLE(
  vendor_service_id UUID,
  -- {"booked_count": int, "type_mix": [...], "ledger": [...]}
  record            JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  -- Minimum-N floor. Below this a card emits its COUNT only: no type mix, no
  -- ledger. See gate (a) in the header for why 3, and why it is enforced here
  -- rather than in any caller.
  v_min_n      CONSTANT INTEGER := 3;
  -- Hard cap on batch size — a caller cannot amplify one call into an unbounded
  -- scan. A gallery page has a handful of cards; 50 is generous.
  v_max_ids    CONSTANT INTEGER := 50;
  -- Ledger row cap. A long ledger is a timeline; a short one is a record.
  v_ledger_max CONSTANT INTEGER := 6;

  -- "Today" in Asia/Manila. Used only to derive the month boundary below.
  v_today DATE := (now() AT TIME ZONE 'Asia/Manila')::date;
  -- COMPLETED-MONTH BOUNDARY — gate (b). An event is ledgerable only once its
  -- whole month is in the past, so the day a row first appears reveals nothing
  -- finer than the 'YYYY-MM' the row already states.
  v_ledger_before DATE := date_trunc('month', v_today)::date;

  v_ids UUID[];
BEGIN
  -- Nothing asked for, or more than the cap → empty result, never an error.
  IF p_service_ids IS NULL
     OR COALESCE(array_length(p_service_ids, 1), 0) = 0
     OR array_length(p_service_ids, 1) > v_max_ids THEN
    RETURN;
  END IF;

  v_ids := ARRAY(SELECT DISTINCT x FROM unnest(p_service_ids) AS x WHERE x IS NOT NULL);
  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH req AS (
    -- Every id the caller asked about, existing or not.
    SELECT x AS sid FROM unnest(v_ids) AS x
  ),
  svc AS (
    -- ...resolved to its owning vendor. A miss leaves vpid NULL, which the
    -- booked CTE's WHERE then drops → the zero record.
    SELECT r.sid, vs.vendor_profile_id AS vpid
    FROM req r
    LEFT JOIN public.vendor_services vs ON vs.vendor_service_id = r.sid
  ),
  booked AS (
    -- ONE ROW PER (card, EVENT) — DISTINCT collapses the package cascade, and a
    -- card booked twice within one event still documents that event once.
    -- This CTE is the only place raw rows are touched; everything below it is
    -- an aggregate.
    SELECT DISTINCT
      s.sid              AS sid,
      ev.event_id        AS event_id,
      e.event_type::TEXT AS event_type,
      e.event_date       AS event_date,
      -- Pax banding happens HERE so the exact head-count never leaves SQL.
      CASE
        WHEN e.estimated_pax IS NULL THEN 'unknown'
        WHEN e.estimated_pax <  50   THEN 'under_50'
        WHEN e.estimated_pax <  100  THEN '50_99'
        WHEN e.estimated_pax <  200  THEN '100_199'
        ELSE                              '200_plus'
      END AS pax_band
    FROM svc s
    JOIN public.event_vendors ev ON ev.service_id = s.sid
    JOIN public.events e ON e.event_id = ev.event_id
    WHERE s.vpid IS NOT NULL
      AND ev.status::TEXT = ANY (public.booked_event_vendor_statuses())
      -- A superseded pick (archived when a package lock replaced it) is not a
      -- booking, and a fraud-voided one must never pad a public trust signal.
      AND ev.archived_at IS NULL
      AND ev.voided_by_fraud = FALSE
      AND e.archived = FALSE
      AND public.vendor_booking_is_arms_length(s.vpid, ev.event_id, ev.vendor_id)
  ),
  counts AS (
    SELECT s.sid, COUNT(b.event_id)::INTEGER AS n
    FROM svc s
    LEFT JOIN booked b ON b.sid = s.sid
    GROUP BY s.sid
  ),
  mix AS (
    SELECT b.sid, b.event_type, COUNT(*)::INTEGER AS n
    FROM booked b
    GROUP BY b.sid, b.event_type
  ),
  ranked AS (
    -- Ledgerable rows: dated, and in a month that is already history.
    SELECT
      b.sid,
      b.event_type,
      to_char(b.event_date, 'YYYY-MM') AS month_year,
      b.pax_band,
      ROW_NUMBER() OVER (PARTITION BY b.sid ORDER BY b.event_date DESC) AS rn
    FROM booked b
    WHERE b.event_date IS NOT NULL
      AND b.event_date < v_ledger_before
  )
  SELECT
    c.sid,
    jsonb_build_object(
      'booked_count', c.n,
      -- Below the minimum-N floor the aggregates ARE one private event, so both
      -- collections come back empty. Reuses the shipped min_n_ok() gate rather
      -- than restating the comparison.
      'type_mix',
        CASE WHEN public.min_n_ok(c.n, v_min_n) THEN
          COALESCE(
            (
              SELECT jsonb_agg(jsonb_build_object('event_type', m.event_type, 'n', m.n)
                               ORDER BY m.n DESC, m.event_type ASC)
              FROM mix m WHERE m.sid = c.sid
            ),
            '[]'::JSONB
          )
        ELSE '[]'::JSONB END,
      'ledger',
        CASE WHEN public.min_n_ok(c.n, v_min_n) THEN
          COALESCE(
            (
              SELECT jsonb_agg(jsonb_build_object(
                       'event_type', r.event_type,
                       'month_year', r.month_year,
                       'pax_band',   r.pax_band)
                     ORDER BY r.rn)
              FROM ranked r WHERE r.sid = c.sid AND r.rn <= v_ledger_max
            ),
            '[]'::JSONB
          )
        ELSE '[]'::JSONB END
    )
  FROM counts c;
END;
$$;

-- Name the roles, do not rely on FROM PUBLIC: Supabase's default privileges
-- hand anon and authenticated their own explicit EXECUTE entries at creation
-- time, and those are not part of PUBLIC (verified against prod 2026-07-26 —
-- five functions written with the FROM PUBLIC form were still anon-callable).
--
-- NOT granted to anon. Both shipped call sites are server-side: /v/[slug] reads
-- through the service-role client while rendering, and the vendor's services
-- manager reads as the signed-in vendor. No browser calls this directly, so
-- anon EXECUTE would be surface with no consumer — and it is exactly the
-- surface that would let a stranger enumerate card ids to probe DRAFT and
-- PAUSED cards. Dropping it costs nothing and closes that at the grant rather
-- than in a predicate.
REVOKE ALL ON FUNCTION public.service_card_records(UUID[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_records(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_records(UUID[]) TO service_role;

COMMENT ON FUNCTION public.service_card_records(UUID[]) IS
  'THE CARD RECORD — the compiled history of a BATCH of vendor_services cards, for the /v/[slug] gallery and the vendor''s own services manager (owner-locked 2026-07-28). One row per requested id; unknown ids return the zero record rather than nothing, so a probe cannot distinguish them from a card with no bookings. Batched because /v/[slug] is force-dynamic and renders a whole gallery — a per-card function meant one round-trip per card per uncached request; the array is capped at 50 so a caller cannot amplify one call into an unbounded scan. Each record is {booked_count, type_mix, ledger}. PRIVACY ENVELOPE, three gates: (a) MINIMUM-N — below 3 arm''s-length events the card emits its count ALONE (type_mix and ledger empty), because at N=1 the "aggregates" are one private event''s record sitting on the same page as a reviews section that names the couple; enforced via the shipped min_n_ok(); (b) COMPLETED-MONTH LEDGER BOUNDARY — a row appears only once its whole month is history, so the day it first appears cannot reveal the exact event_date that the ''YYYY-MM'' format exists to withhold; (c) PAST + BANDED + CAPPED — future bookings count but never ledger, estimated_pax is banded in SQL and never returned raw, ledger capped at 6. No name, user or event id, exact date, venue or price ever crosses the boundary. Counts DISTINCT event_id, the same grain as the free-tier cap rule, so a package lock''s cascaded covered rows cannot multiply the number. Anti-padding: honours public.vendor_booking_is_arms_length() — the same owner/team/internal/self-comp exclusion set that gates the public completed-events and trusted-review numbers — and skips archived + fraud-voided bookings. NOT granted to anon: both call sites are server-side (service_role / authenticated), so anon EXECUTE would be surface with no consumer and the enumeration path to draft and paused cards.';

COMMIT;
