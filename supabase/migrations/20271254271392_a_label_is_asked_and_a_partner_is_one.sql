-- ============================================================================
-- a_label_is_asked_and_a_partner_is_one
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
--
-- ── WHY ────────────────────────────────────────────────────────────────────
-- Owner, 2026-09-29, on the People picker ("HOW IS <NAME> YOURS? Parent ·
-- Sibling · Child · Ninong / Ninang · Friend"):
--
--   > "add partner (to become a couple)"
--   > "assigning a label needs a handshake"
--
-- Three changes, one table:
--
--   1. 'partner' JOINS THE STORED VOCABULARY. This amends OD7 (2026-07-30,
--      "stored vocabulary FROZEN at the seven relations") by the owner's own
--      word. ⚠ THE CHECK IS RE-LISTED WITH EVERY CURRENT VALUE — spouse ·
--      parent · child · sibling · godparent · godchild · friend — plus the new
--      one. A re-listed vocabulary that drops a value refuses every row that
--      still holds it.
--
--   2. A LABEL ON A CONFIRMED CONNECTION IS ASKED, NOT SET. Until today the
--      declarer could write any label onto a connection the other person had
--      already accepted, and kinship derived from it at once — "you are my
--      Parent" became a fact about somebody who was never asked. The original
--      lock (2026-07-04) said every edge is mutually confirmed ("declare X is my
--      parent → X confirms you're my child"); the label step added on
--      2026-08-21 quietly stepped around it.
--
--        relation            the label BOTH people stand behind (kinship
--                            derives from this, on confirmed rows only)
--        proposed_relation   a label the declarer has ASKED for, not yet agreed
--        proposed_status     'pending' (waiting on them) · 'declined' (they
--                            said no — kept so the asker can be told "didn't
--                            confirm", then cleared)
--
--      On a PENDING connection the label still rides the request itself: the
--      person accepting the connection is shown the label and accepts both.
--      That is already a handshake, so nothing changes there.
--
--      ⚠ EXISTING ROWS ARE NOT TOUCHED. No `relation` is moved into
--      `proposed_relation` and nothing is downgraded; whether labels written
--      under the old rule should be re-asked is an OWNER question, surfaced in
--      the PR, not decided here.
--
--   3. ONE PARTNER AT A TIME. A person may hold at most one partner: an agreed
--      partnership (either direction), or a partner request THEY sent. A request
--      somebody ELSE sent you does not count against you — otherwise anyone
--      could block you from naming your own partner by asking first.
--
-- ── WHERE EACH RULE LIVES ──────────────────────────────────────────────────
-- · vocabulary + proposal shape → CHECK constraints (a row that breaks them
--   cannot exist, whoever writes it)
-- · who may change a label → `person_connections_transition_guard`, the
--   BEFORE UPDATE trigger that already answers "which change may each side
--   make", reproduced VERBATIM from 20271154117655 plus ONE marked block
-- · one partner → its own BEFORE INSERT OR UPDATE trigger, SECURITY DEFINER so
--   it can see the other person's rows (RLS shows each side only its own)
--
-- IDEMPOTENT: DROP/ADD CONSTRAINT by name, ADD COLUMN IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS + CREATE TRIGGER.
-- ============================================================================

-- ── 1 · the vocabulary, every current value + partner ──────────────────────
ALTER TABLE public.person_connections
  DROP CONSTRAINT IF EXISTS person_connections_relation_check;
ALTER TABLE public.person_connections
  ADD CONSTRAINT person_connections_relation_check CHECK (
    relation IS NULL
    OR relation = ANY (ARRAY['spouse','parent','child','sibling','godparent','godchild','friend','partner'])
  );

-- ── 2 · the asked label ─────────────────────────────────────────────────────
ALTER TABLE public.person_connections ADD COLUMN IF NOT EXISTS proposed_relation TEXT;
ALTER TABLE public.person_connections ADD COLUMN IF NOT EXISTS proposed_status TEXT;
ALTER TABLE public.person_connections ADD COLUMN IF NOT EXISTS proposed_at TIMESTAMPTZ;
ALTER TABLE public.person_connections ADD COLUMN IF NOT EXISTS proposal_answered_at TIMESTAMPTZ;

ALTER TABLE public.person_connections
  DROP CONSTRAINT IF EXISTS person_connections_proposed_relation_check;
ALTER TABLE public.person_connections
  ADD CONSTRAINT person_connections_proposed_relation_check CHECK (
    proposed_relation IS NULL
    OR proposed_relation = ANY (ARRAY['spouse','parent','child','sibling','godparent','godchild','friend','partner'])
  );

ALTER TABLE public.person_connections
  DROP CONSTRAINT IF EXISTS person_connections_proposed_status_check;
ALTER TABLE public.person_connections
  ADD CONSTRAINT person_connections_proposed_status_check CHECK (
    proposed_status IS NULL OR proposed_status = ANY (ARRAY['pending','declined'])
  );

-- An ask and its state travel together, like relation and layer do.
ALTER TABLE public.person_connections
  DROP CONSTRAINT IF EXISTS person_connections_proposal_pair_chk;
ALTER TABLE public.person_connections
  ADD CONSTRAINT person_connections_proposal_pair_chk CHECK (
    (proposed_relation IS NULL) = (proposed_status IS NULL)
  );

-- A separate label ask exists only on a CONFIRMED connection. On a pending one
-- the label rides the request itself (see note 2 above).
ALTER TABLE public.person_connections
  DROP CONSTRAINT IF EXISTS person_connections_proposal_on_confirmed_chk;
ALTER TABLE public.person_connections
  ADD CONSTRAINT person_connections_proposal_on_confirmed_chk CHECK (
    proposed_relation IS NULL OR status = 'confirmed'
  );

CREATE INDEX IF NOT EXISTS person_connections_proposed_to_idx
  ON public.person_connections (to_person_id)
  WHERE proposed_status = 'pending' AND deleted_at IS NULL;

-- ── 3 · who may change a label — the transition guard ───────────────────────
-- Reproduced VERBATIM from 20271154117655 (the live definition) plus ONE new
-- block, marked below.
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

  -- ▼▼ (2026-08-21) ▼▼
  -- The name the declarer typed is the declarer's own note. The recipient
  -- answers the claim; they do not get to re-word it. The label (`relation`) is
  -- already the declarer's alone for the same reason, enforced in the action's
  -- `from_person_id = my person` filter.
  IF NEW.declared_name IS DISTINCT FROM OLD.declared_name AND NOT is_from THEN
    RAISE EXCEPTION
      'person_connections: only the declarer may change the name they gave';
  END IF;
  -- ▲▲ (2026-08-21) ▲▲

  -- ▼▼ NEW (2026-09-29) — A LABEL IS ASKED, NOT SET ▼▼
  -- Owner: "assigning a label needs a handshake".
  --
  -- THE ASK (proposed_relation / proposed_status):
  --   · cleared, the agreed label untouched — anyone who can reach the row.
  --     Taking an ask back, or tidying a "didn't confirm", only ever removes.
  --   · set or changed to a pending ask — the DECLARER only.
  --   · pending → declined, same label — the person it is ABOUT only.
  --   · pending → accepted (cleared while `relation` becomes the asked label)
  --     — the person it is ABOUT only.
  IF NEW.proposed_relation IS DISTINCT FROM OLD.proposed_relation
     OR NEW.proposed_status IS DISTINCT FROM OLD.proposed_status THEN
    IF NEW.proposed_relation IS NULL THEN
      IF NEW.relation IS DISTINCT FROM OLD.relation
         AND NOT COALESCE(is_to
                  AND OLD.proposed_status IS NOT DISTINCT FROM 'pending'
                  AND NEW.relation IS NOT DISTINCT FROM OLD.proposed_relation, FALSE) THEN
        RAISE EXCEPTION
          'person_connections: only the person asked may accept a label';
      END IF;
    ELSIF NEW.proposed_status = 'pending' THEN
      IF NOT is_from THEN
        RAISE EXCEPTION 'person_connections: only the declarer may ask for a label';
      END IF;
    ELSIF NEW.proposed_status = 'declined' THEN
      IF NOT is_to
         OR OLD.proposed_status IS DISTINCT FROM 'pending'
         OR NEW.proposed_relation IS DISTINCT FROM OLD.proposed_relation THEN
        RAISE EXCEPTION
          'person_connections: only the person asked may decline a label, and only while it waits';
      END IF;
    END IF;
  END IF;

  -- THE AGREED LABEL (relation):
  --   · on a CONFIRMED connection it becomes a new word ONLY by the person it
  --     is about accepting the ask. Either side may take it back (→ NULL): a
  --     label is a thing two people stand behind, and either may stop.
  --   · on an unanswered connection it rides the request, so only the
  --     declarer may re-word it (this was the action's filter alone before).
  IF NEW.relation IS DISTINCT FROM OLD.relation THEN
    IF OLD.status = 'confirmed' THEN
      -- ⚠ Every comparison here is NULL-safe. `OLD.proposed_status = 'pending'`
      -- on a row with NO ask is NULL, NOT (… AND NULL) is NULL, and an IF on
      -- NULL does not raise — so the person asked could have written any label
      -- straight onto a connection nobody asked them about. Measured: that
      -- exact hole shipped in the first draft of this block and a db test
      -- ("the person asked cannot set it for them either") caught it.
      IF NEW.relation IS NOT NULL
         AND NOT COALESCE(is_to
                  AND OLD.proposed_status IS NOT DISTINCT FROM 'pending'
                  AND NEW.relation IS NOT DISTINCT FROM OLD.proposed_relation
                  AND NEW.proposed_relation IS NULL, FALSE) THEN
        RAISE EXCEPTION
          'person_connections: a label on a connection is asked, not set — the other person confirms it';
      END IF;
    ELSIF NOT is_from THEN
      RAISE EXCEPTION 'person_connections: only the declarer may word the request';
    END IF;
  END IF;
  -- ▲▲ NEW (2026-09-29) ▲▲

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
  'BEFORE UPDATE guard on person_connections. RLS answers WHO may touch a row; this answers WHICH change they may make: endpoints immutable · only the recipient may confirm/decline, and only from pending · only the declarer may send a draft · nothing returns to draft · an answered claim is final · only the declarer may change declared_name · and (2026-09-29, owner "assigning a label needs a handshake") on a CONFIRMED connection a label is ASKED via proposed_relation and becomes `relation` only when the person it is about accepts; either side may take a label back; on an unanswered connection only the declarer words it.';

-- ── 4 · one partner at a time ───────────────────────────────────────────────
-- A person HOLDS a partner through a row when:
--   · the row's agreed label is partner and the connection is confirmed
--     (either direction — a partnership is one fact, stored once), or
--   · they SENT it: an unanswered request labelled partner, or a pending
--     partner ask on a confirmed connection.
-- A request somebody else sent you is not yours until you accept it.
CREATE OR REPLACE FUNCTION public.person_holds_a_partner(
  p_person UUID,
  p_except BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.person_connections c
     WHERE c.id IS DISTINCT FROM p_except
       AND c.deleted_at IS NULL
       AND c.status <> 'declined'
       AND (
         (c.relation = 'partner' AND c.status = 'confirmed'
            AND (c.from_person_id = p_person OR c.to_person_id = p_person))
         OR (c.relation = 'partner' AND c.status IN ('pending', 'draft')
            AND c.from_person_id = p_person)
         OR (c.proposed_relation = 'partner' AND c.proposed_status = 'pending'
            AND c.from_person_id = p_person)
       )
  );
$$;

COMMENT ON FUNCTION public.person_holds_a_partner(UUID, BIGINT) IS
  'TRUE when the person already holds a partner on a row other than p_except: an agreed, confirmed partner label (either direction) or a partner request/ask THEY sent. Read by person_connections_one_partner. Owner 2026-09-29: "add partner (to become a couple)" — one at a time.';

REVOKE ALL ON FUNCTION public.person_holds_a_partner(UUID, BIGINT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.person_connections_one_partner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sender_claims BOOLEAN;
  v_agreed        BOOLEAN;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.status = 'declined' THEN
    RETURN NEW;
  END IF;

  v_agreed := NEW.relation = 'partner' AND NEW.status = 'confirmed';
  v_sender_claims :=
    (NEW.relation = 'partner')
    OR (NEW.proposed_relation = 'partner' AND NEW.proposed_status = 'pending');

  IF NOT COALESCE(v_sender_claims, FALSE) THEN
    RETURN NEW;
  END IF;

  -- Two writers racing to give one person two partners serialise here.
  PERFORM pg_advisory_xact_lock(hashtext('person_partner:' || NEW.from_person_id::text));
  IF public.person_holds_a_partner(NEW.from_person_id, NEW.id) THEN
    RAISE EXCEPTION 'person_connections: one partner at a time'
      USING ERRCODE = '23514';
  END IF;

  -- The person it is ABOUT only takes a partner on when it is agreed.
  IF COALESCE(v_agreed, FALSE) THEN
    PERFORM pg_advisory_xact_lock(hashtext('person_partner:' || NEW.to_person_id::text));
    IF public.person_holds_a_partner(NEW.to_person_id, NEW.id) THEN
      RAISE EXCEPTION 'person_connections: one partner at a time'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.person_connections_one_partner() IS
  'BEFORE INSERT OR UPDATE on person_connections: a person holds at most ONE partner (owner 2026-09-29). The sender is checked whenever a row claims partner; the person it is about only when the partnership becomes agreed, so a request someone else sent never blocks you. SECURITY DEFINER because each side sees only its own rows under RLS.';

REVOKE ALL ON FUNCTION public.person_connections_one_partner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS person_connections_one_partner ON public.person_connections;
CREATE TRIGGER person_connections_one_partner
  BEFORE INSERT OR UPDATE ON public.person_connections
  FOR EACH ROW EXECUTE FUNCTION public.person_connections_one_partner();

-- ── 5 · the columns say what they mean ──────────────────────────────────────
COMMENT ON COLUMN public.person_connections.relation IS
  'What to_person IS to from_person, as BOTH people stand behind it. NULL = on the list, not yet labelled. On a pending connection it is the label the request carries (accepting the request accepts it). On a confirmed connection it changes only by the other person accepting proposed_relation (2026-09-29: "assigning a label needs a handshake"). Kinship derives from CONFIRMED and LABELLED edges only. Vocabulary: spouse · parent · child · sibling · godparent · godchild · friend · partner.';
COMMENT ON COLUMN public.person_connections.proposed_relation IS
  'A label the declarer has ASKED for on a confirmed connection, not yet agreed. Never derives kinship. Travels with proposed_status (person_connections_proposal_pair_chk).';
COMMENT ON COLUMN public.person_connections.proposed_status IS
  'pending = waiting on the person it is about · declined = they said no; kept so the asker is told "didn''t confirm", cleared when the asker moves on. NULL exactly when proposed_relation is NULL.';
COMMENT ON COLUMN public.person_connections.proposed_at IS
  'When the current label ask was made.';
COMMENT ON COLUMN public.person_connections.proposal_answered_at IS
  'When the person asked declined the current label ask.';

-- ── 6 · an ask does not linger either ───────────────────────────────────────
-- The privacy notice: "A request nobody answers, and a connection that is
-- declined, are both deleted after 30 days." A label ask IS a request, so the
-- daily sweep now also clears a label ask nobody answered, and a declined one,
-- once it is 30 days old. It CLEARS the ask and never deletes the row: the
-- connection underneath is confirmed, and a confirmed connection has no expiry.
-- `expire_stale_connection_requests` is reproduced VERBATIM from
-- 20271155852254 plus ONE marked block; it returns rows deleted + asks cleared.
CREATE OR REPLACE FUNCTION public.expire_stale_connection_requests(p_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := now() - make_interval(days => GREATEST(p_days, 1));
  v_deleted INTEGER;
  v_cleared INTEGER;
BEGIN
  DELETE FROM public.person_connections pc
   WHERE pc.deleted_at IS NULL
     AND (
       (pc.status IN ('pending', 'draft') AND pc.created_at < v_cutoff)
       OR (pc.status = 'declined' AND COALESCE(pc.declined_at, pc.updated_at, pc.created_at) < v_cutoff)
     );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- ▼▼ NEW (2026-09-29) ▼▼
  UPDATE public.person_connections pc
     SET proposed_relation = NULL,
         proposed_status = NULL,
         proposed_at = NULL,
         proposal_answered_at = NULL
   WHERE pc.deleted_at IS NULL
     AND pc.proposed_relation IS NOT NULL
     AND (
       (pc.proposed_status = 'pending'
          AND COALESCE(pc.proposed_at, pc.updated_at, pc.created_at) < v_cutoff)
       OR (pc.proposed_status = 'declined'
          AND COALESCE(pc.proposal_answered_at, pc.updated_at, pc.created_at) < v_cutoff)
     );
  GET DIAGNOSTICS v_cleared = ROW_COUNT;
  -- ▲▲ NEW ▲▲

  RETURN v_deleted + v_cleared;
END;
$$;

COMMENT ON FUNCTION public.expire_stale_connection_requests(INTEGER) IS
  'Keeps the promise the public privacy notice makes: an unanswered request, an unsent draft, and a declined connection are DELETED after 30 days. Hard delete — the notice says deleted, and a soft-deleted row still holds a relationship claim about two named people. NEVER touches a confirmed connection: that is a relationship both people agreed to and it has no expiry. (2026-09-29) A LABEL ask on a confirmed connection that nobody answered, or that was declined, is CLEARED after the same 30 days — the ask goes, the confirmed connection stays. Returns rows deleted + asks cleared. Called once a day by the app''s traffic-driven job runner (lib/daily-email-jobs.ts); service_role only.';

-- Nobody's browser runs a retention sweep (re-stated: CREATE OR REPLACE keeps
-- grants, but a reader should not have to know that).
REVOKE ALL ON FUNCTION public.expire_stale_connection_requests(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_connection_requests(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.expire_stale_connection_requests(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_connection_requests(INTEGER) TO service_role;
