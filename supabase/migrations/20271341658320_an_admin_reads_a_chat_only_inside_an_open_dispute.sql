-- an_admin_reads_a_chat_only_inside_an_open_dispute
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- NOT applied anywhere by this PR — the pipeline pushes it.
-- ════════════════════════════════════════════════════════════════════════════
-- AN ADMIN READS A CHAT ONLY WHILE AN OPEN DISPUTE TIES THE EVENT TO THE SUPPLIER (task 6119)
--
-- The private line already worked this way (chat_messages_private_reaches_its_people · chat_private_in_dispute,
-- migration 20271340374819). Everything ELSE a chat carries still admitted any admin session outright through a
-- bare `OR (SELECT public.is_admin())` arm. This file narrows that ONE arm on every chat-content read to the threads
-- an open `vendor_disputes` row ties to (the SAME link chat_private_in_dispute uses: the dispute's shop = the
-- thread's shop, the dispute's order's event = the thread's event, status 'open'). Every other arm is restated
-- byte-for-byte; nobody else's read changes, and nobody is widened.
--
-- ── THE ROUTES, MEASURED (pg_policies after the full replay; every SELECT that named is_admin() on chat content) ──
--   chat_decision_messages_read    thread_id  → admin arm narrowed
--   chat_decision_topics_read      thread_id  → admin arm narrowed
--   chat_polls_read                thread_id  → admin arm narrowed
--   chat_poll_choices_read         thread_id  → admin arm narrowed
--   chat_poll_votes_read           thread_id  → admin arm narrowed
--   chat_thread_members_read       thread_id  → admin arm narrowed (who is in the chat)
--   booking_change_asks_members_read  thread_id  → admin arm narrowed
--   thread_calls_member_read          thread_id  → admin arm narrowed
--   change_asks_read(uuid)  (SECURITY DEFINER reader that restates the table's admission) → same narrowing
--
-- ── LEFT AS THEY ARE, ON PURPOSE ─────────────────────────────────────────────
--   chat_messages / chat_threads — their PERMISSIVE reads have NO admin arm (an admin who is not in the chat reads
--     no shared line today); adding a dispute arm would be a WIDENING, so none is added. The private-line
--     RESTRICTIVE policy is already dispute-gated.
--   chat_message_flags — the moderation queue: flag metadata (category, hit count, status), never the words.
--   chat_blocker_shows — how often a "blocked" banner was shown; no content.
--   The admin dispute console (apps/web/app/admin/disputes) reads through the service-role client, which RLS does
--   not govern, so it reads exactly what it read before.
-- ════════════════════════════════════════════════════════════════════════════

-- ── §1 · the one helper ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_disputed_thread_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.thread_id
    FROM public.vendor_disputes d
    JOIN public.orders o       ON o.order_id = d.order_id
    JOIN public.chat_threads t ON t.event_id = o.event_id
                              AND t.vendor_profile_id = d.vendor_profile_id
   WHERE d.status = 'open'
     AND COALESCE(public.is_admin(), FALSE);
$$;
REVOKE ALL ON FUNCTION public.admin_disputed_thread_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_disputed_thread_ids() TO authenticated;
COMMENT ON FUNCTION public.admin_disputed_thread_ids() IS
  'The chat threads an ADMIN may read: those an open vendor_disputes row ties to (dispute shop = thread shop, dispute order event = thread event) — the same link as chat_private_in_dispute. Empty for anyone who is not an admin. Replaces the bare is_admin() arm on every chat-content read (owner task 6119). Migration 20271341658320.';

-- ── §2 · the thread-keyed reads ──────────────────────────────────────────────
DROP POLICY IF EXISTS chat_decision_messages_read ON public.chat_decision_messages;
CREATE POLICY chat_decision_messages_read
  ON public.chat_decision_messages FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR thread_id IN (SELECT t.thread_id FROM public.chat_threads t
                      WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
                         OR t.vendor_profile_id IN (SELECT public.current_vendor_ids()))
    OR thread_id IN (SELECT public.admin_disputed_thread_ids())
  );

DROP POLICY IF EXISTS chat_decision_topics_read ON public.chat_decision_topics;
CREATE POLICY chat_decision_topics_read
  ON public.chat_decision_topics FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR thread_id IN (SELECT t.thread_id FROM public.chat_threads t
                      WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
                         OR t.vendor_profile_id IN (SELECT public.current_vendor_ids()))
    OR thread_id IN (SELECT public.admin_disputed_thread_ids())
  );

