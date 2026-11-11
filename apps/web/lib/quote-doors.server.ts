import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { canUse, papersProgress, type LockKey, type LockShop } from '@/lib/locks';
import { readLockShop } from '@/lib/bundle-cards.server';
import { readShopOffers } from '@/lib/offers.server';
import { packageAuthoringEnabled } from '@/lib/package-authoring-flag';
import { phTodayIso } from '@/lib/vendor-day-picker';
import { REQUIRED_DOC_COUNT, countCompleteRequiredSlots, fetchLatestApplication, type DocUploadMap } from '@/lib/vendor-verification';
import type { LockNeed } from '@/app/_components/lock/locked-feature';
import type { QuoteBundlesDoor, QuoteDoors, QuoteOffersDoor } from '@/lib/quote-doors';

export type { QuoteDoors } from '@/lib/quote-doors';

/**
 * lib/quote-doors.server.ts — what the quote's two new doors need, read once with the thread (owner 11 Nov 2026,
 * "Should the quote get the Offer Maker line and 'Make a new card'?" — *"YES. they can load a bundle also and edit
 * from it."*).
 *
 *   · 🏷 THE SHOP'S OFFERS — `readShopOffers`, the Offer Maker's own read (the quote filters them with the Offer
 *     Maker's own functions, lib/quote-offer-door.ts);
 *   · 🧺 THE SHOP'S BUNDLES — the Bundle Maker's packages whose lines are service cards (the same test `savePackage`
 *     uses: a line with a card is a bundle line), listed by name; each is priced only when picked
 *     (`loadPackageLinesForQuote`, with the Bundle Maker's sums);
 *   · 🔒 THE SHARED LOCK for each (`canUse('offerMaker' | 'bundleMaker')`, lib/locks.ts) — a locked door is SHOWN with
 *     the shared LockedFeature, never hidden; the papers are read only when a lock is actually drawn.
 *
 * HONEST: a refused read is `unread` and the door says it could not load — never an empty list that reads as "none".
 */

async function verifyNeed(supabase: SupabaseClient, shopId: string): Promise<LockNeed> {
  const papers = await fetchLatestApplication(supabase, shopId)
    .then((a) => ({ done: countCompleteRequiredSlots((a?.doc_uploads ?? {}) as DocUploadMap), of: REQUIRED_DOC_COUNT }))
    .catch((err) => {
      console.error('[supabase-error] lib/quote-doors.server.ts · latest application', err);
      return null;
    });
  return { kind: 'verify', progress: papersProgress(papers) };
}

const locked = (key: LockKey, shop: LockShop | null) => Boolean(shop && !canUse(key, shop).ok);

export async function readQuoteDoors(supabase: SupabaseClient, shopId: string): Promise<QuoteDoors> {
  const bundlesOn = packageAuthoringEnabled();
  const [shop, offers, pkgs] = await Promise.all([
    readLockShop(supabase, shopId),
    readShopOffers(supabase, shopId),
    bundlesOn
      ? supabase
          .from('vendor_packages')
          .select('package_id, package_name, vendor_package_items(vendor_service_id)')
          .eq('vendor_profile_id', shopId)
          .order('updated_at', { ascending: false })
      : Promise.resolve(null),
  ]);
  const anyLocked = locked('offerMaker', shop) || (bundlesOn && locked('bundleMaker', shop));
  const need = anyLocked ? await verifyNeed(supabase, shopId) : null;

  // An unread lock is not "open": the door says it could not load, and the server's own gate still refuses.
  const offersDoor: QuoteOffersDoor = !shop
    ? { kind: 'unread' }
    : locked('offerMaker', shop) && need
      ? { kind: 'locked', need }
      : offers
        ? { kind: 'read', offers, today: phTodayIso() }
        : { kind: 'unread' };

  let bundlesDoor: QuoteBundlesDoor = { kind: 'off' };
  if (bundlesOn) {
    if (!shop) bundlesDoor = { kind: 'unread' };
    else if (locked('bundleMaker', shop) && need) bundlesDoor = { kind: 'locked', need };
    else if (!pkgs || pkgs.error) {
      if (pkgs?.error) console.error('[supabase-error] lib/quote-doors.server.ts · from:vendor_packages.select', pkgs.error);
      bundlesDoor = { kind: 'unread' };
    } else {
      const rows = (pkgs.data ?? []) as { package_id: string; package_name: string | null; vendor_package_items: { vendor_service_id: string | null }[] | null }[];
      bundlesDoor = {
        kind: 'read',
        bundles: rows
          .filter((r) => (r.vendor_package_items ?? []).some((i) => i.vendor_service_id))
          .map((r) => ({ id: r.package_id, name: r.package_name?.trim() || 'Untitled bundle' })),
      };
    }
  }
  return { offers: offersDoor, bundles: bundlesDoor };
}
