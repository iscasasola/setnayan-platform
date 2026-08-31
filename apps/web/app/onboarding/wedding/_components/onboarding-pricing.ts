/**
 * onboarding-pricing.ts — live-catalog → onboarding view-model.
 *
 * WHY (owner directive 2026-06-08): "our pricing must not be hardcoded but
 * taken from the admin pricing page." The onboarding services screens (15/16)
 * previously read SELLING prices from a hardcoded `SVC` constant in
 * onboarding-shell.tsx. They must instead read the SAME live, admin-managed
 * catalog that /pricing reads:
 *   - platform_retail_catalog_v2  (à-la-carte customer SKUs) · fetchV2CustomerCatalog()
 *   - platform_package_catalog    (the 2 bundles)            · fetchV2BundleCatalog()
 * Admins edit both at /admin/pricing.
 *
 * This module is a small, PURE, server-importable transform: it turns the two
 * live-catalog fetch results into ONE plain-serializable view-model the client
 * shell consumes across the server→client boundary (all fields are plain JSON —
 * numbers + strings + booleans). It carries NO 'use client' / NO 'server-only'
 * so the onboarding server page (page.tsx) can import + call it, then pass the
 * result as a prop.
 *
 * It is intentionally free of any picker/refine imports so the in-flight Dream
 * Team picker restructure never collides with this pricing wiring.
 *
 * Boundary:
 *   - svc[k].set   = Setnayan SELLING price (pesos) FROM the live catalog. The
 *                    customer-charged amount. For a pax-curve SKU this would be
 *                    the floor, used only for aggregate math fallbacks; the
 *                    authoritative charge is recomputed server-side at order
 *                    time by resolvePaxPricedOrderCentavos. NO catalog row is
 *                    pax-priced today (see INAPP_TO_SERVICE_CODE below), so
 *                    every row here is a flat price.
 *   - svc[k].label = display string via formatSkuPriceLabel ("₱X" for flat SKUs,
 *                    "from ₱X" if a pax curve is ever switched back on). What
 *                    the UI renders.
 *   - svc[k].out   = ILLUSTRATIVE market anchor ("if hired elsewhere"). NOT a
 *                    Setnayan price, never customer-charged. No catalog/DB
 *                    column exists for it (no compare_at field on
 *                    platform_retail_catalog_v2), so it stays an author-curated
 *                    constant here (OUT_ANCHORS) — permitted by the directive.
 */
import {
  type V2CustomerSku,
  type V2BundleSku,
  type BuildStatus,
  formatSkuPriceLabel,
} from '@/lib/v2-catalog-pure';

/**
 * The onboarding in-app service keys → their platform_retail_catalog_v2
 * service_code. Single source of truth for the inapp-key ↔ catalog mapping.
 *
 * VERIFIED against live platform_retail_catalog_v2 (is_active=true, 2026-07-29).
 * NOTE the map is keyed by service_code (NOT title): PRO_WEBSITE's live title is
 * "Editorial PRO" (₱2,999) and LIVE_WALL's is "Live Venue Photo Wall" — the
 * code match is exact regardless of display title. NO active row is
 * is_pax_priced today — PAPIC_GUEST was the only one, and the two-type reprice
 * (2026-07-29) made it a FLAT ₱1,000 pool top-up (`is_pax_priced=false`,
 * verified on prod). `high_res` from BUNDLE_ITEMS is NOT an onboarding inapp
 * key (free baseline) and is intentionally absent.
 *
 * ⚠ THE KEY STRINGS ARE STABLE IDENTIFIERS, NOT LABELS. `papic_seats` and
 * `papic_guest` are written into `style_preferences.interested_services` on
 * every draft ever saved, so renaming them would orphan live rows. The
 * two-type model (owner-locked 2026-07-29) changed only what they POINT AT:
 *   papic_seats → Papic ONE  (a dedicated camera · its own QR · unshared shots)
 *   papic_guest → Papic POOL (a shared shot pool · additive top-ups)
 * The old products both died with that lock: PAPIC_SEATS (the ₱2,999 five-seat
 * pack) and the pax-priced "Papic for guests" are `is_active=false`, and an
 * inactive code here renders a BLANK card (price 0 · empty label ·
 * `not_built`) — which is exactly the defect this remap closes.
 */
