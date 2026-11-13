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
- DB test `tests/db/a-tagged-files-photo-shows-in-inspiration-only-when-the-shop-does.db.test.ts`.

SPEC IMPACT: None — builds an approved design; the DECISION_LOG row (ff3781e5) already records the rulings.
