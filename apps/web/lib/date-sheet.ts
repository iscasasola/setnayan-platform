/**
 * lib/date-sheet.ts — THE DATE SHEET'S RULES, PURE (Build 3 · Lane D part 1; approved prototype v3.1
 * `Setnayan-specs/prototypes/date_picker_2026-11-09/`, artifact MfhZ3LUJpns19SDzFGDtTx v4; DECISION_LOG 📆 2026-11-09;
 * `plans/supplier_build_3_2026-11-08/03-FINAL-RULINGS-2026-11-09.md` § "Date picker (Lane D)").
 *
 * Owner, 9 Nov 2026: *"show me a date picker that should apply to all date pickers"* · *"maybe option a but keep the
 * proportion of calendar properly centered? if there is space on the side, we can show a greyed out previous and next
 * month"* · *"why can i tap on the not available?"* · *"date picker approved"*.
 *
 * What this file decides (the sheet, `app/_components/date-sheet.tsx`, only draws it):
 *   · THE MONTH IS NEVER STRETCHED — one drawing everywhere: the sheet's width minus its 16-px sides, never more than
 *     360 px. 288 at 320 · 328 at 360 · 343 at 375 · 358 at 390 · 360 from 392 up (`dateSheetMonthPx`);
 *   · WHOLE NEIGHBOURS, GREYED, WHEN THEY FIT — as many on each side as fit whole, never squeezed: 0 at 768, 1 at 1280
 *     (`dateSheetNeighbours`);
 *   · QUICK CHOICES FIRST — the common answers for a use; a choice past the last allowed day is HIDDEN, never greyed
 *     (Valid until's 30 days when the event is sooner); a use with none opens straight on the grid;
 *   · A NOT-AVAILABLE DAY CAN NEVER BE CHOSEN — the screen names the reason (`DateSheetRefusal`); the sheet says it on the
 *     hint line as "Fri 20 Nov — Lumina is not available" (`refusalLine`) and Set never lights for it (`dateSheetCanSet`);
 *   · BOTH SIDES' AVAILABILITY (meetings) — a busy day or time says WHO; the other side only "is not available", your
 *     own conflict names itself ("You have the florist meeting at 3 PM") — `busyWords`.
 *
 * A day is the DATE ITSELF (`YYYY-MM-DD`), never a `Date` in the viewer's zone — the same rule as `lib/calendar-grid.ts`,
 * whose helpers this extends. A time is `HH:MM`, 24 h. No React, no DOM. Held by `lib/the-date-sheet.test.ts`.
 */
import { CALENDAR_MONTH_NAMES, CALENDAR_WEEKDAYS, dayAllowed, dayOf, dayParts, type CalendarDay } from './calendar-grid';

/** The month's widest drawing, px — a phone's month; it never grows past this (three whole months fit at 1280). */
export const DATE_SHEET_MONTH_MAX_PX = 360;
/** The sheet's sides, px — the house gutter floor; the head, the month and the foot all keep them. */
export const DATE_SHEET_SIDE_PX = 16;
/** The gap between the centre month and a greyed neighbour, px. */
export const DATE_SHEET_MONTH_GAP_PX = 16;
/** A finger that travels this far sideways on the months is a swipe to the next / earlier one. */
export const DATE_SHEET_SWIPE_PX = 48;
/** How long a refused day's reason stays on the hint line (or until the next tap). */
export const DATE_SHEET_REASON_MS = 3000;
/** The hint line's resting words: one month on show · neighbours on show. */
export const DATE_SHEET_HINT_ONE = 'Swipe, or ‹ ›, to move between months';
export const DATE_SHEET_HINT_MANY = 'Swipe, or tap a greyed month, to bring it to the centre';

/** The centre month's width on a sheet `sheetPx` wide: the sheet minus its sides, never more than 360. */
export function dateSheetMonthPx(sheetPx: number): number {
  const w = Math.floor(sheetPx) - 2 * DATE_SHEET_SIDE_PX;
  return Math.max(0, Math.min(DATE_SHEET_MONTH_MAX_PX, w));
}

/** How many WHOLE greyed months fit on EACH side of the centre one (never a squeezed or cut one). */
export function dateSheetNeighbours(sheetPx: number): number {
  const month = dateSheetMonthPx(sheetPx);
  if (month <= 0) return 0;
  /* The room beside the centre month on one side, less the sheet's own side (a neighbour keeps the gutter too). */
  const room = (Math.floor(sheetPx) - month) / 2 - DATE_SHEET_SIDE_PX;
  return Math.max(0, Math.floor(room / (month + DATE_SHEET_MONTH_GAP_PX)));
}

