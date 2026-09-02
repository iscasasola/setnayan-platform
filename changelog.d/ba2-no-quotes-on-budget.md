## 2026-09-02 · feat(budget): quotes leave the budget page — /budget prints finalized money only (BA2)

**Owner ruling, 2026-09-02, verbatim:** *"no quotes here. we only add the finalized budgets. on the marketplace, this is where they can add and subtract the other vendors to help them find the better option for them."*

`/dashboard/[eventId]/budget` answers one question — **what have we signed for, and how much of it have we handed over?** A shortlisted supplier's ₱80,000 is a guess about a decision the couple has not made. It belongs in the Merkado, next to the other candidates, where adding and subtracting one is the whole point.

### What changed

- **`lib/budget-page-money.ts` · `vendorsToItemize`** — stops widening. BUD-2 widened it from `contracted`+ to `contracted`+ **or carrying money**; it is `contracted`+ again, in **both** flag states, so the `enabled` parameter is gone (a parameter that changes nothing is a second story about one fact). `vendorCarriesMoney` went with it — it existed only to widen this list, and a dead exported predicate about money is exactly the second mechanism that drifts.
- **`lib/budget-page-money.ts` · `BudgetStripMoney`** — the `estimatedPhp` field is removed, so the strip's *"₱X more is still an estimate"* hint has nothing to print. The hint is retired in `budget/page.tsx` with it.
- **`app/dashboard/[eventId]/budget/actions.ts` · `getBudgetLiveSummary`** — found while measuring, fixed here: see below.

`resolveEventMoney` is **untouched**. `EventMoney.estimated` and `MoneyBucket.estimatedPhp` are still computed and still read — by the Merkado lens's siblings and by the checklist. This is a display rule for one surface, not arithmetic.

### The second writer of the same card

`/budget`'s live payment-progress card is written **twice**: `budget/page.tsx` computes the first paint through `budgetLiveSummaryMoney`, and the Realtime refetch (`getBudgetLiveSummary`, fired by `BudgetLiveSummaryCard` on any `event_vendor_payments` / `event_vendor_line_items` change) returned the **raw legacy summary** — whose `budget` is *every vendor's itemized total, whatever their status*, with the headline `total_cost_php` as its fallback.

With `NEXT_PUBLIC_BUDGET_TRUTH_ENABLED` on (Production since 2026-09-02) a card that first painted ₱0 committed would **swap to ₱80,000 the moment a payment landed** — the removed quote, straight back onto the page, with no card anywhere to explain it. Now routed through the same core, with the same degrade-to-legacy rule the two render surfaces use.

**Measured against prod, 2026-09-02: LATENT, not yet observable.** No event has both an unconfirmed vendor carrying money *and* the confirmed-vendor payment activity that fires the channel — `044f7e64…` is the only event with the former and it has 0 line items and 0 payments. Wired anyway: two writers of one number must not be able to disagree.

### Why this does not break §18.5 rule 3

Rule 3 says an estimate must not vanish, and it is right — **on its premise.** That premise is that un-booked vendors are listed on this page: a couple reading **₱0 committed** beside an **₱80,000 vendor in their own list** is a contradiction the page has to explain, which is what BUD-2's estimate hint did. Remove the vendor and the premise goes with it — there is no ₱0-next-to-₱80,000 left to explain. The estimate has not been hidden; it is shown where the couple is actually choosing.

This is a deliberate reversal of a documented display rule, not an oversight, and it is applied to the corpus in the same session (below).

### Guards

New **`lib/no-quotes-on-the-budget-page.test.ts`** asserts the narrowing three ways, each facing a different way of undoing it — the widening it reverses was a *correct* answer to a real defect (R1) and is the kind of change a future session re-derives in good faith:

1. **Behaviour** — a vendor carrying money through *every* channel the snapshot has (headline · itemization · logged payment · payments array) gets no card at `considering` · `shortlisted` · `inquired` · `quoted` · `declined`; the complement asserts a `contracted` vendor with the *same* money still does, so a filter that returns nothing cannot pass.
2. **Shape** — `budgetStripMoney`'s result carries no estimate-shaped key, in **both** flag states.
3. **Source** — the page's list is built by exactly one `vendorsToItemize(` call and nothing else turns `snapshot.vendors` into a list; the page reads neither `estimatedPhp` nor `money.estimated`. Property 1 is blind to a page that stops calling the seam.

`lib/budget-one-core.test.ts` and `lib/flag-chokepoint-scan.test.ts` both gain `budget/actions.ts`, so the Realtime writer cannot silently go dark either.

**Sabotage-tested, all four red:** re-widening `vendorsToItemize` → 5 failures · growing `estimatedPhp` back → 2 · replacing the call with an inline filter in `page.tsx` → 1 · reverting the refetch to the raw legacy summary → 2.

**Effect on the prod fixture** (event `044f7e64…`, measured 2026-09-02: 0 confirmed vendors, 1 `considering` carrying ₱80,000): `/budget` now shows ₱0 committed with the existing *"You're still choosing vendors — the moment you contract one, its itemized costs and payments show up here"* empty state and its **Open vendors** doorway. The ₱80,000 appears nowhere on the page; it is in the Merkado, where the couple is comparing.

### SPEC IMPACT

**Not "None".** This reverses a documented display rule. Applied directly in the corpus at `~/Documents/Claude/Projects/Setnayan/` per the 2026-06-04 direct-edit authorization:

- `DECISION_LOG.md` — new row: *`/budget` shows finalized money only; quotes and shortlists live in the Merkado* (owner, 2026-09-02), recording that it narrows §18.5 rule 3's scope rather than contradicting it.

⚠ **Surfaced for owner sign-off:** §18.5 rule 3 remains in force everywhere else — the Merkado lens and the checklist still read `estimated`. Only `/budget` stops printing it.
