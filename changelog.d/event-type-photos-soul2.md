## 2026-11-04 · feat(event-types): the 17 event-type photos — the owner's 4 Nov renders

Replaces `apps/web/public/event-types/*.webp` one for one (same 17 names, 880×1100 WebP) with the owner's
4 Nov Soul 2.0 renders: upper-class Filipino families at upscale venues, real guest counts, one frame.
Every surface reads these through `eventTypePhotoSrc` (admin `hero_photo_url` → repo file);
live `/start` was measured on 4 Nov serving the repo file for all 17, so no admin override hides them.
Weight: 921 KB → 1,570 KB in the repo (+649 KB); pages receive `next/image` resizes, not these files.

**Faces kept in the strips.** The launcher card and the event-dashboard band show these 4:5 photos as a
wide strip (a fifth to a half of the photo's height) at a per-event height (`EVENT_CARD_CROP_STOPS`
26–50 %, zoom up to 1.3). That assumed the subject sat mid-frame; the new photos put faces in the top
~10–35 %, so 13 of 17 types lost heads in most framings. Now:

- `EVENT_TYPE_PHOTO_FACES`, beside `eventTypePhotoSrc` in `create-event/_components/event-types.ts` —
  the per-type focal point: the measured face span `[top, bottom]` of each repo photo, applied only when the drawn photo IS that repo file (an admin upload keeps the old crop).
- `lib/event-card-art.ts` `faceFramedObjectPosition` — places the span inside the strip with CSS
  container units (`cqw`/`cqh`), so it holds at every card width; the per-event variety becomes a slide
  through the room the strip leaves (plus the existing mirror and colour). Zoom is dropped in this mode.
  A span taller than the strip pins its top, so the heads are the part kept.
- `EventScene` gains `footClear` (how low the faces may sit); the dashboard passes 0.6 for its fade.
- `lib/event-type-photo-faces.test.ts` — every photo has a span and every span a photo; heads are in the
  band at the four measured strip sizes for every slide; the CSS equals its numeric twin.

Known limit: on the 1280 px dashboard strip (19 % of the photo's height) a tall group span keeps hair and
eyes, and mouths sit under the paper fade. Photos whose faces touch their own top edge have little or
no slide variety on roomy strips; mirror and colour still tell those events apart.

SPEC IMPACT: None