export const INAPP_TO_SERVICE_CODE: Record<string, string> = {
  // Papic ONE — the dedicated-camera rung. Points to the cheapest live rung
  // (₱50 / 50 shots); the ₱100 rung reloads the same camera from the studio.
  // Was PAPIC_SEATS (₱2,999 · 5 seats), retired + deactivated 2026-07-29.
  papic_seats: 'PAPIC_CAMERA_MINI_DAY',
  // "Advanced Website" = the reactivated Website PRO umbrella (owner 2026-07-22 ·
  // ₱3,500). Was the legacy PRO_WEBSITE code, which is is_active=false (absorbed
  // into COUPLE_WEBSITE_PRO) — so this now sells the live umbrella that also
  // includes the bundle-only Editorial PRO + Cinematic Reveal.
  advanced_website: 'COUPLE_WEBSITE_PRO',
  animated_monogram: 'ANIMATED_MONOGRAM',
  // ⚠ WAS 'PANOOD_SYSTEM', WHICH IS is_active=false IN PRODUCTION (retired
  // 2026-07-26, migration 20271005180040 — Cast folded into the unified SKU).
  // fetchV2CustomerCatalog filters `.eq('is_active', true)`, so the row never
  // came back, the missing-row branch below zeroed the card, and the renderer
  // (`p.label || pesoB(p.set)`) printed **₱0** — a livestream advertised as FREE
  // on the onboarding screen when it costs ₱2,999. Same defect that was fixed on
  // PAPIC_SEATS + PAPIC_GUEST on 2026-07-21; this key was missed.
  // LIVE_STUDIO is the live product (₱3,000, is_active=true). It is name-excluded
  // from the customer catalog only while NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED is
  // off — that flag is ON in production (verified: the row is on /pricing, which
  // is impossible while it is excluded), so this resolves a real price today, and
  // degrades to the honest empty row if the flag is ever turned back off.
  panood: 'LIVE_STUDIO',
  // Papic POOL — the shared shot pool. Same code as before, but the product
  // underneath it changed: it is now a FLAT ₱1,000 top-up that ADDS 3,000
  // shots to whatever the event already holds (repeatable; ₱2,000/6,000 and
  // ₱3,000/10,000 rungs exist too and are bought from the studio). It is no
  // longer the pax-priced "from ₱2,999 for up to N guests" pack.
  papic_guest: 'PAPIC_GUEST',
  pakanta: 'PAKANTA',
  custom_qr: 'CUSTOM_QR_GUEST',
  // indoor_blueprint RETIRED (owner 2026-06-08) — dropped from the catalog + the offered set.
  // live_background RETIRED as an onboarding pick (owner 2026-07-22): Live
  // Background is bundle-only, folded into Monogram PRO (animated_monogram).
  guest_stories: 'PAPIC_ADDON_STORIES',
  thank_you: 'PAPIC_ADDON_THANK_YOU',
  live_photowall: 'LIVE_WALL',
};

