/**
 * lib/supplier-today-next-events.ts — 📸 TODAY'S "NEXT EVENTS" CARD(S) (pure; THE ONE BUILD A3, v113 Today).
 *
 * v113: one photo card for the next booked event; when more than one booking falls on that NEXT EVENT DAY, they are a
 * swipe carousel ("Next events · 2 tomorrow · swipe", "1 of 2" on the photo, no dots — v110 "No dot pagers"). Each card:
 *   · the pill "Today" · "Tomorrow" · "in N days";
 *   · the event's name, "Sun 8 Nov · Taal Vista, Tagaytay";
 *   · "Call time 1:00 PM · Ceremony 3:00 PM" — the supplier's call time is the ONE rule every call-time reader uses
 *     (`earliestTaggedBlock`, the Schedule moments they are tagged on), the programme time is the day's first timed
 *     chapter. A refused schedule read says "Schedule couldn’t load" — never "No call time" on a day that has them;
 *   · chips, each from a shipped fact: Hub ready / Hub not set up (a `vendor_dayof_configs` row for this booking) ·
 *     Balance paid / ₱X due (the payday rows, per booking) · "N hosts in chat" (owner v112 HOLD: *"Keep it"* — from the
 *     hosts the Clients slice adds to `get_vendor_event_brief`; unknown → no chip, never a guessed number);
 *   · the photo is the event's LIVE Hub hero (`readEventCover`, the same image Discover shows); none → the initials.
 *
 * A tap opens that client's HUB PAGE in Clients — never the live `/vendor-dashboard/on-the-day` console.
 *
 * Nothing here reads; the page hands in what it read. 🔒 lib/supplier-today-next-events.test.ts
 */
import { formatCount } from '@/lib/format-number';
import { formatPhp } from '@/lib/php';
import { daysFrom } from '@/lib/vendor-dates';
import { initialsOf, shortDay } from '@/lib/supplier-today';
import type { UpcomingEventRow } from '@/lib/vendor-overview';

/**
 * The picked client's Hub page. ⏳ TYPED STUB until L2's hour-0 push gives `customerCardHref(id, page)` the nine page
 * ids (spec §9 #17); the address is the one B1 §6 fixes (`/vendor-dashboard/clients/<id>?tab=hub`), so the swap is a
 * one-line change and the href does not move.
 */
export function clientHubHref(eventId: string): string {
  return `/vendor-dashboard/clients/${eventId}?tab=hub`;
}

/** What the page read for ONE booking on the next event day. `undefined` = not read; `null` = the read was refused. */
export type NextEventFacts = {
  /** The supplier's call time ("1:00 PM"), null when they are tagged on no timed moment. */
  callTime?: string | null;
  /** The day's first timed chapter ("Ceremony 3:00 PM"), null when the Schedule has none. */
  programme?: string | null;
  /** The schedule read was refused — the time line says so. */
  scheduleUnread?: boolean;
  /** A saved Hub setup for this booking (`vendor_dayof_configs`) — null when that read was refused. */
  hubReady?: boolean | null;
  /** ₱ still to come in on this booking (whole pesos) — 0 = all paid; null/undefined = not known. */
  owedPhp?: number | null;
  /** Hosts in this event's chat — from the Clients slice's brief `hosts`; absent until that read exists. */
  hosts?: number | null;
  /** The live Hub hero, when the event has one. */
  photo?: string | null;
  /** 🌑 On the day itself (owner Q8): the next moment ("3:30 Reception") and how many checked in — from `readEventDayFacts`. */
  dayNext?: string | null;
  checkedIn?: number | null;
};

export type NextEventChip = { id: 'next' | 'checked-in' | 'hub' | 'money' | 'hosts'; word: string; tone: 'ok' | 'wait' | 'quiet' };

export type NextEventCard = {
  key: string;
  eventId: string;
  title: string;
  /** "Tomorrow" · "Today" · "in 5 days". */
  when: string;
  /** "Sun 8 Nov · Taal Vista, Tagaytay". */
  dateLine: string;
  /** "Call time 1:00 PM · Ceremony 3:00 PM" · "Schedule couldn’t load" · null (nothing timed yet). */
  timeLine: string | null;
  timeUnread: boolean;
  chips: NextEventChip[];
  photo: string | null;
  initials: string | null;
  href: string;
  /** "1 of 2" — only when there is more than one. */
  position: string | null;
};

