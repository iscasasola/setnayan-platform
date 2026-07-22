import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveVendorDisplayName } from '@/lib/vendors';
import { isPubliclyVisible, parseVisibility } from '@/lib/vendor-visibility';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { fetchInquiriesDrivenForCreators } from '@/lib/inquiry-attribution';

/**
 * Creator Economy — vendor↔creator DISCOUNT COLLAB loop (P1) · app seam.
 *
 * The three-party money engine's first rung. A vendor spends a REACH TOKEN to
 * send a discount offer to a creator (a user with >=1 published Adventure
 * Chapter on a public profile); the creator accepts/declines; the deliverable is
 * a published Chapter crediting the vendor. Setnayan holds NO money — it records
 * the collab + gates the outreach with a token; the discount settles off-platform.
 *
 * REUSE, DON'T FORK: the token spend is the EXISTING per-voucher burn
 * (consume_vendor_assets_per_voucher / consume_member_purchased_tokens).
 * ESCROW AT SEND (migration 20270819350491, closing the readiness-council B1–B3
 * money bugs; supersedes the soft-hold in 20270817214733): the send DEBITS the
 * reach token up front; accept AND decline merely SETTLE the already-spent
 * token (a "no" still costs the vendor the outreach — owner lock); only an
 * unanswered offer past expires_at is REFUNDED (credited back as purchased
 * tokens) by the sweep. This module is the thin seam over the RPCs:
 *   • offer_creator_reach_hold      — send (DEBIT/escrow a reach token)
 *   • respond_creator_offer         — accept/decline (settle; OFFER_EXPIRED past window)
 *   • link_creator_offer_deliverable— attach the crediting chapter later
 *   • sweep_expired_creator_offers  — expire unanswered offers + REFUND the escrow
 *
 * The client is untyped (no generated Database generic), so `.from()` / `.rpc()`
 * on the new names typecheck as loose queries; we cast returned rows to the
 * shapes below.
 */

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired';

/** An eligible creator a vendor may offer to (browse surface). */
export type EligibleCreator = {
  userId: string;
  displayName: string;
  slug: string | null;
  followersCount: number;
  viewCount: number;
  chapterCount: number;
  /** PR-C — the ONE influence metric: distinct events whose chapter-attributed
   *  inquiry a vendor unlocked (self-owned-vendor unlocks excluded). Raw
   *  integer; surfaces render nothing at 0. */
  inquiriesDriven: number;
};

/** A vendor's own sent offer (their Creators surface). */
export type VendorSentOffer = {
  offerId: string;
  creatorUserId: string;
  creatorName: string;
  creatorSlug: string | null;
  creatorRateTerms: string;
  audienceRateTerms: string | null;
  status: OfferStatus;
  /** Reach tokens CHARGED at send (escrow-at-send). Refunded as purchased
   *  tokens if the offer expires unanswered; kept on accept AND decline. */
  tokensHeld: number;
  createdAt: string;
  respondedAt: string | null;
  expiresAt: string;
  /**
   * PR-C fulfillment state: non-null when the creator linked the crediting
   * PUBLISHED chapter as the deliverable. fulfilled/unfulfilled is the WHOLE
   * outcome model — no clawback (owner paper-lock): an unfulfilled collab is
   * simply visible, and the vendor doesn't offer again.
   */
  fulfilledAt: string | null;
  deliverableChapterId: string | null;
};

/** An incoming offer in the creator's inbox. */
export type CreatorInboxOffer = {
  offerId: string;
  vendorId: string;
  vendorName: string;
  vendorSlug: string | null;
  vendorLogoUrl: string | null;
  creatorRateTerms: string;
  audienceRateTerms: string | null;
  status: OfferStatus;
  createdAt: string;
  respondedAt: string | null;
  expiresAt: string;
  deliverableChapterId: string | null;
};

/** A partnered vendor for the public profile "influence" block (aggregate). */
export type CreatorInfluenceVendor = {
  slug: string;
  name: string;
  logoUrl: string | null;
};

type VendorNameRow = {
  vendor_profile_id: string;
  business_name: string | null;
  business_slug: string | null;
  logo_url: string | null;
  location_city: string | null;
  public_visibility: string | null;
  name_revealed_at: string | null;
  tier_state: string | null;
  services: string[] | null;
  screen_name: string | null;
  verification_state: string | null;
};

