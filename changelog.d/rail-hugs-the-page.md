## 2026-08-18 · fix(event-hub): the desktop rail hugs the page instead of the window edge

**What a person gets.** On a wide monitor the five buttons sit just beside the
event's column, keeping a constant gap from it, instead of drifting to the far
left of the glass.

🔴 **THE OWNER LOOKED AT IT ON A REAL SCREEN AND IT WAS WRONG.** Pinned to
`left-0`, on a ~2000px monitor the rail sat **a thousand pixels** from the column
it belongs to — an orphaned pill in a field of cream — and on a second event it
**clipped** against the left edge.

🔑 **AND THE OLD GUARD PASSED THE WHOLE TIME.** It asked whether the rail
*cleared* the content, which an orphan in the far margin does perfectly.
**Clearing is not belonging, and only one of those two can be measured.** The
arithmetic was right and the result was still bad; that is what looking is for.

**The fix:** `left: max(0.75rem, calc(50% - 40.5rem))`, read right to left —
every room centres its column, so its left edge is `50% − half`; the widest
column any room uses is the 64rem stage (half = 32rem); the rail is 7rem plus a
1.5rem gap → 40.5rem. So the rail travels WITH the content as the window grows.
The `max()` is the clamp: below ~1296px that sum goes **negative**, which is
exactly the clipping that was seen, so it stops at a 0.75rem margin instead.
🔑 **A `calc()` that can go negative is a layout bug waiting for a narrow
screen.**

🪤 **AND I NEARLY SHIPPED IT ON A FALSE NEGATIVE.** A Tailwind arbitrary value
with nested `max()`/`calc()` can silently generate NO CSS — which would leave the
rail at `left: auto`, tests still green. I probed the real toolchain: the first
probe emitted **0 bytes** and looked like proof it failed. It was an empty input
stylesheet, so it could not have matched anything. Re-probed with a real
`@tailwind utilities` input: the rule compiles exactly as intended.
**A search that cannot match is not a negative result — this time it nearly cost
a correct fix rather than hiding a defect.**

🛡 `rail-fits.test.ts` rewritten for the new geometry — 7 assertions: the anchor
offset equals half the widest column + the rail + the gap; the clamp exists and
is not dead code; and even clamped at the breakpoint the rail cannot overlap the
widest column. **Mutation-proved, counts printed:** back to `left-0` (landed)
**4 fail** · clamp removed (landed) **3 fail** · anchor measured against the
48rem plate instead of the 64rem stage, my original error (landed) **3 fail** ·
restored **7 pass**.

⚠ **STILL NOT THE WHOLE DESKTOP PROBLEM.** This fixes where the rail SITS. The
page is still a phone-width column in a very wide window, with a lot of empty
cream around it. That is a composition question, not a placement one, and it is
not what this change claims to solve.

SPEC IMPACT: None.
