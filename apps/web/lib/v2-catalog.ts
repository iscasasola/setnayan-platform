/**
 * V2 catalog reader · single source of truth for the live pricing surfaces.
 *
 * Reads from the 3 V2 catalog tables in setnayan-prod and exposes typed
 * shapes to server components. Replaces the V1 sku-catalog.ts TypeScript
 * mirror (which carries retired SKUs and 5% Setnayan Pay language).
 *
 * Tables:
 *   platform_retail_catalog_v2  · 19 customer SKUs
 *   platform_package_catalog    · 2 bundles (Guided Pack + Media Pack)
 *   vendor_billing_catalog      · 7 vendor SKUs (2 subs + 5 token packs)
 *
 * Build status is hardcoded here (not in DB) so we can be honest about
 * what works vs what's coming. Items marked NOT_BUILT render with a
 * "Coming soon" badge instead of a buy button. Aligned to the audit
 * shared with owner 2026-05-28.
 *
 * Per owner directive: Setnayan takes ZERO commission · vendor bookings
 * are transacted off-platform · customers buy software SKUs at 100%
 * retail directly from Setnayan as publisher.
 */

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  CatalogChargeResolution as CatalogChargeResolutionType,
  BundleChargeResolution as BundleChargeResolutionType,
} from '@/lib/order-charge-math';
import {
  VENDOR_3D_PLAN_UNLOCK_SERVICE_KEY,
  applyVendor3dPlanUnlockDiscountCentavos,
  eventVendor3dPlanUnlockDiscountActive,
} from '@/lib/vendor-3d-plan-unlock';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { resolveLivePax } from '@/lib/pax';
import {
  computePaxPriceCentavos,
  formatBillingPeriodSuffix,
  formatPeso,
  type BillingPeriod,
  type BuildStatus,
  type PaxPricingConfig,
  type V2BundleSku,
  type V2CustomerSku,
  type V2VendorSku,
} from '@/lib/v2-catalog-pure';

/**
 * ⚠ THE ROW SHAPES AND THE PRICE ARITHMETIC ARE NOT IN THIS FILE — they are in
 * `./v2-catalog-pure`, because every reader below goes through
 * `createAdminClient`, while the onboarding price copy that formats a label
 * from an already-fetched row is reachable from a `'use client'` component.
 * Re-exported here, so `@/lib/v2-catalog` still resolves every symbol it always
 * did.
 */
export * from '@/lib/v2-catalog-pure';


/**
 * Hardcoded build status per SKU. Honest about what's actually wired
 * end-to-end vs catalog-only-with-no-fulfillment. Update as features
 * ship.
 *
 * Source: feature audit shared with owner 2026-05-28.
 */
