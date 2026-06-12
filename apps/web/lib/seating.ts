import type { SupabaseClient } from '@supabase/supabase-js';

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

export type EventTableRow = {
  table_id: string;
  public_id: string;
  event_id: string;
  table_label: string;
  table_type: TableType;
  capacity: number;
  sort_order: number;
  x_pos: number | null;
  y_pos: number | null;
  // Optional on the type so render-only literals (e.g. the indoor-blueprint
  // sample tables) need not set them; fetchTables always returns concrete
  // values, and every reader coalesces (`?? 0` / removedSeatSet / effectiveCapacity).
  rotation_deg?: number;
  removed_seats?: number[];
  // Per-table QR (32-hex). Exists from creation; printed on the table sign
  // sheet + resolved by future Papic fan-out / day-of find-my-seat. Optional on
  // the type so render-only literals need not set it; fetchTables always returns it.
  qr_token?: string;
  qr_published_at?: string | null;
  // Linked unit (identity + QR only): tables sharing link_group_id render and
  // print as ONE named table under link_group_label. Seating math stays per-table.
  link_group_id?: string | null;
  link_group_label?: string | null;
};

export type SeatAssignmentRow = {
  assignment_id: string;
  table_id: string;
  guest_id: string;
  seat_number: number | null;
};

export async function fetchTables(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventTableRow[]> {
  const { data, error } = await supabase
    .from('event_tables')
    .select(
      'table_id,public_id,event_id,table_label,table_type,capacity,sort_order,x_pos,y_pos,rotation_deg,removed_seats,qr_token,qr_published_at,link_group_id,link_group_label',
    )
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`fetchTables failed: ${error.message}`);
  // Defensive defaults so the editor + PDF work even before the rotation/
  // removed-seats migration is applied (the columns just read as 0 / []).
  return (data ?? []).map((t) => ({
    ...(t as EventTableRow),
    rotation_deg: (t as EventTableRow).rotation_deg ?? 0,
    removed_seats: (t as EventTableRow).removed_seats ?? [],
    qr_token: (t as EventTableRow).qr_token ?? '',
    qr_published_at: (t as EventTableRow).qr_published_at ?? null,
    link_group_id: (t as EventTableRow).link_group_id ?? null,
    link_group_label: (t as EventTableRow).link_group_label ?? null,
  }));
}

export async function fetchAssignments(
  supabase: SupabaseClient,
  eventId: string,
): Promise<SeatAssignmentRow[]> {
  const { data, error } = await supabase
    .from('event_seat_assignments')
    .select('assignment_id,table_id,guest_id,seat_number')
    .eq('event_id', eventId);
  if (error) throw new Error(`fetchAssignments failed: ${error.message}`);
  return (data ?? []) as SeatAssignmentRow[];
}

// Per-event floor-plan markers (stage + single entrance door). All coords are
// percent (0–100) of the editor canvas. Defaults match the DB defaults so the
// editor renders sensibly before the row exists.
export type FloorPlanRow = {
  stage_x: number;
  stage_y: number;
  // Stage SIZE (percent of the canvas; x/y = centre) — drag-resizable.
  stage_w: number;
  stage_h: number;
  entrance_enabled: boolean;
  entrance_x: number;
  entrance_y: number;
  // Dance-floor zone (no-table area; the editor blocks drops inside it).
  dance_enabled: boolean;
  dance_x: number;
  dance_y: number;
  dance_w: number;
  dance_h: number;
  // Optional second door — load-in / caterer access.
  service_entrance_enabled: boolean;
  service_entrance_x: number;
  service_entrance_y: number;
  venue_width_m: number | null;
  venue_length_m: number | null;
  // When the couple last published the seating pack (stamped table QR sheets).
  published_at: string | null;
};

export const DEFAULT_FLOOR_PLAN: FloorPlanRow = {
  stage_x: 50,
  stage_y: 6,
  stage_w: 24,
  stage_h: 7,
  entrance_enabled: false,
  entrance_x: 50,
  entrance_y: 94,
  dance_enabled: false,
  dance_x: 50,
  dance_y: 55,
  dance_w: 22,
  dance_h: 18,
  service_entrance_enabled: false,
  service_entrance_x: 97,
  service_entrance_y: 50,
  venue_width_m: null,
  venue_length_m: null,
  published_at: null,
};

