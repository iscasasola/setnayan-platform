'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { clampPct } from '@/lib/indoor-blueprint';

/**
 * Save the venue entrance marker position for the Indoor Blueprint wayfinding.
 *
 * Auth-bound (the couple's add-on page is behind auth) + writes through the
 * standard RLS-scoped server client, so the existing per-event `events` policy
 * authorizes the update — no service-role escalation. Persists the entrance as
 * 0–100 percentages on the seating floor-plan grid (migration 20260717000000).
 *
 * Graceful-degrade: if the entrance columns don't exist yet (pre-migration
 * database, error 42703), the save is a no-op success — the wayfinding still
 * works off the bottom-center default, so the couple's UI never errors out on
 * a database that hasn't applied the migration. Any other error surfaces.
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
    .from('events')
    .update({ venue_entrance_x: x, venue_entrance_y: y })
    .eq('event_id', eventId);

  // Pre-migration column-missing → treat as a no-op success so the UI doesn't
  // throw on a database that hasn't applied 20260717000000 yet.
  if (error && error.code !== '42703') {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/${eventId}/add-ons/indoor-blueprint`);
}
