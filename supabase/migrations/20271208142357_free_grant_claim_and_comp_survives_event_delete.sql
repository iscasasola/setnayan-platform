-- free_grant_claim_and_comp_survives_event_delete
--
-- Two defects shipped 2026-09-05 in migrations 20271204225094 and
-- 20271205612762, found by a post-merge audit the same day. Both are money.
--
-- ══ DEFECT 1 — "first event ever" was stored in a row the customer can DELETE ══
--
-- 20271204225094 resolved "is this the account's first event" by asking
-- `event_members` for another 'couple' row. But `couple_can_delete_member`
-- (migration 20260513040000) is `FOR DELETE TO authenticated USING (event_id IN
-- (SELECT public.current_couple_event_ids()) OR is_admin())` — so a signed-in
-- customer can delete their OWN couple row with one PostgREST call against the
-- public anon key. The history the rule reads then does not exist, and the next
-- event they create earns another full 50. Repeatable, and strictly profitable:
-- the credits already granted to the older event stay on that event.
--
-- That is precisely the farming the feature was built that morning to stop —
-- reopened through a different door. 🔑 A RULE IS ONLY AS DURABLE AS THE ROW IT
-- READS. Membership is the customer's to remove; entitlement history is not.
--
-- Fix: an append-only claim, one per account, in a table no browser role can
-- read or write, keyed on the user rather than on any deletable relationship.
-- `papic_claim_free_pool()` becomes the SINGLE decision site — the trigger and
-- the app's self-heal both call it, so the two can never drift apart the way
-- the trigger and `lib/papic-free-grant.ts`'s docblock already did once.
--
-- ══ DEFECT 2 — comp_grants.event_id CASCADEd, destroying the money record ══
--
-- 20271205612762 wrote `REFERENCES public.events(event_id) ON DELETE CASCADE`.
-- A comp writes no order, no payment and no receipt, so `deleteEvent`'s money
-- gate does not block on one; the couple removes the celebration and the whole
-- grant row goes with it — retail value, rationale, who granted it, gone. The
-- house pattern for a money-adjacent event reference is SET NULL
-- (`orders.event_id`, migration 20260513150000).
--
-- 🛑 BUT PLAIN `SET NULL` WOULD BE A SECOND BUG, WORSE THAN THE FIRST. A NULL
-- `event_id` MEANS "every event this user hosts" to `event_has_comp_for_sku`.
-- So nulling on delete would silently PROMOTE a comp scoped to one event into
-- an account-wide one — a privilege escalation the customer triggers by
-- deleting an event. The record must survive WITHOUT the entitlement.
--
-- So: SET NULL for referential integrity, plus a BEFORE DELETE trigger on
-- `events` that first snapshots the id into a plain UUID column (no FK, so it
-- survives) and stamps `revoked_at`. Both entitlement functions already filter
-- `revoked_at IS NULL`, so the grant confers nothing the instant its event goes
-- — no resolver change needed, which is why revoked_at is the right lever.
--
-- IDEMPOTENT: IF NOT EXISTS / OR REPLACE / DROP-then-CREATE throughout.

BEGIN;

-- ── 1 · the claim: one per account, ever, unreachable from a browser ────────

