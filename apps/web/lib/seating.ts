import type { SupabaseClient } from '@supabase/supabase-js';
import { isBookable, isPubliclyVisible, parseVisibility } from './vendor-visibility';
// Iteration 0053 Phase 2: the wedding seating-tier data now lives in
// lib/role-sets.ts (single source). We import WEDDING_ROLE_SET as the DEFAULT
// for every tier classifier so un-threaded callers behave exactly as before;
// the RoleSet type is imported type-only so there is no runtime import cycle.
import { WEDDING_ROLE_SET, type RoleSet } from './role-sets';

// ===========================================================================
// INVARIANT — Seat-plan coordinate contract (v2, 2026-07-16)
// (Seat_Plan_2D3D_Sync_Council_Verdict_2026-07-16 · § 2. The single statement
//  of record — ONE interpretation of the shared columns, consumed identically
//  by the List, the 2D Plan and the 3D Plan.)
//
//  1. `event_tables.x_pos / y_pos` = the table's visual-bbox CENTRE, as PERCENT
//     of the ROOM BOX — x = % of room width (m), y = % of room length (m).
//     Top-left origin; +x east/right; +y south/down ≡ 3D +z (NO y-flip).
//     Values may exceed 0–100 (free auto-grow); the server clamp −300..900 is
//     unchanged.
//  2. The room box ALWAYS has metre dimensions: `venue_width_m × venue_length_m`
//     when both set and > 0, else `DEFAULT_ROOM_M = {w:20, d:30}`. The room box
//     is the coordinate DENOMINATOR and is NEVER content-dependent — auto-grow
//     is a viewport/display concern (`contentBoundsM`), never a change to what a
//     percent means.
//  3. `rotation_deg` = degrees CLOCKWISE in the y-down plan view; 3D applies
//     `rotation.y = −deg·π/180` (`rotationWorldY`). ONE conversion site.
//  4. Body geometry is ONE metric family: local px geometry from
//     `tableGeometry(type, capacity)` uniformly scaled by
//     `TABLE_FOOTPRINT_M[type] / geo.box.w` (`metricGeometry` — the ONLY body
//     source). Serpentine canonical (cap ≥ 2): Ri≈0.789 m · Ro≈1.183 m · tip
//     rm≈0.986 m · sweep 104° · bbox≈1.864 m · S-bend centre≈1.618 m ·
//     continue-circle≈1.314 m.
//  5. Rows with NULL x/y get client-only homes from ONE shared resolver
//     (`resolveHomePcts`); homes are NEVER persisted.
//  6. Percent↔world: `x_m = (xPct/100 − 0.5)·room.w`, `z_m = (yPct/100 − 0.5)·
//     room.d`, and its exact inverse (`pctToWorldM` / `worldToPctM`). Nothing
//     else converts.
// ===========================================================================

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

// Read-time coordinate/capacity healing (Sync verdict § 4 + render-crash guard
// c, 2026-07-16). A malformed persisted row — NaN/Infinity coords from a bad
// legacy write, an absurd out-of-clamp position, a non-integer/non-positive
// capacity — must render DEGRADED, never crash a `useMemo`/`new Array(n)`
// between hooks (React #310). These NEVER force-rearrange a valid saved room:
// a finite in-range coord is returned verbatim, only genuinely broken values
// heal. A NaN coord becomes NULL → the row falls to a resolved grid home
// (`resolveHomePcts`) instead of projecting to NaN world metres.
export function sanitizePersistedCoord(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null; // NaN/±Infinity → unplaced (resolved home)
  return Math.max(-300, Math.min(900, n)); // absurd → the server safety clamp
}
// `new Array(capacity)` throws RangeError on a negative/fractional value and
// OOMs on an absurd one — occupantsFor + every seat-array path depend on a sane
// integer. Real tables are ≤ 16 seats; anything past 100 is a broken row.
export function sanitizeCapacity(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, 100);
}

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
  // removed-seats migration is applied (the columns just read as 0 / []), plus
  // read-time coord/capacity healing so a malformed row degrades, never crashes.
  return (data ?? []).map((t) => {
    const r = t as EventTableRow;
    return {
      ...r,
      capacity: sanitizeCapacity(r.capacity),
      x_pos: sanitizePersistedCoord(r.x_pos),
      y_pos: sanitizePersistedCoord(r.y_pos),
      rotation_deg: Number.isFinite(Number(r.rotation_deg)) ? (r.rotation_deg ?? 0) : 0,
      removed_seats: r.removed_seats ?? [],
      qr_token: r.qr_token ?? '',
      qr_published_at: r.qr_published_at ?? null,
      link_group_id: r.link_group_id ?? null,
      link_group_label: r.link_group_label ?? null,
    };
  });
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
/**
 * Phase 6 (gap G8): the event's group-overflow adjacency preference. Defaults to
 * ON — only an explicit FALSE (`events.seating_group_adjacency`) reverts a couple
 * to the classic stage-ranked fill. Shared by the reactive reconcile path and the
 * couple-triggered Auto-Arrange so the toggle is honored consistently.
 */
export async function fetchGroupAdjacency(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('events')
    .select('seating_group_adjacency')
    .eq('event_id', eventId)
    .maybeSingle();
  return (
    (data as { seating_group_adjacency?: boolean | null } | null)?.seating_group_adjacency !== false
  );
}

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
  // Main-entrance geometry (migration 20270717284319): 'door' = a shallow
  // doorway (default) · 'tunnel' = a deeper WALK-THROUGH (UI-labelled
  // "Walk-through" — the schema keeps the value 'tunnel'), back flush to the
  // nearest wall, opening inward by entrance_depth_m metres.
  entrance_kind: 'door' | 'tunnel';
  entrance_depth_m: number;
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
  entrance_kind: 'door',
  entrance_depth_m: 3,
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
      'stage_x,stage_y,stage_w,stage_h,entrance_enabled,entrance_x,entrance_y,entrance_kind,entrance_depth_m,dance_enabled,dance_x,dance_y,dance_w,dance_h,service_entrance_enabled,service_entrance_x,service_entrance_y,cocktail_enabled,cocktail_x,cocktail_y,cocktail_w,cocktail_h,cocktail_label,cocktail_width_m,cocktail_length_m,cocktail_schedule_block_id,cocktail_vendor_edit,cocktail_linked,venue_width_m,venue_length_m,published_at,priority_order,venue_photo_visibility',
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
    // Degrade any unknown/missing kind (e.g. a not-yet-migrated row) → 'door'.
    entrance_kind: data.entrance_kind === 'tunnel' ? 'tunnel' : 'door',
    entrance_depth_m: num(data.entrance_depth_m, D.entrance_depth_m),
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

// Side-of-wedding fallback color for a guest who belongs to no custom group.
// The canonical side-colour language now lives in lib/side-colors.ts (SIDE_HEX)
// — the ONE map consumed by BOTH the seat map and the Guests roster so a guest
// reads the same colour everywhere. Re-exported under the historical name for
// this file's existing importer; SIDE_HEX carries the solid (non-CSS-var) hex
// the inline SVG chairs need.
export { SIDE_HEX as SIDE_COLORS } from './side-colors';

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
  // Phase 6 (gap G8): group-overflow adjacency. TRUE (default) spills a group's
  // overflow to the nearest table by floor coordinates; FALSE reverts to the
  // classic stage-ranked fill (the couple's per-event opt-out).
  groupAdjacency: boolean = true,
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

  // Smart seat-plan · Phase 6 — group-overflow ADJACENCY. A custom group's first
  // member takes the stage-nearest free table (VIP weighting preserved); when the
  // group overflows that table, the rest spill onto the table nearest BY FLOOR
  // COORDINATES to the group's anchor — not the next stage-ranked table, which can
  // be across the room. Ungrouped guests keep the pure stage-ranked fill, so this
  // is a strict superset (no behaviour change without custom groups). Deterministic:
  // ties break on pool (stage) order.
  const pointById = new Map<string, { x: number; y: number }>();
  tables.forEach((t, i) => pointById.set(t.table_id, tablePoint(t, i, tables.length)));
  const dist2 = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  };
  const groupAnchor = new Map<string, string>();

  const result: AutoSeatRow[] = [];
  for (const g of ordered) {
    let table: EventTableRow | undefined;
    const anchorId = groupAdjacency && g.group_id ? groupAnchor.get(g.group_id) : undefined;
    if (anchorId) {
      // Nearest free table to the group's anchor (the anchor itself while it has
      // room, then its physical neighbours). Ties fall back to stage order.
      const anchorPt = pointById.get(anchorId);
      let bestD = Infinity;
      for (const t of pool) {
        if ((freeCount.get(t.table_id) ?? 0) <= 0) continue;
        const d = anchorPt ? dist2(pointById.get(t.table_id)!, anchorPt) : 0;
        if (d < bestD) {
          bestD = d;
          table = t;
        }
      }
    }
    if (!table) table = pool.find((t) => (freeCount.get(t.table_id) ?? 0) > 0);
    if (!table) break; // pool exhausted — remaining guests stay unseated
    const occ = occupied.get(table.table_id)!;
    let seat = 0;
    while (occ.has(seat)) seat++;
    occ.add(seat);
    freeCount.set(table.table_id, (freeCount.get(table.table_id) ?? 0) - 1);
    // Anchor the group on the first table one of its members lands on.
    if (g.group_id && !groupAnchor.has(g.group_id)) {
      groupAnchor.set(g.group_id, table.table_id);
    }
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
  // Phase 6 (gap G8): group-overflow adjacency, threaded to the warm start.
  groupAdjacency?: boolean;
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
    groupAdjacency = true,
  } = input;

  // Warm start (priority + stage aware; ignores constraints). No rules → done.
  const warm = computeAutoSeat(tables, guests, assignments, stage, priorityOrder, roleSet, groupAdjacency);
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
// Smart seat-plan · Phase 5 — LIVE PROVISIONAL SEATING (guest-reactive).
// Keeps the plan in sync with the guest list without the couple pressing
// Auto-Arrange: every non-declined guest holds a provisional (unlocked) seat if
// capacity exists, and a guest whose seating-relevant fields changed (role /
// group / priority / +1) can be re-placed next to their new tier/group.
//
// Pure + deterministic — reuses computeAutoSeat / solveSeatPlan (so Phase 2
// priority, Phase 3 keep-apart, and group/+1 clustering all carry through) and
// returns a DELTA the caller applies:
//   • assign   — seat rows to UPSERT (event_seat_assignments UNIQUE(event,guest)
//                makes each a replace; covers new adds AND re-placed guests)
//   • release  — guest_ids whose stale row must be DELETED (only when a vacated
//                seat got reused and the guest couldn't be re-placed — rare)
//   • needsTable — eligible guests left with no seat (drives "add a table")
//
// Invariants: a LOCKED (Phase 4) seat is never touched — an explicit pin beats
// group-togetherness. A guest who currently has a seat is never stranded: if a
// re-seat can't be improved, the original seat is restored. Newly-added
// (unseated) guests are always gap-filled regardless of `reseatGuestIds`.
// ---------------------------------------------------------------------------
export type ReconcileInput = {
  tables: EventTableRow[];
  /** Non-declined guests for the event. */
  guests: AutoSeatGuest[];
  /** Current seat rows — the `locked` flag is honored. */
  assignments: SeatAssignmentRow[];
  /** Phase 3 keep-apart rules (optional; routes placement through solveSeatPlan). */
  constraints?: KeepApartRule[];
  /** guest_id → custom group_ids, for group-aware keep-apart expansion. */
  groupMembers?: Map<string, string[]>;
  priorityOrder?: PriorityOrder | null;
  stage?: { x: number; y: number };
  roleSet?: RoleSet;
  /**
   * Already-seated guests to RE-PLACE because a seating-relevant field changed.
   * Only their UNLOCKED seat is vacated. Include a guest's +1 alongside them so
   * the pair stays together. New/unseated guests are gap-filled regardless.
   */
  reseatGuestIds?: Iterable<string>;
  /** Phase 6 (gap G8): group-overflow adjacency; default TRUE. */
  groupAdjacency?: boolean;
};

