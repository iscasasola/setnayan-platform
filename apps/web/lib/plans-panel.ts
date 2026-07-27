/**
 * Plans panel — the PURE row/merge core behind the Compare surface reframed as
 * "Plans" (`Explore_Replan_BUILD_SPEC_2026-07-27.md` §3 PR-F + §2 decision #10
 * + §8 plan lifecycle).
 *
 * The reframe in one sentence: **a plan varies only the categories the couple
 * has NOT locked.** Locked vendors are contracts — they are pinned identical in
 * every column, and loading a plan must never re-open one. These helpers hold
 * no DB / React so the invariant is unit-testable (`plans-panel.test.ts`):
 *
 *   • `lockedGroupIdsOf`  — which categories are locked RIGHT NOW (the live plan
 *     is the authority; a saved snapshot's `locked` flag is historical and must
 *     never pin a row).
 *   • `partitionPlanRows` — the matrix split: pinned locked rows on top,
 *     candidate rows (the ones plans may differ on) below.
 *   • `planPicksToApply` — the Load/merge semantics: a saved plan's candidates
 *     minus anything that has since been locked, deduped, vendor-id-bearing.
 *
 * Consumed by `_components/build-compare.tsx` behind `isExploreReplanEnabled()`.
 */

/**
 * One category's pick as the Plans surface reads it — structurally the
 * `PlanBuildPick` of `vendors/build-actions.ts`, redeclared here so this module
 * stays free of any `'use server'` import.
 */
export type PlansRowPick = {
  groupId: string;
  label: string;
  vendorName: string;
  costPhp: number | null;
  locked: boolean;
  /** Absent on snapshots saved before the vendorId era → not loadable. */
  vendorId?: string;
  inclusions?: string[];
};

/** A pinned row — one locked vendor, identical in every column. */
export type PinnedPlanRow = {
  groupId: string;
  label: string;
  vendorName: string;
  costPhp: number | null;
};

/** A row plans may disagree on — rendered per-column from each snapshot. */
export type CandidatePlanRow = { groupId: string; label: string };

export type PlansRowPartition = {
  lockedRows: PinnedPlanRow[];
  candidateRows: CandidatePlanRow[];
};

/**
 * The plan-group ids the couple has LOCKED in their LIVE plan, in plan order,
 * deduped. Deliberately reads only the current picks: a saved snapshot captured
 * `locked` at save time, so trusting it would pin a category the couple has
 * since unlocked (and miss one they have since locked).
 */
export function lockedGroupIdsOf(currentPicks: ReadonlyArray<PlansRowPick>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of currentPicks) {
    if (!p.locked || !p.groupId || seen.has(p.groupId)) continue;
    seen.add(p.groupId);
    out.push(p.groupId);
  }
  return out;
}

/**
 * Split the comparison matrix into PINNED locked rows and per-column candidate
 * rows.
 *
 *   • A category is pinned iff the LIVE plan has a locked pick for it. The
 *     pinned row carries the live locked vendor + cost — every column shows the
 *     same thing, which is why it renders once with a colSpan.
 *   • Candidate rows = every other category any column has a pick in, in a
 *     stable order (live plan first, then each saved snapshot in the order
 *     given). Deterministic, so column/row order never jitters between renders.
 *
 * Never mutates its inputs.
 */
export function partitionPlanRows(args: {
  currentPicks: ReadonlyArray<PlansRowPick>;
  savedPickSets: ReadonlyArray<ReadonlyArray<PlansRowPick>>;
}): PlansRowPartition {
  const locked = new Set(lockedGroupIdsOf(args.currentPicks));

  const lockedRows: PinnedPlanRow[] = [];
  const seenLocked = new Set<string>();
  for (const p of args.currentPicks) {
    if (!p.locked || seenLocked.has(p.groupId)) continue;
    seenLocked.add(p.groupId);
    lockedRows.push({
      groupId: p.groupId,
      label: p.label,
      vendorName: p.vendorName,
      costPhp: p.costPhp ?? null,
    });
  }

  const candidateRows: CandidatePlanRow[] = [];
  const seenCandidate = new Set<string>();
  const collect = (picks: ReadonlyArray<PlansRowPick>) => {
    for (const p of picks) {
      if (!p.groupId || locked.has(p.groupId) || seenCandidate.has(p.groupId)) continue;
      seenCandidate.add(p.groupId);
      candidateRows.push({ groupId: p.groupId, label: p.label });
    }
  };
  collect(args.currentPicks);
  for (const set of args.savedPickSets) collect(set);

  return { lockedRows, candidateRows };
}

/**
 * The picks a **Load** should hand to `applyBuildToWorking` — spec §8.2.
 *
 *   • Drops picks with no `vendorId` (pre-vendorId snapshots aren't loadable).
 *   • Drops picks in a LOCKED category — a plan may only vary the unlocked ones,
 *     so loading never re-opens a settled category or shadows a contract.
 *   • Dedupes on (group, vendor) so a multi-pick category can't double-insert.
 *
 * Order is preserved (stable applies → stable partial-failure behaviour).
 */
export function planPicksToApply(args: {
  snapshotPicks: ReadonlyArray<PlansRowPick>;
  lockedGroupIds: ReadonlyArray<string>;
}): { planGroupId: string; vendorId: string }[] {
  const locked = new Set(args.lockedGroupIds);
  const seen = new Set<string>();
  const out: { planGroupId: string; vendorId: string }[] = [];
  for (const p of args.snapshotPicks) {
    const vendorId = p.vendorId;
    if (!vendorId || !p.groupId || locked.has(p.groupId)) continue;
    const key = `${p.groupId}::${vendorId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ planGroupId: p.groupId, vendorId });
  }
  return out;
}

/**
 * Can this snapshot be loaded at all? False when every pick it holds is either
 * vendorId-less (legacy snapshot) or in a category the couple has since locked
 * — the Load button disables rather than firing a no-op write.
 */
export function isPlanLoadable(args: {
  snapshotPicks: ReadonlyArray<PlansRowPick>;
  lockedGroupIds: ReadonlyArray<string>;
}): boolean {
  return planPicksToApply(args).length > 0;
}
