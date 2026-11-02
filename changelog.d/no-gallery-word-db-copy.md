## 2026-10-23 · copy(db): the copy the database holds says no "gallery" either

Follow-up to the no-gallery-word copy PR, on the owner's word (2026-10-23:
*"yes, do the migration as a follow-up"*). Migration `20271286099999`
rewords only rows that reach a screen, measured against production with a
read-only scan of every text/jsonb/array column in `public`:

- **Mood Board themes** — 120 names "… Gallery Vow" → "… Atelier Vow" (the
  generator's suffix already moved; "Once Upon a" takes "an"), and one
  description "in the entire gallery" → "in the entire collection".
- **Event Hub Pro** (`COUPLE_WEBSITE_PRO`, `COUPLE_HUB_PART_PHOTOS`) —
  "your own photo gallery" / "The photo gallery" → "photos you add", the
  name the item already carries in the app.
- **Pre-nup shoot locations** service schema — the supplier's field label
  "Upload at least 5 location gallery photos" → "… location photos to your
  Portfolio" (the key `gallery_image_uploads_count` is unchanged).
- **Admin privacy console** — the `vendor_papic_capture` note's "the
  couple's gallery" → "the couple's Memories".

Every change is a `replace()` of the exact old phrase (an admin's later
wording is kept) and idempotent; keys, tokens, prices, COMMENT text, logs,
what couples typed, and the retired `save_the_date_video` row are untouched.
Held by `apps/web/tests/db/no-gallery-word-in-stored-copy.db.test.ts`
(words-only, no "gallery" left, idempotent; sabotage run recorded in it).

SPEC IMPACT: None — applies the 2026-10-23 DECISION_LOG row "no 'gallery' in
the UI" to stored copy; no new decision.
