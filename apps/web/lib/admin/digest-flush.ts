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
import { buildDigestEmail, sendThresholdMs } from '@/lib/admin/digest-content';
import { getAdminQueueDigest, deriveQueueUrgency } from '@/lib/admin/queue-counts';

/** Min gap between DB checks per instance — makes the after() hooks ~free. */
const CHECK_THROTTLE_MS = 30 * 60 * 1000;

let lastCheckMs = 0;

export async function runAdminDigestFlush(): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - lastCheckMs < CHECK_THROTTLE_MS) return;
  lastCheckMs = nowMs;

  try {
    const thresholdMs = sendThresholdMs(nowMs);
    // Before today's send hour → nothing to do yet.
    if (Number.isNaN(thresholdMs) || nowMs < thresholdMs) return;
    const thresholdIso = new Date(thresholdMs).toISOString();
    const nowIso = new Date(nowMs).toISOString();

    const admin = createAdminClient();

    // Cheap pre-check — skip the digest fetch when the feature is off or today's
    // digest already went out. (The atomic claim below is the real concurrency
    // guard; this just avoids work. Parsed to ms so the comparison is robust to
    // ISO offset/format differences.)
    const { data: cfg } = await admin
      .from('platform_settings')
      .select('admin_digest_enabled, admin_digest_last_sent_at')
      .eq('id', 1)
      .maybeSingle();
    if (!cfg || cfg.admin_digest_enabled !== true) return;
    if (
      cfg.admin_digest_last_sent_at &&
      new Date(cfg.admin_digest_last_sent_at).getTime() >= thresholdMs
    ) {
      return; // already sent since today's send hour
    }

    // Confirm there is REAL work BEFORE spending the day's claim. A degraded
    // read (any null count → totalOpen 0) OR a genuinely quiet morning both
    // return here WITHOUT claiming, so the next visitor retries and work that
    // lands later in the morning still gets a digest. (Fixes: a transient read
    // at the send minute silently eating the whole day's digest, and a quiet
    // 08:00 suppressing a 10:00 arrival.)
    const digest = await getAdminQueueDigest();
    const urgency = deriveQueueUrgency(digest, nowMs);
    if (urgency.totalOpen === 0) return;

    // Atomic daily claim — NOW that there's something to send. Only one
    // concurrent caller wins (the row-level lock re-checks the condition); the
    // rest bail. `enabled` is re-checked so a toggle-off mid-flight is honored.
    const { data: claim, error: claimErr } = await admin
      .from('platform_settings')
      .update({ admin_digest_last_sent_at: nowIso })
      .eq('admin_digest_enabled', true)
      .or(
        `admin_digest_last_sent_at.is.null,admin_digest_last_sent_at.lt.${thresholdIso}`,
      )
      .select('id');
    if (claimErr) {
      logQueryError('runAdminDigestFlush (claim)', claimErr);
      return;
    }
    if (!claim || claim.length === 0) return; // toggled off, or lost the race

    // Every admin who clears queues: internal + team-pool + account_type admin
    // (mirrors the /admin doorway gate in app/admin/layout.tsx).
    const { data: admins, error: adminErr } = await admin
      .from('users')
      .select('email')
      .or('is_internal.eq.true,is_team_member.eq.true,account_type.eq.admin')
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