/**
 * Illustrative market anchors — what each service would cost if hired
 * SEPARATELY from other providers. NOT a Setnayan price; never customer-charged.
 * Setnayan's selling prices come from the live catalog (svc[k].set). These
 * power the "You save ₱X vs <vendor>" comparison lines only.
 *
 * Lifted verbatim from the old hardcoded SVC table's `out` values — there is no
 * catalog/DB column for a market-anchor / compare-at price, and the owner
 * directive explicitly permits keeping these as a clearly-labeled illustrative
 * constant.
 *
 * ⚠ BOTH PAPIC KEYS ARE DELIBERATELY ABSENT (2026-07-29 · the two-type reprice).
 * They used to carry `papic_seats: 75000` ("vs 5 hired photographers") and
 * `papic_guest: 32000` ("vs 20+ disposable cams + developing") — anchors sized
 * against a ₱2,999 five-seat pack and a pax-priced guest pass. Both products
 * are gone. Against what actually ships now — a ₱50 dedicated camera and a
 * ₱1,000 shot-pool top-up — those same anchors would have claimed "you save
 * ₱74,950" and "you save ₱31,000", i.e. a 1,500× and a 32× bargain, on the
 * onboarding screen where a couple decides what to trust us with.
 *
 * That is the SAME failure the missing-SKU degrade path below was written to
 * stop, arriving from the opposite direction: there a live anchor sat beside a
 * ₱0 price; here it would sit beside a real but tiny one. The rule is the same
 * either way — silence is honest, a fake bargain is not — so the anchors are
 * removed rather than guessed at. `?? 0` yields `out: 0`, the shell renders no
 * compare-at and no savings line, and the price stands on its own.
 *
 * If the owner wants a compare-at on either Papic card, it needs a real,
 * like-for-like PH market figure (one disposable camera, not five hired
 * photographers) — that is a pricing claim to decide, not one to infer here.
 */
export const OUT_ANCHORS: Record<string, number> = {
  advanced_website: 25000,
  guest_stories: 8000,
  animated_monogram: 15500,
  thank_you: 60000,
  pakanta: 12500,
  custom_qr: 5000,
  panood: 17500,
  live_background: 20000,
  live_photowall: 18000,
};

/**
 * Bundle membership — which SKUs each package bundles. Used to compute the
 * bundle "worth" (Σ of member SELLING prices) + the displayed savings + the
 * "what's included" list. There is NO platform_package_items table, so this is
 * AUTHOR-CURATED. Keyed by catalog SERVICE_CODE (NOT the onboarding INAPP keys) —
 * a bundle can contain ANY catalog SKU, incl. ones with no standalone onboarding
 * card (Setnayan AI, Pro RSVP, Event Website). Worth + titles are looked up at
 * runtime from the full live customer catalog.
 *
 * Owner-decided 2026-06-08: bundles are ONBOARDING-ONLY (bought only during the
 * flow). `essentials` = the owner's 7 (Setnayan AI · Animated Monogram · Custom
 * QR · Pro RSVP · Papic Guest · Event Website · Editorial Website). `complete` =
 * the canonical paid catalog (FIXED list — NOT "all active", so the worth is
 * controlled + doesn't drift when SKUs are added). NOTE: the live catalog now
 * also has RSVP_WEBSITE + RSVP_PRO_WEBSITE (added out-of-band) — deliberately
 * EXCLUDED here pending owner confirm (flagged in the PR).
 */
export const BUNDLE_MEMBERS: { essentials: string[]; complete: string[] } = {
  // Essentials — the owner's 7 (2026-06-08).
  essentials: [
    'SETNAYAN_AI',
    'ANIMATED_MONOGRAM',
    'CUSTOM_QR_GUEST',
    'PRO_RSVP',
    'PAPIC_GUEST',
    'EVENT_WEBSITE',
    'PRO_WEBSITE', // = "Editorial Website"
  ],
  // Complete — the canonical paid SKUs.
  complete: [
    'SETNAYAN_AI',
    'ANIMATED_MONOGRAM',
    'CUSTOM_QR_GUEST',
    'PRO_RSVP',
    'EVENT_WEBSITE',
    'PRO_WEBSITE',
    'PAPIC_GUEST',
    'PAPIC_ADDON_STORIES', // Guest Stories
    // PAPIC_SEATS is permanently is_active=false (retired 2026-07-29 by the
    // two-type lock) → absent from fetchV2CustomerCatalog → contributes 0 to
    // `worth` and drops out of the "what's included" list. Left listed for
    // lineage, same convention as /pricing's retired-code comments. Both
    // bundles are themselves deactivated (2026-06-29), so bundleVM returns null.
    'PAPIC_SEATS',
    'CAMERA_BRIDGE',
    // PABATI is GONE, not merely retired — the Pabati video guestbook was
    // removed from the product 2026-08-21 (owner: "we do not need pabati.
    // retire it because it is part of papic"). Same treatment LIVE_BACKGROUND
    // gets below: a bundle cannot include a thing that no longer exists, and
    // the membership guard requires this list to match the code + SQL mirrors.
    'PAPIC_ADDON_THANK_YOU', // Thank You
    'LIVE_WALL', // PhotoWall
    // LIVE_BACKGROUND is GONE, not merely retired — the LED wall backdrop was
    // removed from the product 2026-08-11. The "left listed for lineage"
    // convention above applies to SKUs that still EXIST but are off sale; a
    // bundle cannot include a thing that no longer exists at all, and the
    // membership guard requires this list to match the code + SQL mirrors.
    'PANOOD_SYSTEM',
    'PAKANTA',
  ],
};

