import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { openRailOptions } from '@/lib/payment-channels';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { isStoreShellRequest } from '@/lib/request-platform';
import { fetchShopGiftBought, fetchShopGiftPacks, fetchShopGiftRewardStock, fetchShopGiftStock } from '@/lib/shop-gifts.server';
import { freeByKind, rewardFreeByKind } from '@/lib/shop-gifts';
import { readGrantedRewards, readRewardNames } from '@/lib/badge-rewards.server';
import { fetchVendorPaysGiftPrice } from '@/lib/setnayan-gift.server';
import type { ShopGiftsSectionData } from './shop-gifts-section';

/**
 * 🎁 YOUR GIFTS' READ — the exact reads the section made on the Plan page (owner 2026-11-04), moved with it to Shop ›
 * Promote (owner 2026-11-05, DECISION_LOG "SHOP › PROMOTE IS THE HOME OF THE SUPPLIER QR CODES, PRINTS AND GIFTS").
 *
 * The shop's gift stock and purchases with the shop's own client (RLS: its own rows); the catalogue and the tier with the
 * service role, as the buy action prices them; the rails the owner left ON (`openRailOptions`, the same list the Plan
 * page's add-on cards offer). Every value is honest: an unread one is `null` and the section says so — never 0.
 * The pinned row's gifts figure reads `stock` from THIS result (`promoteFigures`), so the row and the section can never
 * disagree.
 */
export async function loadShopGiftsSection(supabase: SupabaseClient, vendorProfileId: string): Promise<ShopGiftsSectionData> {
  const giftsAdmin = createAdminClient();
  // 🏅 …and the badge rewards kept in it (owner 2026-11-05): what is left of the reward stock, every reward given and
  // the free booking fee's history — read with the service role, keyed on the shop's own id.
  const [stock, bought, packs, paysGiftPrice, papicOn, storeShell, settings, rewardStock, rewardsGranted, rewardNames] =
    await Promise.all([
      fetchShopGiftStock(supabase, vendorProfileId, null),
      fetchShopGiftBought(supabase, vendorProfileId),
      fetchShopGiftPacks(giftsAdmin),
      fetchVendorPaysGiftPrice(giftsAdmin, vendorProfileId),
      isVendorPapicCaptureEnabled(),
      isStoreShellRequest(),
      fetchPlatformSettings(supabase),
      fetchShopGiftRewardStock(supabase, vendorProfileId, null),
      readGrantedRewards(giftsAdmin, vendorProfileId),
      readRewardNames(giftsAdmin),
    ]);
  return {
    stock,
    // 💎 Event Plus / Pro are not Papic — with the Papic switch off only they stay on sale (#7297, slice 2).
    packs: papicOn ? packs : (packs?.filter((p) => p.kind !== 'papic') ?? null),
    paysGiftPrice,
    bought,
    openRails: openRailOptions(settings),
    canBuy: !storeShell,
    rewards: { left: rewardFreeByKind(rewardStock, freeByKind(stock)), granted: rewardsGranted, names: rewardNames },
  };
}
