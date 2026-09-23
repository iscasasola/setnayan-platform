-- ═══════════════════════════════════════════════════════════════════════════
-- THE COUPLE'S HAND-OUT COMES OFF — no camera holds credits the couple gave it
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚖ Owner, 2026-09-16: *"no dedicated shots individually."* Asked again on
-- 2026-09-22, in a form that separates the two mechanisms — *"On 2026-09-16 you
-- retired the couple handing credits to one camera's QR. That control is still
-- live today — should it come off, or did 'should stay' mean it stays too?"* —
-- he chose **off**.
--
-- 🔑 WHY THE QUESTION HAD TO BE ASKED TWICE. An earlier framing said "dedicated
-- camera credits", which names TWO mechanisms at once, and the answer to it
-- ("should stay") was about the FREE camera grant. A question that cannot
-- separate two things gets an answer that settles neither and then reads as if
-- it settled both.
--
-- ── ⚠ WHAT STAYS, AND IT IS NOT A DETAIL ──────────────────────────────────
-- `papic_event_point_grants.seat_id` — the FREE Papic One camera grant — STAYS.
-- Measured in prod 2026-09-23: 4 rows, 20 points, every one `source =
-- 'camera_grant'`. A camera still carries a balance of its own; what is gone is
-- the COUPLE handing one out. The two share no machinery:
-- `papic_grant_camera_points` references neither `papic_dedicate_shots` nor
-- `papic_seat_allocations` (checked against `pg_get_functiondef`, both false).
-- `paparazzi_seats` (24 rows) stays — a seat is the camera CLAIM, not an
-- allowance. `papic_seat_grant_releases` stays — that is the GUEST giving her
-- own bought credits back, a different direction and a different table.
--
-- ── 🛑 NOTHING IS STRANDED AND NO COUPLE LOSES A CREDIT ────────────────────
-- Verified against production immediately before writing this, not taken from a
-- handoff: `papic_seat_allocations` **0 rows, 0 points**. The table has never
-- held a row on any live celebration. If that is not still true when this runs,
-- the guard in § 1 refuses to apply rather than deleting somebody's credits.
--
-- ── WHY THE TABLE GOES TOO, RATHER THAN SITTING EMPTY ─────────────────────
-- `papic_dedicate_shots` is its ONLY writer. Dropping the function alone leaves
-- `table-no-writer: papic_seat_allocations`, which `ugat-both-ends` refuses —
-- and that guard explicitly forbids a baseline line for it. Measured by writing
-- the DROP and running the guard, not predicted.
--
-- ── THE ARITHMETIC IS PROVABLY UNCHANGED ──────────────────────────────────
-- Three live functions read the table. Every one reads it as a term that is
-- **0 on every row that exists**, so removing it cannot move a number:
--
--   papic_event_pool_status       v_total := base + granted − alloc + released
--                                 →        := base + granted + released
--   papic_seat_dedicated_points   grants + alloc − released
--                                 →  grants − released
--   papic_seat_releasable_grants  LEAST( GREATEST(0, grants−released−spent),
--                                        GREATEST(0, (grants+alloc−released)−spent) )
--                                 → with alloc gone the two arms are IDENTICAL,
--                                   so LEAST(x,x) = x and the whole expression
--                                   collapses to the first arm, unchanged.
--
-- ⚠ THE `− spent` IN THAT FIRST ARM IS LOAD-BEARING AND IS KEPT. Its own
-- docblock records why: without it a camera holding a guest's 137 AND a 200
-- hand-out could give back all 137 while 41 were already spent. The hand-out is
-- what is going; the attribution rule is not.
--
-- 🚨 EVERY BODY BELOW WAS TAKEN FROM `pg_get_functiondef` IN PRODUCTION, NOT
-- FROM MIGRATION TEXT. A `CREATE OR REPLACE` is a full overwrite, so restating
-- one from an older migration silently reverts the newest — that is exactly how
-- `+ COALESCE(v_released, 0)` was deleted on 2026-09-22 and the shared pot
-- stopped rising when a guest gave credits back.
--
-- IDEMPOTENT. One guard, three replacements, one function drop, one table drop.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 · REFUSE TO DELETE ANYBODY'S CREDITS
-- ---------------------------------------------------------------------------
-- A DROP is irreversible in a way a code change is not. The zero-rows figure is
-- re-checked HERE, at apply time, against the real database — a measurement
-- taken by a session hours earlier is a claim, not a fact.

