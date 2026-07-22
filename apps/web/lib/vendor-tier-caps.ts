/**
 * Vendor tier capability matrix — the SINGLE SOURCE OF TRUTH in code for the
 * owner-provided tier grid.
 *
 * `tier_state` enum on vendor_profiles = free | verified | solo | pro | enterprise.
 * free + verified are legacy states kept for backward compatibility.
 * The three marketed tiers are Solo (₱999/28d) · Pro (₱2,499/28d) · Enterprise (₱7,999/28d).
 * (Prices shown for reference only — the live figures are read from
 * vendor_billing_catalog; this file only carries capability caps, not prices.)
 *
 * Numeric caps use `Infinity` for "Unlimited" and `0` for "✗ / none".
 */

export const VENDOR_TIERS = ['free', 'verified', 'solo', 'pro', 'enterprise', 'custom'] as const;
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
  /**
   * Eligible to be tagged in editorial (the showcase credit chip — logo +
   * /v/[slug] link). RETIRED AS A TIER DISTINCTION 2026-07-16 (owner-ratified
   * Simplicity Canon rule 2, Creator_Economy_Discount_Collab_Build_Plan:
   * "Being credited in a story is always free — editorial or chapter, any
   * tier. You never pay to be named in a story."). Now TRUE for every tier;
   * kept as a field so the matrix shape (and any external read) is unchanged.
   * Pro keeps its other perks. Name display still respects the hybrid-
   * anonymity mechanic at the read sites (resolveVendorDisplayName).
   */
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
  /**
   * HYBRID feature gates (owner 2026-07-01). The audit found most Solo/Pro
   * benefits were built but ungated; the hybrid decision gates the premium few
   * and keeps the ops spine free. Enforced flag-dark via
   * isVendorFeatureGateEnabled() — see lib/vendor-feature-gate.ts.
   */
  /**
   * Demand Radar + Price-Position / cross-business market intelligence surface.
   * ENTERPRISE-ONLY (owner 2026-07-01 My Performance tiering): this is the only
   * class of analytics derived from OTHER businesses' aggregate (de-identified +
   * min-N) data, so it sits at the top tier. Own-business analytics never gate
   * here. (Was Pro+ until the tiering decision.)
   */
  marketIntel: boolean;
  /** Reverse-image theft-watch surface. Pro+. */
  theftWatch: boolean;
  /**
   * BASIC own-business performance — My Performance access + Health composite +
   * Grow recs + basic Momentum (count, Monthly/Annual). Solo+ (the free snapshot
   * panel on Home stays free).
   */
  performanceTrends: boolean;
  /**
   * ADVANCED own-business analytics — ROI attribution, Funnel, daily + revenue
   * Momentum, and the inquiry-handling / conversion / catalog / reputation
   * detail families. Pro+ (owner 2026-07-01 My Performance tiering: "basic
   * information analytics will be for pro; more complex will be for enterprise").
   */
  performanceAdvanced: boolean;
  /** Solo business back-office (earnings analytics + recap sharing). Solo+ (2026-07-01 beef-up). */
  soloBusinessTools: boolean;
  /**
   * In-thread 1:1 voice/video CALLS with couples (the "Call" tab + appointment
   * video/voice join). PAID-tier capability — any paid plan (Solo+), NOT
   * Free/Verified (owner 2026-07-13: "a service for the paid"). The media is
   * free P2P; a TURN relay covers hard-NAT couples, so gating it to paying
   * vendors also keeps the relay a paid-vendor cost. Enforced flag-dark via
   * isVendorFeatureGateEnabled() — see lib/vendor-feature-gate.ts — so the
   * transport un-gates unchanged until the owner flips the gate on.
   */
  calls: boolean;
}

