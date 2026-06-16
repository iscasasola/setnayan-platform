/**
 * Build — the 3-State Solver core (Phase 3d-A · Build_3State_Solver_2026-06-16.md).
 *
 * Each Build row carries one tri-state control — **Locked / Auto / Excluded** —
 * replacing the legacy 2-state Flag/Unflag (`category-flags.tsx`) + Pin/Flag
 * anchors. The host *constrains* (lock what's decided, exclude what's out, leave
 * the rest on Auto) and [Build] fills every Auto row.
 *
 *   • Locked   — fixed to a concrete pick (a quoted vendor for a taxonomy row;
 *                a value on `events` for the Date/Budget/Location dimension rows).
 *   • Auto     — "fill this for me" → [Build] generates it (OFF solver = cheapest
 *                quoted vendor that fits the remaining budget).
 *   • Excluded — left out of the build; the implicit default / empty state.
 *
 * ─── THE FLAG ──────────────────────────────────────────────────────────────
 * EVERYTHING in this surface is gated by `BUILD_3STATE_ENABLED` (default OFF).
 * When off, the Build tab behaves EXACTLY as today: the 2-state `CategoryFlags`
 * control + `openCats` row sourcing + `computeBuildFromShortlist` path stay the
 * production experience. The new toggle UI / state table reads / Reset / Build
 * resolution are all unreachable. Mirrors the `lib/setnayan-ai.ts` env-read
 * pattern — a config flip, not a deploy.
 *
 * Resolved picks STILL land in the existing `event_build_picks` table, so the
 * Compare + Lock tabs (which read it) are unchanged. No schema change — the
 * `event_category_build_state` table already exists in prod (migration
 * 20261230000000); this PR is read/write only.
 *
 * This file is the PURE core (no DB, no React) — the resolution logic is
 * unit-tested in `build-3state.test.ts`. The DB side lives in
 * `app/dashboard/[eventId]/vendors/build-3state-actions.ts`.
 */

import { isMultiPickGroup } from '@/lib/wedding-plan-groups';

/**
 * Is the 3-state Build control active? Default OFF. Env-driven so the flip is a
 * config change, not a deploy (read server-side, passed to client surfaces as a
 * prop — NOT `NEXT_PUBLIC_*`). When false, NONE of the 3-state surface activates
 * and the live Build is byte-identical to today.
 */
export function isBuild3StateEnabled(): boolean {
  return process.env.BUILD_3STATE_ENABLED === 'true';
}

/** The three control states, in display order (Locked · Auto · Excluded). */
export const BUILD_STATES = ['locked', 'auto', 'excluded'] as const;
export type BuildState = (typeof BUILD_STATES)[number];

/** The implicit default — a row with no stored state row reads as Excluded. */
export const DEFAULT_BUILD_STATE: BuildState = 'excluded';

export function isBuildState(v: unknown): v is BuildState {
  return v === 'locked' || v === 'auto' || v === 'excluded';
}

/**
 * Reserved `plan_group_id` keys for the three always-present dimension rows
 * (Date · Budget · Location). They share the `event_category_build_state` table
 * with taxonomy rows but carry NO `pinned_vendor_id` — their Locked value lives
 * on `events` (event_date / estimated_budget_centavos / region). The `_dim_`
 * prefix can never collide with a real `PlanGroupId` (those are bare slugs).
 */
export const DIM_DATE = '_dim_date';
export const DIM_BUDGET = '_dim_budget';
export const DIM_LOCATION = '_dim_location';
export const DIMENSION_KEYS = [DIM_DATE, DIM_BUDGET, DIM_LOCATION] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export function isDimensionKey(planGroupId: string): planGroupId is DimensionKey {
  return (
    planGroupId === DIM_DATE ||
    planGroupId === DIM_BUDGET ||
    planGroupId === DIM_LOCATION
  );
}

/** One stored control state for a row (taxonomy or dimension). */
export type CategoryBuildState = {
  state: BuildState;
  /** The Locked pick for a taxonomy row; null for Auto/Excluded + dimension rows. */
  pinnedVendorId: string | null;
};

/**
 * A row stored as `Map<plan_group_id, CategoryBuildState>`. Rows absent from the
 * map are implicitly Excluded (the table's default), so callers never need to
 * materialize an Excluded row.
 */
