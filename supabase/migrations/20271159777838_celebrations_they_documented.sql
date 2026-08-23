-- celebrations_they_documented
-- ============================================================================
-- "NO PHOTO, NO PROOF THE EVENT TOOK PLACE" — a shop's record is the days it
-- actually recorded.
--
-- ── THE OWNER RULING THIS IMPLEMENTS (2026-08-24, verbatim) ─────────────────
--   "we only count events that they had photos with. this is to make sure that
--    they record everything"
--   "if they were able to collect photos, that is registered as a completed
--    event. no photo, no proof the event took place."
--
-- Two things follow, and only two:
--   • THE UNIT IS THE EVENT, never the photo. Fifty photographs of one wedding
--     are one celebration documented. `COUNT(DISTINCT event_id)` — the same
--     grain every other number in this reader already uses, and the same reason:
--     a package lock cascades rows, a shoot cascades files, and counting either
--     would multiply the number by something nobody means.
--   • THE PHOTO IS THE EVIDENCE, not the subject. A booking can be created by
--     anybody in a few seconds; a photograph of the day is hard to fake. So the
--     count is also the anti-padding rule the owner reached for it — "make sure
--     that they record everything" is an incentive when the number is visible
--     and rises only with real work.
--
-- ── WHAT THIS DELIBERATELY DOES **NOT** DO ─────────────────────────────────
-- 🛑 IT DOES NOT TOUCH `event_vendors.completion_status`. That column carries a
-- five-rung machine — awaiting_vendor → vendor_marked → confirmed /
-- auto_confirmed / disputed — and the owner's own rule of 2026-08-21 is that
-- **`vendor_marked` is a claim, not a release**, with a disputed completion
-- never releasing at all. A capture is a supplier's own act. Letting one
-- advance that machine would hand a shop the power to certify its own job
-- finished, and the booking fee, the review window and the event-deletion
-- handshake all read that machine.
--
-- The phrase "registered as a completed event" is therefore read HERE as what
-- it plainly says on the surface we were discussing — which celebrations count
-- toward the shop's documented record — and NOT as a change to who decides a
-- job is done. If it was meant as the second thing too, that is a separate
-- change with real money attached and it needs saying out loud. Nothing in this
-- migration blocks it; nothing in it assumes it either.
--
-- ── NO MINIMUM-N FLOOR, AND THAT IS THE CONSIDERED ANSWER ──────────────────
-- The two aggregates added to this reader on 2026-08-24 (the option mix) carry
-- a K=3 floor twice over, because they describe OTHER PEOPLE'S choices. This
-- one describes the SHOP'S OWN work, exactly like `booked_count` — whose own
-- migration says the count "is NOT suppressed: 'booked 1×' leaks nothing about
-- WHICH event, and suppressing it would make the medal ladder unreadable". The
-- same is true here, and a floor would additionally defeat the owner's stated
-- purpose: a new shop would watch the number sit at nothing for its first two
-- celebrations, which is precisely when the nudge is supposed to work.
--
-- What the count DOES honour: `hidden_at IS NULL` (a capture the shop or an
-- admin has hidden is not evidence on show), `nsfw_checked = TRUE` (the
-- table's own surfacing rule — the route writes FALSE and flips it only after
-- the screen, and a posterless clip stays unscreened by design), archived
-- events, and `vendor_booking_is_arms_length()` — a shop photographing its own
-- owner's wedding has not documented a client's.
--
-- What it deliberately does NOT filter on is `consent_basis`. Every capture
-- today defaults to `pending_dpo_ruling`, and whether that lane may run at all
-- is the DPO's decision about COLLECTION, not a display rule for a count to
-- encode — a filter here would quietly make the number wrong the day the
-- ruling lands.
--
-- ⚠ IT IS A SHOP FACT ON A CARD, and the UI must say so. Captures are keyed on
-- `vendor_profile_id`, not on a service card, so every card of a shop reports
-- the same number — the same shape as the shop rating that already renders
-- beside it, and labelled the same way.
--
-- ── LIVE EFFECT TODAY: NONE, BY ARITHMETIC ─────────────────────────────────
-- Production holds **0** vendor captures across **2** shops, and the capture
-- surface itself is flag-dark (`VENDOR_PAPIC_CAPTURE_ENABLED`, default off) and
-- sits behind an unresolved DPO question about a supplier collecting guest
-- photos. So every card reports 0 and renders nothing. This ships the counting
-- rule; it does not open the lane that feeds it.
--
-- Replaced whole (CREATE OR REPLACE cannot patch a body). Everything except the
-- new `documented` CTE and the new key is the 20271159436100 body, lifted from
-- that file verbatim rather than retyped.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.service_card_records(
  p_service_ids UUID[]
)
RETURNS TABLE(
  vendor_service_id UUID,
  -- {"booked_count": int, "type_mix": [...], "ledger": [...],
  --  "option_sample_n": int, "option_mix": [{"label": text, "n": int}],
  --  "documented_events": int}
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
  -- Option-mix row cap. The card says what couples CHOOSE, not what it sells —
  -- an unbounded list is the option catalogue with numbers on it.
  v_option_max CONSTANT INTEGER := 6;

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
  ),
  -- ── NEW · the picks ──────────────────────────────────────────────────────
  pkg_bookings AS (
    -- Every arm's-length LOCKED booking of the package this card was minted
    -- for. Deliberately NOT joined through `event_vendors`: a package lock
    -- cascades rows that carry NO service_id, so the `booked` CTE above cannot
    -- see a package booking at all. This is its own sample, with its own N.
    --
    -- `status = 'locked'` and not the event_vendors status set: an unanswered
    -- lock request sits at 'considering', and a supplier who has not agreed has
    -- not been chosen by anybody.
    SELECT
      s.sid                     AS sid,
      evp.event_id              AS event_id,
      evp.locked_at             AS locked_at,
      evp.customizations_json   AS cj
    FROM svc s
    JOIN public.vendor_packages vp
      ON vp.vendor_service_id = s.sid
     AND vp.vendor_profile_id = s.vpid
    JOIN public.event_vendor_packages evp ON evp.package_id = vp.package_id
    JOIN public.events e ON e.event_id = evp.event_id
    WHERE s.vpid IS NOT NULL
      AND evp.status = 'locked'
      AND e.archived = FALSE
      AND public.vendor_booking_is_arms_length(s.vpid, evp.event_id, NULL)
  ),
  pkg_n AS (
    -- THE DENOMINATOR — events, never rows.
    SELECT b.sid, COUNT(DISTINCT b.event_id)::INTEGER AS n
    FROM pkg_bookings b
    GROUP BY b.sid
  ),
  picked AS (
    -- One row per (card, event, option) — DISTINCT so a booking that somehow
    -- lists an option twice still counts as one couple choosing it.
    SELECT DISTINCT
      b.sid                        AS sid,
      b.event_id                   AS event_id,
      opt ->> 'option_id'          AS option_id,
      opt ->> 'label'              AS label,
      b.locked_at                  AS locked_at
    FROM pkg_bookings b
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(b.cj -> 'pricing_snapshot' -> 'options') = 'array'
          THEN b.cj -> 'pricing_snapshot' -> 'options'
        ELSE '[]'::JSONB
      END
    ) AS opt
    -- A snapshot written by an older deploy, a support script, or nothing at
    -- all is JSONB like any other: check the shape, never cast and hope.
    WHERE jsonb_typeof(opt) = 'object'
      AND COALESCE(opt ->> 'option_id', '') <> ''
      AND COALESCE(opt ->> 'label', '') <> ''
  ),
  documented AS (
    -- ── OWNER RULING 2026-08-24 ──────────────────────────────────────────
    -- "we only count events that they had photos with. this is to make sure
    -- that they record everything" … "if they were able to collect photos,
    -- that is registered as a completed event. no photo, no proof the event
    -- took place."
    --
    -- So the unit is the EVENT, never the photo, and the photo is the
    -- EVIDENCE rather than the subject: a celebration counts once the shop
    -- has something visible from it, and a shop that recorded nothing counts
    -- nothing no matter how many bookings it holds. That is the incentive he
    -- asked for, and it is also the anti-padding rule — a booking anybody can
    -- create proves nothing, a photograph of the day is hard to fake.
    --
    -- ⚠ THIS IS A COUNT, NOT A STATE. It does not touch
    -- `event_vendors.completion_status`, whose five rungs
    -- (awaiting_vendor → vendor_marked → confirmed / auto_confirmed /
    -- disputed) carry the owner's 2026-08-21 rule that **a supplier's own
    -- claim is not a release**. A capture is a supplier's own act, so letting
    -- one advance that machine would let a shop certify its own job done and
    -- move the booking fee, the review window and the delete handshake with
    -- it. If the ruling above was also meant to change WHO decides a job is
    -- finished, that is a separate change and needs to be said out loud.
    --
    -- Grain: DISTINCT event_id, per SHOP — captures are keyed on the vendor
    -- profile, not on a card, so every card of a shop reports the same number
    -- and the UI must label it as a shop fact (the shop rating beside it
    -- already sets that precedent).
    SELECT s.sid, COUNT(DISTINCT vpc.event_id)::INTEGER AS n
    FROM svc s
    JOIN public.vendor_papic_captures vpc ON vpc.vendor_profile_id = s.vpid
    JOIN public.events e2 ON e2.event_id = vpc.event_id
    WHERE s.vpid IS NOT NULL
      -- A capture the shop or an admin has hidden is not evidence on show.
      AND vpc.hidden_at IS NULL
      -- …and neither is one that has not passed the screen. The table's OWN
      -- comment states the rule — "nsfw_checked must be TRUE to surface" — and
      -- the capture route writes FALSE first, flipping it only after the NSFW
      -- pass (a posterless clip stays unscreened forever, by design). Without
      -- this line a capture that failed to screen, or never got screened, would
      -- pad a number couples read. The count is a surface like any other.
      AND vpc.nsfw_checked = TRUE
      AND e2.archived = FALSE
      -- The same anti-padding rule every public number here honours: a shop
      -- photographing its own owner's wedding has not documented a client's.
      AND public.vendor_booking_is_arms_length(s.vpid, vpc.event_id, NULL)
    GROUP BY s.sid
  ),
  option_counts AS (
    SELECT
      p.sid,
      p.option_id,
      -- The label from the MOST RECENT lock that named it: frozen text, most
      -- current version. The live option row is not consulted — an option the
      -- vendor has since retired has none, and losing those lines would lose
      -- exactly what the record is for.
      (ARRAY_AGG(p.label ORDER BY p.locked_at DESC NULLS LAST))[1] AS label,
      COUNT(DISTINCT p.event_id)::INTEGER AS n
    FROM picked p
    GROUP BY p.sid, p.option_id
  )
  SELECT
    c.sid,
    jsonb_build_object(
      'booked_count', c.n,
      -- CELEBRATIONS DOCUMENTED — the shop's own record, evidenced by photos.
      -- NO MINIMUM-N FLOOR, deliberately, and for the same reason booked_count
      -- has none: this counts the SHOP'S OWN work rather than other people's
      -- choices, so "documented 1" discloses nothing about WHICH celebration —
      -- and the owner's stated purpose is an incentive to record everything,
      -- which a floor would switch off exactly when a new shop most needs to
      -- watch the number move.
      'documented_events',
        COALESCE((SELECT d.n FROM documented d WHERE d.sid = c.sid), 0),
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
        ELSE '[]'::JSONB END,
      -- THE DENOMINATOR, published only once it has itself cleared the floor —
      -- so it is never a statement about one or two identifiable couples. 0
      -- means "nothing to say", and the caller renders nothing.
      'option_sample_n',
        COALESCE(
          (
            SELECT CASE WHEN public.min_n_ok(pn.n, v_min_n) THEN pn.n ELSE 0 END
            FROM pkg_n pn WHERE pn.sid = c.sid
          ),
          0
        ),
      -- THE FLOOR, TWICE. The sample must clear it, and so must every single
      -- line: an option chosen by one couple out of five is a fact about one
      -- identifiable booking, sitting beside a ledger that gives its month and
      -- its size. Below the floor a line is ABSENT — not rounded, not "fewer
      -- than 3", which are both disclosures of their own.
      'option_mix',
        COALESCE(
          (
            SELECT jsonb_agg(x.obj)
            FROM (
              SELECT jsonb_build_object('label', oc.label, 'n', oc.n) AS obj
              FROM option_counts oc
              JOIN pkg_n pn ON pn.sid = oc.sid
              WHERE oc.sid = c.sid
                AND public.min_n_ok(pn.n, v_min_n)
                AND public.min_n_ok(oc.n, v_min_n)
              ORDER BY oc.n DESC, oc.label ASC
              LIMIT v_option_max
            ) x
          ),
          '[]'::JSONB
        )
    )
  FROM counts c;
