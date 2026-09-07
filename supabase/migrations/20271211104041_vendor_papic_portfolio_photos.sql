-- vendor_papic_portfolio_photos
-- ============================================================================
-- VENDOR-PORTFOLIO PAPIC — the private album (G3, following G2's ledger).
--
-- Owner, 2026-08-26/09-05: a supplier spends Papic credits to "upload their
-- work" / pay "the photo importation fee for their portfolio" — a marketing
-- album that is THEIRS, never the couple's. This is a DIFFERENT thing from
-- vendor_papic_captures (migration slug vendor_papic_capture_counsel_gated):
-- captures are on-the-day shots of somebody ELSE's wedding, taken with the
-- Papic camera at a booked event, and the host may see them (owner 2026-08-26
-- part 5). Portfolio photos are the supplier's own finished work, imported
-- for their own business page, and the host is never a reader of this table —
-- pinned by tests/db/vendor-papic-portfolio-is-not-the-host-gallery.db.test.ts.
--
-- Spend is ONE meter (G2, "base it all from the supplier's shots per event"):
-- vendor_papic_portfolio_credit_grants is the grant side; the spend side is
-- TWO tables now — vendor_papic_captures (1 pt/photo, 8 pt/clip, the on-the-day
-- allowance) and this one (credits_spent per row, imports only — no video,
-- so this table never touches the open video-at-800 question). Both are
-- summed by fetchVendorPapicPortfolioCredits (lib/vendor-papic-grants.ts) so
-- "left" reflects whichever door a supplier spent through.
--
-- Storage is a THIRD prefix, deliberately not shared with either the host
-- gallery (`events/{id}/…`, `papic/guest/…`) or the vendor's own on-the-day
-- captures (`papic/vendor-{id}/event-{id}/cap-…`):
--   papic/vendor-{vendorProfileId}/portfolio/{eventId}/{uuid}.jpg
--
-- Same NSFW posture as every other Papic ingest path (DECISION_LOG 2026-06-13:
-- "on by default, CANNOT be disabled") — nsfw_checked defaults FALSE and only
-- a background classify (apps/web/lib/nsfw-screen.ts) flips it TRUE; a row
-- only surfaces to its own vendor once screened, mirroring
-- vendor_papic_captures exactly.
--
-- KEEP IDEMPOTENT (may be re-applied).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_papic_portfolio_photos (
  photo_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id          UUID NOT NULL
                      REFERENCES public.events(event_id) ON DELETE CASCADE,
  r2_object_key     TEXT NOT NULL,
  -- Almost always 1 (one credit imports one photo) — kept as a column rather
  -- than hardcoded so a future bulk-import price change never needs a schema
  -- migration, matching the "the number lives in the table" convention used
  -- for vendor_billing_catalog.price_php.
  credits_spent     INTEGER NOT NULL DEFAULT 1
                      CONSTRAINT vendor_papic_portfolio_photos_credits_positive
                      CHECK (credits_spent > 0),
  nsfw_checked      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Soft delete/takedown — an NSFW block, or the vendor's own removal.
  hidden_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_papic_portfolio_photos_ve_idx
  ON public.vendor_papic_portfolio_photos (vendor_profile_id, event_id, created_at DESC);

COMMENT ON TABLE public.vendor_papic_portfolio_photos IS
  'A supplier''s PRIVATE portfolio album for one booked event — imported work, '
  'paid for out of vendor_papic_portfolio_credit_grants, never the host''s or '
  'guest''s to see. Distinct storage prefix from the host gallery AND from '
  'vendor_papic_captures (papic/vendor-{id}/portfolio/{eventId}/…). '
  'nsfw_checked gates visibility, same posture as every other Papic ingest.';

ALTER TABLE public.vendor_papic_portfolio_photos ENABLE ROW LEVEL SECURITY;

-- The supplier reads their own album; admin reads all. No one else — this is
-- the "private" half of "private portfolio album" and the property the db
-- test proves: the host's own gallery readers never join this table at all.
DROP POLICY IF EXISTS vendor_papic_portfolio_photos_vendor_read
  ON public.vendor_papic_portfolio_photos;
CREATE POLICY vendor_papic_portfolio_photos_vendor_read
  ON public.vendor_papic_portfolio_photos
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_admin()
  );

-- Insert is bound to a BOOKED event + the caller's own vendor profile — same
-- shape as vendor_papic_captures_vendor_insert. The credit-balance check
-- (enough left to afford this import) is NOT expressible here and is enforced
-- in the route before the insert, the same posture canCapture already uses
-- for the on-the-day allowance.
DROP POLICY IF EXISTS vendor_papic_portfolio_photos_vendor_insert
  ON public.vendor_papic_portfolio_photos;
CREATE POLICY vendor_papic_portfolio_photos_vendor_insert
  ON public.vendor_papic_portfolio_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

-- No UPDATE/DELETE policy for authenticated: the NSFW screen writes through
-- the service-role admin client (like vendor_papic_captures' background
-- screen), and a supplier rewriting their own screen result is the one thing
-- this table must make impossible — same posture as the credit ledger.
--
-- Supabase grants ALL on every new public table to anon + authenticated and
-- publishes it as REST. RLS is row-level and cannot hide a capability; take
-- the capability away. (tests/db/anon-table-grants-closed.db.test.ts)
REVOKE ALL ON TABLE public.vendor_papic_portfolio_photos FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.vendor_papic_portfolio_photos FROM authenticated;

COMMIT;
