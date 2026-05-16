'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Admin actions for the Boosted Ads / Sponsored Boost queue
 * (`/admin/ads`). Cancel + refund logic for ad subscriptions; the
 * actual money movement lives on the existing payments rail
 * (admin uses `/admin/payments` to process the refund).
 *
 * Iteration 0022 § 5b + 0023 § 4.3 — single-admin authority for routine
 * operational refunds/cancels. Every transition is audit-logged into
 * `admin_audit_log` with `vendor_ad_subscription_admin_cancel` action.
 */

type AdminUser = { user_id: string };

async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { user_id: user.id };
}

function readFormString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function readFormInt(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Cancel an ad subscription as admin, optionally recording a refund amount
 * (in centavos). The flip is idempotent on already-cancelled rows.
 *
 * The `refund_centavos` is a marker for the operator's records — the actual
 * refund payment flows through the existing `/admin/payments` workflow.
 */
export async function adminCancelAdSubscription(formData: FormData) {
  const actor = await requireAdmin();
  const adSubscriptionId = readFormString(formData, 'ad_subscription_id');
  const reason = readFormString(formData, 'reason') || null;
  const refundCentavos = readFormInt(formData, 'refund_centavos');

  if (!adSubscriptionId) {
    redirect(
      `/admin/ads?error=${encodeURIComponent('Missing subscription id.')}`,
    );
  }

  const admin = createAdminClient();

  const { data: existing, error: readErr } = await admin
    .from('vendor_ad_subscriptions')
    .select(
      'ad_subscription_id, vendor_profile_id, sku_code, gross_centavos, cancelled_at',
    )
    .eq('ad_subscription_id', adSubscriptionId)
    .maybeSingle();

  if (readErr || !existing) {
    redirect(
      `/admin/ads?error=${encodeURIComponent(
        readErr?.message ?? 'Subscription not found.',
      )}`,
    );
  }
  if (existing.cancelled_at) {
    redirect('/admin/ads?cancelled=1');
  }

  if (refundCentavos !== null && refundCentavos > existing.gross_centavos) {
    redirect(
      `/admin/ads?error=${encodeURIComponent(
        'Refund cannot exceed original gross.',
      )}`,
    );
  }

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from('vendor_ad_subscriptions')
    .update({
      cancelled_at: now,
      cancel_reason: reason,
      refund_centavos: refundCentavos ?? null,
      cancelled_by_user_id: actor.user_id,
      auto_renew: false,
      updated_at: now,
    })
    .eq('ad_subscription_id', adSubscriptionId);

  if (updErr) {
    redirect(`/admin/ads?error=${encodeURIComponent(updErr.message)}`);
  }

  await admin.from('admin_audit_log').insert({
    action: 'vendor_ad_subscription_admin_cancel',
    target_table: 'vendor_ad_subscriptions',
    target_id: adSubscriptionId,
    before_json: { cancelled_at: null },
    after_json: {
      cancelled_at: now,
      cancel_reason: reason,
      refund_centavos: refundCentavos,
    },
    reason,
    actor_user_id: actor.user_id,
  });

  revalidatePath('/admin/ads');
  revalidatePath('/vendor-dashboard/marketing');
  revalidatePath('/vendors');
  redirect('/admin/ads?cancelled=1');
}
