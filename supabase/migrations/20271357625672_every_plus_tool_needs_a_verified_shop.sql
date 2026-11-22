-- every_plus_tool_needs_a_verified_shop
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🪪 EVERY ＋ TOOL NEEDS A VERIFIED SHOP — THE DATABASE HALF (UNICHAT ＋ P1; owner 21 Nov 2026, the ＋ drawing's "Gates":
-- *"every ＋ tool needs the shop at least Verified, with a server check on every send"*; DECISION_LOG 9dd5576c).
--
-- The server actions ask `lib/shop-plus-gate.server.ts` before they write. FOUR ＋ tools write from the BROWSER with
-- the person's own session, so no server action stands in front of them: a poll (`chat_poll_open`), a decision
-- (`chat_decision_open`), a payment-plan / change ask (`ask_for_a_change` → booking_change_asks) and a dropped offer
-- (a direct INSERT into chat_messages carrying `vendor_offer_id`). This trigger is their server check.
--
-- WHO IS REFUSED — only the SHOP's side of a supplier chat, while that shop is not verified:
--   · a server write (no signed-in caller: auth.uid() IS NULL — service role, cron, backfills) passes;
--   · a group thread (no shop on it) passes;
--   · a caller who is not on the thread's shop (the hosts, a coordinator for the hosts) passes;
--   · a caller who is a HOST of the thread's event passes (an owner hosting their own shop's event);
--   · a shop whose verification_state = 'verified' passes (`shopIsVerified`, the ONE test);
--   · everyone else: refused, 42501, words the app shows as they are.
-- No function body is replaced (chat_poll_open · chat_decision_open · ask_for_a_change stay byte-for-byte).

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.tg_chat_plus_needs_a_verified_shop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_shop  uuid;
  v_event uuid;
  v_state text;
BEGIN
  -- 🔑 SECURITY DEFINER ON PURPOSE: the caller may not read the shop's verification row or the event's members under
  -- their own RLS, and a refused read here must never read as "verified".
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.vendor_profile_id, t.event_id INTO v_shop, v_event
    FROM public.chat_threads t
   WHERE t.thread_id = NEW.thread_id;
  IF v_shop IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.current_vendor_profile_ids() AS mine(id) WHERE mine.id = v_shop) THEN
    RETURN NEW;
  END IF;

  IF v_event IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_members m
     WHERE m.event_id = v_event AND m.user_id = v_uid AND m.member_type = 'couple'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT vp.verification_state::text INTO v_state
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = v_shop;
  IF v_state = 'verified' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'PLUS_NEEDS_VERIFIED: Chat tools open once your shop is verified.' USING ERRCODE = '42501';
END;
$$;

-- A trigger function, SECURITY DEFINER: never reachable as an RPC.
REVOKE EXECUTE ON FUNCTION public.tg_chat_plus_needs_a_verified_shop() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_chat_plus_needs_a_verified_shop() FROM anon, authenticated;

DROP TRIGGER IF EXISTS chat_polls_plus_needs_a_verified_shop ON public.chat_polls;
CREATE TRIGGER chat_polls_plus_needs_a_verified_shop
  BEFORE INSERT ON public.chat_polls
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_plus_needs_a_verified_shop();

DROP TRIGGER IF EXISTS chat_decision_topics_plus_needs_a_verified_shop ON public.chat_decision_topics;
CREATE TRIGGER chat_decision_topics_plus_needs_a_verified_shop
  BEFORE INSERT ON public.chat_decision_topics
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_plus_needs_a_verified_shop();

DROP TRIGGER IF EXISTS booking_change_asks_plus_needs_a_verified_shop ON public.booking_change_asks;
CREATE TRIGGER booking_change_asks_plus_needs_a_verified_shop
  BEFORE INSERT ON public.booking_change_asks
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_plus_needs_a_verified_shop();

DROP TRIGGER IF EXISTS chat_messages_offer_needs_a_verified_shop ON public.chat_messages;
CREATE TRIGGER chat_messages_offer_needs_a_verified_shop
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW
  WHEN (NEW.vendor_offer_id IS NOT NULL)
  EXECUTE FUNCTION public.tg_chat_plus_needs_a_verified_shop();

COMMENT ON FUNCTION public.tg_chat_plus_needs_a_verified_shop() IS
  'UNICHAT ＋ P1 (owner 21 Nov 2026): a ＋ tool written from the browser (poll, decision, change/plan ask, dropped offer) needs the shop verified when the SHOP side writes it. Server writes, group threads, the hosts and a host of the event pass. Migration 20271357625672.';

COMMIT;
