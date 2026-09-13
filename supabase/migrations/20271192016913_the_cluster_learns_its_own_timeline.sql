-- the cluster learns its own timeline
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- ITEM 7 · "THE YEAR" — PHASE 7c: DATES AND THE TIMELINE.
--
-- WHATS_NEXT_Papic_Build_Order_2026-08-29.md § 7, owner ruling 2026-09-02:
-- "the year is the full planning platform, but every celebration keeps its own
-- pot — a cluster is presentation and planning, NEVER accounting", and "the
-- expensive half is the planning surface, not the money model."
--
-- 7a (20271189765490) made the link. 7b (20271191258098) made one guest one
-- person across it. Both were schema with no screen, by design. THIS PHASE IS
-- THE READ SIDE OF THE PLANNING SURFACE: given a cluster, what are its
-- celebrations, in what order, and when is each one.
--
-- ─── 🛑 WHAT THIS FILE DOES NOT DO, AND WILL NOT BE TALKED INTO ────────────
--
-- ⛔ IT STORES NOTHING. Not a span, not a year, not a season, not a
--    starts_on/ends_on. 7a's own comment block forbids it in advance:
--
--      "NO `year` / `season` / `starts_on` / `ends_on`. The span is DERIVED
--       from the members' own `event_date`s at read time … A stored span goes
--       stale the first time a date moves."
--
--    A wedding date moves. It moves often, and it moves late. A stored span is
--    wrong from the instant it is written and nothing tells you it went wrong —
--    the cluster simply starts lying about a year it no longer covers. This
--    file adds ZERO columns to ZERO tables. It is one read function.
--
-- ⛔ IT HOLDS NO VALUE. No points, credits, shots, money or guest count cross
--    this function, and the Papic pool tables are not touched, not joined and
--    not mentioned. The pot stays keyed `event_id`, as
--    apps/web/tests/db/a-pot-belongs-to-one-celebration.db.test.ts requires.
--
-- ⛔ IT ADDS NO OCCASION EVENT TYPES. `engagement_party` and `bridal_shower`
--    still do not exist in `public.event_type`; 7a flagged that as an owner
--    call and it stays flagged. The timeline is type-agnostic and renders
--    whatever type each celebration already carries.
--
-- ─── 🪤 THE TRAP THIS FUNCTION EXISTS TO NOT FALL INTO ─────────────────────
--
-- `events.event_date` IS NOT A DATE. It is a date-shaped ANCHOR whose meaning
-- is set by a SECOND column. From 20260603100000_iteration_0021_event_date_
-- precision.sql, verbatim:
--
--   "For year/month modes, event_date stores the first-day-of-range
--    placeholder ('2027-01-01' for year, '2027-08-01' for month) so all the
--    downstream consumers that read event_date continue to function without
--    conditional null-checks."
--
-- 🔑 SO `ORDER BY event_date` SORTS "SOMETIME IN 2027" AS IF IT WERE LITERALLY
--    NEW YEAR'S DAY. It is the earliest thing in that year, ahead of a wedding
--    genuinely booked for January 3rd — and it renders as the FIRST chapter of
--    the year when the host has said only that it happens SOMEWHERE in it.
--    That is not a rounding error on a planning surface; it is the screen
--    asserting an order the host never gave it. Measured 2026-08-20 and
--    recorded in lib/join-door-meta.ts: 4 of 9 prod events carry 'year'
--    precision while holding a real-looking date, so this is the common case,
--    not the edge case.
--
-- ⇒ WHAT WE DO INSTEAD. Each celebration is resolved to the RANGE its own
--   precision actually claims:
--
--     precision 'day'   → [event_date, coalesce(event_end_date, event_date)]
--     precision 'month' → [first of that month, last of that month]
--     precision 'year'  → [Jan 1 of that year, Dec 31 of that year]
--
--   (a multi-day celebration's `event_end_date` extends the range's tail; it
--   never becomes a second member row — 7a: "ONE ROW PER OCCASION, NEVER ONE
--   PER DAY".)
--
--   and ordered by that range's MIDPOINT, not its head. "Sometime in 2027"
--   lands mid-2027 — after a wedding actually booked for January, before one
--   actually booked for December — which is the most honest single position
--   for a date whose owner has only committed to a window. Both endpoints are
--   returned alongside it, so the screen can draw the uncertainty rather than
--   flattening it to a point, and re-sort deterministically if it wants to.
--
--   ⚠ THE MIDPOINT IS A SORT KEY, NEVER A DISPLAYED DATE. Nothing may render
--     `sort_key` to a human: it would invent a July date the host never chose.
--     The label comes from formatEventDateWithPrecision() in lib/events.ts,
--     which already speaks 'Sometime in 2027' / 'August 2027' / a full date and
--     is reused rather than reimplemented.
--
--   UNDATED CELEBRATIONS SORT LAST, not first. `events.event_date` is NULLABLE
--   and a celebration created by the simplified flow has no date at all; NULLS
--   FIRST would open every year with the things nobody has scheduled.
--
-- ─── AUTHORIZATION: INHERITED, NOT INVENTED ────────────────────────────────
--
-- SECURITY INVOKER (the default — no SECURITY DEFINER here, on purpose), the
-- same posture as 7b's cluster_guest_roster(). It runs as the caller and
-- inherits the RLS already on the two tables it reads:
--
--   · public.event_cluster_members — event_cluster_members_read (20271189765490):
--       the cluster's OWNER, or a COUPLE member of that specific celebration.
--       Deliberately NOT current_event_ids(), so a shower GUEST never learns
--       the shower belongs to a group.
--   · public.events                — event_member_can_read (current_event_ids()).
--
-- A stranger gets zero membership rows and therefore zero timeline rows. No
-- ninth RLS pattern is invented here, and no policy is added, altered or
-- weakened by this file.
--
-- ADDITIVE + IDEMPOTENT. Creates ONE function. Nothing is dropped, no table,
-- column, policy, trigger or row is altered.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.cluster_timeline(p_event_cluster_id UUID)
RETURNS TABLE (
  event_id              UUID,
  display_name          TEXT,
  event_type            TEXT,
  event_date            DATE,
  event_end_date        DATE,
  event_date_precision  TEXT,
  is_anchor             BOOLEAN,
  range_start           DATE,
  range_end             DATE,
  sort_key              DATE
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH member_event AS (
    SELECT
      e.event_id,
      e.display_name,
      e.event_type::TEXT              AS event_type,
      e.event_date,
      e.event_end_date,
      e.event_date_precision,
      ecm.is_anchor,
      -- The range this celebration's OWN precision actually claims. A 'year'
      -- or 'month' event_date is a first-of-range placeholder, never a day the
      -- host picked, so the range is widened to the window they did pick.
      CASE
        WHEN e.event_date IS NULL THEN NULL
        WHEN e.event_date_precision = 'year'  THEN date_trunc('year',  e.event_date)::DATE
        WHEN e.event_date_precision = 'month' THEN date_trunc('month', e.event_date)::DATE
        ELSE e.event_date
      END AS range_start,
      CASE
        WHEN e.event_date IS NULL THEN NULL
        WHEN e.event_date_precision = 'year'
          THEN GREATEST(
                 (date_trunc('year', e.event_date) + INTERVAL '1 year' - INTERVAL '1 day')::DATE,
                 COALESCE(e.event_end_date, e.event_date))
        WHEN e.event_date_precision = 'month'
          THEN GREATEST(
                 (date_trunc('month', e.event_date) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
                 COALESCE(e.event_end_date, e.event_date))
        -- 'day' (and any value a future CHECK might add): the celebration's own
        -- days, multi-day tail included.
        ELSE GREATEST(COALESCE(e.event_end_date, e.event_date), e.event_date)
      END AS range_end
    FROM public.event_cluster_members ecm
    JOIN public.events e ON e.event_id = ecm.event_id
    WHERE ecm.event_cluster_id = p_event_cluster_id
  )
  SELECT
    me.event_id,
    me.display_name,
    me.event_type,
    me.event_date,
    me.event_end_date,
    me.event_date_precision,
    me.is_anchor,
    me.range_start,
    me.range_end,
    -- MIDPOINT of the claimed range. A sort key, never a label: rendering it
    -- would invent a day the host never chose.
    (me.range_start + ((me.range_end - me.range_start) / 2))::DATE AS sort_key
  FROM member_event me
  -- Undated celebrations last: NULLS FIRST would open the year with the things
  -- nobody has scheduled. display_name is the final tiebreak so the order is
  -- total and the screen never reshuffles between two identical reads.
  ORDER BY
    (me.range_start + ((me.range_end - me.range_start) / 2))::DATE ASC NULLS LAST,
    me.range_start ASC NULLS LAST,
    me.display_name ASC;
$$;

COMMENT ON FUNCTION public.cluster_timeline(UUID) IS
  'ITEM 7c — the planning surface''s read shape: one row per celebration in an '
  'event_cluster, chronological. DERIVED AT READ TIME AND STORED NOWHERE (7a '
  'forbids a year/season/starts_on/ends_on column: a stored span goes stale the '
  'first time a date moves). Each row carries the RANGE its own '
  'event_date_precision claims — a ''year''/''month'' event_date is a '
  'first-of-range placeholder, not a chosen day — and is ordered by that '
  'range''s MIDPOINT so "Sometime in 2027" does not sort as if it were literally '
  'Jan 1. sort_key is a SORT KEY, NEVER A DISPLAYED DATE; the human label comes '
  'from formatEventDateWithPrecision() in lib/events.ts. Undated celebrations '
  'sort last. SECURITY INVOKER: no elevated rights, inherits the caller''s '
  'existing RLS on event_cluster_members (owner-or-couple) and events, so a '
  'stranger or a mere guest gets zero rows. Carries no points, credits, shots, '
  'money or guest count — a cluster is a label, never a container of value.';

-- 🪤 THE REVOKE IS LOAD-BEARING (7a documented this for tables, 7b for
-- functions, and it is the same trap). A CREATE FUNCTION leaves a default
-- PUBLIC EXECUTE grant in place, so without this the function ships callable
-- at /rest/v1/rpc/cluster_timeline by anyone holding the publishable anon key.
-- SECURITY INVOKER makes that harmless at runtime (an anon caller reads zero
-- rows through RLS), but the exposure baseline tracks the RPC SURFACE itself,
-- not merely its runtime safety — narrow it anyway, exactly as 7b did.
REVOKE ALL ON FUNCTION public.cluster_timeline(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cluster_timeline(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.cluster_timeline(UUID) TO authenticated, service_role;

COMMIT;
