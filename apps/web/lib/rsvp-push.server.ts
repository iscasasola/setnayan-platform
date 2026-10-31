import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isAnyPushConfigured, sendPush } from '@/lib/push-send.server';
import { rsvpPushFacts, type UnreadReplyRow } from '@/lib/rsvp-push-count';
import { rsvpSentence } from '@/lib/push-message';

/**
 * A GUEST REPLIED → THE HOST'S PHONE, AT ONCE, REPLACING THE LAST ONE.
 *
 * Owner, 2026-10-31, verbatim "Yes" to: *"instant, but each new RSVP notification
 * replaces the last one on the lock screen instead of stacking."*
 *
 *   · INSTANT — no window, no hold. Called by `emitNotification` right after the
 *     reply's bell row lands, which itself runs in the RSVP action's `after()`, so
 *     the guest's reply never waits on it.
 *   · REPLACES — the collapse key is `rsvp:<eventId>` (Web Push `tag` + `Topic`;
 *     `apns-collapse-id` next), so the lock screen holds ONE notice per event.
 *   · COUNTS WHAT IS UNREAD — "Maria replied", then "Maria + 1 other replied",
 *     then "Maria + 5 others replied": the host's UNREAD `rsvp_received` rows for
 *     this event (lib/rsvp-push-count.ts, pure). Opening Guests or reading the
 *     bell marks them read, so the count starts again from the next reply.
 *   · "· 34 coming so far" — guests attending, removed guests left out.
 *
 * No new table, no new column: the count is the bell rows' own `read_at`.
 */
export async function pushRsvpReply(userId: string, eventId: string): Promise<void> {
  if (!isAnyPushConfigured()) return;
  try {
    const admin = createAdminClient();
    const [replies, coming] = await Promise.all([
      admin
        .from('notifications')
        .select('title, related_url, created_at')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .eq('type', 'rsvp_received')
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(500),
      admin
        .from('guests')
        .select('guest_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('rsvp_status', 'attending')
        .is('deleted_at', null),
    ]);
    if (replies.error) {
      logQueryError('pushRsvpReply.unread', replies.error, { eventId }, 'graceful_degrade');
      return;
    }
    if (coming.error) logQueryError('pushRsvpReply.coming', coming.error, { eventId }, 'graceful_degrade');
    const facts = rsvpPushFacts((replies.data ?? []) as UnreadReplyRow[], eventId, coming.error ? null : coming.count ?? null);
    if (!facts) return;
    await sendPush(userId, {
      sentence: rsvpSentence(facts),
      url: facts.url,
      collapseKey: `rsvp:${eventId}`,
      eventId,
      fallbackUrl: `/dashboard/${eventId}/guests`,
    });
  } catch (e) {
    console.error('[rsvp-push] pushRsvpReply threw:', e);
  }
}

/**
 * OPENING GUESTS RESETS THE COUNT (reading the bell already does, through `read_at`).
 * The host has now seen the list, so this event's guest-reply bell rows are read, and
 * the next reply's notice says "Maria replied" again. Runs in the Guests page's
 * `after()`, for the couple, once the list was really drawn — it adds nothing to the
 * page's wait and no server action (the budget is at its ceiling). `userId` is the
 * page's own signed-in user; the service-role client is scoped to that id because
 * cookies are out of reach after the response.
 */
export async function markReplyNoticesSeen(userId: string, eventId: string): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .eq('type', 'rsvp_received')
      .is('read_at', null);
    if (error) logQueryError('markReplyNoticesSeen', error, { eventId }, 'graceful_degrade');
  } catch (e) {
    console.error('[rsvp-push] markReplyNoticesSeen threw:', e);
  }
}
