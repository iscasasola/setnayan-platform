/**
 * checklist-budget-attribution — where a committed vendor's pesos land.
 * (BUD-3 · Explore_Replan_BUILD_SPEC_2026-07-27 §18.6 — "kills R2")
 *
 * ─── The defect this closes (R2, ₱810,000 wrong on prod today) ────────────
 * `computeBudgetHealth` attributes a committed vendor's cost to
 * `covers_plan_groups[0]` and, when that array is empty, **skips the row
 * entirely**:
 *
 *     if (groups.length === 0) continue; // no plan-group mapping — skip
 *
 * The couple is then wrong TWICE over, in the same direction:
 *   1 · their real commitment never reaches `committedCentavos`, and
 *   2 · because the plan group is never marked committed, the health card
 *       ALSO adds a market-range GUESS for a service they have already booked.
 *
 * So the buffer subtracts an invented number instead of the real one. On prod
 * that is ₱810,000 across 12 rows — reported as ₱0.
 *
 * ─── A second half the spec did not name ─────────────────────────────────
 * Even a vendor WITH `covers_plan_groups` is dropped from the total when that
 * group is outside the couple's tier-1/2/3 scope: the totalling loop iterates
 * `allPlanGroups`, so money attributed to any other group is silently
 * discarded. `groupsCarryingMoney()` exists to widen that loop.
 *
 * ─── The fix ─────────────────────────────────────────────────────────────
 * Attribute through `bucketForVendor` — the resolver's mapping, which already
 * falls back to the vendor's category and lands the genuinely unmappable in
 * `'other'` rather than dropping them. ONE mapping serves both surfaces; a
 * second would be the same class of bug in a new place.
 *
 * ─── FLAG ─────────────────────────────────────────────────────────────────
 * `enabled` is `isBudgetTruthEnabled()`, taken as a PARAMETER so this core can
 * be exercised in BOTH states inside one test process. Never read the env here.
 */

import { bucketForVendor, OTHER_BUCKET } from './budget-truth';

/** The columns `computeBudgetHealth` actually selects. */
export type CommittedVendorRow = {
  total_cost_php: number | null;
  transport_php?: number | null;
  food_allowance_php?: number | null;
  covers_plan_groups?: string[] | null;
  category?: string | null;
};

export type CommittedAttribution = {
  /** plan-group (or `'other'`) id → committed centavos. */
  byGroup: Map<string, number>;
  /**
   * Centavos the LEGACY rule would have thrown away. Zero under flag OFF by
   * construction. Callers surface it; it is the size of the lie.
   */
  recoveredCentavos: number;
  recoveredCount: number;
};

/** total_cost_php + transport_php + food_allowance_php, in integer centavos. */
export function vendorCostCentavos(v: CommittedVendorRow): number {
  const sum =
    Number(v.total_cost_php ?? 0) +
    Number(v.transport_php ?? 0) +
    Number(v.food_allowance_php ?? 0);
  return Number.isFinite(sum) ? Math.round(sum * 100) : 0;
}

/**
 * Attribute every committed vendor to a bucket.
 *
 * Flag OFF → byte-identical to today, skip and all: a row with no
 * `covers_plan_groups` contributes nothing and marks nothing.
 * Flag ON  → nothing is ever skipped. Secondary groups are still marked
 * committed at zero additive cost (they are covered by the primary booking),
 * exactly as before — that part was never the bug.
 */
export function attributeCommitted(args: {
  enabled: boolean;
  vendors: CommittedVendorRow[];
}): CommittedAttribution {
  const { enabled, vendors } = args;
  const byGroup = new Map<string, number>();
  let recoveredCentavos = 0;
  let recoveredCount = 0;

  for (const v of vendors) {
    const groups = (Array.isArray(v.covers_plan_groups) ? v.covers_plan_groups : []).filter(
      (g): g is string => typeof g === 'string' && g.length > 0,
    );

    if (groups.length === 0) {
      // THE DEFECT. Under flag OFF this row disappears — and so does its money.
      if (!enabled) continue;
      const bucket = bucketForVendor({
        covers_plan_groups: null,
        category: (v.category ?? null) as never,
      });
      const centavos = vendorCostCentavos(v);
      byGroup.set(bucket, (byGroup.get(bucket) ?? 0) + centavos);
      if (centavos !== 0) {
        recoveredCentavos += centavos;
        recoveredCount += 1;
      }
      continue;
    }

    const [primary, ...secondary] = groups as [string, ...string[]];
    byGroup.set(primary, (byGroup.get(primary) ?? 0) + vendorCostCentavos(v));
    for (const g of secondary) {
      // Marked committed, zero additive cost — already paid via the primary.
      byGroup.set(g, byGroup.get(g) ?? 0);
    }
  }

  return { byGroup, recoveredCentavos, recoveredCount };
}

/**
 * Every bucket carrying money that the caller's plan-group scope does not
 * already cover — the rows whose pesos the totalling loop would otherwise
 * never visit.
 *
 * Flag OFF returns `[]`, so the loop is unchanged.
 */
export function groupsCarryingMoney(args: {
  enabled: boolean;
  byGroup: Map<string, number>;
  inScope: readonly string[];
}): string[] {
  const { enabled, byGroup, inScope } = args;
  if (!enabled) return [];
  const scope = new Set(inScope);
  const extra: string[] = [];
  for (const [group, centavos] of byGroup) {
    if (scope.has(group)) continue;
    if (centavos === 0) continue; // a secondary-only marker carries no money
    extra.push(group);
  }
  // Stable order: `'other'` last, so the named groups read first.
  extra.sort((a, b) => {
    if (a === OTHER_BUCKET) return 1;
    if (b === OTHER_BUCKET) return -1;
    return a.localeCompare(b);
  });
  return extra;
}
