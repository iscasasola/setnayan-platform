/**
 * lib/plan-maker.ts — 🪑 THE SEAT PLAN'S DRAWING CORE, WITHOUT AN EVENT (owner 2026-11-18).
 *
 * Owner, verbatim: *"we can fix that seat plan to adapt for this one and improve the functions. Seat Plan maker and
 * Room Maker applies similar to the seat plan. they are already coded. we just need to improve and adapt them
 * properly"* (DECISION_LOG 2026-11-18, "Rooms & seating = the shipped seat plan and room makers, improved and
 * adapted"; "supplier floor plan reuses the couple seat-plan editor"; "Grid on every plan, Floor plan on Pro, Max
 * and Ultra").
 *
 * WHAT THIS IS. A PLAN — a room size, its doors, its tables — and the pure math that draws and edits one, with no
 * event, no guest list and no database. It is NOT a second engine: every couple table is drawn by the couple's own
 * `tableGeometry`, "Line up" is the couple's own `computeAutoLayout`, an unplaced table lands where the couple's
 * `defaultTablePosition` puts it, and the nearest-wall rule is the one the couple editor's walk-through entrance has
 * always used (`nearestWall`, now imported from here by `seating-editor.tsx`). What is new is only what a supplier
 * needs and a couple never had:
 *
 *   · three table shapes — Round · Long (with a "chairs at the ends" switch, counted in the one chair number) ·
 *     Half-moon booth — each with ONE chair count. A Long table with 4 chairs or fewer and no end chairs draws as a
 *     square. (The words match `lib/rooms-seating.ts` on the supplier storage PR: `round | long | half_moon`.)
 *   · a room given as Wide × Deep in metres, which sets the plan's shape;
 *   · doors that live ON a wall — a main door plus "＋ Door" — and snap to the nearest wall when dragged.
 *
 * WHO DRAWS IT. `app/_components/plan-maker/plan-maker.tsx` (the shared component a supplier page imports) — Grid
 * view, Floor plan view, read-only with one table marked, and the guest/name layer that can be switched off.
 *
 * 🔒 COUPLES NEVER SEE WHICH TABLE A SUPPLIER ASSIGNS (owner 18 Nov). Nothing here reads or writes a booking; the
 * marked table in read-only mode is whatever the caller passes, and only a supplier page passes one.
 *
 * Pure: no React, no Supabase. 🔒 lib/plan-maker.test.ts
 */
import {
  CHAIR_PX,
  DEFAULT_ROOM_M,
  TABLE_FOOTPRINT_M,
  TABLE_TYPE_CATALOG,
  computeAutoLayout,
  defaultTablePosition,
  effectiveCapacity,
  shapeHintFor,
  tableGeometry,
  type EventTableRow,
  type FloorPlanRow,
  type SeatSlot,
  type TableGeometry,
  type TableType,
} from '@/lib/seating';
import type { ShopPlan } from '@/lib/rooms-seating';

// ── The plan ─────────────────────────────────────────────────────────────────

/** The three shapes a supplier picks from (Rooms & seating). Same words as `lib/rooms-seating.ts` `TableShape`. */
export type PlanTableShape = 'round' | 'long' | 'half_moon';
/** A table is either a supplier shape or one of the couple's 11 locked types — the couple's own set is kept whole. */
export type PlanTableKind = PlanTableShape | TableType;

export type PlanTable = {
  id: string;
  label: string;
  kind: PlanTableKind;
  /** ONE chair count — for a Long table with ends, the two end chairs are counted IN it. */
  chairs: number;
  /** Long only: one chair at each end, counted in `chairs`. Ignored for every other kind. */
  chairsAtEnds?: boolean;
  /** Centre, percent (0–100) of the room's width / depth. null = never placed (drawn at its default spot). */
  x: number | null;
  y: number | null;
  rotationDeg?: number;
  /** Couple types only: chairs the couple deleted (`event_tables.removed_seats`). */
  removedSeats?: number[];
  /** Couple serpentine chain (`link_group_id` set) — spaces its chairs evenly, exactly as the couple editor does. */
  linked?: boolean;
};

