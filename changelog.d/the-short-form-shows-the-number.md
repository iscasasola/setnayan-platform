## 2026-08-29 · fix(onboarding): the short form shows the budget before it saves it

Owner 2026-08-29, on the recommendation that both doors show the couple the range
before storing it: **"ok"**.

**The defect.** Two doors into a celebration, two different saved budgets for the
same two answers:

| | shows the couple | saves |
|---|---|---|
| wedding flow | the band's range, with a slider on its top | the **top** |
| short form (every other celebration) | *"we'll estimate a starting budget"* — no figure | the **middle** |

Same band, same guest count, **about a fifth apart** depending on the door — and
that number decides which suppliers the couple is shown (budget-fit is the
second-largest dimension of the match score) and what the budget planner splits.

**The fix is the honest half, not the arithmetic half.** The rule that was true
on one door and false on the other is *show the couple the number before you save
it*. The short form now prints the range live as they pick a feel and type a
guest count — *"About ₱600K – ₱900K for 150 guests. We'll start you at the top of
that and you can change it any time."* — and stores that top. Both doors now
store the same figure, as a consequence rather than as the change.

⛔ **The middle is DELETED, not kept beside the top.** A second stored answer
nobody calls is how the two crept apart in the first place. The arithmetic that
produced it survives as `bandRangePhp`, whose ends are 0.8x and 1.2x that median.

**Cost, stated plainly:** budgets on non-wedding celebrations now start about a
fifth higher than they did — at a number the couple has been shown and can
change, rather than a lower one chosen for them in silence.

**Four tests failed, and every one was right to.** Two asserted the old lower
figure; one pinned which function the capture calls; and one — written yesterday
— said *"the two stored answers still differ … if these ever converge, somebody
made a call about a couple's money and this test should be the thing that
notices."* It noticed. It now pins the convergence and carries the ruling.

🔒 **New guard: screen and storage cannot drift again.** The picker prints
`bandRangePhp(...).highPhp`, the capture stores `bandReachBudgetPhp`, and a test
proves those are the same value at four band/pax pairs — not merely similar.

**Measured** · **11,153 unit pass, 0 fail** · 5 mutations, each measured by
occurrence count before → after, all RED: the middle restored, the range no
longer printed, the vague promise brought back, the retired function
reintroduced, and storage drifting to the low end (20 failures — the widest
blast radius, which is what a money change should look like when it goes wrong).

SPEC IMPACT: `DECISION_LOG.md` 2026-08-29.