const BUILD_STATUS: Record<string, BuildStatus> = {
  // Live and working today
  // (TODAYS_FOCUS removed 2026-06-05 — the AI-planner SKU is retired; the
  //  reader also filters its catalog row out via `.neq('service_code', …)`.)
  PRO_WEBSITE:         'partial',  // = Editorial Website (post-event phase) · free baseline live · Pro gating not built
  // Wedding-website lifecycle phases (owner 2026-06-08 · added to catalog DB):
  // RSVP (before) · Event Website (during) · Editorial = PRO_WEBSITE (after).
  // Same in-build state as the Editorial phase — baseline live, upgrades not built.
  RSVP_WEBSITE:        'partial',  // RSVP phase ₱2,499
  RSVP_PRO_WEBSITE:    'partial',  // RSVP Pro upgrade ₱4,499
  EVENT_WEBSITE:       'partial',  // during-event website ₱1,999
  PRO_RSVP:            'partial',  // the actually-seeded RSVP SKU (migration 20260915000000) · was missing → silently defaulted to not_built
  COUPLE_WEBSITE_PRO:  'live',     // ₱4,999 website unlock (migration 20270103020000 · repriced 20270511151471) · collapses PRO_RSVP/EVENT_WEBSITE/PRO_WEBSITE · the UMBRELLA across STD·RSVP·on-the-day·Editorial · perk: removes "Powered by Setnayan" watermark from site+recap+editorial when active (lib/couple-website-pro.ts) · 2026-06-22
  EDITORIAL_PRO:       'live',     // ₱3,499 à-la-carte editorial-authoring SKU (migration 20270511151471 · owner 2026-07-04) · marked live 2026-07-10 (owner "all features active")
  SETNAYAN_AI:         'live',     // the planner / first paywall · catalog SETNAYAN_AI ₱499/28d subscription · gate lib/setnayan-ai.ts
  CUSTOM_QR_GUEST:     'live',     // branded per-guest QR (monogram + palette + print) · PR #727 · 2026-06-01
  INDOOR_BLUEPRINT:    'live',     // entrance→table wayfinding end-to-end: couple studio + guest find-my-table · migration 20260717000000 · 2026-06-02

  // Partially working
  ANIMATED_MONOGRAM:   'live',     // drawn-live monogram bound to the SKU · PR #729 · 2026-06-01
  PANOOD_SYSTEM:       'live',     // = Live Studio — the ONE SKU, ₱2,500/day, unlocks everything (owner 2026-07-21) · marked live 2026-07-10 (owner "all features active") · YouTube verified-app is an external gate tracked separately
  PANOOD_SYSTEM_MOBILE: 'live',    // RETIRED 2026-07-21 — never purchasable (no buy surface, zero orders); catalog row deactivated. Kept here so any historical holder still resolves. (owner-locked 2026-07-08 · migration 20270526326110) · marked live 2026-07-10
  LIVE_STUDIO_ROAM:    'partial',  // = Live Studio Roam ₱3,500/day (owner 2026-07-23). RETIRED into LIVE_STUDIO 2026-07-25 (is_active=false, migration 20271001110000). Kept for historical order rows.
  LIVE_STUDIO:         'partial',  // = UNIFIED Live Studio ₱2,999/event (owner 2026-07-25) — merges Cast (PANOOD_SYSTEM) + Roam (LIVE_STUDIO_ROAM) into one switching controller. Built on the Roam substrate; controller (Main Stage cut) + unified viewer shipped flag-dark behind NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED. Excluded from /pricing by name until launch. YouTube broadcast orchestration still pending G1. Bump to 'live' at launch. · migration 20271001110000
  PATIKTOK_COMPILER:   'live',     // ₱1,499/day booth · marked live 2026-07-10 (owner "all features active") · TikTok app review tracked separately
  PAPIC_GUEST:         'live',     // guest camera end-to-end: cookie identity + server quota (150) + capture · 2026-06-02
  PAPIC_SEATS:         'live',     // photo crew end-to-end: provision + claim + capture · PR #731 + migration 20260718000000 · 2026-06-01
  PAPIC_CAMERA_ROLL_DAY:      'live', // per-camera legacy Roll rate (Mini economics) · capacity = papic_tier_config.points_per_day, NOT a fixed photo/clip count · #2246 · 2026-06-26
  PAPIC_CAMERA_UNLIMITED_DAY: 'live', // per-camera Unli (Unlimited) rate · unlimited points/day · #2246 · 2026-06-26
  HIGH_RES_ARCHIVE:    'partial',  // 0009 photo delivery partial
  LIVE_BACKGROUND:     'not_built', // REMOVED 2026-08-11 (owner: "remove wall backdrop"). Was marked 'live' on 2026-07-10 under "all features active" — it never was: the maker saved a draft and nothing rendered the 8K file or posted the USB it promised. Route, save endpoint, templates and both tables deleted (migration 20271132121622). Kept listed so the retirement is legible and any historical order row still resolves a status.
  PABATI:              'live',     // video guestbook end-to-end: gated day-of card + 5s guest recorder + recap section · collector exists · 2026-06-22
  KWENTO:              'live',     // words-on-a-photo · FREE for every event (owner 2026-08-21 "kwento is free"; row deactivated by 20271156242842, feature kept on via FREE_FOR_ALL_SKUS) · was paid-to-unlock ₱299 from 2026-06-26 · ⚠ the old comment here said ₱500, which the catalog never charged

  PAKANTA:               'live',       // custom-song delivery end-to-end: intake + admin upload → auto-plays on the couple's site (PR #2038) · 2026-06-22
  // Activated 2026-07-10 (owner "all our features should now be active" · migration
  // 20270710619774 flips SEATING_3D/STORIES/THANK_YOU is_active=true). These read
  // Live; CAMERA BRIDGE alone is still HELD as 'partial' ("In build") because it
  // genuinely needs native iOS/Android + a DSLR SDK (owner-confirmed hold).
  //
  // ⚠ UPDATED 2026-08-11 — this sentence used to name Live Wall in that hold and
  // STORIES among the activated. Both moved: Live Wall is 'live' (it was built all
  // along), and STORIES is retired off sale (it sold nothing). A block that records
  // one state at the top and contradicts it four lines down gets read from
  // whichever line you land on, so it is corrected here and at each row.
  SEATING_3D:            'live',     // ₱2,499 · 3D reception + seating walk · public 3D walk shipped (Fable slices)
  // RETIRED 2026-08-11 — is_active=false (migration below). The ₱2,000 add-on
  // bought NOTHING: the story maker is owner-locked FREE and lib/guest-stories.ts
  // has no entitlement gate ("FREE TIER — no entitlement gate, no price; nothing
  // here charges anything"), so no code anywhere asks whether this was purchased.
  // It was already retired for exactly this reason by migration 20270328922621
  // ("Guest Stories is owner-locked FREE") and reactivated as collateral by the
  // blanket sweep in 20270710619774, which flipped SEATING_3D + THANK_YOU (both
  // real paid products) and swept this one along. Owner re-confirmed off sale
  // 2026-08-11. Zero orders ever, so nothing anyone owns is affected.
  // build_status stays 'live' on purpose — the FEATURE works and is free; it is
  // `is_active` that retires a SKU, and a status label is not a gate (see below).
  PAPIC_ADDON_STORIES:   'live',     // ₱2,000 · 30s guest story maker · RETIRED (free feature, sold nothing)
  PAPIC_ADDON_THANK_YOU: 'live',     // ₱2,499 · compiled thank-you video
  STD_PREMIUM_OPENINGS:  'live',     // ₱1,499 · Save-the-Date Cinematic Reveal openings · buy flow shipped #1705/#1709/#1718
  CAMERA_BRIDGE:         'partial',  // ₱499 (reprice 2026-07-08 · migration 20270711042075) · HELD "In build" — needs native iOS/Android + DSLR SDK
  // 2026-08-11 — 'partial' → 'live'. The hold said "WebSocket display surface not
  // built", and no WebSocket was ever needed: the venue wall ships as a polled
  // surface. Every piece exists — app/wall/[eventId] (projection route),
  // wall-claim.tsx (screen code), wall-projection.tsx, the couple's
  // live-wall-controls.tsx, AND the guest-phone mirror in site-body.tsx. It was
  // selling at ₱2,500, is_active=TRUE, while /pricing chipped it "in active
  // build" — telling a couple the thing they can buy today is unfinished.
  // FREE for every event since 2026-08-11 (owner: "live photo wall FREE"). The
  // paid row is deactivated so nothing quotes ₱2,500, and the feature is switched
  // on for everyone via FREE_FOR_ALL_SKUS in lib/entitlements.ts.
  // 🔑 THE DEACTIVATION ALONE WOULD HAVE MADE IT UNAVAILABLE, NOT FREE — every
  // gate asks whether the event OWNS the SKU, and nobody owns what nobody can
  // buy. Free and retired are identical in the catalog and opposite in the app.
  // build_status stays 'live': it describes whether the thing is BUILT, and a
  // status label is not a gate (see the note further down this map).
  LIVE_WALL:             'live',     // FREE · venue projection + guest-phone mirror, both shipped
  CALL_TIME_ESCALATOR:   'not_built',  // retired SKU (is_active=false) — no SMS infrastructure
  // RETIRED 2026-08-11 — is_active=false (migration 20271128898031). Owner ruled
  // it off sale 2026-08-10: ₱999/year bought an address that resolves NOWHERE
  // (no wildcard DNS, no subdomain-aware routing). Kept listed so the retirement
  // is legible rather than looking like an accidental deletion — same convention
  // as PANOOD_SYSTEM and LIVE_BACKGROUND above, and so any historical order row
  // still resolves a status.
  // 🔑 'partial' HERE WAS NEVER A GATE. It rendered the chip "Partial · in active
  //    build" on /pricing and blocked no buy path — `build_status` is read only
  //    for styling and the onboarding list. `is_active` is the only real switch,
  //    and it stayed TRUE for a month while this label implied otherwise.
  //    A STATUS LABEL IS NOT A GATE.
  EVENT_SUBDOMAIN:       'partial',
};

