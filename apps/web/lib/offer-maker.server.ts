import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import { getGiftLimitPct } from '@/lib/gift-limit-settings.server';
import { fetchShopGiftPacks, fetchShopGiftStock } from '@/lib/shop-gifts.server';
import { freeByKind, tierPaysGiftPrice } from '@/lib/shop-gifts';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { displayServiceLabel } from '@/lib/vendors';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { deriveLeanMonths, formatLeanMonths } from '@/lib/vendor-lean-months';
import { fetchVendorBlocks, fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { phTodayIso } from '@/lib/vendor-day-picker';
import type { VendorServiceDiscount } from '@/lib/vendor-services';
import { readShopOffers } from '@/lib/offers.server';
import { seasonFromLeanMonths, type GiftContext, type Offer, type OfferCard, type SeasonSuggestion } from '@/lib/offers';

/**
 * lib/offer-maker.server.ts — the OPEN Offer Maker's reads (Build 6 · Lane D): the signed-in shop and its lock facts,
 * its cards with their own discount rows, its add-ons, the live gift catalogue / stock / limit, and the season its slow
 * months suggest. Only ever read by `offerMaker({ op: 'load' })`, after the lock. HONEST: each refused read is null and
 * the maker says so.
 */

export type OfferMakerData = {
  today: string;
  offers: Offer[] | null;
  cards: OfferCard[] | null;
  /** null = a gift read was refused; the gift part then says so and saves nothing it cannot judge. */
  gifts: GiftContext | null;
  /** The season the "Event date in a season" answer starts from — the shop's slow months. null = not readable. */
  season: SeasonSuggestion | null;
};

/** Everything the open Offer Maker draws, in one wave. Only read while `?maker=offers` (the Forms Maker pattern). */
export async function readOfferMaker(
  supabase: SupabaseClient,
  shop: { id: string; tier: string | null; city: string | null },
): Promise<OfferMakerData> {
  const today = phTodayIso();
  const admin = createAdminClient();
  const [offers, cardsRes, addonsRes, packs, stock, schedule, limitPct, season] = await Promise.all([
    readShopOffers(supabase, shop.id),
    supabase
      .from('vendor_services')
      .select('vendor_service_id,title,category,starting_price_php,is_active,primary_photo_r2_key')
      .eq('vendor_profile_id', shop.id)
      .order('created_at', { ascending: true }),
    supabase.from('vendor_service_addons').select('id,vendor_service_id,label,from_price_php,sort_order').eq('vendor_profile_id', shop.id).order('sort_order', { ascending: true }),
    // 🔒 The catalogue's gift price is withheld from a session (G6): the packs are read with the service role.
    fetchShopGiftPacks(admin).catch(() => null),
    fetchShopGiftStock(supabase, shop.id).catch(() => null),
    getBookingFeeSchedule(admin).catch(() => null),
    getGiftLimitPct(admin).catch(() => null),
    readSeasonSuggestion(supabase, shop, today),
  ]);
  // The cards' own discount rows — so the maker's "wins here" is decided by the SAME function and the SAME candidates
  // couples get (pickBestDiscount over the card's rows + the offers), never a second opinion.
  const discRes = cardsRes.error
    ? null
    : await supabase
        .from('vendor_service_discounts')
        .select('vendor_service_id,discount_type,rate,unit,min_lead_months,expires_at,conditions_md,sort_order')
        .eq('vendor_profile_id', shop.id)
        .order('sort_order', { ascending: true });
  if (discRes?.error) console.error('[supabase-error] lib/offers.server.ts · from:vendor_service_discounts.select', discRes.error);
  const discountsOf = (id: string) => ((discRes?.data ?? []) as VendorServiceDiscount[]).filter((d) => d.vendor_service_id === id);
  if (cardsRes.error) console.error('[supabase-error] lib/offers.server.ts · from:vendor_services.select', cardsRes.error);
  if (addonsRes.error) console.error('[supabase-error] lib/offers.server.ts · from:vendor_service_addons.select', addonsRes.error);
  const rows = cardsRes.error || discRes?.error ? null : ((cardsRes.data ?? []) as { vendor_service_id: string; title: string | null; category: string; starting_price_php: number | null; is_active: boolean; primary_photo_r2_key: string | null }[]);
  const cards: OfferCard[] | null = rows
    ? await Promise.all(
        rows.map(async (r) => ({
          id: r.vendor_service_id,
          name: r.title?.trim() || displayServiceLabel(r.category),
          pricePhp: r.starting_price_php != null && Number(r.starting_price_php) > 0 ? Number(r.starting_price_php) : null,
          leaf: displayServiceLabel(r.category),
          coverUrl: await displayUrlForStoredAsset(r.primary_photo_r2_key).catch(() => null),
          isActive: r.is_active,
          discounts: discountsOf(r.vendor_service_id),
        })),
      )
    : null;
  const gifts: GiftContext | null =
    packs && schedule && limitPct != null && !addonsRes.error
      ? {
          packs,
          schedule,
          limitPct,
          paysGiftPrice: tierPaysGiftPrice(shop.tier),
          free: freeByKind(stock),
          addons: ((addonsRes.data ?? []) as { id: number; vendor_service_id: string; label: string; from_price_php: number | null }[]).map((a) => ({
            id: a.id,
            cardId: a.vendor_service_id,
            label: a.label,
            fromPhp: a.from_price_php,
          })),
        }
      : null;
  return { today, offers, cards, gifts, season };
}

/** The shop's slow months (DEMAND: the dates that actually took capacity), as a season window to start from. */
async function readSeasonSuggestion(supabase: SupabaseClient, shop: { id: string; city: string | null }, today: string): Promise<SeasonSuggestion | null> {
  try {
    // DEMAND, not the room: slow months are the dates that actually took capacity — what an off-season offer is priced
    // against (the read the retired services-manager nudge made, moved here with the offer).
    const [bookings, blocks] = await Promise.all([fetchVendorPoolBookings(supabase, shop.id), fetchVendorBlocks(supabase, shop.id)]);
    const lean = await deriveLeanMonths(
      bookings.map((b) => ({ date: b.bookedDate })),
      blocks.map((b) => ({ date: b.startDate })),
      { client: supabase, regionHint: shop.city },
    );
    return seasonFromLeanMonths(lean.months, today, formatLeanMonths(lean.months), lean.source);
  } catch {
    return null;
  }
}

export type OfferShop = { id: string; verified: boolean; tier: string | null; city: string | null; slug: string | null };

/**
 * The signed-in user's active shop, with the two facts the lock needs: Verified (`verification_state`, the papers —
 * the same read as the Plan screen) and the plan. null = no shop, or it could not be read.
 */
export async function readOfferShop(supabase: SupabaseClient): Promise<OfferShop | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('verification_state,tier_state')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] lib/offers.server.ts · from:vendor_profiles.select(verification_state)', error);
    return null;
  }
  const row = data as { verification_state: string | null; tier_state: string | null } | null;
  return {
    id: profile.vendor_profile_id as string,
    verified: row?.verification_state === 'verified',
    tier: row?.tier_state ?? null,
    city: profile.location_city ?? null,
    slug: profile.business_slug ?? null,
  };
}

