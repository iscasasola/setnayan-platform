/**
 * year-moments.ts — the "Your Year" derivation.
 *
 * Turns the couple's events (+ an authored holiday ruleset) into the list of
 * upcoming MOMENTS the Year view renders. Every moment is DERIVED at read time
 * from an anchor — nothing is stored, nothing is auto-created (a moment becomes
 * an event only on the user's go-signal tap). Pure + dependency-free (uses only
 * the event-anchor derivation engine), so it's trivially unit-testable and free
 * to run anywhere (Rule 1).
 *
 * PRIVACY: `buildYearMoments` derives ONLY from anchor/wedding dates + fixed
 * holidays — zero PII, no birthdates. `buildSelfMoments` (below) adds exactly
 * ONE birthdate: the signed-in person's OWN, shown only to themselves. Somebody
 * ELSE's birthdate still arrives with the counsel-gated dependent People layer
 * (PR-D) and is deliberately absent from both.
 */
import {
  nextAnniversary,
  nextMonthsary,
  nextOccurrence,
  nextBirthday,
  milestoneAges,
  parseISO,
  leadTimeFor,
  type NudgeTier,
  type Sex,
} from './event-anchor';

export type MomentEvent = {
  event_id: string;
  event_type: string;
  display_name: string;
  event_date: string | null;
  anchor_date: string | null;
  anchor_origin: string | null;
  recurs: boolean | null;
  archived?: boolean | null;
};

export type YearMomentKind =
  | 'anniversary'
  | 'monthsary'
  | 'wedding'
  | 'holiday'
  | 'recurring'
  | 'milestone';

export type YearMoment = {
  dateISO: string;
  daysUntil: number;
  label: string;
  detail: string | null;
  kind: YearMomentKind;
  /** Link target — the event to open, or null for a holiday (a create prompt). */
  eventId: string | null;
  /** TRUE = gets a proactive nudge; ordinary years stay quiet lines. */
  isMilestone: boolean;
  tier: NudgeTier;
};

/**
 * Authored calendar holidays (§ 3 of the setup design). Christmas + Valentine's
 * are the owner-marked safe defaults; the rest of the set is an open owner
 * sign-off, so this list is deliberately minimal and easy to extend.
 */
export const CALENDAR_HOLIDAYS: { monthDay: string; label: string; detail: string }[] = [
  { monthDay: '12-25', label: 'Christmas', detail: 'The biggest gathering season — parties book early.' },
  { monthDay: '02-14', label: "Valentine's Day", detail: 'A date worth planning something for.' },
];

const DAY_MS = 86400000;

function daysBetween(fromISO: string, toISO: string): number {
  const from = parseISO(fromISO);
  const to = parseISO(toISO);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'] as const;
  const v = n % 100;
  const suffix = s[(v - 20) % 10] ?? s[v] ?? 'th';
  return `${n}${suffix}`;
}

function anniversaryLabel(origin: string | null, n: number, displayName: string): string {
  const nth = ordinal(n);
  switch (origin) {
    case 'wedding':
      return `Your ${nth} wedding anniversary`;
    case 'relationship':
      return `Your ${nth} anniversary together`;
    case 'milestone':
    case 'matters':
    default:
      return `${displayName} — ${nth} year`;
  }
}

/** A wedding/anniversary N is a milestone at the 1st, and the silver/golden years. */
function anniversaryIsMilestone(n: number): boolean {
  return n === 1 || n === 25 || n === 50;
}

/**
 * A recurring BIRTHDAY's line. A stored date is only a time-gap measure, and a
 * dependent can be a pet, a sentimental item, or an elder like Lolo Ramon — so
 * the derived COUNT is safe to show (owner 2026-07-13: "dates only help to
 * measure time gaps … is safe to count"). With a birth anchor we count the age →
 * "Lolo Ramon — 70th birthday"; without one it degrades to a plain "— birthday"
 * (added only when the title doesn't already say it).
 *
 * The age here is a pure COUNT off a date the user already chose to store — it
 * does NOT relax the separate birthdate-STORAGE fence / minor-consent gate in
 * lib/dependent-people.ts (that stays owner-locked + counsel-pending).
 */
function birthdayLabel(displayName: string, age: number | null): string {
  if (age != null && age >= 1) return `${displayName} — ${ordinal(age)} birthday`;
  if (/\bbirthday\b|\bbday\b/i.test(displayName)) return displayName;
  return `${displayName} — birthday`;
}

