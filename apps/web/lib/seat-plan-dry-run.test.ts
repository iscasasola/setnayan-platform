/**
 * ✦ THE SMART LAYER'S DRY RUN (seat plan § 4.4; corpus SEAT-PLAN-COMPLETE-2026-11-27.md § 7 source asserts: "the dry
 * run writes nothing" · "a failed read never shows 'All good'"). Executed on the shipped seater.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_FLOOR_PLAN, type EventTableRow, type SeatAssignmentRow } from '@/lib/seating';
import {
  fixAllMoves,
  seatCheckLine,
  seatPlanDryRun,
  seatProblemWords,
  suggestionReason,
  type DryRunGuest,
  type DryRunInput,
} from '@/lib/seat-plan-dry-run';

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
const input = (over: Partial<DryRunInput>): DryRunInput => ({
  tables: [],
  guests: [],
  assignments: [],
  groupLabels: new Map(),
  floor: DEFAULT_FLOOR_PLAN,
  ...over,
});

test('card suggestions: the unseated, as parties, at a table with room — with a reason from the seater\'s terms', () => {
  const run = seatPlanDryRun(
    input({
      tables: [table('t1', 1)],
      guests: [
        guest('ana', { group_id: 'santos', side: 'groom' }),
        guest('ana+1', { plus_one_of_guest_id: 'ana', group_id: 'santos', side: 'groom' }),
        guest('ben', { group_id: 'santos', side: 'groom' }),
      ],
      groupLabels: new Map([['santos', 'Santos family']]),
    }),
  );
  assert.ok(run.ok);
  assert.equal(run.suggestions.length, 1);
  const s = run.suggestions[0]!;
  assert.equal(s.tableId, 't1');
  assert.deepEqual(s.units.map((u) => [...u].sort()), [['ana', 'ana+1'], ['ben']]);
  assert.equal(s.reason, 'Santos family · 2 parties · groom’s side');
  assert.equal(s.rows.length, 3);
});

test('the reason names a group only when it holds more than half, and a side only when everyone shares it', () => {
  const g = (id: string, group: string | null, side: 'bride' | 'groom') => guest(id, { group_id: group, side });
  const labels = new Map([['a', 'Reyes'], ['b', 'Cruz']]);
  assert.equal(suggestionReason([[g('1', 'a', 'bride')], [g('2', 'b', 'groom')]], labels), '2 parties');
  assert.equal(suggestionReason([[g('1', 'a', 'bride'), g('2', 'a', 'bride')], [g('3', 'b', 'bride')]], labels), 'Reyes · 2 parties · bride’s side');
  assert.equal(suggestionReason([[g('1', null, 'bride')]], labels), '1 party · bride’s side');
});

test('"Suggest seats on the cards" off: no suggestions, the seat check still runs', () => {
  const run = seatPlanDryRun(
    input({ tables: [table('t1', 1)], guests: [guest('a')], floor: { ...DEFAULT_FLOOR_PLAN, seat_suggestions: false } }),
  );
  assert.ok(run.ok);
  assert.deepEqual(run.suggestions, []);
});

test('suggestions never use a Spare or locked table, and nobody already seated moves', () => {
  const run = seatPlanDryRun(
    input({
      tables: [table('spare', 1, { table_kind: 'spare' }), table('lock', 2, { locked: true }), table('open', 3)],
      guests: [guest('seated'), guest('new')],
      assignments: [seat('seated', 'lock')],
    }),
  );
  assert.ok(run.ok);
  assert.deepEqual(run.suggestions.map((s) => s.tableId), ['open']);
  assert.deepEqual(run.suggestions[0]!.units, [['new']]);
});

test('seat check: a +1 apart, with the move that fixes it', () => {
  const run = seatPlanDryRun(
    input({
      tables: [table('t1', 1), table('t2', 2)],
      guests: [guest('ana'), guest('ana+1', { plus_one_of_guest_id: 'ana' })],
      assignments: [seat('ana', 't1'), seat('ana+1', 't2')],
    }),
  );
  assert.ok(run.ok);
  const p = run.problems.find((x) => x.kind === 'plus_one_apart');
  assert.ok(p);
  assert.deepEqual(p.fix, { kind: 'move', moves: [{ guest_id: 'ana+1', table_id: 't1' }] });
  assert.equal(seatProblemWords(p, (id) => id.toUpperCase(), (t) => t), 'ANA’s +1 sits apart from them');
});

test('seat check: a party of three split, but a full table or a pinned seat is "review", never a forced move', () => {
  const guests = [guest('h'), guest('k1', { plus_one_of_guest_id: 'h' }), guest('k2', { plus_one_of_guest_id: 'h' })];
  const full = seatPlanDryRun(
    input({
      tables: [table('t1', 1, { capacity: 2 }), table('t2', 2)],
      guests: [...guests, guest('x')],
      assignments: [seat('h', 't1'), seat('x', 't1'), seat('k1', 't2'), seat('k2', 't2')],
    }),
  );
  assert.ok(full.ok);
  const p = full.problems.find((x) => x.kind === 'party_split');
  assert.ok(p);
  assert.deepEqual(p.fix, { kind: 'review' });
  const pinned = seatPlanDryRun(
    input({
      tables: [table('t1', 1), table('t2', 2)],
      guests,
      assignments: [seat('h', 't1'), seat('k1', 't2', { locked: true }), seat('k2', 't2')],
    }),
  );
  assert.ok(pinned.ok);
  assert.deepEqual(pinned.problems.find((x) => x.kind === 'party_split')?.fix, { kind: 'review' });
});

test('a principal sponsor\'s +1 seated away under "nearest" is the host\'s rule, not a problem', () => {
  const run = seatPlanDryRun(
    input({
      tables: [table('vip', 1, { table_kind: 'vip' }), table('t2', 2)],
      guests: [guest('ninang', { role: 'principal_sponsor' }), guest('spouse', { plus_one_of_guest_id: 'ninang' })],
      assignments: [seat('ninang', 'vip'), seat('spouse', 't2')],
      floor: { ...DEFAULT_FLOOR_PLAN, vip_plus_ones: 'nearest' },
    }),
  );
  assert.ok(run.ok);
  assert.equal(run.problems.filter((p) => p.kind === 'plus_one_apart').length, 0);
});

test('seat check: an elder near the speakers, moved with their party to a quiet Elders table', () => {
  const run = seatPlanDryRun(
    input({
      tables: [table('loud', 1, { x_pos: 10, y_pos: 10 }), table('quiet', 2, { table_kind: 'elders', x_pos: 80, y_pos: 90 })],
      guests: [guest('lola', { role: 'bride_grandparents' }), guest('lola+1', { plus_one_of_guest_id: 'lola' })],
      assignments: [seat('lola', 'loud'), seat('lola+1', 'loud')],
      floor: { ...DEFAULT_FLOOR_PLAN, speakers_enabled: true, speakers_x: 8, speakers_y: 8 },
    }),
  );
  assert.ok(run.ok);
  const p = run.problems.find((x) => x.kind === 'elder_near_speakers');
  assert.ok(p);
  assert.deepEqual(p.fix, { kind: 'move', moves: [{ guest_id: 'lola', table_id: 'quiet' }, { guest_id: 'lola+1', table_id: 'quiet' }] });
  // No speakers on the plan → never a speakers problem.
  const off = seatPlanDryRun(input({ tables: [table('loud', 1, { x_pos: 10, y_pos: 10 })], guests: [guest('lola', { role: 'bride_grandparents' })], assignments: [seat('lola', 'loud')] }));
  assert.ok(off.ok);
  assert.equal(off.problems.length, 0);
});

test('seat check: a table over its seats', () => {
  const run = seatPlanDryRun(
    input({
      tables: [table('t1', 1, { capacity: 2 })],
      guests: [guest('a'), guest('b'), guest('c')],
      assignments: [seat('a', 't1'), seat('b', 't1'), seat('c', 't1')],
    }),
  );
  assert.ok(run.ok);
  const p = run.problems.find((x) => x.kind === 'over_capacity');
  assert.ok(p);
  assert.equal(seatProblemWords(p, (id) => id, () => 'Table 1'), 'Table 1 has 3 people for 2 seats');
});

test('seat check: a new yes seated among strangers, moved to where their group sits', () => {
  const now = new Date('2026-11-28T00:00:00Z');
  const recent = '2026-11-27T00:00:00Z';
  const run = seatPlanDryRun(
    input({
      tables: [table('t1', 1), table('t2', 2)],
      guests: [guest('new', { group_id: 'g' }), guest('stranger'), guest('mate', { group_id: 'g' })],
      assignments: [seat('new', 't1', { placed_by: 'auto', placed_at: recent }), seat('stranger', 't1'), seat('mate', 't2')],
      now,
    }),
  );
  assert.ok(run.ok);
  const p = run.problems.find((x) => x.kind === 'new_rsvp_alone');
  assert.ok(p);
  assert.deepEqual(p.fix, { kind: 'move', moves: [{ guest_id: 'new', table_id: 't2' }] });
  // Placed by the host, or long ago: not "new", never named.
  const old = seatPlanDryRun(
    input({
      tables: [table('t1', 1), table('t2', 2)],
      guests: [guest('new', { group_id: 'g' }), guest('stranger'), guest('mate', { group_id: 'g' })],
      assignments: [seat('new', 't1', { placed_by: 'couple', placed_at: recent }), seat('stranger', 't1'), seat('mate', 't2')],
      now,
    }),
  );
  assert.ok(old.ok);
  assert.equal(old.problems.length, 0);
});

test('Fix all: every problem\'s moves, a party never half-moved, no table overfilled', () => {
  const tables = [table('t1', 1, { capacity: 3 }), table('t2', 2), table('t3', 3)];
  const assignments = [seat('a', 't1'), seat('b', 't1'), seat('x', 't2'), seat('y', 't3')];
  const moves = fixAllMoves(
    [
      { kind: 'plus_one_apart', guestIds: ['a', 'x'], tableIds: ['t1', 't2'], fix: { kind: 'move', moves: [{ guest_id: 'x', table_id: 't1' }] } },
      { kind: 'plus_one_apart', guestIds: ['b', 'y'], tableIds: ['t1', 't3'], fix: { kind: 'move', moves: [{ guest_id: 'y', table_id: 't1' }] } },
      { kind: 'over_capacity', guestIds: [], tableIds: ['t2'], fix: { kind: 'review' } },
    ],
    tables,
    assignments,
  );
  assert.deepEqual(moves, [{ guest_id: 'x', table_id: 't1' }], 'the second would overfill t1, so it waits for review');
});

test('honest failure: a run that throws is { ok: false } and the line says so — never "All good"', () => {
  const broken = seatPlanDryRun(input({ tables: null as unknown as EventTableRow[] }));
  assert.equal(broken.ok, false);
  assert.equal(seatCheckLine(broken), 'Couldn’t check seats · Try again');
  assert.equal(seatCheckLine({ ok: true, suggestions: [], problems: [] }), null, 'nothing to look at → no line');
  const one = seatPlanDryRun(
    input({ tables: [table('t1', 1, { capacity: 1 })], guests: [guest('a'), guest('b')], assignments: [seat('a', 't1'), seat('b', 't1')] }),
  );
  assert.equal(seatCheckLine(one), '⚠ 1 to look at');
});

test('the dry run writes nothing: no client, no query, no action in the file', () => {
  const src = readFileSync(join(__dirname, 'seat-plan-dry-run.ts'), 'utf8');
  assert.doesNotMatch(src, /supabase|\.from\(|\.rpc\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(|'use server'|fetch\(/);
  assert.doesNotMatch(src, /anthropic|openai|generateText/i, 'no guest name goes to an outside AI');
});

test('the RSVP hook runs the same seater after a yes, behind the ⋯ switch, and checks the plan before writing', () => {
  const slug = readFileSync(join(__dirname, '..', 'app', '[slug]', 'actions.ts'), 'utf8');
  assert.match(slug, /applyReconcileForEvent\(admin, eventId, \{ trigger: 'rsvp' \}\)/);
  const rec = readFileSync(join(__dirname, 'seating-reconcile.ts'), 'utf8');
  assert.match(rec, /opts\.trigger === 'rsvp' && floorPlan\.auto_seat_rsvps === false\) return null;/);
  assert.match(rec, /const breaks = checkAutoSeatPlan\(/);
  assert.match(rec, /if \(breaks\.length > 0\) \{[\s\S]{0,300}return \{ message:/, 'a refused plan writes nothing');
  assert.ok(rec.indexOf('const breaks = checkAutoSeatPlan(') < rec.indexOf(".from('event_seat_assignments')"), 'the check comes before any write');
});

test('a re-seat never takes a guest off a locked, Spare or Sweetheart table (the RSVP hook keeps them as they are)', async () => {
  const { reconcileProvisionalSeats } = await import('@/lib/seating');
  for (const closed of [{ locked: true }, { table_kind: 'spare' }, { table_type: 'sweetheart_2' as const }]) {
    const tables = [table('closed', 1, closed), table('open', 2)];
    const r = reconcileProvisionalSeats({
      tables,
      guests: [guest('a')],
      assignments: [seat('a', 'closed')],
      reseatGuestIds: ['a'],
    });
    assert.deepEqual(r.assign, [], `${JSON.stringify(closed)}: nothing re-placed`);
    assert.deepEqual(r.release, []);
  }
});
