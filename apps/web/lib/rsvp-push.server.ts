import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { isWebPushConfigured, sendWebPush } from '@/lib/web-push';
import {
  RSVP_PUSH_FLUSH_GAP_MS,
  RSVP_PUSH_HORIZON_MS,
  decideGroupedPush,
  groupedPushText,
  type RsvpNoticeRow,
} from '@/lib/rsvp-push-grouping';

/**
 * THE GROUPED PHONE NOTICE FOR GUEST REPLIES — the server half of
 * `lib/rsvp-push-grouping.ts` (which holds every decision, pure and tested).
 *
 * Called by `emitNotification` right after an `rsvp_received` bell row lands,
 * and by the cron-free flush below for the replies left waiting at the end of a
 * burst. Both paths go through `pushGroupedRsvp`, so there is one rule.
 *
 * 🔑 THE STATE IS THE BELL ROWS THEMSELVES (`notifications.pushed_at`, migration
 * `…_rsvp_push_groups_on_the_bell_rows.sql`). A row is "in a notice" once a push
 * claimed it. No second table to drift from the tray.
 *
 * ⚖ CONCURRENCY. The claim is one UPDATE … WHERE pushed_at IS NULL, so a row is
 * never pushed twice. Two replies landing in the same instant can each win their
 * own row and send two notices seconds apart; both carry the event's `tag`, so on
 * the device the second REPLACES the first. Bounded, and invisible on the phone.
 *
 * Fails soft, like every push here: nothing in this file may cost a guest their
 * reply or a host their bell row.
 */

const SELECT = 'notification_id, title, body, related_url, created_at, pushed_at, read_at';

export type GroupedPushOutcome = 'sent' | 'held' | 'nothing' | 'unconfigured' | 'refused';

export async function pushGroupedRsvp(
  userId: string,
  eventId: string,
  nowMs: number = Date.now(),
): Promise<GroupedPushOutcome> {
  if (!isWebPushConfigured()) return 'unconfigured';
  try {
    const admin = createAdminClient();
    const since = new Date(nowMs - RSVP_PUSH_HORIZON_MS).toISOString();
    const { data, error } = await admin
      .from('notifications')
      .select(SELECT)
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .eq('type', 'rsvp_received')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) {
      logQueryError('pushGroupedRsvp.read', error, { eventId }, 'graceful_degrade');
      return 'refused';
    }
    const decision = decideGroupedPush((data ?? []) as RsvpNoticeRow[], nowMs);
    if (!decision.send) return decision.reason === 'inside-window' ? 'held' : 'nothing';

    // The claim: only rows nobody else has pushed. A zero-row answer means another
    // request won them — that is not a failure, it is the grouping working.
    const { data: claimed, error: claimError } = await admin
      .from('notifications')
      .update({ pushed_at: new Date(nowMs).toISOString() })
      .in('notification_id', decision.ids)
      .is('pushed_at', null)
      .select(SELECT);
    if (claimError) {
      logQueryError('pushGroupedRsvp.claim', claimError, { eventId }, 'graceful_degrade');
      return 'refused';
    }
    const rows = (claimed ?? []) as RsvpNoticeRow[];
    if (rows.length === 0) return 'held';
    await sendWebPush(userId, groupedPushText(rows, eventId));
    return 'sent';
  } catch (e) {
    console.error('[rsvp-push] pushGroupedRsvp threw:', e);
    return 'refused';
  }
}

/**
 * The replies left waiting when a burst ends: the last reply inside a window is
 * held, and no further reply may come to carry it. This sweep finds every host ×
 * event with a waiting reply and runs the same decision — so the tail of a burst
 * reaches the phone as *"Maria + 2 others replied"* within about a window and a
 * flush gap, instead of never.
 *
 * Returns how many notices it sent (0 is a real answer: nothing was due).
 */
export async function flushWaitingRsvpPushes(nowMs: number = Date.now()): Promise<number> {
  if (!isWebPushConfigured()) return 0;
  const admin = createAdminClient();
  const since = new Date(nowMs - RSVP_PUSH_HORIZON_MS).toISOString();
  const { data, error } = await admin
    .from('notifications')
    .select('user_id, event_id')
    .eq('type', 'rsvp_received')
    .is('pushed_at', null)
    .is('read_at', null)
    .not('event_id', 'is', null)
    .gte('created_at', since)
    .limit(1000);
  if (error) throw new Error(`rsvp-push flush read refused: ${error.message}`);
  const keys = new Map<string, { userId: string; eventId: string }>();
  for (const r of (data ?? []) as { user_id: string; event_id: string | null }[]) {
    if (!r.event_id) continue;
    keys.set(`${r.user_id}:${r.event_id}`, { userId: r.user_id, eventId: r.event_id });
  }
  let sent = 0;
  for (const { userId, eventId } of keys.values()) {
    if ((await pushGroupedRsvp(userId, eventId, nowMs)) === 'sent') sent += 1;
  }
  return sent;
}

/** CRON-FREE, like every periodic job here: a DB claim on request traffic. Never throws. */
export async function maybeFlushRsvpPushes(): Promise<void> {
  await runClaimedJob('rsvp-push-flush', RSVP_PUSH_FLUSH_GAP_MS, () => flushWaitingRsvpPushes());
}
