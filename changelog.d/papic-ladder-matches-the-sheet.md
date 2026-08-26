## 2026-08-26 · feat(papic): the shot ladder becomes 16 rungs, priced off ₱1 = 1 credit

The owner showed his own credit sheet and asked why the live prices did not match it. They did not:
two rungs were underpriced and his top rung **did not exist in any form** — not retired, not
switched off, never created — so the largest package a couple could ask for could not be bought.

**The ladder is now 16 rungs** (credits / bundle price, against a ₱1-a-credit regular price):
100 ₱50 · 200 ₱100 · 300 ₱150 · 400 ₱200 · 500 ₱250 · 1,000 ₱500 · 2,000 ₱1,000 · 3,000 ₱1,200 ·
4,000 ₱1,600 · 5,000 ₱2,000 · 6,000 ₱2,400 · 7,000 ₱2,800 · 10,000 ₱3,200 · 20,000 ₱5,000 ·
30,000 ₱7,500 · 50,000 ₱10,000 — 50% off at the bottom deepening to 80% at the top. Two prices
move (3,000 → ₱1,200 · 10,000 → ₱3,200), ten rungs are new, two come back on sale (6,000 · 30,000,
re-priced) and four come off (13,000 · 16,000 · 23,000 · 26,000 — **deactivated, never deleted,
keeping their activation hooks** so an order minted earlier still converts).

🛑 **WHY THIS WAS NOT ALREADY BUILT.** The corpus `DECISION_LOG.md` recorded this ladder on
2026-08-26 with the words *"Built as given"* — and it was not built. Measured before writing a
line: no migration on `origin/main`, no branch anywhere carrying `PAPIC_GUEST_50K` outside one
negative test fixture, no open PR. **A decision log is not evidence that code exists.**

🚨 **A RUNG IS THREE PLACES, NOT ONE** — the catalog row (the peso figure), the `papic_pass_tiers`
row (the shots), and a line in `lib/sku-activation.ts`. That dispatcher ends `if (!hook) return;`,
a no-op, so a rung on sale and absent from the map is fully purchasable and grants **zero** shots:
no throw, no log, an empty pool and a paid order. All 10 new hooks ship here.

🪤 **A REAL NEGATIVE FIXTURE ROTTED INTO A LIVE PRODUCT.** `papic-guest-buy.test.ts` used
`PAPIC_GUEST_50K` as its example of an *unknown* service code. That code is now a real rung, at
which point the test would have stayed green while asserting a live product is unknown. Swapped
for a code that can never be minted, with a note saying why.

⚖ **40,000 IS DELIBERATELY ABSENT, and that is the flag working.** His first table had it at
₱10,000 — the same price as 50,000 — so nobody could rationally choose it. It was surfaced to him
rather than silently corrected, and he removed it: *"remove the 40,000"*. **Do not re-add it
without a price of its own.**

**Guards.** `papic-rungs-are-fundable.db.test.ts` now pins the 16-rung set *and* two rules derived
from the live ladder rather than from the literal, so they still bite on a future re-cut nobody
runs past this file: **no rung may cost more than ₱1 a credit**, and **buying more must never cost
more per credit than buying less** (`<=` rather than `<`, so a future ladder may legitimately
repeat a per-credit rate). Mutation-checked: removing the `PAPIC_GUEST_50K` hook takes the
occurrence count 1 → 0 (measured, printed) and turns the guard RED. Migration dry-run against
production in an aborting transaction first — 16 on sale, 0 above ₱1-a-credit — then prod
re-queried to confirm it was unchanged.

**Nobody is affected by the two increases:** production has taken two orders in its life and
neither was a Papic rung. The free 50 per event is untouched (a grant, not a catalog row) and
cameras stay free and unlimited.

SPEC IMPACT: `CLAUDE.md` (Papic ladder) + `DECISION_LOG.md` already carry the 16-rung decision as
of 2026-08-26; this PR is the build half that the earlier row claimed was already done.
