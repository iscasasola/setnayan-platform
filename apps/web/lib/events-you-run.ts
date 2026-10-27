/**
 * events-you-run.ts — the events a supplier RUNS as the hosts' coordinator, and the one rule for "live".
 *
 * Owner, verbatim, 2026-10-28 (DECISION_LOG "COORDINATORS GET A DOOR INTO THE EVENTS THEY RUN — APPROVED"):
 * *"for coordinators, since they have access to the whole event as well. we can add that additional menu for them?
 * to enter the event dashboard?"* → *"approved"* on `prototypes/coordinator_door_2026-10-28/`.
 *
 * 🔑 A DOOR, NEVER A GRANT. Nothing here admits anyone anywhere. The couple's event dashboard admits a coordinator
 * through the check it has always made (`app/dashboard/[eventId]/layout.tsx`: an accepted, non-removed
 * `event_moderators` seat), and every area keeps its own enforcement (`moderator_area_level`, the seat's
 * `permissions_json` through `permissionsWithinWindow`). This file only decides whether to DRAW the door — and it
 * draws it for STRICTLY FEWER people than that check admits:
 *
 *   · the seat is the coordinator's (`wedding_planner_external` — the seat `hosts/actions.ts` and
 *     `lib/coordinator-grant.ts` create), accepted, not removed;
 *   · its window is open — the SAME pure rule every permission reader applies (`permissionsWithinWindow`): the hosts'
 *     access never ends, a delegate's ends 7 days after the event;
 *   · the hosts' ONE switch is ON (`coordinatorHasHostAccess`, Event details › Access, owner 2026-10-07) — "Off only
 *     provides them the initial information they received", so an Off coordinator has no event to run and no door.
 *
 * Any of those false → the row, the Events tab and "Open their event" all go, at the next render. Never a dead tab.
 * 🔒 `events-you-run.test.ts` · `app/vendor-dashboard/coordinator-door.test.ts`.
 */
import { delegateAccessLastDay, permissionsWithinWindow } from './delegate-access-window';
import type { ModeratorPermissions } from './delegate-areas';
import { areaCells, coordinatorHasHostAccess } from './people-with-access';

/** The coordinator's seat — the one role this door is for (owner 2026-10-07: "Same as User Host of the event"). */
export const COORDINATOR_SEAT_ROLE = 'wedding_planner_external';

export { EVENTS_YOU_RUN_HREF, EVENTS_YOU_RUN_TIP, EVENTS_YOU_RUN_LEDE } from './events-you-run-words';

export type CoordinatorSeatEvent = {
  event_id: string;
  display_name: string | null;
  event_type: string | null;
  event_date: string | null;
  event_end_date: string | null;
  event_date_precision: string | null;
  venue_name: string | null;
};

/** One `event_moderators` row as the server read returns it (the event embedded). */
export type CoordinatorSeatRow = {
  event_id: string;
  role_subtype: string | null;
  permissions_json: ModeratorPermissions | null;
  accepted_at: string | null;
  removed_at: string | null;
  events: CoordinatorSeatEvent | CoordinatorSeatEvent[] | null;
};

