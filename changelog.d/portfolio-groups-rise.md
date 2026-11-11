## 2026-11-12 · feat(portfolio): each group heading rises its group full screen

Build 6 run list item 6. Owner, 10 Nov (DECISION_LOG "FULLY ANIMATED MOSTLY MEANS RISE FULL SCREEN"): every tappable block on a dashboard rises from itself, and closing falls back into it.

On Portfolio (`/vendor-dashboard/collections`) a group heading (On my page · Service cards · Albums by event · Your own shots · Delivered to couples · Instagram · Moodboard library · Song bank · Stories couples published · Video links) used to be a link to another page, or it opened the in-body panel. Now it is one button that rises the whole group full screen through the shared `RiseScreen` (`lib/rise-motion.ts` / `lib/rise-screen.ts`, 0.7 s, a cross-fade under reduced motion). The risen screen shows:

- the group's title and count;
- the group as a full-screen grid: every photo in the full-bleed 3-column grid (not just the rail's first 12), or each album under its own name and count;
- for groups without a grid of their own, the group's own tiles wrapped onto the 16-px gutters. An empty group keeps its finished empty look.

The group's own page is one row at the foot. ✕, Esc or Back falls back into the heading. Tiles still open their one collection in the body panel, as before. "More" stays a plain heading.

- `portfolio-sections.tsx`: `PortfolioSection` takes `rise` in place of `onOpen`, and `Rail` wraps inside a risen group.
- `portfolio-groups.tsx`: the grid is lifted into `PhotoGrid`, which the opened collection and the risen group both use, plus `AlbumGrids`.
- `collections-list.tsx`: every group passes its rise.

Guard: new `collections/each-group-heading-rises-full-screen.test.ts`. `the-portfolio-is-collections.test.ts` now counts the one rising head.

SPEC IMPACT: None. This applies the 2026-11-10 ruling.
