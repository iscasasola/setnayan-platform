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
 *
 * 👥 …AND A LIVE CO-HOST SEAT (owner 2026-10-29: *"This is similar to adding them as a cohost which is already in
 * effect. They only need a way to access it and have that menu for them on their account."*). A supplier the hosts
 * made a CO-HOST from the guest list (`event_moderators.role_subtype` a full co-host kind — `seatIsFullCohost`, the
 * mirror of SQL `seat_is_full_cohost`) is a `couple` member of the event, admitted by the dashboard's membership
 * check, with every area. The door is drawn for that seat too, while it is joined (`user_id` theirs, `accepted_at`
 * stamped by `activate_guest_seats`), not removed, and its event readable — and, so the list never grows forever,
 * only until the same seven days after the event a coordinator's window gives (a co-host's ACCESS does not end there;
 * only the list row goes, so this still draws for fewer people than the dashboard admits). A limited helper
 * (`viewer`) views; it does not run the event — no door.
 * 🔒 `events-you-run.test.ts` · `app/vendor-dashboard/coordinator-door.test.ts`.
 */
import { delegateAccessHasExpired, delegateAccessLastDay, permissionsWithinWindow } from './delegate-access-window';
import type { ModeratorPermissions } from './delegate-areas';
import { areaCells, coordinatorHasHostAccess } from './people-with-access';
import type { EventDecisionSummary } from './event-decisions';
import { formatCount } from './format-number';
import { FULL_COHOST_SEAT_KINDS, seatIsFullCohost } from './guest-access';
import { levelOf, type LevelledPermissions } from './coordinator-access-level';

/** The coordinator's seat — the one role this door is for (owner 2026-10-07: "Same as User Host of the event"). */
export const COORDINATOR_SEAT_ROLE = 'wedding_planner_external';

/**
 * Every seat kind that can run an event: the coordinator's, and each full co-host kind. The server read asks for
 * exactly these (`.in('role_subtype', RUN_SEAT_ROLES)`); `seatRunsTheEvent` decides which of them is live.
 */
export const RUN_SEAT_ROLES: readonly string[] = [COORDINATOR_SEAT_ROLE, ...FULL_COHOST_SEAT_KINDS];

/** The word for the seat on the Today row and the customer card's pill. */
export type RunSeatWord = 'Coordinator' | 'Co-host';
export const runSeatWord = (roleSubtype: string | null, permissions?: ModeratorPermissions | null): RunSeatWord =>
  // A coordinator the hosts gave FULL access sits on a co-host seat — still their coordinator (owner 2026-10-29).
  roleSubtype === COORDINATOR_SEAT_ROLE || levelOf({ permissions_json: (permissions ?? null) as LevelledPermissions | null }) !== null
    ? 'Coordinator'
    : 'Co-host';

export { EVENTS_YOU_RUN_HREF, EVENTS_YOU_RUN_TIP, EVENTS_YOU_RUN_LEDE } from './events-you-run-words';

