-- a_plan_hold_keeps_extra_services
-- ═══════════════════════════════════════════════════════════════════════════
-- 🧭 THE SERVICES LIFE CYCLE — A SERVICE THE PLAN CANNOT HOLD GOES ON HOLD,
-- AND THE SUPPLIER PICKS WHICH STAY ON.
--
-- Owner rulings, specs-repo DECISION_LOG, 2026-11-06:
--   · "SERVICES LIFE CYCLE (OWNER'S MODEL) — MANY AT SIGN-UP, ALL ACTIVE THROUGH
--     THE FIRST BOOKING, THEN ONE ACTIVE UNTIL VERIFIED + UPGRADED." — (4) all
--     services go ON HOLD except the ones they pick (hidden, can't accept, never
--     deleted); once verified AND upgraded, every held service reactivates;
--     (5) a couple's booking naming an on-hold service → the couple sees
--     "Waiting on the supplier to accept", the supplier "Upgrade to accept".
--   · "A DOWNGRADE PUTS EXTRA SERVICES ON HOLD — THE SUPPLIER PICKS WHICH STAY
--     ON." — at downgrade the supplier chooses; when the lower plan STARTS the
--     rest go on hold; upgrading again turns them back on. Build note: "on hold"
--     must be told apart from a card the supplier switched off themselves
--     (`is_active`) — "reuse, don't add a parallel flag, unless the two cannot be
--     told apart".
--   · "… THE AFTER-FIRST-BOOKING CHOICE IS A PLAN PICKER WITH SWAP." — the
--     picker is app code (`lib/service-plan-hold.ts`); this file is the state it
--     writes and the rules that keep that state true.
--
-- ── WHY is_active IS REUSED, AND WHAT IS ADDED ─────────────────────────────
-- `vendor_services.is_active` IS the card's public switch: the public read
-- policy, `/v/[slug]`, Find and every booking path read it. A hold therefore
-- sets `is_active = false`, so every place that hides a draft hides a held card
-- for the same reason and no reader learns a second flag — exactly the shape of
-- the admin take-down (20271309211124). What `is_active` cannot say on its own:
--   1. that the PLAN turned it off, not the supplier (release must turn on only
--      what the plan turned off) → `plan_hold` + `plan_hold_was_live`;
--   2. when it comes back → `plan_hold_returns_on` (the plan that holds every
--      card the shop has, worked out by the app's fit rule when the supplier
--      picks — NULL when no plan holds them all: it then comes back only by a
--      new pick);
--   3. a pick made BEFORE the lower plan starts (a downgrade, or an upgrade
--      chosen with a swap) → `plan_hold = 'scheduled'` + `plan_hold_starts_on`.
--
-- ── THE RULES ───────────────────────────────────────────────────────────────
--   A. A held card cannot be live — whoever asks (trigger
--      `a_plan_held_card_stays_held`, same shape as the take-down).
--   B. Only Setnayan's server sets or lifts a hold: a browser session
--      (current_user authenticated/anon) that is not an admin may not write the
--      four columns. The supplier's pick goes through the server action, which
--      checks the pick against the plan with the same rule the create gate uses.
--   C. When the shop's plan CHANGES (`vendor_profiles.tier_state`), the
--      database acts on the pick — no cron, no app call to forget:
--        · 'scheduled' cards go on hold when the plan they were picked for
--          starts, or when the shop drops below it;
--        · a 'scheduled' pick is dropped when the shop moves UP past it (more
--          room than the pick was made for);
--        · 'held' cards come back when the shop is VERIFIED and on a plan at or
--          above `plan_hold_returns_on` — back to exactly the switch they had
--          (`plan_hold_was_live`), and never live if Setnayan took it down.
--   D. A held card takes no booking: no marketplace `event_vendors` row may move
--      INTO a booked status while its card (`service_id`) or any card it asked
--      for (`requested_service_ids`) is held. Same scope and grandfathering as
--      `enforce_bookings_open` (20271302310560): an already-booked row is never
--      re-checked. The couple's ask itself is NOT refused — it stays open, so
--      the couple reads "waiting for ‹shop› to agree" (owner: the couple is
--      never stopped).
--
-- `vendor_agree_to_lock` is NOT redefined (PR #7339 redefines it; a second
-- copy here would silently revert one of the two). Rule D is a trigger on the
-- row the RPC flips, so it holds for every path that books.
--
-- RLS: unchanged. The supplier reads their own card's hold through
-- `vendor_services_manage`; `vendor_services_public_read` requires
-- `is_active = true`, which a held card never is.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS plan_hold TEXT,
  ADD COLUMN IF NOT EXISTS plan_hold_starts_on public.vendor_tier_state,
  ADD COLUMN IF NOT EXISTS plan_hold_returns_on public.vendor_tier_state,
  ADD COLUMN IF NOT EXISTS plan_hold_was_live BOOLEAN,
  ADD COLUMN IF NOT EXISTS plan_held_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_services.plan_hold IS
  'NULL = the plan is not holding this card. held = on hold because the shop''s plan holds fewer services than it has (owner 2026-11-06, SERVICES LIFE CYCLE / A DOWNGRADE PUTS EXTRA SERVICES ON HOLD): is_active is false, it takes no booking, it is never deleted. scheduled = picked to go on hold when plan_hold_starts_on starts (a downgrade, or an upgrade chosen with a swap); still live until then. Set only by the server (trigger a_plan_held_card_stays_held).';
