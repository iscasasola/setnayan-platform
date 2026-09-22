-- ═══════════════════════════════════════════════════════════════════════════
-- THE RECOMMENDATION LEARNS — AND THE NAIVE LOOP IS WRONG TWICE
-- ═══════════════════════════════════════════════════════════════════════════
-- Owner, 2026-09-22: *"we will set the initial value. then create an average
-- depending on the total credits used on actual events."*
--
-- This builds the MECHANISM. **It starts dormant** and, on the day it applies,
-- changes no number anywhere: `learned_points_per_guest` is NULL on every row
-- and the resolver falls straight through to the owner's initial figure.
--
-- ── 🛑 TRAP 1 · THERE IS NO DATA YET, AND AN AVERAGE OVER IT IS ZERO ───────
-- Measured in prod 2026-09-22: nine weddings hold **100,362 credits GRANTED and
-- ONE credit USED** (plus `date` 21/55 and `simple_event` 1/55). A mean over
-- that recommends roughly nothing per head and collapses the figure to zero —
-- which reads on screen as *"this celebration needs no credits"*.
--
-- So a type must produce at least `learning_min_sample` usable observations
-- before anything overrides the owner's number, the initial stays as the
-- fallback rather than being replaced, and `papic_pool_learning_state()` says
-- WHICH of the two is in force. A learned number that silently replaced a set
-- one is unreviewable.
--
-- ── 🛑 TRAP 2 · USAGE MEASURES SUPPLY, NOT DEMAND ─────────────────────────
-- An event that spent its whole pool might have wanted twice as much. We
-- observe what they COULD spend, not what they WANTED — a censored observation,
-- in the statistical sense. Averaging raw usage therefore spirals DOWNWARD:
--
--     recommend less → they buy less → they use less → recommend less again
--
-- and every step of that looks like the mechanism working. So:
--
--   • only events that did NOT exhaust their pool are averaged — those are the
--     UNCENSORED observations, the ones where "used" really is "wanted";
--   • an EXHAUSTED event is evidence of *"wanted ≥ X"* and enters as a LOWER
--     BOUND only. It can push the learned figure UP; it can never pull it down;
--   • only events whose capture window has CLOSED count at all. An event still
--     shooting has not finished wanting.
--
-- 🔑 BOTH TRAPS ARE INVISIBLE IN A TEST WITH GENEROUS FIXTURES. Every event
-- under its ceiling makes the naive mean look right. `papic-pool-learning.test.ts`
-- carries the fixture that EXHAUSTS a pool and asserts the average does not fall.
--
-- ── WHERE THE RULE LIVES ──────────────────────────────────────────────────
-- `learnPointsPerGuest()` in apps/web/lib/papic-pool-learning.ts is the pure,
-- unit-tested implementation; `papic_pool_learning_state()` below mirrors it so
-- the admin screen and any future job agree. Same posture as
-- `computeEventPool` / `papic_event_pool_status`.
--
-- ⚠ NOTHING SCHEDULES THIS. This repo has no scheduler, deliberately.
-- `papic_recompute_pool_learning()` is called by an admin action and by nothing
-- else, so a learned number only ever appears because somebody asked for it and
-- can see what it is replacing.
--
-- ⚠ IT READS `events.papic_window_end` BUT DOES NOT DEFINE IT. "Has this
-- celebration finished shooting?" is asked of the stored column; the RULE for
-- what that column contains is `lib/papic-window.ts`'s, and is being changed in
-- parallel (capture now runs until lunch the next day). This survives that
-- change because it asks the column, not the rule.
--
-- ADDITIVE + IDEMPOTENT. Four columns, two functions, one CREATE OR REPLACE of
-- the resolver added in 20271239794268. No row's meaning changes.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 · Where a learned figure lives — beside the initial, never on top of it
-- ---------------------------------------------------------------------------

ALTER TABLE public.papic_event_pool_config
  ADD COLUMN IF NOT EXISTS learned_points_per_guest INTEGER
    CHECK (learned_points_per_guest IS NULL OR learned_points_per_guest > 0),
  ADD COLUMN IF NOT EXISTS learned_sample_size INTEGER NOT NULL DEFAULT 0
    CHECK (learned_sample_size >= 0),
  ADD COLUMN IF NOT EXISTS learned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS learning_min_sample INTEGER NOT NULL DEFAULT 12
    CHECK (learning_min_sample >= 1);

COMMENT ON COLUMN public.papic_event_pool_config.learned_points_per_guest IS
  'The per-head figure LEARNED from closed celebrations of this type, or NULL '
  'when nothing has been learned. ⚠ NULL IS THE NORMAL STATE and is what every '
  'row holds today. It NEVER overwrites points_per_guest — the owner''s initial '
  'stays put and remains the fallback, so a learned number can always be '
  'compared with the one it is standing in for. Written only by '
  'papic_recompute_pool_learning(), which nothing schedules.';

