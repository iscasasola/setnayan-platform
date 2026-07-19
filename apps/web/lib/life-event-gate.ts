/**
 * life-event-gate.ts — the life-event creation gate (pure half).
 *
 * Council verdict Event_Creation_Limits_Council_Verdict_2026-07-17.md, owner
 * "build it now" 2026-07-17. The organizing ruling:
 *
 *   "One per life event" = the shipped wedding-guard generalized — ONE
 *   IN-PLANNING life event per (creator account × event type × honoree).
 *   "Eligibility" = a SOFT planning-horizon advisory on the party date the
 *   form already collects — never a birthdate demand, never a hard wall.
 *
 * LIFE types (person-anchored moments): debut, christening, birthday,
 * graduation, gender_reveal — plus wedding, which keeps its own untouched
 * guard (wedding-guard.ts) and is deliberately NOT in this map.
 * LIFESTYLE types (everything else, incl. anniversary in v1): zero rules,
 * unlimited — and unknown/admin-created vocab types FAIL OPEN to lifestyle
 * (a fail-closed gate would orphan-block types a solo operator must hand-clear).
 *
 * The flag lives in CODE beside ANCHOR_BY_TYPE per the Conflict-E ruling
 * ("pure map first; promote to a vocab/profile column only when
 * admin-editability is actually needed").
 *
 * VISIBILITY (owner 2026-07-17): "hide events that do not concern them for
 * their life events — although Wedding should be available anytime as an adult
 * because this is not a measured date." So types split by MEASURABILITY:
 *  - measured (debut, christening) — their moment is derivable from a stored
 *    birthdate, so the create grid hides them unless the account's People data
 *    says they concern it. Hidden ≠ locked: a "show all" doorway always exists
 *    (wayfinding lock), because a self-planning debutante or a niece's aunt has
 *    no dependent record.
 *  - unmeasured (wedding, gender_reveal, graduation, birthday) — the platform
 *    cannot know (no pregnancy/education records; your own birthday always
 *    concerns you) → always visible.
 *
 * PRIVACY: pure functions over caller-supplied dates — this module stores
 * nothing and never asks for a birthdate. Mirrors event-anchor.ts.
 */
import { parseISO, yearsBetween, type Sex } from './event-anchor';

/**
 * Gate epoch — the grandfather rule (council § 2, mandatory). Legacy rows
 * created before the gate shipped carry no honoree_label and NEVER block; only
 * post-epoch unlabeled rows contend for the per-type singleton slot. No prod
 * account is retroactively frozen out of a type it was using.
 */
export const LIFE_GATE_EPOCH_ISO = '2026-07-18';

export type LifeGateSpec = {
  /**
   * Soft planning-horizon (days): typing a party date beyond this shows a
   * "malayo pa 'yan" ADVISORY with [Start planning anyway] — never a block,
   * never enforced server-side. From the owner-locked preparation-months
   * table (2026-07-17): debut 18 mo · christening 6 mo · birthday 9 mo ·
   * gender reveal 5 mo (biologically capped) · graduation 4 mo.
   */
  horizonDays: number;
  /** TRUE = visibility on the create grid is driven by People data (see above). */
  measured: boolean;
};

/** Wedding is deliberately absent — its own shipped guard stays byte-identical. */
export const LIFE_GATE_BY_TYPE: Record<string, LifeGateSpec> = {
  debut: { horizonDays: 548, measured: true },
  christening: { horizonDays: 183, measured: true },
  birthday: { horizonDays: 274, measured: false },
  graduation: { horizonDays: 122, measured: false },
  gender_reveal: { horizonDays: 152, measured: false },
};

/** Life type under THIS gate (wedding excluded — it has its own guard). */
export function isGatedLifeType(eventType: string | null | undefined): boolean {
  return !!eventType && eventType in LIFE_GATE_BY_TYPE;
}

export function horizonDaysFor(eventType: string): number | null {
  return LIFE_GATE_BY_TYPE[eventType]?.horizonDays ?? null;
}

/** The measured life types — hidden from the create grid absent a concern. */
export function measuredLifeTypes(): string[] {
  return Object.keys(LIFE_GATE_BY_TYPE).filter((k) => LIFE_GATE_BY_TYPE[k]?.measured);
}

/**
 * Normalize a typed honoree label into the cardinality key: case/whitespace-
 * folded. '' = no honoree typed → the per-type singleton slot.
 */
