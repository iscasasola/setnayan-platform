/**
 * event-date-options.ts — the date as OPTIONS, with a day count (owner 2026-11-13, DECISION_LOG "DATE EDIT PROTOTYPE
 * APPROVED — HOW MANY DAYS? FIRST · N-DAY OPTIONS · EXACT DATE CAN BE A RANGE · ONE CITY OR AREA"; approved prototype
 * `prototypes/event_dates_edit_2026-11-13/index.html`).
 *
 *   · "How many days is your event?" — N, from 1 to the type's `max_days` (`event_type_profiles.max_days`, 30 · 7 · 1).
 *     A 1-day type never shows the step. N lives in `events.event_days`.
 *   · Specific dates: up to 4 OPTIONS. With N > 1 one tap picks N consecutive days as one option; each stored
 *     candidate (`events.date_candidates`) is the START day of its option. Two options may not overlap.
 *   · Flexible window: `date_window_start` → `date_window_end` (≤ 30 days) — with N > 1 it is the window the N-day
 *     block may START in.
 *   · Options are options: the exact date (`event_date`) stays EMPTY until a booking makes it exact — "your venue's
 *     booked day becomes your date" (DECISION_LOG 2026-11-13 "ONE MAIN DATE SPAN").
 *
 * PURE and client-safe: the shared calendar (`onboarding/_shared/date-calendar.tsx`) and the server writer
 * (`updateEventDateOptions`) read the SAME rules from here, so what the screen allows and what the save accepts can
 * never disagree. Dates are `YYYY-MM-DD`, read by their parts (a DATE column must not drift a day across timezones).
 */

/** Up to four options (the shipped calendar's `MAXMULTI`). */
export const MAX_OPTIONS = 4;
/** A window spans at most 30 days, inclusive (the shipped calendar's `MAXSPAN` = 29 between). */
export const MAX_WINDOW_DAYS = 30;
/** The outer bound of a day count — the column's CHECK (1..30). The type's own cap is narrower. */
export const MAX_EVENT_DAYS = 30;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function utcOf(iso: string): number | null {
  const m = ISO.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  // Refuse a day that does not exist (2027-02-30 would otherwise roll over to March).
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return t;
}

function isoOf(t: number): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** A readable `YYYY-MM-DD`? */
export function isIsoDay(iso: unknown): iso is string {
  return typeof iso === 'string' && utcOf(iso) !== null;
}

/** `iso` + n days. */
export function addDaysIso(iso: string, n: number): string {
  const t = utcOf(iso);
  return t === null ? iso : isoOf(t + n * DAY_MS);
}

/** Whole days from a to b (b − a). */
export function daysBetweenIso(a: string, b: string): number {
  const x = utcOf(a);
  const y = utcOf(b);
  return x === null || y === null ? Number.NaN : Math.round((y - x) / DAY_MS);
}

/**
 * Every day of an exact span, first to last — the days the booking-clash check asks one by one. No last day (or one
 * not after the first, or unreadable) = just the first day. Bounded by MAX_EVENT_DAYS, so a bad post can never fan
 * out into hundreds of calendar reads.
 */
export function eventSpanDayList(first: string, last: string | null | undefined): string[] {
  const n = last && isIsoDay(first) && isIsoDay(last) ? daysBetweenIso(first, last) : 0;
  const span = Number.isFinite(n) && n > 0 ? Math.min(n, MAX_EVENT_DAYS - 1) : 0;
  return Array.from({ length: span + 1 }, (_, i) => addDaysIso(first, i));
}

/** The last day of an N-day option that starts on `start`. */
export function optionEnd(start: string, days: number): string {
  return addDaysIso(start, Math.max(1, days) - 1);
}

/** Does an N-day option starting on `a` share any day with one starting on `b`? */
export function optionsOverlap(a: string, b: string, days: number): boolean {
  return a <= optionEnd(b, days) && optionEnd(a, days) >= b;
}

/** The option a day sits inside (its start), or null. */
export function optionHolding(candidates: readonly string[], day: string, days: number): string | null {
  return candidates.find((s) => day >= s && day <= optionEnd(s, days)) ?? null;
}

