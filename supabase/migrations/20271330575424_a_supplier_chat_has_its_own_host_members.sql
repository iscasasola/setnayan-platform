-- a supplier chat has its own host members
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- SUPPLIER BUILD 3 · LANE B — owner rulings, DECISION_LOG 👥 2026-11-09:
--   ⚖ A supplier chat has per-thread HOST membership. A new thread starts with
--     the host who opened it; a host or coordinator already in it can add
--     another event host; a host may leave; the supplier can add nobody.
--   ⚖ "coordinators/planners see everything. they cannot leave. just hosts."
--     Every coordinator on the event (event_members.member_type =
--     'coordinator' — the enum is couple · guest · vendor · coordinator,
--     measured) is in EVERY supplier thread of that event, automatically:
--     new threads, old threads, and a coordinator who joins later. They are
--     never a row, so they can never be removed and can never leave.
--   ⚖ An add or a leave posts a system line in the chat.
--   ⚖ An added host reads the full history (except private lines not
--     addressed to them — 20271329968207 still narrows); a host who left
--     reads nothing written after they left.
--
-- ── current_thread_ids() IS LOAD-BEARING — WHO CALLS IT (measured) ─────────
-- In the replayed schema, before this file: NO policy (pg_policies qual /
-- with_check) and NO function (pg_proc.prosrc) calls current_thread_ids().
-- It has been the base migration's empty stub since 20260512000000 —
-- 20271295352678 and 20271325581544 both note that and route around it. So
-- giving it a body changes NO existing reader for suppliers, admins or anyone
-- else; its only callers are the policies and functions written here. The
-- db test re-measures that list, so a later caller is seen.
--
-- ── THE POLICY DIFF (chat_messages) ─────────────────────────────────────────
--   chat_messages_member_read  (SELECT)
--   − event_id IN (SELECT current_couple_event_ids())
--   + thread_id IN (SELECT current_thread_ids())
--   + OR <a departed member row of this thread, and created_at <= its left_at>
--     vendor_profile_id IN (SELECT current_vendor_profile_ids())          (same)
--     OR (vendor_profile_id IN (SELECT current_vendor_ids('viewer'))
--         AND event_id IN (SELECT agent_customer_event_ids()))           (same)
--   chat_messages_member_insert (INSERT · WITH CHECK)
--   − event_id IN (SELECT current_couple_event_ids())
--   + thread_id IN (SELECT current_thread_ids())
--     <the two vendor branches>                                          (same)
--   Unchanged: chat_messages_block_guard, chat_messages_private_reaches_two.
--   Supplier side: byte-identical. Admins: no chat_messages branch before,
--   none after (they read private rows only through the restrictive policy's
--   is_admin(), which still needs a permissive branch — unchanged).
--   Coordinators: NEW read on every thread of their event (the ruling).
--   Couple side: a host now reads a thread only as its member.
--   The three unread counters follow the same membership.
-- NOT changed (flagged in the lane report): chat_threads' own policies still
-- show a non-member host that a thread EXISTS (its row, not its words), and
-- tg_chat_messages_derive_sender still has no 'coordinator' branch, so a
-- coordinator reads but cannot post.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · the member table (hosts only — coordinators are derived) ───────────
CREATE TABLE IF NOT EXISTS public.chat_thread_members (
  thread_id        UUID NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  -- Who added them. NULL = the thread's opener, or the 2026-11-09 backfill.
  added_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Set when the host leaves. They keep what was written up to this moment.
  left_at          TIMESTAMPTZ,
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_thread_members_user_idx
  ON public.chat_thread_members (user_id, thread_id);

ALTER TABLE public.chat_thread_members ENABLE ROW LEVEL SECURITY;

-- Reads only. Every write is the opener trigger or the two functions below.
REVOKE ALL ON public.chat_thread_members FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.chat_thread_members FROM authenticated;
GRANT SELECT ON public.chat_thread_members TO authenticated;

COMMENT ON TABLE public.chat_thread_members IS
  'The HOSTS in one supplier conversation (owner 2026-11-09). A host reads a thread''s messages only through a row here (current_thread_ids()); left_at = they left and read nothing written after it. Coordinators (event_members.member_type = coordinator) are NOT rows: they are in every thread of their event, derived in current_thread_ids(), and can never leave. The supplier side stays derived from vendor_profiles / vendor_team_members. Writes only through tg_chat_threads_seat_the_opener, chat_thread_add_host() and chat_thread_leave(). Migration 20271330575424.';

-- ── 2 · the canonical helper gets its body ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_thread_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- A host: a live membership row.
  SELECT m.thread_id
    FROM public.chat_thread_members m
   WHERE m.user_id = auth.uid()
     AND m.left_at IS NULL
  UNION
  -- A coordinator: every supplier thread of their event.
  SELECT t.thread_id
    FROM public.chat_threads t
    JOIN public.event_members em ON em.event_id = t.event_id
   WHERE em.user_id = auth.uid()
     AND em.member_type = 'coordinator';
$$;
GRANT EXECUTE ON FUNCTION public.current_thread_ids() TO authenticated;

COMMENT ON FUNCTION public.current_thread_ids() IS
  'Chat threads the caller is IN on the hosts'' side: a live chat_thread_members row (a host), or any thread of an event where the caller is an event_members coordinator. Excludes the supplier side, which stays vendor_profile-derived. The canonical RLS helper (RLS_Policy_Pattern §4) — an empty stub until migration 20271330575424.';

-- Members of a thread see who else is in it; a departed host sees their own row.
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
    OR (SELECT public.is_admin())
  );

