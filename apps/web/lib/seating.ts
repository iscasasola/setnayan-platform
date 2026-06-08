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
  | 'serpentine_6'
  | 'serpentine_12'
  | 'serpentine_18';

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
  { type: 'serpentine_6', label: 'Serpentine (6 seats · 1 segment)', defaultCapacity: 6, shapeHint: 'serpentine' },
  { type: 'serpentine_12', label: 'Serpentine (12 seats · 2 segments)', defaultCapacity: 12, shapeHint: 'serpentine' },
  { type: 'serpentine_18', label: 'Serpentine (18 seats · 3 segments)', defaultCapacity: 18, shapeHint: 'serpentine' },
];

// Number of donut-wedge segments per serpentine type. Each segment seats 6
// (2 inner-cove chairs + 4 outer-edge chairs). Per 2026-05-09 spec lock.
export const SERPENTINE_SEGMENTS: Partial<Record<TableType, number>> = {
  serpentine_6: 1,
  serpentine_12: 2,
  serpentine_18: 3,
};

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
      'table_id,public_id,event_id,table_label,table_type,capacity,sort_order,x_pos,y_pos',
    )
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`fetchTables failed: ${error.message}`);
  return (data ?? []) as EventTableRow[];
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
  entrance_enabled: boolean;
  entrance_x: number;
  entrance_y: number;
};

export const DEFAULT_FLOOR_PLAN: FloorPlanRow = {
  stage_x: 50,
  stage_y: 6,
  entrance_enabled: false,
  entrance_x: 50,
  entrance_y: 94,
};

export async function fetchFloorPlan(
  supabase: SupabaseClient,
  eventId: string,
): Promise<FloorPlanRow> {
  const { data, error } = await supabase
    .from('event_floor_plan')
    .select('stage_x,stage_y,entrance_enabled,entrance_x,entrance_y')
    .eq('event_id', eventId)
    .maybeSingle();
  // Graceful-degrade: a missing row (or a not-yet-migrated table) just yields
  // the defaults so the seating page never crashes on the floor-plan read.
  if (error || !data) return { ...DEFAULT_FLOOR_PLAN };
  return {
    stage_x: Number(data.stage_x),
    stage_y: Number(data.stage_y),
    entrance_enabled: Boolean(data.entrance_enabled),
    entrance_x: Number(data.entrance_x),
    entrance_y: Number(data.entrance_y),
  };
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
// canvas and any future print-pack renderer share one source of truth.
//
// Serpentine renders on a full circle in this pass — the locked quarter-donut
// wedge geometry (2026-05-09) is a visual follow-up; capacity + interaction are
// already correct, only the curve is approximated.
// ---------------------------------------------------------------------------

export const CHAIR_PX = 40;

export type SeatSlot = { x: number; y: number };

export type TableGeometry = {
  box: { w: number; h: number };
  hub: { w: number; h: number; radius: number; shape: 'round' | 'rect' | 'pill' };
  seats: SeatSlot[];
};

export function tableGeometry(shape: TableShapeHint, capacity: number): TableGeometry {
  const n = Math.max(1, capacity);

  // Round / sweetheart / serpentine → chairs evenly around a circle.
  if (shape === 'round' || shape === 'sweetheart' || shape === 'serpentine') {
    const hubR = shape === 'sweetheart' ? 24 : Math.round(28 + n * 2.3);
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
};

export type AutoSeatRow = { guest_id: string; table_id: string; seat_number: number };

function tierOf(g: AutoSeatGuest): 1 | 2 | 3 | 4 {
  if (TIER1_ROLES.has(g.role)) return 1;
  if (TIER2_ROLES.has(g.role)) return 2;
  if (g.group_category === 'family') return 3;
  return 4;
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
  const occupied = new Map<string, Set<number>>();
  const freeCount = new Map<string, number>();
  for (const t of tables) {
    occupied.set(t.table_id, new Set());
    freeCount.set(t.table_id, t.capacity);
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

  // Order within each tier, keeping a guest's plus-one adjacent to its primary.
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
    primaries.sort((a, b) => nameKey(a).localeCompare(nameKey(b)));
    for (const g of primaries) {
      ordered.push(g);
      for (const p of plusOnesBy.get(g.guest_id) ?? []) ordered.push(p);
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
