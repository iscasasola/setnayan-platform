/**
 * event-anchor.ts — the date-anchor derivation engine.
 *
 * The deterministic, dependency-free half of the date-anchor model
 * (Event_Anchor_Minimalist_Setup_Design_2026-07-12.md). Anchors turn one-off
 * events into a recurring family relationship: store an anchor date once, and
 * these PURE functions derive every future occurrence — next birthday, the Nth
 * anniversary, the 18th debut, the milestone ladder — at read time.
 *
 * Rule 1 (owner-locked 2026-07-12): Setnayan AI is 100% deterministic and FREE
 * — no LLM, no per-call cost, no scheduler. Recurrence is DERIVED here, never
 * an RRULE engine and never an auto-created row (the Year view calls these to
 * render "moments"; an event exists only on the user's go-signal tap).
 *
 * PRIVACY: every function takes dates as ARGUMENTS. This module stores nothing
 * and knows nothing about who a date belongs to. The dependent People layer
 * (stored minors' birthdates) is a separate, counsel-gated build (PR-D); the
 * milestone helpers below compute over a caller-supplied birthdate so the
 * engine is ready without holding any PII itself.
 *
 * All date math is UTC to avoid timezone drift; dates are ISO 'YYYY-MM-DD'.
 */

export type AnchorKind =
  | 'person_birthdate'
  | 'union_date'
  | 'expected_due_date'
  | 'fixed_date'
  | 'date_range'
  | 'calendar_holiday'
  | 'none';

export type DateModel = 'input' | 'output';

/** Reminder scale — drives the authored lead-time ladder (§ 4c). */
export type NudgeTier = 'grand' | 'milestone' | 'standard' | 'light' | 'season' | 'none';

export type TypeAnchorDefault = { kind: AnchorKind; dateModel: DateModel };

/**
 * Per-type anchor defaults — the AUTHORED SOURCE OF TRUTH (council Conflict-E
 * ruling: "pure map first; promote to a vocab/profile column only when admin-
 * editability is actually needed"). The create-event server action stamps
 * events.anchor_kind from this map at insert; the migration adds no vocab column.
 */
export const ANCHOR_BY_TYPE: Record<string, TypeAnchorDefault> = {
  wedding: { kind: 'none', dateModel: 'output' },
  anniversary: { kind: 'union_date', dateModel: 'input' },
  debut: { kind: 'person_birthdate', dateModel: 'input' },
  birthday: { kind: 'person_birthdate', dateModel: 'input' },
  christening: { kind: 'person_birthdate', dateModel: 'output' },
  gender_reveal: { kind: 'expected_due_date', dateModel: 'input' },
  travel: { kind: 'date_range', dateModel: 'input' },
  graduation: { kind: 'fixed_date', dateModel: 'input' },
  reunion: { kind: 'fixed_date', dateModel: 'input' },
  corporate: { kind: 'fixed_date', dateModel: 'input' },
  tournament: { kind: 'date_range', dateModel: 'input' },
  gala_night: { kind: 'fixed_date', dateModel: 'input' },
  celebration: { kind: 'fixed_date', dateModel: 'input' },
  simple_event: { kind: 'fixed_date', dateModel: 'input' },
  date: { kind: 'fixed_date', dateModel: 'input' },
  hangout: { kind: 'fixed_date', dateModel: 'input' },
};

/** Unknown/admin-created types fall back to a chosen fixed date. */
export const FALLBACK_ANCHOR: TypeAnchorDefault = { kind: 'fixed_date', dateModel: 'input' };

/**
 * Anniversary typed origins — WHAT a recurring memorable date celebrates.
 * POSITIVE, TYPED origins only (the DB CHECK on events.anchor_origin enforces
 * the same set): no memorial/death option, so generalized anniversaries can't
 * backdoor babang-luksa (burial retirement 2026-05-16).
 *
 * 🔴 `'matters'` ("A date that matters to us") WAS HERE AND IS RETIRED
 * 2026-08-15. The 2026-07-12 flow-check council ruled it out in writing — *"A
 * user can enter a parent's death anniversary; #3176 then fires an annual
 * reminder = a death-anniversary tracker, exactly what 2026-05-16 killed …
 * Label-only guardrails don't hold."* — the owner accepted it, and it never
 * reached the code: the CHECK still admitted it, this constant still carried it,
 * and two screens still offered it. A per-event repeat CADENCE is the widening
 * that makes it live, so it goes in the same change. Prod had zero rows using
 * it. **Do not re-add it — the guardrail has to be the absence of the option.**
 */
