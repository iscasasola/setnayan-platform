/**
 * Vendor government registration number — normalization + validation.
 *
 * The vendor types a government registration number during verification (their
 * BIR TIN, or a DTI / SEC registration, or a Mayor's-Permit number). We store:
 *
 *   • the RAW string (trimmed) for display + admin review, and
 *   • a NORMALIZED canonical key that the DB partial-unique index guards, so a
 *     vendor cannot open a second account under the same registered identity to
 *     farm launch perks (the "first N bookings free" window).
 *
 * Normalization is deliberately format-agnostic (works for a hyphenated TIN
 * `123-456-789-000`, a DTI cert, or an SEC number): uppercase + drop every
 * non-alphanumeric character. Two inputs that differ only in spacing / dashes /
 * case therefore collide, which is the whole point.
 *
 * Pure module (no 'use server', no DB) so it is unit-testable and importable
 * from both server actions and client copy.
 */

/** Minimum meaningful length after normalization — guards against a vendor
 *  typing "1" or "-" and accidentally reserving a near-empty identity that
 *  would collide with everyone else who did the same. PH TINs are 9+ digits;
 *  DTI/SEC numbers are longer still. 5 is a safe, permissive floor. */
export const REGISTRATION_NUMBER_MIN_LENGTH = 5;

/** Upper bound so a pasted blob can never bloat the column / index. */
export const REGISTRATION_NUMBER_MAX_LENGTH = 40;

/**
 * Canonicalize a raw registration number into the comparison key stored in
 * `vendor_profiles.registration_number_normalized`. Returns `null` when the
 * input is not a usable identity (empty, or shorter than the floor after
 * stripping) — callers persist `null` (leaving the row out of the unique
 * index) rather than reserving a junk key.
 */
export function normalizeRegistrationNumber(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length < REGISTRATION_NUMBER_MIN_LENGTH) return null;
  return normalized.slice(0, REGISTRATION_NUMBER_MAX_LENGTH);
}

/** Trim + clamp the raw value we keep for display. Returns null for blanks. */
export function cleanRegistrationNumberRaw(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, 128);
  return t.length > 0 ? t : null;
}

export type RegistrationNumberParse =
  | { ok: true; raw: string; normalized: string }
  | { ok: false; reason: 'empty' | 'too_short' };

/**
 * Parse + validate a submitted registration number in one shot. `empty` means
 * the vendor left it blank (a soft no-op for the caller); `too_short` means
 * they typed something that doesn't normalize to a usable identity (surface a
 * "please enter your full registration number" message).
 */
export function parseRegistrationNumber(raw: string | null | undefined): RegistrationNumberParse {
  const cleanedRaw = cleanRegistrationNumberRaw(raw);
  if (!cleanedRaw) return { ok: false, reason: 'empty' };
  const normalized = normalizeRegistrationNumber(cleanedRaw);
  if (!normalized) return { ok: false, reason: 'too_short' };
  return { ok: true, raw: cleanedRaw, normalized };
}

/** SQLSTATE for a unique-constraint violation — how a registration-number
 *  collision surfaces from Postgres when two vendors race the same identity
 *  (or one simply reuses another's). Callers treat this as "needs review",
 *  never a crash. */
export const UNIQUE_VIOLATION = '23505';

/** The one vendor-facing collision message, shared by copy + enforcement so
 *  they can never drift. */
export const REGISTRATION_NUMBER_TAKEN_MESSAGE =
  'This registration number is already registered to another shop. ' +
  "We've flagged your application for our team to review — you don't need to do anything else right now.";
