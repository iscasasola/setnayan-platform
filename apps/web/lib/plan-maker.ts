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
  const GAP = 3;
  const placed: Record<string, { x: number; y: number }> = {};
  for (const [line, ids] of rowsByLine) {
    const widths = ids.map((id) => breadthPct(byId.get(id)!));
    const total = widths.reduce((s, w) => s + w, 0) + GAP * (ids.length - 1);
    let cursor = 50 - total / 2;
    ids.forEach((id, k) => {
      const mid = Math.max(0, Math.min(100, cursor + widths[k]! / 2));
      placed[id] = across ? { x: mid, y: line } : { x: line, y: mid };
      cursor += widths[k]! + GAP;
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
