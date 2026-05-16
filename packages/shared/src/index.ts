// Setnayan shared types + helpers. Sprint 0 holds the canonical ID contract;
// iteration 0000 layers in the role-router types, and later iterations grow
// this surface as they ship.

export type PublicIdType = 'U' | 'V' | 'E' | 'O';

export const PUBLIC_ID_PATTERN = /^S89[UVEO]-[0-9A-HJKMNP-TV-Z]{10}$/;

/**
 * Validates that a string matches the canonical Setnayan public_id contract
 * defined in 02_Specifications/Account_ID_Format.md.
 *
 * Generation lives server-side in the Postgres function `generate_public_id`.
 * This helper exists for client-side display + form validation.
 */
export function isValidPublicId(value: string, type?: PublicIdType): boolean {
  if (!PUBLIC_ID_PATTERN.test(value)) return false;
  if (type && value.charAt(3) !== type) return false;
  return true;
}

export type AccountType = 'customer' | 'vendor' | 'admin';

export type EventType =
  | 'wedding'
  | 'birthday'
  | 'celebration'
  | 'travel'
  | 'corporate'
  | 'tournament'
  | 'christening';

export type MemberType = 'couple' | 'guest' | 'vendor' | 'coordinator';

export type LocaleCode = 'en' | 'tl' | 'ceb';

export type ThemePreference = 'setnayan_default' | 'victorian' | 'classy' | 'ios';
