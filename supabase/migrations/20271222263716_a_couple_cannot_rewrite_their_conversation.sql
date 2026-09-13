-- a_couple_cannot_rewrite_their_conversation
-- ============================================================================
-- A PARTY TO A CONVERSATION MAY CHANGE ONLY WHAT THEIR SIDE MAY CHANGE.
--
-- Owner, 2026-09-10: "our goal is to let them integrate their event with the
-- vendor they find. not to let them communicate outside the app."
--
-- MEASURED (N1, in the replay, as a real `authenticated` couple — 1 row each),
-- and the grants re-read in production (read-only, 2026-09-11):
--   `anon` and `authenticated` hold TABLE-level INSERT/SELECT/UPDATE/DELETE on
--   public.chat_threads (all 25 columns), and chat_threads_member_update admits
--   the couple arm, the supplier arm and the agent arm with no column filter.
--   RLS scopes ROWS, never columns, so on their OWN thread a couple could:
--     · UPDATE vendor_profile_id — move the conversation into ANY supplier's
--       inbox (and event_id — into any event);
--     · UPDATE inquiry_status / accepted_at — accept their own inquiry;
--     · UPDATE locked_at / agreed_price_centavos / locked_by_user_id — stamp a
--       lock at a price of their choosing (the payment session reads this);
--   and the same through INSERT (open a thread already 'accepted', or locked).
--
-- ── WHY A GUARD TRIGGER, NOT A COLUMN REVOKE ─────────────────────────────────
-- The grant is TABLE-level: a column REVOKE is inert against it. Rebuilding a
-- computed column allowlist (the vendor_profiles pattern) would still leave
-- inquiry_status UPDATE-able by BOTH sides — the supplier legitimately accepts
-- and declines, the couple legitimately displaces and revives — so the rule is
-- not "who may write this column" but "which SIDE may make which CHANGE". That
-- is a row-and-value rule, and only a trigger can hold it. The existing
-- guard_thread_provenance_columns shows the house shape; this one REFUSES
-- (42501) rather than silently restoring, so a writer that was missed fails
-- loudly in review instead of losing its write in production.
--
-- ── EVERY LEGITIMATE WRITER, AND THE RULE THAT KEEPS IT WORKING ──────────────
-- (grepped: every `.from('chat_threads')` write in apps/web + every function
--  body in production that writes the table)
--   supplier  accept  pending → accepted (+ accepted_at)      lib/chat-actions.ts
--   supplier  decline pending → declined (+ declined_at, reason)  lib/chat-actions.ts
--   couple    displace  pending|accepted → displaced, displaced_from_status =
--             the prior status              vendors/actions.ts finalizeVendor
--   couple    revive    displaced → displaced_from_status, marker cleared
--                                            vendors/actions.ts revertVendorToConsidering
--   couple    open/resume a thread (upsert by event_id,vendor_profile_id —
--             on conflict the pair is UNCHANGED, so it passes)
--             messages/actions.ts · v/[slug]/inquiry-actions.ts ·
--             vendors/_actions/unlock-category.ts
--   couple    archived_at, pax_at_inquiry, pax_current — not guarded here
--   LOCK      agreed_price_centavos / locked_at / locked_by_user_id — NO browser
--             session writes them any more: lockDeal (negotiation-actions.ts)
--             now stamps them on the SERVICE ROLE, scoped by the thread it has
--             just proved is the couple's and after its own checks.
--   service role (auto-accept, demo inquiries, push stamp, first-reply stamp,
--             vendor invite pre-seed), SECURITY DEFINER bodies (they run as the
--             owner), and an admin session — privileged, untouched.
--
-- WHO IS PRIVILEGED is read from `current_user`, not auth.role(): inside a
-- SECURITY DEFINER function the JWT still says 'authenticated' while the
-- statement really runs as the owner. So this trigger function is SECURITY
-- INVOKER on purpose — declaring it DEFINER would make every caller "postgres".
--
-- IDEMPOTENT: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- REVERSIBLE: DROP TRIGGER chat_threads_guard_sides ON public.chat_threads;
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.tg_chat_threads_guard_sides()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_couple   BOOLEAN;
  v_supplier BOOLEAN;
  v_what     TEXT;
