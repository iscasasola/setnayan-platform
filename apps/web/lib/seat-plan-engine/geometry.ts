/**
 * lib/seat-plan-engine/geometry.ts — 🪑 TABLES AND SEATS, AND THE ROOM THEY STAND IN.
 *
 * MOVED here, byte for byte, from `lib/seating.ts` (2026-11-20) so the couple's Seat plan and a supplier's Spaces
 * floor plan draw from ONE file (DECISION_LOG 2026-11-20, "ONE SEAT-PLAN ENGINE FOR THE COUPLE AND THE SUPPLIER.
 * ONLY WHO FILLS A SEAT DIFFERS" · owner: "the need to run the same logic and code"). `lib/seating.ts` re-exports
 * every name below, so its ~60 importers did not change.
 *
 * The coordinate contract this obeys is written at the top of `lib/seating.ts` (Seat-plan coordinate contract v2):
 * percent of the room box, top-left origin, rotation clockwise in the y-down plan.
 *
 * Pure: no React, no Supabase, no import at all. 🔒 lib/seat-plan-engine/engine.test.ts
 */

// Catalog locked 2026-05-09 (CLAUDE.md decision log § "0008 Seating Chart
// table catalog locked at 13 entries" + same-day "0008 serpentine geometry
// locked" refinement). Realigned 2026-05-22 from the 2026-05-13 drift —
// see migration 20260603200000_iteration_0008_seating_catalog_realignment.sql.
export type TableType =
  | 'round_8'
  | 'round_10'
  | 'round_12'
  | 'long_banquet_6'
  | 'long_banquet_8'
  | 'long_banquet_10'
  | 'family_head_12'
  | 'family_head_14'
  | 'family_head_16'
  | 'sweetheart_2'
  | 'serpentine';

export type TableShapeHint =
  | 'round'
  | 'long_banquet'
  | 'family_head'
  | 'sweetheart'
  | 'serpentine';

export const TABLE_TYPE_CATALOG: ReadonlyArray<{
  type: TableType;
  label: string;
  defaultCapacity: number;
  shapeHint: TableShapeHint;
}> = [
  { type: 'round_8', label: 'Round (8 seats)', defaultCapacity: 8, shapeHint: 'round' },
  { type: 'round_10', label: 'Round (10 seats)', defaultCapacity: 10, shapeHint: 'round' },
  { type: 'round_12', label: 'Round (12 seats)', defaultCapacity: 12, shapeHint: 'round' },
  { type: 'long_banquet_6', label: 'Long banquet (6 seats)', defaultCapacity: 6, shapeHint: 'long_banquet' },
  { type: 'long_banquet_8', label: 'Long banquet (8 seats)', defaultCapacity: 8, shapeHint: 'long_banquet' },
  { type: 'long_banquet_10', label: 'Long banquet (10 seats)', defaultCapacity: 10, shapeHint: 'long_banquet' },
  { type: 'family_head_12', label: 'Family head (12 seats)', defaultCapacity: 12, shapeHint: 'family_head' },
  { type: 'family_head_14', label: 'Family head (14 seats)', defaultCapacity: 14, shapeHint: 'family_head' },
  { type: 'family_head_16', label: 'Family head (16 seats)', defaultCapacity: 16, shapeHint: 'family_head' },
  { type: 'sweetheart_2', label: 'Sweetheart (2 seats)', defaultCapacity: 2, shapeHint: 'sweetheart' },
  // One quarter-donut wedge, up to 5 seats (≤3 outer · ≤2 inner). Chain + rotate
  // several to build an S / circle / oval (2026-05-09 lock, single-wedge model).
  { type: 'serpentine', label: 'Serpentine (up to 5 · curved)', defaultCapacity: 5, shapeHint: 'serpentine' },
];

export const TABLE_TYPE_LABEL: Record<TableType, string> = Object.fromEntries(
  TABLE_TYPE_CATALOG.map((t) => [t.type, t.label]),
) as Record<TableType, string>;