COMMENT ON COLUMN public.vendor_services.plan_hold_starts_on IS
  'For plan_hold = scheduled: the plan whose start puts this card on hold (also when the shop drops below it). NULL otherwise.';
COMMENT ON COLUMN public.vendor_services.plan_hold_returns_on IS
  'The plan at which this card comes back on, once the shop is also verified: the lowest plan that holds every card the shop had when the supplier picked (app fit rule, lib/service-plan-hold.ts). NULL = no plan holds them all; it comes back only through a new pick.';
COMMENT ON COLUMN public.vendor_services.plan_hold_was_live IS
  'Whether the card was live (is_active) when the plan put it on hold — a release restores exactly that, so a card the supplier had switched off stays off.';
COMMENT ON COLUMN public.vendor_services.plan_held_at IS
  'When the plan put this card on hold (plan_hold = held). NULL otherwise.';

ALTER TABLE public.vendor_services
  DROP CONSTRAINT IF EXISTS vendor_services_plan_hold_shape;
ALTER TABLE public.vendor_services
  ADD CONSTRAINT vendor_services_plan_hold_shape CHECK (
    (plan_hold IS NULL
       AND plan_hold_starts_on IS NULL AND plan_hold_returns_on IS NULL
       AND plan_hold_was_live IS NULL AND plan_held_at IS NULL)
    OR (plan_hold = 'held'
       AND plan_hold_starts_on IS NULL
       AND plan_hold_was_live IS NOT NULL AND plan_held_at IS NOT NULL)
    OR (plan_hold = 'scheduled'
       AND plan_hold_starts_on IS NOT NULL
       AND plan_hold_was_live IS NULL AND plan_held_at IS NULL)
  );

CREATE INDEX IF NOT EXISTS vendor_services_plan_hold_idx
  ON public.vendor_services (vendor_profile_id)
  WHERE plan_hold IS NOT NULL;

-- ── A + B · a held card stays held; only the server sets the hold ──────────

