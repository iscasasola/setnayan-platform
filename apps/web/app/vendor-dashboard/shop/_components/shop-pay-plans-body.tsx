import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readPayPlanTemplates } from '@/lib/pay-plan-templates.server';
import { ShopPayPlans } from './shop-pay-plans';

/**
 * 💳 SHOP › TEMPLATES › PAYMENT STRATEGIES — the panel's body, drawn by the server ONLY while `?maker=plans` (the Forms
 * Maker's read-when-open pattern, `shop-forms-body.tsx`), so the Shop tab pays nothing for it until it is tapped.
 */
export async function ShopPayPlansBody() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;
  const plans = await readPayPlanTemplates(supabase, profile.vendor_profile_id);
  return <ShopPayPlans plans={plans} />;
}

/** What the Shop page hands Templates: the Payment Strategies body while `?maker=plans`, else nothing to read. */
export function shopPayPlansBody(search: object) {
  const sp = search as Record<string, string | string[] | undefined>;
  return sp.maker === 'plans' ? <ShopPayPlansBody /> : null;
}
