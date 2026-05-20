'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { STEPS, type StepKey } from '@/lib/planner';

/**
 * Save the wedding date on an event. Empty / null clears the date back to
 * "not set." RLS scopes the update to event_members so non-hosts can't
 * touch other people's events.
 *
 * Per the 0021 date-edit gate: hosts may freely change the date until at
 * least one vendor relationship is in a confirmed state (`accepted` /
 * `active`), at which point edits are gated to support. For the V1 input
 * we allow free updates — the support-gate logic comes when the vendor
 * confirmation states actually settle on prod.
 */
export async function updateEventDate(formData: FormData) {
  const eventId = formData.get('event_id');
  const dateRaw = formData.get('event_date');
  if (typeof eventId !== 'string') throw new Error('event_id required');

  let eventDate: string | null = null;
  if (typeof dateRaw === 'string' && dateRaw.trim().length > 0) {
    // HTML date inputs emit YYYY-MM-DD which Postgres DATE accepts as-is.
    // Reject anything else so we don't store junk.
    const trimmed = dateRaw.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new Error('Invalid date format — use YYYY-MM-DD');
    }
    eventDate = trimmed;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('events')
    .update({ event_date: eventDate })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}`);
}

const MANUAL_KEYS = new Set<StepKey>(
  STEPS.filter((s) => s.source === 'manual').map((s) => s.key),
);

export async function toggleJourneyStep(formData: FormData) {
  const eventId = formData.get('event_id');
  const stepKey = formData.get('step_key');
  const action = formData.get('action');

  if (typeof eventId !== 'string' || typeof stepKey !== 'string' || typeof action !== 'string') {
    throw new Error('Invalid input');
  }
  if (!MANUAL_KEYS.has(stepKey as StepKey)) {
    throw new Error('Step is auto-derived');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (action === 'complete') {
    const { error } = await supabase
      .from('event_journey_steps')
      .upsert(
        { event_id: eventId, step_key: stepKey, completed_by: user.id, completed_at: new Date().toISOString() },
        { onConflict: 'event_id,step_key' },
      );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('event_journey_steps')
      .delete()
      .eq('event_id', eventId)
      .eq('step_key', stepKey);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/dashboard/${eventId}`);
}
