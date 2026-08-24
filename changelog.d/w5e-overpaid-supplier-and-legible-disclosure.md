## 2026-08-25 · fix(budget): an overpaid supplier is not a settled one, and the words that state a row's state are legible

**1 · "Remaining ₱0.00" in success green, to a couple who had overpaid.**
`remaining` is `Math.max(0, itemizedTotal - paidTotal)`, so paying ₱450,000
against a ₱400,000 supplier clamps to zero and renders **exactly** what an
account that balances renders. The couple got no signal at all that ₱50,000 went
out beyond the agreed figure — on the screen whose whole job is to tell them
where their money is. The summary strip at the top of that same page already
handles its own version of this ("Over target", warning tone); the row below it
did not. The cell now reads **"Overpaid by ₱50,000"** in the warning tone.

⚠ **The claim needs BOTH reads.** `paidTotal` is 0 when the payments read was
refused, and `itemizedTotal` silently falls back to the headline figure when the
line-items read was refused — **either one alone can invent an overpayment or
hide one.** With either unmeasured the answer is `unknown` and the cell renders
an em dash. Accusing a couple of overpaying on a guess is a worse defect than
the one being fixed.

The decision moved into a pure `describeSupplierBalance()` in `lib/budget.ts`
and is covered by **six real unit tests with real inputs** — settled, owing,
overpaid, a refused payments read, a refused line-items read (the half that can
invent an overpayment), and zero-and-zero — not by a source scan. The behaviour
is arithmetic; there is no reason to settle for reading the file.

**2 · The faintest text on the card was the only text stating the control's
state.** PR #4815 introduced an **Open**/**Close** pair and a chevron at
`text-ink/45` — **2.64:1** on this ground, below even the **3:1** non-text floor
an icon must clear, let alone **4.5:1** for words. Now `text-ink/70`
(**5.40:1**). A new rule in the collapse guard bans ink/40–ink/50 inside that
summary and carries the arithmetic.

⚠ Worth recording: my own report had named `text-ink/55` (3.45:1) as the
legibility item I was *not* fixing, while the thing I had just added was fainter
still. **The worst case was the one I introduced, not the one I inherited.**

Found by the completeness critic of an adversarial audit of my own merged work.

SPEC IMPACT: None.
