'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { vendorPaywallApplies } from '@/lib/vendor-feature-gate';
import { SUPPLIER_FLOOR_PLAN_MIN_TIER, planFromShopPlan, validatePlan } from '@/lib/seat-plan-engine';
import { readSpaces, type SpacesRead } from '@/lib/spaces.server';
import {
  MAX_COUNT,
  MAX_SPACE_NAME,
  bookedWhole,
  cleanDetails,
  clothingCount,
  isSpaceKind,
  namesForRun,
  type NameRun,
  type SpaceDetails,
  type SpaceKind,
} from '@/lib/spaces';
import {
  MAX_CHAIRS,
  isAlong,
  isDoorKind,
  isTableShape,
  isWall,
  lineUp,
  parseRoomSize,
  parseUnitNames,
  shopPlanOf,
  type Along,
  type DoorKind,
  type TableShape,
  type Wall,
} from '@/lib/space-tables';

/**
 * 🏛 SPACES — every write on Shop › Spaces (owner 19 Nov; build drawing specs prototypes/spaces_final_screens_2026-11-19.html).
 *
 * A space is a `vendor_schedule_pools` row with a kind (migration 20271356372536). Each op saves, then hands back the
 * page's ONE read (`readSpaces`) for the day the supplier is looking at, so a save never resets the screen.
 *
 * 🔒 Pro locks, checked HERE as well as on the page (a lock that is only drawn is not a lock): typed names, renaming and
 * numbering by floor are on every paid plan (DECISION_LOG 19 Nov "Naming + shared floors APPROVED"; 22 Nov "SAME FEATURES IN EVERY SIZE"); the drawn floor plan too.
 * Both open for every shop while `VENDOR_TIER_FEATURE_GATE` is off (`vendorPaywallApplies`).
 * 🔒 "A booked space can be closed, never removed": removing one with a booking today or later is refused.
 *
 * Moved from #7968's `rooms-seating/actions.ts` (its one export becomes this one), so the action budget does not grow.
 */
export type SpacesResult = { ok: true; read: SpacesRead } | { ok: false; error: string };

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
type Shop = NonNullable<Awaited<ReturnType<typeof shop>>>;

async function fresh(s: Shop, date: string): Promise<SpacesResult> {
  const read = await readSpaces(s.supabase, s.profile.vendor_profile_id, date);
  if (!read) return { ok: false, error: 'Saved, but we couldn’t read your spaces back. Open the page again.' };
  return { ok: true, read };
}

const NO_SHOP: SpacesResult = { ok: false, error: 'Sign in to your shop first.' };

/** A write that matched no row (RLS, or a stale id) changed nothing: it must never read as saved (ship review 21 Nov). */
const NOT_YOURS: SpacesResult = { ok: false, error: 'You can’t change this. Open the page again.' };
function changedNothing(data: unknown): boolean {
  return !Array.isArray(data) || data.length === 0;
}

