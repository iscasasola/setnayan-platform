/**
 * create-subjects.ts — WHO the event is for, asked BEFORE what kind it is.
 *
 * Sixteen type tiles is a wall; the same sixteen sorted around one named person
 * is a short, obvious list. So the create flow asks "Para kanino ito?" first and
 * uses the answer to sort the grid — a pet has no debut, a six-year-old has no
 * wedding.
 *
 * ⚠ SORTED, NEVER LOCKED. Everything this module "hides" flows into the picker's
 * ALREADY-SHIPPED `hiddenTypeKeys` prop, whose "show all event types" expander
 * is the standing wayfinding doorway (owner 2026-07-17: hidden ≠ locked — a
 * self-planning debutante or a niece's aunt has no dependent record). Nothing
 * here can dead-end anyone.
 *
 * ⚠ NO BIRTHDATE IS EVER ASKED OR STORED HERE. The only birthdates in play are
 * ones a guardian already recorded on an alaga (`dependents.birth_date`,
 * counsel-gated behind NEXT_PUBLIC_DEPENDENT_PEOPLE + the
 * `dependent_minor_profiles` data-privacy control). A subject with no birthdate
 * on file narrows nothing — fail OPEN, per person, exactly like
 * hiddenMeasuredTypes.
 *
 * Pure + I/O-free so both the server page and the client picker can import it.
 */
import { hiddenMeasuredTypes, type ConcernPerson } from './life-event-gate';
import { parseISO, yearsBetween } from './event-anchor';

/**
 * What kind of thing the celebration is for.
 *  - `self`        — the account holder. Adults by construction (RA 6809 hand-over
 *                    at 18), so nothing is sorted away: your own grid is your own.
 *  - `person`      — an alaga who is a person (may carry a stored birthdate).
 *  - `pet` / `other` — an alaga with no milestone ladder (a dog, a sari-sari
 *                    store, a car). `dependents.dependent_kind` verbatim.
 *  - `unspecified` — "someone else" / "just an event": we deliberately know
 *                    nothing, so we sort nothing.
 */
export type CreateSubjectKind = 'self' | 'person' | 'pet' | 'other' | 'unspecified';

export type CreateSubject = {
  /** 'self' · 'unspecified' · else the alaga's `dependent_id`. */
  id: string;
  kind: CreateSubjectKind;
  /** What to call them on screen. Never fabricated — see buildSelfSubject. */
  name: string;
  /** One line under the name (e.g. "Alaga · person"). */
  subtitle: string;
  /** ISO birthdate — person alaga only, and ONLY when already on file. */
  birthDate: string | null;
  sex: 'female' | 'male' | null;
};

export const SELF_SUBJECT_ID = 'self';
export const UNSPECIFIED_SUBJECT_ID = 'unspecified';

/**
 * Life types that belong to a PERSON and cannot belong to a pet, a business or
 * a car. Deliberately excludes `birthday`: a dog's birthday party is an
 * ordinary Filipino celebration, and `anniversary` / the lifestyle types are
 * open to anything.
 */
export const PERSON_ONLY_TYPES = [
  'wedding',
  'debut',
  'christening',
  'graduation',
  'gender_reveal',
] as const;

/** PH Family Code Art. 5 — a marriage below 18 is void, not merely discouraged. */
export const MARRIAGE_AGE_FLOOR = 18;

/**
 * Which event types should the grid fold away for this subject?
 *
 * Returns keys, never a decision: the caller passes them to the picker's
 * `hiddenTypeKeys`, which keeps its "show all" expander. An empty array = sort
 * nothing, which is also what every unknown case returns.
 */
export function hiddenTypesForSubject(
  subject: CreateSubject | null,
  todayISO: string,
): string[] {
  if (!subject) return [];

  // "You" and "someone else" tell us nothing measurable. Your own grid stays
  // whole (an 18-year-old CAN plan her own debut; adults DO get baptised), and
  // an unnamed someone-else is by definition unmeasured.
  if (subject.kind === 'self' || subject.kind === 'unspecified') return [];

  // A pet / a business / a car has no milestone ladder — only the generic
  // celebrations apply.
  if (subject.kind === 'pet' || subject.kind === 'other') {
    return [...PERSON_ONLY_TYPES];
  }

  // A person alaga with nothing on file: unmeasurable → fail open.
  if (!subject.birthDate) return [];

  const hidden = new Set(
    hiddenMeasuredTypes(
      [{ birth_date: subject.birthDate, sex: subject.sex } as ConcernPerson],
      todayISO,
    ),
  );

  // The one hard fact a stored birthdate settles: a child cannot be married.
  // This is a legal floor, not a preference — and it is still only a fold, since
  // "show all" remains one tap away for the aunt planning someone else's day.
  const birth = parseISO(subject.birthDate);
  const today = parseISO(todayISO);
  if (birth && today && yearsBetween(birth, today) < MARRIAGE_AGE_FLOOR) {
    hidden.add('wedding');
  }

  return [...hidden];
}