export type CoordinatorSeatEvent = {
  event_id: string;
  display_name: string | null;
  event_type: string | null;
  event_date: string | null;
  event_end_date: string | null;
  event_date_precision: string | null;
  venue_name: string | null;
  /** For the overdue count's anchor + runway (`checklistOverdueCount`) — the same columns the events board reads. */
  date_candidates?: string[] | null;
  date_window_start?: string | null;
  created_at?: string | null;
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
  /** "Wedding · Sat, Dec 12 · Coordinator" — or "· Co-host" (the Today row) */
  line: string;
  /** Which seat runs it — the customer card's pill. */
  seatWord: RunSeatWord;
  /** "Wedding · Sat, Dec 12 · Seda Vertis North" (the Events page row) */
  placeLine: string;
  /** What the day is to them: "Today" · "Tomorrow" · "In 45 days" · "Wrapping up · access until Dec 19" · "Date not set yet". */
  status: string;
  /**
   * 🔔 WHAT NEEDS THEM (owner 2026-10-28: the rows show "3 things need you · …", not the countdown) — the row's
   * accent line. Filled by `withNeeds` from the events board's own attention read (`summarizeEventDecisions`); until
   * then, and whenever that read is refused, it says it could not load — never "nothing needs you".
   */
  needs: string;
  /** The event's date fields, for the overdue count (`checklistOverdueCount`). */
  anchor: { event_type: string | null; event_date: string | null; date_candidates: string[] | null; date_window_start: string | null; created_at: string | null };
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
  if (!row.accepted_at || row.removed_at) return false;
  const ev = one(row.events);
  if (!ev) return false; // the event row is not readable to them — no door to draw
  if (row.role_subtype !== COORDINATOR_SEAT_ROLE) {
    // 👥 A full co-host: every area is theirs (a `couple` member). Live while joined and not removed; listed until
    // the same seven days after the event (the list's limit, not their access's).
    if (!row.role_subtype || !seatIsFullCohost(row.role_subtype)) return false;
    return !delegateAccessHasExpired({
      isCouple: false,
      eventDate: ev.event_date,
      eventEndDate: ev.event_end_date,
      precision: ev.event_date_precision,
      now,
    });
  }
  const perms = permissionsWithinWindow(row.permissions_json, {
    isCouple: false,
    eventDate: ev.event_date,
    eventEndDate: ev.event_end_date,
    precision: ev.event_date_precision,
    now,
  });
  if (!perms) return false; // window closed (or no grant at all)
  // 🔑 The hosts answered LIMITED (owner 2026-10-29, Home's Limited · Full access): she views every part — still her
  // event to open, inside the same window.
  if (levelOf({ permissions_json: row.permissions_json as LevelledPermissions | null }) === 'limited') return true;
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
  const seatWord = runSeatWord(row.role_subtype, row.permissions_json);
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
    // A co-host's access does not end after the event — only the coordinator's does, so only it names a day.
    status = lastWord && row.role_subtype === COORDINATOR_SEAT_ROLE ? `Wrapping up · access until ${lastWord}` : 'Wrapping up';
    rank = 2;
  }
  return {
    eventId: ev.event_id,
    name,
    line: [typeWord, day, seatWord].filter(Boolean).join(' · '),
    seatWord,
    placeLine: [typeWord, day, ev.venue_name?.trim() || null].filter(Boolean).join(' · '),
    status,
    needs: NEEDS_UNREAD,
    anchor: {
      event_type: ev.event_type,
      event_date: ev.event_date,
      date_candidates: ev.date_candidates ?? null,
      date_window_start: ev.date_window_start ?? null,
      created_at: ev.created_at ?? null,
    },
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

/** A refused attention read, said — never "nothing needs you" (collection template, owner 2026-09-24). */
export const NEEDS_UNREAD = 'Couldn’t load what needs you';
/** A measured nothing. */
export const NEEDS_NOTHING = 'Nothing needs you right now';

/**
 * The accent line, from the events board's own summary (`summarizeEventDecisions`: payments to settle · quotes to
 * approve · unread chats · tasks overdue, in that priority). `null` = the read was refused.
 * "3 things need you · 2 quotes to approve" when more is waiting than the top line names (prototype frame B), else
 * the top line alone ("2 quotes to approve") so one number is never said twice.
 */
export function needsLine(summary: EventDecisionSummary | null): string {
  if (summary === null) return NEEDS_UNREAD;
  if (summary.total <= 0 || !summary.top) return NEEDS_NOTHING;
  if (summary.total > summary.top.count) {
    return `${formatCount(summary.total)} ${summary.total === 1 ? 'thing needs' : 'things need'} you · ${summary.top.label}`;
  }
  return summary.top.label;
}

/** Each row with its line, from a summary per event id (`null` / missing = refused). Pure. */
export function withNeeds(
  events: readonly EventYouRun[],
  summaries: ReadonlyMap<string, EventDecisionSummary | null>,
): EventYouRun[] {
  return events.map((e) => ({ ...e, needs: needsLine(summaries.has(e.eventId) ? summaries.get(e.eventId)! : null) }));
}

/** The slim dark line inside their event (prototype frame D). */
export function coordinatingWords(eventName: string | null | undefined): string {
  const n = eventName?.trim();
  return n ? `Coordinating ${n}` : 'Coordinating this event';
}
