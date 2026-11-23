import 'server-only';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createMoneyWriterClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { canManageVendor, resolveVendorRoleForProfile } from '@/lib/vendor-role';
import { confirmSupplierPlanJws, issueSupplierPlanToken } from './supplier-subscription.server';
import { startRefusal, type IapConfirmResult, type IapStartResult } from './iap-outcome';
import type { SupplierPlanProduct } from './supplier-plans';

/**
 * 🏪 The app's confirm of a SUPPLIER PLAN, for the signed-in person — folded into `confirmAppStorePurchase`
 * (lib/iap/iap-actions.ts) because the server-action budget is at its ceiling; every Apple transaction the phone holds
 * reaches that one door (the buy, the launch re-delivery, Restore), and this answers only for supplier plans.
 *
 * The caller's shop is read from the SESSION (the shop they stand in), never sent by the phone; only its owner or an
 * admin manages the plan, as on the web. A subscription already belonging to another shop is refused — a restore on a
 * second shop never grants it. Null = not a supplier plan.
 */
/** The shops the signed-in person manages: the shop they stand in, when its owner or an admin. */
async function managedShops(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const profile = await fetchOwnVendorProfile(supabase, userId);
  if (!profile) return [];
  const role = await resolveVendorRoleForProfile(supabase, userId, profile.vendor_profile_id);
  return canManageVendor(role) ? [profile.vendor_profile_id.toLowerCase()] : [];
}

/**
 * 🔑 The START of a supplier plan purchase — folded into `startAppStorePurchase` (the server-action budget is at its
 * ceiling). The shop is the one the signed-in person stands in and manages, read from the SESSION, never sent by the
 * phone. The server issues the `appAccountToken` for that shop and keeps the pairing; Apple's notifications grant only
 * to it. The plan's other checks (verified · one channel · one subscription per shop) are the database's, at grant.
 */
export async function startSupplierPlanForUser(userId: string, product: SupplierPlanProduct): Promise<IapStartResult> {
  const shops = await managedShops(userId);
  const shop = shops[0];
  if (!shop) return startRefusal('not_plan_manager');
  const issued = await issueSupplierPlanToken(createMoneyWriterClient(), {
    userId,
    vendorProfileId: shop,
    productId: product.productId,
  });
  if (!issued.ok) return startRefusal('try_again');
  return { ok: true, token: issued.token, productId: product.productId, quantity: 1 };
}

export async function confirmSupplierPlanForUser(userId: string, jws: string): Promise<IapConfirmResult | null> {
  const out = await confirmSupplierPlanJws(createMoneyWriterClient(), jws, () => managedShops(userId));
  if (!out) return null;
  // Page-scoped, never the vendor layout (lint-vendor-layout-revalidate): the plan door's page and the Plan page.
  if (out.result.status === 'on') {
    revalidatePath('/vendor-dashboard/shop');
    revalidatePath('/vendor-dashboard/subscription');
  }
  return out.result;
}
