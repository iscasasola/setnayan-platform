-- sponsors get a bigger share
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE OR REPLACE FUNCTION …
--
-- ═══════════════════════════════════════════════════════════════════════════
-- SPONSORS DEFAULT TO A BIGGER SHARE — owner addition, 2026-08-29
-- ═══════════════════════════════════════════════════════════════════════════
-- On a celebration where the couple has turned on "how many credits each guest
-- gets", a ninong or ninang now STARTS with three equal shares and a cord, veil,
-- coin or candle sponsor with two — without the couple naming them. A named
-- guest's own number still wins, and the release (the button and the late
-- automatic one) still opens every un-named guest, sponsors included.
--
-- ── 🔑 WHO IS A SPONSOR: THE GUEST LIST, NOT THE SPONSORS PAGE ─────────────
-- `guests.role` (+ `extra_roles`) carries the five sponsor values. The sponsors
-- page (`event_sponsors`) stamps that role on the guest it creates when a
-- sponsor accepts (`markResponse` → `sponsorGuestRole`), so every accepted
-- sponsor is on the list WITH the role — but the reverse is not true. Measured
-- in production 2026-09-11: 8 guests carry a sponsor role, 0 `event_sponsors`
-- rows exist. The couple's sheet used to read `event_sponsors.linked_guest_id`
-- and so recognised NONE of the eight; it now reads the same column this does.
--
-- ── ⚖ WEIGHTED, NOT MULTIPLIED ON TOP ──────────────────────────────────────
-- A sponsor does not get "3 × the share everyone else was going to get" — that
-- would promise more credits than the pot holds, and the whole design of this
-- ceiling is that CAPPING EVERYONE IS THE GUARANTEE (spec § 2): if every other
-- guest is held to their share, none of them can reach yours. So a sponsor is
-- counted as 3 (or 2) HEADS in the division, and takes 3 (or 2) of the shares
-- that division produces. The shares still add up to the pot, and every guest's
-- number is still derived at spend time rather than stamped.
--
--   share          = GREATEST(1, FLOOR((pot − named) / (heads + extra)))
--   extra          = Σ (weight − 1) over un-named sponsors who are still coming
--   ceiling(guest) = share × weight(guest)
--
-- With no sponsor on the list, `extra` is 0 and every weight is 1: the result
-- is byte-identical to the resolver this replaces.
--
-- ── ⛔ CREATE OR REPLACE IS A TIME MACHINE ──────────────────────────────────
-- The body below starts from PRODUCTION's live `pg_get_functiondef` of
-- `papic_guest_spend_ceiling`, read 2026-09-11 — not from 20271184624871 — and
-- changes only the three places marked ➕ SPONSOR. The assertion at the foot
-- refuses to apply if the named tier, the release or the floor of one has gone.
--
-- ⚠ THE MULTIPLIERS HAVE A TWIN IN TYPESCRIPT (`ROLE_MULTIPLIER`,
-- `lib/papic-guest-allotments.ts`), which draws the couple's sheet. The two are
-- held together by `tests/db/papic-sponsors-get-a-bigger-share.db.test.ts`,
-- which walks EVERY value of the guest_role enum through both.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · THE WEIGHT — how many equal shares a guest's role is worth
-- ═══════════════════════════════════════════════════════════════════════════
-- Pure, so the resolver can apply it to one guest AND sum it over the list
-- without two copies of the CASE. A principal sponsor who is also listed as a
-- cord sponsor is a principal sponsor: the larger weight wins.
CREATE OR REPLACE FUNCTION public.papic_share_weight(
  p_role        public.guest_role,
  p_extra_roles public.guest_role[]
) RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_role = 'principal_sponsor'
      OR 'principal_sponsor' = ANY (COALESCE(p_extra_roles, '{}'))
      THEN 3
    WHEN p_role IN ('cord_sponsor', 'veil_sponsor', 'coin_sponsor', 'candle_sponsor')
      OR COALESCE(p_extra_roles, '{}')
         && ARRAY['cord_sponsor', 'veil_sponsor', 'coin_sponsor', 'candle_sponsor']::public.guest_role[]
      THEN 2
    ELSE 1
  END;
$$;

COMMENT ON FUNCTION public.papic_share_weight(public.guest_role, public.guest_role[]) IS
  'How many equal shares of a celebration''s credits a guest''s role is worth: '
  '3 for a principal sponsor, 2 for a cord, veil, coin or candle sponsor, 1 for '
  'everyone else. Twin of ROLE_MULTIPLIER in lib/papic-guest-allotments.ts.';

