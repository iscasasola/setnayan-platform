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
};

/** Unknown/admin-created types fall back to a chosen fixed date. */
export const FALLBACK_ANCHOR: TypeAnchorDefault = { kind: 'fixed_date', dateModel: 'input' };

/**
 * Anniversary typed origins — WHAT a recurring memorable date celebrates.
 * POSITIVE origins only (the DB CHECK on events.anchor_origin enforces the same
 * set): no memorial/death option, so generalized anniversaries can't backdoor
 * babang-luksa (burial retirement 2026-05-16).
 */
export const ANCHOR_ORIGINS = ['wedding', 'relationship', 'milestone', 'matters'] as const;
export type AnchorOrigin = (typeof ANCHOR_ORIGINS)[number];

/** Human labels for the typed-origin picker (§ 3b of the setup design). */
export const ANCHOR_ORIGIN_LABELS: Record<AnchorOrigin, string> = {
  wedding: 'Our wedding',
  relationship: 'Our relationship',
  milestone: 'A milestone we’re proud of',
  matters: 'A date that matters to us',
};

export function isAnchorOrigin(v: unknown): v is AnchorOrigin {
  return typeof v === 'string' && (ANCHOR_ORIGINS as readonly string[]).includes(v);
}

/**
 * Types that show the "Make it a yearly thing?" toggle at creation (owner:
 * "travel can be annual or one-time"). Anniversary + birthday recur by nature
 * (no toggle needed); wedding/debut/christening/gender_reveal/graduation are
 * one-time. The rest are user's choice.
 */
export const RECUR_TOGGLE_TYPES = [
  'travel',
  'celebration',
  'corporate',
  'gala_night',
  'reunion',
  'tournament',
] as const;

export function canToggleRecur(eventType: string | null | undefined): boolean {
  return !!eventType && (RECUR_TOGGLE_TYPES as readonly string[]).includes(eventType);
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
