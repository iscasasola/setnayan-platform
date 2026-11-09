-- a_host_asks_and_only_the_supplier_writes_the_price
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- SUPPLIER BUILD 3 · LANE C — the money rules the chat cards stand on, held in
-- the DATABASE so no door can forget them (owner, 8–9 Nov 2026):
--
--   💳 "only the SUPPLIER edits the quote and its payment plan. Hosts AND the
--      coordinator never edit them; they send Ask for a change … the supplier
--      answers by sending a revised quote/plan or declining."
--   🔒 "Locked ⇒ hosts/coordinator see no Ask for a change on THAT item;
--      server refuses."  (locks: lane B migration 20271329937802)
--   🧾 "they will not be able to make the price smaller from their paid
--      quotation. that is already the minimum."  (DECISION_LOG 2026-11-08 —
--      "Supplier Build 3 adds the floor in the database (a trigger, not only
--      the screen)")
--   💳 "the payment plan should always be able to pay all" — the server
--      refuses any plan where Σ(payments) ≠ Agreed.
--
-- ── 1 · public.booking_change_asks — the "Ask for a change" card's record ──
-- Measured before adding a table (RULE 0 · a flag beats new schema):
--   • proposal_amendments / vendor_change_orders carry PRICED items a side
--     proposes and the other ACCEPTS — accepting one moves the agreed total.
--     An ask is the opposite: words only, it moves nothing, and only the
--     supplier may answer it by WRITING a new version. Reusing either would let
--     a host's ask re-price a booking on a tap — the exact thing the ruling
--     takes away.
--   • lane B's migration says it outright: "the Ask-for-a-change card has no
--     table yet (Lane C); its writer must read these columns."
-- Written ONLY by the two DEFINER functions below. Members of the conversation
-- read it (the card draws from it); nobody INSERTs/UPDATEs directly.
--
-- ── 2 · THE PAID FLOOR ──────────────────────────────────────────────────────
-- "Paid" = the booking has at least one payment the SUPPLIER CONFIRMED and did
-- not refuse (event_vendor_payments.vendor_confirmed_at, payment_refused_at).
-- The floor is the paid QUOTATION — the latest quote the hosts accepted (status
-- 'accepted', or 'superseded' with resolved_at set: supersede retires only
-- sent/viewed/accepted rows, and only an accept/decline stamps resolved_at, so
-- a superseded row with resolved_at was accepted). Two writers can lower a price:
--   (a) a new quote version — BEFORE INSERT/UPDATE on vendor_proposals moving
--       into 'sent': total_centavos ≥ the floor;
--   (b) a change line riding on the agreed total (20271218458148 —
--       event_vendor_line_items.is_change_delta, written by
--       accept_change_order / record_agreed_price_change): with a confirmed
--       payment, Σ(change lines) after the insert may never be < 0, i.e. the
--       agreed total never falls below the headline that was paid on.
--       Removing a line is a SWAP: one net row that is ≥ 0.
--   Before any confirmed payment the price moves freely (owner: "Before any
--   payment the card has no floor").
--
-- ── 3 · PAY IN FULL ─────────────────────────────────────────────────────────
-- A quote that carries a plan (payment_schedule.installments non-empty) may be
-- SENT only when Σ(installments.amount_centavos) = total_centavos and nothing
-- is over-covered. Checked on the move into 'sent' (and a schedule/total change
-- while sent), never re-checked on view/accept/expiry. A quote with no plan
-- ({}) is unchanged — it is the line items alone.
--
-- Never applied by hand — the pipeline's `supabase db push --include-all`.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · Ask for a change ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_change_asks (
  ask_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id          UUID NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  event_id           UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- What the ask is about: the quotation's lines/amounts, its payment plan, or a sent form.
  subject            TEXT NOT NULL CHECK (subject IN ('quote', 'plan', 'form')),
  proposal_id        UUID REFERENCES public.vendor_proposals(proposal_id) ON DELETE SET NULL,
  -- A sent library form (event_form_sends is keyed (event_id, form_id)); NULL with subject 'form' = the shop's
  -- "Questions for the couple" set on this event (event_question_requests, keyed (event_id, vendor_profile_id)).
  form_id            UUID,
  note               TEXT NOT NULL CHECK (char_length(btrim(note)) BETWEEN 1 AND 1000),
  -- An actor stamp (the refunds table's recorded_by_user_id shape): un-keyed on purpose, see the erasure note.
  asked_by           UUID,
  asked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'revised', 'declined')),
  answer_note        TEXT CHECK (answer_note IS NULL OR char_length(answer_note) <= 500),
  answered_by        UUID,
  answered_at        TIMESTAMPTZ,
  CONSTRAINT booking_change_asks_answer_is_whole
    CHECK ((status = 'open') = (answered_at IS NULL))
);
ALTER TABLE public.booking_change_asks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS booking_change_asks_thread_idx
  ON public.booking_change_asks (thread_id, asked_at DESC);
