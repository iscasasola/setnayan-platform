import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { phTodayIso } from '@/lib/vendor-day-picker';
import type { VendorServiceDiscount } from '@/lib/vendor-services';
import { fetchDiscountsByServicePublic } from '@/lib/vendor-service-public';
import { offerCandidatesFor, offerFromRow, VENDOR_OFFER_SELECT, type Offer, type VendorOfferRow } from '@/lib/offers';

/**
 * lib/offers.server.ts — the offer reads COUPLES' pages make (Build 6 · Lane D): the shop's running offers projected onto
 * its cards for `pickBestDiscount`. Deliberately free of any signed-in read (no cookies, no active shop), so the cached
 * public shop page can import it (`lib/the-shop-page-stays-cacheable.test.ts`). The maker's own reads — the signed-in
 * shop, the lock, gifts, slow months — are in `lib/offer-maker.server.ts`. HONEST: a refused read returns null and the
 * maker says "Couldn't load" — never an empty list that reads as "No offers yet" (the 2026-08-20 disease).
 */

/** The shop's offers, in its own order. null = the read was refused. */
export async function readShopOffers(supabase: SupabaseClient, shopId: string): Promise<Offer[] | null> {
  const { data, error } = await supabase
    .from('vendor_offers')
    .select(VENDOR_OFFER_SELECT)
    .eq('vendor_profile_id', shopId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) {
    console.error('[supabase-error] lib/offers.server.ts · from:vendor_offers.select', error);
    return null;
  }
  return ((data ?? []) as unknown as VendorOfferRow[]).map(offerFromRow);
}

/**
 * 🏷 COUPLES SEE THE BEST OFFER. The running offers that reach each of `serviceIds`, as price candidates for
 * `pickBestDiscount` beside the cards' own discount rows (Build 6 Lane D). An offer only ever reaches its OWN shop's
 * cards (the migration's trigger, and the vendor match here). Fail-soft like every badge read on these pages — a badge
 * is not worth a public page — but LOUD: a refused read is logged.
 */
export async function fetchOfferCandidatesByService(
  client: SupabaseClient,
  serviceIds: readonly string[],
): Promise<Map<string, VendorServiceDiscount[]>> {
  const out = new Map<string, VendorServiceDiscount[]>();
  if (serviceIds.length === 0) return out;
  const { data: svc, error: svcErr } = await client.from('vendor_services').select('vendor_service_id,vendor_profile_id').in('vendor_service_id', [...serviceIds]);
  if (svcErr) {
    console.error('[supabase-error] lib/offers.server.ts · offer candidates · vendor_services', svcErr);
    return out;
  }
  const shopOf = new Map(((svc ?? []) as { vendor_service_id: string; vendor_profile_id: string }[]).map((r) => [r.vendor_service_id, r.vendor_profile_id]));
  const shops = [...new Set(shopOf.values())];
  if (shops.length === 0) return out;
  const { data, error } = await client
    .from('vendor_offers')
    .select(`vendor_profile_id,${VENDOR_OFFER_SELECT}`)
    .in('vendor_profile_id', shops)
    .eq('is_on', true);
  if (error) {
    console.error('[supabase-error] lib/offers.server.ts · offer candidates · vendor_offers', error);
    return out;
  }
  const byShop = new Map<string, Offer[]>();
  for (const r of (data ?? []) as unknown as (VendorOfferRow & { vendor_profile_id: string })[]) {
    const list = byShop.get(r.vendor_profile_id) ?? [];
    list.push(offerFromRow(r));
    byShop.set(r.vendor_profile_id, list);
  }
  const today = phTodayIso();
  for (const id of serviceIds) {
    const offers = byShop.get(shopOf.get(id) ?? '') ?? [];
    const c = offerCandidatesFor(offers, id, today);
    if (c.length) out.set(id, c);
  }
  return out;
}

/** The cards' own discount rows with the shop's offers beside them — what `pickBestDiscount` chooses from. */
export function withOfferCandidates(
  discounts: Map<string, VendorServiceDiscount[]>,
  offers: Map<string, VendorServiceDiscount[]>,
): Map<string, VendorServiceDiscount[]> {
  if (offers.size === 0) return discounts;
  const out = new Map(discounts);
  for (const [id, list] of offers) out.set(id, [...(out.get(id) ?? []), ...list]);
  return out;
}

/**
 * The couple-facing read: each card's own discount rows AND the shop's running offers that reach it, in one map — so
 * every `pickBestDiscount` downstream (the public page, Find, the quote's seed) chooses the single best of both.
 */
export async function fetchDiscountsWithOffers(client: SupabaseClient, serviceIds: string[]): Promise<Map<string, VendorServiceDiscount[]>> {
  const [rows, offers] = await Promise.all([fetchDiscountsByServicePublic(client, serviceIds), fetchOfferCandidatesByService(client, serviceIds)]);
  return withOfferCandidates(rows, offers);
}
