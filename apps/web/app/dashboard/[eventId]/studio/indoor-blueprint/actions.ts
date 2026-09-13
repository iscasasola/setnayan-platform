'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { clampPct } from '@/lib/indoor-blueprint';

/**
 * Save the venue entrance marker position for the Indoor Blueprint wayfinding.
 *
 * Auth-bound (the couple's add-on page is behind auth) + writes through the
 * standard RLS-scoped server client, so `event_floor_plan`'s couple-write
 * policy authorizes it — no service-role escalation. Persists the entrance as
 * 0–100 percentages on the seating floor-plan grid.
 *
 * ⚠ WRITES THE CANONICAL STORE, NOT `events.venue_entrance_*` ANY MORE. Those
 * columns were a SECOND source of truth: this editor wrote them and only the
 * wayfinding read them, while the seating lab, the public venue walk,
 * plan3d-scene and venue-decor all read `event_floor_plan.entrance_x/y`. A
 * couple who moved the door here left the 3D room's door where it was.
 *
 * `entrance_enabled` is set TRUE deliberately: placing a marker is the couple
 * saying "the door is here", and the 3D surfaces IGNORE a stored position while
 * the doorway is disabled. Writing the position without enabling it would save
 * a coordinate that every 3D surface then refuses to use — the same silent
 * disagreement, one field along.
 *
 * Graceful-degrade: a missing table/column (pre-migration database, 42P01 /
 * 42703) is a no-op success, so the couple's UI never errors on a database
 * that hasn't caught up. Any other error surfaces.
 */
export async function saveEntrance(formData: FormData) {
  const eventId = formData.get('event_id');
  const xRaw = formData.get('entrance_x');
  const yRaw = formData.get('entrance_y');

  if (typeof eventId !== 'string') {
    throw new Error('Invalid input');
  }
  const x = clampPct(typeof xRaw === 'string' ? Number(xRaw) : NaN);
  const y = clampPct(typeof yRaw === 'string' ? Number(yRaw) : NaN);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_floor_plan')
    .upsert({ event_id: eventId, entrance_x: x, entrance_y: y, entrance_enabled: true }, { onConflict: 'event_id' });

  // Pre-migration table/column-missing → no-op success so the UI doesn't throw
  // on a database that hasn't caught up.
  if (error && error.code !== '42703' && error.code !== '42P01') {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/${eventId}/studio/indoor-blueprint`);
  // The door the couple just placed is drawn by the seating lab and walked
  // through on the public venue page — both read the row we just wrote, so
  // both must be re-rendered or the unification is invisible until a hard
  // reload. This is the whole point of the change: one door, everywhere.
  revalidatePath(`/dashboard/${eventId}/seating`);
  revalidatePath(`/dashboard/${eventId}/seating/lab`);
}
