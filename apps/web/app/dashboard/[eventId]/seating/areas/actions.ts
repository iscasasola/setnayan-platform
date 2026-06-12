'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Areas & booths — multi-area blueprints (cocktail garden, foyer) with
 * free-placed booth/station pins, each optionally linked to a booked vendor.
 * Owner-approved 2026-06-13 ("extend a blueprint for the cocktail place
 * while waiting for the reception venue").
 *
 * All writes ride RLS: couple (Pattern B) + Phase 2 delegates holding the
 * seat_plan edit grant. No admin client anywhere in this file.
 */

const AREA_TYPES = new Set(['cocktail', 'ceremony', 'foyer', 'garden', 'custom']);
const OBJECT_TYPES = new Set(['booth', 'station', 'bar', 'photo_wall', 'dessert', 'custom']);

function str(raw: FormDataEntryValue | null, max = 80): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

function pct(raw: FormDataEntryValue | null, fallback: number): number {
  const n = typeof raw === 'string' ? Number(raw) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return supabase;
}

export async function createFloorArea(formData: FormData) {
  const eventId = str(formData.get('event_id'), 64);
  const label = str(formData.get('label'));
  const areaTypeRaw = str(formData.get('area_type'), 20) ?? 'cocktail';
  if (!eventId || !label) throw new Error('Area needs a name.');
  const areaType = AREA_TYPES.has(areaTypeRaw) ? areaTypeRaw : 'custom';

  const supabase = await requireUser();
  const { error } = await supabase.from('event_floor_areas').insert({
    event_id: eventId,
    area_type: areaType,
    label,
    schedule_block_id: str(formData.get('schedule_block_id'), 64),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating/areas`);
  redirect(`/dashboard/${eventId}/seating/areas`);
}

export async function updateFloorArea(formData: FormData) {
  const eventId = str(formData.get('event_id'), 64);
  const areaId = str(formData.get('area_id'), 64);
  if (!eventId || !areaId) throw new Error('Invalid input');

  const supabase = await requireUser();
  const patch: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };
  const label = str(formData.get('label'));
  if (label) patch.label = label;
  // Empty string = unlink the schedule block.
  if (formData.has('schedule_block_id')) {
    patch.schedule_block_id = str(formData.get('schedule_block_id'), 64);
  }
  const { error } = await supabase
    .from('event_floor_areas')
    .update(patch)
    .eq('area_id', areaId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating/areas`);
  redirect(`/dashboard/${eventId}/seating/areas`);
}

export async function deleteFloorArea(formData: FormData) {
  const eventId = str(formData.get('event_id'), 64);
  const areaId = str(formData.get('area_id'), 64);
  if (!eventId || !areaId) throw new Error('Invalid input');

  const supabase = await requireUser();
  // Pins cascade with the area (ON DELETE CASCADE).
  const { error } = await supabase
    .from('event_floor_areas')
    .delete()
    .eq('area_id', areaId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating/areas`);
  redirect(`/dashboard/${eventId}/seating/areas`);
}

export async function createFloorObject(formData: FormData) {
  const eventId = str(formData.get('event_id'), 64);
  const label = str(formData.get('label'));
  const typeRaw = str(formData.get('object_type'), 20) ?? 'booth';
  if (!eventId || !label) throw new Error('The pin needs a name.');

  const supabase = await requireUser();
  const { error } = await supabase.from('event_floor_objects').insert({
    event_id: eventId,
    // NULL = the reception canvas.
    area_id: str(formData.get('area_id'), 64),
    object_type: OBJECT_TYPES.has(typeRaw) ? typeRaw : 'booth',
    label,
    event_vendor_id: str(formData.get('event_vendor_id'), 64),
    x_pos: pct(formData.get('x_pos'), 50),
    y_pos: pct(formData.get('y_pos'), 50),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating/areas`);
  redirect(`/dashboard/${eventId}/seating/areas`);
}

/**
 * Drag-end position save from the client canvas. Plain server action (no
 * redirect — the canvas updates optimistically and only needs the write).
 */
export async function moveFloorObject(
  eventId: string,
  objectId: string,
  x: number,
  y: number,
): Promise<{ ok: boolean }> {
  if (!eventId || !objectId) return { ok: false };
  const supabase = await requireUser();
  const { error } = await supabase
    .from('event_floor_objects')
    .update({
      x_pos: Math.min(100, Math.max(0, x)),
      y_pos: Math.min(100, Math.max(0, y)),
      updated_at: new Date().toISOString(),
    })
    .eq('object_id', objectId)
    .eq('event_id', eventId);
  if (error) return { ok: false };
  revalidatePath(`/dashboard/${eventId}/seating/areas`);
  return { ok: true };
}

export async function deleteFloorObject(formData: FormData) {
  const eventId = str(formData.get('event_id'), 64);
  const objectId = str(formData.get('object_id'), 64);
  if (!eventId || !objectId) throw new Error('Invalid input');

  const supabase = await requireUser();
  const { error } = await supabase
    .from('event_floor_objects')
    .delete()
    .eq('object_id', objectId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/seating/areas`);
  redirect(`/dashboard/${eventId}/seating/areas`);
}
