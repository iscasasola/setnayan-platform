-- Booking Fee · PR-0 — Attribution: add 'explore' and 'search' to inquiry_source.
--
-- The Booking Fee is only owed on Setnayan-SOURCED bookings; imports are free
-- forever (model doc §3.0e). Today an organic marketplace discovery is
-- indistinguishable from a bare direct hit — both land as inquiry_source = NULL —
-- because the Explore/Search cards link to /v/[slug] with no ?src=, and the two
-- marketplace origins have no enum values. You cannot bill a fee you cannot
-- attribute, so this is the first slice (Booking_Fee_Build_Plan §PR-0).
--
-- Purely additive: two new allowed values on chat_threads.inquiry_source. Existing
-- rows (incl. NULL) are untouched — NULL stays "not billable", never retro-billed.
-- The CHECK is currently auto-named chat_threads_inquiry_source_check (it was added
-- inline with the column in 20270819553697), so we drop-if-exists then re-add.

ALTER TABLE public.chat_threads
  DROP CONSTRAINT IF EXISTS chat_threads_inquiry_source_check;

ALTER TABLE public.chat_threads
  ADD CONSTRAINT chat_threads_inquiry_source_check
  CHECK (inquiry_source IN (
    'shortlist', 'first_pick', 'favorites', 'influencer', 'website',
    'editorial', 'auto_build', 'degree',
    'explore', 'search'
  ));

COMMENT ON COLUMN public.chat_threads.inquiry_source IS
  'Marketplace attribution of the thread (NULL = direct/website default). '
  'explore/search = organic marketplace discovery (Booking-Fee SOURCED); '
  'imports (NULL, host_manual, invite_claim) are free forever. Stamped once on a '
  'brand-new thread via stampThreadProvenance (service-role); '
  'guard_thread_provenance_columns_trg blocks later edits by non-privileged callers.';