DROP POLICY IF EXISTS chat_polls_read ON public.chat_polls;
CREATE POLICY chat_polls_read
  ON public.chat_polls FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR thread_id IN (SELECT t.thread_id FROM public.chat_threads t
                      WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
                         OR t.vendor_profile_id IN (SELECT public.current_vendor_ids()))
    OR thread_id IN (SELECT public.admin_disputed_thread_ids())
  );

DROP POLICY IF EXISTS chat_poll_choices_read ON public.chat_poll_choices;
CREATE POLICY chat_poll_choices_read
  ON public.chat_poll_choices FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR thread_id IN (SELECT t.thread_id FROM public.chat_threads t
                      WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
                         OR t.vendor_profile_id IN (SELECT public.current_vendor_ids()))
    OR thread_id IN (SELECT public.admin_disputed_thread_ids())
  );

DROP POLICY IF EXISTS chat_poll_votes_read ON public.chat_poll_votes;
CREATE POLICY chat_poll_votes_read
  ON public.chat_poll_votes FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR thread_id IN (SELECT t.thread_id FROM public.chat_threads t
                      WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
                         OR t.vendor_profile_id IN (SELECT public.current_vendor_ids()))
    OR thread_id IN (SELECT public.admin_disputed_thread_ids())
  );

DROP POLICY IF EXISTS chat_thread_members_read ON public.chat_thread_members;
CREATE POLICY chat_thread_members_read
  ON public.chat_thread_members FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR user_id = (SELECT auth.uid())
    OR thread_id IN (
      SELECT t.thread_id FROM public.chat_threads t
       WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
    OR thread_id IN (SELECT public.admin_disputed_thread_ids())
  );

-- ── §3 · the reads that ALSO carry event_id + vendor_profile_id — keyed on thread_id (NOT NULL on both;
--        event_id is nullable there, so the thread is the one link that cannot silently miss) ──
DROP POLICY IF EXISTS booking_change_asks_members_read ON public.booking_change_asks;
CREATE POLICY booking_change_asks_members_read
  ON public.booking_change_asks FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR thread_id IN (SELECT public.admin_disputed_thread_ids())
  );

DROP POLICY IF EXISTS thread_calls_member_read ON public.thread_calls;
CREATE POLICY thread_calls_member_read
  ON public.thread_calls FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR thread_id IN (SELECT public.admin_disputed_thread_ids())
  );

-- ── §4 · the definer reader that restates booking_change_asks_members_read ──
-- Body unchanged except the admin arm, which follows the table's policy above.
CREATE OR REPLACE FUNCTION public.change_asks_read(p_thread_id UUID)
RETURNS TABLE (
  ask_id UUID, subject TEXT, note TEXT, asked_at TIMESTAMPTZ, status TEXT, proposal_id UUID,
  amount_centavos BIGINT, scope_label TEXT, proposed_plan JSONB, good_until DATE, raised_by TEXT,
  answer_proposal_id UUID, kind TEXT, money_hidden BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.ask_id, a.subject, a.note, a.asked_at, a.status, a.proposal_id,
         CASE WHEN h.hidden THEN NULL ELSE a.amount_centavos END,
         a.scope_label,
         CASE WHEN h.hidden THEN NULL ELSE a.proposed_plan END,
         a.good_until, a.raised_by, a.answer_proposal_id,
         CASE WHEN a.amount_centavos IS NOT NULL THEN 'counter' WHEN a.proposed_plan IS NOT NULL THEN 'plan' ELSE 'words' END,
         h.hidden
    FROM public.booking_change_asks a
    CROSS JOIN LATERAL (SELECT public.chat_thread_money_hidden(p_thread_id) AS hidden) h
   WHERE a.thread_id = p_thread_id
     -- The SAME admission as booking_change_asks_members_read (hosts' side · the shop · an admin inside an open
     -- dispute) — never wider.
     AND (a.thread_id IN (SELECT public.current_thread_ids())
          OR a.vendor_profile_id IN (SELECT public.current_vendor_ids())
          OR a.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
          OR a.thread_id IN (SELECT public.admin_disputed_thread_ids()))
   ORDER BY a.asked_at DESC
   LIMIT 40;
$$;
REVOKE ALL ON FUNCTION public.change_asks_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_asks_read(UUID) TO authenticated;
COMMENT ON FUNCTION public.change_asks_read(UUID) IS
  'The chat''s asks (words · counters · plans), newest first, admitted exactly as booking_change_asks_members_read (the hosts'' side, the shop, an admin only while an open dispute ties the event to the shop). A coordinator without Budget & payments (chat_thread_money_hidden) reads amount_centavos and proposed_plan as NULL with money_hidden = TRUE — those two columns are closed per column to browser roles. Migrations 20271340018194 · 20271341658320.';
