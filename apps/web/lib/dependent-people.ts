/**
 * dependent-people.ts — the pure logic of the guardian-held dependent layer
 * (date-anchor model · Phase 3 · Family graph · COUNSEL-GATED, flag-off).
 *
 * ⚠ This module holds NO data and does NO I/O — it is the pure age-fence +
 * milestone + validation logic behind the dependent records. The records
 * themselves (a child's birthdate + religion + sex) are the most sensitive data
 * the platform holds and are gated by `dependentPeopleEnabled()` (default OFF)
 * until the DPO/counsel review clears them.
 *
 * Owner-locked rules encoded here:
 *  - AGE FENCE: a dependent's birthdate is storable ONLY when the person is
 *    UNDER 18 (a child a guardian plans for) or OVER 50 (an elder being
 *    honored). 18–50 adults own their own dates — invite, never register.
 *    (A DB CHECK can't reference now(); this is the authoritative check.)
 *  - AGE-OUT: a <18 record hands over to the person's own account at their LAST
 *    debut milestone — 18 for female, 21 for male (owner reconciliation: persist
 *    a son's record to 21, not a flat 18).
 */
import { yearsBetween, parseISO, nextMilestone, type Sex } from './event-anchor';
import { RELIGIONS, isReligion, type Religion } from './profile-personalization';

export { RELIGIONS, isReligion, type Religion };

/** Optional sex — only for the 18F/21M debut derivation. */
export const DEPENDENT_SEXES = ['female', 'male'] as const;
export type DependentSex = (typeof DEPENDENT_SEXES)[number];

/** The family role a dependent record represents (drives which milestones apply). */
export const DEPENDENT_RELATIONSHIPS = ['child', 'parent', 'grandparent', 'sibling', 'other'] as const;
export type DependentRelationship = (typeof DEPENDENT_RELATIONSHIPS)[number];

export const DEPENDENT_RELATIONSHIP_LABELS: Record<DependentRelationship, string> = {
  child: 'My child',
  parent: 'My parent',
  grandparent: 'My grandparent',
  sibling: 'My sibling',
  other: 'Someone I care for',
};

export function isDependentSex(v: unknown): v is DependentSex {
  return typeof v === 'string' && (DEPENDENT_SEXES as readonly string[]).includes(v);
}
export function isDependentRelationship(v: unknown): v is DependentRelationship {
  return typeof v === 'string' && (DEPENDENT_RELATIONSHIPS as readonly string[]).includes(v);
}

export type FenceBand = 'child' | 'elder' | 'blocked';

/**
 * The age fence (owner rule). Returns which band a birthdate falls in:
 * 'child' (<18, guardian-held), 'elder' (>50, honoring), or 'blocked' (18–50 →
 * they own their own dates; invite, never register). This is the authoritative
 * gate — the server action MUST refuse a 'blocked' record.
 */
export function fenceBand(birthISO: string, todayISO: string): FenceBand | null {
  const birth = parseISO(birthISO);
  const today = parseISO(todayISO);
  if (!birth || !today) return null;
  const age = yearsBetween(birth, today);
  if (age < 18) return 'child';
  if (age > 50) return 'elder';
  return 'blocked';
}

export function isFenceEligible(birthISO: string, todayISO: string): boolean {
  const band = fenceBand(birthISO, todayISO);
  return band === 'child' || band === 'elder';
}

/** The age a dependent record hands over to its own account: female 18, male 21. */
export function handOverAge(sex: DependentSex | null | undefined): number {
  return sex === 'male' ? 21 : 18;
}

/**
 * Should this <18 record hand over to the person's own account now? True once
 * the person reaches their hand-over age (their last debut milestone). Elder
 * (>50) records never hand over.
 */
export function shouldHandOver(
  birthISO: string,
  sex: DependentSex | null | undefined,
  todayISO: string,
): boolean {
  const birth = parseISO(birthISO);
  const today = parseISO(todayISO);
  if (!birth || !today) return false;
  if (yearsBetween(birth, today) > 50) return false; // elder — never hands over
  return yearsBetween(birth, today) >= handOverAge(sex);
}

/** The dependent's next milestone (reuses the ladder; sex maps to F/M debut). */
export function dependentNextMilestone(birthISO: string, sex: DependentSex | null | undefined, todayISO: string) {
  return nextMilestone(birthISO, (sex ?? null) as Sex, todayISO);
}