/** The option an N-day block starting on `start` would share a day with, or null. */
export function optionOverlapping(candidates: readonly string[], start: string, days: number): string | null {
  return candidates.find((s) => optionsOverlap(s, start, days)) ?? null;
}

/** The one step's number: whole, 1 … the type's cap (itself never past 30). */
export function clampDays(n: number, maxDays: number): number {
  const cap = Math.min(MAX_EVENT_DAYS, Math.max(1, Math.floor(maxDays) || 1));
  const v = Math.floor(Number.isFinite(n) ? n : 1);
  return Math.min(cap, Math.max(1, v));
}

/** Is "How many days is your event?" asked at all? Only where the type may run more than a day. */
export function asksHowManyDays(maxDays: number | null | undefined): boolean {
  return typeof maxDays === 'number' && maxDays > 1;
}

const WD: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' };
const MD: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' };

/** "Dec 19". */
export function shortDayWords(iso: string): string {
  const t = utcOf(iso);
  return t === null ? iso : new Date(t).toLocaleDateString('en-US', MD);
}

/** "Sat Dec 19". */
function weekdayWords(iso: string): string {
  const t = utcOf(iso);
  return t === null ? iso : new Date(t).toLocaleDateString('en-US', WD).replace(/,/g, '');
}

/** An option in words — "Dec 19" for one day; "Sat Dec 19 – Mon Dec 21" for a block. */
export function optionWords(start: string, days: number): string {
  return days > 1 ? `${weekdayWords(start)} – ${weekdayWords(optionEnd(start, days))}` : shortDayWords(start);
}

/**
 * Two options may sit side by side (Sat–Mon then Tue–Thu is fine); they may never SHARE a day. The plain line for it —
 * never "days that don't touch" (owner 2026-11-13: touching options are allowed).
 */
export function sharesDayLine(start: string, hit: string, days: number): string {
  return `${optionWords(start, days)} shares a day with ${optionWords(hit, days)}.`;
}

/**
 * 📅 A TAP THAT SHARES A DAY WITH AN OPTION IS OFFERED A WINDOW (owner 2026-11-13, prototype `mkwindow`): the line says
 * what clashed and asks "Make it a window: a N-day event starting <earlier> – <later>?" — with " This replaces your
 * other option(s)." when more options than the clashing one are set. Two answers: "Make it a window" (Flexible window,
 * start = the earlier start, end = the later start; the options are cleared) or "Keep my options" (dismissed).
 */
export function sharesDayOffer(
  start: string,
  hit: string,
  days: number,
  optionCount: number,
): { line: string; windowStart: string; windowEnd: string } {
  const windowStart = start < hit ? start : hit;
  const windowEnd = start < hit ? hit : start;
  const others = Math.max(0, optionCount - 1);
  const tail = others > 0 ? ` This replaces your other ${others === 1 ? 'option' : `${others} options`}.` : '';
  return {
    line: `${sharesDayLine(start, hit, days)} Make it a window: a ${days}-day event starting ${shortDayWords(windowStart)} – ${shortDayWords(windowEnd)}?${tail}`,
    windowStart,
    windowEnd,
  };
}

/**
 * A new N re-reads the options: any that would now overlap an earlier one, or run past `lastDay`, is dropped. The
 * caller says how many were dropped (`droppedLine`).
 */
export function keepOptionsForDays(
  candidates: readonly string[],
  days: number,
  lastDay: string | null = null,
): { kept: string[]; dropped: number } {
  const kept: string[] = [];
  let dropped = 0;
  for (const s of [...candidates].sort()) {
    if ((lastDay && optionEnd(s, days) > lastDay) || kept.some((k) => optionsOverlap(k, s, days))) dropped++;
    else kept.push(s);
  }
  return { kept, dropped };
}

/** "1 option removed — at 3 days they shared a day." */
export function droppedLine(dropped: number, days: number): string | null {
  if (dropped <= 0) return null;
  return `${dropped} ${dropped === 1 ? 'option' : 'options'} removed — at ${days} days they shared a day.`;
}