export type ReconcileResult = {
  assign: AutoSeatRow[];
  release: string[];
  needsTable: string[];
};

export function reconcileProvisionalSeats(input: ReconcileInput): ReconcileResult {
  const {
    tables,
    guests,
    assignments,
    priorityOrder = null,
    stage = STAGE_POINT,
    roleSet = WEDDING_ROLE_SET,
    groupAdjacency = true,
  } = input;
  const constraints = input.constraints ?? [];
  const reseat = new Set(input.reseatGuestIds ?? []);

  // Locked seats are immovable — a pin beats group-togetherness.
  const lockedGuestIds = new Set(
    assignments.filter((a) => a.locked).map((a) => a.guest_id),
  );
  // Seats we may vacate: unlocked seats of guests flagged for re-placement.
  const vacate = assignments.filter(
    (a) => !a.locked && reseat.has(a.guest_id) && !lockedGuestIds.has(a.guest_id),
  );
  const vacateIds = new Set(vacate.map((a) => a.guest_id));
  // Fixed occupancy = everything except the vacated seats. Newly-added guests
  // aren't in `assignments`, so computeAutoSeat/solveSeatPlan seat them here too.
  const kept = assignments.filter((a) => !vacateIds.has(a.guest_id));

  const placed =
    constraints.length > 0
      ? solveSeatPlan({
          tables,
          guests,
          assignments: kept,
          stage,
          priorityOrder,
          constraints,
          groupMembers: input.groupMembers,
          roleSet,
          groupAdjacency,
        }).assignments
      : computeAutoSeat(tables, guests, kept, stage, priorityOrder, roleSet, groupAdjacency);

  const placedIds = new Set(placed.map((r) => r.guest_id));
  const takenSeat = new Set(placed.map((r) => `${r.table_id}#${r.seat_number}`));

  // A vacated guest not re-placed: restore their original seat if it's still
  // free (never strand a guest who had a seat); else their row must be deleted
  // so the seat someone else took isn't double-booked.
  const restore: AutoSeatRow[] = [];
  const release: string[] = [];
  for (const a of vacate) {
    if (placedIds.has(a.guest_id)) continue; // re-placed → upsert replaces old row
    if (a.seat_number !== null && !takenSeat.has(`${a.table_id}#${a.seat_number}`)) {
      restore.push({ guest_id: a.guest_id, table_id: a.table_id, seat_number: a.seat_number });
    } else {
      release.push(a.guest_id);
    }
  }

  const assign = [...placed, ...restore];

  const seatedNow = new Set<string>([
    ...kept.map((a) => a.guest_id),
    ...assign.map((r) => r.guest_id),
  ]);
  const needsTable = guests
    .filter(
      (g) =>
        g.rsvp_status !== 'declined' &&
        !roleSet.coupleRoles.has(g.role) &&
        !seatedNow.has(g.guest_id),
    )
    .map((g) => g.guest_id);

  return { assign, release, needsTable };
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

// Next auto-increment default name for a new table: the smallest positive
// integer N not already used by an existing "Table N" label. Custom names
// (anything that isn't exactly "Table <number>") are ignored, so a floor of
// "Sponsors 1" + "Table 2" still suggests "Table 1". Fills gaps — deleting
// "Table 2" from {1,2,3} makes the next suggestion "Table 2" again. This is the
// fix for the "six tables all named Table 5" bug: the add-table form seeds this
// as its default instead of leaving the field blank (so rapid adds increment).
export function nextTableName(existing: ReadonlyArray<string | null | undefined>): string {
  const used = new Set<number>();
  for (const raw of existing) {
    const m = /^Table\s+(\d+)$/i.exec((raw ?? '').trim());
    if (m) {
      const n = Number.parseInt(m[1]!, 10);
      if (Number.isSafeInteger(n) && n > 0) used.add(n);
    }
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `Table ${n}`;
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
  // Vendor-run stations added 2026-07-04 (3D-Plan booths, migration
  // 20270511347133): a band/stage, a live-COOKING action station, and a
  // live-PERFORMANCE (acoustic act) spot — each with its own 3D silhouette.
  | 'band'
  | 'live_cooking'
  | 'live_performance'
  | 'custom'
  // A blank pin the couple has placed but not yet typed (place-then-pick).
  | 'unassigned';

// The pickable kinds shown in the booth type picker — 'unassigned' is the
// pre-pick state and is deliberately NOT offered as a choice.
export const BOOTH_CATALOG: ReadonlyArray<{ type: Exclude<BoothType, 'unassigned'>; label: string }> = [
  { type: 'photo_booth', label: 'Photo Booth' },
  { type: 'mobile_bar', label: 'Mobile Bar' },
  { type: 'live_cooking', label: 'Live Cooking' },
  { type: 'dessert_station', label: 'Dessert Station' },
  { type: 'band', label: 'Band / Stage' },
  { type: 'live_performance', label: 'Live Performance' },
  { type: 'gift_table', label: 'Gift Table' },
  { type: 'souvenir_table', label: 'Souvenir Table' },
  { type: 'registration_desk', label: 'Front Desk' },
  { type: 'custom', label: 'Custom booth' },
];

// --- vendor presence / Setnayan promotion (owner directive 2026-07-16) -------
// A booth is a PRESENCE SLOT: it shows a FINALIZED (booked/locked) vendor when
// one is assigned (event_vendor_id → a BOOKED_VENDOR_STATUSES event_vendors row,
// enforced server-side by nullOutForeignBoothVendors), and defaults to SETNAYAN
// promotion otherwise. This is the 3D Booth Ads inventory seam — the default is
// data-driven so future ad inventory swaps in without touching the render layer.

/** The brand string shown on any booth/slot with NO finalized vendor — the 3D
 *  Setnayan-promotion default + the 2D blueprint marker's "otherwise" label.
 *  Kept as a single constant so 2D + 3D never drift. Brand spelling per
 *  CLAUDE.md (full "SETNAYAN", never "STNYN"). */
export const SETNAYAN_BOOTH_PROMO_LABEL = 'SETNAYAN';

/**
 * The presence label for a booth slot: a FINALIZED vendor's name when the booth
 * is assigned one, else the Setnayan-promotion default. Pure + data-driven so
 * the 2D marker and the 3D booth sign resolve identically from the same room
 * doc (no divergence — owner alignment directive). The blank pre-pick pin
 * (booth_type === 'unassigned') is an EDITOR affordance, not a presence slot, so
 * callers handle its "Pick type" prompt separately and never pass it here.
 */
export function boothPresenceLabel(
  booth: { event_vendor_id: string | null; label: string },
): string {
  return booth.event_vendor_id ? booth.label : SETNAYAN_BOOTH_PROMO_LABEL;
}

/**
 * Coarse map from a booked vendor's canonical category → the booth's 2D icon +
 * PR1 footprint. Deliberately coarse: the 3D venue walk resolves the booth's
 * silhouette from the LINKED vendor's category (fetchBooths joins it), so this
 * only picks the 2D marker icon and the geometry-rule footprint. Anything
 * without an obvious station falls to 'custom' (a generic booth marker). `category`
 * is typed loosely (string) so callers don't have to import VendorCategory.
 */
export function boothTypeForVendorCategory(category: string): Exclude<BoothType, 'unassigned'> {
  switch (category) {
    case 'photobooth':
      return 'photo_booth';
    case 'mobile_bar':
      return 'mobile_bar';
    case 'catering':
      return 'live_cooking';
    case 'cake_maker':
      return 'dessert_station';
    case 'band_dj':
    case 'string_quartet':
    case 'choir':
      return 'band';
    case 'host_emcee':
      return 'live_performance';
    case 'gifts_and_giveaways':
      return 'souvenir_table';
    default:
      return 'custom';
  }
}

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
  vendor?: {
    vendor_name: string;
    category: string;
    logo_url: string | null;
    // The vendor's subscription tier — gates 3D booth logo branding to
    // pro / enterprise (boothCanBrand). Null when the join is absent.
    tier: string | null;
    // Marketplace profile slug (/v/[slug]) — null unless the linked profile is
    // publicly visible (isPubliclyVisible), so a hidden/archived vendor never
    // leaks a profile link onto a booth card.
    slug: string | null;
    // Whether the profile can take bookings (isBookable — 'verified' only).
    // Gates the booth card's "Book this vendor" CTA wording per the
    // owner-locked surface-D contract; a coming_soon profile keeps its slug
    // (the profile page is publicly visible) but is NOT bookable.
    bookable: boolean;
  } | null;
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
        'event_vendors(vendor_name,category,vendor_profiles!marketplace_vendor_id(logo_url,tier_state,business_slug,public_visibility))',
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
  type VP = {
    logo_url: string | null;
    tier_state: string | null;
    business_slug: string | null;
    public_visibility: string | null;
  } | null;
  type Joined = Omit<FloorBoothRow, 'vendor'> & {
    event_vendors:
      | { vendor_name: string; category: string; vendor_profiles: VP }
      | { vendor_name: string; category: string; vendor_profiles: VP }[]
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
        ? {
            vendor_name: ev.vendor_name,
            category: ev.category,
            logo_url: vp?.logo_url ?? null,
            tier: vp?.tier_state ?? null,
            slug: vp && isPubliclyVisible(parseVisibility(vp.public_visibility)) ? vp.business_slug ?? null : null,
            bookable: vp ? isBookable(parseVisibility(vp.public_visibility)) : false,
          }
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

// (Round tables are standalone furniture — owner 2026-07-16. The former
// "round kiss" snap is retired: two rounds never connect and always collide.)

// ---------------------------------------------------------------------------
// Footprint collision (owner-reported 2026-07-15: tables — rounds, serpentines —
// were rendering STACKED into each other, chair rings interpenetrating). The
// editor's footprint box (tableGeometry().box, scaled) already INCLUDES the
// chair ring — a round's box is the seat-ring diameter + pad, a serpentine's is
// the ribbon + its outer/inner chairs — so an axis-aligned box overlap is a true
// "chairs touch" collision, not just "tabletops touch". These pure predicates
// are the one source of truth the editor's drag/mount collision passes call, so
// the "a drop never persists an overlap" invariant is unit-pinned.
// ---------------------------------------------------------------------------

export type Box = { w: number; h: number };
export type Rect = { x: number; y: number; w: number; h: number };

// Do two centre-anchored axis-aligned footprints overlap, keeping `gap` clear
// between them? Same units throughout (the editor passes pixels). Because each
// box already spans its chair ring, this is the chair-inclusive collision test.
export function boxesOverlap(
  ax: number,
  ay: number,
  a: Box,
  bx: number,
  by: number,
  b: Box,
  gap = 0,
): boolean {
  return Math.abs(ax - bx) < (a.w + b.w) / 2 + gap && Math.abs(ay - by) < (a.h + b.h) / 2 + gap;
}

// Does a centre-anchored footprint overlap a centre-anchored zone rect (dance
// floor, cocktail room, booth) with `gap` clear? Same shape as boxesOverlap —
// a zone is just a box that isn't a table.
export function boxOverlapsRect(
  ax: number,
  ay: number,
  a: Box,
  zone: Rect,
  gap = 0,
): boolean {
  return boxesOverlap(ax, ay, a, zone.x, zone.y, { w: zone.w, h: zone.h }, gap);
}

// ---------------------------------------------------------------------------
// Sanctioned chain contact — the ONE overlap that is legal. Two same-family
// tables may touch only when their connection anchors coincide: serpentine end
// tips meeting (serpentineChainSnap's output), or banquet / family-head run ends
// joining flush (rectChainSnap's). Everything else — two serpentines merely
// shoved together mid-curve, two banquets crossing — is a real collision the
// editor must resolve. The join tolerance absorbs the %→px round-trip; a genuine
// body overlap puts the tips >100 px apart, far outside it.
// ---------------------------------------------------------------------------

export const SERP_JOIN_TOL_PX = 18;
export const RECT_JOIN_TOL_PX = 16;

type SerpPose = { x: number; y: number; rot: number; scale: number };
type RectPose = { x: number; y: number; rot: number; halfLen: number };

// Two serpentine wedges are in a sanctioned tip-join if any end-midpoint of one
// coincides (within tol px) with an end-midpoint of the other.
export function serpentinesJoined(a: SerpPose, b: SerpPose, tolPx = SERP_JOIN_TOL_PX): boolean {
  const ea = serpentineEndsWorld(a);
  const eb = serpentineEndsWorld(b);
  for (const p of ea) for (const q of eb) if (Math.hypot(p.x - q.x, p.y - q.y) <= tolPx) return true;
  return false;
}

// World-space end-face midpoints of a rectangular run (banquet / family head).
// halfLen = half the TABLETOP length (px) along the run axis.
export function rectEndsWorld(w: RectPose): SeatSlot[] {
  const dir = rotatePoint({ x: 1, y: 0 }, w.rot);
  return [
    { x: w.x + dir.x * w.halfLen, y: w.y + dir.y * w.halfLen },
    { x: w.x - dir.x * w.halfLen, y: w.y - dir.y * w.halfLen },
  ];
}

// Two rectangular runs are in a sanctioned flush join if an end face of one
// coincides (within tol px) with an end face of the other.
export function rectRunsJoined(a: RectPose, b: RectPose, tolPx = RECT_JOIN_TOL_PX): boolean {
  const ea = rectEndsWorld(a);
  const eb = rectEndsWorld(b);
  for (const p of ea) for (const q of eb) if (Math.hypot(p.x - q.x, p.y - q.y) <= tolPx) return true;
  return false;
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

// ===========================================================================
// THE PLACEMENT ORACLE (council verdict 2026-07-16 · one pure, testable model)
// ---------------------------------------------------------------------------
// Governing principle: there is exactly ONE placement oracle. Every mutation
// path in the editor (drag, snap, every rotate path, link, group move/rotate,
// Auto Arrange, server persist) validates through these pure helpers, and
// nothing persists a pose the oracle rejects. Sanctioned contact exists ONLY as
// same-`link_group_id` membership — the "weld" model (snap is link, link is
// rigid). The old distance-only join exemptions (serpentinesJoined /
// rectRunsJoined / SERP_JOIN_TOL_PX) are superseded: they were wider than the
// enforcement gap at real room scales and let X-crossed tips read as "joined".
//
// Geometry: rotation-aware oriented footprints (OBBs) with a SAT narrow-phase
// and an AABB/circumscribed-circle broad-phase prefilter. A round table is a
// circle; banquet / sweetheart / family-head are a single OBB; a serpentine
// wedge is a 3-OBB decomposition of its arc (a convex hull would overestimate
// the concave inner edge). All numbers are WORLD PIXELS at the editor scale.
// ===========================================================================

export type Vec2 = { x: number; y: number };

// A convex footprint primitive. `ax`/`ay` are unit axis vectors (rotated with
// the table); `hw`/`hh` the half-extents along them.
export type ConvexPart =
  | { kind: 'circle'; c: Vec2; r: number }
  | { kind: 'obb'; c: Vec2; ax: Vec2; ay: Vec2; hw: number; hh: number };

// A table's world footprint: one or more convex parts, plus a circumscribed
// broad-phase circle (centre + radius) for the cheap prefilter.
export type Footprint = { parts: ConvexPart[]; bc: { c: Vec2; r: number } };

// The minimum a pose must carry for the oracle to build its footprint. `scale`
// = world px per local geometry unit (footprintPx.w / tableGeometry().box.w),
// i.e. the same to-scale shrink the editor applies when rendering.
export type OraclePose = {
  shape: TableShapeHint;
  capacity: number;
  x: number; // world-px centre
  y: number;
  rot: number; // degrees, y-down clockwise (matches rotatePoint)
  scale: number;
};

// A pose the oracle can attribute a violation to / exempt by link membership.
export type WorldPose = OraclePose & { tableId: string; linkGroupId: string | null };

// A centre-anchored no-go rectangle (dance floor, cocktail room, booth, centre
// aisle) in world px. `id` labels violations; axis-aligned (rot 0).
// `sweetheartExempt` marks the STAGE platform: a table overlapping it is a
// violation UNLESS it's a sweetheart table (owner 2026-07-16 · shared oracle
// rule — the couple's table may sit on the stage; nothing else may).
export type OracleZone = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sweetheartExempt?: boolean;
};

// The stage platform expressed as a sweetheart-exempt no-go zone, in the world
// px of the caller's rect. Shared by BOTH projections (2D `zonesFor`, 3D
// `oracleZones`) and Auto Arrange so the "only a sweetheart on the stage" rule
// is enforced identically everywhere through `checkPlacement` — no 3D fork.
export function stageZone(
  fp: { stage_x: number; stage_y: number; stage_w: number; stage_h: number },
  rect: { width: number; height: number },
): OracleZone {
  return {
    id: 'stage',
    x: (fp.stage_x / 100) * rect.width,
    y: (fp.stage_y / 100) * rect.height,
    w: (fp.stage_w / 100) * rect.width,
    h: (fp.stage_h / 100) * rect.height,
    sweetheartExempt: true,
  };
}

// Sanctioned-join tolerance, METRIC (not px): end-midpoints must coincide
// within 5 cm and the rotation delta land on a legal joint angle (±3°). The
// 5 cm floor absorbs float drift in saved rotations (2 cm was too tight).
export const JOIN_TOL_M = 0.05;
export const JOIN_ROT_TOL_DEG = 3;

// --- vector helpers (local, pure) ------------------------------------------
function vdot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

// Unit axis vectors for a table rotated by `deg` (local x-axis → world).
function axesFor(deg: number): { ax: Vec2; ay: Vec2 } {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  // Same convention as rotatePoint: (x,y) → (x c − y s, x s + y c).
  return { ax: { x: c, y: s }, ay: { x: -s, y: c } };
}

// ---------------------------------------------------------------------------
// Serpentine local geometry — mirrors tableGeometry()'s serpentine branch so
// the oracle footprint lines up with the render exactly (chair-inclusive).
// ---------------------------------------------------------------------------
const SERP_CHAIR_GAP = CHAIR_PX / 2 + 4; // chairs sit this far past each arc edge
const SERP_RCO = SERP_RO + SERP_CHAIR_GAP; // outer chair radius
const SERP_RCI = SERP_RI - SERP_CHAIR_GAP; // inner chair radius
const SERP_R_OUT = SERP_RCO + CHAIR_PX / 2; // outer occupied radius (chair edge)
const SERP_R_IN = SERP_RCI - CHAIR_PX / 2; // inner occupied radius (chair edge)
// Recenter offset tableGeometry applies (box-centre origin): oy = (minY+maxY)/2
// where minY = −Ro (outer apex) and maxY = −Ri·cos(sweep/2) (inner ends).
const SERP_OY = (() => {
  const s = (SERPENTINE_SWEEP_DEG * Math.PI) / 180;
  return (-SERP_RO + -SERP_RI * Math.cos(s / 2)) / 2;
})();

// Build the 3-OBB decomposition of a serpentine wedge in LOCAL geometry px
// (box-centre origin, pre-scale, pre-rotate). Three angular slices of the
// [SERP_R_IN, SERP_R_OUT] radial band, each a box tangent to the arc — so the
// union hugs the curve and leaves the concave interior empty.
function serpLocalParts(): Array<{ c: Vec2; ax: Vec2; ay: Vec2; hw: number; hh: number }> {
  const s = (SERPENTINE_SWEEP_DEG * Math.PI) / 180;
  const rMid = (SERP_R_IN + SERP_R_OUT) / 2;
  const radialHalf = (SERP_R_OUT - SERP_R_IN) / 2;
  const sliceHalf = s / 6; // three slices → each spans s/3, half = s/6
  const tangHalf = SERP_R_OUT * Math.sin(sliceHalf) + CHAIR_PX / 2;
  const parts: Array<{ c: Vec2; ax: Vec2; ay: Vec2; hw: number; hh: number }> = [];
  for (let i = 0; i < 3; i++) {
    const phi = -s / 2 + (s * (i + 0.5)) / 3;
    const sinP = Math.sin(phi);
    const cosP = Math.cos(phi);
    // at(r, phi) = { x: r·sinφ, y: −r·cosφ }; then recenter by −oy on y.
    const c: Vec2 = { x: rMid * sinP, y: -rMid * cosP - SERP_OY };
    // radial (outward) axis = d/dr at(r,phi) = (sinφ, −cosφ); tangential ⟂.
    const ax: Vec2 = { x: sinP, y: -cosP }; // hw along radial band
    const ay: Vec2 = { x: cosP, y: sinP }; // hh along tangent
    parts.push({ c, ax, ay, hw: radialHalf, hh: tangHalf });
  }
  return parts;
}
const SERP_LOCAL_PARTS = serpLocalParts();

// Rotate+scale+translate a local unit vector's *direction* (scale is uniform so
// direction is preserved; we just rotate by the table angle).
function rotDir(v: Vec2, ax: Vec2, ay: Vec2): Vec2 {
  // world dir = v.x·ax + v.y·ay
  return { x: v.x * ax.x + v.y * ay.x, y: v.x * ax.y + v.y * ay.y };
}

// The oracle footprint of a table at a pose. Round → circle; banquet /
// sweetheart / family-head → single OBB; serpentine → 3-OBB arc decomposition.
export function obbOf(p: OraclePose): Footprint {
  const geo = tableGeometry(p.shape, Math.max(1, p.capacity));
  const s = p.scale;
  const { ax, ay } = axesFor(p.rot);
  const centre: Vec2 = { x: p.x, y: p.y };

  if (p.shape === 'round') {
    const r = (geo.box.w / 2) * s;
    return { parts: [{ kind: 'circle', c: centre, r }], bc: { c: centre, r } };
  }

  if (p.shape === 'serpentine') {
    const parts: ConvexPart[] = SERP_LOCAL_PARTS.map((lp) => {
      // world centre = tableCentre + rotate(scale·localCentre)
      const wax = rotDir(lp.ax, ax, ay);
      const way = rotDir(lp.ay, ax, ay);
      const local = rotatePoint({ x: lp.c.x * s, y: lp.c.y * s }, p.rot);
      return {
        kind: 'obb' as const,
        c: { x: p.x + local.x, y: p.y + local.y },
        ax: wax,
        ay: way,
        hw: lp.hw * s,
        hh: lp.hh * s,
      };
    });
    // Broad circle: enclose the whole wedge (outer occupied radius from the arc
    // centre, which sits below the box centre by |SERP_OY|·s).
    const bcR = (SERP_R_OUT + Math.abs(SERP_OY)) * s;
    return { parts, bc: { c: centre, r: bcR } };
  }

  // sweetheart / long_banquet / family_head → single OBB.
  const hw = (geo.box.w / 2) * s;
  const hh = (geo.box.h / 2) * s;
  const r = Math.hypot(hw, hh);
  return {
    parts: [{ kind: 'obb', c: centre, ax, ay, hw, hh }],
    bc: { c: centre, r },
  };
}

// A zone rect → a single axis-aligned OBB footprint.
function zoneFootprint(z: OracleZone): Footprint {
  const hw = z.w / 2;
  const hh = z.h / 2;
  const c = { x: z.x, y: z.y };
  return {
    parts: [{ kind: 'obb', c, ax: { x: 1, y: 0 }, ay: { x: 0, y: 1 }, hw, hh }],
    bc: { c, r: Math.hypot(hw, hh) },
  };
}

// --- SAT narrow-phase (penetration depth for the monotone-escape rule) ------
// Project an OBB's half-width onto axis n.
function obbProjHalf(
  part: { ax: Vec2; ay: Vec2; hw: number; hh: number },
  n: Vec2,
): number {
  return Math.abs(vdot(part.ax, n)) * part.hw + Math.abs(vdot(part.ay, n)) * part.hh;
}

// OBB vs OBB with a clearance `gap` (each inflated by gap/2). Returns the
// penetration depth (MTV magnitude) if they overlap, else null.
function obbObb(
  a: { c: Vec2; ax: Vec2; ay: Vec2; hw: number; hh: number },
  b: { c: Vec2; ax: Vec2; ay: Vec2; hw: number; hh: number },
  gap: number,
): number | null {
  const g = gap / 2;
  const A = { ...a, hw: a.hw + g, hh: a.hh + g };
  const B = { ...b, hw: b.hw + g, hh: b.hh + g };
  const d: Vec2 = { x: B.c.x - A.c.x, y: B.c.y - A.c.y };
  const axes = [A.ax, A.ay, B.ax, B.ay];
  let minOverlap = Infinity;
  for (const n of axes) {
    const len = Math.hypot(n.x, n.y) || 1;
    const un = { x: n.x / len, y: n.y / len };
    const overlap = obbProjHalf(A, un) + obbProjHalf(B, un) - Math.abs(vdot(d, un));
    if (overlap <= 0) return null; // separating axis found → clear
    if (overlap < minOverlap) minOverlap = overlap;
  }
  return minOverlap;
}

// OBB vs circle with clearance `gap`. Closest-point method (robust for the
// corner case). Returns penetration depth if overlapping, else null.
function obbCircle(
  a: { c: Vec2; ax: Vec2; ay: Vec2; hw: number; hh: number },
  circle: { c: Vec2; r: number },
  gap: number,
): number | null {
  const g = gap / 2;
  const hw = a.hw + g;
  const hh = a.hh + g;
  const r = circle.r + g;
  const d: Vec2 = { x: circle.c.x - a.c.x, y: circle.c.y - a.c.y };
  const lx = vdot(d, a.ax);
  const ly = vdot(d, a.ay);
  const clx = Math.max(-hw, Math.min(hw, lx));
  const cly = Math.max(-hh, Math.min(hh, ly));
  const inside = Math.abs(lx) <= hw && Math.abs(ly) <= hh;
  if (inside) {
    // Circle centre inside the box → deep penetration.
    return r + Math.min(hw - Math.abs(lx), hh - Math.abs(ly));
  }
  const dx = lx - clx;
  const dy = ly - cly;
  const dist = Math.hypot(dx, dy);
  if (dist >= r) return null;
  return r - dist;
}

function circleCircle(
  a: { c: Vec2; r: number },
  b: { c: Vec2; r: number },
  gap: number,
): number | null {
  const dist = Math.hypot(a.c.x - b.c.x, a.c.y - b.c.y);
  const sum = a.r + b.r + gap;
  return dist < sum ? sum - dist : null;
}

function partsOverlap(a: ConvexPart, b: ConvexPart, gap: number): number | null {
  if (a.kind === 'circle' && b.kind === 'circle') return circleCircle(a, b, gap);
  if (a.kind === 'obb' && b.kind === 'circle') return obbCircle(a, b, gap);
  if (a.kind === 'circle' && b.kind === 'obb') return obbCircle(b, a, gap);
  if (a.kind === 'obb' && b.kind === 'obb') return obbObb(a, b, gap);
  return null;
}

// Overlap between two footprints, honouring `gap` clearance. Returns the
// maximum penetration depth across all part pairs (0 when clear). Broad-phase
// circle prefilter first.
export function footprintsOverlap(A: Footprint, B: Footprint, gap: number): number {
  const bd = Math.hypot(A.bc.c.x - B.bc.c.x, A.bc.c.y - B.bc.c.y);
  if (bd > A.bc.r + B.bc.r + gap) return 0; // broad-phase: definitely clear
  let depth = 0;
  for (const pa of A.parts) {
    for (const pb of B.parts) {
      const d = partsOverlap(pa, pb, gap);
      if (d != null && d > depth) depth = d;
    }
  }
  return depth;
}

export type Violation = {
  otherId: string | null; // table id, or null for a zone (id in `zoneId`)
  zoneId?: string;
  kind: 'overlap' | 'tight';
  depthPx: number;
};

export type OracleWorld = { others: WorldPose[]; zones: OracleZone[] };
export type OracleParams = { gapPx: number };

// Rotation slack for the joint-adjacency test — a hair looser than the strict
// snap tolerance so sub-pixel float drift on a persisted joint never turns a
// clean connection into a phantom overlap.
const JOINT_ADJ_ROT_TOL_DEG = 6;

// Are two tables cleanly CONNECTED at a legal joint, by GEOMETRY alone (no
// link_group_id, no stored state)? Owner ruling 2026-07-16: connection is
// positional, not a link — two INDEPENDENT chain-class tables snapped end-to-end
// (coincident ends, tangent-continuous, seam de-duplicated) sit body-to-body,
// which is valid ADJACENCY, not an overlap. The oracle recognises this straight
// from the poses: chain-class shapes whose current poses match a `legalJoinPose`
// candidate within a tight, size-relative tolerance + rotation. This REPLACES
// the deleted link-group exemption — nothing is exempted by membership; a pose
// is either at a real legal joint or it collides. Round/sweetheart/king never
// qualify (not chain-class) so two rounds shoved together always collide.
export function atLegalJoint(a: OraclePose, b: OraclePose): boolean {
  if (!chainableShapes(a.shape, b.shape)) return false;
  const ra = obbOf(a).bc.r;
  const rb = obbOf(b).bc.r;
  // Generous catch so the generator returns the nearest candidate; then confirm
  // `a` actually sits on it within a tight, size-relative tolerance.
  const cand = legalJoinPose(b, a, ra + rb + 40);
  if (!cand) return false;
  const tol = Math.max(6, 0.1 * Math.min(ra, rb));
  if (Math.hypot(cand.x - a.x, cand.y - a.y) > tol) return false;
  const dRot = Math.abs(((cand.rot - a.rot + 540) % 360) - 180);
  return dRot <= JOINT_ADJ_ROT_TOL_DEG;
}

// THE ORACLE. A pose vs all others + zones, keeping `gapPx` clear. `valid` iff
// the pose fully clears the aisle everywhere; violations grade the failure —
// 'overlap' = true body intersection, 'tight' = gap < aisle but no body overlap.
// The ONE sanctioned contact is a clean geometric joint (`atLegalJoint`) — two
// chain-class tables snapped end-to-end are valid adjacency; everything else,
// including two shoved rounds, collides.
export function checkPlacement(
  pose: WorldPose,
  world: OracleWorld,
  params: OracleParams,
): { valid: boolean; violations: Violation[] } {
  const fp = obbOf(pose);
  const gap = Math.max(0, params.gapPx);
  const violations: Violation[] = [];

  for (const other of world.others) {
    if (other.tableId === pose.tableId) continue;
    // Sanctioned contact = a DIRECT weld (same group AT a legal joint), not
    // blanket group membership.
    if (atLegalJoint(pose, other)) continue;
    const fo = obbOf(other);
    const body = footprintsOverlap(fp, fo, 0);
    if (body > 0) {
      violations.push({ otherId: other.tableId, kind: 'overlap', depthPx: body });
      continue;
    }
    if (gap > 0) {
      const infl = footprintsOverlap(fp, fo, gap);
      if (infl > 0) violations.push({ otherId: other.tableId, kind: 'tight', depthPx: infl });
    }
  }

  for (const z of world.zones) {
    // Stage rule: a sweetheart table is exempt from the stage platform (the
    // couple's table is the ONE thing allowed to sit on it). Any other zone —
    // or any non-sweetheart table over the stage — is a violation as usual.
    if (z.sweetheartExempt && pose.shape === 'sweetheart') continue;
    const fz = zoneFootprint(z);
    const body = footprintsOverlap(fp, fz, 0);
    if (body > 0) {
      violations.push({ otherId: null, zoneId: z.id, kind: 'overlap', depthPx: body });
      continue;
    }
    if (gap > 0) {
      const infl = footprintsOverlap(fp, fz, gap);
      if (infl > 0) violations.push({ otherId: null, zoneId: z.id, kind: 'tight', depthPx: infl });
    }
  }

  const valid = violations.length === 0;
  return { valid, violations };
}

// Maximum penetration depth of a pose against everything (0 when fully valid) —
// the scalar the monotone-escape drag compares frame to frame. Counts body
// overlap only (gap 0); a table may always slide out of a real overlap even
// through a tight-but-legal corridor.
export function penetrationDepth(pose: WorldPose, world: OracleWorld): number {
  const fp = obbOf(pose);
  let depth = 0;
  for (const other of world.others) {
    if (other.tableId === pose.tableId) continue;
    if (atLegalJoint(pose, other)) continue;
    const d = footprintsOverlap(fp, obbOf(other), 0);
    if (d > depth) depth = d;
  }
  for (const z of world.zones) {
    if (z.sweetheartExempt && pose.shape === 'sweetheart') continue;
    const d = footprintsOverlap(fp, zoneFootprint(z), 0);
    if (d > depth) depth = d;
  }
  return depth;
}

// Full-board O(n²) audit built on checkPlacement. Returns only the tables that
// have violations. Used by Auto Arrange verification, the mount audit, and the
// server actions.
export function layoutViolations(
  poses: WorldPose[],
  zones: OracleZone[],
  gapPx: number,
): Array<{ tableId: string; violations: Violation[] }> {
  const out: Array<{ tableId: string; violations: Violation[] }> = [];
  for (const p of poses) {
    const others = poses.filter((q) => q.tableId !== p.tableId);
    const res = checkPlacement(p, { others, zones }, { gapPx });
    if (!res.valid) out.push({ tableId: p.tableId, violations: res.violations });
  }
  return out;
}

// ── Monotone-escape drag decision core (shared by the pointer pipelines) ──────
// The invariant a live drag must keep: a table can move to a fully-valid pose,
// or — if it STARTED violating (a legacy overlap, or the walkway was widened) —
// to a pose no DEEPER than where it began (+ ε plateau); never deeper, never a
// fresh overlap. The reference depth is the pose the drag STARTED from, captured
// ONCE (`dragEscapeBaseline`) and held for the whole gesture.
//
// Why a captured baseline and not the running pose: recomputing the reference
// from the current pose every frame (the pre-2026-07-17 3D-lab bug) lets a slow
// *continuous* drag ratchet inward — each frame is `≤ prevDepth + ε`, but
// `prevDepth` grows every frame, so the ceiling walks all the way through the
// neighbour (owner's live "round table on top of the other" figure-8). The 2D
// editor masked the same running-reference code because it grid-snaps the
// pointer to 0.5 m steps — a 0.5 m jump can't stay within ε — while the 3D lab
// feeds a continuous raycast, exposing it. Anchoring to the START depth bounds
// total penetration at `startDepth + ε` for the entire drag, in either surface.
export type DragEscapeBaseline = { startValid: boolean; startDepth: number };

export function dragEscapeBaseline(
  pose: WorldPose,
  world: OracleWorld,
  params: OracleParams,
): DragEscapeBaseline {
  const valid = checkPlacement(pose, world, params).valid;
  return { startValid: valid, startDepth: valid ? 0 : penetrationDepth(pose, world) };
}

// May `pose` be SETTLED under the escape rule, given the drag's fixed baseline?
// A table that started fully valid must stay fully valid (refuse ALL invalid);
// one that started violating may rest only at a pose whose body penetration does
// not exceed where it began (+ ε).
export function escapeAccepts(
  pose: WorldPose,
  world: OracleWorld,
  params: OracleParams,
  base: DragEscapeBaseline,
  epsM: number,
): boolean {
  if (checkPlacement(pose, world, params).valid) return true;
  if (base.startValid) return false; // a clean table must keep the walkway
  return penetrationDepth(pose, world) <= base.startDepth + epsM; // stuck → non-worsening
}

// Resolve ONE drag frame: try the desired pose, then an axis-separated slide
// (X-only, then Y-only) so a table glides along an obstacle to the next gap,
// else hold at the current pose. Returns the pct centre to move to. `poseFor`
// builds a world-pose from a pct centre (the caller owns table geometry/scale).
export function resolveDragStep(
  poseFor: (xPct: number, yPct: number) => WorldPose,
  desired: { x: number; y: number },
  cur: { x: number; y: number },
  world: OracleWorld,
  params: OracleParams,
  base: DragEscapeBaseline,
  epsM: number,
): { x: number; y: number } {
  const ok = (x: number, y: number) => escapeAccepts(poseFor(x, y), world, params, base, epsM);
  if (ok(desired.x, desired.y)) return { x: desired.x, y: desired.y };
  if (ok(desired.x, cur.y)) return { x: desired.x, y: cur.y }; // slide along X
  if (ok(cur.x, desired.y)) return { x: cur.x, y: desired.y }; // slide along Y
  return { x: cur.x, y: cur.y }; // fully boxed in → hold at the last accepted pose
}

// ── THE DROP RULE (owner 2026-07-17 · "undroppable when overlap") ─────────────
// An invalid drop is NO drop: the pointer follows freely in-drag (the warm-red
// ring is the per-frame warning), and enforcement lives HERE, at release. This
// SUPERSEDES the monotone-escape COMMIT semantics (escapeAccepts + settle-to-
// last-valid) — a release the oracle rejects is not settled anywhere; the caller
// persists nothing and animates the element(s) back to the drag-START pose.
//
// `moved` is the pose(s) being placed on release: a single table, or every
// member of a welded/connective unit translated as a rigid body. `others` are
// the poses NOT moving. A drop is accepted iff EVERY moved pose is oracle-valid
// (`checkPlacement`, chair-inclusive, zones, walkway) against everything else —
// where "everything else" includes the OTHER moved members, so a unit's own
// legal joints are recognised (via `atLegalJoint`) and never self-collide, while
// a connective SNAP pose is valid by construction (it sits on a legal joint).
//
// Legacy healing is preserved BY CONSTRUCTION: a violating table's drag-start
// pose is its current spot; dragging OUT to a valid pose is an accepted drop;
// any invalid release returns it exactly to start — so no table can ever get
// MORE stuck. ONE rule, both projections (2D editor + 3D lab).
export function dropAccepted(
  moved: WorldPose[],
  others: WorldPose[],
  zones: OracleZone[],
  params: OracleParams,
): boolean {
  if (moved.length === 0) return true;
  return moved.every((p) => {
    const rest = others.concat(moved.filter((m) => m.tableId !== p.tableId));
    return checkPlacement(p, { others: rest, zones }, params).valid;
  });
}

// The first oracle-valid centre for a NEW round_10 table, spiralling out from the
// room centre until the SHARED oracle clears every existing table + zone. The
// footprint is CHAIR-INCLUSIVE by construction — `round_10` scale is
// `TABLE_FOOTPRINT_M.round_10 / geo.box.w`, so `obbOf` yields the 2.8 m-diameter
// (r = 1.4 m) disc that spans the seat ring, exactly the disc the 2D editor and
// the 3D drag path validate against. Returns percent-of-room coords, or null when
// the room is too dense (caller falls back to the client grid). Extracted from the
// 3D lab's inline spawn so CREATE parity is a tested invariant, not component-local
// logic: any candidate it returns has passed `checkPlacement(...).valid`, so it can
// never seed a round-vs-round overlap (owner 2026-07-17 · 3D round-collision audit).
export function firstFreeRoundSpawnPct(
  others: WorldPose[],
  zones: OracleZone[],
  room: { w: number; d: number },
  gapPx: number,
): { x: number; y: number } | null {
  const geo = tableGeometry('round', 10);
  const scale = TABLE_FOOTPRINT_M.round_10 / geo.box.w;
  const ok = (xPct: number, yPct: number): boolean => {
    const pose: WorldPose = {
      tableId: '__new__',
      shape: 'round',
      capacity: 10,
      x: (xPct / 100) * room.w,
      y: (yPct / 100) * room.d,
      rot: 0,
      scale,
      linkGroupId: null,
    };
    return checkPlacement(pose, { others, zones }, { gapPx }).valid;
  };
  const baseX = 50;
  const baseY = 55; // below the top-centre stage default
  if (ok(baseX, baseY)) return { x: baseX, y: baseY };
  const stepPct = 4;
  for (let ring = 1; ring <= 48; ring++) {
    for (let deg = 0; deg < 360; deg += 18) {
      const a = (deg * Math.PI) / 180;
      const nx = baseX + Math.cos(a) * ring * stepPct;
      const ny = baseY + Math.sin(a) * ring * stepPct;
      if (nx < 2 || nx > 98 || ny < 2 || ny > 98) continue;
      if (ok(nx, ny)) return { x: nx, y: ny };
    }
  }
  return null; // dense room → let the client grid fallback place it
}

// ---------------------------------------------------------------------------
// legalJoinPose — the single source of truth for BOTH snapping and join
// validation. Given an anchor and a mover (at its drag/current centre), returns
// the EXACT snapped pose for a legal joint or null. Reuses the existing snap
// generators (serpentineChainSnap / rectChainSnap); the joint
// is legal by construction (only ±sweep / 180° / flush-collinear / kiss poses
// are ever produced), so the rotation constraint is automatic.
// ---------------------------------------------------------------------------
type JoinPose = {
  shape: TableShapeHint;
  capacity: number;
  x: number;
  y: number;
  rot: number;
  scale: number;
};

function serpBoxW(capacity: number): number {
  return tableGeometry('serpentine', Math.max(1, capacity)).box.w;
}
function rectHalfLenPx(p: JoinPose): number {
  const g = tableGeometry(p.shape, Math.max(1, p.capacity));
  const footW = g.box.w * p.scale;
  return (g.hub.w / 2) * (footW / g.box.w);
}
const rectishShape = (s: TableShapeHint) => s === 'long_banquet' || s === 'family_head';
// A shape that CONNECTS end-to-end: straight banquet runs + serpentine curves.
// Owner rulings 2026-07-16: (1) "long and serpentine should also be able to
// [connect]" — any two chain-class shapes connect, cross-family included
// (banquet↔banquet, serpentine↔serpentine, banquet↔serpentine). (2) ROUND is
// standalone furniture — NON-connectable (the old "round kiss" is REMOVED). A
// round can never combine into one table, so two rounds simply collide. King +
// sweetheart are likewise standalone.
const chainClassShape = (s: TableShapeHint) => s === 'serpentine' || rectishShape(s);

// The connectable-set rule: two shapes snap/join end-to-end iff BOTH are
// chain-class (any mix). Round, sweetheart, king → false (standalone, collide).
export function chainableShapes(a: TableShapeHint, b: TableShapeHint): boolean {
  return chainClassShape(a) && chainClassShape(b);
}

const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

// Serpentine LOCAL end tips + their outward run tangents (unit, pre-rotate). The
// tangent is the direction a straight run would continue past the tip — for the
// tangent-continuous straight→curve joint.
function serpLocalTips(): Array<{ loc: Vec2; tan: Vec2 }> {
  const s = (SERPENTINE_SWEEP_DEG * Math.PI) / 180;
  const f = serpentineFrame();
  return [
    { loc: f.endPlus, tan: { x: Math.cos(s / 2), y: Math.sin(s / 2) } },
    { loc: f.endMinus, tan: { x: -Math.cos(s / 2), y: Math.sin(s / 2) } },
  ];
}

// Serpentine WORLD end tips + outward tangents for a pose.
function serpWorldTips(p: JoinPose): Array<{ tip: Vec2; tan: Vec2 }> {
  return serpLocalTips().map(({ loc, tan }) => {
    const tw = rotatePoint({ x: loc.x * p.scale, y: loc.y * p.scale }, p.rot);
    const td = rotatePoint(tan, p.rot); // rotation preserves the unit length
    return { tip: { x: p.x + tw.x, y: p.y + tw.y }, tan: { x: td.x, y: td.y } };
  });
}

// Rect run WORLD end-face midpoints + outward run directions for a pose.
function rectEndFrames(p: JoinPose): Array<{ end: Vec2; out: Vec2 }> {
  const halfLen = rectHalfLenPx(p);
  const dir = rotatePoint({ x: 1, y: 0 }, p.rot);
  return [
    { end: { x: p.x + dir.x * halfLen, y: p.y + dir.y * halfLen }, out: { x: dir.x, y: dir.y } },
    { end: { x: p.x - dir.x * halfLen, y: p.y - dir.y * halfLen }, out: { x: -dir.x, y: -dir.y } },
  ];
}

// Cross-family weld (rect-ish ↔ serpentine): the banquet's end-face midpoint
// coincides with the serpentine's end-tip AND the banquet's run axis is tangent-
// continuous with the serpentine's end-tangent (straight flows smoothly into
// curve, no kink, no gap). Returns the mover's snapped pose, or null past tolPx.
function crossChainSnap(
  anchor: JoinPose,
  mover: JoinPose,
  tolPx: number,
): { x: number; y: number; rot: number } | null {
  const candidates: Array<{ x: number; y: number; rot: number }> = [];
  if (mover.shape === 'serpentine') {
    // anchor = rect: seat a serpentine tip on a rect end, its tangent continuing
    // the run INTO the curve (so the tip's OUTWARD tangent points back along the
    // rect, i.e. = −out).
    for (const { end, out } of rectEndFrames(anchor)) {
      const targetAng = Math.atan2(-out.y, -out.x);
      for (const { loc, tan } of serpLocalTips()) {
        const rotDeg = norm360(((targetAng - Math.atan2(tan.y, tan.x)) * 180) / Math.PI);
        const tw = rotatePoint({ x: loc.x * mover.scale, y: loc.y * mover.scale }, rotDeg);
        candidates.push({ x: end.x - tw.x, y: end.y - tw.y, rot: rotDeg });
      }
    }
  } else {
    // anchor = serpentine, mover = rect: seat a rect end on a serpentine tip, the
    // run axis continuing the tip's OUTWARD tangent (banquet extends away).
    const halfLen = rectHalfLenPx(mover);
    for (const { tip, tan } of serpWorldTips(anchor)) {
      const rotDeg = norm360((Math.atan2(tan.y, tan.x) * 180) / Math.PI);
      candidates.push({ x: tip.x + tan.x * halfLen, y: tip.y + tan.y * halfLen, rot: rotDeg });
    }
  }
  let best: { x: number; y: number; rot: number } | null = null;
  let bestD = tolPx * tolPx;
  for (const c of candidates) {
    const d = (c.x - mover.x) ** 2 + (c.y - mover.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function legalJoinPose(
  anchor: JoinPose,
  mover: JoinPose,
  tolPx: number,
): { x: number; y: number; rot: number } | null {
  if (!chainableShapes(anchor.shape, mover.shape)) return null;
  const drag = { x: mover.x, y: mover.y };
  if (anchor.shape === 'serpentine' && mover.shape === 'serpentine') {
    return serpentineChainSnap(
      drag,
      [{ x: anchor.x, y: anchor.y, rot: anchor.rot, scale: anchor.scale }],
      tolPx,
    );
  }
  if (rectishShape(anchor.shape) && rectishShape(mover.shape)) {
    return rectChainSnap(
      drag,
      rectHalfLenPx(mover),
      [{ x: anchor.x, y: anchor.y, rot: anchor.rot, halfLen: rectHalfLenPx(anchor) }],
      tolPx,
    );
  }
  // Cross-family connect (rect-ish ↔ serpentine).
  return crossChainSnap(anchor, mover, tolPx);
}

// Are two tables ALREADY in a legal joint at their current poses? Used to
// validate `linkTables` server-side and to promote legacy kissed-but-unlinked
// runs. Metric tolerance (JOIN_TOL_M) converted to px via pxPerMeter.
export function isLegalJoint(
  anchor: JoinPose,
  mover: JoinPose,
  pxPerMeter: number,
): boolean {
  const tolPx = Math.max(4, JOIN_TOL_M * pxPerMeter);
  // Generous catch so the generator returns the nearest candidate; then verify
  // the mover already sits on it within the tight metric tolerance.
  const cand = legalJoinPose(anchor, mover, Math.max(tolPx * 6, 120));
  if (!cand) return false;
  const dist = Math.hypot(cand.x - mover.x, cand.y - mover.y);
  if (dist > tolPx) return false;
  if (mover.shape === 'round') return true; // kiss has no rotation constraint
  const dRot = Math.abs(((cand.rot - mover.rot + 540) % 360) - 180);
  return dRot <= JOIN_ROT_TOL_DEG;
}

// ===========================================================================
// SHARED PROJECTION API (contract v2 · Seat_Plan_2D3D_Sync_Council_Verdict
// 2026-07-16 · § 3). The ONE percent↔world map, room-box denominator, rotation
// convention, metric body geometry, metric joint validator, null-row resolver
// and canvas-letterbox fit — consumed identically by the List, the 2D editor,
// the 3D lab, `actions.ts` and the proof suite. Pure, server-safe, no React,
// no three. `lib/seating-3d.ts` keeps thin re-exports so its consumers compile.
// ===========================================================================

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

// The serpentine band is capacity-independent (2026-05-09 lock: ONE 104° band).
// box.w is stable for cap ≥ 2 (chairs fill the widest spread); we anchor the
// metric family to cap 5 so a single band serves every serpentine on every
// surface (mirrors seating-3d's cached `serpentineBand`).
const SERP_REF_CAP = 5;

/** The ONE body-geometry source (contract § 4): `tableGeometry` uniformly scaled
 *  to metres. Round/banquet/sweetheart return `box` + `outlineM`; serpentine
 *  additionally returns the recentred metric tips + the band radii — the shared
 *  numbers `lib/seating-3d.ts` derives its whole serpentine family from, so 2D,
 *  3D, the mesh, the snap and the server validator speak ONE family. */
export function metricGeometry(
  type: TableType,
  capacity: number,
): {
  box: { w: number; d: number };
  outlineM: Vec2[];
  tipsM?: { plus: Vec2; minus: Vec2 };
  bandM?: { ri: number; ro: number; rm: number; sweepDeg: number; chairGap: number };
} {
  const shape = shapeHintFor(type);
  const geo = tableGeometry(shape, Math.max(1, capacity));
  const s = TABLE_FOOTPRINT_M[type] / geo.box.w;
  const box = { w: geo.box.w * s, d: geo.box.h * s };
  const outlineM = (geo.outline ?? []).map((p) => ({ x: p.x * s, y: p.y * s }));
  if (shape === 'serpentine') {
    // Anchor the band to the capacity-independent reference scale so tips/radii
    // don't drift by a hair across capacities (box.w is stable for cap ≥ 2).
    const refGeo = tableGeometry('serpentine', SERP_REF_CAP);
    const rs = TABLE_FOOTPRINT_M[type] / refGeo.box.w;
    const f = serpentineFrame();
    return {
      box,
      outlineM,
      tipsM: {
        plus: { x: f.endPlus.x * rs, y: f.endPlus.y * rs },
        minus: { x: f.endMinus.x * rs, y: f.endMinus.y * rs },
      },
      bandM: {
        ri: SERP_RI * rs,
        ro: SERP_RO * rs,
        rm: ((SERP_RI + SERP_RO) / 2) * rs,
        sweepDeg: SERPENTINE_SWEEP_DEG,
        chairGap: (CHAIR_PX / 2 + 4) * rs,
      },
    };
  }
  return { box, outlineM };
}

/** A pose in METRES (position + degrees + metric render scale). The metric twin
 *  of `OraclePose` — `legalJoinPose`/`serpentineChainSnap`/`rectChainSnap` are
 *  unit-agnostic (local geometry × `scale` → world), so feeding metric x/y and a
 *  metric `scale` yields metric output with ppm folded to 1. */
export type PoseM = {
  shape: TableShapeHint;
  capacity: number;
  x: number; // metres
  y: number; // metres (the plan-view down axis ≡ 3D +z)
  rot: number; // degrees, y-down clockwise
  scale: number; // metres per local geometry unit (metricScale)
};

/** Build a `PoseM` for a persisted row at its percent position (contract §§ 4,6). */
export function metricPoseM(
  row: { table_type: TableType; capacity: number; rotation_deg?: number | null },
  xPct: number,
  yPct: number,
  room: { w: number; d: number },
): PoseM {
  const w = pctToWorldM(xPct, yPct, room);
  return {
    shape: shapeHintFor(row.table_type),
    capacity: row.capacity,
    x: w.x,
    y: w.z,
    rot: row.rotation_deg ?? 0,
    scale: metricScale(row.table_type, row.capacity),
  };
}

/** The metric wrapper over `legalJoinPose` (ppm folded to 1). Given a metric
 *  anchor + mover, the EXACT snapped joint pose (metres) or null past `tolM`. The
 *  3D snap routes through THIS, so its output passes `validateChainJointM` by
 *  construction. */
export function legalJoinPoseM(
  anchor: PoseM,
  mover: PoseM,
  tolM = Math.max(0.6, JOIN_TOL_M * 12),
): { x: number; y: number; rot: number } | null {
  return legalJoinPose(anchor, mover, tolM);
}

/** Are two metric poses ALREADY at a legal joint (within `JOIN_TOL_M` = 5 cm +
 *  the rotation tolerance)? The pose check inside `linkTables`, extracted and
 *  metric-native — server, 2D, 3D and tests all call THIS (no NOMINAL_W bridge,
 *  no `venueW && venueL` guard: the free board validates too). */
export function validateChainJointM(a: PoseM, b: PoseM): boolean {
  if (!chainableShapes(a.shape, b.shape)) return false;
  const cand = legalJoinPoseM(a, b);
  if (!cand) return false;
  if (Math.hypot(cand.x - b.x, cand.y - b.y) > JOIN_TOL_M) return false;
  if (b.shape === 'round') return true; // kiss has no rotation constraint
  const dRot = Math.abs(((cand.rot - b.rot + 540) % 360) - 180);
  return dRot <= JOIN_ROT_TOL_DEG;
}

/** Minimal row shape the null-row resolver + editor/lab projection need. */
export type ProjectTableRow = {
  table_id: string;
  table_type: TableType;
  capacity: number;
  x_pos: number | null;
  y_pos: number | null;
  rotation_deg?: number | null;
};

/** The ONE null-row home resolver (contract § 5). Rows with NULL x/y get a
 *  deterministic grid home from `defaultTablePosition` at their row index — the
 *  SAME homes the 2D editor's grid fallback and the 3D lab loader consume, so an
 *  un-positioned table sits identically in both. Homes are never persisted. */
export function resolveHomePcts(
  rows: ReadonlyArray<Pick<ProjectTableRow, 'table_id' | 'x_pos' | 'y_pos'>>,
  room: { w: number; d: number; isDefault: boolean },
): Map<string, { x: number; y: number }> {
  const spread = room.isDefault; // free board spreads outward; sized room packs
  const out = new Map<string, { x: number; y: number }>();
  rows.forEach((r, i) => {
    if (r.x_pos == null || r.y_pos == null) {
      out.set(r.table_id, defaultTablePosition(i, rows.length, spread));
    }
  });
  return out;
}

/** Letterbox a room box into a measured cell — the largest room-aspect rectangle
 *  that fits (contract § 2 behaviour: the free board letterboxes to the room's
 *  aspect EXACTLY like a sized room, so `pxPerMeter` is always defined and the
 *  percent space is isotropic). `pxPerMeter` is EXACT (unfloored) so the
 *  projection stays canvas-independent; the display may pixel-snap separately. */
export function fitRoomToCell(
  room: { w: number; d: number },
  cellW: number,
  cellH: number,
): { canvasW: number; canvasH: number; pxPerMeter: number } {
  const ratio = room.w / room.d;
  let w = cellW;
  let h = w / ratio;
  if (h > cellH) {
    h = cellH;
    w = h * ratio;
  }
  return { canvasW: w, canvasH: h, pxPerMeter: w / room.w };
}

/** Canvas px → percent, against a room-aspect letterbox fit. Isotropic because
 *  the canvas carries the room aspect (`canvasW/room.w === canvasH/room.d`), so
 *  the per-axis divide is canvas-size-INVARIANT (the Gun-B bug class dies here). */
export function canvasPxToPctM(
  px: Vec2,
  fit: { canvasW: number; canvasH: number },
): { xPct: number; yPct: number } {
  return { xPct: (px.x / fit.canvasW) * 100, yPct: (px.y / fit.canvasH) * 100 };
}

/** The exact inverse of `canvasPxToPctM` (percent → canvas px). */
export function pctToCanvasPxM(
  xPct: number,
  yPct: number,
  fit: { canvasW: number; canvasH: number },
): Vec2 {
  return { x: (xPct / 100) * fit.canvasW, y: (yPct / 100) * fit.canvasH };
}

/** The 2D editor's world projection, modelled through its REAL render seam:
 *  a table renders at `left:xPct%`/`top:yPct%` of the room-aspect letterboxed
 *  canvas, so its world metres = the letterbox px position mapped back through
 *  `pxPerMeter`. Threads canvas px genuinely (anti-tautology, § 6 T8) yet equals
 *  `pctToWorldM(xPct, yPct, room)` for ANY canvas width — the isotropy proof. */
export function editorWorldPose(
  row: { x_pos: number | null; y_pos: number | null },
  floor: { venue_width_m?: number | null; venue_length_m?: number | null },
  canvasWpx: number,
): { x: number; z: number } {
  const room = roomBoxM(floor);
  const fit = fitRoomToCell(room, canvasWpx, (canvasWpx * room.d) / room.w);
  const xPct = row.x_pos ?? 0;
  const yPct = row.y_pos ?? 0;
  const px = pctToCanvasPxM(xPct, yPct, fit);
  return {
    x: (px.x - fit.canvasW / 2) / fit.pxPerMeter,
    z: (px.y - fit.canvasH / 2) / fit.pxPerMeter,
  };
}

/** A pose to persist atomically at a connective weld (position + rotation). */
export type WeldPose = { tableId: string; xPct: number; yPct: number; rotationDeg: number };

/** The atomic weld batch (Sync verdict § 5 · GUN C). A connective snap persists
 *  the MOVER pose + the ANCHOR pose in ONE round trip — never the mover's
 *  rotation alone (the half-persisted state the owner screenshotted). Pure so the
 *  editor, the 3D lab and `commitWeld` build the identical batch; de-dupes if the
 *  same id appears twice. */
export function weldCommitBatch(mover: WeldPose, anchor: WeldPose): WeldPose[] {
  return anchor.tableId === mover.tableId ? [mover] : [mover, anchor];
}

/** Display envelope (metres) for a set of tables — VIEWPORT ONLY (contract § 2):
 *  the world bbox of the placed tables (+ a footprint margin) or the room itself
 *  when empty. NEVER a change to the percent denominator (that stays `roomBoxM`);
 *  this is only how the camera/fit knows how far to frame an auto-grown board. */
export function contentBoundsM(
  rows: ReadonlyArray<{ x_pos: number | null; y_pos: number | null }>,
  room: { w: number; d: number },
): { w: number; d: number } {
  const pts = rows.filter((r) => r.x_pos != null && r.y_pos != null);
  if (pts.length === 0) return { w: room.w, d: room.d };
  const M = 2; // metre margin per table for its footprint + chairs
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const r of pts) {
    const p = pctToWorldM(r.x_pos!, r.y_pos!, room);
    minX = Math.min(minX, p.x - M);
    maxX = Math.max(maxX, p.x + M);
    minZ = Math.min(minZ, p.z - M);
    maxZ = Math.max(maxZ, p.z + M);
  }
  return { w: Math.max(room.w, maxX - minX), d: Math.max(room.d, maxZ - minZ) };
}

// ---------------------------------------------------------------------------
// Auto Arrange = solver over the same oracle (verdict § 5). Keeps the stage-out
// centre-out row-packing heuristic as the SEED, adds verified legality: every
// slot must pass checkPlacement vs everything placed so far; rejected slots scan
// alternate slots in the row, then the next row; the keep-stacking fallback and
// one-shot zone push are DELETED (they were dishonest overlap producers). After
// layout a final layoutViolations pass runs — the result is either fully legal
// or { placed, unplaced }. Structurally incapable of returning what drag forbids.
// ---------------------------------------------------------------------------
export type SolveLayoutInput = {
  tables: EventTableRow[];
  floorPlan: FloorPlanLike &
    Pick<FloorPlanRow, 'dance_enabled' | 'dance_x' | 'dance_y' | 'dance_w' | 'dance_h'> &
    Pick<FloorPlanRow, 'cocktail_enabled' | 'cocktail_x' | 'cocktail_y' | 'cocktail_w' | 'cocktail_h'>;
  rect: { width: number; height: number };
  footprintOf: (t: EventTableRow) => { w: number; h: number };
  // Metric walkway width (m) and the room's px/m — drive metric gaps + zone
  // inflation. When absent (free board) the solver falls back to % gaps.
  aisleM?: number;
  pxPerMeter?: number;
  // Extra world-px no-go zones (booths). Centre-anchored.
  booths?: Array<{ x: number; y: number; w: number; h: number }>;
  // Reserve a centre processional/service lane when a stage exists.
  reserveCentreAisle?: boolean;
};

export type SolveLayoutResult = {
  placed: Record<string, { x: number; y: number }>;
  unplaced: string[];
  // How many MORE tables would fit if the walkway dropped to the 0.6 m floor —
  // powers the honest overflow banner's "at 0.6 m it fits N" suggestion.
  altPlacedAtFloor: number;
};

// A rigid super-element: a link group collapsed to one compound footprint that
// the solver places as a unit (never scatters an assembled chain).
type SolveUnit = {
  id: string; // representative table id
  members: EventTableRow[];
  // Union footprint half-extents (world px, axis-aligned bound of the group).
  fw: number;
  fh: number;
  // Member offsets from the unit's bbox centre (world px), so the placer can
  // fan the group's tables out around the chosen centre.
  offsets: Record<string, { dx: number; dy: number }>;
  rep: EventTableRow;
};

function unitFor(
  members: EventTableRow[],
  footprintOf: (t: EventTableRow) => { w: number; h: number },
  posOf: (t: EventTableRow) => { x: number; y: number } | null,
): { fw: number; fh: number; offsets: Record<string, { dx: number; dy: number }> } {
  // Build the group's bounding box from members' CURRENT positions (world %),
  // falling back to a single-file lay-out when unpositioned.
  const pts: Array<{ t: EventTableRow; x: number; y: number; f: { w: number; h: number } }> = [];
  let cursor = 0;
  for (const m of members) {
    const f = footprintOf(m);
    const p = posOf(m);
    const x = p ? p.x : cursor;
    const y = p ? p.y : 0;
    if (!p) cursor += f.w;
    pts.push({ t: m, x, y, f });
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x - p.f.w / 2);
    minY = Math.min(minY, p.y - p.f.h / 2);
    maxX = Math.max(maxX, p.x + p.f.w / 2);
    maxY = Math.max(maxY, p.y + p.f.h / 2);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const offsets: Record<string, { dx: number; dy: number }> = {};
  for (const p of pts) offsets[p.t.table_id] = { dx: p.x - cx, dy: p.y - cy };
  return { fw: maxX - minX, fh: maxY - minY, offsets };
}

export function solveAutoLayout(input: SolveLayoutInput): SolveLayoutResult {
  const empty: SolveLayoutResult = { placed: {}, unplaced: [], altPlacedAtFloor: 0 };
  const { tables, floorPlan: fp, rect, footprintOf } = input;
  if (tables.length === 0 || rect.width <= 0 || rect.height <= 0) return empty;

  const ppm = input.pxPerMeter && input.pxPerMeter > 0 ? input.pxPerMeter : null;
  const pctW = (px: number) => (px / rect.width) * 100;
  const pctH = (px: number) => (px / rect.height) * 100;

  // --- collapse link groups to rigid super-elements ------------------------
  // Member positions in WORLD PX (unitFor's bbox math must match footprintOf's
  // px units — mixing % positions with px footprints scrambles the offsets).
  const posOf = (t: EventTableRow): { x: number; y: number } | null =>
    t.x_pos != null && t.y_pos != null
      ? { x: (Number(t.x_pos) / 100) * rect.width, y: (Number(t.y_pos) / 100) * rect.height }
      : null;
  const groups = new Map<string, EventTableRow[]>();
  const singles: EventTableRow[] = [];
  for (const t of tables) {
    if (t.link_group_id) {
      const g = groups.get(t.link_group_id) ?? [];
      g.push(t);
      groups.set(t.link_group_id, g);
    } else {
      singles.push(t);
    }
  }
  const units: SolveUnit[] = [];
  for (const t of singles) {
    const f = footprintOf(t);
    units.push({ id: t.table_id, members: [t], fw: f.w, fh: f.h, offsets: { [t.table_id]: { dx: 0, dy: 0 } }, rep: t });
  }
  for (const [, members] of groups) {
    const { fw, fh, offsets } = unitFor(members, footprintOf, posOf);
    // Representative = highest-priority member (drives row rank + label sort).
    const rep = [...members].sort((a, b) => a.sort_order - b.sort_order)[0]!;
    units.push({ id: rep.table_id, members, fw, fh, offsets, rep });
  }

  // Solve for a given metric walkway; returns placed count + placements.
  const solveAt = (aisleM: number | null): { placed: Record<string, { x: number; y: number }>; unplaced: string[] } => {
    const slotGapPct = ((): { gw: number; gh: number } => {
      if (ppm && aisleM != null) {
        const slotPx = aisleM * ppm;
        const rowPx = (aisleM + 0.3) * ppm; // + service allowance
        return { gw: pctW(slotPx), gh: pctH(rowPx) };
      }
      return { gw: 3, gh: 4 }; // free-board % gaps
    })();
    const gapPx = ppm && aisleM != null ? aisleM * ppm : 0;

    // Stage-out axis (same heuristic as before).
    const dx = 50 - fp.stage_x;
    const dy = 50 - fp.stage_y;
    const u: Vec2 = Math.abs(dy) >= Math.abs(dx) ? { x: 0, y: dy >= 0 ? 1 : -1 } : { x: dx >= 0 ? 1 : -1, y: 0 };
    const v = { x: u.y, y: u.x };

    const depthOf = (unit: SolveUnit) => (u.x === 0 ? pctH(unit.fh) : pctW(unit.fw));
    const breadthOf = (unit: SolveUnit) => (u.x === 0 ? pctW(unit.fw) : pctH(unit.fh));

    const TYPE_RANK: Record<TableShapeHint, number> = {
      sweetheart: 0,
      family_head: 1,
      round: 2,
      long_banquet: 3,
      serpentine: 4,
    };
    const ordered = [...units].sort((a, b) => {
      const ra = TYPE_RANK[shapeHintFor(a.rep.table_type)];
      const rb = TYPE_RANK[shapeHintFor(b.rep.table_type)];
      return (
        ra - rb ||
        a.rep.sort_order - b.rep.sort_order ||
        a.rep.table_label.localeCompare(b.rep.table_label) ||
        a.rep.table_id.localeCompare(b.rep.table_id)
      );
    });

    const stageHalfU = u.x === 0 ? fp.stage_h / 2 : fp.stage_w / 2;
    const stageFront =
      u.x === 0
        ? fp.stage_y + (u.y > 0 ? stageHalfU : -stageHalfU)
        : fp.stage_x + (u.x > 0 ? stageHalfU : -stageHalfU);
    const LO = 8;
    const HI = 92;

    // No-go zones (world px) for the verified pass: dance, cocktail, booths,
    // optional centre aisle. Inflated by aisle/2 already handled by gapPx in
    // checkPlacement — here they are the raw rects.
    const zones: OracleZone[] = [];
    const toPxRect = (cx: number, cy: number, w: number, h: number): OracleZone => ({
      id: `z${zones.length}`,
      x: (cx / 100) * rect.width,
      y: (cy / 100) * rect.height,
      w: (w / 100) * rect.width,
      h: (h / 100) * rect.height,
    });
    if (fp.dance_enabled) zones.push(toPxRect(fp.dance_x, fp.dance_y, fp.dance_w, fp.dance_h));
    if (fp.cocktail_enabled) zones.push(toPxRect(fp.cocktail_x, fp.cocktail_y, fp.cocktail_w, fp.cocktail_h));
    // The stage is a conditional obstacle (sweetheart-exempt): Auto Arrange keeps
    // its non-sweetheart rows off the platform, but the couple's sweetheart table
    // may be seeded on it. Same shared rule as drag/rotate (owner 2026-07-16).
    // Sized room only (ppm present) — the free board is place-anywhere.
    if (ppm) zones.push(stageZone(fp, rect));
    for (const b of input.booths ?? []) zones.push({ id: `b${zones.length}`, x: b.x, y: b.y, w: b.w, h: b.h });
    // Centre aisle: reserved lane, width max(aisle, 1.5 m), stage→back wall.
    if (input.reserveCentreAisle && ppm) {
      const laneM = Math.max(aisleM ?? 0.9, 1.5);
      const lanePx = laneM * ppm;
      if (u.x === 0) {
        zones.push({ id: 'aisle', x: (fp.stage_x / 100) * rect.width, y: rect.height / 2, w: lanePx, h: rect.height });
      } else {
        zones.push({ id: 'aisle', x: rect.width / 2, y: (fp.stage_y / 100) * rect.height, w: rect.width, h: lanePx });
      }
    }

    const placed: Record<string, { x: number; y: number }> = {};
    const placedPoses: WorldPose[] = [];
    const unplaced: string[] = [];

    // Try to place a unit's representative CENTRE at (cx,cy) %, expanding the
    // whole group by offsets, and verify every member clears.
    const tryPlaceUnit = (unit: SolveUnit, cx: number, cy: number): boolean => {
      const memberPoses: WorldPose[] = [];
      for (const m of unit.members) {
        const off = unit.offsets[m.table_id]!;
        const mx = cx + pctW(off.dx);
        const my = cy + pctH(off.dy);
        if (mx < LO || mx > HI || my < LO || my > HI) return false;
        const g = tableGeometry(shapeHintFor(m.table_type), m.capacity);
        const f = footprintOf(m);
        memberPoses.push({
          tableId: m.table_id,
          shape: shapeHintFor(m.table_type),
          capacity: m.capacity,
          x: (mx / 100) * rect.width,
          y: (my / 100) * rect.height,
          rot: m.rotation_deg ?? 0,
          scale: f.w / g.box.w,
          linkGroupId: m.link_group_id ?? null,
        });
      }
      // Verify each member vs everything already placed + zones (group members
      // exempt each other by link membership inside checkPlacement).
      for (const mp of memberPoses) {
        const res = checkPlacement(mp, { others: placedPoses, zones }, { gapPx });
        if (!res.valid) return false;
      }
      // Commit.
      for (let i = 0; i < unit.members.length; i++) {
        const m = unit.members[i]!;
        const mp = memberPoses[i]!;
        placed[m.table_id] = { x: (mp.x / rect.width) * 100, y: (mp.y / rect.height) * 100 };
        placedPoses.push(mp);
      }
      return true;
    };

    const rowAnchor = u.x === 0 ? fp.stage_x : fp.stage_y;
    let cursor = 0;
    let rowStart = stageFront;
    const roomBreadth = HI - LO;

    while (cursor < ordered.length) {
      // Greedy fill: how many upcoming units fit across the room breadth?
      const rowUnits: SolveUnit[] = [];
      let rowDepth = 0;
      let used = 0;
      for (let i = cursor; i < ordered.length; i++) {
        const unit = ordered[i]!;
        const w = breadthOf(unit) + slotGapPct.gw;
        if (rowUnits.length > 0 && used + w > roomBreadth) break;
        rowUnits.push(unit);
        used += w;
        rowDepth = Math.max(rowDepth, depthOf(unit));
      }
      const rowSign = u.x === 0 ? u.y : u.x;
      const depth = rowStart + rowSign * (slotGapPct.gh + rowDepth / 2);
      const depthClamped = Math.max(LO, Math.min(HI, depth));

      // Centre-out slotting with per-slot verification + alternate-slot scan.
      let right = 0;
      let left = 0;
      let anyPlacedThisRow = false;
      for (let k = 0; k < rowUnits.length; k++) {
        const unit = rowUnits[k]!;
        const w = breadthOf(unit) + slotGapPct.gw;
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
        // Candidate slot centres to try: the natural slot, then nudged along
        // the row in both directions (alternate-slot scan), all in this row.
        const baseCx = u.x === 0 ? rowAnchor + offset * v.x : depthClamped;
        const baseCy = u.x === 0 ? depthClamped : rowAnchor + offset * v.y;
        let done = false;
        for (let step = 0; step <= 6 && !done; step++) {
          const nudges = step === 0 ? [0] : [step, -step];
          for (const ns of nudges) {
            const shift = ns * (breadthOf(unit) / 2 + slotGapPct.gw);
            const cx = Math.max(LO, Math.min(HI, u.x === 0 ? baseCx + shift * v.x : baseCx));
            const cy = Math.max(LO, Math.min(HI, u.x === 0 ? baseCy : baseCy + shift * v.y));
            if (tryPlaceUnit(unit, cx, cy)) {
              done = true;
              anyPlacedThisRow = true;
              break;
            }
          }
        }
        if (!done) {
          // Defer to the next row by leaving it in the queue tail.
          for (const m of unit.members) unplaced.push(m.table_id);
        }
      }
      rowStart = depthClamped + rowSign * (rowDepth / 2);
      cursor += rowUnits.length;
      if (!anyPlacedThisRow && depthClamped >= HI) break; // ran off the board
    }

    return { placed, unplaced };
  };

  const primary = solveAt(ppm ? (input.aisleM ?? 0.9) : null);
  // Cheap second pass at the 0.6 m floor to power the honest "at Tight it fits
  // N" banner (only meaningful in a metric room with overflow).
  let altPlacedAtFloor = Object.keys(primary.placed).length;
  if (ppm && primary.unplaced.length > 0) {
    const floor = solveAt(0.6);
    altPlacedAtFloor = Object.keys(floor.placed).length;
  }
  return { placed: primary.placed, unplaced: primary.unplaced, altPlacedAtFloor };
}
