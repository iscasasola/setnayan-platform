-- ═══════════════════════════════════════════════════════════════════════════
-- EVERY GUEST IS PROMISED A MINIMUM — and a promise has to be payable
-- ═══════════════════════════════════════════════════════════════════════════
-- ── WHAT WAS MISSING, MEASURED ────────────────────────────────────────────
-- `papic_guest_spend_ceilings.ceiling_points` is a CEILING: the MOST one guest
-- may take. The shipped `splitTheRest` docblock states the consequence plainly
-- (measured 2026-09-16): *"THIS IS A SUGGESTION ENGINE, NOT AN ALLOCATION …
-- NOTHING is ever held back for her. Every credit comes out of the one pot,
-- first come first served, and a guest who arrives late finds whatever is left
-- regardless of her number."*
--
-- So **nothing in the product guarantees any guest anything.** A couple can cap
-- a loud uncle at 40 and still have their mother arrive at 10pm to find the pot
-- empty. This adds the other half: a MINIMUM.
--
-- ── 🔑 A FLOOR IS A PROMISE, SO IT MUST BE PAYABLE ────────────────────────
-- A ceiling that cannot be reached costs nobody anything — it is a limit, and
-- an unreachable limit simply never binds. A FLOOR is the opposite: it is a
-- sentence spoken to a guest, and a floor the pot cannot cover is a lie told to
-- every one of them at once.
--
-- `minimum × guests` is therefore checked against what the celebration holds,
-- and the couple is told **how many credits short they are** rather than being
-- allowed to save a number that quietly means nothing. That arithmetic is
-- `guestMinimumVerdict()` in apps/web/lib/papic-guest-allotments.ts — pure, and
-- beside the split it belongs with.
--
-- ⚠ PAYABILITY CANNOT BE A CHECK CONSTRAINT, and pretending otherwise would be
-- worse than not having one. The pot moves (a top-up, a grant) and the head
-- count moves (an RSVP, a new name) without anybody touching this column, so a
-- constraint would either refuse a legitimate save or go stale the instant it
-- passed. It is a VERDICT the screen shows, re-derived every render.
--
-- ── WHAT *IS* ENFORCED HERE ───────────────────────────────────────────────
--   • a minimum is a positive number of credits, or absent (NULL). ⚠ A blank
--     box is not zero — zero would mean "nobody may shoot", which is what the
--     capture window is for. Same rule, same reason, as the ceiling column.
--   • **A FLOOR CAN NEVER EXCEED THE CEILING.** A celebration promising every
--     guest at least 80 while capping them at 40 is not a configuration, it is
--     a contradiction, and it would resolve to one of the two silently. A CHECK
--     refuses it, so neither box can be saved into that state from anywhere.
--   • the resolver applies it: `GREATEST(minimum, whatever tier resolved)`.
--
-- ── ⚖ THE MINIMUM BEATS A NAMED GUEST'S OWN NUMBER, AND THAT IS THE POINT ──
-- Owner ruling 7c (2026-08-28) says naming somebody means her credits wait for
-- her all night. That is about the RELEASE, which never lifts a named guest's
-- allotment. It is not a licence to promise everybody 80 and hand one named
-- guest 20 — the minimum is said to EVERY guest, so it raises a named number
-- that sits below it rather than being quietly overridden by one. The couple's
-- sheet says when that is happening; it is not hidden.
--
-- 🔑 A MINIMUM NEVER OPENS MORE CREDITS THAN THE POT HOLDS. The pot is the
-- money gate and this migration does not touch it. This is a FAIRNESS rule
-- between guests, exactly like the shipped floor-of-one, and a fairness rule
-- must never be the thing that spends money nobody paid for.
--
-- ADDITIVE + IDEMPOTENT. One column, its grants, the `events_host` rebuild the
-- grants force, one CHECK, one CREATE OR REPLACE of the resolver.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 · The column
-- ---------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_guest_spend_floor_points INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.events'::regclass
       AND conname  = 'events_papic_guest_spend_floor_points_positive'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_papic_guest_spend_floor_points_positive
      CHECK (papic_guest_spend_floor_points IS NULL
             OR papic_guest_spend_floor_points > 0);
  END IF;

  -- 🔑 A FLOOR CAN NEVER EXCEED THE CEILING. Written as a constraint rather
  -- than as a rule in the action, because there are three writers of these two
  -- columns already and a fourth is one refactor away.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.events'::regclass
       AND conname  = 'events_papic_guest_spend_floor_at_most_ceiling'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_papic_guest_spend_floor_at_most_ceiling
      CHECK (papic_guest_spend_floor_points IS NULL
             OR papic_guest_spend_ceiling_points IS NULL
             OR papic_guest_spend_floor_points <= papic_guest_spend_ceiling_points);
  END IF;
END $$;