-- ── 3 · the backfill: nobody loses access ───────────────────────────────────
-- Every existing thread gets today's event_chat_hosts(event) list — every
-- event_members couple row that has a users row (that function's own join).
INSERT INTO public.chat_thread_members (thread_id, user_id)
SELECT t.thread_id, em.user_id
  FROM public.chat_threads t
  JOIN public.event_members em ON em.event_id = t.event_id AND em.member_type = 'couple'
  JOIN public.users u ON u.user_id = em.user_id
ON CONFLICT (thread_id, user_id) DO NOTHING;

-- ── 4 · a new thread seats the host who opened it ───────────────────────────
-- The host = the signed-in caller when they are a host of the event, else the
-- thread's created_by_user_id when that is a host. A thread opened from the
-- supplier side or by the service role has no host to name, so it seats
-- every host of the event — nobody is locked out of a conversation about
-- their own event. Not wrapped: a thread nobody on the host side can read is
-- worse than a thread that failed to open.
CREATE OR REPLACE FUNCTION public.tg_chat_threads_seat_the_opener()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host UUID;
BEGIN
  SELECT em.user_id INTO v_host
    FROM public.event_members em
    JOIN public.users u ON u.user_id = em.user_id
   WHERE em.event_id = NEW.event_id
     AND em.member_type = 'couple'
     AND em.user_id IN (auth.uid(), NEW.created_by_user_id)
   ORDER BY (em.user_id = auth.uid()) DESC
   LIMIT 1;

  IF v_host IS NOT NULL THEN
    INSERT INTO public.chat_thread_members (thread_id, user_id)
    VALUES (NEW.thread_id, v_host)
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  ELSE
    INSERT INTO public.chat_thread_members (thread_id, user_id)
    SELECT NEW.thread_id, em.user_id
      FROM public.event_members em
      JOIN public.users u ON u.user_id = em.user_id
     WHERE em.event_id = NEW.event_id AND em.member_type = 'couple'
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_chat_threads_seat_the_opener() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chat_threads_seat_the_opener ON public.chat_threads;
CREATE TRIGGER chat_threads_seat_the_opener
  AFTER INSERT ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_threads_seat_the_opener();

-- ── 5 · add a host · leave ──────────────────────────────────────────────────
-- A person's name for a chat line: first name, else the first word of their
-- display name, else "A host".
CREATE OR REPLACE FUNCTION public.chat_member_first_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT COALESCE(NULLIF(btrim(u.first_name), ''),
                     NULLIF(split_part(btrim(COALESCE(u.display_name, '')), ' ', 1), ''))
       FROM public.users u WHERE u.user_id = p_user_id),
    'A host');