/**
 * FIRST-YEAR MONTHSARY (owner 2026-07-13: "monthsary for everything on the first
 * year — new born, new marriage, new relationship"). Any new beginning is
 * celebrated MONTHLY through year one; from month 12 on it graduates to the
 * yearly anniversary / birthday instead. Returns the single NEXT monthsary as a
 * quiet, non-milestone line — but ONLY while the anchor is still in its first
 * year (ordinal 1..11). Returns null past year one, at the year mark (12 = the
 * anniversary's date), or on a bad date. `label` receives the ordinal N.
 */
function firstYearMonthsary(
  anchorISO: string,
  todayISO: string,
  label: (n: number) => string,
  eventId: string,
): YearMoment | null {
  const ms = nextMonthsary(anchorISO, todayISO);
  if (!ms || ms.n < 1 || ms.n > 11) return null;
  return {
    dateISO: ms.dateISO,
    daysUntil: daysBetween(todayISO, ms.dateISO),
    label: label(ms.n),
    detail: 'Every month · first year',
    kind: 'monthsary',
    eventId,
    isMilestone: false,
    tier: 'light',
  };
}

/**
 * Build the upcoming moments for the Year view, within `withinDays` of `todayISO`
 * (default a rolling year). Sorted soonest-first.
 */
export function buildYearMoments(
  events: MomentEvent[],
  todayISO: string,
  opts: { withinDays?: number; includeHolidays?: boolean } = {},
): YearMoment[] {
  const withinDays = opts.withinDays ?? 366;
  const includeHolidays = opts.includeHolidays ?? true;
  const out: YearMoment[] = [];

  for (const e of events) {
    if (e.archived) continue;

    // Recurring anniversary → derive off its anchor_date.
    if (e.event_type === 'anniversary' && e.recurs && e.anchor_date) {
      const ann = nextAnniversary(e.anchor_date, todayISO);
      if (ann && ann.n >= 1) {
        const lead = leadTimeFor('anniversary', ann.n);
        out.push({
          dateISO: ann.dateISO,
          daysUntil: daysBetween(todayISO, ann.dateISO),
          label: anniversaryLabel(e.anchor_origin, ann.n, e.display_name),
          detail: e.anchor_origin === 'wedding' ? null : e.display_name,
          kind: 'anniversary',
          eventId: e.event_id,
          isMilestone: anniversaryIsMilestone(ann.n),
          tier: anniversaryIsMilestone(ann.n) ? lead.tier : 'light',
        });
      }

      // NEW RELATIONSHIP monthsary — the couple's monthly "together since" line
      // through year one (owner 2026-07-13). One quiet line; graduates to the
      // yearly "anniversary together" at month 12.
      if (e.anchor_origin === 'relationship') {
        const ms = firstYearMonthsary(
          e.anchor_date,
          todayISO,
          (n) => `Your ${ordinal(n)} monthsary`,
          e.event_id,
        );
        if (ms) out.push(ms);
      }
      continue;
    }

    // Wedding → its own anniversary once it's in the past (mirrors the cron), or
    // a countdown while it's still upcoming.
    if (e.event_type === 'wedding' && e.event_date) {
      const wed = parseISO(e.event_date);
      const today = parseISO(todayISO);
      if (wed && today) {
        if (wed.getTime() < today.getTime()) {
          const ann = nextAnniversary(e.event_date, todayISO);
          if (ann && ann.n >= 1) {
            out.push({
              dateISO: ann.dateISO,
              daysUntil: daysBetween(todayISO, ann.dateISO),
              label: anniversaryLabel('wedding', ann.n, e.display_name),
              detail: e.display_name,
              kind: 'anniversary',
              eventId: e.event_id,
              isMilestone: anniversaryIsMilestone(ann.n),
              tier: anniversaryIsMilestone(ann.n) ? leadTimeFor('anniversary', ann.n).tier : 'light',
            });
          }
          // NEW MARRIAGE monthsary — a newlywed's monthly line through year one
          // (owner 2026-07-13); graduates to the 1st wedding anniversary at
          // month 12.
          const ms = firstYearMonthsary(
            e.event_date,
            todayISO,
            (n) => `Your ${ordinal(n)} wedding monthsary`,
            e.event_id,
          );
          if (ms) out.push(ms);
        } else {
          out.push({
            dateISO: e.event_date,
            daysUntil: daysBetween(todayISO, e.event_date),
            label: `${e.display_name} — your wedding`,
            detail: 'The day itself.',
            kind: 'wedding',
            eventId: e.event_id,
            isMilestone: true,
            tier: 'grand',
          });
        }
      }
      continue;
    }

    // Recurring birthday → COUNT the age off the birth anchor when present (a
    // date is only a time-gap measure; the count is safe to show for any
    // dependent kind — a pet, a sentimental item, or an elder like Lolo Ramon —
    // owner 2026-07-13). With a birth anchor the line reads "Lolo Ramon — 70th
    // birthday"; without one it degrades to a plain "— birthday" off the next
    // occurrence. The count does NOT relax the birthdate-storage fence.
    if (e.event_type === 'birthday' && e.recurs) {
      const occ = e.anchor_date ? nextAnniversary(e.anchor_date, todayISO) : null;
      const dateISO =
        occ?.dateISO ?? (e.event_date ? nextOccurrence(e.event_date, todayISO) : null);
      if (dateISO) {
        out.push({
          dateISO,
          daysUntil: daysBetween(todayISO, dateISO),
          label: birthdayLabel(e.display_name, occ?.n ?? null),
          detail: 'Every year',
          kind: 'recurring',
          eventId: e.event_id,
          isMilestone: false,
          tier: 'light',
        });
      }
      // NEW BORN monthsary — a baby's monthly milestones through year one (owner
      // 2026-07-13). Only when a birth anchor is present AND the child is still
      // in its first year (firstYearMonthsary caps at month 11); it graduates to
      // the 1st birthday at month 12.
      if (e.anchor_date) {
        const ms = firstYearMonthsary(
          e.anchor_date,
          todayISO,
          (n) => `${e.display_name} — ${ordinal(n)} month`,
          e.event_id,
        );
        if (ms) out.push(ms);
      }
      continue;
    }

    // Generic recurring event (travel/corporate/gala/celebration/reunion/
    // tournament with the yearly toggle) → its next annual occurrence off the
    // chosen event_date.
    if (e.recurs && e.event_date) {
      const dateISO = nextOccurrence(e.event_date, todayISO);
      if (dateISO) {
        out.push({
          dateISO,
          daysUntil: daysBetween(todayISO, dateISO),
          label: e.display_name,
          detail: 'Every year',
          kind: 'recurring',
          eventId: e.event_id,
          isMilestone: false,
          tier: 'light',
        });
      }
    }
  }

  if (includeHolidays) {
    for (const h of CALENDAR_HOLIDAYS) {
      const dateISO = nextOccurrence(`2000-${h.monthDay}`, todayISO);
      if (!dateISO) continue;
      out.push({
        dateISO,
        daysUntil: daysBetween(todayISO, dateISO),
        label: h.label,
        detail: h.detail,
        kind: 'holiday',
        eventId: null,
        isMilestone: false,
        tier: 'season',
      });
    }
  }

  return out
    .filter((m) => m.daysUntil >= 0 && m.daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.label.localeCompare(b.label));
}

