-- only_the_supplier_flips_a_lock_and_a_quote_expires
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- SUPPLIER BUILD 3 · LANE B · ROUND 2 — the server side of the chat's rules.
-- Owner rulings: plan `plans/supplier_build_3_2026-11-08/03-FINAL-RULINGS-2026-11-09.md`
-- ("Money and forms: who writes, who asks, locks" · "Blockers" · "Approved" 1)
-- and DECISION_LOG 🤝 2026-11-08 (coordinators never ask for access — the host
-- agrees once, when sending the payment proof).
--
--   1 · ONLY THE SUPPLIER FLIPS A LOCK. `changes_locked` / `plan_locked` (a quote)
--       and `locked` (a sent form) change only for the quote's / form's own shop.
--   2 · THE REFUSAL CHECK. `supplier_lock_refusal(kind, id)` — the ONE answer to
--       "may a change be asked for on this?", which Lane C's Ask-for-a-change
--       writer calls before it writes.
--   3 · A QUOTE EXPIRES. sent / viewed past Valid until → 'expired', by a writer
--       the chat calls when it reads a lapsed quote (no scheduler: vercel.json has
--       no crons). A lapsed quote cannot be accepted; an accepted one never expires.
--   4 · THE CALL TIME, FOR THE PIN. A DEFINER reader returns ONE supplier's call
--       time on ONE event — never another block — so neither side's RLS widens.
--   5 · THE HOST'S AGREE FOR A COORDINATOR / PLANNER, recorded on the shipped
--       consent record (`coordinator_access_consents`), not a second home.
--   6 · DECISION TOPICS: either side closes one, anyone in the chat reopens it.
--   7 · A PRIVATE LINE NO LONGER MOVES THE THREAD for a third member (measured by
--       `a-private-message-never-reaches-a-third-person.db.test.ts`).
-- Nothing here widens a policy.

BEGIN;

-- ── 1 · only the supplier flips a lock ──────────────────────────────────────
-- MEASURED BEFORE: the hosts have no UPDATE policy on any of the three tables,
-- so RLS already refuses them; but the forms' *_vendor_update policies admit
-- the WHOLE shop team (current_vendor_ids() defaults to 'viewer'), and nothing
-- held the lock columns to the shop beyond whichever policy a future migration
-- adds. This trigger is the column rule itself, whatever policy admits the row:
--   • a quote's two locks — its shop's editors (current_vendor_profile_ids():
--     owner ∪ admin), the same set that writes the quote;
--   • a sent form's lock — its shop's working team (agent and up; a viewer
--     reads, never decides);
--   • is_admin() (support) and a session with no user (the service role, a
--     DEFINER writer acting for the shop) pass.
CREATE OR REPLACE FUNCTION public.tg_supplier_locks_are_the_suppliers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed BOOLEAN;
  v_allowed BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'vendor_proposals' THEN
    v_changed := NEW.changes_locked IS DISTINCT FROM OLD.changes_locked
              OR NEW.plan_locked    IS DISTINCT FROM OLD.plan_locked;
  ELSE
    v_changed := NEW.locked IS DISTINCT FROM OLD.locked;
  END IF;
  IF NOT v_changed OR auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'vendor_proposals' THEN
    v_allowed := OLD.vendor_profile_id IN (SELECT public.current_vendor_profile_ids());
  ELSE
    v_allowed := OLD.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
              OR OLD.vendor_profile_id IN (SELECT public.current_vendor_ids('agent'));
  END IF;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'supplier_lock: ONLY_THE_SUPPLIER — only the supplier locks or unlocks this'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_supplier_locks_are_the_suppliers() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_proposals_locks_are_the_suppliers ON public.vendor_proposals;
CREATE TRIGGER vendor_proposals_locks_are_the_suppliers
  BEFORE UPDATE OF changes_locked, plan_locked ON public.vendor_proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_supplier_locks_are_the_suppliers();
