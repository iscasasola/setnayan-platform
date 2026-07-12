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
 * PRIVACY: this first cut derives ONLY from anchor/wedding dates + fixed
 * holidays — zero PII, no birthdates. Milestone birthdays arrive with the
 * counsel-gated dependent People layer (PR-D); they are deliberately absent here.
 */
import {
  nextAnniversary,
  nextOccurrence,
  parseISO,
  leadTimeFor,
  type NudgeTier,
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

export type YearMomentKind = 'anniversary' | 'wedding' | 'holiday' | 'recurring' | 'milestone';

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
