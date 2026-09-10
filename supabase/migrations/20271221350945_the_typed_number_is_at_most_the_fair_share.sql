-- the typed number is at most the fair share
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE OR REPLACE FUNCTION …
--
-- ═══════════════════════════════════════════════════════════════════════════
-- A NUMBER THE COUPLE TYPES FOR "EVERYONE ELSE" IS AN "AT MOST"
-- ═══════════════════════════════════════════════════════════════════════════
-- The couple's sheet and the database were two copies of one rule, and they
-- disagreed:
--
--   • the SHEET (`splitTheRest`) shows a typed number CAPPED at the equal
--     share — `Math.min(everyoneElse, derived)` — so a couple who types 500 on
--     a pot that divides to 14 is told "everyone else gets 14 credits each";
--   • the DATABASE returned the typed number RAW, so every un-named guest could
--     actually spend up to 500 (×3 for a principal sponsor since 20271220526938).
--
-- ⚖ THE SHEET IS RIGHT, AND AN OWNER RULING SAYS WHY. There is no ruling on the
-- typed number itself (DECISION_LOG searched 2026-09-11), but there are two it
-- must not break:
--   • "CAPPING EVERYONE IS THE GUARANTEE" (2026-08-28) — nothing is reserved;
--     a share is safe only because every other guest is held to theirs;
--   • 7c — "a named guest's shots STAY HERS, protected all night."
-- A raw 500 each on a pot that divides to 14 lets the first guests through the
-- door spend what the named guests and the late arrivals were promised. So the
-- typed number now binds as "at most": LEAST(typed, the equal share), and a
-- sponsor takes her weight in THAT.
--
-- 🔑 IT RISES ON ITS OWN. The share is derived at spend time, so a top-up lifts
-- every guest toward the couple's number — and never past it. Typing 50 means
-- "up to 50 each, as far as the pot reaches".
--
-- Where there is nothing to divide — no pot applies, or everybody on the list is
-- named — the typed number still stands on its own, exactly as before.
--
-- ⛔ CREATE OR REPLACE IS A TIME MACHINE. The body below starts from
-- PRODUCTION's live `pg_get_functiondef`, read 2026-09-11 after 20271220526938
-- applied. The named tier, both releases, the headcount, the sponsor weight and
-- the floor of one are carried unchanged; only the order of tier 2 moves (the
-- typed number is now compared with the share instead of returning before it is
-- computed). The assertion at the foot refuses a body that lost any of them.
-- Inert on merge: measured in prod, 0 celebrations have the switch on and 0 have
-- a typed number.

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
  v_share      INTEGER;
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

  -- ── TIER 2 · the equal share of what the named guests left ───────────────
  -- Computed FIRST now, whether or not the couple typed a number, because a
  -- typed number is compared against it (below). v_share stays NULL where there
  -- is nothing to divide.
  SELECT applies, total_points
    INTO v_applies, v_total
    FROM public.papic_event_pool_status(v_event_id);

  -- No pot at all: there is nothing to divide and the ownership gate refuses
  -- this capture anyway. A share here would be arithmetic about nothing.
  IF COALESCE(v_applies, FALSE) THEN
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
    -- There is no "everyone else" to divide among, so no share exists.
    IF v_heads > 0 THEN
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
      v_share := GREATEST(
                   1,
                   FLOOR(GREATEST(v_total - v_named_sum, 0)::NUMERIC / (v_heads + v_extra))::INTEGER
                 );
    END IF;
  END IF;

  -- ── TIER 2 · the number the couple typed is AT MOST the share ────────────
  -- 🔑 THE FIX. It used to RETURN here, before the share existed, so a typed
  -- 500 bound as 500 on a pot that divides to 14 — while the couple's sheet
  -- showed 14. Now it can only LOWER the share, never raise it past what the
  -- pot divides to. Where there is no share (no pot, nobody left to divide
  -- among), the typed number stands on its own, as it always did.
  -- The couple's number is ≥ 1 by CHECK, so the floor of one survives LEAST.
  IF v_everyone IS NOT NULL THEN
    v_share := LEAST(v_everyone, COALESCE(v_share, v_everyone));
  END IF;

  IF v_share IS NULL THEN
    RETURN NULL;
  END IF;

  -- ➕ SPONSOR · the floor applies to ONE share; a sponsor takes her weight in them.
  -- The LEAST keeps an absurd typed figure from overflowing INTEGER.
  RETURN LEAST(v_share::BIGINT * COALESCE(v_weight, 1), 2147483647)::INTEGER;
END;
$function$;

COMMENT ON FUNCTION public.papic_guest_spend_ceiling(UUID) IS
  'How many CREDITS this guest may still be allowed to spend in total — the ONE '
  'place the three tiers are resolved. NULL means no ceiling binds (the switch '
  'is off, the couple released the rest, the celebration is in its last stretch, '
  'or there is no pot to divide and no typed number). A number the couple typed '
  'for everyone else is AT MOST the equal share, never more. A sponsor who is not '
  'named takes 3 (principal) or 2 (cord, veil, coin, candle) shares — '
  'papic_share_weight. Derived at spend time and never stamped on a guest.';

-- CREATE OR REPLACE keeps the grants, and these restate them so a reader of
-- this file alone sees the whole fence.
REVOKE ALL ON FUNCTION public.papic_guest_spend_ceiling(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_guest_spend_ceiling(UUID) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- REFUSE TO APPLY IF THE TIME MACHINE RAN — or the fix did not land
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

  -- ⚠ Each needle is a DECISION the body makes, not a name it happens to read.
  v_def := pg_get_functiondef('public.papic_guest_spend_ceiling(uuid)'::regprocedure);
  IF v_def NOT LIKE '%IF v_named IS NOT NULL THEN%RETURN v_named;%'
     OR v_def NOT LIKE '%IF v_released IS NOT NULL THEN%RETURN NULL;%'
     OR v_def NOT LIKE '%NOW() >= v_auto_at THEN%RETURN NULL;%'
     OR v_def NOT LIKE '%papic_event_guest_headcount(v_event_id)%'
     OR v_def NOT LIKE '%GREATEST(%1,%(v_heads + v_extra)%'
     OR v_def NOT LIKE '%v_share := LEAST(v_everyone, COALESCE(v_share, v_everyone));%'
     OR v_def NOT LIKE '%v_share::BIGINT * COALESCE(v_weight, 1)%' THEN
    RAISE EXCEPTION 'papic_guest_spend_ceiling lost an arm (named, release, late release, headcount, floor, typed-at-most or sponsor weight)';
  END IF;
  -- And the old early return must be GONE, not merely joined by the new rule.
  IF v_def LIKE '%IF v_everyone IS NOT NULL THEN%RETURN LEAST(v_everyone%' THEN
    RAISE EXCEPTION 'papic_guest_spend_ceiling still returns the typed number raw';
  END IF;
END;
$$;
