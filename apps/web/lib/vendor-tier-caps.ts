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

/**
 * The tiers an admin may SET on one vendor from a dropdown — the list
 * `setVendorTier` validates against, and the list both tier `<select>`s are
 * built from. ONE constant, because the two used to disagree.
 *
 * 🚨 THE BUG THIS EXISTS TO END (found by a post-merge audit 2026-09-05). The
 * dropdowns on /admin/gifts and /admin/vendors/[id]/plan were built from
 * `VENDOR_TIERS` (six options) while `setVendorTier` validated against its own
 * private four — so choosing **Solo**, the cheapest paid tier and the natural
 * comp, threw `Invalid tier.` as an unhandled server-action error: the form
 * contents lost, the vendor unchanged, and nothing on screen explaining why.
 * Same for Custom. A list you can pick from and a list that is accepted must be
 * the same list, so now they are literally the same constant.
 *
 * `solo` IS settable: it is a real `tier_state` enum value (migration
 * 20270221294989), `solo_vendor_monthly` is a live catalogue SKU, and a cohort
 * deal can already promote vendors to it (`PROMOTABLE_VENDOR_TIERS`). Denying
 * it to a single named vendor was an accident, not a decision.
 *
 * `custom` is deliberately NOT here, and that is a decision. The Custom tier is
 * a bespoke arrangement assembled from its own `vendor_custom_*` line items;
 * stamping `tier_state = 'custom'` from a dropdown would leave a vendor on a
 * plan whose contents nobody configured. `PROMOTABLE_VENDOR_TIERS` excludes it
 * for the same reason. It is set through the custom-plan surface, not here.
 */
export const VENDOR_TIER_SETTABLE = ['free', 'verified', 'solo', 'pro', 'enterprise'] as const;
export type SettableVendorTier = (typeof VENDOR_TIER_SETTABLE)[number];

// Video calls REMOVED 2026-06-09 (owner). ChatLevel is text-only now — no
// 'chat_video'; Enterprise chat == Pro/Verified. The 2026-05-16 "video
// meetings retired" lock stands.
export type ChatLevel = 'none' | 'chat';
export type SchedulingMode = 'manual' | 'hybrid';
/**
 * hidden = ✗ (no marketplace presence) · screen = anonymized screen name · true = real business name day-1 ·
 * verified = the real business name ONCE THE SHOP IS VERIFIED (`vendor_profiles.verification_state = 'verified'`).
 *
 * `verified` is the Free plan's mode (owner 2026-10-23). The tier alone never reveals a Free shop — an unverified
 * shop stays a placeholder on surfaces whose query is not verification-gated — and the reveal comes from
 * `is_verified` at `resolveVendorDisplayName`, which already shows a verified Free shop's real name day-1. So
 * `isTrueNameTier()` stays `false` for it, by construction (it asks `=== 'true'`).
 */
export type NameMode = 'hidden' | 'screen' | 'true' | 'verified';
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

/*
 * ════════════════════════════════════════════════════════════════════════════
 * ⚖ PLANS PRICE REACH, NEVER INCOME — owner 2026-10-23 (DECISION_LOG), verbatim:
 *   "their price differences is based on their type of business reach and not
 *    their capability to maximize the app features that return us income. We
 *    want everybody to be able to give us booking fee. let them create at least
 *    3 per category."
 *
 * Every plan earns Setnayan the same way — the booking fee — so nothing that
 * leads to a booking is rationed by plan any more:
 *   · bookings a day      — NO plan limit. The supplier's own daily-capacity
 *                           setting governs (`vendor_schedule_pools.
 *                           daily_booking_capacity`, DEFAULT 1, CHECK 1..50, and
 *                           the per-card `vendor_services.daily_capacity`).
 *   · answering couples   — NO weekly limit, on any plan, Free included.
 *   · service cards       — at least {@link MIN_SERVICES_PER_LEAF} per category on every plan.
 *   · couples per date    — {@link WHITELIST_PER_DATE_ALL_PLANS} on every plan (the SQL
 *                           twin is `vendor_tier_limit(…,'whitelist_per_date')`).
 *   · portfolio photos    — {@link PORTFOLIO_FREE_BASE} free on every plan; more is
 *                           paid with Papic credits (Phase 2 — until then, blocked
 *                           with {@link PORTFOLIO_OVER_BASE_MESSAGE}).
 * What a plan still buys is REACH: service area, categories, team seats, SEO
 * level, own web address, and the business tools / insights.
 * Held by `plans-price-reach-not-income.test.ts`.
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * The most bookings a day a supplier may set on one calendar — the SQL CHECK on
 * `vendor_schedule_pools.daily_booking_capacity` (1..50). NOT a plan limit: it is the same on every plan, and it is
 * the only ceiling on the supplier's own daily-capacity setting (owner 2026-10-23).
 */