DO $$
DECLARE v_rows BIGINT; v_pts BIGINT;
BEGIN
  IF to_regclass('public.papic_seat_allocations') IS NULL THEN
    RAISE NOTICE 'papic_seat_allocations already gone — nothing to do';
    RETURN;
  END IF;
  EXECUTE 'SELECT COUNT(*), COALESCE(SUM(points),0) FROM public.papic_seat_allocations'
    INTO v_rows, v_pts;
  IF v_rows > 0 THEN
    RAISE EXCEPTION
      'refusing to apply: papic_seat_allocations holds % row(s) totalling % credits. Those are credits a couple handed to a camera, and dropping the table would destroy them. Hand them back to the shared pot first, then re-run.',
      v_rows, v_pts;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2 · The pool total stops subtracting a term that is always zero
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_event_pool_status(p_event_id uuid)
 RETURNS TABLE(applies boolean, guest_count integer, base_points integer, granted_points integer, total_points integer, used_points integer, remaining_points integer, soft_stop_at integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_per_guest  INTEGER;
  v_floor      INTEGER;
  v_ceiling    INTEGER;
  v_soft_pct   INTEGER;
  v_event_type TEXT;
  v_guests     INTEGER;
  v_base       INTEGER;
  v_granted    INTEGER;
  v_released   INTEGER;
  v_total      INTEGER;
  v_used       INTEGER;
  v_has_flat   BOOLEAN;
BEGIN
  v_has_flat := public.papic_event_has_flat_pass(p_event_id);

  -- SHARED grants only. seat_id NOT NULL is a camera's own balance.
  SELECT COALESCE(SUM(points), 0)::INTEGER
    INTO v_granted
    FROM public.papic_event_point_grants
   WHERE event_id = p_event_id
     AND seat_id IS NULL;

  IF NOT v_has_flat AND COALESCE(v_granted, 0) <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  -- ⛔ `v_alloc` WAS HERE — what the host had handed out to individual cameras.
  -- The hand-out is retired (owner 2026-09-16, re-confirmed 2026-09-22) and
  -- `papic_seat_allocations` is dropped below. The term was 0 on every row that
  -- ever existed, so the total is unchanged.

  -- What guests have given back out of their OWN bought credits. Those were
  -- never the event's before; they are now.
  --
  -- ⚠ THIS IS NOT THE HAND-OUT AND MUST NOT GO WITH IT. Opposite direction,
  -- different table, live writer (`papic_release_seat_grants`). Deleting this
  -- term once already stopped the pot rising on a give-back.
  SELECT COALESCE(SUM(points), 0)::INTEGER
    INTO v_released
    FROM public.papic_seat_grant_releases
   WHERE event_id = p_event_id;

  SELECT e.event_type INTO v_event_type
    FROM public.events e WHERE e.event_id = p_event_id;

  SELECT s.points_per_guest, s.floor_points, s.ceiling_points
    INTO v_per_guest, v_floor, v_ceiling
    FROM public.papic_event_pool_sizing(v_event_type) s;

  SELECT soft_stop_pct INTO v_soft_pct
    FROM public.papic_event_pool_config
   WHERE config_key = 'default';

  IF v_has_flat THEN
    v_guests := COALESCE(public.papic_event_guest_headcount(p_event_id), 0);
    v_base := LEAST(v_ceiling, GREATEST(v_floor, v_guests * v_per_guest));
  ELSE
    v_guests := 0;
    v_base := 0;
  END IF;

  v_total := v_base + COALESCE(v_granted, 0) + COALESCE(v_released, 0);

  SELECT COALESCE(points_used, 0)
    INTO v_used
    FROM public.papic_event_pool_usage
   WHERE event_id = p_event_id;
  v_used := COALESCE(v_used, 0);

  RETURN QUERY SELECT
    TRUE,
    v_guests,
    v_base,
    COALESCE(v_granted, 0),
    v_total,
    v_used,
    GREATEST(0, v_total - v_used),
    (v_total * v_soft_pct) / 100;
END;
$function$;

REVOKE ALL ON FUNCTION public.papic_event_pool_status(UUID)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3 · A camera's own balance is its grants, less what its guest gave back
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.papic_seat_dedicated_points(p_seat_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- ⛔ `+ papic_seat_allocations.points` WAS HERE — the couple's hand-out,
  -- retired. What remains is the FREE camera grant, which stays.
  SELECT GREATEST(0, (
    COALESCE((SELECT SUM(points) FROM public.papic_event_point_grants
               WHERE seat_id = p_seat_id), 0)
  - COALESCE((SELECT points FROM public.papic_seat_grant_releases
               WHERE seat_id = p_seat_id), 0)
  ))::INTEGER;
$function$;

-- ---------------------------------------------------------------------------
-- 4 · The two ceilings on a give-back become one, because they were identical
-- ---------------------------------------------------------------------------
-- The shipped body was LEAST of two arms. With the hand-out gone the second arm
-- is `GREATEST(0, (grants - released) - spent)` — the first arm exactly — so
-- LEAST(x, x) = x. This is the same expression, written once.
--
-- ⚠ `- spent` IS KEPT, AND IT IS NOT REDUNDANT. Her spend is attributed to her
-- own purchase FIRST (`papic_guest_self_funded_spend`, `LEAST(spent, paid)`),
-- so without it she could give back credits she had already shot.
CREATE OR REPLACE FUNCTION public.papic_seat_releasable_grants(p_seat_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH s AS (
    SELECT
      COALESCE((SELECT SUM(points) FROM public.papic_event_point_grants
                 WHERE seat_id = p_seat_id), 0)::INTEGER AS grants,
      COALESCE((SELECT points FROM public.papic_seat_grant_releases
                 WHERE seat_id = p_seat_id), 0)::INTEGER AS released,
      COALESCE((SELECT points_used FROM public.papic_seat_point_usage
                 WHERE seat_id = p_seat_id), 0)::INTEGER AS spent
  )
  SELECT GREATEST(0, s.grants - s.released - s.spent)::INTEGER
    FROM s;
$function$;

-- ---------------------------------------------------------------------------
-- 5 · The mover, then the table
-- ---------------------------------------------------------------------------
-- In this order: the function is the table's only writer, so dropping it first
-- means the table is provably unwritable for the instant between the two.

DROP FUNCTION IF EXISTS public.papic_dedicate_shots(UUID, UUID, INTEGER, UUID);
DROP TABLE IF EXISTS public.papic_seat_allocations;

-- ---------------------------------------------------------------------------
-- 6 · Refuse to leave a reference behind
-- ---------------------------------------------------------------------------
-- 🔑 A DROP THAT LEAVES A READER IS A BROKEN FUNCTION NOBODY CALLS UNTIL THEY
-- DO. `DROP TABLE` without CASCADE already refuses a hard dependency, but a
-- plpgsql body is only text to Postgres and is NOT a dependency — so a function
-- that still names the table would survive this migration and fail at runtime.
DO $$
DECLARE v_left TEXT;
BEGIN
  -- ⚠ `prokind = 'f'` IS REQUIRED, NOT TIDINESS. `pg_get_functiondef` RAISES on
  -- an aggregate ("array_agg is an aggregate function"), so an unfiltered scan
  -- of pg_proc fails the whole migration on a function that has nothing to do
  -- with this change. Found by the replay, not reasoned.
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname)
    INTO v_left
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prokind = 'f'
     -- ⚠ STRIP `--` COMMENTS FIRST. `pg_get_functiondef` returns the body
     -- INCLUDING its prose, and the two functions rewritten above deliberately
     -- say `papic_seat_allocations` in a comment explaining what was removed.
     -- Matching the raw text convicted them of the thing they document NOT
     -- doing — the guard read prose as code, which is the same mistake its
     -- sibling test made an hour earlier.
     AND regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
           ILIKE '%papic_seat_allocations%';
  IF v_left IS NOT NULL THEN
    RAISE EXCEPTION
      'refusing to apply: these functions still reference the dropped table and would fail at runtime: %',
      v_left;
  END IF;

  IF to_regclass('public.papic_seat_allocations') IS NOT NULL THEN
    RAISE EXCEPTION 'refusing to apply: papic_seat_allocations is still present';
  END IF;

  -- ⚠ AND THE FREE CAMERA GRANT MUST STILL BE THERE. It is what the owner said
  -- "should stay", and it is the thing most easily taken out by accident here.
  IF to_regclass('public.papic_event_point_grants') IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: the free camera grant ledger is gone';
  END IF;
  IF to_regclass('public.paparazzi_seats') IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: paparazzi_seats is gone — a seat is the camera claim, not an allowance';
  END IF;
  IF to_regclass('public.papic_seat_grant_releases') IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: the guest give-back ledger is gone — that is the opposite direction and it stays';
  END IF;
END $$;

COMMIT;
