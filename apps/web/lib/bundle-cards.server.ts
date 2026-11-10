import 'server-only';

/**
 * lib/bundle-cards.server.ts — 🧺 THE SHOP'S CARDS AS THE BUNDLE MAKER PRICES THEM, read HONESTLY (Build 6 · Lane D).
 *
 * The maker draws its pinned New total from these, and `savePackage` re-reads them to compute the price it writes.
 * So every read here REFUSES on error (null), never degrades: the shipped `fetchDiscountsByService` /
 * `fetchInclusionsByService` fail soft to an empty map, which is right for a card face and WRONG for a price — a
 * refused discount read would price the bundle as if no discount were on (the 20 Aug disease: a failure that looks
 * like success, here in money). Card name and price come from the same columns the shipped maker already read.
 *
 * Also the bundleMaker lock's facts (`readLockShop`) — the shop's verification and plan, from `vendor_profiles`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BundleCardFacts } from '@/lib/bundle-sums';
import type { VendorServiceDiscount } from '@/lib/vendor-services';
import { humanizeKind } from '@/lib/service-card-kind';
import type { LockShop } from '@/lib/locks';

/** One shop card as the maker lists it — the facts the sums need, plus the card's kind for its line. */
export type BundleCardRow = BundleCardFacts & { category: string; isActive: boolean };

export async function readBundleCards(supabase: SupabaseClient, vendorProfileId: string): Promise<BundleCardRow[] | null> {
  const { data: cards, error } = await supabase
    .from('vendor_services')
    .select('vendor_service_id, title, category, starting_price_php, is_active')
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: true });
  if (error || !cards) {
    console.error('[supabase-error] lib/bundle-cards.server.ts · from:vendor_services.select', error);
    return null;
  }
  const ids = (cards as { vendor_service_id: string }[]).map((c) => c.vendor_service_id);
  if (ids.length === 0) return [];

  const [disc, inc] = await Promise.all([
    supabase
      .from('vendor_service_discounts')
      .select('vendor_service_id,discount_type,rate,unit,min_lead_months,expires_at,conditions_md,sort_order')
      .in('vendor_service_id', ids)
      .order('sort_order', { ascending: true }),
    supabase
      .from('vendor_service_inclusions')
      .select('vendor_service_id,label,worth_php,sort_order')
      .in('vendor_service_id', ids)
      .order('sort_order', { ascending: true }),
  ]);
  if (disc.error || !disc.data) {
    console.error('[supabase-error] lib/bundle-cards.server.ts · from:vendor_service_discounts.select', disc.error);
    return null;
  }
  if (inc.error || !inc.data) {
    console.error('[supabase-error] lib/bundle-cards.server.ts · from:vendor_service_inclusions.select', inc.error);
    return null;
  }

  return (
    cards as Array<{ vendor_service_id: string; title: string | null; category: string; starting_price_php: number | string | null; is_active: boolean | null }>
  ).map((r) => {
    const price = r.starting_price_php == null ? null : Number(r.starting_price_php);
    return {
      id: r.vendor_service_id,
      name: r.title?.trim() || humanizeKind(r.category),
      category: r.category,
      isActive: r.is_active === true,
      pricePhp: price != null && Number.isFinite(price) ? price : null,
      discounts: (disc.data as VendorServiceDiscount[])
        .filter((d) => d.vendor_service_id === r.vendor_service_id)
        .map((d) => ({ ...d, rate: Number(d.rate) })),
      inclusions: (inc.data as Array<{ vendor_service_id: string; label: string; worth_php: number | null }>)
        .filter((i) => i.vendor_service_id === r.vendor_service_id)
        .map((i) => ({ label: i.label, worth_php: i.worth_php == null ? null : Number(i.worth_php) })),
    };
  });
}

/** The bundleMaker lock's facts. null = unread — the gate REFUSES on it, never reads it as "open". */
export async function readLockShop(supabase: SupabaseClient, vendorProfileId: string): Promise<LockShop | null> {
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('verification_state, tier_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (error || !data) {
    console.error('[supabase-error] lib/bundle-cards.server.ts · from:vendor_profiles.select (lock)', error);
    return null;
  }
  const row = data as { verification_state: string | null; tier_state: string | null };
  return { verified: row.verification_state === 'verified', tier: row.tier_state };
}