export const DAILY_CAPACITY_MAX = 50;

/** Service cards every plan may put up per category, at the least (owner 2026-10-23: "at least 3 per category"). */
export const MIN_SERVICES_PER_LEAF = 3;

/** Couples a shop may hold for one date — the same on every plan (owner 2026-10-23). */
export const WHITELIST_PER_DATE_ALL_PLANS = 5;

/**
 * The FREE portfolio base — every shop, every plan (owner 2026-10-23: "free 50"). Photos beyond it are paid with
 * Papic credits (Phase 2, after the owner approves that prototype); until then an upload past it is refused with
 * {@link PORTFOLIO_OVER_BASE_MESSAGE}. A shop already holding more keeps every photo — the check counts NEW photos
 * only (see `capPortfolioRefs`).
 */
export const PORTFOLIO_FREE_BASE = 50;

/** What a supplier reads when a new photo would go past the free base. Words fixed by the owner's ruling. */
export const PORTFOLIO_OVER_BASE_MESSAGE = `Your first ${PORTFOLIO_FREE_BASE} portfolio photos are free. More photos with Papic credits is coming soon.`;

/**
 * Keep a requested portfolio list inside the free base — GRANDFATHERED. Pure.
 *
 * `requested` is the list the supplier is saving (already validated + deduped), `stored` the list on the row now.
 * Every photo already stored is kept, however many there are; a NEW photo is admitted only while the total stays
 * within `max`. So a shop that held 80 photos before the base existed can re-save, reorder or remove freely, and
 * only an ADDITION past the base is refused. `refused` counts the new photos that did not fit (order preserved).
 */
export function capPortfolioRefs(
  requested: readonly string[],
  stored: readonly string[],
  max: number = PORTFOLIO_FREE_BASE,
): { refs: string[]; refused: number } {
  const had = new Set(stored.filter(Boolean));
  const keptCount = requested.filter((r) => had.has(r)).length;
  let room = Math.max(0, max - keptCount);
  const refs: string[] = [];
  let refused = 0;
  for (const r of requested) {
    if (had.has(r)) refs.push(r);
    else if (room > 0) {
      refs.push(r);
      room -= 1;
    } else refused += 1;
  }
  return { refs, refused };
}

