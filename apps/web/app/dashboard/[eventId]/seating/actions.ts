'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent, fetchGroupMembershipsByEvent } from '@/lib/guests';
import { SeatingLockError } from './seating-lock-error';
import {
  BOOTH_CATALOG,
  TABLE_TYPE_CATALOG,
  computeAutoSeat,
  effectiveCapacity,
  fetchAssignments,
  fetchFloorPlan,
  fetchTables,
  removedSeatSet,
  roleTier,
  type AutoSeatGuest,
  type BoothType,
  type TableType,
} from '@/lib/seating';

function clampPct(v: unknown): number | null {
  if (typeof v !== 'string' || v.length === 0) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

// ---------------------------------------------------------------------------
// Exclusive seating-editor lock (PR 2 · owner lock 2026-06-13) — one editor at
// a time per event, co-owners included. Enforcement lives HERE in the
// server-action layer (not RLS): assertSeatingLockHeld() calls the DB guard
// (server-clock 90s cutoff) BEFORE every mutation, so a peer who took over (or
// whose own lock went stale) gets a typed, recoverable error instead of an
// opaque RLS denial. The editor reads this error code to drop to view-only.
// (SeatingLockError lives in its own module — a 'use server' file may only
// export async functions, so the class can't be declared/exported here.)
// ---------------------------------------------------------------------------

// Assert the caller currently holds a LIVE seating lock for the event before a
// mutation runs. lockId is best-effort threaded from the client (the active
// lock the editor acquired); when present it pins the assert so a silent peer
// takeover is also caught. A missing/empty lockId still asserts the caller
// holds *some* live lock on the event. Throws SeatingLockError on failure.
async function assertSeatingLockHeld(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  lockId: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('assert_seating_lock_held', {
    p_event_id: eventId,
    p_lock_id: lockId && lockId.length > 0 ? lockId : null,
  });
  if (error) throw new SeatingLockError();
}

// Pull the optional lock_id the editor stamps onto every gated FormData.
function lockIdFrom(formData: FormData): string | null {
  const v = formData.get('lock_id');
  return typeof v === 'string' && v.length > 0 ? v : null;
}

// Best-effort heartbeat after a successful mutation — keeps the holder's lock
// warm without a separate round-trip. NEVER throws: a 'lost' result (peer took
// over) is handled by the next assert / the client heartbeat, not here.
async function refreshSeatingLock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lockId: string | null,
): Promise<void> {
  if (!lockId) return;
  try {
    await supabase.rpc('refresh_seating_editor_lock', { p_lock_id: lockId });
  } catch {
    // swallow — refresh is opportunistic; correctness rides on assert-before.
  }
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

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  const { error } = await supabase.from('event_tables').insert({
    event_id: eventId,
    table_label: trimmed,
    table_type: type,
    capacity,
  });
  if (error) throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
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

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  const { error } = await supabase
    .from('event_tables')
    .delete()
    .eq('table_id', tableId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
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

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

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

  await refreshSeatingLock(supabase, lockIdFrom(formData));
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

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

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
    await refreshSeatingLock(supabase, lockIdFrom(formData));
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

  // Bulk action: assert the lock ONCE up front (not per row).
  const lockId = lockIdFrom(formData);
  await assertSeatingLockHeld(supabase, eventId, lockId);

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
    seating_priority: g.seating_priority ?? null,
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

  await refreshSeatingLock(supabase, lockId);
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
  // Floor-plan kit: stage size + dance-floor zone + optional service door.
  // Sizes clamp to 2–100% so a degenerate drag can't zero an element out.
  const clampSize = (v: unknown): number | null => {
    if (typeof v !== 'string' || v.length === 0) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.max(2, Math.min(100, n));
  };
  const stageW = clampSize(formData.get('stage_w'));
  const stageH = clampSize(formData.get('stage_h'));
  const danceEnabled = formData.get('dance_enabled') === 'true';
  const danceX = clampPct(formData.get('dance_x'));
  const danceY = clampPct(formData.get('dance_y'));
  const danceW = clampSize(formData.get('dance_w'));
  const danceH = clampSize(formData.get('dance_h'));
  const serviceEnabled = formData.get('service_entrance_enabled') === 'true';
  const serviceX = clampPct(formData.get('service_entrance_x'));
  const serviceY = clampPct(formData.get('service_entrance_y'));

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

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  const { error } = await supabase.from('event_floor_plan').upsert(
    {
      event_id: eventId,
      stage_x: stageX ?? 50,
      stage_y: stageY ?? 6,
      stage_w: stageW ?? 24,
      stage_h: stageH ?? 7,
      entrance_enabled: entranceEnabled,
      entrance_x: entranceX ?? 50,
      entrance_y: entranceY ?? 94,
      dance_enabled: danceEnabled,
      dance_x: danceX ?? 50,
      dance_y: danceY ?? 55,
      dance_w: danceW ?? 22,
      dance_h: danceH ?? 18,
      service_entrance_enabled: serviceEnabled,
      service_entrance_x: serviceX ?? 97,
      service_entrance_y: serviceY ?? 50,
      venue_width_m: venueWidth,
      venue_length_m: venueLength,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id' },
  );
  if (error) throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
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

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  const { error } = await supabase
    .from('event_tables')
    .update({ x_pos: clampedX, y_pos: clampedY, updated_at: new Date().toISOString() })
    .eq('table_id', tableId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
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

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  const { error } = await supabase
    .from('event_seat_assignments')
    .delete()
    .eq('event_id', eventId)
    .eq('guest_id', guestId);
  if (error) throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
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

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  const { error } = await supabase
    .from('event_tables')
    .update({ rotation_deg: rotation, updated_at: new Date().toISOString() })
    .eq('table_id', tableId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Change a table's STYLE/type (owner-directed 2026-06-13: "they picked long
// table, then decided to make them round tables — give them the right to do
// so"). Capacity resets to the new type's seat count and the geometry changes,
// so deleted-chair state (removed_seats) is cleared and any guest sitting in a
// chair that no longer exists is returned to the unseated pool. Position +
// label are kept. Returns how many guests were unseated so the editor can say.
export async function updateTableType(
  formData: FormData,
): Promise<{ unseated: number }> {
  const eventId = formData.get('event_id');
  const tableId = formData.get('table_id');
  const newType = formData.get('table_type');
  if (typeof eventId !== 'string' || typeof tableId !== 'string' || !isValidTableType(newType)) {
    throw new Error('Invalid input');
  }
  const newCapacity = TABLE_TYPE_CATALOG.find((t) => t.type === newType)?.defaultCapacity ?? 8;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  // Guests sitting in a chair index that the new (smaller) shape no longer has
  // are unseated. Chairs 0..newCapacity-1 keep their occupant; null-seat rows
  // (dropped on the table without a specific chair) beyond capacity also clear.
  const assignments = await fetchAssignments(supabase, eventId);
  const here = assignments.filter((a) => a.table_id === tableId);
  const toUnseat = here.filter(
    (a) => a.seat_number === null || a.seat_number < 0 || a.seat_number >= newCapacity,
  );
  // If everyone has a low seat number but there are simply MORE of them than
  // the new capacity, drop the surplus (highest seat numbers first).
  const keep = here.filter((a) => !toUnseat.includes(a));
  const surplus = keep
    .slice()
    .sort((a, b) => (b.seat_number ?? 0) - (a.seat_number ?? 0))
    .slice(0, Math.max(0, keep.length - newCapacity));
  const unseatIds = [...toUnseat, ...surplus].map((a) => a.guest_id);

  if (unseatIds.length > 0) {
    const { error: delErr } = await supabase
      .from('event_seat_assignments')
      .delete()
      .eq('event_id', eventId)
      .eq('table_id', tableId)
      .in('guest_id', unseatIds);
    if (delErr) throw new Error(delErr.message);
  }

  const { error } = await supabase
    .from('event_tables')
    .update({
      table_type: newType,
      capacity: newCapacity,
      removed_seats: [],
      updated_at: new Date().toISOString(),
    })
    .eq('table_id', tableId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
  revalidatePath(`/dashboard/${eventId}/seating`);
  return { unseated: unseatIds.length };
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

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

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

  await refreshSeatingLock(supabase, lockIdFrom(formData));
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

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  const { error } = await supabase
    .from('event_tables')
    .update({ table_label: label, updated_at: new Date().toISOString() })
    .eq('table_id', tableId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  // Renaming a linked table renames the UNIT: keep link_group_label in sync
  // across the whole group so the shared sign + badges follow the new name.
  const { data: row } = await supabase
    .from('event_tables')
    .select('link_group_id')
    .eq('table_id', tableId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (row?.link_group_id) {
    const { error: syncErr } = await supabase
      .from('event_tables')
      .update({ link_group_label: label, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('link_group_id', row.link_group_id);
    if (syncErr) throw new Error(syncErr.message);
  }

  await refreshSeatingLock(supabase, lockIdFrom(formData));
  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Link two tables into ONE named unit (identity + QR only — owner-locked
// 2026-06-10): members share link_group_id + link_group_label, render with the
// shared name, and the print pack emits ONE QR sign for the unit. Seating math
// stays per-table. Linking into an existing unit merges the groups.
export async function linkTables(formData: FormData) {
  const eventId = formData.get('event_id');
  const tableA = formData.get('table_id_a');
  const tableB = formData.get('table_id_b');
  if (
    typeof eventId !== 'string' ||
    typeof tableA !== 'string' ||
    typeof tableB !== 'string' ||
    tableA === tableB
  ) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  const tables = await fetchTables(supabase, eventId);
  const a = tables.find((t) => t.table_id === tableA);
  const b = tables.find((t) => t.table_id === tableB);
  if (!a || !b) throw new Error('Table not found');

  const groupId = a.link_group_id ?? b.link_group_id ?? crypto.randomUUID();
  // The unit keeps the FIRST table's identity (its existing unit label, else
  // its own label) — tap the head table first, then the extension.
  const label = a.link_group_label ?? a.table_label;
  const memberIds = new Set<string>([tableA, tableB]);
  for (const t of tables) {
    if (t.link_group_id && (t.link_group_id === a.link_group_id || t.link_group_id === b.link_group_id)) {
      memberIds.add(t.table_id);
    }
  }

  const { error } = await supabase
    .from('event_tables')
    .update({ link_group_id: groupId, link_group_label: label, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .in('table_id', [...memberIds]);
  if (error) throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Dissolve a linked unit (from any member): every member returns to its own
// name + its own QR sign.
export async function unlinkTable(formData: FormData) {
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

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  const { data: row } = await supabase
    .from('event_tables')
    .select('link_group_id')
    .eq('table_id', tableId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!row?.link_group_id) return;

  const { error } = await supabase
    .from('event_tables')
    .update({ link_group_id: null, link_group_label: null, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('link_group_id', row.link_group_id);
  if (error) throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
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

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

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
    await refreshSeatingLock(supabase, lockIdFrom(formData));
    revalidatePath(`/dashboard/${eventId}/seating`);
  }

  return { seated: rows.length, requested: eligible.length, overflow: eligible.length - rows.length };
}

// ---------------------------------------------------------------------------
// Auto Arrange (owner-directed 2026-06-13) — booths + one-click arrangement.
// All placement math is deterministic lib/seating.ts logic computed on the
// client; these actions validate + persist, then run the (equally pure)
// auto-seat pass server-side. No AI calls anywhere on this path.
// ---------------------------------------------------------------------------

const VALID_BOOTH_TYPES = new Set(BOOTH_CATALOG.map((b) => b.type));
const MAX_BOOTHS = 12;

type BoothPayload = {
  booth_id: string | null;
  booth_type: BoothType;
  label: string;
  x_pos: number;
  y_pos: number;
  sort_order: number;
};

// Parse + clamp the booths JSON. Throws on anything malformed — the editor
// always sends well-formed data, so a failure here is a tampered request.
function parseBoothsPayload(raw: unknown): BoothPayload[] {
  if (typeof raw !== 'string') throw new Error('Invalid input');
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    throw new Error('Invalid input');
  }
  if (!Array.isArray(arr) || arr.length > MAX_BOOTHS) throw new Error('Invalid input');
  return arr.map((b, i) => {
    const o = b as Record<string, unknown>;
    const type = o.booth_type;
    if (typeof type !== 'string' || !VALID_BOOTH_TYPES.has(type as BoothType)) {
      throw new Error('Invalid booth type');
    }
    const label = typeof o.label === 'string' ? o.label.trim().slice(0, 60) : '';
    const x = Number(o.x_pos);
    const y = Number(o.y_pos);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid input');
    return {
      booth_id: typeof o.booth_id === 'string' && o.booth_id.length > 0 ? o.booth_id : null,
      booth_type: type as BoothType,
      label: label || (BOOTH_CATALOG.find((c) => c.type === type)?.label ?? 'Booth'),
      x_pos: Math.max(0, Math.min(100, x)),
      y_pos: Math.max(0, Math.min(100, y)),
      sort_order: i,
    };
  });
}

// Replace-all save of the event's booth markers (RLS scopes writes to the
// couple's own events). Booths NOT in the payload are deleted.
async function persistBooths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  booths: BoothPayload[],
) {
  const keepIds = booths.map((b) => b.booth_id).filter((id): id is string => id !== null);
  const del = supabase.from('event_floor_booths').delete().eq('event_id', eventId);
  const { error: delError } = await (keepIds.length > 0
    ? del.not('booth_id', 'in', `(${keepIds.join(',')})`)
    : del);
  if (delError) throw new Error(delError.message);
  for (const b of booths) {
    const row = {
      event_id: eventId,
      booth_type: b.booth_type,
      label: b.label,
      x_pos: b.x_pos,
      y_pos: b.y_pos,
      sort_order: b.sort_order,
    };
    const { error } = b.booth_id
      ? await supabase.from('event_floor_booths').update(row).eq('booth_id', b.booth_id).eq('event_id', eventId)
      : await supabase.from('event_floor_booths').insert(row);
    if (error) throw new Error(error.message);
  }
}

export async function saveBooths(formData: FormData) {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) throw new Error('Invalid input');
  const booths = parseBoothsPayload(formData.get('booths'));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));
  await persistBooths(supabase, eventId, booths);
  await refreshSeatingLock(supabase, lockIdFrom(formData));
  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Explicit per-guest priority-tier override (guests.seating_priority). An
// empty value clears the override back to the role-derived tier.
export async function setGuestSeatingPriority(formData: FormData) {
  const eventId = formData.get('event_id');
  const guestId = formData.get('guest_id');
  const raw = formData.get('priority');
  if (typeof eventId !== 'string' || typeof guestId !== 'string' || guestId.length === 0) {
    throw new Error('Invalid input');
  }
  const priority =
    typeof raw === 'string' && ['1', '2', '3', '4'].includes(raw) ? Number(raw) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  const { error } = await supabase
    .from('guests')
    .update({ seating_priority: priority })
    .eq('guest_id', guestId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  await refreshSeatingLock(supabase, lockIdFrom(formData));
  revalidatePath(`/dashboard/${eventId}/seating`);
}

// One-click Auto Arrange: persist the client-computed table layout + booth
// anchors, then run the deterministic role-tier auto-seat against the NEW
// positions so "nearest the stage" means the layout that was just made.
// Seating stays idempotent (already-seated guests never move).
export async function autoArrange(formData: FormData): Promise<{ seated: number }> {
  const eventId = formData.get('event_id');
  const positionsRaw = formData.get('positions');
  if (typeof eventId !== 'string' || eventId.length === 0 || typeof positionsRaw !== 'string') {
    throw new Error('Invalid input');
  }
  let positions: Record<string, { x: number; y: number }>;
  try {
    positions = JSON.parse(positionsRaw);
  } catch {
    throw new Error('Invalid input');
  }
  const booths = parseBoothsPayload(formData.get('booths') ?? '[]');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Bulk action: assert the lock ONCE up front (not per persisted table).
  const lockId = lockIdFrom(formData);
  await assertSeatingLockHeld(supabase, eventId, lockId);

  const [tables, assignments, guests, floorPlan, memberships] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
    fetchFloorPlan(supabase, eventId),
    fetchGroupMembershipsByEvent(supabase, eventId),
  ]);

  // Persist positions — only for tables that really belong to this event, with
  // clamped finite coordinates. Unknown ids in the payload are ignored.
  const tableIds = new Set(tables.map((t) => t.table_id));
  const cleanPos: Record<string, { x: number; y: number }> = {};
  for (const [id, p] of Object.entries(positions)) {
    if (!tableIds.has(id)) continue;
    const x = Number((p as { x: unknown }).x);
    const y = Number((p as { y: unknown }).y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    cleanPos[id] = { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }
  for (const [id, p] of Object.entries(cleanPos)) {
    const { error } = await supabase
      .from('event_tables')
      .update({ x_pos: p.x, y_pos: p.y })
      .eq('table_id', id)
      .eq('event_id', eventId);
    if (error) throw new Error(error.message);
  }

  await persistBooths(supabase, eventId, booths);

  // Auto-seat against the freshly arranged positions.
  const arrangedTables = tables.map((t) =>
    cleanPos[t.table_id] ? { ...t, x_pos: cleanPos[t.table_id]!.x, y_pos: cleanPos[t.table_id]!.y } : t,
  );
  const autoSeatGuestList: AutoSeatGuest[] = guests.map((g) => ({
    guest_id: g.guest_id,
    role: g.role,
    group_category: g.group_category,
    rsvp_status: g.rsvp_status,
    plus_one_of_guest_id: g.plus_one_of_guest_id,
    last_name: g.last_name,
    first_name: g.first_name,
    group_id: memberships.get(g.guest_id)?.[0] ?? null,
    seating_priority: g.seating_priority ?? null,
  }));
  const rows = computeAutoSeat(arrangedTables, autoSeatGuestList, assignments, {
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

  await refreshSeatingLock(supabase, lockId);
  revalidatePath(`/dashboard/${eventId}/seating`);
  return { seated: rows.length };
}