CREATE OR REPLACE FUNCTION public.a_plan_held_card_stays_held()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- B · Only Setnayan's server (or an admin) sets or lifts a plan hold.
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.plan_hold IS NOT NULL OR NEW.plan_hold_starts_on IS NOT NULL
         OR NEW.plan_hold_returns_on IS NOT NULL OR NEW.plan_hold_was_live IS NOT NULL
         OR NEW.plan_held_at IS NOT NULL THEN
        RAISE EXCEPTION 'plan_hold_is_the_plans: a new card cannot start on hold.'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    ELSIF NEW.plan_hold IS DISTINCT FROM OLD.plan_hold
       OR NEW.plan_hold_starts_on IS DISTINCT FROM OLD.plan_hold_starts_on
       OR NEW.plan_hold_returns_on IS DISTINCT FROM OLD.plan_hold_returns_on
       OR NEW.plan_hold_was_live IS DISTINCT FROM OLD.plan_hold_was_live
       OR NEW.plan_held_at IS DISTINCT FROM OLD.plan_held_at THEN
      RAISE EXCEPTION 'plan_hold_is_the_plans: pick which services stay on from Which services stay on.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- A · A card the plan holds cannot be live — whoever asks.
  IF NEW.plan_hold = 'held' AND NEW.is_active IS TRUE THEN
    RAISE EXCEPTION
      'service_on_hold: this service is on hold on your plan, so it cannot go live. Upgrade, or pick it in Which services stay on.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.a_plan_held_card_stays_held() IS
  'A service card the plan holds (plan_hold = held) cannot be made live by anyone, and only the server or an admin may write the plan-hold columns. Owner 2026-11-06 SERVICES LIFE CYCLE. 20271320474333.';

DROP TRIGGER IF EXISTS a_plan_held_card_stays_held ON public.vendor_services;
CREATE TRIGGER a_plan_held_card_stays_held
  BEFORE INSERT OR UPDATE ON public.vendor_services
  FOR EACH ROW
  EXECUTE FUNCTION public.a_plan_held_card_stays_held();

REVOKE ALL ON FUNCTION public.a_plan_held_card_stays_held() FROM PUBLIC, anon, authenticated;

-- ── C · the plan changes → the pick is acted on ────────────────────────────

CREATE OR REPLACE FUNCTION public.plan_holds_follow_the_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new  INTEGER := public.vendor_tier_rank(NEW.tier_state);
  v_old  INTEGER := public.vendor_tier_rank(OLD.tier_state);
  v_card RECORD;