export async function fetchFloorPlan(
  supabase: SupabaseClient,
  eventId: string,
): Promise<FloorPlanRow> {
  const { data, error } = await supabase
    .from('event_floor_plan')
    .select(
      'stage_x,stage_y,stage_w,stage_h,entrance_enabled,entrance_x,entrance_y,dance_enabled,dance_x,dance_y,dance_w,dance_h,service_entrance_enabled,service_entrance_x,service_entrance_y,venue_width_m,venue_length_m,published_at',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  // Graceful-degrade: a missing row (or a not-yet-migrated table) just yields
  // the defaults so the seating page never crashes on the floor-plan read.
  if (error || !data) return { ...DEFAULT_FLOOR_PLAN };
  const D = DEFAULT_FLOOR_PLAN;
  const num = (v: unknown, fb: number) => (v === null || v === undefined ? fb : Number(v));
  return {
    stage_x: num(data.stage_x, D.stage_x),
    stage_y: num(data.stage_y, D.stage_y),
    stage_w: num(data.stage_w, D.stage_w),
    stage_h: num(data.stage_h, D.stage_h),
    entrance_enabled: Boolean(data.entrance_enabled),
    entrance_x: num(data.entrance_x, D.entrance_x),
    entrance_y: num(data.entrance_y, D.entrance_y),
    dance_enabled: Boolean(data.dance_enabled),
    dance_x: num(data.dance_x, D.dance_x),
    dance_y: num(data.dance_y, D.dance_y),
    dance_w: num(data.dance_w, D.dance_w),
    dance_h: num(data.dance_h, D.dance_h),
    service_entrance_enabled: Boolean(data.service_entrance_enabled),
    service_entrance_x: num(data.service_entrance_x, D.service_entrance_x),
    service_entrance_y: num(data.service_entrance_y, D.service_entrance_y),
    venue_width_m: data.venue_width_m === null ? null : Number(data.venue_width_m),
    venue_length_m: data.venue_length_m === null ? null : Number(data.venue_length_m),
    published_at: (data as { published_at?: string | null }).published_at ?? null,
  };
}

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

export type SeatingStats = {
  tableCount: number;
  totalCapacity: number;
  assignedCount: number;
  unassignedCount: number;
};

export function computeSeatingStats(
  tables: EventTableRow[],
  assignments: SeatAssignmentRow[],
  totalGuests: number,
): SeatingStats {
  const totalCapacity = tables.reduce((acc, t) => acc + t.capacity, 0);
  return {
    tableCount: tables.length,
    totalCapacity,
    assignedCount: assignments.length,
    unassignedCount: Math.max(0, totalGuests - assignments.length),
  };
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

export function tableGeometry(shape: TableShapeHint, capacity: number): TableGeometry {
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
    const along = (count: number, r: number, inset: number): SeatSlot[] => {
      const half = sweep / 2 - inset;
      const out: SeatSlot[] = [];
      for (let i = 0; i < count; i++) {
        const phi = count === 1 ? 0 : -half + (2 * half * i) / (count - 1);
        out.push(at(r, phi));
      }
      return out;
    };

    // Seat order: outer left→right, then inner left→right (stable seat_number map).
    const seats: SeatSlot[] = [
      ...along(outerN, Rco, 0.18),
      ...along(innerN, Rci, 0.32),
    ];

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
    for (const p of [...seatsC, ...outlineC]) {
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

// Distinct accent colors for custom guest groups — earthy + editorial so they
// read on the alabaster canvas without the template's neon. Indexed by the
// group's position in the event's group list (deterministic, no schema column).
export const GROUP_COLORS = [
  '#C97B4B', // terracotta
  '#5B8FA0', // teal-slate
  '#7BA05B', // sage
  '#A05B8F', // mulberry-rose
  '#C2913B', // ochre
  '#6B7FB0', // dusty blue
  '#B0655B', // clay
  '#4FA08C', // jade
];

export function groupColorFor(index: number): string {
  return GROUP_COLORS[((index % GROUP_COLORS.length) + GROUP_COLORS.length) % GROUP_COLORS.length]!;
}

// Side-of-wedding fallback color for a guest who belongs to no custom group —
// mirrors the rose / sky / amethyst chip language used across the guest list.
export const SIDE_COLORS: Record<'bride' | 'groom' | 'both', string> = {
  bride: '#D17A8A',
  groom: '#5B92A6',
  both: '#9B6FA0',
};

// ---------------------------------------------------------------------------
// Role-tier auto-seat (iteration 0008 "Auto-fill — role-tier rings"). Maps the
// 0001 role taxonomy onto four concentric tiers and fills the nearest tables to
// the stage outward. Pure: takes the current tables/guests/assignments and
// returns ONLY the new (guest → table → seat) rows to insert. Idempotent —
// already-seated guests are never moved; the couple can re-run after edits.
// ---------------------------------------------------------------------------

const TIER1_ROLES = new Set<GuestRoleLike>([
  'principal_sponsor',
  'officiant',
  'reader_lector',
  'soloist_musician',
  'bride_parents',
  'groom_parents',
  'bride_immediate_family',
  'groom_immediate_family',
]);

const TIER2_ROLES = new Set<GuestRoleLike>([
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'bridesmaid',
  'groomsman',
  'candle_sponsor',
  'veil_sponsor',
  'cord_sponsor',
  'coin_sponsor',
  'ring_bearer',
  'bible_bearer',
  'coin_bearer',
  'flower_girl',
]);

type GuestRoleLike = string;

export type AutoSeatGuest = {
  guest_id: string;
  role: GuestRoleLike;
  group_category: string;
  rsvp_status: string;
  plus_one_of_guest_id: string | null;
  last_name: string;
  first_name: string;
  // Primary custom group (first membership) — auto-seat keeps a group's
  // members contiguous within their tier so they land together. null = the
  // guest belongs to no custom group and falls back to pure name order.
  group_id: string | null;
};

export type AutoSeatRow = { guest_id: string; table_id: string; seat_number: number };

// Public role-tier classifier — same mapping the auto-seat rings use, exported so
// the editor's "seat a role tier at this table" action can group guests without
// re-deriving the role sets. 1 = family + principal sponsors (innermost), 2 =
// entourage, 3 = extended family, 4 = everyone else.
export function roleTier(role: string, groupCategory: string): 1 | 2 | 3 | 4 {
  if (TIER1_ROLES.has(role)) return 1;
  if (TIER2_ROLES.has(role)) return 2;
  if (groupCategory === 'family') return 3;
  return 4;
}

// Human labels for the four role tiers (the popup's "Role" picker tab).
export const ROLE_TIER_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Family & principal sponsors',
  2: 'Entourage',
  3: 'Extended family',
  4: 'Friends & others',
};

function tierOf(g: AutoSeatGuest): 1 | 2 | 3 | 4 {
  return roleTier(g.role, g.group_category);
}

// Default stage anchor (top-centre) when the event has no saved floor plan.
const STAGE_POINT = { x: 50, y: 8 };

function tablePoint(t: EventTableRow, index: number, total: number): { x: number; y: number } {
  if (t.x_pos !== null && t.y_pos !== null) return { x: Number(t.x_pos), y: Number(t.y_pos) };
  const cols = Math.max(2, Math.ceil(Math.sqrt(total)));
  const rows = Math.max(1, Math.ceil(total / cols));
  return {
    x: ((index % cols) + 0.5) / cols * 100,
    y: 20 + (Math.floor(index / cols) + 0.5) / rows * 75,
  };
}

export function computeAutoSeat(
  tables: EventTableRow[],
  guests: AutoSeatGuest[],
  assignments: SeatAssignmentRow[],
  stage: { x: number; y: number } = STAGE_POINT,
): AutoSeatRow[] {
  const assignedGuestIds = new Set(assignments.map((a) => a.guest_id));

  // Per-table occupancy: which seat numbers are taken + a live free count.
  // Deleted chairs (removed_seats) are pre-marked occupied so auto-seat never
  // fills them, and the free count starts at the effective (occupiable) capacity.
  const occupied = new Map<string, Set<number>>();
  const freeCount = new Map<string, number>();
  for (const t of tables) {
    occupied.set(t.table_id, removedSeatSet(t.removed_seats, t.capacity));
    freeCount.set(t.table_id, effectiveCapacity(t.capacity, t.removed_seats));
  }
  for (const a of assignments) {
    const occ = occupied.get(a.table_id);
    if (!occ) continue;
    if (a.seat_number !== null && a.seat_number >= 0) occ.add(a.seat_number);
    freeCount.set(a.table_id, (freeCount.get(a.table_id) ?? 0) - 1);
  }

  // Table pool: everything except sweetheart (reserved for the couple),
  // sorted nearest-to-stage first.
  const pool = tables
    .map((t, i) => ({ t, p: tablePoint(t, i, tables.length) }))
    .filter((x) => x.t.table_type !== 'sweetheart_2')
    .sort((a, b) => {
      const da = (a.p.x - stage.x) ** 2 + (a.p.y - stage.y) ** 2;
      const db = (b.p.x - stage.x) ** 2 + (b.p.y - stage.y) ** 2;
      if (da !== db) return da - db;
      return a.p.y - b.p.y || a.p.x - b.p.x;
    })
    .map((x) => x.t);

  // Eligible: attending, not yet seated, not the couple themselves.
  const eligible = guests.filter(
    (g) =>
      g.rsvp_status === 'attending' &&
      !assignedGuestIds.has(g.guest_id) &&
      g.role !== 'bride' &&
      g.role !== 'groom',
  );

  // Order within each tier: cluster a custom group's members together, and
  // keep a guest's plus-one adjacent to its primary. Contiguous order → the
  // sequential fill below drops a group onto the same/neighbouring tables.
  const byTier: Record<1 | 2 | 3 | 4, AutoSeatGuest[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const g of eligible) byTier[tierOf(g)].push(g);

  const nameKey = (g: AutoSeatGuest) => `${g.last_name} ${g.first_name}`.toLowerCase();
  const ordered: AutoSeatGuest[] = [];
  for (const tier of [1, 2, 3, 4] as const) {
    const list = byTier[tier];
    const plusOnesBy = new Map<string, AutoSeatGuest[]>();
    const primaries: AutoSeatGuest[] = [];
    for (const g of list) {
      if (g.plus_one_of_guest_id) {
        const arr = plusOnesBy.get(g.plus_one_of_guest_id) ?? [];
        arr.push(g);
        plusOnesBy.set(g.plus_one_of_guest_id, arr);
      } else {
        primaries.push(g);
      }
    }

    // Bucket primaries by custom group; an ungrouped guest is its own singleton
    // bucket, so the cluster sort below leaves them in pure name order (matches
    // the prior behaviour). Each bucket is name-sorted internally, and buckets
    // are ordered by their first member's name — deterministic across runs.
    const clusters = new Map<string, AutoSeatGuest[]>();
    for (const g of primaries) {
      const key = g.group_id ?? `__solo__${g.guest_id}`;
      const arr = clusters.get(key) ?? [];
      arr.push(g);
      clusters.set(key, arr);
    }
    const orderedClusters = [...clusters.values()]
      .map((members) => members.sort((a, b) => nameKey(a).localeCompare(nameKey(b))))
      .sort((a, b) => nameKey(a[0]!).localeCompare(nameKey(b[0]!)));

    for (const cluster of orderedClusters) {
      for (const g of cluster) {
        ordered.push(g);
        for (const p of plusOnesBy.get(g.guest_id) ?? []) ordered.push(p);
      }
    }
    // Plus-ones whose primary isn't in this tier still get seated here.
    for (const [primaryId, arr] of plusOnesBy) {
      if (!list.some((g) => g.guest_id === primaryId && !g.plus_one_of_guest_id)) {
        for (const p of arr) ordered.push(p);
      }
    }
  }

  const result: AutoSeatRow[] = [];
  for (const g of ordered) {
    const table = pool.find((t) => (freeCount.get(t.table_id) ?? 0) > 0);
    if (!table) break; // pool exhausted — remaining guests stay unseated
    const occ = occupied.get(table.table_id)!;
    let seat = 0;
    while (occ.has(seat)) seat++;
    occ.add(seat);
    freeCount.set(table.table_id, (freeCount.get(table.table_id) ?? 0) - 1);
    result.push({ guest_id: g.guest_id, table_id: table.table_id, seat_number: seat });
  }
  return result;
}
