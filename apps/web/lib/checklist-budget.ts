/**
 * Checklist budget health-check — server-side function.
 *
 * Design: Adaptive_Checklist_Design_2026-06-17.md §5 "Three-tier budget model"
 *
 * Formula:
 *   buffer = events.estimated_budget_centavos
 *            − committed  (sum from event_vendors at contracted/deposit_paid/delivered/complete)
 *            − projected  (admin-seeded market ranges from budget_leaf_benchmarks per
 *                          unlocked plan group)
 *            − paperwork  (static estimate by ceremony_type)
 *
 * NOTE on vendor_market_stats: that view is a VENDOR DIRECTORY (business_name,
 * location, ratings, ads) — it carries NO price columns. Per-plan-group market
 * ranges come from `budget_leaf_benchmarks` (admin-seeded p25_php / benchmark_php /
 * p75_php, migrated in 20260826000000 + seeded in 20260829000000). That is the
 * canonical market-rate source used by the budget-allocation engine
 * (lib/budget-allocation-data.ts) and re-used here.
 */

import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  CHECKLIST_BUDGET_TIERS,
  BUDGET_PAPERWORK_TASK_KEYS,
  checklistTier3PlanGroups,
} from './checklist';
import { PICK_TO_GROUP } from './onboarding-availability';

// ─── Public types ─────────────────────────────────────────────────────────────

export type BudgetTier = 'tier1' | 'tier2' | 'tier3' | 'paperwork';

export type PlanGroupBudgetLine = {
  /** plan_group_id (matches budget_leaf_benchmarks.plan_group_id) */
  planGroupId: string;
  tier: BudgetTier;
  /**
   * Committed centavos from contracted/deposit_paid/delivered/complete
   * event_vendors rows whose covers_plan_groups includes this plan group.
   * Includes total_cost_php + transport_php + food_allowance_php (all lines).
   */
  committedCentavos: number;
  /**
   * Market-rate lower bound (budget_leaf_benchmarks.p25_php × 100).
   * 0 when the vendor is already committed (committed takes precedence).
   */
  projectedMinCentavos: number;
  /**
   * Market-rate upper bound (budget_leaf_benchmarks.p75_php × 100).
   * 0 when the vendor is already committed.
   */
  projectedMaxCentavos: number;
  /** true when the couple has at least one vendor at contracted or later for this group. */
  isCommitted: boolean;
};

export type ChecklistBudgetHealth = {
  totalBudgetCentavos: number;
  committedCentavos: number;
  /** Sum of projectedMinCentavos across all uncommitted lines. */
  projectedMinCentavos: number;
  /** Sum of projectedMaxCentavos across all uncommitted lines. */
  projectedMaxCentavos: number;
  /** Static paperwork estimate (varies by ceremony_type). */
  paperworkCentavos: number;
  /** total − committed − projectedMin − paperwork */
  bestCaseBufferCentavos: number;
  /** total − committed − projectedMax − paperwork */
  worstCaseBufferCentavos: number;
  isOverBudgetBestCase: boolean;
  isOverBudgetWorstCase: boolean;
  lines: PlanGroupBudgetLine[];
};

// ─── Statuses that lock in a vendor cost ─────────────────────────────────────

/** vendor_status values that mean the couple has committed to this vendor */
const COMMITTED_STATUSES = ['contracted', 'deposit_paid', 'delivered', 'complete'] as const;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Paperwork costs by ceremony type.
 * These are rough PH estimates; the budget UI labels them "estimated."
 *
 * Components:
 *   marriage_license   ~₱500    (civil registrar — all types)
 *   psa_cenomar        ~₱730    (₱365 × 2 documents — all types)
 *   church_fee         ~₱10,000 (parish package — church only)
 *   pre_cana           ~₱3,000  (diocese seminar — church only)
 *   civil_ceremony_fee ~₱2,000  (civil rites — civil only)
 */
