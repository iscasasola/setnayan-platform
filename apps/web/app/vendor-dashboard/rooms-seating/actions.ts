'use server';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import { readRoomsSeating } from '@/lib/rooms-seating.server';
import {
  MAX_CHAIRS,
  MAX_GROUP_NAME,
  isAlong,
  isDoorKind,
  isTableShape,
  isWall,
  lineUp,
  parseRoomSize,
  parseUnitNames,
  type Along,
  type DoorKind,
  type RoomsSeating,
  type TableShape,
  type UnitKind,
  type Wall,
} from '@/lib/rooms-seating';

/**
 * 🛏 Rooms & seating — the writes (piece A, owner 2026-11-18). Each returns the shop's whole fresh read, so the page
 * never shows a guess. RLS does the scoping (the shop's admin and owner seats write); the database guard refuses a room
 * on another shop's floor. Supplier-only: nothing here touches a booking, a card or a couple.
 */
export type RoomsSeatingResult = { ok: true; data: RoomsSeating; hallSize: { widthM: number; lengthM: number } | null } | { ok: false; error: string };

async function shop() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;
  return { supabase, profile };
}

async function fresh(s: NonNullable<Awaited<ReturnType<typeof shop>>>): Promise<RoomsSeatingResult> {
  const [data, hall] = await Promise.all([
    readRoomsSeating(s.supabase, s.profile.vendor_profile_id),
    s.supabase.from('vendor_profiles').select('venue_width_m, venue_length_m').eq('vendor_profile_id', s.profile.vendor_profile_id).maybeSingle(),
  ]);
  if (!data) return { ok: false, error: 'Saved, but we couldn’t read your rooms back. Open the page again.' };
  const h = hall.data as { venue_width_m: number | string | null; venue_length_m: number | string | null } | null;
  const hallSize = h && h.venue_width_m != null && h.venue_length_m != null ? { widthM: Number(h.venue_width_m), lengthM: Number(h.venue_length_m) } : null;
  return { ok: true, data, hallSize };
}

const NO_SHOP: RoomsSeatingResult = { ok: false, error: 'Sign in to your shop first.' };

/** Words for a database refusal — never the raw message. */
function said(error: { code?: string; message?: string } | null): string {
  if (!error) return '';
  if (error.code === '23505') return 'That name is already used. Each room and each table needs its own name.';
  if (error.code === '42501' || /row-level security|unit_group_not_yours/.test(error.message ?? '')) return 'Only the shop’s owner and admins can change rooms and tables.';
  return 'Couldn’t save just now. Try again.';
}

/** The group to add into: an existing one of the right kind, or a new one by name. */
async function groupFor(
  s: NonNullable<Awaited<ReturnType<typeof shop>>>,
  kind: UnitKind,
  groupId: string | null,
  newName: string | null,
): Promise<{ id: string } | { error: string }> {
  if (groupId) return { id: groupId };
  const name = (newName ?? '').trim();
  if (!name) return { error: kind === 'room' ? 'Name the floor, or pick one.' : 'Name the area, or pick one.' };
  if (name.length > MAX_GROUP_NAME) return { error: `Keep the name under ${MAX_GROUP_NAME} letters.` };
  const { data, error } = await s.supabase
    .from('vendor_unit_groups')
    .insert({ vendor_profile_id: s.profile.vendor_profile_id, kind: kind === 'room' ? 'floor' : 'dining_area', name, sort_order: Date.now() % 1_000_000_000 })
    .select('group_id')
    .single();
  if (error || !data) return { error: error?.code === '23505' ? 'There is already one with that name. Pick it from the list.' : said(error) || 'Couldn’t save just now.' };
  return { id: (data as { group_id: string }).group_id };
}

function tableFields(shape: unknown, chairs: unknown, ends: unknown): { shape: TableShape; chairs: number; ends: boolean } | { error: string } {
  if (!isTableShape(shape)) return { error: 'Pick a type of table.' };
  const n = Number(chairs);
  if (!Number.isInteger(n) || n < 1 || n > MAX_CHAIRS) return { error: `Chairs: 1 to ${MAX_CHAIRS}.` };
  return { shape, chairs: n, ends: shape === 'long' && ends === true };
}

