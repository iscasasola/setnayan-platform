-- ════════════════════════════════════════════════════════════════════════════
-- THE SHELL A MESSAGE IS SENT FROM DECIDES WHICH SIDE IT SPEAKS FOR
-- (owner, 11 Nov 2026 — live fault, with a screenshot)
-- ════════════════════════════════════════════════════════════════════════════
--
-- ── WHAT HAPPENED ────────────────────────────────────────────────────────────
-- The owner's one login owns a shop ("SetnaProd") AND hosts a test event. He
-- opened the shop's picked client, typed "Hello" FROM THE SHOP, and the bubble
-- came back as "Indalecio · IC" — his personal name, on the host's side.
-- Owner, verbatim: "instead of the shop messaging my user account, it's just
-- me messaging myself".
--
-- ── WHY ──────────────────────────────────────────────────────────────────────
-- tg_chat_messages_derive_sender (20271132839561, last replaced in
-- 20271333348826) derives sender_role from auth.uid() alone, testing COUPLE
-- FIRST. One person who is both a host of the event and the shop's owner always
-- resolves to 'couple', whichever screen they typed in. The uid cannot say
-- which side someone speaks for when they stand on both; only the screen can.
--
-- ── THE FIX ─────────────────────────────────────────────────────────────────
-- A new nullable column, `sent_as`, that the browser MAY name: the side the
-- screen it was typed in belongs to ('couple' or 'vendor'). It is a REQUEST,
-- never a claim the database trusts:
--   • sent_as = 'vendor' → stored as 'vendor' ONLY IF the sender truly stands
--     on the shop side (the same two vendor branches as before); otherwise the
--     row is refused (42501). It can never mint a side a person does not hold.
--   • sent_as = 'couple' → likewise, only for a couple member of the event.
--   • sent_as IS NULL     → exactly the old derivation, unchanged (every older
--     caller, the native endpoint, and anything not yet updated).
-- sender_role / sender_user_id stay un-nameable by the browser — nothing in
-- chat-sender-not-forgeable.db.test.ts is relaxed. The new column only picks
-- BETWEEN sides the database already proves the sender holds.
--
-- Checked against Rule 0 first: chat_messages had no side marker other than
-- sender_role itself (which is deliberately not the browser's to write), and
-- no "as_vendor"/"sender_side" column exists anywhere in the corpus.
--
-- 🔒 apps/web/tests/db/one-person-on-both-sides-speaks-for-the-screen.db.test.ts
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · the column ──────────────────────────────────────────────────────────
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS sent_as public.chat_sender_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.chat_messages'::regclass
       AND conname  = 'chat_messages_sent_as_is_a_side'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_sent_as_is_a_side
      CHECK (sent_as IS NULL OR sent_as IN ('couple', 'vendor'));
  END IF;
END $$;

COMMENT ON COLUMN public.chat_messages.sent_as IS
  'The side the SCREEN a message was typed in belongs to (couple or vendor), as the browser asked. A request, not a '
  'claim: tg_chat_messages_derive_sender honours it only when the sender truly stands on that side and refuses the row '
  'otherwise. Decides the side for ONE person who is both a host and the shop (owner 2026-11-11). NULL = derive as '
  'before. sender_role remains the truth. Migration 20271338442002.';

-- The browser may NAME the side it is sending from (column INSERT grants since 20271132839561).
GRANT INSERT (sent_as) ON public.chat_messages TO authenticated;

-- ── 2 · the derivation honours the screen, never beyond the person ──────────
CREATE OR REPLACE FUNCTION public.tg_chat_messages_derive_sender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid;
  v_role   public.chat_sender_role;
  v_couple boolean;
  v_vendor boolean;
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
$$;
COMMENT ON FUNCTION public.tg_chat_messages_derive_sender() IS
  'BEFORE INSERT on chat_messages: for end-user sessions, replaces any client-supplied sender_role/sender_user_id with values derived from auth.uid() — couple, vendor (owner/admin team, or assigned staff), or coordinator (an event_members coordinator of the event, in the thread; migration 20271333348826). When the row names sent_as (couple|vendor — the screen it was typed in), that side is used ONLY if the sender holds it, else the row is refused (migration 20271338442002). Service-role and owner sessions pass through untouched.';

COMMIT;