REVOKE ALL ON FUNCTION public.papic_share_weight(public.guest_role, public.guest_role[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_share_weight(public.guest_role, public.guest_role[])
  TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · THE SAME WEIGHT, FOR ONE GUEST — what the guest's counter asks
-- ═══════════════════════════════════════════════════════════════════════════
-- NULL for a guest the couple NAMED: her number is the couple's own and takes
-- no part in the division, so she has no share to be "bigger" — and the counter
-- must not tell her she is on a sponsor's share when she is on a number the
-- couple typed. The exclusion is the same NOT EXISTS the resolver's sum uses.
CREATE OR REPLACE FUNCTION public.papic_guest_share_weight(
  p_guest_id UUID
) RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.papic_share_weight(g.role, g.extra_roles)
    FROM public.guests g
   WHERE g.guest_id = p_guest_id
     AND g.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.papic_guest_spend_ceilings c WHERE c.guest_id = g.guest_id
     );
$$;

COMMENT ON FUNCTION public.papic_guest_share_weight(UUID) IS
  'How many equal shares this guest takes in the division of a celebration''s '
  'credits (1, 2 or 3), or NULL when the couple named her own number. Read by '
  'the guest''s counter to say when a bigger number is a sponsor''s share.';

REVOKE ALL ON FUNCTION public.papic_guest_share_weight(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_guest_share_weight(UUID) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · THE RESOLVER — production's live body, plus the sponsor arm
-- ═══════════════════════════════════════════════════════════════════════════
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
BEGIN
  IF p_guest_id IS NULL THEN RETURN NULL; END IF;

  -- ➕ SPONSOR · the weight is read with the event, on the one lookup that
  -- already had to find this guest.
  SELECT g.event_id, public.papic_share_weight(g.role, g.extra_roles)
    INTO v_event_id, v_weight
    FROM public.guests g
   WHERE g.guest_id = p_guest_id
     AND g.deleted_at IS NULL;
  IF v_event_id IS NULL THEN RETURN NULL; END IF;

  SELECT e.papic_guest_spend_ceiling_on,
         e.papic_guest_spend_ceiling_points,
         e.papic_guest_spend_ceiling_released_at,
         e.papic_window_end,
         e.event_date,
         e.timezone
    INTO v_on, v_everyone, v_released, v_window_end, v_event_date, v_tz
    FROM public.events e
   WHERE e.event_id = v_event_id;

  -- 🔑 THE SWITCH IS THE FIRST WORD, AND THAT IS DELIBERATE. Off — the default,
  -- and every celebration in existence on the day this applied — returns before
  -- a single further read, so this function costs one indexed lookup and the
  -- capture path is what it was.
  IF NOT COALESCE(v_on, FALSE) THEN
    RETURN NULL;
  END IF;

  -- ── TIER 1 · a guest the couple named ────────────────────────────────────
  -- Asked FIRST, and before the release, because naming somebody has to mean
  -- something: her credits wait for her all night whatever else opens up
  -- (owner 7c). 0 is a legitimate figure and means she may not spend.
  -- A named sponsor gets the couple's number, not a sponsor's share: the couple
  -- typed it, and a default must never overrule a choice.
  SELECT c.ceiling_points INTO v_named
    FROM public.papic_guest_spend_ceilings c
   WHERE c.guest_id = p_guest_id;
  IF v_named IS NOT NULL THEN
    RETURN v_named;
  END IF;

  -- ── THE RELEASE (owner 7a) · the couple's button ─────────────────────────
  -- "Open the rest to everyone." Lifts tiers 2 and 3 and nothing else.
  IF v_released IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- ── THE RELEASE · and it also happens by itself, late ─────────────────────
  -- So nobody is ever locked out of a pot that still holds credits because the
  -- couple were busy getting married. Derived, never scheduled: a cron that
  -- fails to run is a promise that fails silently, and this cannot fail to run
  -- because it is computed at the moment the question is asked.
  --
  -- ⚠ BEING LATE IS HARMLESS; BEING EARLY BREAKS THE PROMISE. So the fallback
  -- for a celebration with no window is the END of the event day rather than
  -- any guess at when the party thins out. The authoritative capture window
  -- lives in lib/papic-window.ts and this does not attempt to reproduce it —
  -- it only needs a moment that is certainly near the end.
  v_auto_at := COALESCE(
    v_window_end,
    CASE WHEN v_event_date IS NOT NULL
      THEN ((v_event_date + 1)::timestamp AT TIME ZONE COALESCE(v_tz, 'Asia/Manila'))
    END
  ) - INTERVAL '2 hours';
  IF v_auto_at IS NOT NULL AND NOW() >= v_auto_at THEN
    RETURN NULL;
  END IF;

  -- ── TIER 2 · the number the couple typed for everyone else ────────────────
  -- ➕ SPONSOR · a sponsor gets that many shares of it. The couple's figure is
  -- what ONE ordinary guest gets; a ninong is three ordinary guests' worth.
  -- The LEAST keeps an absurd typed figure from overflowing INTEGER.
  IF v_everyone IS NOT NULL THEN
    RETURN LEAST(v_everyone::BIGINT * COALESCE(v_weight, 1), 2147483647)::INTEGER;
  END IF;

  -- ── TIER 2 · derived — an equal share of what the named guests left ───────
  SELECT applies, total_points
    INTO v_applies, v_total
    FROM public.papic_event_pool_status(v_event_id);

  -- No pot at all: there is nothing to divide and the ownership gate refuses
  -- this capture anyway. A ceiling here would be arithmetic about nothing.
  IF NOT COALESCE(v_applies, FALSE) THEN
    RETURN NULL;
  END IF;

  -- ⚠ ONLY THE NAMED GUESTS WHO ARE STILL COMING. A row survives a guest being
  -- removed from the list or declining, and the headcount above counts neither
  -- — so counting them here would subtract an absent person's credits from the
  -- pot AND shrink the divisor, quietly making everybody else's share smaller
  -- than the arithmetic the couple was shown. The predicate is the same one
  -- papic_event_guest_headcount uses, on purpose.
  SELECT COALESCE(SUM(c.ceiling_points), 0)::INTEGER, COUNT(*)::INTEGER
    INTO v_named_sum, v_named_cnt
    FROM public.papic_guest_spend_ceilings c
    JOIN public.guests g ON g.guest_id = c.guest_id
   WHERE c.event_id = v_event_id
     AND g.deleted_at IS NULL
     AND g.rsvp_status::text <> 'declined';

  v_heads := COALESCE(public.papic_event_guest_headcount(v_event_id), 0) - v_named_cnt;

  -- Everybody is named, or the headcount has not caught up with the naming.
  -- There is no "everyone else" to divide among, so tier 2 does not exist.
  IF v_heads <= 0 THEN
    RETURN NULL;
  END IF;

  -- ➕ SPONSOR · the extra heads. Every un-named sponsor who is still coming
  -- counts as weight − 1 MORE heads in the division, so the shares they take
  -- come out of the same pot everybody else's do — and still add up to it.
  -- Same "still coming" predicate as the named sum above and the headcount; a
  -- named sponsor is excluded because she is already out of the division.
  SELECT COALESCE(SUM(public.papic_share_weight(g.role, g.extra_roles) - 1), 0)::INTEGER
    INTO v_extra
    FROM public.guests g
   WHERE g.event_id = v_event_id
     AND g.deleted_at IS NULL
     AND g.rsvp_status::text <> 'declined'
     AND NOT EXISTS (
       SELECT 1 FROM public.papic_guest_spend_ceilings c WHERE c.guest_id = g.guest_id
     );

  -- ⚖ THE FLOOR OF ONE, AND WHY IT IS NOT A FUDGE. A 200-guest celebration
  -- holding only the free 50-credit grant divides to a share of zero, and a
  -- ceiling of zero would refuse every guest their FIRST photograph — with a
  -- refusal that reads "you have spent your allowance" when they have spent
  -- nothing. The pot is the money gate and it is untouched; this is a FAIRNESS
  -- rule between guests, and a fairness rule must never be the thing that
  -- stops the party. It never opens more credits than the pot holds, because
  -- the pot refuses on its own.
  -- ➕ SPONSOR · the floor applies to ONE share; a sponsor takes her weight in them.
  RETURN GREATEST(
           1,
           FLOOR(GREATEST(v_total - v_named_sum, 0)::NUMERIC / (v_heads + v_extra))::INTEGER
         ) * COALESCE(v_weight, 1);
END;
$function$;

COMMENT ON FUNCTION public.papic_guest_spend_ceiling(UUID) IS
  'How many CREDITS this guest may still be allowed to spend in total — the ONE '
  'place the three tiers are resolved. NULL means no ceiling binds (the switch '
  'is off, the couple released the rest, the celebration is in its last stretch, '
  'or there is no pot to divide). A sponsor who is not named takes 3 (principal) '
  'or 2 (cord, veil, coin, candle) equal shares — papic_share_weight. Derived at '
  'spend time and never stamped on a guest: the pot grows with top-ups and the '
  'headcount grows with RSVPs, so a stored share is stale the moment either moves.';

-- CREATE OR REPLACE keeps the grants, and these restate them so a reader of
-- this file alone sees the whole fence.
REVOKE ALL ON FUNCTION public.papic_guest_spend_ceiling(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_guest_spend_ceiling(UUID) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · REFUSE TO APPLY IF THE TIME MACHINE RAN
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_def  TEXT;
  v_cnt  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_cnt
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'papic_guest_spend_ceiling';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'papic_guest_spend_ceiling: expected exactly one overload, found %', v_cnt;
  END IF;

  v_def := pg_get_functiondef('public.papic_guest_spend_ceiling(uuid)'::regprocedure);
  IF v_def NOT LIKE '%papic_guest_spend_ceilings c%'
     OR v_def NOT LIKE '%papic_guest_spend_ceiling_released_at%'
     OR v_def NOT LIKE '%INTERVAL ''2 hours''%'
     OR v_def NOT LIKE '%papic_event_guest_headcount%'
     OR v_def NOT LIKE '%GREATEST(%1,%'
     OR v_def NOT LIKE '%papic_share_weight%' THEN
    RAISE EXCEPTION 'papic_guest_spend_ceiling lost an arm (named, release, late release, headcount, floor or sponsor weight)';
  END IF;
END;
$$;
