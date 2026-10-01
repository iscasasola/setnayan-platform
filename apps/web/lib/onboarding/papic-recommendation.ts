/**
 * papic-recommendation.ts — the onboarding Papic card's ONE recommendation (Lane 1).
 *
 * ⚖ Owner 2026-10-01 (DECISION_LOG "ONBOARDING RECOMMENDS A PAPIC PACK — THE
 * NEAREST PACK, AND THEY CAN CHANGE IT" and "THE PAPIC PACK IS A − [NUMBER] +
 * STEPPER"): *"yes. we will recommend but they can change the number. the
 * recommended papic credits is X (not the exact amount but the nearest amount
 * from our choices) for your X guests"*. Exact half-way → the BIGGER pack
 * (*"go up on ties"*).
 *
 * 🔑 THIS SUPERSEDES THE 2026-09-23 RULING ("until data is collected, nothing
 * to recommend") FOR THIS ONE SURFACE, BY THE OWNER'S LATER, SPECIFIC WORD.
 * `lib/the-recommendation-waits-for-data.test.ts` names this file as the ONLY
 * module allowed to turn a guest count into a credit figure, and holds it to
 * the rule below.
 *
 * ⛔ NO NUMBER OF ITS OWN. "A number that governs money must come from its
 * existing home" (CLAUDE.md RULE 0.9): points-per-guest, the recommendation
 * floor and the ceiling arrive as `PapicSizing`, read from
 * `papic_event_pool_config` — the admin-editable table — by
 * `services-step-server.ts`; the packs are the live `PAPIC_GUEST_*` ladder.
 * This file contains arithmetic and no constants.
 *
 * Pure and client-safe.
 */

/** The admin-editable sizing for the event type (`papic_event_pool_config`). */
export type PapicSizing = {
  pointsPerGuest: number;
  /** The smallest pool we SUGGEST (not the entitlement floor). */
  recommendFloorPoints: number;
  ceilingPoints: number;
};

/** clamp(guests × points_per_guest, recommend floor, ceiling) — the shipped sizing rule. */
export function targetPoolPoints(guests: number, sizing: PapicSizing): number {
  const raw = Math.max(0, guests) * sizing.pointsPerGuest;
  return Math.min(sizing.ceilingPoints, Math.max(sizing.recommendFloorPoints, raw));
}

/**
 * The ladder step (1-based; step 0 is the free grant alone) of the pack NEAREST
 * to the target. A tie goes to the bigger pack. 0 when there is no pack to sell.
 * `rungs` is the live ladder, cheapest first (`PapicTypeView.rungs`).
 */
export function nearestPackStep(rungs: ReadonlyArray<{ points: number }>, target: number): number {
  let best = 0;
  let bestGap = Number.POSITIVE_INFINITY;
  rungs.forEach((r, i) => {
    const gap = Math.abs(r.points - target);
    // `<=` walks a tie UP the ladder: the later (bigger) pack wins an exact half-way.
    if (gap <= bestGap) {
      best = i + 1;
      bestGap = gap;
    }
  });
  return best;
}

/** The recommended step for a guest estimate, or 0 when nothing can be recommended. */
export function recommendedPackStep(
  rungs: ReadonlyArray<{ points: number }>,
  guests: number | null | undefined,
  sizing: PapicSizing | null | undefined,
): number {
  if (!sizing || typeof guests !== 'number' || !Number.isFinite(guests) || guests <= 0) return 0;
  return nearestPackStep(rungs, targetPoolPoints(guests, sizing));
}
