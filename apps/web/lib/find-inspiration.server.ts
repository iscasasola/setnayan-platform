import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getInspirationParts } from './inspiration-parts-db';
import { inspirationPartsInOrder } from './inspiration-parts';
import { logQueryError } from './supabase/error-detect';
import { buildFindInspiration, type FindInspiration, type FindInspirationPhoto, type FindLikedNames } from './find-inspiration';
import { createAdminClient } from './supabase/admin';
import { resolveVendorDisplayName } from './vendors';
import { isTrueNameTier } from './vendor-tier-caps';

/**
 * The inspiration box's ONE read for Suppliers › Find (`lib/find-inspiration.ts`): the couple's own photos under their
 * own RLS-bound client (`event_inspiration_assets_host_select` — a viewer the couple's board does not reach reads none,
 * which is the truth for them), with the supplier each was picked from. A refused read is `{ read: 'unread' }` — said,
 * never drawn as an empty board. `onList` = the marketplace shops already on the couple's list for this event.
 */
export async function readFindInspiration(
  supabase: SupabaseClient,
  eventId: string,
  onList: ReadonlySet<string>,
): Promise<FindInspiration> {
  const [snapshot, res] = await Promise.all([
    getInspirationParts(),
    supabase
      .from('event_inspiration_assets')
      .select('slot_key, image_url, created_at, library_asset_id, asset:moodboard_library_assets ( vendor_profile_id, vendor_service_id )')
      .eq('event_id', eventId)
      .is('removed_at', null)
      .not('slot_key', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);
  if (res.error) {
    logQueryError('readFindInspiration', res.error, { event_id: eventId }, 'graceful_degrade');
    return buildFindInspiration(inspirationPartsInOrder(snapshot), null, onList);
  }
  type Asset = { vendor_profile_id: string | null; vendor_service_id: string | null };
  type Row = { slot_key: string | null; image_url: string | null; library_asset_id: string | null; asset: Asset | Asset[] | null };
  const photos: FindInspirationPhoto[] = ((res.data ?? []) as Row[]).flatMap((r) => {
    if (!r.slot_key || !r.image_url) return [];
    const asset = Array.isArray(r.asset) ? r.asset[0] : r.asset;
    return [
      {
        slotKey: r.slot_key,
        imageUrl: r.image_url,
        fromSupplier: r.library_asset_id !== null,
        vendorProfileId: asset?.vendor_profile_id ?? null,
        vendorServiceId: asset?.vendor_service_id ?? null,
      },
    ];
  });
  return buildFindInspiration(inspirationPartsInOrder(snapshot), photos, onList, await readLikedNames(photos));
}

/**
 * 🔗 The words for "From <shop> · <card> ›" (owner 2026-11-12). The shop's name goes through the ONE hybrid-anonymity
 * gate (`resolveVendorDisplayName`) — a Free shop's real name never reaches a couple it has not replied to — and the
 * card's title is the card's own. Read with the server's client: a couple's session cannot read `vendor_profiles`'
 * gate columns, and only ids already on the couple's own board are asked about. A refused read is `null` — the photos
 * then say "Find who does this ›", never a wrong name.
 */
async function readLikedNames(photos: readonly FindInspirationPhoto[]): Promise<FindLikedNames | null> {
  const shopIds = [...new Set(photos.map((p) => p.vendorProfileId).filter((x): x is string => Boolean(x)))];
  if (shopIds.length === 0) return null;
  const cardIds = [...new Set(photos.map((p) => p.vendorServiceId).filter((x): x is string => Boolean(x)))];
  try {
    const admin = createAdminClient();
    const [prof, cards] = await Promise.all([
      admin
        .from('vendor_profiles')
        .select('vendor_profile_id, business_name, screen_name, name_revealed_at, services, tier_state, verification_state, location_city')
        .in('vendor_profile_id', shopIds),
      cardIds.length > 0
        ? admin.from('vendor_services').select('vendor_service_id, vendor_profile_id, title').in('vendor_service_id', cardIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (prof.error) {
      logQueryError('readFindInspiration.names', prof.error, { shops: shopIds.length }, 'graceful_degrade');
      return null;
    }
    type Prof = {
      vendor_profile_id: string;
      business_name: string | null;
      screen_name: string | null;
      name_revealed_at: string | null;
      services: string[] | null;
      tier_state: string | null;
      verification_state: string | null;
      location_city: string | null;
    };
    const shops = new Map<string, string>();
    for (const r of (prof.data ?? []) as Prof[]) {
      shops.set(
        r.vendor_profile_id,
        resolveVendorDisplayName({
          business_name: r.business_name,
          screen_name: r.screen_name,
          name_revealed_at: r.name_revealed_at,
          services: r.services,
          isPaidTier: isTrueNameTier(r.tier_state),
          is_verified: r.verification_state === 'verified',
          primary_canonical_service: r.services?.[0] ?? null,
          location_city: r.location_city,
        }),
      );
    }
    const titles = new Map<string, string>();
    if (cards.error) logQueryError('readFindInspiration.cards', cards.error, { cards: cardIds.length }, 'graceful_degrade');
    else
      for (const c of (cards.data ?? []) as { vendor_service_id: string; vendor_profile_id: string; title: string | null }[]) {
        // Only the photo's OWN shop's card (the 20271297295494 trigger holds this too).
        if (c.title && shops.has(c.vendor_profile_id)) titles.set(c.vendor_service_id, c.title);
      }
    return { shops, cards: titles };
  } catch {
    return null;
  }
}