/** A wall, as drawn on screen: top · right · bottom · left. */
export type PlanWall = 'top' | 'right' | 'bottom' | 'left';
export type PlanDoorKind = 'main' | 'service';
export type PlanDoor = {
  id: string;
  kind: PlanDoorKind;
  wall: PlanWall;
  /** Where along the wall, percent: left→right on the top and bottom walls, top→bottom on the side walls. */
  at: number;
};

/** Metres. Both or neither: an unsized room is drawn at `DEFAULT_ROOM`'s shape and says so. */
export type PlanRoom = { widthM: number | null; depthM: number | null };

export type Plan = { room: PlanRoom; doors: PlanDoor[]; tables: PlanTable[] };

export type PlanView = 'grid' | 'floor';

/** The room an unsized plan is drawn as — the couple editor's "Standard" preset's shape, turned landscape. */
export const DEFAULT_ROOM = { widthM: 20, depthM: 15 } as const;
/** Limits, matched to the supplier storage's CHECKs (`lib/rooms-seating.ts`: MAX_CHAIRS 60, MAX_SIDE_M 500). */
export const PLAN_MAX_CHAIRS = 60;
export const PLAN_MAX_SIDE_M = 500;

// ── The table catalogue ──────────────────────────────────────────────────────

export const PLAN_TABLE_SHAPES: ReadonlyArray<{ key: PlanTableShape; label: string; hint: string; chairs: number }> = [
  { key: 'round', label: 'Round', hint: 'Chairs all around', chairs: 8 },
  { key: 'long', label: 'Long', hint: 'Square when 4 chairs or fewer', chairs: 8 },
  { key: 'half_moon', label: 'Half-moon booth', hint: 'A curved cushion, seats along it', chairs: 4 },
];

const SHAPE_KEYS = new Set<string>(PLAN_TABLE_SHAPES.map((s) => s.key));
const COUPLE_KEYS = new Set<string>(TABLE_TYPE_CATALOG.map((t) => t.type));

export function isPlanTableShape(v: unknown): v is PlanTableShape {
  return typeof v === 'string' && SHAPE_KEYS.has(v);
}
export function isCoupleTableType(v: unknown): v is TableType {
  return typeof v === 'string' && COUPLE_KEYS.has(v);
}

/** What the table is drawn as: a Long table with ≤ 4 chairs and no end chairs is a square. */
export type PlanDrawnShape = 'round' | 'long' | 'square' | 'half_moon' | 'couple';
export function planDrawnShape(t: Pick<PlanTable, 'kind' | 'chairs' | 'chairsAtEnds'>): PlanDrawnShape {
  if (!isPlanTableShape(t.kind)) return 'couple';
  if (t.kind === 'long') return clampChairs(t.chairs) <= 4 && !t.chairsAtEnds ? 'square' : 'long';
  return t.kind;
}

export function clampChairs(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(PLAN_MAX_CHAIRS, Math.floor(n)));
}

/** Seats the table really offers — couple types less their deleted chairs; supplier shapes their one number. */
export function planSeatCount(t: PlanTable): number {
  if (isCoupleTableType(t.kind)) return effectiveCapacity(t.chairs, t.removedSeats);
  return clampChairs(t.chairs);
}

/** "Round · 8 chairs" · "Long · 10 chairs · 2 at the ends" · "Square · 4 chairs" · "Half-moon booth · seats 4". */
export function planTableWords(t: PlanTable): string {
  if (isCoupleTableType(t.kind)) return TABLE_TYPE_CATALOG.find((c) => c.type === t.kind)?.label ?? 'Table';
  const n = clampChairs(t.chairs);
  if (t.kind === 'half_moon') return `Half-moon booth · seats ${n}`;
  const drawn = planDrawnShape(t);
  const look = drawn === 'square' ? 'Square' : drawn === 'long' ? 'Long' : 'Round';
  const ends = t.kind === 'long' && t.chairsAtEnds ? ` · ${Math.min(2, n)} at the ends` : '';
  return `${look} · ${n} ${n === 1 ? 'chair' : 'chairs'}${ends}`;
}

