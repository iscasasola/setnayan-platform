'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SCHEDULE_BLOCK_TYPES, type ScheduleBlockType } from '@/lib/schedule';

const VALID_TYPES = new Set<ScheduleBlockType>(SCHEDULE_BLOCK_TYPES);

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function parseDatetimeLocal(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  // <input type="datetime-local"> gives e.g. "2026-12-12T15:30"; treat as
  // local time, convert to ISO with the user's local TZ offset.
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function createScheduleBlock(formData: FormData) {
  const eventId = formData.get('event_id');
  const label = formData.get('label');
  const blockTypeRaw = formData.get('block_type');
  const startRaw = formData.get('start_at');
  const endRaw = formData.get('end_at');

  if (typeof eventId !== 'string' || typeof label !== 'string') {
    throw new Error('Invalid input');
  }
  if (typeof blockTypeRaw !== 'string' || !VALID_TYPES.has(blockTypeRaw as ScheduleBlockType)) {
    throw new Error('Invalid block type');
  }
  const trimmedLabel = label.trim().slice(0, 120);
  if (trimmedLabel.length === 0) throw new Error('Label required');

  const startIso = parseDatetimeLocal(startRaw);
  const endIso = parseDatetimeLocal(endRaw);
  if (!startIso) throw new Error('Start time required');
  if (endIso && new Date(endIso) <= new Date(startIso)) {
    throw new Error('End time must be after start time');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('event_schedule_blocks').insert({
    event_id: eventId,
    label: trimmedLabel,
    block_type: blockTypeRaw,
    start_at: startIso,
    end_at: endIso,
    location: nullIfBlank(formData.get('location')),
    notes: nullIfBlank(formData.get('notes')),
    is_public: formData.get('is_public') === 'on',
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
}

export async function deleteScheduleBlock(formData: FormData) {
  const eventId = formData.get('event_id');
  const blockId = formData.get('block_id');
  if (typeof eventId !== 'string' || typeof blockId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_schedule_blocks')
    .delete()
    .eq('block_id', blockId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
}

export async function toggleBlockVisibility(formData: FormData) {
  const eventId = formData.get('event_id');
  const blockId = formData.get('block_id');
  const desiredRaw = formData.get('desired');
  if (
    typeof eventId !== 'string' ||
    typeof blockId !== 'string' ||
    typeof desiredRaw !== 'string'
  ) {
    throw new Error('Invalid input');
  }
  const desired = desiredRaw === 'true';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_schedule_blocks')
    .update({ is_public: desired, updated_at: new Date().toISOString() })
    .eq('block_id', blockId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
}
