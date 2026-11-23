/**
 * 🔒 THE SEAT PLAN IS ONE EDITOR (seat plan PR2, option B — DECISION_LOG d1fafcd5). The couple's editor is the one
 * seat-plan engine; a supplier's hall in Spaces opens the SAME component in its venue mode, with a store that says the
 * editor's calls in the Spaces dispatcher's ops. PlanMaker is retired. A couple's plan is unchanged: every couple row
 * draws exactly as `tableGeometry(shapeHintFor(type), capacity, linked)` did.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TABLE_TYPE_CATALOG, shapeHintFor, tableGeometry } from '@/lib/seating';
import {
  VENUE_TABLE_PICKS,
  planTableGeometry,
  rowGeometry,
  rowFootprintM,
  venueDoorChange,
  venueEditorRows,
  venuePickFor,
  TABLE_FOOTPRINT_M,
} from '@/lib/seat-plan-engine';
import { SEATING_STORE_ACTIONS } from './seating-store';

const WEB = join(__dirname, '..', '..', '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const HOST = 'app/vendor-dashboard/spaces/_components/venue-seat-plan.tsx';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

test('1 · PlanMaker is gone: no folder, and no file imports it', () => {
  assert.equal(existsSync(join(WEB, 'app/_components/plan-maker')), false, 'app/_components/plan-maker came back');
  const users = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib')), ...walk(join(WEB, 'components'))]
    .filter((p) => /from ['"][^'"]*plan-maker\/plan-maker['"]/.test(readFileSync(p, 'utf8')))
    .map((p) => relative(WEB, p));
  assert.deepEqual(users, []);
});

test('2 · both sides draw from ONE component: the event page and the hall import the same SeatingEditor', () => {
  const page = strip(read('app/dashboard/[eventId]/seating/page.tsx'));
  const host = strip(read(HOST));
  assert.match(page, /import \{ SeatingEditor \} from '\.\/_components\/seating-lazy'/);
  assert.match(host, /import \{ SeatingEditor \} from '@\/app\/dashboard\/\[eventId\]\/seating\/_components\/seating-lazy'/);
  assert.match(host, /<SeatingStoreContext\.Provider value=\{store\}>\s*<SeatingEditor/, 'the hall does not hand the editor its store');
  assert.match(host, /const source = useMemo\(\(\) => \(\{ kind: 'venue' as const, spaceId, floorPlanOpen \}\), \[spaceId, floorPlanOpen\]\);/, 'the hall does not open the editor in venue mode');
  assert.match(host, /<SeatingEditor[\s\S]*?source=\{source\}/, 'the hall does not hand the editor its venue source');
  assert.match(strip(read('app/vendor-dashboard/spaces/_components/base-layout.tsx')), /<VenueSeatPlan /, 'the Spaces sheet no longer shows the hall’s plan');
});

test('3 · the hall’s store answers every call the editor makes — the event-only ones refuse, never reach an event action', () => {
  const host = strip(read(HOST));
  const body = host.slice(host.indexOf('export function venueSeatingStore'), host.indexOf('export function VenueSeatPlan'));
  for (const k of [...SEATING_STORE_ACTIONS, 'guestSeatView', 'saveEntrance', 'venueTable']) {
    assert.match(body, new RegExp(`\\n\\s+${k}:`), `the hall's store has no ${k} — the editor would fall back to the event's server action`);
  }
  assert.doesNotMatch(host, /from '@\/app\/dashboard\/\[eventId\]\/seating\/actions'/, 'the hall imports the event’s server actions');
  assert.match(body, /op: 'placeTable'/);
  assert.match(body, /op: 'addTables'/);
  assert.match(body, /op: 'deleteTable'/);
  assert.match(body, /op: 'updateTable'/);
});

test('4 · nothing under app/dashboard hands the editor a store — an event always runs its shipped actions', () => {
  const providers = walk(join(WEB, 'app/dashboard'))
    .filter((p) => /SeatingStoreContext\.Provider/.test(strip(readFileSync(p, 'utf8'))))
    .map((p) => relative(WEB, p));
  assert.deepEqual(providers, []);
});

test('5 · a couple row draws byte for byte as before; a hall row draws its own shape at true scale', () => {
  for (const c of TABLE_TYPE_CATALOG) {
    for (const linked of [false, true]) {
      const row = { table_type: c.type, capacity: c.defaultCapacity };
      assert.deepEqual(rowGeometry(row, linked), tableGeometry(shapeHintFor(c.type), c.defaultCapacity, linked), `${c.type} linked=${linked}`);
      assert.equal(rowFootprintM(row), TABLE_FOOTPRINT_M[c.type]);
    }
  }
  const half = { table_type: 'round_10' as const, capacity: 4, plan_shape: 'half_moon' as const };
  assert.deepEqual(rowGeometry(half), planTableGeometry({ id: '', label: '', kind: 'half_moon', chairs: 4, x: null, y: null }));
  const ends = { table_type: 'long_banquet_8' as const, capacity: 10, plan_shape: 'long' as const, chairs_at_ends: true };
  assert.equal(rowGeometry(ends).seats.length, 10, 'the end chairs are counted in the one number');
  assert.equal(venuePickFor(ends).key, 'long_ends');
  assert.equal(new Set(VENUE_TABLE_PICKS.map((p) => p.key)).size, 4);
});

test('6 · a hall becomes the editor’s rows: shape, chairs, spot and its first main and service door — no guest, no event', () => {
  const rows = venueEditorRows({
    areaId: 'hall-1',
    room: { widthM: 20, lengthM: 30 },
    tables: [
      { id: 't1', label: 'T1', shape: 'round', chairs: 10, chairsAtEnds: false, x: 30, y: 40, rotationDeg: 0 },
      { id: 't2', label: 'T2', shape: 'long', chairs: 12, chairsAtEnds: true, x: null, y: null, rotationDeg: 90 },
    ],
    doors: [
      { id: 'd1', kind: 'main', wall: 'front', along: 'middle' },
      { id: 'd2', kind: 'service', wall: 'right', along: 'left' },
    ],
  });
  assert.deepEqual(
    rows.tables.map((t) => [t.table_id, t.event_id, t.plan_shape, t.capacity, t.chairs_at_ends, t.x_pos, t.y_pos, t.rotation_deg]),
    [
      ['t1', 'hall-1', 'round', 10, false, 30, 40, 0],
      ['t2', 'hall-1', 'long', 12, true, null, null, 90],
    ],
  );
  assert.equal(rows.floorPlan.venue_width_m, 20);
  assert.equal(rows.floorPlan.venue_length_m, 30);
  assert.deepEqual([rows.floorPlan.entrance_enabled, rows.floorPlan.entrance_x, rows.floorPlan.entrance_y], [true, 50, 100]);
  assert.deepEqual([rows.floorPlan.service_entrance_enabled, rows.floorPlan.service_entrance_x, rows.floorPlan.service_entrance_y], [true, 100, 20]);
  assert.deepEqual([rows.floorPlan.dance_enabled, rows.floorPlan.cocktail_enabled], [false, false]);
  assert.deepEqual([rows.entranceDoorId, rows.serviceDoorId], ['d1', 'd2']);
});

test('7 · a door the editor moved is put back on its wall: unchanged → nothing; moved → swapped; off → removed; new → added', () => {
  const was = { id: 'd1', wall: 'front' as const, along: 'middle' as const };
  assert.deepEqual(venueDoorChange(was, { enabled: true, x: 52, y: 99 }), { remove: null, add: null });
  assert.deepEqual(venueDoorChange(was, { enabled: true, x: 0, y: 15 }), { remove: 'd1', add: { wall: 'left', along: 'left' } });
  assert.deepEqual(venueDoorChange(was, { enabled: false, x: 50, y: 100 }), { remove: 'd1', add: null });
  assert.deepEqual(venueDoorChange(null, { enabled: true, x: 85, y: 0 }), { remove: null, add: { wall: 'back', along: 'right' } });
  assert.deepEqual(venueDoorChange(null, { enabled: false, x: 50, y: 100 }), { remove: null, add: null });
});

test('8 · the hall’s floor plan opens OVER its Spaces sheet, and keeps the same store between renders', () => {
  // Live in the lab at 390: the full screen stood on the pop layer (40), under the sheet that opened it (50). Opened
  // from inside a Sheet, RiseScreen reads `InSheet` BEFORE its own provider, and globals.css lifts it to the modal layer
  // token (not the toast layer: the editor's own sheets are modal too, and must still open over it).
  const rise = strip(read('app/_components/rise/rise-screen.tsx'));
  const body = rise.slice(rise.indexOf('export function RiseScreen('));
  const reads = body.indexOf('const overSheet = useContext(InSheet);');
  assert.ok(reads > 0 && reads < body.indexOf('<InSheet.Provider value>'), 'RiseScreen no longer knows it was opened from a sheet');
  assert.match(body, /data-rise-over-sheet=\{overSheet \? '' : undefined\}/, 'a full screen opened from a sheet does not say so');
  const css = read('app/globals.css');
  assert.match(css, /\[data-rise-screen\]\[data-rise-over-sheet\] \{\s*z-index: var\(--sn-z-modal\);\s*\}/, 'a full screen opened from a sheet falls under it again');
  // The Spaces sheet IS a Sheet, so the hall's floor plan is inside one.
  const sheet = strip(read('app/vendor-dashboard/spaces/_components/space-sheet.tsx'));
  assert.match(sheet, /<Sheet\b/, 'the Spaces sheet is not the shared Sheet any more — re-check where the floor plan opens');
  // A save re-renders the sheet with a new `run`: the store must not be rebuilt for it.
  const host = strip(read(HOST));
  assert.match(host, /useMemo\(\(\) => venueSeatingStore\(spaceId, \(op, done\) => runRef\.current\(op, done\), \(\) => latest\.current\), \[spaceId\]\)/, 'the hall’s store is rebuilt on every render');
  assert.doesNotMatch(host.slice(host.indexOf('<SeatingEditor')), /=\{\[\]\}|=\{\{/, 'the editor gets a new list or object every render');
});

test('9 · a hall opens on its floor at 390, its tables inside its wall, and nothing in it speaks of guests', () => {
  // Live in the lab at 390 (Hall001, six tables with no saved spot): the editor flipped to the guests' List; on the
  // floor the first layout was 134 px wide, the tables dodged each other metres past the wall and `prev` kept them.
  const ed = strip(read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx'));
  assert.match(ed, /if \(!details && !isVenue && initialView !== 'list' &&/, 'a hall opens on the guests’ List on a phone');
  assert.match(ed, /function layoutRectOf\(/, 'the layout box is gone');
  const place = ed.slice(ed.indexOf('const placedForRef = useRef'), ed.indexOf('const shelf = venueScaled ? venueShelfBase(rect) : null;'));
  assert.match(place, /const rect = canvasRef\.current \? layoutRectOf\(canvasRef\.current\) : null;/, 'tables are placed against the painted (still zooming) box');
  assert.match(place, /const resized = was !== null &&/, 'a resize no longer re-places the tables nobody moved');
  assert.match(ed, /const kept = resized && !dirty\.has\(t\.table_id\) \? undefined : prev\[t\.table_id\];/, 'a resize throws away a table the person moved, or keeps a spot from the wrong size');
  assert.match(ed, /setRegion\(\{ w: el\.offsetWidth, h: el\.offsetHeight \}\);/, 'the floor is sized from the painted first frame');
  // One view in a hall: no List (guest seating) and no 3D, on either picker; no people search.
  assert.match(ed, /\{isVenue \? null : \(\s*<SeatingViewSegment/, 'the desktop picker offers a hall List or 3D');
  assert.match(ed, /show3D=\{!isVenue && process\.env\.NEXT_PUBLIC_SEATING_3D !== 'false'\}/, 'the phone offers a hall 3D');
  assert.match(ed, /\{isVenue \? null : <div className="shrink-0 p-3 pb-2">\{searchRow\}<\/div>\}/, 'a hall shows a people search');
  assert.match(ed, /\{isVenue \? \(\s*venueRowWords\(u\.lead\)/, 'a hall’s row says the couple type and a seated count');
  const phone = strip(read('app/dashboard/[eventId]/seating/_components/seat-plan-phone.tsx'));
  const head = phone.slice(phone.indexOf('data-seat-plan-phone-head'), phone.indexOf('export function PhoneSeatPlanFoot'));
  assert.match(head, /\{venue \? null : \(\s*<p data-seat-plan-status=""/, 'a hall’s head says “0 seated · guests see it on the day”');
  assert.match(head, /\{venue \? null : \(\s*<div className="flex items-center gap-2">\s*<button\s+type="button"\s+onClick=\{onUnseated\}/, 'a hall’s head carries Unseated or the View picker');
});