CREATE TABLE IF NOT EXISTS public.papic_free_grant_claims (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Which event consumed it. SET NULL, never CASCADE — deleting the event must
  -- not erase the claim; that is defect 2's lesson applied here at birth.
  event_id    UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.papic_free_grant_claims IS
  'One row per account, ever: this account has consumed its one free Papic pool '
  'grant. Deliberately NOT derived from event_members — a customer can delete '
  'their own membership row (couple_can_delete_member), which is how the '
  '2026-09-05 reset loophole worked. Written only by papic_claim_free_pool().';

ALTER TABLE public.papic_free_grant_claims ENABLE ROW LEVEL SECURITY;
-- No policies, and the grant revoked: service-role / SECURITY DEFINER only. A
-- claim a customer could DELETE would reproduce the very defect this fixes.
REVOKE ALL ON public.papic_free_grant_claims FROM anon, authenticated;

-- ── 2 · backfill: everyone who already consumed their grant keeps it consumed ─
-- Without this, every existing account's next event would earn a fresh 50 the
-- moment this ships. Attribute the claim to the earliest event that holds a
-- FULL free grant (points > 1 — a 1-point row is a repeat event, not a claim).

INSERT INTO public.papic_free_grant_claims (user_id, event_id, claimed_at)
SELECT DISTINCT ON (em.user_id)
       em.user_id, g.event_id, COALESCE(g.created_at, NOW())
  FROM public.papic_event_point_grants g
  JOIN public.event_members em
    ON em.event_id = g.event_id
   AND em.member_type = 'couple'
 WHERE g.source = 'free_grant'
   AND g.points > 1
 ORDER BY em.user_id, g.created_at ASC
ON CONFLICT (user_id) DO NOTHING;

-- ── 3 · the single decision site ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.papic_claim_free_pool(
  p_event_id UUID,
  p_user_id  UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pts   INTEGER;
  v_first BOOLEAN;
  v_user  UUID;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN;
  END IF;

  -- Already armed. The steady state: the trigger and the studio self-heal both
  -- call this, so every call after the first is a no-op.
  IF EXISTS (
    SELECT 1 FROM public.papic_event_point_grants
     WHERE event_id = p_event_id AND source = 'free_grant'
  ) THEN
    RETURN;
  END IF;

  SELECT free_grant_points INTO v_pts
    FROM public.papic_event_pool_config WHERE config_key = 'default';
  v_pts := COALESCE(v_pts, 50);

  -- PRE-EXISTING behaviour, unchanged: an admin-set 0 arms nothing at all.
  -- Read BEFORE the claim so a switched-off allowance never burns an account's
  -- one claim on a grant that was never written.
  IF v_pts <= 0 THEN
    RETURN;
  END IF;

  -- The caller may not know the owner (the Papic-studio self-heal runs for
  -- whoever opened the page, who need not be the couple). Resolve it HERE so
  -- there is one decision site rather than a TS half and a SQL half — the two
  -- drifting apart is how this feature's docblock came to describe a mechanism
  -- that was not the live one.
  v_user := p_user_id;
  IF v_user IS NULL THEN
    SELECT em.user_id INTO v_user
      FROM public.event_members em
     WHERE em.event_id = p_event_id
       AND em.member_type = 'couple'
     ORDER BY em.joined_at ASC
     LIMIT 1;
  END IF;

  -- Genuinely unattributable. Fence the event at the minimum rather than hand
  -- an unidentified account the full 50 — the old TS path defaulted to the FULL
  -- allowance here, generous in exactly the direction that costs money.
  IF v_user IS NULL THEN
    INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
    VALUES (p_event_id, 1, 'free_grant',
            'Papic Free minimum — no couple member resolved for this event.');
    RETURN;
  END IF;

  -- The arbiter. The PRIMARY KEY decides, so two concurrent creations by one
  -- account cannot both win — one INSERTs and claims, the other conflicts.
  WITH ins AS (
    INSERT INTO public.papic_free_grant_claims (user_id, event_id)
    VALUES (v_user, p_event_id)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM ins) INTO v_first;

  IF v_first THEN
    INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
    VALUES (p_event_id, v_pts, 'free_grant', 'Papic Free · shared event pool — this account''s first event.');
  ELSE
    INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
    VALUES (p_event_id, 1, 'free_grant',
            'Papic Free minimum — this account already claimed its free pool.');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.papic_claim_free_pool(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_claim_free_pool(UUID, UUID) TO service_role;

-- ── 4 · the trigger becomes a thin caller of that one site ──────────────────

CREATE OR REPLACE FUNCTION public.papic_seed_free_grant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.member_type <> 'couple' THEN
    RETURN NEW;
  END IF;
  PERFORM public.papic_claim_free_pool(NEW.event_id, NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS papic_seed_free_grant_trg ON public.event_members;
CREATE TRIGGER papic_seed_free_grant_trg
  AFTER INSERT ON public.event_members
  FOR EACH ROW EXECUTE FUNCTION public.papic_seed_free_grant();

-- ── 5 · a comp grant outlives the event it was scoped to, conferring nothing ─

ALTER TABLE public.comp_grants
  ADD COLUMN IF NOT EXISTS scoped_event_id_snapshot UUID;

COMMENT ON COLUMN public.comp_grants.scoped_event_id_snapshot IS
  'The event this grant was scoped to, kept after that event is deleted. No FK '
  'on purpose — it must survive the row it points at. Set by '
  'comp_grants_revoke_on_event_delete_trg; never an entitlement, only a record.';

ALTER TABLE public.comp_grants
  DROP CONSTRAINT IF EXISTS comp_grants_event_id_fkey;
ALTER TABLE public.comp_grants
  ADD CONSTRAINT comp_grants_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.comp_grants_revoke_on_event_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- BEFORE the delete, so event_id is still readable and the FK's SET NULL has
  -- not fired yet. Snapshot first, then revoke: a grant whose event is gone
  -- must never fall back to "applies to every event this user hosts".
  UPDATE public.comp_grants
     SET scoped_event_id_snapshot = COALESCE(scoped_event_id_snapshot, event_id),
         revoked_at = COALESCE(revoked_at, NOW())
   WHERE event_id = OLD.event_id;
  RETURN OLD;
END;
$$;

-- A trigger function needs no EXECUTE grant — Postgres does not check the
-- caller's privilege on it when the trigger fires, it runs in the trigger
-- machinery's own context. Leaving the default PUBLIC grant would put a new
-- anon-callable SECURITY DEFINER function on the surface for no reason, which
-- `anon-rpc-surface.db.test.ts` correctly refuses.
REVOKE ALL ON FUNCTION public.comp_grants_revoke_on_event_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS comp_grants_revoke_on_event_delete_trg ON public.events;
CREATE TRIGGER comp_grants_revoke_on_event_delete_trg
  BEFORE DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.comp_grants_revoke_on_event_delete();

COMMIT;
