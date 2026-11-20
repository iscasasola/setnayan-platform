import type { SupabaseClient } from '@supabase/supabase-js';
import { askedOnce } from '@/lib/request-once';

/**
 * lib/event-delegate-once.ts — "WHAT MAY THIS DELEGATE DO ON THIS EVENT?" IS ASKED ONCE PER RENDER (speed pass
 * 2026-11-18).
 *
 * The byte-identical request
 * `event_moderators?select=permissions_json&event_id=eq.<e>&user_id=eq.<u>&accepted_at=not.is.null&removed_at=is.null`
 * was sent by `fetchEventViewer` (22 callers), the People page, the Schedule's advance check and the budget's
 * visibility — up to three times in one render. It is now one read, remembered by `askedOnce` (`lib/request-once.ts`)
 * exactly as `eventMemberTypeOnce` remembers the membership read: keyed by the client's authority, the event and the
 * user; per render only (a server action or route reads afresh); the answer handed out as the database gave it — an
 * error stays an error for every asker. No retry is added: each caller degrades as it did before.
 *
 * Only this exact shape belongs here. The reads that also exclude `role_subtype = 'viewer'`, or that list every seat,
 * ask a different question and keep their own.
 */
export function eventDelegateGrantOnce(client: SupabaseClient, eventId: string, userId: string) {
  return askedOnce(client, 'event_moderators.permissions_json', [eventId, userId], async () =>
    client
      .from('event_moderators')
      .select('permissions_json')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle(),
  );
}