/**
 * Server-side fetch of all customer SKUs from the V2 catalog.
 * Sorted by display priority · token-worthy items first.
 */
export async function fetchV2CustomerCatalog(): Promise<V2CustomerSku[]> {
  // createAdminClient throws when SUPABASE_SERVICE_ROLE_KEY is unset (CI
  // builds run `next build` with placeholder NEXT_PUBLIC_* env only · no
  // service-role key). Match the documented "return [] on error" semantic
  // below so callers degrade gracefully — the page renders an empty
  // catalog instead of failing the prerender. Defense-in-depth alongside
  // `export const dynamic = 'force-dynamic'` in /pricing/page.tsx.
  // CLAUDE.md 2026-05-28 row "fix endless loop error on vercel".
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  let query = admin
    .from('platform_retail_catalog_v2')
    .select('service_code, title, retail_price_php, onboarding_price_php, saas_overhead_cost_php, is_token_able, description, billing_period, is_pax_priced, pax_floor, pax_floor_price_php, pax_increment_size, pax_increment_price_php')
    // RETIRED SKUs must not surface on /pricing, /vendors, the admin discount
    // picker, or the onboarding bundle — honor the is_active flag (owner 2026-06-08:
    // the only way to retire a customer SKU is is_active=false). Previously this
    // reader IGNORED is_active, so admin retirements had NO effect on the live site.
    .eq('is_active', true)
    // Belt-and-suspenders: the old Today's-Focus / Setnayan-AI-planner SKU stays
    // excluded by name too (it is also is_active=false). See DECISION_LOG 2026-06-05.
    .neq('service_code', 'TODAYS_FOCUS');

  // Live Studio Roam is is_active=TRUE (so its flag-gated buy path works — migration
  // 20270930100000) but must stay OFF /pricing until launch (owner-locked "not on
  // /pricing until launch"). Exclude it by name while the Roam flag is off — the same
  // idiom as the TODAYS_FOCUS name-exclusion above. When the owner flips the flag, Roam
  // appears on /pricing AND the Studio tile lights up together — one launch switch.
  if (!liveStudioRoamEnabled()) {
    query = query
      .neq('service_code', 'LIVE_STUDIO_ROAM')
      // The unified Live Studio SKU (₱2,999 · owner 2026-07-25) is is_active=TRUE so
      // its flag-gated buy path resolves a price, but must stay OFF /pricing until
      // launch — same idiom. When the owner flips the flag, Live Studio appears on
      // /pricing AND the Studio tile lights up together — one launch switch.
      .neq('service_code', 'LIVE_STUDIO');
  }

  const { data, error } = await query.order('service_code', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    service_code: row.service_code as string,
    title: row.title as string,
    retail_price_php: Number(row.retail_price_php),
    // NULL stays NULL — "this service has no sign-up price", never 0. See the
    // field's docblock on V2CustomerSku.
    onboarding_price_php:
      row.onboarding_price_php == null ? null : Number(row.onboarding_price_php),
    saas_overhead_cost_php: Number(row.saas_overhead_cost_php),
    is_token_able: Boolean(row.is_token_able),
    description: (row.description as string | null) ?? null,
    build_status: BUILD_STATUS[row.service_code as string] ?? 'not_built',
    // Coerce to the known union; a stale env without the column → 'one_time'
    // (the column default), so the suffix never renders unexpectedly.
    billing_period: (row.billing_period as BillingPeriod) ?? 'one_time',
    is_pax_priced: Boolean(row.is_pax_priced),
    pax_floor: row.pax_floor == null ? null : Number(row.pax_floor),
    pax_floor_price_php:
      row.pax_floor_price_php == null ? null : Number(row.pax_floor_price_php),
    pax_increment_size:
      row.pax_increment_size == null ? null : Number(row.pax_increment_size),
    pax_increment_price_php:
      row.pax_increment_price_php == null ? null : Number(row.pax_increment_price_php),
  }));
}

