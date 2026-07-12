/**
 * faith-rites.ts — the per-religion child rite ladder + upcoming-rite derivation
 * (date-anchor model · Phase 3 · family graph · flag-off).
 *
 * A dependent with a religion surfaces their next RITE as a Year-view moment: a
 * Catholic child's Binyag → First Communion → Confirmation (Kumpil), a Muslim
 * child's Aqiqah, etc. Rites are AGE-WINDOWED but PARISH-DATED (the parish sets
 * the actual day), so the moment is a soft "around age N" nudge — the age date
 * is the anchor, the parish schedules the real day.
 *
 * Pure + dependency-free. ⚠ Consumes a CHILD's birthdate + religion — the caller
 * gates behind dependentPeopleEnabled(). Owner-confirmed 2026-07-12: the Catholic
 * ladder includes BOTH First Communion and Confirmation.
 */
import { parseISO, toISO, addYears } from './event-anchor';
import type { YearMoment } from './year-moments';

export type Rite = { rite: string; label: string; age: number; infant?: boolean };

/** Per-religion rite ladder (authored). Ages are PH-typical; the parish schedules the day. */
export const RITE_LADDER: Record<string, Rite[]> = {
  catholic: [
    { rite: 'baptism', label: 'Binyag (baptism)', age: 0, infant: true },
    { rite: 'first_communion', label: 'First Communion', age: 7 },
    { rite: 'confirmation', label: 'Confirmation (Kumpil)', age: 13 },
  ],
  muslim: [{ rite: 'aqiqah', label: 'Aqiqah', age: 0, infant: true }],
  christian: [{ rite: 'dedication', label: 'Child dedication', age: 0, infant: true }],
  inc: [{ rite: 'baptism', label: 'Baptism', age: 12 }],
  other: [],
};

export type UpcomingRite = { rite: string; label: string; dateISO: string; age: number };

/**
 * The next rite a child is approaching within `withinDays`, or null. An infant
 * rite (age 0) surfaces while the child is under ~1 (the binyag/aqiqah window);
 * an age-N rite surfaces as its age date approaches.
 */
export function upcomingRite(
  religion: string | null | undefined,
  birthISO: string,
  todayISO: string,
  withinDays = 366,
): UpcomingRite | null {
  const ladder = religion ? RITE_LADDER[religion] : undefined;
  const birth = parseISO(birthISO);
  const today = parseISO(todayISO);
  if (!ladder || !birth || !today) return null;

  let best: UpcomingRite | null = null;
  for (const r of ladder) {
    const ageDate = r.age === 0 ? birth : addYears(birth, r.age);
    const days = Math.round((ageDate.getTime() - today.getTime()) / 86400000);
    let inWindow: boolean;
    if (r.infant) {
      // binyag/aqiqah: relevant while the child is under 1 (age date within the
      // last year up to today).
      inWindow = days <= 0 && days >= -366;
    } else {
      inWindow = days >= 0 && days <= withinDays;
    }
    if (!inWindow) continue;
    const candidate: UpcomingRite = { rite: r.rite, label: r.label, dateISO: toISO(ageDate), age: r.age };
    if (!best || candidate.dateISO < best.dateISO) best = candidate;
  }
  return best;
}

export type DependentForRites = {
  dependent_id: string;
  name: string;
  birth_date: string | null;
  religion: string | null;
};

const DAY_MS = 86400000;
function daysBetween(fromISO: string, toISO2: string): number {
  const from = parseISO(fromISO);
  const to = parseISO(toISO2);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * Rite moments for each dependent with a religion — the next rite they approach.
 * `eventId` is null (a rite is a suggestion until the guardian taps to plan it).
 */
export function buildDependentRiteMoments(
  dependents: DependentForRites[],
  todayISO: string,
  opts: { withinDays?: number } = {},
): YearMoment[] {
  const withinDays = opts.withinDays ?? 366;
  const out: YearMoment[] = [];
  for (const d of dependents) {
    if (!d.birth_date || !d.religion) continue;
    const r = upcomingRite(d.religion, d.birth_date, todayISO, withinDays);
    if (!r) continue;
    const daysUntil = Math.max(0, daysBetween(todayISO, r.dateISO));
    out.push({
      dateISO: r.dateISO,
      daysUntil,
      label: `${d.name} — ${r.label}`,
      detail:
        r.age === 0
          ? 'Within the first year · the parish sets the day'
          : `Around age ${r.age} · the parish sets the day`,
      kind: 'milestone',
      eventId: null,
      isMilestone: true,
      tier: 'milestone',
    });
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil || a.label.localeCompare(b.label));
}
