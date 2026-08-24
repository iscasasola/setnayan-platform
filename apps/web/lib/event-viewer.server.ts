import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { logQueryError } from '@/lib/supabase/error-detect';
import type { EventViewer } from './event-viewer';
import type { ModeratorPermissions } from './delegate-areas';

// Re-exported so a screen needs one import, not two, and cannot accidentally
// answer the permission question with its own copy of the rule.
export { viewerAreaLevel, isDelegateWithoutArea } from './event-viewer';
export type { EventViewer } from './event-viewer';

/**
 * WHO IS LOOKING AT THIS EVENT — the couple, a delegate, or neither.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Three screens already resolved this by hand, with the same pair of reads
 * copied between them (`/people`, `/schedule`, and the floor console). A
 * fourth and fifth needed it, and a permission question answered in five
 * places is five chances for one of them to answer differently. It is the
 * caller's OWN rows both times, so every policy admits them.
 *
 * 🔑 IT RETURNS THE VIEWER, NOT A BOOLEAN. The screens do not all ask the
 * same question — one wants "may they see the guest list", another "may they
 * edit the seat plan" — and a helper that answered only the first would be
 * copied and widened by the second.
 *
 * ⚠ A REFUSED READ MAKES THEM A STRANGER, DELIBERATELY. Both reads are the
 * caller's own rows, so a refusal is not a normal state; treating it as "no
 * access" shows them less than they have, which is recoverable. The other
 * direction is not.
 */
export async function fetchEventViewer(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<EventViewer> {
  const [memberRes, delegateRes] = await Promise.all([
    supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('event_moderators')
      .select('permissions_json')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle(),
  ]);

  if (memberRes.error) {
    logQueryError('fetchEventViewer.member', memberRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  if (delegateRes.error) {
    logQueryError('fetchEventViewer.delegate', delegateRes.error, { event_id: eventId }, 'graceful_degrade');
  }

  return {
    isCouple: (memberRes.data as { member_type?: string } | null)?.member_type === 'couple',
    delegatePermissions:
      (delegateRes.data?.permissions_json as ModeratorPermissions | undefined) ?? null,
  };
}