export interface TierCaps {
  /** Service/distance coverage radius. Infinity = unlimited, 0 = ✗. */
  serviceRadiusKm: number;
  /**
   * Number of distinct SERVICE LISTINGS a vendor may create per leaf category
   * (owner 2026-06-07: the "Creating Package" matrix row = service listings per
   * leaf). Infinity = unlimited.
   */
  servicesPerLeaf: number;
  /** Chat capability. 'chat' = text, on EVERY plan (Free included since 2026-10-23); 'none' is no longer used. Video removed 2026-06-09. */
  chat: ChatLevel;
  /** Distinct parent (of the 10) categories the vendor may list under. Infinity = unlimited. */
  parentCategories: number;
  /** Agent (sub) seats beyond the main holder. Infinity = unlimited, 0 = none. */
  agentAccounts: number;
  scheduling: SchedulingMode;
  /** Appears in marketplace search — every plan once verified (owner 2026-10-23). The queries gate on `verification_state`, never on tier. */
  marketplaceSearchable: boolean;
  nameMode: NameMode;
  /**
   * Bookable slots/day as a PLAN limit — `Infinity` on every plan since 2026-10-23 (no plan limit). The supplier's
   * own daily-capacity setting is what governs; the database's CHECK (1..50) is the only ceiling on that setting.
   */
  slotsPerDay: number;
  /** Slots are time-bounded (am/pm split → effective slots double). */
  slotsTimeBounded: boolean;
  /** In-app customer inquiries the vendor may answer per rolling week — `Infinity` on every plan (owner 2026-10-23; the inbox has been ungated since 2026-07-24). */
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
  /** Portfolio photo cap — {@link PORTFOLIO_FREE_BASE} on every plan (the free base, owner 2026-10-23). */
  portfolioPhotos: number;
  /**
   * BACK-CATALOGUE photos the shop may put into the couple-facing moodboard
   * supplier gallery (MB11), PER CATEGORY (MB19) — the field used to be named
   * `galleryBackCatalogPhotos` and counted ACCOUNT-WIDE, which was a lie
   * nothing went red over: the number in this field means "photos per
   * category", so the name says so. A SECOND, SMALLER ladder that sits
   * ALONGSIDE `portfolioPhotos` and never replaces it — the two answer
   * different questions and the owner sized them separately:
   *
   *   · `portfolioPhotos` = how much of your shop YOUR OWN page may show.
   *   · `galleryBackCatalogPhotosPerCategory` = how much of your archive, IN
   *     EACH inspiration category, we push into OTHER people's inspiration
   *     boards. A shop holding 20 Flowers photos may still upload to Tables.
   *
   * Only BACK-CATALOGUE counts — a photo delivered on a celebration the shop
   * was actually booked for (`moodboard_library_assets.source_event_id IS NOT
   * NULL`) is never rationed, at any tier or category.
   *
   * 🔑 OWNER DECISION 2026-09-04: back-catalogue uploads are OPEN TO EVERY
   * TIER, free included, capped at 20 per vendor PER CATEGORY they cover —
   * "all their previous work can be uploaded to us, until we have enough data
   * of our own." This retires the earlier PRO 20 / ENTERPRISE 100
   * account-wide ladder (MB11 brief, 2026-09-03) — free/verified/solo used to
   * read 0 here and could not back-catalogue at all.
   *
   * Enforced as a check on NEW INSERTS only (see the server action), so rows
   * created under a looser ladder are grandfathered by construction and no
   * rescue migration is ever needed.
   */
  galleryBackCatalogPhotosPerCategory: number;
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
  /**
   * 🔒 TRUE FOR EVERY TIER, PERMANENTLY — owner ruling, re-confirmed 2026-08-09:
   * reviews are **never** ranked, hidden or unlocked by what a vendor pays.
   *
   * These two flags used to gate reviews by tier: a Free shop showed no star
   * average and no review list at all, and Free + Verified hid every written
   * review body. The public tier table even advertised "Full written reviews
   * shown" as a paid perk, and a Free vendor's page told couples "Reviews
   * unlock when this vendor upgrades their Setnayan plan."
   *
   * That is a paid vendor's reputation looking better than an unpaid one's for
   * money rather than merit — the exact thing the merit-first ranking lock
   * exists to prevent. Settled while **production held ZERO reviews and two
   * vendors** (checked, 2026-08-09), so nothing a couple ever saw changes. It
   * would have been expensive to undo after the first real review.
   *
   * The fields are kept rather than deleted so the shape stays stable for the
   * tier matrix and so `reviews-are-never-tiered.test.ts` has something to pin.
   * If you are about to set either to `false`, you are reversing an owner lock.
   */
  reviewStarsCounted: boolean;
  /** See above — never tiered. */
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
  /**
   * WHITELIST — how many ACCEPTED-BUT-NOT-YET-LOCKED customers the vendor may
   * hold for ONE date (owner 2026-08-09). Their live pipeline for that day:
   * couples they have answered and are still pursuing, before anyone locks in.
   * Informational demand, never a hold on the date
   * (Service_Schedule_and_Quotation_Flow_2026-06-02 § T1.1).
   *
   * ⚠ NOT the `whitelist` calendar DAY STATE (a vendor-set "approve-first" day).
   * Same word, different feature; the day state is not capped.
   */
  whitelistPerDate: number;
  /**
   * WAITLIST — how many queued couples the vendor may ACCEPT off the waitlist
   * for one taken date (owner 2026-08-09). `0` = the plan has no waitlist at
   * all, and `waitlist_enabled` is forced off for it.
   * Supersedes the flat per-vendor 1..3 setting.
   */
  waitlistAcceptances: number;
}

