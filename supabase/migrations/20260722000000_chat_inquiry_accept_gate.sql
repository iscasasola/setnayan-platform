-- ============================================================================
-- Chat inquiry accept-gate
-- CLAUDE.md 2026-06-02 — owner: "the chat will only reveal when the vendor
-- accepts the inquiry."
--
-- BEFORE: a couple→vendor first contact opened a chat thread immediately and
-- the couple could keep messaging; the vendor's name revealed on their first
-- reply.
-- AFTER : a thread starts PENDING (the couple's inquiry sits waiting). The
-- vendor ACCEPTS — the chat opens both ways and the vendor's name reveals — or
-- DECLINES — the couple is told and shown alternatives. Reveal moves from
-- first-reply to accept (the canonical direction per
-- project_setnayan_vendor_hybrid_anonymity; the existing first-reply trigger
-- stays as an idempotent backstop).
--
-- Existing live threads backfill to 'accepted' so in-flight conversations are
-- never retroactively gated.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. chat_inquiry_status enum
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.chat_inquiry_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. chat_threads columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS inquiry_status public.chat_inquiry_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS accepted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decline_reason TEXT;

COMMENT ON COLUMN public.chat_threads.inquiry_status IS
  'Accept-gate per CLAUDE.md 2026-06-02. pending = couple sent an inquiry, vendor has not accepted (chat is closed to further couple messages, vendor name hidden); accepted = vendor accepted (chat open both ways, name revealed via reveal_vendor_name_on_accept); declined = vendor declined (couple shown alternatives). New threads default ''pending''; the vendor flips it via the acceptInquiry / declineInquiry server actions.';

-- ----------------------------------------------------------------------------
-- 3. Backfill — every PRE-MIGRATION thread is a live conversation; keep it open.
--    (The ADD COLUMN above set all existing rows to the default 'pending';
--     flip them back to 'accepted' so the gate only applies to NEW threads.)
-- ----------------------------------------------------------------------------
UPDATE public.chat_threads
   SET inquiry_status = 'accepted',
       accepted_at = COALESCE(accepted_at, created_at)
 WHERE inquiry_status = 'pending';

-- ----------------------------------------------------------------------------
-- 4. Index — vendor inbox lists pending inquiries; couple list filters by state.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS chat_threads_vendor_inquiry_status_idx
  ON public.chat_threads(vendor_profile_id, inquiry_status);

-- ----------------------------------------------------------------------------
-- 5. Reveal-on-accept trigger
--    Mirrors reveal_vendor_name_on_first_reply (20260530010000): when a thread
--    flips to 'accepted', stamp the vendor's name_revealed_at if still NULL.
--    Idempotent (IS NULL gate). With the accept-gate a vendor cannot reply
--    before accepting, so accept is now the canonical reveal moment; the
--    first-reply trigger remains as a harmless backstop for already-accepted
--    (backfilled) threads.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reveal_vendor_name_on_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.inquiry_status = 'accepted'
     AND OLD.inquiry_status IS DISTINCT FROM 'accepted' THEN
    UPDATE public.vendor_profiles
       SET name_revealed_at = NOW()
     WHERE vendor_profile_id = NEW.vendor_profile_id
       AND name_revealed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reveal_vendor_name_on_accept() IS
  'Hybrid-anonymity reveal trigger per CLAUDE.md 2026-06-02 accept-gate. Fires on chat_threads UPDATE OF inquiry_status · when a thread transitions to ''accepted'' and the vendor''s name_revealed_at IS NULL, stamps name_revealed_at = NOW(). Idempotent. Moves the canonical reveal from first-reply to accept; cross-ref project_setnayan_vendor_hybrid_anonymity.';

DROP TRIGGER IF EXISTS reveal_vendor_name_on_thread_accept ON public.chat_threads;
CREATE TRIGGER reveal_vendor_name_on_thread_accept
  AFTER UPDATE OF inquiry_status ON public.chat_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.reveal_vendor_name_on_accept();

-- ----------------------------------------------------------------------------
-- 6. notification_type enum — accept / decline outcomes (consumed by the
--    acceptInquiry / declineInquiry server actions; not referenced here).
-- ----------------------------------------------------------------------------
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'inquiry_accepted';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'inquiry_declined';