export async function fetchV2BundleCatalog(): Promise<V2BundleSku[]> {
  // Same build-time tolerance as fetchV2CustomerCatalog above — see WHY there.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const { data, error } = await admin
    .from('platform_package_catalog')
    .select('package_code, title, retail_price_php')
    // Honor is_active (owner 2026-06-29 "no more essentials and complete"):
    // GUIDED_PACK + MEDIA_PACK are is_active=false, so this reader now returns
    // ZERO bundles. Every consumer (onboarding `bundleVM`, /pricing tier cards
    // + JSON-LD bundle map) finds nothing and renders nothing — defense-in-depth
    // alongside the explicit UI removal in those files. Same is_active semantics
    // as fetchV2CustomerCatalog + resolveBundleChargeCentavos.
    .eq('is_active', true)
    .order('retail_price_php', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    package_code: row.package_code as string,
    title: row.title as string,
    retail_price_php: Number(row.retail_price_php),
  }));
}

export async function fetchV2VendorCatalog(): Promise<V2VendorSku[]> {
  // Same build-time tolerance as fetchV2CustomerCatalog above — see WHY there.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const { data, error } = await admin
    .from('vendor_billing_catalog')
    .select('sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    sku_code: row.sku_code as string,
    title: row.title as string,
    price_php: Number(row.price_php),
    offering_type: row.offering_type as V2VendorSku['offering_type'],
    token_grant_count: (row.token_grant_count as number | null) ?? null,
    max_categories: (row.max_categories as number | null) ?? null,
    max_sub_seats: (row.max_sub_seats as number | null) ?? null,
    display_order: Number(row.display_order ?? 0),
  }));
}

/**
 * Vendor pricing for the marketing pages — DERIVED FROM THE DB so /vendors,
 * /how-it-works etc. never hardcode vendor prices (owner 2026-06-08 "make sure
 * these prices are based on the admin page and not hardcoded"). `cache()` dedupes
 * to a single query per request even if several server components call it. The
 * fallbacks (= current catalog) only ever render if the DB is unreachable.
 */
