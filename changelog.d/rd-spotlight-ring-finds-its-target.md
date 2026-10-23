## 2026-10-23 · fix(spotlight): the ring wraps its target, lit, evenly — and the card sits beside it

Owner, on his own Maker at a ~1000 pt desktop window: *"spotlight tours are misaligned"*. In About the Maker, at
"Step 2 of 2 · Apply when you like it", the ring drew as a thin flat pill about 40 px **below** Apply, cut off at the
right edge. Apply itself stayed dimmed, and the card sat centred at the top of the page.

The cause was in the shared engine (`app/_components/spotlight-tour.tsx`), so every tour had it:

- **A bar the Maker covers still counted as an obstacle.** `freeBand` treated every fixed or sticky `header` / `nav` /
  `.shell-topbar` as something the ring must stay clear of. That included the app's own sticky top bar, which sits
  **under** the full-screen Maker where nobody can see it. The ring was clamped to start below that bar. Apply lives in
  the Maker's own top bar, so the clamp ate the ring's whole height: the height went negative and only the outline was
  drawn. The four dimming blockers then covered Apply. Now a bar only counts when it is **painted** (a hit test finds
  it on top) and the target is not drawn over it.
- **The padding was cut on one side.** `x = max(8, left − 8)` with the width cut at the screen's edge gave a button near
  the edge 8 px on the left and none on the right, with its outline off screen. Now every side gets the same padding:
  the largest, up to 8 px, that keeps the white outline on screen and out of the bars.
- **The card was always centred on the screen.** That works on a phone, where the card fills the width, but on a
  desktop it sat beside nothing. It now goes under its ring, over it, or next to it (a tall target on a desktop),
  centred on the ring and kept on screen. It is also `box-sizing: border-box`, so its width is its width.
- **A tall target scrolled flush under the top bar.** It then read as covered and its step was **skipped**, even though
  the target was right there. It now lands 16 px below the bar.
- **The layers are portalled to `<body>`.** A transformed ancestor (a page slide, a frosted panel) can no longer carry
  a `position: fixed` ring off its button.
- **Nothing left to light is a missing step.** It waits or is skipped like any missing step. An empty ring is never
  drawn.

The geometry is now pure functions in `lib/spotlight-geometry.ts` (`freeBandFrom`, `ringFor`, `tipFor`), held by
`lib/spotlight-geometry.test.ts`. The real engine, bundled and run in Chromium, is held by
`tests/e2e/the-spotlight-ring-wraps-its-target.spec.ts`. That spec covers **every step of every spotlight tour in
`lib/tours.ts`** (read at run time, so steps added later are walked too) at 375 · 390 · 1024 · 1440 · 1920 · 2000. For
each step it measures that the ring contains its target with even padding, that the target is lit rather than
dimmed, and that the card is on screen and beside the ring. It also checks that a missing target is skipped with no
empty ring drawn. Tour content is untouched.

SPEC IMPACT: None — the approved spotlight look (`prototypes/spotlight_tour_sample_2026-10-02.html`) is unchanged; this
puts the ring and the card where that look always meant them to be.
