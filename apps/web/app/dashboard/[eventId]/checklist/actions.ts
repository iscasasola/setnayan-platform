'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Upsert or delete a per-plan-group couple decision on the adaptive checklist.
 *
 * decision = 'excluded' | 'deferred' → upserts a row in event_category_decisions.
 * decision = null → deletes the row, resetting the category back to not_started.
 *
 * Authorization: validates that the caller is a couple member of the event
 * (RLS on event_category_decisions enforces this at the DB layer; we also
 * check membership explicitly so we can give a clear error instead of a
 * silent no-op on RLS rejection).
 */
export async function setCategoryDecision(
  eventId: string,
  planGroupId: string,
  decision: 'excluded' | 'deferred' | null,
): Promise<void> {
  if (!eventId || !planGroupId) throw new Error('eventId and planGroupId are required');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify couple membership — the table's RLS enforces this at DB level too,
  // but an explicit check gives us a clear error if needed.
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if ((membership as { member_type?: string } | null)?.member_type !== 'couple') {
    throw new Error('Only couple members can record category decisions');
  }

  if (decision === null) {
    // Reset: delete the explicit decision row, returning the category to not_started.
    const { error } = await supabase
      .from('event_category_decisions')
      .delete()
      .eq('event_id', eventId)
      .eq('plan_group_id', planGroupId);
    if (error) throw new Error(error.message);
  } else {
    // Upsert: insert or replace the decision for this plan group.
    const { error } = await supabase
      .from('event_category_decisions')
      .upsert(
        {
          event_id: eventId,
          plan_group_id: planGroupId,
          decision,
          decided_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,plan_group_id' },
      );
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/dashboard/${eventId}/checklist`);
  revalidatePath(`/dashboard/${eventId}`);
}
