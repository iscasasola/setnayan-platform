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
