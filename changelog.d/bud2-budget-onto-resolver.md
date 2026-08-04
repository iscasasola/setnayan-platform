## 2026-08-04 · fix(budget): the budget page stops printing three different totals over three different row sets (BUD-2, flag-dark)

`Explore_Replan_BUILD_SPEC_2026-07-27.md` §18.6's **BUD-2 — "kills R1 (live prod defect)"**. BUD-1 shipped the shared resolver (`lib/budget-truth.ts` → `resolveEventMoney`, PR #3842) **read-only, nothing wired**; as of this branch its only importer was still `scripts/budget-parity.ts`. This is the first surface moved onto it.

**The defect, live on prod today.** `/dashboard/[eventId]/budget` computes its money three times over three different row sets and renders all three on one screen:

| What the couple reads | Row set |
|---|---|
| the strip's **"Committed"** | paid/fulfilled `orders` + `contracted`+ vendors' `total_cost_php` |
| the card's **"Total to pay"** | **every** vendor's itemized total, whatever their status |
| the vendor card list | `contracted`+ vendors **only** |

On prod event `044f7e64…` — one `considering` vendor carrying ₱80,000 — that renders **"Total to pay ₱80,000" eight inches above "Committed ₱0"**, with the empty state *"You're still choosing vendors"* underneath. The ₱80,000 vendor's card is never rendered, so the couple cannot find, edit or delete the number driving their own headline.

**The fix.** One calculator feeds all three, and the vendor list widens from `contracted`+ to `contracted`+ **or carrying money**, so every peso in a headline has a card the couple can open.

- **`lib/budget-truth-flag.ts`** (new) — `isBudgetTruthEnabled()` / `NEXT_PUBLIC_BUDGET_TRUTH_ENABLED`, default OFF, mirroring `explore-replan-flag.ts`. Registered in `lib/flag-chokepoint-scan.test.ts` per that file's own promise that the next flag-dark feature adds one entry and inherits all four properties.
- **`lib/budget-page-money.ts`** (new, pure) — `budgetStripMoney` · `budgetLiveSummaryMoney` · `vendorsToItemize` · `vendorCarriesMoney`. Takes `enabled` as a **parameter**, never reading the env, so its suite drives both flag states in one process (the injection `bench-sort.ts` / `your-team.ts` already use).
- **`app/dashboard/[eventId]/budget/page.tsx`** — resolver call joins the existing `Promise.all` (**flag OFF issues not one extra query**, so the page's cost profile is unchanged in production); the strip, the live card and the vendor list all read from it.

**Three honesty legs that come with it:**
- **The estimate stops masquerading as nothing.** A `considering` vendor's ₱80,000 is reported as `estimatedPhp`, kept out of `committed`/`stillOwed` (§18.5 rules 2/3), and named on the strip — *"₱80,000 more is still an estimate"* — instead of driving a headline the couple can't reconcile.
- **R11 · the card's "remaining" is `stillOwed`, not `committed − paid`.** They diverge whenever a vendor is overpaid: the resolver floors per vendor and reports the excess separately, so a ₱25,000 overpayment on one vendor can no longer silently cancel ₱5,000 still owed on another.
- **R12 · every "does this row carry money" test is `!== 0`, never `> 0`.** A change-order credit is a negative line, and a credit-only vendor is exactly the row a couple most needs to reach.

**Degradation:** any resolver failure returns `null` and the page falls back to the legacy figures — a budget page that silently zeroes is worse than one merely out of date.

Tests — new `lib/budget-page-money.test.ts` (15 cases driven from the real prod fixture). The load-bearing one is **flag OFF reproducing the contradiction verbatim** (`strip.committedPhp !== card.budget`, and the ₱80,000 vendor unreachable): a suite that only asserted the fixed state would let BUD-2 ship to production the day it merged without anyone flipping the flag. Full unit suite green (6356), typecheck clean, no new lint warnings.

⚠ **Not yet flipped.** BUD-3 (checklist health onto the same resolver — the ₱810,000 defect) is the sibling slice; the owner flips `NEXT_PUBLIC_BUDGET_TRUTH_ENABLED` once both are previewable, so the couple never sees half the app on new arithmetic and half on old.

SPEC IMPACT: None — this executes `Explore_Replan_BUILD_SPEC_2026-07-27.md` §18.6 BUD-2 as written; no decision changed.
