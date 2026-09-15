-- ═══════════════════════════════════════════════════════════════════════════
-- A CARD NAMES *THIS* CONVERSATION'S SUPPLIER.
--
-- A chat message can carry a CARD — a link to a proposal, a meeting, a change
-- order, a deal amendment, or an offered service. The card is what the platform
-- itself vouches for: it renders with Setnayan's chrome, the supplier's price,
-- and a working button. The message body is just what somebody typed.
--
-- ── WHAT WAS POSSIBLE (measured in the replay as a real `authenticated`
--    session, and read in production, 2026-09-15) ────────────────────────────
-- `authenticated` holds INSERT on all five card columns — it HAS to, because the
-- supplier writes them under their own session (lib/proposal-send.ts,
-- app/_components/negotiation-actions.ts, lib/offer-service-core.ts). Nothing
-- then asked whether the row those columns POINT AT belongs to this
-- conversation:
--
--   · chat_messages_member_insert is satisfied by its FIRST disjunct alone —
--     `event_id IN current_couple_event_ids()`. A couple writing on their own
--     event passes, and the policy never looks at the card columns.
--   · the two BEFORE INSERT triggers that already exist do not close it either.
--     tg_chat_messages_derive_sender (20271132839561) overwrites sender_role and
--     sender_user_id, so WHO sent it cannot be forged. tg_chat_messages_guard_
--     end_user_write (20271221089848) pins thread_id to (event_id,
--     vendor_profile_id), so WHICH conversation cannot be forged. Neither reads
--     proposal_id, appointment_id, change_order_id, amendment_id or
--     offered_service_id.
--
-- 🔑 THE HOLE IS THE GAP BETWEEN THOSE TWO. The conversation is honest and the
-- sender is honest; the CARD INSIDE IT is not. A couple with threads open to two
-- suppliers could paste supplier B's proposal_id / appointment_id /
-- amendment_id into supplier A's thread and get a fully-populated card —
-- B's title, B's price, B's status, and a live /proposals/<public_id> link —
-- presented under A's name, on their own screen AND on supplier A's.
--
-- ⚠ RLS CANNOT REFUSE THIS, AND IT IS NOT A BUG IN RLS. A policy is row-level,
-- never value-level: one that admits you to your own row cannot govern what that
-- row SAYS about somebody else. And couple-side RLS on the referenced tables is
-- EVENT-scoped, not vendor-scoped (vendor_proposals_couple_read,
-- event_appointments' couple arm, proposal_amendments' couple arm all read
-- `event_id IN current_event_ids()` with no vendor predicate), so every one of
-- those foreign rows is legitimately readable by the forger. The ids are not
-- secret. Only the comparison below is.
--
-- ── WHY A TRIGGER RATHER THAN THE SCREEN ────────────────────────────────────
-- lib/offered-service-card.ts ALREADY makes this comparison for one of the five
-- (`svc.vendor_profile_id !== row.vendor_profile_id`), and its docblock names
-- this exact threat. That check is correct and stays. But it is ONE reader's
-- discipline: the other four resolve in app/_components/chat-message-stream.tsx
-- with no ownership test at all, and a sixth reader added next month inherits
-- nothing. A forged row that no screen draws today is still a forged row in the
-- table, waiting for a reader that does. The database is where "this card is not
-- from this supplier" stops being a rendering decision.
--
-- ── SCOPE: EVERY ROLE, NOT JUST END-USER SESSIONS ───────────────────────────
-- Unlike its two siblings this guard does NOT exempt the service role. It is not
-- a policy about who may speak — it is a consistency invariant about what a row
-- may claim, and it is equally true of a row the server writes. Measured before
-- choosing that: ALL FIVE legitimate writers copy event_id and vendor_profile_id
-- from the thread they are already holding, so none of them can trip it; NO
-- admin-client writer sets any of the five (lib/chat-actions.ts,
-- lib/chat-send.ts, build-3state-actions.ts, demo-vendors/inquiries/actions.ts
-- set none); the one seed migration that inserts chat_messages
-- (20270405784887) sets none; and no test inserts an inconsistent card.
--
-- 🔢 PRODUCTION, READ-ONLY, 2026-09-15: chat_messages holds 8 rows and ZERO
-- carry ANY of the five columns. So there is no existing row this can strand,
-- and nothing to backfill.
--
-- ⚖ WHAT IS COMPARED, AND WHY IT DIFFERS BY CARD:
--   · a SERVICE is vendor-scoped and not event-scoped — a supplier offers the
--     same service to every couple — so only vendor_profile_id is compared.
--   · a PROPOSAL, MEETING, CHANGE ORDER and AMENDMENT are each scoped to one
--     event AND one supplier, so both are compared.
--   thread_id is deliberately NOT compared even where the referenced table
--   carries one: tg_chat_messages_guard_end_user_write already pins the
--   message's thread to its (event, vendor), so (event, vendor) IS the identity
--   of the conversation, and two of the five tables allow a NULL thread_id.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.tg_chat_messages_card_names_this_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event  uuid;
  v_vendor uuid;
