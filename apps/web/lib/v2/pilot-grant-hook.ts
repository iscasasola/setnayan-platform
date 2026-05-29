import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

/**
 * V2 cutover · Phase I — 100-token pilot grant hook
 * Spec: CLAUDE.md 2026-05-28 third row § decisions (f) + tenth row v2.1 brief.
 *
 * The DB-side grant is fully atomic on the trigger. When admin's
 * `approveApplication` writes `vendor_profiles.verification_state='verified'`
 * (see `apps/web/app/admin/verify/actions.ts` line ~322), the Postgres
 * trigger `grant_verified_vendor_bonus()` shipped by migration
 * `20260703500000_vendor_token_grants.sql` fires automatically and:
 *
 *   1. Calls `grant_admin_direct_tokens()` plpgsql helper which atomically:
 *      a. Mints an `earned_token_vouchers` row · 100 tokens · 45-day expiry
 *         · grant_source='pilot_grant' · idempotency_key='founder_bonus:<vendor>'
 *      b. INSERTs `token_grants_log` (UNIQUE idempotency_key dedups re-fires)
 *      c. Refreshes `vendor_wallets` cache via `evaluate_earned_token_expiry()`
 *      d. Returns the new voucher_id (linked back into token_grants_log)
 *   2. Writes the legacy `token_rewards_log` row with service_code=
 *      'VERIFIED_VENDOR_BONUS_100' (preserved for external consumers).
 *
 * Idempotency is enforced at TWO levels by the trigger: (a) legacy
 * `token_rewards_log` existence check (verified→demoted→re-verified does NOT
 * re-grant), and (b) UNIQUE idempotency_key on `token_grants_log` (belt-and-
 * suspenders). The trigger early-returns on either match.
 *
 * What this hook adds at the APP layer (best-effort, never rolls back):
 *
 *   • Brand-voice welcome email to the vendor (editorial-restraint copy per
 *     [[feedback_setnayan_no_dev_text_post_launch]]). Subject + body mention
 *     the 100-token grant + 45-day expiry + token wallet URL + "Set na 'yan."
 *     sign-off.
 *   • `admin_audit_log` row with action='pilot_grant_issued' for the broader
 *     admin action stream (per 0023 § 4.3 single-admin discipline · canonical
 *     pattern from `issueCompGrant` at apps/web/app/admin/users/actions.ts:408).
 *
 * Both are wrapped in try/catch — a failure to send email or to log audit
 * NEVER rolls back the approval. The DB-side grant always succeeds regardless.
 *
 * Pre-existing app-side `admin_audit_log` rows written by
 * `applyApplicationDecision`:
 *   - action='vendor_verification_approved' (the umbrella action)
 *
 * This hook adds the additional row with action='pilot_grant_issued' that
 * future audit queries can scope to "show me every founder bonus issued".
 */
export async function firePilotGrantHookOnVerification(
  admin: SupabaseClient,
  opts: {
    vendorProfileId: string;
    actorAdminUserId: string;
  },
): Promise<void> {
  // Lookup the vendor's account email + business_name. The DB trigger has
  // already fired and credited the wallet by the time this hook runs — the
  // app-side work below is non-blocking polish.
  let vendorEmail: string | null = null;
  let businessName: string | null = null;
  let vendorOwnerUserId: string | null = null;

  try {
    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('user_id, business_name, contact_email')
      .eq('vendor_profile_id', opts.vendorProfileId)
      .maybeSingle();
    if (vendor) {
      businessName = vendor.business_name ?? null;
      vendorOwnerUserId = vendor.user_id ?? null;
      // Prefer vendor_profiles.contact_email (the business email the vendor
      // wants for client communications). Fall back to the account email on
      // `users` if contact_email is empty.
      vendorEmail = vendor.contact_email ?? null;
    }

    if (!vendorEmail && vendorOwnerUserId) {
      const { data: account } = await admin
        .from('users')
        .select('email')
        .eq('user_id', vendorOwnerUserId)
        .maybeSingle();
      vendorEmail = account?.email ?? null;
    }
  } catch (err) {
    console.warn('[pilot-grant-hook] vendor lookup failed:', err);
  }

  // ---- (1) Best-effort welcome email ----
  if (vendorEmail) {
    try {
      const greetingName = businessName ?? 'and welcome';
      const subject = `Welcome aboard, ${greetingName}!`;
      const text = [
        `Your Setnayan verification is approved.`,
        ``,
        `100 founder tokens have landed in your wallet — these expire in 45 days. Spend them on Boosters or accept manpower gigs.`,
        ``,
        `See your balance: https://www.setnayan.com/vendor-dashboard/tokens`,
        ``,
        `Salamat.`,
        `Set na 'yan.`,
        `Setnayan team`,
      ].join('\n');
      const result = await sendEmail({ to: vendorEmail, subject, text });
      if (!result.ok) {
        console.warn(
          '[pilot-grant-hook] welcome email not sent:',
          result.reason,
        );
      }
    } catch (err) {
      console.warn('[pilot-grant-hook] welcome email threw:', err);
    }
  } else {
    console.warn(
      '[pilot-grant-hook] no vendor email found for vendor_profile_id:',
      opts.vendorProfileId,
    );
  }

  // ---- (2) Best-effort admin_audit_log row · action='pilot_grant_issued' ----
  // Distinct from the umbrella 'vendor_verification_approved' row already
  // written by `applyApplicationDecision`. Scoped audit lets owner query
  // "show every founder grant" without conflating with rejections or
  // demotions on the same vendor.
  try {
    await admin.from('admin_audit_log').insert({
      action: 'pilot_grant_issued',
      target_table: 'vendor_profiles',
      target_id: opts.vendorProfileId,
      before_json: null,
      after_json: {
        tokens_granted: 100,
        ttl_days: 45,
        grant_source: 'pilot_grant',
      },
      reason: 'Verified vendor founder bonus · 100 tokens · 45-day expiry',
      actor_user_id: opts.actorAdminUserId,
    });
  } catch (err) {
    console.warn('[pilot-grant-hook] admin_audit_log insert failed:', err);
  }
}