BEGIN
  IF NEW.tier_state IS DISTINCT FROM OLD.tier_state THEN
    -- The plan a card was picked to go on hold for has started (or the shop
    -- dropped below it): on hold now, remembering the switch it had.
    UPDATE public.vendor_services vs
       SET plan_hold = 'held',
           plan_hold_was_live = vs.is_active,
           is_active = FALSE,
           plan_held_at = NOW(),
           plan_hold_starts_on = NULL
     WHERE vs.vendor_profile_id = NEW.vendor_profile_id
       AND vs.plan_hold = 'scheduled'
       AND (
         v_new = public.vendor_tier_rank(vs.plan_hold_starts_on)
         OR (v_new < v_old AND v_new < public.vendor_tier_rank(vs.plan_hold_starts_on))
       );

    -- Moved UP past the plan the pick was made for: more room than the pick
    -- assumed, so the pick no longer applies.
    UPDATE public.vendor_services vs
       SET plan_hold = NULL,
           plan_hold_starts_on = NULL,
           plan_hold_returns_on = NULL
     WHERE vs.vendor_profile_id = NEW.vendor_profile_id
       AND vs.plan_hold = 'scheduled'
       AND v_new > v_old
       AND v_new > public.vendor_tier_rank(vs.plan_hold_starts_on);
  END IF;

  -- Verified AND on a plan that holds them: every held card comes back, to the
  -- switch it had. One row at a time, so a card that can no longer go live (a
  -- publish rule tightened since, a take-down) comes back OFF instead of
  -- refusing the plan change that paid for it.
  IF NEW.verification_state = 'verified'::public.vendor_verification_state THEN
    FOR v_card IN
      SELECT vs.vendor_service_id
        FROM public.vendor_services vs
       WHERE vs.vendor_profile_id = NEW.vendor_profile_id
         AND vs.plan_hold = 'held'
         AND vs.plan_hold_returns_on IS NOT NULL
         AND v_new >= public.vendor_tier_rank(vs.plan_hold_returns_on)
    LOOP
      PERFORM public.plan_hold_release(v_card.vendor_service_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.plan_holds_follow_the_plan() IS
  'When a shop''s plan or verification changes: scheduled plan holds start when the picked plan starts (or the shop drops below it), and held cards come back (to their own switch) once the shop is verified and on plan_hold_returns_on or above. Owner 2026-11-06 SERVICES LIFE CYCLE + A DOWNGRADE PUTS EXTRA SERVICES ON HOLD. 20271320474333.';

DROP TRIGGER IF EXISTS plan_holds_follow_the_plan ON public.vendor_profiles;
CREATE TRIGGER plan_holds_follow_the_plan
  AFTER UPDATE OF tier_state, verification_state ON public.vendor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.plan_holds_follow_the_plan();

REVOKE ALL ON FUNCTION public.plan_holds_follow_the_plan() FROM PUBLIC, anon, authenticated;

-- ── D · a held card takes no booking ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.a_held_service_takes_no_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_confirmed CONSTANT public.vendor_status[] :=
    ARRAY['contracted','deposit_paid','delivered','complete']::public.vendor_status[];
  v_title TEXT;
BEGIN
  IF NEW.marketplace_vendor_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT (NEW.status = ANY (v_confirmed)) THEN
    RETURN NEW;
  END IF;
  -- Grandfathered: an already-booked row is never re-checked.
  IF TG_OP = 'UPDATE' AND OLD.status = ANY (v_confirmed) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(btrim(vs.title), ''), vs.category)
    INTO v_title
    FROM public.vendor_services vs
   WHERE vs.vendor_profile_id = NEW.marketplace_vendor_id
     AND vs.plan_hold = 'held'
     AND (vs.vendor_service_id = NEW.service_id
          OR vs.vendor_service_id = ANY (COALESCE(NEW.requested_service_ids, '{}'::uuid[])))
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'service_on_hold: % is on hold on this shop''s plan, so this booking cannot be accepted until the shop upgrades (marketplace_vendor_id=%)',
      v_title, NEW.marketplace_vendor_id
      USING ERRCODE = 'check_violation',
            HINT = 'Upgrade the plan, or pick this service in Which services stay on.';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.a_held_service_takes_no_booking() IS
  'Owner 2026-11-06 SERVICES LIFE CYCLE (5): no marketplace event_vendors row may move INTO a booked status while its card or a card it asked for is on a plan hold. The ask itself stays open (the couple waits). Same scope and grandfathering as enforce_bookings_open. 20271320474333.';

REVOKE ALL ON FUNCTION public.a_held_service_takes_no_booking() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendors_refuse_a_held_service ON public.event_vendors;
CREATE TRIGGER event_vendors_refuse_a_held_service
  BEFORE INSERT OR UPDATE ON public.event_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.a_held_service_takes_no_booking();

