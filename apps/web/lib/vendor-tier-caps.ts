/**
 * Vendor tier capability matrix — the SINGLE SOURCE OF TRUTH in code for the
 * owner-provided tier grid.
 *
 * `tier_state` enum on vendor_profiles = free | verified | solo | pro | enterprise.
 * free + verified are legacy states kept for backward compatibility.
 * The three marketed tiers are Solo (₱999/28d) · Pro (₱2,499/28d) · Enterprise (₱4,999/28d).
 * (Prices shown for reference only — the live figures are read from
 * vendor_billing_catalog; this file only carries capability caps, not prices.)
 *
 * Numeric caps use `Infinity` for "Unlimited" and `0` for "✗ / none".
 */

export const VENDOR_TIERS = ['free', 'verified', 'solo', 'pro', 'enterprise'] as const;
export type VendorTier = (typeof VENDOR_TIERS)[number];

// Video calls REMOVED 2026-06-09 (owner). ChatLevel is text-only now — no
// 'chat_video'; Enterprise chat == Pro/Verified. The 2026-05-16 "video
// meetings retired" lock stands.
export type ChatLevel = 'none' | 'chat';
export type SchedulingMode = 'manual' | 'hybrid';
/** hidden = ✗ (no marketplace presence) · screen = anonymized screen name · true = real business name day-1 */
export type NameMode = 'hidden' | 'screen' | 'true';
export type WebsiteMode = 'basic' | 'custom';

export interface TierCaps {
  /** Service/distance coverage radius. Infinity = unlimited, 0 = ✗. */
  serviceRadiusKm: number;
  /**
   * Number of distinct SERVICE LISTINGS a vendor may create per leaf category
   * (owner 2026-06-07: the "Creating Package" matrix row = service listings per
   * leaf). Infinity = unlimited.
   */
  servicesPerLeaf: number;
  /** Chat capability. 'none' = ✗ (FREE), 'chat' = text (Verified/Pro/Enterprise). Video removed 2026-06-09. */
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
   * OWNER 2026-06-07 (reissued sheet): only PRO/ENTERPRISE pay — FREE-VERIFIED
   * answers its 10/week FREE (gate ✗); FREE can't answer at all (moot). This
   * reverted the earlier same-day "verified also pays" choice.
   */
  inAppGated: boolean;
  /**
   * Token cost to import/sync an outside customer. 0 for all tiers — import
   * is FREE (owner 2026-06-30; the free CRM on-ramp + viral acquisition
   * engine, retiring the old 1-token import fee). Kept as a field for the
   * tier matrix's shape; not read for gating.
   */
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
    servicesPerLeaf: 2,
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
    importCustomerTokenCost: 0,
    portfolioPhotos: 30,
    editorialTagged: false,
    reviewStarsCounted: false,
    reviewCommentsViewable: false,
    website: 'basic',
    customWebsiteName: false,
    inquireLink: true,
  },
  // Verified — legacy FREE tier kept for backward compatibility. RETUNED
  // 2026-06-25 (owner-approved) so the ladder is strictly monotonic
  // Free < Verified < Solo: parentCategories 3→1, agentAccounts 1→0, and
  // inAppGated false→true (verified now burns tokens per in-app answer — but
  // still keeps its 10/week cap, enforced in unlock_vendor_event). Solo stays
  // strictly better (servicesPerLeaf 3 vs 2, inAppCustomersPerWeek ∞ vs 10).
  verified: {
    serviceRadiusKm: 20,
    servicesPerLeaf: 2,
    chat: 'chat',
    parentCategories: 1,
    agentAccounts: 0,
    scheduling: 'hybrid',
    marketplaceSearchable: true,
    nameMode: 'screen',
    slotsPerDay: 1,
    slotsTimeBounded: false,
    inAppCustomersPerWeek: 10,
    inAppGated: true,
    importCustomerTokenCost: 0,
    portfolioPhotos: 50,
    editorialTagged: false,
    reviewStarsCounted: true,
    reviewCommentsViewable: false,
    website: 'custom',
    customWebsiteName: false,
    inquireLink: true,
  },
  // Solo — ₱999/28d entry-level paid tier (price from vendor_billing_catalog).
  // One category, one operator. Real name shown day-1 (paid). Token-burn model
  // same as Pro/Enterprise (inAppGated = true). No agent seats (truly solo).
  solo: {
    serviceRadiusKm: 20,
    servicesPerLeaf: 3,
    chat: 'chat',
    parentCategories: 1,
    agentAccounts: 0,
    scheduling: 'hybrid',
    marketplaceSearchable: true,
    nameMode: 'true',
    slotsPerDay: 1,
    slotsTimeBounded: false,
    inAppCustomersPerWeek: Infinity,
    inAppGated: true,
    importCustomerTokenCost: 0,
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
    servicesPerLeaf: 5,
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
    importCustomerTokenCost: 0,
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
    servicesPerLeaf: Infinity,
    chat: 'chat',
    parentCategories: Infinity,
    agentAccounts: Infinity,
    scheduling: 'hybrid',
    marketplaceSearchable: true,
    nameMode: 'true',
    slotsPerDay: Infinity,
    slotsTimeBounded: true,
    inAppCustomersPerWeek: Infinity,
    inAppGated: true,
    importCustomerTokenCost: 0,
    portfolioPhotos: Infinity,
    editorialTagged: true,
    reviewStarsCounted: true,
    reviewCommentsViewable: true,
    website: 'custom',
    customWebsiteName: true,
    inquireLink: true,
  },
};

