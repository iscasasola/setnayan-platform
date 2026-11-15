-- ============================================================================
-- 20271345227050_shop_page_inquiry_is_setnayan_sourced.sql
--
-- 💳 OWNER RULING 2026-11-13 (specs DECISION_LOG, "BOOKING FEE — THE SUPPLIER'S
-- PERSONAL QR IS FREE; THEIR SHOP PAGE ('THEIR WEBSITE') IS CHARGED"):
--   a couple who arrives through the supplier's PERSONAL QR / own link is the
--   supplier's own client → no fee; a couple who finds and books them through
--   their Setnayan SHOP PAGE (setnayan.com/{slug}) is Setnayan-sourced → fee.
--   "Build must VERIFY the shipped attribution tells a QR/invite arrival apart
--   from an organic shop-page visit … if both land on the same page untagged,
--   the QR needs a tag."
--
-- MEASURED (walk 13 Nov, F-W1-58): both landed on the same page untagged. A
-- shop-page inquiry stamped `chat_threads.inquiry_source` = NULL, NULL is an
-- import, and a booking made entirely in the app (quote → ask to confirm →
-- agree) read "No Setnayan booking fee · This client did not come from
-- Setnayan" — no fee row was ever opened.
--
-- THE FIX, TWO HALVES (this file is the database half):
--   · a NEW value `shop_page` = an organic arrival on the shop page. It joins the
--     sourced surfaces. `website` keeps its locked meaning (2026-07-26: "the
--     vendor's own link" → import) — the supplier's QR / share link now carries
--     `?src=own` and is stamped `website`.
--   · the app half (apps/web): `app/v/[slug]/page.tsx` stamps `shop_page` on an
--     untagged arrival and `website` on `?src=own`; every link the supplier hands
--     out is built by `ownPageUrl` (lib/supplier-qr-codes.ts).
--
-- NOTHING EXISTING CHANGES: no row carries `shop_page` before this ships
-- (measured: chat_threads.inquiry_source is NULL ×6, 'shortlist' ×1), and NULL
-- stays an import. Frozen ledger rows are never re-derived.
--
-- IDEMPOTENT: DROP CONSTRAINT IF EXISTS · CREATE OR REPLACE FUNCTION.
-- ============================================================================

BEGIN;

ALTER TABLE public.chat_threads
  DROP CONSTRAINT IF EXISTS chat_threads_inquiry_source_check;

ALTER TABLE public.chat_threads
  ADD CONSTRAINT chat_threads_inquiry_source_check
  CHECK (inquiry_source IN (
    'shortlist', 'first_pick', 'favorites', 'influencer', 'website',
    'editorial', 'auto_build', 'degree',
    'explore', 'search',
    'shop_page'
  ));

-- Mirrors SOURCED_INQUIRY_SOURCES in apps/web/lib/booking-fee-gate.ts; the DB
-- test asserts the two agree.
CREATE OR REPLACE FUNCTION public.booking_fee_is_sourced_surface(p_inquiry_source TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_inquiry_source IS NOT NULL
     AND p_inquiry_source IN (
       'explore', 'search', 'shortlist', 'first_pick',
       'favorites', 'auto_build', 'editorial', 'influencer',
       'shop_page'
     );
$$;

COMMENT ON FUNCTION public.booking_fee_is_sourced_surface(TEXT) IS
  'TRUE when an inquiry_source means the couple discovered the vendor THROUGH '
  'Setnayan (billable): explore, search, shortlist, first_pick, favorites, '
  'auto_build, editorial, influencer, and shop_page (an organic arrival on the '
  'shop page, owner 2026-11-13). Everything else - incl. NULL, host_manual, '
  'invite_claim, degree and website (the vendor own link / personal QR) - is an '
  'IMPORT and free forever. Mirrors SOURCED_INQUIRY_SOURCES in '
  'apps/web/lib/booking-fee-gate.ts.';

COMMENT ON COLUMN public.chat_threads.inquiry_source IS
  'Marketplace attribution of the thread (NULL = unknown, an import). '
  'explore/search/shop_page = organic Setnayan discovery (Booking-Fee SOURCED); '
  'website = the vendor own link / personal QR (?src=own) - an import. Stamped '
  'once on a brand-new thread via stampThreadProvenance (service-role); '
  'guard_thread_provenance_columns_trg blocks later edits by non-privileged callers.';

COMMIT;
