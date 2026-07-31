-- ============================================================================
-- Connection tree PILOT guardrail — both endpoints must be claimed accounts
--
-- ── WHY THIS EXISTS ────────────────────────────────────────────────────────
-- The connection tree runs as a TEST PILOT ahead of the NPC submission, with
-- the PH counsel requirement waived by the owner-as-DPO until January 2027.
--
-- The sharpest exposure in a kin graph is NOT the graph. It is storing named,
-- dated, sometimes photographed records of people who have NO ACCOUNT, never
-- agreed to anything, and cannot see or delete their own data. `people` allows
-- exactly that: `claimed_by_user_id` is nullable by design, so someone's lola
-- can be a node without ever signing up.
--
-- That is the question external counsel would push hardest on, and it is the
-- one hardest to answer well. This constraint removes it rather than arguing it:
--
--   during the pilot, a connection may only be stored when BOTH endpoints are
--   claimed accounts.
--
-- Then both parties have accepted the terms, both can see the claim, both can
-- decline it, and both can delete it. That is a materially different posture
-- from holding data about a third party who has no idea the record exists — and
-- it is enforced in the database, so it is provable to the NPC later rather than
-- merely asserted.
--
-- ── THE COST, STATED ───────────────────────────────────────────────────────
-- You cannot add a relative who has no account. For a pilot that is the right
-- trade; for the full product it is probably not, which is why this is a
-- SEPARATE, NAMED, DROPPABLE trigger rather than a change to the schema's
-- shape. Ending the pilot is one DROP TRIGGER, and the accompanying decision
-- should be recorded when it happens.
--
-- ── WHY A TRIGGER AND NOT A CHECK ──────────────────────────────────────────
-- A CHECK constraint cannot subquery. The claimed-ness of an endpoint lives on
-- `people`, not on the row being written, so this has to be a trigger.
--
-- Deliberately NOT folded into the RLS insert policy: policies express who may
-- write, this expresses a temporary product boundary, and merging them would
-- make the pilot's end require a policy edit plus an exposure-baseline
-- regeneration instead of a one-line drop.
-- ============================================================================

-- SECURITY DEFINER, deliberately, and this was a real bug before it was a
-- comment. `people` is governed by `people_owner_all` — a user can only SELECT
-- their OWN person row. So an INVOKER-rights check cannot see whether the OTHER
-- endpoint is claimed: the lookup returns nothing, reads as "not claimed", and
-- the guardrail refuses every legitimate connection. Caught by the positive
-- test, which is why negative-only test suites are dangerous.
--
-- Safe as DEFINER because it returns a BOOLEAN DECISION and nothing else: no
-- row, no column, no name is exposed to the caller. `search_path` is pinned so
-- the elevated body cannot be redirected at attacker-controlled objects.
CREATE OR REPLACE FUNCTION public.kin_pilot_require_mutual_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  from_claimed BOOLEAN;
  to_claimed   BOOLEAN;
BEGIN
  -- Admins are exempt: support and back-office repair must not be blocked by a
  -- pilot boundary. Every admin write is already audited elsewhere.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT (claimed_by_user_id IS NOT NULL) INTO from_claimed
    FROM public.people WHERE person_id = NEW.from_person_id;
  SELECT (claimed_by_user_id IS NOT NULL) INTO to_claimed
    FROM public.people WHERE person_id = NEW.to_person_id;

  IF NOT COALESCE(from_claimed, FALSE) OR NOT COALESCE(to_claimed, FALSE) THEN
    RAISE EXCEPTION
      'connection tree pilot: both people must have an account. During the pilot '
      'a connection is only stored when both sides can see, confirm and delete it. '
      'Invite them first, or wait for the pilot to end.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.kin_pilot_require_mutual_accounts() IS
  'PILOT-SCOPED (2026-07-31 → NPC submission). Both endpoints of a person_connection must be '
  'claimed accounts, so no relationship data is stored about someone who has no account and '
  'cannot see or delete it. Removes the sharpest third-party-data question for the pilot period. '
  'Ending the pilot = DROP TRIGGER kin_pilot_mutual_accounts — record that decision when it happens.';

DROP TRIGGER IF EXISTS kin_pilot_mutual_accounts ON public.person_connections;
CREATE TRIGGER kin_pilot_mutual_accounts
  BEFORE INSERT OR UPDATE OF from_person_id, to_person_id
  ON public.person_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.kin_pilot_require_mutual_accounts();