/** Sum of every table's seats. */
export function planSeatTotal(plan: Pick<Plan, 'tables'>): number {
  return plan.tables.reduce((s, t) => s + planSeatCount(t), 0);
}

// ── Geometry (centre-origin px, the couple's `tableGeometry` space) ───────────

/**
 * The table's drawing — box, hub, chairs and (for a shape a circle or rectangle cannot say) an outline.
 * 🔑 A COUPLE TYPE GOES STRAIGHT THROUGH `tableGeometry`, byte for byte (`lib/plan-maker.test.ts` holds every one of
 * the 11). Round goes through it too. Only Long-with-ends, the square and the half-moon booth are drawn here.
 */
export function planTableGeometry(t: PlanTable): TableGeometry {
  if (isCoupleTableType(t.kind)) return tableGeometry(shapeHintFor(t.kind), t.chairs, t.linked === true);
  const n = clampChairs(t.chairs);
  const drawn = planDrawnShape(t);
  if (drawn === 'round') return tableGeometry('round', n);
  if (drawn === 'half_moon') return halfMoonGeometry(n);
  if (drawn === 'square') return squareGeometry(n);
  if (!t.chairsAtEnds) return tableGeometry('long_banquet', n);
  return longWithEndsGeometry(n);
}

/** ≤ 4 chairs, one to a side: top · right · bottom · left (the supplier tile's order in `lib/rooms-seating.ts`). */
function squareGeometry(n: number): TableGeometry {
  const hub = 60;
  const off = hub / 2 + 26;
  const sides: SeatSlot[] = [
    { x: 0, y: -off },
    { x: off, y: 0 },
    { x: 0, y: off },
    { x: -off, y: 0 },
  ];
  const reach = off + CHAIR_PX / 2 + 6;
  return {
    box: { w: reach * 2, h: reach * 2 },
    hub: { w: hub, h: hub, radius: 8, shape: 'rect' },
    seats: sides.slice(0, Math.min(4, n)),
  };
}

/** Long with a chair at each end — the ends are IN the count; the rest split top/bottom like the couple's banquet. */
function longWithEndsGeometry(n: number): TableGeometry {
  const ends = Math.min(2, n);
  const side = n - ends;
  const per = Math.max(1, Math.ceil(side / 2));
  const gap = 40;
  const hubW = per * gap + 16;
  const hubH = 36;
  const offsetY = hubH / 2 + 26;
  const endX = hubW / 2 + 26;
  const seats: SeatSlot[] = [];
  const top = Math.ceil(side / 2);
  for (let i = 0; i < side; i++) {
    const isTop = i < top;
    const idx = isTop ? i : i - top;
    const count = isTop ? top : side - top;
    const usable = hubW - gap;
    const x = count <= 1 ? 0 : -usable / 2 + (usable / (count - 1)) * idx;
    seats.push({ x, y: isTop ? -offsetY : offsetY });
  }
  if (ends >= 1) seats.push({ x: -endX, y: 0 });
  if (ends >= 2) seats.push({ x: endX, y: 0 });
  return {
    box: { w: (endX + CHAIR_PX / 2 + 6) * 2, h: hubH + 2 * (26 + CHAIR_PX) },
    hub: { w: hubW, h: hubH, radius: 12, shape: 'rect' },
    seats,
  };
}

/**
 * Half-moon booth — a curved cushion (the outline) round the back of a round table, open toward the room (+y).
 * Seats sit along the cushion, spread over its half-turn.
 */