export type DateOptionsInput = {
  mode: 'specific' | 'window';
  candidates: readonly string[];
  windowStart: string | null;
  windowEnd: string | null;
  days: number;
  /** The event type's cap (`event_type_profiles.max_days`). */
  maxDays: number;
};

/**
 * The server's check of a set of options before it is saved — the same rules the calendar draws. A plain sentence to
 * refuse with, or null when it may be saved. (The first-event-day floor is checked separately by the writer, with
 * the account's exemption.)
 */
export function dateOptionsRefusal(input: DateOptionsInput): string | null {
  const days = Math.floor(input.days);
  if (!Number.isFinite(days) || days < 1) return 'Pick how many days your event is.';
  if (days > clampDays(input.maxDays, MAX_EVENT_DAYS)) {
    return input.maxDays <= 1
      ? 'This kind of event runs for one day.'
      : `This kind of event can run for up to ${input.maxDays} days.`;
  }
  if (input.mode === 'specific') {
    const c = input.candidates;
    if (c.length === 0) return 'Pick at least one date.';
    if (c.length > MAX_OPTIONS) return `Pick up to ${MAX_OPTIONS} ${days > 1 ? 'options' : 'dates'}.`;
    if (!c.every(isIsoDay)) return 'Those dates could not be read.';
    const sorted = [...c].sort();
    for (let i = 1; i < sorted.length; i++) {
      if (optionsOverlap(sorted[i - 1]!, sorted[i]!, days)) return sharesDayLine(sorted[i]!, sorted[i - 1]!, days);
    }
    return null;
  }
  if (!isIsoDay(input.windowStart) || !isIsoDay(input.windowEnd)) return 'Pick a start and an end for your window.';
  const span = daysBetweenIso(input.windowStart, input.windowEnd) + 1;
  if (span < 1) return 'The window cannot end before it starts.';
  if (span > MAX_WINDOW_DAYS) return `A window can be up to ${MAX_WINDOW_DAYS} days.`;
  return null;
}

/** The toast a saved set of options leaves — "Your options: Sat Dec 19 – Mon Dec 21 · …" / "Your window: Dec 19 – Jan 2 for 3 days". */
export function dateOptionsSavedWords(
  mode: 'specific' | 'window',
  candidates: readonly string[],
  windowStart: string | null,
  windowEnd: string | null,
  days: number,
): string {
  if (mode === 'specific') {
    return `Your ${days > 1 ? 'options' : candidates.length === 1 ? 'date' : 'dates'}: ${[...candidates].sort().map((c) => optionWords(c, days)).join(' · ')}`;
  }
  return `Your window: ${shortDayWords(windowStart ?? '')} – ${shortDayWords(windowEnd ?? '')}${days > 1 ? ` for ${days} days` : ''}`;
}

/**
 * The date · place line while the date is still options (the prototype's `dateFact`): "3 days · 2 options · Dec 19 –
 * Jan 11", "4 dates · Dec 19 – Jan 9", "1 date · Dec 19", "Dec 19 – Jan 2". Null when there are none.
 */
export function dateOptionsFactWords(o: {
  mode: string | null;
  candidates: readonly string[] | null;
  windowStart: string | null;
  windowEnd: string | null;
  days: number | null;
}): string | null {
  const n = Math.max(1, Math.floor(o.days ?? 1) || 1);
  const c = (o.candidates ?? []).filter(isIsoDay).sort();
  if (o.mode !== 'window' && c.length > 0) {
    const first = shortDayWords(c[0]!);
    const last = shortDayWords(optionEnd(c[c.length - 1]!, n));
    if (n > 1) return `${n} days · ${c.length} ${c.length === 1 ? 'option' : 'options'} · ${first} – ${last}`;
    return c.length === 1 ? `1 date · ${first}` : `${c.length} dates · ${first} – ${last}`;
  }
  if (isIsoDay(o.windowStart) && isIsoDay(o.windowEnd)) {
    return `${n > 1 ? `${n} days · ` : ''}${shortDayWords(o.windowStart)} – ${shortDayWords(o.windowEnd)}`;
  }
  return null;
}
