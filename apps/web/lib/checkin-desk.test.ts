/**
 * checkin-desk.test.ts — 🛂 THE CHECK-IN DESK IN THREE PARTS (owner 16 Nov 2026, "Yes, as drawn").
 *
 *   (1) Who runs the desk: hosts always every part; the starting defaults are owner answer 3 (coordinator all three,
 *       helpers Guests, supplier Off); a stored empty list is the hosts' Off, never "everything";
 *   (2) a supplier gets parts ONLY when they are the one the hosts picked for the door;
 *   (3) Suppliers: arrival is the shipped "On site" preset against `arrive_clock` — On time · Late · Not yet — and the
 *       board reads ONLY the four arrival presets (the two `issue` presets are the coordinator's inbox);
 *   (4) Team: this phone first, then whoever scanned or handed a souvenir, active within five minutes;
 *   (5) the page and the actions ask ONE reader (`readDeskViewer`), so a part the page hides is a part the action refuses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARRIVAL_PRESETS,
  DEFAULT_DESK_ACCESS,
  arrivalsBoard,
  deskRoleOf,
  parseDeskAccess,
  partsForRole,
  serializeDeskAccess,
  teamOnDesk,
} from './checkin-desk';
import { VENDOR_STATUS_PRESETS } from './day-requests';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

test('(1) hosts always run every part; the defaults are owner answer 3; an empty list is Off', () => {
  assert.deepEqual(partsForRole('host', parseDeskAccess({ coordinator: [], helpers: [] }), U1), ['guests', 'suppliers', 'team']);
  const d = parseDeskAccess(null);
  assert.deepEqual(d, DEFAULT_DESK_ACCESS);
  assert.deepEqual(partsForRole('coordinator', d, U1), ['guests', 'suppliers', 'team']);
  assert.deepEqual(partsForRole('helper', d, U1), ['guests']);
  assert.deepEqual(partsForRole('supplier', d, U1), []);
  assert.deepEqual(partsForRole('helper', parseDeskAccess({ helpers: [] }), U1), []);
  assert.deepEqual(parseDeskAccess({ helpers: ['team', 'nope', 'guests', 'team'] }).helpers, ['guests', 'team']);
  assert.deepEqual(partsForRole(null, d, U1), []);
});

test('(2) only THE picked supplier at the door gets parts', () => {
  const a = parseDeskAccess(serializeDeskAccess({ ...DEFAULT_DESK_ACCESS, door: { userId: U1, parts: ['guests'] } }));
  assert.deepEqual(partsForRole('supplier', a, U1), ['guests']);
  assert.deepEqual(partsForRole('supplier', a, U2), []);
  assert.equal(parseDeskAccess({ door: { user_id: 'not-a-uuid', parts: ['guests'] } }).door, null);
  assert.equal(parseDeskAccess({ door: { user_id: U1, parts: [] } }).door, null);
});

test('(2b) the desk role comes from facts the event holds', () => {
  const base = { isHost: false, bookedCoordinator: false, supplierProposesOnly: false, seatRole: null, isCoordinatorMember: false };
  assert.equal(deskRoleOf({ ...base, isHost: true, supplierProposesOnly: true }), 'host');
  assert.equal(deskRoleOf({ ...base, bookedCoordinator: true, seatRole: 'wedding_planner_external' }), 'coordinator');
  assert.equal(deskRoleOf({ ...base, supplierProposesOnly: true, seatRole: 'wedding_planner_external' }), 'supplier');
  assert.equal(deskRoleOf({ ...base, seatRole: 'wedding_planner_external' }), 'coordinator');
  assert.equal(deskRoleOf({ ...base, seatRole: 'viewer' }), 'helper');
  assert.equal(deskRoleOf({ ...base, isCoordinatorMember: true }), 'coordinator');
  assert.equal(deskRoleOf(base), null);
});

test('(3) the arrivals board: the shipped presets against their own times', () => {
  // The four presets the board reads are exactly the shipped status_update presets — not a second mechanism.
  assert.deepEqual(
    [...ARRIVAL_PRESETS],
    VENDOR_STATUS_PRESETS.filter((p) => p.kind === 'status_update').map((p) => p.key),
  );
  const day = Date.parse('2026-12-12T00:00:00Z');
  const wallToMs = (hhmm: string) => day + (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))) * 60_000;
  const clockOf = (iso: string) => iso.slice(11, 16);
  const ownClock = (hhmm: string) => hhmm;
  const { lines, here } = arrivalsBoard({
    suppliers: [
      { vendorProfileId: 'a', name: 'Lumière Studio' },
      { vendorProfileId: 'b', name: 'Casa Verde Catering' },
      { vendorProfileId: 'c', name: 'Taal Vista Hotel' },
      { vendorProfileId: 'd', name: 'Makati Florals' },
      { vendorProfileId: 'e', name: 'Late Band' },
    ],
    rows: [
      { vendorProfileId: 'a', presetKey: 'on_site', at: '2026-12-12T11:52:00Z' },
      { vendorProfileId: 'a', presetKey: 'on_site', at: '2026-12-12T13:30:00Z' }, // a second press never makes them late
      { vendorProfileId: 'a', presetKey: 'setup_done', at: '2026-12-12T12:40:00Z' },
      { vendorProfileId: 'b', presetKey: 'running_late', at: '2026-12-12T13:50:00Z' }, // an issue, not an arrival
      { vendorProfileId: 'e', presetKey: 'on_site', at: '2026-12-12T15:10:00Z' },
    ],
    times: new Map([
      ['a', { arrive: '12:00', done: null }],
      ['b', { arrive: '14:00', done: null }],
      ['c', { arrive: '16:00', done: null }],
      ['e', { arrive: '15:00', done: null }],
    ]),
    nowMs: Date.parse('2026-12-12T14:20:00Z'),
    wallToMs,
    clockOf,
    ownClock,
  });
  assert.equal(here, 2);
  assert.deepEqual(
    lines.map((l) => [l.name, l.verdict, l.line]),
    [
      ['Lumière Studio', 'on_time', 'On site 11:52 · due 12:00 · Setup done 12:40'],
      ['Casa Verde Catering', 'late', 'Due 14:00 · 20m ago'],
      ['Taal Vista Hotel', 'not_yet', 'Due 16:00'],
      ['Makati Florals', 'not_yet', 'No times yet'],
      ['Late Band', 'late', 'On site 15:10 · due 15:00'],
    ],
  );
  assert.equal(lines[3]?.noTimes, true);
});

test('(4) the Team part: this phone first, then who worked the desk', () => {
  const now = Date.parse('2026-12-12T16:45:00Z');
  const lines = teamOnDesk({
    viewerId: U1,
    viewerRole: 'host',
    activity: [
      { userId: U2, at: '2026-12-12T16:43:00Z', kind: 'scan' },
      { userId: U2, at: '2026-12-12T16:30:00Z', kind: 'scan' },
      { userId: 'h', at: '2026-12-12T16:39:00Z', kind: 'souvenir' },
      { userId: null, at: '2026-12-12T16:44:00Z', kind: 'scan' },
    ],
    people: new Map([
      [U1, { name: 'Maria', role: 'host' as const }],
      [U2, { name: 'Liza Ramos', role: 'coordinator' as const }],
      ['h', { name: 'Tito Ben', role: 'helper' as const }],
    ]),
    nowMs: now,
  });
  assert.deepEqual(
    lines.map((l) => [l.name, l.line, l.status]),
    [
      ['Maria', 'Host · this phone', 'On the desk'],
      ['Liza Ramos', 'Coordinator · 2 scans', 'Scanning'],
      ['Tito Ben', 'Helper · Souvenir table', 'Away 6m'],
    ],
  );
});

test('(5) the page and the actions ask the one reader', () => {
  const dir = join(process.cwd(), 'app/dashboard/[eventId]/guests/checkin');
  const page = readFileSync(join(dir, 'page.tsx'), 'utf8');
  const actions = readFileSync(join(dir, 'actions.ts'), 'utf8');
  assert.match(page, /readDeskViewer\(/);
  assert.match(actions, /readDeskViewer\(/);
  // Both writes the Guests part makes are asked again at the write.
  assert.equal((actions.match(/deskPartRefusal\(eventId, \w+, 'guests'\)/g) ?? []).length, 2);
});
