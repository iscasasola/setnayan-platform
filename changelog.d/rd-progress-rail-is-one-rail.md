## 2026-09-23 · feat(progress): the journey rail becomes one rail, six stops, one number (treatment B)

The owner picked **treatment B** from the three shown on the Overview prototype. His reason, relayed
by the controller: **A repeats the same number twice and C hides how far along they are overall; B
shows the whole journey and states one number.**

`JourneyRail` was six 46px ringed nodes, each printing its own `N% complete` — and, until the
previous change, a seventh repeat in the panel heading. It is now a single bar with a head, six stops
beneath it, and exactly one percentage: the current stage's.

**THE HEAD'S POSITION IS A STATED RULE, NOT A VALUE LIFTED FROM THE MOCK.** The approved drawing put
the head at 38% with no derivation, and a position nobody can re-derive is a number waiting to rot.
`railHeadPercent(index, pct, count)` in `lib/stage-mark.ts`: stops are evenly spaced with the first
at 0 and the last at 100, so there are `count - 1` gaps, and the head sits on the current stop
advanced into the gap ahead of it by that stage's own completion — `(index + pct/100) / (count - 1)`.
A stage at 100% therefore lands exactly on the NEXT stop, which is what finishing a phase should look
like. Executed across both ends, the degenerate `count <= 1`, and non-finite inputs.

⚠ **ONE DELIBERATE DEPARTURE FROM THE APPROVED MOCK, FLAGGED RATHER THAN SILENTLY COPIED.** The mock
drew every stop before the current one as "done", including one sitting at **8%**. That would tell a
couple a phase is finished when it is not — the same class of defect this rail has just been cleaned
of. So a stop's dot reflects **that stage's own completion** (`stageMarkFor`), never its position
relative to the current one. Behind-ness is carried by the fill reaching past the stop; completion is
carried by the dot. If the owner wants the mock's literal behaviour, that is a one-line change and a
decision he should make knowing it overstates.

**ONE NUMBER ON SCREEN, SIX IN THE ACCESSIBILITY TREE.** Each stop's button is `aria-label`led with
its own figure — somebody using a screen reader cannot see the bar, so hiding five numbers from the
screen must not hide them from the tree — and the single visible figure is `aria-hidden`, or the
current stop announces its percentage twice. That would be the exact duplicate this treatment removes,
wearing an accessibility costume. The guard counts visible labels at the TAG BOUNDARY
(`>\d+% complete`), so an attribute can never be mistaken for a rendered one, and asserts the
distinction in both directions.

**The guard mounts the component and reads the emitted HTML.** A source grep cannot do this: the
figure now appears in both an `aria-label` and (once) as text, and a string search cannot tell them
apart. Eight cases — the rail and head render; exactly one visible percentage and it is the current
stage's; the counter can say two, so the green means something; all six stops carry their figure for a
screen reader; three kinds of mark at 0 / 1–99 / 100; a not-started stop is smaller, read from the
emitted `data-markpx`; an all-zero event draws six dots and still one number; and the head's rendered
width matches the rule.

Four watched sabotages, each red on its own assertion, both files restored to verified hashes:
(A) show the figure on every stop → `visible percentages: 6`; (B) drop the `aria-label` → the screen
reader case fires; (C) make the not-started dot the same size as the rest → the size case fires,
printing `not-started px: [10,10]`; (D) replace the derived head with the mock's literal 38% → the
rule case fires.

🔑 **TREATMENT B ORPHANED THE RING-ERA SIZING, AND IT IS DELETED RATHER THAN KEPT.** `STAGE_RING_PX`,
`STAGE_DOT_PX`, `NOT_STARTED_MAX_RATIO` and `StageMark.diameterPx` existed to size a 34px
`ProgressRing` and floor the not-started mark at a third of it. B has no rings, so the moment they
stopped being read they became **well-tested constants nothing runs** — which is exactly the defect
that got `lib/digest-sub.ts` deleted this week, and it would have been self-inflicted. Measured
before removing: zero production references outside their own module. The size rule moved onto the
marks that actually ship as `notStartedIsSmallest()` — a strict inequality rather than a ratio,
because these are all small dots now and "a third of the others" was measuring a constant nothing
rendered. Its own vacuity is asserted: equalised sizes must violate it.

🪤 **THE TEST FOUND A REAL BUG IN THE MODULE.** `railHeadPercent(NaN, …)` returned `NaN`, because
`Math.trunc(NaN)` is NaN and NaN survives both `Math.max` and `Math.min`. The component would have
emitted `width: NaN%` — an invalid declaration a browser drops **silently**, leaving a rail with no
fill, which reads as "nothing has started" rather than as a bug. `index` is now guarded for
non-finite separately from `pct`.

🪤 **AND THE PREVIEW HARNESS LIED BEFORE THE COMPONENT DID — TWICE.** First every element measured
`0px` wide; the cause was the Browser pane having `window.innerWidth === 0`, so the whole reading was
an artefact of the measuring environment, not a layout bug. Then the dots rendered as SQUARES: this
repo maps `.rounded-full` to `var(--m-r-full)`, and the harness's token sheet carried only `--sn-*`,
so the radius resolved to nothing. Both were fixed in the harness. Worth recording because a preview
that misrepresents the component is how the owner came to judge "does not look clean" against six
stacked bars that exist nowhere in the product.

SPEC IMPACT: None — no locked decision, SKU or price is touched. This is the rendering of figures
`lib/progress-stages.ts` already computes; the six stage percentages are unchanged.