/** Per-service onboarding price view-model (one row per inapp key). */
export type OnboardingSvcPrice = {
  /** Setnayan selling price in pesos, from the live catalog. Pax SKU → floor. */
  set: number;
  /** Illustrative "if hired elsewhere" market anchor. NOT a Setnayan price.
   *  0 = no anchor (both Papic keys — see OUT_ANCHORS). */
  out: number;
  /** Display string via formatSkuPriceLabel — "₱X", or "from ₱X" for a pax SKU. */
  label: string;
  /** False for every live SKU today (PAPIC_GUEST went flat 2026-07-29). */
  isPax: boolean;
  /** Live build status from the catalog reader. */
  buildStatus: BuildStatus;
};

/** Bundle view-model. price+title from platform_package_catalog. */
export type OnboardingBundleVM = {
  code: string;
  title: string;
  price: number;
  /** Σ member SELLING prices (pesos). */
  worth: number;
  /** max(0, worth − price). */
  savings: number;
  /** Member SKU display titles, in BUNDLE_MEMBERS order (for the "what's included" list). */
  items: string[];
};

/** The full onboarding pricing view-model passed into OnboardingShell. */
export type OnboardingPricing = {
  /** Keyed by ONBOARDING inapp key (papic_seats…), NOT service_code. */
  svc: Record<string, OnboardingSvcPrice>;
  bundles: {
    essentials: OnboardingBundleVM | null;
    complete: OnboardingBundleVM | null;
  };
  /** Setnayan AI (the planner / first paywall) — read straight from the catalog
   *  by service_code, since it isn't one of the onboarding "pick" keys. Null when
   *  the row is missing/inactive. Powers the "Your Plan" keep-card. */
  setnayanAi: { price: number; label: string } | null;
  /** Onboarding promo fraction (business rule, not a catalog value). */
  promo: number;
};

/** Onboarding promo — 20% off any in-app add-on added during onboarding. */
const ONBOARDING_PROMO = 0.2;

/**
 * Build the onboarding pricing view-model from the two live-catalog fetch
 * results. The single builder page.tsx calls.
 *
 * @param customer V2 customer SKUs (fetchV2CustomerCatalog()).
 * @param bundles  V2 package SKUs (fetchV2BundleCatalog()).
 * @param pax      estimated guest count, or null/undefined. Onboarding has NO
 *                 committed event at render time (the event row is lazily
 *                 created only at the final commit button), so this is
 *                 normally undefined. NO live SKU is pax-priced since the
 *                 2026-07-29 two-type reprice, so every label is a flat "₱X"
 *                 regardless — matching /pricing's public behavior. The
 *                 parameter is kept because the pax engine itself is not
 *                 retired (lib/v2-catalog.ts), and the authoritative charge is
 *                 still recomputed server-side at order time by
 *                 resolvePaxPricedOrderCentavos.
 */
