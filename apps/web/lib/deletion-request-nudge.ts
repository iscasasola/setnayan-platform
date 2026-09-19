import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { runClaimedJob, DAILY_GAP_MS } from '@/lib/periodic-jobs';
import { emitNotification } from '@/lib/notification-emit';

/**
 * THE 3-DAY DELETION-REQUEST REMINDER — one pass, cron-free.
 *
 * `deletion_request_nudge` has been a registered NotificationType + DB enum
 * value since the deletion handshake shipped (owner 2026-08-21, migration
 * 20271151830396), alongside `deletion_request_received` /
 * `_agreed` / `_declined` — all three of which ARE wired
 * (`app/dashboard/[eventId]/delete-actions.ts` and
 * `app/vendor-dashboard/clients/[eventId]/actions.ts`). The nudge never was.
 * A supplier who is asked and never answers gets no reminder, and the
 * couple's request to remove a celebration money was holding stays blocked
 * on a question nobody prompted them to look at again (S26 orphan sweep,
 * notice-no-emitter class; S40).
 *
 * Modelled directly on `lib/lock-request-expiry.ts` — same shape: a
 * SECURITY DEFINER sweep RPC atomically claims due rows and stamps its own
 * column so it fires once per ask round, this module notifies. Unlike the
 * lock handshake, a deletion ask has NO expiry (it stays pending until the
 * supplier answers or the couple cancels via `cancel_event_deletion_request`),
 * so there is no matching "expire" half here.
 */

type NudgedRow = {
  event_vendor_id: string;
  event_id: string;
  marketplace_vendor_id: string | null;
  requested_at: string | null;
};

/** Business/event name for the vendor-facing copy; falls back rather than throwing. */
async function eventLabel(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<string> {
  const { data } = await admin
    .from('events')
    .select('display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  return (data as { display_name?: string } | null)?.display_name ?? 'A couple';
}

/**
 * The callable work body — shared by the cron-free wrapper and any manual
 * trigger. Call THIS directly from a test or a "run now" control, never
 * `maybeRunDeletionRequestNudge` twice: `claimPeriodicJob` has a 5-minute
 * in-memory pre-throttle that returns false BEFORE it reaches the DB, so a
 * second call silently does nothing and looks broken.
 */
export async function runDeletionRequestNudgeSweep(): Promise<{ nudged: number }> {
  const admin = createAdminClient();
  let nudged = 0;

  try {
    const { data, error } = await admin.rpc('nudge_stale_deletion_requests', {
      p_days: 3,
      p_limit: 200,
    });
    if (error) {
      console.error('[deletion-request-nudge] rpc failed:', error.message);
      return { nudged: 0 };
    }
    const rows = (data ?? []) as NudgedRow[];
    nudged = rows.length;
    for (const r of rows) {
      try {
        if (!r.marketplace_vendor_id) continue;
        const { data: prof } = await admin
          .from('vendor_profiles')
          .select('user_id')
          .eq('vendor_profile_id', r.marketplace_vendor_id)
          .maybeSingle();
        const uid = (prof as { user_id?: string | null } | null)?.user_id ?? null;
        if (!uid) continue;
        const who = await eventLabel(admin, r.event_id);
        await emitNotification({
          userId: uid,
          type: 'deletion_request_nudge',
          title: `${who} is still waiting on your answer`,
          body: `${who} asked whether you agree to removing their celebration and has not heard back from you. Nothing is removed until you answer.`,
          relatedUrl: '/vendor-dashboard',
        });
      } catch (e) {
        console.error('[deletion-request-nudge] notify failed:', e);
      }
    }
  } catch (e) {
    console.error('[deletion-request-nudge] threw:', e);
  }

  return { nudged };
}

/**
 * Cron-free daily pass, fired from `after()` on request traffic. Mounted on
 * BOTH the admin and vendor layouts (same reasoning as
 * `maybeRunLockRequestExpiry`): production is pre-launch-quiet, and an
 * admin-only mount would leave a supplier's reminder waiting on somebody
 * opening /admin. Best-effort; never throws — a missed day retries on the
 * next eligible request.
 */
export async function maybeRunDeletionRequestNudge(): Promise<void> {
  await runClaimedJob('deletion-request-nudge', DAILY_GAP_MS, async () => {
    const { nudged } = await runDeletionRequestNudgeSweep();
    return nudged;
  });
}
