# MB14b — the decor pilot goes live, with no credentials

**Model · effort: Opus · high.** Ten assets, one migration that un-retires and repoints, the
composite-with-fallback the original MB14 brief was really about, and a byte-identical fallback
invariant that is the whole safety property.

**Supersedes `MB14.md`'s "Owner provides R2 credentials."** Measured 2026-09-05: the owner's local
env has no R2 keys; the pilot rows point at `media.setnayan.com`, which does not resolve; MB26
(PR #5204) retired all ten. MB24 (#5198) and MB25 (#5199) established the precedent this brief
follows — an SVG the app serves from `public/moodboard-seed/` recolours with no CORS and no upload.

## What exists (do not rebuild)

- **The ten files:** `apps/web/scripts/decor-pilot-output/{backdrop,ceiling}/{style-slug}.svg`,
  untracked, 2.8 MB total. Two are large (`bridgerton-regal` ×2 ≈ 750 KB each).
- **The ten rows:** `moodboard_library_assets` where `asset_type = 'venue_scene'`,
  `asset_subtype IN ('backdrop','ceiling')`, `storage_path LIKE 'https://media.setnayan.com/%'`,
  seeded by `20271194970382`, now `retired_at IS NOT NULL` (MB26's `20271206504078`),
  `approved_at IS NULL`. Their `moodboard_asset_color_ranges` rows exist (one slot each).
- **The tags were already verified:** `scripts/verify-decor-pilot-colors.mjs` — MB14 re-checked all
  ten `sampled_hex` values against the real files with the background-exclusion method in
  `reception-decor-pilot-prompts.ts`; all ten matched. Re-run it; do not re-derive.
- **The consumer:** `reception-scene.ts` — the flat-SVG reception scene the 3D plan / mood board
  composes per `(zone, style)`. MB14's deliverable was *composite-with-fallback* there.
- **The upload script** `scripts/upload-decor-pilot-to-r2.ts` is now the wrong tool. Leave it; add
  one line to its header saying MB14b hosted the files app-served instead and why.

## The build

1. **Host them app-served.** Copy the ten files byte-for-byte to
   `apps/web/public/moodboard-seed/venue_scene/{backdrop,ceiling}/{style-slug}.svg`. Record all
   ten sha256 in the migration header. If you run `svgo` on the two 750 KB files, do it BEFORE
   hashing, re-run `verify-decor-pilot-colors.mjs` afterwards (an optimiser can merge fills), and
   say so; if the colours move, ship the unoptimised bytes.
2. **Migration** (`pnpm migration:new`, above `20271207345427`): for exactly those ten rows,
   `SET storage_path = '/moodboard-seed/venue_scene/<zone>/<slug>.svg', retired_at = NULL,
   approved_at = NOW()`. A `DO $$ … RAISE` if the matched count is not 10. This is the one
   legitimate un-retire: the rows were retired for a dead host, not for content.
3. **Guards, extended not added:**
   - `tests/db/no-placeholder-photo-is-ever-live.db.test.ts` (MB23/MB26) must still pass with ten
     more live venue scenes — and its "nothing live on `media.setnayan.com`" assertion stays.
   - `the-background-never-wears-the-palette.test.ts` (MB23/MB25): add the ten as one-slot cases —
     the tagged region recolours, the rest moves by nothing. If any of the ten has a backdrop that
     shares its region's colour (MB23's bride disease), that file is not shippable as-is: report
     it, leave that row retired, and RAISE on 9 instead of 10.
4. **Composite-with-fallback in `reception-scene.ts`** — MB14's original deliverable. Any
   `(zone, style)` combination WITHOUT a live asset renders **byte-identical** to today's flat SVG.
   Guard: snapshot the fallback render for an uncovered combo before your change, assert equality
   after. The pilot folder holds before/after e2e PNGs showing the technique. Sabotage: substitute a
   near-miss asset for an uncovered combo → red.
5. **Page check:** `page.tsx`'s `findVenue` takes the FIRST `venue_scene` matching
   `church|ceremony` — ten new live rows with subtypes `backdrop`/`ceiling` must not displace the
   church drawing from the Ceremony card. Assert it.

## Out of lane

The Ceremony card's own asset (MB25). Attire. The watermark. Setting up `media.setnayan.com`
(owner ruled: not now).

## Report

The four lines in `MB-OVERSIGHT.md`, plus: the ten hashes, the `verify-decor-pilot-colors.mjs`
output, and the byte-equality result for one uncovered `(zone, style)` fallback.
