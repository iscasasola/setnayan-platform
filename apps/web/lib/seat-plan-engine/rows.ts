/**
 * 🪑 lib/seat-plan-engine/rows.ts — the grid: even rows facing the stage (PR #8057, the round-two floor). Moved here from
 * `lib/plan-maker.ts` unchanged, as `ADAPTER.md` §7 says, so the grid has exactly ONE home. Its spacing reads the engine's
 * own names (`SLOT_GAP_PCT` · `ROW_GAP_PCT` · `TABLE_BAND_PCT`), the same numbers the couple's Auto-arrange uses.
 */
import type { EventTableRow, FloorPlanRow } from '@/lib/seating';
import { DEFAULT_ROOM_M, ROW_GAP_PCT, SLOT_GAP_PCT, TABLE_BAND_PCT, TABLE_FOOTPRINT_M, shapeHintFor, tableGeometry } from './geometry';
import { planRoomM, type PlanRoom } from './plan';

// ── The grid: even rows facing the stage, centred on the stage line (owner 2026-11-20) ───────────────────────────────
//
// 🪑⚙ ONE ENGINE (DECISION_LOG 2026-11-20, "ONE SEAT-PLAN ENGINE FOR THE COUPLE AND THE SUPPLIER" · "GUESTS › SEATS,
// ROUND TWO", pick 3): *"the need to run the same logic and code."* The rows a table joins, how a row re-centres, what a
// dragged table lines up with and what Fit shows are decided HERE, for a couple's floor and a shop's Spaces alike. The
// couple's editor (`seating-editor.tsx`) and the shared `PlanMaker` both call these; neither keeps a copy.
//
//   · A ROW is a line across the room, facing the stage. Its tables stand with ONE gap between them, the run centred
//     on the STAGE LINE: one table sits on the line, two sit either side of it (`centredRun`).
//   · A table is STILL ON THE GRID while it stands exactly where its row's centred run puts it (`onGridRun`). A table
//     moved by hand no longer does — and a table that is not on the grid NEVER moves when a row re-centres.
//   · A NEW table joins the first row, front first, that has room for it; that row re-centres (`joinRow`). With no room
//     in any row it starts the next row, on the stage line.
//   · FIT shows the whole ROOM — every wall — in the part of the screen nothing covers (`fitRoom`).
//
// Everything is percent of the room (0–100 on each axis), the unit both plans store. Pure. 🔒 lib/seat-plan-engine/rows.test.ts

/** The gap between two tables in a row, and between two rows — percent of the room. The couple's Auto-arrange numbers. */
export const GRID_GAP = SLOT_GAP_PCT;
export const GRID_ROW_GAP = ROW_GAP_PCT;
/** Tables keep inside this band; the outer ring is the walls' (doors, booths). The couple's Auto-arrange numbers. */
export const GRID_LO = TABLE_BAND_PCT.lo;
export const GRID_HI = TABLE_BAND_PCT.hi;
/** How far off its slot a table may stand and still count as on the grid — percent. */
export const GRID_TOL = 0.75;
/** A dragged table within this of a row or a column line snaps to it — percent (the couple editor's shipped number). */
export const GRID_SNAP_TOL = 1.2;

/** A table as the grid reads it: its centre and its footprint, chairs included. */
export type GridBox = { id: string; x: number; y: number; w: number; h: number };
/** A stage, or any area no table may stand on (dance floor, cocktail area) — centre-anchored. */
export type GridArea = { x: number; y: number; w: number; h: number };

/** Which way the rows run. Rows are parallel to the stage and step away from it. */
export type GridFrame = {
  /** true = rows run left to right (the stage is toward the top or the bottom wall). */
  across: boolean;
  /** Rows step this way from the stage, along the depth axis. */
  sign: 1 | -1;
  /** THE STAGE LINE — the stage's centre on the row axis. Every row centres on it. */
  line: number;
  /** The stage's front edge on the depth axis: the first row starts one row gap beyond it. */
  front: number;
};

/** The rows' frame for a stage — the same dominant-axis rule the couple's Auto-arrange has always used. */
export function gridFrame(stage: GridArea): GridFrame {
  const dx = 50 - stage.x;
  const dy = 50 - stage.y;
  const across = Math.abs(dy) >= Math.abs(dx);
  const sign: 1 | -1 = (across ? dy : dx) >= 0 ? 1 : -1;
  return {
    across,
    sign,
    line: across ? stage.x : stage.y,
    front: across ? stage.y + (sign * stage.h) / 2 : stage.x + (sign * stage.w) / 2,
  };
}

