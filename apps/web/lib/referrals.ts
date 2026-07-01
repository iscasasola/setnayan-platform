/**
 * apps/web/lib/referrals.ts — Couple referral rewards engine.
 *
 * "Happy couples refer; when their referral books you, both get a perk."
 *
 * Rides the SHIPPED voucher rail (public.discount_codes + the calculate.ts
 * pct_off_capped math) rather than inventing a new discount primitive. When a
 * referred couple's FIRST PAID ORDER lands, we mint TWO single-use vouchers —
 * one for the referrer, one for the referred — each a `pct_off_capped` voucher
 * at 100% capped at `platform_settings.referral_reward_php` (so it's an
 * "₱X off your next covered order" perk that flows through the existing math).
 *
 * Substrate: migration 20270416213000_couple_referral_rewards.sql
 *   • referral_codes            (one per couple account)
 *   • referral_redemptions      (one per referred account · open→qualified→rewarded)
 *   • platform_settings.referral_reward_php  (ADMIN-MANAGED · DEFAULT 0 = inert)
 *
 * DESIGN NOTES
 * ------------
 * • reward is ADMIN-MANAGED. When referral_reward_php = 0 the engine is LIVE but
 *   INERT: qualifyReferralOnFirstPaidOrder still records the qualification
 *   lifecycle (open→qualified) but mints NOTHING (no vouchers) — the owner can
 *   backfill by re-running once a reward is set, since a still-`qualified` row
 *   with NULL reward codes is the marker.  (Owner follow-up: set the reward.)
 * • best-effort by contract. qualifyReferralOnFirstPaidOrder NEVER throws — it
 *   is called from an after()/waitUntil hook off the paid-order handler and must
 *   never block or fail an order.
 * • all writes here run through the service-role admin client (bypasses RLS),
 *   matching the discount_codes apply-time pattern.
 */

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

/** Public base URL for share links. Mirrors signup/actions.ts fallback. */
function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com';
}

/** The share link a couple gives out. New signups arrive at ?refc=<code>. */
export function referralShareLink(code: string): string {
  return `${appUrl()}/signup?refc=${encodeURIComponent(code)}`;
}

/**
 * Resolve a `created_by_admin_id` for system-minted referral vouchers.
 * discount_codes.created_by_admin_id is NOT NULL + FKs to users, so referral
 * grants are attributed to the platform's first internal admin (the owner).
 * Returns null if no admin row exists yet (engine stays inert — we don't mint).
 */
