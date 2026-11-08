import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { asVendorTier, firstPlanWith, TIER_LABEL, tierCaps } from '@/lib/vendor-tier-caps';
import { readFormSuggestions, readShopForms } from '@/lib/vendor-forms.server';
import { ShopFormsMaker } from '../../forms/_components/forms-page-body';

/**
 * 🛠 SHOP › MAKERS › FORMS MAKER — the panel's body, drawn by the server ONLY while the panel is open (`?maker=forms`,
 * the Shop ⚙'s read-when-open pattern, `shop-settings-body.tsx`), so the Shop tab pays nothing for it until it is tapped
 * (Build 2 §10 #33; owner 8 Nov: *"should share a single row… keep the navs and just take up the body part"*).
 *
 * The SAME reads as a picked client's Forms page (`clients/[eventId]/_pages/forms.tsx`) minus the event: the shop's
 * library (`readShopForms`), the plan's two media locks, and "Suggested for <service>" from the shop's own cards. One
 * wave, then the suggestions (they need the cards' categories). A refused read is said, never "no forms yet".
 */
export async function ShopFormsBody() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;
  const shop = profile.vendor_profile_id;
  const [library, tierRes] = await Promise.all([
    readShopForms(supabase, shop),
    supabase.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', shop).maybeSingle(),
  ]);
  const caps = tierCaps(asVendorTier((tierRes.data as { tier_state: string | null } | null)?.tier_state));
  const lock = (has: boolean, pick: (c: ReturnType<typeof tierCaps>) => boolean) => {
    if (has) return null;
    const plan = firstPlanWith(pick);
    return plan ? TIER_LABEL[plan] : 'a higher plan';
  };
  const lib = library.status === 'ok' ? library : null;
  const suggestions = await readFormSuggestions(supabase, lib?.cards.map((c) => c.category) ?? []);
  return (
    <ShopFormsMaker
      library={lib ? lib.forms : null}
      cards={lib ? lib.cards.map((c) => ({ id: c.id, title: c.title })) : []}
      suggestions={suggestions.status === 'ok' ? suggestions : null}
      locks={{ media: lock(caps.formMediaUploads, (c) => c.formMediaUploads), video: lock(caps.formVideoLinks, (c) => c.formVideoLinks) }}
      returnPath="/vendor-dashboard/shop"
      shopId={shop}
    />
  );
}

/** What the Shop page hands Makers: the Forms body while `?maker=forms`, else nothing to read. */
export function shopFormsBody(search: object) {
  const sp = search as Record<string, string | string[] | undefined>;
  return sp.maker === 'forms' ? <ShopFormsBody /> : null;
}