/** `ilike` treats % and _ as wildcards: a name is matched as it is typed, never as a pattern. */
function likeExactly(name: string): string {
  return name.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Words for a database refusal — never the raw message. */
function said(error: { code?: string; message?: string } | null): string {
  if (!error) return '';
  if (error.code === '23505') return 'That name is already used here. Each one needs its own name.';
  if (/space_connects_not_yours/.test(error.message ?? '')) return 'A hall connects only to another of your halls or rooms.';
  if (error.code === '42501' || /row-level security|unit_space_not_yours/.test(error.message ?? '')) return 'Only the shop’s owner can change its spaces.';
  return 'Couldn’t save just now. Try again.';
}

/** Every paid plan, from Plus (or the paywall switch off): own names, renaming, numbering by floor, the drawn floor plan. */
async function proOpen(s: Shop): Promise<boolean> {
  const { data } = await s.supabase.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', s.profile.vendor_profile_id).maybeSingle();
  const tier = (data as { tier_state?: string | null } | null)?.tier_state ?? null;
  // A refused tier read reads as below Pro: the lock holds, never a wrong "you have it".
  return !vendorPaywallApplies(isTierAtLeast(tier, SUPPLIER_FLOOR_PLAN_MIN_TIER));
}

const PRO_ONLY = 'Your own names come with Pro.';

/* ── Spaces ──────────────────────────────────────────────────────────────────────────────────────────────────── */

export type SpaceInput = {
  kind: SpaceKind;
  /** How many to add (a numbered run past 1). Counted kinds always add ONE row with a count. */
  howMany: number;
  run: NameRun;
  seated?: string;
  standing?: string;
  width?: string;
  length?: string;
  connectsTo?: string | null;
  /** Rooms: the floor the run is on (2 = "2F"). */
  floorLevel?: number | null;
  /** Counted kinds: how many owned · in repair. Clothing's count is its sizes. */
  owned?: number;
  inRepair?: number;
  details?: SpaceDetails;
};

const guests = (raw: unknown): number | null | 'bad' => {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : 'bad';
};

/** The columns a space's sheet writes, checked in words before the database's CHECKs say the same. */
function columnsOf(input: Omit<SpaceInput, 'howMany' | 'run'>): { cols: Record<string, unknown> } | { error: string } {
  const kind = input.kind;
  const whole = bookedWhole(kind);
  const out: Record<string, unknown> = { space_kind: kind, is_hall: whole, is_vendor_created: true };
  const seated = guests(input.seated);
  const standing = guests(input.standing);
  if (seated === 'bad' || standing === 'bad') return { error: 'Guests: a number from 1 to 100,000.' };
  out.seated_capacity = kind === 'hall' || kind === 'room' ? seated : null;
  out.standing_capacity = kind === 'hall' || kind === 'room' ? standing : null;
  const size = parseRoomSize(input.width ?? '', input.length ?? '');
  if (!size.ok) return { error: size.error };
  out.space_width_m = size.widthM;
  out.space_length_m = size.lengthM;
  out.connects_to_pool_id = (kind === 'hall' || kind === 'room') && input.connectsTo ? input.connectsTo : null;
  const details = cleanDetails(kind, input.details);
  out.space_details = details;
  if (whole) {
    out.space_count = null;
    out.in_repair_count = 0;
  } else {
    const owned = kind === 'clothing' ? clothingCount(details.sizes) : Math.floor(Number(input.owned));
    if (!Number.isInteger(owned) || owned < 1 || owned > MAX_COUNT) return { error: kind === 'clothing' ? 'Add at least one size.' : `How many you own: 1 to ${MAX_COUNT.toLocaleString('en-PH')}.` };
    const repair = Math.floor(Number(input.inRepair ?? 0));
    if (!Number.isInteger(repair) || repair < 0 || repair > owned) return { error: 'In repair can’t be more than you own.' };
    out.space_count = owned;
    out.in_repair_count = repair;
  }
  return { cols: out };
}

/**
 * "Connects to" is saved both ways: the other hall points back, and whoever pointed at either of them before lets go —
 * so no hall is left pointing one way at a hall that now connects elsewhere (ship review 21 Nov).
 */
async function connectBothWays(s: Shop, id: string, to: string | null): Promise<string> {
  const v = s.profile.vendor_profile_id;
  const { error: a } = await s.supabase.from('vendor_schedule_pools').update({ connects_to_pool_id: null }).eq('vendor_profile_id', v).eq('connects_to_pool_id', id).neq('pool_id', to ?? id);
  if (a) return said(a);
  if (!to) return '';
  const { error: c } = await s.supabase.from('vendor_schedule_pools').update({ connects_to_pool_id: null }).eq('vendor_profile_id', v).eq('connects_to_pool_id', to).neq('pool_id', id);
  if (c) return said(c);
  const { data, error: b } = await s.supabase.from('vendor_schedule_pools').update({ connects_to_pool_id: id }).eq('vendor_profile_id', v).eq('pool_id', to).select('pool_id');
  if (b) return said(b);
  return changedNothing(data) ? 'That hall is no longer here. Open the page again.' : '';
}

async function addSpaces(input: SpaceInput, date: string): Promise<SpacesResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  if (!isSpaceKind(input.kind)) return { ok: false, error: 'Pick what you rent out.' };
  const run = input.run ?? { naming: 'generic' };
  if (run.naming !== 'generic' && !(await proOpen(s))) return { ok: false, error: PRO_ONLY };
  const made0 = columnsOf(input);
  if ('error' in made0) return { ok: false, error: made0.error };
  const cols = made0.cols;
  // Counted kinds are one row with a count ("Chairs · 200"); booked-whole kinds a numbered run ("Room001 … Room012").
  const howMany = bookedWhole(input.kind) ? Math.floor(Number(input.howMany) || 1) : 1;
  const { data: mine, error: readErr } = await s.supabase.from('vendor_schedule_pools').select('calendar_name').eq('vendor_profile_id', s.profile.vendor_profile_id).eq('is_active', true);
  if (readErr) return { ok: false, error: 'Couldn’t check your names just now. Nothing was saved.' };
  const existing = ((mine ?? []) as { calendar_name: string | null }[]).map((r) => r.calendar_name ?? '').filter(Boolean);
  const names = namesForRun(input.kind, existing, howMany, { ...run, floorLevel: input.floorLevel ?? run.floorLevel });
  if (!names.ok) return { ok: false, error: names.error };
  const floor = input.kind === 'room' && input.floorLevel ? (input.floorLevel <= 1 ? 'G' : `${input.floorLevel}F`) : null;
  const rows = names.names.map((name) => ({ ...cols, vendor_profile_id: s.profile.vendor_profile_id, calendar_name: name, pool_label: name, daily_booking_capacity: 1, floor_label: floor }));
  const { data: made, error } = await s.supabase.from('vendor_schedule_pools').insert(rows).select('pool_id');
  if (error) return { ok: false, error: said(error) };
  const first = ((made ?? []) as { pool_id: string }[])[0]?.pool_id;
  if (first && cols.connects_to_pool_id) {
    const e = await connectBothWays(s, first, cols.connects_to_pool_id as string);
    if (e) return { ok: false, error: e };
  }
  revalidateShopPage(s.profile.vendor_profile_id, s.profile.business_slug);
  // A card's "add the first" (screen 8) is answered with the card's own Uses row, in this same response.
  revalidatePath('/vendor-dashboard/services/[serviceId]', 'page');
  return fresh(s, date);
}

