## 2026-07-29 · feat(explore): "Your team" is one card, and the Lock/Auto/Hidden grid is replaced by a single row that speaks in vendors and pesos

PR-2 of `Explore_Integration_BUILD_SPEC_2026-07-29.md` §8 — the large half. The owner's complaint was literal: *"why does the build your team has build your plan and your team?"* One section, three titles.

### The finding that reframes it — the grid was UI theatre (spec §1)

`Build3StateControl`'s three "YOUR ANCHORS" rows (Wedding date · Total budget · Location) were **wired to nothing**. The solver reads its budget ceiling straight off `events_host.estimated_budget_centavos`; `resolveBuildPicks` consumes only taxonomy states and never looks at a `_dim_*` row. Worse, the row's tri-state came from `event_category_build_state` (default `'excluded'`) while its *value* came from `events` — two independent stores — and the value only rendered when the tri-state said `locked`. So a couple **whose date was set** read "Setnayan suggests this."

And because an absent state row defaults to `'excluded'`, **pressing Build on a fresh event did nothing at all**. The rows only ever existed because the grid wrote them.

### What replaces it

`build-3state-control.tsx` is **deleted** — 727 lines: `Build3StateControl`, `StateTrio`, `DimensionRow`, `InlineValueEditor`, `TaxonomyRowControl`, `STATE_META` and every Lock/Auto/Hidden string. `setCategoryBuildState` and `resetBuildStates` go with it (caller-less).

**`vendors/_components/quote-fill.tsx`** — one context-aware row inside "Your team", between "In your build" and "Still needs your decision". No card, no title, no state vocabulary:

- **0 fillable** → renders `null`. Today's worst screen — *"No quoted services yet"* sitting under a Lock/Auto/Hidden legend — stops existing. This is prod's default state.
- **1 fillable** → *"1 quote is in — {Vendor} for {Category}, ₱{amount}"* · **＋ Add to your build**.
- **2+** → *"Quotes are in for {N} categories"* · **Fill your build from your quotes**, with the no-budget subline linking to `/dashboard/[eventId]/budget` (the canonical editor — never an inline re-declaration).
- **after a run** → what was added, plus the existing **`FallbackPanel`**, relocated verbatim.

Adjust-after needed **zero new UI**: keep = the per-row Lock ✓ (`AccordionLockButton`) · remove = ✕ (`removeBuildPick`) · swap = the "Still needs your decision" doorway · bulk undo = "Clear candidates". That *is* Lock/Auto/Hidden, expressed against real vendors and real pesos, with no state name to learn.

### Engine — a rename with one default flipped, not a fork

`runBuild3State` → **`proposeBuildFromQuotes`**: same read → `resolveBuildPicks` → write phase, byte for byte, plus one pre-pass. The grid was its only caller.

New pure helper **`withAbsentQuotedAsAuto(states, fillableGroupIds)`** (`lib/build-3state.ts`) synthesizes `'auto'` for fillable groups with no stored row. **Explicit rows always win** — a legacy `'excluded'` stays excluded, a legacy `'locked'` + pin still resolves to its pin. Four named unit tests: absent→auto · explicit-excluded respected · explicit lock+pin respected · non-fillable skipped. Mutation-checked: reverting the absent→auto line turns *"withAbsentQuotedAsAuto: absent fillable group becomes auto"* red.

**FILLABLE** = ≥1 quoted inquiry · no locked vendor · no existing build pick · no `event_category_decisions` row in `('excluded','complete')` for the group **or its tile** · no explicit `'excluded'` state. Derived **server-side inside the action** from the couple's own RLS-scoped rows — never from the client's list — so a forged request cannot widen the set. The page derives the same five conditions only to decide what the row *says*.

### The merge (spec §3) + the reorder

`BuildLocked`'s inner `<h2>` is gone (the section heading already says "Your team"; the total it carried is the "Locked" tile). Flag-ON the sections are re-ordered per the prototype's `renderTeam()`: locked → *[handshake slot for PR-H]* → in-your-build → **quote-fill** → still-needs-decision → the six money tiles → **"Save current as a plan"**. The rail follows the §2.2 ruling the code never caught up to: **Bench → Your team → Your plans → Payments**.

`build` heading → **"Your team"**.

### Three things the spec did not account for

1. **The Plans panel's Rename control broke on the move.** It worked by loading a plan's name into the Save-As bar via `setState` — which stops working the moment the bar lives in a sibling component. Fixed with `BB_RENAME_PLAN_EVENT`, declared beside the `BB_TAB_EVENT` bus these two files already jump over, plus a scroll to the team. Not new machinery; the same machinery.
2. **`err`'s only render site was inside the moved card**, so flag-ON every Load/Delete failure on the Plans panel would have gone silent. It now has its own line.
3. **The team's empty state would have hidden the quote-fill row** on exactly the event that needs it (nothing locked, nothing built, quotes in hand — prod's shape). It now stands down for fillable quotes as it already did for open decisions.

### Two places the spec is stale

- **§4 says "Server action keeps its `BUILD_3STATE_ENABLED` guard." There is no such guard and never was** — verified against `origin/main`, `BUILD_3STATE_ENABLED` appears nowhere outside comments. No guard was invented; the note in `build-3state-actions.ts` that asserted one is corrected in place. The real gating is that the action is only reachable from the quote-fill row, which the page mounts behind `isExploreReplanEnabled()`.
- §3 lists the quote-fill row as item 7 while §4 pins it between "In your build" and "Still needs your decision". §4 wins (§3 defers to it with "see §4").

### The kill-switch stays honest

Every delta rides `isExploreReplanEnabled()`. With the flag OFF `BuildLocked` returns its original heading → tiles → ready-to-lock → locked-in in that order, the save bar stays on the Plans panel, and the rail keeps build → budget → compare. Tab keys, `?tab=` deep links, the `BB_TAB_EVENT` bus and the `#svc-*` anchors are untouched.

`setAnchor` (`build-anchors-actions.ts`) is **not** deleted — `onboarding/wedding/_components/onboarding-shell.tsx` still calls it; only the grid's import went. `buildAnchors` and the optional `PlanBuildSnapshot.pinMode` field are kept (old JSONB snapshots must still parse). No migration, no DB write, no feature-flag change. `event_category_build_state` is now **read-only legacy** — nothing writes it, and the rows that exist are still honored.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/Explore_Integration_BUILD_SPEC_2026-07-29.md` §1, §3, §4, §7, §8 row 2 — executed. Two stale claims in that doc recorded above (the phantom `BUILD_3STATE_ENABLED` guard; the §3/§4 ordering conflict). No SKU, price or schema change.