$$;
REVOKE ALL ON FUNCTION public.chat_member_first_name(UUID) FROM PUBLIC, anon, authenticated;

-- Returns: added · already · not_a_host · not_allowed · not_found · unauthenticated.
CREATE OR REPLACE FUNCTION public.chat_thread_add_host(p_thread_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_event  UUID;
  v_shop   UUID;
  v_left   TIMESTAMPTZ;
  v_found  BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'unauthenticated';
  END IF;
  SELECT t.event_id, t.vendor_profile_id INTO v_event, v_shop
    FROM public.chat_threads t WHERE t.thread_id = p_thread_id;
  IF v_event IS NULL THEN
    RETURN 'not_found';
  END IF;
  -- Only someone IN the thread on the hosts' side: a live host, or the
  -- event's coordinator. The supplier is never in current_thread_ids().
  IF p_thread_id NOT IN (SELECT public.current_thread_ids()) THEN
    RETURN 'not_allowed';
  END IF;
  IF p_user_id IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.event_members em
         JOIN public.users u ON u.user_id = em.user_id
        WHERE em.event_id = v_event AND em.user_id = p_user_id AND em.member_type = 'couple') THEN
    RETURN 'not_a_host';
  END IF;

  SELECT TRUE, m.left_at INTO v_found, v_left
    FROM public.chat_thread_members m
   WHERE m.thread_id = p_thread_id AND m.user_id = p_user_id
   FOR UPDATE;
  IF v_found AND v_left IS NULL THEN
    RETURN 'already';
  END IF;

  IF v_found THEN
    UPDATE public.chat_thread_members
       SET left_at = NULL, joined_at = NOW(), added_by_user_id = v_uid
     WHERE thread_id = p_thread_id AND user_id = p_user_id;
  ELSE
    INSERT INTO public.chat_thread_members (thread_id, user_id, added_by_user_id)
    VALUES (p_thread_id, p_user_id, v_uid);
  END IF;

  PERFORM public.chat_record_post_line(v_event, v_shop,
    public.chat_member_first_name(p_user_id) || ' was added to this chat by '
      || public.chat_member_first_name(v_uid),
    'A host was added to this chat');
  RETURN 'added';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_thread_add_host(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_thread_add_host(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.chat_thread_add_host(UUID, UUID) IS
  'A host or the event''s coordinator, already in this supplier conversation, adds another HOST of the event (event_members couple). The supplier cannot (it is never in current_thread_ids()). Re-adding a host who left restores them. Posts a system line. Returns added | already | not_a_host | not_allowed | not_found | unauthenticated. Migration 20271330575424.';

-- Returns: left · cannot_leave (a coordinator / the supplier) · last_host ·
-- not_a_member · not_found · unauthenticated.
CREATE OR REPLACE FUNCTION public.chat_thread_leave(p_thread_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_event UUID;
  v_shop  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'unauthenticated';
  END IF;
  SELECT t.event_id, t.vendor_profile_id INTO v_event, v_shop
    FROM public.chat_threads t WHERE t.thread_id = p_thread_id;
  IF v_event IS NULL THEN
    RETURN 'not_found';
  END IF;

  PERFORM 1 FROM public.chat_thread_members m
   WHERE m.thread_id = p_thread_id AND m.user_id = v_uid AND m.left_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    -- A coordinator or the supplier is in the thread without a row: they
    -- cannot leave. Anyone else was never in it.
    IF p_thread_id IN (SELECT public.current_thread_ids())
       OR v_shop IN (SELECT public.current_vendor_profile_ids())
       OR v_shop IN (SELECT public.current_vendor_ids('viewer')) THEN
      RETURN 'cannot_leave';
    END IF;
    RETURN 'not_a_member';
  END IF;

  -- The last host stays: with no host left, nobody on the hosts' side but a
  -- coordinator could ever bring one back.
  IF NOT EXISTS (
       SELECT 1 FROM public.chat_thread_members m
        WHERE m.thread_id = p_thread_id AND m.left_at IS NULL AND m.user_id <> v_uid) THEN
    RETURN 'last_host';
  END IF;

  PERFORM public.chat_record_post_line(v_event, v_shop,
    public.chat_member_first_name(v_uid) || ' left this chat',
    'A host left this chat');
  UPDATE public.chat_thread_members
     SET left_at = clock_timestamp()
   WHERE thread_id = p_thread_id AND user_id = v_uid;
  RETURN 'left';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_thread_leave(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_thread_leave(UUID) TO authenticated;

COMMENT ON FUNCTION public.chat_thread_leave(UUID) IS
  'A HOST leaves one supplier conversation: they keep what was written before, and read nothing after (left_at). The supplier and the coordinator cannot leave; the last host cannot leave. Posts a system line. Returns left | cannot_leave | last_host | not_a_member | not_found | unauthenticated. Migration 20271330575424.';

-- ── 6 · who is in THIS thread — the source for ChatHostStrip ────────────────
-- event_chat_hosts(event) stays as it is for the supplier brief's event-wide
-- 'hosts' key. The chat strip reads this instead: same fields, plus kind.
CREATE OR REPLACE FUNCTION public.thread_chat_hosts(p_thread_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH people AS (
    SELECT m.user_id, 'host'::TEXT AS kind, m.joined_at AS since, t.event_id
      FROM public.chat_thread_members m
      JOIN public.chat_threads t ON t.thread_id = m.thread_id
     WHERE m.thread_id = p_thread_id AND m.left_at IS NULL
    UNION ALL
    SELECT em.user_id, 'coordinator'::TEXT, em.joined_at, t.event_id
      FROM public.chat_threads t
      JOIN public.event_members em ON em.event_id = t.event_id AND em.member_type = 'coordinator'
     WHERE t.thread_id = p_thread_id AND em.user_id IS NOT NULL
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'user_id',    u.user_id,
           'first_name', COALESCE(NULLIF(btrim(u.first_name), ''),
                                  NULLIF(split_part(btrim(COALESCE(u.display_name, '')), ' ', 1), '')),
           'name',       COALESCE(NULLIF(btrim(u.display_name), ''),
                                  NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), '')),
           'role',       mo.role_subtype,
           'label',      mo.display_label,
           'kind',       p.kind
         ) ORDER BY (p.kind = 'host') DESC, p.since NULLS LAST, u.user_id), '[]'::jsonb)
  FROM people p
  JOIN public.users u ON u.user_id = p.user_id
  LEFT JOIN public.event_moderators mo
         ON mo.event_id = p.event_id AND mo.user_id = p.user_id
        AND mo.removed_at IS NULL AND mo.accepted_at IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.thread_chat_hosts(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.thread_chat_hosts(UUID) TO service_role;

COMMENT ON FUNCTION public.thread_chat_hosts(UUID) IS
  'Who is in ONE supplier conversation on the hosts'' side, for ChatHostStrip: its live host members, then the event''s coordinators, as { user_id, first_name, name, role, label, kind: host | coordinator } — event_chat_hosts'' shape plus kind. service_role only, like event_chat_hosts. Migration 20271330575424.';

-- ── 7 · chat_messages read/insert: the couple branch becomes membership ─────
DROP POLICY IF EXISTS chat_messages_member_read ON public.chat_messages;
CREATE POLICY chat_messages_member_read
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR EXISTS (
      SELECT 1 FROM public.chat_thread_members m
       WHERE m.thread_id = chat_messages.thread_id
         AND m.user_id   = (SELECT auth.uid())
         AND m.left_at IS NOT NULL
         AND chat_messages.created_at <= m.left_at
    )
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (
      vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
      AND event_id IN (SELECT public.agent_customer_event_ids())
    )
  );

DROP POLICY IF EXISTS chat_messages_member_insert ON public.chat_messages;
CREATE POLICY chat_messages_member_insert
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    thread_id IN (SELECT public.current_thread_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (
      vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
      AND event_id IN (SELECT public.agent_customer_event_ids())
    )
  );

-- ── 7b · a coordinator sees every supplier thread of the event ──────────────
-- "coordinators/planners see everything" — until now a coordinator had no
-- chat_threads branch at all (the read policy named couple, shop and agent).
-- The 20260821000000 predicate, byte-for-byte, plus ONE arm. The couple arm is
-- deliberately KEPT: every host still sees which suppliers the event is
-- talking to (20271295352678 relies on it); what a non-member host cannot
-- read is the conversation itself (chat_messages_member_read above).
DROP POLICY IF EXISTS chat_threads_member_read ON public.chat_threads;
CREATE POLICY chat_threads_member_read
  ON public.chat_threads FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (
      vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
      AND event_id IN (SELECT public.agent_customer_event_ids())
    )
    OR thread_id IN (SELECT public.current_thread_ids())
  );