export const ANCHOR_ORIGINS = ['wedding', 'relationship', 'milestone'] as const;
export type AnchorOrigin = (typeof ANCHOR_ORIGINS)[number];

/** Human labels for the typed-origin picker (§ 3b of the setup design). */
export const ANCHOR_ORIGIN_LABELS: Record<AnchorOrigin, string> = {
  wedding: 'Our wedding',
  relationship: 'Our relationship',
  milestone: 'A milestone we’re proud of',
};

export function isAnchorOrigin(v: unknown): v is AnchorOrigin {
  return typeof v === 'string' && (ANCHOR_ORIGINS as readonly string[]).includes(v);
}

/**
 * Types that ASK whether this repeats — everything that CAN repeat and is not
 * forced to.
 *
 * 🔑 DERIVED FROM `CADENCES_BY_TYPE`, NOT HAND-MAINTAINED BESIDE IT. It used to
 * be a literal list, and a second literal list in `event-recurrence.ts` gave a
 * different answer for the same question; that divergence is what let a birthday
 * created one way never appear on the Year view. A derived list cannot drift
 * from the map it is derived from.
 *
 * (Definition lives below `CADENCES_BY_TYPE` for ordering; see `canToggleRecur`.)
 */
export function canToggleRecur(eventType: string | null | undefined): boolean {
  // The create-time control is a YES/NO box labelled "Make it a yearly thing",
  // so it may only be offered where ANNUAL is actually on the ladder. `date` and
  // `hangout` can repeat (weekly/monthly) but not yearly — they are set from the
  // Personalization picker instead, never from a box that promises a year.
  return (
    canRepeat(eventType) &&
    !cadenceIsForced(eventType) &&
    cadencesForType(eventType).includes('annual')
  );
}

// ── HOW OFTEN — the cadence ladder (owner 2026-08-15) ───────────────────────

/**
 * The five cadences. Ordered coarsest-last so a UI can render them in this
 * order and a comparison reads naturally.
 */
export const RECUR_CADENCES = ['weekly', 'monthly', 'quarterly', 'semestral', 'annual'] as const;
export type RecurCadence = (typeof RECUR_CADENCES)[number];

export function isRecurCadence(v: unknown): v is RecurCadence {
  return typeof v === 'string' && (RECUR_CADENCES as readonly string[]).includes(v);
}

/** What each cadence is called on screen — the Year view's existing register. */
export const CADENCE_LABELS: Record<RecurCadence, string> = {
  weekly: 'Every week',
  monthly: 'Every month',
  quarterly: 'Every 3 months',
  semestral: 'Every 6 months',
  annual: 'Every year',
};