async function updateSpace(input: Omit<SpaceInput, 'howMany' | 'run'> & { id: string; name?: string }, date: string): Promise<SpacesResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  if (!isSpaceKind(input.kind)) return { ok: false, error: 'Pick what you rent out.' };
  const { data: now, error: nowErr } = await s.supabase
    .from('vendor_schedule_pools')
    .select('pool_id, calendar_name, space_kind')
    .eq('pool_id', input.id)
    .eq('vendor_profile_id', s.profile.vendor_profile_id)
    .maybeSingle();
  if (nowErr || !now) return { ok: false, error: 'That space is no longer here. Open the page again.' };
  const was = now as { calendar_name: string | null; space_kind: string | null };
  // A space keeps its kind: a hall that is booked as a hall never turns into a counted object.
  if (was.space_kind !== input.kind) return { ok: false, error: 'A space keeps its kind. Add a new one instead.' };
  const made0 = columnsOf(input);
  if ('error' in made0) return { ok: false, error: made0.error };
  const cols = made0.cols;
  const patch: Record<string, unknown> = { ...cols, updated_at: new Date().toISOString() };
  const name = input.name?.trim().replace(/\s+/g, ' ');
  if (name !== undefined && name !== (was.calendar_name ?? '')) {
    if (!(await proOpen(s))) return { ok: false, error: 'Renaming comes with every paid plan.' };
    if (!name || name.length > MAX_SPACE_NAME) return { ok: false, error: `A name, up to ${MAX_SPACE_NAME} letters.` };
    const { data: same } = await s.supabase.from('vendor_schedule_pools').select('pool_id').eq('vendor_profile_id', s.profile.vendor_profile_id).eq('is_active', true).ilike('calendar_name', likeExactly(name)).neq('pool_id', input.id).limit(1);
    if ((same ?? []).length > 0) return { ok: false, error: `${name} is already a name in your shop.` };
    // Renaming never breaks a booking: a booking holds the space's id, never its name.
    patch.calendar_name = name;
    patch.pool_label = name;
  }
  const { data: saved, error } = await s.supabase.from('vendor_schedule_pools').update(patch).eq('pool_id', input.id).eq('vendor_profile_id', s.profile.vendor_profile_id).select('pool_id');
  if (error) return { ok: false, error: said(error) };
  if (changedNothing(saved)) return NOT_YOURS;
  const e = await connectBothWays(s, input.id, (cols.connects_to_pool_id as string | null) ?? null);
  if (e) return { ok: false, error: e };
  revalidateShopPage(s.profile.vendor_profile_id, s.profile.business_slug);
  return fresh(s, date);
}

