## 2026-09-28 · fix(maker-logo): Draw on traces again, follows the pen part by part, and each layer sets its speed

Owner, on the layered Logo page: *"logo animation lost its trace effect"* · *"draw the trace does not follow properly"* · *"The start started with 2 points"* · *"each part separated with a small gap"* · *"the animation can set it speed"* · *"highlight or identify each part to detect its start and end point"*.

- **Trace restored.** Draw on works with no writing path: one pen traces the letter's own outlines, one after another (so it starts in ONE place), then the fill inks in. It is a new layer's default again (was Fade).
- **Follows the pen.** With a writing path, the fixed-width mask brush is replaced by the pen's cells (`writeRevealCells`): each bit of ink appears when the pen reaches the nearest point of the path. Measured on the owner's C: the brush left 29% of the ink to pop in when the mask came off; the cells show 99% before the pen finishes. Nothing shows before its moment (the brush's round cap used to show a dot at every layer's start).
- **Part by part.** Each gap-separated part (one traced shape each) follows only the pen that is on it (`writeRevealPlan`, `lib/logo-parts-dom.ts` shared by player and editor).
- **Speed.** Each layer's In takes `motion.dur` seconds (0.3–8, `data-dur`); absent = the old default, so saved logos keep their timing.
- **Editor.** While tracing / on a traced layer: parts in their own colours, Start and End on the trace, parts numbered in pen order, "Reverse it". Brush slider removed.
- **Capture.** A long trace is thinned evenly instead of cut at 400 points (the closing curl was lost); the release reads the stroke from a ref, not a stale render.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-28 row "THE LOGO'S DRAW ON — TRACES AGAIN, FOLLOWS THE PEN, PART BY PART, AT ITS OWN SPEED" (retires the 2026-09-27 build's "no writing path ⇒ Fade" and the brush).