COMMENT ON COLUMN public.events.papic_guest_spend_floor_points IS
  'The LEAST any guest of this celebration may spend — a promise, not a limit. '
  'NULL = no minimum, which is every celebration on the day this applied. ⚠ NOT '
  'papic_event_pool_config.floor_points, which is the smallest POT a celebration '
  'of this kind is recommended; this is the smallest allowance one PERSON is '
  'guaranteed. ⚠ AND NOT ZERO WHEN BLANK — zero would mean "nobody may shoot". '
  'A minimum the pot cannot cover is a lie told to every guest at once, so '
  'payability is re-derived on every render by guestMinimumVerdict() in '
  'apps/web/lib/papic-guest-allotments.ts; it cannot be a CHECK because the pot '
  'and the head count both move without this column being touched.';

-- ── THE GRANT · `events` revokes table-level SELECT and re-grants a per-column
-- allowlist, so an ungranted column makes PostgREST refuse the WHOLE query and
-- every surface reading `events` through a user session goes silently empty.
-- SELECT + UPDATE, no INSERT: it is not answered when a celebration is minted.
-- `anon` gets nothing.
GRANT SELECT (papic_guest_spend_floor_points) ON public.events TO authenticated;
GRANT UPDATE (papic_guest_spend_floor_points) ON public.events TO authenticated;

-- ── AND THE HOST VIEW HAS TO BE REBUILT WITH IT ──────────────────────────
-- `events_host` has an EXPLICIT projection computed from those grants, so a new
-- column is a PHANTOM COLUMN on it until the view is rebuilt.
DROP VIEW IF EXISTS public.events_host;

DO $$
DECLARE
  private_columns TEXT[] := ARRAY[
    'partner_a_birth_date','partner_a_birth_time',
    'partner_b_birth_date','partner_b_birth_time',
    'bazi_birthdata_consent_at',
    'estimated_budget_centavos','budget_band',
    'wizard_state',
    'photo_delivery_folder_id','photo_delivery_folder_name',
    'photo_delivery_account_email',
    'setnayan_ai_tier_at_purchase',
    'signature_details','honoree_label','honoree_dependent_id'
  ];
  projected TEXT;
