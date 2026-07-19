import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchInquiriesDrivenForCreators } from '@/lib/inquiry-attribution';
import { fetchVendorSentOffers, type OfferStatus } from '@/lib/creator-offers';

/**
 * Creator Economy P3 — the two USAGE-GATED analytics reads (simplest-approach
 * verdict §2 items 8+9). Both render nothing/clean below their volume gate; the
 * spend-time influencer tags they aggregate (`token_redemptions_log.spend_source`
 * = 'creator_offer' | 'lead_unlock') were captured at P1-fix + PR-C, so the data
 * already accrues — this is the surfacing half only.
 *
 * LOCKS honored:
 *   • LEDGER FACTS ONLY — leads driven + tokens spent. NO "discount given"
 *     anywhere (it settles off-platform → structurally unknowable; verdict §2
 *     item 6).
 *   • AGGREGATE-ONLY attribution — never expose WHO booked. The per-creator
 *     "inquiries driven" reuses fetchInquiriesDrivenForCreators verbatim (its two
 *     guards — exclude creator-owned-vendor unlocks, dedup per event — are NOT
 *     reforked here).
 *   • Admin read is a service-role AGGREGATE (createAdminClient), the same
 *     read-only-page shape the verdict prescribes (§2 item 9 — "a saved SQL
 *     query until volume exists").
 */

// ---------------------------------------------------------------------------
// Vendor per-creator ROI (task 1) — /vendor-dashboard/creators.
// ---------------------------------------------------------------------------

export type VendorCreatorRoiRow = {
  creatorUserId: string;
  creatorName: string;
  creatorSlug: string | null;
  /** The creator's PUBLIC "inquiries driven" (reused helper; renders 0 clean). */
  inquiriesDriven: number;
  /** Reach tokens THIS vendor actually debited on offers to this creator
   *  (token_redemptions_log, spend_source='creator_offer', keyed by offer_id in
   *  metadata). Ledger fact — the vendor's real outreach cost. */
  reachTokensSpent: number;
  /** The most advanced collab state with this creator, for the status chip. */
  collabStatus: OfferStatus;
  /** TRUE when an accepted offer has a linked published deliverable chapter. */
  fulfilled: boolean;
};

// Rank so "the collab that matters most" wins when a vendor has several offers
// to the same creator: an accepted (live) collab outranks a still-pending one,
// which outranks a dead (declined/expired) one.
const STATUS_RANK: Record<OfferStatus, number> = {
  accepted: 3,
  pending: 2,
  declined: 1,
  expired: 0,
};

/**
 * Per-collab'd-creator ROI for a vendor: for every creator this vendor has ever
 * offered, the creator's inquiries-driven (reused public metric), the reach
 * tokens this vendor spent reaching them, and the collab status. Ledger facts —
 * NO discount-given column (unknowable off-platform). Renders nothing when the
 * vendor has no offers.
 *
 * `supabase` is the caller's RLS-scoped client — fetchVendorSentOffers reads the
 * offers through it (vendor owns via current_vendor_ids). The token ledger is
 * read on the admin client scoped to this vendor_id (resolved server-side from
 * the authed owner, never trusted from input), the same public-read pattern the
 * creator libs use.
 */