/** Remove a space — refused while anything holds it today or later ("A booked space can be closed, never removed"). */
async function removeSpace(id: string, date: string): Promise<SpacesResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const [held, uses] = await Promise.all([
    s.supabase.from('vendor_schedule_pool_bookings').select('pool_booking_id', { count: 'exact', head: true }).eq('pool_id', id).is('released_at', null).gte('booked_date', today),
    s.supabase.from('vendor_service_halls').select('vendor_service_id', { count: 'exact', head: true }).eq('pool_id', id),
  ]);
  if (held.error || uses.error) return { ok: false, error: 'Couldn’t check its bookings just now. Nothing was removed.' };
  if ((held.count ?? 0) > 0) return { ok: false, error: 'It is booked. Close its dates instead; it can’t be removed.' };
  if ((uses.count ?? 0) > 0) return { ok: false, error: 'A service card uses it. Take it off the card first.' };
  // Soft, as every schedule is: is_active off. Its tables and doors go with it from the screen.
  const { data: gone, error } = await s.supabase.from('vendor_schedule_pools').update({ is_active: false, connects_to_pool_id: null, updated_at: new Date().toISOString() }).eq('pool_id', id).eq('vendor_profile_id', s.profile.vendor_profile_id).select('pool_id');
  if (error) return { ok: false, error: said(error) };
  if (changedNothing(gone)) return NOT_YOURS;
  // Whoever connected to it lets go too; a refusal here is said, never swallowed.
  const e = await connectBothWays(s, id, null);
  if (e) return { ok: false, error: e };
  revalidateShopPage(s.profile.vendor_profile_id, s.profile.business_slug);
  return fresh(s, date);
}

/**
 * ↩ B4 (drawing final-check-area-7 § 4b, approved 25 Nov): UNDO a removal. A removal is a soft switch-off
 * (`is_active = false`, its "connects to" cleared), so Undo switches the same space back on and puts its connection
 * back; its tables and doors were never deleted. Only a space of THIS shop that is switched off comes back; a refused
 * or missing row says so in words.
 */
async function restoreSpace(id: string, connectsTo: string | null, date: string): Promise<SpacesResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const { data: back, error } = await s.supabase
    .from('vendor_schedule_pools')
    .update({ is_active: true, connects_to_pool_id: connectsTo, updated_at: new Date().toISOString() })
    .eq('pool_id', id)
    .eq('vendor_profile_id', s.profile.vendor_profile_id)
    .eq('is_active', false)
    .select('pool_id');
  if (error) return { ok: false, error: said(error) };
  if (changedNothing(back)) return { ok: false, error: 'That space can’t come back now. Open the page again.' };
  if (connectsTo) {
    const e = await connectBothWays(s, id, connectsTo);
    if (e) return { ok: false, error: e };
  }
  revalidateShopPage(s.profile.vendor_profile_id, s.profile.business_slug);
  return fresh(s, date);
}

/* ── Tables and doors in a hall or room (#7968, hung on a space) ─────────────────────────────────────────────── */

function tableFields(shape: unknown, chairs: unknown, ends: unknown): { shape: TableShape; chairs: number; ends: boolean } | { error: string } {
  if (!isTableShape(shape)) return { error: 'Pick a type of table.' };
  const n = Number(chairs);
  if (!Number.isInteger(n) || n < 1 || n > MAX_CHAIRS) return { error: `Chairs: 1 to ${MAX_CHAIRS}.` };
  return { shape, chairs: n, ends: shape === 'long' && ends === true };
}

