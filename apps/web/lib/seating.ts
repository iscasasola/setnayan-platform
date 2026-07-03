import type { SupabaseClient } from '@supabase/supabase-js';
// Iteration 0053 Phase 2: the wedding seating-tier data now lives in
// lib/role-sets.ts (single source). We import WEDDING_ROLE_SET as the DEFAULT
// for every tier classifier so un-threaded callers behave exactly as before;
// the RoleSet type is imported type-only so there is no runtime import cycle.
import { WEDDING_ROLE_SET, type RoleSet } from './role-sets';

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
  // Smart seat-plan Phase 4 lock-and-fill: a pinned hand-placed seat the solver
  // never moves. Optional on the type so pre-migration reads + render-only
  // literals don't need it; fetchAssignments coalesces to false.
  locked?: boolean;
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
    .select('assignment_id,table_id,guest_id,seat_number,locked')
    .eq('event_id', eventId);
  if (error) throw new Error(`fetchAssignments failed: ${error.message}`);
  // Coalesce locked → false so a pre-migration read never yields undefined.
  return (data ?? []).map((a) => ({
    ...(a as SeatAssignmentRow),
    locked: (a as SeatAssignmentRow).locked ?? false,
  }));
}

// Keep-apart rules for an event (smart seat-plan · Phase 3). Couple-private via
// RLS. Graceful-degrade: a read error (or not-yet-migrated table) yields no
// rules so auto-seat still runs (it just won't separate anyone). Returned as
// KeepApartRule pairs; solveSeatPlan expands them to whole groups at solve time.
export async function fetchSeatingConstraints(
  supabase: SupabaseClient,
  eventId: string,
): Promise<KeepApartRule[]> {
  const { data, error } = await supabase
    .from('event_seating_constraints')
    .select('guest_a_id,guest_b_id')
    .eq('event_id', eventId)
    .eq('kind', 'keep_apart');
  if (error) return [];
  return (data ?? []).map((r) => {
    const row = r as { guest_a_id: string; guest_b_id: string };
    return { guest_a_id: row.guest_a_id, guest_b_id: row.guest_b_id };
  });
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
  // Cocktail / waiting-area room — a SECOND room on the same canvas (sits
  // outside the reception walls). Booths place inside; tables/chairs blocked.
  cocktail_enabled: boolean;
  cocktail_x: number;
  cocktail_y: number;
  cocktail_w: number;
  cocktail_h: number;
  cocktail_label: string;
  cocktail_width_m: number | null;
  cocktail_length_m: number | null;
  cocktail_schedule_block_id: string | null;
  // Couple revoke switch — when false, booked stylist/booth vendors can't edit.
  cocktail_vendor_edit: boolean;
  // Dock mode: TRUE = the room docks at the reception entrance with a drawn
  // doorway connector (arrive→register→enter); FALSE = free-floats.
  cocktail_linked: boolean;
  venue_width_m: number | null;
  venue_length_m: number | null;
  // When the couple last published the seating pack (stamped table QR sheets).
  published_at: string | null;
  // Smart seat-plan Phase 2: the couple's draggable seating-priority tier order
  // (who fills the stage-closest tables first). null = the locked default
  // (defaultPriorityOrder()), which reproduces the historical hardcoded fill.
  priority_order: PriorityOrder | null;
  // Host choice for guest PHOTOS in the public 3D venue walk (owner 2026-07-03):
  // 'table' (default) = own tablemates only · 'all' = every seated face · 'none'
  // = no photos. Photos are always token-gated in the RPC; this sets the reach.
  venue_photo_visibility: 'table' | 'all' | 'none';
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
  cocktail_enabled: false,
  cocktail_x: 50,
  cocktail_y: 40,
  cocktail_w: 30,
  cocktail_h: 22,
  cocktail_label: 'Cocktail Area',
  cocktail_width_m: null,
  cocktail_length_m: null,
  cocktail_schedule_block_id: null,
  cocktail_vendor_edit: true,
  cocktail_linked: true,
  venue_width_m: null,
  venue_length_m: null,
  published_at: null,
  priority_order: null,
  venue_photo_visibility: 'table',
};

