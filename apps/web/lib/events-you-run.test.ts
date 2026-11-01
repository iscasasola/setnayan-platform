/**
 * events-you-run.test.ts — the coordinator's door is drawn ONLY for live coordinator access (owner "approved",
 * 2026-10-28, DECISION_LOG "COORDINATORS GET A DOOR INTO THE EVENTS THEY RUN").
 *
 * Asked of the pure rule every door reads (`seatRunsTheEvent` / `eventsYouRun`): the Today rows, the Events tab, the
 * Events page and "Open their event" cannot disagree, because they all ask this. Each case below flips ONE fact off a
 * live seat and expects the door gone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { COORDINATOR_AREAS, type ModeratorPermissions } from './delegate-areas';
import { COORDINATOR_ON_AREAS } from './people-with-access';
import { FULL_COHOST_SEAT_KINDS, seatIsFullCohost } from './guest-access';
import { summarizeEventDecisions } from './event-decisions';
import {
  NEEDS_NOTHING,
  NEEDS_UNREAD,
  needsLine,
  withNeeds,
  COORDINATOR_SEAT_ROLE,
  RUN_SEAT_ROLES,
  coordinatingWords,
  eventYouRunOf,
  eventsYouRun,
  seatRunsTheEvent,
  shopServesTheEvent,
  type CoordinatorSeatRow,
} from './events-you-run';

const NOW = new Date('2026-10-28T04:00:00Z');
const TODAY = '2026-10-28';
/** (a) The events THIS SHOP is on (a live `event_vendors` row pointing at the active shop) — every fixture event. */
const SERVED: ReadonlySet<string> = new Set(['e-1', 'a', 'b', 'c', 'd', 'e']);

/** The grant every coordinator seat is created with — `lib/coordinator-grant.ts`, `hosts/actions.ts`. */
const ON: ModeratorPermissions = { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { ...COORDINATOR_AREAS } };
/** The hosts' switch Off: every settable area Off (`coordinatorSwitchWrites(…, false)`). */
const OFF: ModeratorPermissions = {
  ...ON,
  areas: Object.fromEntries(COORDINATOR_ON_AREAS.map((a) => [a, null])) as ModeratorPermissions['areas'],
};

const seat = (over: Partial<CoordinatorSeatRow> = {}, ev: Partial<NonNullable<CoordinatorSeatRow['events']> & object> = {}): CoordinatorSeatRow => ({
  event_id: 'e-1',
  role_subtype: COORDINATOR_SEAT_ROLE,
  permissions_json: ON,
  accepted_at: '2026-10-01T00:00:00Z',
  removed_at: null,
  events: {
    event_id: 'e-1',
    display_name: 'Claire & Indalecio',
    event_type: 'wedding',
    event_date: '2026-12-12',
    event_end_date: null,
    event_date_precision: 'day',
    venue_name: 'Seda Vertis North',
    ...ev,
  },
  ...over,
});

test('a live coordinator seat runs the event — and its door is the couple’s own dashboard', () => {
  assert.equal(seatRunsTheEvent(seat(), NOW), true);
  const [e] = eventsYouRun([seat()], NOW, TODAY, SERVED);
  assert.ok(e);
  assert.equal(e.href, '/dashboard/e-1', 'the door must be the shipped event dashboard address, nothing new');
  assert.equal(e.name, 'Claire & Indalecio');
  assert.equal(e.line, 'Wedding · Sat, Dec 12 · Coordinator');
  assert.equal(e.placeLine, 'Wedding · Sat, Dec 12 · Seda Vertis North');
  assert.equal(e.status, 'In 45 days');
});

