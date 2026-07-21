/**
 * Setnayan-AI Decision Cockpit — pure derivation layer (item R4).
 *
 * Turns data the couple Overview ALREADY loaded (the vendor pick model, the
 * budget/lock counts, the sponsor rows, the top-priority task, the paperwork
 * pipeline) into the three things the cockpit renders:
 *
 *   • briefing — a one-line human summary ("You're 62% locked in, 3 decisions
 *     need you, next deadline in 5 days").
 *   • decisions[] — open choices that BLOCK progress and need the COUPLE:
 *       - categories with options saved but nothing locked (quotes awaiting a
 *         pick),
 *       - the single most-urgent lockable category with no vendor booked yet,
 *       - principal sponsor roles the couple started but hasn't confirmed.
 *     (Unpaid orders are a listed decision type but the Overview does NOT load
 *     unpaid orders — only paid/fulfilled — so that type is intentionally
 *     OMITTED here rather than triggering a new query. See item R4 guardrails.)
 *   • upcoming[] — time-ordered deadlines/nudges from the loaded schedule/
 *     checklist data (the wedding day itself, the top task's hard-floor, and
 *     any paperwork due/expiry dates).
 *
 * Pure + I/O-free + unit-testable: every input is already-loaded data, and the
 * only imports are other pure modules. It invents no numbers and issues no
 * fetches.
 */

import {
  PLAN_GROUPS,
  bucketVendorsByGroup,
  type EventVendorRowInput,
  type PlanCardPick,
} from './wedding-plan-groups';
import type { ResolvedTask } from './todays-one-thing';

/**
 * The event_vendors statuses that count as "locked" — mirrors
 * `CONFIRMED_VENDOR_STATUSES` (lib/events.ts) + `LOCKED_STATUSES`
 * (lib/wedding-plan-groups.ts). Inlined here (rather than imported from
 * lib/events, which pulls in server-only deps) so this stays a pure, I/O-free,
 * unit-testable leaf. Keep in lock-step with those two sources.
 */
const CONFIRMED_SET = new Set<string>([
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
]);

/** A single blocking choice that needs the couple. */
export type CockpitDecision = {
  /** Stable id (plan-group id or a synthetic key) — for React keys + telemetry. */
  id: string;
  kind: 'pick' | 'start' | 'role';
  /** The decision, phrased as an action ("Pick your caterer"). */
  label: string;
  /** One short supporting line ("3 options saved · none locked yet"). */
  detail: string;
  ctaLabel: string;
  href: string;
};

/** A time-ordered upcoming deadline / nudge. */
export type CockpitUpcoming = {
  id: string;
  label: string;
  /** Days from `now` (negative = overdue, null = no firm date). */
  daysOut: number | null;
  /** Pre-rendered relative phrase ("in 5 days", "overdue by 3 days"). */
  when: string;
  href?: string;
};

export type CockpitBriefing = {
  lockedPct: number;
  decisionCount: number;
  nextDeadlineDays: number | null;
  /** Full human sentence assembled from the fields above. */
  sentence: string;
};

export type CockpitModel = {
  briefing: CockpitBriefing;
  decisions: CockpitDecision[];
  upcoming: CockpitUpcoming[];
};

export type CockpitInput = {
  eventId: string;
  /** Days until the event — null unless the date is at 'day' precision. */
  daysOut: number | null;
  lockedVendorCount: number;
  totalLockableCategories: number;
  /** The vendor pick rows the page already loaded (event_vendors). */
  vendors: ReadonlyArray<EventVendorRowInput>;
  /** Sponsor rows the page already loaded (tier + invitation status only). */
  sponsors: ReadonlyArray<{
    sponsor_tier: string | null;
    invitation_status: string | null;
  }>;
  /** The resolver's #1 unstarted task (pickTodaysOneThing), or null. */
  topPriorityTask: ResolvedTask | null;
  /** Paperwork pipeline rows, pre-reduced to label + due date. */
  paperwork: ReadonlyArray<{ id: string; label: string; dueIso: string | null }>;
};

