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

/* ── KIND 31 · CALENDAR DAYS WITH SEVERAL STATES (extends kind 8) ─────────────────────────────────────────────────
 *
 * Owner, 2026-10-12 ("APPROVE ALL", control templates round 2, `prototypes/control_templates_round2_2026-10-12.html`
 * § 31): *"The approved calendar, with meaning under the days: a supplier's dates (booked · holding · blocked · free),
 * a couple's plan. The picked day stays the one terracotta circle; a dot says what is on the day; a blocked day is
 * crossed out."* — and answer 4: **a blocked day = a hatched grey square** (not a struck-through number). Two things
 * on a day are two dots; a full day (its limit reached) is bold. **The colour is never the only sign** — every dot has
 * its word in the legend and in the day's own name for a screen reader.
 *
 * The screen says what each day holds (`CalendarDayState`); this file only says how that is drawn and named.
 */

/**
 * What a dot under a day means — green Booked here · grey Outside (a booking from outside, its own dot — owner
 * 2026-10-14 ✅ "APPROVE", plain words) · amber Asking · the accent for the viewer's own event.
 */
export type CalendarDot = 'booked' | 'outside' | 'asking' | 'event';

/** The legend's words, and a day's name for a screen reader (the plain words adopted 2026-10-14). */
export const CALENDAR_DOT_WORD: Readonly<Record<CalendarDot, string>> = {
  booked: 'Booked here',
  outside: 'Outside',
  asking: 'Asking',
  event: 'Your event',
};

/** The legend's word for a blocked day (plain words, 2026-10-14: block days → "Not available"). */
export const CALENDAR_BLOCKED_WORD = 'Not available';

/** One day's state (kind 31). Left out, a day is drawn exactly as kind 8 draws it. */
export type CalendarDayState = {
  /** A dot per thing on the day, in this order; at most three are drawn. */
  dots?: readonly CalendarDot[];
  /** Nothing new can be booked on it — the hatched grey square. */
  blocked?: boolean;
  /** Some HOURS are not available (a morning / afternoon / evening block) — the top half hatched; the day stays open. */
  part?: boolean;
  /** Its limit is reached — the number is bold. */
  full?: boolean;
};

/**
 * A blocked day's hatch: thin ink lines on nothing, so it reads as "closed" in Light and in Dark alike (the ink flips
 * with the theme). The square's corners are the house 8 px (the template drew 10). A plain string, so a server-drawn row can wear it.
 */
export const CALENDAR_HATCH = 'repeating-linear-gradient(135deg, transparent 0 3px, rgb(var(--color-ink) / 0.16) 3px 4px)';

/** A part-day block's mark: the same hatch on the TOP HALF only (prototype `.xm`) — some hours, never the day. */
export const CALENDAR_PART_STYLE = {
  backgroundImage: CALENDAR_HATCH,
  backgroundSize: '100% 50%',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'top',
} as const;

/** The most dots under one day (a 44-px day has room for three 5-px dots). */
export const CALENDAR_MAX_DOTS = 3;

/** A day's dots, deduplicated in the legend's order and cut to what fits. Blocked days carry none (the hatch says it). */
export function dayDots(state: CalendarDayState | null | undefined): CalendarDot[] {
  if (!state || state.blocked) return [];
  const seen = new Set(state.dots ?? []);
  return (['booked', 'outside', 'asking', 'event'] as const).filter((d) => seen.has(d)).slice(0, CALENDAR_MAX_DOTS);
}

/**
 * What a screen reader hears after the day's date: "not available" · "Booked here and Asking, full" · "some hours not
 * available" · '' for a quiet day.
 */
export function dayStateWords(state: CalendarDayState | null | undefined): string {
  if (!state) return '';
  if (state.blocked) return CALENDAR_BLOCKED_WORD.toLowerCase();
  const words = dayDots(state).map((d) => CALENDAR_DOT_WORD[d]);
  if (state.part) words.push('some hours not available');
  const said = words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
  return state.full ? (said ? `${said}, full` : 'full') : said;
}
