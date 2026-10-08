/**
 * apps/web/lib/timeline.ts — THE TIMELINE ROW'S ARITHMETIC (pure: no React, no clock, no I/O).
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9, "Timeline row + the time ticker"; approved gallery
 * `prototypes/control_templates_2026-10-08.html` § 13): *"tap the time start and time end and name of that
 * schedule"* · *"how about a ticker instead"* · *"can also be love story form"* · *"add optional for the day it can
 * be month and year only or month year and day or year only"*.
 *
 * Two uses of ONE row (`app/_components/timeline-row.tsx`) and ONE ticker (`app/_components/ticker.tsx`):
 *   · a TIME — hour · minute (5-minute steps) · AM/PM — for a schedule's start and end;
 *   · a WHEN — a year, a month and year, or a full date — for a Love Story chapter.
 * Everything that turns a rolled column into a value, and a value into the words a row shows, lives here so it is
 * tested rather than eyeballed.
 *
 * 🔑 A PRECISION IS THE SHAPE OF THE DATE, NEVER AN INVENTED DAY. `TimelineWhen` is `{ y, m?, d? }` — the same
 * shape `MomentDate` has in `lib/love-story-moments.ts`. "June 2019" is `{ y: 2019, m: 6 }`; there is no day in it
 * to be wrong. `whenAt` is the only way a precision changes, and it DROPS what the precision does not hold.
 */

const DAY = 24 * 60;
/** A time lands on a multiple of this — the rail's own five (`SNAP_MINUTES`, lib/schedule-rail.ts). */
export const TICKER_MINUTE_STEP = 5;

/* ── A TIME ─────────────────────────────────────────────────────────────── */

export type ClockParts = { hour: number; minute: number; pm: boolean };

/** Minutes after midnight → the three things the ticker rolls. Minutes past midnight of the next day wrap. */
export function clockPartsOf(minutes: number): ClockParts {
  const within = ((Math.round(minutes) % DAY) + DAY) % DAY;
  const h24 = Math.floor(within / 60);
  return { hour: h24 % 12 === 0 ? 12 : h24 % 12, minute: within % 60, pm: h24 >= 12 };
}

/** The three rolled things → minutes after midnight (0–1439). 12 AM is 0; 12 PM is 720. */
export function minutesOfClock(p: ClockParts): number {
  return ((p.hour % 12) + (p.pm ? 12 : 0)) * 60 + p.minute;
}

/**
 * The minute column: every fifth minute — and the moment's own minute when it is not one of them (a 2:07 PM
 * written elsewhere), so rolling only the HOUR never quietly rounds a time the couple did not touch.
 */
export function minuteChoices(current: number): number[] {
  const out: number[] = [];
  for (let m = 0; m < 60; m += TICKER_MINUTE_STEP) out.push(m);
  if (current >= 0 && current < 60 && !out.includes(current)) out.push(current);
  return out.sort((a, b) => a - b);
}

export type TimeSpan = { startMin: number; endMin: number };

/** The start moved: the end moves with it — the length is kept. */
export function moveStart(span: TimeSpan, startMin: number): TimeSpan {
  return { startMin, endMin: startMin + (span.endMin - span.startMin) };
}

/**
 * An end was picked on the clock (0–1439). An end at or before the start means THE NEXT DAY — an after-party to
 * 1 AM — never a moment that ends before it began. The start does not move.
 */
export function pickEnd(span: TimeSpan, clockMin: number): TimeSpan {
  const startDay = Math.floor(span.startMin / DAY) * DAY;
  const startClock = span.startMin - startDay;
  const clock = ((clockMin % DAY) + DAY) % DAY;
  return { startMin: span.startMin, endMin: startDay + (clock <= startClock ? clock + DAY : clock) };
}

/** Does this span end on the day after it starts? */
export function endsNextDay(span: TimeSpan): boolean {
  return Math.floor(span.endMin / DAY) > Math.floor(span.startMin / DAY);
}

/** "2:00 PM" — the row's pill and the ticker's line. */
export function clockWords(minutes: number): string {
  const { hour, minute, pm } = clockPartsOf(minutes);
  return `${hour}:${String(minute).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`;
}

/** "30 min" · "1 h" · "1 h 30 min". */
export function lengthWords(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The one line above the time ticker: "5:00 PM – 6:00 PM · 1 h" (+ " · ends next day"). */
export function spanLine(span: TimeSpan): string {
  return `${clockWords(span.startMin)} – ${clockWords(span.endMin)} · ${lengthWords(span.endMin - span.startMin)}${endsNextDay(span) ? ' · ends next day' : ''}`;
}

/** Rows in time order, by start; a tie keeps the order it came in. */
export function byStart<T>(rows: readonly T[], startOf: (row: T) => number): T[] {
  return rows.map((row, i) => ({ row, i, s: startOf(row) })).sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.row);
}

/**
 * Which rows start before the one above them ends — said in ONE amber line under that row, never blocked. `rows`
 * are in the order drawn (by start). The answer names the EARLIER row and when it ends.
 */
export function overlapsAbove<T>(rows: readonly T[], spanOf: (row: T) => TimeSpan): Map<number, { above: T; endMin: number }> {
  const out = new Map<number, { above: T; endMin: number }>();
  for (let i = 1; i < rows.length; i += 1) {
    const prev = spanOf(rows[i - 1]!);
    if (spanOf(rows[i]!).startMin < prev.endMin) out.set(i, { above: rows[i - 1]!, endMin: prev.endMin });
  }
  return out;
}

