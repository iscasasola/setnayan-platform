## 2026-10-04 · fix(poster): the logo's circle on the event card never squashes into an oval

Owner, on the Claire & Indalecio dashboard card: *"something might be wrong with the logo"*. Measured live: the paper invitation card's circle (`event-poster.module.css` `.circ`, `width: 21cqw; aspect-ratio: 1`) drew 51 × 17 px, an oval that cropped the mark, on every card (M & J too). The paper is a fixed-height flex column; when its words run tall (the theme body faces that went live in trains e/f), flex shrank the circle's height while its width held. `.circ` now has `flex-shrink: 0`. Applies everywhere `<EventPoster>` draws: the dashboard card, Discover, the Maker preview. Guard in `lib/event-poster.test.ts` (sabotaged: removing it turns red).

SPEC IMPACT: None.
