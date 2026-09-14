import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { logQueryError } from '@/lib/supabase/error-detect';
import type { EventViewer } from './event-viewer';
import type { ModeratorPermissions } from './delegate-areas';
import { permissionsWithinWindow } from './delegate-access-window';

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
  const [memberRes, delegateRes, eventRes] = await Promise.all([
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
    // The access WINDOW (owner 2026-09-14: a delegate's access ends seven days
    // after the event; the couple's never does). Read alongside the other two
    // rather than after them — it is the same round trip, and a delegate whose
    // window has closed must not be resolved as a delegate at all.
    supabase
      .from('events')
      .select('event_date, event_end_date, event_date_precision')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  if (memberRes.error) {
    logQueryError('fetchEventViewer.member', memberRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  if (delegateRes.error) {
    logQueryError('fetchEventViewer.delegate', delegateRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  if (eventRes.error) {
    logQueryError('fetchEventViewer.window', eventRes.error, { event_id: eventId }, 'graceful_degrade');
  }

  const isCouple =
    (memberRes.data as { member_type?: string } | null)?.member_type === 'couple';
  const ev = eventRes.data as
    | { event_date?: string | null; event_end_date?: string | null; event_date_precision?: string | null }
    | null;

  return {
    isCouple,
    // ⚠ A REFUSED DATE READ LEAVES THE WINDOW OPEN, and that is the opposite of
    // this file's other degrade — deliberately. The rest of this function makes
    // a refused read a STRANGER because showing less than they have is
    // recoverable. Here the same instinct inverts: `ev` null would mean "no
    // date", and `delegateAccessHasExpired` treats no date as NOT expired, so a
    // transient failure cannot lock a coordinator out of a wedding they are
    // running that week. Being one read late to revoke is recoverable; being
    // locked out mid-event is not.
    delegatePermissions: permissionsWithinWindow(
      (delegateRes.data?.permissions_json as ModeratorPermissions | undefined) ?? null,
      {
        isCouple,
        eventDate: ev?.event_date ?? null,
        eventEndDate: ev?.event_end_date ?? null,
        precision: ev?.event_date_precision ?? null,
        now: new Date(),
      },
    ),
  };
}
