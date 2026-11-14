## 2026-11-13 · feat(card-maker): a card's photos are ONE gallery upload (owner-approved 13 Nov)

Owner, 13 Nov 2026: *"Card maker main photo and photos to be added should look like a gallery upload. tapping on a photo
will pop up set as primary photo, delete photo. at the end of the uploaded photos will be the photo place holder to
upload more photos. if they have placed all photo limit number, then add photo box will disappear"* — approved as drawn
(`prototypes/card_maker_gallery_upload_2026-11-13/`, DECISION_LOG "CARD MAKER GALLERY UPLOAD APPROVED").

- The Card Maker's Photos section is one 3-across grid of square tiles: the **primary** (`primary_photo_r2_key`) first,
  tagged "Primary", then the showcase photos (`showcase_photo_r2_keys`), then the add tile (rounded square, ImagePlus).
  The separate cover uploader and the "More photos · a clip" fold with its boxed "Showcase media" are gone.
- Tap a photo → the house sheet: **Set as primary photo** (waits, greyed, on the primary — its reason in the ⓘ) ·
  **Delete photo** (danger) · Cancel in the head. Set as primary swaps the keys (the old primary moves into the showcase
  list); deleting the primary promotes the next photo, said in one line with Undo (the shipped Undo toast).
- The add tile hides at **6 = the primary + 5** — the 5 is the DB CHECK `cardinality(showcase_photo_r2_keys) <= 5`
  (migration `20270502342558`), held in `lib/card-photos.ts` `CARD_SHOWCASE_MAX_PHOTOS`, which a test reads back from
  the migration. `showcase-media-fields.tsx` `maxFiles` now reads the same constant. A quiet "N of 6 photos" line.
- Uploads are the shipped `FileUpload` in a new opt-in `tiles` mode (gallery variant): its 0–100 pie, its 45 s stall
  watchdog and its failed tile ("Couldn’t upload. Try again." with Try again). No other caller changes.
- The clip stays its own row ("Clip", the unchanged clip uploader, now `ShowcaseClipField`).
- All help copy moved into the section's ⓘ (T17).
- Server: `actions.ts` reads both fields through one list (`cardPhotoFields`) — a card with photos always has a valid
  primary (the first showcase photo is promoted when none is posted), the primary never repeats in the showcase, and
  the showcase never passes the CHECK.
- Not moved: the "same day" capacity row stays where #7553 has it (its owner question is still open).

Tests: `lib/card-photos.test.ts` (swap-primary · delete-primary promotion · add tile hidden at the limit · the server's
cardinality and valid-primary rules · the limit read from the migration) and
`app/vendor-dashboard/services/the-card-photos-are-one-gallery.test.ts` (one gallery, the sheet, the clip row, a static
render posting the primary first).

SPEC IMPACT: None — builds the approved drawing; the DECISION_LOG row already records it.
