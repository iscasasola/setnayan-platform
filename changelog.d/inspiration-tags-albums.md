## 2026-11-14 · feat(inspiration): the album rows say which inspirations their photos are in (B8 frames 6–7)

Follow-up to #7622, now that B5 (#7623, card event albums) has merged. Builds frames 6–7 of the approved design
`prototypes/inspiration_tags_2026-11-14_fable.html` (DECISION_LOG 2026-11-14).

- **Frame 6 — service card › Portfolio:** under each album, one chip per inspiration its photos are in, with a count
  ("Bridal bouquet · 2"); a chip opens that album in Their work. Supplier side only — the couple's grown card is unchanged.
- **Frame 7 — Their work:** one row under "Booked on" — **In inspiration** · the parts, opening the supplier's
  inspiration library.
- One pure rule (`albumInspirations` in `lib/inspiration-tags.ts`) for both screens and the lab; one read
  (`readAlbumTags`, service role scoped to the proven shop, approved · not retired · not refused). An unread is no row,
  never a wrong one. `toAlbumViews` takes the tags as an option; nothing about the album itself changes.

SPEC IMPACT: None — builds an approved design.
