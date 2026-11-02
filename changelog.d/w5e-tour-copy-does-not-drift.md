## 2026-08-25 · fix(tour): the public copy of the budget card stops carrying a defect its original had fixed

`/tour/budget` is STOP 4 of the **public, no-login** marketing tour, and its
per-supplier card is a declared read-only fork of the couple's
`VendorItemizationCard`. When the original's money figures moved into the ledger
face earlier the same day, the fork was not touched — so the very defect that
change existed to end, the word **Paid** appearing on one screen in two
typefaces, survived on the **one budget surface a stranger can reach without an
account**. The couple saw the fixed screen; a visitor evaluating Setnayan saw
the unfixed one.

🔑 **A clone inherits the bug its twin already fixed.** This repo has paid for
that at least twice — the Live Studio camera seat kept the *"one of the couple"*
copy its Papic twin had corrected, surviving in the signed-out arm because every
review pass was made signed in. Same shape here: the fork is the arm nobody is
looking at.

**The guard reads BOTH files.** A rule that only knew the tour file would pin
today's answer and say nothing about the pair. `the-tour-copy-does-not-drift.test.ts`
asks whether the fork AGREES WITH ITS ORIGIN, so fixing one and not the other
fails in **either** direction — including the direction nobody watches, where the
original regresses and the fork does not.

⛔ **DELIBERATELY NOT TOUCHED — and this is the important half.** The tour's
budget *planner* fork renders its big money figures in `font-serif` where the
original uses `font-mono`. That looks like the same drift and **it is a recorded
decision**: that file's own docblock says *"Palette retuned to the tour's tokens
(**serif headings**, #1B1A17 ink, #5F5E5A body …)"*. The itemization fork makes
no such claim — it says it copies the visual markup of the money strip — and it
kept the origin's mono labels verbatim, which is why its body-face figure is
inherited drift and the planner's serif figure is not. **A thing that looks like
a defect and is a decision is not yours to change**; the difference between the
two forks was one docblock away.

SPEC IMPACT: None.