BEGIN
  -- 🔑 SECURITY DEFINER ON PURPOSE. An INVOKER trigger would read these tables
  -- through the caller's RLS and a foreign row would simply be invisible — which
  -- happens to refuse the attack today, but says "you cannot see it" where the
  -- rule is "it is not yours". Those are different sentences and only one of
  -- them stays true when a policy is widened. This reads ground truth.

  -- 1 · OFFERED SERVICE → vendor only. A service belongs to a supplier, not to
  --     an event.
  IF NEW.offered_service_id IS NOT NULL THEN
    SELECT s.vendor_profile_id INTO v_vendor
      FROM public.vendor_services s
     WHERE s.vendor_service_id = NEW.offered_service_id;
    IF NOT FOUND OR v_vendor IS DISTINCT FROM NEW.vendor_profile_id THEN
      RAISE EXCEPTION
        'chat_messages: CARD_NOT_THIS_CONVERSATION — the offered service is not this conversation''s supplier''s'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2 · PROPOSAL → event AND vendor.
  IF NEW.proposal_id IS NOT NULL THEN
    SELECT p.event_id, p.vendor_profile_id INTO v_event, v_vendor
      FROM public.vendor_proposals p
     WHERE p.proposal_id = NEW.proposal_id;
    IF NOT FOUND
       OR v_event  IS DISTINCT FROM NEW.event_id
       OR v_vendor IS DISTINCT FROM NEW.vendor_profile_id THEN
      RAISE EXCEPTION
        'chat_messages: CARD_NOT_THIS_CONVERSATION — the proposal is not this conversation''s'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3 · MEETING → event AND vendor.
  IF NEW.appointment_id IS NOT NULL THEN
    SELECT a.event_id, a.vendor_profile_id INTO v_event, v_vendor
      FROM public.event_appointments a
     WHERE a.appointment_id = NEW.appointment_id;
    IF NOT FOUND
       OR v_event  IS DISTINCT FROM NEW.event_id
       OR v_vendor IS DISTINCT FROM NEW.vendor_profile_id THEN
      RAISE EXCEPTION
        'chat_messages: CARD_NOT_THIS_CONVERSATION — the meeting is not this conversation''s'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 4 · CHANGE ORDER → event AND vendor. The card this links to is RETIRED (no
  --     renderer; lib/the-change-marker-is-retired.test.ts holds that), but the
  --     column is still INSERT-granted and the writers still exist, so it is
  --     fenced with the rest rather than left as the one way back in.
  IF NEW.change_order_id IS NOT NULL THEN
    SELECT c.event_id, c.vendor_profile_id INTO v_event, v_vendor
      FROM public.vendor_change_orders c
     WHERE c.change_order_id = NEW.change_order_id;
    IF NOT FOUND
       OR v_event  IS DISTINCT FROM NEW.event_id
       OR v_vendor IS DISTINCT FROM NEW.vendor_profile_id THEN
      RAISE EXCEPTION
        'chat_messages: CARD_NOT_THIS_CONVERSATION — the change request is not this conversation''s'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 5 · AMENDMENT → event AND vendor. This is the money one: the amendment card
  --     carries an accept button and a deal lock.
  IF NEW.amendment_id IS NOT NULL THEN
    SELECT m.event_id, m.vendor_profile_id INTO v_event, v_vendor
      FROM public.proposal_amendments m
     WHERE m.amendment_id = NEW.amendment_id;
    IF NOT FOUND
       OR v_event  IS DISTINCT FROM NEW.event_id
       OR v_vendor IS DISTINCT FROM NEW.vendor_profile_id THEN
      RAISE EXCEPTION
        'chat_messages: CARD_NOT_THIS_CONVERSATION — the deal change is not this conversation''s'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.tg_chat_messages_card_names_this_conversation() IS
  'BEFORE INSERT on chat_messages: every card link (proposal, meeting, change '
  'order, amendment, offered service) must point at a row belonging to this '
  'message''s own event and supplier. RLS is row-level and cannot govern the '
  'VALUES a row claims about somebody else; this is that check. Refuses with the '
  'marker CARD_NOT_THIS_CONVERSATION. Applies to every role, including the '
  'service role — it is a consistency invariant, not a permission.';

-- SECURITY DEFINER, so it must never be reachable as an RPC.
REVOKE EXECUTE ON FUNCTION public.tg_chat_messages_card_names_this_conversation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_chat_messages_card_names_this_conversation() FROM anon, authenticated;

DROP TRIGGER IF EXISTS chat_messages_card_names_this_conversation ON public.chat_messages;
CREATE TRIGGER chat_messages_card_names_this_conversation
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_messages_card_names_this_conversation();
