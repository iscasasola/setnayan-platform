-- event group chats and a private line to several people
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ════════════════════════════════════════════════════════════════════════════
-- EVENT GROUP CHATS · PART 2 of 2 (part 1 = 20271339978803, the 'guest' side).
--
-- Owner rulings (specs DECISION_LOG), binding:
--   💬 2026-11-12 "EVENT GROUP CHATS APPROVED AS DRAWN"
--      (Build_Group_Chats_2026-11-12/event-group-chats.html):
--      · General = the hosts + every guest whose reply is attending, NO
--        suppliers (11 Nov); one group per role from the guest list; groups a
--        host makes may hold suppliers and guests ("Day-of crew").
--      · quotes, payments and forms NEVER go inside a group.
--      · a reply to a private-to-several goes back to the same people.
--      · a guest may send a private message in General, hosts included.
--      · hosts + the coordinator add; hosts may leave; a supplier never adds
--        and never leaves (as in the supplier chat).
--   🔒 2026-11-12 "PRIVATE MESSAGES — TWO DOORS, SEVERAL PEOPLE": a private
--      message may go to several people. Shipped = ONE recipient
--      (recipient_user_id, 20271329968207).
--   🛡 2026-11-12 "FIVE GUARDS APPROVED": (1) a private message's alert
--      (push/email/tray) reaches only its recipients and never shows the words
--      to anyone else; (2) private messages are readable by Setnayan
--      admin/support ONLY inside a dispute, never by event helpers/moderators.
--
-- WHAT THIS FILE DOES
--   1 · chat_threads.kind ('supplier' | 'group'). A group has no supplier
--       (vendor_profile_id NULL — the NOT NULL becomes a CHECK tied to kind) and
--       carries group_kind ('general' | 'role' | 'made'), a name, a key and,
--       for a role group, the guest-list roles it gathers.
--       chat_messages.vendor_profile_id follows: NULL exactly when the thread
--       is a group (trigger chat_messages_group_rules, every writer).
--   2 · WHO IS IN A GROUP — chat_group_member_ids(thread), the one answer:
--         general · the event's hosts + its attending guests (derived, live)
--         role    · the hosts + the guests holding one of its roles (derived)
--         made    · its chat_thread_members rows only
--       and, for every kind, chat_thread_members rows on top: a live row adds
--       a person (the coordinator added to General), a row with left_at takes
--       a derived person out (a host who left). current_thread_ids() gains this
--       branch, so EVERY existing reader keyed on it (chat_messages read and
--       insert, chat_is_in_thread → decisions and polls, the unread counters)
--       reaches group members with no second rule. Its coordinator branch is
--       narrowed to SUPPLIER threads: a coordinator is in a group only when
--       added (the drawing: Tita Lu is in "Day-of crew", not in General).
--   3 · GROUP ROWS ARE INVISIBLE TO TABLE READS — a RESTRICTIVE SELECT on
--       chat_threads: kind = 'supplier'. ~90 shipped reads list a host's
--       chat_threads by event_id and expect a supplier on every row; none of
--       them can ever be handed a group. Groups are read only through
--       chat_group_list / chat_group_head / chat_group_members, each of which
--       answers members only.
--   4 · WRITES ONLY THROUGH FUNCTIONS: chat_group_open (General),
--       chat_group_open_role, chat_group_create (hosts), chat_group_add
--       (hosts + coordinators; General never takes a supplier),
--       chat_group_leave (hosts only). The shipped chat_thread_add_host /
--       chat_thread_leave refuse a group, so a supplier row in a made group
--       cannot leave through the supplier-chat door.
--   5 · MONEY NEVER ENTERS A GROUP — chat_messages_group_rules refuses a
--       proposal, change order, amendment or offered-service link in a group
--       (the meeting link is a meeting, not money, and is left to
--       card_names_this_conversation as today).
--   6 · A PRIVATE LINE TO SEVERAL PEOPLE — chat_messages.recipient_user_ids
--       uuid[]. recipient_user_id stays as the FIRST of them, so every shipped
--       "IS NULL = shared" test (the CHECK words-only, the push webhook's WHEN,
--       the bump trigger's WHEN, the tray trigger's WHEN, the AI's filters)
--       keeps meaning the same thing. One BEFORE INSERT body (the shipped
--       tg_chat_messages_private_is_between_members, rewritten) folds the two
--       into one sorted, de-duplicated list; a CHECK holds them equal.
--       It is an ARRAY ON THE ROW, not a junction table, on purpose: a junction
--       row is written AFTER the message, so for that instant the message
--       would be a shared line — realtime, the push webhook and the bump
--       trigger all fire on the INSERT.
--   7 · THE READ RULE — chat_messages_private_reaches_two is replaced by
--       chat_messages_private_reaches_its_people (RESTRICTIVE SELECT):
--       shared, or you sent it, or you are one of its recipients, or you are
--       an admin AND an open vendor_disputes row ties this event to this
--       supplier (chat_private_in_dispute). A moderator / event helper has no
--       branch at all. A group has no supplier, so no dispute: an admin never
--       reads a private line in a group.
--   8 · THE ALERTS — tg_chat_messages_private_tells_its_reader writes one
--       tray row per recipient (never the words); the live ping reaches the
--       recipients of a private line and the members of a group; the push
--       webhook (the shop's devices) fires for shared SUPPLIER lines only; the
--       three unread counters read the list.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · the thread kind ─────────────────────────────────────────────────────
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS kind        TEXT NOT NULL DEFAULT 'supplier',
  ADD COLUMN IF NOT EXISTS group_kind  TEXT,
  ADD COLUMN IF NOT EXISTS group_name  TEXT,
  ADD COLUMN IF NOT EXISTS group_key   TEXT,
  ADD COLUMN IF NOT EXISTS group_roles public.guest_role[];

ALTER TABLE public.chat_threads ALTER COLUMN vendor_profile_id DROP NOT NULL;
ALTER TABLE public.chat_messages ALTER COLUMN vendor_profile_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.chat_threads'::regclass
                    AND conname = 'chat_threads_kind_is_known') THEN
    ALTER TABLE public.chat_threads
      ADD CONSTRAINT chat_threads_kind_is_known CHECK (kind IN ('supplier', 'group'));
  END IF;
  -- The NOT NULL that just dropped, kept for every supplier conversation.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.chat_threads'::regclass
                    AND conname = 'chat_threads_a_supplier_chat_has_a_supplier') THEN
    ALTER TABLE public.chat_threads
      ADD CONSTRAINT chat_threads_a_supplier_chat_has_a_supplier
      CHECK ((kind = 'supplier') = (vendor_profile_id IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.chat_threads'::regclass
                    AND conname = 'chat_threads_a_group_says_what_it_is') THEN
    ALTER TABLE public.chat_threads
      ADD CONSTRAINT chat_threads_a_group_says_what_it_is
      CHECK (
        (kind = 'supplier' AND group_kind IS NULL AND group_name IS NULL
                           AND group_key IS NULL AND group_roles IS NULL)
        OR (kind = 'group' AND group_kind IN ('general', 'role', 'made')
            AND group_name IS NOT NULL AND char_length(btrim(group_name)) BETWEEN 1 AND 60
            AND (group_kind <> 'role' OR (group_key IS NOT NULL AND cardinality(group_roles) > 0))
            AND (group_kind = 'role' OR group_roles IS NULL))
      );
  END IF;
END $$;

-- One General and one group per role, per event.
CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_one_general_and_one_per_role
  ON public.chat_threads (event_id, group_kind, COALESCE(group_key, ''))
  WHERE kind = 'group' AND group_kind IN ('general', 'role');

COMMENT ON COLUMN public.chat_threads.kind IS
  'supplier = one event × one supplier (the shipped conversation). group = an EVENT GROUP CHAT (owner 2026-11-12 "EVENT GROUP CHATS APPROVED AS DRAWN"): no supplier, group_kind general · role · made. Group rows are invisible to table reads (policy chat_threads_groups_read_through_functions) — read them with chat_group_list / chat_group_head / chat_group_members. Migration 20271340374819.';

-- ── 3 · group rows are read through the functions only ──────────────────────
DROP POLICY IF EXISTS chat_threads_groups_read_through_functions ON public.chat_threads;
CREATE POLICY chat_threads_groups_read_through_functions
  ON public.chat_threads
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (kind = 'supplier');

-- SELECT on chat_threads is granted per column since 20271333705710 (a new
-- column is closed until granted): the new columns are readable — the rows of
-- a group are not (the policy above).
GRANT SELECT (kind, group_kind, group_name, group_key, group_roles) ON public.chat_threads TO authenticated;

-- No browser write ever makes or edits a group. ⚠ A column REVOKE is INERT
-- here: chat_threads' INSERT/UPDATE grants are TABLE-level, so every new
-- column inherits them (the exposure-freeze guard measured it). The fence is
-- this trigger: an end-user session may only open a SUPPLIER conversation
-- and may never change a thread's kind or its group fields. The group
-- functions below run as their owner, so they pass.
CREATE OR REPLACE FUNCTION public.tg_chat_threads_group_fields_are_the_servers()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.kind IS DISTINCT FROM 'supplier' OR NEW.group_kind IS NOT NULL OR NEW.group_name IS NOT NULL
       OR NEW.group_key IS NOT NULL OR NEW.group_roles IS NOT NULL THEN
      RAISE EXCEPTION 'chat_threads: GROUP_IS_OPENED_BY_SETNAYAN — a group chat is made through its own door'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.kind IS DISTINCT FROM OLD.kind OR NEW.group_kind IS DISTINCT FROM OLD.group_kind
     OR NEW.group_name IS DISTINCT FROM OLD.group_name OR NEW.group_key IS DISTINCT FROM OLD.group_key
     OR NEW.group_roles IS DISTINCT FROM OLD.group_roles THEN
    RAISE EXCEPTION 'chat_threads: GROUP_IS_OPENED_BY_SETNAYAN — a thread''s kind and group fields are not written from a browser'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_chat_threads_group_fields_are_the_servers() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chat_threads_group_fields_are_the_servers ON public.chat_threads;
CREATE TRIGGER chat_threads_group_fields_are_the_servers
  BEFORE INSERT OR UPDATE ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_threads_group_fields_are_the_servers();

-- ── 2 · who is a person of this event, and who is in a group ────────────────
-- 'host' · 'coordinator' · 'supplier' (owner or live team member of a shop
-- with a supplier conversation on this event) · 'guest' (a guest-list account
-- link on this event) · NULL (nobody here). First match wins.
CREATE OR REPLACE FUNCTION public.chat_group_person_kind(p_event_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR p_event_id IS NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.event_members em
                  WHERE em.event_id = p_event_id AND em.user_id = p_user_id
                    AND em.member_type = 'couple') THEN 'host'
    WHEN EXISTS (SELECT 1 FROM public.event_members em
                  WHERE em.event_id = p_event_id AND em.user_id = p_user_id
                    AND em.member_type = 'coordinator') THEN 'coordinator'
    WHEN EXISTS (SELECT 1 FROM public.chat_threads t
                   JOIN public.vendor_profiles vp ON vp.vendor_profile_id = t.vendor_profile_id
                  WHERE t.event_id = p_event_id AND t.kind = 'supplier'
                    AND vp.user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.chat_threads t
                   JOIN public.vendor_team_members tm ON tm.vendor_profile_id = t.vendor_profile_id
                  WHERE t.event_id = p_event_id AND t.kind = 'supplier'
                    AND tm.user_id = p_user_id AND tm.deactivated_at IS NULL) THEN 'supplier'
    WHEN EXISTS (SELECT 1 FROM public.event_members em
                   JOIN public.guests g ON g.guest_id = em.guest_id
                  WHERE em.event_id = p_event_id AND em.user_id = p_user_id
                    AND em.member_type = 'guest'
                    AND g.event_id = p_event_id AND g.deleted_at IS NULL) THEN 'guest'
    ELSE NULL
  END;
$$;
REVOKE ALL ON FUNCTION public.chat_group_person_kind(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- …and the caller's own answer, the only form a browser or an INVOKER body
-- (the sender derivation) may ask: it never answers about anybody else.
CREATE OR REPLACE FUNCTION public.chat_group_my_kind(p_event_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.chat_group_person_kind(p_event_id, auth.uid());
$$;
REVOKE ALL ON FUNCTION public.chat_group_my_kind(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_group_my_kind(UUID) TO authenticated;

-- THE one answer to "who is in this group".
CREATE OR REPLACE FUNCTION public.chat_group_member_ids(p_thread_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (
    SELECT ct.thread_id, ct.event_id, ct.group_kind, ct.group_roles
      FROM public.chat_threads ct
     WHERE ct.thread_id = p_thread_id AND ct.kind = 'group'
  ),
  derived AS (
    -- The hosts, in General and in every role group.
    SELECT em.user_id
      FROM t JOIN public.event_members em
        ON em.event_id = t.event_id AND em.member_type = 'couple'
     WHERE t.group_kind IN ('general', 'role')
    UNION
    -- The guests: attending (General) · holding one of the group's roles.
    SELECT em.user_id
      FROM t
      JOIN public.event_members em ON em.event_id = t.event_id AND em.member_type = 'guest'
      JOIN public.guests g ON g.guest_id = em.guest_id AND g.event_id = t.event_id
     WHERE g.deleted_at IS NULL
       AND (   (t.group_kind = 'general' AND g.rsvp_status = 'attending')
            OR (t.group_kind = 'role' AND (g.role = ANY (t.group_roles)
                                           OR g.extra_roles && t.group_roles)))
  )
  SELECT d.user_id FROM derived d
   WHERE d.user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.chat_thread_members m
                      WHERE m.thread_id = p_thread_id AND m.user_id = d.user_id
                        AND m.left_at IS NOT NULL)
  UNION
  SELECT m.user_id FROM public.chat_thread_members m
    JOIN t ON t.thread_id = m.thread_id
   WHERE m.left_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.chat_group_member_ids(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.chat_group_is_member(p_thread_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.chat_group_member_ids(p_thread_id) x WHERE x = p_user_id);
$$;
REVOKE ALL ON FUNCTION public.chat_group_is_member(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- The caller's own membership — the only form an INVOKER body (the sender
-- derivation) may ask; it never answers about anybody else.
CREATE OR REPLACE FUNCTION public.chat_group_i_am_in(p_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.chat_group_is_member(p_thread_id, auth.uid());
$$;
REVOKE ALL ON FUNCTION public.chat_group_i_am_in(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_group_i_am_in(UUID) TO authenticated;

-- The thread's kind, read past the caller's RLS (a group row is hidden from
-- table reads, and the sender derivation runs as the caller).
CREATE OR REPLACE FUNCTION public.chat_thread_kind(p_thread_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.kind FROM public.chat_threads t WHERE t.thread_id = p_thread_id;
$$;
REVOKE ALL ON FUNCTION public.chat_thread_kind(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_thread_kind(UUID) TO authenticated;

-- The canonical helper (RLS_Policy_Pattern §4), with its group branch.
CREATE OR REPLACE FUNCTION public.current_thread_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- A live membership row: a host in a supplier chat, anyone put in a group.
  SELECT m.thread_id
    FROM public.chat_thread_members m
   WHERE m.user_id = auth.uid()
     AND m.left_at IS NULL
  UNION
  -- A coordinator: every SUPPLIER thread of their event (groups only when added).
  SELECT t.thread_id
    FROM public.chat_threads t
    JOIN public.event_members em ON em.event_id = t.event_id
   WHERE em.user_id = auth.uid()
     AND em.member_type = 'coordinator'
     AND t.kind = 'supplier'
  UNION
  -- General and the role groups: derived from the hosts and the guest list.
  SELECT t.thread_id
    FROM public.chat_threads t
   WHERE t.kind = 'group'
     AND t.group_kind IN ('general', 'role')
     AND t.event_id IN (SELECT em.event_id FROM public.event_members em
                         WHERE em.user_id = auth.uid()
                           AND em.member_type IN ('couple', 'guest'))
     AND public.chat_group_is_member(t.thread_id, auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.current_thread_ids() TO authenticated;

COMMENT ON FUNCTION public.current_thread_ids() IS
  'Chat threads the caller is IN on the people''s side: a live chat_thread_members row (a host in a supplier chat · anyone put in a group), every SUPPLIER thread of an event where the caller is a coordinator, and the General / role groups the caller is derived into (chat_group_member_ids). Excludes the supplier side of supplier chats, which stays vendor_profile-derived. Migrations 20271330575424 · 20271340374819.';

-- ── 5 · money never enters a group · a group line has no supplier ───────────
CREATE OR REPLACE FUNCTION public.tg_chat_messages_group_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT;
BEGIN
  SELECT t.kind INTO v_kind FROM public.chat_threads t WHERE t.thread_id = NEW.thread_id;
  IF v_kind = 'group' THEN
    IF NEW.vendor_profile_id IS NOT NULL THEN
      RAISE EXCEPTION 'chat_messages: GROUP_HAS_NO_SUPPLIER — a group line is not addressed to one supplier'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.proposal_id IS NOT NULL OR NEW.change_order_id IS NOT NULL
       OR NEW.amendment_id IS NOT NULL OR NEW.offered_service_id IS NOT NULL THEN
      RAISE EXCEPTION 'chat_messages: MONEY_NOT_IN_A_GROUP — quotes, payments and forms go in the supplier''s own chat'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.sent_as IS NOT NULL THEN
      RAISE EXCEPTION 'chat_messages: a group line is written as yourself'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.vendor_profile_id IS NULL THEN
    -- The NOT NULL this column had, kept for every supplier conversation.
    RAISE EXCEPTION 'chat_messages: a supplier conversation line names its supplier'
      USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_chat_messages_group_rules() FROM PUBLIC, anon, authenticated;

-- BEFORE INSERT; sorts after chat_messages_derive_sender and before
-- chat_messages_guard_end_user_write / _private_is_between_members.
DROP TRIGGER IF EXISTS chat_messages_group_rules ON public.chat_messages;
CREATE TRIGGER chat_messages_group_rules
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_messages_group_rules();

-- The sender derivation: the shipped body, with a GROUP branch first.
CREATE OR REPLACE FUNCTION public.tg_chat_messages_derive_sender()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid    uuid;
  v_role   public.chat_sender_role;
  v_couple boolean;
  v_vendor boolean;
  v_kind   text;
BEGIN
  -- Service role, the table owner and migrations author 'system' rows, bot
  -- replies and demo seeds with an explicit sender. They are the server; there
  -- is nothing to derive them from and nothing to protect them against.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'chat_messages: no signed-in identity to attribute this message to'
      USING ERRCODE = '42501';
  END IF;

  -- 🆕 A GROUP (20271340374819): a member writes as who they are on the event.
  v_kind := public.chat_thread_kind(NEW.thread_id);
  IF v_kind = 'group' THEN
    IF NEW.sent_as IS NOT NULL THEN
      RAISE EXCEPTION 'chat_messages: a group line is written as yourself'
        USING ERRCODE = '42501';
    END IF;
    IF NOT public.chat_group_i_am_in(NEW.thread_id) THEN
      RAISE EXCEPTION
        'chat_messages: sender is not a party to this conversation'
        USING ERRCODE = '42501';
    END IF;
    v_role := CASE public.chat_group_my_kind(NEW.event_id)
                WHEN 'host'        THEN 'couple'::public.chat_sender_role
                WHEN 'coordinator' THEN 'coordinator'::public.chat_sender_role
                WHEN 'supplier'    THEN 'vendor'::public.chat_sender_role
                WHEN 'guest'       THEN 'guest'::public.chat_sender_role
                ELSE NULL
              END;
    IF v_role IS NULL THEN
      RAISE EXCEPTION
        'chat_messages: sender is not a party to this conversation'
        USING ERRCODE = '42501';
    END IF;
    NEW.sender_role    := v_role;
    NEW.sender_user_id := v_uid;
    RETURN NEW;
  END IF;

  -- A couple member of the event.
  v_couple := NEW.event_id IN (SELECT public.current_couple_event_ids());
  -- The vendor profile's owner, or an owner/admin team member; or vendor-side
  -- staff below admin, on an event their assigned service serves.
  v_vendor := NEW.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
           OR (NEW.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
               AND NEW.event_id IN (SELECT public.agent_customer_event_ids()));

  -- 🆕 THE SCREEN ASKED FOR A SIDE (owner 2026-11-11). Honoured only when held.
  IF NEW.sent_as = 'vendor' THEN
    IF NOT coalesce(v_vendor, false) THEN
      RAISE EXCEPTION
        'chat_messages: sender does not stand on the shop side of this conversation'
        USING ERRCODE = '42501';
    END IF;
    v_role := 'vendor';
  ELSIF NEW.sent_as = 'couple' THEN
    IF NOT coalesce(v_couple, false) THEN
      RAISE EXCEPTION
        'chat_messages: sender is not a host of this event'
        USING ERRCODE = '42501';
    END IF;
    v_role := 'couple';
  ELSIF NEW.sent_as IS NOT NULL THEN
    -- The CHECK constraint refuses this too; said here so the reason is legible.
    RAISE EXCEPTION
      'chat_messages: sent_as must be couple or vendor'
      USING ERRCODE = '42501';
  ELSE
    -- No side asked: the derivation as it was (couple first, matching lib/chat-send.ts).
    SELECT CASE
      WHEN coalesce(v_couple, false) THEN 'couple'::public.chat_sender_role
      WHEN coalesce(v_vendor, false) THEN 'vendor'::public.chat_sender_role
      -- A coordinator / planner of THIS event, in THIS thread (20271333348826).
      WHEN NEW.thread_id IN (SELECT public.current_thread_ids())
       AND EXISTS (SELECT 1 FROM public.event_members em
                    WHERE em.event_id = NEW.event_id
                      AND em.user_id = v_uid
                      AND em.member_type = 'coordinator')
        THEN 'coordinator'::public.chat_sender_role
      ELSE NULL
    END INTO v_role;
  END IF;

  IF v_role IS NULL THEN
    RAISE EXCEPTION
      'chat_messages: sender is not a party to this conversation'
      USING ERRCODE = '42501';
  END IF;

  NEW.sender_role    := v_role;
  NEW.sender_user_id := v_uid;
  RETURN NEW;
END;
$function$;

-- ── 6 · a private line to several people ────────────────────────────────────
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS recipient_user_ids UUID[];

UPDATE public.chat_messages
   SET recipient_user_ids = ARRAY[recipient_user_id]
 WHERE recipient_user_id IS NOT NULL
   AND recipient_user_ids IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.chat_messages'::regclass
                    AND conname = 'chat_messages_recipients_agree') THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_recipients_agree
      CHECK (
        (recipient_user_ids IS NULL AND recipient_user_id IS NULL)
        OR (cardinality(recipient_user_ids) BETWEEN 1 AND 50
            AND recipient_user_id = recipient_user_ids[1]
            AND array_position(recipient_user_ids, NULL) IS NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS chat_messages_recipient_ids_idx
  ON public.chat_messages USING GIN (recipient_user_ids)
  WHERE recipient_user_ids IS NOT NULL;

COMMENT ON COLUMN public.chat_messages.recipient_user_ids IS
  'NULL = everyone in the thread. Set = a PRIVATE line, readable only by its sender, these people and an admin inside an open dispute (policy chat_messages_private_reaches_its_people). Sorted, de-duplicated, never the sender; recipient_user_id is always its first entry (CHECK chat_messages_recipients_agree). Owner 2026-11-12 "PRIVATE MESSAGES — TWO DOORS, SEVERAL PEOPLE", migration 20271340374819.';
COMMENT ON COLUMN public.chat_messages.recipient_user_id IS
  'The FIRST of recipient_user_ids (CHECK chat_messages_recipients_agree) — kept so every "IS NULL = shared" test still means the same thing. NULL = everyone in the thread. ON DELETE CASCADE on purpose — SET NULL would make it public. Migrations 20271329968207 · 20271340374819.';

GRANT INSERT (recipient_user_ids) ON public.chat_messages TO authenticated;

-- The one BEFORE INSERT body for a private line (name kept: it sorts last).
CREATE OR REPLACE FUNCTION public.tg_chat_messages_private_is_between_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list UUID[];
  v_kind TEXT;
  v_who  UUID;
BEGIN
  -- Fold the single column and the list into one sorted, de-duplicated list.
  IF NEW.recipient_user_id IS NULL AND NEW.recipient_user_ids IS NULL THEN
    RETURN NEW;
  END IF;
  v_list := ARRAY(
    SELECT DISTINCT x
      FROM unnest(COALESCE(NEW.recipient_user_ids, '{}'::uuid[])
                  || CASE WHEN NEW.recipient_user_id IS NULL THEN '{}'::uuid[]
                          ELSE ARRAY[NEW.recipient_user_id] END) AS x
     WHERE x IS NOT NULL
     ORDER BY x);
  IF cardinality(v_list) = 0 THEN
    -- An empty list is a line to everyone (the column's documented NULL).
    NEW.recipient_user_id  := NULL;
    NEW.recipient_user_ids := NULL;
    RETURN NEW;
  END IF;
  IF cardinality(v_list) > 50 THEN
    RAISE EXCEPTION 'chat_messages: PRIVATE_TOO_MANY — a private message goes to at most 50 people'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.sender_user_id IS NULL THEN
    RAISE EXCEPTION 'chat_messages: PRIVATE_NEEDS_A_SENDER — a private message is from a person'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.sender_user_id = ANY (v_list) THEN
    RAISE EXCEPTION 'chat_messages: PRIVATE_NOT_TO_SELF — a private message goes to someone else'
      USING ERRCODE = '23514';
  END IF;

  v_kind := (SELECT t.kind FROM public.chat_threads t WHERE t.thread_id = NEW.thread_id);
  FOREACH v_who IN ARRAY v_list LOOP
    IF v_kind = 'group' THEN
      IF NOT public.chat_group_is_member(NEW.thread_id, v_who) THEN
        RAISE EXCEPTION 'chat_messages: PRIVATE_NOT_A_MEMBER — a private message goes to someone in this conversation'
          USING ERRCODE = '42501';
      END IF;
    ELSIF NOT (
         EXISTS (SELECT 1 FROM public.chat_thread_members m
                  WHERE m.thread_id = NEW.thread_id
                    AND m.user_id = v_who
                    AND m.left_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.event_members em
                  WHERE em.event_id = NEW.event_id
                    AND em.user_id = v_who
                    AND em.member_type = 'coordinator')
      OR EXISTS (SELECT 1 FROM public.vendor_profiles vp
                  WHERE vp.vendor_profile_id = NEW.vendor_profile_id
                    AND vp.user_id = v_who)
      OR EXISTS (SELECT 1 FROM public.vendor_team_members tm
                  WHERE tm.vendor_profile_id = NEW.vendor_profile_id
                    AND tm.user_id = v_who
                    AND tm.deactivated_at IS NULL)
    ) THEN
      RAISE EXCEPTION 'chat_messages: PRIVATE_NOT_A_MEMBER — a private message goes to someone in this conversation'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  NEW.recipient_user_ids := v_list;
  NEW.recipient_user_id  := v_list[1];
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_chat_messages_private_is_between_members() FROM PUBLIC, anon, authenticated;

-- ── 7 · the read rule ───────────────────────────────────────────────────────
-- An admin reads a private line ONLY while an open dispute ties this event to
-- this supplier (🛡 guard 2). A group has no supplier, so never there.
CREATE OR REPLACE FUNCTION public.chat_private_in_dispute(p_event_id UUID, p_vendor_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_event_id IS NOT NULL AND p_vendor_profile_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.vendor_disputes d
                   JOIN public.orders o ON o.order_id = d.order_id
                  WHERE d.vendor_profile_id = p_vendor_profile_id
                    AND o.event_id = p_event_id
                    AND d.status = 'open');
$$;
REVOKE ALL ON FUNCTION public.chat_private_in_dispute(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_private_in_dispute(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS chat_messages_private_reaches_two ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_private_reaches_its_people ON public.chat_messages;
CREATE POLICY chat_messages_private_reaches_its_people
  ON public.chat_messages
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    recipient_user_ids IS NULL
    OR sender_user_id = (SELECT auth.uid())
    OR (SELECT auth.uid()) = ANY (recipient_user_ids)
    OR ((SELECT public.is_admin()) AND public.chat_private_in_dispute(event_id, vendor_profile_id))
  );

-- A group member reads the group's hearts (the shipped read branches are the
-- event's hosts and the shop; a guest is neither). Still narrowed by
-- chat_message_hearts_follow_the_message.
DROP POLICY IF EXISTS chat_message_hearts_group_member_read ON public.chat_message_hearts;
CREATE POLICY chat_message_hearts_group_member_read
  ON public.chat_message_hearts FOR SELECT
  TO authenticated
  USING (thread_id IN (SELECT public.current_thread_ids()));

-- ── 8 · the alerts ──────────────────────────────────────────────────────────
-- The tray: one row per recipient, never the words.
CREATE OR REPLACE FUNCTION public.tg_chat_messages_private_tells_its_reader()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from TEXT;
  v_kind TEXT;
  v_who  UUID;
  v_shop_side BOOLEAN;
  v_url TEXT;
BEGIN
  IF NEW.recipient_user_ids IS NULL THEN
    RETURN NEW;
  END IF;
  v_kind := (SELECT t.kind FROM public.chat_threads t WHERE t.thread_id = NEW.thread_id);
  -- Who it is from, in the words the recipient knows them by.
  IF NEW.sender_role = 'vendor' AND NEW.vendor_profile_id IS NOT NULL THEN
    SELECT vp.business_name INTO v_from FROM public.vendor_profiles vp
     WHERE vp.vendor_profile_id = NEW.vendor_profile_id;
  ELSE
    SELECT NULLIF(btrim(COALESCE(u.display_name, u.first_name, '')), '') INTO v_from
      FROM public.users u WHERE u.user_id = NEW.sender_user_id;
  END IF;

  FOREACH v_who IN ARRAY NEW.recipient_user_ids LOOP
    IF v_kind = 'group' THEN
      v_url := '/samahan/chat/' || NEW.thread_id::TEXT;
    ELSE
      v_shop_side := EXISTS (SELECT 1 FROM public.vendor_profiles vp
                              WHERE vp.vendor_profile_id = NEW.vendor_profile_id
                                AND vp.user_id = v_who)
                  OR EXISTS (SELECT 1 FROM public.vendor_team_members tm
                              WHERE tm.vendor_profile_id = NEW.vendor_profile_id
                                AND tm.user_id = v_who
                                AND tm.deactivated_at IS NULL);
      v_url := CASE WHEN v_shop_side
                    THEN '/vendor-dashboard/messages/' || NEW.thread_id::TEXT
                    ELSE '/dashboard/' || NEW.event_id::TEXT || '/messages/' || NEW.thread_id::TEXT END;
    END IF;
    -- The words of the line are NOT copied here: the notice says who and
    -- where; the line itself stays behind chat_messages_private_reaches_its_people.
    INSERT INTO public.notifications (user_id, type, title, body, related_url, event_id)
    VALUES (
      v_who,
      'chat_message'::public.notification_type,
      left(format('Private message from %s', COALESCE(v_from, 'someone in your chat')), 160),
      'Only the people it was sent to can read it. Open the chat to see it.',
      v_url,
      NEW.event_id
    );
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_chat_messages_private_tells_its_reader() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chat_messages_private_tells_its_reader ON public.chat_messages;
CREATE TRIGGER chat_messages_private_tells_its_reader
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  WHEN (NEW.recipient_user_id IS NOT NULL)
  EXECUTE FUNCTION public.tg_chat_messages_private_tells_its_reader();

-- The live ping: a private line reaches its recipients; a shared group line
-- its members; a shared supplier line the shipped set (chat_message_recipient_ids).
CREATE OR REPLACE FUNCTION public.chat_message_reader_ids(
  p_thread_id UUID, p_event_id UUID, p_vendor_profile_id UUID, p_sender UUID, p_recipients UUID[])
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT x FROM unnest(p_recipients) AS x
   WHERE p_recipients IS NOT NULL AND x IS DISTINCT FROM p_sender
  UNION
  SELECT g FROM public.chat_group_member_ids(p_thread_id) AS g
   WHERE p_recipients IS NULL
     AND public.chat_thread_kind(p_thread_id) = 'group'
     AND g IS DISTINCT FROM p_sender
  UNION
  SELECT r FROM public.chat_message_recipient_ids(p_thread_id, p_event_id, p_vendor_profile_id, p_sender, NULL) AS r
   WHERE p_recipients IS NULL
     AND public.chat_thread_kind(p_thread_id) = 'supplier';
$$;
REVOKE ALL ON FUNCTION public.chat_message_reader_ids(UUID, UUID, UUID, UUID, UUID[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.chat_messages_ping_recipients()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- OFF (flag unset in production, or never stamped): one primary-key read, and nothing else.
  IF NOT public.user_live_pings_on() THEN
    RETURN NULL;
  END IF;
  PERFORM public.user_live_send(
    ARRAY(SELECT public.chat_message_reader_ids(
      NEW.thread_id, NEW.event_id, NEW.vendor_profile_id, NEW.sender_user_id, NEW.recipient_user_ids)),
    'chat_message',
    jsonb_build_object('thread_id', NEW.thread_id, 'message_id', NEW.message_id, 'at', NEW.created_at)
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- 🔒 A ping must never cost a message. Whatever went wrong, the INSERT stands; readers fall back to the poll.
  RETURN NULL;
END $function$;

-- The push webhook posts to /api/notify, which pushes the body to the SHOP's
-- devices: shared SUPPLIER lines only. A group line has no shop.
DROP TRIGGER IF EXISTS chat_messages_notify_webhook ON public.chat_messages;
CREATE TRIGGER chat_messages_notify_webhook
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  WHEN (NEW.recipient_user_id IS NULL AND NEW.vendor_profile_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_chat_message_webhook();

-- The unread counters (SECURITY DEFINER: RLS does not reach them) — the
-- shipped bodies (20271336137492) with the recipient LIST.
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
      AND m.sender_user_id IS NOT NULL
      AND m.sender_user_id <> (SELECT auth.uid())
      AND (m.recipient_user_ids IS NULL OR (SELECT auth.uid()) = ANY (m.recipient_user_ids))
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
        AND m.sender_user_id IS NOT NULL
        AND m.sender_user_id <> auth.uid()
        AND (m.recipient_user_ids IS NULL OR auth.uid() = ANY (m.recipient_user_ids))
        AND m.created_at > COALESCE(
          (SELECT r.last_read_at FROM public.chat_thread_reads r
           WHERE r.thread_id = t.thread_id AND r.user_id = auth.uid()),
          'epoch'::timestamptz)
    )
  GROUP BY t.event_id;
$$;

CREATE OR REPLACE FUNCTION public.unread_message_threads_by_vendor()
RETURNS TABLE(vendor_profile_id UUID, unread_count INT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT t.vendor_profile_id, COUNT(*)::int AS unread_count
  FROM public.chat_threads t
  WHERE t.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.thread_id = t.thread_id
        AND m.sender_user_id IS NOT NULL
        AND m.sender_user_id <> auth.uid()
        AND (m.recipient_user_ids IS NULL OR auth.uid() = ANY (m.recipient_user_ids))
        AND m.created_at > COALESCE(
          (SELECT r.last_read_at FROM public.chat_thread_reads r
           WHERE r.thread_id = t.thread_id AND r.user_id = auth.uid()),
          'epoch'::timestamptz)
    )
  GROUP BY t.vendor_profile_id;
$$;

-- A group never seats "the opener" the supplier-chat way: its people are
-- derived (General · role) or written by chat_group_create.
DROP TRIGGER IF EXISTS chat_threads_seat_the_opener ON public.chat_threads;
CREATE TRIGGER chat_threads_seat_the_opener
  AFTER INSERT ON public.chat_threads
  FOR EACH ROW
  WHEN (NEW.kind = 'supplier')
  EXECUTE FUNCTION public.tg_chat_threads_seat_the_opener();

-- ── 4 · the group functions ─────────────────────────────────────────────────
-- A system line in a group ("Ana made the group", "Lea added Marco").
CREATE OR REPLACE FUNCTION public.chat_group_post_line(p_thread_id UUID, p_body TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event UUID;
BEGIN
  SELECT t.event_id INTO v_event FROM public.chat_threads t
   WHERE t.thread_id = p_thread_id AND t.kind = 'group';
  IF v_event IS NULL OR NULLIF(btrim(p_body), '') IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body)
  VALUES (p_thread_id, v_event, NULL, NULL, 'system', left(btrim(p_body), 4000));
END;
$$;
REVOKE ALL ON FUNCTION public.chat_group_post_line(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- General: hosts and coordinators open it (idempotent). Returns its thread.
CREATE OR REPLACE FUNCTION public.chat_group_open(p_event_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_thread UUID;
BEGIN
  IF public.chat_group_person_kind(p_event_id, v_uid) NOT IN ('host', 'coordinator')
     OR public.chat_group_person_kind(p_event_id, v_uid) IS NULL THEN
    RAISE EXCEPTION 'chat_group_open: only the hosts and the coordinator open the event''s groups'
      USING ERRCODE = '42501';
  END IF;
  SELECT t.thread_id INTO v_thread FROM public.chat_threads t
   WHERE t.event_id = p_event_id AND t.kind = 'group' AND t.group_kind = 'general';
  IF v_thread IS NULL THEN
    INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, kind, group_kind, group_name)
    VALUES (p_event_id, NULL, v_uid, 'group', 'general', 'General')
    ON CONFLICT DO NOTHING
    RETURNING thread_id INTO v_thread;
    IF v_thread IS NULL THEN
      SELECT t.thread_id INTO v_thread FROM public.chat_threads t
       WHERE t.event_id = p_event_id AND t.kind = 'group' AND t.group_kind = 'general';
    END IF;
  END IF;
  RETURN v_thread;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_group_open(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_group_open(UUID) TO authenticated;

-- A role group ("Principal sponsors" = the guests holding these roles).
-- The app names the group and its roles from lib/role-groups.ts (the one
-- role → group map); idempotent per (event, key).
CREATE OR REPLACE FUNCTION public.chat_group_open_role(
  p_event_id UUID, p_key TEXT, p_name TEXT, p_roles public.guest_role[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_thread UUID;
  v_key    TEXT := NULLIF(btrim(COALESCE(p_key, '')), '');
BEGIN
  IF COALESCE(public.chat_group_person_kind(p_event_id, v_uid), '') NOT IN ('host', 'coordinator') THEN
    RAISE EXCEPTION 'chat_group_open_role: only the hosts and the coordinator open the event''s groups'
      USING ERRCODE = '42501';
  END IF;
  IF v_key IS NULL OR v_key !~ '^[a-z_]{1,40}$' OR COALESCE(cardinality(p_roles), 0) = 0 THEN
    RAISE EXCEPTION 'chat_group_open_role: a role group needs a key and at least one role'
      USING ERRCODE = '22023';
  END IF;
  SELECT t.thread_id INTO v_thread FROM public.chat_threads t
   WHERE t.event_id = p_event_id AND t.kind = 'group' AND t.group_kind = 'role' AND t.group_key = v_key;
  IF v_thread IS NULL THEN
    INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, kind, group_kind, group_name, group_key, group_roles)
    VALUES (p_event_id, NULL, v_uid, 'group', 'role', left(btrim(p_name), 60), v_key, p_roles)
    ON CONFLICT DO NOTHING
    RETURNING thread_id INTO v_thread;
    IF v_thread IS NULL THEN
      SELECT t.thread_id INTO v_thread FROM public.chat_threads t
       WHERE t.event_id = p_event_id AND t.kind = 'group' AND t.group_kind = 'role' AND t.group_key = v_key;
    END IF;
  END IF;
  RETURN v_thread;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_group_open_role(UUID, TEXT, TEXT, public.guest_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_group_open_role(UUID, TEXT, TEXT, public.guest_role[]) TO authenticated;

-- "+ New group" — hosts only. The people: hosts · the coordinator · guests ·
-- the event's suppliers (owner 12 Nov: a host-made group may hold suppliers
-- and guests).
CREATE OR REPLACE FUNCTION public.chat_group_create(p_event_id UUID, p_name TEXT, p_people UUID[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_thread UUID;
  v_name   TEXT := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_who    UUID;
  v_names  TEXT[] := '{}';
BEGIN
  IF public.chat_group_person_kind(p_event_id, v_uid) IS DISTINCT FROM 'host' THEN
    RAISE EXCEPTION 'chat_group_create: only a host makes a group'
      USING ERRCODE = '42501';
  END IF;
  IF v_name IS NULL OR char_length(v_name) > 60 THEN
    RAISE EXCEPTION 'chat_group_create: a group needs a name (60 characters at most)'
      USING ERRCODE = '22023';
  END IF;
  FOREACH v_who IN ARRAY COALESCE(p_people, '{}'::uuid[]) LOOP
    IF public.chat_group_person_kind(p_event_id, v_who) IS NULL THEN
      RAISE EXCEPTION 'chat_group_create: GROUP_NOT_A_PERSON_HERE — everyone in a group is someone on this event'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, kind, group_kind, group_name)
  VALUES (p_event_id, NULL, v_uid, 'group', 'made', v_name)
  RETURNING thread_id INTO v_thread;

  INSERT INTO public.chat_thread_members (thread_id, user_id, added_by_user_id)
  SELECT v_thread, x, CASE WHEN x = v_uid THEN NULL ELSE v_uid END
    FROM (SELECT DISTINCT unnest(COALESCE(p_people, '{}'::uuid[]) || ARRAY[v_uid]) AS x) s
   WHERE x IS NOT NULL
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  SELECT COALESCE(array_agg(public.chat_member_first_name(x) ORDER BY public.chat_member_first_name(x)), '{}')
    INTO v_names
    FROM (SELECT DISTINCT unnest(COALESCE(p_people, '{}'::uuid[])) AS x) s
   WHERE x IS NOT NULL AND x <> v_uid;
  PERFORM public.chat_group_post_line(v_thread,
    public.chat_member_first_name(v_uid) || ' made the group'
    || CASE WHEN cardinality(v_names) > 0 THEN ' · ' || array_to_string(v_names, ', ') ELSE '' END);
  RETURN v_thread;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_group_create(UUID, TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_group_create(UUID, TEXT, UUID[]) TO authenticated;

-- (＋) on the strip — hosts and the coordinator who are in the group add; a
-- host who left may come back by themselves. General never takes a supplier.
-- Returns 'added' · 'rejoined' · 'already' · 'not_allowed' · 'not_found' ·
-- 'not_a_person_here' · 'no_suppliers_in_general' · 'unauthenticated'.
CREATE OR REPLACE FUNCTION public.chat_group_add(p_thread_id UUID, p_people UUID[])
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_event UUID;
  v_gkind TEXT;
  v_me    TEXT;
  v_who   UUID;
  v_kind  TEXT;
  v_self  BOOLEAN;
  v_new   TEXT[] := '{}';
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'unauthenticated';
  END IF;
  SELECT t.event_id, t.group_kind INTO v_event, v_gkind
    FROM public.chat_threads t WHERE t.thread_id = p_thread_id AND t.kind = 'group';
  IF v_event IS NULL THEN
    RETURN 'not_found';
  END IF;
  v_me := public.chat_group_person_kind(v_event, v_uid);

  -- A host who left, coming back by themselves.
  v_self := COALESCE(p_people, '{}'::uuid[]) = ARRAY[v_uid]
        AND v_me = 'host'
        AND EXISTS (SELECT 1 FROM public.chat_thread_members m
                     WHERE m.thread_id = p_thread_id AND m.user_id = v_uid AND m.left_at IS NOT NULL);
  IF v_self THEN
    UPDATE public.chat_thread_members
       SET left_at = NULL, left_note = NULL, joined_at = NOW()
     WHERE thread_id = p_thread_id AND user_id = v_uid;
    PERFORM public.chat_group_post_line(p_thread_id, public.chat_member_first_name(v_uid) || ' joined');
    RETURN 'rejoined';
  END IF;

  IF COALESCE(v_me, '') NOT IN ('host', 'coordinator')
     OR NOT public.chat_group_is_member(p_thread_id, v_uid) THEN
    RETURN 'not_allowed';
  END IF;

  FOREACH v_who IN ARRAY COALESCE(p_people, '{}'::uuid[]) LOOP
    v_kind := public.chat_group_person_kind(v_event, v_who);
    IF v_kind IS NULL THEN
      RETURN 'not_a_person_here';
    END IF;
    IF v_gkind = 'general' AND v_kind = 'supplier' THEN
      RETURN 'no_suppliers_in_general';
    END IF;
  END LOOP;

  FOREACH v_who IN ARRAY COALESCE(p_people, '{}'::uuid[]) LOOP
    CONTINUE WHEN v_who IS NULL OR public.chat_group_is_member(p_thread_id, v_who);
    INSERT INTO public.chat_thread_members (thread_id, user_id, added_by_user_id)
    VALUES (p_thread_id, v_who, v_uid)
    ON CONFLICT (thread_id, user_id) DO UPDATE
      SET left_at = NULL, left_note = NULL, joined_at = NOW(), added_by_user_id = v_uid;
    v_new := v_new || public.chat_member_first_name(v_who);
  END LOOP;
  IF cardinality(v_new) = 0 THEN
    RETURN 'already';
  END IF;
  PERFORM public.chat_group_post_line(p_thread_id,
    public.chat_member_first_name(v_uid) || ' added ' || array_to_string(v_new, ', '));
  RETURN 'added';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_group_add(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_group_add(UUID, UUID[]) TO authenticated;

-- Own face → Leave. Hosts only (a supplier, a coordinator and a guest stay).
-- Returns 'left' · 'cannot_leave' · 'not_a_member' · 'not_found' · 'unauthenticated'.
CREATE OR REPLACE FUNCTION public.chat_group_leave(p_thread_id UUID, p_note TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_event UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'unauthenticated';
  END IF;
  SELECT t.event_id INTO v_event FROM public.chat_threads t
   WHERE t.thread_id = p_thread_id AND t.kind = 'group';
  IF v_event IS NULL THEN
    RETURN 'not_found';
  END IF;
  IF NOT public.chat_group_is_member(p_thread_id, v_uid) THEN
    RETURN 'not_a_member';
  END IF;
  IF public.chat_group_person_kind(v_event, v_uid) IS DISTINCT FROM 'host' THEN
    RETURN 'cannot_leave';
  END IF;
  PERFORM public.chat_group_post_line(p_thread_id, public.chat_member_first_name(v_uid) || ' left this chat');
  INSERT INTO public.chat_thread_members (thread_id, user_id, left_at, left_note)
  VALUES (p_thread_id, v_uid, clock_timestamp(), NULLIF(left(btrim(COALESCE(p_note, '')), 200), ''))
  ON CONFLICT (thread_id, user_id) DO UPDATE
    SET left_at = clock_timestamp(),
        left_note = NULLIF(left(btrim(COALESCE(p_note, '')), 200), '');
  RETURN 'left';
END;
$$;
REVOKE ALL ON FUNCTION public.chat_group_leave(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_group_leave(UUID, TEXT) TO authenticated;

-- The Chats list's Groups section: the groups the caller is in, plus the ones
-- they left (greyed, no words). The last line is one the CALLER may read — a
-- private line between other people never becomes someone's preview.
CREATE OR REPLACE FUNCTION public.chat_group_list(p_event_id UUID)
RETURNS TABLE (
  thread_id UUID, group_kind TEXT, group_name TEXT, group_key TEXT,
  made_by_name TEXT, member_count INT, left_at TIMESTAMPTZ,
  last_body TEXT, last_at TIMESTAMPTZ, last_sender_name TEXT, last_is_private BOOLEAN,
  unread BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH mine AS (
    SELECT t.*,
           public.chat_group_is_member(t.thread_id, auth.uid()) AS is_in,
           (SELECT m.left_at FROM public.chat_thread_members m
             WHERE m.thread_id = t.thread_id AND m.user_id = auth.uid()) AS my_left_at
      FROM public.chat_threads t
     WHERE t.event_id = p_event_id AND t.kind = 'group' AND auth.uid() IS NOT NULL
  )
  SELECT g.thread_id, g.group_kind, g.group_name, g.group_key,
         CASE WHEN g.group_kind = 'made' THEN public.chat_member_first_name(g.created_by_user_id) END,
         (SELECT COUNT(*)::int FROM public.chat_group_member_ids(g.thread_id)),
         CASE WHEN g.is_in THEN NULL ELSE g.my_left_at END,
         CASE WHEN g.is_in THEN lm.body END,
         CASE WHEN g.is_in THEN lm.created_at END,
         CASE WHEN g.is_in AND lm.sender_user_id IS NOT NULL
              THEN CASE WHEN lm.sender_user_id = auth.uid() THEN 'You' ELSE public.chat_member_first_name(lm.sender_user_id) END END,
         CASE WHEN g.is_in THEN lm.recipient_user_ids IS NOT NULL END,
         g.is_in AND lm.sender_user_id IS NOT NULL AND lm.sender_user_id <> auth.uid()
           AND lm.created_at > COALESCE((SELECT r.last_read_at FROM public.chat_thread_reads r
                                          WHERE r.thread_id = g.thread_id AND r.user_id = auth.uid()),
                                        'epoch'::timestamptz)
    FROM mine g
    LEFT JOIN LATERAL (
      SELECT m.body, m.created_at, m.sender_user_id, m.recipient_user_ids
        FROM public.chat_messages m
       WHERE m.thread_id = g.thread_id
         AND (m.recipient_user_ids IS NULL
              OR m.sender_user_id = auth.uid()
              OR auth.uid() = ANY (m.recipient_user_ids))
         AND (g.my_left_at IS NULL OR g.is_in OR m.created_at <= g.my_left_at)
       ORDER BY m.created_at DESC
       LIMIT 1
    ) lm ON TRUE
   WHERE g.is_in OR g.my_left_at IS NOT NULL
   ORDER BY (g.group_kind = 'general') DESC, (g.group_kind = 'role') DESC,
            COALESCE(lm.created_at, g.created_at) DESC;
$$;
REVOKE ALL ON FUNCTION public.chat_group_list(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_group_list(UUID) TO authenticated;

-- One group's head, for a member (or a host who left it, to offer "Join again").
CREATE OR REPLACE FUNCTION public.chat_group_head(p_thread_id UUID)
RETURNS TABLE (
  thread_id UUID, event_id UUID, group_kind TEXT, group_name TEXT,
  made_by_name TEXT, member_count INT, my_kind TEXT, is_member BOOLEAN,
  left_at TIMESTAMPTZ, left_note TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.thread_id, t.event_id, t.group_kind, t.group_name,
         CASE WHEN t.group_kind = 'made' THEN public.chat_member_first_name(t.created_by_user_id) END,
         (SELECT COUNT(*)::int FROM public.chat_group_member_ids(t.thread_id)),
         public.chat_group_person_kind(t.event_id, auth.uid()),
         public.chat_group_is_member(t.thread_id, auth.uid()),
         m.left_at, m.left_note
    FROM public.chat_threads t
    LEFT JOIN public.chat_thread_members m
           ON m.thread_id = t.thread_id AND m.user_id = auth.uid()
   WHERE t.thread_id = p_thread_id
     AND t.kind = 'group'
     AND auth.uid() IS NOT NULL
     AND (public.chat_group_is_member(t.thread_id, auth.uid()) OR m.left_at IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.chat_group_head(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_group_head(UUID) TO authenticated;

-- "Who is on" for a group — the shape thread_chat_hosts returns, plus the
-- person's kind (host · coordinator · supplier · guest) and, for a supplier,
-- their shop. Members only.
CREATE OR REPLACE FUNCTION public.chat_group_members(p_thread_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (
    SELECT ct.thread_id, ct.event_id FROM public.chat_threads ct
     WHERE ct.thread_id = p_thread_id AND ct.kind = 'group'
       AND public.chat_group_is_member(ct.thread_id, auth.uid())
  ),
  people AS (
    SELECT x AS user_id, t.event_id,
           public.chat_group_person_kind(t.event_id, x) AS kind
      FROM t, public.chat_group_member_ids(t.thread_id) AS x
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'user_id',    u.user_id,
           'first_name', COALESCE(NULLIF(btrim(u.first_name), ''),
                                  NULLIF(split_part(btrim(COALESCE(u.display_name, '')), ' ', 1), '')),
           'name',       COALESCE(NULLIF(btrim(u.display_name), ''),
                                  NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), '')),
           'role',       mo.role_subtype,
           'label',      mo.display_label,
           'kind',       p.kind,
           'shop',       (SELECT vp.business_name
                            FROM public.chat_threads st
                            JOIN public.vendor_profiles vp ON vp.vendor_profile_id = st.vendor_profile_id
                           WHERE p.kind = 'supplier' AND st.event_id = p.event_id AND st.kind = 'supplier'
                             AND (vp.user_id = p.user_id
                                  OR EXISTS (SELECT 1 FROM public.vendor_team_members tm
                                              WHERE tm.vendor_profile_id = vp.vendor_profile_id
                                                AND tm.user_id = p.user_id AND tm.deactivated_at IS NULL))
                           ORDER BY st.created_at LIMIT 1)
         ) ORDER BY CASE p.kind WHEN 'host' THEN 0 WHEN 'coordinator' THEN 1 WHEN 'supplier' THEN 2 ELSE 3 END,
                    u.first_name NULLS LAST, u.user_id), '[]'::jsonb)
    FROM people p
    JOIN public.users u ON u.user_id = p.user_id
    LEFT JOIN public.event_moderators mo
           ON mo.event_id = p.event_id AND mo.user_id = p.user_id
          AND mo.removed_at IS NULL AND mo.accepted_at IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.chat_group_members(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_group_members(UUID) TO authenticated;

-- The event's people a host or the coordinator may put in a group ("+ New
-- group" and the strip's ＋): the hosts, the coordinators, the guests with an
-- account, the owners and team of the event's suppliers. Hosts and
-- coordinators of the event only; anyone else is told nobody.
CREATE OR REPLACE FUNCTION public.chat_group_people(p_event_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ok AS (
    SELECT 1 WHERE COALESCE(public.chat_group_person_kind(p_event_id, auth.uid()), '') IN ('host', 'coordinator')
  ),
  ids AS (
    SELECT em.user_id FROM public.event_members em, ok
     WHERE em.event_id = p_event_id AND em.member_type IN ('couple', 'coordinator', 'guest')
    UNION
    SELECT vp.user_id FROM public.chat_threads t
      JOIN public.vendor_profiles vp ON vp.vendor_profile_id = t.vendor_profile_id, ok
     WHERE t.event_id = p_event_id AND t.kind = 'supplier' AND vp.user_id IS NOT NULL
    UNION
    SELECT tm.user_id FROM public.chat_threads t
      JOIN public.vendor_team_members tm ON tm.vendor_profile_id = t.vendor_profile_id, ok
     WHERE t.event_id = p_event_id AND t.kind = 'supplier' AND tm.deactivated_at IS NULL
  ),
  people AS (
    SELECT i.user_id, public.chat_group_person_kind(p_event_id, i.user_id) AS kind FROM ids i
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'user_id',    u.user_id,
           'first_name', COALESCE(NULLIF(btrim(u.first_name), ''),
                                  NULLIF(split_part(btrim(COALESCE(u.display_name, '')), ' ', 1), '')),
           'name',       COALESCE(NULLIF(btrim(u.display_name), ''),
                                  NULLIF(btrim(concat_ws(' ', u.first_name, u.last_name)), '')),
           'kind',       p.kind
         ) ORDER BY CASE p.kind WHEN 'host' THEN 0 WHEN 'coordinator' THEN 1 WHEN 'supplier' THEN 2 ELSE 3 END,
                    u.first_name NULLS LAST, u.user_id), '[]'::jsonb)
    FROM people p
    JOIN public.users u ON u.user_id = p.user_id
   WHERE p.kind IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.chat_group_people(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_group_people(UUID) TO authenticated;

-- The supplier-chat doors refuse a group (a supplier row in a made group must
-- not leave through chat_thread_leave). The shipped bodies, one predicate each.
CREATE OR REPLACE FUNCTION public.chat_thread_add_host(p_thread_id uuid, p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid    UUID := auth.uid();
  v_event  UUID;
  v_shop   UUID;
  v_left   TIMESTAMPTZ;
  v_found  BOOLEAN;
  v_self   BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'unauthenticated';
  END IF;
  SELECT t.event_id, t.vendor_profile_id INTO v_event, v_shop
    FROM public.chat_threads t WHERE t.thread_id = p_thread_id AND t.kind = 'supplier';  -- a group has its own door (chat_group_add · chat_group_leave)
  IF v_event IS NULL THEN
    RETURN 'not_found';
  END IF;
  SELECT TRUE, m.left_at INTO v_found, v_left
    FROM public.chat_thread_members m
   WHERE m.thread_id = p_thread_id AND m.user_id = p_user_id
   FOR UPDATE;

  -- Rejoining yourself: only a host who was in this thread and left.
  v_self := (p_user_id = v_uid) AND COALESCE(v_found, FALSE) AND v_left IS NOT NULL;

  -- Anyone else: only someone IN the thread on the hosts' side (a live host
  -- or the event's coordinator). The supplier is never in current_thread_ids().
  IF NOT v_self AND p_thread_id NOT IN (SELECT public.current_thread_ids()) THEN
    RETURN 'not_allowed';
  END IF;
  IF p_user_id IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.event_members em
         JOIN public.users u ON u.user_id = em.user_id
        WHERE em.event_id = v_event AND em.user_id = p_user_id AND em.member_type = 'couple') THEN
    RETURN 'not_a_host';
  END IF;
  IF v_found AND v_left IS NULL THEN
    RETURN 'already';
  END IF;

  IF v_found THEN
    UPDATE public.chat_thread_members
       SET left_at = NULL, left_note = NULL, joined_at = NOW(),
           added_by_user_id = CASE WHEN v_self THEN added_by_user_id ELSE v_uid END
     WHERE thread_id = p_thread_id AND user_id = p_user_id;
  ELSE
    INSERT INTO public.chat_thread_members (thread_id, user_id, added_by_user_id)
    VALUES (p_thread_id, p_user_id, v_uid);
  END IF;

  IF v_self THEN
    PERFORM public.chat_record_post_line(v_event, v_shop,
      public.chat_member_first_name(v_uid) || ' joined',
      'A host joined');
    RETURN 'rejoined';
  END IF;
  PERFORM public.chat_record_post_line(v_event, v_shop,
    public.chat_member_first_name(p_user_id) || ' was added to this chat by '
      || public.chat_member_first_name(v_uid),
    'A host was added to this chat');
  RETURN 'added';
END;
$function$;

CREATE OR REPLACE FUNCTION public.chat_thread_leave(p_thread_id uuid, p_note text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid   UUID := auth.uid();
  v_event UUID;
  v_shop  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'unauthenticated';
  END IF;
  SELECT t.event_id, t.vendor_profile_id INTO v_event, v_shop
    FROM public.chat_threads t WHERE t.thread_id = p_thread_id AND t.kind = 'supplier';  -- a group has its own door (chat_group_add · chat_group_leave)
  IF v_event IS NULL THEN
    RETURN 'not_found';
  END IF;

  PERFORM 1 FROM public.chat_thread_members m
   WHERE m.thread_id = p_thread_id AND m.user_id = v_uid AND m.left_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    -- A coordinator or the supplier is in the thread without a row: they
    -- cannot leave. Anyone else was never in it (or already left).
    IF p_thread_id IN (SELECT public.current_thread_ids())
       OR v_shop IN (SELECT public.current_vendor_profile_ids())
       OR v_shop IN (SELECT public.current_vendor_ids('viewer')) THEN
      RETURN 'cannot_leave';
    END IF;
    RETURN 'not_a_member';
  END IF;

  IF NOT EXISTS (
       SELECT 1 FROM public.chat_thread_members m
        WHERE m.thread_id = p_thread_id AND m.left_at IS NULL AND m.user_id <> v_uid) THEN
    RETURN 'last_host';
  END IF;

  PERFORM public.chat_record_post_line(v_event, v_shop,
    public.chat_member_first_name(v_uid) || ' left this chat',
    'A host left this chat');
  UPDATE public.chat_thread_members
     SET left_at   = clock_timestamp(),
         left_note = NULLIF(left(btrim(COALESCE(p_note, '')), 200), '')
   WHERE thread_id = p_thread_id AND user_id = v_uid;
  RETURN 'left';
END;
$function$;


COMMIT;
