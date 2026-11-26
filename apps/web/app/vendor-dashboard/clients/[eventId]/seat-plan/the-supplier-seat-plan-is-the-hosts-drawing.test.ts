/**
 * 🔗 A7-16 (final check, 25 Nov 2026 · DECISION_LOG 2026-11-20 "one seat-plan engine for the couple and the supplier").
 *
 * The supplier's seat plan hand-drew its own map: every table a fixed 9 % square or circle whatever its type or chairs,
 * joined tables apart under their own labels, an unsized room 4:3 landscape. It now reads the plan through the engine
 * (`planFromSeating`) and draws it with the one `PlanPoster`, and lists the hosts' display units (`groupTablesIntoUnits`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { DEFAULT_ROOM_M, planAspect, planFromSeating, planRoomM, planTableGeometry } from '@/lib/seat-plan-engine';
import { supplierPlanOf, tableUnits, type Plan } from '@/lib/supplier-seat-plan';

const HERE = dirname(fileURLToPath(import.meta.url));
const BODY = stripComments(readFileSync(join(HERE, 'seat-plan-body.tsx'), 'utf8'));
const LIB = stripComments(readFileSync(join(HERE, '..', '..', '..', '..', '..', 'lib', 'supplier-seat-plan.ts'), 'utf8'));

const table = (over: Partial<Plan['tables'][number]>): Plan['tables'][number] => ({
  table_id: 't',
  label: 'Table',
  table_type: 'round_10',
  capacity: 10,
  x: 30,
  y: 40,
  rotation_deg: 0,
  sort_order: 1,
  seated: 0,
  meal_counts: null,
  removed_seats: [],
  link_group_id: null,
  link_group_label: null,
  ...over,
});

const FIXTURE: Plan = {
  published_at: '2026-11-25T00:00:00Z',
  venue: { width_m: null, length_m: null },
  stage: { x: 50, y: 8, w: 30, h: 8 },
  dance: null,
  entrance: { x: 50, y: 100 },
  service_entrance: null,
  cocktail: null,
  dietary_included: true,
  objects: [],
  tables: [
    table({ table_id: 'a', label: 'Table 1', table_type: 'round_10', capacity: 10, removed_seats: [1, 2], seated: 6 }),
    table({ table_id: 'b', label: 'Table 2', table_type: 'long_banquet_10', capacity: 10, x: 60, y: 50, rotation_deg: 90, seated: 4 }),
    table({ table_id: 'c', label: 'Table 3', table_type: 'long_banquet_8', capacity: 8, x: 40, y: 70, link_group_id: 'g', link_group_label: 'Family table', seated: 8, meal_counts: { beef: 5, fish: 3 } }),
    table({ table_id: 'd', label: 'Table 4', table_type: 'long_banquet_8', capacity: 8, x: 55, y: 70, link_group_id: 'g', link_group_label: 'Family table', seated: 7, meal_counts: { beef: 2, kids: 4 } }),
    table({ table_id: 'e', label: 'Table 5', x: null, y: null }),
  ],
};

test('the map is the engine\'s drawing — PlanPoster through planFromSeating, no hand-drawn 9 % boxes', () => {
  assert.match(BODY, /<PlanPoster\b/, 'the supplier map is not drawn by the one PlanPoster');
  assert.match(BODY, /supplierPlanOf\(plan\)/, 'the map is not drawn from the engine reading');
  assert.match(BODY, /tableUnits\(/, 'the rows are not the hosts\' display units');
  assert.match(LIB, /planFromSeating\(/, 'the plan is not read through the engine');
  assert.match(LIB, /groupTablesIntoUnits\(/, 'the units are not the hosts\' own grouping');
  assert.doesNotMatch(BODY, /\[9%\]/, 'a fixed 9 % table box is back');
  assert.doesNotMatch(BODY, /isRound\(/, 'a second way to decide a table\'s shape is back');
  assert.doesNotMatch(BODY, /text-\[\d+px\]/, 'a typed px size is back');
});

test('each table\'s geometry is exactly the hosts\' planTableGeometry for the same plan', () => {
  const supplier = supplierPlanOf(FIXTURE);
  const hosts = planFromSeating(
    FIXTURE.tables
      .filter((t) => t.x !== null)
      .map((t) => ({
        table_id: t.table_id,
        table_label: t.label,
        table_type: t.table_type as never,
        capacity: t.capacity,
        x_pos: t.x,
        y_pos: t.y,
        rotation_deg: t.rotation_deg,
        removed_seats: t.removed_seats ?? [],
        link_group_id: t.link_group_id ?? null,
      })),
    {
      venue_width_m: null, venue_length_m: null,
      entrance_enabled: true, entrance_x: 50, entrance_y: 100,
      service_entrance_enabled: false, service_entrance_x: 50, service_entrance_y: 100,
    },
  );
  assert.equal(supplier.tables.length, 4, 'the placed tables are drawn; the unplaced one waits in the rows');
  for (const t of supplier.tables) {
    const h = hosts.tables.find((x) => x.id === t.id)!;
    assert.deepEqual(planTableGeometry(t), planTableGeometry(h), `${t.id}: the supplier draws a different table`);
    assert.deepEqual([t.x, t.y, t.rotationDeg], [h.x, h.y, h.rotationDeg]);
  }
  // A long table is long, not a small square: its box is wider than it is deep.
  const long = planTableGeometry(supplier.tables.find((t) => t.id === 'b')!);
  assert.ok(long.box.w > long.box.h * 1.5, 'a long table drew as a square');
});

test('an unsized room is the engine\'s default room, not a 4:3 landscape', () => {
  const room = planRoomM(supplierPlanOf(FIXTURE).room);
  assert.deepEqual([room.widthM, room.depthM], [DEFAULT_ROOM_M.w, DEFAULT_ROOM_M.d]);
  assert.equal(planAspect(supplierPlanOf(FIXTURE).room), DEFAULT_ROOM_M.w / DEFAULT_ROOM_M.d);
});

test('a joined set is ONE row under the group\'s name, its seats the hosts\' own count', () => {
  const units = tableUnits(FIXTURE.tables);
  assert.equal(units.length, 4, 'two joined tables read as one unit');
  const family = units.find((u) => u.isLinked)!;
  assert.equal(family.label, 'Family table');
  assert.deepEqual(family.members.map((m) => m.table_id), ['c', 'd']);
  assert.equal(family.capacity, 16);
  assert.equal(units.find((u) => u.key === 'a')!.capacity, 8, 'removed chairs never count (A7-17)');
  // On the map the group's name rides on the lead table only.
  const drawn = supplierPlanOf(FIXTURE).tables;
  assert.equal(drawn.find((t) => t.id === 'c')!.label, 'Family table');
  assert.equal(drawn.find((t) => t.id === 'd')!.label, '');
  assert.ok(drawn.find((t) => t.id === 'c')!.linked, 'the chain is spaced as one, as the hosts draw it');
});

test('counts only — no guest name reaches the supplier\'s drawing', () => {
  assert.match(BODY, /seated=\{seatedById\}/, 'the chairs are filled from the seated COUNT');
  assert.doesNotMatch(BODY, /names=\{/, 'a names list reached the supplier map');
});
