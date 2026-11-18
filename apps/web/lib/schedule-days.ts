/**
 * 📅 THE DAYS ON A CLIENT'S SCHEDULE (owner 18 Nov 2026, client-page rulings; drawing NL5NDoD6 v7 "Days on the Schedule
 * tab"). Schedule stays the event's blow-by-blow, unchanged; a strip of this client's DAYS goes on top of it. A dot is a
 * day with something on it — and nothing here is a new record: the strip reads what the page already read.
 *
 *   · the EVENT day(s)   — the event's date and every day a schedule chapter starts on (a two-day wedding has two);
 *   · a MEETING day      — an `event_appointments` row of this shop (a Meeting card in the chat), not declined;
 *   · a PAYMENT day      — an installment's due date in the booking's frozen plan.
 *
 * "All clients" adds the shop's OTHER bookings on the same days (the Clients month's one read), in another colour, and
 * marks a CLASH when another client is booked in the same schedule (a hall, a crew) on the same day.
 *
 * Pure, and zone-safe without a formatter: a chapter's `start_at` is the venue's wall clock (read its digits, never
 * re-zone); a meeting's `scheduled_at` is an instant, read in Manila (UTC+8, no daylight saving) by arithmetic; a due
 * date is already a civil day.
 */
export type ScheduleDayKind = 'event' | 'meeting' | 'payment';

export type ScheduleDayItem = {
  key: string;
  day: string;
  kind: ScheduleDayKind;
  /** "2:00 PM", "All day", or null for an event day (its times are the blow-by-blow below). */
  time: string | null;
  title: string;
  sub: string | null;
  chip: string | null;
};

export type ScheduleDayInputs = {
  eventDate: string | null;
  chapters: readonly { start_at: string | null }[];
  meetings: readonly { appointment_id: string; label: string; scheduled_at: string | null; status: string }[];
  payments: readonly { label: string; due_date?: string | null; state: 'paid' | 'pending' | 'due' }[];
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MNL_OFFSET_MS = 8 * 60 * 60 * 1000;

/** "2:00 PM" from hours + minutes. */
function clock(h: number, m: number): string {
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

/** A meeting instant → its Manila civil day and clock. Null when it has no time yet. */
export function manilaDayAndTime(iso: string | null): { day: string; time: string } | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t + MNL_OFFSET_MS);
  const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { day, time: clock(d.getUTCHours(), d.getUTCMinutes()) };
}

const MEETING_CHIP: Record<string, string> = { proposed: 'Waiting for an answer', confirmed: 'Both said yes', done: 'Done' };

/** Every dotted day of THIS client, sorted by day then kind (event · meeting · payment). */
export function clientScheduleDays(input: ScheduleDayInputs): ScheduleDayItem[] {
  const out: ScheduleDayItem[] = [];
  const eventDays = new Set<string>();
  if (input.eventDate && DAY.test(input.eventDate.slice(0, 10))) eventDays.add(input.eventDate.slice(0, 10));
  for (const c of input.chapters) {
    const d = (c.start_at ?? '').slice(0, 10);
    if (DAY.test(d)) eventDays.add(d);
  }
  for (const d of eventDays) out.push({ key: `event:${d}`, day: d, kind: 'event', time: null, title: 'Event day', sub: 'The blow-by-blow is below', chip: null });
  for (const m of input.meetings) {
    if (m.status === 'cancelled') continue;
    const at = manilaDayAndTime(m.scheduled_at);
    if (!at) continue;
    out.push({ key: `meeting:${m.appointment_id}`, day: at.day, kind: 'meeting', time: at.time, title: m.label, sub: 'From a Meeting card', chip: MEETING_CHIP[m.status] ?? null });
  }
  input.payments.forEach((p, i) => {
    const d = p.due_date ?? '';
    if (!DAY.test(d)) return;
    out.push({
      key: `payment:${i}:${d}`,
      day: d,
      kind: 'payment',
      time: 'All day',
      title: `${p.label || 'A payment'} due`,
      sub: "From the booking's payment plan",
      chip: p.state === 'paid' ? 'Paid' : p.state === 'pending' ? 'Waiting for you to confirm' : 'Not paid yet',
    });
  });
  const order: Record<ScheduleDayKind, number> = { event: 0, meeting: 1, payment: 2 };
  return out.sort((a, b) => a.day.localeCompare(b.day) || order[a.kind] - order[b.kind] || (a.time ?? '').localeCompare(b.time ?? ''));
}

/** Another client's booking on a day ("All clients"), from the Clients month's read. */
export type OtherBooking = { eventId?: string | null; eventName: string; bookedDate: string; poolId: string; hours?: string | null };

/**
 * The other clients' bookings on `day`, each marked a clash when THIS client is booked in the same schedule (pool) that
 * day — two events in one hall. This client's own rows are left out (they are the dots above).
 */
export function otherClientsOn(
  day: string,
  bookings: readonly OtherBooking[],
  thisEventId: string,
  poolName: (poolId: string) => string,
): { key: string; title: string; sub: string | null; clash: string | null }[] {
  const mine = new Set(bookings.filter((b) => b.bookedDate === day && b.eventId === thisEventId).map((b) => b.poolId));
  return bookings
    .filter((b) => b.bookedDate === day && b.eventId !== thisEventId)
    .map((b, i) => ({
      key: `other:${b.eventId ?? i}:${b.poolId}`,
      title: b.eventName,
      sub: [b.hours ?? '', poolName(b.poolId)].filter(Boolean).join(' · ') || null,
      clash: mine.has(b.poolId) ? `Clash: ${poolName(b.poolId) || 'same schedule'}` : null,
    }));
}

/** The days in `month` (YYYY-MM) that hold another client's booking. */
export function otherClientDays(bookings: readonly OtherBooking[], thisEventId: string): Set<string> {
  return new Set(bookings.filter((b) => b.eventId !== thisEventId).map((b) => b.bookedDate));
}

// ── Calendar arithmetic (civil days, no zone) ────────────────────────────────────────────────────────────────────────
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

function utc(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12));
}
function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export function addDays(day: string, n: number): string {
  const d = utc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
/** Sun–Sat of the week holding `day`. */
export function weekOf(day: string): string[] {
  const start = addDays(day, -utc(day).getUTCDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
/** The month grid of `month` (YYYY-MM): leading nulls to its first weekday, then each day. */
export function monthGrid(month: string): (string | null)[] {
  const first = utc(`${month}-01`);
  const lead = first.getUTCDay();
  const days: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = first; iso(d).slice(0, 7) === month; d = utc(addDays(iso(d), 1))) days.push(iso(d));
  return days;
}
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1 + n, 1, 12));
  return iso(t).slice(0, 7);
}
/** "Sat, Dec 12". */
export function dayHeading(day: string): string {
  const d = utc(day);
  return `${WEEKDAY[d.getUTCDay()]}, ${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
/** "December 2026". */
export function monthHeading(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_LONG[m! - 1]} ${y}`;
}