/* ── days as text ─────────────────────────────────────────────────────────── */

const MON3 = CALENDAR_MONTH_NAMES.map((m) => m.slice(0, 3));
const pad = (n: number) => String(n).padStart(2, '0');

/** `n` days on (or back) — across a month's and a year's end. '' for what is not a day. */
export function addDays(day: CalendarDay, n: number): CalendarDay {
  const p = dayParts(day);
  if (!p) return '';
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return dayOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** The weekday, 0 = Sunday. */
export function weekdayOf(day: CalendarDay): number {
  const p = dayParts(day);
  return p ? new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay() : -1;
}

/** The first `weekday` strictly AFTER `day` ("This Saturday" on a Saturday is next week's). */
export function nextWeekday(day: CalendarDay, weekday: number): CalendarDay {
  let d = addDays(day, 1);
  for (let i = 0; i < 7 && d && weekdayOf(d) !== weekday; i++) d = addDays(d, 1);
  return d;
}

/** "Nov 23" — '' for what is not a day. */
export function shortDay(day: CalendarDay | null | undefined): string {
  const p = dayParts(day);
  return p ? `${MON3[p.m - 1]} ${p.d}` : '';
}

/** "Fri 20 Nov" — the hint line's way of naming a day. */
export function hintDay(day: CalendarDay): string {
  const p = dayParts(day);
  if (!p) return '';
  return `${CALENDAR_WEEKDAYS[weekdayOf(day)]?.name.slice(0, 3) ?? ''} ${p.d} ${MON3[p.m - 1]}`;
}

/** "Thursday, Nov 12". */
export function longDay(day: CalendarDay): string {
  const p = dayParts(day);
  return p ? `${CALENDAR_WEEKDAYS[weekdayOf(day)]?.name ?? ''}, ${shortDay(day)}` : '';
}

/** A time: `HH:MM`, 24 h. */
export type SheetTime = string;

function timeParts(t: SheetTime | null | undefined): { h: number; m: number } | null {
  const hit = /^(\d{2}):(\d{2})$/.exec(t ?? '');
  if (!hit) return null;
  const h = Number(hit[1]);
  const m = Number(hit[2]);
  return h <= 23 && m <= 59 ? { h, m } : null;
}

/** "3:00 PM" — '' for what is not a time. */
export function timeWords(t: SheetTime | null | undefined): string {
  const p = timeParts(t);
  return p ? `${p.h % 12 || 12}:${pad(p.m)} ${p.h >= 12 ? 'PM' : 'AM'}` : '';
}

/** "3 PM" on the hour, "3:30 PM" otherwise — how a busy time is said. */
export function hourWords(t: SheetTime): string {
  const p = timeParts(t);
  if (!p) return '';
  return p.m ? timeWords(t) : `${p.h % 12 || 12} ${p.h >= 12 ? 'PM' : 'AM'}`;
}

/* ── quick choices ────────────────────────────────────────────────────────── */

/** One quick choice: the day it means and its word ("14 days"); the sheet shows the day under it ("Nov 23"). */
export type DateSheetChoice = { day: CalendarDay; label: string };

/** Keep only the choices that may be picked — a choice past the last allowed day is HIDDEN, never greyed. */
function inBounds(list: DateSheetChoice[], min: CalendarDay | null, max: CalendarDay | null): DateSheetChoice[] {
  return list.filter((c) => dayAllowed(c.day, { min, max }));
}

/**
 * Valid until (a quotation): 7 days · 14 days · 30 days, none pre-selected; a choice after `lastDay` (the event) is
 * hidden. The owner's ruling: required to send, after today, on or before the event date.
 */
export function validUntilChoices(today: CalendarDay, lastDay: CalendarDay | null = null): DateSheetChoice[] {
  return inBounds(
    [7, 14, 30].map((n) => ({ day: addDays(today, n), label: `${n} days` })),
    addDays(today, 1),
    lastDay,
  );
}

/** A meeting: Today · Tomorrow · This Saturday (from today to `lastDay`, the day before the event). */
export function meetingChoices(today: CalendarDay, lastDay: CalendarDay | null = null): DateSheetChoice[] {
  return inBounds(
    [
      { day: today, label: 'Today' },
      { day: addDays(today, 1), label: 'Tomorrow' },
      { day: nextWeekday(today, 6), label: 'This Saturday' },
    ],
    today,
    lastDay,
  );
}

/** A payment ask's "By when": Today · Tomorrow · In a week. */
export function paymentAskChoices(today: CalendarDay, lastDay: CalendarDay | null = null): DateSheetChoice[] {
  return inBounds(
    [
      { day: today, label: 'Today' },
      { day: addDays(today, 1), label: 'Tomorrow' },
      { day: addDays(today, 7), label: 'In a week' },
    ],
    today,
    lastDay,
  );
}

/* ── refusals: what can never be chosen, and why ──────────────────────────── */

/**
 * Who is busy, and — for your OWN conflict only — what it is. The other side never says what (owner: the other side
 * "only says not available"); you are named "You".
 */
export type DateSheetBusy = { who: string; what?: string | null };

export const DATE_SHEET_YOU = 'You';

/** "Lumina is not available this date" · "You have the florist meeting this date" · …"at 3 PM" with a time. */
export function busyWords(busy: DateSheetBusy, at: SheetTime | null = null): string {
  const when = at ? `at ${hourWords(at)}` : 'this date';
  if (busy.who === DATE_SHEET_YOU && busy.what) return `You have ${busy.what} ${when}`;
  if (busy.who === DATE_SHEET_YOU) return `You are not available ${when}`;
  return `${busy.who} is not available ${when}`;
}

/** The screen's answer for a day that can never be chosen: its reason in words ("Lumina is not available"), or null. */
export type DateSheetRefusal = (day: CalendarDay) => string | null;

/** The hint line under the grid after a refused day is tapped: "Fri 20 Nov — Lumina is not available". */
export function refusalLine(day: CalendarDay, reason: string): string {
  return `${hintDay(day)} — ${reason}`;
}

/* ── the meeting's slot list ──────────────────────────────────────────────── */

/** The meeting's times: the screen's list, and who (if anyone) is busy at each on a day. */
export type DateSheetSlots = {
  times: readonly SheetTime[];
  /** Who is busy at `time` on `day` — null when everyone is free. */
  busy: (day: CalendarDay, time: SheetTime) => DateSheetBusy | null;
  /** The people whose schedules were read ("Lumina, Maria, You") — the list's first line. */
  free: readonly string[];
};

/** The list's first line: "Free for Lumina, Maria, You on Thursday, Nov 12". */
export function slotsHeadWords(day: CalendarDay, free: readonly string[]): string {
  return free.length ? `Free for ${free.join(', ')} on ${longDay(day)}` : `Times on ${longDay(day)}`;
}

/** The ⓘ line for people who have not added a schedule: "Tita Lu hasn't added their schedule — check with them". */
export function missingScheduleWords(names: readonly string[]): string {
  if (!names.length) return '';
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${who} ${names.length === 1 ? "hasn't" : "haven't"} added their schedule — check with them`;
}

/* ── the one gate: Set ────────────────────────────────────────────────────── */

/**
 * May Set light? Only on a real day that is in range and NOT refused — and, for a date + time, a time that is on the
 * list and free for everyone. This is the sheet's only gate; a refused day never gets this far.
 */
export function dateSheetCanSet(at: {
  day: CalendarDay | null;
  time?: SheetTime | null;
  min?: CalendarDay | null;
  max?: CalendarDay | null;
  refuse?: DateSheetRefusal | null;
  slots?: DateSheetSlots | null;
}): boolean {
  const { day, time = null, min = null, max = null, refuse = null, slots = null } = at;
  if (!day || !dayAllowed(day, { min, max })) return false;
  if (refuse && refuse(day) !== null) return false;
  if (!slots) return true;
  if (!time || !slots.times.includes(time)) return false;
  return slots.busy(day, time) === null;
}

/** The sheet's subtitle for a date-only use: "Nov 9 – Nov 28" · "From Nov 9" · "Until Nov 28" · "Any day". */
export function rangeWords(min: CalendarDay | null, max: CalendarDay | null): string {
  if (min && max) return `${shortDay(min)} – ${shortDay(max)}`;
  if (min) return `From ${shortDay(min)}`;
  if (max) return `Until ${shortDay(max)}`;
  return 'Any day';
}

/** Today on the device, as a day — for a screen that has no clock of its own. */
export function deviceToday(now: Date = new Date()): CalendarDay {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