async function addUnits(input: {
  kind: UnitKind;
  names: string;
  groupId: string | null;
  newGroupName: string | null;
  shape?: TableShape;
  chairs?: number;
  ends?: boolean;
}): Promise<RoomsSeatingResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const kind: UnitKind = input.kind === 'room' ? 'room' : 'table';
  const parsed = parseUnitNames(input.names);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const t = kind === 'table' ? tableFields(input.shape, input.chairs, input.ends) : null;
  if (t && 'error' in t) return { ok: false, error: t.error };
  const g = await groupFor(s, kind, input.groupId, input.newGroupName);
  if ('error' in g) return { ok: false, error: g.error };
  const { data: last } = await s.supabase.from('vendor_units').select('sort_order').eq('group_id', g.id).order('sort_order', { ascending: false }).limit(1);
  const start = ((last as { sort_order: number }[] | null)?.[0]?.sort_order ?? -1) + 1;
  const rows = parsed.names.map((name, i) => ({
    vendor_profile_id: s.profile.vendor_profile_id,
    group_id: g.id,
    kind,
    name,
    table_shape: t && !('error' in t) ? t.shape : null,
    chairs: t && !('error' in t) ? t.chairs : null,
    chairs_at_ends: t && !('error' in t) ? t.ends : false,
    sort_order: start + i,
  }));
  const { error } = await s.supabase.from('vendor_units').insert(rows);
  if (error) return { ok: false, error: said(error) };
  return fresh(s);
}

async function updateUnit(input: { id: string; name: string; groupId: string; shape?: TableShape; chairs?: number; ends?: boolean }): Promise<RoomsSeatingResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const name = String(input.name ?? '').trim();
  const one = parseUnitNames(name);
  if (!one.ok || one.names.length !== 1 || one.names[0] !== name) return { ok: false, error: 'Give it one name or number.' };
  const patch: Record<string, unknown> = { name, group_id: input.groupId };
  if (input.shape !== undefined) {
    const t = tableFields(input.shape, input.chairs, input.ends);
    if ('error' in t) return { ok: false, error: t.error };
    Object.assign(patch, { table_shape: t.shape, chairs: t.chairs, chairs_at_ends: t.ends });
  }
  const { error } = await s.supabase.from('vendor_units').update(patch).eq('unit_id', input.id).eq('vendor_profile_id', s.profile.vendor_profile_id);
  if (error) return { ok: false, error: said(error) };
  return fresh(s);
}

async function deleteUnit(id: string): Promise<RoomsSeatingResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const { error } = await s.supabase.from('vendor_units').delete().eq('unit_id', id).eq('vendor_profile_id', s.profile.vendor_profile_id);
  if (error) return { ok: false, error: said(error) };
  return fresh(s);
}

/** Move: one group's tiles in their new order. */
async function saveOrder(groupId: string, ids: string[]): Promise<RoomsSeatingResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  for (let i = 0; i < ids.length; i++) {
    const { error } = await s.supabase
      .from('vendor_units')
      .update({ sort_order: i })
      .eq('unit_id', ids[i]!)
      .eq('group_id', groupId)
      .eq('vendor_profile_id', s.profile.vendor_profile_id);
    if (error) return { ok: false, error: said(error) };
  }
  return fresh(s);
}

/** Line up: every floor (or area) back in name order. */
async function lineUpAll(kind: UnitKind): Promise<RoomsSeatingResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const now = await readRoomsSeating(s.supabase, s.profile.vendor_profile_id);
  if (!now) return { ok: false, error: 'Couldn’t read your rooms just now. Try again.' };
  for (const [, ids] of lineUp(now.units.filter((u) => u.kind === kind))) {
    for (let i = 0; i < ids.length; i++) {
      const { error } = await s.supabase.from('vendor_units').update({ sort_order: i }).eq('unit_id', ids[i]!).eq('vendor_profile_id', s.profile.vendor_profile_id);
      if (error) return { ok: false, error: said(error) };
    }
  }
  return fresh(s);
}

async function renameGroup(id: string, name: string): Promise<RoomsSeatingResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const n = String(name ?? '').trim();
  if (!n || n.length > MAX_GROUP_NAME) return { ok: false, error: `A name, up to ${MAX_GROUP_NAME} letters.` };
  const { error } = await s.supabase.from('vendor_unit_groups').update({ name: n }).eq('group_id', id).eq('vendor_profile_id', s.profile.vendor_profile_id);
  if (error) return { ok: false, error: said(error) };
  return fresh(s);
}

/** Deleting a floor or area deletes what is on it (the page asks first and names the count). */
async function deleteGroup(id: string): Promise<RoomsSeatingResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const { error } = await s.supabase.from('vendor_unit_groups').delete().eq('group_id', id).eq('vendor_profile_id', s.profile.vendor_profile_id);
  if (error) return { ok: false, error: said(error) };
  return fresh(s);
}

async function setAreaSize(id: string, width: string, depth: string): Promise<RoomsSeatingResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const z = parseRoomSize(width, depth);
  if (!z.ok) return { ok: false, error: z.error };
  const { error } = await s.supabase
    .from('vendor_unit_groups')
    .update({ width_m: z.widthM, length_m: z.lengthM })
    .eq('group_id', id)
    .eq('kind', 'dining_area')
    .eq('vendor_profile_id', s.profile.vendor_profile_id);
  if (error) return { ok: false, error: said(error) };
  return fresh(s);
}

