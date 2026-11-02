## 2026-08-25 · fix(budget): the money guard stops crying wolf, and both of its rules share one JSX scan

Rule A of `money-wears-the-ledger-face.test.ts` found a ledger cell's enclosing
element with **"the nearest `<` before the match"**. Put an icon or a tooltip
between the `<dd>` and the figure — an ordinary, harmless edit — and that
returns the **icon**, whose className has no `font-mono`, so the guard failed a
change it does not govern with a message that was untrue.

Proved both ways, against both revisions of the rule, with one icon added to the
money cell:

| | icon added (a legitimate edit) |
|---|---|
| rule as merged (`origin/main`) | **RED** — pass 3 / fail 1 |
| rule on this branch | **GREEN** — pass 4 / fail 0 |

and with the icon present *and* the figure pushed back into the body face, the
new rule still goes **RED**. So it lost the false alarm and kept the catch.

🔑 **A guard that is loud on harmless edits teaches you to skim past the one time
it is right** — this repo has recorded that cost before. Rule B already carried a
real JSX scan (element stack, brace- and quote-aware tag ends) written because a
regex gets both the enclosing element and the attribute/content distinction
wrong; rule A now shares it instead of keeping a second, weaker answer to the
same question.

Found by an adversarial audit of my own merged work — it survived both skeptics
in the "does it matter?" direction precisely because the false-alarm direction is
how guards get deleted.

SPEC IMPACT: None.
