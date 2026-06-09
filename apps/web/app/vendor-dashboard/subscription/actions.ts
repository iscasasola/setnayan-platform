'use server';

/**
 * /vendor-dashboard/subscription · server action — start a subscription order.
 *
 * Phase D (Vendor Tier #5). Vendors self-serve upgrade to Pro / Enterprise via
 * apply-then-pay, CLONED from the token-pack purchase flow (tokens/actions.ts).
 *
 * FLOW (apply-then-pay · manual reconcile)
 *   1. Vendor picks a tier + cycle → this action calls
 *      `create_vendor_subscription(p_sku_code)` (migration 20261010000000). The
 *      DB function reads price + tier + cycle + period from vendor_billing_
 *      catalog (NEVER a client-supplied amount), mints a 'SUB-xxxxxxxx'
 *      reference, and inserts a pending_payment row.
 *   2. Vendor pays the pesos externally (BDO / GCash · accounts from
 *      platform_settings) putting the reference code in the note.
 *   3. Admin confirms at /admin/subscriptions → `approve_vendor_subscription(id)`
 *      sets tier_state + tier_expires_at + grants the token bundle (idempotent
 *      per purchase). Same RPC a future Maya / PayMongo webhook hits via
 *      confirm_vendor_subscription_by_reference — automating later is a webhook
 *      handler, not a rebuild.
 *
 * Runs as the vendor's own user (no admin client); the DB function is
 * SECURITY DEFINER and resolves the vendor from auth.uid().
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { notifyAdminsSubscriptionPending } from '@/lib/subscription-purchase-notify';

const ERR = (msg: string) =>
  redirect('/vendor-dashboard/subscription?error=' + encodeURIComponent(msg));

/**
 * Begin a subscription order. Form field:
 *   • sku_code — a vendor_billing_catalog subscription sku_code
 *     (pro_vendor_monthly / pro_vendor_annual / enterprise_vendor_monthly /
 *      enterprise_vendor_annual).
 *
 * On success: redirect to /vendor-dashboard/subscription?ordered=<reference_code>
 * so the page shows the payment-instructions panel for the new order.
 */
export async function startSubscriptionPurchase(formData: FormData): Promise<void> {
  const sku = formData.get('sku_code');
  if (typeof sku !== 'string' || sku.trim().length === 0) {
    ERR('Pick a plan to continue.');
  }
  const skuCode = (sku as string).trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('create_vendor_subscription', {
    p_sku_code: skuCode,
  });

  if (error) {
    const m = error.message?.toUpperCase() ?? '';
    if (m.includes('NO_VENDOR_PROFILE')) {
      ERR('Sign in with your vendor account to upgrade.');
    }
    if (m.includes('INVALID_SKU') || m.includes('UNMAPPED_SKU_TIER')) {
      ERR('That plan is no longer available. Refresh and try again.');
    }
    ERR("We couldn't start that upgrade right now. Please try again.");
  }

  // RPC returns the inserted vendor_subscriptions row (SETOF → first row).
  const row = Array.isArray(data) ? data[0] : data;
  const ref: string | null =
    row && typeof row.reference_code === 'string' ? row.reference_code : null;
  const purchaseId: string | null =
    row && typeof row.purchase_id === 'string' ? row.purchase_id : null;

  // Alert admins there's a payment to watch for (fail-soft — never blocks the
  // vendor's redirect to the payment instructions).
  if (purchaseId) {
    await notifyAdminsSubscriptionPending(purchaseId);
  }

  revalidatePath('/vendor-dashboard/subscription');
  redirect('/vendor-dashboard/subscription?ordered=' + encodeURIComponent(ref ?? ''));
}