function halfMoonGeometry(n: number): TableGeometry {
  const tableR = Math.round(24 + n * 3);
  const benchIn = tableR + 14;
  const benchOut = benchIn + 26;
  const seatR = (benchIn + benchOut) / 2;
  const seats: SeatSlot[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI + ((i + 0.5) / n) * Math.PI; // π → 2π: the top half, left to right
    seats.push({ x: Math.cos(a) * seatR, y: Math.sin(a) * seatR });
  }
  const outline: SeatSlot[] = [];
  const STEPS = 18;
  for (let k = 0; k <= STEPS; k++) {
    const a = Math.PI + (k / STEPS) * Math.PI;
    outline.push({ x: Math.cos(a) * benchOut, y: Math.sin(a) * benchOut });
  }
  for (let k = STEPS; k >= 0; k--) {
    const a = Math.PI + (k / STEPS) * Math.PI;
    outline.push({ x: Math.cos(a) * benchIn, y: Math.sin(a) * benchIn });
  }
  const reach = benchOut + 6;
  return {
    box: { w: reach * 2, h: reach * 2 },
    hub: { w: tableR * 2, h: tableR * 2, radius: tableR, shape: 'round' },
    seats,
    outline,
  };
}

/** Metres per geometry px — the couple's own round-of-10 footprint (`TABLE_FOOTPRINT_M`) over its drawn box. */
export const PLAN_M_PER_PX = TABLE_FOOTPRINT_M.round_10 / tableGeometry('round', 10).box.w;

/** How wide the table really is, chairs included, in metres. Couple types read the couple's own table. */
export function planFootprintM(t: PlanTable): number {
  if (isCoupleTableType(t.kind)) return TABLE_FOOTPRINT_M[t.kind];
  return planTableGeometry(t).box.w * PLAN_M_PER_PX;
}

// ── The room ────────────────────────────────────────────────────────────────

export function planRoomSized(room: PlanRoom): boolean {
  return Boolean(room.widthM && room.depthM && room.widthM > 0 && room.depthM > 0);
}
/** The room in metres — its own size, or the default shape when it has none. */
export function planRoomM(room: PlanRoom): { widthM: number; depthM: number } {
  return planRoomSized(room) ? { widthM: room.widthM!, depthM: room.depthM! } : { ...DEFAULT_ROOM };
}
/** Wide ÷ Deep — the plan's drawn shape. */
export function planAspect(room: PlanRoom): number {
  const r = planRoomM(room);
  return r.widthM / r.depthM;
}

/** A typed side: blank → null; a number above 0 and up to 500 m, one decimal; anything else → 'bad'. */
export function parsePlanSide(raw: unknown): number | null | 'bad' {
  const s = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > PLAN_MAX_SIDE_M) return 'bad';
  return Math.round(n * 10) / 10;
}

// ── Doors ───────────────────────────────────────────────────────────────────

/**
 * The wall nearest a point (percent). ⚖ Ties go top · bottom · left · right — the order the couple editor's
 * walk-through entrance has always tested them in, so moving its inline copy here changed nothing it draws.
 */
export function nearestWall(x: number, y: number): PlanWall {
  const dTop = y;
  const dBottom = 100 - y;
  const dLeft = x;
  const dRight = 100 - x;
  const min = Math.min(dTop, dBottom, dLeft, dRight);
  if (min === dTop) return 'top';
  if (min === dBottom) return 'bottom';
  if (min === dLeft) return 'left';
  return 'right';
}

/** A door is never closer to a corner than this (percent of the wall). */
export const DOOR_CORNER_CLEAR = 6;

/** Drop a door anywhere → it lands on the nearest wall, at the point along it. */
export function snapDoor(x: number, y: number): { wall: PlanWall; at: number } {
  const wall = nearestWall(x, y);
  const raw = wall === 'top' || wall === 'bottom' ? x : y;
  return { wall, at: Math.max(DOOR_CORNER_CLEAR, Math.min(100 - DOOR_CORNER_CLEAR, Math.round(raw * 10) / 10)) };
}

/** Where a door is drawn, percent. */
export function doorPoint(d: Pick<PlanDoor, 'wall' | 'at'>): { x: number; y: number } {
  if (d.wall === 'top') return { x: d.at, y: 0 };
  if (d.wall === 'bottom') return { x: d.at, y: 100 };
  if (d.wall === 'left') return { x: 0, y: d.at };
  return { x: 100, y: d.at };
}