async function resolveSystemAdminId(admin: AdminClient): Promise<string | null> {
  const { data } = await admin
    .from('users')
    .select('user_id')
    .or('is_internal.eq.true,account_type.eq.admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

/** Read the admin-managed reward (whole pesos). 0 = inert. */
async function readRewardPhp(admin: AdminClient): Promise<number> {
  const { data } = await admin
    .from('platform_settings')
    .select('referral_reward_php')
    .eq('id', 1)
    .maybeSingle();
  const raw = Number(data?.referral_reward_php ?? 0);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

/** All covered service_codes from the live V2 retail catalog. */
async function coveredServiceKeys(admin: AdminClient): Promise<string[]> {
  const { data } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code');
  // Cap at 50 to respect the discount_codes covered_service_keys convention.
  return (data ?? []).map((r) => r.service_code as string).slice(0, 50);
}

/**
 * Mint one single-use pct_off_capped voucher worth `rewardPhp` off any covered
 * SKU, LOCKED to `recipientUserId` (via discount_code_eligible_users so the
 * perk can't be shared). Returns the minted code, or null on any failure
 * (best-effort caller). discount_codes.code is caller-supplied (8 A-Z0-9), so
 * we generate an 8-char Crockford code and retry on the rare UNIQUE collision.
 */
async function mintRewardVoucher(args: {
  admin: AdminClient;
  rewardPhp: number;
  covered: string[];
  adminId: string;
  recipientUserId: string;
  expiresAt: string;
}): Promise<string | null> {
  const { admin, rewardPhp, covered, adminId, recipientUserId, expiresAt } = args;
  const capCentavos = rewardPhp * 100;

  // A few attempts to dodge the (rare) 8-char code collision on the UNIQUE.
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = referralVoucherCode();
    const { data, error } = await admin
      .from('discount_codes')
      .insert({
        code,
        discount_type: 'pct_off_capped',
        pct_value: 100,
        cap_centavos: capCentavos,
        covered_service_keys: covered,
        expires_at: expiresAt,
        max_uses: 1,
        is_active: true,
        created_by_admin_id: adminId,
      })
      .select('discount_code_id, code')
      .maybeSingle();
    if (!error && data?.code) {
      // Account-lock the voucher to its recipient. When at least one eligible
      // row exists, ONLY that account can redeem (per the eligible-users spec),
      // so a referral perk is never shareable. Best-effort: if this fails we
      // deactivate the just-minted (un-locked) voucher rather than leak a
      // world-redeemable code, and report failure.
      const { error: lockErr } = await admin
        .from('discount_code_eligible_users')
        .insert({
          discount_code_id: data.discount_code_id,
          user_id: recipientUserId,
          added_by_admin_id: adminId,
        });
      if (lockErr) {
        console.warn('[referrals] voucher account-lock failed:', lockErr.message);
        await admin
          .from('discount_codes')
          .update({ is_active: false })
          .eq('discount_code_id', data.discount_code_id);
        return null;
      }
      return data.code as string;
    }
    // 23505 = unique_violation on the code → retry with a fresh code.
    if (error && error.code !== '23505') {
      console.warn('[referrals] voucher mint failed:', error.message);
      return null;
    }
  }
  return null;
}

/** 8-char A-Z0-9 code (Crockford alphabet, no ambiguous glyphs). */
function referralVoucherCode(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * QUALIFYING EVENT hook — call from the paid-order handler's after()/waitUntil.
 *
 * If `buyerUserId` has an OPEN referral redemption (they signed up with a
 * ?refc= code and this is their FIRST paid order), mark it qualified and mint
 * the two reward vouchers. Best-effort: NEVER throws, NEVER blocks the order.
 *
 * Inert-when-unset: if referral_reward_php = 0 (or no admin row exists), the
 * redemption is marked `qualified` (lifecycle advances) but NO vouchers are
 * minted — a still-qualified row with NULL reward codes is the backfill marker.
 *
 * INTENTIONAL COVERAGE GAP (do not "fix" without a policy decision): this hook
 * is wired ONLY into approvePayment (a real, admin-reconciled external payment).
 * It is deliberately NOT wired into the ₱0 self-comp order path
 * (createSelfCompOrder) — otherwise a couple could farm reward vouchers by
 * self-comping free ₱0 "orders". Only a genuine paid order qualifies a referral.
 */
export async function qualifyReferralOnFirstPaidOrder(
  buyerUserId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();

    // Is this buyer a referred account with an OPEN redemption? The partial
    // index idx_referral_redemptions_referred_open backs this lookup.
    const { data: redemption } = await admin
      .from('referral_redemptions')
      .select('referral_redemption_id, referrer_user_id, referred_user_id, status')
      .eq('referred_user_id', buyerUserId)
      .eq('status', 'open')
      .maybeSingle();
    if (!redemption) return; // no open referral for this buyer → nothing to do.

    const rewardPhp = await readRewardPhp(admin);

    // INERT PATH — no reward configured. Advance to `qualified` so we don't
    // re-scan on every future paid order, but mint nothing. A qualified row
    // with NULL reward codes is the marker the owner can backfill.
    if (rewardPhp <= 0) {
      await admin
        .from('referral_redemptions')
        .update({ status: 'qualified', qualified_at: new Date().toISOString() })
        .eq('referral_redemption_id', redemption.referral_redemption_id)
        .eq('status', 'open');
      return;
    }

    const adminId = await resolveSystemAdminId(admin);
    if (!adminId) {
      // No admin to attribute the grant to → stay inert (mark qualified only).
      await admin
        .from('referral_redemptions')
        .update({ status: 'qualified', qualified_at: new Date().toISOString() })
        .eq('referral_redemption_id', redemption.referral_redemption_id)
        .eq('status', 'open');
      return;
    }

    const covered = await coveredServiceKeys(admin);
    if (covered.length === 0) return; // no coverable SKUs → try again later.

    // 90-day redemption window on both reward vouchers.
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const [referrerCode, referredCode] = await Promise.all([
      mintRewardVoucher({
        admin,
        rewardPhp,
        covered,
        adminId,
        recipientUserId: redemption.referrer_user_id as string,
        expiresAt,
      }),
      mintRewardVoucher({
        admin,
        rewardPhp,
        covered,
        adminId,
        recipientUserId: redemption.referred_user_id as string,
        expiresAt,
      }),
    ]);

    // Only flip to `rewarded` if BOTH vouchers minted. If one failed, leave the
    // row `open` so a later paid order (or a manual re-run) retries cleanly —
    // no half-rewarded state. Deactivate the orphan voucher if exactly one
    // minted so we don't leak an un-paired perk.
    if (referrerCode && referredCode) {
      const nowIso = new Date().toISOString();
      await admin
        .from('referral_redemptions')
        .update({
          status: 'rewarded',
          qualified_at: nowIso,
          rewarded_at: nowIso,
          referrer_reward_code: referrerCode,
          referred_reward_code: referredCode,
        })
        .eq('referral_redemption_id', redemption.referral_redemption_id)
        .eq('status', 'open');
    } else {
      const orphan = referrerCode ?? referredCode;
      if (orphan) {
        await admin
          .from('discount_codes')
          .update({ is_active: false })
          .eq('code', orphan);
      }
    }
  } catch (e) {
    // Best-effort contract — a referral failure must never touch the order.
    console.warn('[referrals] qualifyReferralOnFirstPaidOrder failed (non-fatal):', e);
  }
}
