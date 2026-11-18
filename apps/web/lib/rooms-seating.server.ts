import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isAlong, isDoorKind, isTableShape, isWall, type Door, type RoomsSeating, type Unit, type UnitGroup } from '@/lib/rooms-seating';

/**
 * 🛏 Rooms & seating — the shop's own read (RLS: its team only). A refused read is `null`, never an empty shop: a
 * hotel with forty rooms must not be told "You have no rooms yet" because one query failed (the 2026-08-20 disease).
 */
export async function readRoomsSeating(supabase: SupabaseClient, vendorProfileId: string): Promise<RoomsSeating | null> {
  const [g, u, d] = await Promise.all([
    supabase
      .from('vendor_unit_groups')
      .select('group_id, kind, name, width_m, length_m, sort_order')
      .eq('vendor_profile_id', vendorProfileId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('vendor_units')
      .select('unit_id, group_id, kind, name, table_shape, chairs, chairs_at_ends, sort_order')
      .eq('vendor_profile_id', vendorProfileId),
    supabase
      .from('vendor_unit_doors')
      .select('door_id, group_id, door_kind, wall, along')
      .eq('vendor_profile_id', vendorProfileId)
      .order('created_at', { ascending: true }),
  ]);
  for (const [name, r] of [['groups', g], ['units', u], ['doors', d]] as const) {
    if (r.error) {
      logQueryError(`roomsSeating.${name}`, r.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
      return null;
    }
  }
  type G = { group_id: string; kind: string; name: string; width_m: number | string | null; length_m: number | string | null; sort_order: number };
  type U = { unit_id: string; group_id: string; kind: string; name: string; table_shape: string | null; chairs: number | null; chairs_at_ends: boolean; sort_order: number };
  type D = { door_id: string; group_id: string | null; door_kind: string; wall: string; along: string };
  const num = (v: number | string | null) => (v === null ? null : Number(v));
  const groups: UnitGroup[] = ((g.data ?? []) as G[]).map((r) => ({
    id: r.group_id,
    kind: r.kind === 'floor' ? 'floor' : 'dining_area',
    name: r.name,
    widthM: num(r.width_m),
    lengthM: num(r.length_m),
    sortOrder: r.sort_order,
  }));
  const units: Unit[] = ((u.data ?? []) as U[]).map((r) => ({
    id: r.unit_id,
    groupId: r.group_id,
    kind: r.kind === 'room' ? 'room' : 'table',
    name: r.name,
    shape: isTableShape(r.table_shape) ? r.table_shape : null,
    chairs: r.chairs,
    chairsAtEnds: Boolean(r.chairs_at_ends),
    sortOrder: r.sort_order,
  }));
  const doors: Door[] = ((d.data ?? []) as D[]).map((r) => ({
    id: r.door_id,
    groupId: r.group_id,
    kind: isDoorKind(r.door_kind) ? r.door_kind : 'main',
    wall: isWall(r.wall) ? r.wall : 'front',
    along: isAlong(r.along) ? r.along : 'middle',
  }));
  return { groups, units, doors };
}
