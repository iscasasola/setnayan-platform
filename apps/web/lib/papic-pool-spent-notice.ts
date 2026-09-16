import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import {
  POOL_SPENT_NOTICE_WINDOW_MS,
  poolSpentNoticeBody,
  poolSpentNoticeTitle,
} from '@/lib/papic-pool-spent-copy';

/**
 * TELL THE COUPLE, BECAUSE THEY ARE THE ONLY PEOPLE WHO CAN ACT ON IT.
 *
 * A guest whose celebration has run out of shared shots is handed a refusal she
 * cannot resolve — the pot is the couple's, and only the couple can top it up.
 * Before this, nothing anywhere told them: no notification type existed, and
 * the guest's screen was the only place the fact appeared. She is standing at
 * their wedding; they are getting married. Neither of them is going to raise it.
 *
 * ⚠ THE NOTIFICATION AND THE EMAIL ALLOWLIST ARE TWO HALVES OF ONE MECHANISM,
 * AND HAVING ONE IS INDISTINGUISHABLE FROM HAVING NEITHER. An in-app row is a
 * tray badge, and the two people who need this are at a reception, not at a
 * console. `papic_pool_spent` is therefore on EMAIL_ENABLED_TYPES and
 * deliberately NOT in MARKETING_GATED_EMAIL_TYPES (that set suppresses unless
 * `users.marketing_opt_in = TRUE`, a NOT NULL DEFAULT FALSE column — it has
 * silenced a money notice for everybody once already). Both halves are held by
 * `papic-pool-spent-notice.test.ts`.
 *
 * ⛔ AND IT SENDS NOTHING, SILENTLY, IF `RESEND_API_KEY` IS UNSET IN VERCEL.
 * That is a deployment fact this file cannot fix; `emitNotification` fails soft
 * by design so a missing key never costs a capture.
 *
 * ── ONCE, NOT ONCE PER REFUSED SHOT ───────────────────────────────────────
 * The refusal fires on EVERY subsequent capture attempt, and at a live
 * reception that is hundreds of them. The dedupe is a read against the rows we
 * already wrote: if a notice of this type reached any of these recipients
 * inside POOL_SPENT_NOTICE_WINDOW_MS, this one is a duplicate. A window rather
 * than "ever" so a couple who tops up and runs dry again on a second day is
 * told the second time too.
 *
 * FAILS SOFT AND SILENT, always. A capture refusal must never become a 500
 * because a notification could not be written.
 */
export async function tellTheCouplePapicPoolIsSpent(eventId: string): Promise<void> {
  try {
    if (!eventId) return;
    const admin = createAdminClient();

    const { data: couples } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple');
    const recipients = (couples ?? [])
      .map((r) => r.user_id as string | null)
      .filter((id): id is string => Boolean(id));
    if (recipients.length === 0) return;

    const since = new Date(Date.now() - POOL_SPENT_NOTICE_WINDOW_MS).toISOString();
    const { data: already } = await admin
      .from('notifications')
      .select('notification_id')
      .in('user_id', recipients)
      .eq('type', 'papic_pool_spent')
      .gte('created_at', since)
      .limit(1);
    if ((already ?? []).length > 0) return;

    const { data: ev } = await admin
      .from('events')
      .select('display_name')
      .eq('event_id', eventId)
      .maybeSingle();
    const displayName = (ev?.display_name as string | undefined) ?? 'your celebration';

    const relatedUrl = `/dashboard/${eventId}/studio/papic`;
    for (const userId of recipients) {
      await emitNotification({
        userId,
        type: 'papic_pool_spent',
        title: poolSpentNoticeTitle(),
        body: poolSpentNoticeBody(displayName),
        relatedUrl,
      });
    }
  } catch {
    /* a refused capture must never become a 500 because of a notification */
  }
}
