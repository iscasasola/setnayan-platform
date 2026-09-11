-- a_supplier_cannot_open_a_strangers_thread
-- ============================================================================
-- A SUPPLIER CANNOT DROP A CONVERSATION INTO A STRANGER'S INBOX.
--
-- Owner, 2026-09-10: "our goal is to let them integrate their event with the
-- vendor they find. not to let them communicate outside the app."
--
-- FOUND by N4 (#5435, "found, not fixed"), MEASURED by N5 on origin/main in the
-- replay as a real `authenticated` supplier (not the superuser):
--   1. INSERT INTO vendor_follows (follower_user_id = me, vendor_profile_id =
--      MY OWN shop)                                   → accepted (no self rule)
--   2. INSERT INTO chat_threads (event_id = a STRANGER's event,
--      vendor_profile_id = my shop)                   → accepted, 1 row
--   The stranger couple then sees a conversation from a supplier they never
--   contacted. Without step 1 the RESTRICTIVE chat_threads_follow_gate refuses
--   — that gate was the only thing in the way, and a supplier can satisfy it
--   alone. chat_threads_member_insert's supplier arm
--   (vendor_profile_id IN current_vendor_profile_ids()) admits ANY event_id.
--
-- ── WHY THE GUARD, NOT THE POLICY ────────────────────────────────────────────
-- tg_chat_threads_guard_sides (20271222263716) already owns "which side may do
-- what" on this table, refuses loudly (42501) and recognises the privileged
-- writers by current_user. Rewriting chat_threads_member_insert would split one
-- rule across two objects; the guard gains one INSERT clause instead, and the
-- body below is 20271222263716's byte for byte apart from that clause.
--
-- ── EVERY LEGITIMATE OPENER, AND WHY IT STILL WORKS ──────────────────────────
-- (grepped: every .from('chat_threads').insert/upsert in apps/web, and every
--  function body in production that inserts into chat_threads — there are none)
--   couple    messages/actions.ts · v/[slug]/inquiry-actions.ts ·
--             vendors/_actions/unlock-category.ts — all on the couple's own
--             event (couple arm)                                    → allowed
--   agent     a shop's agent on a customer event they were given
--             (agent arm of the insert policy)                     → allowed
--   supplier  the claimed invite pre-seeds its thread on the SERVICE ROLE
--             (lib/vendor-invite-actions.ts); admin demo inquiries and
--             auto-accept are service-role too                   → privileged
--   A supplier's own browser session has NO opener in the app: every supplier
--   answer is an UPDATE of a thread the couple opened (untouched here).
--
-- IDEMPOTENT: CREATE OR REPLACE (the trigger itself is unchanged).
-- REVERSIBLE: re-apply the function body from 20271222263716.
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
    -- 0 · …and it is opened by the event's own side (N5, 2026-09-11). A
    -- supplier's own shop arm is NOT an opener: no browser path of a supplier's
    -- opens a thread (every supplier-initiated thread — the claimed invite, the
    -- admin's demo inquiries — is written by the service role), and on its own
    -- that arm let any supplier follow their own shop and drop a conversation
    -- into ANY couple's inbox. The couple arm and the agent arm (a shop's agent
    -- on a customer event they were given) stay exactly as the insert policy
    -- has them.
    IF NOT (
         NEW.event_id IN (SELECT public.current_couple_event_ids())
         OR (NEW.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
             AND NEW.event_id IN (SELECT public.agent_customer_event_ids()))
       ) THEN
      RAISE EXCEPTION 'CHAT_THREAD_SIDE_REFUSED: a conversation is opened from the event''s side — a supplier cannot start one on an event they are not part of'
        USING ERRCODE = '42501';
    END IF;
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
  'BEFORE INSERT/UPDATE guard on chat_threads (20271222263716 + 20271222816187): '
  'for a browser session (current_user authenticated/anon, not an admin) — a new '
  'thread is opened from the event''s side (the couple, or a shop''s agent on a '
  'customer event), pending with no answer/lock; event_id/vendor_profile_id never '
  'change; the lock columns are server-only; accept/decline is the supplier''s; '
  'displace/revive is the couple''s, along the displaced_from_status marker only. '
  'SECURITY INVOKER on purpose: current_user is how a DEFINER body or the service '
  'role is recognised.';

-- ── POST-CONDITIONS ────────────────────────────────────────────────────────
DO $$
DECLARE
  v_def TEXT := pg_get_functiondef('public.tg_chat_threads_guard_sides()'::regprocedure);
BEGIN
  IF v_def NOT LIKE '%NEW.event_id IN (SELECT public.current_couple_event_ids())%'
     OR v_def NOT LIKE '%a supplier cannot start one on an event they are not part of%' THEN
    RAISE EXCEPTION 'POST-CONDITION 1 FAILED: the guard does not restrict who opens a conversation';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.tg_chat_threads_guard_sides()'::regprocedure) THEN
    RAISE EXCEPTION 'POST-CONDITION 2 FAILED: the guard is SECURITY DEFINER — current_user would always be its owner and every caller would pass';
  END IF;
  IF has_function_privilege('authenticated', 'public.tg_chat_threads_guard_sides()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.tg_chat_threads_guard_sides()', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-CONDITION 3 FAILED: the guard is callable by a browser role';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.chat_threads'::regclass
       AND t.tgname = 'chat_threads_guard_sides'
       AND (t.tgtype & 2) = 2 AND (t.tgtype & 4) = 4 AND (t.tgtype & 16) = 16
       AND t.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'POST-CONDITION 4 FAILED: chat_threads_guard_sides is not a live BEFORE INSERT OR UPDATE trigger';
  END IF;
END $$;

COMMIT;
