/**
 * 🔒 A LOCKED TABLE NEVER CHANGES, AND A PARTY NEVER SPLITS (seat plan § 5 hard rules; the controller's review of
 * #8462, 28 Nov). Every way the seater writes:
 *   1. Lock and fill keeps every seat at a locked table (not only the pinned ones), and checks the plan first;
 *   2. the live re-seat never takes a guest off a locked, Spare or Sweetheart table;
 *   3. the keep-apart repair moves a whole party, never one member of it;
 *   4. the independent check refuses a plan that seats a +1 away from the guest who brought them;
 *   5. a +1 whose guest is already seated sits at that table or is shown as not fitting — never somewhere else.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeAutoSeat, reconcileProvisionalSeats, solveSeatPlan, type AutoSeatCannotFit, type AutoSeatGuest, type EventTableRow, type SeatAssignmentRow } from '@/lib/seating';
import { checkAutoSeatPlan } from '@/lib/seat-plan-validator';

const table = (id: string, n: number, over: Partial<EventTableRow> = {}): EventTableRow => ({
  table_id: id,
  public_id: `S89T-${id}`,
  event_id: 'e',
  table_label: `Table ${n}`,
  table_type: 'round_10',
  capacity: 10,
  sort_order: n,
  x_pos: 20 * n,
  y_pos: 50,
  ...over,
});
const guest = (id: string, over: Partial<AutoSeatGuest> = {}): AutoSeatGuest => ({
  guest_id: id,
  role: 'guest',
  group_category: 'friends',
  rsvp_status: 'attending',
  plus_one_of_guest_id: null,
  last_name: id,
  first_name: id,
  group_id: null,
  ...over,
});
const seat = (guest_id: string, table_id: string, seat_number: number, over: Partial<SeatAssignmentRow> = {}): SeatAssignmentRow => ({
  assignment_id: `a-${guest_id}`,
  guest_id,
  table_id,
  seat_number,
  ...over,
});

test('1 · Lock and fill keeps every seat at a locked table, and checks the plan before anything comes off', () => {
  const act = readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'seating', 'actions.ts'), 'utf8');
  const fn = act.slice(act.indexOf('export async function lockAndFill('), act.indexOf('export async function updateTablePosition('));
  assert.match(fn, /const cleared = seatsToClear\(assignments, true, lockedTables\);/);
  assert.match(fn, /const lockedAssignments = seatsThatStay\(assignments, true, lockedTables\);/);
  assert.doesNotMatch(fn, /\.delete\(\)\s*\.eq\('event_id', eventId\)\s*\.eq\('locked', false\);/, 'every unpinned seat is still deleted, locked tables included');
  assert.ok(fn.indexOf('checkAutoSeatPlan(') < fn.indexOf(".from('event_seat_assignments')"), 'the check comes before the delete');
  const auto = act.slice(act.indexOf('export async function autoSeatGuests('), act.indexOf('export async function setSeatingAutoplace('));
  assert.ok(auto.indexOf('checkAutoSeatPlan(') > 0 && auto.indexOf('checkAutoSeatPlan(') < auto.indexOf(".insert("), 'Seat them writes without the check');
  const arrange = act.slice(act.indexOf('export async function autoArrange('), act.indexOf('const NOTHING_SEATED'));
  assert.ok(arrange.indexOf('const planBreaks = checkAutoSeatPlan(') < arrange.indexOf('await persistBooths(supabase, eventId, booths);'), 'a refused plan already moved the tables and booths');
});

test('2 · the live re-seat never moves a guest off a locked table', () => {
  const r = reconcileProvisionalSeats({
    tables: [table('locked', 1, { locked: true }), table('open', 2)],
    guests: [guest('a')],
    assignments: [seat('a', 'locked', 0)],
    reseatGuestIds: ['a'],
  });
  assert.deepEqual(r.assign, []);
  assert.deepEqual(r.release, []);
});

test('3 · the keep-apart repair moves a whole party: a +1 is never left behind', () => {
  // A and their +1 (no group) land at T1 beside X; A must be kept apart from X. The repair moves A — with the +1.
  const tables = [table('t1', 1, { capacity: 3 }), table('t2', 2, { capacity: 3 })];
  const guests = [guest('x', { last_name: 'A' }), guest('a', { last_name: 'B' }), guest('a1', { plus_one_of_guest_id: 'a', last_name: 'C' })];
  const solved = solveSeatPlan({ tables, guests, assignments: [], constraints: [{ guest_a_id: 'x', guest_b_id: 'a' }] });
  const at = new Map(solved.assignments.map((r) => [r.guest_id, r.table_id]));
  assert.equal(solved.violations.length, 0);
  assert.notEqual(at.get('a'), at.get('x'));
  assert.equal(at.get('a1'), at.get('a'), 'the +1 sits with the guest who brought them');
  assert.deepEqual(checkAutoSeatPlan({ tables, guests, existing: [], added: solved.assignments }), []);
});

test('4 · the independent check refuses a +1 away from their guest (but not the host\'s "nearest" sponsor rule)', () => {
  const tables = [table('t1', 1), table('t2', 2), table('vip', 3, { table_kind: 'vip' })];
  const guests = [guest('a'), guest('a1', { plus_one_of_guest_id: 'a' }), guest('n', { role: 'principal_sponsor' }), guest('n1', { plus_one_of_guest_id: 'n' })];
  const split = checkAutoSeatPlan({ tables, guests, existing: [seat('a', 't1', 0)], added: [{ guest_id: 'a1', table_id: 't2', seat_number: 0 }] });
  assert.deepEqual(split.map((b) => b.rule), ['party']);
  const together = checkAutoSeatPlan({ tables, guests, existing: [seat('a', 't1', 0)], added: [{ guest_id: 'a1', table_id: 't1', seat_number: 1 }] });
  assert.deepEqual(together, []);
  const sponsor = { tables, guests, existing: [seat('n', 'vip', 0)], added: [{ guest_id: 'n1', table_id: 't2', seat_number: 1 }] };
  assert.deepEqual(checkAutoSeatPlan({ ...sponsor, nearestVipPlusOnes: true }), [], 'nearest: a sponsor\'s +1 sits near the VIP tables');
  assert.deepEqual(checkAutoSeatPlan(sponsor).map((b) => b.rule), ['party'], 'beside: it must sit with them');
  // A linked run is one table.
  const linked = [table('l1', 1, { link_group_id: 'L' }), table('l2', 2, { link_group_id: 'L' })];
  assert.deepEqual(checkAutoSeatPlan({ tables: linked, guests, existing: [seat('a', 'l1', 0)], added: [{ guest_id: 'a1', table_id: 'l2', seat_number: 0 }] }), []);
});

test('5 · a +1 whose guest is seated at a full or locked table is shown as not fitting, never seated elsewhere', () => {
  for (const at of [table('home', 1, { capacity: 1 }), table('home', 1, { locked: true })]) {
    const cannotFit: AutoSeatCannotFit[] = [];
    const rows = computeAutoSeat([at, table('other', 2)], [guest('a'), guest('a1', { plus_one_of_guest_id: 'a' })], [seat('a', 'home', 0)], undefined, null, undefined, true, null, { cannotFit });
    assert.deepEqual(rows, [], JSON.stringify(at));
    assert.ok(cannotFit.some((c) => c.kind === 'no_room' && c.guestIds.includes('a1')), 'and it is said');
  }
});