/**
 * Merge the account's own-birthday moment into the event-derived ones, dropping
 * it when an event already occupies that calendar day.
 *
 * 🚨 WITHOUT THIS THE SAME DAY PRINTS TWICE. `/onboarding/[type]` hardcodes
 * `recurs: true` for `event_type = 'birthday'`, so a person who creates their own
 * birthday through onboarding AND has the date on their profile produced two rows
 * on one date — *"My 30th Birthday"* and *"Your birthday — turning 30"*. Measured,
 * not theorised. On the home strip only three rows are visible, so the duplicate
 * ate two of them and pushed a real moment behind "Show 1 more".
 *
 * 🔑 THE EVENT WINS, NOT THE PROFILE. The event row is tappable (it deep-links to
 * its dashboard), it carries the name the person chose, and it is the thing they
 * are actually planning. The profile line is the fallback for when no event
 * exists — which is the whole reason it was added.
 *
 * Lives here rather than in each caller because two callers merging by hand is
 * two chances to merge differently, and the strip and the page must not disagree
 * about how many lines one day gets.
 */
export function mergeSelfMoments(fromEvents: YearMoment[], self: YearMoment[]): YearMoment[] {
  const taken = new Set(fromEvents.map((m) => m.dateISO));
  return [...fromEvents, ...self.filter((m) => !taken.has(m.dateISO))].sort(
    (a, b) => a.daysUntil - b.daysUntil || a.label.localeCompare(b.label),
  );
}

/** The signed-in person's own profile fields the year derivation can use. */
export type SelfForMoments = {
  /** `users.birth_date` — THEIR OWN, typed by them into their own profile. */
  birth_date: string | null;
  /** `users.sex` — optional; only narrows which ages count as milestones. */
  sex?: Sex;
};

