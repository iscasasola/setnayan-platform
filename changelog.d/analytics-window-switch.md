## 2026-11-12 · feat(analytics): "How is my business doing" — the ▾ window becomes the sliding switch (ruling 6075)

`performance/_components/business-doing.tsx` was the last Analytics surface still drawing the window as a
`PickMenu` ▾. It now wears the house `PillSelector` ("28 days" · "12 months", the thumb slides), exactly as each
Shop-carousel card already does (prototype `analytics_option_b_2026-11-11`, option 3). The three counts tick old →
new through the shipped `HeldCount` (no remount to 0); the bars regrow on a slide; a card handed one window shows it
as a label with no switch; each card keeps its own window. Reduced motion: thumb jumps, counts land, bars stand.
This card draws bars only — it has no curve to morph. Guarded in `the-pickers-are-one-dropdown.test.ts`.

SPEC IMPACT: None — implements the 2026-11-11 ruling as written.
