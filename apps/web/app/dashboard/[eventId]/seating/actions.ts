'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { fetchGuestsByEvent, fetchGroupMembershipsByEvent } from '@/lib/guests';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import { isChineseWedding } from '@/lib/chinese-wedding';
import { BOOKED_VENDOR_STATUSES } from '@/lib/vendors';
import { SeatingLockError } from './seating-lock-error';
import {
  BOOTH_CATALOG,
  TABLE_TYPE_CATALOG,
  computeAutoLayout,
  computeAutoSeat,
  effectiveCapacity,
  fetchAssignments,
  fetchFloorPlan,
  fetchSeatingConstraints,
  fetchGroupAdjacency,
  fetchTables,
  parsePriorityOrder,
  recommendTableSet,
  removedSeatSet,
  roleTier,
  shapeHintFor,
  solveSeatPlan,
  tableGeometry,
  type AutoSeatGuest,
  type BoothType,
  type PriorityOrder,
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

  // Smart seat-plan Phase 5 (gap G1): a new table is fresh capacity — gap-fill
  // any guests who were waiting for a seat. Best-effort; no-op when autoplace is
  // off. This is what makes the "add more tables" nudge actually seat people.
  await applyReconcileForEvent(supabase, eventId);

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

// Atomically SWAP two seated guests (3D lab · tap guest A then guest B). Both
// guests must already be seated somewhere in the event. Replaces the old
// two-independent-`assignGuest`-upserts path, which was neither atomic (a crash
// between writes left a half-swap) nor collision-safe (two guests could land on
// one chair). The swap_seat_assignments RPC exchanges (table_id, seat_number)
// inside ONE transaction, guarded by the new physical-chair unique index.
// Lock-gated like every seating mutation.
export async function swapSeats(formData: FormData) {
  const eventId = formData.get('event_id');
  const guestA = formData.get('guest_a_id');
  const guestB = formData.get('guest_b_id');
  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    typeof guestA !== 'string' ||
    typeof guestB !== 'string' ||
    !UUID_RE.test(guestA) ||
    !UUID_RE.test(guestB) ||
    guestA === guestB
  ) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  const { error } = await supabase.rpc('swap_seat_assignments', {
    p_event_id: eventId,
    p_guest_a: guestA,
    p_guest_b: guestB,
  });
  if (error) throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Atomically SWAP every occupant between two tables (3D lab · arm table A, tap
// table B). Seat numbers travel with each guest. Replaces the old per-seat loop
// of independent `assignGuest` writes with the single swap_table_assignments
// RPC, so the exchange is all-or-nothing and never transiently double-seats a
// chair. Lock-gated like every seating mutation.
export async function swapTableOccupants(formData: FormData) {
  const eventId = formData.get('event_id');
  const tableA = formData.get('table_id_a');
  const tableB = formData.get('table_id_b');
  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    typeof tableA !== 'string' ||
    typeof tableB !== 'string' ||
    tableA.length === 0 ||
    tableB.length === 0 ||
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

  const { error } = await supabase.rpc('swap_table_assignments', {
    p_event_id: eventId,
    p_table_a: tableA,
    p_table_b: tableB,
  });
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

  // Anchor the role-tier rings on where the couple actually placed the stage,
  // and fill tiers in the couple's saved priority order (Phase 2; null = default).
  // Iteration 0053 P4 Unit 6: tier by the event's role set (wedding → identical).
  const roleSet = await resolveRoleSetForEvent(eventId);
  const groupAdjacency = await fetchGroupAdjacency(supabase, eventId);
  const rows = computeAutoSeat(
    tables,
    autoSeatGuestList,
    assignments,
    { x: floorPlan.stage_x, y: floorPlan.stage_y },
    floorPlan.priority_order,
    roleSet,
    groupAdjacency,
  );
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
  // Stamp Auto-arrange adoption for the admin lead-scoring signal
  // (admin_lead_scores · /admin/intelligence). Best-effort: an analytics
  // stamp must never block seating, so the error is intentionally dropped.
  await supabase
    .from('events')
    .update({ auto_seat_last_used_at: new Date().toISOString() })
    .eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Smart Seat-Plan Phase 5: turn live auto-seating on/off for the event. Couple-
// scoped (the events RLS update backs it). When off, adding or re-roling a guest
// no longer auto-places a provisional seat — the couple seats manually via
// Auto-Arrange / drag.
export async function setSeatingAutoplace(formData: FormData) {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) return;
  const enabled = formData.get('enabled') === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('events')
    .update({ seating_autoplace_enabled: enabled })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  // Gap G4: turning auto-seating ON should catch up the guests who piled up
  // while it was off — gap-fill them now (respects locked seats; no-op if the
  // room is already seated or full).
  if (enabled) {
    await applyReconcileForEvent(supabase, eventId);
  }

  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Smart Seat-Plan Phase 6 (gap G8): turn group-overflow adjacency on/off. When
// off, a group's overflow reverts to the classic stage-ranked fill instead of
// the nearest table by floor coordinates. Couple-scoped.
export async function setSeatingGroupAdjacency(formData: FormData) {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) return;
  const enabled = formData.get('enabled') === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('events')
    .update({ seating_group_adjacency: enabled })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating`);
}

// ── 3D Booth Ads · Part A (slice 9, owner-locked 2026-07-08) ──────────────────
// The couple's controls for the dashed "ghost booths" (unbooked vendor
// categories) shown ONLY in their own 3D planning lab. Prefs persist on
// event_floor_plan; couple-scoped (RLS gates the row to the event's owner).

/** Master toggle: show/hide ghost booths for the whole event. */
export async function setGhostBoothsEnabled(formData: FormData) {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) return;
  const enabled = formData.get('enabled') === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_floor_plan')
    .update({ ghost_booths_enabled: enabled })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating/lab`);
}

/** Per-booth dismiss: hide the ghost booth for one vendor category (the "×"). */
export async function dismissGhostBooth(formData: FormData) {
  const eventId = formData.get('event_id');
  const category = formData.get('category');
  if (typeof eventId !== 'string' || eventId.length === 0) return;
  if (typeof category !== 'string' || category.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read-modify-write to keep the dismissed set deduped (idempotent re-dismiss).
  const { data: row } = await supabase
    .from('event_floor_plan')
    .select('ghost_booths_dismissed')
    .eq('event_id', eventId)
    .maybeSingle();
  const current = (row?.ghost_booths_dismissed as string[] | null) ?? [];
  if (current.includes(category)) {
    revalidatePath(`/dashboard/${eventId}/seating/lab`);
    return;
  }
  const { error } = await supabase
    .from('event_floor_plan')
    .update({ ghost_booths_dismissed: [...current, category] })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating/lab`);
}

/** Restore every dismissed ghost booth (the master toggle's "show all again"). */
export async function restoreGhostBooths(formData: FormData) {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_floor_plan')
    .update({ ghost_booths_dismissed: [] })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating/lab`);
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
  // Main-entrance geometry (migration 20270717284319): door vs walk-through.
  // The schema value stays 'tunnel'; the UI labels it "Walk-through". Depth is
  // METRES (not a percent — never route it through clampPct), clamped 1.5–8.
  const entranceKind = formData.get('entrance_kind') === 'tunnel' ? 'tunnel' : 'door';
  const entranceDepth = ((): number => {
    const raw = formData.get('entrance_depth_m');
    if (typeof raw !== 'string' || raw.length === 0) return 3;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 3;
    return Math.max(1.5, Math.min(8, n));
  })();
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

  // Cocktail / waiting-area room — a second room on the same canvas. Its centre
  // clamps to a WIDER band than 0–100 so the room can dock just OUTSIDE a
  // reception wall (at the entrance door) without being snapped back on-canvas.
  const clampCocktailCoord = (v: unknown): number | null => {
    if (typeof v !== 'string' || v.length === 0) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.max(-80, Math.min(180, n));
  };
  const cocktailEnabled = formData.get('cocktail_enabled') === 'true';
  const cocktailX = clampCocktailCoord(formData.get('cocktail_x'));
  const cocktailY = clampCocktailCoord(formData.get('cocktail_y'));
  const cocktailW = clampSize(formData.get('cocktail_w'));
  const cocktailH = clampSize(formData.get('cocktail_h'));
  const cocktailLabelRaw = formData.get('cocktail_label');
  const cocktailLabel =
    typeof cocktailLabelRaw === 'string' && cocktailLabelRaw.trim().length > 0
      ? cocktailLabelRaw.trim().slice(0, 80)
      : 'Cocktail Area';
  // Couple revoke switch — absent or anything but 'false' keeps vendor edit on.
  const cocktailVendorEdit = formData.get('cocktail_vendor_edit') !== 'false';
  // Dock mode — absent or anything but 'false' keeps it linked (DB default TRUE).
  const cocktailLinked = formData.get('cocktail_linked') !== 'false';

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
      entrance_kind: entranceKind,
      entrance_depth_m: entranceDepth,
      dance_enabled: danceEnabled,
      dance_x: danceX ?? 50,
      dance_y: danceY ?? 55,
      dance_w: danceW ?? 22,
      dance_h: danceH ?? 18,
      service_entrance_enabled: serviceEnabled,
      service_entrance_x: serviceX ?? 97,
      service_entrance_y: serviceY ?? 50,
      cocktail_enabled: cocktailEnabled,
      cocktail_x: cocktailX ?? 50,
      cocktail_y: cocktailY ?? 40,
      cocktail_w: cocktailW ?? 30,
      cocktail_h: cocktailH ?? 22,
      cocktail_label: cocktailLabel,
      cocktail_vendor_edit: cocktailVendorEdit,
      cocktail_linked: cocktailLinked,
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

// Host choice for guest PHOTOS in the public 3D venue walk (owner 2026-07-03).
// Persists event_floor_plan.venue_photo_visibility ∈ {'table','all','none'} —
// 'table' (default) shows own-tablemate faces, 'all' shows every seated face,
// 'none' shows no photos. The public_venue_scene RPC still hard-gates photos
// behind a valid per-guest token; this only widens/narrows WHICH seats it lets
// through. Lock-gated like every seating mutation.
const VALID_PHOTO_VISIBILITY = new Set(['table', 'all', 'none']);

export async function saveVenuePhotoVisibility(formData: FormData) {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('Invalid input');
  }
  const value = formData.get('venue_photo_visibility');
  if (typeof value !== 'string' || !VALID_PHOTO_VISIBILITY.has(value)) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  // Upsert just this column on the per-event floor-plan singleton. onConflict
  // keeps every other floor-plan field intact; a first-time row gets the DB
  // defaults for everything else.
  const { error } = await supabase.from('event_floor_plan').upsert(
    { event_id: eventId, venue_photo_visibility: value, updated_at: new Date().toISOString() },
    { onConflict: 'event_id' },
  );
  if (error) throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Save the couple's draggable seating-priority tier order (smart seat-plan
// Phase 2). Upserts just the priority_order column on the per-event floor-plan
// singleton (other columns keep their DB defaults / existing values). The client
// value is re-validated server-side via parsePriorityOrder — never trusted — and
// stored as a clean PriorityOrder, or null when empty/malformed (→ the default
// order). Lock-gated like every seating mutation.
export async function savePriorityOrder(formData: FormData) {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('Invalid input');
  }
  const raw = formData.get('priority_order');
  // Iteration 0053 P4 Unit 6: re-derive tier labels from the event's role set.
  const roleSet = await resolveRoleSetForEvent(eventId);
  let parsed: PriorityOrder | null = null;
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      parsed = parsePriorityOrder(JSON.parse(raw), roleSet);
    } catch {
      parsed = null;
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  const { error } = await supabase.from('event_floor_plan').upsert(
    {
      event_id: eventId,
      priority_order: parsed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id' },
  );
  if (error) throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Keep-apart constraints (smart seat-plan · Phase 3). Couple-private rules that
// two guests must never share a table; the solver expands each to both guests'
// groups at solve time. Lock-gated like every seating mutation; RLS keeps them
// couple-only. Guest ids are validated as UUIDs before use in any filter.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addSeatingConstraint(formData: FormData) {
  const eventId = formData.get('event_id');
  const a = formData.get('guest_a_id');
  const b = formData.get('guest_b_id');
  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    typeof a !== 'string' ||
    typeof b !== 'string' ||
    !UUID_RE.test(a) ||
    !UUID_RE.test(b) ||
    a === b
  ) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  const { error } = await supabase
    .from('event_seating_constraints')
    .insert({ event_id: eventId, kind: 'keep_apart', guest_a_id: a, guest_b_id: b });
  // 23505 = the unordered-pair unique index → the rule already exists (in either
  // direction); adding it again is an idempotent no-op, not an error.
  if (error && error.code !== '23505') throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
  revalidatePath(`/dashboard/${eventId}/seating`);
}

export async function removeSeatingConstraint(formData: FormData) {
  const eventId = formData.get('event_id');
  const a = formData.get('guest_a_id');
  const b = formData.get('guest_b_id');
  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    typeof a !== 'string' ||
    typeof b !== 'string' ||
    !UUID_RE.test(a) ||
    !UUID_RE.test(b)
  ) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  // Delete the rule regardless of which order the pair was stored in. Both ids
  // are UUID-validated above, so the PostgREST or-filter is injection-safe.
  const { error } = await supabase
    .from('event_seating_constraints')
    .delete()
    .eq('event_id', eventId)
    .or(`and(guest_a_id.eq.${a},guest_b_id.eq.${b}),and(guest_a_id.eq.${b},guest_b_id.eq.${a})`);
  if (error) throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Pin/unpin a seated guest (smart seat-plan · Phase 4 lock-and-fill). A locked
// seat is fixed: lockAndFill (and any future solve) seats everyone else around
// it. Lock-gated like every seating mutation.
export async function toggleSeatLock(formData: FormData) {
  const eventId = formData.get('event_id');
  const guestId = formData.get('guest_id');
  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    typeof guestId !== 'string' ||
    !UUID_RE.test(guestId)
  ) {
    throw new Error('Invalid input');
  }
  const locked = formData.get('locked') === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));

  const { error } = await supabase
    .from('event_seat_assignments')
    .update({ locked })
    .eq('event_id', eventId)
    .eq('guest_id', guestId);
  if (error) throw new Error(error.message);

  await refreshSeatingLock(supabase, lockIdFrom(formData));
  revalidatePath(`/dashboard/${eventId}/seating`);
}