export async function fetchVendorCreatorRoi(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorCreatorRoiRow[]> {
  if (!vendorProfileId) return [];

  const offers = await fetchVendorSentOffers(supabase, vendorProfileId);
  if (offers.length === 0) return [];

  // Reach-token debits for this vendor, keyed by offer_id (ledger truth: an
  // expired-refunded offer's debit was reversed, so it won't be summed here —
  // the ledger row is the debit, and the refund credits a separate rewards row).
  const offerReach = new Map<string, number>();
  try {
    const admin = createAdminClient();
    const { data: ledger } = await admin
      .from('token_redemptions_log')
      .select('tokens_spent, metadata')
      .eq('vendor_id', vendorProfileId)
      .eq('spend_source', 'creator_offer');
    for (const row of (ledger ?? []) as Array<{
      tokens_spent: number | null;
      metadata: { offer_id?: string } | null;
    }>) {
      const offerId = row.metadata?.offer_id;
      if (!offerId) continue;
      offerReach.set(offerId, (offerReach.get(offerId) ?? 0) + Number(row.tokens_spent ?? 0));
    }
  } catch {
    /* best-effort — a missing ledger just shows 0 reach spent */
  }

  // The creators' public "inquiries driven" — REUSED helper, guards intact.
  const creatorIds = [...new Set(offers.map((o) => o.creatorUserId))];
  const driven = await fetchInquiriesDrivenForCreators(creatorIds);

  // Fold offers → one row per creator.
  const byCreator = new Map<string, VendorCreatorRoiRow>();
  for (const o of offers) {
    const reach = offerReach.get(o.offerId) ?? 0;
    let row = byCreator.get(o.creatorUserId);
    if (!row) {
      row = {
        creatorUserId: o.creatorUserId,
        creatorName: o.creatorName,
        creatorSlug: o.creatorSlug,
        inquiriesDriven: driven.get(o.creatorUserId) ?? 0,
        reachTokensSpent: 0,
        collabStatus: o.status,
        fulfilled: false,
      };
      byCreator.set(o.creatorUserId, row);
    }
    row.reachTokensSpent += reach;
    if (STATUS_RANK[o.status] > STATUS_RANK[row.collabStatus]) {
      row.collabStatus = o.status;
    }
    if (o.status === 'accepted' && o.fulfilledAt) row.fulfilled = true;
  }

  // Most influence first, then most reach spent — the vendor's best collabs top.
  return [...byCreator.values()].sort(
    (a, b) =>
      b.inquiriesDriven - a.inquiriesDriven ||
      b.reachTokensSpent - a.reachTokensSpent,
  );
}

// ---------------------------------------------------------------------------
// Admin influencer analytics (task 2) — read-only aggregate, ≥25-gated.
// ---------------------------------------------------------------------------

/** Council default gate: analytics stay dark until this many attributed
 *  unlocked inquiries exist platform-wide (verdict §7 item 5 — retunable). */
export const ADMIN_INFLUENCER_ANALYTICS_MIN_UNLOCKS = 25;

export type TopCreatorInfluence = {
  creatorUserId: string;
  creatorName: string;
  creatorSlug: string | null;
  inquiriesDriven: number;
};

export type InfluencerAnalytics = {
  /** TRUE once the volume gate is met — surfaces render the numbers; otherwise
   *  the caller shows the "not enough activity yet" state. */
  unlocked: boolean;
  /** Total distinct attributed unlocked inquiries platform-wide (the gate
   *  metric): the sum of every creator's inquiries-driven. */
  totalInquiriesDriven: number;
  /** Reach-token spend tagged 'creator_offer' (vendor→creator offers, P1). */
  reachTokensSpent: number;
  /** Lead-unlock token spend tagged 'lead_unlock' on ATTRIBUTED inquiries
   *  (vendor unlocking a creator-referred inquiry, PR-C). */
  leadUnlockTokensSpent: number;
  /** Distinct vendors who spent ANY influencer-tagged token (participation). */
  participatingVendorCount: number;
  /** Distinct creators with >=1 inquiry driven. */
  activeCreatorCount: number;
  /** Leaderboard (only when unlocked) — top creators by inquiries driven. */
  topCreators: TopCreatorInfluence[];
};

const EMPTY_ANALYTICS: InfluencerAnalytics = {
  unlocked: false,
  totalInquiriesDriven: 0,
  reachTokensSpent: 0,
  leadUnlockTokensSpent: 0,
  participatingVendorCount: 0,
  activeCreatorCount: 0,
  topCreators: [],
};

/**
 * Platform-wide influencer analytics for the admin Storytellers surface. Pure
 * service-role AGGREGATE reads — no PII, never who booked. Below the gate it
 * still returns the gate metric (totalInquiriesDriven) so the surface can show
 * "N of 25" progress, but withholds the leaderboard + spend detail (unlocked=false).
 */
export async function fetchInfluencerAnalyticsForAdmin(): Promise<InfluencerAnalytics> {
  try {
    const admin = createAdminClient();

    // Every creator = a user with >=1 published chapter (same eligibility shape
    // as fetchEligibleCreators, without the public-profile browse gate — an
    // admin aggregate counts all attributed influence).
    const { data: chapterRows } = await admin
      .from('creator_chapters')
      .select('user_id')
      .eq('status', 'published');
    const creatorIds = [
      ...new Set(
        ((chapterRows ?? []) as Array<{ user_id: string | null }>)
          .map((r) => r.user_id)
          .filter((v): v is string => !!v),
      ),
    ];

    // Reuse the locked attribution counter for every creator at once.
    const driven =
      creatorIds.length > 0
        ? await fetchInquiriesDrivenForCreators(creatorIds)
        : new Map<string, number>();

    let totalInquiriesDriven = 0;
    let activeCreatorCount = 0;
    for (const n of driven.values()) {
      if (n > 0) {
        totalInquiriesDriven += n;
        activeCreatorCount += 1;
      }
    }

    // Influencer-tagged token spend, platform-wide, split by tag.
    const { data: ledger } = await admin
      .from('token_redemptions_log')
      .select('vendor_id, tokens_spent, spend_source')
      .in('spend_source', ['creator_offer', 'lead_unlock']);
    let reachTokensSpent = 0;
    let leadUnlockTokensSpent = 0;
    const vendorSet = new Set<string>();
    for (const row of (ledger ?? []) as Array<{
      vendor_id: string | null;
      tokens_spent: number | null;
      spend_source: string | null;
    }>) {
      const tokens = Number(row.tokens_spent ?? 0);
      if (row.spend_source === 'creator_offer') reachTokensSpent += tokens;
      else if (row.spend_source === 'lead_unlock') leadUnlockTokensSpent += tokens;
      if (row.vendor_id) vendorSet.add(row.vendor_id);
    }

    const unlocked = totalInquiriesDriven >= ADMIN_INFLUENCER_ANALYTICS_MIN_UNLOCKS;

    // Leaderboard only above the gate (aggregate names + slugs only, never who
    // booked). Resolve display names for the top drivers.
    let topCreators: TopCreatorInfluence[] = [];
    if (unlocked) {
      const ranked = [...driven.entries()]
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      const topIds = ranked.map(([id]) => id);
      const nameById = new Map<string, { display_name: string | null; slug: string | null }>();
      if (topIds.length > 0) {
        const { data: users } = await admin
          .from('users')
          .select('user_id, display_name, slug')
          .in('user_id', topIds);
        for (const u of (users ?? []) as Array<{
          user_id: string;
          display_name: string | null;
          slug: string | null;
        }>) {
          nameById.set(u.user_id, { display_name: u.display_name, slug: u.slug });
        }
      }
      topCreators = ranked.map(([id, n]) => {
        const u = nameById.get(id);
        return {
          creatorUserId: id,
          creatorName: u?.display_name?.trim() || 'A Setnayan storyteller',
          creatorSlug: u?.slug ?? null,
          inquiriesDriven: n,
        };
      });
    }

    return {
      unlocked,
      totalInquiriesDriven,
      reachTokensSpent,
      leadUnlockTokensSpent,
      participatingVendorCount: vendorSet.size,
      activeCreatorCount,
      topCreators,
    };
  } catch {
    return EMPTY_ANALYTICS;
  }
}