export const TIER_CAPS: Record<VendorTier, TierCaps> = {
  free: {
    calls: false,
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
    marketIntel: false,
    theftWatch: false,
    performanceTrends: false,
    performanceAdvanced: false,
    soloBusinessTools: false,
    editorialTagged: true, // always free (Simplicity Canon rule 2 · 2026-07-16)
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
    calls: false,
    serviceRadiusKm: 20,
    servicesPerLeaf: 2,
    chat: 'chat',
    parentCategories: 1,
    agentAccounts: 0,
    scheduling: 'hybrid',
    marketplaceSearchable: true,
    nameMode: 'screen',
    marketIntel: false,
    theftWatch: false,
    performanceTrends: false,
    performanceAdvanced: false,
    soloBusinessTools: false,
    slotsPerDay: 1,
    slotsTimeBounded: false,
    inAppCustomersPerWeek: 10,
    inAppGated: true,
    importCustomerTokenCost: 0,
    portfolioPhotos: 50,
    editorialTagged: true, // always free (Simplicity Canon rule 2 · 2026-07-16)
    reviewStarsCounted: true,
    reviewCommentsViewable: false,
    website: 'custom',
    customWebsiteName: false,
    inquireLink: true,
  },
  // Solo — ₱999/28d entry-level paid tier (price from vendor_billing_catalog).
  // One category, one operator + one helper. Real name shown day-1 (paid).
  // Token-burn model same as Pro/Enterprise (inAppGated = true). One agent seat
  // (owner 2026-07-02 — Solo now sits one seat above Free · Verified's 0).
  solo: {
    calls: true,
    serviceRadiusKm: 20,
    servicesPerLeaf: 3,
    marketIntel: false,
    theftWatch: false,
    performanceTrends: true,
    performanceAdvanced: false,
    soloBusinessTools: true,
    chat: 'chat',
    parentCategories: 1,
    agentAccounts: 1,
    scheduling: 'hybrid',
    marketplaceSearchable: true,
    nameMode: 'true',
    slotsPerDay: 1,
    slotsTimeBounded: false,
    inAppCustomersPerWeek: Infinity,
    inAppGated: true,
    importCustomerTokenCost: 0,
    portfolioPhotos: 50,
    editorialTagged: true, // always free (Simplicity Canon rule 2 · 2026-07-16)
    reviewStarsCounted: true,
    reviewCommentsViewable: false,
    website: 'custom',
    customWebsiteName: false,
    inquireLink: true,
  },
  pro: {
    calls: true,
    serviceRadiusKm: 50,
    // Market intel (cross-business Demand Radar + Price-Position) is PRO-AND-UP
    // (owner 2026-07-11 — supersedes the 2026-07-01 "Enterprise-only" call, which
    // the marketing copy had already been advertising as a Pro benefit). Pro also
    // keeps the full OWN-business analytics via performanceAdvanced.
    marketIntel: true,
    theftWatch: true,
    performanceTrends: true,
    performanceAdvanced: true,
    soloBusinessTools: true,
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
  // Enterprise is now a BOUNDED "larger range", not truly unlimited (owner
  // 2026-07-01, alongside the ₱4,999→₱7,999 reprice — 28-day fee finalized at
  // ₱7,999 on 2026-07-10). The four scale axes are
  // finite; a negotiated "Custom" tier (follow-up) is the home for franchises /
  // multi-location / truly-unlimited. Left unbounded: parentCategories ("all
  // categories" — taxonomy-bounded already) + servicesPerLeaf + inApp volume.
  enterprise: {
    calls: true,
    serviceRadiusKm: 100, // nationwide-marketed (top of the Local→20→50→100 ladder)
    marketIntel: true,
    theftWatch: true,
    performanceTrends: true,
    performanceAdvanced: true,
    soloBusinessTools: true,
    servicesPerLeaf: Infinity,
    chat: 'chat',
    parentCategories: Infinity,
    agentAccounts: 10,
    scheduling: 'hybrid',
    marketplaceSearchable: true,
    nameMode: 'true',
    slotsPerDay: 8,
    slotsTimeBounded: true,
    inAppCustomersPerWeek: Infinity,
    inAppGated: true,
    importCustomerTokenCost: 0,
    portfolioPhotos: 300,
    editorialTagged: true,
    reviewStarsCounted: true,
    reviewCommentsViewable: true,
    website: 'custom',
    customWebsiteName: true,
    inquireLink: true,
  },
  // Custom — the negotiated "Talk to us" tier ABOVE Enterprise (owner-signed
  // rate card · VENDOR_TIERS_AND_BENEFITS.md §11). Owner rule: "Custom runs as
  // Enterprise automatically" — so every feature/boolean axis and the base
  // numeric ceilings are the Enterprise values. The composed plan's extra reach
  // / seats / slots / photos / tokens / domain are overlaid at read time from an
  // ACTIVE vendor_custom_plans row by vendorEffectiveCaps() (lib/vendor-effective-
  // caps.ts) — the static base here is the Enterprise clone, never edited per
  // vendor. Keep this in lockstep with `enterprise` above on any Enterprise edit.
  custom: {
    calls: true,
    serviceRadiusKm: 100,
    marketIntel: true,
    theftWatch: true,
    performanceTrends: true,
    performanceAdvanced: true,
    soloBusinessTools: true,
    servicesPerLeaf: Infinity,
    chat: 'chat',
    parentCategories: Infinity,
    agentAccounts: 10,
    scheduling: 'hybrid',
    marketplaceSearchable: true,
    nameMode: 'true',
    slotsPerDay: 8,
    slotsTimeBounded: true,
    inAppCustomersPerWeek: Infinity,
    inAppGated: true,
    importCustomerTokenCost: 0,
    portfolioPhotos: 300,
    editorialTagged: true,
    reviewStarsCounted: true,
    reviewCommentsViewable: true,
    website: 'custom',
    customWebsiteName: true,
    inquireLink: true,
  },
};

/**
 * Monthly (28-day) + annual subscription price (PHP) — fallback only; the live
 * `vendor_billing_catalog` (read via getVendorPrices) is authoritative. Never
 * hardcode a price in UI copy.
 *
 * ROUND-NUMBER LADDER (owner 2026-07-22 · reprice off the charm "Ladder B"
 * ₱999/₱2,499/₱7,999): Solo ₱1,000 · Pro ₱2,500 · Enterprise ₱8,000 /28d, with
 * annual = 10× the 28-day fee (a subscription year is 13 cycles, billed for 10
 * — first 3 free): ₱10,000 · ₱25,000 · ₱80,000. Enterprise is a BOUNDED tier; a
 * negotiated "Custom" tier for the truly-unlimited case sits above it.
 */
export const TIER_PRICE_PHP: Record<VendorTier, { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  verified: { monthly: 0, annual: 0 },
  solo: { monthly: 1000, annual: 10000 },
  pro: { monthly: 2500, annual: 25000 },
  enterprise: { monthly: 8000, annual: 80000 },
  // Custom is priced PER PLAN (composed 28-day total on vendor_custom_plans,
  // computed by lib/vendor-custom-pricing.ts). These are the base-only fallback
  // figures (base ₱8,999/28d · annual = 10× base) for display when no plan is
  // composed yet; the real quote always comes from the composed plan.
  custom: { monthly: 8999, annual: 89990 },
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
  // Solo grants NO bundle tokens: neither the SQL CASE in
  // _apply_subscription_credit (branches pro/enterprise only) nor setVendorTier
  // (guarded to pro/enterprise) ever credits Solo. Zeroed 2026-07-01 so the
  // subscription card can't advertise free tokens no grant path delivers.
  solo: { monthly: 0, annual: 0 },
  pro: { monthly: 5, annual: 50 },
  enterprise: { monthly: 10, annual: 100 },
  // Custom's included tokens are a composed line (tokensPerCycle on the plan,
  // priced at a flat face value per the rate card) — NOT a fixed subscription
  // bundle. This static entry is 0 so no bundle-token path double-grants; the
  // composed count is handled by the Custom plan flow.
  custom: { monthly: 0, annual: 0 },
};

/** Price to buy one additional lifetime (non-expiring) token. */
export const TOKEN_BUY_PRICE_PHP = 100;

/**
 * May purchase additional lifetime tokens (₱200/token)?
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
  custom: 'Custom',
};

/**
 * Ordinal rank of a tier on the value ladder (Free 0 … Custom 5). Use this for
 * "this tier or higher" gates instead of hard `tier === 'enterprise'` equality
 * so `custom` — which runs as Enterprise-or-better automatically — inherits
 * every Enterprise entitlement without a per-site edit. `verified` outranks
 * `free` but is still a free tier; the paid ladder is solo < pro < enterprise <
 * custom.
 */
const TIER_RANK: Record<VendorTier, number> = {
  free: 0,
  verified: 1,
  solo: 2,
  pro: 3,
  enterprise: 4,
  custom: 5,
};

export function tierRank(tier: string | null | undefined): number {
  return TIER_RANK[asVendorTier(tier)];
}

/** True when `tier` is at or above `min` on the value ladder. */
export function isTierAtLeast(
  tier: string | null | undefined,
  min: VendorTier,
): boolean {
  return tierRank(tier) >= TIER_RANK[min];
}

/**
 * May this tier buy paid EXTRA team seats beyond its base cap? Enterprise (base
 * 10) and Custom (runs as Enterprise) — i.e. Enterprise-or-higher. Rank-derived
 * so Custom inherits automatically. Enforced server-side in team/actions.ts
 * (`buyExtraSeat`) + the invite guard's "at cap" hint.
 */
export function canBuyExtraSeats(tier: string | null | undefined): boolean {
  return isTierAtLeast(tier, 'enterprise');
}

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
 * slots. Keyed directly on the enterprise tier — NOT on a numeric slot cap:
 * Enterprise is now BOUNDED to slotsPerDay=8 (owner 2026-07-01), so the old
 * `slotsPerDay === Infinity` test went permanently false and broke the feature
 * for every tier. `slotsTimeBounded` is also unusable (true for Pro too). Pro
 * keeps the #2 daily_capacity model; only Enterprise gets the separate
 * named-window model. Re-checked server-side on every plot/edit action so a
 * downgrade can't keep adding slots.
 */
export function canPlotTimeSlots(tier: string | null | undefined): boolean {
  // Enterprise-or-higher (rank-derived so Custom, which runs as Enterprise,
  // inherits automatically) rather than a hard `=== 'enterprise'` equality.
  return isTierAtLeast(tier, 'enterprise');
}

/**
 * HYBRID feature gates (owner 2026-07-01). The premium-few gate up to their
 * tier; the ops spine stays free. These read the caps above; enforcement is
 * flag-dark behind isVendorFeatureGateEnabled() (lib/vendor-feature-gate.ts) so
 * the founder + demo/test vendors (all tier_state='free' today) aren't locked
 * out until paid vendors exist in prod.
 */
export function canSeeMarketIntel(tier: string | null | undefined): boolean {
  return tierCaps(tier).marketIntel; // Demand Radar + Price-Position (Pro-and-up · 2026-07-11)
}
export function canSeeTheftWatch(tier: string | null | undefined): boolean {
  return tierCaps(tier).theftWatch; // reverse-image theft watch (Pro+)
}
export function canSeePerformanceTrends(tier: string | null | undefined): boolean {
  return tierCaps(tier).performanceTrends; // My Performance access + basic Momentum (Solo+); snapshot panel stays free
}
export function canSeePerformanceAdvanced(tier: string | null | undefined): boolean {
  return tierCaps(tier).performanceAdvanced; // ROI + Funnel + daily/revenue Momentum + detail families (Pro+)
}
export function canUseSoloBusinessTools(tier: string | null | undefined): boolean {
  return tierCaps(tier).soloBusinessTools; // earnings dashboard + recap sharing (Solo+)
}
export function canUseCalls(tier: string | null | undefined): boolean {
  return tierCaps(tier).calls; // in-thread voice/video calls with couples — any paid plan (Solo+)
}
