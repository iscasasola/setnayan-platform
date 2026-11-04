## 2026-11-04 · feat(event-types): the 17 event-type photos — the owner's 4 Nov renders

Replaces `apps/web/public/event-types/*.webp` one for one (same 17 names, 880×1100 WebP) with the owner's
4 Nov Soul 2.0 renders: upper-class Filipino families at upscale venues, real guest counts, one frame.
No code change. Every surface reads these through `eventTypePhotoSrc` (admin `hero_photo_url` → repo file);
live `/start` was measured on 4 Nov serving the repo file for all 17, so no admin override hides them.
Weight: 921 KB → 1,570 KB in the repo (+649 KB); pages receive `next/image` resizes, not these files.

⚠ Known, not fixed here: the launcher card band and the event-dashboard band crop these 4:5 photos to a
strip at a per-event height (`EVENT_CARD_CROP_STOPS` 26–50 %, zoom up to 1.3 in `lib/event-card-art.ts`).
The new photos put faces in the top ~10–35 % of the frame, so most types lose heads in most framings
there. There is no per-type focal point to set; that needs its own change.

SPEC IMPACT: None
