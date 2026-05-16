'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { parseVisibility } from '@/lib/vendor-visibility';
import {
  AD_TIER_OPTIONS,
  findAdOption,
  type AdSkuCode,
} from '@/lib/vendor-ads';

/**
 * Server actions backing the vendor Marketing surface — the purchase + cancel
 * flow for the Boosted Ads ladder (5/10/20km weekly) and Sponsored Boost
 * long-commit tier (Quarterly/Annual at 30km, verified-only).
 *
 * Both actions are authority-scoped to the calling vendor: the SKU is
 * resolved via the vendor's own `vendor_profiles` row; the admin client only
 * comes into play for the write so the apply-then-pay workflow can reconcile
 * later. The vendor never sees other vendors' subscriptions.
 *
 * V1 simplification: this is a "start the subscription record now" flow.
 * Real payment lands via the existing manual reconciliation rail (admin marks
 * the corresponding order paid in /admin/payments); the active row sits in
 * `vendor_ad_subscriptions` from the moment the vendor opts in, and the
 * marketplace surfaces the boost. If admin cancels for non-payment, the
 * `cancelled_at` flip removes the boost.
 */

type VendorContext = {
  user_id: string;
  vendor_profile_id: string;
  business_name: string;
  is_verified: boolean;
};

async function requireVendor(): Promise<VendorContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Verified gate. The parallel verification-flow migration added the
  // canonical `vendor_profiles.verification_state` ENUM; we accept either
  // that or the marketplace-side `public_visibility = 'verified'` as the
  // unlock signal (per 0022 § 2.1c they carry the same semantic meaning).
  // Soft-probe so a pre-migration environment still resolves the page.
  const supabaseAdmin = createAdminClient();
  let isVerified = false;
  try {
    const res = await supabaseAdmin
      .from('vendor_profiles')
      .select(
        'vendor_profile_id, business_name, public_visibility, verification_state' as
          | 'vendor_profile_id, business_name, public_visibility',
      )
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    const row = res.data as unknown as
      | {
          vendor_profile_id?: string;
          business_name?: string;
          public_visibility?: string | null;
          verification_state?: string | null;
        }
      | null;
    const visibility = parseVisibility(row?.public_visibility);
    isVerified =
      row?.verification_state === 'verified' || visibility === 'verified';
  } catch {
    const { data: fallback } = await supabaseAdmin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name, public_visibility')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    isVerified = parseVisibility(fallback?.public_visibility) === 'verified';
  }

  return {
    user_id: user.id,
    vendor_profile_id: profile.vendor_profile_id,
    business_name: profile.business_name,
    is_verified: isVerified,
  };
}

function readFormString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function readFormBool(formData: FormData, key: string): boolean {
  const raw = formData.get(key);
  if (raw === null) return false;
  const s = typeof raw === 'string' ? raw.trim() : '';
  return s === '1' || s === 'true' || s === 'on';
}

/**
 * Start a new ad subscription. Validates:
 *   1. The SKU exists in `AD_TIER_OPTIONS`.
 *   2. Sponsored-tier SKUs require the vendor to be `verified` — Boosted Ads
 *      also require verification per § 3 ("Pro tier · verified vendors only").
 *   3. The vendor has no other active row for the same tier — V1 limits a
 *      vendor to one active Boosted Ads and one active Sponsored Boost at a
 *      time (we'll loosen this when multi-pin ads land in V1.5).
 *
 * On success: inserts a fresh `vendor_ad_subscriptions` row, sets
 * `started_at = now()` + `expires_at = now() + term`, and redirects back to
 * the marketing surface with a flash. Service-role insert; vendor self-write
 * is intentionally not policied (see migration header).
 */
