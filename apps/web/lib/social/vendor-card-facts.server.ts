import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { readShopBadgeFacts } from '@/lib/shop-badges.server';
import { readPrintBadgeList } from '@/lib/print-badges-v84.server';
import type { PrintBadge } from '@/lib/print-badges-v84';
import { coupleShopRenewing } from '@/lib/papers-renewal';
import { tierCaps } from '@/lib/vendor-tier-caps';
import { effectiveSeoTier } from '@/lib/vendor-seo-tier';
import { vendorPaywallApplies } from '@/lib/vendor-feature-gate';
import { fetchVendorMicrosite, isSectionVisible, micrositeCan } from '@/lib/vendor-microsite';
import { readOverdueTopUpEventIds, readPageRefsFromEvents } from '@/lib/booking-fee-top-up.server';
import { manilaToday } from '@/lib/std-views';
import { shopCoverChoice, shopPortfolioKeys } from '@/lib/shop-cover-photo';
import { isShopNameWithheld } from '@/lib/vendors';
import { vendorCardProof, vendorCardStatus, type VendorCardProof, type VendorCardStatus } from '@/lib/social/vendor-card-layout';

/**
 * vendor-card-facts.server.ts — WHAT A SHOP'S SHARE CARD SAYS, READ NOW (shop share card v2, DECISION_LOG 2026-11-21).
 *
 * No new number: every fact is the read the shop page and the prints already use —
 *   · seal + badges   `readPrintBadgeList` (`printBadgesV84`: the shop page's `displayedSeals` + the Badges shelf's
 *                     earned tiers; No. 1 off) on `readShopBadgeFacts` — with Verified ALSO asking the page's
 *                     `!renewing` (a shop whose papers lapsed wears no Verified badge anywhere on the page);
 *   · ★ + reviews     `vendor_trusted_review_stats` (inside `readShopBadgeFacts`), under the page's own star gate;
 *   · events          `vendor_public_completed_events_stats.public_completed_count` (same), only when above 0;
 *   · cover photo     the page's own hero choice (`shopCoverChoice`), through the public-bucket signer.
 * A read that fails leaves its part OFF the card — never a 0 — and says so in `allRead`, so the route does not cache
 * that picture for long.
 *
 * 🧪 A demo shop: no seal, no proof, no badges (drawing, "Demo shop") — its sample reviews are not a real shop's.
 * 🙈 A shop whose name is withheld: no cover photo (controller call on the ruling — the photo could identify it).
 */

/** The row shape the route already holds (`fetchVendor`'s `PublicVendorRow`), only the columns read here. */
export type VendorCardRow = {
  vendor_profile_id: string;
  business_name: string | null;
  is_demo?: boolean | null;
  verification_state?: string | null;
  papers_current?: boolean | null;
  tier_state?: string | null;
  tier_expires_at?: string | null;
  portfolio_r2_keys: string[] | null;
};

export type VendorCardFacts = {
  status: VendorCardStatus;
  proof: VendorCardProof;
  /** The print list as read (the row is cut from it by `vendorCardBadgeRow`). */
  badges: PrintBadge[];
  /** An already-resolved, fetchable URL, or null (the dark Setnayan ground). */
  coverUrl: string | null;
  /** False when any read behind the card was refused — the card is drawn without that part, and cached briefly. */
  allRead: boolean;
};

export async function readVendorCardFacts(vendor: VendorCardRow): Promise<VendorCardFacts> {
  const isDemo = vendor.is_demo === true;
  const [proofAndBadges, coverUrl] = await Promise.all([
    // A refused read is not "nothing earned": the card is drawn without seal, proof and badges, and cached briefly.
    isDemo ? null : readProofAndBadges(vendor).catch(() => 'unread' as const),
    readCoverUrl(vendor),
  ]);
  if (!proofAndBadges || proofAndBadges === 'unread') {
    const none = { rating: null, reviews: null, events: null };
    return { status: 'shop', proof: none, badges: [], coverUrl, allRead: proofAndBadges !== 'unread' };
  }
  return { ...proofAndBadges, status: vendorCardStatus({ isDemo, badges: proofAndBadges.badges }), coverUrl };
}

async function readProofAndBadges(vendor: VendorCardRow): Promise<Omit<VendorCardFacts, 'status' | 'coverUrl'>> {
  const admin = createAdminClient();
  const read = await readShopBadgeFacts(admin, vendor.vendor_profile_id);
  // The page's own Verified: the badge's deadline (`hasVerifiedBadge`, in the facts) AND papers current (`!renewing`).
  const verified = read.verified && !coupleShopRenewing(vendor);
  const facts = { ...read, verified };
  const { badges, allRead } = await readPrintBadgeList(admin, vendor.vendor_profile_id, facts);
  // The page's star gate (`app/v/[slug]/page.tsx`, the hero rating chip and the JSON-LD aggregateRating): a verified
  // shop, not a demo, whose plan counts stars — `vendorCardProof` then asks count > 0 and average > 0.
  const plan = effectiveSeoTier({ tier_state: vendor.tier_state ?? null, tier_expires_at: vendor.tier_expires_at ?? null });
  const starsShown = verified && tierCaps(plan).reviewStarsCounted;
  const proof = vendorCardProof({ starsShown, trusted: facts.trusted, completedEvents: facts.completedEvents });
  return { proof, badges, allRead: allRead && facts.trusted !== null && facts.completedEvents !== null };
}

async function readCoverUrl(vendor: VendorCardRow): Promise<string | null> {
  if (isShopNameWithheld(vendor)) return null;
  try {
    const admin = createAdminClient();
    const [microsite, unlisted] = await Promise.all([
      fetchVendorMicrosite(admin, vendor.vendor_profile_id),
      readOverdueTopUpEventIds(vendor.vendor_profile_id, manilaToday()).then((ids) => readPageRefsFromEvents(vendor.vendor_profile_id, ids)),
    ]);
    // The page's own gates (`renderVendorBySlug`): the plan the shop is really on, then what the editor let it save.
    const plan = effectiveSeoTier({ tier_state: vendor.tier_state ?? null, tier_expires_at: vendor.tier_expires_at ?? null });
    const proPicksRender = !vendorPaywallApplies(tierCaps(plan).premiumPage);
    const canPersonalize = !vendorPaywallApplies(micrositeCan(plan).canPersonalize);
    const showPortfolio = isSectionVisible(canPersonalize ? microsite.sections : {}, 'portfolio');
    const choice = shopCoverChoice({ heroPhotoKey: microsite.heroPhotoKey, proPicksRender, showPortfolio, unlisted });
    const keys = [
      ...(choice.heroKey ? [choice.heroKey] : []),
      ...(choice.portfolioLeads ? shopPortfolioKeys(vendor.portfolio_r2_keys, unlisted) : []),
    ];
    // In order, the first that resolves — the page's hero, else its first shown portfolio photo.
    for (const key of keys) {
      const url = await displayUrlForStoredAsset(key).catch(() => null);
      if (url) return url;
    }
    return null;
  } catch {
    return null;
  }
}