test('🔑 each way the access ends takes the door away', () => {
  const cases: Array<[string, CoordinatorSeatRow]> = [
    ['the hosts turned the switch off', seat({ permissions_json: OFF })],
    ['no grant at all', seat({ permissions_json: null })],
    ['removed by the hosts', seat({ removed_at: '2026-10-20T00:00:00Z' })],
    ['never accepted', seat({ accepted_at: null })],
    ['the window after the event closed (7 days)', seat({}, { event_date: '2026-10-20' })],
    ['a helper seat, not the coordinator’s', seat({ role_subtype: 'viewer' })],
    // (A co-host seat used to be on this list; owner 2026-10-29 widened the door to a live co-host — see below.)
    ['an unknown seat kind', seat({ role_subtype: 'photographer' })],
    ['no seat kind at all', seat({ role_subtype: null })],
    ['the event row is not readable', seat({ events: null })],
  ];
  for (const [why, row] of cases) {
    assert.equal(seatRunsTheEvent(row, NOW), false, `${why}: the door is still drawn`);
    assert.deepEqual(eventsYouRun([row], NOW, TODAY, SERVED), [], `${why}: still listed`);
  }
});

test('the window is the shipped one: day seven after the event is still open, day eight is not', () => {
  assert.equal(seatRunsTheEvent(seat({}, { event_date: '2026-10-21' }), NOW), true, 'day 7 after must still be open');
  assert.equal(seatRunsTheEvent(seat({}, { event_date: '2026-10-20' }), NOW), false, 'day 8 after must be closed');
  // No date / an imprecise date never closes a coordinator out (the shipped rule's own refusal to guess).
  assert.equal(seatRunsTheEvent(seat({}, { event_date: null }), NOW), true);
  assert.equal(seatRunsTheEvent(seat({}, { event_date: '2026-01-01', event_date_precision: 'year' }), NOW), true);
});

test('upcoming first (soonest first), then undated, then the ones wrapping up', () => {
  const rows = [
    seat({ event_id: 'a' }, { event_id: 'a', display_name: 'Santos 50th', event_date: '2027-02-14' }),
    seat({ event_id: 'b' }, { event_id: 'b', display_name: 'After', event_date: '2026-10-24' }),
    seat({ event_id: 'c' }, { event_id: 'c', display_name: 'No date', event_date: null }),
    seat({ event_id: 'd' }, { event_id: 'd', display_name: 'Reyes debut', event_date: '2026-11-17' }),
    seat({ event_id: 'e' }, { event_id: 'e', display_name: 'Today one', event_date: TODAY }),
  ];
  const list = eventsYouRun(rows, NOW, TODAY, SERVED);
  assert.deepEqual(list.map((e) => e.name), ['Today one', 'Reyes debut', 'Santos 50th', 'No date', 'After']);
  assert.equal(list[0]!.status, 'Today');
  assert.match(list[4]!.status, /^Wrapping up · access until Oct 31$/);
  assert.equal(list[3]!.status, 'Date not set yet');
});

test('one row per event, even if two seats name it', () => {
  assert.equal(eventsYouRun([seat(), seat()], NOW, TODAY, SERVED).length, 1);
});

test('a name is never blank', () => {
  assert.equal(eventYouRunOf(seat({}, { display_name: '  ' }), TODAY)?.name, 'Wedding you run');
  assert.equal(coordinatingWords('Claire & Indalecio'), 'Coordinating Claire & Indalecio');
  assert.equal(coordinatingWords(''), 'Coordinating this event');
});

/* ── 🔔 WHAT NEEDS THEM (owner 2026-10-28: "3 things need you · …", not the countdown) ─────────────────────── */


test('the line is the events board’s own summary — total first only when it says more than the top line', () => {
  assert.equal(needsLine(summarizeEventDecisions({ pay: 0, approve: 2, message: 1, overdue: 0 })), '3 things need you · 2 quotes to approve');
  assert.equal(needsLine(summarizeEventDecisions({ pay: 0, approve: 2, message: 0, overdue: 0 })), '2 quotes to approve');
  assert.equal(needsLine(summarizeEventDecisions({ pay: 1, approve: 0, message: 0, overdue: 0 })), '1 payment to settle');
  assert.equal(needsLine(summarizeEventDecisions({ pay: 0, approve: 0, message: 0, overdue: 0 })), NEEDS_NOTHING);
});

