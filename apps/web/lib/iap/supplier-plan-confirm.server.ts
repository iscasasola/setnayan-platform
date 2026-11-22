import 'server-only';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createMoneyWriterClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { canManageVendor, resolveVendorRoleForProfile } from '@/lib/vendor-role';
import { confirmSupplierPlanJws } from './supplier-subscription.server';
import type { IapConfirmResult } from './iap-outcome';

/**
 * 🏪 The app's confirm of a SUPPLIER PLAN, for the signed-in person — folded into `confirmAppStorePurchase`
 * (lib/iap/iap-actions.ts) because the server-action budget is at its ceiling; every Apple transaction the phone holds
 * reaches that one door (the buy, the launch re-delivery, Restore), and this answers only for supplier plans.
 *
 * The caller's shop is read from the SESSION (the shop they stand in), never sent by the phone; only its owner or an
 * admin manages the plan, as on the web. A subscription already belonging to another shop is refused — a restore on a
 * second shop never grants it. Null = not a supplier plan.
 */
export async function confirmSupplierPlanForUser(userId: string, jws: string): Promise<IapConfirmResult | null> {
  const callerShops = async (): Promise<string[]> => {
    const supabase = await createClient();
    const profile = await fetchOwnVendorProfile(supabase, userId);
    if (!profile) return [];
    const role = await resolveVendorRoleForProfile(supabase, userId, profile.vendor_profile_id);
    return canManageVendor(role) ? [profile.vendor_profile_id.toLowerCase()] : [];
  };
  const out = await confirmSupplierPlanJws(createMoneyWriterClient(), jws, callerShops);
  if (!out) return null;
  // Page-scoped, never the vendor layout (lint-vendor-layout-revalidate): the plan door's page and the Plan page.
  if (out.result.status === 'on') {
    revalidatePath('/vendor-dashboard/shop');
    revalidatePath('/vendor-dashboard/subscription');
  }
  return out.result;
}