BEGIN
  SELECT string_agg('e.' || quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO projected
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'events'
    AND (
      has_column_privilege('authenticated', 'public.events', c.column_name, 'SELECT')
      OR c.column_name = ANY (private_columns)
    );

  IF projected IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed events_host projection is empty';
  END IF;

  -- The projection is DERIVED from the GRANT above, so this asserts it took
  -- rather than assuming it.
  IF projected NOT LIKE '%papic_guest_spend_floor_points%' THEN
    RAISE EXCEPTION 'refusing to apply: papic_guest_spend_floor_points missing from the events_host projection — its GRANT did not take';
  END IF;

  EXECUTE format($ddl$
    CREATE VIEW public.events_host
      WITH (security_invoker = false)
      AS
      SELECT %s
        FROM public.events e
       WHERE e.event_id IN (SELECT public.current_couple_event_ids())
          OR e.event_id IN (SELECT public.current_moderator_event_ids())
          OR current_user = 'service_role'
          OR auth.role() = 'service_role'
  $ddl$, projected);
END $$;

REVOKE ALL ON public.events_host FROM PUBLIC;
REVOKE ALL ON public.events_host FROM anon;
REVOKE ALL ON public.events_host FROM authenticated;
GRANT SELECT ON public.events_host TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2 · The resolver honours it
-- ---------------------------------------------------------------------------
-- Byte-identical to the shipped body (20271221350945) except for the minimum:
-- it is read with the other three event columns, and applied with a GREATEST at
-- each of the two points a number is returned. Every other line — the switch,
-- the release, the automatic late release, the sponsor weights, the typed
-- number being at most the fair share — is unchanged.
--
-- ⚠ THE RELEASE STILL WINS. Once the rest is opened to everyone there is no
-- ceiling at all, and a minimum is not a reason to re-impose one: NULL means
-- "nothing binds", which is strictly more generous than any floor.

CREATE OR REPLACE FUNCTION public.papic_guest_spend_ceiling(p_guest_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id   UUID;
  v_on         BOOLEAN;
  v_everyone   INTEGER;
  v_floor      INTEGER;
  v_released   TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_event_date DATE;
  v_tz         TEXT;
  v_named      INTEGER;
  v_auto_at    TIMESTAMPTZ;
  v_applies    BOOLEAN;
  v_total      INTEGER;
  v_named_sum  INTEGER;
  v_named_cnt  INTEGER;
  v_heads      INTEGER;
  v_weight     INTEGER;
  v_extra      INTEGER;
  v_share      INTEGER;
BEGIN
  IF p_guest_id IS NULL THEN RETURN NULL; END IF;

  SELECT g.event_id, public.papic_share_weight(g.role, g.extra_roles)
    INTO v_event_id, v_weight
    FROM public.guests g
   WHERE g.guest_id = p_guest_id
     AND g.deleted_at IS NULL;
  IF v_event_id IS NULL THEN RETURN NULL; END IF;

  SELECT e.papic_guest_spend_ceiling_on,
         e.papic_guest_spend_ceiling_points,
         e.papic_guest_spend_floor_points,
         e.papic_guest_spend_ceiling_released_at,
         e.papic_window_end,
         e.event_date,
         e.timezone
    INTO v_on, v_everyone, v_floor, v_released, v_window_end, v_event_date, v_tz
    FROM public.events e
   WHERE e.event_id = v_event_id;

  -- 🔑 THE SWITCH IS THE FIRST WORD. Off — the default — returns before a
  -- single further read, so the capture path is what it was.
  IF NOT COALESCE(v_on, FALSE) THEN
    RETURN NULL;
  END IF;

  -- ── TIER 1 · a guest the couple named ────────────────────────────────────
  -- ⚖ THE MINIMUM RAISES HER NUMBER IF IT SITS BELOW IT. A minimum is said to
  -- EVERY guest; naming somebody cannot be the thing that takes it away from
  -- her. Ruling 7c protects a named allotment from the RELEASE, which is a
  -- different question and is still honoured below.
  SELECT c.ceiling_points INTO v_named
    FROM public.papic_guest_spend_ceilings c
   WHERE c.guest_id = p_guest_id;
  IF v_named IS NOT NULL THEN
    RETURN GREATEST(v_named, COALESCE(v_floor, 0));
  END IF;

  -- ── THE RELEASE (owner 7a) · the couple's button ─────────────────────────
  IF v_released IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- ── THE RELEASE · and it also happens by itself, late ─────────────────────
  v_auto_at := COALESCE(
    v_window_end,
    CASE WHEN v_event_date IS NOT NULL
      THEN ((v_event_date + 1)::timestamp AT TIME ZONE COALESCE(v_tz, 'Asia/Manila'))
    END
  ) - INTERVAL '2 hours';
  IF v_auto_at IS NOT NULL AND NOW() >= v_auto_at THEN
    RETURN NULL;
  END IF;

  -- ── TIER 2 · the equal share of what the named guests left ───────────────
  SELECT applies, total_points
    INTO v_applies, v_total
    FROM public.papic_event_pool_status(v_event_id);

  IF COALESCE(v_applies, FALSE) THEN
    SELECT COALESCE(SUM(c.ceiling_points), 0)::INTEGER, COUNT(*)::INTEGER
      INTO v_named_sum, v_named_cnt
      FROM public.papic_guest_spend_ceilings c
      JOIN public.guests g ON g.guest_id = c.guest_id
     WHERE c.event_id = v_event_id
       AND g.deleted_at IS NULL
       AND g.rsvp_status::text <> 'declined';

    v_heads := COALESCE(public.papic_event_guest_headcount(v_event_id), 0) - v_named_cnt;

    IF v_heads > 0 THEN
      SELECT COALESCE(SUM(public.papic_share_weight(g.role, g.extra_roles) - 1), 0)::INTEGER
        INTO v_extra
        FROM public.guests g
       WHERE g.event_id = v_event_id
         AND g.deleted_at IS NULL
         AND g.rsvp_status::text <> 'declined'
         AND NOT EXISTS (
           SELECT 1 FROM public.papic_guest_spend_ceilings c WHERE c.guest_id = g.guest_id
         );

      v_share := GREATEST(
                   1,
                   FLOOR(GREATEST(v_total - v_named_sum, 0)::NUMERIC / (v_heads + v_extra))::INTEGER
                 );
    END IF;
  END IF;

  -- ── TIER 2 · the number the couple typed is AT MOST the share ────────────
  IF v_everyone IS NOT NULL THEN
    v_share := LEAST(v_everyone, COALESCE(v_share, v_everyone));
  END IF;

  -- ⚖ AND THE MINIMUM IS APPLIED LAST, so it survives the LEAST above. The
  -- CHECK on the table already refuses a minimum above the couple's typed
  -- ceiling, so this can never contradict a number they chose; what it DOES
  -- override is a thin share, which is the entire purpose.
  IF v_floor IS NOT NULL THEN
    v_share := GREATEST(COALESCE(v_share, v_floor), v_floor);
  END IF;

  IF v_share IS NULL THEN
    RETURN NULL;
  END IF;

  -- ➕ SPONSOR · the floor applies to ONE share; a sponsor takes her weight in them.
  RETURN LEAST(v_share::BIGINT * GREATEST(COALESCE(v_weight, 1), 1), 2147483647)::INTEGER;
END;
$function$;

COMMIT;
