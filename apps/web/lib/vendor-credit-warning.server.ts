import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import {
  CREDIT_WARNING_MIN_PHP,
  CREDIT_WARNING_WINDOW_DAYS,
  type CreditWarningCandidate,
  creditWarningCopy,
  creditWarningKey,
  shouldWarnAboutCredit,
} from '@/lib/vendor-credit-warning';

/**
 * THE FLEET-WIDE SWEEP THAT WARNS A SHOP BEFORE ITS CREDIT IS TAKEN.
 *
 * ── WHY IT SWEEPS EVERY SHOP AND NOT JUST THE VISITOR ──────────────────────
 * 🔑 THE SHOPS THAT NEED THIS ARE THE ONES NOT VISITING. A per-visitor sweep
 * would warn only shops that are already opening their dashboard — the ones in
 * no danger of drifting into a lapse. So this copies the shape
 * `maybeSweepExpiredCreatorOffers` already uses: ANY vendor's dashboard load
 * sweeps the whole fleet, and the notice reaches a shop that has not signed in
 * for weeks.
 *
 * ⚠ THE LIMIT, STATED RATHER THAN BURIED: this project is CRON-FREE. If nobody
 * loads a vendor dashboard at all during a shop's final week, nothing is sent.
 * That is acceptable rather than merely tolerated, because expiry is ALSO
 * login-driven — the same silence that skips the warning also means nothing has
 * taken the money. The two are attached to traffic on purpose, so a term cannot
 * expire through a window in which no warning could have fired.
 *
 * ── THE THROTTLE IS THE DATABASE, NOT THE TIMER ────────────────────────────
 * The in-memory timer below saves the round trip on the overwhelming majority
 * of loads and is NOT the correctness mechanism: every serverless instance has
 * its own, so on its own it would let several instances sweep at once and send
 * a shop two warnings. The conditional UPDATE is what makes exactly one
 * instance win.
 */

const SWEEP_CHECK_THROTTLE_MS = 5 * 60 * 1000;
const SWEEP_MIN_GAP_MS = 6 * 60 * 60 * 1000;

let lastCreditWarningCheckMs = 0;

/**
 * Tiers that can carry credit into a lapse. Free and verified never do.
 *
 * ⚠ THE COLUMN IS `tier_state`, NOT `tier`. There is no `tier` column on
 * `vendor_profiles` — an earlier draft of this file named one, and PostgREST
 * REFUSES THE WHOLE QUERY for one unknown column rather than throwing, so the
 * sweep would have read zero rows, warned nobody, and looked completely healthy.
 * Read out of production, not remembered: the enum is
 * free · verified · solo · pro · enterprise · custom.
 */
const SWEEPABLE_TIERS = ['solo', 'pro', 'enterprise', 'custom'] as const;

export async function maybeSweepVendorCreditWarnings(): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - lastCreditWarningCheckMs < SWEEP_CHECK_THROTTLE_MS) return;
  lastCreditWarningCheckMs = nowMs;

  try {
    const admin = createAdminClient();
    const nowIso = new Date(nowMs).toISOString();
    const cutoffIso = new Date(nowMs - SWEEP_MIN_GAP_MS).toISOString();

    // Claim the run. `IS NULL` is spelled out rather than left to a comparison:
    // `NULL < cutoff` is NULL, not true, so a never-run sweep would be
    // permanently ineligible if this relied on the comparison alone.
    const { data: claim } = await admin
      .from('platform_settings')
      .update({ vendor_credit_warning_sweep_last_run_at: nowIso })
      .eq('id', 1)
      .or(
        `vendor_credit_warning_sweep_last_run_at.is.null,vendor_credit_warning_sweep_last_run_at.lt.${cutoffIso}`,
      )
      .select('id');
    if (!claim || claim.length === 0) return; // throttled, or another instance won

    const horizonIso = new Date(
      nowMs + CREDIT_WARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    // ⚠ Supabase RESOLVES with `{ error }`. An unchecked read here would treat a
    // failed query as "no shop is close to expiring" and stay silent forever,
    // which is the failure mode this whole feature exists to remove.
    const { data: rows, error } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id,user_id,business_name,subscription_credit_php,tier_expires_at,tier_state')
      .in('tier_state', SWEEPABLE_TIERS as unknown as string[])
      .gt('subscription_credit_php', CREDIT_WARNING_MIN_PHP - 1)
      .not('tier_expires_at', 'is', null)
      .gt('tier_expires_at', nowIso)
      .lte('tier_expires_at', horizonIso);
    if (error || !rows || rows.length === 0) return;

    const candidates: CreditWarningCandidate[] = (rows as Array<{
      vendor_profile_id: string;
      user_id: string | null;
      business_name: string | null;
      subscription_credit_php: number | string | null;
      tier_expires_at: string | null;
    }>).map((r) => ({
      vendorProfileId: r.vendor_profile_id,
      ownerUserId: r.user_id,
      businessName: r.business_name,
      creditPhp: r.subscription_credit_php == null ? 0 : Number(r.subscription_credit_php),
      tierExpiresAt: r.tier_expires_at,
    }));

    // The window is applied AGAIN in code, against the same pure rule the tests
    // exercise. The SQL filter is an optimisation that keeps the row set small;
    // `shouldWarnAboutCredit` is the rule. Two spellings of one rule drift, so
    // the query is deliberately the loose one and the function is the strict one.
    const due = candidates.filter((c) => shouldWarnAboutCredit(c, nowMs));
    if (due.length === 0) return;

    // Who has already been told about THIS term. One query for every key.
    const keys = due.map((c) => creditWarningKey(c.vendorProfileId, c.tierExpiresAt!));
    const { data: existing } = await admin
      .from('notifications')
      .select('related_url')
      .in('related_url', keys);
    const alreadyWarned = new Set(
      ((existing ?? []) as Array<{ related_url: string | null }>)
        .map((r) => r.related_url)
        .filter((u): u is string => typeof u === 'string'),
    );

    for (const c of due) {
      const key = creditWarningKey(c.vendorProfileId, c.tierExpiresAt!);
      if (alreadyWarned.has(key)) continue;
      const { title, body } = creditWarningCopy({
        creditPhp: c.creditPhp,
        tierExpiresAt: c.tierExpiresAt!,
      });
      await emitNotification({
        userId: c.ownerUserId!,
        type: 'vendor_credit_expiring',
        title,
        body,
        relatedUrl: key,
      });
    }
  } catch {
    // Best-effort. A missed run retries on the next eligible dashboard load;
    // the balance is untouched either way, because nothing here moves money.
  }
}