export const TIER_CAPS: Record<VendorTier, TierCaps> = {
  free: {
    calls: false,
    whitelistPerDate: WHITELIST_PER_DATE_ALL_PLANS, // 2026-10-23 — same on every plan (was 1)
    waitlistAcceptances: 0, // FREE: no waitlist (owner 2026-08-09)
    serviceRadiusKm: 0,
    servicesPerLeaf: MIN_SERVICES_PER_LEAF, // 2026-10-23 — "at least 3 per category" (was 2)
    chat: 'chat', // 2026-10-23 — every plan answers couples (the inbox was ungated 2026-07-24)
    parentCategories: 1,
    agentAccounts: 0,
    scheduling: 'manual',
    marketplaceSearchable: true, // once verified — the queries gate on verification_state (2026-10-23)
    nameMode: 'verified', // real name once verified (2026-10-23) — see NameMode
    slotsPerDay: Infinity, // no plan limit — the supplier's own daily capacity governs (2026-10-23)
    slotsTimeBounded: false,
    inAppCustomersPerWeek: Infinity, // no weekly limit (2026-10-23)
    inAppGated: false,
    importCustomerTokenCost: 0,
    portfolioPhotos: PORTFOLIO_FREE_BASE, // the free base (2026-10-23; was 30)
    galleryBackCatalogPhotosPerCategory: 20, // MB19 — per category, every tier; event-linked is never counted
    marketIntel: false,
    theftWatch: false,
    performanceTrends: false,
    performanceAdvanced: false,
    soloBusinessTools: false,
    editorialTagged: true, // always free (Simplicity Canon rule 2 · 2026-07-16)
    editorialFeatures: false, // proactive editorial featuring — Pro+ (§ 1 GROW)
    seoLevel: 'basic', // basic indexability is free for all (§ 8)
    reviewStarsCounted: true,
    reviewCommentsViewable: true,
    website: 'basic',
    customWebsiteName: false,
    inquireLink: true,
  },
  // Verified — legacy FREE tier kept for backward compatibility. RETUNED
  // 2026-06-25 (owner-approved) so the ladder is strictly monotonic
  // Free < Verified < Solo: parentCategories 3→1, agentAccounts 1→0, and
  // inAppGated false→true (verified now burns tokens per in-app answer — but
  // still keeps its 10/week cap, enforced in unlock_vendor_event). ⚠ The 10/week
  // cap and the 2-per-category edge are GONE (owner 2026-10-23, "plans price reach,
  // not income"): Solo is better on reach and tools, never on how much a shop may sell.
  verified: {
    calls: false,
    // OWNER 2026-08-29 — verified gets its OWN pair, 2 / 1. It used to clone the
    // FREE numbers (1 / 0) because the 2026-08-09 grid gave four numbers for five
    // tiers and `verified` was the row the build had to invent. Asked directly, the
    // owner answered *"we already had a table for this"* — so the table wins. Both
    // moves WIDEN, and free <= verified <= solo still holds on both keys (solo's
    // waitlist is also 1), which the ladder test asserts.
    whitelistPerDate: WHITELIST_PER_DATE_ALL_PLANS, // 2026-10-23 — same on every plan (was 2)
    waitlistAcceptances: 1,
    serviceRadiusKm: 20,
    servicesPerLeaf: MIN_SERVICES_PER_LEAF, // 2026-10-23 (was 2)
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
    slotsPerDay: Infinity, // no plan limit (2026-10-23; was 1)
    slotsTimeBounded: false,
    inAppCustomersPerWeek: Infinity, // no weekly limit (2026-10-23; was 10)
    inAppGated: true,
    importCustomerTokenCost: 0,
    portfolioPhotos: PORTFOLIO_FREE_BASE,
    galleryBackCatalogPhotosPerCategory: 20, // MB19 — per category, every tier; event-linked is never counted
    editorialTagged: true, // always free (Simplicity Canon rule 2 · 2026-07-16)
    editorialFeatures: false, // proactive editorial featuring — Pro+ (§ 1 GROW)
    seoLevel: 'basic', // basic indexability is free for all (§ 8)
    reviewStarsCounted: true,
    reviewCommentsViewable: true,
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
    whitelistPerDate: WHITELIST_PER_DATE_ALL_PLANS, // 2026-10-23 (was 3)
    waitlistAcceptances: 1, // owner 2026-08-09
    serviceRadiusKm: 30, // owner 2026-10-23: Solo reaches 30 km (was 20) — Free·Verified 20 · Pro 50 · Ultra 100
    servicesPerLeaf: MIN_SERVICES_PER_LEAF,
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
    slotsPerDay: Infinity, // no plan limit (2026-10-23; was 1)
    slotsTimeBounded: false,
    inAppCustomersPerWeek: Infinity,
    inAppGated: true,
    importCustomerTokenCost: 0,
    portfolioPhotos: PORTFOLIO_FREE_BASE,
    galleryBackCatalogPhotosPerCategory: 20, // MB19 — per category, every tier; event-linked is never counted
    editorialTagged: true, // always free (Simplicity Canon rule 2 · 2026-07-16)
    editorialFeatures: false, // proactive editorial featuring — Pro+ (§ 1 GROW)
    // Solo buys ENHANCED SEO + GEO (§ 8): local/entity structured data on top of
    // the free basic indexability. AEO stays Pro+.
    seoLevel: 'enhanced',
    reviewStarsCounted: true,
    reviewCommentsViewable: true,
    website: 'custom',
    customWebsiteName: false,
    inquireLink: true,
  },
  pro: {
    calls: true,
    whitelistPerDate: WHITELIST_PER_DATE_ALL_PLANS,
    waitlistAcceptances: 3, // owner 2026-08-09
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
    slotsPerDay: Infinity, // no plan limit (2026-10-23; was 3)
    slotsTimeBounded: true,
    inAppCustomersPerWeek: Infinity,
    inAppGated: true,
    importCustomerTokenCost: 0,
    portfolioPhotos: PORTFOLIO_FREE_BASE, // the free base (2026-10-23; was 100) — more via Papic credits, Phase 2
    galleryBackCatalogPhotosPerCategory: 20, // MB19 — per category, every tier; event-linked is never counted
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
    whitelistPerDate: WHITELIST_PER_DATE_ALL_PLANS, // 2026-10-23 (was 10)
    waitlistAcceptances: 5, // owner 2026-08-09
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
    slotsPerDay: Infinity, // no plan limit (2026-10-23; was 8)
    slotsTimeBounded: true,
    inAppCustomersPerWeek: Infinity,
    inAppGated: true,
    importCustomerTokenCost: 0,
    portfolioPhotos: PORTFOLIO_FREE_BASE, // the free base (2026-10-23; was 300)
    galleryBackCatalogPhotosPerCategory: 20, // MB19 — per category, every tier; event-linked is never counted
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
    whitelistPerDate: WHITELIST_PER_DATE_ALL_PLANS, // 2026-10-23 (was 10) — runs as Enterprise
    waitlistAcceptances: 5, // runs as Enterprise (keep in lockstep on any Enterprise edit)
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
    slotsPerDay: Infinity, // no plan limit (2026-10-23; was 8)
    slotsTimeBounded: true,
    inAppCustomersPerWeek: Infinity,
    inAppGated: true,
    importCustomerTokenCost: 0,
    portfolioPhotos: PORTFOLIO_FREE_BASE, // the free base (2026-10-23; was 300)
    galleryBackCatalogPhotosPerCategory: 20, // MB19 — per category, every tier; event-linked is never counted
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
  // ⚖ The plan a person sees is "Ultra" (owner 2026-10-23: plan names are Solo · Pro · Ultra). The internal key
  // `enterprise` and every SKU id stay unchanged — only the words move. `no-enterprise-plan-name.test.ts` holds it.
  enterprise: 'Ultra',
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

/**
 * The allowance the LOWEST plan that includes a counted feature gives — e.g.
 * the first tier with any team seats, or any waitlist places. Read from the
 * table above, never typed in, so it follows every owner edit to the ladder.
 * Used by `vendorAllowance()` (lib/vendor-feature-gate.ts) while the plan
 * paywall is switched off. 0 only if no plan includes the feature at all.
 */
export function entryTierAllowance(key: 'agentAccounts' | 'waitlistAcceptances'): number {
  const ladder = [...VENDOR_TIERS].sort((a, b) => TIER_RANK[a] - TIER_RANK[b]);
  for (const t of ladder) {
    const v = TIER_CAPS[t][key];
    if (v > 0) return v;
  }
  return 0;
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

/** Can this tier receive/answer in-app inquiries at all? Every plan can (owner 2026-10-23). */
export function canAcceptInAppInquiries(tier: string | null | undefined): boolean {
  return tierCaps(tier).inAppCustomersPerWeek > 0;
}

/**
 * EXACT TIME SLOTS ARE ON EVERY PLAN (owner 2026-10-14, DECISION_LOG 🧑‍🤝‍🧑 call 3: *"Time slots open to all plans
 * (were Enterprise-only)"*, kept by ✅ "APPROVE"). Until then only Enterprise could plot named time windows; every
 * plan may now — Free included. The function stays so every caller keeps one place to ask; there is no SQL tier gate
 * on slots and none is added. `time-slots-are-on-every-plan.test.ts` holds it.
 */
export function canPlotTimeSlots(_tier: string | null | undefined): boolean {
  return true;
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
 * WHITELIST cap — accepted-but-not-yet-locked customers the vendor may hold for
 * ONE date. {@link WHITELIST_PER_DATE_ALL_PLANS} on every plan (owner 2026-10-23; was
 * Free 1 · Verified 2 · Solo 3 · Pro 5 · Enterprise 10 from 2026-08-09).
 *
 * Enforcement lives in the DATABASE (`enforce_vendor_whitelist_per_date`,
 * migration 20271121655918), because accepting is reachable from the vendor
 * inbox, the admin demo console and any future surface, and a per-date count is
 * racy client-side. This helper exists so a UI can show the number and warn
 * BEFORE the vendor hits the wall — never as the gate itself.
 */
export function vendorWhitelistPerDate(tier: string | null | undefined): number {
  return tierCaps(tier).whitelistPerDate;
}

/**
 * WAITLIST cap — queued couples the vendor may accept for one taken date.
 * Free 0 · Solo 1 · Pro 3 · Enterprise 5 (owner 2026-08-09). `0` means the plan
 * has no waitlist at all.
 */
export function vendorWaitlistAcceptances(tier: string | null | undefined): number {
  return tierCaps(tier).waitlistAcceptances;
}

/** Does this plan include the Booked-Out Waitlist at all? (Free does not.) */
export function canUseWaitlist(tier: string | null | undefined): boolean {
  return vendorWaitlistAcceptances(tier) > 0;
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