-- ── THE FIRST BOOKING — read, never counted ────────────────────────────────
-- Owner 2026-11-06: "the first booking = any booking on Setnayan (Setnayan-found
-- OR a couple's QR), whichever is marked delivered first." The fact already
-- exists: an `event_vendors` row of this shop in 'delivered' / 'complete'. This
-- function READS it — no counter, no stored copy. ONE definition, asked by the
-- pick below and by the app (lib/service-plan-hold.server.ts), so the screen and
-- the write can never disagree.
-- ⚠ SEAM (PR #7372, not on main when this was written): "one per business" —
-- once `booking_fee_business_matches` ships, a matched shop's delivered booking
-- should count here too. Main has no business match, so this counts the shop.

CREATE OR REPLACE FUNCTION public.vendor_first_booking_done(p_vendor_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.event_vendors ev
     WHERE ev.marketplace_vendor_id = p_vendor_profile_id
       AND ev.status IN ('delivered'::public.vendor_status, 'complete'::public.vendor_status)
  );
$function$;

COMMENT ON FUNCTION public.vendor_first_booking_done(UUID) IS
  'Has this shop had a booking on Setnayan marked delivered (or complete)? The "first booking" of the SERVICES LIFE CYCLE ruling (owner 2026-11-06): until it, every service stays on. Reads event_vendors.status; counts nothing.';

REVOKE ALL ON FUNCTION public.vendor_first_booking_done(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_first_booking_done(UUID) TO service_role;

-- ── RELEASE ONE CARD (shared by the pick and nothing else that guesses) ────

CREATE OR REPLACE FUNCTION public.plan_hold_release(p_vendor_service_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    UPDATE public.vendor_services
       SET is_active = (COALESCE(plan_hold_was_live, FALSE) AND taken_down_at IS NULL),
           plan_hold = NULL, plan_hold_starts_on = NULL, plan_hold_returns_on = NULL,
           plan_hold_was_live = NULL, plan_held_at = NULL
     WHERE vendor_service_id = p_vendor_service_id
       AND plan_hold = 'held';
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.vendor_services
       SET is_active = FALSE,
           plan_hold = NULL, plan_hold_starts_on = NULL, plan_hold_returns_on = NULL,
           plan_hold_was_live = NULL, plan_held_at = NULL
     WHERE vendor_service_id = p_vendor_service_id
       AND plan_hold = 'held';
  END;
END;
$function$;

COMMENT ON FUNCTION public.plan_hold_release(UUID) IS
  'Take one card off its plan hold, back to the switch it had (never live if taken down; off if it can no longer go live). 20271320474333.';

REVOKE ALL ON FUNCTION public.plan_hold_release(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_hold_release(UUID) TO service_role;

-- ── THE PICK — "Which services stay on" writes here, all or nothing ────────
-- The app checks the pick against the plan (lib/service-plan-hold.ts — the same
-- family + per-kind rule the card's create gate enforces) and hands over the
-- kept cards and the plan that holds them all. WHEN it takes effect is decided
-- HERE from the shop row, never from the caller:
--   · p_plan = the shop's plan            → now: the rest go on hold now.
--     On Free / Verified this waits for the first booking (all stay on until it).
--   · p_plan above the shop's plan        → upgrade: the rest go on hold when that
--     plan starts; a kept held card comes back when it does.
--   · p_plan = the scheduled lower plan   → at_plan_change: the rest go on hold
--     when the lower plan starts (the downgrade ruling).
--   · anything else                       → refused (no_such_change).
-- service_role only: the fit check is the app's, so a browser may not call this.

CREATE OR REPLACE FUNCTION public.apply_service_plan_pick(
  p_vendor_profile_id UUID,
  p_plan public.vendor_tier_state,
  p_keep UUID[],
  p_returns_on public.vendor_tier_state
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier    public.vendor_tier_state;
  v_pending public.vendor_tier_state;
  v_mode    TEXT;
  v_keep    UUID[] := COALESCE(p_keep, '{}'::uuid[]);
  v_id      UUID;
  v_held    INTEGER := 0;
  v_sched   INTEGER := 0;
BEGIN
  SELECT vp.tier_state, vp.pending_tier
    INTO v_tier, v_pending
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = p_vendor_profile_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_shop');
  END IF;

  v_mode := CASE
    WHEN p_plan = v_tier THEN 'now'
    WHEN public.vendor_tier_rank(p_plan) > public.vendor_tier_rank(v_tier) THEN 'upgrade'
    WHEN v_pending IS NOT NULL AND p_plan = v_pending THEN 'at_plan_change'
    ELSE NULL
  END;
  IF v_mode IS NULL THEN
    RETURN jsonb_build_object('status', 'no_such_change');
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_keep) k(id)
     WHERE NOT EXISTS (
       SELECT 1 FROM public.vendor_services vs
        WHERE vs.vendor_service_id = k.id AND vs.vendor_profile_id = p_vendor_profile_id)
  ) THEN
    RETURN jsonb_build_object('status', 'not_your_card');
  END IF;

  IF v_mode = 'now'
     AND public.vendor_tier_rank(v_tier) <= public.vendor_tier_rank('verified'::public.vendor_tier_state)
     AND NOT public.vendor_first_booking_done(p_vendor_profile_id) THEN
    RETURN jsonb_build_object('status', 'first_booking_not_done');
  END IF;

  -- Kept cards: a scheduled pick is dropped either way.
  UPDATE public.vendor_services
     SET plan_hold = NULL, plan_hold_starts_on = NULL, plan_hold_returns_on = NULL
   WHERE vendor_profile_id = p_vendor_profile_id
     AND vendor_service_id = ANY (v_keep)
     AND plan_hold = 'scheduled';

  IF v_mode = 'now' THEN
    -- Kept + held → back on now.
    FOR v_id IN
      SELECT vendor_service_id FROM public.vendor_services
       WHERE vendor_profile_id = p_vendor_profile_id
         AND vendor_service_id = ANY (v_keep) AND plan_hold = 'held'
    LOOP
      PERFORM public.plan_hold_release(v_id);
    END LOOP;

    -- Not kept → on hold now (a held one just learns its new way back).
    UPDATE public.vendor_services
       SET plan_hold = 'held',
           plan_hold_was_live = is_active,
           is_active = FALSE,
           plan_held_at = NOW(),
           plan_hold_starts_on = NULL,
           plan_hold_returns_on = p_returns_on
     WHERE vendor_profile_id = p_vendor_profile_id
       AND NOT (vendor_service_id = ANY (v_keep))
       AND plan_hold IS DISTINCT FROM 'held';
    GET DIAGNOSTICS v_held = ROW_COUNT;
    UPDATE public.vendor_services
       SET plan_hold_returns_on = p_returns_on
     WHERE vendor_profile_id = p_vendor_profile_id
       AND NOT (vendor_service_id = ANY (v_keep))
       AND plan_hold = 'held';
  ELSE
    IF v_mode = 'upgrade' THEN
      -- Kept + held → comes back when the picked plan starts (and the shop is verified).
      UPDATE public.vendor_services
         SET plan_hold_returns_on = p_plan
       WHERE vendor_profile_id = p_vendor_profile_id
         AND vendor_service_id = ANY (v_keep) AND plan_hold = 'held';
    END IF;

    -- Not kept → on hold when the picked plan starts.
    UPDATE public.vendor_services
       SET plan_hold = 'scheduled',
           plan_hold_starts_on = p_plan,
           plan_hold_returns_on = p_returns_on
     WHERE vendor_profile_id = p_vendor_profile_id
       AND NOT (vendor_service_id = ANY (v_keep))
       AND plan_hold IS DISTINCT FROM 'held';
    GET DIAGNOSTICS v_sched = ROW_COUNT;
    UPDATE public.vendor_services
       SET plan_hold_returns_on = p_returns_on
     WHERE vendor_profile_id = p_vendor_profile_id
       AND NOT (vendor_service_id = ANY (v_keep))
       AND plan_hold = 'held';
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'mode', v_mode, 'held', v_held, 'scheduled', v_sched);
END;
$function$;

COMMENT ON FUNCTION public.apply_service_plan_pick(UUID, public.vendor_tier_state, UUID[], public.vendor_tier_state) IS
  'The supplier''s "Which services stay on" pick, all or nothing (owner 2026-11-06 SERVICES LIFE CYCLE · A DOWNGRADE PUTS EXTRA SERVICES ON HOLD · PLAN PICKER WITH SWAP). Mode from the shop row: now · upgrade · at_plan_change; Free/Verified "now" waits for vendor_first_booking_done. service_role only — the fit check is lib/service-plan-hold.ts.';

REVOKE ALL ON FUNCTION public.apply_service_plan_pick(UUID, public.vendor_tier_state, UUID[], public.vendor_tier_state) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_service_plan_pick(UUID, public.vendor_tier_state, UUID[], public.vendor_tier_state) TO service_role;

COMMIT;
