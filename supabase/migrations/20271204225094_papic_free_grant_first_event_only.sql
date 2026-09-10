-- papic_free_grant_first_event_only
--
-- The free Papic pool is now ACCOUNT-scoped, not event-scoped (owner-confirmed
-- 2026-09-04): it's a "try Papic once" sample, granted on an account's FIRST
-- event ever, regardless of event_type. Every event after that gets a minimal
-- 1-point grant instead of the full allowance.
--
-- 🔑 THE REAL SEEDING POINT WAS A DB TRIGGER, NOT THE APP CODE. RULE 0 miss
-- caught mid-build: apps/web/lib/papic-free-grant.ts's own docblock claims
-- "nothing ever wrote the free grant" and frames its TS insert as the arming
-- mechanism — but migration 20270902100836 already added an AFTER INSERT
-- trigger on public.events (`papic_seed_free_grant_trg`) that unconditionally
-- grants the full allowance the instant an events row lands, before any app
-- code runs. The TS-layer insert was racing the trigger and always losing
-- (23505, "already armed"). That docblock is stale as of this migration —
-- the trigger, not the TS insert, has been the live mechanism.
--
-- THE MOVE: events has no owner column — "whose account is this" only
-- becomes knowable once an event_members row lands. The old trigger fired on
-- events INSERT and could never have implemented account-scoping no matter
-- how the function body changed. So the trigger moves from `events` to
-- `event_members`, filtered to member_type = 'couple' (the sole insertion
-- shape all 4 event-creation call sites already use) — the earliest point an
-- event has a knowable owner.
--
-- 🚨 A 0-POINT ROW WAS THE FIRST DRAFT AND IT WAS WRONG. The live
-- `papic_event_pool_status()` (migration 20271185813837) fences on
-- `SUM(points) > 0`, not on whether a grant row exists — its own comment:
-- "granted_points <= 0 is this function's test for 'this event has no Papic
-- pool product at all'". A 0-point free_grant row is therefore
-- INDISTINGUISHABLE from no grant at all and would silently revert the event
-- to unmetered — exactly the bug this whole mechanism exists to prevent. So a
-- repeat event gets 1 point (the module's `PAPIC_REPEAT_EVENT_GRANT_POINTS`),
-- not 0 — enough to flip `applies = TRUE`, consumed by the first capture.
-- The `points > 0` CHECK is therefore left untouched; no schema relaxation
-- needed for this pass.
--
-- IDEMPOTENT: DROP TRIGGER IF EXISTS + CREATE OR REPLACE re-runs cleanly.
-- Does not touch already-armed events (the one-free-grant-per-event partial
-- unique index is untouched and still the backstop against double arming
-- from the trigger + the TS self-heal call racing each other).

DROP TRIGGER IF EXISTS papic_seed_free_grant_trg ON public.events;

CREATE OR REPLACE FUNCTION public.papic_seed_free_grant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pts       INTEGER;
  v_has_prior BOOLEAN;
BEGIN
  IF NEW.member_type <> 'couple' THEN
    RETURN NEW;
  END IF;

  -- Idempotent: one free_grant per event, ever. Also the backstop against the
  -- TS-layer self-heal call (ensureFreePapicPoolGrantAdmin) racing this
  -- trigger — whichever writes first wins, the loser sees this and no-ops.
  IF EXISTS (
    SELECT 1 FROM public.papic_event_point_grants
     WHERE event_id = NEW.event_id AND source = 'free_grant'
  ) THEN
    RETURN NEW;
  END IF;

  -- Account-scoped: any OTHER event already carrying a 'couple' row for this
  -- user_id means this is not their first event, regardless of event_type
  -- (per-type would have been a 16x farming loophole across event_type).
  SELECT EXISTS (
    SELECT 1 FROM public.event_members
     WHERE user_id = NEW.user_id
       AND member_type = 'couple'
       AND event_id <> NEW.event_id
  ) INTO v_has_prior;

  IF v_has_prior THEN
    -- 1, not 0 — see the "0-point row was wrong" note above.
    INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
    VALUES (
      NEW.event_id, 1, 'free_grant',
      'Papic Free minimum — not this account''s first event (owner-confirmed 2026-09-04).'
    );
    RETURN NEW;
  END IF;

  SELECT free_grant_points INTO v_pts
    FROM public.papic_event_pool_config WHERE config_key = 'default';
  v_pts := COALESCE(v_pts, 50);
  -- PRE-EXISTING behavior, unchanged: an admin-set 0 skips the insert
  -- entirely (no fence at all), not a fenced row.
  IF v_pts <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
  VALUES (NEW.event_id, v_pts, 'free_grant', 'Papic Free · shared 50-pt event pool');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS papic_seed_free_grant_trg ON public.event_members;
CREATE TRIGGER papic_seed_free_grant_trg
  AFTER INSERT ON public.event_members
  FOR EACH ROW EXECUTE FUNCTION public.papic_seed_free_grant();