export const getVendorPrices = cache(async () => {
  const rows = await fetchV2VendorCatalog();
  const price = (code: string) => rows.find((r) => r.sku_code === code)?.price_php ?? null;
  const soloMo = price('solo_vendor_monthly');
  const soloYr = price('solo_vendor_annual');
  const proMo = price('pro_vendor_monthly');
  const proYr = price('pro_vendor_annual');
  const entMo = price('enterprise_vendor_monthly');
  const entYr = price('enterprise_vendor_annual');
  const branch = price('vendor_branch_28day');
  // The Custom tier's "from" floor. It WAS being typed into
  // app/_components/home/vendor-benefits.ts on the stated grounds that Custom
  // "is not a DB catalog SKU (Custom is composed per plan)" — untrue:
  // `vendor_custom_base` is an active row, and it is the number that was typed.
  // ⚠ NO PESO FALLBACK, deliberately, unlike the tier fields above. A "from"
  // price that silently reverts to a stale literal is how the /vendors label,
  // the matrix header and the matrix's own regex fallback ended up as three
  // copies of one number. Unreadable → null → the surface omits the figure.
  const customBase = price('vendor_custom_base');
  const pack = rows.find((r) => r.offering_type === 'token_pack' && r.token_grant_count);
  // Fallback mirrors the live flat ₱200/token ladder (2026-07-15 catalog
  // restructure: ₱1,000 = 5 tokens) so a DB-unreachable build never renders a
  // stale ₱100. The live read (price_php ÷ token_grant_count) wins when present.
  const tokenUnit = pack && pack.token_grant_count ? pack.price_php / pack.token_grant_count : 200;
  const fmt = (n: number | null, fb: string) => (n == null ? fb : `₱${formatPeso(n)}`);
  const save = (mo: number | null, yr: number | null, fb: string) =>
    mo != null && yr != null ? `₱${formatPeso(mo * 13 - yr)}` : fb;
  // Fallback strings/numbers mirror the LIVE vendor_billing_catalog ladder
  // (Solo ₱1,000/₱10,000 · Pro ₱2,500/₱25,000 · Enterprise ₱8,000/₱80,000 —
  // round-number reprice 2026-07-22) so a DB-unreachable build never renders a
  // stale price. They only ever surface if the catalog read returns empty —
  // the live read wins.
  return {
    soloMonthly: fmt(soloMo, '₱1,000'),
    soloAnnual: fmt(soloYr, '₱10,000'),
    soloAnnualSave: save(soloMo, soloYr, '₱3,000'),
    proMonthly: fmt(proMo, '₱2,500'),
    proAnnual: fmt(proYr, '₱25,000'),
    proAnnualSave: save(proMo, proYr, '₱7,500'),
    enterpriseMonthly: fmt(entMo, '₱8,000'),
    enterpriseAnnual: fmt(entYr, '₱80,000'),
    enterpriseAnnualSave: save(entMo, entYr, '₱24,000'),
    branch: fmt(branch, '₱999'),
    /** `null` when unreadable — callers render the bare label, never a guess. */
    customFrom: customBase == null ? null : `₱${formatPeso(customBase)}`,
    tokenUnit: `₱${formatPeso(tokenUnit)}`,
    // Raw numbers for the schema.org JSON-LD Offers (need unformatted values).
    num: {
      soloMonthly: soloMo ?? 1000,
      soloAnnual: soloYr ?? 10000,
      proMonthly: proMo ?? 2500,
      proAnnual: proYr ?? 25000,
      enterpriseMonthly: entMo ?? 8000,
      enterpriseAnnual: entYr ?? 80000,
    },
  };
});

/**
 * One ACTIVE customer-SKU price from the DB by service_code. cache()d per
 * code. Returns the BARE formatted number (no "₱", no period suffix), or null
 * if unavailable. Callers that need the recurrence unit pair this with
 * `getCustomerSkuPriceLabel` (full "₱X / 28 days") instead.
 *
 * 2026-06-13: now honors is_active — the sole consumer is marketing copy
 * (homepage Setnayan AI price), and a retired SKU (e.g. TODAYS_FOCUS ₱1,499)
 * must never leak a stale price onto a public surface. Same lesson as the
 * 2026-06-08 fetchV2CustomerCatalog is_active fix.
 */
export const getCustomerSkuPrice = cache(
  async (serviceCode: string): Promise<string | null> => {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return null;
    }
    const { data, error } = await admin
      .from('platform_retail_catalog_v2')
      .select('retail_price_php')
      .eq('service_code', serviceCode)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) return null;
    return formatPeso(Number((data as { retail_price_php: number }).retail_price_php));
  },
);

/**
 * One ACTIVE customer-SKU price as a FULL display label — "₱X" for one-time
 * SKUs, "₱X / 28 days" for per-28-day subscription SKUs (SETNAYAN_AI). The
 * number AND the recurrence unit both come from the catalog row, so a per_28d
 * price can never render as a bare one-time "₱499". Returns null when the row
 * is unreadable / inactive (caller supplies its own fallback copy).
 *
 * cache()d per code; honors is_active for the same reason as getCustomerSkuPrice.
 */
