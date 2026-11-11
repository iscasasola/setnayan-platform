-- ============================================================================
-- 20271339379038_a_dropped_offer_is_a_card_the_couple_applies.sql
-- THE OFFER CARD IN THE CHAT (Quote + negotiation · Piece 1 · PR-4, owner 2026-11-12,
-- approved design quote-maker-polish.html "Offer card in chat · Apply to my quote").
--
-- The supplier drops one of their OWN Offer Maker offers into the chat with a
-- "Good until" day; the couple taps Apply and the quote gets a new version with
-- the offer as its own named line. No chat record of an offer had a state
-- before this — the offer existed only inside the quote maker.
--
-- ── 1 · THE MARKER: chat_messages.vendor_offer_id + offer_good_until ────────
--   The SAME shape as the five card markers that ship (proposal_id ·
--   appointment_id · change_order_id · amendment_id · offered_service_id
--   20271214894972): a nullable FK, a partial index, a per-column INSERT grant.
--   ⚠ BIGINT, not UUID: `vendor_offers` keys on `id BIGSERIAL` (20271336923559
--   — "internal joins use hidden bigserial"); the plan's "UUID" named the
--   precedent's type, not this table's key.
--   ⚠ ON DELETE SET NULL, deliberately (the precedent's rule): a deleted offer
--   must not delete the conversation it was offered in. The message keeps its
--   body and stops drawing a card. `offer_good_until` stays — it is a fact about
--   that message, and the reader draws nothing without the offer.
--   RLS UNCHANGED: chat_messages' own policies decide who reads and writes the row.
--
-- ── 2 · THE COLUMN IS A CLAIM, NOT AN AUTHORISATION ──────────────────────────
--   The INSERT grant lets ANY party write an offer id (RLS is row-level, never
--   value-level — 20271229461225's lesson). So a trigger refuses, whoever
--   writes:
--     · an offer that is not THIS conversation's supplier's  (CARD_NOT_THIS_CONVERSATION)
--     · a drop by anyone but that shop's own team            (OFFER_NOT_YOURS)
--     · a drop with no Good-until day, or one already past   (OFFER_NEEDS_GOOD_UNTIL)
--     · a drop inside a private message (words only, 20271329968207)
--   A service-role write (no auth.uid()) skips only the "who" check.
--
-- ── 3 · APPLY: apply_dropped_offer(...) — SERVICE ROLE ONLY ──────────────────
--   The couple cannot write a quote (RLS makes a sent quote immutable; only the
--   supplier inserts), and the PRICE of the offer is the Offer Maker's own TS
--   answer (`offersForQuote`, lib/quote-offer-door.ts — % first, then ₱ off the
--   rest, the 9 Nov rule), computed on the SERVER by the one action
--   (app/_actions/offer-card-actions.ts) after it proves the caller in their own
--   session. This function is the atomic write and the backstop, and it trusts
--   only that one number. It REFUSES, with a named reason:
--     OFFER_DROP_EXPIRED   the drop's Good-until day has passed
--     OFFER_ENDED          the offer is switched off, past its last day, or all taken
--     NOT_THE_COUPLE       the actor is not a couple of this event, or is on the shop's team
--     NO_LIVE_QUOTE        nothing sent / viewed / accepted to apply it to
--     QUOTE_EXPIRED        the live quote's own Valid until has passed
--     DEAL_LOCKED          the booking is confirmed or a lock is pending (Piece 2 owns booked deals)
--     ALREADY_APPLIED      the live quote already carries THIS offer
--     ANOTHER_OFFER        the live quote already carries another offer (never stacked)
--     BAD_VERSION          the new lines are not the old lines + ONE offer line, or the
--                          total is not the old total + that line, or the offer line is ≥ 0
--     PAID_ROW_CHANGED     a plan row already paid would change
--   And it writes, in one transaction:
--     · a NEW vendor_proposals row = the live quote + the offer line, its plan
--       re-split, and THE PREDECESSOR'S STATUS (owner 12 Nov: "an applied offer keeps
--       the quote's prior status") — never reset to 'sent', never forced to 'accepted';
--     · the predecessor → 'superseded' (directly: `supersede_prior_vendor_proposals`
--       is the supplier's door and resets an acceptance, which this must not do);
--     · the shop's gift lines copied onto the new version (they key on proposal_id);
--     · on an accepted quote, the couple's shortlisted bench row re-priced to the new
--       total (the figure Lock books at — the same column supersede writes);
--     · one system line in the chat carrying the new version's card.
--   "Applied" is never stored: it is derived from a later version's
--   `line_items[].offer_id` (lib/offer-drop.ts).
--
-- Idempotent. Applied by the pipeline (`supabase db push --include-all`), never by hand.
-- ============================================================================

BEGIN;

-- ── 1 · the marker ──────────────────────────────────────────────────────────
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS vendor_offer_id BIGINT
    REFERENCES public.vendor_offers(id) ON DELETE SET NULL;
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS offer_good_until DATE;

COMMENT ON COLUMN public.chat_messages.vendor_offer_id IS
  'Set when the supplier drops one of their own Offer Maker offers into the chat — '
  'renders as the offer card the couple can Apply (PR-4, owner 2026-11-12). Mirrors '
  'offered_service_id. Refused unless the offer is this conversation''s supplier''s '
  'and the writer is on that shop''s team (tg_chat_messages_offer_is_this_suppliers).';
COMMENT ON COLUMN public.chat_messages.offer_good_until IS
  'The last Manila day the dropped offer can be applied from this card (the offer '
  'itself also ends on its own until_date). Required with vendor_offer_id.';

CREATE INDEX IF NOT EXISTS chat_messages_vendor_offer_id_idx
  ON public.chat_messages (vendor_offer_id)
  WHERE vendor_offer_id IS NOT NULL;

-- INSERT on chat_messages is per column (20271214894972's docblock): without
-- this the supplier's own drop fails with a bare permission error.
GRANT INSERT (vendor_offer_id, offer_good_until) ON public.chat_messages TO authenticated;

-- ── 2 · the claim is checked ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_chat_messages_offer_is_this_suppliers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop  UUID;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Manila')::DATE;
BEGIN
  IF NEW.vendor_offer_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- An UPDATE that leaves the offer and its day alone (ON DELETE SET NULL, an
  -- unrelated column) is not a new claim.
  IF TG_OP = 'UPDATE'
     AND NEW.vendor_offer_id IS NOT DISTINCT FROM OLD.vendor_offer_id
     AND NEW.offer_good_until IS NOT DISTINCT FROM OLD.offer_good_until THEN
    RETURN NEW;
  END IF;

  SELECT o.vendor_profile_id INTO v_shop FROM public.vendor_offers o WHERE o.id = NEW.vendor_offer_id;
  IF NOT FOUND OR v_shop IS DISTINCT FROM NEW.vendor_profile_id THEN
    RAISE EXCEPTION 'chat_messages: CARD_NOT_THIS_CONVERSATION — the offer is not this conversation''s supplier''s'
      USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT (NEW.vendor_profile_id IN (SELECT public.current_vendor_ids())
              OR NEW.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())) THEN
    RAISE EXCEPTION 'chat_messages: OFFER_NOT_YOURS — only the supplier drops their own offer'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.offer_good_until IS NULL OR NEW.offer_good_until < v_today THEN
    RAISE EXCEPTION 'chat_messages: OFFER_NEEDS_GOOD_UNTIL — a dropped offer needs a Good until day, today or later'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.recipient_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'chat_messages: PRIVATE_IS_WORDS_ONLY — an offer is never a private message'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_chat_messages_offer_is_this_suppliers() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chat_messages_offer_is_this_suppliers ON public.chat_messages;
CREATE TRIGGER chat_messages_offer_is_this_suppliers
  BEFORE INSERT OR UPDATE OF vendor_offer_id, offer_good_until ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_messages_offer_is_this_suppliers();

-- ── 3 · apply ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_dropped_offer(
  p_message_id       UUID,
  p_actor            UUID,
  p_line_items       JSONB,
  p_total_centavos   BIGINT,
  p_payment_schedule JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today    DATE := (NOW() AT TIME ZONE 'Asia/Manila')::DATE;
  v_msg      RECORD;
  v_offer    RECORD;
  v_quote    RECORD;
  v_blocker  TEXT;
  v_offer_ln JSONB;
  v_rest     JSONB;
  v_n_offer  INT;
  v_new_id   UUID;
  v_paid     INT[];
  v_old_row  JSONB;
  v_new_row  JSONB;
  v_seq      INT;
BEGIN
  SELECT m.message_id, m.event_id, m.vendor_profile_id, m.thread_id, m.vendor_offer_id, m.offer_good_until
    INTO v_msg
    FROM public.chat_messages m
   WHERE m.message_id = p_message_id;
  IF NOT FOUND OR v_msg.vendor_offer_id IS NULL OR v_msg.event_id IS NULL THEN
    RAISE EXCEPTION 'apply_dropped_offer: OFFER_ENDED — this offer is no longer in the chat' USING ERRCODE = 'P0001';
  END IF;

  -- The couple of THIS event, and nobody on the shop's own team.
  IF p_actor IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.event_members em
                     WHERE em.event_id = v_msg.event_id AND em.user_id = p_actor AND em.member_type = 'couple')
     OR EXISTS (SELECT 1 FROM public.vendor_profiles vp
                 WHERE vp.vendor_profile_id = v_msg.vendor_profile_id AND vp.user_id = p_actor)
     OR EXISTS (SELECT 1 FROM public.vendor_team_members tm
                 WHERE tm.vendor_profile_id = v_msg.vendor_profile_id AND tm.user_id = p_actor
                   AND tm.deactivated_at IS NULL) THEN
    RAISE EXCEPTION 'apply_dropped_offer: NOT_THE_COUPLE' USING ERRCODE = '42501';
  END IF;

  IF v_msg.offer_good_until IS NULL OR v_msg.offer_good_until < v_today THEN
    RAISE EXCEPTION 'apply_dropped_offer: OFFER_DROP_EXPIRED — the offer in the chat was good until %', v_msg.offer_good_until
      USING ERRCODE = 'P0001';
  END IF;

  SELECT o.public_id, o.name, o.is_on, o.until_date, o.who, o.first_n_cap, o.first_n_taken
    INTO v_offer
    FROM public.vendor_offers o
   WHERE o.id = v_msg.vendor_offer_id AND o.vendor_profile_id = v_msg.vendor_profile_id;
  IF NOT FOUND OR NOT v_offer.is_on
     OR (v_offer.until_date IS NOT NULL AND v_offer.until_date < v_today)
     OR (v_offer.who = 'first_n' AND v_offer.first_n_cap IS NOT NULL AND v_offer.first_n_taken >= v_offer.first_n_cap) THEN
    RAISE EXCEPTION 'apply_dropped_offer: OFFER_ENDED — the offer has ended' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.* INTO v_quote
    FROM public.vendor_proposals p
   WHERE p.event_id = v_msg.event_id
     AND p.vendor_profile_id = v_msg.vendor_profile_id
     AND p.status IN ('sent', 'viewed', 'accepted')
   ORDER BY p.created_at DESC
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'apply_dropped_offer: NO_LIVE_QUOTE' USING ERRCODE = 'P0001';
  END IF;
  IF v_quote.status IN ('sent', 'viewed') AND v_quote.valid_until IS NOT NULL
     AND NOT v_quote.valid_until_legacy AND v_quote.valid_until < v_today THEN
    RAISE EXCEPTION 'apply_dropped_offer: QUOTE_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  v_blocker := public.vendor_requote_blocker(v_msg.event_id, v_msg.vendor_profile_id);
  IF v_blocker IS NOT NULL THEN
    RAISE EXCEPTION 'apply_dropped_offer: DEAL_LOCKED — %', v_blocker USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_quote.line_items, '[]'::jsonb)) e
              WHERE e ->> 'offer_id' = v_offer.public_id) THEN
    RAISE EXCEPTION 'apply_dropped_offer: ALREADY_APPLIED' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_quote.line_items, '[]'::jsonb)) e
              WHERE NULLIF(e ->> 'offer_id', '') IS NOT NULL) THEN
    RAISE EXCEPTION 'apply_dropped_offer: ANOTHER_OFFER' USING ERRCODE = 'P0001';
  END IF;

  -- The new version is the old lines, unchanged, plus ONE line naming this offer.
  IF jsonb_typeof(p_line_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'apply_dropped_offer: BAD_VERSION' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_n_offer
    FROM jsonb_array_elements(p_line_items) e
   WHERE NULLIF(e ->> 'offer_id', '') IS NOT NULL;
  SELECT e INTO v_offer_ln
    FROM jsonb_array_elements(p_line_items) e
   WHERE e ->> 'offer_id' = v_offer.public_id
   LIMIT 1;
  SELECT COALESCE(jsonb_agg(e ORDER BY o), '[]'::jsonb) INTO v_rest
    FROM jsonb_array_elements(p_line_items) WITH ORDINALITY AS t(e, o)
   WHERE NULLIF(e ->> 'offer_id', '') IS NULL;
  IF v_n_offer <> 1 OR v_offer_ln IS NULL
     OR jsonb_typeof(v_offer_ln -> 'amount_centavos') IS DISTINCT FROM 'number'
     OR (v_offer_ln ->> 'amount_centavos')::NUMERIC >= 0
     OR v_rest IS DISTINCT FROM COALESCE(v_quote.line_items, '[]'::jsonb)
     OR p_total_centavos IS DISTINCT FROM v_quote.total_centavos + (v_offer_ln ->> 'amount_centavos')::BIGINT
     OR p_total_centavos < 0 THEN
    RAISE EXCEPTION 'apply_dropped_offer: BAD_VERSION' USING ERRCODE = '22023';
  END IF;

  -- Paid plan rows never change (owner: "paid amounts never change").
  SELECT COALESCE(array_agg(DISTINCT pay.schedule_instance_seq), '{}')
    INTO v_paid
    FROM public.event_vendor_payments pay
    JOIN public.event_vendors ev ON ev.vendor_id = pay.vendor_id
   WHERE ev.event_id = v_msg.event_id
     AND ev.marketplace_vendor_id = v_msg.vendor_profile_id
     AND pay.vendor_confirmed_at IS NOT NULL
     AND pay.payment_refused_at IS NULL
     AND pay.schedule_instance_seq IS NOT NULL;
  FOREACH v_seq IN ARRAY v_paid LOOP
    SELECT e INTO v_old_row FROM jsonb_array_elements(v_quote.payment_schedule -> 'installments') e
     WHERE (e ->> 'seq')::INT = v_seq LIMIT 1;
    SELECT e INTO v_new_row FROM jsonb_array_elements(p_payment_schedule -> 'installments') e
     WHERE (e ->> 'seq')::INT = v_seq LIMIT 1;
    IF v_old_row IS NOT NULL
       AND (v_new_row IS NULL OR (v_new_row ->> 'amount_centavos') IS DISTINCT FROM (v_old_row ->> 'amount_centavos')) THEN
      RAISE EXCEPTION 'apply_dropped_offer: PAID_ROW_CHANGED — a paid payment never changes' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  -- The new version: everything the quote said, the offer line added, its own status kept.
  INSERT INTO public.vendor_proposals (
    vendor_profile_id, event_id, template_id, title, merge_snapshot, rendered_body, rendered_terms,
    line_items, total_centavos, payment_schedule, payment_method_ids, valid_until, valid_until_legacy,
    includes_setnayan_gift, service_card_ids, changes_locked, plan_locked,
    status, sent_at, viewed_at, resolved_at, resolved_by_user_id
  ) VALUES (
    v_quote.vendor_profile_id, v_quote.event_id, v_quote.template_id, v_quote.title,
    COALESCE(v_quote.merge_snapshot, '{}'::jsonb)
      || jsonb_build_object('applied_offer', jsonb_build_object(
           'offer_id', v_offer.public_id, 'message_id', v_msg.message_id,
           'from_proposal_id', v_quote.proposal_id, 'at', NOW())),
    v_quote.rendered_body, v_quote.rendered_terms,
    p_line_items, p_total_centavos, COALESCE(p_payment_schedule, v_quote.payment_schedule),
    v_quote.payment_method_ids, v_quote.valid_until, v_quote.valid_until_legacy,
    v_quote.includes_setnayan_gift, v_quote.service_card_ids, v_quote.changes_locked, v_quote.plan_locked,
    v_quote.status, NOW(), v_quote.viewed_at, v_quote.resolved_at, v_quote.resolved_by_user_id
  )
  RETURNING proposal_id INTO v_new_id;

  UPDATE public.vendor_proposals
     SET status = 'superseded', updated_at = NOW()
   WHERE proposal_id = v_quote.proposal_id;

  INSERT INTO public.vendor_proposal_shop_gifts
    (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title)
  SELECT v_new_id, g.vendor_profile_id, g.service_code, g.gift_kind, g.credits, g.srp_php, g.title
    FROM public.vendor_proposal_shop_gifts g
   WHERE g.proposal_id = v_quote.proposal_id;

  IF v_quote.status = 'accepted' THEN
    UPDATE public.event_vendors
       SET total_cost_php = p_total_centavos::NUMERIC / 100.0, updated_at = NOW()
     WHERE event_id = v_msg.event_id
       AND marketplace_vendor_id = v_msg.vendor_profile_id
       AND status = 'shortlisted'::public.vendor_status
       AND archived_at IS NULL;
  END IF;

  INSERT INTO public.chat_messages
    (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body, proposal_id)
  VALUES
    (v_msg.thread_id, v_msg.event_id, v_msg.vendor_profile_id, NULL, 'system',
     left(format('🏷 %s applied — the quote''s new version is %s.',
                 btrim(v_offer.name), public.booking_change_php_words(p_total_centavos::NUMERIC / 100.0)), 4000),
     v_new_id);

  RETURN v_new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_dropped_offer(UUID, UUID, JSONB, BIGINT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_dropped_offer(UUID, UUID, JSONB, BIGINT, JSONB) TO service_role;
COMMENT ON FUNCTION public.apply_dropped_offer(UUID, UUID, JSONB, BIGINT, JSONB) IS
  'Service role only (app/_actions/offer-card-actions.ts, after it proves the couple in their own session and prices the offer with offersForQuote). Writes the quote''s next version = the live quote + ONE offer line, keeping the predecessor''s status; paid plan rows never change. Refuses OFFER_DROP_EXPIRED · OFFER_ENDED · NOT_THE_COUPLE · NO_LIVE_QUOTE · QUOTE_EXPIRED · DEAL_LOCKED · ALREADY_APPLIED · ANOTHER_OFFER · BAD_VERSION · PAID_ROW_CHANGED. PR-4, owner 2026-11-12.';

COMMIT;