/**
 * THE ONE DATE EVERY ACCOUNT HAS THAT COMES BACK EVERY YEAR — the signed-in
 * person's own birthday.
 *
 * ── WHY THIS EXISTS (owner, 2026-08-15) ─────────────────────────────────────
 * *"we used to have a plan. for events that are upcoming for them. based on
 * their account. events that are celebrated always."* The plan shipped and was
 * silent, because every moment `buildYearMoments` can produce is derived inside
 * its `for (const e of events)` loop: with no events there are no moments, and
 * "celebrated always" had nothing to stand on. Meanwhile the profile has asked
 * for a birthday since it was built — *"Optional — so we can greet you on your
 * day 🎂"* — and the ADMIN social queue already reads it to greet people, so
 * the platform was using the date on the user's behalf and never showing it
 * back to them.
 *
 * ── WHY IT IS NOT COUNSEL-GATED, unlike every other birthdate here ──────────
 * This is the person's OWN date, typed by them into their own profile, rendered
 * only on their own screens. That is the self-consented Phase-1 slate of the
 * Family Life-OS plan (§D Phase 1 item 1), explicitly un-gated — as opposed to
 * `dependents.birth_date` (somebody else's, often a minor's), which stays
 * behind `dependentPeopleEnabled()` + counsel. **Do not widen this to read any
 * other person's birthdate.** `people.birth_date` in particular has no writer
 * in the app and is a third party's; it is not a shortcut to a fuller year.
 *
 * ── WHY IT IS NOT GATED ON `public_greeting_opt_in` ─────────────────────────
 * That flag governs Setnayan greeting somebody PUBLICLY (the admin social
 * queue selects on it, and must keep doing so). Showing you your own birthday
 * on your own home publishes nothing, so gating on it would hide a person's
 * date from the one person it is already known to.
 *
 * ── SHAPE ───────────────────────────────────────────────────────────────────
 * ONE line, not two: the next birthday, marked as a milestone when its age
 * lands on the PH ladder (1 · 7 · 18F/21M · 60 — `milestoneAges`). Emitting
 * both an "ordinary" and a "milestone" row would print the same date twice.
 * `eventId` is null because a birthday is a SUGGESTION until the person taps to
 * plan it — the same go-signal rule the rest of this module obeys, and the
 * reason nothing here is ever auto-created.
 *
 * Pure: the caller supplies the date, this module stores nothing.
 */
export function buildSelfMoments(
  self: SelfForMoments | null,
  todayISO: string,
  opts: { withinDays?: number } = {},
): YearMoment[] {
  const withinDays = opts.withinDays ?? 366;
  const birthISO = self?.birth_date ?? null;
  if (!birthISO) return [];

  const birth = parseISO(birthISO);
  const today = parseISO(todayISO);
  if (!birth || !today) return [];

  // 🚨 REJECT ON THE BIRTH YEAR, NOT ON THE DERIVED AGE.
  //
  // The first cut tested `next.age < 1` and its comment claimed that covered
  // "today's year or in the future (a typo, or a date picker's default)". It did
  // not. `age` comes off the NEXT occurrence, so it only caught a mistyped date
  // still ahead in the current year; once the month/day had passed, the next
  // occurrence rolled into next year and `age` came back **1** — which sits on
  // the first rung of the PH milestone ladder. Measured over every in-year date
  // on 2026-08-15: **210 of 336 rendered "Your 1st birthday · A milestone year"**
  // to an adult, in the gold highlighted "Worth planning for" band, while the
  // other 126 were dropped. The same slip produced a confident falsehood or a
  // silent nothing depending only on the month.
  //
  // The profile field is a bare <input type="date"> with no `max`, the save
  // action checks only the SHAPE, and no CHECK constraint exists — so a year
  // left at the picker's default saves fine and is the ordinary way in.
  //
  // Nobody holding an account was born this year, so a birth year at or after
  // today's is provably wrong for a SELF moment. This is the rule the original
  // comment described; the old test only ever exercised the half that worked.
  if (birth.getUTCFullYear() >= today.getUTCFullYear()) return [];

  const next = nextBirthday(birthISO, todayISO);
  if (!next || next.age < 1) return [];

  const isMilestone = milestoneAges(self?.sex ?? null).includes(next.age);
  const daysUntil = daysBetween(todayISO, next.dateISO);
  if (daysUntil < 0 || daysUntil > withinDays) return [];

  return [
    {
      dateISO: next.dateISO,
      daysUntil,
      label: isMilestone ? `Your ${ordinal(next.age)} birthday` : `Your birthday — turning ${next.age}`,
      detail: isMilestone ? 'A milestone year' : 'Every year',
      kind: isMilestone ? 'milestone' : 'recurring',
      eventId: null,
      isMilestone,
      tier: leadTimeFor('birthday', isMilestone ? next.age : null).tier,
    },
  ];
}