export async function startAdSubscription(formData: FormData) {
  const ctx = await requireVendor();
  const skuCode = readFormString(formData, 'sku_code') as AdSkuCode | '';
  const autoRenew = readFormBool(formData, 'auto_renew');

  const option = skuCode ? findAdOption(skuCode) : undefined;
  if (!option) {
    redirect(
      `/vendor-dashboard/marketing?error=${encodeURIComponent(
        'Unknown ad tier. Pick one of the listed options.',
      )}`,
    );
  }

  if (option.verifiedOnly && !ctx.is_verified) {
    redirect(
      `/vendor-dashboard/marketing?error=${encodeURIComponent(
        `${option.label} requires a verified vendor profile. Complete verification first.`,
      )}`,
    );
  }

  const admin = createAdminClient();

  // V1 one-active-per-tier guard. A Boosted row + a Sponsored row can
  // coexist (they stack per spec), but we reject a second Boosted (or a
  // second Sponsored) while one is still live.
  const { data: existing } = await admin
    .from('vendor_ad_subscriptions')
    .select('ad_subscription_id, sku_code')
    .eq('vendor_profile_id', ctx.vendor_profile_id)
    .is('cancelled_at', null)
    .gt('expires_at', new Date().toISOString());

  const sponsoredSkus = AD_TIER_OPTIONS.filter((o) => o.tier === 'sponsored').map(
    (o) => o.skuCode,
  );
  const existingTiers = new Set<'boosted' | 'sponsored'>();
  for (const row of existing ?? []) {
    existingTiers.add(
      sponsoredSkus.includes(row.sku_code as AdSkuCode) ? 'sponsored' : 'boosted',
    );
  }
  if (existingTiers.has(option.tier)) {
    redirect(
      `/vendor-dashboard/marketing?error=${encodeURIComponent(
        `You already have an active ${option.tier} subscription. Cancel it before starting a new one.`,
      )}`,
    );
  }

  const now = new Date();
  const expires = new Date(now.getTime() + option.termDays * 24 * 60 * 60 * 1000);

  const { error: insErr } = await admin.from('vendor_ad_subscriptions').insert({
    vendor_profile_id: ctx.vendor_profile_id,
    sku_code: option.skuCode,
    radius_km: option.radiusKm,
    gross_centavos: option.priceCentavos,
    started_at: now.toISOString(),
    expires_at: expires.toISOString(),
    auto_renew: autoRenew,
    notes: `Vendor self-serve start · ${ctx.business_name}`,
  });

  if (insErr) {
    redirect(
      `/vendor-dashboard/marketing?error=${encodeURIComponent(
        `Could not start subscription: ${insErr.message}`,
      )}`,
    );
  }

  // Audit-log the start so the admin queue can wind back later if needed.
  await admin.from('admin_audit_log').insert({
    action: 'vendor_ad_subscription_start',
    target_table: 'vendor_ad_subscriptions',
    target_id: null,
    before_json: null,
    after_json: {
      vendor_profile_id: ctx.vendor_profile_id,
      sku_code: option.skuCode,
      radius_km: option.radiusKm,
      gross_centavos: option.priceCentavos,
      auto_renew: autoRenew,
    },
    actor_user_id: ctx.user_id,
  });

  revalidatePath('/vendor-dashboard/marketing');
  revalidatePath('/admin/ads');
  revalidatePath('/vendors');
  redirect(`/vendor-dashboard/marketing?started=${encodeURIComponent(option.skuCode)}`);
}

/**
 * Cancel an active ad subscription. The vendor-self-serve path only.
 * Admins use `/admin/ads` for refund + reason tracking; this surface is
 * intentionally lean.
 */
export async function cancelAdSubscription(formData: FormData) {
  const ctx = await requireVendor();
  const adSubscriptionId = readFormString(formData, 'ad_subscription_id');
  if (!adSubscriptionId) {
    redirect(
      `/vendor-dashboard/marketing?error=${encodeURIComponent(
        'Missing subscription id.',
      )}`,
    );
  }
  const reason = readFormString(formData, 'reason') || null;

  const admin = createAdminClient();

  // Authority check — the row must belong to the calling vendor.
  const { data: row, error: readErr } = await admin
    .from('vendor_ad_subscriptions')
    .select('ad_subscription_id, vendor_profile_id, sku_code, cancelled_at')
    .eq('ad_subscription_id', adSubscriptionId)
    .maybeSingle();

  if (readErr || !row) {
    redirect(
      `/vendor-dashboard/marketing?error=${encodeURIComponent(
        readErr?.message ?? 'Subscription not found.',
      )}`,
    );
  }
  if (row.vendor_profile_id !== ctx.vendor_profile_id) {
    redirect(
      `/vendor-dashboard/marketing?error=${encodeURIComponent(
        'You can only cancel your own subscriptions.',
      )}`,
    );
  }
  if (row.cancelled_at) {
    // Idempotent no-op.
    revalidatePath('/vendor-dashboard/marketing');
    redirect('/vendor-dashboard/marketing?cancelled=1');
  }

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from('vendor_ad_subscriptions')
    .update({
      cancelled_at: now,
      cancel_reason: reason,
      cancelled_by_user_id: ctx.user_id,
      auto_renew: false,
      updated_at: now,
    })
    .eq('ad_subscription_id', adSubscriptionId);

  if (updErr) {
    redirect(
      `/vendor-dashboard/marketing?error=${encodeURIComponent(updErr.message)}`,
    );
  }

  await admin.from('admin_audit_log').insert({
    action: 'vendor_ad_subscription_cancel',
    target_table: 'vendor_ad_subscriptions',
    target_id: adSubscriptionId,
    before_json: { cancelled_at: null },
    after_json: { cancelled_at: now, cancel_reason: reason },
    reason,
    actor_user_id: ctx.user_id,
  });

  revalidatePath('/vendor-dashboard/marketing');
  revalidatePath('/admin/ads');
  revalidatePath('/vendors');
  redirect('/vendor-dashboard/marketing?cancelled=1');
}
