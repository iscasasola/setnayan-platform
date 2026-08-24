## 2026-08-24 · feat(papic): a supplier's photographs compress like everyone else's

Owner 2026-08-24: *"compress it as well."* Migration `20271161602044`.

Every other photograph on this platform is stored twice — the full-res original and a
compressed AVIF web copy — and after the retention window the original is **replaced by** the
copy, so the photograph is never deleted, only its resolution changes. `vendor_papic_captures`
had none of the columns that model needs, so a supplier's photographs sat at full resolution
indefinitely, outside the retention model the public `/privacy` notice describes.

⚠ **The absence failed in the safe direction, which is why it lasted.** The sweep only ever
considers rows that already HAVE a web copy, so a table with no such column is not one it drops
from — it is one it cannot see. Nothing errored; the bill just grew.

**Three joints, all of which were missing:**

1. **The web copy is made** — through the *existing* `generatePhotoDerivatives`, in a second
   `after()` hook. Deliberately not folded into the NSFW hook: that one returns early on a
   posterless clip because there is nothing to *screen*, which is no reason to skip compressing
   a photo.
2. **The couple's copy goes out first.** 🔑 **The inverse before the destructive half.** The
   sweep refuses to drop anything not confirmed in the couple's Drive hand-off, and nothing
   enqueued a supplier's captures — so wiring the sweep alone would have been **inert on
   Drive-connected celebrations and unsafe on unconnected ones**. Same helper, same artifact
   type, same per-key dedup.
3. **The sweep sees the table** — photos only.

⛔ **A vendor CLIP keeps its original video, and there is no `clip_web_r2_key` column to imply
otherwise.** The couple-side video copy is transcoded in the *guest's own browser* (Vercel has
no ffmpeg, and we pay ₱0 of compute for it); the supplier path has no such transcode, so adding
the column without a writer would be the seventh "gate with no handle". The clip's **still** does
compress — its poster becomes `display_r2_key` — and a vendor clip is capped at 10 seconds,
measured at 0.25–1.48 MB, smaller than one phone photo.

**Safe by construction, not by sequencing:** a row is a candidate only once `display_r2_key` is
NOT NULL, written only after the replacement copy has uploaded. A failed compression leaves it
NULL and the original is simply kept. The failure mode is a bigger bill, never a lost photograph.

### 🚨 And it uncovered a pre-existing hole in the couple's own photographs

While mutation-testing the new query, a mis-aimed substitution removed the
`.not('display_r2_key', 'is', null)` filter from the **couple's guest-capture** query instead —
and the **entire 9785-test suite passed**. That one line is all that stands between this sweep
and deleting a full-res original with nothing to replace it, and it was unguarded for every
table.

The new guard is **derived from the code, not from a list of tables**: it finds every
drop-candidate query by the column the drop stamps, requires the right web-copy filter on each
(photo vs clip), and is **floored at three** so a renamed helper or moved query fails rather
than silently passing with nothing to check. Verified by removing the filter from each of the
three photo queries and the clip query in turn — four mutations, each measured **inside its own
query block**, each red.

**Exposure baseline regenerated:** exactly the ten new columns, no removals. A new column on an
existing table cannot be narrower than the table; the RLS policies are the control.

Live effect today: none. Prod holds 0 supplier captures and the capture surface is flag-dark.

SPEC IMPACT: None — this brings a feature under an existing retention lock rather than changing it.
