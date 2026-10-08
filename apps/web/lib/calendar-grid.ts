/**
 * lib/calendar-grid.ts — THE CALENDAR'S RULES, PURE (`INTERACTION_RULES.md` § 9, kind 8 "Calendar"; approved gallery
 * `prototypes/control_templates_2026-10-08.html` § 6 "Reply by" and § 8).
 *
 * Owner, 2026-10-08: *"form row with date"* · the gallery he approved: **"Three uses, one look. Pick one day. Pick a
 * range of days. See what is on each day. The picked day is terracotta; a dot means something is on that day."**
 *
 * A day here is the DATE ITSELF — `YYYY-MM-DD`, the way a `date` column holds it — never a moment in time: nothing
 * in this file makes a `Date` in the viewer's timezone (a reply-by of 12 November must not become the 11th for a
 * couple reading it east or west of the server). No React, no DOM: `app/_components/calendar.tsx` draws what this
 * decides. Held by `lib/the-calendar.test.ts`.
 */

/** A day: `YYYY-MM-DD`. */
export type CalendarDay = string;
/** A month on show: `m` is 1–12. */
export type CalendarMonth = { y: number; m: number };

export const CALENDAR_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
/** The grid's seven column heads, Sunday first (the gallery's `SMTWTFS`) — and their names for a screen reader. */
export const CALENDAR_WEEKDAYS = [
  { letter: 'S', name: 'Sunday' },
  { letter: 'M', name: 'Monday' },
  { letter: 'T', name: 'Tuesday' },
  { letter: 'W', name: 'Wednesday' },
  { letter: 'T', name: 'Thursday' },
  { letter: 'F', name: 'Friday' },
  { letter: 'S', name: 'Saturday' },
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** Days in a month (`m` 1–12). */
export function daysIn(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The parts of a real day, or null — `2026-02-30` is not a day, and neither is anything that is not `YYYY-MM-DD`. */
export function dayParts(day: CalendarDay | null | undefined): { y: number; m: number; d: number } | null {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec((day ?? '').trim());
  if (!hit) return null;
  const y = Number(hit[1]);
  const m = Number(hit[2]);
  const d = Number(hit[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysIn(y, m)) return null;
  return { y, m, d };
}

export function dayOf(y: number, m: number, d: number): CalendarDay {
  return `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;
}

/** "November 12, 2026" — '' for what is not a day. */
export function dayWords(day: CalendarDay | null | undefined): string {
  const p = dayParts(day);
  return p ? `${CALENDAR_MONTH_NAMES[p.m - 1]} ${p.d}, ${p.y}` : '';
}

/** "November 2026". */
export function monthTitle(month: CalendarMonth): string {
  return `${CALENDAR_MONTH_NAMES[month.m - 1] ?? ''} ${month.y}`;
}

/** The month a calendar opens on: the picked day's — else the first of `fallbacks` that is a day. */
export function monthOf(day: CalendarDay | null | undefined, ...fallbacks: Array<CalendarDay | null | undefined>): CalendarMonth | null {
  for (const candidate of [day, ...fallbacks]) {
    const p = dayParts(candidate);
    if (p) return { y: p.y, m: p.m };
  }
  return null;
}

/** `n` months on (or back, negative) — across the year's end too. */
export function stepMonth(month: CalendarMonth, n: number): CalendarMonth {
  const at = month.y * 12 + (month.m - 1) + n;
  return { y: Math.floor(at / 12), m: (((at % 12) + 12) % 12) + 1 };
}

/** One month's grid: the empty cells before its first day (Sunday first), and its days. */
export function monthCells(month: CalendarMonth): { lead: number; days: number } {
  return { lead: new Date(Date.UTC(month.y, month.m - 1, 1)).getUTCDay(), days: daysIn(month.y, month.m) };
}

/** May this day be picked? No earliest and no latest unless the screen gives one (`YYYY-MM-DD` compares as text). */
export function dayAllowed(day: CalendarDay, bounds: { min?: CalendarDay | null; max?: CalendarDay | null } = {}): boolean {
  if (!dayParts(day)) return false;
  if (bounds.min && dayParts(bounds.min) && day < bounds.min) return false;
  if (bounds.max && dayParts(bounds.max) && day > bounds.max) return false;
  return true;
}

/** A range being picked: its first day, and its last once that is tapped. */
export type CalendarRange = { from: CalendarDay; to: CalendarDay | null };

/**
 * A tap while picking a range (the gallery's own rule): with a first day and no last, a LATER day closes the range;
 * anything else starts a new one on the day tapped.
 */
export function pickInRange(range: CalendarRange | null, day: CalendarDay): CalendarRange {
  if (range && range.to === null && day > range.from) return { from: range.from, to: day };
  return { from: day, to: null };
}

/** How one day of the grid is drawn. */
export type CalendarDayLook = {
  /** The accent circle: the picked day, or either end of a range. */
  picked: boolean;
  /** Between a closed range's two ends (the ends included — they are drawn as circles, the days between softly filled). */
  inRange: boolean;
  /** Today: a hairline ring. */
  today: boolean;
  /** Something is on that day: a dot under the number. */
  marked: boolean;
  /** Outside what may be picked: grey, and not pressable. */
  out: boolean;
};

export function dayLook(
  day: CalendarDay,
  at: { value?: CalendarDay | null; range?: CalendarRange | null; today?: CalendarDay | null; marks?: ReadonlySet<CalendarDay> | null; min?: CalendarDay | null; max?: CalendarDay | null },
): CalendarDayLook {
  const r = at.range ?? null;
  const closed = r !== null && r.to !== null;
  return {
    picked: day === at.value || (r !== null && (day === r.from || day === r.to)),
    inRange: closed && day >= r.from && day <= (r.to as CalendarDay),
    today: day === at.today,
    marked: at.marks?.has(day) === true,
    out: !dayAllowed(day, at),
  };
}

/** Below this a calendar that belongs to a row rises from the bottom as a sheet; from it, it opens under its pill (the app's one phone line). */
export const CALENDAR_SHEET_BELOW_PX = 1024;
export function calendarOpensAs(viewportWidth: number): 'sheet' | 'panel' {
  return viewportWidth < CALENDAR_SHEET_BELOW_PX ? 'sheet' : 'panel';
}

/** After a pick the calendar stays a moment — the circle is SEEN landing on the day — then closes (the gallery's 260 ms). */
export const CALENDAR_CLOSE_AFTER_PICK_MS = 260;

/**
 * The motion's shares of the press family's one speed (`--sn-pill-dur`; the gallery's own figures over its pill's
 * 230): the sheet rises, the panel lands, a month slides in.
 */
export const CALENDAR_MOTION = { sheet: 220 / 230, panel: 160 / 230, month: 120 / 230 } as const;
/** How far a month slides in from, in px, toward the side it came from. */
export const CALENDAR_MONTH_SLIDE_PX = 18;
