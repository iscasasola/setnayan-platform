-- ============================================================================
-- person_connections — close the forgery + self-confirm hole, and add drafts
--
-- ── THE HOLE ────────────────────────────────────────────────────────────────
-- The table shipped with ONE policy, `person_connections_participant`, declared
-- FOR ALL. Its WITH CHECK was byte-identical to its USING, and both accepted
-- EITHER endpoint. Consequences, verified against live prod:
--
--   · either side could INSERT a row naming the other ......... forgery
--   · the SAME side could then UPDATE it to confirmed ......... self-approval
--
-- So "X is my sibling" could be declared and confirmed by X alone, with the
-- other person never involved. Today that is harmless — the table holds ZERO
-- rows behind an off flag — which is exactly why it is the right moment.
--
-- ── WHY RLS ALONE IS NOT ENOUGH ─────────────────────────────────────────────
-- Row-level security answers WHO may touch a row. It cannot express WHICH
-- TRANSITION each party may make: both endpoints legitimately need UPDATE (one
-- to retract, one to confirm), so any UPDATE policy permitting both also
-- permits the declarer to set `confirmed`. A policy split alone would look like
-- a fix and leave self-approval intact.
--
-- The transition rule therefore lives in a BEFORE UPDATE trigger, which can see
-- OLD and NEW. RLS decides who is in the room; the trigger decides what they
-- may do there. Both are required; neither is sufficient.
--
-- ── DRAFTS (owner OD2, 2026-07-30) ──────────────────────────────────────────
-- A `draft` status lets someone build their connection tree before PH counsel
-- clears the flag. A draft is visible ONLY to its declarer — the counterparty
-- must not see a claim that has not been put to them.
--
-- ── GATE ────────────────────────────────────────────────────────────────────
-- The owner (who is the DPO) approved 2026-07-31. PH COUNSEL HAS NOT.
-- `NEXT_PUBLIC_PEOPLE_CONNECTIONS` stays OFF and this migration does not touch
-- it. This is a NARROWING: it removes capability that exists today and grants
-- none. It is safe ahead of counsel precisely because it only takes away.
-- ============================================================================

-- ── 1 · drafts ──────────────────────────────────────────────────────────────

ALTER TABLE public.person_connections
  DROP CONSTRAINT IF EXISTS person_connections_status_check;

ALTER TABLE public.person_connections
  ADD CONSTRAINT person_connections_status_check
  CHECK (status = ANY (ARRAY['draft', 'pending', 'confirmed', 'declined']));

COMMENT ON COLUMN public.person_connections.status IS
  'draft = declarer-only, invisible to the counterparty (pre-counsel tree building, owner OD2). '
  'pending = put to the other person. confirmed/declined = their answer, and ONLY they may set it '
  '(enforced by person_connections_transition_guard, not by RLS — RLS cannot express transitions).';

-- ── 2 · replace the FOR ALL policy with per-command policies ────────────────

DROP POLICY IF EXISTS person_connections_participant ON public.person_connections;

-- Helper predicate, inlined per policy (no new function: the RLS pattern
-- catalogue prefers explicit EXISTS over bespoke helpers for one-table scopes).

-- SELECT — both endpoints may read, EXCEPT that a draft is declarer-only.
CREATE POLICY person_connections_select ON public.person_connections
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.people p
       WHERE p.person_id = person_connections.from_person_id
         AND p.claimed_by_user_id = auth.uid()
    )
    OR (
      status <> 'draft'
      AND EXISTS (
        SELECT 1 FROM public.people p
         WHERE p.person_id = person_connections.to_person_id
           AND p.claimed_by_user_id = auth.uid()
      )
    )
  );

-- INSERT — the DECLARER only. You may state your own relationship to someone;
-- you may not author one on their behalf. This is the half that closes forgery.
-- A new row may only start as draft or pending: nobody inserts a pre-confirmed
-- edge.
CREATE POLICY person_connections_insert ON public.person_connections
  FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (
      status IN ('draft', 'pending')
      AND EXISTS (
        SELECT 1 FROM public.people p
         WHERE p.person_id = person_connections.from_person_id
           AND p.claimed_by_user_id = auth.uid()
      )
    )
  );

