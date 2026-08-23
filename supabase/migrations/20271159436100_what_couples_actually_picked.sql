-- what_couples_actually_picked
-- ============================================================================
-- "WHAT COUPLES ACTUALLY PICKED" — the card compiles the choices, not just the
-- count.
--
-- The Card Record already tells a card's history: how often it was booked, the
-- event-type mix, an anonymized ledger. The veteran-card design (Card Family
-- stream, § 3b) asks it for one more thing — which of this card's own OPTIONS
-- couples chose — because that is the single most useful sentence a card can
-- say to the next couple reading it, and the most useful one a vendor can read
-- about their own card.
--
-- ── THE PREMISE THIS SHIP CORRECTS ──────────────────────────────────────────
-- The build note for this item (2026-07-29) says per-option picks are "NOT
-- queryable" and prescribes a NEW TABLE, `event_vendor_item_options`, written
-- by `lockPackage`. Measured 2026-08-24, that premise is stale by one day: the
-- pricing freeze (#3862, merged 2026-07-28) already writes every charged option
-- into `event_vendor_packages.customizations_json -> 'pricing_snapshot' ->
-- 'options'` as `{item_id, option_id, label, delta_centavos}`. The picks ARE
-- queryable, and they are queryable from the FROZEN record — the one a vendor's
-- later rename or retirement cannot rewrite.
--
-- So no new table. A projection table would have needed a second writer inside
-- `lockPackage` (a file another session owns this wave), and would have been a
-- second copy of a fact the snapshot already holds — free to drift, and drifting
-- silently. The one thing genuinely missing was a LINK.
--
-- ── (1) THE LINK THAT WAS ALWAYS MISSING ────────────────────────────────────
-- `vendor_packages` has no service column, so the one-service package that
-- `commitVendorService` mints for a card's ★ Customization step cannot be found
-- from the card. That gap is already written down in the code, twice, as the
-- reason a vendor cannot re-open a card to EDIT its options
-- (`services/actions.ts` and `lib/service-customization-draft.ts` both name this
-- exact column). It is added here because without it there is no honest way to
-- attribute a pick to a card — and matching by vendor + category instead would
-- credit ONE card with ANOTHER card's choices.
--
-- 🔒 AND IT IS OWNERSHIP-GUARDED, because a nullable FK is not a permission.
-- `vendor_packages` is writable by its owning vendor through PostgREST, and the
-- FK alone would happily accept ANOTHER vendor's `vendor_service_id` — pointing
-- your package at a competitor's card and publishing your picks on their
-- record. The row is yours; the field is not. A trigger refuses the mismatch,
-- because a CHECK cannot ask another table.
--
-- ⛔ WHAT THIS MIGRATION DELIBERATELY DOES NOT DO: it does not change whether a
-- minted package is `is_active`. That half of the same note is an OWNER
-- DECISION ("should that package publish with the service instead of landing
-- is_active:false?") and is left exactly as it ships.
--
-- ── (2) THE FLOOR IS APPLIED TWICE, AND BOTH TIMES IN SQL ───────────────────
-- This publishes an aggregate about other people's money, so the arms-length
-- and minimum-N rules that already govern this reader govern it too — and one
-- more:
--
--   (a) THE SAMPLE MUST CLEAR THE FLOOR. Fewer than K arm's-length locked
--       bookings of this card's package and `option_mix` comes back EMPTY. Same
--       K, same `min_n_ok()` gate, same reasoning as the type mix.
--   (b) EVERY LINE MUST CLEAR THE FLOOR ON ITS OWN. An option chosen by ONE
--       couple out of five is a fact about one identifiable booking sitting on
--       the same page as a ledger that gives its month and size. So a line is
--       emitted only when at least K couples chose it. Below that: nothing —
--       not a rounded number, not "fewer than 3". An absent line is the only
--       disclosure that discloses nothing.
--   (c) THE DENOMINATOR IS PUBLISHED, and it is safe because it exists only
--       when it is already ≥ K. Without it "4 couples added a second shooter"
--       has no scale; with it the card can say "4 of the last 6".
--
-- ⚠ THE COUNT IS OF EVENTS, NEVER OF ROWS. A package lock cascades one
-- `event_vendors` row per kept item, so counting rows would inflate every
-- number by the size of the package. `COUNT(DISTINCT event_id)` throughout,
-- the same grain the rest of this reader already uses.
--
-- ⚠ THE LABEL COMES FROM THE MOST RECENT LOCK THAT NAMED IT — frozen text, most
-- current version. Not the live `vendor_package_item_options` row: an option the
-- vendor has since retired has no live row at all, and the aggregate would lose
-- exactly the lines that say most about the card's history.
--
-- ── (3) NOTHING NEW IS EXPOSED ──────────────────────────────────────────────
-- No new grant. `service_card_records` keeps the grants it already has
-- (authenticated + service_role, never anon), and the new column rides
-- `vendor_packages`' existing table-level privileges — which is precisely why
-- the ownership trigger above is not optional.
--
-- Prod at the time of writing: 0 packages, 0 locked bookings, 0 picked options.
-- Every card is below the floor, so this ships visible to nobody — which is the
-- plan, not a defect.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE · DROP/CREATE TRIGGER.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- (1) THE LINK — a package may name the service card it was minted for.
--
-- NULLABLE and ON DELETE SET NULL: the great majority of packages are authored
-- standalone in the packages editor and belong to no single card, and deleting a
-- card must not delete a package a couple may have locked.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.vendor_packages
  ADD COLUMN IF NOT EXISTS vendor_service_id UUID
    REFERENCES public.vendor_services(vendor_service_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vendor_packages.vendor_service_id IS
  'The service CARD this package was minted for by the maker''s ★ Customization step, or NULL for a package authored standalone in the packages editor. Added 2026-08-24 so a card can compile which of its own options couples chose — before this there was no path at all from a card to its options, and the code named this exact column twice as the missing piece. ON DELETE SET NULL: deleting a card must not delete a package a couple may have locked. 🔒 A FK IS NOT A PERMISSION — vendor_packages is writable by its owning vendor, so trg_vendor_package_service_same_owner refuses a service belonging to a different vendor_profile_id; without it a vendor could point their package at a competitor''s card and publish their own picks on that card''s record.';

CREATE INDEX IF NOT EXISTS vendor_packages_vendor_service_id_idx
  ON public.vendor_packages (vendor_service_id)
  WHERE vendor_service_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- (2) THE OWNERSHIP GUARD — the row is yours, the field is not.
--
-- SECURITY DEFINER so the check reads `vendor_services` as the owner: an
-- attacker's own RLS view of that table would not show the victim's row, and a
-- guard that cannot SEE the row it is checking passes by accident.
--
-- NULL is always allowed (a standalone package). A non-NULL value must name a
-- service belonging to the SAME vendor profile as the package.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_package_service_same_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vendor_service_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.vendor_services vs
    WHERE vs.vendor_service_id = NEW.vendor_service_id
      AND vs.vendor_profile_id = NEW.vendor_profile_id
  ) THEN
    RAISE EXCEPTION
      'vendor_packages.vendor_service_id must name a service card owned by the same vendor'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_package_service_same_owner()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.vendor_package_service_same_owner() IS
  'Refuses a vendor_packages.vendor_service_id that names another vendor''s service card. The FK guarantees the card EXISTS, never that it is YOURS — and vendor_packages is writable by its owning vendor through PostgREST, so without this a vendor could attach their package to a competitor''s card and have their own option picks compiled onto that card''s public record. SECURITY DEFINER because the check must see a row the caller''s RLS would hide: a guard that cannot see what it is checking passes by accident. NULL is always allowed — most packages are authored standalone and belong to no card.';

-- Fires on INSERT **and** UPDATE. A guard attached to one verb is a guard
-- around one door: this project has already shipped a correct BEFORE UPDATE
-- check that delete-then-reinsert walked straight past.
DROP TRIGGER IF EXISTS trg_vendor_package_service_same_owner ON public.vendor_packages;
CREATE TRIGGER trg_vendor_package_service_same_owner
  BEFORE INSERT OR UPDATE OF vendor_service_id, vendor_profile_id
  ON public.vendor_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.vendor_package_service_same_owner();

-- ────────────────────────────────────────────────────────────────────────────
-- (3) THE READER — `service_card_records` grows two keys.
--
-- Replaced whole (CREATE OR REPLACE cannot patch a body). Everything above the
-- two new CTEs and the two new JSONB keys is the shipped 2026-07-28 body,
-- verified byte-for-byte against production with pg_get_functiondef before this
-- was written — not against the migration file, and not against its comment.
--
-- The signature, the grants, the batch cap, the arms-length rule, the
-- completed-month ledger boundary and the pax banding are all unchanged.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.service_card_records(
  p_service_ids UUID[]
)
RETURNS TABLE(
  vendor_service_id UUID,
  -- {"booked_count": int, "type_mix": [...], "ledger": [...],
  --  "option_sample_n": int, "option_mix": [{"label": text, "n": int}]}
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
REVOKE ALL ON FUNCTION public.service_card_records(UUID[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_records(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_records(UUID[]) TO service_role;

COMMENT ON FUNCTION public.service_card_records(UUID[]) IS
  'THE CARD RECORD — the compiled history of a BATCH of vendor_services cards, for the /v/[slug] gallery and the vendor''s own services manager (owner-locked 2026-07-28). One row per requested id; unknown ids return the zero record rather than nothing, so a probe cannot distinguish them from a card with no bookings. Batched because /v/[slug] is force-dynamic and renders a whole gallery; the array is capped at 50. Each record is {booked_count, type_mix, ledger, option_sample_n, option_mix}. PRIVACY ENVELOPE: (a) MINIMUM-N — below 3 arm''s-length events the card emits its count ALONE; (b) COMPLETED-MONTH LEDGER BOUNDARY — a row appears only once its whole month is history; (c) PAST + BANDED + CAPPED — estimated_pax is banded in SQL, ledger capped at 6. (d) ADDED 2026-08-24, THE PICKS: option_mix says which of the card''s own options couples chose, read from the FROZEN pricing_snapshot each lock wrote (never from live option rows, so a rename or retirement cannot rewrite history) and reached through the new vendor_packages.vendor_service_id link. Its floor applies TWICE — the sample needs 3+ arm''s-length locked bookings AND each line needs 3+ couples, so no line ever describes one identifiable booking; below either floor the line is ABSENT rather than rounded or bucketed, and option_sample_n is 0. Counts DISTINCT event_id everywhere, so a package lock''s cascaded rows cannot multiply a number. No name, user or event id, exact date, venue or price ever crosses the boundary. NOT granted to anon: both call sites are server-side.';

COMMIT;
