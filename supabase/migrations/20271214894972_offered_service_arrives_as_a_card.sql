-- ============================================================================
-- 20271214894972_offered_service_arrives_as_a_card.sql
-- Link a chat message to the vendor service it offers, so the offer renders as
-- the supplier's own card — cover photo, clip, price, what is included —
-- instead of a word in the "Inquiring about" chip row.
--
-- WHY THIS EXISTS
--   Owner 2026-09-09: "the service card of each service still needs that
--   photo/image/video." Offering a service recorded a thread_service_interests
--   row and NOTHING ELSE, so the couple's only evidence of the offer was one
--   chip. Measured on production the same day: BOTH live services have a NULL
--   `title`, so `interestChipLabel` fell back to the category key — a couple
--   being pitched a live band saw the words "Live band" and no photograph.
--   A couple choosing between three caterers is choosing on what they can see.
--
--   The marker is the SAME shape as the four that already ship — proposal_id
--   (20270225555952), appointment_id (20270920827160), change_order_id
--   (20270921698789) and amendment_id (20270924533987): a nullable FK plus a
--   partial index, rendered as a card by app/_components/chat-message-stream.
--   Purely additive; every existing row keeps NULL and the text path is
--   untouched.
--
-- ⚠ ON DELETE SET NULL, deliberately, and it MUST stay that way.
--   A retired service must not delete the conversation in which it was
--   pitched. The message survives with its body ("Kuya Ben offered <service>")
--   and simply stops rendering a card — the same degrade the other four
--   markers take.
--
-- 🔑 THE GRANT IS HALF THE CHANGE, NOT A FOOTNOTE.
--   `chat_messages` holds a TABLE-level SELECT for anon/authenticated (so a new
--   column is readable the moment it exists) but INSERT is granted PER COLUMN —
--   13 of 17 columns, measured 2026-09-09. Without the explicit INSERT grant
--   below, the vendor's own insert fails with a bare permission error and the
--   offer silently posts no card at all. All four existing markers carry this
--   grant; this one had to as well.
--
-- 🔑 THE COLUMN IS A CLAIM, NOT AN AUTHORISATION.
--   `authenticated` holding INSERT means a COUPLE can also name a service id on
--   their own message — including another supplier's. Nothing here can stop
--   that (RLS is row-level, never value-level), so the reader is what refuses:
--   lib/offered-service-card.ts serves a card ONLY when the service belongs to
--   the thread's own vendor_profile_id. Do not delete that check on the grounds
--   that "only the vendor writes this".
--
-- 🔢 SAFE BY ARITHMETIC: production holds 3 chat messages and 1 thread, and
--   thread_service_interests holds exactly one row (source='initial') —
--   ZERO services have ever been offered. Nothing to backfill.
--
-- IDEMPOTENT. Safe to (re-)apply.
-- ============================================================================

BEGIN;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS offered_service_id UUID
    REFERENCES public.vendor_services(vendor_service_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.chat_messages.offered_service_id IS
  'Set when this message offers one of the thread vendor''s own services — '
  'renders as the supplier''s service card (cover photo, clip, price, '
  'inclusions) in the message stream. Mirrors proposal_id / appointment_id / '
  'change_order_id / amendment_id. NULL on every other message. A card is '
  'served only when the service belongs to the thread''s vendor: the grant '
  'lets any party WRITE this id, so the reader is what refuses a foreign one.';

-- Partial index — only the handful of offer rows per thread.
CREATE INDEX IF NOT EXISTS chat_messages_offered_service_id_idx
  ON public.chat_messages (offered_service_id)
  WHERE offered_service_id IS NOT NULL;

-- See the docblock: INSERT on this table is per-column, so a new column has no
-- insert privilege until it is granted. SELECT is table-level and needs none.
GRANT INSERT (offered_service_id) ON public.chat_messages TO authenticated;

COMMIT;
