'use server';

/**
 * apps/web/lib/referral-actions.ts — couple-facing referral server actions.
 *
 *   • getMyReferral()            — mint-or-return the caller's referral code +
 *                                  share link + their redemption status list.
 *   • applyReferralAtSignup()    — record an OPEN redemption for a brand-new
 *                                  account that arrived via ?refc=<code>.
 *
 * The QUALIFYING side-effect (first paid order → mint reward vouchers) lives in
 * lib/referrals.ts, wired into the paid-order handler. This file is only the
 * couple-facing mint + signup-capture path.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { referralShareLink } from '@/lib/referrals';
import { isReferralProgramEnabled } from '@/lib/platform-settings';

export type ReferralRedemptionSummary = {
  referred_user_id: string;
  status: 'open' | 'qualified' | 'rewarded';
  created_at: string;
};

export type MyReferral = {
  code: string;
  shareLink: string;
  redemptions: ReferralRedemptionSummary[];
  /** How many referred couples reached a paid order (qualified or rewarded). */
  qualifiedCount: number;
};

/**
 * Mint-or-return the signed-in couple's referral code. Idempotent: the
 * referral_codes.owner_user_id UNIQUE means a second call returns the existing
 * row. Runs as the couple (their INSERT policy scopes owner_user_id = auth.uid).
 * Returns null only if unauthenticated.
 */
export async function getMyReferral(): Promise<MyReferral | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Try to read an existing code first.
  let code: string | null = null;
  const { data: existing } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('owner_user_id', user.id)
    .maybeSingle();
  code = (existing?.code as string | undefined) ?? null;

  // Mint if absent. The `code` defaults DB-side via generate_public_id('R').
  if (!code) {
    const { data: inserted, error } = await supabase
      .from('referral_codes')
      .insert({ owner_user_id: user.id })
      .select('code')
      .maybeSingle();
    if (error) {
      // A concurrent mint may have won the UNIQUE race — re-read.
      const { data: reread } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('owner_user_id', user.id)
        .maybeSingle();
      code = (reread?.code as string | undefined) ?? null;
    } else {
      code = (inserted?.code as string | undefined) ?? null;
    }
  }

  if (!code) return null;

  // Their referred-couple statuses (RLS: referrer_user_id = auth.uid()).
  const { data: rows } = await supabase
    .from('referral_redemptions')
    .select('referred_user_id, status, created_at')
    .eq('referrer_user_id', user.id)
    .order('created_at', { ascending: false });

  const redemptions: ReferralRedemptionSummary[] = (rows ?? []).map((r) => ({
    referred_user_id: r.referred_user_id as string,
    status: r.status as ReferralRedemptionSummary['status'],
    created_at: r.created_at as string,
  }));
  const qualifiedCount = redemptions.filter(
    (r) => r.status === 'qualified' || r.status === 'rewarded',
  ).length;

  return { code, shareLink: referralShareLink(code), redemptions, qualifiedCount };
}

/**
 * Record an OPEN redemption for a brand-new account that signed up with
 * ?refc=<code>. Called from the signup action with the freshly-created
 * userId. Best-effort — NEVER throws (a referral hiccup must not break signup).
 *
 * Guards (belt + suspenders with the DB CHECK/UNIQUE/trigger):
 *   • unknown / malformed code           → ignore
 *   • self-referral (owner === referred) → ignore
 *   • account already referred (UNIQUE)  → ignore
 *
 * Runs through the admin client because the just-created user's session isn't
 * established in the signup request context; the referred_user_id we write is
 * the trusted server-side userId, not client input.
 */
export async function applyReferralAtSignup(
  rawCode: string,
  referredUserId: string,
): Promise<void> {
  try {
    const code = (rawCode ?? '').trim();
    if (!code || !referredUserId) return;

    // Master toggle: only track a referral while the program is active. Off →
    // the new couple still signs up; we simply record no redemption.
    if (!(await isReferralProgramEnabled())) return;

    const admin = createAdminClient();

    const { data: referral } = await admin
      .from('referral_codes')
      .select('referral_code_id, owner_user_id')
      .eq('code', code)
      .maybeSingle();
    if (!referral) return; // unknown code.

    const referrerUserId = referral.owner_user_id as string;
    if (referrerUserId === referredUserId) return; // self-referral → ignore.

    // Insert an OPEN redemption. UNIQUE(referred_user_id) + the BEFORE-INSERT
    // guard trigger make a dupe/self insert a no-op error we swallow.
    const { error } = await admin.from('referral_redemptions').insert({
      referral_code_id: referral.referral_code_id,
      referrer_user_id: referrerUserId,
      referred_user_id: referredUserId,
      status: 'open',
    });
    if (error && error.code !== '23505') {
      // 23505 = already referred (UNIQUE) → expected/ignored. Anything else is
      // logged but never surfaced (best-effort contract).
      console.warn('[referrals] applyReferralAtSignup insert failed:', error.message);
    }
  } catch (e) {
    console.warn('[referrals] applyReferralAtSignup failed (non-fatal):', e);
  }
}
