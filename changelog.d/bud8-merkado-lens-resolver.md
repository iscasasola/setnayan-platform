## 2026-08-14 · fix(budget): the Merkado payments lens joins the shared money resolver — before anyone flips the flag (BUD-8, flag-dark)

`MARKETPLACE_FOUR_TABS_PLAN_2026-08-13.md` §3.3 slice 4, and the last of the two "our money" screens still doing its own arithmetic.

**The defect, and why nobody has seen it yet.** `/dashboard/[eventId]/budget` moved onto the shared calculator (`lib/budget-truth.ts` → `resolveEventMoney`) in BUD-2. The Merkado payments lens did not — it computed from the legacy `buildBudgetLiveSummary`. Both are screens a couple would call *"our money"*, and today they agree only because `NEXT_PUBLIC_BUDGET_TRUTH_ENABLED` is **off**. The moment it is switched on, they disagree.

**Measured, not asserted** — `scripts/budget-parity.ts` against the read-only prod capture:

| event | Merkado lens · "to go" | `/budget` · still owed | gap |
|---|---|---|---|
| `947e7bab…` | ₱698,500 | ₱698,500 | ₱0 |
| `044f7e64…` | **₱80,000** | **₱0** | **₱80,000** |

The ₱80,000 is one `considering` vendor's headline — an ESTIMATE, a guess the couple has not agreed to pay. The resolver reports it as `estimated` and keeps it out of `committed`/`stillOwed` (§18.5 rules 2/3); the legacy formula folds it into the total anyway. So on the owner's own event, flipping the flag without this slice would have put two screens **₱80,000 apart on the same wedding**.

🔴 **THIS MUST LAND BEFORE ANYONE FLIPS `NEXT_PUBLIC_BUDGET_TRUTH_ENABLED`.**

**The change** — `app/dashboard/[eventId]/vendors/_components/merkado-budget-lens.tsx`:
- reads `isBudgetTruthEnabled()` (never the env — property 1 of the chokepoint scan) and joins `resolveEventMoney` into the existing fetch as a `Promise.all`, so **flag OFF issues not one extra query**;
- computes through the SAME pure core `/budget` uses, `budgetLiveSummaryMoney` — no new arithmetic, no new schema, no second formula to keep in step;
- carries the SAME degrade-to-legacy rule: any resolver failure returns `null` and the lens falls back to the legacy figures rather than printing a confident ₱0.

**One copy change, flag-gated.** The progress subline said *"{n}% of your itemized total is paid"* — under the resolver that base is what the couple has **committed**, not every vendor's itemized total. A right number under a wrong label is the same misleading-name defect the resolver exists to end (`sponsored_included` · `tagged_only`), so the noun follows the arithmetic. **Flag OFF the sentence is byte-identical.**

**Ownership held** (§5, settled): the lens still owns paid-so-far · progress · next dues · ONE doorway, read-only. It declares no editor control, and the phone gets no fourth Budget doorway. Nothing was redesigned — session 7 owns this component's look.

**Guards — both mutation-tested, counts measured before → after:**
- `lib/flag-chokepoint-scan.test.ts` — the lens is now a **named gate** on `NEXT_PUBLIC_BUDGET_TRUTH_ENABLED`, inheriting all four properties. Sabotage: `isBudgetTruthEnabled()` 1 → 0 occurrences ⇒ **2 failures**.
- `lib/budget-one-core.test.ts` (new) — both money surfaces must call `budgetLiveSummaryMoney`, and every `buildBudgetLiveSummary(` in them must be the `legacy:` argument to it. Sabotage A, full bypass: `budgetLiveSummaryMoney(` 1 → 0 ⇒ **2 failures**. Sabotage B, *partial* bypass (core kept, one extra direct read added): `buildBudgetLiveSummary(` 1 → 2 ⇒ **1 failure**. Sabotage B is the point — a presence-only check would have stayed green.

**The parity harness is annotated, not "fixed".** Its before/after outputs are **identical**, because it transcribes the legacy arithmetic verbatim and deliberately does not import the surfaces — so it cannot observe this change. Its rows for wired surfaces are now labelled as *the jump that happens when the flag is switched on*, not as unfixed surfaces. No figure in it was touched: editing the measuring stick to agree with the code would destroy the only reason to run it.

**Verification.** Full unit suite **8056 pass / 4 fail**, and all 4 failures are `Cannot find module` for packages absent from this machine's borrowed `node_modules` (`@anthropic-ai/sdk`, `@electric-sql/pglite`) — none budget-related. Typecheck error set is **byte-identical** (0 lines of diff) to unmodified `origin/main` in the same tree, so this change adds none; the local 262 are the same missing-module artifact. `pnpm build` cannot run on this machine — **CI is the only valid build claim.**

SPEC IMPACT: None — executes `MARKETPLACE_FOUR_TABS_PLAN_2026-08-13.md` §3.3 / §7 slice 4 as written; no decision changed, no price, SKU or lock touched.
