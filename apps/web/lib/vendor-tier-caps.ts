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

/**
 * External-visibility ladder (Vendor_Monetization_Model_LOCKED_2026-07-25 § 8 —
 * "SEO/GEO/AEO is BUNDLED into the subscription, never an add-on"):
 *
 *   'basic'    — Free · Verified. Basic indexability: the /v/[slug] page is
 *                crawlable and carries the core LocalBusiness identity graph
 *                (name · url · description · image · city · breadcrumb). FREE
 *                FOR EVERYONE, deliberately — it also feeds Setnayan's own SEO,
 *                so we never de-index a vendor to sell a tier.
 *   'enhanced' — Solo+. Enhanced SEO + GEO: the local/entity enrichment that
 *                lets Google and local-pack surfaces match the vendor against
 *                category + place queries (`knowsAbout` service entities).
 *   'aeo'      — Pro+. Answer-Engine Optimization: the machine-answerable OFFER
 *                graph (`hasOfferCatalog` · `makesOffer` · `priceRange`) that AI
 *                answer engines quote verbatim, plus priority sitemap weight.
 *   'priority' — Enterprise · Custom. Everything in 'aeo' plus the top sitemap
 *                priority band ("Priority + AEO" in the locked matrix).
 *
 * Monotonic by construction — see `SEO_LEVEL_RANK` + the ladder tests.
 */
export type VendorSeoLevel = 'basic' | 'enhanced' | 'aeo' | 'priority';

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
  /**
   * EDITORIAL FEATURES — the GROWTH row of the locked matrix
   * (Vendor_Monetization_Model_LOCKED_2026-07-25 § 1: "Vendor favorites ·
   * Editorial features | — | favorites | ✓ | ✓") → **Pro+**.
   *
   * ⚠ THIS IS NOT `editorialTagged`, and the distinction is load-bearing:
   *   • `editorialTagged` = being CREDITED in a couple's story (logo + /v link).
   *     ALWAYS FREE at every tier — owner-ratified Simplicity Canon rule 2
   *     (2026-07-16): "You never pay to be named in a story." Untouched here.
   *   • `editorialFeatures` = Setnayan proactively FEATURING/promoting the
   *     vendor editorially (§ 8's "AI-surfaced featuring"), i.e. the vendor is
   *     eligible to be picked for a Setnayan-authored feature slot.
   *
   * Deliberately NOT wired to any credit path — doing so would break rule 2.
   * Shipped as the SSOT cap + `canUseEditorialFeatures()` helper so the
   * featuring surface (when it exists) reads the matrix instead of inventing a
   * tier check. See the changelog fragment's owner-decision note.
   */
  editorialFeatures: boolean;
  /**
   * External visibility bundled into the subscription — see {@link VendorSeoLevel}.
   * Basic indexability is FREE for every tier; Solo buys GEO enrichment, Pro
   * buys AEO + priority sitemap, Enterprise/Custom buy the top priority band.
   * Read through `vendorSeoPlan()` (lib/vendor-seo-tier.ts), never directly at a
   * render site, so the flag-dark fallback stays in exactly one place.
   */
  seoLevel: VendorSeoLevel;
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
   * **PRO-AND-UP** — owner 2026-07-11, re-confirmed by the locked monetization
   * matrix (Vendor_Monetization_Model_LOCKED_2026-07-25 § 1 GROW row: "Market
   * intel (Demand Radar + price-position) | — | — | ✓ | ✓"). This is the only
   * class of analytics derived from OTHER businesses' aggregate (de-identified +
   * min-N) data. Own-business analytics never gate here.
   * (History: briefly Enterprise-only under the 2026-07-01 My Performance
   * tiering; the 2026-07-11 reversal to Pro+ stands and is now matrix-locked.)
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
    editorialFeatures: false, // proactive editorial featuring — Pro+ (§ 1 GROW)
    seoLevel: 'basic', // basic indexability is free for all (§ 8)
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
    // NAME IS NEVER GATED (owner "open it up" lock · Vendor_Subscription_Ladder_
    // 2026-07-22 §3). Was 'screen' (anonymized until first chat reply / upgrade)
    // — the name paywall. A `verified` vendor is a real, verified business on the
    // free plan; couples must always see who's there, so the real business name
    // shows day-1 on every tier. Paid tiers buy PROMINENCE + REACH (radius,
    // seats, categories, market intel), never the name itself.
    nameMode: 'true',
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
    editorialFeatures: false, // proactive editorial featuring — Pro+ (§ 1 GROW)
    seoLevel: 'basic', // basic indexability is free for all (§ 8)
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
    editorialFeatures: false, // proactive editorial featuring — Pro+ (§ 1 GROW)
    // Solo buys ENHANCED SEO + GEO (§ 8): local/entity structured data on top of
    // the free basic indexability. AEO stays Pro+.
    seoLevel: 'enhanced',
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
    editorialFeatures: true, // GROW row unlocks at Pro (§ 1)
    // Pro buys AEO — the machine-answerable offer graph AI answer engines quote
    // — plus priority sitemap weight (§ 8).
    seoLevel: 'aeo',
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
    editorialFeatures: true, // GROW row unlocks at Pro (§ 1)
    // Enterprise · Custom buy the TOP sitemap priority band on top of AEO
    // ("Priority + AEO" · § 8).
    seoLevel: 'priority',
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
    editorialFeatures: true, // GROW row unlocks at Pro (§ 1)
    // Enterprise · Custom buy the TOP sitemap priority band on top of AEO
    // ("Priority + AEO" · § 8).
    seoLevel: 'priority',
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

/**
 * TRUE when the tier shows the real business name day-1 (the `isPaidTier` reveal
 * flag passed to resolveVendorDisplayName). Per the "open it up" lock
 * (Vendor_Subscription_Ladder_2026-07-22 §3) a vendor's name is NEVER gated, so
 * every couple-facing tier resolves 'true' here; only the internal unverified
 * `free` state may still carry the anonymized placeholder. Derive from the
 * `nameMode` cap — never hardcode a tier set (that was the vendor-cards.ts bug).
 */
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

/**
 * GROWTH row of the locked matrix — proactive EDITORIAL FEATURING (Pro+).
 *
 * ⚠ Not the editorial CREDIT chip: being named/credited in a couple's story is
 * free at every tier forever (Simplicity Canon rule 2 · `editorialTagged`). This
 * helper answers only "is this vendor eligible to be picked for a Setnayan-
 * authored feature slot?".
 */
export function canUseEditorialFeatures(tier: string | null | undefined): boolean {
  return tierCaps(tier).editorialFeatures; // Pro-and-up (locked matrix § 1 GROW)
}

/**
 * Ordinal rank of the external-visibility ladder, so "at least enhanced" is a
 * comparison instead of a set membership (the same lesson as `TIER_RANK`: a
 * hardcoded tier set is what broke `canPlotTimeSlots`).
 */
export const SEO_LEVEL_RANK: Record<VendorSeoLevel, number> = {
  basic: 0,
  enhanced: 1,
  aeo: 2,
  priority: 3,
};

/** The tier's bundled external-visibility level (§ 8). Never a price — a level. */
export function vendorSeoLevel(tier: string | null | undefined): VendorSeoLevel {
  return tierCaps(tier).seoLevel;
}

/** True when the tier's SEO level is at or above `min`. */
export function isSeoLevelAtLeast(
  tier: string | null | undefined,
  min: VendorSeoLevel,
): boolean {
  return SEO_LEVEL_RANK[vendorSeoLevel(tier)] >= SEO_LEVEL_RANK[min];
}
