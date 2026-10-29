/**
 * 🗓 THE HUB'S EVENTS — the one list the supplier's Hub ▾ picks from (supplier dashboard v13, owner "Approved." 2026-10-29;
 * DECISION_LOG 2026-10-29 "THE SUPPLIER'S BOTTOM BAR = TODAY · CUSTOMERS · SHOP · HUB — 'EVENTS' FOLDS INTO HUB").
 *
 * Two shipped sources, folded into ONE row per celebration — never a second list:
 *   · the days this SHOP is booked on (`fetchVendorRoomEvents` → `collapseToPickerDays`), each with its booking-fee lock;
 *   · the events this PERSON runs as the hosts' coordinator or co-host (`readEventsYouRun`) — the old fifth tab, "Events".
 * An event in both is one row that says "You run it". Which of a celebration's days the row is about is the SHIPPED rule
 * (`pickConfigureDay`: today, else the nearest ahead, else the latest past).
 *
 * The menu groups mirror the prototype's (`pageMenu` for the Hub): Today · Next 7 days · Coming up · Earlier, with
 * events whose date is not set yet after Coming up. Pure — `today` is injected as `YYYY-MM-DD` (Manila), and dates
 * are compared as strings, never as `Date`s (`lib/vendor-day-picker.ts` says why).
 */
import { pickConfigureDay, type VendorDay } from './vendor-day-picker';

export type HubLock = { headline: string; cta: string | null; payHref: string };

export type HubEvent = {
  eventId: string;
  /** The couple's names / the event's name — never blank. */
  name: string;
  /** `YYYY-MM-DD` of the day this row is about, or null (a run event with no date yet). */
  date: string | null;
  when: 'today' | 'upcoming' | 'past' | 'undated';
  /** This person runs it as the hosts' coordinator or co-host. */
  runs: boolean;
  /** This shop holds a booked day on it (the Event Hub, the tools and the crew are the shop's, per booked day). */
  booked: boolean;
  /** The booking fee still locks it — the gate's own words and the bill's link. Null = open. */
  lock: HubLock | null;
  /** The coordinator door into the couple's own event dashboard (`EventYouRun.href`), or null. */
  runHref: string | null;
  /** May they "Message everyone" (the broadcast's own rule, `EventYouRun.canAnnounce`). */
  canAnnounce: boolean;
};

export type HubRunInput = {
  eventId: string;
  name: string;
  date: string | null;
  href: string;
  canAnnounce: boolean;
  /** 0 upcoming · 1 no date yet · 2 after the event — `EventYouRun.rank`. */
  rank: 0 | 1 | 2;
};

const whenOf = (date: string | null, today: string): HubEvent['when'] =>
  date == null ? 'undated' : date === today ? 'today' : date > today ? 'upcoming' : 'past';

/** One row per celebration — booked days and run events folded together. */
export function hubEvents({
  days,
  runs,
  locks,
  today,
}: {
  days: readonly VendorDay[];
  runs: readonly HubRunInput[];
  locks: Readonly<Record<string, HubLock>>;
  today: string;
}): HubEvent[] {
  const out = new Map<string, HubEvent>();
  for (const id of new Set(days.map((d) => d.eventId))) {
    const day = pickConfigureDay(days, id, today);
    if (!day) continue;
    const when = whenOf(day.bookedDate, today);
    out.set(id, {
      eventId: id,
      name: day.eventName.trim() || 'Your event',
      date: day.bookedDate,
      when,
      runs: false,
      booked: true,
      // A past day is never shown locked — there is nothing left to open (the shipped picker's rule).
      lock: when === 'past' ? null : (locks[id] ?? null),
      runHref: null,
      canAnnounce: false,
    });
  }
  for (const r of runs) {
    const had = out.get(r.eventId);
    if (had) {
      out.set(r.eventId, { ...had, runs: true, runHref: r.href, canAnnounce: r.canAnnounce });
      continue;
    }
    const date = r.date && /^\d{4}-\d{2}-\d{2}/.test(r.date) ? r.date.slice(0, 10) : null;
    out.set(r.eventId, {
      eventId: r.eventId,
      name: r.name.trim() || 'Your event',
      date,
      when: r.rank === 2 ? 'past' : whenOf(date, today),
      runs: true,
      booked: false,
      lock: null,
      runHref: r.href,
      canAnnounce: r.canAnnounce,
    });
  }
  const order: Record<HubEvent['when'], number> = { today: 0, upcoming: 1, undated: 2, past: 3 };
  return [...out.values()].sort((a, b) => {
    const w = order[a.when] - order[b.when];
    if (w !== 0) return w;
    // Ahead: soonest first. Past: most recent first.
    if (a.when === 'past') return (b.date ?? '').localeCompare(a.date ?? '');
    return (a.date ?? '').localeCompare(b.date ?? '') || a.name.localeCompare(b.name);
  });
}

/**
 * The event the Hub opens on: the one asked for (`?event=`), else today's, else the next one ahead, else one with no
 * date yet, else the most recent. An id that is not in the list (not theirs) falls back the same way — never an error.
 */
export function pickHubEvent(list: readonly HubEvent[], asked: string | null): HubEvent | null {
  if (asked) {
    const hit = list.find((e) => e.eventId === asked);
    if (hit) return hit;
  }
  return list[0] ?? null;
}

/** `YYYY-MM-DD` + n days, as a string (no `Date` in Manila's calendar — UTC arithmetic on a UTC-noon anchor). */
function plusDays(iso: string, n: number): string {
  const t = Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Which group of the Hub ▾ an event sits in (the prototype's headings). */
export function hubMenuGroup(e: Pick<HubEvent, 'when' | 'date'>, today: string): string {
  if (e.when === 'today') return 'Today';
  if (e.when === 'upcoming') return e.date != null && e.date <= plusDays(today, 7) ? 'Next 7 days' : 'Coming up';
  if (e.when === 'undated') return 'Date not set yet';
  return 'Earlier';
}

/** "Fri, Dec 18" — the day a row names, read as the venue's calendar day. Null when there is no date. */
export function hubDayWords(iso: string | null, withYear = false): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return d.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  });
}

/** The small line under a menu row and on the event card: what this event is to them. */
export function hubRoleWords(e: Pick<HubEvent, 'runs' | 'booked' | 'lock'>): string {
  if (e.lock) return 'Booked · booking fee not paid yet';
  if (e.runs) return 'You run it · coordinator';
  return 'Booked · your service only';
}

/** The Hub's three segments (prototype `segRow`: Set up · Crew · The event's pages), each its own address. */
export const HUB_SEGMENTS = ['setup', 'crew', 'pages'] as const;
export type HubSegment = (typeof HUB_SEGMENTS)[number];
export const HUB_SEGMENT_LABEL: Readonly<Record<HubSegment, string>> = {
  setup: 'Set up',
  crew: 'Crew',
  pages: 'The event’s pages',
};
export const hubSegmentOf = (raw: unknown): HubSegment =>
  (HUB_SEGMENTS as readonly string[]).includes(String(raw)) ? (raw as HubSegment) : 'setup';

/** The Hub's address for one event and segment. */
export function hubHref(eventId: string | null, seg: HubSegment = 'setup'): string {
  const q = new URLSearchParams();
  if (eventId) q.set('event', eventId);
  if (seg !== 'setup') q.set('seg', seg);
  const s = q.toString();
  return `/vendor-dashboard/on-the-day${s ? `?${s}` : ''}`;
}
