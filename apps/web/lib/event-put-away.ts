import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * May this person put the event away (or bring it back)? ONE answer for the writer (`setEventArchived` in
 * `app/dashboard/[eventId]/archive-actions.ts`) and every card that offers it (`details/page.tsx` · `PutAwayCard`), so
 * the card is never drawn for someone the writer refuses (final check A2-H10).
 *
 * 👑 OWNER RULING (brief Add 39, 25 Nov 2026): only the couple can put their event away — a coordinator or a helper
 * cannot (putting it away quiets the cameras and Memory lane). So: a `couple` member of this event. Read with the
 * request's own client: a refused read answers `false` (no card, no write), never a guess that they may.
 */
export async function mayPutAwayEvent(supabase: SupabaseClient, eventId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('member_type', 'couple')
    .maybeSingle();
  return !error && Boolean(data);
}
