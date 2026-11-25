/**
 * plus-one-welcome.ts — what a PLUS-ONE is asked when they open THEIR OWN link.
 *
 * Owner, verbatim, 2026-09-29: *"plus guests are only minimum questions. they
 * don't need to recommend songs and notes to the couple. They also get their
 * own QR Code. they can also link it to their account."* Prototype
 * `rsvp_plus_ones_2026-09-29.html`, frame F: *"His name and meal are already
 * there — from Maria's answers, marked so. Only what is missing is asked
 * (dietary notes, the Terms). One button: Save to my account … Small 'Not now —
 * just show my pass'."*
 *
 * A plus-one's four are first name, last name, meal and dietary — meal and
 * dietary only when the couple asks them (the same `rsvp_ask_config` switches
 * as every guest). Nothing else: no attendance question (their attendance
 * follows their own reply IF they give one, on the RSVP tab — it is never
 * demanded here), no mobile, no song, no note, no selfie.
 *
 * Pure: no database, no cookies. The door (`app/[slug]/welcome`), the link
 * (`app/[slug]/redeem`) and the Event Hub's key gate (`app/[slug]/page.tsx`)
 * all ask THIS, so the three cannot disagree about what a plus-one still owes.
 */
import { PLACEHOLDER_FIRST_NAME } from '@/lib/extra-seats';
import { FORMAL_NAME_FIELDS, type FormalNameField } from '@/lib/formal-name';

/**
 * Set by either of the door's two buttons — "Save to my account" or "Not now".
 * Value = the plus-one's guest id. While it matches, opening the link again
 * goes straight to the Event Hub instead of the welcome. Per browser, like the
 * pass itself; a new phone sees the welcome once more, which costs one tap.
 */
export const PLUS_ONE_WELCOMED_COOKIE = 'sn_p1_welcomed';
export const PLUS_ONE_WELCOMED_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * 🔁 A4-26 (final check, area 4): when the plus-one's save does not go through, the name they typed comes back
 * into the boxes. It travels in a five-minute, httpOnly cookie scoped to this door — never in the address, so a
 * guest's name is not written into the URL, the browser history or a server log. Read only beside
 * `?error=save_failed`.
 */
export const PLUS_ONE_TYPED_COOKIE = 'sn_p1_typed';
export const PLUS_ONE_TYPED_MAX_AGE = 60 * 5;

export type TypedName = Partial<Record<FormalNameField, string>>;

/** The five name boxes as typed (trimmed, at most 80 characters each), or null when nothing was typed. */
export function typedNameFromForm(formData: FormData): string | null {
  const typed: TypedName = {};
  for (const field of FORMAL_NAME_FIELDS) {
    const v = String(formData.get(field) ?? '').trim().slice(0, 80);
    if (v) typed[field] = v;
  }
  return Object.keys(typed).length > 0 ? JSON.stringify(typed) : null;
}

/** The cookie back into box defaults. Anything malformed is nothing — the boxes are simply empty, as before. */
export function readTypedName(raw: string | undefined | null): TypedName | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const typed: TypedName = {};
    for (const field of FORMAL_NAME_FIELDS) {
      const v = (parsed as Record<string, unknown>)[field];
      if (typeof v === 'string' && v.trim()) typed[field] = v.trim().slice(0, 80);
    }
    return Object.keys(typed).length > 0 ? typed : null;
  } catch {
    return null;
  }
}

export type PlusOneRow = {
  first_name: string | null;
  last_name: string | null;
  /** The other three name parts — the door's name boxes are the five (owner 2026-09-30). */
  name_prefix?: string | null;
  middle_name?: string | null;
  name_suffix?: string | null;
  plus_one_name_confirmed_at: string | null;
  meal_preference: string | null;
  dietary_restrictions: string | null;
};

export type PlusOneAnswers = {
  /** Their name is still the placeholder — nobody has named them. */
  name: boolean;
  meal: boolean;
  dietary: boolean;
};

/** A seat still unnamed — the same test the link and the loader use for "TBA". */
export function plusOneUnnamed(row: Pick<PlusOneRow, 'first_name' | 'plus_one_name_confirmed_at'>): boolean {
  if (row.plus_one_name_confirmed_at) return false;
  const first = (row.first_name ?? '').trim();
  return !first || first.toUpperCase() === PLACEHOLDER_FIRST_NAME;
}

/** Which of the four are still MISSING — only these are asked. */
export function plusOneMissing(
  row: PlusOneRow,
  ask: { meal: boolean; dietary: boolean },
): PlusOneAnswers {
  return {
    name: plusOneUnnamed(row),
    meal: ask.meal && !(row.meal_preference ?? '').trim(),
    dietary: ask.dietary && !(row.dietary_restrictions ?? '').trim(),
  };
}

/**
 * Which of the four are already FILLED — shown, marked "from <bringer>", never
 * asked again. The mirror of `plusOneMissing` for the fields the couple asks.
 */
export function plusOneFilled(
  row: PlusOneRow,
  ask: { meal: boolean; dietary: boolean },
): PlusOneAnswers {
  const missing = plusOneMissing(row, ask);
  return { name: !missing.name, meal: ask.meal && !missing.meal, dietary: ask.dietary && !missing.dietary };
}

/**
 * THE KEY GATE FOR A PLUS-ONE (the owner's 2026-09-26 key gate: a required
 * answer missing is asked before the Event Hub opens). For a plus-one the
 * REQUIRED answers are their name and — when the couple asks it — their meal.
 * Dietary is optional; attendance and mobile are not theirs to be asked
 * (owner 2026-09-29: "only minimum questions"). Missing → their own door.
 */
export function plusOneGate(
  row: PlusOneRow,
  ask: { meal: boolean; dietary: boolean },
  locked: boolean,
): 'welcome' | 'inside' {
  if (locked) return 'inside';
  const missing = plusOneMissing(row, ask);
  return missing.name || missing.meal ? 'welcome' : 'inside';
}

/**
 * Does opening the link show the welcome? Once per browser (the cookie), and
 * never for a plus-one whose invitation is already kept in an account.
 */
export function plusOneWelcomeDue(input: {
  guestId: string;
  welcomedCookie: string | null | undefined;
  seatHeld: boolean;
}): boolean {
  if (input.seatHeld) return false;
  return input.welcomedCookie !== input.guestId;
}
