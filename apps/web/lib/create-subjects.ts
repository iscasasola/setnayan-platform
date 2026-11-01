/**
 * create-subjects.ts — WHO the event is for, asked BEFORE what kind it is.
 *
 * Sixteen type tiles is a wall; the same sixteen sorted around one named person
 * is a short, obvious list. So the grid is sorted around WHO the event is for —
 * a pet has no debut, a six-year-old has no wedding.
 *
 * 🔁 NO LONGER A STEP OF ITS OWN (owner 2026-10-22, "Yes to all" — Host 3
 * option B, prototype journey_fixes_2026-10-22.html). "Para kanino ito?" asked
 * first, a whole screen, before the real question. Now the grid opens FIRST,
 * sorted for the account holder (`openingSubject`), and the who becomes a
 * "For · You ▾" dropdown above it ONLY when there is a real choice — a loved
 * one on file (`forMenuSubjects`). With none, nothing is drawn: "someone else"
 * was always the grid's own "show all event types".
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
  | 'unspecified'
  /** "Someone who passed away" (owner 2026-10-26: "wake is if your declared
   *  passed away. so the event you can only make is anniversary or wake/funeral").
   *  Nobody on file — the name is asked downstream, as for "someone else". */
  | 'memorial'
  /** One of the account's own GROUPS (People › Groups — a samahan this person
   *  organizes). Owner 2026-10-28, DECISION_LOG "EVENT TYPES MUST BE SPECIFIC":
   *  picking it makes the event belong to that group (`events.community_id`, the
   *  shipped samahan create path) and narrows the tiles to the types a group may
   *  hold (`event_type_profiles.event_class = 'community_eligible'`). */
  | 'group';

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
  /**
   * Only on the generic "A business" row (`BUSINESS_SUBJECT_ID`): the account's
   * own shop name when it has one — the honoree a business event is filled in
   * with. NULL = no shop → the business name is asked downstream.
   */
  shopName?: string | null;
  /** Only on a GROUP row: the `communities.community_id` the event will belong to. */
  communityId?: string;
  /** Only on a GROUP row: how many people are in it, when that count was read. */
  memberCount?: number | null;
};

export const SELF_SUBJECT_ID = 'self';
export const UNSPECIFIED_SUBJECT_ID = 'unspecified';
export const MEMORIAL_SUBJECT_ID = 'memorial';
/** The generic "A business" row — NOT a `dependents` record (that row's id is a uuid). */
export const BUSINESS_SUBJECT_ID = 'business';
/** A group row's id is this prefix + its `community_id` — never a bare uuid, so it cannot collide with an alaga. */
export const GROUP_SUBJECT_PREFIX = 'group:';

/**
 * ── WHO A TYPE CAN BE FOR (owner 2026-10-26) ────────────────────────────────
 *
 * Owner, verbatim: *"if i click for you, and it i don't have a debut, it should
 * not show. same concept to the christening, wake, and whatever is not needed for
 * that person … If it is for a business, only business related events or whatever
 * applies. For someone else, shows everything."* · *"wake is if your declared
 * passed away. so the event you can only make is anniversary or wake/funeral."*
 *
 * 🔑 ONE SOURCE: the rule is DATA — `event_type_vocab.for_whom`, admin-edited on
 * Admin › Categories › Event types — carried on each `EventTypeRow.forWhom`. This
 * module only maps the "For ▾" answer to one of its four words and compares. No
 * event-type key is named here for this rule.
 */
export const FOR_WHOM_MODES = ['self', 'someone', 'memorial', 'business'] as const;
export type ForWhomMode = (typeof FOR_WHOM_MODES)[number];

/** The four words as Admin › Event types prints them ("Who it's for"). */
export const FOR_WHOM_LABELS: Readonly<Record<ForWhomMode, string>> = {
  self: 'For you',
  someone: 'Someone else',
  memorial: 'Someone who passed away',
  business: 'A business',
};

/** Keep only known words, in their canonical order, once each. */
export function cleanForWhom(values: readonly unknown[]): ForWhomMode[] {
  return FOR_WHOM_MODES.filter((m) => values.includes(m));
}

/** The rule word a "For ▾" answer reads. A pet / a car / "something you care
 *  for" is "someone" (living, not you); the person-only fold below still applies. */
export function forWhomModeOf(subject: CreateSubject): ForWhomMode {
  switch (subject.kind) {
    case 'self':
      return 'self';
    case 'memorial':
      return 'memorial';
    case 'business':
      return 'business';
    default:
      return 'someone';
  }
}

/**
 * The type keys the DB rule folds away for this answer. A type whose `forWhom` is
 * unknown (NULL — the fallback roster, a row read before the column existed) is
 * never folded: unknown fails OPEN. No subject (samahan, the QR fast-lane) folds
 * nothing.
 */
