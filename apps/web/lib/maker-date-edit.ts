/**
 * 📅 What the Maker's date Edit says (`stage-panel/date-edit.tsx`, Maker Edit shell v3, owner-approved 2026-11-13) —
 * pure, so the guard reads it without the sheet's server doors. Held by `lib/the-date-part-edits-the-date-in-place.test.ts`.
 */
import { daysUntil } from './guest-checklist';
import type { DateSheetData } from './suppliers-fact-sheets';

export const DATE_EDIT_SHARED = 'Suppliers and Home use this date too.';
export const DATE_EDIT_NOT_FINAL = 'Not final yet';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
/** The calendar day of a YYYY-MM-DD string — no time zone moves it, and no locale reorders it. */
function dayOf(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}
/** "Sat, 12 December 2026" — the prototype's own form. */
export function dateEditDay(iso: string): string {
  const d = dayOf(iso);
  return d ? `${WEEKDAY[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}` : iso;
}
/** "12 Dec" — an option's chip. */
function chip(iso: string): string {
  const d = dayOf(iso);
  return d ? `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]!.slice(0, 3)}` : iso;
}

/** What row 1–2 say, from the sheet's own read. Pure — held by the test. */
export function dateEditLines(d: Pick<DateSheetData, 'date' | 'precision' | 'options'>, today: string): { final: boolean; value: string; sub: string | null; chips: string[] } {
  const final = Boolean(d.date) && d.precision === 'day';
  if (final && d.date) {
    const n = daysUntil({ eventDate: d.date, today });
    const sub = n === null ? 'Final' : n > 1 ? `Final · ${n} days to go` : n === 1 ? 'Final · tomorrow' : n === 0 ? 'Final · today' : 'Final';
    return { final: true, value: dateEditDay(d.date), sub, chips: [] };
  }
  const chips = d.options?.mode === 'specific' ? d.options.candidates.slice(0, 4).map(chip) : [];
  const window = d.options?.mode === 'window' && d.options.windowStart ? `${chip(d.options.windowStart)} – ${chip(d.options.windowEnd ?? d.options.windowStart)}` : null;
  return { final: false, value: DATE_EDIT_NOT_FINAL, sub: window, chips };
}

