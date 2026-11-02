## 2026-08-25 · fix(budget): the loading skeleton stops promising a page that never arrives

`budget/loading.tsx` drew a **four**-tile stat strip and **no** header action.
The page renders **three** stats (Target · Committed · Budget left) and **one**
action (Export upcoming dates). So the first thing a couple saw on every budget
load was a four-tile row becoming a three-tile row a beat later — everything
under it jumping, and a button appearing from nowhere. **The skeleton was
causing the layout shift it exists to prevent.**

🔑 **Neither file is wrong on its own.** Each reviews cleanly in isolation;
typecheck passes, every other guard passes. The defect exists only in the
RELATIONSHIP between them, and only at render — the same shape as the two pinned
bars this repo already wrote a lint for, which the owner found by looking at a
phone. **A guard that checks one surface can never see it.**

So `the-skeleton-matches-the-page.test.ts` reads BOTH and **derives** the
expected numbers from the page — how many `<SummaryStat>` it renders, and
whether its masthead carries an `actions=` slot — rather than hard-coding them
on each side. A hand-typed expectation in two files is two hand-typed lists,
which is not a guard. Change the page's stat strip and the guard tells you to
change the skeleton.

Found by the completeness critic of an adversarial audit, which asked what the
audit itself had not looked at.

SPEC IMPACT: None.
