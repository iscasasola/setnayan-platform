## 2026-11-18 · perf(front-page): event-type tiles load a 330-px copy

The front page's event-type strip draws 150-px tiles but pulled 880x1100 photos (~170 KB each). Repo photos now get a `public/event-types/sm/` copy (~24 KB) through `srcSet`; admin uploads keep their URL. `sizes` names both widths the stylesheet draws (150 px on a phone, 200 px from 701 px), so a 2× desktop still takes the 880. Guard: `lib/event-type-tiles-use-the-small-copy.test.ts` (reads the widths from the CSS).

SPEC IMPACT: None
