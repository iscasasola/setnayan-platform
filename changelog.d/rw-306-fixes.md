## 2026-11-14 · fix(walkthrough RW-306): the moodboard library fits a phone and names its parts · the hub privacy "Stories" link presses at 44

- **Admin Moodboard Library (`/admin/studio?tab=moodboard-library`)** laid out 584 px wide on a 390 px phone: the
  tagging canvas draws at the photo's full width and the page's implicit `auto` grid track sized itself to it. The
  grid is `grid-cols-1` (minmax(0,1fr)) under `lg` and each column is `min-w-0`; the desktop 320 px + 1fr layout is
  unchanged.
- The same cards and the selected photo's header printed stored codes (`SUPPLIER_GALLERY · ENTOURAGE_BOUQUETS`,
  `internet_placeholder`). They now print the words the app already has: a shop's gallery photo reads
  "Inspiration · <part>" (the part's name from the admin's inspiration parts, `getInspirationParts`, the supplier
  library's own words for the same row), the asset type and source read the Upload form's own picker labels (one
  list now feeds both). An unknown key still prints itself rather than vanishing.
- **Event Hub privacy**: the in-sentence "Stories" link (18 px) wears the shared invisible press `sn-hit` — no
  visual change. Held by `lib/the-shared-controls-press-at-44.test.ts`.

SPEC IMPACT: None

Also (AW-13, now that #7712 has landed): the admin Work list's lane chips get `sn-hit`, so they press at 46 px instead of 30. The drawing is unchanged, and a guard in `lib/the-shared-controls-press-at-44.test.ts` holds it.
