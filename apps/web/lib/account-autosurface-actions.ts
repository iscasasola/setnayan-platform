'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';

/**
 * Account auto-surface opt-out ("leave") — #7b. The guest says NO from their own
 * event picker → hide the auto-surfaced event. Guarded to the caller's OWN
 * `auto_surfaced` membership: a real (explicitly-joined) membership is never
 * touched, and one account can't hide another's row. Admin client because
 * event_members RLS doesn't let a guest member self-update. (Declining the RSVP
 * is the other "no" path — handled DB-side by `hide_autosurfaced_on_decline`.)
 */
export async function leaveAutoSurfacedEvent(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '');
  if (!eventId) return;
  const user = await getCurrentUser();
  if (!user) return;

  const admin = createAdminClient();
  await admin
    .from('event_members')
    .update({ hidden_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('auto_surfaced', true)
    .is('hidden_at', null);

  revalidatePath('/dashboard');
}