DROP TRIGGER IF EXISTS event_form_sends_lock_is_the_suppliers ON public.event_form_sends;
CREATE TRIGGER event_form_sends_lock_is_the_suppliers
  BEFORE UPDATE OF locked ON public.event_form_sends
  FOR EACH ROW EXECUTE FUNCTION public.tg_supplier_locks_are_the_suppliers();
DROP TRIGGER IF EXISTS event_question_requests_lock_is_the_suppliers ON public.event_question_requests;
CREATE TRIGGER event_question_requests_lock_is_the_suppliers
  BEFORE UPDATE OF locked ON public.event_question_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_supplier_locks_are_the_suppliers();

-- The forms' lock, any time, through one door (the quote's is
-- vendor_set_proposal_lock, 20271329937802). A sent form is keyed
-- (event_id, form_id); the questions set (event_id, vendor_profile_id) — so
-- p_ref is the form_id for 'form' and ignored for 'questions'. Returns ok ·
-- not_allowed · not_found · unknown_kind · unauthenticated.
CREATE OR REPLACE FUNCTION public.vendor_set_form_lock(p_kind TEXT, p_event_id UUID, p_ref UUID, p_locked BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'unauthenticated';
  END IF;
  IF p_kind NOT IN ('form', 'questions') OR p_locked IS NULL OR p_event_id IS NULL
     OR (p_kind = 'form' AND p_ref IS NULL) THEN
    RETURN 'unknown_kind';
  END IF;
  IF p_kind = 'form' THEN
    SELECT vendor_profile_id INTO v_shop FROM public.event_form_sends
     WHERE event_id = p_event_id AND form_id = p_ref FOR UPDATE;
  ELSE
    -- The caller's own shop's set on this event (a shop holds one per event).
    SELECT vendor_profile_id INTO v_shop FROM public.event_question_requests
     WHERE event_id = p_event_id
       AND (vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
            OR vendor_profile_id IN (SELECT public.current_vendor_ids('agent')))
     LIMIT 1 FOR UPDATE;
  END IF;
  IF v_shop IS NULL THEN
    RETURN 'not_found';
  END IF;
  IF NOT (v_shop IN (SELECT public.current_vendor_profile_ids())
          OR v_shop IN (SELECT public.current_vendor_ids('agent'))) THEN
    RETURN 'not_allowed';
  END IF;
  IF p_kind = 'form' THEN
    UPDATE public.event_form_sends SET locked = p_locked
     WHERE event_id = p_event_id AND form_id = p_ref AND locked IS DISTINCT FROM p_locked;
  ELSE
    UPDATE public.event_question_requests SET locked = p_locked
     WHERE event_id = p_event_id AND vendor_profile_id = v_shop AND locked IS DISTINCT FROM p_locked;
  END IF;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_set_form_lock(TEXT, UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_set_form_lock(TEXT, UUID, UUID, BOOLEAN) TO authenticated;
COMMENT ON FUNCTION public.vendor_set_form_lock(TEXT, UUID, UUID, BOOLEAN) IS
  'The sent form''s own shop (agent and up) locks or unlocks it (p_kind form = event_form_sends keyed by form_id; questions = the shop''s event_question_requests set). The flip posts its chat line (tg_sent_form_lock_chat_record). Migration 20271332497337.';

-- ── 2 · the refusal check: may a change be asked for on this? ───────────────
-- Returns NULL (it may), 'quote_locked', 'plan_locked', 'form_locked',
-- 'not_found' (or not yours to ask about). Kinds and ids: quote / plan → the
-- proposal_id; form → the form_id (with p_event_id); questions → the shop's
-- vendor_profile_id (with p_event_id).
-- 🔑 Lane C's Ask-for-a-change writer calls this BEFORE it writes; the TS
-- mirror is `lib/supplier-locks.ts` `askRefusal()` — one rule, two callers.
CREATE OR REPLACE FUNCTION public.supplier_lock_refusal(p_kind TEXT, p_id UUID, p_event_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event  UUID;
  v_shop   UUID;
  v_locked BOOLEAN;
BEGIN
  IF p_kind IN ('quote', 'plan') THEN
    SELECT event_id, vendor_profile_id,
           CASE WHEN p_kind = 'quote' THEN changes_locked ELSE plan_locked END
      INTO v_event, v_shop, v_locked
      FROM public.vendor_proposals WHERE proposal_id = p_id;
  ELSIF p_kind = 'form' THEN
    SELECT event_id, vendor_profile_id, locked INTO v_event, v_shop, v_locked
      FROM public.event_form_sends WHERE event_id = p_event_id AND form_id = p_id;
  ELSIF p_kind = 'questions' THEN
    SELECT event_id, vendor_profile_id, locked INTO v_event, v_shop, v_locked
      FROM public.event_question_requests WHERE event_id = p_event_id AND vendor_profile_id = p_id;
  ELSE
    RETURN 'not_found';
  END IF;
  -- Only someone in that conversation learns anything about the row.
  IF v_event IS NULL
     OR NOT (v_event IN (SELECT public.current_event_ids())
             OR v_shop IN (SELECT public.current_vendor_profile_ids())
             OR v_shop IN (SELECT public.current_vendor_ids())
             OR public.is_admin()) THEN
    RETURN 'not_found';
  END IF;
  IF v_locked THEN
    RETURN CASE p_kind WHEN 'quote' THEN 'quote_locked' WHEN 'plan' THEN 'plan_locked' ELSE 'form_locked' END;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.supplier_lock_refusal(TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_lock_refusal(TEXT, UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.supplier_lock_refusal(TEXT, UUID, UUID) IS
  'The ONE server answer to "may a change be asked for on this?" (owner 2026-11-09: a lock hides Ask for a change AND the server refuses requests). NULL = may ask; quote_locked / plan_locked / form_locked = refused; not_found = no such row or not your conversation. Every Ask-for-a-change writer calls it before writing. Migration 20271332497337.';

-- The one change request that already ships: the hosts' counter-offer on a
-- quote (a `proposal_amendments` row raised_by = 'couple'). A locked quotation
-- refuses it HERE, whatever door wrote it — the Ask-for-a-change card (Lane C)
-- and the shipped Counter-offer alike. The supplier's own amendments pass: the
-- lock is the supplier's word on their own price.
CREATE OR REPLACE FUNCTION public.tg_proposal_amendments_respect_the_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  IF NEW.raised_by IS DISTINCT FROM 'couple' THEN
    RETURN NEW;
  END IF;
  IF NEW.base_proposal_id IS NOT NULL THEN
    SELECT changes_locked INTO v_locked FROM public.vendor_proposals WHERE proposal_id = NEW.base_proposal_id;
  ELSE
    SELECT changes_locked INTO v_locked
      FROM public.vendor_proposals
     WHERE event_id = NEW.event_id AND vendor_profile_id = NEW.vendor_profile_id
       AND status IN ('sent', 'viewed', 'accepted')
     ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_locked THEN
    RAISE EXCEPTION 'supplier_lock: QUOTE_LOCKED — the supplier locked this quotation; the price is final'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_proposal_amendments_respect_the_lock() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS proposal_amendments_respect_the_lock ON public.proposal_amendments;
CREATE TRIGGER proposal_amendments_respect_the_lock
  BEFORE INSERT ON public.proposal_amendments
  FOR EACH ROW EXECUTE FUNCTION public.tg_proposal_amendments_respect_the_lock();

-- ── 3 · a quote expires ─────────────────────────────────────────────────────
-- "Valid until" is the LAST day the quote holds: it lapses the day after.
-- Accepted never expires. A legacy quote (sent before Valid until was required,
-- valid_until_legacy) has no date and never lapses.
CREATE OR REPLACE FUNCTION public.tg_vendor_proposals_expiry_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'accepted' AND NEW.status = 'expired' THEN
    RAISE EXCEPTION 'vendor_proposals: ACCEPTED_NEVER_EXPIRES — an accepted quotation never expires'
      USING ERRCODE = '23514';
  END IF;
  IF OLD.status IN ('sent', 'viewed') AND NEW.status = 'accepted'
     AND OLD.valid_until IS NOT NULL AND NOT OLD.valid_until_legacy
     AND OLD.valid_until < (NOW() AT TIME ZONE 'Asia/Manila')::DATE THEN
    RAISE EXCEPTION 'vendor_proposals: QUOTE_EXPIRED — this quotation''s Valid until has passed; the supplier sends a new one'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS vendor_proposals_expiry_rules ON public.vendor_proposals;
CREATE TRIGGER vendor_proposals_expiry_rules
  BEFORE UPDATE OF status ON public.vendor_proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_vendor_proposals_expiry_rules();

-- The writer. Either side of the conversation may run it (it only ever moves a
-- lapsed quote forward to the state it is already in, in fact). Returns how
-- many quotes it expired. Each posts one chat line.
CREATE OR REPLACE FUNCTION public.expire_lapsed_quotes(p_event_id UUID, p_vendor_profile_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_n   INTEGER := 0;
BEGIN
  IF p_event_id IS NULL OR p_vendor_profile_id IS NULL THEN
    RETURN 0;
  END IF;
  IF auth.uid() IS NOT NULL
     AND NOT (p_event_id IN (SELECT public.current_event_ids())
              OR p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
              OR p_vendor_profile_id IN (SELECT public.current_vendor_ids())
              OR public.is_admin()) THEN
    RETURN 0;
  END IF;
  FOR v_row IN
    SELECT proposal_id, title, valid_until
      FROM public.vendor_proposals
     WHERE event_id = p_event_id
       AND vendor_profile_id = p_vendor_profile_id
       AND status IN ('sent', 'viewed')
       AND valid_until IS NOT NULL
       AND NOT valid_until_legacy
       AND valid_until < (NOW() AT TIME ZONE 'Asia/Manila')::DATE
     FOR UPDATE
  LOOP
    UPDATE public.vendor_proposals
       SET status = 'expired', updated_at = NOW()
     WHERE proposal_id = v_row.proposal_id;
    v_n := v_n + 1;
    PERFORM public.chat_record_post_line(p_event_id, p_vendor_profile_id,
      'Quotation expired · ' || left(btrim(v_row.title), 80) || ' · it was valid until '
        || to_char(v_row.valid_until, 'FMMon FMDD, YYYY'),
      'Quotation expired · a new one is on its way');
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_lapsed_quotes(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_lapsed_quotes(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.expire_lapsed_quotes(UUID, UUID) IS
  'Moves this event × shop''s sent / viewed quotations whose Valid until has passed (Manila day) to expired, one chat line each. Accepted and legacy quotes are never touched. Called by the chat when it reads a lapsed quote — there is no scheduler. Either side of the conversation may call it. Migration 20271332497337.';

-- ── 4 · the call time, for the pin — one supplier, one event ────────────────
-- The rule is `earliestTaggedBlock` (lib/coordinator-broadcasts.ts) over the
-- moments tagged with the booking (responsible_vendor_ids holds
-- event_vendors.vendor_id): the earliest timed block, a Time-TBA chapter and
-- every moment inside it excluded. Returns NULL = no call time set.
-- 🔒 Returns one timestamp — never a label, a note or another supplier's row —
-- to the event's people and the supplier's own team only.
CREATE OR REPLACE FUNCTION public.chat_call_time_for(p_event_id UUID, p_vendor_profile_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT ev.vendor_id
      FROM public.event_vendors ev
     WHERE ev.event_id = p_event_id
       AND ev.marketplace_vendor_id = p_vendor_profile_id
  ),
  allowed AS (
    SELECT 1 WHERE p_event_id IN (SELECT public.current_event_ids())
                OR p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
                OR p_vendor_profile_id IN (SELECT public.current_vendor_ids())
                OR public.is_admin()
  ),
  tba AS (
    SELECT b.block_id FROM public.event_schedule_blocks b
     WHERE b.event_id = p_event_id AND b.parent_block_id IS NULL AND b.time_tba IS TRUE
  )
  SELECT min(b.start_at)
    FROM public.event_schedule_blocks b
   WHERE EXISTS (SELECT 1 FROM allowed)
     AND b.event_id = p_event_id
     AND b.start_at IS NOT NULL
     AND b.time_tba IS NOT TRUE
     AND (b.parent_block_id IS NULL OR b.parent_block_id NOT IN (SELECT block_id FROM tba))
     AND b.responsible_vendor_ids && ARRAY(SELECT vendor_id FROM me);
$$;
REVOKE ALL ON FUNCTION public.chat_call_time_for(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_call_time_for(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.chat_call_time_for(UUID, UUID) IS
  'ONE booked supplier''s call time on ONE event (earliest timed Schedule moment tagged with the booking; a Time-TBA chapter and its moments give none), for the chat''s "call time unset" pin. Returns only the timestamp, to the event''s people and the shop''s team. NULL = none set. Migration 20271332497337.';

-- ── 5 · the host's Agree for a coordinator / planner ────────────────────────
-- DECISION_LOG 🤝 2026-11-08: the host agrees ONCE, when sending the payment
-- proof — "[Name] will be able to access your event to help you build it."
-- Recorded on the shipped consent record (who, when), keyed to the shop.
ALTER TABLE public.coordinator_access_consents
  ADD COLUMN IF NOT EXISTS vendor_profile_id UUID REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS coordinator_access_consents_shop_idx
  ON public.coordinator_access_consents (event_id, vendor_profile_id)
  WHERE vendor_profile_id IS NOT NULL;
COMMENT ON COLUMN public.coordinator_access_consents.vendor_profile_id IS
  'Set when the consent is a host''s Agree for a coordinator / planner SUPPLIER booked on the event (DECISION_LOG 🤝 2026-11-08, given with the payment proof) — written only by host_agree_coordinator_access(). NULL for the coordinator host-invite consent. Migration 20271332497337.';

-- The supplier reads its own agreement row (who agreed, when).
DROP POLICY IF EXISTS coordinator_access_consents_shop_select ON public.coordinator_access_consents;
CREATE POLICY coordinator_access_consents_shop_select
  ON public.coordinator_access_consents FOR SELECT
  TO authenticated
  USING (vendor_profile_id IS NOT NULL
         AND (vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
              OR vendor_profile_id IN (SELECT public.current_vendor_ids())));

-- Only a HOST (a couple member) agrees, for a coordinator-trade shop that has
-- a booking on the event. Returns ok · already · not_a_host · not_a_coordinator
-- · not_booked · unauthenticated.
CREATE OR REPLACE FUNCTION public.host_agree_coordinator_access(p_event_id UUID, p_vendor_profile_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_services TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'unauthenticated';
  END IF;
  IF p_event_id NOT IN (SELECT public.current_couple_event_ids()) THEN
    RETURN 'not_a_host';
  END IF;
  SELECT business_name, services INTO v_name, v_services
    FROM public.vendor_profiles WHERE vendor_profile_id = p_vendor_profile_id;
  IF v_name IS NULL OR NOT public.services_make_a_coordinator(v_services) THEN
    RETURN 'not_a_coordinator';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_vendors
                  WHERE event_id = p_event_id AND marketplace_vendor_id = p_vendor_profile_id) THEN
    RETURN 'not_booked';
  END IF;
  IF EXISTS (SELECT 1 FROM public.coordinator_access_consents
              WHERE event_id = p_event_id AND vendor_profile_id = p_vendor_profile_id AND revoked_at IS NULL) THEN
    RETURN 'already';
  END IF;
  INSERT INTO public.coordinator_access_consents
    (event_id, vendor_profile_id, consented_by_user_id, coordinator_label, scope_version)
  VALUES (p_event_id, p_vendor_profile_id, auth.uid(), left(v_name, 120), 'supplier-proof-v1');
  PERFORM public.chat_record_post_line(p_event_id, p_vendor_profile_id,
    'Access agreed · ' || left(v_name, 80) || ' can now help build the whole event',
    'Access agreed · they can now help build the whole event');
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.host_agree_coordinator_access(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_agree_coordinator_access(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.host_agree_coordinator_access(UUID, UUID) IS
  'A host''s one-time Agree that a booked coordinator / planner supplier may access the whole event (DECISION_LOG 🤝 2026-11-08 — given with the payment proof; Lane C''s Log a payment card calls it). Writes the consent record (who, when) and one chat line. Hosts only. Migration 20271332497337.';

-- The pin's question, asked by either side: does this booked coordinator /
-- planner still wait for the hosts' Agree? TRUE only for a coordinator-trade
-- shop with a booking on the event and no live consent. FALSE to anyone outside
-- the conversation (it says nothing to a stranger).
CREATE OR REPLACE FUNCTION public.chat_coordinator_agree_needed(p_event_id UUID, p_vendor_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT public.services_make_a_coordinator(vp.services)
       AND EXISTS (SELECT 1 FROM public.event_vendors ev
                    WHERE ev.event_id = p_event_id AND ev.marketplace_vendor_id = p_vendor_profile_id)
       AND NOT EXISTS (SELECT 1 FROM public.coordinator_access_consents c
                        WHERE c.event_id = p_event_id AND c.vendor_profile_id = p_vendor_profile_id
                          AND c.revoked_at IS NULL)
      FROM public.vendor_profiles vp
     WHERE vp.vendor_profile_id = p_vendor_profile_id
       AND (p_event_id IN (SELECT public.current_event_ids())
            OR p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
            OR p_vendor_profile_id IN (SELECT public.current_vendor_ids())
            OR public.is_admin())
  ), FALSE);
$$;
REVOKE ALL ON FUNCTION public.chat_coordinator_agree_needed(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_coordinator_agree_needed(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.chat_coordinator_agree_needed(UUID, UUID) IS
  'TRUE when a booked coordinator / planner supplier still waits for the hosts'' one-time Agree (no live coordinator_access_consents row for the shop) — the chat''s coordinator_agree pin. FALSE to anyone outside the conversation. Migration 20271332497337.';

-- ── 6 · decision topics — either side closes, anyone reopens ────────────────
-- Owner 2026-11-09 ("everything is approved", recommendation 1): "Either side
-- may close a decision topic, and anyone may reopen it." The (+) Decision card
-- (Lane C) opens a topic; it stays pinned until closed.
CREATE TABLE IF NOT EXISTS public.chat_decision_topics (
  topic_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id          UUID NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  title              TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  opened_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at          TIMESTAMPTZ,
  closed_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reopened_at        TIMESTAMPTZ
);
ALTER TABLE public.chat_decision_topics ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS chat_decision_topics_thread_idx
  ON public.chat_decision_topics (thread_id, closed_at);
COMMENT ON TABLE public.chat_decision_topics IS
  'A chat''s decision topics (the (+) Decision card): pinned while open; either side closes one, anyone in the chat reopens it (owner 2026-11-09). Rows are written ONLY by chat_decision_open / chat_decision_set_closed. Migration 20271332497337.';

-- Read: whoever is in the conversation (the hosts' side by membership, the
-- supplier's side by its shop). No write policy — the RPCs below are the door.
DROP POLICY IF EXISTS chat_decision_topics_read ON public.chat_decision_topics;
CREATE POLICY chat_decision_topics_read
  ON public.chat_decision_topics FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR thread_id IN (SELECT t.thread_id FROM public.chat_threads t
                      WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
                         OR t.vendor_profile_id IN (SELECT public.current_vendor_ids()))
    OR (SELECT public.is_admin())
  );
REVOKE INSERT, UPDATE, DELETE ON public.chat_decision_topics FROM anon, authenticated;
GRANT SELECT ON public.chat_decision_topics TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_is_in_thread(p_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_thread_id IN (SELECT public.current_thread_ids())
      OR EXISTS (SELECT 1 FROM public.chat_threads t
                  WHERE t.thread_id = p_thread_id
                    AND (t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
                         OR t.vendor_profile_id IN (SELECT public.current_vendor_ids())));
$$;
REVOKE ALL ON FUNCTION public.chat_is_in_thread(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_is_in_thread(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_decision_open(p_thread_id UUID, p_title TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_event UUID;
  v_shop UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.chat_is_in_thread(p_thread_id) THEN
    RAISE EXCEPTION 'chat_decision: NOT_IN_THIS_CHAT' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.chat_decision_topics (thread_id, title, opened_by_user_id)
  VALUES (p_thread_id, left(btrim(p_title), 120), auth.uid())
  RETURNING topic_id INTO v_id;
  SELECT event_id, vendor_profile_id INTO v_event, v_shop FROM public.chat_threads WHERE thread_id = p_thread_id;
  PERFORM public.chat_record_post_line(v_event, v_shop, 'Decision opened · ' || left(btrim(p_title), 120));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_decision_open(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_decision_open(UUID, TEXT) TO authenticated;

-- Close (p_closed = true) or reopen (false). Anyone in the chat may do either:
-- "either side closes, anyone reopens" — both sides ARE everyone in the chat.
-- Returns ok · unchanged · not_found.
CREATE OR REPLACE FUNCTION public.chat_decision_set_closed(p_topic_id UUID, p_closed BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t RECORD;
  v_event UUID;
  v_shop UUID;
BEGIN
  SELECT topic_id, thread_id, title, closed_at INTO v_t
    FROM public.chat_decision_topics WHERE topic_id = p_topic_id FOR UPDATE;
  IF v_t.topic_id IS NULL OR auth.uid() IS NULL OR NOT public.chat_is_in_thread(v_t.thread_id) THEN
    RETURN 'not_found';
  END IF;
  IF p_closed AND v_t.closed_at IS NOT NULL OR NOT p_closed AND v_t.closed_at IS NULL THEN
    RETURN 'unchanged';
  END IF;
  IF p_closed THEN
    UPDATE public.chat_decision_topics
       SET closed_at = NOW(), closed_by_user_id = auth.uid()
     WHERE topic_id = p_topic_id;
  ELSE
    UPDATE public.chat_decision_topics
       SET closed_at = NULL, closed_by_user_id = NULL, reopened_at = NOW()
     WHERE topic_id = p_topic_id;
  END IF;
  SELECT event_id, vendor_profile_id INTO v_event, v_shop FROM public.chat_threads WHERE thread_id = v_t.thread_id;
  PERFORM public.chat_record_post_line(v_event, v_shop,
    CASE WHEN p_closed THEN 'Decision closed · ' ELSE 'Decision reopened · ' END || v_t.title);
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_decision_set_closed(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_decision_set_closed(UUID, BOOLEAN) TO authenticated;
COMMENT ON FUNCTION public.chat_decision_set_closed(UUID, BOOLEAN) IS
  'Closes (true) or reopens (false) a chat decision topic. Anyone in that chat — either side — may do either (owner 2026-11-09). One chat line per change. Migration 20271332497337.';

-- ── 7 · a private line does not move the thread for a third member ──────────
-- chat_threads.updated_at is ONE stamp every member's list sorts and un-archives
-- by (lib/chat.ts computeArchived), so a private line bumping it told a third
-- member that something they cannot read had happened. Shared lines only — the
-- same WHEN the push webhook already wears (20271329968207).
DROP TRIGGER IF EXISTS on_chat_message_inserted ON public.chat_messages;
CREATE TRIGGER on_chat_message_inserted
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  WHEN (NEW.recipient_user_id IS NULL)
  EXECUTE FUNCTION public.bump_chat_thread_updated_at();

COMMIT;
