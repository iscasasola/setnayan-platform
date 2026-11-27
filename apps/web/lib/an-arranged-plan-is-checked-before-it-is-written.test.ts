/**
 * 🛡 AN AUTO-ARRANGED PLAN IS CHECKED BY CODE THAT SHARES NOTHING WITH THE SOLVER, AND A BROKEN ONE IS NEVER WRITTEN
 * (seat plan § 5 step 7; § 7 "the validator agrees with the solver"). Executed: the checker on hand-made plans, and
 * against the shipped seater on rooms with locked, Spare and removed chairs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { checkAutoSeatPlan, type CheckTable } from '@/lib/seat-plan-validator';
import { computeAutoSeat, type AutoSeatGuest, type EventTableRow } from '@/lib/seating';

const T = (id: string, over: Partial<CheckTable> = {}): CheckTable => ({ table_id: id, table_type: 'round_10', capacity: 4, ...over });
const G = (id: string, rsvp = 'attending') => ({ guest_id: id, rsvp_status: rsvp });

test('each hard rule is caught', () => {
  const tables = [T('a'), T('lock', { locked: true }), T('spare', { table_kind: 'spare' }), T('sw', { table_type: 'sweetheart_2', capacity: 2 }), T('gap', { removed_seats: [1] })];
  const guests = [G('g1'), G('g2'), G('g3'), G('no', 'declined'), G('g5'), G('g6'), G('g7')];
  const rules = (added: Array<{ guest_id: string; table_id: string; seat_number: number | null }>, existing: typeof added = []) =>
    checkAutoSeatPlan({ tables, guests, existing, added }).map((b) => b.rule);
  assert.deepEqual(rules([{ guest_id: 'g1', table_id: 'a', seat_number: 0 }]), []);
  assert.deepEqual(rules([{ guest_id: 'g1', table_id: 'nowhere', seat_number: 0 }]), ['table']);
  assert.deepEqual(rules([{ guest_id: 'g1', table_id: 'a', seat_number: 0 }], [{ guest_id: 'g1', table_id: 'a', seat_number: 1 }]), ['twice']);
  assert.deepEqual(rules([{ guest_id: 'g1', table_id: 'a', seat_number: 9 }]), ['chair']);
  assert.deepEqual(rules([{ guest_id: 'g1', table_id: 'gap', seat_number: 1 }]), ['chair']);
  assert.deepEqual(rules([{ guest_id: 'g1', table_id: 'a', seat_number: 0 }, { guest_id: 'g2', table_id: 'a', seat_number: 0 }]), ['chair']);
  assert.deepEqual(
    rules(['g1', 'g2', 'g3', 'g5', 'g6'].map((g) => ({ guest_id: g, table_id: 'a', seat_number: null }))),
    ['capacity'],
  );
  for (const closed of ['lock', 'spare', 'sw']) assert.deepEqual(rules([{ guest_id: 'g1', table_id: closed, seat_number: 0 }]), ['closed']);
  assert.deepEqual(rules([{ guest_id: 'no', table_id: 'a', seat_number: 0 }]), ['guest']);
});

test('the checker shares no code with the solver', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'lib/seat-plan-validator.ts'), 'utf8'));
  assert.doesNotMatch(src, /from ['"][^'"]*(seating|seat-plan-engine|seat-plan-scope)['"]/);
  assert.doesNotMatch(src, /^import /m, 'the checker imports nothing at all');
});

test('the shipped seater passes the checker on rooms with closed tables and removed chairs', () => {
  const table = (id: string, n: number, over: Partial<EventTableRow> = {}): EventTableRow => ({
    table_id: id, public_id: `S89T-${id}`, event_id: 'e', table_label: `Table ${n}`, table_type: 'round_10', capacity: 10,
    sort_order: n, x_pos: 15 * n, y_pos: 20 + n, ...over,
  });
  for (let seed = 0; seed < 25; seed += 1) {
    const tables = [
      table('t1', 1, { removed_seats: seed % 3 === 0 ? [2, 5] : [] }),
      table('t2', 2, { locked: seed % 2 === 0 }),
      table('t3', 3, { table_kind: seed % 4 === 1 ? 'spare' : 'regular' }),
      table('t4', 4, { capacity: 8 }),
      table('sw', 0, { table_type: 'sweetheart_2', capacity: 2 }),
    ];
    const guests: AutoSeatGuest[] = Array.from({ length: 20 + seed }, (_, i) => ({
      guest_id: `g${seed}-${i}`, role: 'guest', group_category: 'friends',
      rsvp_status: i % 7 === 3 ? 'declined' : i % 5 === 0 ? 'pending' : 'attending',
      plus_one_of_guest_id: i % 6 === 1 ? `g${seed}-${i - 1}` : null,
      last_name: `L${(i * 7) % 11}`, first_name: `F${i}`, group_id: i % 3 === 0 ? 'grp-a' : null,
    }));
    const existing = [{ guest_id: guests[0]!.guest_id, table_id: 't2', seat_number: 0, assignment_id: 'x', locked: false }];
    const added = computeAutoSeat(tables, guests, existing);
    const breaks = checkAutoSeatPlan({ tables, guests, existing, added });
    assert.deepEqual(breaks, [], `seed ${seed}: ${JSON.stringify(breaks)}`);
  }
});

test('auto arrange checks the plan before it writes, and a refusal changes nothing', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/seating/actions.ts'), 'utf8'));
  const check = src.indexOf('checkAutoSeatPlan({ tables: arrangedTables');
  const write = src.indexOf("from('event_seat_assignments').insert(\n      rows.map(", check);
  assert.ok(check > 0 && write > check, 'the check runs before the auto-arrange write');
  const refusal = src.slice(check, write);
  assert.match(refusal, /restoreSeats\.map/, 'the seats taken off go back');
  assert.match(refusal, /from\('event_tables'\)\.delete\(\)/, 'the tables this run added come off');
  assert.match(refusal, /Couldn't make a plan\. Nothing changed\./);
});
