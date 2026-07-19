## 2026-06-28 · fix(stories): exclude guest clips from photo-driven Guest Stories render + correct tagged-photo count

`lib/guest-stories.ts` `readTaggedPhotos()` loaded `papic_guest_captures` rows filtering
only on moderation (`moderation_state='clean'` + `hidden_at IS NULL`) — it did NOT filter
`media_type='photo'`. Any guest tagged in a Papic guest CLIP therefore got the clip's MP4
`r2_object_key` promoted to a `StoryPhoto`, fed to the client-side `<img>` loader
(`lib/patiktok-render.ts` `loadImage`), which fired `img.onerror` and REJECTED the whole
FREE Guest Stories render with the misleading "Could not load a tagged photo (check R2
CORS)." The module's own header contract said "clips are excluded — Stories are
PHOTO-driven," so the code contradicted itself. Same root cause inflated the "You're tagged
in N photos" count (it counted clip rows too).

Fix: added `.eq('media_type', 'photo')` to the `papic_guest_captures` query — mirroring the
existing `.eq('photo_type', 'photo')` on the `papic_photos` query in the same function.
Confirmed the real clip column is `media_type` (text, NOT NULL DEFAULT 'photo', CHECK IN
('photo','clip')) added by migration `20270216612756_alaala_guest_clip_showcase.sql`. With
clips excluded at the DB level, a clip-tagged row's `source_id` never resolves to a key, so
it drops out of both the reel input and `total` → `taggedPhotoCount` (the count corrects
automatically; no second fix needed). Extracted the pure photo-set assembly into
`lib/guest-stories-photo-set.ts` (no `server-only`/admin deps) with a belt-and-suspenders
video-extension guard, and added `lib/guest-stories.test.ts` asserting a clip row is
excluded and the count reflects photos only.

Honors Papic's untagged-still-delivered + clean-allowlist rules: this change only EXCLUDES
clips from the PHOTO reel; legitimate tagged photos are untouched. No UX/copy change beyond
count correctness. No price touched.

SPEC IMPACT: None. (Behavior now matches the existing 0024/Stories spec contract — "Stories
are PHOTO-driven, clips excluded" — which the code had drifted from.)
