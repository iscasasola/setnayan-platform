/**
 * check-a-date.ts — "CHECK A DATE", DECIDED PURELY (owner 2026-10-28, DECISION_LOG "✅📅 CHECK A DATE — APPROVED; BUILD
 * `/v/[slug]/dates`"; approved prototype `prototypes/check_a_date_2026-10-28/index.html`).
 *
 * Owner, verbatim: *"it will only show dates not bookable and available dates. and will not show if there are current
 * inquiries on that day."* → *"index.html approve"*.
 *
 * TWO STATES, NEVER A THIRD. A day is `available` or `not_bookable`; past days are simply not offered. NOT BOOKABLE is
 * the shop's own month, read the way its supplier sees it — the ONE shipped derivation of a day,
 * `buildCustomerCalendarMonth` (`lib/vendor-customers.ts`), which folds every block through the ONE closure rule
 * (`lib/not-available.ts`: an ALL-DAY "Not available", one-off or repeating; a morning Mass leaves the day open):
 *   · `blocked` — an all-day closure;
 *   · `locked`  — the shop's own hard hold on the day (the booking lock refuses it as it refuses a closure);
 *   · `full`    — every schedule has reached its "How many a day" (Setnayan bookings + bookings from outside).
 * Everything else — free, some room left, approve-first, a waiting list — is `available`.
 *
 * 🔒 WHAT THIS FILE IS NEVER GIVEN. The month builder takes an optional list of open asks per day; this file never
 * passes one, and nothing here can carry one: the inputs below are schedules, bookings, blocks and day states only.
 * Who booked is never an input either — a booking is a schedule and a date, nothing else
 * (`app/v/[slug]/dates/no-inquiry-reads.test.ts` holds both).
 *
 * PER SERVICE, WHEN THE SHOP RUNS SEPARATE SCHEDULES. A service belongs to the schedule(s) the supplier put it on
 * (Named Calendars membership, or the halls it uses), else to its category's schedule. A service is not bookable on a
 * day when EVERY schedule it belongs to is; the day is not bookable when every service is. A shop whose services all
 * share one schedule answers once (`perService` is null).
 */
import { buildCustomerCalendarMonth, type CalendarBlockInput, type CalendarBookingInput } from './vendor-customers';
import type { SchedulePool, VendorCalendarDayState } from './vendor-schedule';
import { blockClosesDay } from './not-available';

/** The two answers a couple ever reads. */
export type CheckDateState = 'available' | 'not_bookable';

/** The legend's words (prototype `.leg`). */
export const CHECK_DATE_WORDS: Readonly<Record<CheckDateState, string>> = {
  available: 'Available',
  not_bookable: 'Not bookable',
};

/** How far ahead the calendar answers, in months (this month + the next 23). Later days are not offered. */
export const CHECK_DATE_MONTHS_AHEAD = 24;