/**
 * Monthly (28-day) + annual subscription price (PHP) — owner reissue 2026-06-07.
 * NOTE: round numbers (not the brand charm/-1 convention) — owner-set explicitly.
 */
export const TIER_PRICE_PHP: Record<VendorTier, { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  verified: { monthly: 0, annual: 0 },
  solo: { monthly: 2000, annual: 0 },
  pro: { monthly: 6000, annual: 60000 },
  enterprise: { monthly: 10000, annual: 100000 },
};

/**
 * Free tokens bundled with a paid subscription, granted per paid period
 * (activation/renewal) by `_apply_subscription_credit`, and on admin tier-set
 * (the monthly amount) by `setVendorTier`.
 *
 * RATES (owner 2026-06-09): Pro 5/50 · Enterprise 10/100. **LIFETIME** — the
 * bundle is credited to the never-expire `vendor_wallets.purchased_tokens`
 * bucket and available in full immediately (via `grant_vendor_lifetime_tokens`,
 * migration 20261012000000). The amounts are MIRRORED in the SQL CASE inside
 * `_apply_subscription_credit`; keep BOTH in sync on any future reprice.
 */
export const TIER_SUBSCRIPTION_BUNDLE_TOKENS: Record<
  VendorTier,
  { monthly: number; annual: number }
> = {
  free: { monthly: 0, annual: 0 },
  verified: { monthly: 0, annual: 0 },
  solo: { monthly: 2, annual: 0 },
  pro: { monthly: 5, annual: 50 },
  enterprise: { monthly: 10, annual: 100 },
};

/** Price to buy one additional lifetime (non-expiring) token. */
export const TOKEN_BUY_PRICE_PHP = 100;

/**
 * May purchase additional lifetime tokens (₱100/token)?
 *
 * VERIFICATION-GATED (owner 2026-07-01: "they can only purchase tokens and
 * subscribe when they are verified"). Only a VERIFIED store may buy — i.e. any
 * tier except unverified `free`. This is the client-side UX mirror; the server
 * RPC `create_vendor_token_purchase` is authoritative — it RAISEs NOT_VERIFIED
 * on `vendor_profiles.verification_state <> 'verified'` (migration
 * 20270403095563). Reverses the 2026-06-07 "FREE may buy" override, whose
 * client-import justification died when customer import went free (#2448).
 */
export function canBuyTokens(tier: string | null | undefined): boolean {
  return asVendorTier(tier) !== 'free';
}

export const TIER_LABEL: Record<VendorTier, string> = {
  free: 'Free',
  verified: 'Free · Verified',
  solo: 'Solo',
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

/**
 * Tier #3 (owner 2026-06-07): only ENTERPRISE may plot time-bound booking
 * slots. The Enterprise signal is `slotsPerDay === Infinity` (unbounded
 * bookings/day) — NOT `slotsTimeBounded`, which is true for both Pro and
 * Enterprise. Pro keeps the #2 daily_capacity model (finite slotsPerDay); only
 * Enterprise gets the separate named-window model. Re-checked server-side on
 * every plot/edit action so a downgrade can't keep adding slots.
 */
export function canPlotTimeSlots(tier: string | null | undefined): boolean {
  return tierCaps(tier).slotsPerDay === Infinity;
}
