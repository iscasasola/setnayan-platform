import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { vouchHasLapsed } from '@/lib/verification-bypass';
import {
  BADGE_REMINDER_DAYS,
  badgeLapsedCopy,
  badgeReminderCopy,
  planBadgeDeadlineSweep,
  sweepKey,
  type DeadlineReason,
  type SweepCandidate,
} from '@/lib/verified-badge';

/**
 * THE DAILY PASS FOR THE VERIFIED BADGE'S DEADLINE — it SPEAKS; it does not
 * decide.
 *
 * Owner rulings 2026-09-11: a reminder 60 days before a Mayor's Permit runs out
 * (Q5); the six-month papers deadline for the two shops verified before the
 * papers check (Q4) and for every vouch.
 *
 * 🔑 THE BADGE ITSELF IS EXPIRY-ON-READ (`hasVerifiedBadge`). This pass never
 * writes anything a badge reads, so a missed day can make a note late but can
 * never leave a lapsed badge standing.
 *
 * ⛔ IT NEVER HIDES, UNPUBLISHES OR UN-VERIFIES A SHOP. It writes three things
 * only: a notification (in-app + email, via the one existing path), an audit
 * row (which doubles as the "already said this" record), and — for a vouch
 * whose window closed — the vouch row's own `expired_at` stamp, so the admin
 * desk shows it lapsed. `public_visibility` and `verification_state` are not
 * named anywhere in this file, and a guard fails if they ever are.
 *
 * Rides `runDailyEmailJobs` (public-page `after()` + a daily DB claim), the
 * house's traffic-driven runner — no scheduler.
 */

const MAX_PER_PASS = 200;
const DAY_MS = 86_400_000;

const AUDIT_REMIND = 'verified_badge_reminder_sent';
const AUDIT_LAPSE = 'verified_badge_lapsed';

/** Where the note sends the supplier: the papers section on My Shop. */
const PAPERS_URL = '/vendor-dashboard/shop#get-verified';

/**
 * A vouch whose window closed with no approved papers gets its `expired_at`
 * stamped (the desk then reads it as lapsed); one whose papers DID land gets
 * its deadline cleared — the bridge was crossed.
 *
 * ⚠ THIS USED TO HIDE THE SHOP. `sweepExpiredVerificationBypasses` set
 * `public_visibility = 'hidden'` at the deadline — and had no caller anywhere,
 * so it had never run. The owner's 2026-09-11 rulings make the consequence of
 * a missed papers deadline "the badge comes off", with the shop still findable
 * and bookable, so the hide is gone rather than wired up.
 */
async function settleLapsedVouches(
  admin: ReturnType<typeof createAdminClient>,
  now: Date,
): Promise<number> {
  const nowIso = now.toISOString();
  const { data: due, error } = await admin
    .from('vendor_verification_bypasses')
    .select('vendor_profile_id, expires_at')
    .not('expires_at', 'is', null)
    .lt('expires_at', nowIso)
    .limit(50);
  if (error || !due?.length) return 0;

  let settled = 0;
  for (const row of due) {
    const { count, error: countErr } = await admin
      .from('vendor_verification_applications')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_profile_id', row.vendor_profile_id)
      .eq('status', 'approved');
    // A refused read is not "no papers" — skip the row and try tomorrow.
    if (countErr) continue;
    const documentsApproved = (count ?? 0) > 0;

    if (!vouchHasLapsed({ expiresAt: row.expires_at as string | null, documentsApproved }, now)) {
      if (documentsApproved) {
        await admin
          .from('vendor_verification_bypasses')
          .update({ expires_at: null, updated_at: nowIso })
          .eq('vendor_profile_id', row.vendor_profile_id);
      }
      continue;
    }

    await admin
      .from('vendor_verification_bypasses')
      .update({ expires_at: null, expired_at: nowIso, updated_at: nowIso })
      .eq('vendor_profile_id', row.vendor_profile_id);
    await admin.from('admin_audit_log').insert({
      action: 'vendor_verification_bypass_expired',
      target_table: 'vendor_verification_bypasses',
      target_id: row.vendor_profile_id,
      actor_user_id: null,
      metadata: { deadline: row.expires_at, consequence: 'badge_off_shop_stays_listed' },
    });
    settled += 1;
  }
  return settled;
}

/**
 * The callable work body. Call THIS from a test or a manual trigger — never
 * the claim-gated wrapper twice (its in-memory pre-throttle makes the second
 * call a silent no-op).
 */
