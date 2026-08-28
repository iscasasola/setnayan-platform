import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimPeriodicJob, DAILY_GAP_MS } from '@/lib/periodic-jobs';
import { emitNotification } from '@/lib/notification-emit';

/**
 * THE 24-HOUR REMINDER AND THE 48-HOUR FUSE — one pass, cron-free.
 *
 * ⚖ 48 HOURS IS THE OWNER'S RULING (2026-08-28). The reminder moved WITH it and
 * had to: `nudge_stale_lock_requests` requires `lock_request_expires_at > NOW()`,
 * so a day-5 reminder against a 48-hour deadline could never match a row. It
 * would not have broken loudly — it would have swept nothing and reported
 * success forever.
 *
 * The shipped data layer had NO sweeper: expiry was flipped lazily inside
 * `vendor_agree_to_lock` / `vendor_decline_lock`, and BOTH of those need the
 * supplier to act — which is precisely the thing expiry exists to handle when
 * they do not. A supplier who simply ignored the ask left the row `pending`
 * forever, holding both pending indexes, with the couple's Cancel as the only
 * inverse. A forward primitive with no inverse.
 *
 * ⚠ NUDGE FIRST, THEN EXPIRE — the order is load-bearing. Sweeps fire on request
 * traffic, so the gap between two passes is real (DAILY_GAP_MS is 20h, and
 * production is pre-launch-quiet). Expire-first would close a request that
 * crossed BOTH thresholds since the last pass having never warned the supplier —
 * the exact outcome the owner added the nudge to prevent. And do not "fix" a
 * missed nudge by nudging on expiry: a message saying "2 days left" delivered in
 * the same pass that closes the request is worse than silence.
 *
 * ⚠ THIS DOES NOT CHECK THE HANDSHAKE FLAG, ON PURPOSE. Closing a stale request
 * is safe in both states, and a flag-gated sweep would strand every in-flight
 * request the moment the flag went back off — the pending indexes are DB objects
 * and keep holding their category whatever the app believes. It is registered in
 * neither `gates` nor `pureCores` for the same reason.
 */

type SweptRow = {
  event_vendor_id: string;
  event_id: string;
  marketplace_vendor_id: string | null;
  expires_at: string | null;
};

/** Business name for the supplier-facing copy; falls back rather than throwing. */
async function coupleLabel(
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
 * `maybeRunLockRequestExpiry` twice: `claimPeriodicJob` has a 5-minute in-memory
 * pre-throttle that returns false BEFORE it reaches the DB, so a second call
 * silently does nothing and looks broken.
 */
export async function runLockRequestExpirySweep(): Promise<{ nudged: number; expired: number }> {
  const admin = createAdminClient();
  let nudged = 0;
  let expired = 0;

  // ── 1 · NUDGE (24 hours in, 24 hours left) ─────────────────────────────
  //
  // ⚠ NOT GUARANTEED, and this is the honest cost of a 48-hour window on a
  // cron-free sweep. Passes are traffic-driven with a 20-hour floor, so on a
  // regular cadence one always falls in the 24 hours between the reminder and
  // the deadline (48 − 24 = 24 > 20). If traffic goes quiet for more than a day
  // — today's state, pre-launch — a request can close having warned nobody. No
  // threshold fixes that; only a real schedule would.
  try {
    const { data, error } = await admin.rpc('nudge_stale_lock_requests', {
      p_days: 1,
      p_limit: 200,
    });
    if (error) {
      console.error('[lock-request-expiry] nudge failed:', error.message);
    } else {
      const rows = (data ?? []) as SweptRow[];
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
          const who = await coupleLabel(admin, r.event_id);
          await emitNotification({
            userId: uid,
            type: 'lock_request_nudge',
            title: `${who} is still waiting`,
            body: `${who} asked you to take their booking and has not heard back. You have about a day left to agree or decline before the request closes.`,
            relatedUrl: '/vendor-dashboard',
          });
        } catch (e) {
          console.error('[lock-request-expiry] nudge notify failed:', e);
        }
      }
    }
  } catch (e) {
    console.error('[lock-request-expiry] nudge threw:', e);
  }

  // ── 2 · EXPIRE (48 hours) ──────────────────────────────────────────────
  try {
    const { data, error } = await admin.rpc('expire_stale_lock_requests', { p_limit: 200 });
    if (error) {
      console.error('[lock-request-expiry] expire failed:', error.message);
    } else {
      const rows = (data ?? []) as SweptRow[];
      expired = rows.length;
      for (const r of rows) {
        try {
          const { data: ev } = await admin
            .from('event_vendors')
            .select('vendor_name')
            .eq('vendor_id', r.event_vendor_id)
            .maybeSingle();
          const vendorName =
            (ev as { vendor_name?: string } | null)?.vendor_name ?? 'The vendor';
          const { data: members } = await admin
            .from('event_members')
            .select('user_id')
            .eq('event_id', r.event_id)
            .eq('member_type', 'couple');
          for (const m of members ?? []) {
            if (!m.user_id) continue;
            await emitNotification({
              userId: m.user_id,
              type: 'lock_request_expired',
              title: `${vendorName} did not answer`,
              body: `${vendorName} did not reply within 48 hours, so your request is closed. You can ask them again or pick someone else.`,
              relatedUrl: `/dashboard/${r.event_id}/vendors`,
            });
          }
        } catch (e) {
          console.error('[lock-request-expiry] expiry notify failed:', e);
        }
      }
    }
  } catch (e) {
    console.error('[lock-request-expiry] expire threw:', e);
  }

  return { nudged, expired };
}

/**
 * Cron-free daily pass, fired from `after()` on request traffic.
 * DAILY, not weekly: a 48-hour fuse checked weekly could fire a week late.
 * ⚠ AND THE GAP IS NOW THE BINDING CONSTRAINT, not the cadence label — see the
 * reminder's own note above: 20 hours between passes against a 48-hour window
 * leaves no slack for a quiet day.
 * Best-effort; never throws — a missed day retries on the next eligible request.
 */
export async function maybeRunLockRequestExpiry(): Promise<void> {
  try {
    if (await claimPeriodicJob('lock-request-expiry', DAILY_GAP_MS)) {
      await runLockRequestExpirySweep();
    }
  } catch {
    /* best-effort */
  }
}
