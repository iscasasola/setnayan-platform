'use server';

/**
 * switch-on-actions.ts — Home's "Switch on more" (owner 2026-10-08, Level 1).
 *
 * ⚖ DECISION_LOG "ONBOARDING FOLLOWS WHAT THE EVENT NEEDS": what the person left off at onboarding
 * "stays off but can be switched on later from Home's quick setup". One tap writes the need's own
 * column (`lib/event-needs.ts` `SWITCH_ON`) and lands on the shipped setup for it (matrix §2: guests →
 * the Guest list, whose first visit asks who can reply · suppliers → Find · the Event Hub → the Maker).
 *
 * The write goes through the HOST'S OWN SESSION (the columns carry UPDATE for authenticated, migration
 * 20271276545380), after the host gate. 🔴 A zero-row UPDATE is success-shaped, so the row is asked
 * back (`.select`) and an empty answer is a failure, said out loud — never a landing on a page that
 * still hides what was just "switched on".
 */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireHostMembershipOrThrow, refuseLimitedHelper } from '@/lib/host-gate';
import { isUuid } from '@/lib/is-uuid';
import { SWITCH_ON, isSwitchOnNeed } from '@/lib/event-needs';

export async function switchOnNeed(eventId: string, need: string): Promise<void> {
  await refuseLimitedHelper(eventId);
  if (!isUuid(eventId) || !isSwitchOnNeed(need)) throw new Error('That can’t be switched on here.');
  await requireHostMembershipOrThrow(eventId, 'Only the hosts can switch this on.');
  const { column, to } = SWITCH_ON[need];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .update({ [column]: true })
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !data || data.length === 0) {
    console.error('[switchOnNeed] update refused', { eventId, column, error: error?.message ?? 'no row' });
    throw new Error('We couldn’t switch that on. Nothing changed — please try again.');
  }
  const base = `/dashboard/${eventId}`;
  revalidatePath(base, 'layout');
  redirect(to(base));
}
