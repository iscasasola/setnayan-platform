-- ═══════════════════════════════════════════════════════════════════════════
-- SUPPLIER BUILD 2 · LANE E — three server pieces, one migration.
-- Created via `pnpm migration:new`. Idempotent: ADD COLUMN IF NOT EXISTS ·
-- CREATE TABLE IF NOT EXISTS (+ RLS in this same migration) · DROP … IF EXISTS
-- before every CREATE · CREATE OR REPLACE FUNCTION. Every ALTER comes before
-- anything that writes (there is no UPDATE of existing rows here at all).
--
-- 1 · WHO A BOOKED QR IS FOR — `vendor_locked_qr_tokens.client_name`.
--     Row #34's leftover: the Booked QRs list names a code by its deal words
--     ("Full-day coverage"), so two codes for two couples read the same. The
--     generator now asks "Client name". NULLABLE, no default: every code issued
--     before today never said, and NULL is that honest answer.
--
-- 2 · CLAIMING A CODE COPIES ITS QUOTE LINES ONTO THE COUPLE'S QUOTATION.
--     DECISION_LOG 2026-11-03, "A BOOKED QR CARRIES THE WHOLE PURCHASE": *"On
--     scan, the couple's event links as booked with all of it (services,
--     price, plan, paid amount, gifts)."* The lines were stored on the token
--     (20271327929301) and thrown away at the scan. The couple's quotation is
--     an ACCEPTED `vendor_proposals` row (`lib/accepted-quote-terms.ts`, rule 1
--     "Only an ACCEPTED quote states terms"; rule 4 "the quote IS the price").
--     So the claim now writes one, step (c2):
--       · the lines are COPIED, byte for byte — `t.quote_line_items` (already
--         the `vendor_proposals.line_items` shape, `[{label, detail,
--         amount_centavos}]`). Nothing is computed: the total is the token's
--         own `total_php` (which `issueLockedQr` stored as the lines' sum) in
--         centavos. No lines (a code from before #34) → nothing is written;
--         a quote made up from the Total alone would be a quote nobody wrote.
--       · IDEMPOTENT TWICE OVER: the claim's own early return already stops a
--         re-scan (`already_claimed`), and the new
--         `vendor_proposals.locked_qr_token_id` is UNIQUE, so the INSERT is
--         `ON CONFLICT DO NOTHING` — a re-run can never write a second copy.
--       · ONE ACCEPTED QUOTE PER EVENT × SHOP (rule 1; the readers take
--         `.eq('status','accepted').limit(1)` with no order, so two would be
--         read at random). The shop's earlier sent / viewed / accepted quotes
--         on this event are retired to 'superseded' first — the same move
--         `supersede_prior_vendor_proposals` makes when a revised quote is
--         accepted. The Booked QR carries the whole purchase, so it IS the deal.
--     `CREATE OR REPLACE` restates the WHOLE body of `vendor_claim_locked_qr`
--     (20271174880981, the last to define it). Every earlier rule is carried
--     word for word: the COALESCE on `source`, the link stamp on both columns,
--     step (e) after the date narrowing and its degrade-open EXCEPTION block.
--     Pinned by `tests/db/booked-qr-claim-copies-the-quote.db.test.ts`.
--
-- 3 · A SUPPLIER RECORDS A REFUND THEY GAVE A CLIENT — `event_vendor_refunds`.
--     ⚖ WHY NOT `event_vendor_payments` (the brief's first choice, measured):
--       · `amount_php` is `CHECK (amount_php > 0)` and the table has no kind;
--       · it is the COUPLE's table (couple-RLS writes; the supplier only
--         confirms via `confirm_vendor_payment`), and at least fourteen readers
--         SUM it as money received (budget-truth, vendor-earnings, payday,
--         booked-money-step, preparation, the cashflow RPCs, the data export…).
--         A positive "refund" row would be counted by every one of them as a
--         PAYMENT; a negative one would need the check dropped and would print
--         "₱-5,000 paid" in each list that draws rows.
--     So the smallest safe change is a sibling ledger the existing readers do
--     not see, read only where a refund is meant to be drawn.
--     NO MONEY MOVES. It is a record, exactly like a logged payment.
--     WRITES go through two SECURITY DEFINER functions (the
--     `confirm_vendor_payment` shape — ownership re-checked inside, auth.uid()
--     the recorder); the table grants authenticated SELECT only:
--       · `vendor_record_client_refund` — amount · date · reason · optional
--         proof; ONLY for a booking of the caller's own shop (by
--         `marketplace_vendor_id`, never an agent's assigned service); never
--         more than the payments the shop has CONFIRMED received, less what it
--         already refunded; a `p_request_id` makes a double tap one row;
--       · `vendor_remove_client_refund` — the swipe-left (its Undo is the
--         client's delayed commit, `deleteWithUndo`, so the database never
--         needs an un-remove). The row is kept, stamped `removed_at`: money
--         history is never hard-deleted.
--     READS (canonical patterns, no invented one): the recording shop
--     (`current_vendor_profile_ids`), the couple (`current_couple_event_ids` —
--     the same arm as `event_vendor_payments_couple_read`), and console admins.
--     anon: nothing.
--     The money follows its booking exactly as `event_vendor_payments` does
--     (20271153200818): a composite FK to `event_vendors(event_id, vendor_id)`
--     ON UPDATE CASCADE, so a preserved booking keeps its refunds.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Who the code is for ─────────────────────────────────────────────────
ALTER TABLE public.vendor_locked_qr_tokens
  ADD COLUMN IF NOT EXISTS client_name TEXT;

ALTER TABLE public.vendor_locked_qr_tokens
  DROP CONSTRAINT IF EXISTS vendor_locked_qr_client_name_len;
ALTER TABLE public.vendor_locked_qr_tokens
  ADD CONSTRAINT vendor_locked_qr_client_name_len
  CHECK (client_name IS NULL OR length(btrim(client_name)) BETWEEN 1 AND 120);

COMMENT ON COLUMN public.vendor_locked_qr_tokens.client_name IS
  'Who the Booked QR is for, as the shop typed it ("Ana & Ben"). NULL = issued before the field existed (never said).';

-- ── 2a · Which Booked QR a quote came from ──────────────────────────────────
ALTER TABLE public.vendor_proposals
  ADD COLUMN IF NOT EXISTS locked_qr_token_id BIGINT;

ALTER TABLE public.vendor_proposals
  DROP CONSTRAINT IF EXISTS vendor_proposals_locked_qr_token_fk;
ALTER TABLE public.vendor_proposals
  ADD CONSTRAINT vendor_proposals_locked_qr_token_fk
  FOREIGN KEY (locked_qr_token_id) REFERENCES public.vendor_locked_qr_tokens(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_proposals_locked_qr_token_uniq
  ON public.vendor_proposals (locked_qr_token_id)
  WHERE locked_qr_token_id IS NOT NULL;

COMMENT ON COLUMN public.vendor_proposals.locked_qr_token_id IS
  'The Booked QR (vendor_locked_qr_tokens.id) this accepted quote was copied from at the couple''s scan — vendor_claim_locked_qr step (c2). UNIQUE: one code writes one quote, however often the claim runs. NULL for every quote written in the conversation.';

-- ── 2a' · Only the claim writes it ──────────────────────────────────────────
-- The column inherits the table's browser grants (RLS is row-level; a column
-- cannot be revoked out of a table-level grant), and a shop may write its own
-- draft quotes. Unguarded, a shop could stamp ANOTHER shop's token id (the FK
-- checks only that it exists) onto its own draft — and the UNIQUE index would
-- then make that shop's real claim write NO quote (`ON CONFLICT DO NOTHING`).
-- So a browser role may never set or change it; the SECURITY DEFINER claim
-- (current_user = its owner) is the one writer. Same shape as
-- `a_taken_down_card_stays_down` (20271309211124).
CREATE OR REPLACE FUNCTION public.a_quote_names_its_booked_qr_only_by_the_claim()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.locked_qr_token_id IS NOT NULL THEN
        RAISE EXCEPTION 'Only a Booked QR claim can mark a quote as copied from it.'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    ELSIF NEW.locked_qr_token_id IS DISTINCT FROM OLD.locked_qr_token_id THEN
      RAISE EXCEPTION 'Only a Booked QR claim can mark a quote as copied from it.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.a_quote_names_its_booked_qr_only_by_the_claim() IS
  'vendor_proposals.locked_qr_token_id is written only by vendor_claim_locked_qr (SECURITY DEFINER); a browser role may not set or change it. 20271328327292.';

DROP TRIGGER IF EXISTS a_quote_names_its_booked_qr_only_by_the_claim ON public.vendor_proposals;
CREATE TRIGGER a_quote_names_its_booked_qr_only_by_the_claim
  BEFORE INSERT OR UPDATE ON public.vendor_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.a_quote_names_its_booked_qr_only_by_the_claim();

REVOKE ALL ON FUNCTION public.a_quote_names_its_booked_qr_only_by_the_claim() FROM PUBLIC, anon, authenticated;

-- ── 2b · The claim, whole, with step (c2) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_claim_locked_qr(p_token text, p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid        UUID := auth.uid();
  t            public.vendor_locked_qr_tokens%ROWTYPE;
  v_vendor     public.vendor_profiles%ROWTYPE;
  v_event_date DATE;
  v_ev_id      UUID;
  v_instances  JSONB;
  v_pool_id    UUID;
  v_acq        JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  SELECT * INTO t FROM public.vendor_locked_qr_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF t.status = 'void' THEN
    RETURN jsonb_build_object('status', 'void');
  END IF;

  -- Idempotent re-scan by the same claimer -> report the existing lock, don't
  -- double-apply. A different user hitting a consumed token -> 'taken'.
  IF t.status = 'claimed' THEN
    IF t.claimed_by_user_id = v_uid THEN
      RETURN jsonb_build_object(
        'status', 'already_claimed',
        'event_id', t.claimed_event_id,
        'event_vendor_id', t.claimed_event_vendor_id
      );
    END IF;
    RETURN jsonb_build_object('status', 'taken');
  END IF;

  -- Ownership: the target event must be one the claimer hosts.
  IF p_event_id NOT IN (SELECT public.current_event_ids()) THEN
    RETURN jsonb_build_object('status', 'not_your_event');
  END IF;

  -- Race-safe single-use bind: only one caller can flip pending->claimed.
  UPDATE public.vendor_locked_qr_tokens
     SET status             = 'claimed',
         claimed_by_user_id = v_uid,
         claimed_event_id   = p_event_id,
         claimed_at         = NOW()
   WHERE token = p_token AND status = 'pending'
  RETURNING * INTO t;
  IF NOT FOUND THEN
    -- Someone else won the race between our read and this update.
    RETURN jsonb_build_object('status', 'taken');
  END IF;

  SELECT * INTO v_vendor
    FROM public.vendor_profiles WHERE vendor_profile_id = t.vendor_profile_id;

  -- (d0) Finalize the agreed wedding date (owner 2026-07). The precision moves
  --      with the date ('day'); date_status is left to sync_event_date_status_trg.
  --      /!\ STEP (e) DEPENDS ON THIS ONE — see 20271174880981.
  IF t.event_date IS NOT NULL THEN
    UPDATE public.events
       SET event_date           = t.event_date,
           event_date_precision = 'day',
           date_candidates      = NULL,
           date_window_start    = NULL,
           date_window_end      = NULL,
           date_mode            = NULL,
           updated_at           = NOW()
     WHERE event_id = p_event_id;
  END IF;

  -- (a) Lock the vendor onto the event (both shop columns stamped).
  SELECT vendor_id INTO v_ev_id
    FROM public.event_vendors
   WHERE event_id = p_event_id AND marketplace_vendor_id = t.vendor_profile_id
   LIMIT 1;

  IF v_ev_id IS NULL THEN
    INSERT INTO public.event_vendors (
      event_id, marketplace_vendor_id, linked_vendor_profile_id, category, vendor_name,
      status, source, total_cost_php, notes
    ) VALUES (
      p_event_id, t.vendor_profile_id, t.vendor_profile_id, t.category::public.vendor_category, v_vendor.business_name,
      'deposit_paid', 'vendor_locked_qr', t.total_php, t.service_description
    )
    RETURNING vendor_id INTO v_ev_id;
  ELSE
    -- A lock is a change of STATUS, never a rewrite of how they found each
    -- other: COALESCE keeps the original source (owner rule 2026-08-09).
    UPDATE public.event_vendors
       SET status         = 'deposit_paid',
           source         = COALESCE(source, 'vendor_locked_qr'),
           linked_vendor_profile_id =
             COALESCE(linked_vendor_profile_id, t.vendor_profile_id),
           total_cost_php = COALESCE(t.total_php, total_cost_php),
           category       = t.category::public.vendor_category,
           notes          = COALESCE(t.service_description, notes)
     WHERE vendor_id = v_ev_id;
  END IF;

  -- (b) Freeze the payment plan from the schedule template.
  SELECT event_date INTO v_event_date FROM public.events WHERE event_id = p_event_id;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'seq',         (item->>'seq')::INT,
             'label',       item->>'label',
             'amount_kind', COALESCE(item->>'amount_kind', 'fixed'),
             'amount_php',  CASE
               WHEN item->>'amount_kind' = 'percent'
                 THEN ROUND(COALESCE(t.total_php, 0) * (item->>'amount_value')::NUMERIC / 100.0, 2)
               ELSE ROUND((item->>'amount_value')::NUMERIC, 2)
             END,
             'due_date',    CASE
               WHEN NULLIF(item->>'due_date', '') IS NOT NULL
                 THEN item->>'due_date'
               WHEN item->>'due_anchor' = 'on_lock'
                 THEN to_char(CURRENT_DATE + COALESCE((item->>'due_offset_days')::INT, 0), 'YYYY-MM-DD')
               WHEN item->>'due_anchor' = 'before_event' AND v_event_date IS NOT NULL
                 THEN to_char(v_event_date - COALESCE((item->>'due_offset_days')::INT, 0), 'YYYY-MM-DD')
               ELSE NULL
             END
           )
           ORDER BY (item->>'seq')::INT
         ), '[]'::jsonb)
    INTO v_instances
    FROM jsonb_array_elements(t.schedule_json) AS item;

  INSERT INTO public.event_vendor_payment_plan (event_id, event_vendor_id, instances_json)
  VALUES (p_event_id, v_ev_id, v_instances)
  ON CONFLICT (event_id, event_vendor_id)
  DO UPDATE SET instances_json = EXCLUDED.instances_json, updated_at = NOW();

  -- (c) Record the downpayment already received off-platform.
  IF COALESCE(t.initial_paid_php, 0) > 0 THEN
    INSERT INTO public.event_vendor_payments (
      event_id, vendor_id, amount_php, method, reference, notes,
      schedule_instance_seq, vendor_confirmed_at, vendor_confirmed_by
    ) VALUES (
      p_event_id, v_ev_id, t.initial_paid_php, 'qr_lock', t.public_id,
      'Downpayment recorded from Locked QR',
      1, NOW(), t.created_by_user_id
    );
  END IF;

  -- (c2) THE QUOTATION THE CODE CARRIES (Supplier Build 2 lane E; DECISION_LOG
  --      2026-11-03 "A BOOKED QR CARRIES THE WHOLE PURCHASE"). The token's lines
  --      are copied as stored — never computed, never priced here — into ONE
  --      accepted quote for this event × shop. A code without lines (issued
  --      before #34) writes nothing. The shop's earlier live quotes on this
  --      event are retired first, so exactly one accepted quote states the deal.
  --      `locked_qr_token_id` is UNIQUE: a re-run writes no second copy.
  IF t.quote_line_items IS NOT NULL
     AND jsonb_typeof(t.quote_line_items) = 'array'
     AND jsonb_array_length(t.quote_line_items) > 0
     AND t.total_php IS NOT NULL THEN
    UPDATE public.vendor_proposals
       SET status = 'superseded', updated_at = NOW()
     WHERE event_id = p_event_id
       AND vendor_profile_id = t.vendor_profile_id
       AND status IN ('sent', 'viewed', 'accepted')
       AND locked_qr_token_id IS DISTINCT FROM t.id;

    INSERT INTO public.vendor_proposals (
      vendor_profile_id, event_id, title, line_items, total_centavos,
      status, sent_at, resolved_at, resolved_by_user_id, locked_qr_token_id
    ) VALUES (
      t.vendor_profile_id, p_event_id,
      left(COALESCE(NULLIF(btrim(t.service_description), ''), 'Booked QR'), 160),
      t.quote_line_items, ROUND(t.total_php * 100)::BIGINT,
      'accepted', NOW(), NOW(), v_uid, t.id
    )
    ON CONFLICT (locked_qr_token_id) WHERE locked_qr_token_id IS NOT NULL DO NOTHING;
  END IF;

  -- (d) Backfill the resolved booking onto the token for the audit trail.
  UPDATE public.vendor_locked_qr_tokens
     SET claimed_event_vendor_id = v_ev_id
   WHERE id = t.id;

  -- (e) Reserve the date on the vendor's schedule. THE ONE RULE HERE: this
  --     step may never refuse the claim — the money has already moved. The
  --     EXCEPTION block opens a subtransaction so an error rolls back the
  --     reservation and NOTHING ELSE.
  BEGIN
    v_pool_id := public.resolve_schedule_pool(t.vendor_profile_id, t.category);
    IF v_pool_id IS NOT NULL THEN
      v_acq := public.acquire_schedule_pools(p_event_id, v_ev_id, ARRAY[v_pool_id]);
      IF COALESCE(v_acq->>'status', 'error') <> 'ok' THEN
        RAISE WARNING '[locked-qr] schedule NOT reserved (degrading open): status=% event_vendor_id=% pool_id=% event_id=%',
          COALESCE(v_acq->>'status', 'error'), v_ev_id, v_pool_id, p_event_id;
      END IF;
    ELSE
      RAISE WARNING '[locked-qr] no schedule pool for category % on vendor % — booking holds no date (degrading open): event_vendor_id=%',
        t.category, t.vendor_profile_id, v_ev_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[locked-qr] schedule reservation errored (degrading open): % — event_vendor_id=% event_id=%',
      SQLERRM, v_ev_id, p_event_id;
  END;

  RETURN jsonb_build_object(
    'status', 'ok',
    'event_id', p_event_id,
    'event_vendor_id', v_ev_id
  );
END;
$function$;

COMMENT ON FUNCTION public.vendor_claim_locked_qr(text, uuid) IS
  'Claim a vendor Locked-QR (Booked QR) token onto an event the caller hosts. Single-use and '
  'race-safe. Writes BOTH marketplace_vendor_id and linked_vendor_profile_id (the UPDATE arm '
  'COALESCEs). event_vendors.source is written ONLY when inserting a new row (owner rule '
  '2026-08-09). Step (c2): the code''s stored quote lines are copied, as stored, into ONE '
  'accepted vendor_proposals row (locked_qr_token_id UNIQUE — a re-run writes no copy), after '
  'the shop''s earlier live quotes on the event are superseded. The schedule acquire is step (e), '
  'after the date-precision narrowing, and degrades OPEN.';

-- ── 3 · A refund the supplier gave a client ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_vendor_refunds (
  refund_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The booking — and so the client — it went back to.
  event_id             UUID REFERENCES public.events(event_id) ON DELETE CASCADE,
  event_vendor_id      UUID NOT NULL,
  -- The shop that gave it (and recorded it).
  vendor_profile_id    UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  amount_php           NUMERIC(12,2) NOT NULL CHECK (amount_php > 0),
  refunded_on          DATE NOT NULL,
  reason               TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 240),
  proof_r2_key         TEXT CHECK (proof_r2_key IS NULL OR length(proof_r2_key) <= 512),
  -- A double tap is one row: the page sends one id per sheet it opens.
  request_id           UUID UNIQUE,
  -- Nullable: an actor stamp RA 10173 erasure nulls (lib/erasure/coverage.ts AUTHOR_UUID_NULLS); the record stays.
  recorded_by_user_id  UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Swipe-left "remove": kept as history, never hard-deleted.
  removed_at           TIMESTAMPTZ,
  removed_by_user_id   UUID,
  CONSTRAINT event_vendor_refunds_booking_fk
    FOREIGN KEY (event_id, event_vendor_id)
    REFERENCES public.event_vendors(event_id, vendor_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS event_vendor_refunds_booking_idx
  ON public.event_vendor_refunds (event_vendor_id, refunded_on DESC);
CREATE INDEX IF NOT EXISTS event_vendor_refunds_shop_idx
  ON public.event_vendor_refunds (vendor_profile_id, refunded_on DESC);
CREATE INDEX IF NOT EXISTS event_vendor_refunds_event_idx
  ON public.event_vendor_refunds (event_id);

ALTER TABLE public.event_vendor_refunds ENABLE ROW LEVEL SECURITY;

-- Reads only. Every write is one of the two functions below.
REVOKE ALL ON public.event_vendor_refunds FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.event_vendor_refunds FROM authenticated;
GRANT SELECT ON public.event_vendor_refunds TO authenticated;

DROP POLICY IF EXISTS event_vendor_refunds_vendor_read ON public.event_vendor_refunds;
CREATE POLICY event_vendor_refunds_vendor_read
  ON public.event_vendor_refunds FOR SELECT
  TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS event_vendor_refunds_couple_read ON public.event_vendor_refunds;
CREATE POLICY event_vendor_refunds_couple_read
  ON public.event_vendor_refunds FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_vendor_refunds_admin_read ON public.event_vendor_refunds;
CREATE POLICY event_vendor_refunds_admin_read
  ON public.event_vendor_refunds FOR SELECT
  TO authenticated
  -- Wrapped as `(select …)`: asked once per statement, not once per row (policies-ask-once-per-query).
  USING ((SELECT public.is_console_admin()));

COMMENT ON TABLE public.event_vendor_refunds IS
  'A refund a supplier gave one of its clients, recorded by the supplier (Supplier Build 2 lane E). A RECORD — no money moves, like a logged payment. Kept apart from event_vendor_payments on purpose: that table is summed as money RECEIVED by many readers and refuses amounts <= 0. Writes only through vendor_record_client_refund / vendor_remove_client_refund; read by the shop, the couple and console admins.';

-- ── 3a · Record one ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_record_client_refund(
  p_event_vendor_id UUID,
  p_amount_php      NUMERIC,
  p_refunded_on     DATE,
  p_reason          TEXT,
  p_proof_r2_key    TEXT DEFAULT NULL,
  p_request_id      UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_event_id  UUID;
  v_shop      UUID;
  v_existing  UUID;
  v_received  NUMERIC;
  v_refunded  NUMERIC;
  v_id        UUID;
  v_reason    TEXT := btrim(COALESCE(p_reason, ''));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  -- A double tap: the same sheet's id answers with the row it already wrote.
  IF p_request_id IS NOT NULL THEN
    SELECT refund_id INTO v_existing FROM public.event_vendor_refunds WHERE request_id = p_request_id;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'ok', 'refund_id', v_existing, 'repeat', true);
    END IF;
  END IF;

  -- Only a booking of the caller's OWN shop — the shop column, never an agent's
  -- assigned service.
  SELECT ev.event_id, ev.marketplace_vendor_id INTO v_event_id, v_shop
    FROM public.event_vendors ev
   WHERE ev.vendor_id = p_event_vendor_id
     AND ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids());
  IF v_shop IS NULL OR v_event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_your_client');
  END IF;

  IF p_amount_php IS NULL OR p_amount_php <= 0 THEN
    RETURN jsonb_build_object('status', 'amount');
  END IF;
  IF length(v_reason) = 0 OR length(v_reason) > 240 THEN
    RETURN jsonb_build_object('status', 'reason');
  END IF;
  IF p_refunded_on IS NULL OR p_refunded_on > (NOW() AT TIME ZONE 'Asia/Manila')::DATE THEN
    RETURN jsonb_build_object('status', 'date');
  END IF;

  -- Never more than the shop said it received, less what it already gave back.
  SELECT COALESCE(SUM(amount_php), 0) INTO v_received
    FROM public.event_vendor_payments
   WHERE vendor_id = p_event_vendor_id
     AND vendor_confirmed_at IS NOT NULL
     AND payment_refused_at IS NULL;
  SELECT COALESCE(SUM(amount_php), 0) INTO v_refunded
    FROM public.event_vendor_refunds
   WHERE event_vendor_id = p_event_vendor_id
     AND removed_at IS NULL;
  IF ROUND(p_amount_php, 2) > v_received - v_refunded THEN
    RETURN jsonb_build_object('status', 'more_than_received', 'left_php', GREATEST(v_received - v_refunded, 0));
  END IF;

  INSERT INTO public.event_vendor_refunds (
    event_id, event_vendor_id, vendor_profile_id, amount_php, refunded_on, reason,
    proof_r2_key, request_id, recorded_by_user_id
  ) VALUES (
    v_event_id, p_event_vendor_id, v_shop, ROUND(p_amount_php, 2), p_refunded_on, v_reason,
    NULLIF(btrim(COALESCE(p_proof_r2_key, '')), ''), p_request_id, v_uid
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING refund_id INTO v_id;

  IF v_id IS NULL THEN
    SELECT refund_id INTO v_id FROM public.event_vendor_refunds WHERE request_id = p_request_id;
    RETURN jsonb_build_object('status', 'ok', 'refund_id', v_id, 'repeat', true);
  END IF;
  RETURN jsonb_build_object('status', 'ok', 'refund_id', v_id, 'event_id', v_event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_record_client_refund(UUID, NUMERIC, DATE, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_record_client_refund(UUID, NUMERIC, DATE, TEXT, TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.vendor_record_client_refund(UUID, NUMERIC, DATE, TEXT, TEXT, UUID) IS
  'Supplier Build 2 lane E: the shop records a refund it gave a client of its OWN (event_vendors.marketplace_vendor_id). No money moves. Refuses an amount above confirmed payments less earlier refunds. Returns {status: ok | unauthenticated | not_your_client | amount | reason | date | more_than_received}.';

-- ── 3b · Remove one (the swipe left) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_remove_client_refund(p_refund_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_removed TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'unauthenticated';
  END IF;
  UPDATE public.event_vendor_refunds
     SET removed_at = NOW(), removed_by_user_id = v_uid
   WHERE refund_id = p_refund_id
     AND removed_at IS NULL
     AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids());
  IF FOUND THEN
    RETURN 'removed';
  END IF;
  SELECT removed_at INTO v_removed
    FROM public.event_vendor_refunds
   WHERE refund_id = p_refund_id
     AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids());
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  RETURN 'already_removed';
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_remove_client_refund(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_remove_client_refund(UUID) TO authenticated;

COMMENT ON FUNCTION public.vendor_remove_client_refund(UUID) IS
  'Supplier Build 2 lane E: the shop removes (stamps removed_at — never deletes) one refund it recorded. Returns removed | already_removed | not_found | unauthenticated.';