BEGIN
  -- Privileged: the service role, a SECURITY DEFINER body (runs as its owner),
  -- a migration / direct connection, or an admin's own session.
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- ── INSERT: a new conversation opens as a plain inquiry ───────────────────
  IF TG_OP = 'INSERT' THEN
    IF NEW.inquiry_status IS DISTINCT FROM 'pending'::public.chat_inquiry_status
       OR NEW.accepted_at IS NOT NULL
       OR NEW.declined_at IS NOT NULL
       OR NEW.decline_reason IS NOT NULL
       OR NEW.displaced_from_status IS NOT NULL
       OR NEW.locked_at IS NOT NULL
       OR NEW.agreed_price_centavos IS NOT NULL
       OR NEW.locked_by_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'CHAT_THREAD_SIDE_REFUSED: a new conversation opens as a pending inquiry — its answer and its lock are not the opener''s to write'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- ── UPDATE ────────────────────────────────────────────────────────────────
  -- 1 · WHO the conversation is between never changes.
  IF NEW.thread_id IS DISTINCT FROM OLD.thread_id
     OR NEW.public_id IS DISTINCT FROM OLD.public_id
     OR NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.vendor_profile_id IS DISTINCT FROM OLD.vendor_profile_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'CHAT_THREAD_SIDE_REFUSED: a conversation cannot be moved to another supplier or event'
      USING ERRCODE = '42501';
  END IF;

  -- 2 · The LOCK is stamped only by the server, after its own checks.
  IF NEW.locked_at IS DISTINCT FROM OLD.locked_at
     OR NEW.agreed_price_centavos IS DISTINCT FROM OLD.agreed_price_centavos
     OR NEW.locked_by_user_id IS DISTINCT FROM OLD.locked_by_user_id THEN
    RAISE EXCEPTION 'CHAT_THREAD_SIDE_REFUSED: the lock and the agreed price are recorded by Setnayan, not written from a browser'
      USING ERRCODE = '42501';
  END IF;

  -- Which side is asking — the same three arms chat_threads_member_update uses.
  v_couple := NEW.event_id IN (SELECT public.current_couple_event_ids());
  v_supplier := NEW.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
             OR (NEW.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
                 AND NEW.event_id IN (SELECT public.agent_customer_event_ids()));

  -- 3 · The supplier's ANSWER is the supplier's.
  IF (NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
      OR NEW.declined_at IS DISTINCT FROM OLD.declined_at
      OR NEW.decline_reason IS DISTINCT FROM OLD.decline_reason)
     AND NOT v_supplier THEN
    RAISE EXCEPTION 'CHAT_THREAD_SIDE_REFUSED: only the supplier answers an inquiry'
      USING ERRCODE = '42501';
  END IF;

  -- 4 · The status moves only along the paths each side really has.
  IF NEW.inquiry_status IS DISTINCT FROM OLD.inquiry_status
     OR NEW.displaced_from_status IS DISTINCT FROM OLD.displaced_from_status THEN
    v_what := CASE
      -- supplier: answer a pending inquiry
      WHEN v_supplier
       AND OLD.inquiry_status = 'pending'
       AND NEW.inquiry_status IN ('accepted', 'declined')
       AND NEW.displaced_from_status IS NOT DISTINCT FROM OLD.displaced_from_status
        THEN 'answer'
      -- couple: set a rival aside when they lock someone else, remembering where it was
      WHEN v_couple
       AND OLD.inquiry_status IN ('pending', 'accepted')
       AND NEW.inquiry_status = 'displaced'
       AND NEW.displaced_from_status IS NOT DISTINCT FROM OLD.inquiry_status
        THEN 'displace'
      -- couple: bring it back to EXACTLY where it was, and clear the marker
      WHEN v_couple
       AND OLD.inquiry_status = 'displaced'
       AND OLD.displaced_from_status IS NOT NULL
       AND NEW.inquiry_status = OLD.displaced_from_status
       AND NEW.displaced_from_status IS NULL
        THEN 'revive'
      ELSE NULL
    END;
    IF v_what IS NULL THEN
      RAISE EXCEPTION 'CHAT_THREAD_SIDE_REFUSED: % → % is not a change this side of the conversation can make',
        OLD.inquiry_status, NEW.inquiry_status
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- A trigger function, never an RPC.
REVOKE ALL ON FUNCTION public.tg_chat_threads_guard_sides() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.tg_chat_threads_guard_sides() IS
  'BEFORE INSERT/UPDATE guard on chat_threads (20271222263716): for a browser '
  'session (current_user authenticated/anon, not an admin) — a new thread opens '
  'pending with no answer/lock; event_id/vendor_profile_id never change; the lock '
  'columns are server-only; accept/decline is the supplier''s; displace/revive is '
  'the couple''s, along the displaced_from_status marker only. SECURITY INVOKER on '
  'purpose: current_user is how a DEFINER body or the service role is recognised.';

DROP TRIGGER IF EXISTS chat_threads_guard_sides ON public.chat_threads;
CREATE TRIGGER chat_threads_guard_sides
  BEFORE INSERT OR UPDATE ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_threads_guard_sides();

-- ── POST-CONDITIONS ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.chat_threads'::regclass
       AND t.tgname = 'chat_threads_guard_sides'
       AND (t.tgtype & 2) = 2          -- BEFORE
       AND (t.tgtype & 4) = 4          -- INSERT
       AND (t.tgtype & 16) = 16        -- UPDATE
       AND t.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'POST-CONDITION 1 FAILED: chat_threads_guard_sides is not a live BEFORE INSERT OR UPDATE trigger';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.tg_chat_threads_guard_sides()'::regprocedure) THEN
    RAISE EXCEPTION 'POST-CONDITION 2 FAILED: the guard is SECURITY DEFINER — current_user would always be its owner and every caller would pass';
  END IF;
  IF has_function_privilege('authenticated', 'public.tg_chat_threads_guard_sides()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.tg_chat_threads_guard_sides()', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-CONDITION 3 FAILED: the guard is callable by a browser role';
  END IF;
END $$;

COMMIT;
