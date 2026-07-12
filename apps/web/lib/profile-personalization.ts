/**
 * profile-personalization.ts — the OPTIONAL, sensitive-PI self-profile fields
 * that tailor a user's events (date-anchor model · Faith_Aware_Person_Graph).
 *
 * Owner rules (2026-07-12): religion + civil status are REFERENCE-ONLY, never
 * required, opt-in. Both are SENSITIVE personal information under RA 10173
 * §3(l) (religious affiliation; marital status) — so a value is stored only
 * with the user's own consent, stamped `<field>_consent_at` (mirroring the
 * marketing-consent pattern), cleared on withdrawal. Adding them tailors the
 * experience (wedding ceremony pre-select · union-anchor stage); leaving them
 * blank changes nothing.
 *
 * Pure value sets + validators — no I/O, trivially unit-testable.
 */

/** Civil status (PH — no civil divorce except under the Muslim code). */
export const CIVIL_STATUSES = [
  'single',
  'in_a_relationship',
  'engaged',
  'married',
  'widowed',
  'separated',
] as const;
export type CivilStatus = (typeof CIVIL_STATUSES)[number];

export const CIVIL_STATUS_LABELS: Record<CivilStatus, string> = {
  single: 'Single',
  in_a_relationship: 'In a relationship',
  engaged: 'Engaged',
  married: 'Married',
  widowed: 'Widowed',
  separated: 'Separated / annulled',
};

/**
 * Religion — aligned with the faith-registry keys so it can pre-select the
 * wedding ceremony path (a later wiring), plus a neutral "other". These are the
 * PERSON's faith, not a ceremony type (civil/mixed are not religions).
 */
export const RELIGIONS = ['catholic', 'muslim', 'inc', 'christian', 'other'] as const;
export type Religion = (typeof RELIGIONS)[number];

export const RELIGION_LABELS: Record<Religion, string> = {
  catholic: 'Roman Catholic',
  muslim: 'Muslim',
  inc: 'Iglesia ni Cristo',
  christian: 'Christian (other)',
  other: 'Other / prefer to describe later',
};

export function isCivilStatus(v: unknown): v is CivilStatus {
  return typeof v === 'string' && (CIVIL_STATUSES as readonly string[]).includes(v);
}

export function isReligion(v: unknown): v is Religion {
  return typeof v === 'string' && (RELIGIONS as readonly string[]).includes(v);
}

/**
 * Normalize a raw form value to a stored value or null. Empty string / unknown
 * → null (the "prefer not to say" / withdrawal state), never a thrown error.
 */
export function normalizeCivilStatus(raw: unknown): CivilStatus | null {
  return isCivilStatus(raw) ? raw : null;
}
export function normalizeReligion(raw: unknown): Religion | null {
  return isReligion(raw) ? raw : null;
}

/**
 * RA 10173 durable proof-of-consent for a sensitive field, mirroring the
 * marketing-consent transition logic: stamp now() when a value first appears,
 * clear to null when it's withdrawn, and leave an existing timestamp untouched
 * when the value is unchanged (so a later profile save never re-dates consent).
 * Returns the patch to apply (empty object = no change).
 */
export function consentPatch(
  next: string | null,
  prev: string | null,
  nowIso: string,
): { consent_at?: string | null } {
  const hadValue = prev != null;
  const hasValue = next != null;
  if (hasValue && !hadValue) return { consent_at: nowIso };
  if (!hasValue && hadValue) return { consent_at: null };
  return {};
}