export function forWhomHiddenTypes(
  types: ReadonlyArray<{ key: string; forWhom?: readonly string[] | null }>,
  subject: CreateSubject | null,
): string[] {
  if (!subject) return [];
  // A GROUP is not one of the four words — what a group may hold is its own rule
  // (`groupHiddenTypes`, the event class), so the for_whom rule folds nothing here.
  if (subject.kind === 'group') return [];
  const mode = forWhomModeOf(subject);
  return types
    .filter((t) => Array.isArray(t.forWhom) && !t.forWhom.includes(mode))
    .map((t) => t.key);
}

/**
 * What a GROUP may not hold (owner 2026-10-28: "groups … narrows the tiles to
 * group-suitable types"). `groupTypeKeys` = the types whose profile is
 * `community_eligible` — the SAME rule the shipped `?samahan=` page filters by and
 * the create action re-checks (`samahan_invalid_type`). Every other type is folded.
 * Not a group, or no list handed in → folds nothing (unknown fails open; the server
 * still refuses a personal type for a group).
 */
export function groupHiddenTypes(
  types: ReadonlyArray<{ key: string }>,
  subject: CreateSubject | null,
  groupTypeKeys: readonly string[] | null | undefined,
): string[] {
  if (!subject || subject.kind !== 'group' || !groupTypeKeys) return [];
  return types.filter((t) => !groupTypeKeys.includes(t.key)).map((t) => t.key);
}

/**
 * "Show all event types" — the doorway under the grid — is drawn for a person, never
 * for a business or a group (owner 2026-10-28: "business types only"; a group may
 * never own a personal milestone, owner lock 2026-07-15). "Can't find yours? Ask us
 * to add it" is their way out instead.
 */
export function subjectMayShowAll(subject: CreateSubject | null): boolean {
  return !subject || (subject.kind !== 'business' && subject.kind !== 'group');
}

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
  if (subject.kind === 'unspecified' || subject.kind === 'memorial') return [];
  // A group has no milestone ladder; its own rule (`groupHiddenTypes`) is the whole answer.
  if (subject.kind === 'group') return [];
  // The generic "A business" row: the DB rule (`forWhomHiddenTypes`) is the whole
  // answer for it — nothing to measure.
  if (subject.id === BUSINESS_SUBJECT_ID) return [];

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
  // "Someone who passed away" has no milestone ladder to measure; the DB rule
  // alone decides what shows for it.
  if (subject.kind === 'memorial' || subject.kind === 'group') return [];
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
  if (subject.kind === 'self' || subject.kind === 'unspecified' || subject.kind === 'memorial' || subject.kind === 'group') return '';
  // The generic business row is filled with the account's OWN shop name (owner
  // 2026-10-26: "If it is for a business …") — or asked, when there is none.
  if (subject.id === BUSINESS_SUBJECT_ID) return (subject.shopName ?? '').trim().slice(0, 80);
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
  if (subject.kind === 'self' || subject.kind === 'unspecified' || subject.kind === 'memorial' || subject.kind === 'group') return null;
  // The generic business row is not a `dependents` record — its id is a word.
  if (subject.id === BUSINESS_SUBJECT_ID) return null;
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
  person: 'Loved one · person',
  pet: 'Loved one · pet',
  business: 'Loved one · business',
  item: 'Loved one · something you own',
  other: 'Loved one · something you care for',
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
    subtitle: 'Your own event',
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

/** "Someone who passed away" — the only answer that offers a wake (the DB rule). */
export function buildMemorialSubject(): CreateSubject {
  return {
    id: MEMORIAL_SUBJECT_ID,
    kind: 'memorial',
    name: 'Someone who passed away',
    subtitle: 'A wake, or remembering them',
    birthDate: null,
    sex: null,
  };
}

/**
 * The generic "A business" row. `shopName` = the account's own shop, when it has
 * one: the event is then filled in under it, never asked.
 */
export function buildBusinessSubject(shopName?: string | null): CreateSubject {
  const shop = (shopName ?? '').trim().slice(0, 80) || null;
  return {
    id: BUSINESS_SUBJECT_ID,
    kind: 'business',
    name: shop ?? 'A business',
    subtitle: 'Business events only',
    birthDate: null,
    sex: null,
    shopName: shop,
  };
}

/** One of the account's groups (`fetchUserCommunities`, organizer rows only — only an organizer may plan its events). */
export function buildGroupSubject(group: { communityId: string; name: string; memberCount?: number | null }): CreateSubject {
  const n = typeof group.memberCount === 'number' && group.memberCount > 0 ? group.memberCount : null;
  return {
    id: `${GROUP_SUBJECT_PREFIX}${group.communityId}`,
    kind: 'group',
    name: group.name.trim().slice(0, 80) || 'Your group',
    subtitle: n ? `Group · ${n} ${n === 1 ? 'member' : 'members'}` : 'Group',
    birthDate: null,
    sex: null,
    communityId: group.communityId,
    memberCount: n,
  };
}