-- ── 8 · the unread counters follow membership (and 20271329968207's privacy) ─
CREATE OR REPLACE FUNCTION public.count_unread_message_threads()
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.chat_threads t
  WHERE (
    t.thread_id IN (SELECT public.current_thread_ids())
    OR t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  )
  AND EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.thread_id = t.thread_id
      AND m.sender_user_id IS DISTINCT FROM (SELECT auth.uid())
      AND (m.recipient_user_id IS NULL OR m.recipient_user_id = (SELECT auth.uid()))
      AND m.created_at > COALESCE(
        (SELECT r.last_read_at FROM public.chat_thread_reads r
         WHERE r.thread_id = t.thread_id AND r.user_id = (SELECT auth.uid())),
        'epoch'::timestamptz)
  );
$$;

CREATE OR REPLACE FUNCTION public.unread_message_threads_by_event()
RETURNS TABLE(event_id UUID, unread_count INT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT t.event_id, COUNT(*)::int AS unread_count
  FROM public.chat_threads t
  WHERE t.event_id IN (SELECT public.current_couple_event_ids())
    AND t.thread_id IN (SELECT public.current_thread_ids())
    AND EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.thread_id = t.thread_id
        AND m.sender_user_id IS DISTINCT FROM auth.uid()
        AND (m.recipient_user_id IS NULL OR m.recipient_user_id = auth.uid())
        AND m.created_at > COALESCE(
          (SELECT r.last_read_at FROM public.chat_thread_reads r
           WHERE r.thread_id = t.thread_id AND r.user_id = auth.uid()),
          'epoch'::timestamptz)
    )
  GROUP BY t.event_id;