export async function fetchFloorPlan(
  supabase: SupabaseClient,
  eventId: string,
): Promise<FloorPlanRow> {
  const { data, error } = await supabase
    .from('event_floor_plan')
    .select(
      'stage_x,stage_y,stage_w,stage_h,entrance_enabled,entrance_x,entrance_y,dance_enabled,dance_x,dance_y,dance_w,dance_h,service_entrance_enabled,service_entrance_x,service_entrance_y,cocktail_enabled,cocktail_x,cocktail_y,cocktail_w,cocktail_h,cocktail_label,cocktail_width_m,cocktail_length_m,cocktail_schedule_block_id,cocktail_vendor_edit,cocktail_linked,venue_width_m,venue_length_m,published_at,priority_order,venue_photo_visibility',
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
    cocktail_enabled: Boolean(data.cocktail_enabled),
    cocktail_x: num(data.cocktail_x, D.cocktail_x),
    cocktail_y: num(data.cocktail_y, D.cocktail_y),
    cocktail_w: num(data.cocktail_w, D.cocktail_w),
    cocktail_h: num(data.cocktail_h, D.cocktail_h),
    cocktail_label:
      typeof data.cocktail_label === 'string' && data.cocktail_label.length > 0
        ? data.cocktail_label
        : D.cocktail_label,
    cocktail_width_m: data.cocktail_width_m === null ? null : Number(data.cocktail_width_m),
    cocktail_length_m: data.cocktail_length_m === null ? null : Number(data.cocktail_length_m),
    cocktail_schedule_block_id:
      (data as { cocktail_schedule_block_id?: string | null }).cocktail_schedule_block_id ?? null,
    cocktail_vendor_edit:
      data.cocktail_vendor_edit === undefined || data.cocktail_vendor_edit === null
        ? true
        : Boolean(data.cocktail_vendor_edit),
    cocktail_linked:
      data.cocktail_linked === undefined || data.cocktail_linked === null
        ? true
        : Boolean(data.cocktail_linked),
    venue_width_m: data.venue_width_m === null ? null : Number(data.venue_width_m),
    venue_length_m: data.venue_length_m === null ? null : Number(data.venue_length_m),
    published_at: (data as { published_at?: string | null }).published_at ?? null,
    priority_order: parsePriorityOrder((data as { priority_order?: unknown }).priority_order),
    venue_photo_visibility: ((): 'table' | 'all' | 'none' => {
      const v = (data as { venue_photo_visibility?: unknown }).venue_photo_visibility;
      return v === 'all' || v === 'none' || v === 'table' ? v : D.venue_photo_visibility;
    })(),
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

// The minimal table shape the display-unit grouping needs. EventTableRow
// satisfies it; render-only literals can too.
type LinkableTable = Pick<
  EventTableRow,
  | 'table_id'
  | 'table_label'
  | 'table_type'
  | 'capacity'
  | 'removed_seats'
  | 'link_group_id'
  | 'link_group_label'
>;

// A display unit collapses linked tables (sharing link_group_id) into ONE entry
// so list/summary surfaces show a joined set as a single pooled table — combined
// name + combined seat count — while the canvas keeps drawing each physical
// table separately. Mirrors the print route's per-unit grouping, adding the
// summed capacity ("Table 3 & 4 · 20 seats"). Unlinked tables are one-member
// units. `capacity` is the sum of each member's effectiveCapacity (removed
// chairs already excluded) so the caterer counts the unit's real seats once.
export type TableDisplayUnit<T extends LinkableTable = EventTableRow> = {
  key: string; // link_group_id, or table_id for an unlinked table
  label: string; // link_group_label of the unit, else the lead table's label
  lead: T; // first member in iteration order — owns the QR, anchors row actions
  members: T[]; // 1 for an unlinked table; N for a joined unit
  isLinked: boolean; // true when the lead carries a link_group_id
  capacity: number; // Σ effectiveCapacity across members (removed chairs excluded)
};

// Group tables into display units. Preserves first-seen order, so callers should
// pass tables already sorted (fetchTables returns them by sort_order, created_at).
export function groupTablesIntoUnits<T extends LinkableTable>(tables: T[]): TableDisplayUnit<T>[] {
  const byKey = new Map<string, TableDisplayUnit<T>>();
  for (const t of tables) {
    const key = t.link_group_id ?? t.table_id;
    const cap = effectiveCapacity(t.capacity, t.removed_seats);
    const existing = byKey.get(key);
    if (existing) {
      existing.members.push(t);
      existing.capacity += cap;
    } else {
      byKey.set(key, {
        key,
        label: t.link_group_label ?? t.table_label,
        lead: t,
        members: [t],
        isLinked: t.link_group_id != null,
        capacity: cap,
      });
    }
  }
  return [...byKey.values()];
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
    // End insets keep the seam chair-free when wedges chain tip-to-tip: at a
    // joint the neighbouring wedges' chairs must clear each other (inner radius
    // is tight — 0.36 rad ≈ a chair-width gap across the seam; 0.32 crowded).
    const seats: SeatSlot[] = [
      ...along(outerN, Rco, 0.18),
      ...along(innerN, Rci, 0.36),
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

// Tier role sets + labels moved to lib/role-sets.ts (WEDDING_ROLE_SET) — the
// single source consumed below via the defaulted roleSet param.

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
  // Explicit per-guest tier override (guests.seating_priority, 1–4). null /
  // undefined = derive from role + group_category via roleTier().
  seating_priority?: number | null;
};

export type AutoSeatRow = { guest_id: string; table_id: string; seat_number: number };

// Public role-tier classifier — same mapping the auto-seat rings use, exported so
// the editor's "seat a role tier at this table" action can group guests without
// re-deriving the role sets. 1 = family + principal sponsors (innermost), 2 =
// entourage, 3 = extended family, 4 = everyone else.
export function roleTier(
  role: string,
  groupCategory: string,
  roleSet: RoleSet = WEDDING_ROLE_SET,
): 1 | 2 | 3 | 4 {
  if (roleSet.tier1Roles.has(role)) return 1;
  if (roleSet.tier2Roles.has(role)) return 2;
  // tier3Roles is EMPTY for weddings, so this collapses to the historical
  // `groupCategory === 'family'` check (byte-identical); generic role sets use
  // it to map e.g. 'family' to tier 3 without a group_category.
  if (roleSet.tier3Roles.has(role) || groupCategory === 'family') return 3;
  return 4;
}

// Human labels for the four role tiers (the popup's "Role" picker tab).
// Re-exported from WEDDING_ROLE_SET so there is one source of the wedding
// labels; the values are unchanged.
export const ROLE_TIER_LABELS: Record<1 | 2 | 3 | 4, string> =
  WEDDING_ROLE_SET.tierLabels;

// Override-aware tier: an explicit guests.seating_priority (1–4) wins; null /
// undefined / out-of-range falls back to the role-derived tier. Exported so the
// editor's priority chip shows exactly the tier auto-arrange will use.
export function guestTier(
  role: string,
  groupCategory: string,
  override?: number | null,
  roleSet: RoleSet = WEDDING_ROLE_SET,
): 1 | 2 | 3 | 4 {
  if (override === 1 || override === 2 || override === 3 || override === 4) return override;
  return roleTier(role, groupCategory, roleSet);
}

function tierOf(g: AutoSeatGuest, roleSet: RoleSet = WEDDING_ROLE_SET): 1 | 2 | 3 | 4 {
  return guestTier(g.role, g.group_category, g.seating_priority, roleSet);
}

// ---------------------------------------------------------------------------
// Seating priority order (smart seat-plan · Phase 2). The couple DRAGS to
// reorder the role tiers; the order decides who fills the stage-closest tables
// first (computeAutoSeat fills tier by tier into a stage-ranked pool, so the
// tier sequence IS the VIP-near-stage weighting). Persisted as
// event_floor_plan.priority_order (JSONB); null = the default below, which
// reproduces the historical hardcoded 1→2→3→4 fill (back-compatible).
// ---------------------------------------------------------------------------
export type PriorityTier = { tier: 1 | 2 | 3 | 4; label: string };
export type PriorityOrder = PriorityTier[];

// The locked default order — highest priority (nearest the stage) first.
export function defaultPriorityOrder(
  roleSet: RoleSet = WEDDING_ROLE_SET,
): PriorityOrder {
  return ([1, 2, 3, 4] as const).map((tier) => ({ tier, label: roleSet.tierLabels[tier] }));
}

// Validate a JSONB value read from the DB into a clean PriorityOrder: keep only
// well-formed, de-duplicated tiers 1–4 and always re-derive the label from
// ROLE_TIER_LABELS (storage carries the ORDER; labels stay canonical). Returns
// null for anything malformed/empty so callers fall back to the default.
export function parsePriorityOrder(
  raw: unknown,
  roleSet: RoleSet = WEDDING_ROLE_SET,
): PriorityOrder | null {
  if (!Array.isArray(raw)) return null;
  const out: PriorityOrder = [];
  const seen = new Set<number>();
  for (const item of raw) {
    const t = (item as { tier?: unknown } | null)?.tier;
    if ((t === 1 || t === 2 || t === 3 || t === 4) && !seen.has(t)) {
      seen.add(t);
      out.push({ tier: t, label: roleSet.tierLabels[t] });
    }
  }
  return out.length > 0 ? out : null;
}

// Map each role tier to a numeric rank (0 = highest priority = nearest the
// stage) from a possibly-reordered priority list. Tiers absent from the list
// keep a stable fallback after the listed ones. null/empty → the default order.
export function resolvePriorityRank(
  order: PriorityOrder | null | undefined,
): Record<1 | 2 | 3 | 4, number> {
  const list = order && order.length > 0 ? order : defaultPriorityOrder();
  const rank: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const seen = new Set<number>();
  let r = 0;
  for (const { tier } of list) {
    if (!seen.has(tier)) {
      rank[tier] = r++;
      seen.add(tier);
    }
  }
  for (const t of [1, 2, 3, 4] as const) if (!seen.has(t)) rank[t] = r++;
  return rank;
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
  // Smart seat-plan Phase 2: the couple's draggable tier order. null = the
  // default 1→2→3→4 fill (back-compatible — all existing callers omit it).
  priorityOrder: PriorityOrder | null = null,
  // Iteration 0053 P2: per-event-type role set. Default = wedding, so every
  // existing caller is byte-identical; a generic event passes its set to tier
  // host/vip→1, family→3 and to exclude the right principals (none).
  roleSet: RoleSet = WEDDING_ROLE_SET,
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
  // sorted highest priority score first (= nearest to the stage).
  const pool = rankTablesByStage(tables, stage)
    .filter((r) => r.table.table_type !== 'sweetheart_2')
    .map((r) => r.table);

  // Eligible: everyone NOT declined (so pending/maybe get a HELD seat too — the
  // couple plans the whole room before every RSVP is in; pending seats firm up as
  // replies land, declined are excluded), not yet seated, not the couple
  // themselves. Matches recommendTableSet, which already sizes the floor for all
  // non-declined guests, so the seater now fills the tables it built for.
  const eligible = guests.filter(
    (g) =>
      g.rsvp_status !== 'declined' &&
      !assignedGuestIds.has(g.guest_id) &&
      !roleSet.coupleRoles.has(g.role),
  );

  // Order within each tier: cluster a custom group's members together, and
  // keep a guest's plus-one adjacent to its primary. Contiguous order → the
  // sequential fill below drops a group onto the same/neighbouring tables.
  const byTier: Record<1 | 2 | 3 | 4, AutoSeatGuest[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const g of eligible) byTier[tierOf(g, roleSet)].push(g);

  const nameKey = (g: AutoSeatGuest) => `${g.last_name} ${g.first_name}`.toLowerCase();
  const ordered: AutoSeatGuest[] = [];
  // Fill tiers in the couple's chosen priority order (highest first → fills the
  // stage-closest tables first). Default order = 1→2→3→4.
  const rank = resolvePriorityRank(priorityOrder);
  const tierSequence = ([1, 2, 3, 4] as const).slice().sort((a, b) => rank[a] - rank[b]);
  for (const tier of tierSequence) {
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

// ---------------------------------------------------------------------------
// Constraint-aware solver (smart seat-plan · Phase 3). Honours KEEP-APART rules:
// two guests — and, group-aware, their whole custom groups — that must never
// share a table. HARD constraint. The solver warm-starts from computeAutoSeat
// (so the Phase-2 priority + stage weighting carry through), then runs a
// DETERMINISTIC greedy repair: relocate a violating guest to the stage-closest
// conflict-free table that has a free seat. It always returns a best-effort plan
// plus the residual violations (graceful degrade — never throws, never empty).
// Deterministic BY CONSTRUCTION (fixed orderings, no Math.random) so the same
// input always yields the same plan — no per-render randomness.
//
// "Same table" is LINK-GROUP aware: linked tables are ONE pool (Phase 1), so two
// keep-apart guests must not share a link-group unit, not merely a table_id.
// Only the guests computeAutoSeat newly seats are MOVABLE; pre-existing
// assignments are fixed context (they count toward occupancy + conflicts but are
// never moved — Phase 4 adds explicit per-seat locking).
// ---------------------------------------------------------------------------

export type KeepApartRule = { guest_a_id: string; guest_b_id: string };

export type SolveInput = {
  tables: EventTableRow[];
  guests: AutoSeatGuest[];
  assignments: SeatAssignmentRow[];
  stage?: { x: number; y: number };
  priorityOrder?: PriorityOrder | null;
  constraints: KeepApartRule[];
  // guest_id -> custom group_ids (from fetchGroupMembershipsByEvent). A keep-apart
  // pair expands to BOTH guests' whole groups at solve time (group-aware).
  groupMembers?: Map<string, string[]>;
  // Iteration 0053 P2: per-event-type role set (omitted = wedding default).
  roleSet?: RoleSet;
};

export type SolveResult = {
  // Placements for the newly-seated (movable) guests — same contract as
  // computeAutoSeat's return (the caller inserts these).
  assignments: AutoSeatRow[];
  // Rules still unsatisfiable after best-effort repair (e.g. only one big table fits both).
  violations: KeepApartRule[];
  satisfiedCount: number;
  totalRules: number;
};

export function solveSeatPlan(input: SolveInput): SolveResult {
  const {
    tables,
    guests,
    assignments,
    stage = STAGE_POINT,
    priorityOrder = null,
    constraints,
    groupMembers = new Map<string, string[]>(),
    roleSet = WEDDING_ROLE_SET,
  } = input;

  // Warm start (priority + stage aware; ignores constraints). No rules → done.
  const warm = computeAutoSeat(tables, guests, assignments, stage, priorityOrder, roleSet);
  const totalRules = constraints.length;
  if (totalRules === 0) {
    return { assignments: warm, violations: [], satisfiedCount: 0, totalRules: 0 };
  }

  // Units (link-group pools) + capacity + table→unit map, and a stage-ranked
  // unit order so relocations prefer the best remaining seats.
  const units = groupTablesIntoUnits(tables);
  const unitByKey = new Map(units.map((u) => [u.key, u] as const));
  const unitCap = new Map(units.map((u) => [u.key, u.capacity] as const));
  const unitKeyOfTable = new Map<string, string>();
  for (const u of units) for (const m of u.members) unitKeyOfTable.set(m.table_id, u.key);
  const seen = new Set<string>();
  const unitOrder: string[] = [];
  for (const r of rankTablesByStage(tables, stage)) {
    const uk = unitKeyOfTable.get(r.table.table_id);
    if (uk && !seen.has(uk)) {
      seen.add(uk);
      unitOrder.push(uk);
    }
  }

  // Per-table occupied seats (removed pre-marked), seeded from fixed + warm.
  const occupied = new Map<string, Set<number>>();
  for (const t of tables) occupied.set(t.table_id, removedSeatSet(t.removed_seats, t.capacity));
  // guest → seat; movable = the warm-seated set; the rest (pre-existing) are fixed.
  const seatOf = new Map<string, { table_id: string; seat_number: number }>();
  const movable = new Set<string>();
  const unitGuests = new Map<string, Set<string>>();
  const addToUnit = (uKey: string, gid: string) => {
    const s = unitGuests.get(uKey) ?? new Set<string>();
    s.add(gid);
    unitGuests.set(uKey, s);
  };
  const seatGuest = (gid: string, tableId: string, seat: number, isMovable: boolean) => {
    seatOf.set(gid, { table_id: tableId, seat_number: seat });
    occupied.get(tableId)?.add(seat);
    const uk = unitKeyOfTable.get(tableId);
    if (uk) addToUnit(uk, gid);
    if (isMovable) movable.add(gid);
  };
  for (const a of assignments) {
    if (a.seat_number !== null && unitKeyOfTable.has(a.table_id)) {
      seatGuest(a.guest_id, a.table_id, a.seat_number, false);
    }
  }
  for (const r of warm) seatGuest(r.guest_id, r.table_id, r.seat_number, true);

  const unitOfGuest = (gid: string): string | undefined => {
    const s = seatOf.get(gid);
    return s ? unitKeyOfTable.get(s.table_id) : undefined;
  };

  // Forbidden unordered guest pairs (group-expanded). group → members first.
  const membersByGroup = new Map<string, string[]>();
  for (const [gid, groupsOfG] of groupMembers) {
    for (const grp of groupsOfG) {
      const arr = membersByGroup.get(grp) ?? [];
      arr.push(gid);
      membersByGroup.set(grp, arr);
    }
  }
  const expand = (gid: string): Set<string> => {
    const set = new Set<string>([gid]);
    for (const grp of groupMembers.get(gid) ?? []) {
      for (const m of membersByGroup.get(grp) ?? []) set.add(m);
    }
    return set;
  };
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const forbidden = new Set<string>();
  for (const rule of constraints) {
    const A = expand(rule.guest_a_id);
    const B = expand(rule.guest_b_id);
    for (const x of A) for (const y of B) if (x !== y) forbidden.add(pairKey(x, y));
  }

  const conflictAt = (gid: string, uKey: string): boolean => {
    for (const other of unitGuests.get(uKey) ?? []) {
      if (other !== gid && forbidden.has(pairKey(gid, other))) return true;
    }
    return false;
  };
  const freeSeatInUnit = (uKey: string): { table_id: string; seat: number } | null => {
    const u = unitByKey.get(uKey);
    if (!u) return null;
    for (const m of u.members) {
      const occ = occupied.get(m.table_id)!;
      for (let s = 0; s < m.capacity; s++) if (!occ.has(s)) return { table_id: m.table_id, seat: s };
    }
    return null;
  };
  // Lower-priority guests move first (preserve VIP stage placement): higher tier
  // RANK number = lower priority = cheaper to move. Tie-break by guest_id.
  const guestById = new Map(guests.map((g) => [g.guest_id, g] as const));
  const tierRank = resolvePriorityRank(priorityOrder);
  const moveCost = (gid: string): number => {
    const g = guestById.get(gid);
    const tier = g ? guestTier(g.role, g.group_category, g.seating_priority, roleSet) : 4;
    return tierRank[tier];
  };

  // Deterministic greedy repair: each pass fixes at most one violated pair then
  // re-evaluates (no thrashing). Bounded so it always terminates. BEST-EFFORT,
  // not optimal — it relocates a *violating* guest to a conflict-free table but
  // never backtracks an innocent "anchor" guest, so a rare satisfiable layout can
  // still be reported as a violation (e.g. the only conflict-free table is full
  // of unrelated guests a swap would free). That's a quality limit, not a
  // correctness bug: the result is always valid, fully seated, and the violation
  // list is accurate. A future pass could add swaps / simulated annealing.
  const maxPasses = Math.min(1000, movable.size * 4 + constraints.length + 1);
  for (let pass = 0; pass < maxPasses; pass++) {
    const violated = [...forbidden]
      .filter((k) => {
        const i = k.indexOf('|');
        const a = k.slice(0, i);
        const b = k.slice(i + 1);
        const ua = unitOfGuest(a);
        return ua != null && ua === unitOfGuest(b);
      })
      .sort();
    if (violated.length === 0) break;
    let moved = false;
    for (const k of violated) {
      const i = k.indexOf('|');
      const pair = [k.slice(0, i), k.slice(i + 1)];
      const movers = pair
        .filter((x) => movable.has(x))
        .sort((x, y) => moveCost(y) - moveCost(x) || (x < y ? -1 : 1));
      let did = false;
      for (const mover of movers) {
        const from = unitOfGuest(mover);
        for (const uKey of unitOrder) {
          if (uKey === from) continue;
          if ((unitGuests.get(uKey)?.size ?? 0) >= (unitCap.get(uKey) ?? 0)) continue;
          if (conflictAt(mover, uKey)) continue;
          const slot = freeSeatInUnit(uKey);
          if (!slot) continue;
          const old = seatOf.get(mover)!;
          occupied.get(old.table_id)!.delete(old.seat_number);
          if (from) unitGuests.get(from)?.delete(mover);
          seatGuest(mover, slot.table_id, slot.seat, true);
          did = true;
          moved = true;
          break;
        }
        if (did) break;
      }
      if (did) break; // re-evaluate from a clean slate next pass
    }
    if (!moved) break; // stuck — remaining violations are unavoidable
  }

  const outAssignments: AutoSeatRow[] = [...movable].map((gid) => {
    const s = seatOf.get(gid)!;
    return { guest_id: gid, table_id: s.table_id, seat_number: s.seat_number };
  });
  // A rule is violated iff ANY of its expanded pairs is still co-seated.
  const violations = constraints.filter((rule) => {
    const A = expand(rule.guest_a_id);
    const B = expand(rule.guest_b_id);
    for (const x of A) {
      const ux = unitOfGuest(x);
      if (ux == null) continue;
      for (const y of B) if (x !== y && unitOfGuest(y) === ux) return true;
    }
    return false;
  });
  return {
    assignments: outAssignments,
    violations,
    satisfiedCount: totalRules - violations.length,
    totalRules,
  };
}

// Pick the keep-apart rule to RELAX (drop) when the couple accepts that a
// constraint can't be honoured (smart seat-plan · Phase 4 explainability). Keeps
// the separations that protect the most important guests: drops the rule whose
// LOWER-priority guest (the more expendable of its two) is the lowest-ranked
// overall. Deterministic — ties break on the canonical guest-pair key. Pass the
// VIOLATED rules to relax only what actually failed. Returns null for an empty list.
export function relaxLowestPriorityRule(
  rules: KeepApartRule[],
  guests: AutoSeatGuest[],
  priorityOrder?: PriorityOrder | null,
  roleSet: RoleSet = WEDDING_ROLE_SET,
): KeepApartRule | null {
  if (rules.length === 0) return null;
  const rank = resolvePriorityRank(priorityOrder);
  const byId = new Map(guests.map((g) => [g.guest_id, g] as const));
  const rankOf = (id: string): number => {
    const g = byId.get(id);
    return g ? rank[guestTier(g.role, g.group_category, g.seating_priority, roleSet)] : 99;
  };
  // The rule's "expendability" = its more-expendable guest's rank (higher number
  // = lower priority). Drop the most-expendable rule (max), keeping rules that
  // guard high-priority guests. Tie-break on a stable canonical pair key.
  const expendability = (r: KeepApartRule) => Math.max(rankOf(r.guest_a_id), rankOf(r.guest_b_id));
  const keyOf = (r: KeepApartRule) =>
    r.guest_a_id < r.guest_b_id
      ? `${r.guest_a_id}|${r.guest_b_id}`
      : `${r.guest_b_id}|${r.guest_a_id}`;
  let chosen = rules[0]!;
  let chosenScore = expendability(chosen);
  for (const r of rules) {
    const s = expendability(r);
    if (s > chosenScore || (s === chosenScore && keyOf(r) < keyOf(chosen))) {
      chosen = r;
      chosenScore = s;
    }
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// "Build my seating" starting draft (UX north-star — draft, don't blank; owner
// goal 2026-06-20 to take the seating editor off a blank canvas). Pure: from the
// guest list, recommend a SET of tables that seats everyone — one Sweetheart for
// the couple, then enough round tables for the rest. The couple edits the
// result; nothing here is irreversible. Sizing counts everyone NOT declined
// (attending + still-pending) because a couple builds the floor before every
// RSVP is in; computeAutoSeat seats the same non-declined set (pending get held
// seats), so the floor and the seater agree. Uniform round_10 — the PH reception workhorse
// coordinators standardise on, so a draft reads as one clean rental order.
// ---------------------------------------------------------------------------

export type RecommendedTable = { type: TableType; capacity: number; label: string };

// The default round-table size for a generated draft, and a safety cap so a
// runaway guest import can't spawn hundreds of tables.
export const DRAFT_ROUND_TYPE: TableType = 'round_10';
const DRAFT_ROUND_SEATS = 10;
const DRAFT_MAX_ROUND_TABLES = 60;

const COUPLE_ROLES = new Set(['bride', 'groom']);

export type RecommendGuest = Pick<AutoSeatGuest, 'role' | 'rsvp_status'>;

// Chinese (Tsinoy) tradition avoids the number 4 (四 ≈ 死, "death"). This is the
// single, conservative rule every Chinese-aware seating surface shares: parse the
// label's TRAILING integer and warn/skip only when its ONES digit is 4 — so 4, 14,
// 24, 34, 44… match, but 40 (→0) and 42 (→2) do NOT, and a label with no trailing
// number never matches. Pure + advisory: it powers the editor's gentle notice and
// recommendTableSet's auto-number skip; it never blocks a save. Derive the *event*
// flag from isChineseWedding() (lib/chinese-wedding.ts), never an inline check.
export function tableNumberEndsInFour(label: string): boolean {
  const m = /(\d+)\s*$/.exec(label);
  if (!m) return false;
  // Parse just the trailing run of digits; large labels never overflow because we
  // only need the ones digit, which the regex's last character already gives us.
  const onesDigit = m[1]!.charCodeAt(m[1]!.length - 1) - 48; // '0' === 48
  return onesDigit === 4;
}

export function recommendTableSet(
  guests: ReadonlyArray<RecommendGuest>,
  // Optional, default-off so the non-Chinese / default path is byte-identical.
  // When true (a Chinese wedding — derive via isChineseWedding), the generated
  // table numbers ADVANCE PAST any ones-digit-4 value (4, 14, 24, 34, 44…) while
  // still producing the requested COUNT of round tables. Advisory only.
  options?: { skipFour?: boolean },
): RecommendedTable[] {
  const skipFour = options?.skipFour ?? false;
  // Everyone we should reserve a chair for: not explicitly declined. The couple
  // (bride/groom) get the Sweetheart, so they're excluded from the round count.
  const toSeat = guests.filter(
    (g) => g.rsvp_status !== 'declined' && !COUPLE_ROLES.has(g.role),
  ).length;

  // The couple's Sweetheart, front-and-centre: computeAutoLayout pins it at the
  // stage and computeAutoSeat reserves it — always present for a wedding draft.
  const out: RecommendedTable[] = [{ type: 'sweetheart_2', capacity: 2, label: 'Sweetheart' }];

  const roundCount =
    toSeat > 0 ? Math.min(DRAFT_MAX_ROUND_TABLES, Math.ceil(toSeat / DRAFT_ROUND_SEATS)) : 0;
  // Running display number. Default path = i + 1 (byte-identical). With skipFour,
  // advance the counter past every ones-digit-4 number so the labels skip 4, 14,
  // 24… and we still emit exactly `roundCount` tables.
  let tableNumber = 0;
  for (let i = 0; i < roundCount; i++) {
    tableNumber += 1;
    if (skipFour) {
      while (tableNumber % 10 === 4) tableNumber += 1;
    }
    out.push({ type: DRAFT_ROUND_TYPE, capacity: DRAFT_ROUND_SEATS, label: `Table ${tableNumber}` });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Auto Arrange (iteration 0008 expansion, owner-directed 2026-06-13). One
// click = three deterministic steps, all pure sorting logic (zero AI calls,
// zero per-run cost):
//   1. computeAutoLayout — stage-out coordinate grid for table positions
//   2. boothPerimeterSlots / clampBoothToPerimeter — vendor booths anchored
//      to the walls under hardcoded visibility rules
//   3. computeAutoSeat (above) — guests into tables by priority tier
// ---------------------------------------------------------------------------

export type RankedTable = {
  table: EventTableRow;
  // Squared-distance from the stage in percent units (the sort key).
  distance: number;
  // Human-readable 0–100 proximity score (100 = on the stage). Monotonic
  // inverse of distance; surfaced in tests + future UI, never re-derived.
  priorityScore: number;
};

// Rank tables by physical proximity to the stage node: high proximity = high
// priority score. Deterministic ties (y then x then table_id) so two runs on
// the same plan always agree.
export function rankTablesByStage(
  tables: EventTableRow[],
  stage: { x: number; y: number },
): RankedTable[] {
  return tables
    .map((t, i) => {
      const p =
        t.x_pos !== null && t.y_pos !== null
          ? { x: Number(t.x_pos), y: Number(t.y_pos) }
          : defaultTablePosition(i, tables.length, false);
      const d2 = (p.x - stage.x) ** 2 + (p.y - stage.y) ** 2;
      return { table: t, p, distance: d2, priorityScore: Math.round(10000 / (100 + d2)) / 100 };
    })
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        a.p.y - b.p.y ||
        a.p.x - b.p.x ||
        a.table.table_id.localeCompare(b.table.table_id),
    )
    .map(({ table, distance, priorityScore }) => ({ table, distance, priorityScore }));
}

// --- vendor booths ----------------------------------------------------------

export type BoothType =
  | 'photo_booth'
  | 'mobile_bar'
  | 'dessert_station'
  | 'gift_table'
  | 'souvenir_table'
  | 'registration_desk'
  | 'custom'
  // A blank pin the couple has placed but not yet typed (place-then-pick).
  | 'unassigned';

// The pickable kinds shown in the booth type picker — 'unassigned' is the
// pre-pick state and is deliberately NOT offered as a choice.
export const BOOTH_CATALOG: ReadonlyArray<{ type: Exclude<BoothType, 'unassigned'>; label: string }> = [
  { type: 'photo_booth', label: 'Photo Booth' },
  { type: 'mobile_bar', label: 'Mobile Bar' },
  { type: 'dessert_station', label: 'Dessert Station' },
  { type: 'gift_table', label: 'Gift Table' },
  { type: 'souvenir_table', label: 'Souvenir Table' },
  { type: 'registration_desk', label: 'Front Desk' },
  { type: 'custom', label: 'Custom booth' },
];

export type BoothZone = 'reception' | 'cocktail';

export type FloorBoothRow = {
  booth_id: string;
  event_id: string;
  booth_type: BoothType;
  label: string;
  x_pos: number;
  y_pos: number;
  sort_order: number;
  // Which room on the blueprint this booth sits in. Derived from geometry
  // (inside the cocktail rect → 'cocktail') at save time; couple-managed
  // perimeter booths stay 'reception'.
  zone: BoothZone;
  // The booked vendor running this booth (set for vendor-placed cocktail
  // booths so a booth vendor may only move/delete their own); null otherwise.
  event_vendor_id: string | null;
  // Guest-facing "what this booth serves / offers" copy (<=280 chars) surfaced
  // on the 3D venue-walk booth card. Written by the couple here or the booth's
  // vendor in the cocktail editor. Null when unset.
  offerings: string | null;
  // The booked vendor's PUBLIC business identity (name/category/logo) for the
  // booth card, or null/absent when the booth is unlinked. Joined server-side by
  // fetchBooths; carries zero personal PII. `logo_url` is a RAW stored ref —
  // resolve before display. Optional so 2D-editor local rows (which never join)
  // don't have to carry it.
  vendor?: { vendor_name: string; category: string; logo_url: string | null } | null;
};

export async function fetchBooths(
  supabase: SupabaseClient,
  eventId: string,
): Promise<FloorBoothRow[]> {
  const { data, error } = await supabase
    .from('event_floor_booths')
    .select(
      // The vendor_profiles embed MUST name its FK column: event_vendors has
      // TWO relationships to vendor_profiles (linked_vendor_profile_id and
      // marketplace_vendor_id) and an unhinted embed errors as ambiguous.
      'booth_id,event_id,booth_type,label,x_pos,y_pos,sort_order,zone,event_vendor_id,offerings,' +
        'event_vendors(vendor_name,category,vendor_profiles!marketplace_vendor_id(logo_url))',
    )
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  // Graceful-degrade (same contract as fetchFloorPlan): a not-yet-migrated
  // table or RLS hiccup renders a booth-less plan, never a crashed page. The
  // vendor EMBED is the most fragile piece (it needs the FK relationship
  // metadata) — if the joined select errors, fall back to the plain columns so
  // booths still render, just without the vendor block on their cards.
  if (error || !data) {
    const lean = await supabase
      .from('event_floor_booths')
      .select('booth_id,event_id,booth_type,label,x_pos,y_pos,sort_order,zone,event_vendor_id,offerings')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (lean.error || !lean.data) return [];
    return (lean.data as Omit<FloorBoothRow, 'vendor'>[]).map((b) => ({
      ...b,
      x_pos: Number(b.x_pos),
      y_pos: Number(b.y_pos),
      zone: b.zone === 'cocktail' ? 'cocktail' : 'reception',
      event_vendor_id: b.event_vendor_id ?? null,
      offerings: b.offerings ?? null,
      vendor: null,
    }));
  }
  type Joined = Omit<FloorBoothRow, 'vendor'> & {
    event_vendors:
      | { vendor_name: string; category: string; vendor_profiles: { logo_url: string | null } | null }
      | { vendor_name: string; category: string; vendor_profiles: { logo_url: string | null } | null }[]
      | null;
  };
  return (data as unknown as Joined[]).map((b) => {
    // PostgREST returns an embedded to-one as an object, but typings sometimes
    // widen it to an array — normalise to the first row either way.
    const ev = Array.isArray(b.event_vendors) ? b.event_vendors[0] ?? null : b.event_vendors;
    const vp = ev ? (Array.isArray(ev.vendor_profiles) ? ev.vendor_profiles[0] ?? null : ev.vendor_profiles) : null;
    return {
      booth_id: b.booth_id,
      event_id: b.event_id,
      booth_type: b.booth_type,
      label: b.label,
      x_pos: Number(b.x_pos),
      y_pos: Number(b.y_pos),
      sort_order: b.sort_order,
      zone: b.zone === 'cocktail' ? 'cocktail' : 'reception',
      event_vendor_id: b.event_vendor_id ?? null,
      offerings: (b.offerings ?? null) as string | null,
      vendor: ev
        ? { vendor_name: ev.vendor_name, category: ev.category, logo_url: vp?.logo_url ?? null }
        : null,
    };
  });
}

// --- wayfinding signs -------------------------------------------------------
// Directional markers (rotatable arrow + label, e.g. "Restrooms") placed on the
// shared blueprint. Couple/coordinator manage them; ARRANGE-tier cocktail
// vendors may CRUD via the vendor_*_sign RPCs. rotation_deg: 0 = pointing up.
export type FloorSignRow = {
  sign_id: string;
  event_id: string;
  label: string;
  x_pos: number;
  y_pos: number;
  rotation_deg: number;
  sort_order: number;
};

export async function fetchSigns(
  supabase: SupabaseClient,
  eventId: string,
): Promise<FloorSignRow[]> {
  const { data, error } = await supabase
    .from('event_floor_signs')
    .select('sign_id,event_id,label,x_pos,y_pos,rotation_deg,sort_order')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  // Graceful-degrade (same contract as fetchBooths): a not-yet-migrated table
  // or RLS hiccup renders a sign-less plan, never a crashed page.
  if (error || !data) return [];
  return (data as FloorSignRow[]).map((s) => ({
    ...s,
    x_pos: Number(s.x_pos),
    y_pos: Number(s.y_pos),
    rotation_deg: Number(s.rotation_deg),
  }));
}

// --- placed venue objects (whole-venue designer) ----------------------------
// The non-seating fixtures (arch / buffet / bar / cake & gift & registration
// tables / photo booth / lounge / LED wall / greenery) placed on the same
// percent canvas as tables. `kind` mirrors lib/seating-3d VENUE_OBJECT_CATALOG
// (the canonical list) and the event_scene_objects CHECK. The 3D surfaces render
// these; the 2D editor + couple lab own placement.
export type SceneObjectRow = {
  object_id: string;
  event_id: string;
  kind: string;
  label: string | null;
  x_pct: number;
  y_pct: number;
  rotation_deg: number;
};

export async function fetchSceneObjects(
  supabase: SupabaseClient,
  eventId: string,
): Promise<SceneObjectRow[]> {
  const { data, error } = await supabase
    .from('event_scene_objects')
    .select('object_id,event_id,kind,label,x_pct,y_pct,rotation_deg')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  // Graceful-degrade (same contract as fetchBooths/fetchSigns): a not-yet-
  // migrated table or RLS hiccup renders an object-less plan, never a crash.
  if (error || !data) return [];
  return (data as SceneObjectRow[]).map((o) => ({
    ...o,
    label: o.label ?? null,
    x_pct: Number(o.x_pct),
    y_pct: Number(o.y_pct),
    rotation_deg: Number(o.rotation_deg),
  }));
}

// Booth footprint + the hardcoded perimeter rulebook. All numbers are percent
// of the canvas — the same unit as every other floor-plan coordinate.
export const BOOTH_W = 12;
export const BOOTH_H = 6;
// Booth centres sit this far in from the wall (back edge to the wall).
const WALL_INSET = 4;
// Keep clear of room corners…
const CORNER_CLEAR = 8;
// …of the entrance / service doors (guest + load-in paths stay open)…
const DOOR_CLEAR = 12;
// …and of the stage's own wall extent (sightlines + backstage access).
const STAGE_CLEAR = 6;
// Minimum centre-to-centre spacing between booths along a wall.
const BOOTH_GAP = BOOTH_W + 3;

type WallName = 'top' | 'right' | 'bottom' | 'left';
const WALLS: WallName[] = ['top', 'right', 'bottom', 'left'];

type FloorPlanLike = Pick<
  FloorPlanRow,
  | 'stage_x'
  | 'stage_y'
  | 'stage_w'
  | 'stage_h'
  | 'entrance_enabled'
  | 'entrance_x'
  | 'entrance_y'
  | 'service_entrance_enabled'
  | 'service_entrance_x'
  | 'service_entrance_y'
>;

// Point on a wall at 1-D coordinate t (percent along the wall, 0→100
// clockwise from each wall's natural start).
function wallPoint(wall: WallName, t: number): { x: number; y: number } {
  if (wall === 'top') return { x: t, y: WALL_INSET };
  if (wall === 'bottom') return { x: t, y: 100 - WALL_INSET };
  if (wall === 'left') return { x: WALL_INSET, y: t };
  return { x: 100 - WALL_INSET, y: t };
}

// Which wall the stage is parked against (nearest wall to its centre).
// Booths are NEVER anchored to this wall — flanking the stage blocks
// sightlines from the side tables and the performers' access path.
export function stageWallOf(fp: FloorPlanLike): WallName {
  const d: Array<[WallName, number]> = [
    ['top', fp.stage_y],
    ['bottom', 100 - fp.stage_y],
    ['left', fp.stage_x],
    ['right', 100 - fp.stage_x],
  ];
  d.sort((a, b) => a[1] - b[1] || WALLS.indexOf(a[0]) - WALLS.indexOf(b[0]));
  return d[0]![0];
}

// The open intervals of a wall where a booth centre may sit, after removing
// the corner margins and every door-clearance window that projects onto this
// wall. The stage wall returns no intervals at all.
function allowedWallIntervals(wall: WallName, fp: FloorPlanLike): Array<{ from: number; to: number }> {
  if (wall === stageWallOf(fp)) return [];
  // Blocked windows in the wall's 1-D coordinate.
  const blocked: Array<{ from: number; to: number }> = [];
  const doors: Array<{ x: number; y: number }> = [];
  if (fp.entrance_enabled) doors.push({ x: fp.entrance_x, y: fp.entrance_y });
  if (fp.service_entrance_enabled) doors.push({ x: fp.service_entrance_x, y: fp.service_entrance_y });
  for (const door of doors) {
    // A door blocks this wall when it sits on (or near) it.
    const nearWall =
      wall === 'top'
        ? door.y <= 2 * DOOR_CLEAR
        : wall === 'bottom'
          ? door.y >= 100 - 2 * DOOR_CLEAR
          : wall === 'left'
            ? door.x <= 2 * DOOR_CLEAR
            : door.x >= 100 - 2 * DOOR_CLEAR;
    if (!nearWall) continue;
    const t = wall === 'top' || wall === 'bottom' ? door.x : door.y;
    blocked.push({ from: t - DOOR_CLEAR, to: t + DOOR_CLEAR });
  }
  // The stage also shadows the two walls it touches sideways (a stage parked
  // top-centre still owns part of the left/right walls near its corners).
  const sx0 = fp.stage_x - fp.stage_w / 2 - STAGE_CLEAR;
  const sx1 = fp.stage_x + fp.stage_w / 2 + STAGE_CLEAR;
  const sy0 = fp.stage_y - fp.stage_h / 2 - STAGE_CLEAR;
  const sy1 = fp.stage_y + fp.stage_h / 2 + STAGE_CLEAR;
  if (wall === 'top' && sy0 <= WALL_INSET + BOOTH_H) blocked.push({ from: sx0, to: sx1 });
  if (wall === 'bottom' && sy1 >= 100 - WALL_INSET - BOOTH_H) blocked.push({ from: sx0, to: sx1 });
  if (wall === 'left' && sx0 <= WALL_INSET + BOOTH_H) blocked.push({ from: sy0, to: sy1 });
  if (wall === 'right' && sx1 >= 100 - WALL_INSET - BOOTH_H) blocked.push({ from: sy0, to: sy1 });

  // Subtract the blocked windows from the corner-clear span.
  let open: Array<{ from: number; to: number }> = [{ from: CORNER_CLEAR, to: 100 - CORNER_CLEAR }];
  for (const b of blocked) {
    const next: Array<{ from: number; to: number }> = [];
    for (const seg of open) {
      if (b.to <= seg.from || b.from >= seg.to) {
        next.push(seg);
        continue;
      }
      if (b.from > seg.from) next.push({ from: seg.from, to: b.from });
      if (b.to < seg.to) next.push({ from: b.to, to: seg.to });
    }
    open = next;
  }
  // A segment must fit at least one booth.
  return open.filter((seg) => seg.to - seg.from >= BOOTH_W);
}

// Deterministic anchor slots for n booths: back wall (opposite the stage)
// first, centre-out, then the two side walls. Used by Auto Arrange to park
// every booth; the same geometry drag-snap uses, so a dragged booth can only
// land where Auto Arrange could have put it.
export function boothPerimeterSlots(fp: FloorPlanLike, n: number): Array<{ x: number; y: number }> {
  const stage = stageWallOf(fp);
  const OPPOSITE: Record<WallName, WallName> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
  const SIDES: Record<WallName, [WallName, WallName]> = {
    top: ['right', 'left'],
    bottom: ['right', 'left'],
    left: ['top', 'bottom'],
    right: ['top', 'bottom'],
  };
  const wallOrder: WallName[] = [OPPOSITE[stage], ...SIDES[stage]];

  const out: Array<{ x: number; y: number }> = [];
  for (const wall of wallOrder) {
    if (out.length >= n) break;
    for (const seg of allowedWallIntervals(wall, fp)) {
      if (out.length >= n) break;
      const len = seg.to - seg.from;
      const fit = Math.max(1, Math.floor(len / BOOTH_GAP));
      // Even spacing within the segment, pushed centre-out so the first booth
      // lands mid-wall (most visible without blocking anything).
      const ts: number[] = [];
      for (let i = 0; i < fit; i++) ts.push(seg.from + (len * (i + 0.5)) / fit);
      const mid = (seg.from + seg.to) / 2;
      ts.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
      for (const t of ts) {
        if (out.length >= n) break;
        out.push(wallPoint(wall, t));
      }
    }
  }
  // More booths than legal slots (tiny room, many doors): stack the extras on
  // the back wall mid-point rather than inventing an illegal position.
  while (out.length < n) out.push(wallPoint(OPPOSITE[stage], 50));
  return out;
}

// Free-venue booth placement (gardens / open fields — no walls). There's no
// perimeter to hug, so Auto Arrange tucks booths into a row JUST BEYOND the
// furthest table from the stage: behind the guests, out of the sightline, but
// free-floating (the couple can drag them anywhere afterwards). The row runs
// perpendicular to the stage→tables axis and is centred on the stage's lateral
// line. Pure + deterministic. Coords are percent of the canvas like everything
// else; the free board may legitimately exceed 0–100, and the editor clamps.
export function freeBoothSlots(
  stage: { x: number; y: number },
  tablePoints: ReadonlyArray<{ x: number; y: number }>,
  n: number,
): Array<{ x: number; y: number }> {
  if (n <= 0) return [];
  const gap = BOOTH_W + 3;
  const row = (cx: number, cy: number, px: number, py: number) =>
    Array.from({ length: n }, (_, i) => {
      const off = (i - (n - 1) / 2) * gap;
      return { x: cx + px * off, y: cy + py * off };
    });
  // No tables yet → a horizontal row on the far side of the stage from centre.
  if (tablePoints.length === 0) return row(stage.x, stage.y <= 50 ? 90 : 10, 1, 0);

  const cx = tablePoints.reduce((a, p) => a + p.x, 0) / tablePoints.length;
  const cy = tablePoints.reduce((a, p) => a + p.y, 0) / tablePoints.length;
  let dx = cx - stage.x;
  let dy = cy - stage.y;
  let len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    dx = 0;
    dy = 1;
    len = 1;
  } // stage sits on the cluster → push the row downward
  const ux = dx / len;
  const uy = dy / len; // stage → tables (depth axis)
  const maxProj = Math.max(...tablePoints.map((p) => (p.x - stage.x) * ux + (p.y - stage.y) * uy));
  const depth = maxProj + BOOTH_H + 8; // a touch past the furthest table
  return row(stage.x + ux * depth, stage.y + uy * depth, -uy, ux);
}

// Live drag-snap: pull a booth centre to the nearest legal perimeter spot —
// nearest allowed wall interval, then slid along the wall until it clears
// every other booth. The hardcoded boundary rules are enforced HERE, so a
// booth physically cannot be dropped mid-room, on the stage wall, or across
// a door corridor.
export function clampBoothToPerimeter(
  x: number,
  y: number,
  fp: FloorPlanLike,
  others: Array<{ x: number; y: number }>,
): { x: number; y: number } {
  let best: { x: number; y: number; wall: WallName; t: number } | null = null;
  let bestD = Infinity;
  for (const wall of WALLS) {
    for (const seg of allowedWallIntervals(wall, fp)) {
      const raw = wall === 'top' || wall === 'bottom' ? x : y;
      const t = Math.max(seg.from + BOOTH_W / 2, Math.min(seg.to - BOOTH_W / 2, raw));
      const p = wallPoint(wall, t);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { ...p, wall, t };
      }
    }
  }
  if (!best) return { x: 50, y: 100 - WALL_INSET }; // no legal wall at all — park bottom-centre
  // Slide along the wall away from any booth closer than BOOTH_GAP.
  const along = (p: { x: number; y: number }) => (best!.wall === 'top' || best!.wall === 'bottom' ? p.x : p.y);
  const conflict = (t: number) =>
    others.some((o) => {
      const op = { x: o.x, y: o.y };
      const sameWall = Math.hypot(op.x - wallPoint(best!.wall, along(op)).x, op.y - wallPoint(best!.wall, along(op)).y) < BOOTH_H;
      return sameWall && Math.abs(along(op) - t) < BOOTH_GAP;
    });
  if (!conflict(best.t)) return { x: best.x, y: best.y };
  for (let step = 1; step <= 20; step++) {
    for (const dir of [1, -1]) {
      const t = best.t + dir * step * (BOOTH_GAP / 2);
      if (t < CORNER_CLEAR + BOOTH_W / 2 || t > 100 - CORNER_CLEAR - BOOTH_W / 2) continue;
      if (!conflict(t)) return wallPoint(best.wall, t);
    }
  }
  return { x: best.x, y: best.y }; // dense wall — accept the overlap rather than fly mid-room
}

// --- table auto-layout --------------------------------------------------------

export type AutoLayoutInput = {
  tables: EventTableRow[];
  floorPlan: FloorPlanLike &
    Pick<FloorPlanRow, 'dance_enabled' | 'dance_x' | 'dance_y' | 'dance_w' | 'dance_h'> &
    Pick<FloorPlanRow, 'cocktail_enabled' | 'cocktail_x' | 'cocktail_y' | 'cocktail_w' | 'cocktail_h'>;
  // Canvas pixel rect — converts table pixel footprints into percent.
  rect: { width: number; height: number };
  // Real rendered footprint (px, chairs included) — the editor passes its
  // to-scale footprint; tests pass a stub.
  footprintOf: (t: EventTableRow) => { w: number; h: number };
};

// Deterministic stage-out grid: rows parallel to the stage, filled centre-out,
// highest-priority table types nearest the stage. The sweetheart table is
// pinned front-and-centre. Rows step away from the stage; slots skip the
// dance floor and stop at the booth perimeter band (tables live in 10–90%,
// booths own the outer ring). Pure — returns ONLY the new position map.
export function computeAutoLayout(input: AutoLayoutInput): Record<string, { x: number; y: number }> {
  const { tables, floorPlan: fp, rect, footprintOf } = input;
  if (tables.length === 0 || rect.width <= 0 || rect.height <= 0) return {};

  // Stage-out axis, snapped to the dominant direction toward the room centre —
  // axis-aligned rows read as the "coordinate grid" the floor plan wants.
  const dx = 50 - fp.stage_x;
  const dy = 50 - fp.stage_y;
  const u: { x: number; y: number } =
    Math.abs(dy) >= Math.abs(dx) ? { x: 0, y: dy >= 0 ? 1 : -1 } : { x: dx >= 0 ? 1 : -1, y: 0 };
  const v = { x: u.y, y: u.x }; // row direction, perpendicular to u

  const pctW = (px: number) => (px / rect.width) * 100;
  const pctH = (px: number) => (px / rect.height) * 100;
  // Footprint of t in percent, projected on the u (depth) / v (row) axes.
  const depthOf = (t: EventTableRow) => {
    const f = footprintOf(t);
    return u.x === 0 ? pctH(f.h) : pctW(f.w);
  };
  const breadthOf = (t: EventTableRow) => {
    const f = footprintOf(t);
    return u.x === 0 ? pctW(f.w) : pctH(f.h);
  };

  // Table priority order for the layout: sweetheart (couple) right at the
  // stage, then the family/sponsor head tables, rounds, banquets, serpentines.
  // Stable within a type (sort_order, then label, then id) → reruns agree.
  const TYPE_RANK: Record<TableShapeHint, number> = {
    sweetheart: 0,
    family_head: 1,
    round: 2,
    long_banquet: 3,
    serpentine: 4,
  };
  const ordered = [...tables].sort((a, b) => {
    const ra = TYPE_RANK[shapeHintFor(a.table_type)];
    const rb = TYPE_RANK[shapeHintFor(b.table_type)];
    return (
      ra - rb ||
      a.sort_order - b.sort_order ||
      a.table_label.localeCompare(b.table_label) ||
      a.table_id.localeCompare(b.table_id)
    );
  });

  // Stage front edge along u + breathing room.
  const stageHalfU = u.x === 0 ? fp.stage_h / 2 : fp.stage_w / 2;
  const stageFront =
    u.x === 0
      ? fp.stage_y + (u.y > 0 ? stageHalfU : -stageHalfU)
      : fp.stage_x + (u.x > 0 ? stageHalfU : -stageHalfU);
  const ROW_GAP = 4;
  const SLOT_GAP = 3;
  // Tables keep out of the outer ring — that band belongs to the booths.
  const LO = 10;
  const HI = 90;

  type NoTableRect = { x0: number; x1: number; y0: number; y1: number };
  const danceRect: NoTableRect | null = fp.dance_enabled
    ? {
        x0: fp.dance_x - fp.dance_w / 2,
        x1: fp.dance_x + fp.dance_w / 2,
        y0: fp.dance_y - fp.dance_h / 2,
        y1: fp.dance_y + fp.dance_h / 2,
      }
    : null;
  // The cocktail / waiting-area room is also a no-table zone (booths only).
  const cocktailRect: NoTableRect | null = fp.cocktail_enabled
    ? {
        x0: fp.cocktail_x - fp.cocktail_w / 2,
        x1: fp.cocktail_x + fp.cocktail_w / 2,
        y0: fp.cocktail_y - fp.cocktail_h / 2,
        y1: fp.cocktail_y + fp.cocktail_h / 2,
      }
    : null;
  const hitsRect = (rect: NoTableRect | null, cx: number, cy: number, t: EventTableRow) => {
    if (!rect) return false;
    const halfW = (u.x === 0 ? breadthOf(t) : depthOf(t)) / 2;
    const halfH = (u.x === 0 ? depthOf(t) : breadthOf(t)) / 2;
    return (
      cx + halfW > rect.x0 && cx - halfW < rect.x1 && cy + halfH > rect.y0 && cy - halfH < rect.y1
    );
  };
  // Return whichever no-table zone a candidate centre lands in (dance first,
  // then cocktail), or null when clear.
  const blockingRect = (cx: number, cy: number, t: EventTableRow): NoTableRect | null => {
    if (hitsRect(danceRect, cx, cy, t)) return danceRect;
    if (hitsRect(cocktailRect, cx, cy, t)) return cocktailRect;
    return null;
  };

  const out: Record<string, { x: number; y: number }> = {};
  const rowAnchor = u.x === 0 ? fp.stage_x : fp.stage_y; // rows centre on the stage axis
  let cursor = 0; // index into `ordered`
  let depth = stageFront + (u.x !== 0 ? 0 : 0); // set per-row below
  let rowStart = stageFront;

  while (cursor < ordered.length) {
    // Row depth = the tallest table that will sit in it (measured greedily on
    // the next batch) — step the row line out by half of that plus the gap.
    const rowTables: EventTableRow[] = [];
    let rowDepth = 0;
    // Greedy fill: how many of the upcoming tables fit across the room width?
    let used = 0;
    const roomBreadth = HI - LO;
    for (let i = cursor; i < ordered.length; i++) {
      const t = ordered[i]!;
      const w = breadthOf(t) + SLOT_GAP;
      if (rowTables.length > 0 && used + w > roomBreadth) break;
      rowTables.push(t);
      used += w;
      rowDepth = Math.max(rowDepth, depthOf(t));
    }
    const rowSign = u.x === 0 ? u.y : u.x;
    depth = rowStart + rowSign * (ROW_GAP + rowDepth / 2);
    // Clamp the row inside the playable band; once we run off the far edge,
    // keep stacking on the last legal line (a packed room beats a lost table).
    const depthClamped = Math.max(LO, Math.min(HI, depth));

    // Centre-out slotting: first table on the stage axis, then alternate
    // right/left, each consuming its own breadth.
    let right = 0; // edge offset already used on the + side
    let left = 0;
    for (let k = 0; k < rowTables.length; k++) {
      const t = rowTables[k]!;
      const w = breadthOf(t) + SLOT_GAP;
      let offset: number;
      if (k === 0) {
        offset = 0;
        right = w / 2;
        left = w / 2;
      } else if (right <= left) {
        offset = right + w / 2;
        right += w;
      } else {
        offset = -(left + w / 2);
        left += w;
      }
      let cx = u.x === 0 ? rowAnchor + offset * v.x : depthClamped;
      let cy = u.x === 0 ? depthClamped : rowAnchor + offset * v.y;
      cx = Math.max(LO, Math.min(HI, cx));
      cy = Math.max(LO, Math.min(HI, cy));
      // A no-table zone (dance floor or cocktail room) in the way → push the
      // table one zone-width sideways (deterministic single rule; the editor's
      // nearestFree pass resolves any residual contact on render).
      const hitRect = blockingRect(cx, cy, t);
      if (hitRect) {
        const push = hitRect.x1 - hitRect.x0 + breadthOf(t) / 2;
        const cand = u.x === 0 ? cx + push : cx;
        const candY = u.x === 0 ? cy : cy + push;
        if (cand <= HI && candY <= HI && !blockingRect(cand, candY, t)) {
          cx = Math.max(LO, Math.min(HI, cand));
          cy = Math.max(LO, Math.min(HI, candY));
        }
      }
      out[t.table_id] = { x: cx, y: cy };
    }
    rowStart = depthClamped + rowSign * (rowDepth / 2);
    cursor += rowTables.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Serpentine chaining (owner-directed 2026-06-13: "the ends of the table must
// be able to snap together"). The 2026-05-09 serpentine lock always intended
// wedges to chain into an S / circle / oval; this is the magnetic snap that
// makes the connection real. Pure px-space math — the editor feeds it world-
// layer pixel centres and applies the returned position + rotation.
//
// A wedge has two radial end edges (at ±sweep/2). Another wedge can attach to
// an end in exactly two tangent-continuous ways, and BOTH are pure rotations
// of the anchor wedge (no mirroring needed — the wedge is symmetric):
//   · continue the circle — rotate the anchor by ±sweep about its arc centre
//   · S-bend — rotate the anchor 180° about the end-edge midpoint
// Chairs need no special handling: each wedge's chairs are inset from its
// ends (outer 0.18 rad / inner 0.36 rad), so when the tips meet flush the
// chairs flow around the joint without colliding, and they already rotate
// with the wedge.
// ---------------------------------------------------------------------------

export const SERPENTINE_SWEEP_DEG = 104;
const SERP_RI = 80;
const SERP_RO = 120;

// The wedge's local frame (box-centre origin, y-down — identical numbers to
// tableGeometry's serpentine branch): arc centre + the two end-edge midpoints.
export function serpentineFrame(): { centre: SeatSlot; endPlus: SeatSlot; endMinus: SeatSlot } {
  const s = (SERPENTINE_SWEEP_DEG * Math.PI) / 180;
  // Outline extremes: outer-arc apex at φ=0 (minY) and the inner-arc ends at
  // φ=±s/2 (maxY) — the recentre offset tableGeometry applies.
  const minY = -SERP_RO;
  const maxY = -SERP_RI * Math.cos(s / 2);
  const oy = (minY + maxY) / 2;
  const rm = (SERP_RI + SERP_RO) / 2;
  const end = (sign: 1 | -1): SeatSlot => ({
    x: sign * rm * Math.sin(s / 2),
    y: -rm * Math.cos(s / 2) - oy,
  });
  return { centre: { x: 0, y: -oy }, endPlus: end(1), endMinus: end(-1) };
}

// World-space end-edge midpoints of a wedge at centre (x,y) px, rotation deg,
// render scale — for the editor and for tests to verify tips really touch.
export function serpentineEndsWorld(w: {
  x: number;
  y: number;
  rot: number;
  scale: number;
}): SeatSlot[] {
  const f = serpentineFrame();
  return [f.endPlus, f.endMinus].map((e) => {
    const r = rotatePoint({ x: e.x * w.scale, y: e.y * w.scale }, w.rot);
    return { x: w.x + r.x, y: w.y + r.y };
  });
}

// Magnetic end-to-end snap: given the dragged wedge's candidate centre (px)
// and every OTHER serpentine on the floor, return the closest legal chained
// placement (position + rotation) within tolerance, or null to drag free.
// 4 candidates per neighbour: continue-the-circle past either end, or S-bend
// off either end. Deterministic: nearest candidate wins; ties keep the first.
export function serpentineChainSnap(
  dragPx: { x: number; y: number },
  neighbours: Array<{ x: number; y: number; rot: number; scale: number }>,
  tolPx = 36,
): { x: number; y: number; rot: number } | null {
  const f = serpentineFrame();
  const norm = (d: number) => ((d % 360) + 360) % 360;
  let best: { x: number; y: number; rot: number } | null = null;
  let bestD = tolPx * tolPx;
  const consider = (c: { x: number; y: number; rot: number }) => {
    const d = (c.x - dragPx.x) ** 2 + (c.y - dragPx.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  };
  for (const b of neighbours) {
    const cLocal = rotatePoint({ x: f.centre.x * b.scale, y: f.centre.y * b.scale }, b.rot);
    const cw = { x: b.x + cLocal.x, y: b.y + cLocal.y }; // arc centre, world px
    // Continue the circle: the anchor rotated ±sweep about its arc centre.
    for (const sgn of [1, -1] as const) {
      const r = rotatePoint({ x: b.x - cw.x, y: b.y - cw.y }, sgn * SERPENTINE_SWEEP_DEG);
      consider({ x: cw.x + r.x, y: cw.y + r.y, rot: norm(b.rot + sgn * SERPENTINE_SWEEP_DEG) });
    }
    // S-bend: the anchor rotated 180° about an end-edge midpoint.
    for (const end of [f.endPlus, f.endMinus]) {
      const eLocal = rotatePoint({ x: end.x * b.scale, y: end.y * b.scale }, b.rot);
      const m = { x: b.x + eLocal.x, y: b.y + eLocal.y };
      consider({ x: 2 * m.x - b.x, y: 2 * m.y - b.y, rot: norm(b.rot + 180) });
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Rect + round chaining (owner follow-up 2026-06-13: "the long table should
// also connect and the round tables"). Same magnetic model as the serpentine
// snap, with shape-appropriate joints:
//   · long banquet / family head — ends snap FLUSH and collinear, forming one
//     continuous run. Chairs sit only on the long edges (never the ends, each
//     column inset half a chair-gap from its end), so a flush seam reads as
//     one uninterrupted chair line — the seam columns sit exactly one
//     chair-gap apart, the same spacing as within a single table.
//   · round — snaps to a "kiss": centres pulled to the exact distance where
//     the two chair rings (plus the collision gap) just clear, so clustered
//     rounds look connected without any chair overlap, and the resolver
//     never shoves them apart on reload.
// ---------------------------------------------------------------------------

// End-to-end snap for the rectangular runs. halfLen = half the TABLETOP
// length (hub.w/2 × render scale) — the chair overhang is excluded so the
// tabletops join flush. The joined table adopts the anchor's orientation.
export function rectChainSnap(
  dragPx: { x: number; y: number },
  halfLenA: number,
  neighbours: Array<{ x: number; y: number; rot: number; halfLen: number }>,
  tolPx = 36,
): { x: number; y: number; rot: number } | null {
  let best: { x: number; y: number; rot: number } | null = null;
  let bestD = tolPx * tolPx;
  for (const b of neighbours) {
    const dir = rotatePoint({ x: 1, y: 0 }, b.rot); // the run axis
    for (const sgn of [1, -1] as const) {
      const off = sgn * (b.halfLen + halfLenA);
      const cand = { x: b.x + dir.x * off, y: b.y + dir.y * off, rot: ((b.rot % 360) + 360) % 360 };
      const d = (cand.x - dragPx.x) ** 2 + (cand.y - dragPx.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = cand;
      }
    }
  }
  return best;
}

// Breathing room added to a round-table kiss so the snapped distance stays
// just OUTSIDE the editor's collision threshold (footprints + 10px gap) —
// a kissed pair must survive the mount-time resolver untouched.
export const ROUND_KISS_GAP = 11;

// Edge-to-edge snap for round tables: pull the dragged centre onto the line
// of centres at kiss distance. radius = footprint box half-width (chair ring
// + pad, scaled), so chairs clear by construction. Direction is preserved —
// the couple chooses WHERE around the anchor the table sits.
export function roundKissSnap(
  dragPx: { x: number; y: number },
  radiusA: number,
  neighbours: Array<{ x: number; y: number; radius: number }>,
  tolPx = 36,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = tolPx * tolPx;
  for (const b of neighbours) {
    const dx = dragPx.x - b.x;
    const dy = dragPx.y - b.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue; // dropped dead-centre — no direction to kiss along
    const kiss = radiusA + b.radius + ROUND_KISS_GAP;
    const cand = { x: b.x + (dx / len) * kiss, y: b.y + (dy / len) * kiss };
    const d = (cand.x - dragPx.x) ** 2 + (cand.y - dragPx.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = cand;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Atomic swap logic (iteration 0008 · 3D lab). These pure functions mirror,
// on the client, exactly what the DB RPCs swap_seat_assignments /
// swap_table_assignments do server-side, so the two can be kept in lock-step
// and unit-pinned. They compute the FINAL (table_id, seat_number) each affected
// guest should end up with — the server transaction is what actually persists it
// atomically (and the physical-chair unique index is what guarantees no two
// guests share a chair). The NULL-park intermediate the RPCs use is an
// implementation detail of staying inside the un-deferrable index; the OBSERVED
// end state is exactly what these functions return.
// ---------------------------------------------------------------------------

export type SeatPlacement = { tableId: string; seatNumber: number | null };

// Exchange the (table_id, seat_number) of two guests. Returns the resulting
// placement for each, or null if either guest has no assignment (matching the
// RPC, which raises in that case — the caller should treat null as "can't swap").
export function computeGuestSwap(
  assignments: ReadonlyArray<SeatAssignmentRow>,
  guestA: string,
  guestB: string,
): { a: SeatPlacement; b: SeatPlacement } | null {
  if (guestA === guestB) return null;
  const ra = assignments.find((r) => r.guest_id === guestA);
  const rb = assignments.find((r) => r.guest_id === guestB);
  if (!ra || !rb) return null;
  // A takes B's chair; B takes A's chair.
  return {
    a: { tableId: rb.table_id, seatNumber: rb.seat_number },
    b: { tableId: ra.table_id, seatNumber: ra.seat_number },
  };
}

// Swap every occupant between two tables: each guest keeps their seat_number,
// only their table_id flips A<->B. Assignments on other tables are untouched.
// Returns { guest_id → new placement } for just the guests that moved.
export function computeTableSwap(
  assignments: ReadonlyArray<SeatAssignmentRow>,
  tableA: string,
  tableB: string,
): Map<string, SeatPlacement> {
  const out = new Map<string, SeatPlacement>();
  if (tableA === tableB) return out;
  for (const r of assignments) {
    if (r.table_id === tableA) {
      out.set(r.guest_id, { tableId: tableB, seatNumber: r.seat_number });
    } else if (r.table_id === tableB) {
      out.set(r.guest_id, { tableId: tableA, seatNumber: r.seat_number });
    }
  }
  return out;
}
