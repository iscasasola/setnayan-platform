## 2026-09-05 · fix(mood-board): the modern-minimalist bride gets her gown back (MB24)

MB23 (`20271205919528`) deleted this figure's colour range and was right to: her
gown was filled `#ECEBE7` and the same file drew a full-canvas backdrop `<path>`
in that identical fill, ΔE 0.0, so to `recolorRGBA` the dress and the page behind
her were one region and no tolerance could separate them. `page.tsx` then
silently preferred a bride variant that could recolour, and the modern-minimalist
bride stopped appearing in "In your colors".

The artwork is re-cut — one backdrop path removed, an XML comment left in its
place, 276 `<path>`s to 275, nothing else touched — and now ships from the repo at
`apps/web/public/moodboard-seed/figure_attire/modern-minimalist/bride.svg`
(sha256 `5535e693…`), matching the live `/moodboard-seed/florals/*.webp`
precedent: same-origin, no CORS negotiation, versioned with the code that reads
it. Deliberately not an R2 re-upload — a same-key overwrite on `r2.dev` is served
stale from browser caches and puts the artwork back outside the repo.

Migration `20271206127987` repoints the row (asserting it matches exactly one, and
raising on 0 or 2+) and re-inserts the range at `#ECEBE7 ± 16`, `slot_id 1`,
`region_label 'attire'`. The tolerance is measured on a 520px raster of this file,
not inherited: the gown and all three of its shading tones end at ΔE 19, her skin
`#CEB19F` begins at ΔE 20.8, and the boundary is a cliff — 0.67% of her skin is
caught at ±16, 1.64% at ±20, 67.49% at ±22. ±16 recolours 92.30% of the gown
including its folds while staying 4.8 ΔE clear of her shoulders. MB23's retuned
10–12 would have dropped the `#C6C2C0` folds at ΔE 15.6.

Guards extended rather than duplicated.
`the-background-never-wears-the-palette.test.ts` now rasterises the REAL SVG with
`sharp` at the component's own MAX_PREVIEW_PX and reads the served path, the
matched suffix and the tolerance out of the migration — the synthetic two-colour
fixture the other figures use cannot see a backdrop path returning. Sabotaged
three ways, each seen red: reinstating path 0 (2 tests), tolerance 40 (1),
repointing the migration's suffix (1, and 6 when both sides move together).
`attire-recolours-because-the-query-asks.test.ts` asserts the LAST migration to
touch her range inserts rather than deletes, so a future deletion cannot silently
drop her from the section again; sabotaged with a later DELETE migration, seen
red. `tests/db/no-placeholder-photo-is-ever-live.db.test.ts` failed on its own
`UNTAGGABLE` entry the moment the range came back — which is what that list was
built to do — so the entry is deleted and the list is now empty.

`lib/moodboard-library-placeholder.ts` needed no change: `hostOf` already returns
null for an app-relative path, so `/moodboard-seed/…` is not a placeholder. Pinned
with a case for the bride's exact path, because the wrong repair for a refusal
there would be to host the file on R2.

SPEC IMPACT: None. The asset moves hosts and regains a colour range; no locked
decision, SKU, schema or product rule changes. The Ceremony drawing MB23 left
absent by design is still owed by the owner and is out of this lane.
