## 2026-08-24 · fix(event-delete): a supplier's own captures are swept with the celebration

Found while answering an owner question about what the supplier-camera feature is. It is
flag-dark and prod holds 0 captures, so nothing is broken for anybody today — but it would have
been the moment the feature was switched on.

**The rows cascade; the files do not.** `vendor_papic_captures.event_id` is `ON DELETE CASCADE`,
so deleting a celebration removes every row — and with the rows go the only records of which
objects those photographs were. The files stayed in R2, permanently orphaned and unreachable.
That is the worst of both outcomes: the couple is told their photographs are gone, and they are
still there.

The owner's ruling of 2026-08-20 is that when a couple deletes their own celebration the
photographs go with it. It did not say *"except the ones a supplier took"* — and supplier
captures land in the couple's own gallery, which is exactly what that ruling was about.

`collectEventMediaRefs` now reads `vendor_papic_captures` alongside `papic_photos`, taking
**both** stored addresses (`r2_object_key` and `poster_r2_key`) for the same reason the papic
read takes seven: a clip's poster is a second fetchable copy of the same moment. It is collected
BEFORE the delete, like everything else there, and for a sharper reason — after the cascade
there is nothing left to read. A refused read returns `null` rather than degrading to "no
supplier files", matching the two reads beside it.

### ⏭ NAMED, NOT BUILT — supplier captures are outside the compression sweep

`papic-fullres-drop.ts` targets `papic_photos` and `papic_guest_captures` only, so a supplier's
photographs would sit at full resolution indefinitely, outside the retention model we publish.

This is **not** a two-line fix and was deliberately not attempted here: the sweep requires a
compressed copy to fall back to (`display_r2_key`) plus the drop bookkeeping
(`full_res_dropped_at`, `preserved_at`, `orig_bytes`, `full_res_drop_deferred_at`), and
`vendor_papic_captures` has none of them. Giving it a web copy means compressing at upload as
well — its own piece of work, and only worth doing if the lane is going to open.

SPEC IMPACT: None.