/**
 * What the type grid should fold away, given the answer to "para kanino?".
 *
 * `accountHidden` is the page's existing HOUSEHOLD measurement (owner
 * 2026-07-17 — computed from every person alaga on the account). It stays
 * authoritative for the two answers that carry no data of their own, so the
 * grid a user sees for "You" / "Someone else" is byte-identical to today's.
 * A named alaga is strictly more precise than the household, so it replaces it.
 */
export function gridHiddenTypes(
  subject: CreateSubject | null,
  accountHidden: readonly string[],
  todayISO: string,
): string[] {
  // No usable clock ⇒ no per-subject measurement. Falling through would make
  // every date comparison fail and read as "nothing concerns them", i.e. it
  // would fold away MORE, not less — the wrong direction to fail in.
  if (!subject || !todayISO || subject.kind === 'self' || subject.kind === 'unspecified') {
    return [...accountHidden];
  }
  return hiddenTypesForSubject(subject, todayISO);
}

/**
 * The honoree first name to carry forward for this subject — the key the
 * one-in-planning life-event cap counts on (`events.honoree_label`).
 *
 * '' for BOTH `self` and `unspecified`, and that is load-bearing: the unlabeled
 * slot has always meant "the account holder", so stamping your own name here
 * would silently open a SECOND slot beside every event you already created
 * unlabeled. Picking "You" must key exactly like today.
 */
export function subjectHonoreeLabel(subject: CreateSubject | null): string {
  if (!subject) return '';
  if (subject.kind === 'self' || subject.kind === 'unspecified') return '';
  return subject.name.trim().slice(0, 80);
}

/** Row shape of the counsel-gated `dependents` read this module consumes. */
export type DependentSubjectRow = {
  dependent_id: string;
  name: string | null;
  dependent_kind: string | null;
  birth_date: string | null;
  sex: string | null;
  claimed_user_id?: string | null;
  handed_over_at?: string | null;
};

const KIND_SUBTITLE: Record<string, string> = {
  person: 'Alaga · person',
  pet: 'Alaga · pet',
  other: 'Alaga · something you care for',
};

/**
 * Turn the alaga rows into subjects. Rows with no name are DROPPED rather than
 * labelled "Unnamed" — a row we cannot name is a row we cannot honestly offer.
 * Records the viewer has already handed over (or claimed as their own profile)
 * are dropped too: they are no longer an alaga of this account.
 */
export function dependentSubjects(
  rows: readonly DependentSubjectRow[] | null | undefined,
  viewerUserId: string | null,
): CreateSubject[] {
  if (!rows) return [];
  const out: CreateSubject[] = [];
  for (const row of rows) {
    const name = (row.name ?? '').trim();
    if (!name) continue;
    if (row.handed_over_at) continue;
    if (viewerUserId && row.claimed_user_id === viewerUserId) continue;
    const rawKind = row.dependent_kind ?? 'person';
    const kind: CreateSubjectKind =
      rawKind === 'pet' ? 'pet' : rawKind === 'other' ? 'other' : 'person';
    out.push({
      id: row.dependent_id,
      kind,
      name,
      subtitle: KIND_SUBTITLE[rawKind] ?? KIND_SUBTITLE.person!,
      // Sensitive fields are read only for the PERSON case, mirroring
      // dependent-actions.ts (a pet has no sex, and its birthday narrows nothing).
      birthDate: kind === 'person' ? row.birth_date : null,
      sex: kind === 'person' && (row.sex === 'female' || row.sex === 'male') ? row.sex : null,
    });
  }
  return out;
}

/**
 * The "You" row. `displayName` is `users.display_name` — when it is blank we say
 * "You" rather than inventing a name from an email local-part.
 */
export function buildSelfSubject(displayName: string | null | undefined): CreateSubject {
  const name = (displayName ?? '').trim();
  return {
    id: SELF_SUBJECT_ID,
    kind: 'self',
    name: name || 'You',
    subtitle: 'Your own celebration',
    birthDate: null,
    sex: null,
  };
}

/** The always-present escape hatch: nobody named, nothing sorted. */
export function buildUnspecifiedSubject(): CreateSubject {
  return {
    id: UNSPECIFIED_SUBJECT_ID,
    kind: 'unspecified',
    name: 'Someone else',
    subtitle: 'Or nobody in particular — show me everything',
    birthDate: null,
    sex: null,
  };
}
