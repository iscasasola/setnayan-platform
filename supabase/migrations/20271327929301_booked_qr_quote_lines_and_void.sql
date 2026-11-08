-- ═══════════════════════════════════════════════════════════════════════════
-- THE BOOKED QR, COMPLETED — its quote lines, and the shop's own "delete".
-- (Supplier Build 2 row #34, owner 2026-11-08: *"this is a one-time QR… booked
-- card is incomplete. it needs to create a quotation… track and delete a QR"*.)
--
-- The Booked QR IS the shipped Locked QR (`vendor_locked_qr_tokens`, issued by
-- `issueLockedQr`, claimed once by `vendor_claim_locked_qr`). Two things were
-- missing, both named by the row as NEW server work:
--
-- 1 · QUOTE LINES STORED WITH THE TOKEN — `quote_line_items`.
--     The generator now builds the quotation in place (lines from the shop's
--     service cards + its own lines, editable prices, Total). Until now only the
--     Total survived (`total_php`); the lines that made it were thrown away.
--     🔑 SAME SHAPE AS EVERY OTHER QUOTE: `vendor_proposals.line_items`
--     (20261208006000) — `[{label, detail, amount_centavos}]`, read by
--     `lib/accepted-quote-terms.ts` (`QuoteLine`). No second line shape.
--     ⚖ NULLABLE, NO DEFAULT — the `service_card_ids` precedent (20271243019419):
--     `[]` would make every code issued before today assert "this deal had no
--     lines", which is false; NULL is the honest "never said".
--
-- 2 · THE VOID — `vendor_void_locked_qr(token)`.
--     The ledger has always read `status = 'void'` ("Deleted"), but no shipped
--     action ever wrote it. A shop deletes a waiting code (swipe left, with Undo —
--     the Undo is the client's delayed commit, `deleteWithUndo`, so the database
--     never needs an un-void), and CHANGING a waiting code is void + reissue (a
--     printed code cannot change; a scanned one is a booking).
--     SECURITY INVOKER: the shop's own `vendor_locked_qr_vendor_all` RLS decides
--     whose code it may touch — no new policy, no invented pattern. It answers in
--     words the page can say: 'void' · 'claimed' (already scanned — it is a
--     booking now, never deleted from here) · 'already_void' · 'not_found'.
--
-- 3 · A STATUS ONLY MOVES FORWARD — trigger `vendor_locked_qr_status_forward`.
--     `vendor_locked_qr_vendor_all` is FOR ALL, so a shop's own session could
--     always UPDATE `status` to anything: un-void a deleted code (a code the shop
--     was told is dead would book again) or void a CLAIMED one (the couple's
--     booking would lose the code that made it). Measured before writing this:
--     the only status write anywhere is pending → claimed, in the claim function
--     (`WHERE status = 'pending'`); the app never updates this table. So the
--     guard allows exactly pending → claimed and pending → void, and refuses
--     every other move, for every caller.
--
-- RLS: no new table. The column rides the existing vendor-org policy (asserted
-- in the db test, as `locked-qr-names-its-outside-booking` does for block_id).
-- Idempotent: IF NOT EXISTS / DROP … IF EXISTS / CREATE OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vendor_locked_qr_tokens
  ADD COLUMN IF NOT EXISTS quote_line_items JSONB,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

ALTER TABLE public.vendor_locked_qr_tokens
  DROP CONSTRAINT IF EXISTS vendor_locked_qr_quote_lines_is_array;
ALTER TABLE public.vendor_locked_qr_tokens
  ADD CONSTRAINT vendor_locked_qr_quote_lines_is_array
  CHECK (quote_line_items IS NULL OR jsonb_typeof(quote_line_items) = 'array');

COMMENT ON COLUMN public.vendor_locked_qr_tokens.quote_line_items IS
  'The quotation the Booked QR was built from: [{label, detail, amount_centavos}] — the vendor_proposals.line_items shape. NULL = issued before lines were kept (never said), not "no lines".';
COMMENT ON COLUMN public.vendor_locked_qr_tokens.voided_at IS
  'When the shop deleted (voided) this waiting code — vendor_void_locked_qr(). NULL while pending or claimed.';

-- ── 3 · A status only moves forward ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_locked_qr_status_forward()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'pending' AND NEW.status IN ('claimed', 'void')) THEN
    RAISE EXCEPTION 'A one-time code''s status only moves forward (% → % refused)', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_locked_qr_status_forward ON public.vendor_locked_qr_tokens;
CREATE TRIGGER vendor_locked_qr_status_forward
  BEFORE UPDATE OF status ON public.vendor_locked_qr_tokens
  FOR EACH ROW EXECUTE FUNCTION public.vendor_locked_qr_status_forward();

-- ── 2 · The shop's void ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_void_locked_qr(p_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  UPDATE public.vendor_locked_qr_tokens
     SET status = 'void', voided_at = NOW()
   WHERE token = p_token
     AND status = 'pending';
  IF FOUND THEN
    RETURN 'void';
  END IF;
  -- Not voided: say why. Under the caller's RLS another shop's code reads as not found.
  SELECT status INTO v_status FROM public.vendor_locked_qr_tokens WHERE token = p_token;
  IF v_status IS NULL THEN
    RETURN 'not_found';
  END IF;
  RETURN CASE v_status WHEN 'claimed' THEN 'claimed' ELSE 'already_void' END;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_void_locked_qr(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_void_locked_qr(TEXT) TO authenticated;

COMMENT ON FUNCTION public.vendor_void_locked_qr(TEXT) IS
  'Supplier Build 2 #34: the shop deletes (voids) one of its WAITING Booked QRs. Invoker rights — the vendor-org RLS decides whose. Returns void | claimed | already_void | not_found.';
