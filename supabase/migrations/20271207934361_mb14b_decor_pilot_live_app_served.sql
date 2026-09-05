-- ============================================================================
-- 20271207934361_mb14b_decor_pilot_live_app_served.sql
-- MB14b · THE DECOR PILOT GOES LIVE — APP-SERVED, NO CREDENTIALS.
--
-- The 2026-09-03 pilot (`20271194970382`) generated ten venue_scene drawings —
-- backdrop × 5 style families, ceiling × 5 — and pointed all ten at
-- `https://media.setnayan.com/moodboard-library/...`. That host has never
-- resolved and the objects were never uploaded anywhere, because the session
-- that generated them had no R2 credentials. MB26 (`20271206504078`) retired
-- all ten on the owner's ruling that the domain is not being set up now.
--
-- Measured again 2026-09-05: the owner's local environment still has no
-- R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY, so "wait for the
-- upload" is not a plan, it is the same wait that has already cost this pilot
-- two days. MB24 (`20271206127987`) and MB25 (`20271206413595`) established
-- the way out: an SVG the app serves from `public/moodboard-seed/` needs no
-- bucket, no custom domain, no CORS negotiation, and recolours identically.
--
-- 🔑 THIS IS THE ONE LEGITIMATE UN-RETIRE. The ten rows were retired for a
-- DEAD HOST, not for their content — nothing was ever wrong with the artwork.
-- MB23's placeholder rule ("no stock photograph is ever live") is untouched:
-- these are our own Recraft V4.1 vectors, generated for these ten cells. A
-- retirement whose stated cause has been removed is a retirement that should
-- end; a retirement of a picsum photograph never should.
--
-- ── THE TEN FILES, BYTE-FOR-BYTE, WITH THEIR HASHES ─────────────────────────
--
-- ⚠ CORRECTION TO EVERY PRIOR DESCRIPTION OF THESE FILES. MB14, MB26 and the
-- MB14b brief all call them "untracked". They are not: all ten have been
-- TRACKED in this repo at `apps/web/scripts/decor-pilot-output/` since the
-- pilot landed. Measured with `git ls-files`, and the hashes below were then
-- taken from `git show HEAD:<path>` as well as from the working tree — they
-- agree. That makes their provenance stronger than "a folder on one Mac": the
-- bytes now in `public/` are the bytes in git history, not a local copy that
-- happened to survive.
--
-- It also means the repo carries these ten drawings TWICE (2.8 MB each way):
-- once as the generator's output record, once as the served asset.
-- De-duplicating means repointing `verify-decor-pilot-colors.mjs` and
-- `upload-decor-pilot-to-r2.ts` at `public/` and deleting the source folder —
-- a separate, reviewable change, not something to fold into a migration that
-- publishes ten rows. Flagged, not silently done.
--
-- Copied unmodified from `apps/web/scripts/decor-pilot-output/` into
-- `apps/web/public/moodboard-seed/venue_scene/`. NOT run through svgo: this
-- repo has no svgo in its toolchain, adding a dependency to shave bytes off an
-- asset is outside this change, and an optimiser that merges fills is exactly
-- the hazard the colour guard exists to catch. The generator's bytes ship as
-- generated, the same choice MB24 and MB25 made (MB25 kept its C2PA
-- <metadata> block for the same reason: it is the honest record of origin).
--
--   sha256                                                            bytes  file
--   b6cdecfbbadd1fc5d88c4b8c2182b3c86ab83ec806f57e92766166367b3262c8  773275 backdrop/bridgerton-regal.svg
--   2ea4f9cd698a78ec79a3466500b102378ec7208727796bb0614c6f36f50d72ff   49069 backdrop/editorial-cream.svg
--   78c11ac86ef9be92dbf8c86bb8e250ae77ada722953fb119af1040edddc5ad48   48547 backdrop/elegant-simple-classic.svg
--   82d9258b58ee0cf5ccc17f7e527a747fa7b40882618c6a4192e55df9f9ac54bf   14056 backdrop/modern-minimalist.svg
--   e61ceabfeea3baf9bd62575ff20997179cb0f259f22ec50f41c0fab212a18ce8  331576 backdrop/tropical-heritage.svg
--   7f8b18a4c9357ca0e331ade9127fc9f207431dcb615af5f65cf2a1da8f002d0d  749226 ceiling/bridgerton-regal.svg
--   03e701aaff2eddcce263058284182ddb5255affeb6e478c509cbaa23c3e6ca08  225483 ceiling/editorial-cream.svg
--   e02ca76750e2f59b53ab404a9256c99b0b33d4ce0b15c63f1494dc99e125cada   57914 ceiling/elegant-simple-classic.svg
--   0555dd25cdc0bd9536088234b47f4d157914cfea1a6e276ccf61af6b122c766d   17635 ceiling/modern-minimalist.svg
--   1f54dba9720f6dc3f7415bff8b81bc97da1fcf389aeffc9ac33c0d4f27e42838  134337 ceiling/tropical-heritage.svg
--
-- ── THE COLOUR TAGS ARE UNCHANGED, AND RE-VERIFIED, NOT RE-DERIVED ──────────
-- `apps/web/scripts/verify-decor-pilot-colors.mjs` re-sampled all ten against
-- the real files on 2026-09-05 using the background-exclusion method from
-- `reception-decor-pilot-prompts.ts`. All ten reproduce their seeded
-- `sampled_hex` at ΔE 0.000. No range is touched by this migration.
--
-- ⚠ ONE THIN MARGIN, MEASURED AND REPORTED RATHER THAN SMOOTHED OVER.
-- Pushed through the REAL `recolorRGBA` on real 520px rasters, the distance
-- from each slot colour to its own generated background colour is:
--
--   backdrop/elegant-simple-classic  #f7c680 → #ECE6DD   15.6   tol 15  ⚠ 0.6
--   backdrop/tropical-heritage       #9cb29a → #E4D9CC   20.5   tol 15    5.5
--   ceiling/tropical-heritage        #9cb29a → #E4D9CC   20.5   tol 15    5.5
--   ceiling/elegant-simple-classic   #c9a059 → #F3ECE0   30.2   tol 15   15.2
--   backdrop/editorial-cream         #d98ba6 → #F7F3EA   33.2   tol 15   18.2
--   ceiling/editorial-cream          #d98ba6 → #F7F3EA   33.2   tol 15   18.2
--   ceiling/bridgerton-regal         #8c6ba6 → #F3ECE0   45.3   tol 15   30.3
--   backdrop/bridgerton-regal        #a92193 → #F3ECE0   64.0   tol 15   49.0
--   backdrop/modern-minimalist       #4a3b45 → #F5F3EF   70.1   tol 15   55.1
--   ceiling/modern-minimalist        #4a3b45 → #F5F3EF   70.1   tol 15   55.1
--
-- ALL TEN ARE STRICTLY OUTSIDE their own tolerance, so none has MB23's bride
-- disease (a region whose colour IS its background's, where no tolerance can
-- separate them) and all ten ship. On the real raster, ZERO exact background
-- pixels recolour in any of the ten. What the 0.6 margin DOES cost is a
-- 100-pixel antialiased fringe on `backdrop/elegant-simple-classic` — 0.087%
-- of that file's background field, against 0.000% on the seven wide-margin
-- files. Pinned, with the margin itself, by
-- `_components/the-background-never-wears-the-palette.test.ts`, which reads
-- these numbers out of the artefacts rather than restating them: the
-- background colours from `scripts/reception-decor-pilot-prompts.ts`, the slot
-- values from `20271194970382`, the served paths from THIS file.
--
-- ── WHAT THIS MIGRATION DOES, AND WHAT IT REFUSES TO DO ─────────────────────
-- Exactly three columns on exactly ten rows: `storage_path` DERIVED from the
-- old one (never retyped — a hand-copied slug is a mis-mapped drawing nobody
-- would notice), `retired_at = NULL`, `approved_at = NOW()`. It inserts
-- nothing, deletes nothing, and does not touch a single colour range.
--
-- 🪤 THE COUNT GUARD IS THE POINT. If the predicate matches anything other
-- than the ten rows measured today — a new pilot row landed, one was deleted,
-- one was already re-pointed — the world changed under this migration and a
-- human should look rather than have ten arbitrary rows published to couples.
--
-- ⚠ NOTE FOR ANY FUTURE READER OF `20271206504078`: after this runs, MB26's
-- `media.setnayan.com` predicate matches ZERO rows. That is correct and
-- expected — the host is gone from the table entirely, which is a stronger
-- state than "retired". MB26's own DO block only runs in ITS ordinal position
-- (before this one), in prod and in the PGlite replay alike, so it still sees
-- its ten. The db guard that used to count retired rows on that host now
-- counts app-served live ones; see
-- `tests/db/no-placeholder-photo-is-ever-live.db.test.ts`.
--
-- Cross-references:
--   * 20271194970382 — the pilot seed (rows + slot-1 ranges)
--   * 20271206504078 — MB26's retirement, which this reverses for cause
--   * 20271206127987 / 20271206413595 — the app-served precedent (MB24 / MB25)
--   * apps/web/lib/reception-scene.ts — `renderVenueSvg`'s composite-with-fallback
--   * apps/web/lib/reception-decor-layers.ts — `decorLayerHrefs` / `resolveDecorLayer`
--
-- Idempotent: the UPDATE is a no-op on a second run (nothing still matches the
-- old host), and the count is taken on the DESTINATION shape so a re-Apply
-- sees ten and passes rather than raising.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  before_n int;
  after_n  int;
  bad      text;