export type BuildStateMap = Map<string, CategoryBuildState>;

/**
 * The cost-bearing quoted vendor used by the OFF solver. Only vendors with a
 * quote (`total_cost_php != null`) are build-eligible (the § 3 quoted-inquiry
 * gate). `costPhp` is the rolled total (package + transport + crew meal), used
 * for the cheapest-fit pick exactly like `computeBuildFromShortlist`.
 *
 * `compatScore` is the OPTIONAL hidden ranking signal (0–100, lib/compat-score)
 * used ONLY by the Setnayan-AI-ON ranking branch (`rankMode: 'compat'`). It is
 * absent/null in the OFF path (and never read there), so the cheapest-fit
 * behavior stays byte-identical. NEVER surfaced to the couple as a number — it
 * only sorts the Auto candidate order.
 */
export type QuotedVendor = {
  vendorId: string;
  /** The taxonomy plan group this vendor's quote belongs to. */
  planGroupId: string;
  costPhp: number;
  /** Hidden compatibility (0–100) for the AI-ON ranking branch. Optional —
   *  cheapest-fit ignores it. Higher = ranked first when `rankMode='compat'`. */
  compatScore?: number | null;
};

/**
 * How an Auto row chooses among the quoted vendors that fit the remaining
 * budget.
 *   • 'cheapest' — the SHIPPED OFF solver: cheapest quoted vendor that fits
 *     (cheapest-first → most categories filled). The default; AI-off path.
 *   • 'compat'   — the Setnayan-AI-ON ranking: TOP-ranked by `compatScore`
 *     (reception-anchored distance + refinements + ladder, computed by the
 *     caller via lib/compat-score) among the vendors that fit the remaining
 *     budget. Cost still GATES (a pick must fit) — compat only re-orders the
 *     fitting set. Falls back to cheapest order when two vendors tie on compat
 *     (and when no compatScore is present) so it's deterministic + never worse
 *     than cheapest at filling categories.
 */
export type BuildRankMode = 'cheapest' | 'compat';

/** A resolved build pick to upsert into `event_build_picks`. */
export type ResolvedPick = { planGroupId: string; vendorId: string };

/**
 * A quoted vendor an Auto row rejected SOLELY because its quote did not fit the
 * remaining budget (Build 3d-C · the re-quote nudge, §7). It HAS a quote and is
 * a real (date+location-eligible) inquiry — only the price missed. This is the
 * exact, deterministic budget-miss signal the wiring layer needs: a vendor in
 * `budgetRejected` is a candidate to nudge ("your price was a little over their
 * budget — want to re-propose?"); a vendor that was simply out-ranked (a cheaper
 * one took the single slot) is NOT here, and neither is a date/location miss
 * (those never reach the quoted set). `costPhp` is the rolled quote that missed.
 */
export type BudgetRejectedVendor = {
  planGroupId: string;
  vendorId: string;
  costPhp: number;
};

/**
 * The output of resolving the 3-state map against the couple's quoted vendors.
 *   • `picks`           — every (planGroupId, vendorId) to upsert into
 *                         event_build_picks (Locked pins + Auto fills).
 *   • `clearGroupIds`   — taxonomy groups whose state is Excluded (or have no
 *                         row): any existing build pick for them must be removed.
 *   • `unfilledAuto`    — Auto groups with no quoted vendor that fits the
 *                         remaining budget (surfaced to the UI; no fallback
 *                         search in this PR — that's a follow-on flagged PR).
 *   • `budgetRejected`  — quoted vendors an Auto row left unpicked ONLY because
 *                         their quote exceeded the remaining budget (Build 3d-C).
 *                         Drives the vendor re-quote nudge; purely additive (the
 *                         picks/clear/unfilled outputs are byte-identical to
 *                         before, so the shipped solver behavior is unchanged).
 */
export type BuildResolution = {
  picks: ResolvedPick[];
  clearGroupIds: string[];
  unfilledAuto: string[];
  budgetRejected: BudgetRejectedVendor[];
};

