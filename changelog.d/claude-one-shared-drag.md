## 2026-11-01 · feat(drag): one shared edge scroll for every list's drag

Owner ruling "ONE SHARED DRAG-AND-DROP WITH EDGE SCROLL FOR EVERY LIST": while something is held, near a list's top
or bottom edge the list scrolls by itself, faster the nearer — in its own box or the whole page.

- New `apps/web/lib/drag-edge-scroll.ts`: the one rule (`dragEdgeStep`) + what scrolls (`dragScrollerOf`), its band
  (`dragBandOf`) and the scroll (`dragScrollBy`). Replaces three copies of the math: the Maker scene drag
  (`maker-scene-drag.ts › sceneEdgeScroll`, now a reach on the shared rule), the Wedding March (`details-march.tsx`,
  which Guests › March renders) and the RSVP stage's line drag (`rsvp-canvas-drag.ts`).
- One curve for all: 4 px/frame at the band's inner line rising to the cap at the edge (the March's; the scene keeps
  its cap of 14, its any-height-above reach and its bin). The scene's first step is now 4 px/frame instead of 1.
- Hold-to-lift and the "tap · move" fallback are unchanged in each drag.
- Guard `apps/web/lib/one-drag-edge-scroll.test.ts`: speed rises toward the edge; no second copy of the math; every
  drag that follows a finger and scrolls asks the one rule.

SPEC IMPACT: None (implements the 2026-11-01 DECISION_LOG row as written).