function estimatePaperworkCentavos(ceremonyType: string | null): number {
  // Base: marriage license + PSA CENOMAR (applies to all ceremony types)
  const base = (500 + 730) * 100; // ₱1,230 → 123,000 centavos

  if (ceremonyType === 'church' || ceremonyType === 'religious') {
    // + church package fee ~₱10,000 + pre-Cana ~₱3,000
    return base + 10_000_00 + 3_000_00;
  }
  if (ceremonyType === 'civil') {
    // + civil ceremony fee ~₱2,000
    return base + 2_000_00;
  }
  // mixed / beach / garden / destination / other — just the base docs
  return base;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Compute the budget health-check for a single event.
 *
 * Returns `null` when the event has no `estimated_budget_centavos` (budget not
 * yet set during onboarding). Callers should render a "set your budget" CTA
 * rather than a health-check UI.
 */
export async function computeBudgetHealth(
  eventId: string,
): Promise<ChecklistBudgetHealth | null> {
  const supabase = await createClient();

  // ── 1. Fetch event core ──────────────────────────────────────────────────
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'estimated_budget_centavos, estimated_pax, ceremony_type, region, style_preferences',
    )
    .eq('event_id', eventId)
    .single();

  if (eventError || !event || !event.estimated_budget_centavos) {
    // Budget not yet set — nothing to display.
    return null;
  }

  const totalBudget = event.estimated_budget_centavos as number;

  // ── 2. Derive plan groups in scope ────────────────────────────────────────
  // The couple's interested_categories (onboarding picks) live inside the
  // style_preferences JSONB column. Convert them to plan_group_ids via PICK_TO_GROUP.
  const stylePrefs = (event.style_preferences ?? {}) as Record<string, unknown>;
  const rawPicks = Array.isArray(stylePrefs.interested_categories)
    ? (stylePrefs.interested_categories as string[])
    : [];

  // Map onboarding picker keys → plan group IDs (dedup; unknown picks silently dropped).
  const pickedPlanGroups = Array.from(
    new Set(
      rawPicks.map((pick) => PICK_TO_GROUP[pick]).filter((g): g is string => Boolean(g)),
    ),
  );

  // Tier 1 + Tier 2 are always in scope regardless of picks.
  const tier1 = [...CHECKLIST_BUDGET_TIERS.tier1] as string[];
  const tier2 = [...CHECKLIST_BUDGET_TIERS.tier2] as string[];
  const tier3 = checklistTier3PlanGroups(pickedPlanGroups);

  const allPlanGroups = Array.from(new Set([...tier1, ...tier2, ...tier3]));

  // ── 3. Fetch committed event_vendors ─────────────────────────────────────
  // A vendor is "committed" when status is contracted | deposit_paid | delivered | complete.
  // total_cost_php + transport_php + food_allowance_php = full vendor cost.
  // covers_plan_groups links a vendor row to additional plan groups it satisfies.
  const { data: vendors } = await supabase
    .from('event_vendors')
    .select('total_cost_php, transport_php, food_allowance_php, covers_plan_groups, status, category')
    .eq('event_id', eventId)
    .in('status', [...COMMITTED_STATUSES]);

  const committedVendors = vendors ?? [];

  // Build a map: plan_group_id → total committed centavos
  // A vendor row covers its `covers_plan_groups` array; we attribute the full
  // package cost to the PRIMARY covers_plan_groups[0], which is the booking
  // plan group. When covers_plan_groups is empty, we skip (no plan_group_id
  // on the row itself, only vendor_category — not yet mapped here).
  const committedByGroup = new Map<string, number>();
  for (const v of committedVendors) {
    const groups: string[] = Array.isArray(v.covers_plan_groups) ? v.covers_plan_groups : [];
    if (groups.length === 0) continue; // no plan-group mapping — skip

    // Compute total cost in centavos (total_cost_php + transport_php + food_allowance_php)
    const totalPhp =
      (v.total_cost_php ?? 0) + (v.transport_php ?? 0) + (v.food_allowance_php ?? 0);
    const totalCentavos = Math.round(totalPhp * 100);

    // Attribute cost to primary group; secondary groups are marked committed (zero cost
    // duplicated — they're already paid via the primary booking).
    const [primary, ...secondary] = groups as [string, ...string[]];
    committedByGroup.set(primary, (committedByGroup.get(primary) ?? 0) + totalCentavos);
    for (const g of secondary) {
      // Mark as committed with zero additive cost (already covered).
      committedByGroup.set(g, committedByGroup.get(g) ?? 0);
    }
  }

  // ── 4. Fetch admin-seeded market benchmarks ──────────────────────────────
  // budget_leaf_benchmarks has per-plan_group_id price anchors:
  //   p25_php = low range (25th percentile / floor)
  //   p75_php = high range (75th percentile)
  //   benchmark_php = typical midpoint
  // We use p25_php as projectedMin and p75_php as projectedMax.
  // NULL means admin hasn't seeded that leaf yet → fall back to benchmark_php ± 20%.
  const { data: benchmarkRows } = await supabase
    .from('budget_leaf_benchmarks')
    .select('plan_group_id, benchmark_php, p25_php, p75_php')
    .eq('is_active', true);

  const benchmarkMap = new Map<
    string,
    { benchmark: number | null; p25: number | null; p75: number | null }
  >();
  for (const row of benchmarkRows ?? []) {
    benchmarkMap.set(row.plan_group_id as string, {
      benchmark: row.benchmark_php as number | null,
      p25: row.p25_php as number | null,
      p75: row.p75_php as number | null,
    });
  }

  // ── 5. Build per-plan-group lines ────────────────────────────────────────
  function tierFor(pgId: string): BudgetTier {
    if ((tier1 as string[]).includes(pgId)) return 'tier1';
    if ((tier2 as string[]).includes(pgId)) return 'tier2';
    return 'tier3';
  }

  const lines: PlanGroupBudgetLine[] = [];
  let totalCommitted = 0;
  let totalProjectedMin = 0;
  let totalProjectedMax = 0;

  for (const pgId of allPlanGroups) {
    const isCommitted = committedByGroup.has(pgId);
    const committedCentavos = committedByGroup.get(pgId) ?? 0;

    let projectedMinCentavos = 0;
    let projectedMaxCentavos = 0;

    if (!isCommitted) {
      // Use admin-seeded benchmark ranges. If p25/p75 are NULL, derive from benchmark ± 20%.
      const bm = benchmarkMap.get(pgId);
      if (bm) {
        if (bm.p25 !== null && bm.p75 !== null) {
          projectedMinCentavos = bm.p25 * 100;
          projectedMaxCentavos = bm.p75 * 100;
        } else if (bm.benchmark !== null) {
          // Fallback: ± 20% around the benchmark midpoint
          projectedMinCentavos = Math.round(bm.benchmark * 0.8) * 100;
          projectedMaxCentavos = Math.round(bm.benchmark * 1.2) * 100;
        }
        // If both are null (admin hasn't seeded this leaf) → stays at 0.
        // The UI should show "estimate unavailable" for this line.
      }
    }

    totalCommitted += committedCentavos;
    totalProjectedMin += projectedMinCentavos;
    totalProjectedMax += projectedMaxCentavos;

    lines.push({
      planGroupId: pgId,
      tier: tierFor(pgId),
      committedCentavos,
      projectedMinCentavos,
      projectedMaxCentavos,
      isCommitted,
    });
  }

  // ── 6. Paperwork estimate ─────────────────────────────────────────────────
  const paperworkCentavos = estimatePaperworkCentavos(event.ceremony_type as string | null);

  // ── 7. Buffer computation ─────────────────────────────────────────────────
  const bestCaseBufferCentavos =
    totalBudget - totalCommitted - totalProjectedMin - paperworkCentavos;
  const worstCaseBufferCentavos =
    totalBudget - totalCommitted - totalProjectedMax - paperworkCentavos;

  return {
    totalBudgetCentavos: totalBudget,
    committedCentavos: totalCommitted,
    projectedMinCentavos: totalProjectedMin,
    projectedMaxCentavos: totalProjectedMax,
    paperworkCentavos,
    bestCaseBufferCentavos,
    worstCaseBufferCentavos,
    isOverBudgetBestCase: bestCaseBufferCentavos < 0,
    isOverBudgetWorstCase: worstCaseBufferCentavos < 0,
    lines,
  };
}

/**
 * Re-export the paperwork estimator for use on the budget detail page,
 * which displays each paperwork task's estimated cost inline.
 */
export { estimatePaperworkCentavos };

/**
 * The task keys that carry real out-of-pocket paperwork costs —
 * re-exported for consumers that need both the health-check and the task list.
 */
export { BUDGET_PAPERWORK_TASK_KEYS };