/** A box in the frame: `a` along the row, `d` away from the stage, with its breadth and depth. */
type Framed = { id: string; a: number; d: number; bw: number; bd: number };
const framed = (b: GridBox, f: GridFrame): Framed =>
  f.across ? { id: b.id, a: b.x, d: b.y, bw: b.w, bd: b.h } : { id: b.id, a: b.y, d: b.x, bw: b.h, bd: b.w };
const unframed = (a: number, d: number, f: GridFrame): { x: number; y: number } => (f.across ? { x: a, y: d } : { x: d, y: a });
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Centres of a row of tables with these breadths: one gap between neighbours, the whole run centred on `line`. */
export function centredRun(breadths: readonly number[], line: number, gap: number = GRID_GAP): number[] {
  const total = breadths.reduce((s, w) => s + w, 0) + gap * Math.max(0, breadths.length - 1);
  let cursor = line - total / 2;
  return breadths.map((w) => {
    const mid = cursor + w / 2;
    cursor += w + gap;
    return mid;
  });
}

/** The rows on a floor, front first: tables whose centres share a line (within the tolerance), each row left to right. */
export function gridRows(boxes: readonly GridBox[], frame: GridFrame, tol: number = GRID_TOL): Array<{ depth: number; ids: string[] }> {
  const fr = boxes.map((b) => framed(b, frame)).sort((p, q) => frame.sign * (p.d - q.d) || p.a - q.a);
  const rows: Array<{ depth: number; items: Framed[] }> = [];
  for (const b of fr) {
    const row = rows.find((r) => Math.abs(r.depth - b.d) <= tol);
    if (row) row.items.push(b);
    else rows.push({ depth: b.d, items: [b] });
  }
  return rows.map((r) => ({ depth: r.depth, ids: r.items.sort((p, q) => p.a - q.a).map((b) => b.id) }));
}

/**
 * The tables of ONE row that are still on the grid: the longest run of neighbours standing exactly where a centred run
 * of their own breadths puts them. Everything else on that line was placed by hand. A lone table counts when it sits on
 * the stage line.
 */
export function onGridRun(row: readonly GridBox[], frame: GridFrame, gap: number = GRID_GAP, tol: number = GRID_TOL): string[] {
  const fr = row.map((b) => framed(b, frame)).sort((p, q) => p.a - q.a);
  for (let k = fr.length; k >= 1; k--) {
    for (let start = 0; start + k <= fr.length; start++) {
      const win = fr.slice(start, start + k);
      const want = centredRun(win.map((b) => b.bw), frame.line, gap);
      if (win.every((b, i) => Math.abs(b.a - want[i]!) <= tol)) return win.map((b) => b.id);
    }
  }
  return [];
}

function overlaps(p: Framed, q: Framed, gap: number): boolean {
  return Math.abs(p.a - q.a) < (p.bw + q.bw) / 2 + gap && Math.abs(p.d - q.d) < (p.bd + q.bd) / 2 + gap;
}

export type JoinRowInput = {
  /** Every table on the floor now. */
  boxes: readonly GridBox[];
  /** The new table's footprint. */
  add: { w: number; h: number };
  stage: GridArea;
  /** Areas no table stands on, beside the stage itself (dance floor, cocktail area). */
  areas?: readonly GridArea[];
  /** Tables that keep their row to themselves — the couple's own table, on the stage line. */
  alone?: ReadonlySet<string>;
  /** The new table keeps a row to itself too (it IS the couple's table). */
  addAlone?: boolean;
  gap?: number;
  rowGap?: number;
  lo?: number;
  hi?: number;
  tol?: number;
};
export type JoinRowResult = {
  /** Where the new table lands. */
  x: number;
  y: number;
  /** The row's tables that shifted so the row is centred again — tables still on the grid, never one placed by hand. */
  moved: Array<{ id: string; x: number; y: number }>;
  /** The table it landed beside (its neighbour in the row); null when it starts a row. */
  beside: string | null;
};

/**
 * WHERE A NEW TABLE LANDS. It joins the first row, front first, that is still on the grid and has room; that row
 * re-centres on the stage line. Tables placed by hand never move, and nothing lands on one, on the stage or on an area.
 * With no row to join it starts the next row, on the stage line. null = the room has no free line left (the caller
 * keeps its own fallback).
 */
