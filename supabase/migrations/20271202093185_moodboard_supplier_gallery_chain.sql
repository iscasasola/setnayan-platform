-- ============================================================================
-- 20271202093185_moodboard_supplier_gallery_chain.sql
-- MB10 — THE SUPPLIER GALLERY CHAIN. Schema only; every column here is inert
-- until the picker (this same PR) and the vendor upload page (MB11) write it.
--
-- ── WHAT THIS EXISTS TO FIX ─────────────────────────────────────────────────
-- A photo on a couple's inspiration board has no idea where it came from.
-- `event_inspiration_assets` records `source_kind` ('url_paste' | 'file_upload')
-- and an `image_url`, and nothing else — so when the couple sees a bouquet they
-- love, there is no supplier at the other end of it. The whole reason a florist
-- would bother uploading their portfolio is that the couple who saves it can
-- FIND them, and that chain did not exist.
--
-- 🛑 THE APPLY-A-TEMPLATE PATH ALREADY PROVES THE HOLE. `applyMoodboardTemplate`
-- (studio/mood-board/actions.ts) fills empty inspiration slots from
-- `moodboard_library_assets` and writes the row as `source_kind = 'url_paste'`
-- with no reference to the asset it copied — a library photo, permanently
-- recorded as something the couple pasted off the internet. Same PR fixes that
-- call site to use the new mode + id.
--
-- ── THE FOUR MOVES ──────────────────────────────────────────────────────────
--  1. event_inspiration_assets.library_asset_id → moodboard_library_assets,
--     plus a third `source_kind`: 'gallery_pick'.
--  2. moodboard_library_assets.vendor_profile_id → vendor_profiles. `uploaded_by`
--     is a USER; the credit a couple reads is a SHOP ("Bloom & Vine"), and one
--     user can hold more than one shop. Deriving the shop from the uploader at
--     read time would be a guess.
--  3. The rights warranty MB11 captures at upload — HERE, not in a second
--     migration (MB10's brief says so explicitly). Two columns, paired.
--  4. asset_type gains 'supplier_gallery', and for that type `asset_subtype`
--     carries the INSPIRATION SLOT the photo is for.
--
-- ── WHY asset_subtype AND NOT A NEW slot_key COLUMN ─────────────────────────
-- CLAUDE.md RULE 0 §3 — a filter flip beats new schema — and here the flip is
-- also the faster query. `idx_moodboard_library_assets_published` is ALREADY
-- `(asset_type, asset_subtype) WHERE approved_at IS NOT NULL AND retired_at IS
-- NULL`, which is the picker's query verbatim. A `slot_key` column would need
-- its own index to reach the same plan, and would leave two columns that both
-- claim to say what a photo depicts.
-- The overloading is only safe because `asset_subtype` is already read
-- per-asset_type and NEVER on its own: every existing reader pins asset_type
-- first (`.eq('asset_type','figure_attire')`, `.in('asset_type',
-- ['venue_scene','florals'])`, `.eq('asset_type','venue_scene')`). Grep
-- `asset_type` under apps/web before adding a reader that does not.
-- The CHECK below is what stops the overload from becoming free-text: for
-- 'supplier_gallery' rows the subtype must be one of the 18 real slot keys.
--
-- ⚠ THREE GATES AGAIN, THE SAME THREE THE 'cake' MIGRATION NAMED. The slot
-- vocabulary now lives in THREE places and they must be widened together:
--   (1) MOODBOARD_SLOT_KEYS in apps/web/lib/moodboard-slots.ts;
--   (2) event_inspiration_assets_slot_key_check_v3 (20271198640000);
--   (3) moodboard_library_assets_supplier_gallery_shape, added below.
-- A slot added to (1) and (2) but not (3) fails in the way this repo hates
-- most: the couple's own upload works, the supplier gallery for that slot is
-- silently empty forever, and nothing anywhere goes red.
--
-- 🛑 NOT APPLIED BY HAND. `deploy-prod.yml` runs `supabase db push
-- --include-all --yes` on the committed file; a direct apply stamps the prod
-- ledger with a version that has no file on main and jams db push for EVERY
-- subsequent merge (2026-09-02 — seven merged PRs stranded for three hours).
--
-- No new tables → no new RLS. Both tables keep the policies they already have:
--   · event_inspiration_assets — event_members-scoped (Pattern B), so the
--     couple's own pick is inserted under the policy that already exists.
--   · moodboard_library_assets — public read of approved-and-not-retired rows
--     (Pattern D), which is exactly the pool the picker is allowed to browse.
-- The warranty CHECK is deliberately keyed on `approved_at`, i.e. on the same
-- predicate that public read policy uses: an un-warranted gallery row may
-- exist as a draft, and CANNOT become publicly readable.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · event_inspiration_assets — where did this photo come from?
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.event_inspiration_assets
  ADD COLUMN IF NOT EXISTS library_asset_id UUID
    REFERENCES public.moodboard_library_assets(asset_id) ON DELETE CASCADE;

COMMENT ON COLUMN public.event_inspiration_assets.library_asset_id IS
  'The moodboard_library_assets row this board photo was picked from (MB10). NULL for the couple''s own upload or a pasted URL. ON DELETE CASCADE — see the migration header for why SET NULL is the wrong answer here.';

-- 🔑 WHY CASCADE AND NOT SET NULL, WHICH WAS THE FIRST INSTINCT.
-- Three facts decide it, and two of them only appear if you look:
--   (1) `deleteAsset` (admin) and `deleteStylistAsset` (vendor) HARD-DELETE the
--       row AND remove the storage object. A board tile left behind pointing at
--       a deleted object is a broken image square, which is strictly worse for
--       the couple than the tile being gone. `retired_at` is the soft path and
--       it does not touch this FK at all — a retired photo keeps rendering,
--       credited, on every board that holds it.
--   (2) SET NULL would turn the row into `source_kind = 'gallery_pick'` with a
--       NULL id, which the biconditional below REFUSES — so the cascade UPDATE
--       would fail and the delete would be blocked by a check violation, an
--       error message naming a constraint nobody was thinking about.
--   (3) users → vendor_profiles is ON DELETE CASCADE, and vendor_profile_id
--       below is CASCADE for the same reason. Under SET NULL/RESTRICT, deleting
--       a supplier account whose photo a couple had saved would FAIL — an
--       account deletion blocked by somebody else's mood board is an RA 10173
--       erasure hazard, not an inconvenience.
-- ⚠ RESIDUE, NAMED NOT FIXED: deleting a shop cascades its gallery ROWS but
-- leaves their storage objects in the public moodboard-library bucket. That is
-- the pre-existing shape (nothing sweeps the bucket on account deletion); it is
-- flagged here rather than solved, because a bucket sweeper is its own change.

-- The marker query ("you saved N of their photos") walks board rows → library
-- asset → vendor. Partial, because only picked rows carry the id and only
-- active rows are ever counted.
CREATE INDEX IF NOT EXISTS idx_event_inspiration_assets_library_asset
  ON public.event_inspiration_assets (library_asset_id)
  WHERE library_asset_id IS NOT NULL AND removed_at IS NULL;

-- source_kind gains a third mode. Additive: both existing values survive
-- verbatim, so no stored row can be invalidated. A NEW constraint name rather
-- than an edit to 20260625000000, which is applied and never rewritten.
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_source_kind_check;
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_source_kind_check_v2;
ALTER TABLE public.event_inspiration_assets
  ADD CONSTRAINT event_inspiration_assets_source_kind_check_v2
  CHECK (source_kind IN ('url_paste', 'file_upload', 'gallery_pick'));

-- 🔑 THE WIRING, ENFORCED BY THE DATABASE. A 'gallery_pick' with no
-- library_asset_id is a credited photo that lost its credit — the exact
-- failure MB10 exists to close, and it would render as an ordinary uncredited
-- tile with nothing going wrong anywhere. The biconditional also refuses the
-- reverse (an id on a row that claims to be an upload), so the mode and the
-- provenance can never disagree.
--
-- Existing rows are all ('url_paste'|'file_upload', NULL) → FALSE = FALSE, so
-- this validates against live data without a backfill.
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_gallery_pick_has_provenance;
ALTER TABLE public.event_inspiration_assets
  ADD CONSTRAINT event_inspiration_assets_gallery_pick_has_provenance
  CHECK ((source_kind = 'gallery_pick') = (library_asset_id IS NOT NULL));

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · moodboard_library_assets — whose photo is this?
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.moodboard_library_assets
  ADD COLUMN IF NOT EXISTS vendor_profile_id UUID
    -- CASCADE, not SET NULL: the shape CHECK below requires a shop on every
    -- supplier_gallery row, so SET NULL would make deleting a shop fail a
    -- check — and since users → vendor_profiles already cascades, that would
    -- block account deletion. A shop that is gone takes its gallery with it;
    -- Setnayan's own imagery has a NULL here and is untouched by the cascade.
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS rights_warranted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rights_warranty_version TEXT;

COMMENT ON COLUMN public.moodboard_library_assets.vendor_profile_id IS
  'The SHOP credited on this photo (MB10). Distinct from uploaded_by, which is the user account that pushed the bytes — a couple reads "Bloom & Vine", and one user may hold more than one shop, so the shop cannot be derived from the uploader at read time.';

COMMENT ON COLUMN public.moodboard_library_assets.rights_warranted_at IS
  'When the uploader warranted they hold the rights to publish this image (MB11 captures it at upload; the column lands in MB10 so MB11 is not a second migration). The WHO is uploaded_by — deliberately not duplicated here.';

COMMENT ON COLUMN public.moodboard_library_assets.rights_warranty_version IS
  'Which warranty wording was accepted. A timestamp alone cannot say what was agreed to, and the wording will change.';

-- Warranted-when and warranted-what are one fact. Half of it is unusable.
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_rights_warranty_paired;
ALTER TABLE public.moodboard_library_assets
  ADD CONSTRAINT moodboard_library_assets_rights_warranty_paired
  CHECK ((rights_warranted_at IS NULL) = (rights_warranty_version IS NULL));

-- asset_type gains 'supplier_gallery'. Every existing value preserved; the
-- previous name (…_check_v2, from 20260924000000) is dropped first so this is
-- re-runnable.
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_asset_type_check;
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_asset_type_check_v2;
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_asset_type_check_v3;
ALTER TABLE public.moodboard_library_assets
  ADD CONSTRAINT moodboard_library_assets_asset_type_check_v3
  CHECK (asset_type IN ('venue_scene', 'figure_attire', 'florals', 'supplier_gallery'));

-- 🔑 WHAT A SUPPLIER-GALLERY ROW MUST CARRY TO EXIST AT ALL.
--   · a shop to credit — an uncreditable gallery photo is indistinguishable
--     from stock, and crediting is the entire product;
--   · a real inspiration slot in asset_subtype — see the header on why the
--     slot lives there;
--   · a rights warranty BEFORE it is publicly readable. `approved_at IS NOT
--     NULL AND retired_at IS NULL` is literally the public-read policy's
--     predicate, so this CHECK and that policy open the same door. A public
--     bucket with no warranty is fine right up until it is a lawsuit
--     (MB11's own brief says the warranty lands with the scan, not after).
-- Every other asset_type is untouched by the OR's first branch.
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_supplier_gallery_shape;
ALTER TABLE public.moodboard_library_assets
  ADD CONSTRAINT moodboard_library_assets_supplier_gallery_shape
  CHECK (
    asset_type <> 'supplier_gallery'
    OR (
      vendor_profile_id IS NOT NULL
      AND asset_subtype IN (
        'venue','tunnel','stage','table','ceiling','overall',
        'backdrop','flowers','cocktail','reception_venue','cake',
        'palette',
        'groom','bride','principal_sponsor','entourage','parents','guests'
      )
      AND (approved_at IS NULL OR rights_warranted_at IS NOT NULL)
    )
  );

-- The picker filters by shop as well as by slot (MB11's per-shop quota reads
-- the same index).
CREATE INDEX IF NOT EXISTS idx_moodboard_library_assets_vendor_gallery
  ON public.moodboard_library_assets (vendor_profile_id, asset_subtype)
  WHERE asset_type = 'supplier_gallery' AND retired_at IS NULL;

COMMIT;
