/**
 * dependent-moments.ts — derive a guardian's dependents' next MILESTONE moments
 * for the Year view (date-anchor model · Phase 3 · family graph · flag-off).
 *
 * Pure + dependency-free (uses only the derivation engine + the dependent
 * ladder). Produces `YearMoment`s from stored dependent birthdates so a child's
 * lucky-7th, debut, or an elder's 60th surfaces on the guardian's year — with
 * nothing auto-created (eventId=null → the go-signal tap creates the event).
 *
 * ⚠ Consumes a CHILD's birthdate — the caller MUST gate this behind
 * dependentPeopleEnabled() (the dependents themselves are only stored when the
 * flag is on + counsel-cleared). This module holds no data; it derives.
 */
import { parseISO } from './event-anchor';
import { dependentNextMilestone, type DependentSex } from './dependent-people';
import type { YearMoment } from './year-moments';

export type DependentForMoments = {
  dependent_id: string;
  name: string;
  birth_date: string | null;
  sex: DependentSex | null;
};

const DAY_MS = 86400000;

function daysBetween(fromISO: string, toISO: string): number {
  const from = parseISO(fromISO);
  const to = parseISO(toISO);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

function milestoneLabel(name: string, age: number): string {
  if (age === 7) return `${name} turns 7 — lucky 7`;
  if (age === 18 || age === 21) return `${name}’s debut`;
  if (age === 60) return `${name}’s 60th`;
  return `${name} turns ${age}`;
}

/**
 * The upcoming milestone moment for each dependent (their NEXT ladder milestone
 * within `withinDays`). Sorted soonest-first. `eventId` is null — a milestone is
 * a suggestion until the guardian taps to plan it.
 */
export function buildDependentMoments(
  dependents: DependentForMoments[],
  todayISO: string,
  opts: { withinDays?: number } = {},
): YearMoment[] {
  const withinDays = opts.withinDays ?? 366;
  const out: YearMoment[] = [];

  for (const d of dependents) {
    if (!d.birth_date) continue;
    const m = dependentNextMilestone(d.birth_date, d.sex, todayISO);
    if (!m) continue;
    const daysUntil = daysBetween(todayISO, m.dateISO);
    if (daysUntil < 0 || daysUntil > withinDays) continue;
    out.push({
      dateISO: m.dateISO,
      daysUntil,
      label: milestoneLabel(d.name, m.age),
      detail: 'A milestone worth planning for',
      kind: 'milestone',
      eventId: null,
      isMilestone: true,
      tier: m.tier,
    });
  }

  return out.sort((a, b) => a.daysUntil - b.daysUntil || a.label.localeCompare(b.label));
}
