/**
 * 🪑 THE SHAPES THE SEAT SCREENS READ (the controller's contract of 28 Nov; lib/seat-plan-api.ts). A planId is the
 * plan itself; taking a suggestion, a fix or the preview all go through the one Accept.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_FLOOR_PLAN, type EventTableRow, type SeatAssignmentRow } from '@/lib/seating';
import { arrangeView, decodePlanId, dryRunView, encodePlanId, planForMoves } from '@/lib/seat-plan-api';
import { seatPlanDryRun, type DryRunGuest } from '@/lib/seat-plan-dry-run';
import { seatCheckFromView, seatCheckLine } from '@/lib/seat-check';
import { buildArrangePreview, seatPlanBase } from '@/lib/seat-plan-preview';

const table = (id: string, n: number, over: Partial<EventTableRow> = {}): EventTableRow => ({
  table_id: id,
  public_id: `S89T-${id}`,
  event_id: 'e',
  table_label: `Table ${n}`,
  table_type: 'round_10',
  capacity: 4,
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
const seat = (guest_id: string, table_id: string, seat_number: number | null, over: Partial<SeatAssignmentRow> = {}): SeatAssignmentRow => ({
  assignment_id: `a-${guest_id}`,
  guest_id,
  table_id,
  seat_number,
  ...over,
});
const words = { nameOf: (id: string) => id.toUpperCase(), tableName: (id: string) => `Shown ${id}` };

test('a planId is the plan: it reads back exactly, and a garbled one writes nothing', () => {
  const plan = { base: 'b', clear: ['x'], newTables: [], positions: {}, rows: [{ guest_id: 'x', table: 't', seat_number: 2 }], unseated: 3 };
  assert.deepEqual(decodePlanId(encodePlanId(plan)), plan);
  assert.equal(decodePlanId('not-a-plan'), null);
  assert.equal(decodePlanId(encodePlanId({ ...plan, unseated: -1 })), null, 'no honest count, no write');
  assert.equal(decodePlanId(undefined), null);
});

test('a move plan clears the movers and gives them the lowest free real chairs, counted after the clears', () => {
  const tables = [table('t1', 1, { removed_seats: [0] }), table('t2', 2)];
  const assignments = [seat('a', 't1', 1), seat('b', 't2', 0), seat('c', 't2', 1)];
  const plan = planForMoves([{ guest_id: 'b', table_id: 't1' }, { guest_id: 'c', table_id: 't1' }], tables, assignments, 0);
  assert.ok(plan);
  assert.deepEqual(plan.clear, ['b', 'c']);
  assert.deepEqual(plan.rows, [
    { guest_id: 'b', table: 't1', seat_number: 2 },
    { guest_id: 'c', table: 't1', seat_number: 3 },
  ], 'chair 0 is removed and chair 1 is taken');
  assert.equal(plan.base, seatPlanBase(assignments));
  assert.equal(planForMoves([{ guest_id: 'b', table_id: 'gone' }], tables, assignments, 0), null);
});

test('dryRun: suggestions with a planId, problems in words with a fix planId, and Fix all', () => {
  const tables = [table('t1', 1), table('t2', 2)];
  const guests = [guest('ana'), guest('ana+1', { plus_one_of_guest_id: 'ana' }), guest('new')];
  const assignments = [seat('ana', 't1', 0), seat('ana+1', 't2', 0)];
  const view = dryRunView(seatPlanDryRun({ tables, guests, assignments, groupLabels: new Map(), floor: DEFAULT_FLOOR_PLAN }), {
    tables,
    assignments,
    unseatedNow: 1,
    ...words,
  });
  assert.ok(view.status === 'ok');
  assert.equal(view.suggestions.length, 1);
  assert.deepEqual(view.suggestions[0]!.guestIds, ['new']);
  const taken = decodePlanId(view.suggestions[0]!.planId);
  assert.ok(taken);
  assert.equal(taken.unseated, 0);
  assert.deepEqual(taken.clear, []);
  const p = view.problems.find((x) => x.kind === 'plus_one_apart');
  assert.ok(p);
  assert.equal(p.reason, 'ANA’s +1 sits apart from them');
  assert.equal(p.tableId, 't1');
  assert.equal(p.fix.kind, 'move');
  const fix = decodePlanId((p.fix as { planId: string }).planId);
  assert.deepEqual(fix?.rows, [{ guest_id: 'ana+1', table: 't1', seat_number: 1 }]);
  assert.ok(view.fixAllPlanId);
  assert.equal(view.line, '⚠ 1 to look at');
});

test('a failed dry run is { status: "failed" } with the honest line, never "All good"', () => {
  const view = dryRunView({ ok: false }, { tables: [], assignments: [], unseatedNow: 0, ...words });
  assert.deepEqual(view, { status: 'failed', line: 'Couldn’t check seats · Try again' });
});

test('previewArrange: the counts, Not met in words and the changes by SHOWN name — or cannotFit with its repair', () => {
  const ok = buildArrangePreview({
    tables: [table('t1', 1)],
    newTables: [],
    positions: {},
    guests: [guest('a'), guest('b')],
    assignments: [],
    scope: 'unseated',
    keep: new Set(),
    constraints: [],
    memberships: new Map(),
    groupLabels: new Map(),
    floor: DEFAULT_FLOOR_PLAN,
  });
  assert.ok(ok.ok);
  const v = arrangeView(ok, words);
  assert.ok('planId' in v);
  assert.equal(v.seated, 2);
  assert.equal(v.total, 2);
  assert.equal(v.getSeat, 2);
  assert.deepEqual(v.notMet, []);
  assert.deepEqual(v.changes.map((c) => [c.tableId, c.add, c.label]), [['t1', 2, 'Shown t1']]);
  assert.equal(decodePlanId(v.planId)?.unseated, 0);

  const short = buildArrangePreview({
    tables: [table('t1', 1, { capacity: 1 })],
    newTables: [],
    positions: {},
    guests: [guest('a'), guest('b'), guest('c')],
    assignments: [],
    scope: 'unseated',
    keep: new Set(),
    constraints: [],
    memberships: new Map(),
    groupLabels: new Map(),
    floor: DEFAULT_FLOOR_PLAN,
  });
  assert.ok(short.ok);
  const c = arrangeView(short, words);
  assert.ok('cannotFit' in c);
  assert.equal(c.cannotFit.rule, 'Not enough seats: 3 coming, 1 chair. Add 1 table');
  assert.equal(c.cannotFit.repair.kind, 'add_tables');
  assert.ok(c.cannotFit.planId, 'the host may still take what fits');
});

test('the three calls ride the one autoArrange action: dry-run, preview, accept by planId', () => {
  const calls = readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'seating', 'seat-plan-calls.ts'), 'utf8');
  assert.doesNotMatch(calls, /'use server'/, 'no new server action');
  assert.match(calls, /fd\.set\('intent', 'dry-run'\)/);
  assert.match(calls, /fd\.set\('intent', 'preview'\)/);
  assert.match(calls, /fd\.set\('plan_id', planId\)/);
  const act = readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'seating', 'actions.ts'), 'utf8');
  assert.match(act, /formData\.get\('intent'\) === 'dry-run'\) \{\s*return dryRunSeatPlan\(eventId\);/);
  const dry = act.slice(act.indexOf('async function dryRunSeatPlan('), act.indexOf('async function acceptAutoArrange('));
  assert.doesNotMatch(dry, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/, 'the dry run writes nothing');
  assert.match(dry, /dryRun: \{ status: 'failed', line: 'Couldn’t check seats · Try again' \}/, 'a refused read is said');
  assert.match(act, /const fromId = formData\.has\('plan_id'\) \? decodePlanId\(formData\.get\('plan_id'\)\) : null;/);
});

test('the seating page passes the dry run to the editor from its own reads: no new read, nothing written', () => {
  const page = readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'seating', 'page.tsx'), 'utf8');
  const block = page.slice(page.indexOf('const dryRun = ((): DryRunView => {'), page.indexOf('// ONE editor element'));
  assert.match(block, /seatPlanDryRun\(\{\s*tables,/);
  assert.match(block, /return dryRunView\(run, \{/);
  assert.doesNotMatch(block, /await |supabase|\.from\(|fetch[A-Z]/, 'the dry run reads nothing of its own');
  assert.match(page, /dryRun=\{\{ first: dryRun \}\}/, 'the page\'s own read no longer seeds the editor');
  assert.match(block, /try \{[\s\S]*return dryRunView\(run,[\s\S]*\} catch \(err\) \{[\s\S]*return \{ status: 'failed', line: 'Couldn’t check seats · Try again' \};/, 'a throw while naming or shaping crashes the seat page');
  const editor = readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'seating', '_components', 'seating-editor.tsx'), 'utf8');
  // ONE prop, ONE shape: the feed of the engine's own view — and the loader after every change is the shipped call.
  assert.match(editor, /dryRun\?: SeatDryRunFeed \| null;/);
  assert.equal(editor.match(/^  dryRun\?:/gm)?.length, 1, 'the editor has two dryRun props again');
  assert.match(editor, /import \{ dryRun as askDryRun \} from '\.\.\/seat-plan-calls';/, 'the editor is not wired to the engine');
  assert.match(editor, /const loadDryRun = useMemo\(\(\) => \(hasDryRun \? \(feedLoad \?\? \(\(\) => askDryRun\(eventId\)\)\) : null\), \[hasDryRun, feedLoad, eventId\]\);/, 'the loader is disconnected');
  assert.match(editor, /loadDryRun\(\)\s*\.then\(\(view\) => \{\s*if \(n === checkRun\.current\) setSeatCheck\(seatCheckFromView\(view\)\);/, 'a reloaded view is not drawn');
  assert.match(editor, /useState<SeatCheckState>\(\(\) => \(dryRun\?\.first \? seatCheckFromView\(dryRun\.first\) : \{ status: 'idle' \}\)\)/, 'the first paint ignores the page\'s read');
});

test('the engine\'s view drawn by the UI: a move fix seats its guests at its table; a failed view is FAILED', () => {
  const tables = [table('t1', 1), table('t2', 2)];
  const guests = [guest('ana'), guest('ana+1', { plus_one_of_guest_id: 'ana' }), guest('new')];
  const assignments = [seat('ana', 't1', 0), seat('ana+1', 't2', 0)];
  const view = dryRunView(seatPlanDryRun({ tables, guests, assignments, groupLabels: new Map(), floor: DEFAULT_FLOOR_PLAN }), {
    tables,
    assignments,
    unseatedNow: 1,
    ...words,
  });
  const state = seatCheckFromView(view);
  assert.ok(state.status === 'read');
  assert.deepEqual(state.run.suggestions.map((s) => [s.tableId, s.guestIds]), [[view.status === 'ok' ? view.suggestions[0]!.tableId : '', ['new']]]);
  const p = state.run.problems.find((x) => x.kind === 'plus_one_apart');
  assert.deepEqual(p?.fix, { kind: 'seat', tableId: 't1', guestIds: ['ana+1'] });
  assert.equal(seatCheckLine(state)?.words, `${state.run.problems.length} to look at`);
  // Failed, in either form, is never "All good".
  const failed = seatCheckFromView({ status: 'failed', line: 'Couldn’t check seats · Try again' });
  assert.deepEqual(failed, { status: 'failed' });
  assert.equal(seatCheckLine(failed)?.failed, true);
  // The switch off (`seat_suggestions: false`) → no card suggestions reach the UI.
  const off = seatCheckFromView(
    dryRunView(seatPlanDryRun({ tables, guests, assignments, groupLabels: new Map(), floor: { ...DEFAULT_FLOOR_PLAN, seat_suggestions: false } }), {
      tables,
      assignments,
      unseatedNow: 1,
      ...words,
    }),
  );
  assert.ok(off.status === 'read');
  assert.equal(off.run.suggestions.length, 0, 'the host\'s switch no longer hides the suggestions');
});
