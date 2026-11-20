/**
 * 🔒 THE GRID — one engine for the couple's floor and a shop's Spaces (owner 2026-11-20, DECISION_LOG "ONE SEAT-PLAN
 * ENGINE FOR THE COUPLE AND THE SUPPLIER" and "GUESTS › SEATS, ROUND TWO", pick 3: *the row re-centres on the stage
 * line; tables you placed by hand never move*). `lib/plan-maker.ts`: centredRun · gridRows · onGridRun · joinRow ·
 * gridLayout · snapToLines · fitRoom.
 *
 * THE FAULTS THIS HOLDS SHUT (seen live on a test event, 375 wide, `prototypes/guests_redesign_2026-11-20/now/13,17`):
 *   · a new table landed off the row, wherever the first free spot was;
 *   · two tables in a row were NOT either side of the stage line (the first sat on it, the second beside it);
 *   · Fit and the draft framed the tables, so the walls were out of view.
 *
 * Sabotage (each goes red): make `centredRun` start at the line instead of centring · let `joinRow` shift a table that
 * is off the grid · drop the `alone` rule · make `fitRoom` frame `also` only · ignore `inset`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRID_GAP,
  centredRun,
  fitRoom,
  gridFrame,
  gridLayout,
  gridRows,
  joinRow,
  lineUpPlan,
  onGridRun,
  planRoomWords,
  snapToLines,
  type GridBox,
  type Plan,
} from './plan-maker';

const STAGE = { x: 50, y: 8, w: 30, h: 8 }; // top wall, centred — the couple's default
const T = { w: 14, h: 9.3 }; // a round of 10 in a 20 × 30 m room, chairs included
const box = (id: string, x: number, y: number): GridBox => ({ id, x, y, ...T });

test('centredRun: one table sits on the line; two sit either side of it; the gaps are equal', () => {
  assert.deepEqual(centredRun([14], 50), [50]);
  const two = centredRun([14, 14], 50);
  assert.equal(two[0]! + two[1]!, 100, 'the pair is centred on the line');
  assert.equal(two[1]! - two[0]!, 14 + GRID_GAP);
  const mixed = centredRun([10, 20, 10], 40);
  assert.equal(mixed[1], 40);
  assert.equal(mixed[1]! - 10 - (mixed[0]! + 5), GRID_GAP, 'the gap is between EDGES, so unequal tables still read even');
});

test('gridFrame: rows face the stage — across for a top or bottom stage, down for a side one', () => {
  assert.deepEqual(gridFrame(STAGE), { across: true, sign: 1, line: 50, front: 12 });
  assert.deepEqual(gridFrame({ x: 50, y: 92, w: 30, h: 8 }), { across: true, sign: -1, line: 50, front: 88 });
  assert.deepEqual(gridFrame({ x: 6, y: 40, w: 8, h: 30 }), { across: false, sign: 1, line: 40, front: 10 });
});

test('the first table lands on the stage line, one row gap in front of the stage', () => {
  const at = joinRow({ boxes: [], add: T, stage: STAGE })!;
  assert.equal(at.x, 50);
  assert.ok(at.y - T.h / 2 > 12, 'clear of the stage');
  assert.equal(at.beside, null);
  assert.deepEqual(at.moved, []);
});

test('PICK 3 · a table joining a row re-centres the row on the stage line', () => {
  const first = joinRow({ boxes: [], add: T, stage: STAGE })!;
  const boxes = [box('t1', first.x, first.y)];
  const second = joinRow({ boxes, add: T, stage: STAGE })!;
  assert.equal(second.y, first.y, 'the new table is on Table 1’s row — not off it');
  assert.equal(second.beside, 't1');
  assert.equal(second.moved.length, 1);
  const t1 = second.moved[0]!;
  assert.equal(t1.id, 't1');
  assert.ok(Math.abs(t1.x + second.x - 100) < 0.11, 'the two sit either side of the stage line');
  assert.ok(Math.abs(second.x - t1.x - (T.w + GRID_GAP)) < 0.11, 'one gap between them');
});

test('PICK 3 · a table placed by hand NEVER moves, and nothing lands on it', () => {
  const first = joinRow({ boxes: [], add: T, stage: STAGE })!;
  // Table 1 dragged 9% to the right of its slot: it is on the row's line still, but no longer on the grid.
  const hand = box('t1', first.x + 9, first.y);
  assert.deepEqual(onGridRun([hand], gridFrame(STAGE)), []);
  const next = joinRow({ boxes: [hand], add: T, stage: STAGE })!;
  assert.deepEqual(next.moved, [], 'a hand-placed table was shifted');
  assert.ok(Math.abs(next.x - hand.x) >= T.w || Math.abs(next.y - hand.y) >= T.h, 'the new table landed on the hand-placed one');
  // …and a row with one gridded table and one hand-placed one shifts ONLY the gridded one.
  const row = [box('g', 50, first.y), box('h', 82, first.y)];
  assert.deepEqual(onGridRun(row, gridFrame(STAGE)), ['g']);
  const third = joinRow({ boxes: row, add: T, stage: STAGE })!;
  assert.ok(third.moved.every((m) => m.id !== 'h'), 'the hand-placed table moved');
});

test('a full row starts the next one, on the stage line', () => {
  let boxes: GridBox[] = [];
  const ys = new Set<number>();
  for (let i = 0; i < 6; i++) {
    const at = joinRow({ boxes, add: T, stage: STAGE })!;
    boxes = boxes.map((b) => at.moved.find((m) => m.id === b.id) ? { ...b, ...at.moved.find((m) => m.id === b.id)! } : b);
    boxes.push(box(`t${i + 1}`, at.x, at.y));
    ys.add(at.y);
  }
  // 80% of breadth holds four 14%-tables with 3% gaps (65%), not five (82%).
  const rows = gridRows(boxes, gridFrame(STAGE));
  assert.deepEqual(rows.map((r) => r.ids.length), [4, 2]);
  for (const r of rows) {
    const xs = r.ids.map((id) => boxes.find((b) => b.id === id)!.x);
    assert.ok(Math.abs(xs.reduce((s, x) => s + x, 0) / xs.length - 50) < 0.11, 'every row is centred on the stage line');
  }
  assert.equal(ys.size, 2);
});

test('the couple’s table keeps its row to itself, on the line (the auto draft uses the same grid)', () => {
  const at = gridLayout({
    stage: STAGE,
    tables: [
      { id: 'couple', w: 8, h: 5, alone: true },
      { id: 't1', ...T },
      { id: 't2', ...T },
      { id: 't3', ...T },
    ],
  });
  assert.equal(at.couple!.x, 50);
  assert.ok(at.t1!.y > at.couple!.y, 'guest tables start behind the couple’s row');
  assert.equal(new Set([at.t1!.y, at.t2!.y, at.t3!.y]).size, 1);
  assert.ok(Math.abs((at.t1!.x + at.t2!.x + at.t3!.x) / 3 - 50) < 0.11);
});

test('a drafted floor and a floor grown one table at a time are the same floor', () => {
  const drafted = gridLayout({ stage: STAGE, tables: [1, 2, 3, 4, 5].map((i) => ({ id: `t${i}`, ...T })) });
  let boxes: GridBox[] = [];
  for (let i = 1; i <= 5; i++) {
    const at = joinRow({ boxes, add: T, stage: STAGE })!;
    boxes = boxes.map((b) => ({ ...b, ...(at.moved.find((m) => m.id === b.id) ?? {}) }));
    boxes.push(box(`t${i}`, at.x, at.y));
  }
  assert.deepEqual(Object.fromEntries(boxes.map((b) => [b.id, { x: b.x, y: b.y }])), drafted);
});

test('nothing lands on the dance floor, and a stage on the bottom wall steps rows UP the room', () => {
  const dance = { x: 50, y: 30, w: 30, h: 20 };
  const at = joinRow({ boxes: [], add: T, stage: STAGE, areas: [dance] })!;
  assert.ok(at.y - T.h / 2 >= dance.y + dance.h / 2 || at.y + T.h / 2 <= dance.y - dance.h / 2, 'the table is on the dance floor');
  const up = joinRow({ boxes: [], add: T, stage: { x: 50, y: 92, w: 30, h: 8 } })!;
  assert.ok(up.y < 88 && up.y > 50);
});

test('snapToLines: a moved table snaps to the nearest row and column and names what it lined up with', () => {
  const others = [{ id: 't1', x: 40, y: 30 }];
  const s = snapToLines({ at: { x: 40.8, y: 55 }, others, stage: { x: 50, y: 8 } });
  assert.deepEqual([s.x, s.guideX, s.withId], [40, 40, 't1']);
  assert.equal(s.guideY, null);
  const onLine = snapToLines({ at: { x: 50.9, y: 55 }, others, stage: { x: 50, y: 8 } });
  assert.deepEqual([onLine.x, onLine.guideX, onLine.withId], [50, 50, null], 'the stage line is a line too');
  const free = snapToLines({ at: { x: 70, y: 70 }, others, stage: { x: 50, y: 8 } });
  assert.deepEqual([free.x, free.y, free.guideX, free.guideY], [70, 70, null, null]);
});

test('FIT SHOWS THE WHOLE ROOM — every wall, in the part of the floor nothing covers', () => {
  // A phone: the floor is 375 × 620, the room box (20 × 30 m) is 375 wide → 562 tall, centred; the pinned row covers 70
  // at the top, the tray + thumb row 260 at the foot.
  const room = { left: 0, top: 29, width: 375, height: 562 };
  const v = fitRoom({ room, cell: { width: 375, height: 620 }, inset: { top: 70, bottom: 260 } });
  const top = room.top + v.y;
  const bottom = room.top + v.y + v.zoom * room.height;
  const left = room.left + v.x;
  const right = room.left + v.x + v.zoom * room.width;
  assert.ok(top >= 70 && bottom <= 620 - 260, `the walls run under the chrome: ${top}–${bottom}`);
  assert.ok(left >= 0 && right <= 375);
  assert.ok(Math.abs((top + bottom) / 2 - (70 + (620 - 260 - 70) / 2)) < 0.5, 'centred in what is free');
  // The walls decide the zoom — two tables in the middle change nothing…
  const same = fitRoom({ room, cell: { width: 375, height: 620 }, inset: { top: 70, bottom: 260 }, also: [{ minX: 100, minY: 200, maxX: 250, maxY: 300 }] });
  assert.deepEqual(same, v);
  // …and something standing beyond a wall is kept in view too.
  const wider = fitRoom({ room, cell: { width: 375, height: 620 }, inset: { top: 70, bottom: 260 }, also: [{ minX: 0, minY: -200, maxX: 100, maxY: 0 }] });
  assert.ok(wider.zoom < v.zoom);
});

test('the supplier’s Line up centres its rows through the same rule', () => {
  const plan: Plan = {
    room: { widthM: 20, depthM: 15 },
    doors: [{ id: 'm', kind: 'main', wall: 'bottom', at: 50 }],
    tables: [1, 2].map((i) => ({ id: `t${i}`, label: `T${i}`, kind: 'round' as const, chairs: 8, x: null, y: null })),
  };
  const out = lineUpPlan(plan).tables;
  assert.equal(out[0]!.y, out[1]!.y);
  assert.ok(Math.abs(out[0]!.x! + out[1]!.x! - 100) < 0.21, 'two tables sit either side of the middle');
});

test('every floor wears its name and size', () => {
  assert.deepEqual(planRoomWords({ widthM: 20, depthM: 30 }), { name: 'Your room', size: '20 × 30 m' });
  assert.deepEqual(planRoomWords({ widthM: 24.5, depthM: 18 }, 'Grand Ballroom'), { name: 'Grand Ballroom', size: '24.5 × 18 m' });
});
