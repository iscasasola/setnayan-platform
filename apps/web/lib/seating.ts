import type { SupabaseClient } from '@supabase/supabase-js';

export type TableType =
  | 'round_8'
  | 'round_10'
  | 'round_12'
  | 'rectangle_6'
  | 'rectangle_8'
  | 'rectangle_10'
  | 'long_12'
  | 'long_16'
  | 'sweetheart_2'
  | 'head_table'
  | 'crescent_8'
  | 'crescent_10'
  | 'custom';

export const TABLE_TYPE_CATALOG: ReadonlyArray<{
  type: TableType;
  label: string;
  defaultCapacity: number;
  shapeHint: 'round' | 'rectangle' | 'long' | 'crescent' | 'head' | 'sweetheart' | 'custom';
}> = [
  { type: 'round_8', label: 'Round (8 seats)', defaultCapacity: 8, shapeHint: 'round' },
  { type: 'round_10', label: 'Round (10 seats)', defaultCapacity: 10, shapeHint: 'round' },
  { type: 'round_12', label: 'Round (12 seats)', defaultCapacity: 12, shapeHint: 'round' },
  { type: 'rectangle_6', label: 'Rectangle (6 seats)', defaultCapacity: 6, shapeHint: 'rectangle' },
  { type: 'rectangle_8', label: 'Rectangle (8 seats)', defaultCapacity: 8, shapeHint: 'rectangle' },
  { type: 'rectangle_10', label: 'Rectangle (10 seats)', defaultCapacity: 10, shapeHint: 'rectangle' },
  { type: 'long_12', label: 'Long table (12 seats)', defaultCapacity: 12, shapeHint: 'long' },
  { type: 'long_16', label: 'Long table (16 seats)', defaultCapacity: 16, shapeHint: 'long' },
  { type: 'sweetheart_2', label: 'Sweetheart (2 seats)', defaultCapacity: 2, shapeHint: 'sweetheart' },
  { type: 'head_table', label: 'Head table (variable)', defaultCapacity: 10, shapeHint: 'head' },
  { type: 'crescent_8', label: 'Crescent (8 seats)', defaultCapacity: 8, shapeHint: 'crescent' },
  { type: 'crescent_10', label: 'Crescent (10 seats)', defaultCapacity: 10, shapeHint: 'crescent' },
  { type: 'custom', label: 'Custom shape', defaultCapacity: 8, shapeHint: 'custom' },
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
