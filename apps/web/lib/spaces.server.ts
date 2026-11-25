import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchVendorBlocksDetailed, fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { cleanDetails, isSpaceKind, type Space } from '@/lib/spaces';
import { isAlong, isDoorKind, isTableShape, isWall, type Door, type SpaceTables, type Unit, type UnitGroup } from '@/lib/space-tables';
import type { HallBlock, HallBooking } from '@/lib/vendor-halls';

/**
 * 🏛 SPACES — the ONE read for Shop › Spaces (house rule: one batched read per screen): the shop's spaces, the tables and
 * doors in its halls and rooms, and what holds each space on the picked day.
 *
 * Honest by shape (platform CLAUDE.md, "a failure never renders like success or like emptiness"):
 *   · the spaces themselves refused → `null`, and the page says it could not load them (never "no spaces yet");
 *   · the day's bookings or closures refused → `day: null`, and the tiles say nothing about the day rather than "Free".
 */
export type SpacesRead = {
  spaces: Space[];
  tables: SpaceTables;
  /** The day the tiles follow, and what holds each space on it. Null = the day could not be read. */
  day: { date: string; bookings: HallBooking[]; blocks: HallBlock[] } | null;
};

export const SPACE_COLUMNS =
  'pool_id, space_kind, calendar_name, pool_label, seated_capacity, standing_capacity, space_width_m, space_length_m, connects_to_pool_id, floor_label, space_count, in_repair_count, space_details';

type PoolRow = {
  pool_id: string;
  space_kind: string | null;
  calendar_name: string | null;
  pool_label: string | null;
  seated_capacity: number | null;
  standing_capacity: number | null;
  space_width_m: number | string | null;
  space_length_m: number | string | null;
  connects_to_pool_id: string | null;
  floor_label: string | null;
  space_count: number | null;
  in_repair_count: number | null;
  space_details: unknown;
};
const num = (v: number | string | null) => (v === null || v === undefined ? null : Number(v));

export function spaceOf(r: PoolRow): Space | null {
  if (!isSpaceKind(r.space_kind)) return null;
  return {
    id: r.pool_id,
    kind: r.space_kind,
    name: (r.calendar_name ?? r.pool_label ?? '').trim() || 'Space',
    seated: r.seated_capacity,
    standing: r.standing_capacity,
    widthM: num(r.space_width_m),
    lengthM: num(r.space_length_m),
    connectsTo: r.connects_to_pool_id,
    floor: r.floor_label,
    count: r.space_count,
    inRepair: r.in_repair_count ?? 0,
    details: cleanDetails(r.space_kind, r.space_details),
  };
}

/** The shop's spaces only (no tables, no day) — the tile and the admin fold. Null = refused. */
export async function readSpaceList(supabase: SupabaseClient, vendorProfileId: string): Promise<Space[] | null> {
  const { data, error } = await supabase
    .from('vendor_schedule_pools')
    .select(SPACE_COLUMNS)
    .eq('vendor_profile_id', vendorProfileId)
    .eq('is_active', true)
    .not('space_kind', 'is', null)
    .order('created_at', { ascending: true });
  if (error) {
    logQueryError('spaces.list', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  return ((data ?? []) as PoolRow[]).map(spaceOf).filter((s): s is Space => s !== null);
}

export async function readSpaces(supabase: SupabaseClient, vendorProfileId: string, date: string): Promise<SpacesRead | null> {
  const [list, u, d, dayBookings, blocks] = await Promise.all([
    readSpaceList(supabase, vendorProfileId),
    supabase
      .from('vendor_units')
      .select('unit_id, pool_id, kind, name, table_shape, chairs, chairs_at_ends, sort_order, x_pos, y_pos, rotation_deg')
      .eq('vendor_profile_id', vendorProfileId),
    supabase
      .from('vendor_unit_doors')
      .select('door_id, pool_id, door_kind, wall, along')
      .eq('vendor_profile_id', vendorProfileId)
      .order('created_at', { ascending: true }),
    supabase
      .from('vendor_schedule_pool_bookings')
      .select('pool_id, event_id')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('booked_date', date)
      .is('released_at', null),
    fetchVendorBlocksDetailed(supabase, vendorProfileId),
  ]);
  if (list === null) return null;
  for (const [name, r] of [['units', u], ['doors', d]] as const) {
    if (r.error) {
      logQueryError(`spaces.${name}`, r.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
      return null;
    }
  }
  type U = { unit_id: string; pool_id: string; name: string; table_shape: string | null; chairs: number | null; chairs_at_ends: boolean; sort_order: number; x_pos: number | string | null; y_pos: number | string | null; rotation_deg: number | null };
  type D = { door_id: string; pool_id: string; door_kind: string; wall: string; along: string };
  const groups: UnitGroup[] = list
    .filter((s) => s.kind === 'hall' || s.kind === 'room')
    .map((s, i) => ({ id: s.id, kind: s.kind as 'hall' | 'room', name: s.name, widthM: s.widthM, lengthM: s.lengthM, sortOrder: i }));
  const units: Unit[] = ((u.data ?? []) as U[]).map((r) => ({
    id: r.unit_id,
    groupId: r.pool_id,
    kind: 'table',
    name: r.name,
    shape: isTableShape(r.table_shape) ? r.table_shape : null,
    chairs: r.chairs,
    chairsAtEnds: Boolean(r.chairs_at_ends),
    sortOrder: r.sort_order,
    x: num(r.x_pos),
    y: num(r.y_pos),
    rotationDeg: r.rotation_deg ?? 0,
  }));
  const doors: Door[] = ((d.data ?? []) as D[]).map((r) => ({
    id: r.door_id,
    groupId: r.pool_id,
    kind: isDoorKind(r.door_kind) ? r.door_kind : 'main',
    wall: isWall(r.wall) ? r.wall : 'front',
    along: isAlong(r.along) ? r.along : 'middle',
  }));

  let day: SpacesRead['day'] = null;
  if (dayBookings.error) {
    logQueryError('spaces.dayBookings', dayBookings.error, { vendor_profile_id: vendorProfileId, date }, 'graceful_degrade');
  } else if (!blocks.complete) {
    logQueryError('spaces.dayBlocks', { message: 'closures read did not finish' }, { vendor_profile_id: vendorProfileId, date }, 'graceful_degrade');
  } else {
    const rows = (dayBookings.data ?? []) as { pool_id: string; event_id: string }[];
    // Names only when something is booked: the shipped read carries each booking's event name.
    const names = new Map<string, string>();
    if (rows.length > 0) {
      for (const b of await fetchVendorPoolBookings(supabase, vendorProfileId)) if (b.bookedDate === date) names.set(b.eventId, b.eventName);
    }
    day = {
      date,
      bookings: rows.map((r) => ({ poolId: r.pool_id, eventId: r.event_id, title: names.get(r.event_id) || 'A booking' })),
      blocks: blocks.blocks.map((b) => ({
        poolId: b.poolId,
        source: b.source,
        startDate: b.startDate,
        endDate: b.endDate,
        label: b.label,
        clientName: b.clientName,
        repeat: b.repeat,
        repeatUntil: b.repeatUntil,
        dayPart: b.dayPart,
        clientTime: b.clientTime,
      })),
    };
  }
  return { spaces: list, tables: { groups, units, doors }, day };
}
