/**
 * lock-impact-inputs.ts — the PURE adapters that turn DB rows into the
 * arguments `computeLockImpact` takes.
 *
 * `lock-impact.ts` deliberately re-derives nothing: it diffs two verdict sets
 * the caller computed, so it can never disagree with the bench about who fits.
 * That promise is only kept if the caller computes those sets with the SAME
 * functions the bench uses. This module is where that happens — it calls
 * `resolveBuildDateWindow` + `classifyAgainstBuildWindow` (the shipped
 * `build-date-window.ts` core the vendors page already renders from), never a
 * second availability rule of its own.
 *
 * Everything here is pure and total so `finalizeVendor` — which must not grow a
 * private notion of "who fits" — stays a thin read-then-call. The reads live in
 * the action; the reasoning lives here, under `lock-impact-inputs.test.ts`.
 *
 * ## What this module refuses to do
 *
 *  • **Invent a calendar.** A vendor the availability read could not answer for
 *    has `freeDays === null` and gets NO verdict — the fail-open stance of
 *    `getBatchVendorAvailableDays` ("a calendar flake reads free, never a false
 *    booked"), carried through unchanged.
 *  • **Blame the vendor being locked.** The target is excluded from the bench.
 *    Folding it in as a member makes the window a subset of its own free days,
 *    so it can never be sunk by its own lock — but saying so in code is cheaper
 *    than trusting a reader to re-derive it.
 *  • **Trust a JSONB snapshot.** `budget_builds.snapshot` is free-form JSON. A
 *    malformed one yields NO picks, which makes the plan un-loadable BEFORE the
 *    lock too — so `computeLockImpact` skips it rather than reporting a
 *    casualty we cannot substantiate.
 */

import {
  classifyAgainstBuildWindow,
  resolveBuildDateWindow,
  type ProbeWindow,
  type TeamCalendarMember,
} from '@/lib/build-date-window';
import { displayBuildTitle, sortSavedBuilds, type NamedBuildRow } from '@/lib/named-builds';
import type { PlansRowPick } from '@/lib/plans-panel';
import type { SavedPlanForImpact, ServiceCasualty } from '@/lib/lock-impact';
import { PLAN_GROUPS, planGroupForCategory } from '@/lib/wedding-plan-groups';
import type { VendorCategory } from '@/lib/vendors';

/**
 * The statuses that mean "this category is settled" — byte-identical to
 * `CONFIRMED_VENDOR_STATUSES` (lib/events.ts), `LOCKED_VENDOR_STATUSES`
 * (lib/shortlist-taxonomy.ts) and the `PLAN_LOCKED` set the vendors page builds
 * its plan snapshot from. Redeclared here only so this module stays free of a
 * `'use server'` import chain; the three sets are asserted equal in the tests.
 */
export const IMPACT_LOCKED_STATUSES: ReadonlySet<string> = new Set([
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
]);

/** An `event_vendors` row as this module reads it. */
export type ImpactVendorRow = {
  vendorId: string;
  /** Display name — what the confirm modal would NAME as a casualty. */
  name: string;
  /** `event_vendors.category`. */
  category: string | null;
  /** `event_vendors.status`. */
  status: string | null;
  /** `event_vendors.marketplace_vendor_id` — NULL for an off-platform pick. */
  profileId: string | null;
};

/** The plan-group label a casualty is filed under ("Photo & Video"). */
export function planGroupLabelForCategory(category: string | null): string {
  const groupId = category ? planGroupForCategory(category as VendorCategory) : null;
  if (!groupId) return 'Your team';
  return PLAN_GROUPS.find((g) => g.id === groupId)?.label ?? 'Your team';
}

/**
 * The plan groups the couple has LOCKED right now, in row order, deduped.
 *
 * This is the `lockedGroupIds` `computeLockImpact` takes as the state BEFORE
 * the lock — the server-side equivalent of the page's
 * `lockedGroupIdsOf(currentPicks)`, which reads the same four statuses off the
 * same rows. Archived rows are the caller's to exclude (the query filters them);
 * a row whose category maps to no plan group is skipped rather than bucketed
 * into a group it does not belong to.
 */
export function lockedGroupIdsFromVendorRows(
  rows: ReadonlyArray<Pick<ImpactVendorRow, 'category' | 'status'>>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.status || !IMPACT_LOCKED_STATUSES.has(r.status)) continue;
    const groupId = r.category ? planGroupForCategory(r.category as VendorCategory) : null;
    if (!groupId || seen.has(groupId)) continue;
    seen.add(groupId);
    out.push(groupId);
  }
  return out;
}

/** A `budget_builds` row as this module reads it (snapshot stays `unknown`). */
export type ImpactBuildRow = NamedBuildRow & { snapshot: unknown };

/** Defensive read of one `snapshot.picks` entry — JSONB, so nothing is assumed. */
function picksFromSnapshot(snapshot: unknown): PlansRowPick[] {
  const raw = (snapshot as { picks?: unknown } | null | undefined)?.picks;
  if (!Array.isArray(raw)) return [];
  const out: PlansRowPick[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const row = p as Record<string, unknown>;
    if (typeof row.groupId !== 'string' || row.groupId.length === 0) continue;
    out.push({
      groupId: row.groupId,
      label: typeof row.label === 'string' ? row.label : row.groupId,
      vendorName: typeof row.vendorName === 'string' ? row.vendorName : '',
      costPhp: typeof row.costPhp === 'number' ? row.costPhp : null,
      locked: row.locked === true,
      vendorId: typeof row.vendorId === 'string' && row.vendorId.length > 0 ? row.vendorId : undefined,
    });
  }
  return out;
}

