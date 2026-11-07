import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { loadVendorFeaturedStories, type VendorFeaturedStory } from '@/lib/realstories-vendor';
import { loadVendorRecaps, type VendorRecap } from '@/lib/recap-vendor';
import { canUseSoloBusinessTools } from '@/lib/vendor-tier-caps';
import { isVendorFeatureGateEnabled, resolveVendorTier } from '@/lib/vendor-feature-gate';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * 📣 SHARE YOUR WORK — the reads of Shop › Promote row 4 (owner 2026-11-06, DECISION_LOG "ONE HOME FOR EVERY PROMOTE
 * TOOL": real stories + recaps with their Facebook / Pinterest / share / copy / story-card buttons, IN Promote).
 *
 * The SAME loaders the two retired pages used (`/vendor-dashboard/real-stories` · `/vendor-dashboard/recaps`, which now
 * forward to `/vendor-dashboard/shop/promote#share`), with ONE pool read shared by both lists instead of one each.
 * Recaps keep their Solo gate (the old page's `VendorTierGate`, same rule). A thrown read is `null` → "Couldn’t load",
 * never "none".
 */
export type ShareYourWorkData = {
  /** null = the read failed (said, never "none"). */
  stories: VendorFeaturedStory[] | null;
  /** null = the read failed. Empty when `recapsGated`. */
  recaps: VendorRecap[] | null;
  /** The plan gate is on and the shop's plan is below Solo — recap sharing is a Solo feature (unchanged rule). */
  recapsGated: boolean;
};

export async function loadShareYourWork(supabase: SupabaseClient, vendorProfileId: string): Promise<ShareYourWorkData> {
  const gatedRead = isVendorFeatureGateEnabled()
    ? resolveVendorTier(supabase, vendorProfileId).then((tier) => !canUseSoloBusinessTools(tier))
    : Promise.resolve(false);

  // LEFT ON THE POOL READ, ON PURPOSE — and NOT because this is capacity. It is the same "which events did this shop
  // work" question the day-of screens ask, one screen over. It feeds loadVendorFeaturedStories, whose output the shop
  // can promote onto its PUBLIC page, so widening it here would put an agreed-but-unpaid booking one click from
  // strangers — the same leak app/v/[slug] is guarded against. Widening needs that gate first. (Moved here, with its
  // reason, from the two retired pages, 2026-11-06.)
  const eventIdsRead = fetchVendorPoolBookings(supabase, vendorProfileId).then((bookings) => bookings.map((b) => b.eventId));

  const [recapsGated, eventIds] = await Promise.all([
    gatedRead.catch(() => false),
    eventIdsRead.catch((err) => {
      logQueryError('ShareYourWork.bookings', err, { vendorProfileId }, 'graceful_degrade');
      return null;
    }),
  ]);
  if (eventIds === null) return { stories: null, recaps: null, recapsGated };

  const [stories, recaps] = await Promise.all([
    loadVendorFeaturedStories(eventIds).catch((err) => {
      logQueryError('ShareYourWork.stories', err, { vendorProfileId }, 'graceful_degrade');
      return null;
    }),
    recapsGated
      ? Promise.resolve([] as VendorRecap[])
      : loadVendorRecaps(eventIds).catch((err) => {
          logQueryError('ShareYourWork.recaps', err, { vendorProfileId }, 'graceful_degrade');
          return null;
        }),
  ]);
  return { stories, recaps, recapsGated };
}
