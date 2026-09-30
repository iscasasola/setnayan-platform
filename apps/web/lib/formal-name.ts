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

import { parsePersonName } from '@/lib/person-name-parse';

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
 * THE PREFIX DROPDOWN'S CHOICES — the guest-side name boxes (the RSVP's
 * plus-ones, the plus-one's own door, the ask-to-join request) offer Prefix as
 * ONE dropdown (owner 2026-09-30: *"The name will be same: Prefix · First ·
 * Middle · Last · Suffix, to stay consistent"*; a set of choices is a dropdown).
 *
 * ⚖ Not a new vocabulary: every entry is one the Guest list's own name splitter
 * already reads as a prefix (`parsePersonName`, lib/person-name-parse.ts) —
 * `formal-name.test.ts` holds that, so the two can never disagree about what a
 * title is. It is the SHORT list a guest picks from; a stored prefix outside it
 * (the host typed "Justice") is kept as an extra option, never dropped.
 */
export const NAME_PREFIX_CHOICES = [
  'Mr.',
  'Mrs.',
  'Ms.',
  'Miss',
  'Dr.',
  'Dra.',
  'Atty.',
  'Engr.',
  'Arch.',
  'Prof.',
  'Hon.',
  'Judge',
  'Rev.',
  'Fr.',
  'Msgr.',
  'Bro.',
  'Sis.',
  'Pastor',
  'Capt.',
  'Col.',
  'Gen.',
  'Maj.',
  'Lt.',
  'Sgt.',
] as const;

/** The dropdown's options for a given stored prefix: the list, plus that value when it is not on it. */
export function prefixChoicesFor(current: string | null | undefined): string[] {
  const kept = normalizeNamePart(current);
  const list: string[] = [...NAME_PREFIX_CHOICES];
  return kept && !list.includes(kept) ? [kept, ...list] : list;
}

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

/**
 * A one-line name ("Atty. Bob Casasola Jr.") split into the five parts by the
 * Guest list's own splitter (`parsePersonName`) — for boxes that open on a name
 * that was only ever stored whole (an account's display name).
 */
export function formalNameFromLine(line: string | null | undefined): FormalName {
  const p = parsePersonName(line ?? '');
  return {
    name_prefix: normalizeNamePart(p.prefix),
    first_name: normalizeNamePart(p.firstName),
    middle_name: normalizeNamePart(p.middleName),
    last_name: normalizeNamePart(p.lastName),
    name_suffix: normalizeNamePart(p.suffix),
  };
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

/**
 * 🪪 THE NAME ON A PLACE CARD — "Mr. Manuel C. Casasola".
 *
 * Owner, 2026-09-30 (the "Place card" seat style): *"A place card is a name card
 * by definition, and 'no casual greetings' means formal, not no name."* So the
 * card prints the formal name with the MIDDLE NAME AS INITIALS — prefix, first,
 * middle initial(s), last, then any suffix ("Mr. Indalecio S. Casasola II").
 *
 * 🔒 NEVER A BARE FIRST NAME. The first-name rule (#6183, DECISION_LOG
 * 2026-09-30) is about greetings like "Hi, Manuel", not labels — but a card
 * that reads only "Manuel" IS that greeting. Without a last name there is no
 * formal name, and this returns NULL so the card prints its table alone.
 */
export function placeCardName(
  name: Partial<Record<FormalNameField, string | null | undefined>>,
): string | null {
  const first = normalizeNamePart(name.first_name);
  const last = normalizeNamePart(name.last_name);
  if (!first || !last) return null;
  const middle = normalizeNamePart(name.middle_name);
  const initials = middle
    ? middle
        .split(/[\s.]+/)
        .filter(Boolean)
        .map((w) => `${w[0]!.toUpperCase()}.`)
        .join(' ')
    : null;
  return [normalizeNamePart(name.name_prefix), first, initials, last, normalizeNamePart(name.name_suffix)]
    .filter(Boolean)
    .join(' ');
}

/**
 * 👤 A PROFILE'S NAME, WHEN IT IS ONE — the five parts normalised, NULL unless
 * they hold a first AND a last name. A linked guest row wears the profile's name
 * only then (owner 2026-09-30, lib/linked-profile-names.ts); an account that
 * never filled its name leaves the row as the couple typed it.
 */
export function profileFormalName(
  row: Partial<Record<FormalNameField, string | null | undefined>>,
): FormalName | null {
  const name = {} as FormalName;
  for (const f of FORMAL_NAME_FIELDS) name[f] = normalizeNamePart(row[f]);
  return name.first_name && name.last_name ? name : null;
}

/**
 * The row as every screen shows it: a linked account's five parts over the
 * row's own. The couple's nickname (`display_name`) is theirs and stays.
 */
export function withProfileName<T extends { guest_id: string; first_name: string; last_name: string }>(
  row: T,
  names: Record<string, { name: FormalName }>,
): T {
  const n = names[row.guest_id]?.name;
  if (!n) return row;
  return {
    ...row,
    name_prefix: n.name_prefix,
    first_name: n.first_name ?? row.first_name,
    middle_name: n.middle_name,
    last_name: n.last_name ?? row.last_name,
    name_suffix: n.name_suffix,
  };
}

/** The @tag as shown — `users.slug` with its "@". NULL when there is no slug. */
export function atTag(slug: string | null | undefined): string | null {
  const s = (slug ?? '').trim();
  return s ? `@${s}` : null;
}