export type EventYouRun = {
  eventId: string;
  /** The couple's names ("Claire & Indalecio") — never blank. */
  name: string;
  /** "Wedding · Sat, Dec 12 · Coordinator" (the Today row) */
  line: string;
  /** "Wedding · Sat, Dec 12 · Seda Vertis North" (the Events page row) */
  placeLine: string;
  /** What the day is to them: "Today" · "Tomorrow" · "In 45 days" · "Wrapping up · access until Dec 19" · "Date not set yet". */
  status: string;
  /** Where Open goes — the couple's own event dashboard, through its shipped check. */
  href: string;
  /** Sort key: 0 upcoming (by date) · 1 no date yet · 2 after the event (still in its window). */
  rank: 0 | 1 | 2;
  date: string | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/**
 * Is THIS seat a live coordinator's? The whole rule, pure — the tab, the Today rows, the Events page and the
 * customer card's "Open their event" all ask it, so they cannot disagree.
 */
export function seatRunsTheEvent(row: CoordinatorSeatRow, now: Date): boolean {
  if (row.role_subtype !== COORDINATOR_SEAT_ROLE) return false;
  if (!row.accepted_at || row.removed_at) return false;
  const ev = one(row.events);
  if (!ev) return false; // the event row is not readable to them — no door to draw
  const perms = permissionsWithinWindow(row.permissions_json, {
    isCouple: false,
    eventDate: ev.event_date,
    eventEndDate: ev.event_end_date,
    precision: ev.event_date_precision,
    now,
  });
  if (!perms) return false; // window closed (or no grant at all)
  return coordinatorHasHostAccess(areaCells(perms));
}

const TYPE_WORD = (t: string | null): string => {
  const s = (t ?? '').trim();
  if (!s) return 'Event';
  return s
    .split(/[_\s]+/)
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
};

const parts = (iso: string | null): [number, number, number] | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

/** "Sat, Dec 12" — read off the calendar day itself, in UTC, so no timezone moves it. */
export function runDayWord(iso: string | null, precision: string | null): string | null {
  const p = parts(iso);
  if (!p) return null;
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  if (precision === 'year') return `Sometime in ${p[0]}`;
  if (precision === 'month') return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const dayNumber = (iso: string): number | null => {
  const p = parts(iso);
  return p ? Date.UTC(p[0], p[1] - 1, p[2]) / 86_400_000 : null;
};

/** One seat → its row's words. `todayIso` is Manila's calendar day (`manilaToday()`). */
export function eventYouRunOf(row: CoordinatorSeatRow, todayIso: string): EventYouRun | null {
  const ev = one(row.events);
  if (!ev) return null;
  const name = ev.display_name?.trim() || `${TYPE_WORD(ev.event_type)} you run`;
  const day = runDayWord(ev.event_date, ev.event_date_precision);
  const typeWord = TYPE_WORD(ev.event_type);
  const dayPrecise = !ev.event_date_precision || ev.event_date_precision === 'day';
  const start = ev.event_date && dayPrecise ? dayNumber(ev.event_date) : null;
  const end = ev.event_end_date && dayPrecise ? dayNumber(ev.event_end_date) : start;
  const today = dayNumber(todayIso);
  let status: string;
  let rank: 0 | 1 | 2;
  if (start === null || today === null) {
    status = ev.event_date ? (day ?? 'Date not set yet') : 'Date not set yet';
    rank = 1;
  } else if (today < start) {
    const n = start - today;
    status = n === 1 ? 'Tomorrow' : `In ${n} days`;
    rank = 0;
  } else if (today <= (end ?? start)) {
    status = 'Today';
    rank = 0;
  } else {
    const last = delegateAccessLastDay({
      isCouple: false,
      eventDate: ev.event_date,
      eventEndDate: ev.event_end_date,
      precision: ev.event_date_precision,
    });
    const lastWord = last ? runDayWord(last, 'day')?.replace(/^\w+, /, '') : null;
    status = lastWord ? `Wrapping up · access until ${lastWord}` : 'Wrapping up';
    rank = 2;
  }
  return {
    eventId: ev.event_id,
    name,
    line: [typeWord, day, 'Coordinator'].filter(Boolean).join(' · '),
    placeLine: [typeWord, day, ev.venue_name?.trim() || null].filter(Boolean).join(' · '),
    status,
    href: `/dashboard/${ev.event_id}`,
    rank,
    date: ev.event_date,
  };
}

/** Every LIVE seat → its row, upcoming first (soonest first), then undated, then the ones wrapping up. */
export function eventsYouRun(rows: readonly CoordinatorSeatRow[], now: Date, todayIso: string): EventYouRun[] {
  const seen = new Set<string>();
  const out: EventYouRun[] = [];
  for (const r of rows) {
    if (!seatRunsTheEvent(r, now)) continue;
    const e = eventYouRunOf(r, todayIso);
    if (!e || seen.has(e.eventId)) continue;
    seen.add(e.eventId);
    out.push(e);
  }
  return out.sort(
    (a, b) => a.rank - b.rank || (a.date ?? '').localeCompare(b.date ?? '') || a.name.localeCompare(b.name),
  );
}

/** The slim dark line inside their event (prototype frame D). */
export function coordinatingWords(eventName: string | null | undefined): string {
  const n = eventName?.trim();
  return n ? `Coordinating ${n}` : 'Coordinating this event';
}
