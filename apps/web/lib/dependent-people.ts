/**
 * dependent-people.ts — the pure logic of the dependent layer (date-anchor
 * model · Phase 3 · Family graph · flag-off).
 *
 * A dependent is "someone (or something) you care for" — a person, a pet, or
 * anything else (owner 2026-07-13: it is NOT defined as a child). The kind
 * discriminator (`dependent_kind`) decides which rules apply:
 *  - kind = 'person' → the human case, and the ONLY case that can carry
 *    sensitive PI (birthdate + religion + sex, guardian-consented). The age
 *    fence + milestones below apply here.
 *  - kind = 'pet' | 'other' → no fence, no milestones, no religion — just a name
 *    and (optionally) a birthday. No sensitive personal data.
 *
 * ⚠ This module holds NO data and does NO I/O — pure age-fence + milestone +
 * validation logic. The person-case records (a child's birthdate/religion/sex)
 * are sensitive PI and, together with the whole surface, are gated by
 * `dependentPeopleEnabled()` (default OFF) until the DPO/counsel review clears.
 *
 * Owner-locked rules encoded here (person-case only):
 *  - AGE FENCE: a PERSON dependent's birthdate is storable ONLY when they are
 *    UNDER 18 (a child a guardian plans for) or OVER 50 (an elder being
 *    honored). 18–50 adults own their own dates — invite, never register. Pets /
 *    other are exempt (any birthday, or none). A DB CHECK can't reference now(),
 *    so the fence is enforced app-side for person records.
 *  - AGE-OUT: a <18 person record hands over to the person's own account at their
 *    LAST debut milestone — 18 for female, 21 for male (owner reconciliation:
 *    persist a son's record to 21, not a flat 18).
 */
import { yearsBetween, parseISO, nextMilestone, type Sex } from './event-anchor';
import { RELIGIONS, isReligion, type Religion } from './profile-personalization';

export { RELIGIONS, isReligion, type Religion };

/** What a dependent record is — a person, a pet, or anything else you care for. */
export const DEPENDENT_KINDS = ['person', 'pet', 'other'] as const;
export type DependentKind = (typeof DEPENDENT_KINDS)[number];

export const DEPENDENT_KIND_LABELS: Record<DependentKind, string> = {
  person: 'A person',
  pet: 'A pet',
  other: 'Something else',
};

export function isDependentKind(v: unknown): v is DependentKind {
  return typeof v === 'string' && (DEPENDENT_KINDS as readonly string[]).includes(v);
}

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