/**
 * The couple's saved plans, titled and ordered exactly as the Plans surface
 * shows them — `sortSavedBuilds` then `displayBuildTitle`, so the modal names a
 * plan by the words on the couple's own screen. Naming it anything else ("Build
 * 3" for a plan whose column header reads "Garden Classic") would make the
 * warning unactionable.
 */
export function savedPlansFromBuildRows(
  rows: ReadonlyArray<ImpactBuildRow>,
): SavedPlanForImpact[] {
  return sortSavedBuilds(rows).map((row, i) => ({
    buildId: row.build_id,
    title: displayBuildTitle(row, i),
    picks: picksFromSnapshot(row.snapshot),
  }));
}

/** A bench card as the sink verdict reads it. */
export type ImpactBenchRow = {
  vendorId: string;
  name: string;
  categoryLabel: string;
  /** Free day keys inside the probe window; NULL = no calendar signal. */
  freeDays: ReadonlySet<string> | null;
};

/**
 * Split the event's vendor rows into the calendar TEAM (before and after this
 * lock) and the BENCH the verdicts are computed over.
 *
 * Membership mirrors `vendors/page.tsx` exactly: a row is on the team iff it
 * carries a marketplace profile the availability read answered for AND it is
 * either already locked or pinned as a build candidate. An off-platform vendor
 * declares no calendar and so constrains nothing — which is why locking one can
 * cost plans but never services.
 *
 * `membersAfter` is `membersBefore` plus the target folded in AS LOCKED. When
 * the target is already on the team (the couple pinned it to the build first,
 * the common path) the two sets are identical — and they should be: the bench
 * was already narrowed by that vendor, so the lock takes nothing further away.
 */
export function lockImpactTeams(args: {
  rows: ReadonlyArray<ImpactVendorRow>;
  /** `event_build_picks.vendor_id` — the couple's pinned candidates. */
  candidateVendorIds: ReadonlyArray<string>;
  /** profileId → free days, already clipped to the probe window. */
  freeDaysByProfileId: ReadonlyMap<string, ReadonlySet<string>>;
  /** The vendor about to be locked. */
  targetVendorId: string;
}): {
  membersBefore: TeamCalendarMember[];
  membersAfter: TeamCalendarMember[];
  bench: ImpactBenchRow[];
} {
  const candidates = new Set(args.candidateVendorIds);
  const membersBefore: TeamCalendarMember[] = [];
  const bench: ImpactBenchRow[] = [];
  let target: TeamCalendarMember | null = null;

  for (const r of args.rows) {
    const freeDays = r.profileId ? args.freeDaysByProfileId.get(r.profileId) ?? null : null;

    // The vendor being locked is never a casualty of its own lock — folding it
    // in as a member makes the window a subset of its free days, so it always
    // fits after. Excluded outright so that stays true by construction.
    if (r.vendorId !== args.targetVendorId) {
      bench.push({
        vendorId: r.vendorId,
        name: r.name,
        categoryLabel: planGroupLabelForCategory(r.category),
        freeDays,
      });
    }

    // No calendar signal ⇒ never a member. Same filter the page applies with
    // `.filter((t) => availByProfile.has(t.profileId))`.
    if (!freeDays) continue;
    const member: TeamCalendarMember = { vendorId: r.vendorId, name: r.name, freeDays };
    if (r.vendorId === args.targetVendorId) {
      target = member;
      // A target that is ALREADY locked or pinned still belongs to the before
      // set — it is constraining the bench today. Fall through.
    }
    const onTeam =
      (r.status != null && IMPACT_LOCKED_STATUSES.has(r.status)) || candidates.has(r.vendorId);
    if (onTeam) membersBefore.push(member);
  }

  const alreadyOnTeam = membersBefore.some((m) => m.vendorId === args.targetVendorId);
  const membersAfter =
    target && !alreadyOnTeam ? [...membersBefore, target] : [...membersBefore];

  return { membersBefore, membersAfter, bench };
}

/**
 * Which bench vendors share no free day with the build, for one team set.
 *
 * Delegates every judgement to `build-date-window.ts` — the module the bench
 * itself renders from — so a vendor named here is a vendor the couple would
 * actually see slide behind “Doesn't fit your build”. In particular it inherits
 * that core's three silences: no verdicts for an `anchored` or `open` window
 * (the couple has a date, or nothing constrains one yet), none for a vendor
 * with no calendar signal, and none at all when the build's own window is
 * EMPTY — a conflict the couple made is not a vendor's fault.
 */
export function sunkVendors(args: {
  probe: ProbeWindow | null;
  members: ReadonlyArray<TeamCalendarMember>;
  bench: ReadonlyArray<ImpactBenchRow>;
}): ServiceCasualty[] {
  const window = resolveBuildDateWindow({
    enabled: true,
    probe: args.probe,
    members: args.members,
  });
  if (!window || !args.probe) return [];

  const out: ServiceCasualty[] = [];
  for (const row of args.bench) {
    const verdict = classifyAgainstBuildWindow({
      window,
      vendorFreeDays: row.freeDays,
      vendorId: row.vendorId,
      members: args.members,
      probeDayKeys: args.probe.dayKeys,
    });
    if (verdict && verdict.fits === false) {
      out.push({ vendorName: row.name, categoryLabel: row.categoryLabel });
    }
  }
  return out;
}