const VENDOR_NAME_FIELDS =
  'vendor_profile_id, business_name, business_slug, logo_url, location_city, public_visibility, name_revealed_at, tier_state, services, screen_name, verification_state';

function displayNameFor(r: VendorNameRow): string {
  return resolveVendorDisplayName({
    business_name: r.business_name,
    name_revealed_at: r.name_revealed_at ?? null,
    primary_canonical_service: r.services?.[0] ?? null,
    location_city: r.location_city,
    services: r.services ?? null,
    screen_name: r.screen_name ?? null,
    isPaidTier: isTrueNameTier(r.tier_state ?? null),
    is_verified: r.verification_state === 'verified',
  });
}

// ---------------------------------------------------------------------------
// Browse — eligible creators (users with >=1 published chapter on a public
// profile), reach >= the vendor-set bar, ordered by followers then views. Runs
// on the admin client (the SAME public-read pattern as /u — `users` RLS won't
// let a vendor read arbitrary accounts; the gate is app-code here).
// ---------------------------------------------------------------------------
export async function fetchEligibleCreators(opts?: {
  minReach?: number;
  limit?: number;
}): Promise<EligibleCreator[]> {
  const minReach = Math.max(0, opts?.minReach ?? 0);
  const limit = Math.min(Math.max(opts?.limit ?? 60, 1), 200);
  const admin = createAdminClient();

  // Distinct creators = user_ids with >=1 published chapter. Count per user.
  const { data: chapterRows } = await admin
    .from('creator_chapters')
    .select('user_id')
    .eq('status', 'published');
  const counts = new Map<string, number>();
  for (const row of (chapterRows ?? []) as Array<{ user_id: string }>) {
    if (!row.user_id) continue;
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }
  const creatorIds = [...counts.keys()];
  if (creatorIds.length === 0) return [];

  // PR-C: creators who turned "accept vendor offers" OFF are HIDDEN from browse
  // (the server-side floor is offer_creator_reach_hold's CREATOR_OFFERS_OFF).
  // .neq keeps pre-migration rows (column absent → PostgREST error is caught by
  // the loose client returning an error → data null → empty browse; the column
  // ships in the same PR's migration, so this is a same-deploy window only).
  const { data: userRows } = await admin
    .from('users')
    .select('user_id, display_name, slug, followers_count, profile_view_count, public_profile_enabled, creator_accepts_offers')
    .in('user_id', creatorIds)
    .eq('public_profile_enabled', true)
    .neq('creator_accepts_offers', false);

  const rows = (userRows ?? []) as Array<{
    user_id: string;
    display_name: string | null;
    slug: string | null;
    followers_count: number | null;
    profile_view_count: number | null;
  }>;

  // PR-C — "inquiries driven" joins the browse card (raw number, no bands).
  const driven = await fetchInquiriesDrivenForCreators(rows.map((u) => u.user_id));

  const out: EligibleCreator[] = rows
    .map((u) => ({
      userId: u.user_id,
      displayName: u.display_name?.trim() || 'A Setnayan creator',
      slug: u.slug ?? null,
      followersCount: Number(u.followers_count ?? 0),
      viewCount: Number(u.profile_view_count ?? 0),
      chapterCount: counts.get(u.user_id) ?? 0,
      inquiriesDriven: driven.get(u.user_id) ?? 0,
    }))
    .filter((c) => c.followersCount >= minReach);

  out.sort((a, b) =>
    b.followersCount - a.followersCount || b.viewCount - a.viewCount,
  );
  return out.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Vendor's own sent offers — read via the RLS-scoped client (vendor owns via
// current_vendor_ids), then resolve creator display names via the admin client.
// ---------------------------------------------------------------------------
export async function fetchVendorSentOffers(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorSentOffer[]> {
  const { data } = await supabase
    .from('vendor_creator_offers')
    .select(
      'offer_id, creator_user_id, creator_rate_terms, audience_rate_terms, status, reach_tokens_held, created_at, responded_at, expires_at, fulfilled_at, deliverable_chapter_id',
    )
    .eq('vendor_id', vendorProfileId)
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as Array<{
    offer_id: string;
    creator_user_id: string;
    creator_rate_terms: string;
    audience_rate_terms: string | null;
    status: OfferStatus;
    reach_tokens_held: number;
    created_at: string;
    responded_at: string | null;
    expires_at: string;
    fulfilled_at: string | null;
    deliverable_chapter_id: string | null;
  }>;
  if (rows.length === 0) return [];

  const creatorIds = [...new Set(rows.map((r) => r.creator_user_id))];
  const admin = createAdminClient();
  const { data: users } = await admin
    .from('users')
    .select('user_id, display_name, slug')
    .in('user_id', creatorIds);
  const byId = new Map(
    ((users ?? []) as Array<{ user_id: string; display_name: string | null; slug: string | null }>).map(
      (u) => [u.user_id, u],
    ),
  );

  return rows.map((r) => {
    const u = byId.get(r.creator_user_id);
    return {
      offerId: r.offer_id,
      creatorUserId: r.creator_user_id,
      creatorName: u?.display_name?.trim() || 'A Setnayan creator',
      creatorSlug: u?.slug ?? null,
      creatorRateTerms: r.creator_rate_terms,
      audienceRateTerms: r.audience_rate_terms,
      status: r.status,
      tokensHeld: Number(r.reach_tokens_held ?? 0),
      createdAt: r.created_at,
      respondedAt: r.responded_at,
      expiresAt: r.expires_at,
      fulfilledAt: r.fulfilled_at ?? null,
      deliverableChapterId: r.deliverable_chapter_id ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Creator inbox — read via the RLS-scoped client (creator_user_id = auth.uid()),
// then resolve vendor names/logos via the admin client.
// ---------------------------------------------------------------------------
export async function fetchCreatorInbox(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreatorInboxOffer[]> {
  const { data } = await supabase
    .from('vendor_creator_offers')
    .select(
      'offer_id, vendor_id, creator_rate_terms, audience_rate_terms, status, created_at, responded_at, expires_at, deliverable_chapter_id',
    )
    .eq('creator_user_id', userId)
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as Array<{
    offer_id: string;
    vendor_id: string;
    creator_rate_terms: string;
    audience_rate_terms: string | null;
    status: OfferStatus;
    created_at: string;
    responded_at: string | null;
    expires_at: string;
    deliverable_chapter_id: string | null;
  }>;
  if (rows.length === 0) return [];

  const vendorIds = [...new Set(rows.map((r) => r.vendor_id))];
  const admin = createAdminClient();
  const { data: vendors } = await admin
    .from('vendor_profiles')
    .select(VENDOR_NAME_FIELDS)
    .in('vendor_profile_id', vendorIds);
  const byId = new Map(
    ((vendors ?? []) as VendorNameRow[]).map((v) => [v.vendor_profile_id, v]),
  );

  return rows.map((r) => {
    const v = byId.get(r.vendor_id);
    return {
      offerId: r.offer_id,
      vendorId: r.vendor_id,
      vendorName: v ? displayNameFor(v) : 'A Setnayan vendor',
      vendorSlug: v?.business_slug ?? null,
      vendorLogoUrl: v?.logo_url ?? null,
      creatorRateTerms: r.creator_rate_terms,
      audienceRateTerms: r.audience_rate_terms,
      status: r.status,
      createdAt: r.created_at,
      respondedAt: r.responded_at,
      expiresAt: r.expires_at,
      deliverableChapterId: r.deliverable_chapter_id,
    };
  });
}

// ---------------------------------------------------------------------------
// User-home "Your creator benefits" (owner req #6 · plan 2026-07-16) — the
// creator's OWN active (accepted) collabs: the vendor offers they hold. This is
// the PRIVATE, self-only counterpart of fetchCreatorInfluence (which is the
// public aggregate on /u). It reads creator_rate_terms — the private "your rate"
// they were offered — so it runs on the caller's RLS-scoped client (a creator
// reads only offers addressed to them; canonical vendor_creator_offers RLS).
// These are DISCOUNT benefits the vendor settles off-platform — never earnings,
// never cash from Setnayan. Vendor identity resolves on the admin client (same
// public-name path as fetchCreatorInbox).
// ---------------------------------------------------------------------------
export type ActiveCreatorCollab = {
  offerId: string;
  vendorName: string;
  vendorSlug: string | null;
  vendorLogoUrl: string | null;
  /** The creator-rate terms THIS vendor offered them (their own booking). */
  creatorRateTerms: string;
};

export async function fetchActiveCreatorCollabs(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveCreatorCollab[]> {
  const { data } = await supabase
    .from('vendor_creator_offers')
    .select('offer_id, vendor_id, creator_rate_terms, responded_at')
    .eq('creator_user_id', userId)
    .eq('status', 'accepted')
    .order('responded_at', { ascending: false });
  const rows = (data ?? []) as Array<{
    offer_id: string;
    vendor_id: string;
    creator_rate_terms: string;
  }>;
  if (rows.length === 0) return [];

  const vendorIds = [...new Set(rows.map((r) => r.vendor_id))];
  const admin = createAdminClient();
  const { data: vendors } = await admin
    .from('vendor_profiles')
    .select(VENDOR_NAME_FIELDS)
    .in('vendor_profile_id', vendorIds);
  const byId = new Map(
    ((vendors ?? []) as VendorNameRow[]).map((v) => [v.vendor_profile_id, v]),
  );

  return rows.map((r) => {
    const v = byId.get(r.vendor_id);
    return {
      offerId: r.offer_id,
      vendorName: v ? displayNameFor(v) : 'A Setnayan vendor',
      vendorSlug: v?.business_slug ?? null,
      vendorLogoUrl: v?.logo_url ?? null,
      creatorRateTerms: r.creator_rate_terms,
    };
  });
}

// ---------------------------------------------------------------------------
// Public "creator influence" — accepted partnerships (partnered vendors), an
// AGGREGATE for the /u profile. Admin client; app-code gates to publicly-visible
// vendors. Never exposes the offer terms or the offer graph — only the fact of a
// partnership + the vendor's public identity.
// ---------------------------------------------------------------------------
export async function fetchCreatorInfluence(
  userId: string,
): Promise<CreatorInfluenceVendor[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('vendor_creator_offers')
    .select('vendor_id')
    .eq('creator_user_id', userId)
    .eq('status', 'accepted');
  const vendorIds = [
    ...new Set(((data ?? []) as Array<{ vendor_id: string }>).map((r) => r.vendor_id)),
  ];
  if (vendorIds.length === 0) return [];

  const { data: vendors } = await admin
    .from('vendor_profiles')
    .select(VENDOR_NAME_FIELDS)
    .in('vendor_profile_id', vendorIds);

  const out: CreatorInfluenceVendor[] = [];
  const seen = new Set<string>();
  for (const v of (vendors ?? []) as VendorNameRow[]) {
    if (!isPubliclyVisible(parseVisibility(v.public_visibility))) continue;
    if (!v.business_slug || seen.has(v.business_slug)) continue;
    seen.add(v.business_slug);
    out.push({ slug: v.business_slug, name: displayNameFor(v), logoUrl: v.logo_url });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cron-free expiry sweep — flip every offer still 'pending' past its window to
// 'expired' AND REFUND the escrowed reach tokens (credited back as purchased/
// non-expiring tokens to whoever paid; exactly-once via refunded_at + the row
// lock inside the RPC). Mirrors maybeSweepGhostedLeadHolds: a cheap in-memory
// pre-throttle + a durable daily compare-and-swap on platform_settings so any
// vendor's visit sweeps the fleet.
// ---------------------------------------------------------------------------
export async function sweepExpiredCreatorOffers(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('sweep_expired_creator_offers');
  if (error) {
    console.error('[creator-offers] expiry sweep failed:', error.message);
    return 0;
  }
  return Array.isArray(data) ? data.length : 0;
}

/** In-memory pre-throttle per instance — makes the after() hook ~free. */
const OFFER_SWEEP_CHECK_THROTTLE_MS = 30 * 60 * 1000;
/** Target cadence — run the expiry sweep at most ~once per this window. */
const OFFER_SWEEP_MIN_GAP_MS = 20 * 60 * 60 * 1000;
let lastOfferSweepCheckMs = 0;

export async function maybeSweepExpiredCreatorOffers(): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - lastOfferSweepCheckMs < OFFER_SWEEP_CHECK_THROTTLE_MS) return;
  lastOfferSweepCheckMs = nowMs;
  try {
    const admin = createAdminClient();
    const nowIso = new Date(nowMs).toISOString();
    const cutoffIso = new Date(nowMs - OFFER_SWEEP_MIN_GAP_MS).toISOString();
    const { data: claim } = await admin
      .from('platform_settings')
      .update({ creator_offer_sweep_last_run_at: nowIso })
      .eq('id', 1)
      .or(
        `creator_offer_sweep_last_run_at.is.null,creator_offer_sweep_last_run_at.lt.${cutoffIso}`,
      )
      .select('id');
    if (!claim || claim.length === 0) return; // throttled, lost the race, or no row
    await sweepExpiredCreatorOffers();
  } catch {
    // Best-effort — a missed run just retries on the next eligible request.
  }
}