-- UPDATE — both endpoints may reach the row; WHICH change each may make is
-- enforced by the trigger below, because RLS cannot compare OLD to NEW.
CREATE POLICY person_connections_update ON public.person_connections
  FOR UPDATE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.people p
       WHERE p.person_id = person_connections.from_person_id
         AND p.claimed_by_user_id = auth.uid()
    )
    OR (
      status <> 'draft'
      AND EXISTS (
        SELECT 1 FROM public.people p
         WHERE p.person_id = person_connections.to_person_id
           AND p.claimed_by_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.people p
       WHERE p.person_id = person_connections.from_person_id
         AND p.claimed_by_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.people p
       WHERE p.person_id = person_connections.to_person_id
         AND p.claimed_by_user_id = auth.uid()
    )
  );

-- DELETE — the declarer retracts their own claim. The counterparty declines
-- (a status change), they do not delete: a decline is a fact worth keeping
-- until retention purges it.
CREATE POLICY person_connections_delete ON public.person_connections
  FOR DELETE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.people p
       WHERE p.person_id = person_connections.from_person_id
         AND p.claimed_by_user_id = auth.uid()
    )
  );

-- ── 3 · the transition guard — the half RLS cannot do ───────────────────────

CREATE OR REPLACE FUNCTION public.person_connections_transition_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  is_from BOOLEAN;
  is_to   BOOLEAN;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.people p
                  WHERE p.person_id = NEW.from_person_id
                    AND p.claimed_by_user_id = auth.uid())
    INTO is_from;
  SELECT EXISTS (SELECT 1 FROM public.people p
                  WHERE p.person_id = NEW.to_person_id
                    AND p.claimed_by_user_id = auth.uid())
    INTO is_to;

  -- The endpoints are immutable. Re-pointing an edge is how a confirmed
  -- relationship gets quietly transplanted onto a different person.
  IF NEW.from_person_id <> OLD.from_person_id
     OR NEW.to_person_id <> OLD.to_person_id THEN
    RAISE EXCEPTION 'person_connections: endpoints are immutable (retract and re-declare)';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- THE RULE THIS WHOLE MIGRATION EXISTS FOR: only the person a claim is
    -- ABOUT may answer it. The declarer confirming their own claim is exactly
    -- the self-approval the FOR ALL policy allowed.
    IF NEW.status IN ('confirmed', 'declined') THEN
      IF NOT is_to THEN
        RAISE EXCEPTION
          'person_connections: only the recipient may % a connection', NEW.status;
      END IF;
      IF OLD.status <> 'pending' THEN
        RAISE EXCEPTION
          'person_connections: only a pending connection may be answered (was %)', OLD.status;
      END IF;
    END IF;

    -- draft -> pending is the declarer putting their claim to the other person.
    IF NEW.status = 'pending' AND OLD.status = 'draft' AND NOT is_from THEN
      RAISE EXCEPTION 'person_connections: only the declarer may send a draft';
    END IF;

    -- Nothing returns to draft: a claim already seen cannot be un-seen.
    IF NEW.status = 'draft' AND OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'person_connections: a sent connection cannot return to draft';
    END IF;

    -- An answered connection is final. Re-asking is a new declaration.
    IF OLD.status IN ('confirmed', 'declined') THEN
      RAISE EXCEPTION
        'person_connections: % is final — retract and re-declare instead', OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS person_connections_transition_guard ON public.person_connections;
CREATE TRIGGER person_connections_transition_guard
  BEFORE UPDATE ON public.person_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.person_connections_transition_guard();

COMMENT ON FUNCTION public.person_connections_transition_guard() IS
  'Enforces WHICH status transition each party may make — the half RLS cannot express, since '
  'both endpoints legitimately need UPDATE and any policy allowing both also allows the '
  'declarer to self-confirm. Only the recipient may confirm/decline; only the declarer may send '
  'a draft; endpoints are immutable; answered is final.';
