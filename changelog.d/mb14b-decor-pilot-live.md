## 2026-09-05 · feat(moodboard): the decor pilot goes live, app-served, with a byte-identical fallback

The 2026-09-03 reception-decor pilot generated ten venue scenes (backdrop × 5
style families, ceiling × 5) and pointed them at `https://media.setnayan.com/`.
That host has never resolved and the objects were never uploaded anywhere,
because the generating session had no R2 credentials. MB26 retired all ten on
the owner's ruling that the domain is not being set up. Measured again today:
the credentials still do not exist locally, so waiting is not a plan.

- **The ten SVGs are now app-served.** Copied byte-for-byte (verified with
  `cmp`) from `apps/web/scripts/decor-pilot-output/` into
  `apps/web/public/moodboard-seed/venue_scene/{backdrop,ceiling}/`, 2.8 MB, all
  ten sha256 recorded in the migration header. Not run through `svgo`: the repo
  has no svgo, and an optimiser that merges fills is the hazard the colour
  guard exists for. Same choice MB24 and MB25 made.
- **Migration `20271207934361`** repoints exactly those ten rows to
  `/moodboard-seed/venue_scene/<zone>/<slug>.svg` (DERIVED with `replace()`, so
  no slug is retyped), clears `retired_at` and sets `approved_at`. Two `DO $$ …
  RAISE` guards: the source count must be 10, and the destination must be 10
  live rows matching the app-served path shape. The one legitimate un-retire —
  they were retired for a dead host, never for their content.
- **`renderVenueSvg` composites with fallback.** A new optional `decor`
  parameter draws a retinted layer into the backdrop or ceiling slot. Every
  `(zone, style)` without an asset — which is almost all of them — renders
  BYTE-IDENTICALLY to before; the pre-change sha256 digests were captured on
  `origin/main` before the feature was written and are pinned in
  `lib/reception-scene.test.ts`. An href that is neither an app-served seed
  path nor a retinted `data:` URI falls back rather than being drawn.
- **A defect the brief did not predict, found and fixed.** Repointing the rows
  to an app-served path would have BROKEN the one consumer that exists:
  `renderDecorLayerDataUrl` fetched `storage_path` through
  `safeFetchImageBytes`, and `new URL('/moodboard-seed/…')` throws — measured,
  it returns `null`, which every caller reads as "no decor layer". The pilot
  would have gone live and still drawn nothing, silently, with every test
  green. The server half now reads an app-served path off disk, gated by the
  same href predicate the markup uses plus a containment check.
- **Guards extended, not duplicated.** The no-placeholder db test keeps its
  `media.setnayan.com` assertion and gains the ten as live/app-served/tagged
  rows plus a "the file actually exists in `public/`" check; its "exactly one
  live venue_scene" assertion is scoped to the `church`/`ceremony` subtypes it
  always meant. `the-background-never-wears-the-palette.test.ts` gains the ten
  as one-slot real-raster cases. `attire-recolours-because-the-query-asks.test.ts`
  gains the `findVenue` assertion (first-match, no `ORDER BY`).
- **⚠ The brief said the ten SVGs were "untracked". They were already tracked**
  at `apps/web/scripts/decor-pilot-output/` — `git ls-files` says so, and the
  ten hashes taken from `git show HEAD:<path>` match the working tree exactly.
  Good news for provenance, but the repo now holds each drawing twice (2.8 MB
  either way). De-duplicating means repointing two scripts at `public/` and
  deleting the source folder; flagged as a follow-up, not folded in here.
- **⚠ One thin margin, reported not smoothed.** `backdrop/elegant-simple-classic`
  samples `#F7C680` on a `#ECE6DD` background — 15.6 apart in the engine's own
  metric, against a seeded tolerance of 15. All ten are strictly OUTSIDE their
  background (none has MB23's bride disease) and zero exact background pixels
  move on any of them, so all ten ship; but that 0.6 is the whole margin, and
  it costs a 100-pixel antialiased fringe on that one file. Both the margin and
  the fringe ceiling are pinned.

SPEC IMPACT: None. No locked decision changes — the pilot's zones, styles,
sampled colours and tolerances are all untouched. `media.setnayan.com` stays
unbuilt, per the owner's 2026-09-05 ruling.
