import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * May this person put the event away (or bring it back)? ONE answer for the writer (`setEventArchived` in
 * `app/dashboard/[eventId]/archive-actions.ts`) and the card that offers it (`details/page.tsx` · `PutAwayCard`), so the
 * card is never drawn for someone the writer refuses (final check A2-H10: a view-only helper was handed a button that
 * always answered "Only a host of this event can put it away.").
 *
 * A host is a `couple` or `coordinator` member, or an accepted, not-removed helper whose role is not `viewer`. Read
 * with the request's own client: a refused read answers `false` (no card, no write), never a guess that they may.
 */
export async function mayPutAwayEvent(supabase: SupabaseClient, eventId: string, userId: string): Promise<boolean> {
  const { data: memberRow } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .in('member_type', ['couple', 'coordinator'])
    .maybeSingle();
  if (memberRow) return true;
  const { data: modRow } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .is('removed_at', null)
    .not('accepted_at', 'is', null)
    .neq('role_subtype', 'viewer') // a limited helper views, never edits (owner 2026-09-28)
    .maybeSingle();
  return Boolean(modRow);
}
