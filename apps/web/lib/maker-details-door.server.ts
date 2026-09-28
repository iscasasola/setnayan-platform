import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { logQueryError } from '@/lib/supabase/error-detect';
import { makerHasWork } from '@/lib/maker-details-items';

/**
 * 📦 IS THE MAKER'S DETAILS THIS VIEWER'S DOOR TO A PAGE THAT MOVED INTO IT?
 * (Details part 2b — the Love Story and Schedule pages are Details items now;
 * "old routes keep working (redirect to the Details item)".)
 *
 * Only where Details actually draws the item — `makerHasWork`, the launch
 * page's own rule: the couple of an event type WITH an Event Hub. (The Mood
 * Board's page asks the same rule inline.) Anybody else —
 * a coordinator on the schedule, an event type with no Event Hub — keeps the
 * standalone page exactly as it was, so the redirect can never bounce a viewer
 * into a Maker that has nothing to show them. A refused read is NOT a yes: the
 * page stays where it is.
 */
export async function detailsIsTheDoor(supabase: SupabaseClient, eventId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    logQueryError('detailsIsTheDoor.membership', error, { event_id: eventId }, 'graceful_degrade');
    return false;
  }
  const memberType = (data as { member_type?: string | null } | null)?.member_type ?? null;
  // The ONE rule the launch page draws its work area by (`makerHasWork`).
  return makerHasWork(memberType, surfaceEnabled(await resolveProfileByEvent(eventId), 'website'));
}
