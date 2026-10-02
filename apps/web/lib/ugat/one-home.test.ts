/**
 * one-home.test.ts — the ONE-HOME check (Root map part 2, slice 2).
 *
 * Both sides of each rule: a fact a table holds twice IS flagged and a fact
 * two unrelated tables share a word for is NOT; an event answer saved outside
 * Your info IS flagged and one Your info reads is NOT; a snapshot is never a
 * second home.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { oneHomeFindings } from './root-map-checks';
import type { ScreenFacts, UgatFieldsMap } from './fields';

const screen = (id: string, reads: string[], writes: string[]): ScreenFacts => ({ id, reads, writes, actions: [], calcs: [] });

function map(over: Partial<UgatFieldsMap> = {}): UgatFieldsMap {
  return {
    version: 1,
    screens: [
      screen('/dashboard/[eventId]/details', ['events.event_date', 'events.region'], []),
      screen('/onboarding/wedding', [], ['events.event_date', 'events.style_preferences.setup.papic', 'events.style_preferences.setup.eventDate']),
      screen('/dashboard/[eventId]/seating', [], ['events.region', 'event_tables.x_pos']),
    ],
    actions: [],
    forms: [],
    writers: [
      { from: 'app/onboarding/wedding/actions.ts', homes: ['events.event_date', 'events.style_preferences.setup.eventDate', 'events.style_preferences.setup.papic'] },
      { from: 'app/seating/actions.ts', homes: ['event_tables.x_pos', 'event_floor_booths.x_pos', 'events.region'] },
      { from: 'lib/snap.ts', homes: ['papic_limited_snapshots.event_date'] },
    ],
    stores: [],
    ...over,
  };
}

const NODES = new Map([
  ['events', ['TYPE-EVENTS']],
  ['event_tables', ['TYPE-SEATPLAN']],
  ['event_floor_booths', ['TYPE-SEATPLAN']],
  ['papic_limited_snapshots', ['TYPE-EVENTS', 'TYPE-PAPIC']],
]);

test('one record holding one answer twice is flagged — the column and the jsonb copy', () => {
  const f = oneHomeFindings(map(), NODES).filter((x) => x.check === 'one-home');
  assert.deepEqual(f.map((x) => x.key), ['event_date: events.event_date + events.style_preferences.setup.eventDate']);
  assert.deepEqual(f[0]!.screens, ['/onboarding/wedding']);
});

test('two tables sharing a word, and a snapshot, are not a second home', () => {
  const keys = oneHomeFindings(map(), NODES).map((x) => x.key).join('\n');
  assert.ok(!keys.includes('x_pos'), 'x_pos on booths and tables is two things');
  assert.ok(!keys.includes('papic_limited_snapshots'), 'a snapshot copies on purpose');
});

test('a browser copy of an event answer is a second home', () => {
  const f = oneHomeFindings(map({ stores: [{ from: 'app/x.tsx', key: 'store:localStorage.setnayan:region' }] }), NODES);
  assert.ok(f.some((x) => x.check === 'one-home' && x.key.includes('store:localStorage.setnayan:region')));
});

test('an event answer Your info does not hold is flagged; one it reads is not', () => {
  const f = oneHomeFindings(map(), NODES).filter((x) => x.check === 'outside-home');
  assert.deepEqual(f.map((x) => x.key), ['events.style_preferences.setup.eventDate', 'events.style_preferences.setup.papic']);
  assert.ok(!f.some((x) => x.key === 'events.region'), 'Your info reads region, so seating writing it is the same field');
});