/**
 * WHICH CADENCES EACH EVENT TYPE MAY USE — the ONE per-type map.
 *
 * ── 🔴 IT REPLACES THREE LISTS THAT DISAGREED WITH EACH OTHER ───────────────
 * Before this, "can this repeat?" had three different answers in three files:
 *   · RECUR_TOGGLE_TYPES (above)          — 6 types get asked at creation
 *   · RECURRENCE_CAPABLE_TYPES            — 4 types get the "Plan next year" button
 *   · the create/onboarding actions       — force birthday + anniversary true
 * Only `reunion` and `corporate` were in both lists. **Birthday was in one and
 * not the other, and that is a live defect**: a birthday created from the
 * create-event grid gets `recurs = false`, so the Year view's birthday branch
 * (`event_type === 'birthday' && e.recurs`) never fires and that person's
 * birthday never appears — while the onboarding path sets it true for the same
 * type. Same event, two answers.
 *
 * The owner's *"only choose events that this can work"* is a request to make
 * ONE list, not a fourth. `RECUR_TOGGLE_TYPES` is now DERIVED from this map
 * (below) rather than hand-maintained beside it.
 *
 * ── HOW A ROW IS DECIDED ────────────────────────────────────────────────────
 * By what the type IS, not by taste:
 *   · An empty list means the thing happens ONCE. A wedding does not repeat —
 *     it PRODUCES an anniversary; offering it a repeat offers a second wedding.
 *     A debut, a christening, a gender reveal and a graduation are each one per
 *     person or one per pregnancy.
 *   · `annual` alone is for a date that IS the return of one date. Owner:
 *     "Birthday, anniversary can only be annual."
 *   · The full ladder is only honest where sub-annual instances are really the
 *     same event: a corporate standup/townhall/kickoff/review/conference, and
 *     the untyped `simple_event`, which is where "reminder app" actually lives.
 *   · `weekly` is offered on FOUR types only. Weekly plus a reminder email is
 *     how this feature becomes spam, and the corpus already carries an
 *     anti-nagging ruling (2026-07-12: never nag annually on ordinary years).
 *
 * ⚠ DEFAULT IS ALWAYS OFF where a choice exists. A repeat the person did not
 * ask for is a repeat they will resent. `annual` is FORCED only where the type
 * is definitionally a return.
 *
 * ⚠ A TYPE MISSING FROM THIS MAP CANNOT REPEAT. That is the safe direction: an
 * admin can add an event type at runtime (`event_type_vocab` is dynamic), and a
 * new type silently gaining a weekly email would be worse than one that has to
 * be added here deliberately. `event-type-coverage.test.ts` pins the 16 live
 * types so a new one is a conversation, not a surprise.
 */
export const CADENCES_BY_TYPE: Record<string, readonly RecurCadence[]> = {
  // Happens once. Empty on purpose — see the docblock.
  wedding: [],
  debut: [],
  christening: [],
  gender_reveal: [],
  graduation: [],

  // Definitionally the return of one date (owner-locked).
  anniversary: ['annual'],
  birthday: ['annual'],

  // A season is a quarter or a half; a weekly tournament is a league fixture,
  // which this model does not represent.
  tournament: ['quarterly', 'semestral', 'annual'],
  // Family and school reunions are annual, occasionally twice-yearly.
  reunion: ['semestral', 'annual'],
  // A gala is a once-a-year set-piece; a monthly gala is not a gala.
  gala_night: ['annual'],
  // A trip is a date RANGE; sub-annual travel is an itinerary, a different
  // product. Owner already ruled "travel can be annual or one-time".
  travel: ['annual'],
  // The catch-all for anything worth marking. Monthly is the floor — below that
  // it stops being a celebration and becomes a chore, which simple_event is for.
  celebration: ['monthly', 'quarterly', 'semestral', 'annual'],

  // The full ladder, and the only two rows where it is honest.
  corporate: ['weekly', 'monthly', 'quarterly', 'semestral', 'annual'],
  simple_event: ['weekly', 'monthly', 'quarterly', 'semestral', 'annual'],

  // "Date night" and a barkada standing meet-up are the canonical weekly-or-
  // monthly human things. Anything yearly here is an anniversary.
  date: ['weekly', 'monthly'],
  hangout: ['weekly', 'monthly'],
};

/** The cadences this type may use — empty means it cannot repeat at all. */
export function cadencesForType(eventType: string | null | undefined): readonly RecurCadence[] {
  if (!eventType) return [];
  return CADENCES_BY_TYPE[eventType] ?? [];
}

/** TRUE when this type can repeat at all (at any cadence). */
export function canRepeat(eventType: string | null | undefined): boolean {
  return cadencesForType(eventType).length > 0;
}

/**
 * Types whose repeat is NOT a choice — they return by definition, so nothing is
 * asked and the answer cannot be turned off.
 *
 * ⚠ THIS IS SEPARATE FROM "only one cadence is allowed", AND CONFLATING THEM IS
 * A REAL BUG I WROTE AND CAUGHT. Deriving "forced" from `cadences.length === 1`
 * reads travel and gala_night — both `['annual']`, meaning *if* it repeats it is
 * yearly — as ALWAYS repeating, which would have quietly turned every one-off
 * trip into an annual one. "Which cadences are legal" and "does it repeat at
 * all" are two questions and need two answers.
 */
export const FORCED_RECUR_TYPES = ['anniversary', 'birthday'] as const;

/**
 * TRUE when the repeat is definitional: no picker, no off switch, and the single
 * legal cadence is the answer.
 */