/** The supplier storage's words (`lib/rooms-seating.ts`): front = the wall you walk in by (bottom), back = top. */
export const SHOP_WALL_TO_PLAN: Record<'front' | 'back' | 'left' | 'right', PlanWall> = {
  front: 'bottom',
  back: 'top',
  left: 'left',
  right: 'right',
};
export const PLAN_WALL_TO_SHOP: Record<PlanWall, 'front' | 'back' | 'left' | 'right'> = {
  bottom: 'front',
  top: 'back',
  left: 'left',
  right: 'right',
};
/** The storage's three spots along a wall ↔ a point along it. */
export function alongToAt(a: 'left' | 'middle' | 'right'): number {
  return a === 'left' ? 20 : a === 'right' ? 80 : 50;
}
export function atToAlong(at: number): 'left' | 'middle' | 'right' {
  return at < 100 / 3 ? 'left' : at > 200 / 3 ? 'right' : 'middle';
}

/** "＋ Door": the first wall with no door yet (main door's wall last), at its middle. A plan with none gets a main door. */
export function addDoor(plan: Plan, id: string): Plan {
  const hasMain = plan.doors.some((d) => d.kind === 'main');
  const used = new Set(plan.doors.map((d) => d.wall));
  const order: PlanWall[] = ['bottom', 'right', 'left', 'top'];
  const wall = order.find((w) => !used.has(w)) ?? 'bottom';
  const door: PlanDoor = { id, kind: hasMain ? 'service' : 'main', wall, at: 50 };
  return { ...plan, doors: [...plan.doors, door] };
}

export function doorWords(d: Pick<PlanDoor, 'kind' | 'wall'>): string {
  const wall = { top: 'back', bottom: 'front', left: 'left', right: 'right' }[d.wall];
  return `${d.kind === 'main' ? 'Main door' : 'Door'} · ${wall} wall`;
}

// ── Tables: placing, ordering, lining up ─────────────────────────────────────

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Name order a person expects ("Table 2" before "Table 10") — the Grid view's order. */
export function planTablesInOrder(tables: readonly PlanTable[]): PlanTable[] {
  return [...tables].sort((a, b) => collator.compare(a.label.trim(), b.label.trim()) || a.id.localeCompare(b.id));
}

/** Where each table is drawn: its own spot, or the couple's default spot inside the walls for one never placed. */
export function planTablePositions(tables: readonly PlanTable[]): Array<{ x: number; y: number }> {
  return tables.map((t, i) =>
    t.x !== null && t.y !== null && Number.isFinite(t.x) && Number.isFinite(t.y)
      ? { x: t.x, y: t.y }
      : defaultTablePosition(i, tables.length, false),
  );
}

/** "T1", "T2", … — the next free number. */
export function nextPlanTableLabel(tables: readonly PlanTable[]): string {
  const used = new Set(tables.map((t) => t.label.trim().toLowerCase()));
  for (let k = tables.length + 1; ; k++) if (!used.has(`t${k}`)) return `T${k}`;
}

/**
 * LINE UP — every table back in rows. This IS the couple editor's Auto-arrange (`computeAutoLayout`): rows step away
 * from the FRONT of the room, which for a supplier is the wall opposite the main door (no main door → rows start at
 * the back wall). Tables keep their kind and chairs; only x/y move, and rotation goes back to 0. Each row then reads
 * left to right in name order.
 */
