'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TABLE_TYPE_CATALOG, type TableType } from '@/lib/seating';

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

  const { error } = await supabase.from('event_seat_assignments').upsert(
    {
      event_id: eventId,
      table_id: tableId,
      guest_id: guestId,
    },
    { onConflict: 'event_id,guest_id' },
  );
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