BEGIN
  -- Counted on the union of both shapes — the dead host (first run) and the
  -- app-served destination (every run after). Filtering on only one of them
  -- would make this RAISE on the second Apply, which is the failure mode
  -- MB26's own header warned about and then avoided the same way.
  SELECT count(*) INTO before_n
    FROM public.moodboard_library_assets
   WHERE asset_type = 'venue_scene'
     AND asset_subtype IN ('backdrop', 'ceiling')
     AND (storage_path LIKE 'https://media.setnayan.com/%'
          OR storage_path LIKE '/moodboard-seed/venue_scene/%');

  IF before_n <> 10 THEN
    RAISE EXCEPTION
      'MB14b: expected exactly 10 decor-pilot venue_scene rows (backdrop+ceiling), found %. '
      'The world changed under this migration — a new pilot row landed, or one of the '
      'original ten was deleted or re-pointed. Look before publishing ten rows to couples.',
      before_n;
  END IF;

  -- The repoint. `replace` DERIVES the destination from the row's own key, so
  -- no slug is retyped here and no drawing can be published under another
  -- style's name.
  UPDATE public.moodboard_library_assets
     SET storage_path = replace(storage_path,
                                'https://media.setnayan.com/moodboard-library/',
                                '/moodboard-seed/'),
         retired_at   = NULL,
         approved_at  = COALESCE(approved_at, NOW())
   WHERE asset_type = 'venue_scene'
     AND asset_subtype IN ('backdrop', 'ceiling')
     AND storage_path LIKE 'https://media.setnayan.com/moodboard-library/venue_scene/%';

  -- And the destination is what we said it was. A `replace` that matched
  -- nothing, or matched a path shaped differently than expected, leaves rows
  -- live at a URL this app does not serve — a broken image on the couple's
  -- board, which is worse than the retired state we started from.
  SELECT count(*) INTO after_n
    FROM public.moodboard_library_assets
   WHERE asset_type = 'venue_scene'
     AND asset_subtype IN ('backdrop', 'ceiling')
     AND storage_path ~ '^/moodboard-seed/venue_scene/(backdrop|ceiling)/[a-z0-9-]+\.svg$'
     AND approved_at IS NOT NULL
     AND retired_at IS NULL;

  IF after_n <> 10 THEN
    SELECT string_agg(storage_path, ', ' ORDER BY storage_path) INTO bad
      FROM public.moodboard_library_assets
     WHERE asset_type = 'venue_scene'
       AND asset_subtype IN ('backdrop', 'ceiling');
    RAISE EXCEPTION
      'MB14b: expected 10 live app-served decor rows after the repoint, found %. Paths are: %',
      after_n, bad;
  END IF;
END $$;

COMMIT;
