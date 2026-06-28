/**
 * runAdminDigestFlush — the "morning ops digest" email, CRON-FREE
 * ([[project_setnayan_cron_free]]). Mirrors runSocialFlush: fired via Next 15
 * `after()` from high-traffic server renders (the PUBLIC /explore page + the
 * admin layout), throttled in memory, with a durable single-row conditional-
 * UPDATE claim so it sends exactly once per day no matter how many requests
 * trigger it.
 *
 * WHY public traffic: the digest's whole job is to reach an admin when they're
 * NOT in the console, so it can't piggyback on admin traffic alone. /explore is
 * a public page that already carries an after() flush — the site's organic
 * traffic becomes the "scheduler". Trade-off vs a real cron: the send fires
 * shortly AFTER the target hour (when the next visitor arrives), not on the dot
 * — fine for a daily snapshot (the in-app badges + topbar pill are the
 * real-time channel).
 *
 * SAFETY: gated OFF by default (platform_settings.admin_digest_enabled). Until
 * the owner enables it AND there is open work AND Resend is configured, this is
 * a no-op. sendEmail() itself no-ops when RESEND_API_KEY is absent.
 *
 * Pure content (lane rollup + subject/body) lives in digest-content.ts so it's
 * unit-testable without this module's server-only deps.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { sendEmail } from '@/lib/email';
import { buildDigestEmail } from '@/lib/admin/digest-content';
import { getAdminQueueDigest, deriveQueueUrgency } from '@/lib/admin/queue-counts';

/** Min gap between DB checks per instance — makes the after() hooks ~free. */
const CHECK_THROTTLE_MS = 30 * 60 * 1000;
/** Local hour (Asia/Manila) the daily digest may first go out. */
const SEND_HOUR_MANILA = 8;
const MANILA_OFFSET = '+08:00'; // PH has no DST.

let lastCheckMs = 0;

/** Today's send-window start (SEND_HOUR_MANILA, Manila) as a UTC instant (ms). */
function sendThresholdMs(nowMs: number): number {
  const manilaDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
  }).format(new Date(nowMs)); // YYYY-MM-DD
  const hh = String(SEND_HOUR_MANILA).padStart(2, '0');
  return Date.parse(`${manilaDate}T${hh}:00:00${MANILA_OFFSET}`);
}

export async function runAdminDigestFlush(): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - lastCheckMs < CHECK_THROTTLE_MS) return;
  lastCheckMs = nowMs;

  try {
    const thresholdMs = sendThresholdMs(nowMs);
    // Before today's send hour → nothing to do yet.
    if (Number.isNaN(thresholdMs) || nowMs < thresholdMs) return;
    const thresholdIso = new Date(thresholdMs).toISOString();

    const admin = createAdminClient();

    // Atomic daily claim: only succeeds when the digest is ENABLED and hasn't
    // been sent since today's send hour. The row-level lock makes concurrent
    // callers (other requests / regions) lose the claim and bail — exactly one
    // send per day.
    const { data: claim, error: claimErr } = await admin
      .from('platform_settings')
      .update({ admin_digest_last_sent_at: new Date(nowMs).toISOString() })
      .eq('admin_digest_enabled', true)
      .or(
        `admin_digest_last_sent_at.is.null,admin_digest_last_sent_at.lt.${thresholdIso}`,
      )
      .select('id');
    if (claimErr) {
      logQueryError('runAdminDigestFlush (claim)', claimErr);
      return;
    }
    if (!claim || claim.length === 0) return; // disabled, already sent, or lost the race

    // Won the claim. Build today's snapshot (shared cache() fetch).
    const digest = await getAdminQueueDigest();
    const urgency = deriveQueueUrgency(digest, nowMs);
    // Nothing waiting → claim stands (no re-check today) but no email goes out.
    if (urgency.totalOpen === 0) return;

    const { data: admins, error: adminErr } = await admin
      .from('users')
      .select('email')
      .eq('is_internal', true)
      .not('email', 'is', null);
    if (adminErr) {
      logQueryError('runAdminDigestFlush (recipients)', adminErr);
      return;
    }
    const recipients = Array.from(
      new Set(
        (admins ?? [])
          .map((a) => (a as { email: string | null }).email)
          .filter((e): e is string => !!e),
      ),
    );
    if (recipients.length === 0) return;

    const { subject, text, html } = buildDigestEmail(digest, urgency);
    for (const to of recipients) {
      await sendEmail({ to, subject, text, html });
    }
  } catch (err) {
    logQueryError(
      'runAdminDigestFlush',
      err instanceof Error ? err : new Error(String(err)),
    );
  }
}