/**
 * The whole "For ▾" roster, in its order: You · every loved one on file ·
 * Someone else · your groups · A business · Someone who passed away.
 *
 * "A business" is drawn ONCE: when a shop's business alaga is already on file
 * (lib/business-alaga.ts) it IS the business row — a second, generic one would be
 * the same shop twice.
 */
export function buildCreateRoster(
  self: CreateSubject,
  alaga: readonly CreateSubject[],
  shopName?: string | null,
  groups: readonly CreateSubject[] = [],
): CreateSubject[] {
  const businessAlaga = alaga.filter((s) => s.kind === 'business');
  return [
    self,
    ...alaga.filter((s) => s.kind !== 'business'),
    buildUnspecifiedSubject(),
    // 👥 YOUR GROUPS (owner 2026-10-28) — the account's REAL groups, between the people and the business.
    ...groups.filter((s) => s.kind === 'group'),
    // A shop's business alaga IS the business row; the generic one is drawn only without it.
    ...(businessAlaga.length > 0 ? businessAlaga : [buildBusinessSubject(shopName)]),
    buildMemorialSubject(),
  ];
}

/**
 * The heading a row sits under in the open "For ▾" list (prototype
 * who_is_it_for_2026-10-28 frame A): no heading for You / your loved ones / Someone
 * else · "Your groups" · "Your business" · and a plain divider ('') before "Someone
 * who passed away".
 */
export function forMenuGroup(subject: CreateSubject): string | undefined {
  if (subject.kind === 'group') return 'Your groups';
  if (subject.kind === 'business') return 'Your business';
  if (subject.kind === 'memorial') return '';
  return undefined;
}

/**
 * The subject the type grid OPENS on (owner 2026-10-22, Host 3 option B): "You" — the grid first, sorted for the
 * account holder. No "You" in the roster (no roster at all: samahan, a QR fast-lane, signed out) → null, and the
 * grid is exactly the household reading it always was.
 */
export function openingSubject(subjects: readonly CreateSubject[] | null | undefined): CreateSubject | null {
  return (subjects ?? []).find((s) => s.kind === 'self') ?? null;
}

/**
 * The "For · You ▾" dropdown's rows — or null, which means DRAW NOTHING. A dropdown appears exactly when the old
 * step had more than its two fixed rows: a loved one on file. "You" and "Someone else" alone are not a choice the
 * grid needs ("someone else" is its "show all event types").
 */
export function forMenuSubjects(subjects: readonly CreateSubject[] | null | undefined): CreateSubject[] | null {
  const all = [...(subjects ?? [])];
  // 🔁 ALWAYS A CHOICE NOW (owner 2026-10-26): "For you" folds what cannot be
  // yours, so "Someone else" / "A business" / "Someone who passed away" are real
  // answers whether or not a loved one is on file. Only a roster with nothing but
  // "You" in it (or none at all) draws nothing.
  return all.some((s) => s.kind !== 'self') ? all : null;
}

/** A row's words in the dropdown: the account holder is "You" (the prototype's row), everyone else their name. */
export function forMenuLabel(subject: CreateSubject): string {
  return subject.kind === 'self' ? 'You' : subject.name;
}

/**
 * The celebrant name "For you" fills in (owner 2026-10-26: "if it is for you, the
 * name of the celebrant should automatically be me"). The account's own display
 * name; '' when it has none — never an email local-part. Shown and carried as the
 * celebrant's NAME only: the cap's key (`subjectHonoreeLabel`) stays '' for "You".
 */
export function selfCelebrantName(subject: CreateSubject | null): string {
  if (!subject || subject.kind !== 'self') return '';
  return subject.name === 'You' ? '' : subject.name.trim().slice(0, 80);
}

/** The line under a row: "Your own event" · the shipped "Loved one · …" · "Show me everything". */
export function forMenuHint(subject: CreateSubject): string {
  if (subject.kind === 'unspecified') return 'A living person — every event';
  if (subject.kind === 'business') return 'Business events only';
  return subject.subtitle;
}

/** The line under the CLOSED "For ▾" row — a group says where the event will show (prototype frame B). */
export function forTriggerHint(subject: CreateSubject): string {
  if (subject.kind === 'group') return 'Group · members see it in the group';
  return forMenuHint(subject);
}

/** The `community_id` a picked subject makes the event belong to — a group row only. */
export function subjectCommunityId(subject: CreateSubject | null): string | undefined {
  return subject?.kind === 'group' && subject.communityId ? subject.communityId : undefined;
}
