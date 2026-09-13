## 2026-09-04 · feat(mood-board): the back-catalogue gallery quota is per category, and free tier

MB19. Owner decision, 2026-09-04: back-catalogue moodboard-gallery uploads open to **every**
vendor tier, free included — *"all their previous work can be uploaded to us, until we have
enough data of our own"* — capped at **20 per vendor PER CATEGORY they cover**, not per account.

**THE CHANGE OF UNIT.** `TierCaps.galleryBackCatalogPhotos` used to be counted account-wide
(pro 20, enterprise 100, free/verified/solo 0) and is renamed
`galleryBackCatalogPhotosPerCategory` — a name that said "photos" while the number meant "photos
per category" was a lie nothing went red over. Every tier now reads 20.

- `countBackCatalogue` (`app/vendor-dashboard/moodboard-library/actions.ts`) gains a third
  narrowing predicate, `.eq('asset_subtype', slot)`, alongside `source_event_id IS NULL` and
  `retired_at IS NULL`. A shop holding 20 Flowers photos may still upload to Tables.
- The refusal names the category and drops "on your plan" — every tier shares the cap now, so
  that phrase was no longer a true statement: *"You've used all 20 Flowers photos. Retire one, or
  add photos from a celebration you were booked on — those never count."*
- The vendor-side editor (`stylist-library-editor.tsx`) makes the category select controlled and
  derives its "used of cap" readout **per selected category, live off the assets already on the
  page** — the account-wide count it used to show would have blocked a valid upload to an
  unrelated shelf once the total across all categories passed 20.
- Event-linked uploads are unchanged: never counted, at any tier or category.

SPEC IMPACT: None — no migration. `moodboard_library_assets.asset_subtype` already existed; this
session only changes which rows a query counts and what tier caps allow.