export function cadenceIsForced(eventType: string | null | undefined): boolean {
  return !!eventType && (FORCED_RECUR_TYPES as readonly string[]).includes(eventType);
}

/**
 * The cadence to store for this type, given what (if anything) the person chose.
 *
 * 🔑 ONE FUNCTION DECIDES, so the create path, the onboarding path and the edit
 * path cannot disagree — which is exactly how the birthday defect happened.
 * Returns null when the type cannot repeat, so a caller that also writes
 * `recurs` has a single source for both halves.
 */
export function resolveCadence(
  eventType: string | null | undefined,
  chosen: unknown,
): RecurCadence | null {
  const allowed = cadencesForType(eventType);
  if (allowed.length === 0) return null; // cannot repeat at all
  // Definitional: the answer is the single legal cadence, whatever was posted.
  if (cadenceIsForced(eventType)) return allowed[0] ?? null;
  // Offered: honour a legal choice, and treat anything else as "no repeat".
  // A one-cadence type (travel, gala) still has to be CHOSEN — see
  // FORCED_RECUR_TYPES for why length is not the test.
  if (isRecurCadence(chosen) && allowed.includes(chosen)) return chosen;
  // 🪤 THE LEGACY CHECKBOX MEANS ANNUAL, NOT "THE FIRST LEGAL CADENCE".
  // The shipped create form posts `recurs=on` under the words "Make it a yearly
  // thing", and `canToggleRecur('corporate')` is true — so `allowed[0]` would
  // have silently turned every corporate event ticked with that box into a
  // WEEKLY one, because corporate's ladder starts at weekly. Annual is what the
  // person was told they were choosing; the coarsest legal cadence is the
  // fallback only for a type where annual is not on the ladder at all.
  if (chosen === true || chosen === 'on') {
    // ⚠ AND IT NEVER INVENTS A CADENCE THE LABEL DID NOT PROMISE. Falling back
    // to the coarsest legal one stored MONTHLY for a `date` or `hangout` — whose
    // ladder has no annual rung — under a box that says "Make it a yearly
    // thing" and a wizard screen that asks "Is this a yearly thing? / Yes —
    // every year". Answering "yes, yearly" and getting a monthly repeat is
    // worse than getting none. `canToggleRecur` now also requires an annual
    // rung, so those two types are never ASKED this question in the first
    // place; this is the second half of the same rule.
    return allowed.includes('annual') ? 'annual' : null;
  }
  return null;
}

/**
 * What a stored row MEANS. `recurs = true` with no cadence is every row written
 * before 2026-08-15, and the only thing the boolean ever meant was annual — so
 * it reads as annual rather than being backfilled.
 */
export function effectiveCadence(
  recurs: boolean | null | undefined,
  stored: string | null | undefined,
): RecurCadence | null {
  if (!recurs) return null;
  return isRecurCadence(stored) ? stored : 'annual';
}

export function anchorForType(eventType: string | null | undefined): TypeAnchorDefault {
  if (!eventType) return FALLBACK_ANCHOR;
  return ANCHOR_BY_TYPE[eventType] ?? FALLBACK_ANCHOR;
}

/**
 * The PH milestone-birthday ladder (owner-locked 2026-07-12): 1 · 7 · 18(F) /
 * 21(M) · 60. Sex is OPTIONAL — when unknown, both 18 and 21 are milestones so
 * the app can offer either. All other years are ordinary birthdays.
 */
export const MILESTONE_AGES_FEMALE = [1, 7, 18, 60] as const;
export const MILESTONE_AGES_MALE = [1, 7, 21, 60] as const;
export const MILESTONE_AGES_UNKNOWN = [1, 7, 18, 21, 60] as const;

export type Sex = 'female' | 'male' | null | undefined;

export function milestoneAges(sex: Sex): readonly number[] {
  if (sex === 'female') return MILESTONE_AGES_FEMALE;
  if (sex === 'male') return MILESTONE_AGES_MALE;
  return MILESTONE_AGES_UNKNOWN;
}

// ── date helpers (UTC, ISO 'YYYY-MM-DD') ─────────────────────────────────────