// Real-world footprint WIDTH (metres) of each table type including its ring of
// chairs — maps onto tableGeometry().box.w so the editor can scale a table to
// true size relative to the venue. Standard event-industry dimensions: round
// tables by diameter + ~0.5 m chair depth each side; banquet/head tables by
// length; sweetheart compact; serpentine ~ by capacity.
export const TABLE_FOOTPRINT_M: Record<TableType, number> = {
  round_8: 2.5,
  round_10: 2.8,
  round_12: 3.1,
  long_banquet_6: 2.0,
  long_banquet_8: 2.6,
  long_banquet_10: 3.2,
  family_head_12: 4.4,
  family_head_14: 5.1,
  family_head_16: 5.8,
  sweetheart_2: 1.6,
  serpentine: 2.4,
};

// Default placement for a table that hasn't been positioned yet — shared by
// the editor, the PDF export and the day-of map so an un-arranged layout looks
// the same everywhere.
//   spread=true  (free / no room size): FIXED comfortable spacing, so adding
//     more grows the board outward (positions can exceed 100%); the editor
//     auto-fits and the fixed-frame renderers fit via fitFloorTransform.
//   spread=false (inside a defined room): pack within the walls (0–100%).
export const FREE_GRID_SPACING = 48;
export function defaultTablePosition(
  index: number,
  total: number,
  spread: boolean,
): { x: number; y: number } {
  if (spread) {
    const cols = Math.max(3, Math.ceil(Math.sqrt(total * 1.4)));
    return {
      x: 16 + (index % cols) * FREE_GRID_SPACING,
      y: 20 + Math.floor(index / cols) * FREE_GRID_SPACING,
    };
  }
  const cols = Math.max(2, Math.ceil(Math.sqrt(total)));
  const rows = Math.max(1, Math.ceil(total / cols));
  return {
    x: ((index % cols) + 0.5) / cols * 100,
    y: 22 + (Math.floor(index / cols) + 0.5) / rows * 70,
  };
}

// Fixed-frame renderers (PDF export, day-of "find my table" map) draw table
// positions as 0–100% of their box. The free auto-grow board in the editor can
// place tables BEYOND 0–100 (it grows as tables are added and uses zoom/pan).
// This returns a transform that fits such a spread layout back into the 0–100
// box (uniform scale, centred) so those renderers show it correctly — and is a
// NO-OP when everything is already within bounds, so existing layouts are
// unchanged.
export function fitFloorTransform(
  points: ReadonlyArray<{ x: number; y: number }>,
  pad = 6,
): (x: number, y: number) => { x: number; y: number } {
  const identity = (x: number, y: number) => ({ x, y });
  if (points.length === 0) return identity;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  // Already comfortably inside the box → leave it exactly as-is.
  if (minX >= -2 && minY >= -2 && maxX <= 102 && maxY <= 102) return identity;
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const avail = 100 - 2 * pad;
  const scale = avail / Math.max(w, h); // uniform → preserve the layout's aspect
  const offX = pad + (avail - w * scale) / 2 - minX * scale;
  const offY = pad + (avail - h * scale) / 2 - minY * scale;
  return (x: number, y: number) => ({ x: x * scale + offX, y: y * scale + offY });
}

export function shapeHintFor(type: TableType): TableShapeHint {
  return TABLE_TYPE_CATALOG.find((t) => t.type === type)?.shapeHint ?? 'round';
}

// ---------------------------------------------------------------------------
// Chair-level geometry (iteration 0008 "Chair-level interaction" — the
// per-seat circles around each table that were deferred in the 2026-05-13
// MVP). Returns center-origin pixel offsets so the editor can absolutely
// position each chair around the table hub. Pure + deterministic so the
// canvas and the print-pack renderer share one source of truth.
//
// Shapes: round (chair ring) · sweetheart (couple side-by-side on one edge) ·
// long_banquet / family_head (chairs along both long edges) · serpentine (the
// 2026-05-09 quarter-donut-wedge S-curve — a wavy `outline` ribbon with chairs
// on its concave inner + convex outer edges, ~2 inner : 4 outer per segment).
// ---------------------------------------------------------------------------