$$;

-- ── 9 · a private message goes to someone IN this conversation ─────────────
-- 20271329968207 checked "a host of the event"; with per-thread membership a
-- host who is not in (or has left) this conversation is not a recipient. The
-- recipient must be: a live host member · a coordinator of the event · the
-- shop's owner · an active member of the shop's team.
CREATE OR REPLACE FUNCTION public.tg_chat_messages_private_is_between_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.recipient_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.sender_user_id IS NULL THEN
    RAISE EXCEPTION 'chat_messages: PRIVATE_NEEDS_A_SENDER — a private message is from a person'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.recipient_user_id = NEW.sender_user_id THEN
    RAISE EXCEPTION 'chat_messages: PRIVATE_NOT_TO_SELF — a private message goes to someone else'
      USING ERRCODE = '23514';
  END IF;
  IF NOT (
       EXISTS (SELECT 1 FROM public.chat_thread_members m
                WHERE m.thread_id = NEW.thread_id
                  AND m.user_id = NEW.recipient_user_id
                  AND m.left_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.event_members em
                WHERE em.event_id = NEW.event_id
                  AND em.user_id = NEW.recipient_user_id
                  AND em.member_type = 'coordinator')
    OR EXISTS (SELECT 1 FROM public.vendor_profiles vp
                WHERE vp.vendor_profile_id = NEW.vendor_profile_id
                  AND vp.user_id = NEW.recipient_user_id)
    OR EXISTS (SELECT 1 FROM public.vendor_team_members tm
                WHERE tm.vendor_profile_id = NEW.vendor_profile_id
                  AND tm.user_id = NEW.recipient_user_id
                  AND tm.deactivated_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'chat_messages: PRIVATE_NOT_A_MEMBER — a private message goes to someone in this conversation'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_chat_messages_private_is_between_members() FROM PUBLIC, anon, authenticated;

COMMIT;
