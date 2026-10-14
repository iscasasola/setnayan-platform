/**
 * not-available.ts — WHEN A "NOT AVAILABLE" BLOCK COVERS A DAY, AND WHICH HOURS (owner 2026-10-14, ✅ "APPROVE": the
 * simpler supplier dashboard — "repeating 'Not available' blocks + hour ranges: YES (new schema)"; prototype
 * `supplier_easy_dashboard_2026-10-14_fable.html` SHEETS.block: Repeats · Hours).
 *
 * A row of `vendor_calendar_blocks` used to be one range of days. Since migration
 * `20271269411264_not_available_repeats_and_hours.sql` it also carries:
 *
 *   repeat_rule   'once' (the range itself) · 'weekly' (every <weekday of the first day>) · 'weekend' (every Saturday
 *                 and Sunday) · 'daily' (every day) — a repeat starts on the first day and runs to `repeat_until`
 *                 (inclusive), or for ever when that is empty;
 *   day_part      'all_day' · 'morning' (6 AM – 12 NN) · 'afternoon' (12 NN – 6 PM) · 'evening' (6 PM onwards).
 *
 * 🔑 THE SAME RULE AS THE DATABASE. `public.calendar_block_on_day` and `public.calendar_block_meets_time` (same
 * migration) decide the booking path; this file decides every screen. They are one rule written twice, so
 * `not-available-is-one-rule.test.ts` runs both over the same grid of days and times and fails on any difference.
 *
 * 🔑 A PART OF A DAY NEVER CLOSES THE DAY. Only an `all_day` block closes a date (the pool gate refuses it, the month
 * hatches it, the couple reads "Booked"). A morning block leaves the day open — "Still has room · morning not
 * available" — and refuses only the TIMES inside it (an exact time slot that overlaps it is refused by
 * `acquire_service_time_slot`). A day with no time cannot be judged by hours, so it is not refused by them.
 *
 * ⚠ A REPEAT IS NOT A RANGE. Its first occurrence may be months before the window a screen reads, so a read that
 * filters `blocked_until >= <window start>` misses it. Read with `NOT_AVAILABLE_COLUMNS` and the window filter
 * `notAvailableWindowFilter` (the repeat rows are kept whatever their first day), then ask `blockOnDay`.
 */

export const REPEAT_RULES = ['once', 'weekly', 'weekend', 'daily'] as const;
export type RepeatRule = (typeof REPEAT_RULES)[number];

export const DAY_PARTS = ['all_day', 'morning', 'afternoon', 'evening'] as const;
export type DayPart = (typeof DAY_PARTS)[number];

/** The hours each part of the day covers, as minutes after midnight, half-open [from, to). */
export const DAY_PART_MINUTES: Readonly<Record<DayPart, readonly [number, number]>> = {
  all_day: [0, 24 * 60],
  morning: [6 * 60, 12 * 60],
  afternoon: [12 * 60, 18 * 60],
  evening: [18 * 60, 24 * 60],
};

/** The sheet's words for each part (prototype SHEETS.block "Hours"). */
export const DAY_PART_WORDS: Readonly<Record<DayPart, string>> = {
  all_day: 'All day',
  morning: 'Morning · 6 AM – 12 NN',
  afternoon: 'Afternoon · 12 NN – 6 PM',
  evening: 'Evening · 6 PM onwards',
};

/** The short word a row uses ("morning"). */
export const DAY_PART_SHORT: Readonly<Record<DayPart, string>> = {
  all_day: 'all day',
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
};

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function asRepeatRule(v: unknown): RepeatRule {
  return (REPEAT_RULES as readonly unknown[]).includes(v) ? (v as RepeatRule) : 'once';
}

export function asDayPart(v: unknown): DayPart {
  return (DAY_PARTS as readonly unknown[]).includes(v) ? (v as DayPart) : 'all_day';
}

/** The repeat-relevant shape of one block: its first and last civil day (Manila) and the two new columns. */
export type NotAvailableShape = {
  startDate: string;
  endDate: string;
  repeat?: RepeatRule | null;
  repeatUntil?: string | null;
  dayPart?: DayPart | null;
};

/** Weekday (0 = Sunday) of a `YYYY-MM-DD` civil day — never through the viewer's timezone. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/** Does the block cover this civil day at all (any hours)? The TS twin of `public.calendar_block_on_day`. */
export function blockOnDay(b: NotAvailableShape, day: string): boolean {
  const repeat = b.repeat ?? 'once';
  if (repeat === 'once') return b.startDate <= day && b.endDate >= day;
  if (day < b.startDate) return false;
  if (b.repeatUntil && day > b.repeatUntil) return false;
  if (repeat === 'daily') return true;
  const w = weekdayOf(day);
  if (repeat === 'weekend') return w === 0 || w === 6;
  return w === weekdayOf(b.startDate);
}

