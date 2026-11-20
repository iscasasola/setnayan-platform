import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readPayPlanTemplates } from '@/lib/pay-plan-templates.server';
import { ShopFormsBody } from './shop-forms-body';
import { ShopTemplates } from './shop-templates';

/**
 * 🗂 SHOP › MAKERS › TEMPLATES — the panel's body, drawn by the server ONLY while `?maker=templates` (the Forms Maker's
 * read-when-open pattern, `shop-forms-body.tsx`), so the Shop tab pays nothing for it until it is tapped. Quick Forms
 * IS the Forms Maker's own body (the same reads, not a copy); Payment Strategies is one more read pair.
 */
export async function ShopTemplatesBody() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;
  const plans = await readPayPlanTemplates(supabase, profile.vendor_profile_id);
  return <ShopTemplates forms={<ShopFormsBody />} plans={plans} />;
}

/** What the Shop page hands Makers: the Templates body while `?maker=templates`, else nothing to read. */
export function shopTemplatesBody(search: object) {
  const sp = search as Record<string, string | string[] | undefined>;
  return sp.maker === 'templates' ? <ShopTemplatesBody /> : null;
}