export type NextEvents = {
  /** "2 tomorrow · swipe" · "tomorrow" · "today" · "in 5 days" — the eyebrow's right-hand words. */
  meta: string;
  cards: NextEventCard[];
};

/** "Today" · "Tomorrow" · "in N days" — from Manila's civil date. Null for a date already past. */
export function whenWord(todayIso: string, date: string): string | null {
  const d = daysFrom(todayIso, date);
  if (d === null || d < 0) return null;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return `in ${formatCount(d)} days`;
}

/**
 * The bookings on the NEXT EVENT DAY — the earliest date today or later among the booked rows, every booking on it
 * (never capped at five: two weddings on one Saturday are both shown). Rows outside the future are left out.
 */
export function nextEventDay(rows: readonly UpcomingEventRow[], todayIso: string): UpcomingEventRow[] {
  const ahead = rows.filter((r) => {
    const d = daysFrom(todayIso, r.date);
    return d !== null && d >= 0;
  });
  if (ahead.length === 0) return [];
  const first = ahead.map((r) => r.date).sort()[0]!;
  // One card per event (a booking held on two schedules that day is still one event).
  const seen = new Set<string>();
  return ahead
    .filter((r) => r.date === first)
    .filter((r) => (seen.has(r.eventId) ? false : (seen.add(r.eventId), true)))
    .sort((a, b) => a.eventName.localeCompare(b.eventName));
}

function chipsOf(f: NextEventFacts): NextEventChip[] {
  const chips: NextEventChip[] = [];
  // 🌑 The event day's own two (the retired counts row's "next moment · checked in", owner Q8).
  if (f.dayNext) chips.push({ id: 'next', word: `Next ${f.dayNext}`, tone: 'quiet' });
  if (typeof f.checkedIn === 'number') chips.push({ id: 'checked-in', word: `${formatCount(f.checkedIn)} checked in`, tone: 'quiet' });
  if (f.hubReady === true) chips.push({ id: 'hub', word: 'Hub ready', tone: 'ok' });
  else if (f.hubReady === false) chips.push({ id: 'hub', word: 'Hub not set up', tone: 'wait' });
  if (typeof f.owedPhp === 'number') {
    chips.push(f.owedPhp > 0 ? { id: 'money', word: `${formatPhp(f.owedPhp)} due`, tone: 'wait' } : { id: 'money', word: 'Balance paid', tone: 'ok' });
  }
  if (typeof f.hosts === 'number' && f.hosts > 0) {
    chips.push({ id: 'hosts', word: `${formatCount(f.hosts)} host${f.hosts === 1 ? '' : 's'} in chat`, tone: 'quiet' });
  }
  return chips;
}

function timeLineOf(f: NextEventFacts): { line: string | null; unread: boolean } {
  if (f.scheduleUnread) return { line: 'Schedule couldn’t load', unread: true };
  const parts = [f.callTime ? `Call time ${f.callTime}` : null, f.programme ?? null].filter((p): p is string => Boolean(p));
  return { line: parts.length ? parts.join(' · ') : null, unread: false };
}

export function assembleNextEvents(
  day: readonly UpcomingEventRow[],
  facts: Readonly<Record<string, NextEventFacts>>,
  todayIso: string,
): NextEvents | null {
  if (day.length === 0) return null;
  const when = whenWord(todayIso, day[0]!.date) ?? shortDay(day[0]!.date) ?? day[0]!.date;
  const n = day.length;
  const cards = day.map((r, i) => {
    const f = facts[r.eventId] ?? {};
    const t = timeLineOf(f);
    return {
      key: r.eventId,
      eventId: r.eventId,
      title: r.eventName,
      when,
      dateLine: [shortDay(r.date) ?? r.date, r.place].filter(Boolean).join(' · '),
      timeLine: t.line,
      timeUnread: t.unread,
      chips: chipsOf(f),
      photo: f.photo ?? null,
      initials: initialsOf(r.eventName),
      href: clientHubHref(r.eventId),
      position: n > 1 ? `${formatCount(i + 1)} of ${formatCount(n)}` : null,
    } satisfies NextEventCard;
  });
  const lower = when.charAt(0).toLowerCase() + when.slice(1);
  return { meta: n > 1 ? `${formatCount(n)} ${lower} · swipe` : lower, cards };
}