/**
 * The hall's size IS the shop's shipped "Room size" (`vendor_profiles.venue_width_m` / `venue_length_m`) — written here
 * with the same rule, never a second size. Capacity stays on the shop row, untouched.
 */
async function setHallSize(width: string, depth: string): Promise<RoomsSeatingResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const z = parseRoomSize(width, depth);
  if (!z.ok) return { ok: false, error: z.error };
  const { error } = await s.supabase
    .from('vendor_profiles')
    .update({ venue_width_m: z.widthM, venue_length_m: z.lengthM })
    .eq('vendor_profile_id', s.profile.vendor_profile_id);
  if (error) return { ok: false, error: said(error) };
  revalidateShopPage(s.profile.vendor_profile_id, s.profile.business_slug);
  return fresh(s);
}

async function addDoor(input: { groupId: string | null; kind: DoorKind; wall: Wall; along: Along }): Promise<RoomsSeatingResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  if (!isDoorKind(input.kind) || !isWall(input.wall) || !isAlong(input.along)) return { ok: false, error: 'Pick the door, its wall and where along it.' };
  const { error } = await s.supabase.from('vendor_unit_doors').insert({
    vendor_profile_id: s.profile.vendor_profile_id,
    group_id: input.groupId,
    door_kind: input.kind,
    wall: input.wall,
    along: input.along,
  });
  if (error) return { ok: false, error: said(error) };
  return fresh(s);
}

async function deleteDoor(id: string): Promise<RoomsSeatingResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const { error } = await s.supabase.from('vendor_unit_doors').delete().eq('door_id', id).eq('vendor_profile_id', s.profile.vendor_profile_id);
  if (error) return { ok: false, error: said(error) };
  return fresh(s);
}

/** The shared seat-plan core's Move: one table's place on its area's plan (event_tables' sense, 0-100 % and degrees). */
async function saveTablePlace(id: string, x: number, y: number, rotationDeg: number): Promise<RoomsSeatingResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const ok = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi;
  if (!ok(x, 0, 100) || !ok(y, 0, 100) || !ok(rotationDeg, -360, 360)) return { ok: false, error: 'That place is off the plan.' };
  const { error } = await s.supabase
    .from('vendor_units')
    .update({ x_pos: x, y_pos: y, rotation_deg: Math.round(rotationDeg) })
    .eq('unit_id', id)
    .eq('kind', 'table')
    .eq('vendor_profile_id', s.profile.vendor_profile_id);
  if (error) return { ok: false, error: said(error) };
  return fresh(s);
}

/**
 * THE ONE EXPORT (`scripts/lint-server-action-budget.mjs`: "reuse … instead of exporting a new one") — every Rooms &
 * seating write goes through this dispatcher, one op at a time, so the page adds one server action, not twelve.
 */
export type RoomsSeatingOp =
  | { op: 'addUnits'; input: Parameters<typeof addUnits>[0] }
  | { op: 'updateUnit'; input: Parameters<typeof updateUnit>[0] }
  | { op: 'deleteUnit'; id: string }
  | { op: 'saveOrder'; groupId: string; ids: string[] }
  | { op: 'lineUp'; kind: UnitKind }
  | { op: 'renameGroup'; id: string; name: string }
  | { op: 'deleteGroup'; id: string }
  | { op: 'setAreaSize'; id: string; width: string; depth: string }
  | { op: 'setHallSize'; width: string; depth: string }
  | { op: 'addDoor'; input: Parameters<typeof addDoor>[0] }
  | { op: 'deleteDoor'; id: string }
  | { op: 'placeTable'; id: string; x: number; y: number; rotationDeg: number };

export async function roomsSeatingWrite(o: RoomsSeatingOp): Promise<RoomsSeatingResult> {
  switch (o.op) {
    case 'addUnits':
      return addUnits(o.input);
    case 'updateUnit':
      return updateUnit(o.input);
    case 'deleteUnit':
      return deleteUnit(o.id);
    case 'saveOrder':
      return saveOrder(o.groupId, o.ids);
    case 'lineUp':
      return lineUpAll(o.kind);
    case 'renameGroup':
      return renameGroup(o.id, o.name);
    case 'deleteGroup':
      return deleteGroup(o.id);
    case 'setAreaSize':
      return setAreaSize(o.id, o.width, o.depth);
    case 'setHallSize':
      return setHallSize(o.width, o.depth);
    case 'addDoor':
      return addDoor(o.input);
    case 'deleteDoor':
      return deleteDoor(o.id);
    case 'placeTable':
      return saveTablePlace(o.id, o.x, o.y, o.rotationDeg);
    default:
      return { ok: false, error: 'Unknown change.' };
  }
}
