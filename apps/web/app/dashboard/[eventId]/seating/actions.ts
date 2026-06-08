'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent } from '@/lib/guests';
import {
  TABLE_TYPE_CATALOG,
  computeAutoSeat,
  fetchAssignments,
  fetchTables,
  type AutoSeatGuest,
  type TableType,
} from '@/lib/seating';

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
  const fallback = TABLE_TYPE_CATALOG.find((t) => t.type === type)?.defaultCapacity ?? 8;
  const capacity = Math.max(
    1,
    Math.min(32, typeof capacityRaw === 'string' ? Number(capacityRaw) || fallback : fallback),
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

  const [tables, assignments, guests] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
  ]);

  const autoSeatGuestList: AutoSeatGuest[] = guests.map((g) => ({
    guest_id: g.guest_id,
    role: g.role,
    group_category: g.group_category,
    rsvp_status: g.rsvp_status,
    plus_one_of_guest_id: g.plus_one_of_guest_id,
    last_name: g.last_name,
    first_name: g.first_name,
  }));

  const rows = computeAutoSeat(tables, autoSeatGuestList, assignments);
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
  // Positions are stored as percent (0–100) of the canvas dimensions, so the
  // layout adapts to whatever container size we render the floor plan in.
  const clampedX = Math.max(0, Math.min(100, x));
  const clampedY = Math.max(0, Math.min(100, y));

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
