/**
 * Vendor tier capability matrix — the SINGLE SOURCE OF TRUTH in code for the
 * owner-provided 4-tier grid (canonical: corpus `Vendor_Tier_Capability_Matrix_2026-06-07.md`).
 *
 * `tier_state` enum on vendor_profiles = free | verified | pro | enterprise.
 * Every per-tier gate (burn, counts, feature flags, name reveal, radius, …)
 * should read from TIER_CAPS so the matrix lives in exactly one place.
 *
 * Numeric caps use `Infinity` for "Unlimited" and `0` for "✗ / none".
 */

export const VENDOR_TIERS = ['free', 'verified', 'pro', 'enterprise'] as const;
export type VendorTier = (typeof VENDOR_TIERS)[number];

export type ChatLevel = 'none' | 'chat' | 'chat_video';
export type SchedulingMode = 'manual' | 'hybrid';
/** hidden = ✗ (no marketplace presence) · screen = anonymized screen name · true = real business name day-1 */
export type NameMode = 'hidden' | 'screen' | 'true';
export type WebsiteMode = 'basic' | 'custom';

export interface TierCaps {
  /** Service/distance coverage radius. Infinity = unlimited, 0 = ✗. */
  serviceRadiusKm: number;
  /** Packages a vendor may create per leaf category. Infinity = unlimited. */
  packagesPerLeaf: number;
  /** Chat capability. 'none' = ✗ (FREE), 'chat' = text, 'chat_video' = +video (Enterprise). */
  chat: ChatLevel;
  /** Distinct parent (of the 10) categories the vendor may list under. Infinity = unlimited. */
  parentCategories: number;
  /** Agent (sub) seats beyond the main holder. Infinity = unlimited, 0 = none. */
  agentAccounts: number;
  scheduling: SchedulingMode;
  /** Appears in marketplace search. FREE = false. */
  marketplaceSearchable: boolean;
  nameMode: NameMode;
  /** Bookable slots/day. Infinity = unlimited, 0 = ✗. */
  slotsPerDay: number;
  /** Slots are time-bounded (am/pm split → effective slots double). */
  slotsTimeBounded: boolean;
  /** In-app customer inquiries the vendor may answer per rolling week. Infinity = unlimited, 0 = ✗. */
  inAppCustomersPerWeek: number;
  /**
   * Whether answering an in-app inquiry burns tokens.
   * OWNER 2026-06-07: verified ALSO pays (no free allowance) → true for
   * verified/pro/enterprise; free can't answer at all so it's moot (false).
   */
  inAppGated: boolean;
  /** Token cost to import/sync an outside customer. 1 for all tiers. */
  importCustomerTokenCost: number;
  /** Portfolio photo cap. Infinity = unlimited. */
  portfolioPhotos: number;
  /** Eligible to be tagged in editorial. */
  editorialTagged: boolean;
  /** Review star average is counted/shown. */
  reviewStarsCounted: boolean;
  /** Review free-text comments are viewable. */
  reviewCommentsViewable: boolean;
  website: WebsiteMode;
  /** Custom website name/slug. */
  customWebsiteName: boolean;
  /** Inquire link surfaced. True for all tiers. */
  inquireLink: boolean;
}

export const TIER_CAPS: Record<VendorTier, TierCaps> = {
  free: {
    serviceRadiusKm: 0,
    packagesPerLeaf: 2,
    chat: 'none',
    parentCategories: 1,
    agentAccounts: 0,
    scheduling: 'manual',
    marketplaceSearchable: false,
    nameMode: 'hidden',
    slotsPerDay: 0,
    slotsTimeBounded: false,
    inAppCustomersPerWeek: 0,
    inAppGated: false,
    importCustomerTokenCost: 1,
    portfolioPhotos: 30,
    editorialTagged: false,
    reviewStarsCounted: false,
    reviewCommentsViewable: false,
    website: 'basic',
    customWebsiteName: false,
    inquireLink: true,
  },
  verified: {
    serviceRadiusKm: 20,
    packagesPerLeaf: 2,
    chat: 'chat',
    parentCategories: 3,
    agentAccounts: 1,
    scheduling: 'hybrid',
    marketplaceSearchable: true,
    nameMode: 'screen',
    slotsPerDay: 1,
    slotsTimeBounded: false,
    inAppCustomersPerWeek: 10,
    inAppGated: true,
    importCustomerTokenCost: 1,
    portfolioPhotos: 50,
    editorialTagged: false,
    reviewStarsCounted: true,
    reviewCommentsViewable: false,
    website: 'custom',
    customWebsiteName: false,
    inquireLink: true,
  },
  pro: {
    serviceRadiusKm: 50,
    packagesPerLeaf: 5,
    chat: 'chat',
    parentCategories: 3,
    agentAccounts: 3,
    scheduling: 'hybrid',
    marketplaceSearchable: true,
    nameMode: 'true',
    slotsPerDay: 3,
    slotsTimeBounded: true,
    inAppCustomersPerWeek: Infinity,
    inAppGated: true,
    importCustomerTokenCost: 1,
    portfolioPhotos: 100,
    editorialTagged: true,
    reviewStarsCounted: true,
    reviewCommentsViewable: true,
    website: 'custom',
    customWebsiteName: true,
    inquireLink: true,
  },
  enterprise: {
    serviceRadiusKm: Infinity,
    packagesPerLeaf: Infinity,
    chat: 'chat_video',
    parentCategories: Infinity,
    agentAccounts: Infinity,
    scheduling: 'hybrid',
    marketplaceSearchable: true,
    nameMode: 'true',
    slotsPerDay: Infinity,
    slotsTimeBounded: true,
    inAppCustomersPerWeek: Infinity,
    inAppGated: true,
    importCustomerTokenCost: 1,
    portfolioPhotos: Infinity,
    editorialTagged: true,
    reviewStarsCounted: true,
    reviewCommentsViewable: true,
    website: 'custom',
    customWebsiteName: true,
    inquireLink: true,
  },
};

/** Monthly + annual subscription price (PHP) per the matrix. FREE tiers = 0. */
export const TIER_PRICE_PHP: Record<VendorTier, { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  verified: { monthly: 0, annual: 0 },
  pro: { monthly: 3999, annual: 39999 },
  enterprise: { monthly: 9999, annual: 99999 },
};

export const TIER_LABEL: Record<VendorTier, string> = {
  free: 'Free',
  verified: 'Free · Verified',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

/** Normalize an arbitrary string (or null) to a VendorTier, defaulting to 'free'. */
export function asVendorTier(raw: string | null | undefined): VendorTier {
  return (VENDOR_TIERS as readonly string[]).includes(raw ?? '')
    ? (raw as VendorTier)
    : 'free';
}

export function tierCaps(tier: string | null | undefined): TierCaps {
  return TIER_CAPS[asVendorTier(tier)];
}

/** Pro/Enterprise → real business name revealed day-1 (the `isPaidTier` reveal flag). */
export function isTrueNameTier(tier: string | null | undefined): boolean {
  return tierCaps(tier).nameMode === 'true';
}

/** Can this tier receive/answer in-app inquiries at all? (FREE cannot.) */
export function canAcceptInAppInquiries(tier: string | null | undefined): boolean {
  return tierCaps(tier).inAppCustomersPerWeek > 0;
}