CREATE INDEX IF NOT EXISTS booking_change_asks_proposal_idx
  ON public.booking_change_asks (proposal_id) WHERE proposal_id IS NOT NULL;

COMMENT ON TABLE public.booking_change_asks IS
  'Ask for a change (Supplier Build 3 · lane C, owner 2026-11-09): a host or coordinator asks the supplier to change the quotation, its payment plan or a sent form — words only, moves no money. The supplier answers by sending a revised version (status revised) or declining. Refused while that item is locked (vendor_proposals.changes_locked / plan_locked, event_form_sends.locked / event_question_requests.locked). Written only by ask_for_a_change() / answer_change_ask(). Migration 20271332041210.';

DROP POLICY IF EXISTS booking_change_asks_members_read ON public.booking_change_asks;
CREATE POLICY booking_change_asks_members_read
  ON public.booking_change_asks FOR SELECT
  TO authenticated
  USING (
    thread_id IN (SELECT public.current_thread_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

-- Nothing for the public internet; members read through RLS, nobody writes but the two functions below.
REVOKE ALL ON public.booking_change_asks FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.booking_change_asks FROM authenticated;
GRANT SELECT ON public.booking_change_asks TO authenticated;

-- The ask. Returns the new ask_id; RAISES with a named reason when refused so the card can say why.
CREATE OR REPLACE FUNCTION public.ask_for_a_change(
  p_thread_id    UUID,
  p_subject      TEXT,
  p_note         TEXT,
  p_proposal_id  UUID DEFAULT NULL,
  p_form_id      UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_thread public.chat_threads%ROWTYPE;
  v_locked BOOLEAN := FALSE;
  v_id     UUID;
  v_name   TEXT;
  v_what   TEXT;
  v_note   TEXT := btrim(COALESCE(p_note, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ask_for_a_change: NOT_SIGNED_IN' USING ERRCODE = '42501';
  END IF;
  IF p_subject NOT IN ('quote', 'plan', 'form') OR char_length(v_note) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'ask_for_a_change: BAD_ASK — say what should change (1–1000 characters)' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_thread FROM public.chat_threads WHERE thread_id = p_thread_id;
  IF v_thread.thread_id IS NULL THEN
    RAISE EXCEPTION 'ask_for_a_change: NOT_IN_THIS_CHAT' USING ERRCODE = '42501';
  END IF;
  -- The hosts' side only: NOT the shop's own team (the supplier writes; they never ask) …
  IF v_thread.vendor_profile_id IN (SELECT public.current_vendor_ids())
     OR v_thread.vendor_profile_id IN (SELECT public.current_vendor_profile_ids()) THEN
    RAISE EXCEPTION 'ask_for_a_change: NOT_THE_HOSTS_SIDE' USING ERRCODE = '42501';
  END IF;
  -- … and in the conversation (a thread that exists is not a thread you are in).
  IF NOT (p_thread_id IN (SELECT public.current_thread_ids())) THEN
    RAISE EXCEPTION 'ask_for_a_change: NOT_IN_THIS_CHAT' USING ERRCODE = '42501';
  END IF;

  IF p_subject IN ('quote', 'plan') THEN
    IF p_proposal_id IS NULL THEN
      RAISE EXCEPTION 'ask_for_a_change: NO_QUOTE' USING ERRCODE = '22023';
    END IF;
    SELECT CASE WHEN p_subject = 'quote' THEN vp.changes_locked ELSE vp.plan_locked END
      INTO v_locked
      FROM public.vendor_proposals vp
     WHERE vp.proposal_id = p_proposal_id
       AND vp.event_id = v_thread.event_id
       AND vp.vendor_profile_id = v_thread.vendor_profile_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ask_for_a_change: NO_QUOTE' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_form_id IS NOT NULL THEN
      SELECT fs.locked INTO v_locked FROM public.event_form_sends fs
       WHERE fs.event_id = v_thread.event_id AND fs.form_id = p_form_id
         AND fs.vendor_profile_id = v_thread.vendor_profile_id;
    ELSE
      SELECT qr.locked INTO v_locked FROM public.event_question_requests qr
       WHERE qr.event_id = v_thread.event_id AND qr.vendor_profile_id = v_thread.vendor_profile_id;
    END IF;
    IF v_locked IS NULL THEN
      RAISE EXCEPTION 'ask_for_a_change: NO_FORM' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_locked THEN
    RAISE EXCEPTION 'ask_for_a_change: ITEM_LOCKED — the supplier made this final' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.booking_change_asks
    (thread_id, event_id, vendor_profile_id, subject, proposal_id, form_id, note, asked_by)
  VALUES
    (p_thread_id, v_thread.event_id, v_thread.vendor_profile_id, p_subject,
     CASE WHEN p_subject = 'form' THEN NULL ELSE p_proposal_id END,
     CASE WHEN p_subject = 'form' THEN p_form_id ELSE NULL END,
     v_note, v_uid)
  RETURNING ask_id INTO v_id;

  SELECT NULLIF(btrim(u.first_name), '') INTO v_name FROM public.users u WHERE u.user_id = v_uid;
  v_what := CASE p_subject WHEN 'quote' THEN 'Quotation' WHEN 'plan' THEN 'Payment plan' ELSE 'Form' END;
  PERFORM public.chat_record_post_line(
    v_thread.event_id, v_thread.vendor_profile_id,
    'Asked for a change · ' || v_what || ' · ' || COALESCE(v_name, 'A host') || ' — “' || left(v_note, 300) || '”',
    'Asked for a change · ' || v_what || ' · ' || COALESCE(v_name, 'A host'));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ask_for_a_change(UUID, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ask_for_a_change(UUID, TEXT, TEXT, UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.ask_for_a_change(UUID, TEXT, TEXT, UUID, UUID) IS
  'A host or coordinator asks the supplier for a change to the quotation / payment plan / a sent form (words only). Refuses the shop''s own team, anyone outside the conversation, and a LOCKED item (ITEM_LOCKED). Posts "Asked for a change · …" into the chat. Migration 20271332041210.';

-- The supplier's answer: they sent a revised version, or they decline.
CREATE OR REPLACE FUNCTION public.answer_change_ask(
  p_ask_id UUID,
  p_answer TEXT,
  p_note   TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_ask  public.booking_change_asks%ROWTYPE;
  v_what TEXT;
  v_note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF v_uid IS NULL OR p_answer NOT IN ('revised', 'declined') THEN
    RAISE EXCEPTION 'answer_change_ask: BAD_ANSWER' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_ask FROM public.booking_change_asks WHERE ask_id = p_ask_id FOR UPDATE;
  IF v_ask.ask_id IS NULL
     OR NOT (v_ask.vendor_profile_id IN (SELECT public.current_vendor_ids())
             OR v_ask.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())) THEN
    RAISE EXCEPTION 'answer_change_ask: NOT_THE_SUPPLIER' USING ERRCODE = '42501';
  END IF;
  IF v_ask.status <> 'open' THEN
    RETURN 'already';
  END IF;
  UPDATE public.booking_change_asks
     SET status = p_answer, answer_note = left(v_note, 500), answered_by = v_uid, answered_at = NOW()
   WHERE ask_id = p_ask_id;
  v_what := CASE v_ask.subject WHEN 'quote' THEN 'Quotation' WHEN 'plan' THEN 'Payment plan' ELSE 'Form' END;
  PERFORM public.chat_record_post_line(
    v_ask.event_id, v_ask.vendor_profile_id,
    CASE p_answer
      WHEN 'revised' THEN 'Change asked · ' || v_what || ' · the supplier is sending a new version'
      ELSE 'Change asked · ' || v_what || ' · declined by the supplier' || COALESCE(' — “' || left(v_note, 300) || '”', '')
    END,
    CASE p_answer
      WHEN 'revised' THEN 'Change asked · ' || v_what || ' · the supplier is sending a new version'
      ELSE 'Change asked · ' || v_what || ' · declined by the supplier'
    END);
  RETURN p_answer;
END;
$$;
REVOKE ALL ON FUNCTION public.answer_change_ask(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_change_ask(UUID, TEXT, TEXT) TO authenticated;
COMMENT ON FUNCTION public.answer_change_ask(UUID, TEXT, TEXT) IS
  'The shop answers an open Ask for a change: revised (a new version follows) or declined. Shop team only; idempotent (an answered ask returns already). Posts the answer into the chat. Migration 20271332041210.';

-- ── 2 · The paid floor ──────────────────────────────────────────────────────
-- The paid quotation's total (centavos), or NULL when nothing is paid yet.
CREATE OR REPLACE FUNCTION public.quote_floor_of(p_event_id UUID, p_vendor_profile_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN EXISTS (
           SELECT 1
             FROM public.event_vendor_payments p
             JOIN public.event_vendors ev ON ev.vendor_id = p.vendor_id
            WHERE ev.event_id = p_event_id
              AND ev.marketplace_vendor_id = p_vendor_profile_id
              AND p.vendor_confirmed_at IS NOT NULL
              AND p.payment_refused_at IS NULL)
         THEN (SELECT vp.total_centavos
                 FROM public.vendor_proposals vp
                WHERE vp.event_id = p_event_id
                  AND vp.vendor_profile_id = p_vendor_profile_id
                  AND (vp.status = 'accepted' OR (vp.status = 'superseded' AND vp.resolved_at IS NOT NULL))
                ORDER BY vp.resolved_at DESC NULLS LAST, vp.created_at DESC
                LIMIT 1)
         ELSE NULL END;
$$;
REVOKE ALL ON FUNCTION public.quote_floor_of(UUID, UUID) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.quote_floor_of(UUID, UUID) IS
  'Internal: the paid quotation''s total (centavos) or NULL — read by the money-rules triggers whoever writes (a service-role write included). Not callable by a session; the gated reader is paid_quote_floor_centavos(). Migration 20271332041210.';

-- The card's reader: the same number, ONLY for the event's own people, the shop, or an admin — anyone else reads NULL
-- (a DEFINER function granted to every session must not hand a stranger another event's quoted total).
CREATE OR REPLACE FUNCTION public.paid_quote_floor_centavos(p_event_id UUID, p_vendor_profile_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN p_event_id IN (SELECT public.current_event_ids())
             OR p_vendor_profile_id IN (SELECT public.current_vendor_ids())
             OR p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
             OR (SELECT public.is_admin())
           THEN public.quote_floor_of(p_event_id, p_vendor_profile_id)
           ELSE NULL
         END;
$$;
REVOKE ALL ON FUNCTION public.paid_quote_floor_centavos(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.paid_quote_floor_centavos(UUID, UUID) TO authenticated;
COMMENT ON FUNCTION public.paid_quote_floor_centavos(UUID, UUID) IS
  'The paid quotation''s total in centavos — the floor no later version may go under — or NULL while no payment is confirmed (or the caller is not on this event or shop). Migration 20271332041210 (DECISION_LOG 2026-11-08 🧾).';

CREATE OR REPLACE FUNCTION public.tg_vendor_proposals_money_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- reads the floor through the internal quote_floor_of(), which no session may call itself
SET search_path = public
AS $$
DECLARE
  v_floor BIGINT;
  v_sum   BIGINT;
  v_n     INTEGER;
BEGIN
  IF NEW.status <> 'sent' OR NOT (
       TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM 'sent'
       OR NEW.total_centavos IS DISTINCT FROM OLD.total_centavos
       OR NEW.payment_schedule IS DISTINCT FROM OLD.payment_schedule) THEN
    RETURN NEW;
  END IF;

  -- 🧾 The paid quotation is the floor.
  v_floor := public.quote_floor_of(NEW.event_id, NEW.vendor_profile_id);
  IF v_floor IS NOT NULL AND NEW.total_centavos < v_floor THEN
    RAISE EXCEPTION 'vendor_proposals: QUOTE_BELOW_PAID_FLOOR — a new version may not go below the paid quotation'
      USING ERRCODE = '23514';
  END IF;

  -- 💳 The plan pays the whole amount.
  IF jsonb_typeof(NEW.payment_schedule -> 'installments') = 'array' THEN
    SELECT COALESCE(SUM((i ->> 'amount_centavos')::BIGINT), 0), COUNT(*)
      INTO v_sum, v_n
      FROM jsonb_array_elements(NEW.payment_schedule -> 'installments') AS i;
    IF v_n > 0 AND (
         v_sum <> NEW.total_centavos
         OR COALESCE((NEW.payment_schedule ->> 'over_by_centavos')::BIGINT, 0) > 0
         OR COALESCE((NEW.payment_schedule ->> 'credit_over_centavos')::BIGINT, 0) > 0) THEN
      RAISE EXCEPTION 'vendor_proposals: PLAN_DOES_NOT_PAY_IN_FULL — the payments must add up to the quote total'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_vendor_proposals_money_rules() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_proposals_money_rules ON public.vendor_proposals;
CREATE TRIGGER vendor_proposals_money_rules
  BEFORE INSERT OR UPDATE ON public.vendor_proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_vendor_proposals_money_rules();

-- (b) a change line may not take the agreed total under the paid headline.
CREATE OR REPLACE FUNCTION public.tg_change_lines_keep_the_paid_floor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum NUMERIC;
BEGIN
  IF NOT NEW.is_change_delta OR NEW.amount_php >= 0 THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
       SELECT 1 FROM public.event_vendor_payments p
        WHERE p.vendor_id = NEW.vendor_id
          AND p.vendor_confirmed_at IS NOT NULL
          AND p.payment_refused_at IS NULL) THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(SUM(li.amount_php), 0) INTO v_sum
    FROM public.event_vendor_line_items li
   WHERE li.vendor_id = NEW.vendor_id
     AND li.is_change_delta
     AND li.line_item_id IS DISTINCT FROM NEW.line_item_id;
  IF v_sum + NEW.amount_php < 0 THEN
    RAISE EXCEPTION 'event_vendor_line_items: CHANGE_BELOW_PAID_FLOOR — a change may not bring the price under what was paid for'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_change_lines_keep_the_paid_floor() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS change_lines_keep_the_paid_floor ON public.event_vendor_line_items;
CREATE TRIGGER change_lines_keep_the_paid_floor
  BEFORE INSERT OR UPDATE OF amount_php, is_change_delta ON public.event_vendor_line_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_change_lines_keep_the_paid_floor();

COMMIT;
