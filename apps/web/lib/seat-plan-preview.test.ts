/**
 * 🪑 THE AUTO-ARRANGE PREVIEW (seat plan § 4.6, preview D). Executed on the shipped seater: the preview writes nothing,
 * names what changes per table, keeps a 🔒 table as it is, names repairs when nothing fits, and hands Accept a plan
 * whose base is the fingerprint `apply_seat_plan` checks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DEFAULT_FLOOR_PLAN, type EventTableRow, type SeatAssignmentRow } from '@/lib/seating';
import {
  buildArrangePreview,
  parseArrangePlan,
  previewSummaryWords,
  repairWords,
  seatPlanBase,
  type ArrangePreviewInput,
} from '@/lib/seat-plan-preview';
import type { DryRunGuest } from '@/lib/seat-plan-dry-run';

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
const guest = (id: string, over: Partial<DryRunGuest> = {}): DryRunGuest => ({
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
let n = 0;
const seat = (guest_id: string, table_id: string, over: Partial<SeatAssignmentRow> = {}): SeatAssignmentRow => ({
  assignment_id: `a${n++}`,
  guest_id,
  table_id,
  seat_number: n,
  ...over,
});
const input = (over: Partial<ArrangePreviewInput>): ArrangePreviewInput => ({
  tables: [],
  newTables: [],
  positions: {},
  guests: [],
  assignments: [],
  scope: 'unseated',
  keep: new Set(),
  constraints: [],
  memberships: new Map(),
  groupLabels: new Map(),
  floor: DEFAULT_FLOOR_PLAN,
  ...over,
});

test('the base is the same fingerprint the database computes (order and "-" for no chair)', () => {
  const a = seatPlanBase([
    { guest_id: 'b', table_id: 't', seat_number: null },
    { guest_id: 'a', table_id: 't', seat_number: 3 },
  ]);
  const b = seatPlanBase([
    { guest_id: 'a', table_id: 't', seat_number: 3 },
    { guest_id: 'b', table_id: 't', seat_number: null },
  ]);
  assert.equal(a, b);
  assert.equal(a, createHash('md5').update('a:t:3,b:t:-').digest('hex'));
  assert.equal(seatPlanBase([]), 'd41d8cd98f00b204e9800998ecf8427e', 'no seats hashes the empty string');
});

const oldSeats = [seat('old', 't1')];

test('only the unseated: counts, the tables that change with their reason, and a plan for Accept', () => {
  const p = buildArrangePreview(
    input({
      tables: [table('t1', 1)],
      guests: [guest('old'), guest('ana', { group_id: 'g', side: 'bride' }), guest('ben', { group_id: 'g', side: 'bride' }), guest('no', { rsvp_status: 'declined' })],
      assignments: oldSeats,
      groupLabels: new Map([['g', 'Reyes family']]),
    }),
  );
  assert.ok(p.ok);
  assert.equal(p.seated, 3);
  assert.equal(p.coming, 3, 'a declined guest is not coming');
  assert.equal(p.newSeats, 2);
  assert.equal(previewSummaryWords(p), '3 of 3 seated · 0 rules broken · 0 wishes not met · 2 guests get a seat');
  assert.equal(p.tables.length, 1);
  assert.deepEqual(p.tables[0]!.added.sort(), ['ana', 'ben']);
  assert.equal(p.tables[0]!.reason, 'Reyes family · 2 parties · bride’s side');
  assert.deepEqual(p.plan.clear, []);
  assert.equal(p.plan.rows.length, 2);
  assert.equal(p.plan.base, seatPlanBase(oldSeats), 'the base is the seats the preview started from');
});

test('the preview writes nothing: no client, no query, no action in the file', () => {
  const src = readFileSync(join(__dirname, 'seat-plan-preview.ts'), 'utf8');
  assert.doesNotMatch(src, /supabase|\.from\(|\.rpc\(|\.insert\(|\.upsert\(|\.delete\(|'use server'/); // (.update( is the md5 hash)
});

test('seat everyone again: unlocked seats come off, a 🔒 table in the preview keeps its people', () => {
  const tables = [table('t1', 1), table('t2', 2)];
  const assignments = [seat('a', 't1'), seat('b', 't2'), seat('pinned', 't1', { locked: true })];
  const guests = [guest('a'), guest('b'), guest('pinned')];
  const all = buildArrangePreview(input({ tables, guests, assignments, scope: 'all' }));
  assert.ok(all.ok);
  assert.deepEqual([...all.plan.clear].sort(), ['a', 'b'], 'a pinned seat never comes off');
  const kept = buildArrangePreview(input({ tables, guests, assignments, scope: 'all', keep: new Set(['t2']) }));
  assert.ok(kept.ok);
  assert.deepEqual(kept.plan.clear, ['a'], 'the 🔒 table keeps b');
  assert.ok(kept.plan.rows.every((r) => r.table !== 't2'), 'and nobody is added to it');
});

test('a new table for room is in the plan only when a seat lands at it, with its laid-out place', () => {
  const p = buildArrangePreview(
    input({
      tables: [table('t1', 1, { capacity: 2 })],
      newTables: [
        { type: 'round_10', capacity: 10, label: 'Table 2', x: 40, y: 60 },
        { type: 'round_10', capacity: 10, label: 'Table 3' },
      ],
      guests: [guest('a'), guest('b'), guest('c'), guest('d')],
    }),
  );
  assert.ok(p.ok);
  assert.deepEqual(p.plan.newTables.map((t) => t.key), ['Table 2']);
  assert.deepEqual([p.plan.newTables[0]!.x, p.plan.newTables[0]!.y], [40, 60]);
  assert.ok(p.plan.rows.some((r) => r.table === 'new:Table 2'));
});

test('not enough chairs: the repair says how many are coming, how many chairs, and how many tables to add', () => {
  const p = buildArrangePreview(
    input({
      tables: [table('t1', 1, { capacity: 2 })],
      guests: [guest('a'), guest('b'), guest('c'), guest('d'), guest('e')],
    }),
  );
  assert.ok(p.ok);
  const add = p.repairs.find((r) => r.kind === 'add_tables');
  assert.ok(add);
  assert.equal(repairWords(add, (id) => id, (t) => t), 'Not enough seats: 5 coming, 2 chairs. Add 1 table');
});

test('a party bigger than any gap: add the missing seats to the table with the biggest gap', () => {
  const p = buildArrangePreview(
    input({
      tables: [table('t1', 1, { capacity: 2 }), table('t2', 2, { capacity: 2 })],
      guests: [guest('solo'), guest('h'), guest('k1', { plus_one_of_guest_id: 'h' }), guest('k2', { plus_one_of_guest_id: 'h' })],
    }),
  );
  assert.ok(p.ok);
  assert.equal(p.repairs.filter((r) => r.kind === 'add_tables').length, 0, 'four chairs for four guests is not a shortfall');
  const seats = p.repairs.find((r) => r.kind === 'add_seats');
  assert.ok(seats);
  assert.equal(repairWords(seats, (id) => id.toUpperCase(), () => 'Santos family'), 'H’s party needs 3 seats together; the biggest gap is 2. Add 1 seat to Santos family');
  assert.ok(p.notMet.some((x) => x.kind === 'no_room'), 'the party is in the Not met list');
  assert.ok(!p.plan.rows.some((r) => ['h', 'k1', 'k2'].includes(r.guest_id)), 'a party is never split to fit');
});

test('Accept reads back only a well-formed plan; anything else writes nothing', () => {
  const ok = parseArrangePlan(
    JSON.stringify({ base: 'x', clear: ['a'], newTables: [{ key: 'k', label: 'Table 9', type: 'round_10', capacity: 10, sort_order: 9 }], positions: { t1: { x: 1, y: 2 }, bad: { x: 'no' } }, rows: [{ guest_id: 'a', table: 't1', seat_number: 0 }] }),
  );
  assert.ok(ok);
  assert.deepEqual(ok.positions, { t1: { x: 1, y: 2 } });
  assert.equal(parseArrangePlan('{not json'), null);
  assert.equal(parseArrangePlan({ base: 'x', clear: [], newTables: [], rows: [{ guest_id: 'a', table: 't', seat_number: 1.5 }] }), null);
  assert.equal(parseArrangePlan({ clear: [], newTables: [], rows: [] }), null, 'no base, no write');
});

test('autoArrange folds preview and accept into the one action; Accept goes through apply_seat_plan', () => {
  const act = readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'seating', 'actions.ts'), 'utf8');
  assert.match(act, /formData\.get\('intent'\) === 'preview'\) \{\s*return previewAutoArrange\(eventId, formData\);/);
  assert.match(act, /formData\.get\('intent'\) === 'accept'\) \{\s*return acceptAutoArrange\(eventId, formData\);/);
  assert.match(act, /supabase\.rpc\('apply_seat_plan', \{/);
  assert.match(act, /if \(!plan \|\| !Number\.isInteger\(unseated\)\) throw new Error\('Invalid input'\);/, 'Accept never invents "everyone has a seat"');
  const preview = act.slice(act.indexOf('async function previewAutoArrange'), act.indexOf('async function acceptAutoArrange'));
  assert.doesNotMatch(preview, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(|persistBooths/, 'the preview writes nothing');
});
