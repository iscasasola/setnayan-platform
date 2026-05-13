'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { STEPS, type StepKey } from '@/lib/planner';

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
