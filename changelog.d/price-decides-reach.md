## 2026-08-28 · feat(marketplace): the price a shop declares decides which couples see the card

**S5 of the shop redesign.** The couple's budget FEEL band decided nothing, and a
shop was never told what its price was doing.

**What a person gets**

- A couple who picked a budget feel and a guest count — and never typed a peso
  figure — is finally searched for. Their band becomes a number and the vendor
  search ranks toward shops that fit it. Before, that couple was
  indistinguishable from one who answered nothing at all.
- A shop sees, on each service card in its own list, the reach that card's price
  is earning: **Full reach**, or **Limited reach — add a price in Edit details**,
  plus one line above the list when any card is short. The old label for a
  priceless card read *quote on request*, which told the shop nothing was wrong.

**How**

- New `lib/budget-band-money.ts` — the ONE arithmetic that turns a band into
  pesos. It had two implementations, in two flows, at two points of the same
  range: the wedding onboarding stores the band's TOP, `create-event` stores its
  MIDDLE, so the same band and guest count became two different budgets
  (~20% apart) depending on which door the couple came through. Both writers now
  call this module. **Neither stored value is changed** — moving a couple's saved
  budget is the owner's call, not a refactor's — but the disagreement is now one
  visible line instead of two implementations that never met.
- `resolveAllocationInputs` reads `budget_band` (already in the `events_host`
  projection and SELECT-granted to `authenticated` — verified against prod by the
  column ACL) on a query it already makes, and returns `estimatedBudgetPhp` +
  `budgetSource` alongside the unchanged `budgetPhp`. The extra band read happens
  only when no figure was stated, so the stated-budget path issues exactly the
  queries it did before.
- The category-search overlay and the vendors page opt in explicitly
  (`alloc.budgetPhp ?? alloc.estimatedBudgetPhp`) so the two surfaces can never
  disagree about one couple's budget. **The Budget Planner deliberately does
  not** — a money plan is the couple's to state, not ours to guess.
- New `lib/service-reach.ts` derives the shop's reach claim from the SAME
  function the search prices cards with (`paxAdjustedStartsAtPhp`), so the claim
  cannot drift away from the behaviour it describes.

**The rules held, and guarded** (`lib/price-decides-reach.test.ts`)

- ⛔ **Segmentation, never placement.** Reach has exactly two states. Inside the
  budget every priced shop ties at 1.0, so a bigger price cannot climb the
  ranking.
- ⛔ **Never hides a shop.** A priceless card scores the neutral fit and stays in
  the results; the estimate is the TOP of the band precisely so a guess can never
  sink a shop the couple could have afforded. The prototype's *"one card is
  reaching nobody"* would have been an untrue threat; the shipped word is
  **limited**, and a test fails if the copy ever says *nobody*.

**Not built, deliberately**

- `/explore`, the public marketplace grid, stays budget-blind (zero mentions of
  budget in 4,588 lines). A signed-out visitor has no budget to segment on, and
  giving that page one is its own project.
- Performance's *"most couples looking at you are planning ₱60k–₱120k"*. We do
  not have the couples to say it — production holds 6 events — and a market band
  computed from them would be an invented statistic shown to a shop as fact.

**Measured** · typecheck 0 errors (exit 0) · 10,888 unit pass · prod: 6 events,
1 carrying a band, 0 band-without-a-figure — so nothing changes for anybody
today; it starts working on the first couple who answers the band question and
skips the number.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-28 + `WHATS_NEXT_Shop_Redesign_SESSIONS_2026-08-28.md` (S5).
