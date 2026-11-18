## 2026-11-18 · perf(front-page): event-type tiles load a 330-px copy

The front page's event-type strip draws 150-px tiles but pulled 880x1100 photos (~170 KB each). Repo photos now get a `public/event-types/sm/` copy (~24 KB) through `srcSet`; admin uploads keep their URL. Guard: `lib/event-type-tiles-use-the-small-copy.test.ts`.

SPEC IMPACT: None