/** The page a shop's "Check a date" QR opens. `origin` has no trailing slash (`siteOrigin()`). */
export function checkADatePath(slug: string): string {
  return `/v/${encodeURIComponent(slug)}/dates`;
}
export function checkADateUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/+$/, '')}${checkADatePath(slug)}`;
}

/** First and last day the calendar answers: the 1st of today's month → the last day `months` later. */
export function checkDateWindow(today: string, months = CHECK_DATE_MONTHS_AHEAD): { from: string; to: string; months: string[] } {
  const [y = 1970, m = 1] = today.split('-').map(Number);
  const list: string[] = [];
  for (let i = 0; i < months; i++) {
    const at = y * 12 + (m - 1) + i;
    list.push(`${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, '0')}`);
  }
  const last = list[list.length - 1] ?? `${y}-${String(m).padStart(2, '0')}`;
  const [ly = y, lm = m] = last.split('-').map(Number);
  const lastDay = new Date(Date.UTC(ly, lm, 0)).getUTCDate();
  return { from: `${list[0]}-01`, to: `${last}-${String(lastDay).padStart(2, '0')}`, months: list };
}

/** A schedule as this page needs it: its id and its "How many a day". */
export type CheckDatePool = { poolId: string; capacity: number };
/** A service of the shop and the schedules it belongs to ([] = none resolved). */
export type CheckDateService = { serviceId: string; poolIds: string[] };

export type CheckDateInput = {
  pools: CheckDatePool[];
  /** Live (not released) Setnayan bookings: a schedule and a date — never who. */
  bookings: { poolId: string; bookedDate: string }[];
  /** Every block that can touch the window, as PH civil days (`notAvailableShapeOf`), with its schedule (null = all). */
  blocks: CalendarBlockInput[];
  /** The shop's own day states in the window (`locked` · `whitelist`), per schedule (null = all). */
  dayStates: { poolId: string | null; stateDate: string; dayState: 'locked' | 'whitelist' }[];
  services: CheckDateService[];
  months: string[];
  today: string;
};

export type CheckDateAnswer = {
  /** Every day in the window (today on) the couple reads as Not bookable. */
  notBookable: string[];
  /** Per service, when the shop's services sit on different schedules: serviceId → its Not-bookable days. */
  perService: Record<string, string[]> | null;
};

const asPool = (p: CheckDatePool): SchedulePool => ({
  poolId: p.poolId,
  label: '',
  capacity: p.capacity,
  categories: [],
  calendarName: null,
  isVendorCreated: false,
  serviceIds: [],
});

/** A day the month builder says nothing new can be booked on. */
function closedState(state: string | null): boolean {
  return state === 'blocked' || state === 'locked' || state === 'full';
}

/** One schedule's Not-bookable days in the window — the shipped month builder, one schedule at a time. */
function poolClosedDays(pool: CheckDatePool, input: CheckDateInput): Set<string> {
  const out = new Set<string>();
  const bookings: CalendarBookingInput[] = input.bookings.filter((b) => b.poolId === pool.poolId).map((b) => ({ ...b, eventName: '' }));
  const blocks = input.blocks.filter((b) => b.poolId === null || b.poolId === pool.poolId);
  const states: VendorCalendarDayState[] = input.dayStates
    .filter((s) => s.poolId === null || s.poolId === pool.poolId)
    .map((s) => ({ dayStateId: '', poolId: s.poolId, stateDate: s.stateDate, dayState: s.dayState, note: null }));
  for (const month of input.months) {
    // Seven arguments: no asks are passed — the month builder's eighth is never given here.
    const m = buildCustomerCalendarMonth([asPool(pool)], bookings, blocks, states, [], month, input.today);
    for (const d of m.days) if (!d.past && closedState(d.state)) out.add(d.date);
  }
  return out;
}

/** Days closed for the whole shop when a service has no schedule: an all-day closure or a hold on every schedule. */
function shopWideClosedDays(input: CheckDateInput): Set<string> {
  const out = new Set<string>();
  const wide = input.blocks.filter((b) => b.poolId === null && b.source !== 'external_client');
  const held = new Set(input.dayStates.filter((s) => s.poolId === null && s.dayState === 'locked').map((s) => s.stateDate));
  for (const month of input.months) {
    const [y = 1970, mm = 1] = month.split('-').map(Number);
    const days = new Date(Date.UTC(y, mm, 0)).getUTCDate();
    for (let d = 1; d <= days; d++) {
      const day = `${month}-${String(d).padStart(2, '0')}`;
      if (day < input.today) continue;
      if (held.has(day) || wide.some((b) => blockClosesDay(b, day))) out.add(day);
    }
  }
  return out;
}

const sorted = (s: Set<string>) => [...s].sort();

/** The whole answer for the window. */
export function checkDateAnswer(input: CheckDateInput): CheckDateAnswer {
  const known = new Set(input.pools.map((p) => p.poolId));
  const byPool = new Map(input.pools.map((p) => [p.poolId, poolClosedDays(p, input)] as const));
  const wide = shopWideClosedDays(input);

  // Each service's closed days: closed on EVERY schedule it belongs to (none resolved = the shop-wide closures).
  const perServiceSets = new Map<string, Set<string>>();
  for (const s of input.services) {
    const pools = s.poolIds.filter((id) => known.has(id));
    if (pools.length === 0) {
      perServiceSets.set(s.serviceId, new Set(wide));
      continue;
    }
    const [first, ...rest] = pools.map((id) => byPool.get(id) ?? new Set<string>());
    const both = new Set([...(first ?? [])].filter((d) => rest.every((r) => r.has(d))));
    perServiceSets.set(s.serviceId, both);
  }

  let day: Set<string>;
  if (input.services.length > 0) {
    const sets = [...perServiceSets.values()];
    const [first, ...rest] = sets;
    day = new Set([...(first ?? [])].filter((d) => rest.every((r) => r.has(d))));
  } else if (input.pools.length > 0) {
    const sets = [...byPool.values()];
    const [first, ...rest] = sets;
    day = new Set([...(first ?? [])].filter((d) => rest.every((r) => r.has(d))));
  } else {
    day = wide;
  }

  // One answer per day is enough when every service sits on the same schedules.
  const signatures = new Set(input.services.map((s) => [...s.poolIds].filter((id) => known.has(id)).sort().join(',')));
  const perService =
    signatures.size > 1 ? Object.fromEntries([...perServiceSets].map(([id, set]) => [id, sorted(set)])) : null;
  return { notBookable: sorted(day), perService };
}

/** A day's answer from the shipped list. Past days and days outside the window are not answered (null). */
export function checkDateStateOf(
  day: string,
  at: { notBookable: ReadonlySet<string>; today: string; to: string },
): CheckDateState | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < at.today || day > at.to) return null;
  return at.notBookable.has(day) ? 'not_bookable' : 'available';
}

/** "Sat, 22 Nov 2026" — a civil day, never through the viewer's timezone (prototype `nice()`). */
export function checkDateWords(day: string): string {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!hit) return '';
  const at = new Date(Date.UTC(Number(hit[1]), Number(hit[2]) - 1, Number(hit[3])));
  return at.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Where the flow resumes after sign-in: the date and the services ride in the address. */
export function checkDateResumeHref(slug: string, day: string, serviceIds: readonly string[]): string {
  const q = new URLSearchParams({ d: day, step: 'event' });
  if (serviceIds.length > 0) q.set('s', serviceIds.join(','));
  return `${checkADatePath(slug)}?${q.toString()}`;
}

/** The line the shop reads in the chat: the date asked about (the services ride as the conversation's interests). */
export function checkDateAskLine(day: string): string {
  return `Is ${checkDateWords(day)} free? (asked from your Check-a-date code)`;
}
