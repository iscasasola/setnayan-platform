/**
 * the-seat-plan-on-the-phone.test.ts — P1b (2026-10-02): THE SEAT PLAN ON A
 * PHONE IS THE APPROVED FRAME, AND IT IS REACHABLE.
 *
 * DECISION_LOG 2026-10-01 "SEAT PLAN + WALKING ORDER DESIGN — APPROVED"
 * (prototypes/seat_plan_and_walking_order_2026-10-01_fable.html, frames 1–4),
 * "THE SEAT PLAN IS THE VENUE FLOOR PLAN — ON THE PHONE, IN 3D AND ON PAPER",
 * "SEAT PLAN: LINKED TABLES ARE ONE TABLE · NOTHING OVERLAPS", and 2026-10-02
 * "PREVENT 'BUILT BUT NOT THERE'" (a RENDER-level guard, a reach trace).
 *
 *   1 · NO DRAG ON A PHONE — below 768 px a press on the plan is a tap; every
 *       plan press in the editor goes through `planPress`, none binds a drag
 *       handler unguarded.
 *   2 · THE HEAD RENDERS what the frame draws — "Seat plan", the counted
 *       tables, the status line, Auto arrange, Rules ▾, Unseated: N, 2D ▾ —
 *       and the Auto arrange line with Undo.
 *   3 · Every number is COUNTED: N tables = units (linked once, no sweetheart).
 *   4 · "Move … to…" lists only tables with room (a linked unit is one row).
 *   5 · Auto arrange places NEW tables only in free space — placed tables stay.
 *   6 · Undo is an intent of the same action (no new server action).
 *   7 · REACHABLE: Details › Your event › Seat plan (maker=1) → this editor →
 *       on a phone the head (not the desk bar), ⋯ → Share & print → the A3.
 *
 * 🪤 `globalThis.React` is set BEFORE the dynamic imports (tsconfig "jsx":
 * "preserve" → tsx compiles to the classic runtime). Precedent:
 * launch/_components/hub-pro-offer-renders.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { moveTargets, planPress, seatPlanHeadline, seatPlanRoomName } from '@/lib/seat-plan-details';
import { checkPlacement, DEFAULT_FLOOR_PLAN, shapeHintFor, solveAutoLayout, tableGeometry, type EventTableRow } from '@/lib/seating';

(globalThis as unknown as { React: unknown }).React = React;

const SEATING = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'seating');
const code = (...p: string[]) => stripComments(readFileSync(join(SEATING, ...p), 'utf8'));
const editor = () => code('_components', 'seating-editor.tsx');

test('1 · no drag on a phone: a press is a tap below 768 px, and every plan press asks planPress', () => {
  assert.equal(planPress(true), 'tap');
  assert.equal(planPress(false), 'drag');
  const ed = editor();
  assert.match(ed, /window\.matchMedia\('\(max-width: 767px\)'\)/, 'the phone breakpoint is 768 px');
  assert.match(ed, /const press = planPress\(isPhone\)/);
  // No drag handler may be bound to the plan without the phone check.
  assert.doesNotMatch(
    ed,
    /onPointerDown=\{on(Hub|Marker|Booth|Sign|RectGrip|WallGrip)(PointerDown|GripDown|Down)\(/,
    'a plan element binds a DRAG handler with no planPress check — it would drag on a phone',
  );
  for (const kind of ['Hub', 'Marker', 'Booth', 'Sign']) {
    assert.match(ed, new RegExp(`press === 'drag' \\? on${kind}PointerDown\\(`), `${kind}: the drag handler is not behind planPress`);
  }
  assert.match(ed, /press === 'drag' \? onRectGripDown\('stage'\) : undefined/, 'the resize grips mount on a phone');
  assert.match(ed, /press === 'drag' \? onWallGripDown\('se'\) : undefined/, 'the wall grips mount on a phone');
  // The phone tap never moves anything: it selects, seats, or links.
  const run = ed.slice(ed.indexOf('const runTap = '), ed.indexOf('const onHubPointerDown = '));
  assert.ok(run.length > 0, 'runTap is gone');
  assert.doesNotMatch(run, /setPositions|dragRef\.current\s*=/, 'a phone tap moves a table');
});

test('2 · the phone head RENDERS the approved frame — and the Auto arrange line with Undo', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PhoneSeatPlanHead, PhoneSeatPlanFoot } = await import('./seat-plan-phone');
  const html = renderToStaticMarkup(
    React.createElement(PhoneSeatPlanHead, {
      countLabel: '10 tables',
      status: 'Standard room · 102 seated · guests see it on the day.',
      unseated: 14,
      onUnseated: () => {},
      onAutoArrange: () => {},
      autoDisabled: false,
      autoBusy: false,
      rules: React.createElement('p', null, 'rules'),
      more: React.createElement('p', null, 'more'),
      view: '2d',
      onView: () => {},
      show3D: true,
      toast: { text: 'Added 2 tables of 10 · everyone has a seat', onUndo: () => {}, onDismiss: () => {} },
    }),
  );
  for (const want of ['Seat plan', '10 tables', 'Standard room · 102 seated · guests see it on the day.', 'Auto arrange', 'Rules', 'Unseated: 14', '2D', 'Added 2 tables of 10 · everyone has a seat', 'Undo']) {
    assert.ok(html.includes(want), `the phone head does not show “${want}”`);
  }
  assert.match(html, /data-seat-plan-more/, '⋯ (Add a table/element · Share & print) is missing');
  const foot = renderToStaticMarkup(
    React.createElement(PhoneSeatPlanFoot, { room: 'Standard room · 20 × 30 m · walkway 1.2 m', onOpen3D: () => {} }),
  );
  assert.ok(foot.includes('pinch to zoom · tap a table'));
  assert.ok(foot.includes('Same layout in 3D ↗'));
  // No Undo once there is nothing to undo.
  const done = renderToStaticMarkup(
    React.createElement(PhoneSeatPlanHead, {
      countLabel: '1 table', status: 's', unseated: 0, onUnseated: () => {}, onAutoArrange: () => {}, autoDisabled: false, autoBusy: false,
      rules: null, more: null, view: '2d', onView: () => {}, show3D: false,
      toast: { text: 'Everyone already has a seat', onUndo: null, onDismiss: () => {} },
    }),
  );
  assert.ok(!done.includes('data-seat-plan-undo'), 'Undo shows with nothing to undo');
});

test('3 · every number on the head is counted: units, linked once, the sweetheart not a guest table', () => {
  const h = seatPlanHeadline({
    units: [...Array.from({ length: 10 }, () => ({ sweetheart: false })), { sweetheart: true }],
    seated: 102,
    roomName: seatPlanRoomName({ width: 20, length: 30 }),
    dayHasCome: false,
    showingEarly: false,
  });
  assert.deepEqual(h, { count: '10 tables', status: 'Standard room · 102 seated · guests see it on the day.' });
  assert.equal(seatPlanRoomName(null), 'Room size not set');
  assert.equal(seatPlanRoomName({ width: 24, length: 18 }), '24 × 18 m room');
  assert.match(seatPlanHeadline({ units: [], seated: 0, roomName: 'r', dayHasCome: true, showingEarly: false }).status, /guests see it today/);
  // The editor feeds it data, never a typed figure.
  const ed = editor();
  assert.match(ed, /seatPlanHeadline\(\{\s*units: displayUnits\.map/);
  assert.match(ed, /unseated=\{unseatedComing\}/);
});

test('4 · "Move … to…" lists only tables with room for the party (a linked unit is one row)', () => {
  const units = [
    { id: 'u7', label: 'Table 7', free: 0, tableIds: ['t7'] },
    { id: 'u11', label: 'Table 11', free: 2, tableIds: ['t11'] },
    { id: 'u13', label: 'Table 13', free: 1, tableIds: ['t13'] },
    { id: 'g', label: '1 + 2', free: 3, tableIds: ['t1', 't2'] },
  ];
  const got = moveTargets(units, { currentTableId: 't7', party: 2 });
  assert.deepEqual(got.map((o) => [o.id, o.current]), [
    ['u7', true],
    ['u11', false],
    ['g', false],
  ]);
  const ed = editor();
  assert.match(ed, /<MoveGuestSheet/);
  assert.match(ed, /label: '\+ New table'/);
  assert.match(ed, /fd\.set\('seat_guest_ids', JSON\.stringify\(party\.map/);
});

function tbl(over: Partial<EventTableRow> & Pick<EventTableRow, 'table_id'>): EventTableRow {
  return {
    public_id: over.table_id,
    event_id: 'e',
    table_label: over.table_id,
    table_type: 'round_10',
    capacity: 10,
    sort_order: 0,
    x_pos: null,
    y_pos: null,
    rotation_deg: 0,
    removed_seats: [],
    link_group_id: null,
    link_group_label: null,
    ...over,
  };
}

test('5 · Auto arrange places new tables only in free space — every placed table stays put', () => {
  const rect = { width: 400, height: 600 };
  const ppm = rect.width / 20;
  const footprintOf = (t: EventTableRow) => {
    const g = tableGeometry(shapeHintFor(t.table_type), t.capacity);
    const s = (2.8 * ppm) / g.box.w;
    return { w: g.box.w * s, h: g.box.h * s };
  };
  const placed = [tbl({ table_id: 'a', x_pos: 30, y_pos: 40 }), tbl({ table_id: 'b', x_pos: 70, y_pos: 40 })];
  const fresh = tbl({ table_id: 'new:Table 3', sort_order: 5 });
  const res = solveAutoLayout({
    tables: [...placed, fresh],
    keepPlaced: new Set(['a', 'b']),
    floorPlan: { ...DEFAULT_FLOOR_PLAN, dance_enabled: false, cocktail_enabled: false },
    rect,
    footprintOf,
    aisleM: 0.9,
    pxPerMeter: ppm,
  });
  assert.deepEqual(res.placed.a, { x: 30, y: 40 }, 'a placed table moved');
  assert.deepEqual(res.placed.b, { x: 70, y: 40 }, 'a placed table moved');
  const p = res.placed['new:Table 3'];
  assert.ok(p, 'the new table found no free space');
  const pose = (t: EventTableRow, x: number, y: number) => {
    const g = tableGeometry(shapeHintFor(t.table_type), t.capacity);
    return { tableId: t.table_id, shape: shapeHintFor(t.table_type), capacity: t.capacity, x: (x / 100) * rect.width, y: (y / 100) * rect.height, rot: 0, scale: footprintOf(t).w / g.box.w, linkGroupId: null };
  };
  const ok = checkPlacement(pose(fresh, p.x, p.y), { others: placed.map((t) => pose(t, Number(t.x_pos), Number(t.y_pos))), zones: [] }, { gapPx: 0.9 * ppm });
  assert.ok(ok.valid, 'the new table overlaps a placed one');
  // The editor sends the couple's tables as fixed.
  assert.match(editor(), /keepPlaced,\s*floorPlan:/);
});

test('6 · Undo is an intent of autoArrange — no new server action', () => {
  const actions = code('actions.ts');
  assert.match(actions, /formData\.get\('intent'\) === 'undo'/);
  assert.doesNotMatch(actions, /export async function undoAutoArrange/, 'Undo became its own exported server action');
  assert.match(actions, /seatedGuestIds: rows\.map\(\(r\) => r\.guest_id\)/, 'Undo would not know who this run seated');
  const ed = editor();
  assert.match(ed, /fd\.set\('intent', 'undo'\)/);
  assert.match(ed, /data-auto-changed=\{t\.table_id\}/, 'the gold ring on changed tables is gone');
});

test('7 · REACHABLE: Details › Seat plan → the editor → on a phone the head, ⋯ → Share & print → the A3', () => {
  const page = code('page.tsx');
  assert.match(page, /if \(inMaker\) \{[\s\S]*editorFor\(/, 'the Maker no longer draws the editor');
  const ed = editor();
  /* The Studio's phone draws its compact head (studio round 3, 2026-10-08); every other phone the shipped one. */
  assert.match(ed, /\{studioSeat \? studioHead : isPhone \? phoneHead : doorStrip\}/, 'a phone still gets the desk bar instead of its head');
  assert.match(ed, /\{isPhone \? null : \(\s*<CommandBar>/);
  /* ⋯'s menu is one copy (`phoneMore`), drawn by the shipped head and the Studio's (2026-10-08). */
  const more = ed.slice(ed.indexOf('const phoneMore = ('), ed.indexOf('const phoneTrailing = ('));
  assert.match(ed, /<PhoneSeatPlanHead[\s\S]{0,600}?more=\{phoneMore\}/, 'the phone head no longer draws ⋯’s menu');
  assert.match(more, /\{shareMenuBody\}/, '⋯ does not hold Share & print');
  assert.match(more, /\{addMenuBody\}/, '⋯ does not hold Add a table/element');
  assert.match(ed, /href=\{`\/dashboard\/\$\{eventId\}\/seating\/export\?mode=moodboard`\}/, 'Share & print does not reach the A3 seat plan');
  assert.match(ed, /\{phoneFoot\}/);
  assert.match(ed, /\{moveSheet\}/);
  const maker = readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components', 'maker-details.tsx'), 'utf8');
  assert.match(maker, /bodies\.seating = \(/, 'Details no longer hosts the Seat plan');
});