export async function runVerifiedBadgeDeadlineSweep(
  now: Date = new Date(),
): Promise<{ reminded: number; lapsed: number; vouchesSettled: number }> {
  const admin = createAdminClient();
  const horizon = new Date(now.getTime() + BADGE_REMINDER_DAYS * DAY_MS).toISOString();

  // Every verified shop whose badge deadline is inside the window or past it.
  const { data: rows, error } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, user_id, verification_state, next_renewal_due_at')
    .eq('verification_state', 'verified')
    .not('next_renewal_due_at', 'is', null)
    .lte('next_renewal_due_at', horizon)
    .order('next_renewal_due_at', { ascending: true })
    .limit(MAX_PER_PASS);
  if (error) {
    console.error('[verified-badge-sweep] candidate read failed:', error.message);
    return { reminded: 0, lapsed: 0, vouchesSettled: 0 };
  }
  const profiles = (rows ?? []) as Array<{
    vendor_profile_id: string;
    user_id: string | null;
    verification_state: string | null;
    next_renewal_due_at: string | null;
  }>;

  let reminded = 0;
  let lapsed = 0;

  if (profiles.length > 0) {
    const ids = profiles.map((p) => p.vendor_profile_id);

    // What has already been said, per shop per deadline.
    const { data: said, error: saidErr } = await admin
      .from('admin_audit_log')
      .select('action, target_id, metadata')
      .in('action', [AUDIT_REMIND, AUDIT_LAPSE])
      .in('target_id', ids);
    // ⚠ A refused read is NOT "nothing was said" — treating it so would send
    // every shop in the window the same email again on every pass.
    if (saidErr) {
      console.error('[verified-badge-sweep] dedupe read failed:', saidErr.message);
      return { reminded: 0, lapsed: 0, vouchesSettled: await settleLapsedVouches(admin, now) };
    }
    const done = new Set<string>();
    for (const r of (said ?? []) as Array<{
      action: string;
      target_id: string | null;
      metadata: { deadline?: unknown } | null;
    }>) {
      const raw = typeof r.metadata?.deadline === 'string' ? r.metadata.deadline : null;
      const ms = raw ? Date.parse(raw) : NaN;
      if (!r.target_id || !Number.isFinite(ms)) continue;
      const kind = r.action === AUDIT_REMIND ? 'remind' : 'lapse';
      done.add(sweepKey(kind, r.target_id, new Date(ms).toISOString()));
    }

    // Why each deadline exists — decides the words only.
    const [{ data: vouchRows }, { data: approvedRows }] = await Promise.all([
      admin
        .from('vendor_verification_bypasses')
        .select('vendor_profile_id, expires_at, expired_at')
        .in('vendor_profile_id', ids),
      admin
        .from('vendor_verification_applications')
        .select('vendor_profile_id')
        .eq('status', 'approved')
        .in('vendor_profile_id', ids),
    ]);
    const approved = new Set(
      ((approvedRows ?? []) as Array<{ vendor_profile_id: string }>).map((r) => r.vendor_profile_id),
    );
    const onWord = new Set(
      ((vouchRows ?? []) as Array<{
        vendor_profile_id: string;
        expires_at: string | null;
        expired_at: string | null;
      }>)
        .filter((r) => r.expires_at !== null || r.expired_at !== null)
        .map((r) => r.vendor_profile_id),
    );
    const reasonFor = (id: string): DeadlineReason =>
      approved.has(id) ? 'permit' : onWord.has(id) ? 'papers' : 'renewal';

    const candidates: SweepCandidate[] = profiles.map((p) => ({
      vendorProfileId: p.vendor_profile_id,
      verificationState: p.verification_state,
      deadline: p.next_renewal_due_at,
    }));
    const userOf = new Map(profiles.map((p) => [p.vendor_profile_id, p.user_id]));

    for (const action of planBadgeDeadlineSweep(candidates, done, now)) {
      try {
        const userId = userOf.get(action.vendorProfileId) ?? null;
        const reason = reasonFor(action.vendorProfileId);
        const copy =
          action.kind === 'remind'
            ? badgeReminderCopy({ reason, deadlineIso: action.deadlineIso, daysLeft: action.daysLeft })
            : badgeLapsedCopy({ reason, deadlineIso: action.deadlineIso });
        // An unclaimed shop has nobody to tell; the audit row still records
        // that the moment passed, so the desk can see it.
        if (userId) {
          await emitNotification({
            userId,
            type: 'vendor_status_change',
            title: copy.title,
            body: copy.body,
            relatedUrl: PAPERS_URL,
          });
        }
        await admin.from('admin_audit_log').insert({
          action: action.kind === 'remind' ? AUDIT_REMIND : AUDIT_LAPSE,
          target_table: 'vendor_profiles',
          target_id: action.vendorProfileId,
          actor_user_id: null,
          metadata: {
            deadline: action.deadlineIso,
            reason,
            notified: Boolean(userId),
            ...(action.kind === 'remind' ? { days_left: action.daysLeft } : {}),
          },
        });
        if (action.kind === 'remind') reminded += 1;
        else lapsed += 1;
      } catch (e) {
        console.error('[verified-badge-sweep] note failed:', e);
      }
    }
  }

  const vouchesSettled = await settleLapsedVouches(admin, now);
  return { reminded, lapsed, vouchesSettled };
}