export function joinRow(input: JoinRowInput): JoinRowResult | null {
  const gap = input.gap ?? GRID_GAP;
  const rowGap = input.rowGap ?? GRID_ROW_GAP;
  const lo = input.lo ?? GRID_LO;
  const hi = input.hi ?? GRID_HI;
  const tol = input.tol ?? GRID_TOL;
  const frame = gridFrame(input.stage);
  const byId = new Map(input.boxes.map((b) => [b.id, b]));
  const all = input.boxes.map((b) => framed(b, frame));
  const blocks: Framed[] = [input.stage, ...(input.areas ?? [])].map((z, i) => framed({ id: `__area_${i}`, ...z }, frame));
  const add = framed({ id: '__new__', x: 0, y: 0, w: input.add.w, h: input.add.h }, frame);
  const clear = (run: readonly Framed[], skip: ReadonlySet<string>) =>
    run.every(
      (b) =>
        b.a - b.bw / 2 >= lo - 1e-6 &&
        b.a + b.bw / 2 <= hi + 1e-6 &&
        all.every((o) => skip.has(o.id) || !overlaps(b, o, gap / 2)) &&
        blocks.every((z) => !overlaps(b, z, 0)),
    );

  const rows = gridRows(input.boxes, frame, tol);
  let lastGridFar: number | null = null;
  for (const row of rows) {
    const members = row.ids.map((id) => byId.get(id)!);
    const grid = onGridRun(members, frame, gap, tol);
    if (grid.length === 0) continue;
    // Depth measured AWAY from the stage (so "further" is always larger, whichever wall the stage is on).
    const far = Math.max(...grid.map((id) => frame.sign * framed(byId.get(id)!, frame).d + framed(byId.get(id)!, frame).bd / 2));
    lastGridFar = lastGridFar === null ? far : Math.max(lastGridFar, far);
    if (input.addAlone || grid.some((id) => input.alone?.has(id))) continue;
    const run = grid.map((id) => framed(byId.get(id)!, frame));
    const mids = centredRun([...run.map((b) => b.bw), add.bw], frame.line, gap);
    const next = [...run, add].map((b, i) => ({ ...b, a: mids[i]!, d: row.depth }));
    if (!clear(next, new Set(grid))) continue;
    const at = unframed(next[next.length - 1]!.a, row.depth, frame);
    return {
      x: r1(at.x),
      y: r1(at.y),
      moved: next.slice(0, -1).flatMap((b) => {
        const was = byId.get(b.id)!;
        const p = unframed(b.a, b.d, frame);
        return Math.abs(was.x - p.x) > 0.05 || Math.abs(was.y - p.y) > 0.05 ? [{ id: b.id, x: r1(p.x), y: r1(p.y) }] : [];
      }),
      beside: run[run.length - 1]!.id,
    };
  }
  // A row of its own: one row gap beyond the last row still on the grid (or the stage's front), on the stage line —
  // stepping further from the stage past whatever stands there.
  const startFar = lastGridFar ?? frame.sign * frame.front;
  for (let step = 0; step <= 400; step++) {
    const d = frame.sign * (startFar + rowGap + add.bd / 2 + step * 0.5);
    const pastFarWall = frame.sign === 1 ? d + add.bd / 2 > hi + 1e-6 : d - add.bd / 2 < lo - 1e-6;
    if (pastFarWall) break;
    const beforeBand = frame.sign === 1 ? d - add.bd / 2 < lo - 1e-6 : d + add.bd / 2 > hi + 1e-6;
    if (beforeBand) continue;
    const cand = { ...add, a: frame.line, d };
    if (clear([cand], new Set())) {
      const at = unframed(cand.a, cand.d, frame);
      return { x: r1(at.x), y: r1(at.y), moved: [], beside: null };
    }
  }
  return null;
}

/**
 * A WHOLE FLOOR ON THE GRID — the tables in the order given, front rows first, each row centred on the stage line; a
 * table marked `alone` (the couple's own) keeps its row to itself, on the line. This is `joinRow`, one table after
 * another, so a drafted floor and a floor grown one table at a time are the same floor. A table the room has no line
 * for is left out (the caller says so).
 */
export function gridLayout(input: Omit<JoinRowInput, 'boxes' | 'add' | 'alone' | 'addAlone'> & {
  tables: ReadonlyArray<{ id: string; w: number; h: number; alone?: boolean }>;
}): Record<string, { x: number; y: number }> {
  const boxes: GridBox[] = [];
  const alone = new Set<string>();
  for (const t of input.tables) {
    const at = joinRow({ ...input, boxes, add: { w: t.w, h: t.h }, alone, addAlone: t.alone === true });
    if (!at) continue;
    for (const m of at.moved) {
      const b = boxes.find((x) => x.id === m.id);
      if (b) {
        b.x = m.x;
        b.y = m.y;
      }
    }
    boxes.push({ id: t.id, x: at.x, y: at.y, w: t.w, h: t.h });
    if (t.alone) alone.add(t.id);
  }
  return Object.fromEntries(boxes.map((b) => [b.id, { x: b.x, y: b.y }]));
}

