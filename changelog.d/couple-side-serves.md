# couple-side-serves

## 2026-07-03 · feat(marketplace): serves filter + showcase media + pricing detail on the couple-facing card

The vendor service-card redesign recorded showcase media, who-they-serve
(event types + faiths), and rich pricing bases — but couples never saw any of
it. This lands the couple-side payoff, consuming existing schema only:

- **Public service card (`/v/[slug]`) · showcase media** — each card now
  renders its `showcase_photo_r2_keys` (≤5 small thumbs in a horizontal strip)
  and `showcase_video_r2_key` (a modest in-card `<video controls
  preload="metadata" playsInline muted>`). URLs are presigned server-side in
  parallel + fail-soft per service (`resolveServiceShowcaseMedia`), the cover
  (`primary_photo_r2_key`) behavior is unchanged, and empty media renders
  exactly as before (no placeholders).
- **Public service card · "Serves" line** — services with a `coverage_id` show
  a subtle closing line built from their `vendor_coverages` row, e.g.
  `Serves: Wedding · Debut — All faiths` or `— Catholic, Muslim`. Empty
  `faiths[]` = "All faiths" (column contract). Faith keys map to labels via
  `FAITH_REGISTRY`; event types via `getEventTypeVocab()` (fail-soft). New
  public fetcher `fetchCoveragesByIdPublic` in `lib/vendor-service-public.ts`.
- **Public service card · pricing-basis detail** — a footnote under the
  "from ₱X" anchor: per-pax shows `₱X / guest · min N guests` (min only when
  set); per-hour shows `₱X for N hrs · +₱Y/extra hr` (segments only when
  present); fixed shows nothing (brackets stay vendor-side). Anchor unchanged.
- **Explore `?faith=` now narrows the VENDOR GRID** — previously the param
  (drawer Faith select, 2026-05-30) only narrowed catalog-mode ceremony tiles.
  Matching rule: a vendor matches faith X when ANY of their `vendor_coverages`
  rows has EMPTY `faiths[]` (all faiths welcomed) OR contains X; vendors with
  ZERO coverage rows also match (legacy vendors haven't declared — never
  hidden). Implemented as a NOT-IN exclusion set (one `vendor_coverages` read,
  sets computed in-memory — sidesteps PostgREST array-literal quoting for
  multi-word keys like "Born Again"), mirrored into the broadened empty-state
  count, fail-soft to the unfiltered grid. An active-faith strip (with a
  one-click "All faiths" clear) surfaces when the narrow is on; the picker
  itself stays inside the FilterDrawer per the 2026-05-30 owner directive
  that retired inline faith pill rows.

Files: `apps/web/app/v/[slug]/page.tsx` ·
`apps/web/app/v/[slug]/_components/services-gallery.tsx` ·
`apps/web/app/explore/page.tsx` · `apps/web/lib/vendor-service-public.ts`.

SPEC IMPACT: None — consumes existing schema (migrations 20270426250948 +
20270502342558); no migration, no pricing/SKU change.