/** "Starts before Ceremony ends (4:00 PM)." */
export function overlapLine(aboveName: string, endMin: number): string {
  return `Starts before ${aboveName.trim() || 'the moment above'} ends (${clockWords(endMin)}).`;
}

/** Where "Add a moment" starts: where the last one ended (2 PM on an empty day), one hour long. */
export function nextMomentSpan(spans: readonly TimeSpan[], emptyStartMin = 14 * 60, lengthMin = 60): TimeSpan {
  const last = spans.reduce((acc, s) => Math.max(acc, s.endMin), -Infinity);
  /* Never past the day's last hour — a new moment starts on the day it is added to. */
  const startMin = Number.isFinite(last) ? Math.min(last, 23 * 60) : emptyStartMin;
  return { startMin, endMin: startMin + lengthMin };
}

/* ── A WHEN ─────────────────────────────────────────────────────────────── */

/** A year · a month and year · a full date. `m` is 1–12, `d` 1–31. Same shape as `MomentDate`. */
export type TimelineWhen = { y: number; m?: number; d?: number };
export const WHEN_PRECISIONS = ['year', 'month', 'day'] as const;
export type WhenPrecision = (typeof WHEN_PRECISIONS)[number];
/** The three-way pill's words (gallery § 13). */
export const WHEN_PRECISION_LABEL: Record<WhenPrecision, string> = { year: 'Year', month: 'Month', day: 'Full date' };

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** How exact a when IS — read from its shape, never stored beside it. */
export function precisionOf(w: TimelineWhen): WhenPrecision {
  if (!w.m) return 'year';
  return w.d ? 'day' : 'month';
}

/** Days in a month (m is 1–12). */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The same when with its day pulled back inside its month (31 → 30 when the month rolls to June). */
export function clampWhen(w: TimelineWhen): TimelineWhen {
  if (!w.m) return { y: w.y };
  if (!w.d) return { y: w.y, m: w.m };
  return { y: w.y, m: w.m, d: Math.min(w.d, daysInMonth(w.y, w.m)) };
}

/**
 * The when at another precision. Going coarser DROPS the part that precision does not hold (never "June 1" for
 * "June"). Going finer needs a part the when does not have yet: `kept` is what this ticker last showed for it
 * (rolling back to Full date brings the 14th back), else the first — which the couple SEES in the centre band and
 * in the line above before anything is kept.
 */
export function whenAt(w: TimelineWhen, precision: WhenPrecision, kept: { m?: number; d?: number } = {}): TimelineWhen {
  if (precision === 'year') return { y: w.y };
  const m = w.m ?? kept.m ?? 1;
  if (precision === 'month') return { y: w.y, m };
  return clampWhen({ y: w.y, m, d: w.d ?? kept.d ?? 1 });
}

/** "2019" · "Jun 2019" · "Feb 14, 2021" (`long`: "June 2019" · "February 14, 2021") — only as exact as it is. */
export function whenWords(w: TimelineWhen | null | undefined, long = false): string {
  if (!w) return '';
  if (!w.m) return String(w.y);
  const name = MONTH_NAMES[w.m - 1] ?? '';
  const month = long ? name : name.slice(0, 3);
  return w.d ? `${month} ${w.d}, ${w.y}` : `${month} ${w.y}`;
}

/** Sort key: a year alone sorts at the START of its year, a month at the start of its month. No when sorts first. */
export function whenKey(w: TimelineWhen | null | undefined): number {
  if (!w) return -Infinity;
  return w.y * 10000 + (w.m ?? 0) * 100 + (w.m ? (w.d ?? 0) : 0);
}

/** The year column: a span around today that always holds the when's own year. */
export function yearChoices(current: number, thisYear: number, back = 80, ahead = 5): number[] {
  const lo = Math.min(current, thisYear - back);
  const hi = Math.max(current, thisYear + ahead);
  const out: number[] = [];
  for (let y = lo; y <= hi; y += 1) out.push(y);
  return out;
}

/* ── THE ROLLING COLUMN ─────────────────────────────────────────────────── */

/** One choice is this tall; the column shows three (the middle one is the centre band). */
export const TICKER_ROW_PX = 40;

/** Which choice sits in the centre band at this scroll offset — clamped to the column. */
export function settledIndex(scrollTop: number, count: number, rowPx: number = TICKER_ROW_PX): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(scrollTop / rowPx)));
}

/* ── THE POP ────────────────────────────────────────────────────────────── */

/** Below this the ticker opens as a sheet from the bottom; from it, under its button (the app's one phone line). */
export const TICKER_SHEET_BELOW_PX = 1024;

/**
 * Where a desktop pop sits: under its button, flipped above when there is no room below, and always inside the
 * screen — a pop is never taller than the screen (`maxHeight`), it scrolls inside itself instead.
 */
export function placeTickerPop(input: {
  button: { top: number; bottom: number; left: number; right: number };
  pop: { width: number; height: number };
  viewport: { width: number; height: number };
  align?: 'start' | 'end';
  gap?: number;
  edge?: number;
}): { top: number; left: number; maxHeight: number } {
  const { button, pop, viewport, align = 'start', gap = 6, edge = 8 } = input;
  const maxHeight = Math.max(0, viewport.height - edge * 2);
  const height = Math.min(pop.height, maxHeight);
  const below = button.bottom + gap;
  const top = below + height <= viewport.height - edge ? below : Math.max(edge, Math.min(button.top - gap - height, viewport.height - edge - height));
  const wanted = align === 'end' ? button.right - pop.width : button.left;
  const left = Math.max(edge, Math.min(wanted, viewport.width - edge - pop.width));
  return { top, left, maxHeight };
}
