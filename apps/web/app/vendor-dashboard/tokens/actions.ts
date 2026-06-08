'use server';

/**
 * /vendor-dashboard/tokens · server action — start a token-pack purchase.
 *
 * WHY · Owner 2026-06-08 "make purchasing available too" + "Both — manual now,
 *       automated later." Vendors can now self-initiate a token-pack order
 *       instead of waiting on an admin grant.
 *
 * FLOW (apply-then-pay · manual reconcile)
 *   1. Vendor clicks Buy on a pack → this action calls
 *      `create_vendor_token_purchase(p_pack_sku_code)` (migration
 *      20260916000000). The DB function reads price + token count from
 *      vendor_billing_catalog (NEVER a client-supplied amount), generates a
 *      'TKN-xxxxxxxx' reference code, and inserts a pending_payment row.
 *   2. Vendor pays the pesos externally (BDO / GCash · accounts from
 *      platform_settings) putting the reference code in the note.
 *   3. Admin confirms the payment at /admin/token-purchases →
 *      `approve_vendor_token_purchase(id)` credits the wallet via the existing
 *      grant_admin_direct_tokens helper (idempotent per purchase).
 *
 * The same approve_ function a future Maya / PayMongo webhook will call — so
 * automating later is a webhook handler, not a rebuild.
 *
 * Runs as the vendor's own user (no admin client); the DB function is
 * SECURITY DEFINER and resolves the vendor from auth.uid().
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const ERR = (msg: string) =>
  redirect('/vendor-dashboard/tokens?error=' + encodeURIComponent(msg));

/**
 * Begin a token-pack purchase. Form field:
 *   • pack_sku_code — a vendor_billing_catalog token_pack sku_code.
 *
 * On success: redirect to /vendor-dashboard/tokens?ordered=<reference_code>
 * so the page shows the payment instructions panel for the new order.
 */
export async function startTokenPurchase(formData: FormData): Promise<void> {
  const sku = formData.get('pack_sku_code');
  if (typeof sku !== 'string' || sku.trim().length === 0) {
    ERR('Pick a token pack to continue.');
  }
  const packSku = (sku as string).trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('create_vendor_token_purchase', {
    p_pack_sku_code: packSku,
  });

  if (error) {
    const m = error.message?.toUpperCase() ?? '';
    if (m.includes('NO_VENDOR_PROFILE')) {
      ERR('Sign in with your vendor account to buy tokens.');
    }
    if (m.includes('INVALID_PACK')) {
      ERR('That token pack is no longer available. Refresh and try again.');
    }
    ERR("We couldn't start that purchase right now. Please try again.");
  }

  // RPC returns the inserted vendor_token_purchases row (SETOF → first row).
  const row = Array.isArray(data) ? data[0] : data;
  const ref: string | null =
    row && typeof row.reference_code === 'string' ? row.reference_code : null;

  revalidatePath('/vendor-dashboard/tokens');
  redirect(
    '/vendor-dashboard/tokens?ordered=' + encodeURIComponent(ref ?? ''),
  );
}
