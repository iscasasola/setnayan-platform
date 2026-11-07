/**
 * 🔢 THE THREE NUMBERS AT THE TOP OF DETAILS (THE ONE BUILD, 8 Nov 2026 · v113 `pgExtra` `three` · slice plan 3 D2/D3).
 *
 *   BOOKED      Paid (received) · Balance (to collect / all paid) · Event day (today · tomorrow · in N days · done)
 *   NOT BOOKED  Quote (the sent quote's total / "not sent") · Schedules "—" · Event day ("they asked")
 *
 * 🛑 NEVER "all paid" WITHOUT A BOOKING (spec §4 / §9 #22): a client who owes nothing because nothing is booked is a
 * false green. And never "all paid" when no amount was ever set — nothing owed is not everything paid.
 * READS ARE HONEST: an unread ledger or quote list says "couldn't load", never ₱0; a booking whose money lives on a
 * frozen plan points at Payment rather than inventing a sum here.
 *
 * Pure: every input is a fact the client page already read (no new request).
 */
import type { PickedClientPage } from '@/lib/upcoming-schedule-door';
import { monthDay } from '@/lib/format-date';

export type DetailsNumber = {
  key: 'paid' | 'balance' | 'quote' | 'schedules' | 'event';
  label: string;
  value: string;
  sub: string;
  /** The page a tap opens. */
  page: PickedClientPage;
};

export type DetailsNumbersInput = {
  isBooked: boolean;
  /** Manila civil today, YYYY-MM-DD. */
  todayIso: string;
  eventDate: string | null;
  /** Booked only. `null` = the ledger could not be read. */
  ledger: { receivedPhp: number; expectedPhp: number } | null;
  /** Booked only: the booking's money lives on a frozen plan (the Payment page reads it). */
  onPlan: boolean;
  /** Not booked only. `null` = the quotes could not be read; `undefined` = no quote sent. */
  sentQuotePhp: number | null | undefined;
  peso: (php: number) => string;
};

const DAY_MS = 86_400_000;

function eventCell(i: DetailsNumbersInput): DetailsNumber {
  const base = { key: 'event' as const, label: 'Event day', page: 'schedule' as const };
  if (!i.eventDate) return { ...base, value: '—', sub: 'no date yet' };
  const d = new Date(`${i.eventDate.slice(0, 10)}T00:00:00Z`);
  // The app's own short date ("Nov 8", `monthDay`) — one way to say a date across the supplier app.
  const value = monthDay(i.eventDate.slice(0, 10)) ?? '—';
  if (!i.isBooked) return { ...base, value, sub: 'they asked' };
  const days = Math.round((d.getTime() - new Date(`${i.todayIso}T00:00:00Z`).getTime()) / DAY_MS);
  const sub = days === 0 ? 'today' : days === 1 ? 'tomorrow' : days > 1 ? `in ${days} days` : 'done';
  return { ...base, value, sub };
}

export function detailsNumbers(i: DetailsNumbersInput): DetailsNumber[] {
  if (!i.isBooked) {
    const quote: DetailsNumber =
      i.sentQuotePhp === null
        ? { key: 'quote', label: 'Quote', value: '—', sub: 'couldn’t load', page: 'quote' }
        : i.sentQuotePhp === undefined
          ? { key: 'quote', label: 'Quote', value: '—', sub: 'not sent', page: 'quote' }
          : { key: 'quote', label: 'Quote', value: i.peso(i.sentQuotePhp), sub: 'sent', page: 'quote' };
    return [quote, { key: 'schedules', label: 'Schedules', value: '—', sub: 'none yet', page: 'schedule' }, eventCell(i)];
  }
  let paid: DetailsNumber;
  let balance: DetailsNumber;
  if (i.ledger === null) {
    paid = { key: 'paid', label: 'Paid', value: '—', sub: 'couldn’t load', page: 'payments' };
    balance = { key: 'balance', label: 'Balance', value: '—', sub: 'couldn’t load', page: 'payments' };
  } else if (i.onPlan) {
    paid = { key: 'paid', label: 'Paid', value: '—', sub: 'on Payment', page: 'payments' };
    balance = { key: 'balance', label: 'Balance', value: '—', sub: 'on Payment', page: 'payments' };
  } else {
    const left = Math.max(0, i.ledger.expectedPhp - i.ledger.receivedPhp);
    paid = { key: 'paid', label: 'Paid', value: i.peso(i.ledger.receivedPhp), sub: 'received', page: 'payments' };
    balance =
      i.ledger.expectedPhp <= 0
        ? { key: 'balance', label: 'Balance', value: '—', sub: 'no amount set', page: 'payments' }
        : { key: 'balance', label: 'Balance', value: i.peso(left), sub: left > 0 ? 'to collect' : 'all paid', page: 'payments' };
  }
  return [paid, balance, eventCell(i)];
}
