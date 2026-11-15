## 2026-11-13 · fix(service-card): the playing cover carries `data-swipe-photo`

The slideshow photo (`service-face-cover-show.tsx`) now carries `data-swipe-photo`, the mark the full-screen supplier
sheet's next-supplier swipe skips, so a sideways swipe that starts on a photo turns the photo and never changes the
supplier. Held by `lib/the-service-cover-plays.test.ts`.

SPEC IMPACT: None — implements the already-recorded rule (DECISION_LOG 12 Nov "SERVICE CARD PHOTOS PLAY AS A SLIDESHOW").