export const getCustomerSkuPriceLabel = cache(
  async (serviceCode: string): Promise<string | null> => {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return null;
    }
    const { data, error } = await admin
      .from('platform_retail_catalog_v2')
      .select('retail_price_php, billing_period')
      .eq('service_code', serviceCode)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { retail_price_php: number; billing_period: BillingPeriod | null };
    return `₱${formatPeso(Number(row.retail_price_php))}${formatBillingPeriodSuffix(row.billing_period)}`;
  },
);


/**
 * Server-side AUTHORITATIVE price for an order line, in centavos — the keystone
 * for tamper-proof, admin-managed pricing. submitOrderAction calls this and
 * overrides the client-supplied original_centavos with the result for EVERY
 * catalog SKU, so the charged amount always equals the admin-set catalog price
 * (defence-in-depth · mirrors the voucher re-validation in the same action).
 *
 * Returns:
 *   • { is_pax_priced, centavos } — the authoritative charge for THIS order in
 *     centavos. `centavos` is correct for both flat SKUs (retail_price_php × 100)
 *     and the pax-curve SKU (keyed to events.estimated_pax). The is_pax_priced
 *     flag is informational only — the catalog is the source of truth either way,
 *     and the caller overrides the client price whenever this is non-null.
 *   • null — SKU not in platform_retail_catalog_v2 (vendor / bundle / legacy
 *     SKUs) OR any DB error → caller falls back to the client price, so a
 *     transient read failure NEVER blocks an order.
 *
 * Uses the admin client for both reads (catalog is admin-read; the event is the
 * couple's own — we compute THEIR price). Graceful-degrades to the floor (pax
 * null) if estimated_pax is missing / the column is absent in a stale env.
 */
export async function resolvePaxPricedOrderCentavos(
  eventId: string,
  serviceCode: string,
): Promise<{ is_pax_priced: boolean; centavos: number; pax: number | null } | null> {
  const resolution = await resolveRetailChargeCentavos(eventId, serviceCode);
  if (resolution.status !== 'resolved') return null;
  return {
    is_pax_priced: resolution.is_pax_priced,
    centavos: resolution.centavos,
    pax: resolution.pax,
  };
}

/**
 * ⭐ SEC-7 · the FAIL-CLOSED form of {@link resolvePaxPricedOrderCentavos}.
 *
 * The `| null` return above conflates two completely different answers:
 *
 *     not_in_catalog  — "this SKU has no row here"     → try the next resolver
 *     error           — "the read failed"              → REFUSE THE SALE
 *
 * Checkout's old fallback ("a null resolve keeps the client price") turned the
 * second one into a money hole with a heartbeat: a transient PostgREST blip on
 * ANY catalog SKU left the browser-supplied `original_centavos` standing as the
 * charge. Attackers do not need to wait for a blip — they can cause one.
 *
 * So the charge path calls THIS, and treats `error` as a hard stop. The `| null`
 * wrapper stays for DISPLAY callers (e.g. the 3D Plan buy card), where "no price
 * → render nothing" is already the right degradation.
 */
export type { CatalogChargeResolution } from '@/lib/order-charge-math';

