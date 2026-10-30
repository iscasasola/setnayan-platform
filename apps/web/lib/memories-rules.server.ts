import type { SupabaseClient } from '@supabase/supabase-js';
import { delegateAccessHasExpired } from '@/lib/delegate-access-window';
import { COORDINATOR_SEAT_ROLE } from '@/lib/events-you-run';
import { logQueryError } from '@/lib/supabase/error-detect';
import { memoriesManagerRoleOf, type MemoriesManagerRole } from '@/lib/memories-rules';

/**
 * apps/web/lib/memories-rules.server.ts — WHO MAY CHANGE THIS EVENT'S MEMORIES RULES (the read half of
 * `lib/memories-rules.ts`; the rule itself is `memoriesManagerRoleOf`, executed by `memories-rules.test.ts`).
 *
 * Three reads at once on the CALLER'S OWN session (RLS lets a member read their own membership and seat): their
 * `event_members` row, their live coordinator seat, and the event's date for the coordinator's window.
 *
 * 🔒 FAILS CLOSED. Any read that errors answers null — "may not change it" — and is logged: a refused read must
 * never widen who may open every guest's photos to every guest. (The page that draws the ⚙ uses the same answer,
 * so a refusal hides the control rather than drawing one whose save would be refused.)
 */
export async function memoriesManagerRole(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<MemoriesManagerRole | null> {
  if (!eventId || !userId) return null;
  const [memberRes, seatRes, eventRes] = await Promise.all([
    supabase.from('event_members').select('member_type').eq('event_id', eventId).eq('user_id', userId).maybeSingle(),
    supabase
      .from('event_moderators')
      .select('moderator_id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('role_subtype', COORDINATOR_SEAT_ROLE)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .limit(1),
    supabase.from('events').select('event_date, event_end_date, event_date_precision').eq('event_id', eventId).maybeSingle(),
  ]);
  const failed = memberRes.error ?? seatRes.error ?? eventRes.error;
  if (failed) {
    logQueryError('memoriesManagerRole', failed, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const memberType = ((memberRes.data as { member_type?: string } | null)?.member_type ?? null) as string | null;
  const ev = eventRes.data as { event_date?: string | null; event_end_date?: string | null; event_date_precision?: string | null } | null;
  return memoriesManagerRoleOf({
    memberType,
    coordinatorSeat: (seatRes.data ?? []).length > 0,
    coordinatorWindowClosed: delegateAccessHasExpired({
      isCouple: memberType === 'couple',
      eventDate: ev?.event_date ?? null,
      eventEndDate: ev?.event_end_date ?? null,
      precision: ev?.event_date_precision ?? null,
      now: new Date(),
    }),
  });
}