/** Does the block close the WHOLE day — the only kind that makes a date unbookable? */
export function blockClosesDay(b: NotAvailableShape, day: string): boolean {
  return (b.dayPart ?? 'all_day') === 'all_day' && blockOnDay(b, day);
}

/** Does the block cover only PART of this day (the day stays open; some hours are not available)? */
export function blockTakesPartOfDay(b: NotAvailableShape, day: string): boolean {
  return (b.dayPart ?? 'all_day') !== 'all_day' && blockOnDay(b, day);
}

/** "HH:MM[:SS]" → minutes after midnight, or null. "24:00" is the end of the day. */
export function minutesOf(t: string | null | undefined): number | null {
  if (!t) return null;
  const hit = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!hit) return null;
  return Number(hit[1]) * 60 + Number(hit[2]);
}

/**
 * Does a part of the day meet a time? `end` absent (or not after `start`) = a moment: it meets a part it falls inside.
 * Otherwise the two half-open ranges overlap. No time at all meets only `all_day`. The TS twin of
 * `public.calendar_block_meets_time`.
 */
export function dayPartMeetsTime(part: DayPart | null | undefined, start: string | null | undefined, end?: string | null): boolean {
  const p = part ?? 'all_day';
  if (p === 'all_day') return true;
  const s = minutesOf(start);
  if (s === null) return false;
  const e = minutesOf(end);
  const [from, to] = DAY_PART_MINUTES[p];
  if (e === null || e <= s) return s >= from && s < to;
  return s < to && e > from;
}

/** Is this time on this day refused by the block? (covers the day AND meets the time) */
export function blockRefusesTime(b: NotAvailableShape, day: string, start: string | null, end?: string | null): boolean {
  return blockOnDay(b, day) && dayPartMeetsTime(b.dayPart, start, end);
}

/** "Every Sunday" · "Every Saturday and Sunday" · "Every day" · '' for a one-off. */
export function repeatWords(b: Pick<NotAvailableShape, 'repeat' | 'startDate'>): string {
  const r = b.repeat ?? 'once';
  if (r === 'daily') return 'Every day';
  if (r === 'weekend') return 'Every Saturday and Sunday';
  if (r === 'weekly') return `Every ${WEEKDAY_LONG[weekdayOf(b.startDate)]}`;
  return '';
}

/** The repeat choices the sheet offers for a first day (prototype: "Just these days · Every Sunday · …"). */
export function repeatOptions(firstDay: string | null): { key: RepeatRule; label: string }[] {
  const weekday = firstDay ? WEEKDAY_LONG[weekdayOf(firstDay)] : 'week on this day';
  return [
    { key: 'once', label: 'Just these days' },
    { key: 'weekly', label: firstDay ? `Every ${weekday}` : 'Every week on this day' },
    { key: 'weekend', label: 'Every Saturday and Sunday' },
    { key: 'daily', label: 'Every day' },
  ];
}

/**
 * The columns a reader of `vendor_calendar_blocks` must select to honour repeats and hours (append to its own).
 * `not-available-readers-honour-repeats.test.ts` fails a reader that does not.
 */
export const NOT_AVAILABLE_COLUMNS = 'repeat_rule, repeat_until, day_part';

/**
 * The PostgREST `or` filter that keeps every block that can touch [from, to]: a one-off overlapping the window, or a
 * repeat that started on or before its last day (its end is checked by `blockOnDay`). Use with
 * `.lte('blocked_at', <to end>)` — never `.gte('blocked_until', …)` alone, which drops every repeat.
 */
export function notAvailableWindowFilter(fromIso: string): string {
  return `blocked_until.gte.${fromIso},repeat_rule.neq.once`;
}

/** One stored row's repeat fields, normalised (absent columns — an older read — read as a one-off, all day). */
export function notAvailableFieldsOf(row: { repeat_rule?: unknown; repeat_until?: unknown; day_part?: unknown }): {
  repeat: RepeatRule;
  repeatUntil: string | null;
  dayPart: DayPart;
} {
  const until = typeof row.repeat_until === 'string' && /^\d{4}-\d{2}-\d{2}/.test(row.repeat_until) ? row.repeat_until.slice(0, 10) : null;
  return { repeat: asRepeatRule(row.repeat_rule), repeatUntil: until, dayPart: asDayPart(row.day_part) };
}

/** Every civil day in [from, to] the block closes (all day) — for a reader that wants explicit dates. */
export function closedDaysIn(b: NotAvailableShape, from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = from.split('-').map(Number);
  const at = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  for (let i = 0; i < 800; i++) {
    const day = at.toISOString().slice(0, 10);
    if (day > to) break;
    if (blockClosesDay(b, day)) out.push(day);
    at.setUTCDate(at.getUTCDate() + 1);
  }
  return out;
}