/** Parse 'YYYY-MM-DD' to a UTC Date; returns null on malformed input. */
export function parseISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // reject rollovers (e.g. Feb 31 -> Mar 3)
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function toISO(dt: Date): string {
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/** Add whole years, clamping Feb 29 -> Feb 28 in non-leap targets. */
export function addYears(dt: Date, years: number): Date {
  const y = dt.getUTCFullYear() + years;
  const mo = dt.getUTCMonth();
  const d = dt.getUTCDate();
  const candidate = new Date(Date.UTC(y, mo, d));
  if (candidate.getUTCMonth() !== mo) {
    // Feb 29 -> the last valid day of the target month (Feb 28)
    return new Date(Date.UTC(y, mo + 1, 0));
  }
  return candidate;
}

/** Add calendar months, clamping day-of-month overflow to the month's last day. */
export function addMonths(dt: Date, months: number): Date {
  const total = dt.getUTCMonth() + months;
  const y = dt.getUTCFullYear() + Math.floor(total / 12);
  const mo = ((total % 12) + 12) % 12;
  const d = dt.getUTCDate();
  const candidate = new Date(Date.UTC(y, mo, d));
  if (candidate.getUTCMonth() !== mo) return new Date(Date.UTC(y, mo + 1, 0));
  return candidate;
}

export function addDays(dt: Date, days: number): Date {
  return new Date(dt.getTime() + days * 86400000);
}

/** Whole years between two dates (birthday-accurate age). */
export function yearsBetween(from: Date, to: Date): number {
  let age = to.getUTCFullYear() - from.getUTCFullYear();
  const beforeBirthday =
    to.getUTCMonth() < from.getUTCMonth() ||
    (to.getUTCMonth() === from.getUTCMonth() && to.getUTCDate() < from.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

// ── derivation ──────────────────────────────────────────────────────────────

/**
 * The next annual return of a month/day anchor, on or after `from`.
 * Used for birthdays and memorable-date anniversaries.
 */
export function nextOccurrence(anchorISO: string, fromISO: string): string | null {
  const anchor = parseISO(anchorISO);
  const from = parseISO(fromISO);
  if (!anchor || !from) return null;
  let candidate = new Date(Date.UTC(from.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  // handle Feb 29 anchor in a non-leap `from` year
  if (candidate.getUTCMonth() !== anchor.getUTCMonth()) {
    candidate = new Date(Date.UTC(from.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  }
  if (candidate.getTime() < from.getTime()) {
    candidate = addYears(candidate, 1);
  }
  return toISO(candidate);
}

export type AnniversaryOccurrence = { n: number; dateISO: string };

/**
 * The next anniversary of `anchorISO` (a union/wedding or memorable date), on or
 * after `from`, with its ordinal N (years since the anchor). N is 0 in the
 * anchor year itself; the first celebrated return is N = 1.
 */
export function nextAnniversary(anchorISO: string, fromISO: string): AnniversaryOccurrence | null {
  const anchor = parseISO(anchorISO);
  const from = parseISO(fromISO);
  if (!anchor || !from) return null;
  const dateISO = nextOccurrence(anchorISO, fromISO);
  if (!dateISO) return null;
  const date = parseISO(dateISO)!;
  const n = date.getUTCFullYear() - anchor.getUTCFullYear();
  return { n, dateISO };
}

export type MonthsaryOccurrence = { n: number; dateISO: string };

/**
 * The next MONTHSARY of `anchorISO` (a "together since" date), on or after
 * `from`, with its ordinal N (whole months since the anchor). The monthly
 * sibling of nextAnniversary — Filipino couples celebrate every month. N is 0 in
 * the anchor month; the first celebrated return is N = 1. Day-of-month overflow
 * clamps to the month's last day (addMonths handles Jan 31 → Feb 28/29).
 */
export function nextMonthsary(anchorISO: string, fromISO: string): MonthsaryOccurrence | null {
  const anchor = parseISO(anchorISO);
  const from = parseISO(fromISO);
  if (!anchor || !from) return null;
  // Whole months from the anchor to `from`'s month position, then step to the
  // first monthsary date on or after `from` (at most one bump — the candidate is
  // always inside `from`'s own month).
  let n =
    (from.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (from.getUTCMonth() - anchor.getUTCMonth());
  if (n < 0) n = 0;
  let candidate = addMonths(anchor, n);
  while (candidate.getTime() < from.getTime()) {
    n += 1;
    candidate = addMonths(anchor, n);
  }
  return { n, dateISO: toISO(candidate) };
}

/** Add whole weeks. The one stepper the cadence ladder did not already have. */
export function addWeeks(dt: Date, weeks: number): Date {
  return addDays(dt, weeks * 7);
}

/**
 * The next return of `anchorISO` at `cadence`, on or after `fromISO`.
 *
 * 🔑 EVERY STEP REUSES MACHINERY THAT WAS ALREADY TESTED. `addMonths` already
 * clamps day-of-month overflow (Jan 31 → Feb 28/29), which is the hardest part
 * of monthly/quarterly/semestral stepping, and `nextOccurrence` already handles
 * a Feb 29 anchor in a non-leap year. Quarterly and semestral are `addMonths`
 * with a bigger step — not a new engine.
 *
 * Pure, and it stores nothing: the caller supplies both dates.
 */
export function nextByCadence(
  anchorISO: string,
  cadence: RecurCadence,
  fromISO: string,
): string | null {
  const anchor = parseISO(anchorISO);
  const from = parseISO(fromISO);
  if (!anchor || !from) return null;

  if (cadence === 'annual') {
    // 🚨 AN OCCURRENCE CANNOT PRECEDE THE THING THAT RECURS. `nextOccurrence`
    // builds its candidate in FROM's year and only bumps when that candidate is
    // strictly earlier than `from` — so for an event whose chosen date is more
    // than a year out, the month/day in the CURRENT year is still in the future
    // and gets returned as-is. A company gala booked for 2027-11-05 appeared on
    // the Year view on 2026-11-05 labelled "Every year, in 82 days": a countdown
    // to a date the event is not on, twelve months early.
    //
    // The four cadences added in this change all step FORWARD FROM THE ANCHOR
    // and were already correct in that state (the same row at `quarterly`
    // returns nothing). Annual was the only one that could go backwards —
    // measured by brute-forcing 3.6M anchor/from pairs against a naive
    // step-from-anchor reference, where it was the ONLY mismatch class.
    //
    // ⚠ Clamped HERE and not inside `nextOccurrence`, whose other callers
    // (holidays, birthdays) legitimately pass an anchor in the PAST and rely on
    // getting this year's return.
    const next = nextOccurrence(anchorISO, fromISO);
    if (!next) return null;
    return next < anchorISO ? anchorISO : next;
  }

  const stepMonths = cadence === 'monthly' ? 1 : cadence === 'quarterly' ? 3 : cadence === 'semestral' ? 6 : 0;

  if (stepMonths > 0) {
    // Walk forward in whole steps from the anchor. Starting from the anchor
    // rather than from `from` keeps every occurrence on the anchor's rhythm —
    // stepping from today would silently re-phase the series on every read.
    let n = 0;
    // Jump most of the way in one multiplication, then walk — bounded so a
    // nonsense anchor can never spin.
    const roughMonths = Math.max(
      0,
      (from.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (from.getUTCMonth() - anchor.getUTCMonth()) - stepMonths,
    );
    n = Math.floor(roughMonths / stepMonths);
    for (let guard = 0; guard < 64; guard += 1) {
      const candidate = addMonths(anchor, n * stepMonths);
      if (candidate.getTime() >= from.getTime()) return toISO(candidate);
      n += 1;
    }
    return null;
  }

  if (cadence === 'weekly') {
    const DAY = 86400000;
    const diffDays = Math.ceil((from.getTime() - anchor.getTime()) / DAY);
    const steps = Math.max(0, Math.ceil(diffDays / 7));
    return toISO(addWeeks(anchor, steps));
  }

  return null;
}

export type MilestoneOccurrence = { age: number; dateISO: string; tier: NudgeTier };

/**
 * The next milestone birthday on the PH ladder (1/7/18F-21M/60), on or after
 * `from`. Returns null once every milestone has passed. `birthISO` is supplied
 * by the caller — this function stores nothing.
 */
export function nextMilestone(birthISO: string, sex: Sex, fromISO: string): MilestoneOccurrence | null {
  const birth = parseISO(birthISO);
  const from = parseISO(fromISO);
  if (!birth || !from) return null;
  const ages = milestoneAges(sex);
  for (const age of ages) {
    const dateISO = toISO(addYears(birth, age));
    const date = parseISO(dateISO)!;
    if (date.getTime() >= from.getTime()) {
      return { age, dateISO, tier: age >= 60 || age >= 18 ? 'grand' : 'milestone' };
    }
  }
  return null;
}

/**
 * The next ordinary birthday (any year), on or after `from`, with the age the
 * person turns. `birthISO` supplied by the caller.
 */
export function nextBirthday(
  birthISO: string,
  fromISO: string,
): { age: number; dateISO: string } | null {
  const birth = parseISO(birthISO);
  if (!birth) return null;
  const dateISO = nextOccurrence(birthISO, fromISO);
  if (!dateISO) return null;
  const date = parseISO(dateISO)!;
  return { age: date.getUTCFullYear() - birth.getUTCFullYear(), dateISO };
}

// ── the authored lead-time ladder (§ 4c, owner-locked 2026-07-12) ────────────
// "When to begin planning", PH-calibrated. Two moments: headsUp (first nudge)
// and begin (real start-planning deadline). Months are offsets BEFORE the event.
// All numbers are the seed defaults — admin-tunable config is a later PR.

export type LeadTime = { tier: NudgeTier; headsUpMonths: number; beginMonths: number };

export const LIGHT_HEADS_UP_MONTHS = 0.75; // ~3 weeks

/**
 * Resolve the lead time for an event. `milestoneAge` narrows birthdays and
 * anniversaries (a 60th or a 25th is grand; an ordinary year is light).
 */
export function leadTimeFor(eventType: string, milestoneAge?: number | null): LeadTime {
  switch (eventType) {
    case 'debut':
      return { tier: 'grand', headsUpMonths: 12, beginMonths: 9 };
    case 'wedding':
      return { tier: 'none', headsUpMonths: 0, beginMonths: 0 }; // venue-first; no anchor nudge
    case 'christening':
      return { tier: 'standard', headsUpMonths: 2, beginMonths: 1.5 };
    case 'birthday': {
      if (milestoneAge != null && milestoneAge >= 60) return { tier: 'grand', headsUpMonths: 9, beginMonths: 6 };
      if (milestoneAge === 1 || milestoneAge === 7) return { tier: 'milestone', headsUpMonths: 5, beginMonths: 3 };
      return { tier: 'light', headsUpMonths: LIGHT_HEADS_UP_MONTHS, beginMonths: 0 };
    }
    case 'anniversary': {
      if (milestoneAge != null && (milestoneAge === 25 || milestoneAge === 50)) {
        return { tier: 'grand', headsUpMonths: 12, beginMonths: 6 };
      }
      if (milestoneAge === 1) return { tier: 'standard', headsUpMonths: 2, beginMonths: 1.5 };
      return { tier: 'light', headsUpMonths: LIGHT_HEADS_UP_MONTHS, beginMonths: 0 };
    }
    case 'travel':
      return { tier: 'season', headsUpMonths: 2, beginMonths: 0 };
    case 'corporate':
    case 'gala_night':
      return { tier: 'standard', headsUpMonths: 2, beginMonths: 1.5 };
    case 'reunion':
    case 'graduation':
    case 'tournament':
    case 'celebration':
    case 'gender_reveal':
    case 'simple_event':
    default:
      return { tier: 'standard', headsUpMonths: 2, beginMonths: 1 };
  }
}

export type NudgePlan = { headsUpISO: string; beginISO: string; tier: NudgeTier };

/**
 * Given an event date and its lead time, compute the heads-up and begin-planning
 * dates. Applies the DECEMBER OVERRIDE: any event landing in December pulls both
 * nudges ~6 weeks earlier (ber-months venue crunch).
 */
export function nudgePlan(eventISO: string, lead: LeadTime): NudgePlan | null {
  const event = parseISO(eventISO);
  if (!event) return null;
  const december = event.getUTCMonth() === 11;
  const shiftDays = december ? 42 : 0; // ~6 weeks earlier for December events
  const headsUp = addDays(addMonths(event, -Math.round(lead.headsUpMonths)), -shiftDays);
  const begin = addDays(addMonths(event, -Math.round(lead.beginMonths)), -shiftDays);
  return { headsUpISO: toISO(headsUp), beginISO: toISO(begin), tier: lead.tier };
}
