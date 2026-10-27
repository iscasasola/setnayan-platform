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
import {
  COORDINATOR_SEAT_ROLE,
  coordinatingWords,
  eventYouRunOf,
  eventsYouRun,
  seatRunsTheEvent,
  type CoordinatorSeatRow,
} from './events-you-run';

const NOW = new Date('2026-10-28T04:00:00Z');
const TODAY = '2026-10-28';

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
  const [e] = eventsYouRun([seat()], NOW, TODAY);
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
    ['a co-host seat', seat({ role_subtype: 'co_host' })],
    ['the event row is not readable', seat({ events: null })],
  ];
  for (const [why, row] of cases) {
    assert.equal(seatRunsTheEvent(row, NOW), false, `${why}: the door is still drawn`);
    assert.deepEqual(eventsYouRun([row], NOW, TODAY), [], `${why}: still listed`);
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
  const list = eventsYouRun(rows, NOW, TODAY);
  assert.deepEqual(list.map((e) => e.name), ['Today one', 'Reyes debut', 'Santos 50th', 'No date', 'After']);
  assert.equal(list[0]!.status, 'Today');
  assert.match(list[4]!.status, /^Wrapping up · access until Oct 31$/);
  assert.equal(list[3]!.status, 'Date not set yet');
});

test('one row per event, even if two seats name it', () => {
  assert.equal(eventsYouRun([seat(), seat()], NOW, TODAY).length, 1);
});

test('a name is never blank', () => {
  assert.equal(eventYouRunOf(seat({}, { display_name: '  ' }), TODAY)?.name, 'Wedding you run');
  assert.equal(coordinatingWords('Claire & Indalecio'), 'Coordinating Claire & Indalecio');
  assert.equal(coordinatingWords(''), 'Coordinating this event');
});