// Lock-and-fill (smart seat-plan · Phase 4): keep every LOCKED seat exactly where
// it is, clear the rest, and re-seat everyone around the locked ones — honouring
// the saved priority order + keep-apart rules. "Lock the head table, fill the
// rest." Returns the keep-apart outcome so the editor can report it.
export async function lockAndFill(
  formData: FormData,
): Promise<{ seated: number; totalRules: number; satisfiedRules: number; unsatisfiedRules: number }> {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const lockId = lockIdFrom(formData);
  await assertSeatingLockHeld(supabase, eventId, lockId);

  const [tables, assignments, guests, floorPlan, memberships, constraints] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
    fetchFloorPlan(supabase, eventId),
    fetchGroupMembershipsByEvent(supabase, eventId),
    fetchSeatingConstraints(supabase, eventId),
  ]);

  // Keep locked seats; clear everyone else so the solver re-seats around them.
  const lockedAssignments = assignments.filter((a) => a.locked);
  const { error: delErr } = await supabase
    .from('event_seat_assignments')
    .delete()
    .eq('event_id', eventId)
    .eq('locked', false);
  if (delErr) throw new Error(delErr.message);

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

  const solved = solveSeatPlan({
    tables,
    guests: autoSeatGuestList,
    assignments: lockedAssignments, // locked = fixed context the solver fills around
    stage: { x: floorPlan.stage_x, y: floorPlan.stage_y },
    priorityOrder: floorPlan.priority_order,
    constraints,
    groupMembers: memberships,
    // Iteration 0053 P4 Unit 6: tier by the event's role set (wedding → identical).
    roleSet: await resolveRoleSetForEvent(eventId),
    groupAdjacency: await fetchGroupAdjacency(supabase, eventId),
  });
  if (solved.assignments.length > 0) {
    const { error } = await supabase.from('event_seat_assignments').insert(
      solved.assignments.map((r) => ({
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
  return {
    seated: solved.assignments.length,
    totalRules: solved.totalRules,
    satisfiedRules: solved.satisfiedCount,
    unsatisfiedRules: solved.violations.length,
  };
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

// Link two tables into ONE grouped unit: members share link_group_id +
// link_group_label, render under the shared name, and the print pack emits ONE
// QR sign for the unit. Linking into an existing unit merges the groups.
// Owner-authorized 2026-06-21 ("group as one, like Keynote") to upgrade the
// prior 2026-06-10 identity-only lock: the EDITOR now also moves and rotates a
// linked unit as one rigid body (positions/angles still persist per-table via
// updateTablePosition / updateTableRotation — no schema change). Seating math
// (who sits where, capacity) stays per-table.
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
  // A linked unit gets its OWN combined name (not silently the first table's),
  // joining the two sides — e.g. "Table 3 & Table 4". Couples can rename the
  // unit afterward (renaming any member renames the whole unit). De-duped when
  // re-linking the same unit; capped to the rename limit.
  const aLabel = a.link_group_label ?? a.table_label;
  const bLabel = b.link_group_label ?? b.table_label;
  const label =
    a.link_group_id && a.link_group_id === b.link_group_id
      ? aLabel
      : aLabel === bLabel
        ? aLabel
        : `${aLabel} & ${bLabel}`.slice(0, 64);
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

// Break a grouped unit apart (from any member): every member becomes an
// independent table again with its own name + QR sign, and moves/rotates on
// its own. Positions/angles are left where they are.
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

  // Eligible = not declined (pending/maybe get held seats too, like Auto Arrange),
  // in this tier, not the couple, not already seated anywhere.
  // Iteration 0053 P4 Unit 6: tier by the event's role set (wedding → identical).
  const roleSet = await resolveRoleSetForEvent(eventId);
  const seatedIds = new Set(assignments.map((a) => a.guest_id));
  const eligible = guests
    .filter(
      (g) =>
        g.rsvp_status !== 'declined' &&
        g.role !== 'bride' &&
        g.role !== 'groom' &&
        !seatedIds.has(g.guest_id) &&
        roleTier(g.role, g.group_category, roleSet) === tier,
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

// The 6 pickable kinds + 'unassigned' (a blank pin the couple hasn't typed yet).
const VALID_BOOTH_TYPES = new Set<BoothType>([...BOOTH_CATALOG.map((b) => b.type), 'unassigned']);
const MAX_BOOTHS = 12;

type BoothPayload = {
  booth_id: string | null;
  booth_type: BoothType;
  label: string;
  x_pos: number;
  y_pos: number;
  sort_order: number;
  zone: 'reception' | 'cocktail';
  event_vendor_id: string | null;
  // Guest-facing "what this booth serves / offers" copy (<=280, or null).
  offerings: string | null;
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
    const zone = o.zone === 'cocktail' ? 'cocktail' : 'reception';
    const vendorId =
      typeof o.event_vendor_id === 'string' && o.event_vendor_id.length > 0
        ? o.event_vendor_id
        : null;
    // Offerings: trimmed + capped at 280 (mirrors the DB CHECK / vendor RPC);
    // blank -> null so an empty field clears the copy on the next save.
    const offerings =
      typeof o.offerings === 'string' && o.offerings.trim().length > 0
        ? o.offerings.trim().slice(0, 280)
        : null;
    // Cocktail booths can sit in a room docked OUTSIDE the reception walls
    // (off the 0–100 canvas), so they clamp to the same widened band as the
    // cocktail room; reception booths stay on-canvas.
    const lo = zone === 'cocktail' ? -80 : 0;
    const hi = zone === 'cocktail' ? 180 : 100;
    return {
      booth_id: typeof o.booth_id === 'string' && o.booth_id.length > 0 ? o.booth_id : null,
      booth_type: type as BoothType,
      label:
        label ||
        (type === 'unassigned' ? 'New booth' : BOOTH_CATALOG.find((c) => c.type === type)?.label ?? 'Booth'),
      x_pos: Math.max(lo, Math.min(hi, x)),
      y_pos: Math.max(lo, Math.min(hi, y)),
      sort_order: i,
      zone: zone as 'reception' | 'cocktail',
      event_vendor_id: vendorId,
      offerings,
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
  // SECURITY (defense-by-construction): sanitize cross-event vendor links here,
  // in the single choke point EVERY caller (saveBooths, autoArrange, and any
  // future one) passes through — so the guard can never be forgotten again.
  await nullOutForeignBoothVendors(supabase, eventId, booths);
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
      zone: b.zone,
      event_vendor_id: b.event_vendor_id,
      offerings: b.offerings,
    };
    const { error } = b.booth_id
      ? await supabase.from('event_floor_booths').update(row).eq('booth_id', b.booth_id).eq('event_id', eventId)
      : await supabase.from('event_floor_booths').insert(row);
    if (error) throw new Error(error.message);
  }
}

// SECURITY — a booth's event_vendor_id FK permits ANY event_vendors row and RLS
// only scopes booth.event_id, so nothing at the DB layer stops a tampered
// payload from attaching another event's vendor (and leaking its name / logo)
// onto this floor plan. Mutates the parsed booths in place: any event_vendor_id
// that isn't a BOOKED vendor of THIS event is nulled out (the booth still saves,
// just unlinked). One round-trip, only when at least one booth carries a link.
async function nullOutForeignBoothVendors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  booths: BoothPayload[],
): Promise<void> {
  const linkedIds = [
    ...new Set(booths.map((b) => b.event_vendor_id).filter((id): id is string => id !== null)),
  ];
  if (linkedIds.length === 0) return;
  const { data, error } = await supabase
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .in('status', BOOKED_VENDOR_STATUSES as unknown as string[])
    .in('vendor_id', linkedIds);
  if (error) throw new Error(error.message);
  const valid = new Set((data ?? []).map((r) => r.vendor_id as string));
  for (const b of booths) {
    if (b.event_vendor_id !== null && !valid.has(b.event_vendor_id)) {
      b.event_vendor_id = null;
    }
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
  await persistBooths(supabase, eventId, booths); // guards cross-event vendor links internally
  await refreshSeatingLock(supabase, lockIdFrom(formData));
  revalidatePath(`/dashboard/${eventId}/seating`);
}

// --- wayfinding signs (replace-all, same shape as saveBooths) ----------------
const MAX_SIGNS = 24;

type SignPayload = {
  sign_id: string | null;
  label: string;
  x_pos: number;
  y_pos: number;
  rotation_deg: number;
  sort_order: number;
};

function parseSignsPayload(raw: unknown): SignPayload[] {
  if (typeof raw !== 'string') throw new Error('Invalid input');
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    throw new Error('Invalid input');
  }
  if (!Array.isArray(arr) || arr.length > MAX_SIGNS) throw new Error('Invalid input');
  return arr.map((s, i) => {
    const o = s as Record<string, unknown>;
    const label = typeof o.label === 'string' ? o.label.trim().slice(0, 40) : '';
    const x = Number(o.x_pos);
    const y = Number(o.y_pos);
    const rot = Number(o.rotation_deg);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid input');
    return {
      sign_id: typeof o.sign_id === 'string' && o.sign_id.length > 0 ? o.sign_id : null,
      label: label || 'Sign',
      x_pos: Math.max(0, Math.min(100, x)),
      y_pos: Math.max(0, Math.min(100, y)),
      rotation_deg: Number.isFinite(rot) ? ((rot % 360) + 360) % 360 : 0,
      sort_order: i,
    };
  });
}

async function persistSigns(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  signs: SignPayload[],
) {
  const keepIds = signs.map((s) => s.sign_id).filter((id): id is string => id !== null);
  const del = supabase.from('event_floor_signs').delete().eq('event_id', eventId);
  const { error: delError } = await (keepIds.length > 0
    ? del.not('sign_id', 'in', `(${keepIds.join(',')})`)
    : del);
  if (delError) throw new Error(delError.message);
  for (const s of signs) {
    const row = {
      event_id: eventId,
      label: s.label,
      x_pos: s.x_pos,
      y_pos: s.y_pos,
      rotation_deg: s.rotation_deg,
      sort_order: s.sort_order,
    };
    const { error } = s.sign_id
      ? await supabase.from('event_floor_signs').update(row).eq('sign_id', s.sign_id).eq('event_id', eventId)
      : await supabase.from('event_floor_signs').insert(row);
    if (error) throw new Error(error.message);
  }
}

export async function saveSigns(formData: FormData) {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) throw new Error('Invalid input');
  const signs = parseSignsPayload(formData.get('signs'));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await assertSeatingLockHeld(supabase, eventId, lockIdFrom(formData));
  await persistSigns(supabase, eventId, signs);
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
export async function autoArrange(
  formData: FormData,
): Promise<{ seated: number; totalRules: number; satisfiedRules: number; unsatisfiedRules: number }> {
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

  const [tables, assignments, guests, floorPlan, memberships, constraints] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
    fetchFloorPlan(supabase, eventId),
    fetchGroupMembershipsByEvent(supabase, eventId),
    fetchSeatingConstraints(supabase, eventId),
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
  // Honour the couple's saved priority order (Phase 2) and, when keep-apart
  // rules exist, run the constraint-aware solver (Phase 3) instead of the plain
  // seater. Both consume the same stage + priority; the solver adds graceful
  // keep-apart separation. No rules → identical to the priority-only path.
  const stage = { x: floorPlan.stage_x, y: floorPlan.stage_y };
  // Iteration 0053 P4 Unit 6: tier by the event's role set (wedding → identical).
  const roleSet = await resolveRoleSetForEvent(eventId);
  const groupAdjacency = await fetchGroupAdjacency(supabase, eventId);
  const solved =
    constraints.length > 0
      ? solveSeatPlan({
          tables: arrangedTables,
          guests: autoSeatGuestList,
          assignments,
          stage,
          priorityOrder: floorPlan.priority_order,
          constraints,
          groupMembers: memberships,
          roleSet,
          groupAdjacency,
        })
      : null;
  const rows =
    solved?.assignments ??
    computeAutoSeat(arrangedTables, autoSeatGuestList, assignments, stage, floorPlan.priority_order, roleSet, groupAdjacency);
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
  // Surface keep-apart outcome so the editor can show "honored X/Y rules".
  return {
    seated: rows.length,
    totalRules: solved?.totalRules ?? 0,
    satisfiedRules: solved?.satisfiedCount ?? 0,
    unsatisfiedRules: solved?.violations.length ?? 0,
  };
}

// "Build my seating" — generate a complete, editable starting draft from the
// guest list in one tap (UX goal 2026-06-20: draft, don't blank). Deterministic
// + zero-cost, the same family as Auto Arrange: recommend a table SET, create
// it, lay it out stage-out, and seat the confirmed guests by role tier. Guarded
// to a truly empty floor so it can never clobber an in-progress plan.
export async function buildSeatingDraft(
  formData: FormData,
): Promise<{ tables: number; seated: number }> {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const lockId = lockIdFrom(formData);
  await assertSeatingLockHeld(supabase, eventId, lockId);

  const [existing, guests, floorPlan, memberships, eventRow] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
    fetchFloorPlan(supabase, eventId),
    fetchGroupMembershipsByEvent(supabase, eventId),
    supabase
      .from('events')
      .select('ceremony_type, secondary_ceremony_type')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  // Guard: only ever build onto a blank floor — never clobber existing tables.
  if (existing.length > 0) {
    await refreshSeatingLock(supabase, lockId);
    return { tables: 0, seated: 0 };
  }

  // Chinese (Tsinoy) tradition avoids table number 4 (四 ≈ 死). Advisory: the
  // generated draft's auto-numbering skips ones-digit-4 numbers. Derived via the
  // shared overlay predicate so it fires for primary AND secondary Chinese rites.
  const skipFour = isChineseWedding(eventRow.data ?? null);
  const recommended = recommendTableSet(
    guests.map((g) => ({ role: g.role, rsvp_status: g.rsvp_status })),
    { skipFour },
  );
  // No guests yet → nothing to size a floor from; the CTA stays a no-op.
  if (recommended.length <= 1) {
    await refreshSeatingLock(supabase, lockId);
    return { tables: 0, seated: 0 };
  }

  // Create the table set (positions filled in below, once we have real ids).
  const { error: insErr } = await supabase.from('event_tables').insert(
    recommended.map((t, i) => ({
      event_id: eventId,
      table_label: t.label,
      table_type: t.type,
      capacity: t.capacity,
      sort_order: i,
    })),
  );
  if (insErr) throw new Error(insErr.message);

  // Re-read to get the generated ids, then lay them out stage-out. Positions are
  // percent of the canvas, so a nominal server-side rect renders correctly at
  // any real canvas size — the same stub-rect path the unit tests exercise.
  const tables = await fetchTables(supabase, eventId);
  const layout = computeAutoLayout({
    tables,
    floorPlan,
    rect: { width: 1000, height: 680 },
    footprintOf: (t) => tableGeometry(shapeHintFor(t.table_type), t.capacity).box,
  });
  for (const t of tables) {
    const p = layout[t.table_id];
    if (!p) continue;
    const { error } = await supabase
      .from('event_tables')
      .update({ x_pos: Math.max(0, Math.min(100, p.x)), y_pos: Math.max(0, Math.min(100, p.y)) })
      .eq('table_id', t.table_id)
      .eq('event_id', eventId);
    if (error) throw new Error(error.message);
  }

  // Seat the confirmed-attending guests by role-tier ring against the new
  // layout (same pure logic as Auto Arrange / autoSeatGuests). A fresh floor has
  // no prior assignments, so pass an empty set.
  const positioned = tables.map((t) =>
    layout[t.table_id] ? { ...t, x_pos: layout[t.table_id]!.x, y_pos: layout[t.table_id]!.y } : t,
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
  // Iteration 0053 P4 Unit 6: tier by the event's role set (wedding → identical).
  // priorityOrder passed as null (this call's current effective default) so the
  // roleSet 6th arg can be threaded without changing the draft's fill order.
  const roleSet = await resolveRoleSetForEvent(eventId);
  const rows = computeAutoSeat(
    positioned,
    autoSeatGuestList,
    [],
    { x: floorPlan.stage_x, y: floorPlan.stage_y },
    null,
    roleSet,
  );
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
  // Mirror Auto Arrange's adoption stamp for the admin lead-scoring signal.
  await supabase
    .from('events')
    .update({ auto_seat_last_used_at: new Date().toISOString() })
    .eq('event_id', eventId);
  revalidatePath(`/dashboard/${eventId}/seating`);
  return { tables: tables.length, seated: rows.length };
}