END;
$$;

-- Grants unchanged — named explicitly rather than relying on FROM PUBLIC,
-- because Supabase's default privileges hand anon and authenticated their own
-- EXECUTE entries at creation time and those are not part of PUBLIC.

-- Grants unchanged — named explicitly rather than relying on FROM PUBLIC,
-- because Supabase's default privileges hand anon and authenticated their own
-- EXECUTE entries at creation time and those are not part of PUBLIC.
REVOKE ALL ON FUNCTION public.service_card_records(UUID[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_records(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_records(UUID[]) TO service_role;

COMMENT ON FUNCTION public.service_card_records(UUID[]) IS
  'THE CARD RECORD — the compiled history of a BATCH of vendor_services cards, for the /v/[slug] gallery and the vendor''s own services manager (owner-locked 2026-07-28). One row per requested id; unknown ids return the zero record. Each record is {booked_count, type_mix, ledger, option_sample_n, option_mix, documented_events}. PRIVACY ENVELOPE: (a) MINIMUM-N — below 3 arm''s-length events the card emits its count ALONE; (b) COMPLETED-MONTH LEDGER BOUNDARY; (c) PAST + BANDED + CAPPED. (d) THE PICKS (2026-08-24): option_mix reads the FROZEN pricing_snapshot through vendor_packages.vendor_service_id, floored TWICE — 3+ arm''s-length locked bookings AND 3+ couples per line, absent rather than rounded below either. (e) CELEBRATIONS DOCUMENTED (owner ruling 2026-08-24, "no photo, no proof the event took place"): documented_events counts DISTINCT events where this SHOP has a visible vendor_papic_capture — the event is the unit, the photo is the evidence, and it is deliberately UNFLOORED because it counts the shop''s OWN work, exactly like booked_count, and a floor would defeat the incentive the owner asked it to create. 🛑 documented_events is a COUNT, NOT A STATE: it does not touch event_vendors.completion_status, whose 2026-08-21 rule is that a supplier''s own claim is not a release. Honours hidden_at, archived events and vendor_booking_is_arms_length throughout. NOT granted to anon: both call sites are server-side.';

COMMIT;