/**
 * PURE resolution: state map + quoted vendors + budget → the picks to write.
 *
 * Rules (mirroring the shipped OFF solver, `computeBuildFromShortlist`):
 *   • LOCKED taxonomy row → its `pinnedVendorId` is THE pick (host's choice is
 *     honored verbatim, never recomputed). Its cost reserves budget.
 *   • AUTO taxonomy row → fill from the quoted vendors that fit the REMAINING
 *     budget. WHICH one depends on `rankMode`:
 *       – 'cheapest' (default, AI-OFF) → the cheapest that fits (cheapest-first
 *         → most categories filled). Byte-identical to the shipped OFF solver.
 *       – 'compat' (AI-ON) → the TOP-ranked by `compatScore` among the fitting
 *         vendors (cost still gates; compat only re-orders the survivors).
 *     Multi-pick groups (Look/Booths/Prints, `isMultiPickGroup`) may take
 *     SEVERAL picks (every quoted vendor that still fits, in rank order);
 *     single-pick groups take one.
 *   • EXCLUDED row (or no row) → produces no pick; the group is listed in
 *     `clearGroupIds` so a stale build pick is removed.
 *   • Dimension rows (`_dim_*`) carry no vendor pick — they're skipped here
 *     (their Locked value lives on `events`).
 *   • `budgetPhp == null` → no budget constraint (fill each Auto group with its
 *     top-ranked quoted vendor, mirroring the shipped `remaining == null` branch).
 *
 * A vendor already used (a Locked pin or an earlier Auto fill) is never reused
 * for another group. Deterministic: in compat mode tie-break by cheapest then
 * vendorId; in cheapest mode tie-break by vendorId — so the unit tests are
 * stable in both modes.
 *
 * Additionally surfaces `budgetRejected` (Build 3d-C) — quoted vendors an Auto
 * row turned away ONLY on budget (a genuine budget miss). This is read-only
 * advisory: it never changes which picks are written, so the shipped resolution
 * is byte-identical. The wiring layer uses it to fire the re-quote nudge.
 */
