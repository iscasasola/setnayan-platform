'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent, fetchGroupMembershipsByEvent } from '@/lib/guests';
import {
  TABLE_TYPE_CATALOG,
  computeAutoSeat,
  effectiveCapacity,
  fetchAssignments,
  fetchFloorPlan,
  fetchTables,
  removedSeatSet,
  roleTier,
  type AutoSeatGuest,
  type TableType,
} from '@/lib/seating';

function clampPct(v: unknown): number | null {
  if (typeof v !== 'string' || v.length === 0) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

const VALID_TYPES = new Set<TableType>(TABLE_TYPE_CATALOG.map((t) => t.type));

function isValidTableType(value: unknown): value is TableType {
  return typeof value === 'string' && VALID_TYPES.has(value as TableType);
}

export async function createTable(formData: FormData) {
  const eventId = formData.get('event_id');
  const label = formData.get('table_label');
  const type = formData.get('table_type');
  const capacityRaw = formData.get('capacity');

  if (typeof eventId !== 'string' || typeof label !== 'string' || !isValidTableType(type)) {
    throw new Error('Invalid input');
  }
  const trimmed = label.trim();
  if (trimmed.length === 0 || trimmed.length > 64) {
    throw new Error('Label must be 1–64 chars');
  }
  // A table's capacity can't exceed its TYPE's seat count (a Sweetheart seats 2,
  // not 10). Cap at the type's defaultCapacity, not a global 32. (owner 2026-06-09)
  const typeSeats = TABLE_TYPE_CATALOG.find((t) => t.type === type)?.defaultCapacity ?? 8;
  const capacity = Math.max(
    1,
    Math.min(typeSeats, typeof capacityRaw === 'string' ? Number(capacityRaw) || typeSeats : typeSeats),
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('event_tables').insert({
    event_id: eventId,
    table_label: trimmed,
    table_type: type,
    capacity,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating`);
}

export async function deleteTable(formData: FormData) {
  const eventId = formData.get('event_id');
  const tableId = formData.get('table_id');
  if (typeof eventId !== 'string' || typeof tableId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_tables')
    .delete()
    .eq('table_id', tableId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating`);
}

export async function assignGuest(formData: FormData) {
  const eventId = formData.get('event_id');
  const tableId = formData.get('table_id');
  const guestId = formData.get('guest_id');
  if (
    typeof eventId !== 'string' ||
    typeof tableId !== 'string' ||
    typeof guestId !== 'string' ||
    guestId.length === 0
  ) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Optional seat number — lets the editor place a guest in a specific chair.
  // Clamped to a sane range; null when the caller just drops onto the table.
  const seatRaw = formData.get('seat_number');
  let seatNumber: number | null = null;
  if (typeof seatRaw === 'string' && seatRaw.length > 0) {
    const n = Number(seatRaw);
    if (Number.isInteger(n) && n >= 0 && n < 64) seatNumber = n;
  }

  const { error } = await supabase.from('event_seat_assignments').upsert(
    {
      event_id: eventId,
      table_id: tableId,
      guest_id: guestId,
      seat_number: seatNumber,
    },
    { onConflict: 'event_id,guest_id' },
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Seat a whole custom group at one table in a single tap. Seats every member
// who isn't already there into the table's open chairs, in the order given.
// Capacity is enforced server-side (seat-what-fits): if the group is bigger
// than the open seats, the overflow stays put and the count is returned so the
// editor can prompt for another table. Members already at the table keep their
// chair; members seated elsewhere are moved in (no other occupant is evicted).
export async function assignGroup(
  formData: FormData,
): Promise<{ seated: number; requested: number; overflow: number }> {
  const eventId = formData.get('event_id');
  const tableId = formData.get('table_id');
  const idsRaw = formData.get('guest_ids');
  if (typeof eventId !== 'string' || typeof tableId !== 'string' || typeof idsRaw !== 'string') {
    throw new Error('Invalid input');
  }

  let guestIds: string[];
  try {
    const parsed = JSON.parse(idsRaw);
    guestIds = Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string' && x.length > 0)
      : [];
  } catch {
    throw new Error('Invalid guest list');
  }
  if (guestIds.length === 0) return { seated: 0, requested: 0, overflow: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [tables, assignments] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
  ]);
  const table = tables.find((t) => t.table_id === tableId);
  if (!table) throw new Error('Table not found');

  // Current occupants of the target table — we never evict them, so the seats
  // they hold are off-limits and they count against capacity. Deleted chairs
  // (removed_seats) are pre-marked taken so the group never fills them.
  const occupiedSeats = removedSeatSet(table.removed_seats, table.capacity);
  const alreadyHere = new Set<string>();
  for (const a of assignments) {
    if (a.table_id !== tableId) continue;
    alreadyHere.add(a.guest_id);
    if (a.seat_number !== null && a.seat_number >= 0) occupiedSeats.add(a.seat_number);
  }

  // Members still needing a chair here (already-seated members keep theirs).
  // Free seats = effective (occupiable) capacity minus who's already here.
  const incoming = guestIds.filter((id) => !alreadyHere.has(id));
  const free = Math.max(0, effectiveCapacity(table.capacity, table.removed_seats) - alreadyHere.size);
  const toSeat = incoming.slice(0, free);

  let seat = 0;
  const rows = toSeat.map((guestId) => {
    while (occupiedSeats.has(seat)) seat++;
    occupiedSeats.add(seat);
    return { event_id: eventId, table_id: tableId, guest_id: guestId, seat_number: seat };
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from('event_seat_assignments')
      .upsert(rows, { onConflict: 'event_id,guest_id' });
    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/${eventId}/seating`);
  }

  return {
    seated: rows.length + (guestIds.length - incoming.length),
    requested: guestIds.length,
    overflow: incoming.length - toSeat.length,
  };
}

// Role-tier auto-seat: fills every unseated, attending guest into the nearest
// tables to the stage, tier by tier. Idempotent — never moves a guest who is
// already seated, never touches a sweetheart table, never seats the couple.
export async function autoSeatGuests(formData: FormData) {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [tables, assignments, guests, floorPlan, memberships] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
    fetchFloorPlan(supabase, eventId),
    fetchGroupMembershipsByEvent(supabase, eventId),
  ]);

  const autoSeatGuestList: AutoSeatGuest[] = guests.map((g) => ({
    guest_id: g.guest_id,
    role: g.role,
    group_category: g.group_category,
    rsvp_status: g.rsvp_status,
    plus_one_of_guest_id: g.plus_one_of_guest_id,
    last_name: g.last_name,
    first_name: g.first_name,
    // Primary group = first membership, mirroring how the editor colours a
    // guest, so auto-seat clusters the same groups the couple sees.
    group_id: memberships.get(g.guest_id)?.[0] ?? null,
  }));

  // Anchor the role-tier rings on where the couple actually placed the stage.
  const rows = computeAutoSeat(tables, autoSeatGuestList, assignments, {
    x: floorPlan.stage_x,
    y: floorPlan.stage_y,
  });
  if (rows.length > 0) {
    const { error } = await supabase.from('event_seat_assignments').insert(
      rows.map((r) => ({
        event_id: eventId,
        table_id: r.table_id,
        guest_id: r.guest_id,
        seat_number: r.seat_number,
      })),
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Save the floor-plan markers (stage position + the single entrance door).
// Upserts the per-event singleton row; coords are clamped to 0–100 percent.
export async function saveFloorPlan(formData: FormData) {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('Invalid input');
  }
  const stageX = clampPct(formData.get('stage_x'));
  const stageY = clampPct(formData.get('stage_y'));
  const entranceX = clampPct(formData.get('entrance_x'));
  const entranceY = clampPct(formData.get('entrance_y'));
  const entranceEnabled = formData.get('entrance_enabled') === 'true';

  // Venue dimensions (metres) — null when the couple hasn't set a room size.
  const parseDim = (v: FormDataEntryValue | null): number | null => {
    if (typeof v !== 'string' || v.length === 0) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(500, n);
  };
  const venueWidth = parseDim(formData.get('venue_width_m'));
  const venueLength = parseDim(formData.get('venue_length_m'));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('event_floor_plan').upsert(
    {
      event_id: eventId,
      stage_x: stageX ?? 50,
      stage_y: stageY ?? 6,
      entrance_enabled: entranceEnabled,
      entrance_x: entranceX ?? 50,
      entrance_y: entranceY ?? 94,
      venue_width_m: venueWidth,
      venue_length_m: venueLength,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id' },
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating`);
}

export async function updateTablePosition(formData: FormData) {
  const eventId = formData.get('event_id');
  const tableId = formData.get('table_id');
  const xRaw = formData.get('x_pos');
  const yRaw = formData.get('y_pos');
  if (
    typeof eventId !== 'string' ||
    typeof tableId !== 'string' ||
    typeof xRaw !== 'string' ||
    typeof yRaw !== 'string'
  ) {
    throw new Error('Invalid input');
  }
  const x = Number(xRaw);
  const y = Number(yRaw);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error('Position must be numeric');
  }
  // Positions are stored as percent of the canvas; on the free auto-grow board
  // they can exceed 0–100 (the board grows outward as tables are added), so
  // clamp only to a generous safety range, not the viewport.
  const clampedX = Math.max(-300, Math.min(900, x));
  const clampedY = Math.max(-300, Math.min(900, y));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_tables')
    .update({ x_pos: clampedX, y_pos: clampedY, updated_at: new Date().toISOString() })
    .eq('table_id', tableId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating`);
}

export async function unassignGuest(formData: FormData) {
  const eventId = formData.get('event_id');
  const guestId = formData.get('guest_id');
  if (typeof eventId !== 'string' || typeof guestId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_seat_assignments')
    .delete()
    .eq('event_id', eventId)
    .eq('guest_id', guestId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Set a table's orientation (0–359°). Lets couples rotate a table so wedges /
// banquets can be connected edge-to-edge into custom patterns.
export async function updateTableRotation(formData: FormData) {
  const eventId = formData.get('event_id');
  const tableId = formData.get('table_id');
  const degRaw = formData.get('rotation_deg');
  if (typeof eventId !== 'string' || typeof tableId !== 'string' || typeof degRaw !== 'string') {
    throw new Error('Invalid input');
  }
  const n = Number(degRaw);
  if (!Number.isFinite(n)) throw new Error('Rotation must be numeric');
  const rotation = ((Math.round(n) % 360) + 360) % 360; // normalise to 0–359

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_tables')
    .update({ rotation_deg: rotation, updated_at: new Date().toISOString() })
    .eq('table_id', tableId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Delete or restore a single chair at a table (toggles membership of
// removed_seats). Clears the edge where two tables connect. Refuses to delete a
// seat that's currently occupied — unseat the guest first.
export async function setTableSeat(formData: FormData) {
  const eventId = formData.get('event_id');
  const tableId = formData.get('table_id');
  const seatRaw = formData.get('seat_number');
  const removed = formData.get('removed') === 'true';
  if (typeof eventId !== 'string' || typeof tableId !== 'string' || typeof seatRaw !== 'string') {
    throw new Error('Invalid input');
  }
  const seat = Number(seatRaw);
  if (!Number.isInteger(seat) || seat < 0 || seat >= 64) throw new Error('Invalid seat');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [tables, assignments] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
  ]);
  const table = tables.find((t) => t.table_id === tableId);
  if (!table) throw new Error('Table not found');

  // Can't delete a chair someone is sitting in.
  if (removed) {
    const occupied = assignments.some((a) => a.table_id === tableId && a.seat_number === seat);
    if (occupied) throw new Error('Unseat the guest before removing this chair');
  }

  const next = new Set(removedSeatSet(table.removed_seats, table.capacity));
  if (removed) next.add(seat);
  else next.delete(seat);

  const { error } = await supabase
    .from('event_tables')
    .update({ removed_seats: [...next].sort((a, b) => a - b), updated_at: new Date().toISOString() })
    .eq('table_id', tableId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Publish the seating pack: stamp every table + the floor plan as published so
// the print pack (table sign sheets carrying each table's QR, + guest place
// cards) is ready for the venue. Idempotent — table qr_tokens already exist from
// creation and are NEVER re-rolled here (a sign already at the venue keeps
// working); publishing only stamps the "last published" timestamps. Returns the
// table count so the editor can confirm. RLS scopes every write to the couple.
export async function publishSeating(formData: FormData): Promise<{ published: number }> {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now = new Date().toISOString();

  // Stamp all of the event's tables (RLS limits this to the couple's own event).
  const { data: stamped, error: tablesErr } = await supabase
    .from('event_tables')
    .update({ qr_published_at: now, updated_at: now })
    .eq('event_id', eventId)
    .select('table_id');
  if (tablesErr) throw new Error(tablesErr.message);

  // Stamp the per-event floor-plan singleton (create the row if it doesn't exist
  // yet, preserving the default stage/entrance positions).
  const { error: planErr } = await supabase
    .from('event_floor_plan')
    .upsert({ event_id: eventId, published_at: now, updated_at: now }, { onConflict: 'event_id' });
  if (planErr) throw new Error(planErr.message);

  revalidatePath(`/dashboard/${eventId}/seating`);
  revalidatePath(`/dashboard/${eventId}/seating/print`);
  return { published: stamped?.length ?? 0 };
}

// Rename a table (the per-table popup's inline rename). Mirrors
// updateTableRotation: a single guarded UPDATE under the couple's RLS.
// `table_label` already exists — no schema change. Trim + 1–64 chars, matching
// createTable's validation.
export async function updateTableLabel(formData: FormData) {
  const eventId = formData.get('event_id');
  const tableId = formData.get('table_id');
  const labelRaw = formData.get('table_label');
  if (typeof eventId !== 'string' || typeof tableId !== 'string' || typeof labelRaw !== 'string') {
    throw new Error('Invalid input');
  }
  // Strip control characters (NULL/newline/tab/…) — they'd survive into the
  // printed sign sheets and break the HTML layout. esc() covers entities only.
  // eslint-disable-next-line no-control-regex
  const label = labelRaw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (label.length === 0 || label.length > 64) throw new Error('Label must be 1–64 chars');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_tables')
    .update({ table_label: label, updated_at: new Date().toISOString() })
    .eq('table_id', tableId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Seat a whole ROLE TIER's unseated, attending guests at one table in a single
// tap (the popup's "Role" picker). Tiers mirror the auto-seat rings (roleTier):
// 1 = family + principal sponsors · 2 = entourage · 3 = extended family ·
// 4 = friends & others. Seat-what-fits in name order; overflow stays unseated
// and the count is returned so the editor can prompt for another table. Never
// evicts a current occupant, never fills a removed chair, never seats the couple.
export async function seatRoleAtTable(
  formData: FormData,
): Promise<{ seated: number; requested: number; overflow: number }> {
  const eventId = formData.get('event_id');
  const tableId = formData.get('table_id');
  const tierRaw = formData.get('tier');
  if (typeof eventId !== 'string' || typeof tableId !== 'string' || typeof tierRaw !== 'string') {
    throw new Error('Invalid input');
  }
  const tier = Number(tierRaw);
  if (![1, 2, 3, 4].includes(tier)) throw new Error('Invalid tier');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [tables, assignments, guests] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
  ]);
  const table = tables.find((t) => t.table_id === tableId);
  if (!table) throw new Error('Table not found');

  // Eligible = attending, in this tier, not the couple, not already seated anywhere.
  const seatedIds = new Set(assignments.map((a) => a.guest_id));
  const eligible = guests
    .filter(
      (g) =>
        g.rsvp_status === 'attending' &&
        g.role !== 'bride' &&
        g.role !== 'groom' &&
        !seatedIds.has(g.guest_id) &&
        roleTier(g.role, g.group_category) === tier,
    )
    .sort((a, b) =>
      `${a.last_name} ${a.first_name}`
        .toLowerCase()
        .localeCompare(`${b.last_name} ${b.first_name}`.toLowerCase()),
    );
  if (eligible.length === 0) return { seated: 0, requested: 0, overflow: 0 };

  // Open chairs = effective capacity minus current occupants; skip removed +
  // already-taken seat numbers so the fill never collides.
  const occupiedSeats = removedSeatSet(table.removed_seats, table.capacity);
  let here = 0;
  for (const a of assignments) {
    if (a.table_id !== tableId) continue;
    here += 1;
    if (a.seat_number !== null && a.seat_number >= 0) occupiedSeats.add(a.seat_number);
  }
  const free = Math.max(0, effectiveCapacity(table.capacity, table.removed_seats) - here);
  const toSeat = eligible.slice(0, free);

  let seat = 0;
  const rows = toSeat.map((g) => {
    while (occupiedSeats.has(seat)) seat++;
    occupiedSeats.add(seat);
    return { event_id: eventId, table_id: tableId, guest_id: g.guest_id, seat_number: seat };
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from('event_seat_assignments')
      .upsert(rows, { onConflict: 'event_id,guest_id' });
    if (error) throw new Error(error.message);
    revalidatePath(`/dashboard/${eventId}/seating`);
  }

  return { seated: rows.length, requested: eligible.length, overflow: eligible.length - rows.length };
}