function hasLockedPick(picks: ReadonlyArray<PlanCardPick>): boolean {
  for (const p of picks) {
    // See the identical skip in lib/todays-one-thing.ts: catch-all rows are
    // parked in their fallback group, not members of it, so they don't vote on
    // whether that group is decided.
    if (p.bucketed_by_fallback) continue;
    if (p.raw_status !== null && CONFIRMED_SET.has(p.raw_status)) return true;
    if (p.status === 'locked') return true;
  }
  return false;
}

/** Turn a day-delta into a calm relative phrase. */
export function formatRelativeDays(days: number | null): string {
  if (days === null) return 'no date yet';
  if (days < 0) {
    const overdue = Math.abs(days);
    return overdue === 1 ? 'overdue by 1 day' : `overdue by ${overdue} days`;
  }
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return `in ${days} days`;
  if (days <= 30) {
    const weeks = Math.round(days / 7);
    return weeks <= 1 ? 'in about a week' : `in ${weeks} weeks`;
  }
  const months = Math.round(days / 30);
  return months <= 1 ? 'in about a month' : `in ${months} months`;
}

function daysUntilIso(iso: string, now: Date): number | null {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Build the whole cockpit model from already-loaded Overview data.
 * Pure — no clock read beyond the `now` arg, no I/O.
 */
export function buildCockpitModel(
  input: CockpitInput,
  now: Date = new Date(),
): CockpitModel {
  const {
    eventId,
    daysOut,
    lockedVendorCount,
    totalLockableCategories,
    vendors,
    sponsors,
    topPriorityTask,
    paperwork,
  } = input;

  const vendorsHref = `/dashboard/${eventId}/vendors`;

  // ---- Decisions ---------------------------------------------------------
  const decisions: CockpitDecision[] = [];
  const decidedGroupIds = new Set<string>();

  // (a) Options saved, nothing locked → the couple must pick. Strong blocker.
  const bucketed = bucketVendorsByGroup(vendors, null, null);
  for (const group of PLAN_GROUPS) {
    if (group.countsTowardLockable === false) continue;
    // Catch-all rows are excluded from the COUNT too, not just the lock check:
    // "Pick your logistics & misc · 1 option saved" would be a decision the
    // couple can't act on, about a vendor that isn't really in this group.
    const picks = (bucketed.get(group.id) ?? []).filter((p) => !p.bucketed_by_fallback);
    if (picks.length === 0) continue; // no vendor booked — handled by (b)
    if (hasLockedPick(picks)) continue; // already locked — done
    const n = picks.length;
    decisions.push({
      id: `pick:${group.id}`,
      kind: 'pick',
      label: `Pick your ${group.label.toLowerCase()}`,
      detail:
        n === 1
          ? '1 option saved · none locked yet'
          : `${n} options saved · none locked yet`,
      ctaLabel: 'Compare & lock',
      href: vendorsHref,
    });
    decidedGroupIds.add(group.id);
  }
  // Foundation-first, then by group order (PLAN_GROUPS is already canon order).
  decisions.sort((a, b) => rank(a.id) - rank(b.id));

  // (b) The single most-urgent lockable category with NO vendor booked. Reuse
  //     the resolver's #1 pick; skip if that group already surfaced under (a).
  if (topPriorityTask && !decidedGroupIds.has(topPriorityTask.id)) {
    decisions.push({
      id: `start:${topPriorityTask.id}`,
      kind: 'start',
      label: topPriorityTask.title,
      detail:
        topPriorityTask.daysContextual === null
          ? 'Not started yet · plenty of time'
          : topPriorityTask.status === 'overdue'
            ? `Nothing booked · ${formatRelativeDays(-topPriorityTask.daysContextual)}`
            : `Nothing booked · lock by ${formatRelativeDays(topPriorityTask.daysContextual)}`,
      ctaLabel: topPriorityTask.ctaLabel,
      href: topPriorityTask.ctaHref,
    });
  }

  // (c) Principal sponsor roles the couple started but hasn't confirmed.
  //     Fires only once the couple has recorded sponsor rows (so a brand-new
  //     event with an empty list never gets nagged) AND no principal is yet
  //     accepted. "Key roles" the ceremony structurally needs.
  const principalRows = sponsors.filter((s) => s.sponsor_tier === 'principal');
  const acceptedPrincipals = principalRows.filter(
    (s) => s.invitation_status === 'accepted',
  ).length;
  if (principalRows.length > 0 && acceptedPrincipals === 0) {
    decisions.push({
      id: 'role:principal_sponsors',
      kind: 'role',
      label: 'Confirm your principal sponsors',
      detail: `${principalRows.length} invited · none confirmed yet`,
      ctaLabel: 'Review sponsors',
      href: `/dashboard/${eventId}/sponsors`,
    });
  }

  // ---- What's next (time-ordered) ---------------------------------------
  const upcoming: CockpitUpcoming[] = [];

  if (daysOut !== null && daysOut >= 0) {
    upcoming.push({
      id: 'wedding-day',
      label: 'Your wedding day',
      daysOut,
      when: formatRelativeDays(daysOut),
    });
  }

  if (topPriorityTask && topPriorityTask.daysContextual !== null) {
    // daysContextual is days PAST the floor when overdue, days UNTIL otherwise.
    const signed =
      topPriorityTask.status === 'overdue'
        ? -topPriorityTask.daysContextual
        : topPriorityTask.daysContextual;
    upcoming.push({
      id: `deadline:${topPriorityTask.id}`,
      label: topPriorityTask.title,
      daysOut: signed,
      when: formatRelativeDays(signed),
      href: topPriorityTask.ctaHref,
    });
  }

  for (const row of paperwork) {
    if (!row.dueIso) continue;
    const d = daysUntilIso(row.dueIso, now);
    if (d === null) continue;
    upcoming.push({
      id: `paperwork:${row.id}`,
      label: row.label,
      daysOut: d,
      when: formatRelativeDays(d),
      href: `/dashboard/${eventId}/vendors`,
    });
  }

  upcoming.sort((a, b) => {
    // Nulls last; otherwise soonest (incl. overdue negatives) first.
    if (a.daysOut === null) return 1;
    if (b.daysOut === null) return -1;
    return a.daysOut - b.daysOut;
  });

  // ---- Briefing ----------------------------------------------------------
  const lockedPct =
    totalLockableCategories > 0
      ? Math.round((lockedVendorCount / totalLockableCategories) * 100)
      : 0;
  const decisionCount = decisions.length;
  const firstDeadline = upcoming.find((u) => u.daysOut !== null) ?? null;
  const nextDeadlineDays = firstDeadline?.daysOut ?? null;

  const parts: string[] = [`You're ${lockedPct}% locked in`];
  if (decisionCount === 0) {
    parts.push('nothing needs a decision right now');
  } else if (decisionCount === 1) {
    parts.push('1 decision needs you');
  } else {
    parts.push(`${decisionCount} decisions need you`);
  }
  if (firstDeadline) {
    parts.push(`next deadline ${firstDeadline.when}`);
  }
  const sentence = `${parts.join(', ')}.`;

  return {
    briefing: { lockedPct, decisionCount, nextDeadlineDays, sentence },
    decisions,
    upcoming,
  };
}

/** Canonical PLAN_GROUPS position for a `pick:<groupId>` decision id. */
function rank(decisionId: string): number {
  const groupId = decisionId.slice(decisionId.indexOf(':') + 1);
  const idx = PLAN_GROUPS.findIndex((g) => g.id === groupId);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}