test('⛔ a refused read is said — never “nothing needs you”', () => {
  assert.equal(needsLine(null), NEEDS_UNREAD);
  const rows = eventsYouRun([seat()], NOW, TODAY, SERVED);
  // Before the read lands, and for an event the read did not answer, the row says it could not load.
  assert.equal(rows[0]!.needs, NEEDS_UNREAD);
  assert.equal(withNeeds(rows, new Map())[0]!.needs, NEEDS_UNREAD);
  assert.equal(withNeeds(rows, new Map([['e-1', null]]))[0]!.needs, NEEDS_UNREAD);
  assert.notEqual(NEEDS_UNREAD, NEEDS_NOTHING);
});

test('the row carries the event’s date fields for the overdue count', () => {
  const [e] = eventsYouRun([seat({}, { date_candidates: ['2026-12-12'], created_at: '2026-06-01T00:00:00Z' })], NOW, TODAY, SERVED);
  assert.deepEqual(e!.anchor, { event_type: 'wedding', event_date: '2026-12-12', date_candidates: ['2026-12-12'], date_window_start: null, created_at: '2026-06-01T00:00:00Z' });
});

/* ── 👥 A LIVE CO-HOST SEAT RUNS THE EVENT TOO (owner 2026-10-29: "This is similar to adding them as a cohost which
   is already in effect. They only need a way to access it and have that menu for them on their account.") ──────── */

/** The co-host seat the hosts granted a SUPPLIER through Home's "Full access" (`levelWrite('full')`). */
const FULL_ACCESS = { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: true, access_level: 'full' } as ModeratorPermissions;
/** A genuine co-host's seat — the partner / family kind, no supplier answer recorded on it. */
const GENUINE_COHOST: ModeratorPermissions = { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: true };

const cohost = (over: Partial<CoordinatorSeatRow> = {}, ev: Partial<NonNullable<CoordinatorSeatRow['events']> & object> = {}) =>
  seat({ role_subtype: 'co_host', permissions_json: FULL_ACCESS, ...over }, ev);

test('👥 a live "Full access" co-host seat gets the door — the same event dashboard', () => {
  assert.equal(seatRunsTheEvent(cohost(), NOW), true);
  const [e] = eventsYouRun([cohost()], NOW, TODAY, SERVED);
  assert.ok(e);
  assert.equal(e.href, '/dashboard/e-1');
  // The hosts gave their COORDINATOR full access — still their coordinator (owner 2026-10-29, `runSeatWord`).
  assert.equal(e.line, 'Wedding · Sat, Dec 12 · Coordinator');
  assert.equal(e.seatWord, 'Coordinator');
  // The coordinator's row still says Coordinator.
  assert.equal(eventsYouRun([seat()], NOW, TODAY, SERVED)[0]!.seatWord, 'Coordinator');
  // Every full co-host kind (the SQL `seat_is_full_cohost` mirror) is a run seat; the read asks for each.
  for (const k of FULL_COHOST_SEAT_KINDS) {
    assert.equal(seatRunsTheEvent(cohost({ role_subtype: k }), NOW), true, `${k} is a full co-host but gets no door`);
    assert.ok(RUN_SEAT_ROLES.includes(k), `the read never asks for ${k}`);
  }
  assert.ok(RUN_SEAT_ROLES.includes(COORDINATOR_SEAT_ROLE));
  assert.ok(!RUN_SEAT_ROLES.includes('viewer'), 'a limited helper views — it does not run the event');
  assert.equal(seatIsFullCohost('viewer'), false);
});

test('👥 a Full-access co-host seat needs no switch — every area is theirs — but each way the seat ends takes the door', () => {
  // The hosts' coordinator switch is a coordinator thing: a co-host carries no `areas`, and still runs the event.
  assert.equal(seatRunsTheEvent(cohost({ permissions_json: FULL_ACCESS }), NOW), true);
  const cases: Array<[string, CoordinatorSeatRow]> = [
    ['removed (the guest’s Access set to None)', cohost({ removed_at: '2026-10-20T00:00:00Z' })],
    ['not joined yet', cohost({ accepted_at: null })],
    ['the event row is not readable', cohost({ events: null })],
    ['a week after the event (the list’s limit)', cohost({}, { event_date: '2026-10-20' })],
  ];
  for (const [why, row] of cases) {
    assert.equal(seatRunsTheEvent(row, NOW), false, `${why}: the co-host door is still drawn`);
    assert.deepEqual(eventsYouRun([row], NOW, TODAY, SERVED), [], `${why}: still listed`);
  }
});

