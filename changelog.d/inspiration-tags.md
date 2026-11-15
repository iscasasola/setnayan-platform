## 2026-11-14 · feat(inspiration): a supplier tags its event photos to inspirations (B8)

Builds the approved design `prototypes/inspiration_tags_2026-11-14_fable.html` (DECISION_LOG 2026-11-14, "A SUPPLIER
TAGS ITS EVENT PHOTOS TO INSPIRATIONS", owner: "Yes, take its picks").

- **Data** (migration `20271345380761`): one nullable column `moodboard_library_assets.event_file_id` →
  `event_supplier_files` (ON DELETE SET NULL), UNIQUE (event_file_id, asset_subtype) — one row per (photo, part), no
  second slot column. A trigger copies the event and the card from the Files photo, refuses a part the card does not
  offer (`inspiration_part_services`) and anything but a photo filed under a service. The public read policy now also
  asks `inspiration_photo_is_on_the_shop(event_file_id)` — THE ONE LISTING RULE (`event_supplier_photos_listed`) —
  so a tag shows only while its photo shows on the shop. A Files photo removed or re-filed RETIRES its tags (still on
  saved boards, credited). `event_file_id` is granted to nobody but the service role (like `source_event_id`); the
  public event line (type · venue · month, never a name) comes from `inspiration_tag_event_lines`.
- DB test `tests/db/a-tagged-files-photo-shows-in-inspiration-only-when-the-shop-does.db.test.ts`; Ugat joint J72.
- **Files board (frames 1–5):** a tagged tile wears a tag with a count; a service group has **Select** (one service at a
  time, Cancel in two places, "Tag to inspiration ▾"); the photo sheet gains one **Inspiration** row — each tag with its
  state (Checking · Waiting · Shown · Not published · Private) and its own ✕, then "Add to (another) inspiration ▾"
  listing only the parts the photo's card offers, the shipped rights line (never pre-ticked), "Tag to N inspirations".
  New ops `tag` / `untag` on the existing `eventFilesAction` (no new server action). A tag goes through the library's
  one screened door (`importEditorialMediaToGallery` → `storeScreenedAsset`), landing "Checking"; untag deletes a
  never-approved tag with its copy and RETIRES an approved one; an approved tag taken out stays out (no supplier write
  to approval).
- **Couple (frames 8 · 9 · 11):** the library tile carries the event line; tapping a photo opens it (From · From this
  event · Also in · Save). A tag of a photo not shown on the shop is not in the pool at all.
- **Shop page (frame 10):** `fetchShopInspirationLooks` drops Files tags unless the listing gate says the photo is shown
  (fail closed); tiles carry the event line.
- Shots: `build-sessions/shots-inspiration-tags/` (prototype frame beside the build, 390 px; two desktop frames).
- **Left for after B5 (`claude/card-event-albums`):** frames 6–7 (service card Portfolio chips, Their work "In
  inspiration" row), the album link behind "From this event" (today it opens the shop page), the "N in inspiration"
  count on the shop's Their work album, and "Also in" jumping to the other part.

SPEC IMPACT: None — builds an approved design; the DECISION_LOG row (ff3781e5) already records the rulings.