async function addTables(input: { spaceId: string; names: string; shape: TableShape; chairs: number; ends: boolean }, date: string): Promise<SpacesResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const parsed = parseUnitNames(input.names);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const t = tableFields(input.shape, input.chairs, input.ends);
  if ('error' in t) return { ok: false, error: t.error };
  const { data: last } = await s.supabase.from('vendor_units').select('sort_order').eq('pool_id', input.spaceId).order('sort_order', { ascending: false }).limit(1);
  const start = ((last as { sort_order: number }[] | null)?.[0]?.sort_order ?? -1) + 1;
  const rows = parsed.names.map((name, i) => ({
    vendor_profile_id: s.profile.vendor_profile_id,
    pool_id: input.spaceId,
    kind: 'table',
    name,
    table_shape: t.shape,
    chairs: t.chairs,
    chairs_at_ends: t.ends,
    sort_order: start + i,
  }));
  const { error } = await s.supabase.from('vendor_units').insert(rows);
  if (error) return { ok: false, error: said(error) };
  return fresh(s, date);
}

async function updateTable(input: { id: string; name: string; shape: TableShape; chairs: number; ends: boolean }, date: string): Promise<SpacesResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const name = String(input.name ?? '').trim();
  const one = parseUnitNames(name);
  if (!one.ok || one.names.length !== 1 || one.names[0] !== name) return { ok: false, error: 'Give it one name or number.' };
  const t = tableFields(input.shape, input.chairs, input.ends);
  if ('error' in t) return { ok: false, error: t.error };
  const { data, error } = await s.supabase
    .from('vendor_units')
    .update({ name, table_shape: t.shape, chairs: t.chairs, chairs_at_ends: t.ends })
    .eq('unit_id', input.id)
    .eq('vendor_profile_id', s.profile.vendor_profile_id)
    .select('unit_id');
  if (error) return { ok: false, error: said(error) };
  if (changedNothing(data)) return NOT_YOURS;
  return fresh(s, date);
}

async function deleteTable(id: string, date: string): Promise<SpacesResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const { data, error } = await s.supabase.from('vendor_units').delete().eq('unit_id', id).eq('vendor_profile_id', s.profile.vendor_profile_id).select('unit_id');
  if (error) return { ok: false, error: said(error) };
  if (changedNothing(data)) return NOT_YOURS;
  return fresh(s, date);
}

/** Line up (Grid): a hall's tables back in name order. */
async function lineUpTables(spaceId: string, date: string): Promise<SpacesResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const now = await readSpaces(s.supabase, s.profile.vendor_profile_id, date);
  if (!now) return { ok: false, error: 'Couldn’t read your tables just now. Try again.' };
  const ids = lineUp(now.tables.units.filter((u) => u.groupId === spaceId)).get(spaceId) ?? [];
  for (let i = 0; i < ids.length; i++) {
    const { data, error } = await s.supabase.from('vendor_units').update({ sort_order: i }).eq('unit_id', ids[i]!).eq('vendor_profile_id', s.profile.vendor_profile_id).select('unit_id');
    if (error) return { ok: false, error: said(error) };
    if (changedNothing(data)) return NOT_YOURS;
  }
  return fresh(s, date);
}

async function addDoor(input: { spaceId: string; kind: DoorKind; wall: Wall; along: Along }, date: string): Promise<SpacesResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  if (!isDoorKind(input.kind) || !isWall(input.wall) || !isAlong(input.along)) return { ok: false, error: 'Pick the door, its wall and where along it.' };
  const { error } = await s.supabase.from('vendor_unit_doors').insert({
    vendor_profile_id: s.profile.vendor_profile_id,
    pool_id: input.spaceId,
    door_kind: input.kind,
    wall: input.wall,
    along: input.along,
  });
  if (error) return { ok: false, error: said(error) };
  return fresh(s, date);
}

async function deleteDoor(id: string, date: string): Promise<SpacesResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  const { data, error } = await s.supabase.from('vendor_unit_doors').delete().eq('door_id', id).eq('vendor_profile_id', s.profile.vendor_profile_id).select('door_id');
  if (error) return { ok: false, error: said(error) };
  if (changedNothing(data)) return NOT_YOURS;
  return fresh(s, date);
}