/**
 * A TABLE BEING MOVED LINES UP. Within `tol` of another table's row or column — or of the stage line — it snaps to
 * that line; `guideX` / `guideY` are the lines to draw, and `withId` is the table it lined up with (null = the stage
 * line, or nothing). The first table that matches an axis wins it, in the order given.
 */
export function snapToLines(input: {
  at: { x: number; y: number };
  others: ReadonlyArray<{ id: string; x: number; y: number }>;
  /** The stage's centre: the line every row centres on. Absent = the room's centre lines. */
  stage?: { x: number; y: number };
  tol?: number;
}): { x: number; y: number; guideX: number | null; guideY: number | null; withId: string | null } {
  const tol = input.tol ?? GRID_SNAP_TOL;
  let { x, y } = input.at;
  let guideX: number | null = null;
  let guideY: number | null = null;
  let withId: string | null = null;
  for (const o of input.others) {
    if (guideX === null && Math.abs(o.x - input.at.x) < tol) {
      x = o.x;
      guideX = o.x;
      withId ??= o.id;
    }
    if (guideY === null && Math.abs(o.y - input.at.y) < tol) {
      y = o.y;
      guideY = o.y;
      withId ??= o.id;
    }
    if (guideX !== null && guideY !== null) break;
  }
  const cx = input.stage?.x ?? 50;
  const cy = input.stage?.y ?? 50;
  const frame = input.stage ? gridFrame({ ...input.stage, w: 0, h: 0 }) : null;
  // The stage line is a line on the ROW axis only; with no stage, both centre lines of the room are (as shipped).
  if (guideX === null && (!frame || frame.across) && Math.abs(cx - input.at.x) < tol) {
    x = cx;
    guideX = cx;
  }
  if (guideY === null && (!frame || !frame.across) && Math.abs(cy - input.at.y) < tol) {
    y = cy;
    guideY = cy;
  }
  return { x, y, guideX, guideY, withId };
}

/**
 * FIT SHOWS THE WHOLE ROOM (owner 2026-11-20, pick "Fit shows the whole room"; the fault it replaces: Fit and the
 * draft framed the TABLES, so two tables filled the screen and the walls were nowhere).
 *
 * `room` is the room's box as it is drawn at zoom 1, in the floor's own pixels, its top-left at (`room.left`,
 * `room.top`) inside the `cell` — the whole floor element. `inset` is what covers the cell's edges (a pinned row on
 * top, the tray and the thumb row at the foot). `also` are boxes that stand OUTSIDE the walls and must stay in view
 * (a cocktail area docked beyond a wall, a table dragged past one) — in the room's pixels, relative to its top-left.
 * Returns the zoom and the pan (the world layer's translate, in the room's pixels) that centre the room, whole, in
 * what is left.
 */
