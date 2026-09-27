## 2026-09-27 · fix(event-hub): the motion actually plays for guests — on a phone, in every engine, and never hides a word

A QA run on the SHIPPED components (Chromium phone + real iOS Safari 26.5, plus
an engine with scroll timelines stripped, standing in for iOS ≤ 18) found nine
ways the Event Hub's motion failed guests. All nine are fixed and re-measured
before/after in Chromium and iOS Safari 26.5:

1. **Words vanished on older iPhones.** A part's own motion was an ungated
   inline `animation`; an engine without scroll timelines played the Out on a
   clock and its `both` fill held opacity 0 (date, line, time at opacity 0 at
   rest). Element motion is now written ONLY inside
   `@supports (animation-timeline: view())` + `prefers-reduced-motion:
   no-preference` — a scene's as gated CSS (`hubElementSceneCss`), the hero's
   as custom properties (`--el-anim` · `--el-tl` · `--el-range`) that one gated
   `[data-el-motion]` rule in `globals.css` applies. Every Out's fill is
   `backwards`, so none can hold its end state.
2. **Sections with a background never moved.** `overflow: hidden` on
   `.hub-has-media`, `.hub-shape-framed` and the beside-photo box made them
   scroll containers, freezing every `view()` inside (the Cinematic photo's
   lift read 0.5 at every scroll position). Now `overflow: clip` (after a
   `hidden` fallback).
3. **Auto-scroll stopped as soon as a phone scrolled to it** — a touch pan
   starts with `pointerdown`. `hub-auto-run.tsx` now stops on `click` + `keydown`;
   a tap still stops it, the Play button still restarts it.
4. **Reduce Motion was ignored** by a part's scroll motion — fixed by the gate in 1.
5. **Calm / "Plays once" only played on the first screen.** Timed arrivals now
   start when the guest reaches the scene: `PahinaMotionObserver` (the page's
   ONE observer) also marks each `.hub-canvas` frame and each element-styled
   scene `.pahina-in` 32px before it enters, and the timed rules bind only
   then. Nothing is bound before the mark, so the words rest, visible.
6. **"Goes out" was dead on one-after-another parts** (Editorial/Cinematic
   default). The parts' arrival and hand-off now travel as `--hub-part-*`
   values read by one applying rule, with the Out as its second slot.
7. **Sideways wobble** with Comes in = Move from the Right: sections whose
   motion travels sideways clip their body on the x axis (12px → 0).
8. **A part's own motion lost to its scene.** Element motion rules now carry
   one id's worth of specificity (`:not(#el-own)`), always state
   `animation-timeline`/`animation-range` ("Plays once" inside Editorial is on
   the clock again), bind scroll-linked parts inside a pinned Scrub scene or an
   armed Auto run to the scene's named timeline (`--hub-tl`) instead of a
   `view()` that never moves, and put the scene's own In/Out back into the list
   for whatever the part did not choose (Drift no longer erases the arrival).
9. **A delayed part sat invisible through its Delay** — timed Ins use fill
   `none`; the hero's "Follows the scroll · In" plays on arrival (the hero is on
   screen when the page opens), its Out still follows the scroll.

The Maker canvas's instant preview (`editor-bridge.tsx` `applyHeroPartStyle`)
lays a hero part's motion the same way the guest page now does (the three
custom properties + `data-el-motion`, one list: `hubElementHeroMotionVars`).

Guarded by `apps/web/lib/the-motion-reaches-the-guest.test.ts` (14 properties,
each sabotage-proven) and four new cases in
`the-choreography-waits-for-the-page.test.ts`.

SPEC IMPACT: None — this makes existing choices render as specified. One open
owner question flagged in the PR: "Goes out" on a "Plays once" section (whole
or parts) is still not bound, by the canvas's own design ("a timed exit fights
the reader"), so the Maker offers a choice that does nothing on that timing.
