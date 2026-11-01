/**
 * 📅 DATES' THREE FIGURES — booked · asking · days off, for the month on show (supplier dashboard v13, APPROVED
 * 2026-10-29, prototype `custDates()` tiles; DECISION_LOG "EVERY SUPPLIER-DASHBOARD PAGE: THE TOP ROWS COMPRESS INTO ONE
 * PINNED ROW ON SCROLL").
 *
 * 🔑 A PLAIN MODULE, PURE — the page (first paint) and the month (every ‹ ›) count with the SAME function, over the SAME
 * days `buildCustomerCalendarMonth` derived and `dayStateOf` marked. It counts DAYS by their marks — never a booking, never
 * a seat — so a figure can never disagree with the month it sits over:
 *   booked   — a day with a green (Setnayan) or grey (outside) dot;
 *   asking   — a day with the amber dot;
 *   days off — a day the shop closed (`state === 'blocked'`: the hatched square a closure draws).
 * Honest: when the closures did not all load, "days off" is null ("—"), never a short count.
 */
import type { CustomerCalendarDay } from '@/lib/vendor-customers';
import { dayStateOf } from '@/lib/vendor-dates';
import { formatCount } from '@/lib/format-number';
import type { CustomersFigure } from './_components/customers-figures';

export type DatesFigureKey = 'booked' | 'asking' | 'off';

/** Which kind of day each figure counts — and which day a tap on it picks (the first of them). */
export function datesDayIs(key: DatesFigureKey, day: CustomerCalendarDay): boolean {
  if (key === 'off') return day.state === 'blocked';
  const st = dayStateOf(day);
  if (!st?.dots) return false;
  return key === 'asking' ? st.dots.includes('asking') : st.dots.includes('booked') || st.dots.includes('outside');
}

export function datesFiguresOf(days: readonly CustomerCalendarDay[], closuresComplete: boolean): CustomersFigure[] {
  const n = (k: DatesFigureKey) => days.filter((d) => datesDayIs(k, d)).length;
  const asking = n('asking');
  return [
    { key: 'booked', value: formatCount(n('booked')), word: 'booked', jump: 'booked' },
    { key: 'asking', value: formatCount(asking), word: 'asking', hot: asking > 0, jump: 'asking' },
    { key: 'off', value: closuresComplete ? formatCount(n('off')) : null, word: 'days off', jump: 'off' },
  ];
}