export function fitRoom(input: {
  room: { left: number; top: number; width: number; height: number };
  cell: { width: number; height: number };
  inset?: { top?: number; right?: number; bottom?: number; left?: number };
  also?: ReadonlyArray<{ minX: number; minY: number; maxX: number; maxY: number }>;
  /** Breathing room round the walls, as a share of the free area. */
  pad?: number;
  minZoom?: number;
  maxZoom?: number;
}): { zoom: number; x: number; y: number } {
  const { room, cell } = input;
  const it = { top: 0, right: 0, bottom: 0, left: 0, ...input.inset };
  let minX = 0;
  let minY = 0;
  let maxX = room.width;
  let maxY = room.height;
  for (const b of input.also ?? []) {
    if (![b.minX, b.minY, b.maxX, b.maxY].every(Number.isFinite)) continue;
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  const freeW = Math.max(1, cell.width - it.left - it.right);
  const freeH = Math.max(1, cell.height - it.top - it.bottom);
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const pad = input.pad ?? 0.06;
  let zoom = Math.min(freeW / bw, freeH / bh) * (1 - pad);
  if (input.maxZoom !== undefined) zoom = Math.min(input.maxZoom, zoom);
  if (input.minZoom !== undefined) zoom = Math.max(input.minZoom, zoom);
  // The middle of the free area, in the room's own pixels (the world layer's origin is the room's top-left).
  const midX = it.left + freeW / 2 - room.left;
  const midY = it.top + freeH / 2 - room.top;
  return { zoom, x: midX - zoom * ((minX + maxX) / 2), y: midY - zoom * ((minY + maxY) / 2) };
}

/** "Grand Ballroom" / "Your room" and "20 × 30 m" — the two lines every floor wears in its top-left corner. */
export function planRoomWords(room: PlanRoom, name?: string | null): { name: string; size: string } {
  const r = planRoomM(room);
  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  return { name: name?.trim() || 'Your room', size: `${n(r.widthM)} × ${n(r.depthM)} m` };
}

// ── The couple's floor on the grid (event tables, filled from the guest list) ────────────────────────────────────────

/** A couple's floor as the grid reads it: the room in metres, the stage, and the areas no table stands on. */
export type SeatingFloor = { roomM: { w: number; d: number }; stage: GridArea; areas: GridArea[] };

type FloorPlanForGrid = Pick<
  FloorPlanRow,
  | 'venue_width_m' | 'venue_length_m'
  | 'stage_x' | 'stage_y' | 'stage_w' | 'stage_h'
  | 'dance_enabled' | 'dance_x' | 'dance_y' | 'dance_w' | 'dance_h'
  | 'cocktail_enabled' | 'cocktail_x' | 'cocktail_y' | 'cocktail_w' | 'cocktail_h'
>;

/** The couple's saved floor plan as a `SeatingFloor` — an unsized room is the couple's default 20 × 30 m board. */
export function seatingFloorOf(fp: FloorPlanForGrid): SeatingFloor {
  const sized = fp.venue_width_m !== null && fp.venue_length_m !== null && fp.venue_width_m > 0 && fp.venue_length_m > 0;
  return {
    roomM: sized ? { w: fp.venue_width_m!, d: fp.venue_length_m! } : { ...DEFAULT_ROOM_M },
    stage: { x: fp.stage_x, y: fp.stage_y, w: fp.stage_w, h: fp.stage_h },
    areas: [
      ...(fp.dance_enabled ? [{ x: fp.dance_x, y: fp.dance_y, w: fp.dance_w, h: fp.dance_h }] : []),
      ...(fp.cocktail_enabled ? [{ x: fp.cocktail_x, y: fp.cocktail_y, w: fp.cocktail_w, h: fp.cocktail_h }] : []),
    ],
  };
}

type SeatingTableLike = Pick<EventTableRow, 'table_type' | 'capacity'>;

/** A couple table's real footprint, chairs included, as percent of the room — what the floor draws it at. */
export function seatingBoxPct(t: SeatingTableLike, roomM: { w: number; d: number }): { w: number; h: number } {
  const g = tableGeometry(shapeHintFor(t.table_type), t.capacity);
  const wM = TABLE_FOOTPRINT_M[t.table_type];
  return { w: (wM / roomM.w) * 100, h: (((g.box.h / g.box.w) * wM) / roomM.d) * 100 };
}

/** The couple's own table keeps its row to itself, on the stage line. */
const keepsItsRow = (t: SeatingTableLike) => shapeHintFor(t.table_type) === 'sweetheart';

/** Where a NEW couple table lands on this floor (`joinRow`), given every table already placed. */
export function seatingJoinRow(
  floor: SeatingFloor,
  placed: ReadonlyArray<SeatingTableLike & { id: string; x: number; y: number }>,
  add: SeatingTableLike,
): JoinRowResult | null {
  return joinRow({
    boxes: placed.map((t) => ({ id: t.id, x: t.x, y: t.y, ...seatingBoxPct(t, floor.roomM) })),
    add: seatingBoxPct(add, floor.roomM),
    addAlone: keepsItsRow(add),
    alone: new Set(placed.filter(keepsItsRow).map((t) => t.id)),
    stage: floor.stage,
    areas: floor.areas,
  });
}

/** A whole couple floor on the grid, tables in the order given (`gridLayout`) — "Seat everyone for me". */
export function seatingGridLayout(
  floor: SeatingFloor,
  tables: ReadonlyArray<SeatingTableLike & { id: string }>,
): Record<string, { x: number; y: number }> {
  return gridLayout({
    stage: floor.stage,
    areas: floor.areas,
    tables: tables.map((t) => ({ id: t.id, ...seatingBoxPct(t, floor.roomM), alone: keepsItsRow(t) })),
  });
}
