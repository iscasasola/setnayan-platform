-- vendor_locked_qr_service_details
-- ============================================================================
-- My Shop → Locked QR enrichment (owner 2026-07):
--   1. service_description — a REQUIRED (app-layer) plain-text scope of work,
--      "what the couple availed". The couple sees it verbatim on their plan
--      after they scan, so both sides share one record of the deal.
--   2. event_date — the AGREED wedding date. A Locked QR means the couple and
--      vendor already settled a date, so the vendor sets it at issue time; on
--      claim it RESOLVES the couple's event date (see the claim RPC change in
--      20270426215000). Legacy tokens (pre-this-migration) keep NULL and fall
--      back to the couple's own event_date, exactly as before.
--
-- Both columns are NULLABLE at the DB layer for backfill safety (the table may
-- already hold issued tokens). New issuance REQUIRES them (issueLockedQr fails
-- fast on blank). Additive + idempotent — re-runnable, no RLS change.
-- ============================================================================

ALTER TABLE public.vendor_locked_qr_tokens
  ADD COLUMN IF NOT EXISTS service_description TEXT,
  ADD COLUMN IF NOT EXISTS event_date DATE;

COMMENT ON COLUMN public.vendor_locked_qr_tokens.service_description IS
  'What the couple availed — required plain-text scope of work set by the vendor at issue; frozen onto the couple''s booking on claim so both sides share one record. NULL only for legacy tokens issued before 20270426214000.';

COMMENT ON COLUMN public.vendor_locked_qr_tokens.event_date IS
  'Agreed wedding date set by the vendor at issue (a Locked QR implies a settled date). On claim, resolves the couple''s events.event_date: finalize if it matches a candidate, else confirm-to-change. NULL for legacy tokens → claim falls back to the couple''s own event_date.';