export function resolveBuildPicks(args: {
  states: BuildStateMap;
  quoted: ReadonlyArray<QuotedVendor>;
  budgetPhp: number | null;
  /** AI-OFF default 'cheapest' (byte-identical to today); AI-ON 'compat'. */
  rankMode?: BuildRankMode;
}): BuildResolution {
  const { states, quoted, budgetPhp } = args;
  const rankMode: BuildRankMode = args.rankMode ?? 'cheapest';

  const costByVendor = new Map<string, number>();
  for (const q of quoted) costByVendor.set(q.vendorId, q.costPhp);

  // Quoted vendors grouped by taxonomy plan group, then ordered per `rankMode`:
  //   • 'cheapest' → cheapest-first (vendorId tie-break) — the shipped order.
  //   • 'compat'   → highest compatScore first, cheapest then vendorId as the
  //                  deterministic tie-break (a missing score sorts as -1 so an
  //                  unscored vendor never outranks a scored one).
  const quotedByGroup = new Map<string, QuotedVendor[]>();
  for (const q of quoted) {
    const arr = quotedByGroup.get(q.planGroupId);
    if (arr) arr.push(q);
    else quotedByGroup.set(q.planGroupId, [q]);
  }
  const scoreOf = (q: QuotedVendor): number =>
    typeof q.compatScore === 'number' ? q.compatScore : -1;
  for (const arr of quotedByGroup.values()) {
    if (rankMode === 'compat') {
      arr.sort(
        (a, b) =>
          scoreOf(b) - scoreOf(a) ||
          a.costPhp - b.costPhp ||
          (a.vendorId < b.vendorId ? -1 : 1),
      );
    } else {
      arr.sort((a, b) => a.costPhp - b.costPhp || (a.vendorId < b.vendorId ? -1 : 1));
    }
  }

  const picks: ResolvedPick[] = [];
  const clearGroupIds: string[] = [];
  const unfilledAuto: string[] = [];
  const budgetRejected: BudgetRejectedVendor[] = [];
  const usedVendors = new Set<string>();

  // ── Pass 1: LOCKED rows reserve budget first (their cost is committed). ──
  // Process taxonomy rows only; dimension rows carry no vendor pick.
  const taxonomyEntries: Array<[string, CategoryBuildState]> = [];
  for (const [groupId, st] of states) {
    if (isDimensionKey(groupId)) continue;
    taxonomyEntries.push([groupId, st]);
  }

  let committed = 0;
  for (const [groupId, st] of taxonomyEntries) {
    if (st.state !== 'locked') continue;
    if (!st.pinnedVendorId) {
      // A Locked row with no concrete pick is invalid — treat as unfilled so
      // the UI can force the pick. Never silently writes a half-pick.
      unfilledAuto.push(groupId);
      continue;
    }
    picks.push({ planGroupId: groupId, vendorId: st.pinnedVendorId });
    usedVendors.add(st.pinnedVendorId);
    committed += costByVendor.get(st.pinnedVendorId) ?? 0;
  }

  let remaining = budgetPhp != null ? budgetPhp - committed : null;

  // ── Pass 2: AUTO rows fill cheapest-fit from the remaining budget. ──
  for (const [groupId, st] of taxonomyEntries) {
    if (st.state !== 'auto') continue;
    const candidates = (quotedByGroup.get(groupId) ?? []).filter(
      (q) => !usedVendors.has(q.vendorId),
    );
    if (candidates.length === 0) {
      unfilledAuto.push(groupId);
      continue;
    }

    const multi = isMultiPickGroup(groupId);
    let filledAny = false;
    // Quoted vendors this group passed over PURELY because they didn't fit the
    // remaining budget (Build 3d-C). Collected here, then promoted to
    // `budgetRejected` below once we know the group was a genuine budget miss
    // (not, e.g., a single-pick group that DID fill — there a pricier passed-over
    // vendor was out-ranked, not budget-rejected as the build's outcome).
    const overBudgetHere: BudgetRejectedVendor[] = [];
    for (const cand of candidates) {
      const fits = remaining == null || cand.costPhp <= remaining;
      if (!fits) {
        // The remaining budget couldn't absorb this quote → a budget miss for
        // this candidate (the nudge signal). Record it regardless of rank mode.
        overBudgetHere.push({
          planGroupId: groupId,
          vendorId: cand.vendorId,
          costPhp: cand.costPhp,
        });
        // In 'cheapest' mode the array is cost-ascending, so once one doesn't
        // fit, none cheaper remain that would → break (the shipped behavior).
        // In 'compat' mode the array is compat-ordered (cost not monotonic), so
        // a pricier high-compat vendor may not fit while a cheaper lower-compat
        // one later does → skip and keep scanning.
        if (!multi && rankMode === 'cheapest') {
          // Cost-ascending break: every later candidate is ≥ this cost, so they
          // all miss the budget too — record them before breaking so the nudge
          // sees the full over-budget set for this single-pick group.
          for (const later of candidates) {
            if (later === cand) continue;
            const laterCost = later.costPhp;
            const seen = overBudgetHere.some((o) => o.vendorId === later.vendorId);
            if (!seen && (remaining == null || laterCost > remaining)) {
              overBudgetHere.push({
                planGroupId: groupId,
                vendorId: later.vendorId,
                costPhp: laterCost,
              });
            }
          }
          break;
        } else continue;
      }
      picks.push({ planGroupId: groupId, vendorId: cand.vendorId });
      usedVendors.add(cand.vendorId);
      if (remaining != null) remaining -= cand.costPhp;
      filledAny = true;
      if (!multi) break; // single-pick: one and done (the top-ranked that fits).
    }
    if (!filledAny) unfilledAuto.push(groupId);
    // Promote the over-budget passed-over vendors to the nudge signal. A
    // single-pick group that DID fill has no genuine budget miss as its OUTCOME
    // (a cheaper vendor served the slot) — the pricier ones were out-ranked, not
    // turned away on budget — so we only surface them when the group went
    // UNFILLED. Multi-pick groups can fill SOME slots and still turn others away
    // purely on budget, so their over-budget set always surfaces.
    if (multi || !filledAny) {
      for (const r of overBudgetHere) budgetRejected.push(r);
    }
  }

  // ── Pass 3: EXCLUDED taxonomy rows → clear any stale build pick. ──
  for (const [groupId, st] of taxonomyEntries) {
    if (st.state === 'excluded') clearGroupIds.push(groupId);
  }

  return { picks, clearGroupIds, unfilledAuto, budgetRejected };
}