export function lineUpPlan(plan: Plan): Plan {
  if (plan.tables.length === 0) return plan;
  const { widthM, depthM } = planRoomM(plan.room);
  const main = plan.doors.find((d) => d.kind === 'main');
  const front: PlanWall = main ? ({ top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const)[main.wall] : 'top';
  const stage = { top: { x: 50, y: 0 }, bottom: { x: 50, y: 100 }, left: { x: 0, y: 50 }, right: { x: 100, y: 50 } }[front];
  const ordered = planTablesInOrder(plan.tables);
  const rank = new Map(ordered.map((t, i) => [t.id, i]));
  const byId = new Map(plan.tables.map((t) => [t.id, t]));
  // The couple's row type, carrying only what the layout reads. Every supplier table rides as one row "kind" so the
  // order is the name order alone (the couple's type ranks — sweetheart first — mean nothing to a restaurant).
  const rows = plan.tables.map(
    (t) =>
      ({
        table_id: t.id,
        public_id: t.id,
        event_id: '',
        table_label: t.label,
        table_type: isCoupleTableType(t.kind) ? t.kind : 'round_10',
        capacity: planSeatCount(t),
        sort_order: rank.get(t.id) ?? 0,
        x_pos: null,
        y_pos: null,
      }) satisfies EventTableRow,
  );
  const CM = 100; // the layout works in px; a centimetre each keeps metres exact
  const fp: Pick<
    FloorPlanRow,
    | 'stage_x' | 'stage_y' | 'stage_w' | 'stage_h'
    | 'entrance_enabled' | 'entrance_x' | 'entrance_y'
    | 'service_entrance_enabled' | 'service_entrance_x' | 'service_entrance_y'
    | 'dance_enabled' | 'dance_x' | 'dance_y' | 'dance_w' | 'dance_h'
    | 'cocktail_enabled' | 'cocktail_x' | 'cocktail_y' | 'cocktail_w' | 'cocktail_h'
  > = {
    stage_x: stage.x,
    stage_y: stage.y,
    stage_w: 0,
    stage_h: 0,
    entrance_enabled: false,
    entrance_x: 50,
    entrance_y: 100,
    service_entrance_enabled: false,
    service_entrance_x: 100,
    service_entrance_y: 50,
    dance_enabled: false,
    dance_x: 0,
    dance_y: 0,
    dance_w: 0,
    dance_h: 0,
    cocktail_enabled: false,
    cocktail_x: 0,
    cocktail_y: 0,
    cocktail_w: 0,
    cocktail_h: 0,
  };
  const at = computeAutoLayout({
    tables: rows,
    floorPlan: fp,
    rect: { width: widthM * CM, height: depthM * CM },
    footprintOf: (r) => {
      const t = byId.get(r.table_id)!;
      const g = planTableGeometry(t);
      const w = planFootprintM(t) * CM;
      return { w, h: (g.box.h / g.box.w) * w };
    },
  });
  // The couple's rows fill centre-out (the stage's middle seat first). A supplier reads a row like a page, so each
  // row keeps the couple's line and its tables, and is re-set LEFT TO RIGHT in name order, centred, same gap.
  // (Rows are the same line along the front wall's axis: y for a top/bottom front, x for a side one.)
  const across = front === 'top' || front === 'bottom';
  const rowsByLine = new Map<number, string[]>();
  for (const t of ordered) {
    const p = at[t.id];
    if (!p) continue;
    const line = Math.round((across ? p.y : p.x) * 10) / 10;
    rowsByLine.set(line, [...(rowsByLine.get(line) ?? []), t.id]);
  }
  const breadthPct = (t: PlanTable) => {
    const g = planTableGeometry(t);
    const w = planFootprintM(t);
    return across ? (w / widthM) * 100 : (((g.box.h / g.box.w) * w) / depthM) * 100;
  };
  const placed: Record<string, { x: number; y: number }> = {};
  for (const [line, ids] of rowsByLine) {
    // ONE row-centring rule for every plan (`centredRun`) — the couple's floor centres its rows through it too.
    const mids = centredRun(ids.map((id) => breadthPct(byId.get(id)!)), 50, GRID_GAP);
    ids.forEach((id, k) => {
      const mid = Math.max(0, Math.min(100, mids[k]!));
      placed[id] = across ? { x: mid, y: line } : { x: line, y: mid };
    });
  }
  return {
    ...plan,
    tables: plan.tables.map((t) => {
      const p = placed[t.id];
      return p ? { ...t, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, rotationDeg: 0 } : t;
    }),
  };
}

/** Clamp a dragged centre inside the walls (percent). */
export function clampToRoom(x: number, y: number): { x: number; y: number } {
  const c = (v: number) => Math.max(0, Math.min(100, Math.round(v * 10) / 10));
  return { x: c(x), y: c(y) };
}

// ── The couple's plan, read as a Plan ────────────────────────────────────────

/**
 * The couple's event tables + floor plan, as a Plan — so a read-only view of a couple's room is the same drawing a
 * supplier's is. Nothing is lost on the way: kinds stay the couple's own types, deleted chairs ride along, linked
 * serpentines stay linked, and the entrance / service door land on their nearest wall.
 */
export function planFromSeating(
  tables: ReadonlyArray<
    Pick<EventTableRow, 'table_id' | 'table_label' | 'table_type' | 'capacity' | 'x_pos' | 'y_pos'> &
      Partial<Pick<EventTableRow, 'rotation_deg' | 'removed_seats' | 'link_group_id'>>
  >,
  fp: Pick<
    FloorPlanRow,
    | 'venue_width_m' | 'venue_length_m'
    | 'entrance_enabled' | 'entrance_x' | 'entrance_y'
    | 'service_entrance_enabled' | 'service_entrance_x' | 'service_entrance_y'
  >,
): Plan {
  const doors: PlanDoor[] = [];
  if (fp.entrance_enabled) doors.push({ id: 'entrance', kind: 'main', ...snapDoor(fp.entrance_x, fp.entrance_y) });
  if (fp.service_entrance_enabled) {
    doors.push({ id: 'service', kind: 'service', ...snapDoor(fp.service_entrance_x, fp.service_entrance_y) });
  }
  return {
    room: { widthM: fp.venue_width_m, depthM: fp.venue_length_m },
    doors,
    tables: tables.map((t) => ({
      id: t.table_id,
      label: t.table_label,
      kind: t.table_type,
      chairs: t.capacity,
      x: t.x_pos === null ? null : Number(t.x_pos),
      y: t.y_pos === null ? null : Number(t.y_pos),
      rotationDeg: t.rotation_deg ?? 0,
      removedSeats: t.removed_seats ?? [],
      linked: t.link_group_id != null,
    })),
  };
}

// ── The shop's plan (Rooms & seating), read as a Plan ────────────────────────

/**
 * One dining area of a shop (`shopPlanOf` in `lib/rooms-seating.ts`) as a Plan: its tables keep their shape, one chair
 * count, "at the ends" and their saved spot; its doors land on their wall (front = the bottom wall, the storage's
 * left / middle / right → a point along it). No guest is ever on it.
 */
export function planFromShopPlan(p: ShopPlan): Plan {
  return {
    room: { widthM: p.room?.widthM ?? null, depthM: p.room?.lengthM ?? null },
    doors: p.doors.map((d) => ({ id: d.id, kind: d.kind, wall: SHOP_WALL_TO_PLAN[d.wall], at: alongToAt(d.along) })),
    tables: p.tables.map((t) => ({
      id: t.id,
      label: t.label,
      kind: t.shape,
      chairs: t.chairs,
      chairsAtEnds: t.chairsAtEnds,
      x: t.x,
      y: t.y,
      rotationDeg: t.rotationDeg,
    })),
  };
}

/** The tables whose spot or turn changed between two plans — what a move or Line up has to save, and nothing else. */
export function placementsChanged(before: Plan, after: Plan): Array<{ id: string; x: number; y: number; rotationDeg: number }> {
  const was = new Map(before.tables.map((t) => [t.id, t]));
  const out: Array<{ id: string; x: number; y: number; rotationDeg: number }> = [];
  for (const t of after.tables) {
    const b = was.get(t.id);
    if (!b || t.x === null || t.y === null) continue;
    if (b.x !== t.x || b.y !== t.y || (b.rotationDeg ?? 0) !== (t.rotationDeg ?? 0)) {
      out.push({ id: t.id, x: t.x, y: t.y, rotationDeg: t.rotationDeg ?? 0 });
    }
  }
  return out;
}

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
// Everything is percent of the room (0–100 on each axis), the unit both plans store. Pure. 🔒 lib/plan-grid.test.ts

/** The gap between two tables in a row, and between two rows — percent of the room. The couple's Auto-arrange numbers. */
export const GRID_GAP = 3;
export const GRID_ROW_GAP = 4;
/** Tables keep inside this band; the outer ring is the walls' (doors, booths). The couple's Auto-arrange numbers. */
export const GRID_LO = 10;
export const GRID_HI = 90;
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
