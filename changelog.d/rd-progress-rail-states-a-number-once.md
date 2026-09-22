## 2026-09-22 · fix(progress): the journey rail states a number once, and a not-started stage is its own shape

Owner, on the Overview prototype: *"progress bar does not look clean."* Two objective defects sit
under that, both in `JourneyRail` (the "Read your progress" rail), and both survive whichever of the
three prototype treatments he eventually picks — so they are not style questions and were built now.

**1 · SIX STAGES PRODUCED SEVEN PERCENTAGE LABELS.** `{s.pct}% complete` rendered for every stage
inside the map, and `{active.pct}% complete` rendered AGAIN in the tabpanel heading directly below.
Neither was conditional, so both were always on screen — and the duplicated one was the stage the eye
is on. A screen that states one fact in two places is a screen that can begin disagreeing with
itself. The number now has one home, the rail, where all six are comparable; the panel keeps the
stage NAME.

**2 · ONE SHAPE CARRIED TWO MEANINGS.** At `pct = 0` a `ProgressRing`'s arc is fully hidden, so it
drew the TRACK circle alone — the same outline a half-finished stage draws, told apart only by
colour. A typical event has two of six stages at 0, and they read as things that had FAILED rather
than things not begun; a brand-new event drew six of them. A not-started stage is now a small hollow
dot: a different KIND of mark, not a paler version of the same one.

**The guard mounts the component and reads the emitted HTML** (`the-rail-states-a-number-once.test.ts`).
A source grep could not have done this: the duplicate lived in two different expressions (`s.pct` and
`active.pct`), so a string search finds two matches whether or not both reach a screen, and a
file-level match cannot count components at all. It asserts the active stage's label appears exactly
once, six labels for six stages, and which variant is drawn at 0 / 1–99 / 100 — plus an all-zero
event drawing six dots and zero rings, the state where the old behaviour was worst.

🪤 **The counter was wrong on its first run, and the fix is the interesting part: `"100% complete"`
CONTAINS `"0% complete"`.** A bare substring count reported three zero-labels where the rail draws
two, and would equally have hidden a real duplicate behind a neighbouring number. Counting is now
anchored at the tag boundary (`>${pct}% complete`), and the test asserts the naive count still
differs — so the boundary is provably doing work rather than being decoration.

🔑 **A SABOTAGE BEAT THE MARKUP GUARD, AND THAT IS WHY `lib/stage-mark.ts` EXISTS.** Re-drawing the
not-started mark as a RING-SIZED pale circle — a `<span>`, not an `<svg>` — passed the "a not-started
stage emits no `<svg>`" assertion with the defect fully restored: same full outline, same size,
distinguished from a real ring only by colour. A markup guard cannot see that, because the difference
is a NUMBER. So the kind and the size moved into a pure module and are executed:
`stageMarkFor(pct) → { kind, diameterPx }`, with `STAGE_DOT_PX / STAGE_RING_PX <= NOT_STARTED_MAX_RATIO`
(1/3 — the point at which two marks stop reading as the same object, a floor with a reason rather
than a round number chosen to fit today's value). Re-run against the module, that sabotage now fires,
printing `ratio 1.000 (max 0.333)`.

Five watched sabotages, each red, each file restored to a verified hash: (A) restore the duplicate
percentage in the heading → 2 tests fire, printing `7 labels for 6 stages`; (B) revert the 0% mark to
a `ProgressRing` → fires, printing `rings drawn: 5`; (C) the ring-sized pale dot → fires on the ratio
**only after** the module existed, and is recorded here because it PASSED beforehand; (D) loosen
`NOT_STARTED_MAX_RATIO` to 1 instead of fixing the size → fires on the vacuity check, which requires a
ring-sized dot to violate the rule. (D) is the "never weaken a guard to go green" case made
executable.

🪤 **A second assertion of mine was wrong and the module was right:** the test expected
`stageMarkFor(+Infinity)` to be `complete` ("at or past 100"), but the module coerces every non-finite
value to 0 before banding, so it reads as not-started. Infinity is not a measurement of 100% — it is a
broken read, and drawing a ✓ for it would tell a couple a stage was finished on a number nobody
computed. Failing toward "not started" understates; failing toward "complete" lies. The test was
corrected, not the code.

⚠ **THE PROTOTYPE'S "AS IT IS TODAY" PANEL WAS NOT WHAT SHIPS, AND THAT IS HOW THIS WAS FOUND.** It
drew six stacked BARS; the shipped rail is a horizontal tablist of six 46px ringed nodes with
connectors and a "You are here" marker. The owner's verdict was therefore passed on a drawing of
something that does not exist — the second time this project has paid for a prototype
misrepresenting its own build. Treatment A has been redrawn as a reproduction and verified in the
DOM (6 nodes, measured rects, the two 0% nodes resolving to `background-image: none`), not merely
written. Counted with `grep -o | wc -l`: all six nodes are on one line, so `grep -c` said 1.

⏳ **STILL THE OWNER'S CALL:** which progress treatment (A as-ships · B one rail, six stops · C just
where you are). "Does not look clean" is the premise of that question, not an answer to it, and no
treatment was picked here.

SPEC IMPACT: None — no locked decision, SKU or price is touched; this is the rendering of figures
`lib/progress-stages.ts` already computes.
