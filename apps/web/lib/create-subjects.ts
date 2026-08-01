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
 * ⚠ NO BIRTHDATE IS EVER ASKED OR STORED HERE — this module only READS dates
 * that already exist, to sort a picker. Two sources, both already on file:
 *  - an alaga's (`dependents.birth_date`, counsel-gated behind
 *    NEXT_PUBLIC_DEPENDENT_PEOPLE + the `dependent_minor_profiles` control), and
 *  - the account holder's own (`users.birth_date`, which they set themselves on
 *    /dashboard/profile). Owner-directed 2026-07-30: "their birthdays shows
 *    based from their account… only for their own account and their dependents".
 *    Reading your OWN date, for your OWN picker, disclosed to nobody, is the
 *    narrowest possible use of it.
 * A subject with no birthdate on file narrows nothing — fail OPEN, per subject,
 * exactly like hiddenMeasuredTypes.
 *
 * ⚠ AND IT MUST STAY A READ. Nothing here may put a birthdate ON an event —
 * that is the counsel gate enforced in lib/onboarding/event-insert.ts. This
 * module returns event-type KEYS and an honoree label, never a date.
 *
 * Pure + I/O-free so both the server page and the client picker can import it.
 */
import { hiddenMeasuredTypes, type ConcernPerson } from './life-event-gate';
import { parseISO, yearsBetween } from './event-anchor';
import { DEPENDENT_KINDS, type DependentKind } from './dependent-people';

/**
 * What kind of thing the celebration is for.
 *  - `self`        — the account holder, measured from `users.birth_date` when
 *                    they have set one (owner 2026-07-30). No date on file → the
 *                    grid stays exactly as whole as it shipped.
 *  - `person`      — an alaga who is a person (may carry a stored birthdate).
 *  - `pet` / `business` / `item` / `other` — an alaga with no milestone ladder
 *                    (a dog, a sari-sari store, a car).
 *                    `dependents.dependent_kind` verbatim.
 *  - `unspecified` — "someone else" / "just an event": we deliberately know
 *                    nothing, so we sort nothing.
 */
export type CreateSubjectKind =
  | 'self'
  | 'person'
  | 'pet'
  | 'business'
  | 'item'
  | 'other'
  | 'unspecified';

