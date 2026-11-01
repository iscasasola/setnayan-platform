-- locked_qr_names_its_outside_booking
--
-- WHAT A PERSON GETS: on Customers › People, a customer the supplier booked
-- OUTSIDE Setnayan (a `vendor_calendar_blocks` row, `block_source =
-- 'external_client'`) holds THEIR one-time code — "Send their code", then
-- "Code sent", then "Linked" once they scan it (owner 2026-10-28, DECISION_LOG
-- "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE",
-- CUSTOMERS: "a booked-outside customer's row holds THEIR one-time code
-- ('Send their code'; Linked / Code sent / Not linked), also offered right
-- after Add outside booking").
--
-- THE GAP: the one-time code already ships — it IS the Locked QR
-- (`vendor_locked_qr_tokens`, single-use, claimed by `vendor_claim_locked_qr`,
-- `status` pending → claimed). But a token said nothing about WHICH outside
-- booking it was made for, so a row could not honestly say whether its own
-- customer had a code, or had used it. Matching on the date would be a guess
-- (two outside bookings may share a day), so this adds the one fact that was
-- missing: the outside booking a code was made for.
--
--   · `block_id` — nullable (every existing token, and every token made from
--     the QR page without a customer, has none). ON DELETE SET NULL: removing
--     the outside booking never deletes a code that may already have moved
--     money; the code simply stops naming a row.
--   · A trigger refuses a `block_id` that is not THIS shop's own outside
--     booking — a code can never be filed under somebody else's customer, nor
--     under a day off or a Setnayan booking.
--
-- RLS: unchanged — the table's vendor-org policy (`vendor_locked_qr_vendor_all`)
-- already gates every row on `vendor_profile_id`; the new column rides it.
-- `vendor_claim_locked_qr` is NOT touched (it neither reads nor writes the
-- column) — the claim flips `status`, which is what "Linked" reads.

ALTER TABLE public.vendor_locked_qr_tokens
  ADD COLUMN IF NOT EXISTS block_id UUID
    REFERENCES public.vendor_calendar_blocks(block_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vendor_locked_qr_tokens.block_id IS
  'The outside booking (vendor_calendar_blocks, block_source = external_client, same shop) this one-time code was made for — Customers › People shows Linked / Code sent / Not linked from it. Null = made without a customer. ON DELETE SET NULL.';

CREATE INDEX IF NOT EXISTS vendor_locked_qr_tokens_block_idx
  ON public.vendor_locked_qr_tokens (block_id)
  WHERE block_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.vendor_locked_qr_block_is_own_outside()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.block_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.vendor_calendar_blocks b
     WHERE b.block_id = NEW.block_id
       AND b.vendor_profile_id = NEW.vendor_profile_id
       AND b.block_source = 'external_client'
  ) THEN
    RAISE EXCEPTION 'block_id must be this shop''s own outside booking'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_locked_qr_block_is_own_outside() FROM PUBLIC;

DROP TRIGGER IF EXISTS vendor_locked_qr_block_is_own_outside ON public.vendor_locked_qr_tokens;
CREATE TRIGGER vendor_locked_qr_block_is_own_outside
  BEFORE INSERT OR UPDATE OF block_id, vendor_profile_id ON public.vendor_locked_qr_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.vendor_locked_qr_block_is_own_outside();
