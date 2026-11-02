## 2026-06-28 · fix(day-of): exclude guest clips from the day-of LIVE tagged-photo gallery

`lib/guest-live-gallery.ts` `getGuestLiveGallery()` loaded `papic_guest_captures` rows
filtering only on moderation (`moderation_state='clean'` + `hidden_at IS NULL`) — it did
NOT filter `media_type='photo'`. Any guest tagged in a Papic guest CLIP therefore got the
clip's MP4 `r2_object_key` presigned and rendered into the day-of "photos of you, so far"
photo grid as a broken thumbnail. The module's own header contract already said clips are
excluded ("the Living Moments strip owns clip playback"), so the code contradicted itself —
and the sibling `papic_photos` leg in the same `Promise.all` already filters
`photo_type='photo'`.

Fix: added `.eq('media_type', 'photo')` to the `papic_guest_captures` query — mirroring the
existing `.eq('photo_type', 'photo')` on the `papic_photos` query in the same function. With
clips excluded at the DB level, a clip-tagged row's `source_id` never resolves to a key, so
it falls out of `ordered` (and `total`) — no second fix needed. This is the same root-cause
bug class fixed for the FREE Guest Stories render in `lib/guest-stories.ts` (PR #2335);
`guest-live-gallery.ts` is the sibling read that had drifted the same way.

Confirmed the clip column is `media_type` (text, NOT NULL DEFAULT 'photo', CHECK IN
('photo','clip')) added by migration `20270216612756_alaala_guest_clip_showcase.sql`. Honors
Papic's untagged-still-delivered + clean-allowlist rules: this change only EXCLUDES clips
from the PHOTO grid; legitimate tagged photos are untouched. No UX/copy/price change.

SPEC IMPACT: None. (Behavior now matches the file's existing photo-only contract — the
Living Moments strip is the clip surface — which the code had drifted from.)
