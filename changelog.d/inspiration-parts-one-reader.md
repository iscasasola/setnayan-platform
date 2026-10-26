## 2026-10-26 · feat(inspiration): one reader for the Mood Board's parts; the photo tables point at the parts table (step ② of the approved redesign)

Step ② of the owner-approved package `prototypes/admin_inspiration_groups_2026-10-25/PLAN.md` (owner
2026-10-26: "Approve the redesign package — build the nine steps in order, each final"). Stacked on step ①.

- `lib/inspiration-parts-db.ts getInspirationParts()` — `cache()`d, reads `inspiration_parts` +
  `inspiration_part_categories`, falls back to the consts exactly as `getTaxonomy()` does
  (`source: 'db' | 'fallback'`). Pure shapes + fallback in `lib/inspiration-parts.ts` (client-safe);
  `MOODBOARD_SLOT_TRADES` moved there (re-exported from `lib/moodboard-gallery.ts`) as the fallback seed.
- `inspiration-slots.ts` (`palettePhotoParts` / `libraryPhotoParts`), `moodboard-gallery.ts`
  (`tradesForSlot`, `canonicalServicesForSlot`, `tradeLabelForCredit`, `normalizeGalleryQuery`,
  `shapeGalleryPage`, `gallerySlotKeys`) and `moodboard-gallery-upload.ts` (`slotUploadVerdict`,
  `libraryPartLabel`, `uploadableSlotsForShop`) read the snapshot; the server callers (Studio page + actions,
  wizard uploads, the supplier library page + actions) pass `await getInspirationParts()`.
- Migration `20271288430455_inspiration_parts_are_the_photo_keys.sql`: the board's 29-literal CHECK
  `event_inspiration_assets_slot_key_check_v3` → FK `event_inspiration_assets_slot_key_is_a_part`; the slot
  IN-list leaves `moodboard_library_assets_supplier_gallery_shape` for the trigger
  `moodboard_library_assets_subtype_is_a_part` (supplier_gallery rows only — the column is polymorphic).
- Deleted: `GALLERY_SLOT_LABEL`, `AWAITING_A_SLOT`, `SLOT_GROUP_LABEL`, the `LibrarySlotGroup` type. Kept until
  step ④ (which renames the headings): `PHOTO_PART_GROUP_LABEL`, now also holding "More boards".
- No UI change: the couple's and supplier's screens draw the same names, order and headings (before/after
  captures at 390 px).
- Guards: `lib/inspiration-parts-three-lists-are-one.test.ts` (guard 1), `lib/a-shop-sees-only-its-parts.test.ts`
  (guard 2), `tests/db/a-photo-names-a-part.db.test.ts` (guard 3's unknown-key half), each sabotaged once; the
  slot-gate tests that parsed IN-lists re-aimed at the parts table (`lib/inspiration-parts-gate.test-helper.ts`).
- Ugat J55 + the gallery joints flipped: the board's FK claimed, the CHECK claim removed.

Not moved yet (they still read the consts, said in the Ugat J55 traps): the suggestion door's SQL mirror
`inspiration_suggestion_services`, the sign-off map (`moodboard-finalization`) and the render pool.

SPEC IMPACT: None beyond the approved PLAN (it is the spec); the corpus DECISION_LOG rows are step ⑨.
