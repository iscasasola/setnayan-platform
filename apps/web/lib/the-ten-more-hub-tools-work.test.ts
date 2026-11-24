/**
 * 🧰 TEN MORE HUB TOOLS WORK (DECISION_LOG "Seven open calls settled" item 3 — the free rest, part 1 of 2; controller
 * OK 24 Nov on the list): Ceremony details · Proofs & approval · Safety permit & cue (checklist) · Fittings &
 * measurements · Looks per person · Crew roster · Room list (per-person) · Chair schedule · Reservation slots · Brackets &
 * scoring (ordered list).
 *
 * Same shape as the first ten (AL #8247): ONE table (`vendor_hub_tool_entries`), ONE reader (`readHubToolEntries`), ONE
 * writer (`hubToolEntry`) — no new table, no new action, no migration. The Ordered list's ▲ ▼ is the dispatcher's own
 * `move` op (positions swapped in the row's own tool, the Set list's idiom); Brackets keeps a score in `qty`.
 * HELD (controller 24 Nov): Insured people list and Incident log (privacy picks, the owner's call), Photo upload and
 * Photo delivery (a later batch) stay `shipped: false`.
 * The tests EXECUTE the pure halves and read the source only for wiring a test cannot run without a database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENTRY_TEMPLATES, entryTemplateOf, isScoredTool, parseHubToolEntryOp, swapWithNeighbour } from './hub-tool-entries';
import { HUB_TOOL_LIBRARY } from './hub-tools';
import { DAY_OF_MODULES, resolveModules } from './vendor-dayof-modules';
import { dayOfModuleHref } from './vendor-dayof-module-href';

const TEN = {
  ceremony_details: 'checklist',
  proofs_and_approval: 'checklist',
  safety_permit_and_cue: 'checklist',
  fittings_and_measurements: 'per_person',
  looks_per_person: 'per_person',
  crew_roster: 'per_person',
  room_list: 'per_person',
  chair_schedule: 'ordered_list',
  reservation_slots: 'ordered_list',
  brackets_and_scoring: 'ordered_list',
} as const;
const KEYS = Object.keys(TEN) as (keyof typeof TEN)[];
const HELD = ['insured_people_list', 'incident_log', 'photo_upload', 'photo_delivery'] as const;
const ID = '00000000-0000-4000-8000-000000000001';
const web = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const VIEW = 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/hub-tools/hub-tool-panels-view.tsx';
const TOOLS = 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/hub-tools/entry-tools.tsx';
const ACTIONS = 'app/vendor-dashboard/on-the-day/actions.ts';

test('the ten are shipped, each on its library template; the four held tools get no hub switch', () => {
  for (const key of KEYS) {
    const t = HUB_TOOL_LIBRARY.find((x) => x.key === key);
    assert.ok(t, `${key} is not in the library`);
    assert.equal(t.shipped, true, `${key} is not marked shipped`);
    assert.equal(t.template, TEN[key], `${key} is on the wrong template`);
  }
  for (const key of HELD) {
    assert.ok(HUB_TOOL_LIBRARY.some((x) => x.key === key), `${key} stays in the library`);
    assert.ok(!DAY_OF_MODULES.some((m) => (m.id as string) === key || m.hubTool === key), `${key} is held — no switch on the Hub`);
  }
});

test('each of the ten is a day-of module any shop may switch on, drawn inline (no dead link), on for nobody by family', () => {
  for (const key of KEYS) {
    const m = DAY_OF_MODULES.find((x) => x.id === key);
    assert.ok(m, `${key} has no day-of module — a shipped tool nobody can switch on`);
    assert.equal(m.hubTool, key);
    assert.equal(m.alwaysAvailable, true, `${key}: categories suggest, never gate`);
    assert.deepEqual(m.defaultOnFor, [], `${key}: the category switches suggest it, not a family`);
    assert.equal(dayOfModuleHref(key, 'e1'), null, `${key} is drawn inline, never a link row`);
  }
  // An accommodation booking with the seed's suggestion starts the Room list ON; every other of the ten is offered, off.
  const r = resolveModules(['accommodation'], ['accommodation'], null, { suggested: new Set(['room_list']), inactive: new Set() });
  assert.equal(r.find((m) => m.id === 'room_list')?.enabled, true);
  for (const key of KEYS.filter((k) => k !== 'room_list')) assert.equal(r.find((m) => m.id === key)?.enabled, false, key);
});

test('ONE home: the one writer takes every one of the ten, on its own template', () => {
  assert.ok((ENTRY_TEMPLATES as readonly string[]).includes('ordered_list'));
  for (const key of KEYS) {
    assert.equal(entryTemplateOf(key), TEN[key], key);
    const add = parseHubToolEntryOp({ op: 'add', toolKey: key, label: '  Team   Reyes ', note: ' Group A ' });
    assert.ok(add.ok && add.op.op === 'add', `${key}: the writer refuses its rows`);
    if (add.ok && add.op.op === 'add') {
      assert.equal(add.op.label, 'Team Reyes');
      assert.equal(add.op.note, 'Group A');
      assert.equal(add.op.qty, key === 'brackets_and_scoring' ? 0 : null, `${key}: only Brackets keeps a score`);
    }
  }
  assert.equal(isScoredTool('brackets_and_scoring'), true);
  assert.equal(isScoredTool('chair_schedule'), false);
  for (const key of HELD) assert.equal(parseHubToolEntryOp({ op: 'add', toolKey: key, label: 'x' }).ok, false, `${key} is held — the writer refuses it`);
  // Kept in their own tables, never this one — whatever their shipped flag says.
  for (const key of ['set_list', 'song_desk', 'shot_list']) assert.equal(entryTemplateOf(key), null, `${key} keeps its own rows`);
});

test('ORDERED LIST: ▲ ▼ is the move op — one place, never a renumber; a move with no direction is refused', () => {
  const up = parseHubToolEntryOp({ op: 'move', entryId: ID, dir: 'up' });
  assert.ok(up.ok && up.op.op === 'move' && up.op.dir === 'up');
  assert.equal(parseHubToolEntryOp({ op: 'move', entryId: ID, dir: 'sideways' }).ok, false);
  assert.equal(parseHubToolEntryOp({ op: 'move', entryId: 'nope', dir: 'down' }).ok, false);
  const rows = [{ id: 'a', position: 100 }, { id: 'b', position: 200 }, { id: 'c', position: 300 }];
  assert.deepEqual(swapWithNeighbour(rows, 'c', 'up'), { a: { id: 'c', position: 200 }, b: { id: 'b', position: 300 } });
  // A score is the generic count op on the row.
  const score = parseHubToolEntryOp({ op: 'count', entryId: ID, qty: 12 });
  assert.ok(score.ok && score.op.op === 'count' && score.op.qty === 12);
});

test('the dispatcher moves a row only within its own tool, scoped to the event and the shop, and counts a missed write', () => {
  const src = web(ACTIONS);
  const at = src.indexOf("if (op.op === 'move')");
  assert.ok(at > 0, 'the move op is handled by the one dispatcher');
  const body = src.slice(at, src.indexOf('const patch =', at));
  assert.match(body, /\.eq\('tool_key', \(me as \{ tool_key: string \}\)\.tool_key\)/, 'the neighbour is in the same tool');
  assert.match(body, /swapWithNeighbour\(/);
  assert.equal((body.match(/\.eq\('vendor_profile_id', vendorProfileId\)/g) ?? []).length, 3, 'every read and write is the shop’s own');
  assert.match(body, /const bad = counted\(hit, wErr\);/, 'a zero-row write is a failure, never "saved"');
});

test('each of the ten is drawn by its template with its own words and mark; the ordered list has ▲ ▼ and a score', () => {
  const view = web(VIEW);
  for (const key of KEYS) {
    assert.match(view, new RegExp(`\\n  ${key}: \\{\\n    (first|placeholder): '`), `${key}: no add-box words`);
    assert.match(view, new RegExp(`\\n  ${key}: [A-Z][A-Za-z0-9]+,`), `${key}: no mark`);
  }
  assert.match(view, /template === 'ordered_list'\) \{\s*body = \(\s*<OrderedListTool/);
  assert.match(view, /scored=\{isScoredTool\(key\)\}/);
  const tools = web(TOOLS);
  assert.match(tools, /export function OrderedListTool/);
  assert.match(tools, /write\(\{ op: 'move', entryId: row\.id, dir \}/, 'the ▲ ▼ writes through the dispatcher');
  assert.match(tools, /const step = useCountSteps\(initial, setRows, write\);[\s\S]*export function OrderedListTool[\s\S]*const step = useCountSteps\(initial, setRows, write\);/, 'the Counter and the score share ONE stepper');
});
