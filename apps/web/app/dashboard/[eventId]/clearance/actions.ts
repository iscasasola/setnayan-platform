'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { logQueryError } from '@/lib/supabase/error-detect';
import { refuseLimitedHelper } from '@/lib/host-gate';
import { EVENT_CLOCK_COLUMNS } from '@/lib/event-clock';
import { eventClockOf } from '@/lib/event-clock.server';
import { closeOutOpen } from '@/lib/close-out-open';

/**
 * "Close out the day" — the event-level clearance that flips the lifecycle phase
 * Day-of → After (Event Lifecycle Menu PR3). Operable by the couple OR a
 * delegated coordinator. Stamps events.cleared_at + cleared_by_user_id via the
 * admin client AFTER an explicit membership check (events writes don't have a
 * couple-update RLS path for arbitrary columns, so we verify membership first
 * then write service-role — the same pattern other couple/coordinator day-of
 * actions use).
 */
export async function closeOutTheDay(eventId: string): Promise<void> {
  await refuseLimitedHelper(eventId, null);
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !['couple', 'coordinator'].includes(membership.member_type as string)) {
    redirect(`/dashboard/${eventId}`);
  }

  const admin = createAdminClient();
  // A2-P8: never before The Day has opened at the venue — the same rule the page draws (`closeOutOpen`).
  const { data: clockRow, error: clockError } = await admin
    .from('events')
    .select(EVENT_CLOCK_COLUMNS)
    .eq('event_id', eventId)
    .maybeSingle();
  if (clockError || !clockRow) {
    logQueryError('closeOutTheDay (clock read)', clockError, { event_id: eventId }, 'graceful_degrade');
    redirect(`/dashboard/${eventId}/clearance?error=save_failed`);
  }
  if (!closeOutOpen(eventClockOf(clockRow))) {
    redirect(`/dashboard/${eventId}/clearance?error=too_early`);
  }

  const { error } = await admin
    .from('events')
    .update({ cleared_at: new Date().toISOString(), cleared_by_user_id: user.id })
    .eq('event_id', eventId)
    .is('cleared_at', null); // idempotent — don't overwrite an earlier close-out
  if (error) {
    logQueryError('closeOutTheDay (events update)', error, { event_id: eventId }, 'graceful_degrade');
    // A2-G17: a failed save stays on the page and says so — never the success landing.
    redirect(`/dashboard/${eventId}/clearance?error=save_failed`);
  }

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  redirect(`/dashboard/${eventId}`);
}
