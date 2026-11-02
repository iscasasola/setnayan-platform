## 2026-09-15 · fix(papic): remove the photographer cost comparison from the public page

Owner, withdrawing his own figure: *"we have papic credits and 1 credit = 1
photo. i do not think 8000 costs 400 photos."* Then: ***"remove it."***

`/papic` told visitors what Papic **"would otherwise cost"** them, priced against
**₱8,000 for a photographer producing 400 photos in four hours**. Measured live
before removal: `"8,000"` ×2 and `"would otherwise cost"` ×4.

🔑 **The direction of the error is why it could not be softened.** ₱8,000 of
photographer almost certainly delivers far **more** than 400 photographs — so the
comparison **understated a competitor and flattered us**, in public, unsourced.
An unsourced claim that cuts in our own favour is worse than one that does not.

🔑 **And it was already flagged.** The session that built it typed the figure as a
MARKET ASSUMPTION and said in its PR that no `DECISION_LOG` row backed it.
**Nobody read the PR for six days.** A flag in a description is not a mechanism.
That is the durable lesson, and it is why the replacement is a test.

### Removed

`lib/papic-cost-comparison.ts` (all three constants and the builder),
`app/(shell)/papic/_papic-cost-comparison.tsx`, the section's mount, its test,
and its entries in the lost-controls baseline.

⚠ **The anchor is untouched.** `resolvePapicComparisonRung` read the same `rungs`
array `resolvePapicAnchor()` resolves, so a careless deletion could have taken the
anchor's own logic with it. The page computes `anchor` for its own reasons and
only *passed* `anchor.rungs` in — verified before deleting.

⛔ **Nothing replaces it.** No range, no softer figure. There is no sourced number
for a competitor, and inventing a gentler one is the same defect with better
manners. The section is simply gone; if the page reads thin, that is the owner's
to fill.

### The guard — `no-price-on-somebody-elses-business.test.ts`

Pinned to the **shape of the claim**, not to a constant name — re-typing `8_000`
under a new name still trips it. Six patterns: *"would otherwise cost"*, a peso
figure either side of "photographer", a photographer's rate as a number, and a
photographer's output in photos/shots/images either way round. Comments are
stripped first, because the page's own docblock quotes the removed figure on
purpose and prose about a dead claim must never read as the claim.

It also asserts that **stating our OWN prices is still allowed** — a guard that
went red for correct copy would be worse than none — and that the scan is
non-vacuous.

**Sabotage-checked with the realistic failure, not the obvious one**: putting back
a *softer* figure ("about ₱6,500 for roughly 300 photos") turns it RED.

SPEC IMPACT: the ₱8,000 / 400-photo market assumption is withdrawn by its author;
logged in `DECISION_LOG.md`.