export const CHAIR_PX = 40;

export type SeatSlot = { x: number; y: number };

export type TableGeometry = {
  box: { w: number; h: number };
  hub: { w: number; h: number; radius: number; shape: 'round' | 'rect' | 'pill' | 'ribbon' };
  seats: SeatSlot[];
  // Closed polygon (center-origin px) for a shape a circle/rectangle can't
  // express — the serpentine ribbon. Renderers fill + stroke this instead of the
  // hub box when present. Omitted for the simple shapes.
  outline?: SeatSlot[];
};

// Rotate a center-origin point by `deg` (seat-space is y-down, so +deg reads as
// clockwise on screen). Used by the editor + PDF to orient a table — the key to
// connecting wedges/banquets edge-to-edge into custom patterns.
export function rotatePoint(p: SeatSlot, deg: number): SeatSlot {
  if (!deg) return p;
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

// Seats the couple deleted (e.g. to clear a connection edge). Returns the valid
// subset as a Set for O(1) skip checks; ignores out-of-range indices.
export function removedSeatSet(removedSeats: number[] | null | undefined, capacity: number): Set<number> {
  const out = new Set<number>();
  for (const i of removedSeats ?? []) if (Number.isInteger(i) && i >= 0 && i < capacity) out.add(i);
  return out;
}

// Occupiable seats = capacity minus deleted chairs.
export function effectiveCapacity(capacity: number, removedSeats: number[] | null | undefined): number {
  return capacity - removedSeatSet(removedSeats, capacity).size;
}


export function tableGeometry(
  shape: TableShapeHint,
  capacity: number,
  // `even` = this table is part of a LINKED serpentine chain → space its chairs
  // at uniform density across the sweep so they flow continuously across a
  // junction (mirrors the 3D lab's serpentineChairs even mode). Standalone
  // tables keep the endpoint+inset spread. No effect on non-serpentine shapes.
  even = false,
): TableGeometry {
  const n = Math.max(1, capacity);

  // Round → chairs evenly around a circle.
  if (shape === 'round') {
    const hubR = Math.round(28 + n * 2.3);
    const seatR = hubR + 32;
    const seats: SeatSlot[] = [];
    for (let i = 0; i < n; i++) {
      const theta = (-90 + (360 / n) * i) * (Math.PI / 180);
      seats.push({ x: Math.cos(theta) * seatR, y: Math.sin(theta) * seatR });
    }
    const reach = seatR + CHAIR_PX / 2 + 8;
    return {
      box: { w: reach * 2, h: reach * 2 },
      hub: { w: hubR * 2, h: hubR * 2, radius: hubR, shape: 'round' },
      seats,
    };
  }

  // Sweetheart → the couple sit SIDE BY SIDE on one side of a small table
  // (facing the room), not opposite each other. Up to 2 chairs on the top edge.
  if (shape === 'sweetheart') {
    const seatGap = 46;
    const hubW = seatGap + 30;
    const hubH = 30;
    const seatY = -(hubH / 2 + 26); // both chairs above the table body
    const all: SeatSlot[] = [
      { x: -seatGap / 2, y: seatY },
      { x: seatGap / 2, y: seatY },
    ];
    const seats = all.slice(0, Math.min(n, 2));
    const halfW = Math.max(hubW / 2, seatGap / 2 + CHAIR_PX / 2) + 6;
    const halfH = Math.max(hubH / 2, Math.abs(seatY) + CHAIR_PX / 2 + 6);
    return {
      box: { w: halfW * 2, h: halfH * 2 },
      hub: { w: hubW, h: hubH, radius: hubH / 2, shape: 'pill' },
      seats,
    };
  }

  // Serpentine → ONE quarter-donut wedge (2026-05-09 lock). A curved band with
  // up to 3 chairs on the convex OUTER arc + up to 2 on the concave INNER arc.
  // Couples chain + rotate several wedges to build an S / circle / oval. Default
  // fill is outer-first: 1→1+0 · 2→2+0 · 3→2+1 · 4→3+1 · 5→3+2.
  if (shape === 'serpentine') {
    const cap = Math.max(1, Math.min(5, n));
    const FILL: Record<number, [number, number]> = {
      1: [1, 0],
      2: [2, 0],
      3: [2, 1],
      4: [3, 1],
      5: [3, 2],
    };
    const [outerN, innerN] = FILL[cap]!;

    const Ri = 80; // inner (concave) radius
    const Ro = 120; // outer (convex) radius
    const sweep = (104 * Math.PI) / 180; // total angular span of the wedge
    const chairGap = CHAIR_PX / 2 + 4;
    const Rco = Ro + chairGap; // outer chairs sit just beyond the convex edge
    const Rci = Ri - chairGap; // inner chairs sit just inside the concave edge

    // φ = 0 points straight up (−y); +φ sweeps to the right. Center of curvature
    // is below the wedge so it bulges upward (convex on top).
    const at = (r: number, phi: number): SeatSlot => ({ x: r * Math.sin(phi), y: -r * Math.cos(phi) });
    const along = (count: number, r: number, inset: number, evenFlag: boolean): SeatSlot[] => {
      const half = sweep / 2 - inset;
      const out: SeatSlot[] = [];
      for (let i = 0; i < count; i++) {
        // `even` (LINKED chain): slot-centre → uniform density across the sweep
        // so chairs flow one-spacing across a junction (no seam pile-up) and the
        // whole chain reads as one evenly-spaced banquet. Standalone: endpoint+
        // inset spread (end chairs hug the tips, seam stays chair-free).
        const phi = evenFlag
          ? -sweep / 2 + (sweep / count) * (i + 0.5)
          : count === 1
            ? 0
            : -half + (2 * half * i) / (count - 1);
        out.push(at(r, phi));
      }
      return out;
    };

    // Seat order: outer left→right, then inner left→right (stable seat_number map).
    // End insets keep the seam chair-free when wedges chain tip-to-tip: at a
    // joint the neighbouring wedges' chairs must clear each other (inner radius
    // is tight — 0.36 rad ≈ a chair-width gap across the seam; 0.32 crowded).
    const seats: SeatSlot[] = [
      ...along(outerN, Rco, 0.18, even),
      ...along(innerN, Rci, 0.36, even),
    ];
    // The footprint (box) is computed from the STANDALONE (widest) chair spread
    // so it stays even-invariant — the even chairs sit inside it. Keeps
    // footprintPx / snap tolerances / overlap checks consistent with the render,
    // regardless of link state.
    const boxSeats: SeatSlot[] = even
      ? [...along(outerN, Rco, 0.18, false), ...along(innerN, Rci, 0.36, false)]
      : seats;

    // Ribbon body: outer arc left→right, then inner arc right→left, closed.
    const STEP = sweep / 16;
    const outline: SeatSlot[] = [];
    for (let phi = -sweep / 2; phi <= sweep / 2 + 1e-9; phi += STEP) outline.push(at(Ro, phi));
    for (let phi = sweep / 2; phi >= -sweep / 2 - 1e-9; phi -= STEP) outline.push(at(Ri, phi));

    // Recenter on the band's bounding box so rotation pivots on the visual centre.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of outline) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const ox = (minX + maxX) / 2;
    const oy = (minY + maxY) / 2;
    const shift = (p: SeatSlot): SeatSlot => ({ x: p.x - ox, y: p.y - oy });
    const seatsC = seats.map(shift);
    const outlineC = outline.map(shift);

    const pad = CHAIR_PX / 2 + 6;
    let halfW = 0, halfH = 0;
    for (const p of [...boxSeats.map(shift), ...outlineC]) {
      halfW = Math.max(halfW, Math.abs(p.x));
      halfH = Math.max(halfH, Math.abs(p.y));
    }
    return {
      box: { w: (halfW + pad) * 2, h: (halfH + pad) * 2 },
      hub: { w: Ro - Ri + 18, h: maxY - minY, radius: 16, shape: 'ribbon' },
      seats: seatsC,
      outline: outlineC,
    };
  }

  // long_banquet / family_head → chairs along the two long (top + bottom) edges.
  const wide = shape === 'family_head';
  const per = Math.ceil(n / 2);
  const gap = wide ? 44 : 40;
  const hubW = per * gap + 16;
  const hubH = wide ? 46 : 36;
  const offsetY = hubH / 2 + 26;
  const seats: SeatSlot[] = [];
  for (let i = 0; i < n; i++) {
    const top = i < per;
    const idxInRow = top ? i : i - per;
    const countInRow = top ? per : n - per;
    const usableW = hubW - gap;
    const x = countInRow <= 1 ? 0 : -usableW / 2 + (usableW / (countInRow - 1)) * idxInRow;
    seats.push({ x, y: top ? -offsetY : offsetY });
  }
  return {
    box: { w: hubW + CHAIR_PX + 12, h: hubH + 2 * (26 + CHAIR_PX) },
    hub: { w: hubW, h: hubH, radius: 12, shape: 'rect' },
    seats,
  };
}

/** The free-board default room, in metres (MOVED here from seating-3d.ts). */
export const DEFAULT_ROOM_M = { w: 20, d: 30 } as const;

/** The room box (metres) — the coordinate DENOMINATOR (contract § 2). Venue dims
 *  when both set and > 0, else the default board. `isDefault` = the free board. */
export function roomBoxM(floor: {
  venue_width_m?: number | null;
  venue_length_m?: number | null;
}): { w: number; d: number; isDefault: boolean } {
  const w = floor.venue_width_m;
  const d = floor.venue_length_m;
  if (w != null && d != null && w > 0 && d > 0) return { w, d, isDefault: false };
  return { w: DEFAULT_ROOM_M.w, d: DEFAULT_ROOM_M.d, isDefault: true };
}

/** percent (0–100, top-left origin) → centred world metres (origin room centre).
 *  THE linear map (contract § 6). Returns {x, z} to match the 3D convention. */
export function pctToWorldM(
  xPct: number,
  yPct: number,
  room: { w: number; d: number },
): { x: number; z: number } {
  return { x: (xPct / 100 - 0.5) * room.w, z: (yPct / 100 - 0.5) * room.d };
}

/** The EXACT inverse of `pctToWorldM` (world metres → percent). */
export function worldToPctM(
  x: number,
  z: number,
  room: { w: number; d: number },
): { xPct: number; yPct: number } {
  return { xPct: (x / room.w + 0.5) * 100, yPct: (z / room.d + 0.5) * 100 };
}

/** The single rotation-conversion site (contract § 3): plan-view degrees
 *  (clockwise, y-down) → the 3D group's `rotation.y` (radians). */
export function rotationWorldY(deg: number): number {
  return (-deg * Math.PI) / 180;
}

/** Metres-per-local-geometry-unit for a table type — the uniform shrink that
 *  maps `tableGeometry(...).box.w` onto its real chair-inclusive footprint. */
export function metricScale(type: TableType, capacity: number): number {
  const geo = tableGeometry(shapeHintFor(type), Math.max(1, capacity));
  return TABLE_FOOTPRINT_M[type] / geo.box.w;
}

// ── Rows (the Auto-arrange grid) ─────────────────────────────────────────────
// The spacing `computeAutoLayout` (lib/seating.ts) has always used, lifted here so every row on either side — the
// couple's Auto-arrange, the supplier's Line up, and round two's grid when it lands (PR #8057) — spaces tables with
// the very same numbers. All percent of the room box.
/** Between two rows, front to back. */
export const ROW_GAP_PCT = 4;
/** Between two tables in one row. */
export const SLOT_GAP_PCT = 3;
/** Tables keep inside this band; the outer ring belongs to the booths. */
export const TABLE_BAND_PCT = { lo: 10, hi: 90 } as const;
