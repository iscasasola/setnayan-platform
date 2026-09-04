-- ============================================================================
-- 20271202522764_moodboard_gallery_uploads_open_safely.sql
-- MB11 — UNLOCK VENDOR UPLOADS, SAFELY.
--
-- MB10 landed every column the CREDIT needs (vendor_profile_id,
-- rights_warranted_at, rights_warranty_version) and this migration adds the
-- three facts the UPLOAD PATH needs and nothing else:
--
--   1. WHICH PHOTOS THE QUOTA COUNTS.  `source_event_id` — the event a gallery
--      photo came off. NULL means back-catalogue (the shop's own archive), and
--      back-catalogue is the ONLY thing the per-tier quota counts. A photo the
--      shop delivered on a celebration it was actually booked for is never
--      rationed; charging a florist for the wedding they worked is the wrong
--      shape of gate.
--   2. WHERE AN IMPORTED PHOTO CAME FROM.  `source` gains 'editorial_import'
--      — the "From Your Vendors" day-of media (editorial_vendor_media, built
--      2026-06-16 and still at 0 rows) promoted into the gallery pool. Reusing
--      'stylist_upload' for it would make the two indistinguishable, and they
--      are governed by different gates: an import re-checks
--      event_vendors.selection_match_rank = 1 at the moment it is made.
--   3. A SURFACE NAME FOR THE THEFT SCAN.  vendor_image_hashes /
--      vendor_image_flags gain 'moodboard_library'. Without it
--      `hashAndScanVendorImages` cannot record a hash for this bucket at all —
--      the CHECK would reject every row — and MB11's brief is explicit that
--      this is "the one publicly-readable bucket without a theft scan".
--
-- ── WHY source_event_id IS `ON DELETE SET NULL` AND CARRIES NO CHECK ────────
-- CASCADE would delete a supplier's own portfolio photo because somebody else
-- deleted their celebration — the photo is the SHOP's, not the event's. SET
-- NULL keeps it and demotes it to back-catalogue, which is what it then
-- honestly is.
-- 🔑 AND THE COLUMN IS DELIBERATELY NOT NAMED IN ANY CHECK CONSTRAINT. A
-- SET NULL onto a column some CHECK constrains behaves like RESTRICT — the
-- cascade UPDATE violates the check and the PARENT delete fails, while the FK
-- still advertises itself as SET NULL. That has already cost this project an
-- erasure hazard once (see the users→vendor_profiles note in
-- 20271202093185). Nothing here constrains it, so an event delete always
-- succeeds.
-- ⚠ A CONSEQUENCE, NAMED RATHER THAN HIDDEN: a demoted row starts counting
-- against the quota. That can leave a shop ABOVE its cap. It is not a takedown
-- and never becomes one — the quota is a check on NEW INSERTS only (see the
-- index comment below), so an over-cap shop simply cannot add more until it
-- retires something. Nothing is ever deleted to make a count fit.
--
-- ── THE QUOTA IS A NEW-INSERT CHECK, WHICH IS WHY GRANDFATHERING IS FREE ────
-- The per-tier ceilings live in code (lib/vendor-tier-caps.ts,
-- `galleryBackCatalogPhotos`) and are evaluated in the server action against
-- the count this migration's index serves. Because nothing retro-scans, any
-- row created while the ladder was looser survives a later tightening by
-- construction — there is no rescue migration to forget to write.
--
-- 🛑 NOT APPLIED BY HAND. deploy-prod.yml runs `supabase db push --include-all
-- --yes` on the committed file; a direct apply stamps the prod ledger with a
-- version that has no file on main and jams db push for EVERY subsequent merge
-- (2026-09-02 — seven merged PRs stranded for three hours).
--
-- No new tables → no new RLS. Every table touched keeps the policies it has.
-- Additive only. Idempotent.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · moodboard_library_assets — back-catalogue vs event-linked
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.moodboard_library_assets
  ADD COLUMN IF NOT EXISTS source_event_id UUID
    REFERENCES public.events(event_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.moodboard_library_assets.source_event_id IS
  'The celebration this gallery photo was delivered on (MB11). NULL = BACK-CATALOGUE, the shop''s own archive — and back-catalogue is the only thing the per-tier upload quota counts. Deliberately named in no CHECK constraint: a SET NULL onto a CHECKed column blocks the parent DELETE while still advertising SET NULL.';

-- `source` gains the editorial import.
--
-- 🪤 THE FOUR EXISTING VALUES ARE RE-LISTED, AND ONE OF THEM IS EASY TO MISS.
-- The original CHECK (20260525000000, declared inline) named THREE values; the
-- florals seed (20260927000000) then dropped it and added a `_v2` naming FOUR —
-- `recraft_generated`, which it immediately used for eleven live rows. Writing
-- this constraint from the ORIGINAL migration's list silently drops that value,
-- and the failure is not a syntax error: it is
--   `check constraint … is violated by some row`
-- raised while ALTER TABLE validates against existing data. It was caught here
-- by the PGlite replay (apps/web/tests/db/replay-migrations.ts), which applies
-- every migration over the real seeded rows — a plain `db push` on an empty
-- schema would not have noticed, and prod would have refused the deploy.
--
-- All prior constraint names are dropped so this is re-runnable, and the new
-- one takes a fresh `_v3` name rather than editing an applied migration.
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_source_check;
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_source_check_v2;
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_source_check_v3;
ALTER TABLE public.moodboard_library_assets
  ADD CONSTRAINT moodboard_library_assets_source_check_v3
  CHECK (source IN (
    'internet_placeholder', 'higgsfield_generated', 'stylist_upload',
    'recraft_generated',
    'editorial_import'
  ));

-- 🛑 THE CONSTRAINT THAT WAS WRITTEN HERE FIRST, AND WHY IT IS NOT HERE NOW.
--
-- The obvious pairing is "an editorial import must carry its event":
--
--     CHECK (source <> 'editorial_import' OR source_event_id IS NOT NULL)
--
-- It was written, and the PGlite replay refused it within the hour. That CHECK
-- NAMES `source_event_id`, so when an event is deleted the FK's SET NULL
-- cascade produces a row the check rejects — and Postgres then fails the PARENT
-- DELETE with `violates check constraint`, while the FK still advertises itself
-- as SET NULL. Deleting a celebration would have been blocked by a supplier's
-- gallery photograph, and since users → events → vendor_profiles all cascade,
-- that reaches account deletion: an RA 10173 erasure hazard, arriving as an
-- error message naming a constraint nobody was thinking about.
--
-- 🔑 AND THE CONSTRAINT COULD NOT HAVE BEEN RIGHT ANYWAY. The database cannot
-- tell "inserted without an event" (fabrication) from "the event was deleted"
-- (a legitimate demotion to back-catalogue). Only the INSERT knows, so the rule
-- lives where the insert is — `importEditorialMediaToGallery` writes
-- `source_event_id: row.event_id` in the same statement, and that call site is
-- pinned by every-upload-is-screened.test.ts so it cannot quietly stop.
--
-- `source_event_id` is therefore named in NO check constraint at all, and
-- the-back-catalogue-quota db test deletes an event to prove it stays that way.

-- The quota's counting query, verbatim: this shop's supplier-gallery rows that
-- are back-catalogue and not retired. Partial so it stays small — event-linked
-- rows are not in the index at all, which is the same statement the quota
-- makes.
CREATE INDEX IF NOT EXISTS idx_moodboard_library_assets_back_catalogue
  ON public.moodboard_library_assets (vendor_profile_id)
  WHERE asset_type = 'supplier_gallery'
    AND source_event_id IS NULL
    AND retired_at IS NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · the theft scan learns this bucket's name
-- ────────────────────────────────────────────────────────────────────────────
--
-- `hashAndScanVendorImages` writes vendor_image_hashes.surface and
-- vendor_image_flags.flagged_surface / source_surface. Both CHECKs listed only
-- the two website surfaces, so a moodboard-library hash could not be stored:
-- the scan would have thrown on every upload and been swallowed by its own
-- best-effort catch — a theft scan that silently records nothing, which is
-- indistinguishable from a clean marketplace.

ALTER TABLE public.vendor_image_hashes
  DROP CONSTRAINT IF EXISTS vendor_image_hashes_surface_check;
ALTER TABLE public.vendor_image_hashes
  ADD CONSTRAINT vendor_image_hashes_surface_check
  CHECK (surface IN ('service_primary', 'portfolio', 'moodboard_library'));

ALTER TABLE public.vendor_image_flags
  DROP CONSTRAINT IF EXISTS vendor_image_flags_flagged_surface_check;
ALTER TABLE public.vendor_image_flags
  ADD CONSTRAINT vendor_image_flags_flagged_surface_check
  CHECK (flagged_surface IN ('service_primary', 'portfolio', 'moodboard_library'));

ALTER TABLE public.vendor_image_flags
  DROP CONSTRAINT IF EXISTS vendor_image_flags_source_surface_check;
ALTER TABLE public.vendor_image_flags
  ADD CONSTRAINT vendor_image_flags_source_surface_check
  CHECK (source_surface IN ('service_primary', 'portfolio', 'moodboard_library'));

COMMIT;