COMMENT ON COLUMN public.papic_event_pool_config.learned_sample_size IS
  'How many UNCENSORED closed celebrations produced the learned figure — i.e. '
  'events that finished shooting WITHOUT exhausting their pool. Exhausted '
  'events are not counted here: they tell us "wanted at least X", not "wanted '
  'X", and averaging them spirals the recommendation downward.';

COMMENT ON COLUMN public.papic_event_pool_config.learning_min_sample IS
  'How many uncensored observations this type needs before a learned figure may '
  'override the owner''s initial. Measured 2026-09-22: nine weddings hold '
  '100,362 credits granted and ONE used, so an unguarded average recommends '
  'about zero per head. Per-type and admin-editable because a wedding will '
  'reach a usable sample long before a gender reveal does.';

-- ---------------------------------------------------------------------------
-- 2 · The observations — one row per closed celebration, censored or not
-- ---------------------------------------------------------------------------
-- 🔑 "CLOSED" IS ASKED OF THE STORED WINDOW, and an event with no window has
-- never been able to shoot, so it is not an observation at all.

CREATE OR REPLACE FUNCTION public.papic_pool_learning_samples()
RETURNS TABLE (
  event_id      UUID,
  event_type    TEXT,
  guest_count   INTEGER,
  used_points   INTEGER,
  total_points  INTEGER,
  exhausted     BOOLEAN,
  per_head      NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.event_id,
    e.event_type,
    hc.n,
    st.used_points,
    st.total_points,
    -- EXHAUSTED: nothing left to spend. The observation is censored — this
    -- celebration wanted AT LEAST what it used, and possibly far more.
    (st.total_points > 0 AND st.used_points >= st.total_points) AS exhausted,
    st.used_points::NUMERIC / hc.n::NUMERIC AS per_head
  FROM public.events e
  CROSS JOIN LATERAL public.papic_event_pool_status(e.event_id) st
  -- 🪤 THE HEAD COUNT COMES FROM `papic_event_guest_headcount`, NOT FROM
  -- `papic_event_pool_status.guest_count`. That field is set to a LITERAL 0 on
  -- every event that is not flat-pass (`v_guests := 0` in the ELSE branch) — and
  -- no live celebration is flat-pass, because PAPIC_UNLOCK holds zero catalogue
  -- rows. Dividing by it yields no samples at all, which reads exactly like
  -- "nothing has finished yet" and would have made this loop permanently,
  -- silently dormant. The fixture that exhausts a pool is what caught it.
  CROSS JOIN LATERAL (
    SELECT COALESCE(public.papic_event_guest_headcount(e.event_id), 0) AS n
  ) hc
  WHERE e.papic_window_end IS NOT NULL
    AND e.papic_window_end < CURRENT_DATE
    AND st.applies
    AND hc.n > 0
    AND st.total_points > 0;
$$;

COMMENT ON FUNCTION public.papic_pool_learning_samples() IS
  'One row per celebration that has FINISHED shooting and had a real pool. '
  '`exhausted` marks a CENSORED observation — it spent everything it had, so '
  'its per-head figure is a lower bound on what it wanted, never the thing '
  'itself. Consumed by papic_pool_learning_state(); mirrored in TS by '
  'learnPointsPerGuest() in apps/web/lib/papic-pool-learning.ts.';

REVOKE ALL ON FUNCTION public.papic_pool_learning_samples()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3 · What WOULD be learned, per type — and which figure is in force
-- ---------------------------------------------------------------------------
-- Pure read. Computing this is deliberately separate from STORING it (§4), so
-- an admin screen can show the owner what a recompute would do before he asks
-- for it.

CREATE OR REPLACE FUNCTION public.papic_pool_learning_state()
RETURNS TABLE (
  config_key        TEXT,
  initial_per_guest INTEGER,
  stored_learned    INTEGER,
  in_force          INTEGER,
  in_force_source   TEXT,
  sample_size       INTEGER,
  censored_count    INTEGER,
  min_sample        INTEGER,
  candidate         INTEGER,
  candidate_reason  TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT * FROM public.papic_pool_learning_samples()
  ),
  agg AS (
    SELECT
      c.config_key,
      c.points_per_guest,
      c.learned_points_per_guest,
      c.learning_min_sample,
      COUNT(*) FILTER (WHERE NOT s.exhausted)                  AS uncensored_n,
      COUNT(*) FILTER (WHERE s.exhausted)                      AS censored_n,
      AVG(s.per_head) FILTER (WHERE NOT s.exhausted)           AS uncensored_mean,
      MAX(s.per_head) FILTER (WHERE s.exhausted)               AS censored_floor
    FROM public.papic_event_pool_config c
    LEFT JOIN s ON s.event_type = c.config_key
    WHERE c.config_key <> 'default'
    GROUP BY c.config_key, c.points_per_guest, c.learned_points_per_guest,
             c.learning_min_sample
  )
  SELECT
    a.config_key,
    a.points_per_guest,
    a.learned_points_per_guest,
    COALESCE(a.learned_points_per_guest, a.points_per_guest)         AS in_force,
    CASE WHEN a.learned_points_per_guest IS NULL
         THEN 'initial' ELSE 'learned' END                           AS in_force_source,
    a.uncensored_n::INTEGER,
    a.censored_n::INTEGER,
    a.learning_min_sample,
    -- THE CANDIDATE. Below the minimum sample there is none: the owner's figure
    -- stands, and NULL is how that is said.
    CASE
      WHEN a.uncensored_n < a.learning_min_sample THEN NULL
      ELSE GREATEST(
             CEIL(a.uncensored_mean)::INTEGER,
             -- 🔑 A CENSORED EVENT MAY PUSH THE NUMBER UP, NEVER DOWN.
             COALESCE(CEIL(a.censored_floor)::INTEGER, 0)
           )
    END                                                              AS candidate,
    CASE
      WHEN a.uncensored_n < a.learning_min_sample
        THEN 'too few uncensored observations (' || a.uncensored_n || ' of ' ||
             a.learning_min_sample || ') — the owner''s initial stands'
      WHEN COALESCE(CEIL(a.censored_floor)::INTEGER, 0) > CEIL(a.uncensored_mean)::INTEGER
        THEN 'raised by ' || a.censored_n || ' exhausted celebration(s) — they wanted at least this much'
      ELSE 'mean of ' || a.uncensored_n || ' celebration(s) that finished with credits to spare'
    END                                                              AS candidate_reason
  FROM agg a;
$$;

COMMENT ON FUNCTION public.papic_pool_learning_state() IS
  'Per event type: the owner''s initial, anything learned, WHICH OF THE TWO IS '
  'IN FORCE, and what a recompute would produce with its reason. The admin '
  'screen renders this — a learned number that silently replaced a set one is '
  'unreviewable, so the source is part of the answer, not a footnote.';

REVOKE ALL ON FUNCTION public.papic_pool_learning_state()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4 · The write — an admin asks for it, nothing else ever does
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.papic_recompute_pool_learning()
RETURNS TABLE (config_key TEXT, learned INTEGER, sample_size INTEGER)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.papic_event_pool_config c
     SET learned_points_per_guest = st.candidate,
         learned_sample_size      = st.sample_size,
         learned_at               = CASE WHEN st.candidate IS NULL THEN NULL ELSE NOW() END,
         updated_at               = NOW()
    FROM public.papic_pool_learning_state() st
   WHERE st.config_key = c.config_key
     AND (c.learned_points_per_guest IS DISTINCT FROM st.candidate
          OR c.learned_sample_size IS DISTINCT FROM st.sample_size)
  RETURNING c.config_key, c.learned_points_per_guest, c.learned_sample_size;
END;
$$;

COMMENT ON FUNCTION public.papic_recompute_pool_learning() IS
  'Stores what papic_pool_learning_state() computed. NOTHING SCHEDULES THIS — '
  'this repo has no scheduler by design, and a recommendation that governs '
  'money should not change while nobody is looking. A candidate of NULL clears '
  'the learned figure back to the owner''s initial, which is how a type that '
  'loses its sample stops quoting a number nothing supports any more.';

REVOKE ALL ON FUNCTION public.papic_recompute_pool_learning()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5 · The resolver prefers a learned figure — and today there is never one
-- ---------------------------------------------------------------------------
-- Identical to 20271239794268's body except for the COALESCE. `floor_points`
-- and `ceiling_points` are NOT learned: they are the owner's shape for what a
-- small or enormous celebration of this kind means, and no amount of usage data
-- makes a dinner for two want a 5,000-credit floor.

CREATE OR REPLACE FUNCTION public.papic_event_pool_sizing(
  p_event_type TEXT
) RETURNS TABLE (
  points_per_guest INTEGER,
  floor_points     INTEGER,
  ceiling_points   INTEGER,
  sized_by         TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(c.learned_points_per_guest, c.points_per_guest),
    c.floor_points,
    c.ceiling_points,
    c.config_key
    FROM public.papic_event_pool_config c
   WHERE c.config_key = COALESCE(p_event_type, 'default')
      OR c.config_key = 'default'
   ORDER BY (c.config_key = 'default')
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.papic_event_pool_sizing(TEXT)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6 · Refuse to apply if this is not dormant
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_learned INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_learned
    FROM public.papic_event_pool_config
   WHERE learned_points_per_guest IS NOT NULL;
  IF v_learned > 0 THEN
    RAISE EXCEPTION
      'refusing to apply: % row(s) already carry a learned figure — this migration must be inert on merge',
      v_learned;
  END IF;
END $$;

COMMIT;
