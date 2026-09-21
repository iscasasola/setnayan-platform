/**
 * formal-name.ts — a person's FORMAL name on their own profile, and the one
 * rule for turning it into a line of text.
 *
 * Owner, 2026-09-21: *"on my event, my name is Indalecio Casasola II. with a
 * Prefix, First, middle, last, and suffix … on a user profile … when they are
 * added, their real profile name will show."* The display name stays the
 * nickname ("Ice Casasola"); these five are the name guest lists and
 * invitations print ("Mr. Indalecio Sacdalan Casasola II").
 *
 * ⚖ SELF-DECLARED, NEVER VERIFIED (owner, same day): *"placing these
 * information does not require birth certificate or anything. so we do not
 * have to verify if they are the real person."* Whatever a person types is
 * their name here.
 *
 * Pure on purpose — the profile action, the profile page, the people search
 * and the tests all import it, and none of them may disagree about what a
 * blank part is or in what order the parts print.
 */

/** The five parts, in PRINTED order. Same column names as `guests`. */
export const FORMAL_NAME_FIELDS = [
  'name_prefix',
  'first_name',
  'middle_name',
  'last_name',
  'name_suffix',
] as const;

export type FormalNameField = (typeof FORMAL_NAME_FIELDS)[number];
export type FormalName = Record<FormalNameField, string | null>;

/** Matches the `users_formal_name_len_chk` / `guests_name_parts_len_chk` cap. */
export const FORMAL_NAME_PART_MAX = 80;

export const FORMAL_NAME_LABELS: Record<FormalNameField, string> = {
  name_prefix: 'Prefix',
  first_name: 'First name',
  middle_name: 'Middle name',
  last_name: 'Last name',
  name_suffix: 'Suffix',
};

/**
 * One part, as stored: trimmed, inner whitespace collapsed, capped, and a
 * blank becomes NULL — never '' — so "no suffix" and "suffix cleared" are the
 * same value and nothing prints an empty gap.
 */
export function normalizeNamePart(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const clean = raw.replace(/\s+/g, ' ').trim().slice(0, FORMAL_NAME_PART_MAX).trim();
  return clean || null;
}

/** Read all five parts off a submitted form. A missing field is NULL. */
export function formalNameFromForm(form: { get(name: string): unknown }): FormalName {
  const out = {} as FormalName;
  for (const f of FORMAL_NAME_FIELDS) out[f] = normalizeNamePart(form.get(f));
  return out;
}

/** True when not one part holds anything — the profile has never been filled. */
export function isFormalNameEmpty(name: Partial<Record<FormalNameField, string | null | undefined>>): boolean {
  return FORMAL_NAME_FIELDS.every((f) => !normalizeNamePart(name[f]));
}

/**
 * The formal name as one line — "Mr. Indalecio Sacdalan Casasola II".
 * Parts in printed order, blanks skipped, NULL when nothing is left (so a
 * caller drops the line rather than printing an empty one).
 */
export function composeFormalName(
  name: Partial<Record<FormalNameField, string | null | undefined>>,
): string | null {
  const whole = FORMAL_NAME_FIELDS.map((f) => normalizeNamePart(name[f]))
    .filter(Boolean)
    .join(' ');
  return whole || null;
}

/** The @tag as shown — `users.slug` with its "@". NULL when there is no slug. */
export function atTag(slug: string | null | undefined): string | null {
  const s = (slug ?? '').trim();
  return s ? `@${s}` : null;
}