export function buildOnboardingPricing(
  customer: V2CustomerSku[],
  bundles: V2BundleSku[],
  pax?: number | null,
): OnboardingPricing {
  // Index by service_code — never rely on array order. fetchV2CustomerCatalog
  // returns ALL non-TODAYS_FOCUS rows (incl. SETNAYAN_AI, PRO_RSVP, etc.); we
  // pick only the 14 onboarding keys.
  const byCode = new Map<string, V2CustomerSku>();
  for (const sku of customer) byCode.set(sku.service_code, sku);

  const svc: Record<string, OnboardingSvcPrice> = {};
  for (const [inappKey, serviceCode] of Object.entries(INAPP_TO_SERVICE_CODE)) {
    const sku = byCode.get(serviceCode);
    if (!sku) {
      // Catalog read failure / missing row / INACTIVE SKU → degrade to an empty
      // row rather than crashing.
      //
      // ⚠ `out` is zeroed here too, and that is the whole point. It previously
      // kept OUT_ANCHORS while `set` fell to 0, so a retired or deactivated SKU
      // rendered as FREE *and* credited its full compare-at saving. With
      // PAPIC_SEATS and PAPIC_GUEST both inactive that was ₱107,000 of
      // "savings" on two products the couple cannot buy at any price — the
      // single most expensive false claim on the onboarding surface.
      // A ₱0 price beside a ₱75,000 anchor is the worst possible pairing:
      // silence is honest, a fake bargain is not. (Fixed 2026-07-21 · wave 0 of
      // Papic_Website_Strategy_Council_Verdict_2026-07-20.md § 2.)
      //
      // 2026-07-29: both Papic keys now point at LIVE rows again (see
      // INAPP_TO_SERVICE_CODE), so they no longer take this branch — and their
      // anchors were removed outright, so neither can re-grow a fake bargain
      // from the other direction either.
      svc[inappKey] = {
        set: 0,
        out: 0,
        label: '',
        isPax: false,
        buildStatus: 'not_built',
      };
      continue;
    }
    svc[inappKey] = {
      // For the pax SKU, `set` stores the FLOOR pesos (used only as an
      // aggregate-math fallback in the onboarding estimate). `label` is the
      // display string — pax-correct ("from ₱X").
      set: sku.retail_price_php,
      out: OUT_ANCHORS[inappKey] ?? 0,
      label: formatSkuPriceLabel(sku, pax ?? null),
      isPax: sku.is_pax_priced,
      buildStatus: sku.build_status,
    };
  }

  // Bundle members are catalog SERVICE_CODES — resolve worth + titles from the
  // FULL live customer catalog (byCode), not the onboarding INAPP subset, so a
  // bundle can include SKUs with no standalone onboarding card (Setnayan AI etc.).
  const bundleVM = (
    code: string,
    members: string[],
  ): OnboardingBundleVM | null => {
    const pkg = bundles.find((b) => b.package_code === code);
    if (!pkg) return null;
    const rows = members.map((sc) => byCode.get(sc)).filter((s): s is V2CustomerSku => !!s);
    const worth = rows.reduce((s, sku) => s + sku.retail_price_php, 0);
    return {
      code: pkg.package_code,
      title: pkg.title,
      price: pkg.retail_price_php,
      worth,
      savings: Math.max(0, worth - pkg.retail_price_php),
      items: rows.map((sku) => sku.title),
    };
  };

  // Setnayan AI price straight from the live catalog (it's not an onboarding
  // "pick" key, so it isn't in `svc`). Null when missing/inactive → the keep-card
  // falls back to its own copy without crashing.
  const aiSku = byCode.get('SETNAYAN_AI');
  const setnayanAi = aiSku
    ? { price: aiSku.retail_price_php, label: formatSkuPriceLabel(aiSku, null) }
    : null;

  return {
    svc,
    bundles: {
      essentials: bundleVM('GUIDED_PACK', BUNDLE_MEMBERS.essentials),
      complete: bundleVM('MEDIA_PACK', BUNDLE_MEMBERS.complete),
    },
    setnayanAi,
    promo: ONBOARDING_PROMO,
  };
}