export async function resolveRetailChargeCentavos(
  eventId: string,
  serviceCode: string,
): Promise<CatalogChargeResolutionType> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { status: 'error', message: 'no service-role client' };
  }

  const { data: sku, error: skuErr } = await admin
    .from('platform_retail_catalog_v2')
    .select(
      'retail_price_php, is_pax_priced, pax_floor, pax_floor_price_php, pax_increment_size, pax_increment_price_php',
    )
    .eq('service_code', serviceCode)
    .maybeSingle();

  // ⚠ PostgREST returns NO error for a 0-row match, so `!skuErr` is never proof
  // of a hit — the two branches are checked separately and mean different things.
  if (skuErr) return { status: 'error', message: `platform_retail_catalog_v2: ${skuErr.message}` };
  if (!sku) return { status: 'not_in_catalog' };

  const config: PaxPricingConfig = {
    retail_price_php: Number(sku.retail_price_php),
    is_pax_priced: Boolean(sku.is_pax_priced),
    pax_floor: sku.pax_floor == null ? null : Number(sku.pax_floor),
    pax_floor_price_php:
      sku.pax_floor_price_php == null ? null : Number(sku.pax_floor_price_php),
    pax_increment_size:
      sku.pax_increment_size == null ? null : Number(sku.pax_increment_size),
    pax_increment_price_php:
      sku.pax_increment_price_php == null
        ? null
        : Number(sku.pax_increment_price_php),
  };

  // ── Pax at charge time (SEC-3 · 2026-07-26) ────────────────────────────────
  // This used to read events.estimated_pax RAW:
  //
  //     .from('events').select('estimated_pax')…
  //     pax = event.estimated_pax
  //
  // `events` UPDATE RLS is ROW-level, never column-level, and estimated_pax is
  // deliberately host-writable (lib/security/events-column-privileges.ts:43-47
  // — "a grant cannot close those without breaking the product"). So with the
  // public anon key a host could PATCH estimated_pax → 1, buy a pax-priced SKU
  // at pax_floor_price_php, and PATCH it back. Real money on a pax curve.
  //
  // The fix is to stop trusting a single freely-mutable number: resolveLivePax
  // is the app's CANONICAL pax definition (lib/pax.ts) and is already what the
  // vendor quoting engine charges against —
  //
  //     final_pax when the list is frozen  (a LOCKED column, service-role only,
  //                                         guarded by guard_pax_finalize_columns)
  //     else max(estimated_pax, live headcount on the event's basis)
  //
  // …so a deflated estimate is floored by the guest list the host actually has,
  // and a frozen list ignores the estimate entirely. Deflating to 1 with 250
  // attending guests on the roster no longer moves the price. (With no guest
  // list at all the floor price applies anyway — computePaxPriceCentavos
  // clamps at pax_floor, so there is nothing left to win.)
  //
  // Aligning here removes a divergence rather than creating one: every other
  // pax surface in the app already quotes resolveLivePax.
  let pax: number | null = null;
  if (config.is_pax_priced) {
    pax = await resolveLivePax(admin, eventId);
  }

  const standardCentavos = computePaxPriceCentavos(config, pax);

  // ── Vendor-enabled couple discount (owner 2026-07-22) ──────────────────────
  // A booked vendor with an ACTIVE 3D Booth add-on can unlock the 3D Plan for
  // their couple → SEATING_3D drops from the standard catalog price (₱2,999) to
  // ₱1,000. Server-authoritative: eventVendor3dPlanUnlockDiscountActive RE-VALIDATES
  // the unlock AT CHARGE TIME — the record must exist AND the attributing vendor
  // must STILL have a live 3D Booth add-on AND still be booked on the event — then
  // the PURE selector picks the price (only SEATING_3D, only when honored, only
  // ever LOWERS). So a lapsed booth / un-booked / cancelled vendor no longer
  // yields ₱1,000, a tampered/stale client price still can't beat ₱1,000, and a
  // couple with no live vendor-unlock pays the full ₱2,999. The unlock is
  // discount-eligibility ONLY — it grants no free access, and the couple still
  // buys SEATING_3D through this same apply-then-pay checkout.
  if (serviceCode === VENDOR_3D_PLAN_UNLOCK_SERVICE_KEY) {
    const unlocked = await eventVendor3dPlanUnlockDiscountActive(admin, eventId);
    return {
      status: 'resolved',
      is_pax_priced: config.is_pax_priced,
      pax,
      centavos: applyVendor3dPlanUnlockDiscountCentavos(
        serviceCode,
        standardCentavos,
        unlocked,
      ),
    };
  }

  return {
    status: 'resolved',
    is_pax_priced: config.is_pax_priced,
    pax,
    centavos: standardCentavos,
  };
}

/**
 * Server-side AUTHORITATIVE bundle price for an order line, in CENTAVOS.
 *
 * The 4-tier paywall bundles (Essentials = GUIDED_PACK · Complete = MEDIA_PACK)
 * live in `platform_package_catalog` (package_code · title · retail_price_php),
 * NOT in `platform_retail_catalog_v2`. So `resolvePaxPricedOrderCentavos` returns
 * null for them and, without this helper, the bundle order would fall back to the
 * client-supplied `original_centavos` — a tamperable ₱12,999 / ₱27,999.
 *
 * This is the bundle analogue of `resolvePaxPricedOrderCentavos`: it re-resolves
 * the charge from the admin-set `retail_price_php` so the billed amount ALWAYS
 * equals the catalog bundle price, identical to how flat retail SKUs are made
 * authoritative. Bundles are flat-priced (no pax curve), so the math is just
 * `retail_price_php × 100`.
 *
 * Returns:
 *   • centavos — the authoritative bundle charge (retail_price_php × 100).
 *   • null — package_code not in platform_package_catalog (not a bundle) OR a
 *     DB error / build-time env → caller keeps the client price, so a transient
 *     read failure NEVER blocks an order.
 *
 * Honors `is_active` (same soft-deactivation semantics as the retail reader):
 * a retired bundle resolves null here, so the caller never re-prices against a
 * deactivated row — it simply keeps the client value (the order then lands the
 * same way a non-catalog SKU would).
 */
export async function resolveBundleChargeCentavos(
  packageCode: string,
): Promise<number | null> {
  const resolution = await resolveBundleChargeResolution(packageCode);
  return resolution.status === 'resolved' ? resolution.centavos : null;
}

