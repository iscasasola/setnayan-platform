/**
 * lock-impact.ts — what a lock COSTS, computed before the couple commits.
 *
 * Owner ruling 2026-09-06: *"of course adjustments on the saved build will
 * change when a vendor is locked, and announce that the following builds are no
 * longer possible for you, and these services are no longer possible once you
 * lock this vendor."*
 *
 * The consequences were already real and already computed — they were just
 * never said out loud:
 *
 *   • `isPlanLoadable` (lib/plans-panel.ts) already goes FALSE once every pick a
 *     saved plan holds sits in a locked category. The Load button disables and
 *     says nothing. A couple who named a plan "Garden Classic" three weeks ago
 *     finds it greyed out with no explanation of which lock killed it.
 *   • `buildDateWindow` (lib/build-date-window.ts) already sinks bench vendors
 *     that share no free day with the build. Locking narrows that window
 *     further, so a lock can sink vendors the couple was actively considering —
 *     silently, one screen away from where they clicked.
 *
 * This module answers one question — *what dies if I lock this?* — and it
 * answers it BEFORE the write, so the couple can still say no.
 *
 * ## Two rules
 *
 * 1. **SILENT WHEN NOTHING IS LOST.** `isEmpty` exists so the caller renders no
 *    modal at all. Most locks cost nothing; a confirm that always fires is a
 *    nag, and a nag is clicked through without reading — which would make this
 *    module worse than not shipping it.
 * 2. **NEVER INVENT A CASUALTY.** Services lost are DIFFED from two verdict sets
 *    the caller already computed with `buildDateWindow` (before the lock, and
 *    with the locked vendor folded in). This module does not re-derive
 *    availability, so it cannot disagree with the bench about who fits — the
 *    class of bug where two mechanisms answer the same question differently.
 *    A caller that cannot supply the "after" set passes none, and the services
 *    half is simply absent rather than guessed.
 */

import { isPlanLoadable, type PlansRowPick } from '@/lib/plans-panel';

/** A saved plan as this module needs it. */
export type SavedPlanForImpact = {
  buildId: string;
  /** Display title — already resolved by `displayBuildTitle` at the call site. */
  title: string;
  picks: ReadonlyArray<PlansRowPick>;
};

/** A plan that dies, or survives with fewer picks. */
export type PlanCasualty = { buildId: string; title: string };
export type PlanThinned = PlanCasualty & { dropped: number };

/** A bench vendor that stops fitting because of this lock. */
export type ServiceCasualty = { vendorName: string; categoryLabel: string };

export type LockImpact = {
  /** Plans loadable now that would NOT be loadable after this lock. */
  plansLost: PlanCasualty[];
  /** Plans that survive but lose at least one pick to the newly locked group. */
  plansThinned: PlanThinned[];
  /** Bench vendors that share no free day with the build once this is locked. */
  servicesLost: ServiceCasualty[];
  /** True when this lock costs nothing — the caller renders NO confirm. */
  isEmpty: boolean;
};

/**
 * Compute the cost of locking `groupId`.
 *
 * `lockedGroupIds` is the state BEFORE this lock. A plan already dead before the
 * lock is not a casualty of it — only the delta is reported, or the modal would
 * blame this vendor for damage done three locks ago.
 */
export function computeLockImpact(args: {
  /** The plan group about to be locked. */
  groupId: string;
  /** Groups already locked, BEFORE this lock. */
  lockedGroupIds: ReadonlyArray<string>;
  savedPlans: ReadonlyArray<SavedPlanForImpact>;
  /** Vendor names sunk by the date window BEFORE this lock. */
  sunkBefore?: ReadonlyArray<ServiceCasualty>;
  /** Vendor names sunk by the date window WITH this vendor locked. */
  sunkAfter?: ReadonlyArray<ServiceCasualty>;
}): LockImpact {
  const before = [...args.lockedGroupIds];
  const after = before.includes(args.groupId) ? before : [...before, args.groupId];

  const plansLost: PlanCasualty[] = [];
  const plansThinned: PlanThinned[] = [];

  for (const plan of args.savedPlans) {
    const loadableBefore = isPlanLoadable({ snapshotPicks: plan.picks, lockedGroupIds: before });
    // Already dead: not this lock's doing. Reporting it would blame this vendor
    // for a plan the couple lost earlier.
    if (!loadableBefore) continue;

    const loadableAfter = isPlanLoadable({ snapshotPicks: plan.picks, lockedGroupIds: after });
    if (!loadableAfter) {
      plansLost.push({ buildId: plan.buildId, title: plan.title });
      continue;
    }

    // Survives — but does it lose anything to the newly locked group?
    const dropped = plan.picks.filter((p) => p.groupId === args.groupId && p.vendorId).length;
    if (dropped > 0) plansThinned.push({ buildId: plan.buildId, title: plan.title, dropped });
  }

  // Services: strictly the DIFF. A vendor already sunk before the lock is not a
  // casualty of it.
  const beforeKeys = new Set(
    (args.sunkBefore ?? []).map((s) => `${s.categoryLabel}::${s.vendorName}`),
  );
  const servicesLost = (args.sunkAfter ?? []).filter(
    (s) => !beforeKeys.has(`${s.categoryLabel}::${s.vendorName}`),
  );

  return {
    plansLost,
    plansThinned,
    servicesLost: [...servicesLost],
    isEmpty: plansLost.length === 0 && plansThinned.length === 0 && servicesLost.length === 0,
  };
}

/** Join names for prose: "A", "A and B", "A, B and C". */
function list(names: ReadonlyArray<string>): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export type LockImpactCopy = { headline: string; lines: string[]; confirmLabel: string };

/**
 * The confirm's words. Returns NULL when nothing is lost — the caller must not
 * render a modal for a lock that costs nothing (rule 1).
 *
 * ⚠ Says "no longer possible", never "cancelled" or "deleted": a saved plan row
 * is not destroyed by a lock, it becomes un-loadable. Overstating it would push
 * a couple away from a lock they actually want.
 */
export function lockImpactCopy(impact: LockImpact, vendorName: string): LockImpactCopy | null {
  if (impact.isEmpty) return null;

  const lines: string[] = [];

  if (impact.plansLost.length > 0) {
    const titles = list(impact.plansLost.map((p) => p.title));
    lines.push(
      impact.plansLost.length === 1
        ? `The plan “${titles}” is no longer possible — everything left in it sits in categories you have locked.`
        : `These plans are no longer possible: ${titles}. Everything left in each one sits in categories you have locked.`,
    );
  }

  if (impact.plansThinned.length > 0) {
    const titles = list(impact.plansThinned.map((p) => p.title));
    lines.push(
      `${titles} will load without ${impact.plansThinned.length === 1 ? 'its' : 'their'} pick for this category — your locked vendor stays instead.`,
    );
  }

  if (impact.servicesLost.length > 0) {
    const names = list(impact.servicesLost.map((s) => s.vendorName));
    lines.push(
      `${names} no longer share a free day with your build, so ${impact.servicesLost.length === 1 ? 'they move' : 'they move'} behind “Doesn’t fit your build”. Removing this lock brings ${impact.servicesLost.length === 1 ? 'them' : 'them'} straight back.`,
    );
  }

  return {
    headline: `Locking ${vendorName} closes some options`,
    lines,
    confirmLabel: `Lock ${vendorName} anyway`,
  };
}
