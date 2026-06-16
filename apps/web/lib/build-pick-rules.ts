/**
 * THE single source of truth for the multi-pick data-loss guard.
 *
 * When the couple pins a vendor into a build category, must we first clear that
 * category's OTHER picks?
 *   • TRUE  — single-pick categories: one vendor per category, so a new pick
 *             REPLACES the old (delete the others, then upsert).
 *   • FALSE — multi-pick categories (Look / Booths / Prints, `isMultiPickGroup`):
 *             these legitimately hold several vendors, so clearing siblings would
 *             SILENTLY DESTROY the couple's other picks. Never replace.
 *
 * Every write path that could clear siblings — `setBuildPick` (per-pick add) and
 * `runBuild3State` (Compute/Build) — routes its decision through THIS predicate,
 * so the guard can never be half-applied or quietly dropped in a refactor without
 * `build-pick-rules.test.ts` failing.
 *
 * Regression history: the original guard lived in `build-flags-actions.ts`, which
 * was DELETED in the #1568 Build refactor and the guard re-implemented in its
 * successor. The test around this predicate exists so the NEXT refactor cannot
 * lose it the way that one nearly did.
 */
import { isMultiPickGroup } from '@/lib/wedding-plan-groups';

/**
 * Does pinning a vendor into `planGroupId` replace the category's other picks?
 * Single-pick → true (replace); multi-pick → false (keep every pick).
 *
 * Unknown group ids (never in PLAN_GROUPS) default to `true` — the conservative
 * single-pick behavior — matching the historical `isMultiPickGroup` fallback. A
 * delete scoped to an unknown group only ever touches that group's own rows.
 */
export function replacesSiblingsOnPin(planGroupId: string): boolean {
  return !isMultiPickGroup(planGroupId);
}