/**
 * ⭐ SEC-7 · the FAIL-CLOSED form of {@link resolveBundleChargeCentavos}, with
 * the same miss/error split as {@link resolveRetailChargeCentavos}. The charge
 * path uses this one; the `| null` wrapper above is kept for display callers.
 */
export type { BundleChargeResolution } from '@/lib/order-charge-math';

export async function resolveBundleChargeResolution(
  packageCode: string,
): Promise<BundleChargeResolutionType> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { status: 'error', message: 'no service-role client' };
  }

  const { data: pkg, error } = await admin
    .from('platform_package_catalog')
    .select('retail_price_php')
    .eq('package_code', packageCode)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    return { status: 'error', message: `platform_package_catalog: ${error.message}` };
  }
  // A 0-row match here means EITHER "not a bundle" OR "a retired bundle" (the
  // `is_active` filter). Both are `not_in_catalog` for the caller, and BOTH are
  // safe now: the retirement REJECT (resolveServiceSellability) already ran and
  // sent the retired case home, and a genuine miss now REFUSES rather than
  // falling back to the browser's number.
  if (!pkg || pkg.retail_price_php == null) return { status: 'not_in_catalog' };

  return { status: 'resolved', centavos: Math.round(Number(pkg.retail_price_php) * 100) };
}

/**
 * Is this `service_key` SELLABLE right now? The single generic retirement gate
 * for `submitOrderAction`.
 *
 * ── WHY THIS IS A SEPARATE PROBE AND NOT A FILTER ─────────────────────────
 * The obvious fix for "retired SKUs are still purchasable" is to add
 * `.eq('is_active', true)` to `resolvePaxPricedOrderCentavos`. That fix is
 * BACKWARDS and strictly worse than the bug. In `submitOrderAction` a null
 * resolve does NOT reject the order — it falls through and keeps the
 * CLIENT-SUPPLIED `original_centavos` (see the comment above the resolve call:
 * "Only SKUs in NEITHER catalog … keep the client value"). Filtering there
 * would therefore downgrade a retired SKU from "buyable at its real ₱4,999" to
 * "buyable at any price the browser POSTs, including ₱1".
 *
 * So this READS `is_active` rather than filtering on it — it needs to tell
 * "retired" apart from "not in the catalog at all", which a filter destroys:
 *
 *   'sellable' — row exists in either catalog and is_active = true
 *   'retired'  — row exists in either catalog and is_active = false → REJECT
 *   'unknown'  — in NEITHER catalog. Legitimate and common: SETNAYAN_AI_SUB,
 *                PAPIC_CAMERAS and 'vendor_additional_branch__<uuid>' style
 *                keys. → ALLOW. A naive "must map to an active row" rule would
 *                kill all of them.
 *                ⚠ This list previously named 'save-the-date:<slug>', which
 *                does not exist anywhere in the codebase (the real SKU is
 *                STD_PREMIUM_OPENINGS, an ordinary retail row). Corrected
 *                2026-07-26 — verify such lists, do not trust them.
 *                ⚠ It also briefly listed setnayan_service__{category}, added
 *                the same day during the SEC-7 review. REMOVED again 2026-07-26
 *                when the owner deleted that purchase path: no surface mints
 *                that key and no resolver prices it, so it is not a legitimate
 *                'unknown' — it is refused downstream.
 *   'error'    — DB/env failure → caller REJECTS (fail closed).
 *
 * ⚠ DO NOT reuse this to filter catalog READS. `is_active=false` is overloaded
 * in this catalog: on SETNAYAN_AI_RENEW (₱799) it means "not independently
 * sellable", NOT "retired" — it is the live renewal price for every AI
 * subscriber past their first cycle. Filtering that read makes renewals fall
 * back to the ₱1,499 intro price, an 88% overcharge with a matching BIR
 * receipt. See lib/setnayan-ai-event-pricing.ts, which deliberately does not
 * filter.
 */
export async function resolveServiceSellability(
  serviceCode: string,
): Promise<'sellable' | 'retired' | 'unknown' | 'error'> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return 'error';
  }

  const { data: retail, error: retailErr } = await admin
    .from('platform_retail_catalog_v2')
    .select('is_active')
    .eq('service_code', serviceCode)
    .maybeSingle();
  if (retailErr) return 'error';
  if (retail) {
    return (retail as { is_active?: boolean | null }).is_active ? 'sellable' : 'retired';
  }

  const { data: pkg, error: pkgErr } = await admin
    .from('platform_package_catalog')
    .select('is_active')
    .eq('package_code', serviceCode)
    .maybeSingle();
  if (pkgErr) return 'error';
  if (pkg) {
    return (pkg as { is_active?: boolean | null }).is_active ? 'sellable' : 'retired';
  }

  return 'unknown';
}
