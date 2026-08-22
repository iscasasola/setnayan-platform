-- ============================================================================
-- only_the_declarer_names_them
--
-- ── WHY THIS EXISTS ────────────────────────────────────────────────────────
-- The migration before this one added `person_connections.declared_name` — the
-- name the ADDER typed, which is what renders their row while the claim is
-- unanswered. CI's exposure freeze then reported, correctly, that
-- `authenticated` had gained SELECT / INSERT / UPDATE on it.
--
-- SELECT and INSERT are the point: the declarer writes the name, and both
-- endpoints already read every other column of the row they share.
--
-- UPDATE is not. `person_connections_update` deliberately admits the RECIPIENT
-- of a claim — that is how they confirm it — so without this, the person a
-- claim is ABOUT could rewrite the note the declarer made about them, and the
-- declarer's own list would silently start calling them something else.
--
-- ⚠ A COLUMN-LEVEL REVOKE CANNOT FIX THIS. `authenticated` holds table-wide
-- UPDATE on `person_connections`, and `REVOKE UPDATE (declared_name)` is INERT
-- against a table-level grant — measured on `event_vendors`, 2026-08-21. The
-- control has to be a trigger, exactly as it was there.
--
-- ── WHAT CHANGED IN THE FUNCTION ───────────────────────────────────────────
-- `person_connections_transition_guard` is reproduced VERBATIM from the live
-- production definition (`pg_get_functiondef`, read 2026-08-21) plus ONE new
-- block, marked below. It already runs BEFORE UPDATE and already computes
-- `is_from` / `is_to`, so the rule costs nothing extra at write time.
--
-- Same family as the 2026-08-12 sweep: the ROW is yours, the FIELD is not.
--
-- IDEMPOTENT: CREATE OR REPLACE FUNCTION.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.person_connections_transition_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- ▼▼ NEW (2026-08-21) ▼▼
  -- The name the declarer typed is the declarer's own note. The recipient
  -- answers the claim; they do not get to re-word it. The label (`relation`) is
  -- already the declarer's alone for the same reason, enforced in the action's
  -- `from_person_id = my person` filter.
  IF NEW.declared_name IS DISTINCT FROM OLD.declared_name AND NOT is_from THEN
    RAISE EXCEPTION
      'person_connections: only the declarer may change the name they gave';
  END IF;
  -- ▲▲ NEW ▲▲

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
$function$;

COMMENT ON FUNCTION public.person_connections_transition_guard() IS
  'BEFORE UPDATE guard on person_connections. RLS answers WHO may touch a row; this answers WHICH change they may make: endpoints immutable · only the recipient may confirm/decline, and only from pending · only the declarer may send a draft · nothing returns to draft · an answered claim is final · and (2026-08-21) only the declarer may change declared_name, because a column-level REVOKE is inert against the table-wide UPDATE grant authenticated holds.';