/** The shared seat-plan core's Move: one table's place on its hall's plan (event_tables' sense, 0-100 % and degrees). */
async function placeTable(id: string, x: number, y: number, rotationDeg: number, date: string): Promise<SpacesResult> {
  const s = await shop();
  if (!s) return NO_SHOP;
  if (!(await proOpen(s))) return { ok: false, error: 'The floor plan comes with every paid plan.' };
  const ok = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi;
  if (!ok(x, 0, 100) || !ok(y, 0, 100) || !ok(rotationDeg, -360, 360)) return { ok: false, error: 'That place is off the plan.' };
  // ONE check before a save (ADAPTER.md §5): the engine's validatePlan — a supplier floor refuses exactly what an
  // event floor refuses. Only this table's overlap / outside refuses the move.
  const now = await readSpaces(s.supabase, s.profile.vendor_profile_id, date);
  // A refused re-read never skips the check (ship review 21 Nov): the move is refused instead.
  if (!now) return { ok: false, error: 'Couldn’t check the plan just now. Nothing was moved.' };
  const unit = now.tables.units.find((u) => u.id === id);
  if (!unit) return NOT_YOURS;
  const moved = { ...now.tables, units: now.tables.units.map((u) => (u.id === id ? { ...u, x, y, rotationDeg } : u)) };
  const area = shopPlanOf(moved, unit.groupId);
  const bad = area ? validatePlan(planFromShopPlan(area)).find((p) => (p.kind === 'overlap' || p.kind === 'outside') && p.tableId === id) : undefined;
  if (bad) return { ok: false, error: bad.words };
  const { data, error } = await s.supabase
    .from('vendor_units')
    .update({ x_pos: x, y_pos: y, rotation_deg: Math.round(rotationDeg) })
    .eq('unit_id', id)
    .eq('vendor_profile_id', s.profile.vendor_profile_id)
    .select('unit_id');
  if (error) return { ok: false, error: said(error) };
  if (changedNothing(data)) return NOT_YOURS;
  return fresh(s, date);
}

/**
 * THE ONE EXPORT (`scripts/lint-server-action-budget.mjs`: "reuse … instead of exporting a new one") — every Spaces
 * write goes through this dispatcher, one op at a time. `date` is the day the screen is showing, so the read that comes
 * back draws the same tiles.
 */
export type SpacesOp =
  | { op: 'addSpaces'; input: SpaceInput }
  | { op: 'updateSpace'; input: Parameters<typeof updateSpace>[0] }
  | { op: 'removeSpace'; id: string }
  | { op: 'restoreSpace'; id: string; connectsTo: string | null }
  | { op: 'addTables'; input: Parameters<typeof addTables>[0] }
  | { op: 'updateTable'; input: Parameters<typeof updateTable>[0] }
  | { op: 'deleteTable'; id: string }
  | { op: 'lineUp'; spaceId: string }
  | { op: 'addDoor'; input: Parameters<typeof addDoor>[0] }
  | { op: 'deleteDoor'; id: string }
  | { op: 'placeTable'; id: string; x: number; y: number; rotationDeg: number }
  | { op: 'read' };

export async function spacesWrite(o: SpacesOp, date: string): Promise<SpacesResult> {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  switch (o.op) {
    case 'addSpaces':
      return addSpaces(o.input, day);
    case 'updateSpace':
      return updateSpace(o.input, day);
    case 'removeSpace':
      return removeSpace(o.id, day);
    case 'restoreSpace':
      return restoreSpace(o.id, o.connectsTo, day);
    case 'addTables':
      return addTables(o.input, day);
    case 'updateTable':
      return updateTable(o.input, day);
    case 'deleteTable':
      return deleteTable(o.id, day);
    case 'lineUp':
      return lineUpTables(o.spaceId, day);
    case 'addDoor':
      return addDoor(o.input, day);
    case 'deleteDoor':
      return deleteDoor(o.id, day);
    case 'placeTable':
      return placeTable(o.id, o.x, o.y, o.rotationDeg, day);
    case 'read': {
      // The date pick: the same read for another day (no write). A read, not a save, so nothing is revalidated.
      const s = await shop();
      if (!s) return NO_SHOP;
      // A7-13: a refused read on a date pick is a read, never "Saved, but…" — nothing was saved.
      const read = await readSpaces(s.supabase, s.profile.vendor_profile_id, day);
      return read ? { ok: true, read } : { ok: false, error: 'Couldn’t read that day just now. The tiles still show the day before.' };
    }
    default:
      return { ok: false, error: 'Unknown change.' };
  }
}
