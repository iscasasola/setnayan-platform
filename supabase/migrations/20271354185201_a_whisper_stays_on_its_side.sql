-- a_whisper_stays_on_its_side
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
-- NOT applied anywhere by this PR — the pipeline pushes it.

-- ════════════════════════════════════════════════════════════════════════════
-- A WHISPER STAYS ON ITS SIDE — Unichat part E (whisper sides).
--
-- Owner, 19 Nov: "supplier whispers to co suppliers on the chat. and
-- coordinators and hosts do not see it." ("Own shop team".)
-- Owner, 20 Nov: "host and coordinator can whisper to each other."
--
-- A supplier chat now has TWO whisper sides:
--   hosts — the hosts seated in this chat AND the event's coordinators. Never
--           anyone on the shop's side.
--   team  — the shop's own people: its owner and its live (not deactivated)
--           team members. Never a host or a coordinator.
--
-- Until now a whisper was only inferred ("a private line to exactly the
-- co-hosts"), so the label could drop off an old whisper the day the host list
-- changed. Ruling (19 Nov, safety review): "the whisper label must be stored
-- with the message so it never drops off." So the side is a column.
--
-- ── WHAT THIS FILE DOES ─────────────────────────────────────────────────────
--   1 · chat_messages.whisper_side TEXT ('hosts' | 'team'), NULL = not a
--       whisper. CHECK: a whisper is always a private line (it has its people).
--       INSERT granted to authenticated (per-column grants since 20271132839561).
--       No UPDATE grant: a line never changes side.
--   2 · chat_whisper_side_of(thread, user) — which side of THIS supplier chat a
--       person is on NOW: 'team' (the shop's owner, or a team member with
--       deactivated_at IS NULL), else 'hosts' (a HELD host seat —
--       chat_seat_is_held, the F1 rule — or a coordinator of the event), else
--       NULL. The shop wins: one login that hosts AND is on the shop's team is
--       the supplier here (the app's rule, lib/chat-whisper.ts). Answers about
--       anyone, so no grant to end users.
--   3 · chat_whisper_my_side(thread) — the same, for auth.uid() only. Granted to
--       authenticated (the read policy calls it as the caller).
--   4 · BEFORE INSERT tg_chat_messages_whisper_stays_on_its_side — a whisper is
--       a SUPPLIER chat line whose sender AND every recipient are on its side
--       now. Named to sort after chat_messages_private_is_between_members (it
--       reads the list that trigger folded) and chat_messages_derive_sender.
--   5 · RESTRICTIVE SELECT chat_messages_whisper_stays_on_its_side — a whisper
--       reads only to someone on its side NOW (or an admin inside an open
--       dispute — the private line's own arm, chat_private_in_dispute). This
--       sits ON TOP of chat_messages_private_reaches_its_people (sender or
--       recipient) and the permissive member read, so it can only narrow.
--
-- ── F1 STAYS CLOSED (a removed member reads nothing) ────────────────────────
--   · a removed co-host: no held seat → not 'hosts' → reads no hosts' whisper
--     (and current_thread_ids() already reads them nothing);
--   · a removed coordinator: no event_members row → not 'hosts';
--   · a deactivated or removed team member: not 'team' → reads no team whisper.
--     ⚠ This is NARROWER than the shop's permissive read, which still admits a
--     deactivated admin through current_vendor_ids() (it never looks at
--     deactivated_at). That wider gap on SHARED lines is pre-existing and not
--     changed here — flagged in the PR for an owner call.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · the side, stored with the line ──────────────────────────────────────
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS whisper_side TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.chat_messages'::regclass
                    AND conname = 'chat_messages_whisper_side_is_known') THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_whisper_side_is_known
      CHECK (whisper_side IS NULL OR whisper_side IN ('hosts', 'team'));
  END IF;
  -- A whisper with nobody to hear it would be a line to EVERYONE — never.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.chat_messages'::regclass
                    AND conname = 'chat_messages_a_whisper_has_its_people') THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_a_whisper_has_its_people
      CHECK (whisper_side IS NULL OR recipient_user_id IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN public.chat_messages.whisper_side IS
  'NULL = not a whisper. hosts = a whisper on the hosts'' side of a supplier chat (the hosts seated in it + the event''s coordinators; never the shop). team = a whisper among the shop''s own people (owner + live team members; never a host or coordinator). Always a private line (CHECK chat_messages_a_whisper_has_its_people); sender and every recipient must be on the side (tg_chat_messages_whisper_stays_on_its_side); read only by someone on the side NOW (RESTRICTIVE chat_messages_whisper_stays_on_its_side). Owner 2026-11-19 / 2026-11-20, migration 20271354185201.';

GRANT INSERT (whisper_side) ON public.chat_messages TO authenticated;

-- ── 2 · which side a person is on, now ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_whisper_side_of(p_thread_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR t.thread_id IS NULL OR t.kind <> 'supplier' THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.vendor_profiles vp
                  WHERE vp.vendor_profile_id = t.vendor_profile_id
                    AND vp.user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.vendor_team_members tm
                  WHERE tm.vendor_profile_id = t.vendor_profile_id
                    AND tm.user_id = p_user_id
                    AND tm.deactivated_at IS NULL)
      THEN 'team'
    WHEN EXISTS (SELECT 1 FROM public.chat_thread_members m
                  WHERE m.thread_id = t.thread_id
                    AND m.user_id = p_user_id
                    AND m.left_at IS NULL
                    AND public.chat_seat_is_held(m.thread_id, m.user_id))
      OR EXISTS (SELECT 1 FROM public.event_members em
                  WHERE em.event_id = t.event_id
                    AND em.user_id = p_user_id
                    AND em.member_type = 'coordinator')
      THEN 'hosts'
    ELSE NULL
  END
  FROM (SELECT p_thread_id AS want) w
  LEFT JOIN public.chat_threads t ON t.thread_id = w.want;
$$;
REVOKE ALL ON FUNCTION public.chat_whisper_side_of(UUID, UUID) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.chat_whisper_side_of(UUID, UUID) IS
  'Which whisper side of a SUPPLIER chat a person is on now: team (the shop''s owner or a live team member — the shop wins for a login that is both) · hosts (a held host seat, chat_seat_is_held, or a coordinator of the event) · NULL. Answers about anyone, so no grant to end users. Migration 20271354185201.';

-- ── 3 · …for the caller only ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_whisper_my_side(p_thread_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.chat_whisper_side_of(p_thread_id, auth.uid());
$$;
REVOKE ALL ON FUNCTION public.chat_whisper_my_side(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_whisper_my_side(UUID) TO authenticated;

COMMENT ON FUNCTION public.chat_whisper_my_side(UUID) IS
  'chat_whisper_side_of(thread, auth.uid()) — the caller''s own whisper side of a supplier chat, for the RESTRICTIVE read chat_messages_whisper_stays_on_its_side. Migration 20271354185201.';

-- ── 4 · the write: sender and every recipient on the side ───────────────────
CREATE OR REPLACE FUNCTION public.tg_chat_messages_whisper_stays_on_its_side()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list UUID[];
  v_who  UUID;
BEGIN
  IF NEW.whisper_side IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.chat_thread_kind(NEW.thread_id) IS DISTINCT FROM 'supplier' THEN
    RAISE EXCEPTION 'chat_messages: WHISPER_SUPPLIER_CHAT_ONLY — a whisper is a line inside a supplier chat'
      USING ERRCODE = '23514';
  END IF;
  -- The list chat_messages_private_is_between_members already folded and checked.
  v_list := COALESCE(NEW.recipient_user_ids,
                     CASE WHEN NEW.recipient_user_id IS NULL THEN NULL ELSE ARRAY[NEW.recipient_user_id] END);
  IF v_list IS NULL OR cardinality(v_list) = 0 THEN
    RAISE EXCEPTION 'chat_messages: WHISPER_NEEDS_ITS_PEOPLE — a whisper with nobody to hear it is not sent'
      USING ERRCODE = '23514';
  END IF;
  IF public.chat_whisper_side_of(NEW.thread_id, NEW.sender_user_id) IS DISTINCT FROM NEW.whisper_side THEN
    RAISE EXCEPTION 'chat_messages: WHISPER_NOT_YOUR_SIDE — you can only whisper on your own side of the chat'
      USING ERRCODE = '42501';
  END IF;
  FOREACH v_who IN ARRAY v_list LOOP
    IF public.chat_whisper_side_of(NEW.thread_id, v_who) IS DISTINCT FROM NEW.whisper_side THEN
      RAISE EXCEPTION 'chat_messages: WHISPER_CROSSES_SIDES — a whisper reaches only people on its own side'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_chat_messages_whisper_stays_on_its_side() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chat_messages_whisper_stays_on_its_side ON public.chat_messages;
CREATE TRIGGER chat_messages_whisper_stays_on_its_side
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW
  WHEN (NEW.whisper_side IS NOT NULL)
  EXECUTE FUNCTION public.tg_chat_messages_whisper_stays_on_its_side();

-- ── 5 · the read: only someone on its side, now ─────────────────────────────
DROP POLICY IF EXISTS chat_messages_whisper_stays_on_its_side ON public.chat_messages;
CREATE POLICY chat_messages_whisper_stays_on_its_side
  ON public.chat_messages
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    whisper_side IS NULL
    OR public.chat_whisper_my_side(thread_id) = whisper_side
    OR ((SELECT public.is_admin()) AND public.chat_private_in_dispute(event_id, vendor_profile_id))
  );

COMMIT;
