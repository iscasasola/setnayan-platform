## 2026-11-18 · fix(guests): the summary carousel never widens the page (W4 B2)

At 390 px Guests measured scrollWidth 406. `.carousel` in `components/snap-carousel.module.css` now has `max-width: 100%; overflow-x: clip`. Guard `lib/the-snap-carousel-never-widens-the-page.test.ts` (fails without it). CSS source guarded; the pixel was not re-measured in a browser. W4 B3 (wrong-number flash) is NOT changed: the kept copy drawing its own count is the 16 Oct "opens from the phone" design, pinned by a test — an owner question, see #7959.

SPEC IMPACT: None.