export function normalizeHonoree(label: string | null | undefined): string {
  return (label ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export type LifeEventRow = {
  event_id: string;
  event_type: string;
  display_name: string;
  event_date: string | null;
  archived: boolean;
  honoree_label: string | null;
  honoree_dependent_id: string | null;
  created_at: string;
};

export type LifeEventCandidate = {
  eventType: string;
  honoreeLabel?: string | null;
  honoreeDependentId?: string | null;
};

/**
 * Pure predicate — does existing event E block creating candidate N?
 * Blocks iff: same gated life type AND E is IN-PLANNING (byte-identical
 * in-planning shape to isInPlanningWedding: NOT archived AND date unset or
 * upcoming) AND the honoree keys collide — where two unlabeled events collide
 * only when E is post-epoch (grandfather rule).
 */
export function blocksLifeEventCreation(
  existing: LifeEventRow,
  candidate: LifeEventCandidate,
  todayIso: string,
): boolean {
  if (!isGatedLifeType(candidate.eventType)) return false;
  if (existing.event_type !== candidate.eventType) return false;
  if (existing.archived) return false;
  if (existing.event_date != null && existing.event_date < todayIso) return false; // settled

  // Honoree key collision. Dependent link is the strongest key; label next;
  // unlabeled = the singleton slot (opening a second slot costs exactly one
  // non-sensitive act: typing a name).
  if (candidate.honoreeDependentId && existing.honoree_dependent_id) {
    return candidate.honoreeDependentId === existing.honoree_dependent_id;
  }
  const existingKey = normalizeHonoree(existing.honoree_label);
  const candidateKey = normalizeHonoree(candidate.honoreeLabel);
  if (existingKey !== candidateKey) return false;
  if (existingKey === '') {
    // Both unlabeled → only a post-epoch row contends for the singleton slot.
    return existing.created_at.slice(0, 10) >= LIFE_GATE_EPOCH_ISO;
  }
  return true;
}

/** First blocking event among the account's rows, or null. */
export function findBlockingLifeEvent(
  rows: readonly LifeEventRow[],
  candidate: LifeEventCandidate,
  todayIso: string,
): LifeEventRow | null {
  for (const row of rows) {
    if (blocksLifeEventCreation(row, candidate, todayIso)) return row;
  }
  return null;
}

// ── soft horizon advisory (UI-only — never enforced server-side) ────────────

/**
 * Is a typed party date beyond the type's planning horizon? NULL = no advisory
 * (no horizon for the type, or unparseable dates). The advisory always ships
 * with [Start planning anyway] — council § 3: soft, never a wall.
 */
export function beyondHorizon(
  eventType: string,
  partyDateISO: string,
  todayISO: string,
): boolean | null {
  const days = horizonDaysFor(eventType);
  if (days == null) return null;
  const party = parseISO(partyDateISO);
  const today = parseISO(todayISO);
  if (!party || !today) return null;
  const diffDays = Math.round((party.getTime() - today.getTime()) / 86_400_000);
  return diffDays > days;
}

// ── measured-type visibility (owner 2026-07-17 "hide what doesn't concern") ──

/** The Nth birthday as an ISO date, Feb-29 clamped (mirrors claimBirthdateCutoff). */
function nthBirthdayISO(birthISO: string, n: number): string | null {
  const [y, m = 1, d = 1] = birthISO.split('-').map(Number);
  if (!y || !m || !d) return null;
  const lastDay = new Date(Date.UTC(y + n, m, 0)).getUTCDate();
  return new Date(Date.UTC(y + n, m - 1, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

/**
 * Debut concern — someone reaches their debut age (18 F / 21 M / either when
 * sex unknown) within the debut horizon. Pure; caller supplies the birthdate.
 */
export function debutConcernsBirthdate(
  birthISO: string,
  sex: Sex,
  todayISO: string,
): boolean {
  const ages = sex === 'female' ? [18] : sex === 'male' ? [21] : [18, 21];
  const today = parseISO(todayISO);
  if (!today) return false;
  const debutHorizonDays = horizonDaysFor('debut') ?? 548;
  const horizonEnd = new Date(today.getTime() + debutHorizonDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return ages.some((age) => {
    const day = nthBirthdayISO(birthISO, age);
    return day != null && day >= todayISO && day <= horizonEnd;
  });
}

/** Christening concern — a young child (under 8; PH binyag is infant-to-7). */
export function christeningConcernsBirthdate(birthISO: string, todayISO: string): boolean {
  const birth = parseISO(birthISO);
  const today = parseISO(todayISO);
  if (!birth || !today) return false;
  return yearsBetween(birth, today) < 8;
}

export type ConcernPerson = {
  birth_date: string | null;
  sex: string | null;
};

/**
 * Which measured life types should the create grid HIDE for this account?
 * `people` = the account's person-kind dependents (empty array = none;
 * NULL = the People layer is unavailable/flag-off → we cannot measure, so
 * NOTHING hides — fail open, same posture as unknown vocab types).
 * A person with no stored birthdate can't be measured → counts as a concern
 * for every measured type (fail open per person).
 */
export function hiddenMeasuredTypes(
  people: readonly ConcernPerson[] | null,
  todayISO: string,
): string[] {
  if (people == null) return [];
  return measuredLifeTypes().filter((type) => {
    const concerned = people.some((p) => {
      if (!p.birth_date) return true; // unmeasurable person → fail open
      if (type === 'debut') {
        return debutConcernsBirthdate(p.birth_date, (p.sex ?? null) as Sex, todayISO);
      }
      if (type === 'christening') {
        return christeningConcernsBirthdate(p.birth_date, todayISO);
      }
      return true;
    });
    return !concerned;
  });
}