export type CreateSubject = {
  /** 'self' · 'unspecified' · else the alaga's `dependent_id`. */
  id: string;
  kind: CreateSubjectKind;
  /** What to call them on screen. Never fabricated — see buildSelfSubject. */
  name: string;
  /** One line under the name (e.g. "Alaga · person"). */
  subtitle: string;
  /**
   * ISO birthdate. Only ever a date ALREADY on file: a person alaga's
   * (`dependents.birth_date`) or the account holder's own (`users.birth_date`).
   * A pet/business/item never carries one here — its date narrows nothing.
   */
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

  // "Someone else" is by definition unmeasured — an unnamed person tells us
  // nothing, so we sort nothing.
  if (subject.kind === 'unspecified') return [];

  // A pet / a business / a car has no milestone ladder — only the generic
  // celebrations apply. Derived from "not a person" rather than a list of kinds:
  // spelling them out is what stranded the rehome path when the vocabulary grew.
  // (`self` is excluded here — the account holder is a person.)
  if (subject.kind !== 'self' && subject.kind !== 'person') {
    return [...PERSON_ONLY_TYPES];
  }

  // Nothing on file — for an alaga OR for you — is unmeasurable → fail open.
  // This is the branch every account without a saved birthday takes, so "You"
  // keeps the byte-identical whole grid it has always had.
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
 * authoritative for the answers that carry no data of their own, so the grid a
 * user sees is byte-identical to today's whenever we know nothing new. Any
 * subject with a date ON FILE is strictly more precise than the household, so it
 * replaces it — and that now includes "You" (owner 2026-07-30), whose date is
 * `users.birth_date`.
 */
export function gridHiddenTypes(
  subject: CreateSubject | null,
  accountHidden: readonly string[],
  todayISO: string,
): string[] {
  // No usable clock ⇒ no per-subject measurement. Falling through would make
  // every date comparison fail and read as "nothing concerns them", i.e. it
  // would fold away MORE, not less — the wrong direction to fail in.
  if (!subject || !todayISO || subject.kind === 'unspecified') {
    return [...accountHidden];
  }
  // "You" with no saved birthday measures nothing of its own, so the household
  // reading stays authoritative — exactly the shipped behaviour, and the path
  // every account with a blank profile birthday still takes.
  if (subject.kind === 'self' && !subject.birthDate) {
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

/**
 * The `dependents` row this subject IS, for `events.honoree_dependent_id` — the
 * cardinality key that beats the label (lib/life-event-gate.ts).
 *
 * NULL for BOTH `self` and `unspecified`, mirroring subjectHonoreeLabel: "You"
 * is not a dependent row (the account holder is a `users` row), and "someone
 * else" is by definition nobody on file. A named alaga's `id` IS its
 * `dependent_id` (see dependentSubjects) — that is the whole point of carrying
 * it: a link to a RECORD survives renaming the alaga, and two alaga who happen
 * to share a first name stop sharing one in-planning slot.
 *
 * ⚠ This is a CLIENT-side value and is therefore a CLAIM, not a fact — the
 * server re-verifies ownership before writing it
 * (lib/honoree-dependent-link.ts). Never write what this returns directly.
 */
export function subjectHonoreeDependentId(subject: CreateSubject | null): string | null {
  if (!subject) return null;
  if (subject.kind === 'self' || subject.kind === 'unspecified') return null;
  return subject.id || null;
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
  business: 'Alaga · business',
  item: 'Alaga · something you own',
  other: 'Alaga · something you care for',
};

/**
 * The alaga kinds a subject may take — `DEPENDENT_KINDS` minus nothing, plus the
 * guarantee that they are all valid `CreateSubjectKind`s. Kept as one derived
 * check so a widened DB vocabulary reaches the picker without another edit here.
 */
const SUBJECT_ALAGA_KINDS = new Set<string>(DEPENDENT_KINDS);

function isSubjectAlagaKind(v: string): v is Extract<CreateSubjectKind, DependentKind> {
  return SUBJECT_ALAGA_KINDS.has(v);
}

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
    // An UNKNOWN kind falls back to 'person' on purpose: person is the column
    // default and the legacy pre-`dependent_kind` value, and it is the stricter
    // reading (it keeps the human-only types on offer rather than folding them
    // away for a row we simply failed to recognise).
    const rawKind = row.dependent_kind ?? 'person';
    const kind: CreateSubjectKind = isSubjectAlagaKind(rawKind) ? rawKind : 'person';
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
 * The account holder's own profile row, as this module needs it. `display_name`
 * is deliberately NOT here — it stays the first argument, so a caller cannot
 * pass a name in this object and quietly have it ignored.
 */
export type SelfProfile = {
  /** `users.birth_date` — set by the account holder on /dashboard/profile. */
  birth_date?: string | null;
  /** `users.sex` — only ever used to pick 18F/21M on the debut ladder. */
  sex?: string | null;
};

/**
 * The "You" row. `displayName` is `users.display_name` — when it is blank we say
 * "You" rather than inventing a name from an email local-part.
 *
 * `profile` carries the account holder's OWN saved birthday (owner-directed
 * 2026-07-30: "their birthdays shows based from their account"). It is optional
 * and NULL-tolerant on purpose — an account that never filled in a birthday is
 * unmeasurable and gets exactly the whole grid it gets today. Passing it is a
 * READ, used only to sort this picker; no date leaves this module.
 */
export function buildSelfSubject(
  displayName: string | null | undefined,
  profile?: SelfProfile | null,
): CreateSubject {
  const name = (displayName ?? '').trim();
  const rawBirth = (profile?.birth_date ?? '').trim();
  // Only an ISO yyyy-mm-dd is measurable; anything else narrows nothing rather
  // than being coerced into a date we would then sort by.
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(rawBirth) ? rawBirth : null;
  const sex = profile?.sex === 'female' || profile?.sex === 'male' ? profile.sex : null;
  return {
    id: SELF_SUBJECT_ID,
    kind: 'self',
    name: name || 'You',
    subtitle: 'Your own celebration',
    birthDate,
    sex,
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