test('👥 after the event a co-host row never claims their access ends — only a coordinator’s does', () => {
  const [c] = eventsYouRun([cohost({}, { event_date: '2026-10-24' })], NOW, TODAY, SERVED);
  assert.equal(c!.status, 'Wrapping up');
  const [k] = eventsYouRun([seat({}, { event_date: '2026-10-24' })], NOW, TODAY, SERVED);
  assert.equal(k!.status, 'Wrapping up · access until Oct 31');
});

/* ── 🛑 ONLY EVENTS THIS SHOP SERVES, ONLY THROUGH A SEAT A SUPPLIER GETS (fixed 2026-10-29) ─────────────────────────
   The owner opened his shop's Today and found his OWN wedding — "Indalecio & Claire · Wedding · Co-host · 29 tasks
   overdue" — under "Events you run". His shop was not on that event (its coordinator was another shop); his account
   holds a genuine co-host seat on his own event. A row now needs (a) this shop on the event AND (b) a supplier's seat. */

test('🛑 REGRESSION — a host’s own event never appears under their shop’s Events you run', () => {
  // The host's own seat on the wedding he hosts: a genuine co-host (no supplier answer recorded), joined, live.
  const hostsOwnSeat = cohost({ permissions_json: GENUINE_COHOST }, { display_name: 'Indalecio & Claire', event_date: '2026-12-18' });
  // His shop is NOT on the event (the booked coordinator is a different shop) …
  assert.deepEqual(eventsYouRun([hostsOwnSeat], NOW, TODAY, new Set()), [], 'the host’s own event is listed under his shop');
  // … and even if it were (say he once added his own shop to his own wedding), a partner’s seat is not a supplier’s.
  assert.deepEqual(eventsYouRun([hostsOwnSeat], NOW, TODAY, SERVED), [], 'a genuine co-host seat is listed as an event the shop runs');
  assert.equal(seatRunsTheEvent(hostsOwnSeat, NOW), false);
  for (const k of FULL_COHOST_SEAT_KINDS) {
    assert.equal(seatRunsTheEvent(cohost({ role_subtype: k, permissions_json: GENUINE_COHOST }), NOW), false, `${k} with no supplier answer runs the event`);
    assert.equal(seatRunsTheEvent(cohost({ role_subtype: k, permissions_json: null }), NOW), false, `${k} with no grant runs the event`);
  }
  // A Limited answer on a co-host seat is not Full access either.
  assert.equal(seatRunsTheEvent(cohost({ permissions_json: { ...GENUINE_COHOST, access_level: 'limited' } as ModeratorPermissions }), NOW), false);
});

test('🛑 (a) a live supplier seat is listed ONLY when this shop is on the event', () => {
  for (const [why, row] of [
    ['a live coordinator seat', seat()],
    ['a live Full-access co-host seat', cohost()],
  ] as const) {
    assert.equal(eventsYouRun([row], NOW, TODAY, SERVED).length, 1, `${why} on an event this shop serves is not listed`);
    assert.deepEqual(eventsYouRun([row], NOW, TODAY, new Set()), [], `${why} is listed on an event this shop is not on`);
    assert.deepEqual(eventsYouRun([row], NOW, TODAY, new Set(['some-other-event'])), [], `${why} borrowed another event’s bond`);
  }
  // The bond is read off the seat's own event: an unreadable event never borrows one.
  assert.equal(shopServesTheEvent(seat({ events: null }), SERVED), false);
  assert.equal(shopServesTheEvent(seat({ event_id: 'e-1' }, { event_id: 'other' }), SERVED), false);
  // Mixed: two seats, one event the shop serves — exactly that one.
  const mixed = eventsYouRun([seat(), seat({ event_id: 'z' }, { event_id: 'z', display_name: 'Not ours' })], NOW, TODAY, new Set(['e-1']));
  assert.deepEqual(mixed.map((e) => e.eventId), ['e-1']);
});
