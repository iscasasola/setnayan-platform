import Link from 'next/link';
import { ArrowRight, Check, Sparkles, Brush, Clock3 } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchV2CustomerCatalog,
  fetchV2VendorCatalog,
  formatPeso,
  formatSkuPriceLabel,
  formatBillingPeriodSuffix,
  type V2CustomerSku,
  type BuildStatus,
} from '@/lib/v2-catalog';
// Client motion island — the page stays an async Server Component (data fetch +
// JSON-LD @graph below are untouched); these thin wrappers only attach the
// premium reveal/panel refs to server-passed children. See _pricing-motion.tsx.
import { RevealBand, LineRevealHeading } from './_pricing-motion';
// Display-only Papic estimator (client). NEVER calls checkout — pure client
// arithmetic over catalog rates passed as props. See _papic-estimator.tsx.
import { PapicEstimator, type EstimatorRates } from './_papic-estimator';
// Papic capacity / free-camera / cap COPY is derived from papic_tier_config —
// this page must never spell a photo count, a clip count or a cap peso figure
// as a literal (owner 2026-07-20 · guarded by lib/papic-copy-guardrails.test.ts).
import {
  papicBucketPhrase,
  papicOneRungPhrase,
} from '@/lib/papic-tier-copy';
import {
  readPapicOneTiers,
  readPapicTierConfig,
  readPapicFreeOneCameraPoints,
} from '@/lib/papic-tier-config-read';
import { PAPIC_FREE_ONE_CAMERA_COUNT } from '@/lib/papic-one';
import { resolveAiPrices } from '@/app/_components/home/pricing-data';

/**
 * Force dynamic rendering · skip static prerender.
 *
 * WHY: this page calls fetchV2CustomerCatalog / fetchV2VendorCatalog from
 * lib/v2-catalog.ts. Those helpers call createAdminClient (lib/supabase/admin.ts)
 * which throws "Missing SUPABASE env vars for admin client" when
 * SUPABASE_SERVICE_ROLE_KEY is unset — the case in GitHub Actions `production
 * build`. Static prerender invokes the page at build time, hits the throw, fails
 * the build. Per-request rendering is also semantically correct: catalog rows
 * live in setnayan-prod and shift without a redeploy.
 *
 * Locked CLAUDE.md 2026-05-28 row "fix endless loop error on vercel". Pairs with
 * the try/catch around createAdminClient in lib/v2-catalog.ts fetchers.
 */
export const dynamic = 'force-dynamic';

/**
 * /pricing — V2 customer-side pricing surface.
 *
 * REDESIGNED 2026-07-04 (marketing-only): free-forward layout —
 *   hero → Free · Explore vs Setnayan AI → add-ons GROUPED (Papic & its add-ons ·
 *   Go live & interactive · Your website · Personal touches) → a client-side,
 *   DISPLAY-ONLY Papic estimator → the complete "Free, always" list → the
 *   apply-then-pay / 0%-commission line.
 *
 * Every price still reads LIVE from the V2 catalog (platform_retail_catalog_v2 ·
 * vendor_billing_catalog). Build-status chips (Live · In build · Coming soon)
 * are preserved. When a grouped SKU is inactive/absent it is simply omitted —
 * never hardcoded. NO checkout / payment / entitlement / migration touched.
 */

// Pricing copy realigned to the owner-locked 4-tier model (Pricing.md § 00):
// start free on the planning workspace, pay for Setnayan AI + the software you
// add. No "free website / free RSVP" claims — those SKUs are paid.
export const metadata = {
  title: 'Pricing · Setnayan',
  description:
    'Plan for free. Add Setnayan AI and the software you actually use at your event, at transparent PHP prices. 0% commission on vendor bookings. Vendors keep 100%.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing · Setnayan',
    description:
      'Plan free, add the magic as you go. Transparent PHP prices. Vendors transact directly. Setnayan takes 0%.',
    url: '/pricing',
    type: 'website',
    siteName: 'Setnayan',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing · Setnayan',
    description: 'Plan free · add software à la carte · vendors keep 100% · 0% commission.',
  },
};

// Build-status chip — honest about what's wired vs catalog-only.
function BuildStatusChip({ status }: { status: BuildStatus }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta-700 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cream">
        <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
        Live
      </span>
    );
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/40 bg-terracotta/5 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
        <Clock3 aria-hidden className="h-3 w-3" strokeWidth={2} />
        In build
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-ink/[0.03] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
      <Brush aria-hidden className="h-3 w-3" strokeWidth={1.75} />
      Coming soon
    </span>
  );
}

// ── Add-on grouping — data-driven from the catalog by service_code ──
// The prototype groups the à-la-carte SKUs into four named sections; each row's
// price comes from the live catalog. A `withPapic` flag renders the "with Papic"
// tag. `gate` (optional) hides a row unless the SKU is present AND active — used
// for WEBSITE_UPGRADE, which only shows if the catalog carries it.
type GroupItem = { code: string; withPapic?: boolean; gate?: boolean };
type CatalogGroup = { title: string; items: GroupItem[] };

const ADDON_GROUPS: CatalogGroup[] = [
  {
    title: 'Papic & its add-ons',
    items: [
      // The two-type model (owner-locked 2026-07-29) — both rows are SYNTHETIC,
      // collapsing their live rungs into one "from ₱X" line each (see below).
      { code: 'PAPIC_POOL' }, // Papic Pool — the shared shot pool, additive top-ups
      { code: 'PAPIC_CAMERAS' }, // Papic One — a dedicated camera, its own QR + shots
      { code: 'CAMERA_BRIDGE', withPapic: true },
      { code: 'PABATI', withPapic: true },
      { code: 'KWENTO', withPapic: true },
      // Pakanta moved to "Personal touches" on origin/main (owner 2026-07-10
      // "pakanta is not part of papic"); Stories + Thank You are the genuine
      // Papic add-ons activated 2026-07-10.
      { code: 'PAPIC_ADDON_STORIES', withPapic: true }, // Stories — 30s guest story maker
      { code: 'PAPIC_ADDON_THANK_YOU', withPapic: true }, // Thank You Video
    ],
  },
  {
    title: 'Go live & interactive',
    items: [
      // ⭐ THE UNIFIED LIVE STUDIO SKU — ₱2,999 PER EVENT (owner-locked 2026-07-25 ·
      // Live_Studio_Unified_Spec § 3: Cast + Roam merged into one switching product).
      //
      // 🚨 IT MUST BE LISTED HERE OR IT CAN NEVER APPEAR. `resolvedGroups` maps over
      // ADDON_GROUPS' items and omits anything the catalog doesn't return — so a SKU in
      // no group is invisible on /pricing no matter what the catalog says. That is the
      // trap COUPLE_WEBSITE_PRO's comment below records ("must be LISTED here or the
      // reactivated umbrella never appears"), and Live Studio was walking into it: at
      // the flag flip its Studio tile and buy drawer would light up while /pricing
      // showed NO paid live-broadcast row at all — because the only Live Studio code
      // listed here was PANOOD_SYSTEM, which is now permanently retired (below).
      //
      // Safe to list while dark: `fetchV2CustomerCatalog` name-excludes LIVE_STUDIO
      // while NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED is off, so this row is omitted today
      // and appears the moment the owner flips the flag — one launch switch, no second
      // code change. (Free single-camera livestream is unaffected and stays free.)
      { code: 'LIVE_STUDIO' }, // Live Studio ₱2,999/event — the unified switching SKU
      // ~~PANOOD_SYSTEM~~ (Cast, ₱2,500/day) is **RETIRED** — is_active=false via
      // migration 20271005180040 (PR #3716), because Wave 6's ownership alias
      // LIVE_STUDIO ← PANOOD_SYSTEM let a ₱2,500 Cast order collect the ₱2,999 unified
      // controller (a ₱500 arbitrage on a live buy button). PANOOD_SYSTEM_MOBILE was
      // retired 2026-07-21 and was never purchasable anyway (no buy surface ever posted
      // it, zero orders). Both drop out of resolvedGroups automatically; the code stays
      // listed — same convention as LIVE_BACKGROUND below — so the retirement is legible
      // here rather than looking like an accidental deletion.
      { code: 'PANOOD_SYSTEM' }, // retired 2026-07-26 — folded into LIVE_STUDIO above
      // LIVE_WALL is FREE for every event since 2026-08-11 (owner: "live photo
      // wall FREE") — is_active=false, so it drops out of resolvedGroups
      // automatically and no longer appears among the paid à-la-carte rows,
      // which is correct: this page lists what you PAY for. The feature is still
      // on for everyone (entitlements FREE_FOR_ALL_SKUS) and llms.txt describes
      // it as free. Code kept listed — same convention as PANOOD_SYSTEM above
      // and LIVE_BACKGROUND below — so the change is legible here rather than
      // looking like an accidental deletion.
      { code: 'LIVE_WALL' }, // FREE 2026-08-11 — no longer a paid row
      { code: 'PATIKTOK_COMPILER' },
      // LIVE_BACKGROUND (the LED wall backdrop) was REMOVED from the product
      // 2026-08-11 — it is is_active=false and drops out of resolvedGroups
      // automatically, and there is no longer a maker behind it to sell.
      { code: 'SEATING_3D' }, // 3D Plan — walk the reception in 3D (activated 2026-07-10)
    ],
  },
  {
    title: 'Your website',
    items: [
      // Website PRO REACTIVATED + repriced ₱3,500 (owner 2026-07-22): the umbrella
      // and the ONLY way to get Editorial PRO + the Cinematic Reveal, both now
      // bundle-only (is_active=false → their standalone rows auto-drop from
      // resolvedGroups). COUPLE_WEBSITE_PRO must be LISTED here or the reactivated
      // umbrella never appears (resolvedGroups only renders codes in a group).
      { code: 'COUPLE_WEBSITE_PRO' }, // Website PRO ₱3,500 — includes Reveal + Editorial PRO
      { code: 'EVENT_SUBDOMAIN' }, // Custom subdomain yourname.setnayan.com ₱999/year (owner 2026-07-10)
      { code: 'WEBSITE_UPGRADE', gate: true }, // only if active in the catalog
    ],
  },
  {
    title: 'Personal touches',
    // Pakanta = a custom wedding song (iteration 0036), NOT a Papic add-on —
    // it lives here alongside the monogram (owner 2026-07-10 "pakanta is not
    // part of papic").
    items: [{ code: 'ANIMATED_MONOGRAM' }, { code: 'PAKANTA' }],
  },
];

export default async function PricingPage() {
  // Reads in parallel · helpers return [] on error, so the page still renders a
  // polite empty state rather than 500'ing. The Essentials/Complete bundle tiers
  // were removed 2026-06-29 (both deactivated).
  const [customerSkus, vendorSkus, papicTierConfig, papicOneTiers, papicFreeOnePoints] =
    await Promise.all([
      fetchV2CustomerCatalog(),
      fetchV2VendorCatalog(),
      // Papic capacity + caps are DERIVED from the admin-editable tier config —
      // never spelled as literals here (owner 2026-07-20). See lib/papic-tier-copy.ts.
      readPapicTierConfig(),
      // …except the Papic ONE shot counts, which live in `papic_one_tiers`. See
      // the ladder block below for why reading them from the tier config was a lie.
      readPapicOneTiers(),
      // …and the free ONE camera's bucket, which lives in a third place again:
      // papic_event_pool_config.free_one_camera_points. See the free-camera
      // block below for why the tier config's seat count was the wrong number.
      readPapicFreeOneCameraPoints(),
    ]);

  // Setnayan AI is a ONE-TIME, wedding-anchored purchase (owner 2026-07-10): one
  // charge, access until the event date. The prior ₱499→₱799/28-day subscription
  // (and its SETNAYAN_AI_RENEW row) is retired — no renewal price.
  //
  // 🔑 IT HAS TWO PRICES (owner 2026-08-12) AND THIS PAGE SHOWED ONE. A sign-up
  // price if you take it while creating your event, the regular price after.
  // Both live in the catalog row and the sign-up one was already being CHARGED;
  // it simply never reached a public surface. Read both, and let the card decide
  // how to say it.
  //
  // ⚠ THE '₱499' FALLBACK IS GONE, AND IT WAS NOT HARMLESS. By the time it was
  // found the live price was ₱2,499 — the "last-resort" number was FIVE TIMES
  // off, on the page where somebody decides to pay, and nothing checked it
  // because `public-price-literals.ts` declared it `sku: null` (a non-price),
  // which is exactly the class of entry that is never drift-tested. An
  // unreadable catalog now renders NO figure. A missing price is recoverable;
  // a confidently wrong one is not.
  //
  // The period suffix comes from the row's billing_period (now `one_time` → '').
  // ⚠ ONE RESOLVER, TWO SURFACES. `resolveAiPrices` is shared with the nav
  // pricing overlay (`_components/home/pricing-data.ts`) so this page and that
  // popup can never disagree about whether a sign-up price exists. Its docblock
  // carries the four rules; do not re-implement them here.
  const setnayanAi = customerSkus.find((s) => s.service_code === 'SETNAYAN_AI');
  const ai = resolveAiPrices(setnayanAi);
  const aiRegularLabel = ai.regularPhp > 0 ? `₱${formatPeso(ai.regularPhp)}` : null;
  const aiSignupLabel = ai.hasSignupPrice ? `₱${formatPeso(ai.introPhp)}` : null;
  const aiPeriod = setnayanAi ? formatBillingPeriodSuffix(setnayanAi.billing_period) : '';

  // ── The Papic ONE ladder — DERIVED, never spelled ─────────────────────────
  // Rungs come from `papic_one_tiers` (admin-editable: service_code → the
  // LIFETIME shot count that rung grants a single dedicated camera), priced from
  // the live catalog. A rung whose SKU is missing/unreadable DROPS OUT rather
  // than rendering an invented price — the same "never hardcode a missing SKU"
  // doctrine the grouped add-on renderer below follows.
  //
  // ⚠ THIS USED TO READ `papic_tier_config.points_per_day` VIA publicPapicLadder,
  // AND THAT WAS A LIVE FALSEHOOD. The two-type lock (owner 2026-07-29) moved
  // Papic One off a per-day meter onto a lifetime bucket, and set the 'mini'
  // row's points_per_day to NULL on prod. NULL means "unlimited" to every copy
  // helper — so this page told couples a ₱50 camera shoots "unlimited shots per
  // day" when it actually holds 50. The number and the price have to come from
  // the same lock, or the cheaper we make Papic the bigger the lie gets.
  //
  // Capacity is still expressed in the points currency the code enforces
  // (1 photo = 1 pt · one 10-second clip = the constant in lib/papic-cameras.ts),
  // so the copy stays true if an admin retunes a rung.
  const papicOneLadder = papicOneTiers
    .map((tier) => {
      const sku = customerSkus.find((s) => s.service_code === tier.serviceCode);
      const pricePhp = sku ? Number(sku.retail_price_php) : NaN;
      return Number.isFinite(pricePhp) ? { tier, pricePhp } : null;
    })
    .filter((r): r is { tier: (typeof papicOneTiers)[number]; pricePhp: number } => r !== null)
    .sort((a, b) => a.pricePhp - b.pricePhp);
  // 🚨 THE FREE CAMERA ON *THIS* PRODUCT IS ONE, NOT THREE (fixed 2026-07-29).
  //
  // Both surfaces below used to read `papicFreeCameraCount(papicTierConfig)` —
  // i.e. `papic_tier_config.free.seats_per_event`, which is 3. That number is a
  // Papic POOL fact: three free SHARED seats (seat_index 100..102) that spend the
  // event's shared point pool. Papic ONE is the DEDICATED product, and it gets
  // exactly ONE free camera — `papic_ensure_free_one_camera` pins it to a single
  // fixed seat_index and two unique constraints make a second impossible.
  //
  // So the One tab quoted the POOL's free-seat count on a product that gives one
  // dedicated camera, and the estimator billed for that many fewer cameras than
  // a couple would actually buy. Under the 2026-07-29 two-type lock the free tier is
  // "unlimited POOL cameras sharing one purse, plus ONE free dedicated camera" —
  // the three shared seats aren't a One allowance at all, and quoting them here
  // was the last place the retired per-seat model still spoke.
  //
  // The free camera's own bucket is smaller than any paid rung, so the copy says
  // so rather than implying a free camera equals a bought one.
  const papicFreeOneCameras = papicFreeOnePoints > 0 ? PAPIC_FREE_ONE_CAMERA_COUNT : 0;
  const papicOneLadderPhrase = papicOneLadder
    .map(({ tier, pricePhp }) => papicOneRungPhrase(tier.points, pricePhp))
    .join(' · ');
  const papicOneTitle = papicTierConfig.mini.displayTitle;
  const papicFromPhp = papicOneLadder.length
    ? Math.min(...papicOneLadder.map((r) => r.pricePhp))
    : null;

  // Collapse the per-camera rate SKU(s) into ONE synthetic "from ₱X/camera"
  // catalog row for the grouped list; JSON-LD keeps the raw rows. Flat model
  // (2026-07-22 rename): Papic One is a flat price PER CAMERA — no per-day
  // multiplier, no wedding cap. The days/cap framing was removed here.
  const papicCamerasSynthetic: V2CustomerSku | null =
    papicFromPhp != null
      ? {
          service_code: 'PAPIC_CAMERAS',
          title: papicOneTitle,
          retail_price_php: papicFromPhp,
          // Synthetic rows are composed from real rungs and are never bought
          // directly, so they carry no sign-up price.
          onboarding_price_php: null,
          saas_overhead_cost_php: 0,
          is_token_able: false,
          description:
            `A camera of its own for someone you trust — its own QR, and shots ` +
            `nobody else can spend. ` +
            (papicFreeOneCameras > 0
              ? `Your ${papicFreeOneCameras === 1 ? 'first camera is' : `first ${papicFreeOneCameras} cameras are`} ` +
                `free to try — ${papicBucketPhrase(papicFreeOnePoints)}. Then ` +
                papicOneLadderPhrase
              : papicOneLadderPhrase) +
            `. Reload any camera any time.`,
          build_status: 'live',
          billing_period: 'one_time',
          is_pax_priced: true, // drives the "from ₱X" label
          pax_floor: null,
          pax_floor_price_php: null,
          pax_increment_size: null,
          pax_increment_price_php: null,
        }
      : null;

  // Papic — the shot buckets, flat-priced from the live catalog.
  //
  // 🚨 THIS USED TO BE A HARDCODED LIST OF THREE SERVICE CODES and it had
  // already gone wrong. The list named the 3,000 / 6,000 / 10,000 rungs, so it
  // could never show the two the owner added on 2026-08-11 (100 shots ₱50 and
  // 20,000 ₱5,000) and still named the 6,000 rung he retired the same day — the
  // public pricing page advertised a ladder that no longer existed, silently,
  // with nothing to notice it. A page that lists SKUs by hand goes stale the
  // moment the catalog moves, and the catalog is the thing customers buy from.
  //
  // Derived now: every ACTIVE Papic shot rung the catalog offers, whatever it
  // offers. Adding or retiring a rung is a migration and nothing else.
  // `is_topup` rows are excluded upstream in customerSkus; a retired code drops
  // out on its own because it is no longer active.
  const papicPoolBuckets = customerSkus
    .filter((s) => /^PAPIC_GUEST(_|$)/.test(s.service_code)) // gitleaks:allow — catalog service_codes, not secrets
    .map((s) => ({
      key: s.service_code,
      // Short bucket label from the catalog title ("Papic — add 3,000 shots" →
      // "add 3,000 shots"); never a hardcoded shot count.
      //
      // ⚠ The old strip was /^Papic Pool\s*[—-]\s*/ and the titles were renamed
      // to "Papic — add N shots" when the two products became one. It stopped
      // matching, so the page rendered "₱1,000 to Papic — add 3,000 shots".
      // Matching the product word alone survives that rename and the last one.
      label: s.title
        .replace(/^Papic(\s+Pool)?\s*[—-]\s*/i, '')
        .replace(/\s*\(per event\)\s*$/i, ''),
      pricePhp: Number(s.retail_price_php),
    }))
    .sort((a, b) => a.pricePhp - b.pricePhp);

  // Collapse the Pool buckets into ONE synthetic "from ₱X" row, the same way
  // PAPIC_CAMERAS collapses the One rungs.
  //
  // 🚨 WITHOUT THIS, PAPIC POOL IS INVISIBLE ON THIS PAGE. `resolvedGroups` only
  // renders codes that appear in ADDON_GROUPS, so a SKU in no group cannot show
  // no matter what the catalog says — the exact trap recorded on LIVE_STUDIO
  // above. The Pool rows were reactivated on 2026-07-29 and belong to no group,
  // so the estimator quoted a product the price list did not carry. Listing the
  // three buckets separately would read as three products; one "from ₱X" row
  // with the ladder in its description reads as what it is — one shared pool
  // you top up.
  const papicPoolSynthetic: V2CustomerSku | null =
    papicPoolBuckets.length > 0
      ? {
          service_code: 'PAPIC_POOL',
          title: 'Papic',
          retail_price_php: papicPoolBuckets[0]!.pricePhp,
          // Synthetic row — composed from real rungs, never bought directly.
          onboarding_price_php: null,
          saas_overhead_cost_php: 0,
          is_token_able: false,
          description:
            `One shared pool of shots that every guest's phone can spend from — ` +
            `no per-camera math, no seat limit. ` +
            papicPoolBuckets
              .map(({ label, pricePhp }) => `₱${formatPeso(pricePhp)} to ${label}`)
              .join(' · ') +
            `. Every top-up stacks on what your event already holds.`,
          build_status: 'live',
          billing_period: 'one_time',
          is_pax_priced: true, // drives the "from ₱X" label — the ladder starts here
          pax_floor: null,
          pax_floor_price_php: null,
          pax_increment_size: null,
          pax_increment_price_php: null,
        }
      : null;

  // Look up table for the grouped add-on renderer — includes the synthetic rows.
  const skuByCode = new Map<string, V2CustomerSku>(
    customerSkus.map((s) => [s.service_code, s]),
  );
  if (papicCamerasSynthetic) skuByCode.set('PAPIC_CAMERAS', papicCamerasSynthetic);
  if (papicPoolSynthetic) skuByCode.set('PAPIC_POOL', papicPoolSynthetic);

  // Resolve each add-on group's rows from the catalog, dropping any SKU that is
  // absent (and gated rows unless present + active). NEVER hardcodes a price.
  const resolvedGroups = ADDON_GROUPS.map((g) => ({
    title: g.title,
    rows: g.items
      .map((it) => {
        const sku = skuByCode.get(it.code);
        if (!sku) return null; // omit — never hardcode a missing SKU
        return { sku, withPapic: Boolean(it.withPapic) };
      })
      .filter((r): r is { sku: V2CustomerSku; withPapic: boolean } => r !== null),
  })).filter((g) => g.rows.length > 0);

  // Estimator inputs — the SAME derived ladder the description above renders
  // (rungs + rates + per-rung capacity + per-rung WEDDING cap). Nothing about
  // Papic capacity or caps is spelled here. Add-on prices come from the catalog.
  const rateOf = (code: string, fb: number) =>
    Number(customerSkus.find((s) => s.service_code === code)?.retail_price_php ?? fb);
  const estimatorAddonDefs: Array<{ key: string; code: string; label: string; fb: number }> = [
    { key: 'cb', code: 'CAMERA_BRIDGE', label: 'Camera Bridge · DSLR', fb: 500 }, // owner 2026-07-11 (was 499)
    // Kwento + Pabati owner-locked FREE 2026-07-08 → deactivating the catalog row
    // drops them from the estimator (filter below); fb 0 guards a lingering
    // null-priced row from showing a stale paid figure.
    { key: 'pabati', code: 'PABATI', label: 'Pabati', fb: 0 },
    { key: 'kwento', code: 'KWENTO', label: 'Kwento', fb: 0 },
    // Pakanta (custom wedding song, 0036) is NOT a Papic add-on — deliberately
    // excluded from the per-camera Papic estimator (owner 2026-07-10).
  ];
  // Papic One — the rung the estimator prices a camera at: the CHEAPEST live
  // one (papicOneLadder is price-sorted). null = the ladder is unreadable at
  // build time (catalog empty).
  const papicOneRung = papicOneLadder[0] ?? null;

  const estimatorRates: EstimatorRates = {
    // ONE free dedicated camera, not the three shared-pool seats — see the
    // papicFreeOneCameras block above. This makes the quote go UP for anyone
    // estimating more than one camera, which is the correct direction: they
    // were previously quoted for two fewer paid cameras than they would buy.
    freeCameras: papicFreeOneCameras,
    freeCameraCapacity: papicFreeOnePoints > 0 ? papicBucketPhrase(papicFreeOnePoints) : null,
    one: papicOneRung
      ? {
          label: papicOneTitle,
          pricePhp: papicOneRung.pricePhp,
          // The rung's LIFETIME shot bucket, not a per-day meter — see the
          // ladder block above for why the per-day reading was false.
          capacity: papicBucketPhrase(papicOneRung.tier.points),
        }
      : null,
    pool: papicPoolBuckets,
    addons: estimatorAddonDefs
      // Only offer an add-on the catalog actually carries (else drop it).
      .filter((a) => customerSkus.some((s) => s.service_code === a.code))
      .map((a) => ({ key: a.key, label: a.label, price: rateOf(a.code, a.fb) })),
  };

  // The complete "Free, always" list — planning tools, the 4-in-1 website,
  // unlimited RSVP, single-camera livestream, Custom QR. Deliberately EXCLUDES
  // Guest Stories (paid / inactive). Grouped for scanability.
  const FREE_COLUMNS: Array<{ title: string; items: Array<{ n: string; note?: string }> }> = [
    {
      title: 'Plan your day',
      items: [
        { n: 'Schedule', note: 'your day-of timeline' },
        { n: 'Budget tracker' },
        { n: 'Guest list' },
        { n: 'Seat plan', note: '2D layout' },
        { n: 'Mood board' },
        { n: 'Printable plans' },
      ],
    },
    {
      title: 'Your free website',
      items: [
        { n: 'Save-the-Date page' },
        { n: 'RSVP page', note: 'unlimited RSVP collection' },
        { n: 'Event / on-the-day page' },
        { n: 'Editorial page' },
      ],
    },
    {
      title: 'Capture & share',
      items: [
        { n: 'Browse vendors + match preview' },
        { n: 'Single-camera livestream', note: 'to YouTube, auto-archived' },
        { n: 'Custom QR for every guest', note: 'free per-guest QR' },
        { n: 'Ala Ala memory hub' },
        { n: '0% commission on vendor bookings' },
      ],
    },
  ];

  // ── JSON-LD @graph (unchanged shape) — reads the RAW catalog rows so the real
  // per-camera Papic rates + every vendor sub stay in structured data. ──
  const SITE_URL = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
  ).replace(/\/$/, '');
  const ORGANIZATION_REF = { '@id': `${SITE_URL}/#organization` };
  const buildAvailability = (status: BuildStatus): string =>
    status === 'not_built' ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock';

  const vendorSubs = vendorSkus.filter((s) => s.offering_type === 'subscription_monthly');
  const vendorAnnualSubs = vendorSkus.filter((s) => s.offering_type === 'subscription_annual');

  const pricingJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@graph': [
      ...customerSkus.map((sku) => ({
        '@type': 'Product',
        '@id': `${SITE_URL}/pricing#sku-${sku.service_code}`,
        name: sku.title,
        description: sku.description ?? `${sku.title} on Setnayan.`,
        brand: ORGANIZATION_REF,
        category: 'Wedding planning software',
        offers: {
          '@type': 'Offer',
          url: `${SITE_URL}/pricing`,
          price: String(Math.round(sku.retail_price_php)),
          priceCurrency: 'PHP',
          availability: buildAvailability(sku.build_status),
          seller: ORGANIZATION_REF,
          ...(sku.billing_period === 'per_28d'
            ? {
                priceSpecification: {
                  '@type': 'UnitPriceSpecification',
                  price: String(Math.round(sku.retail_price_php)),
                  priceCurrency: 'PHP',
                  billingDuration: 'P28D',
                  unitText: '28-day cycle',
                },
              }
            : {}),
        },
      })),
      ...[...vendorSubs, ...vendorAnnualSubs].map((s) => {
        const isAnnual = s.offering_type === 'subscription_annual';
        const cadence = isAnnual
          ? { billingDuration: 'P1Y', unitText: 'annual subscription', shortLabel: 'per year' }
          : { billingDuration: 'P28D', unitText: '28-day prepaid block', shortLabel: 'per 28 days' };
        return {
          '@type': 'Service',
          '@id': `${SITE_URL}/pricing#vendor-${s.sku_code}`,
          name: s.title,
          description: `${s.title} · Setnayan vendor subscription ${cadence.shortLabel}. 0% commission on bookings.`,
          provider: ORGANIZATION_REF,
          category: 'Wedding vendor subscription',
          offers: {
            '@type': 'Offer',
            url: `${SITE_URL}/vendors`,
            price: String(Math.round(s.price_php)),
            priceCurrency: 'PHP',
            availability: 'https://schema.org/InStock',
            seller: ORGANIZATION_REF,
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: String(Math.round(s.price_php)),
              priceCurrency: 'PHP',
              billingDuration: cadence.billingDuration,
              unitText: cadence.unitText,
            },
          },
        };
      }),
      // Token-pack Products were emitted here until 2026-08-07. The vendor
      // token currency is retired, so publishing them as `InStock` structured
      // data would advertise a purchasable product that does not exist — to
      // search engines, which cache it.
    ],
  };

  return (
    <div className="min-h-screen bg-cream text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />

      {/* Hero */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 pt-20 pb-12 sm:px-6 sm:pt-28 sm:pb-16 lg:px-8 lg:pt-32 lg:pb-20">
          <p className="m-eyebrow">Set na &apos;yan · Pricing</p>
          <LineRevealHeading
            as="h1"
            trigger="mount"
            className="mt-5 text-balance font-display text-5xl font-medium leading-[1.02] tracking-tight sm:text-7xl lg:text-[88px]"
          >
            Plan for free.{' '}
            <span className="text-ink/55">Add the magic as you go.</span>
          </LineRevealHeading>
          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-ink/65">
            Start planning at no cost. Let Setnayan AI do the matching when
            you&rsquo;re ready, then add only the services you actually want. No
            bundles, no lock-in.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="#plans" className="m-btn m-btn-primary">
              See plans
            </Link>
            <Link href="#free" className="m-btn m-btn-ghost">
              What&rsquo;s free ↓
            </Link>
          </div>
        </div>
      </section>

      {/* Free · Explore vs Setnayan AI */}
      <section id="plans" className="border-b border-ink/5 bg-ink/[0.02]">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mb-12 max-w-2xl space-y-3">
            <p className="m-eyebrow">Two ways to plan</p>
            <LineRevealHeading className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Free to start. Paid only when it helps.
            </LineRevealHeading>
            <p className="text-base leading-relaxed text-ink/65">
              Plan free for as long as you like. Add Setnayan AI when you want
              the matching done for you — then pick exactly the software you
              want below.
            </p>
          </div>
          <RevealBand className="grid grid-cols-1 gap-4 sm:grid-cols-2" stagger={0.07}>
            <article
              data-reveal-item
              className="flex flex-col gap-3 rounded-2xl border border-ink/15 bg-cream p-6 sm:p-8"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Free · Explore
              </p>
              <p className="flex items-baseline gap-2">
                <span className="font-sans text-4xl font-semibold tracking-tight text-ink">₱0</span>
                <span className="text-sm text-ink/55">/ forever</span>
              </p>
              <p className="text-sm leading-relaxed text-ink/65">
                A whole planning workspace, your wedding website, and the tools
                to share your day.
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                {[
                  'All five planning tools',
                  'Your free 4-in-1 wedding website',
                  'Unlimited RSVP collection',
                  'Browse vendors + a match preview',
                  'Single-camera livestream & free Custom QR',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
                    <span className="text-ink">{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="#free" className="mt-3 inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink/70 hover:text-ink">
                See everything free ↓
              </Link>
            </article>
            <article
              data-reveal-item
              className="flex flex-col gap-3 rounded-2xl border-2 border-terracotta/40 bg-cream p-6 sm:p-8 shadow-[0_30px_80px_-40px_rgba(197,160,89,0.35)]"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Setnayan AI
              </p>
              {/* THE PRICE, AND THE SECOND ONE THAT WAS NEVER SHOWN.
                  When the catalog carries a sign-up price, THAT is the headline
                  figure — it is what this reader pays if they start now, and
                  quoting the higher number first was quietly overcharging the
                  page's own visitor. The regular price stays visible beside it
                  so nobody discovers it later. When the row carries no sign-up
                  price the block is a single figure, exactly as before; when the
                  catalog is unreadable it renders nothing rather than a guess. */}
              {aiRegularLabel ? (
                <>
                  <p className="flex items-baseline gap-2">
                    <span className="font-sans text-4xl font-semibold tracking-tight text-ink">
                      {aiSignupLabel ?? aiRegularLabel}
                    </span>
                    {aiSignupLabel ? (
                      <span className="text-sm text-ink/55">
                        <span className="line-through decoration-ink/30">{aiRegularLabel}</span>{' '}
                        later
                      </span>
                    ) : null}
                    <span className="text-sm text-ink/55">{aiPeriod}</span>
                  </p>
                  <p className="text-sm font-medium text-ink/70">
                    {aiSignupLabel
                      ? 'One-time · this price while you’re setting up your wedding · access until the day.'
                      : 'One-time · access until your wedding.'}
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium text-ink/70">
                  One-time · access until your wedding. See the price when you start.
                </p>
              )}
              <p className="text-sm leading-relaxed text-ink/65">
                The planner that matches, sorts and cross-references every
                vendor for your exact wedding.
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                {[
                  'Everything in Free',
                  'Full matching — date, budget, venue, pax, faith & reviews',
                  'Your sorted, ready-to-book shortlist',
                  'A planning assistant that keeps you on track',
                  'Runs until your wedding day, then stops',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
                    <span className="text-ink">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/onboarding/wedding?from=pricing"
                className="m-btn m-btn-primary mt-3 self-start"
              >
                Unlock Setnayan AI
              </Link>
            </article>
          </RevealBand>
        </div>
      </section>

      {/* Add-ons — grouped, data-driven from the catalog */}
      <section id="addons" className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mb-12 max-w-2xl space-y-3">
            <p className="m-eyebrow">Add-ons</p>
            <LineRevealHeading className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Pay only for what you want.
            </LineRevealHeading>
            <p className="text-base leading-relaxed text-ink/65">
              A one-time charge for your event. A few scale with your cameras and
              event days — estimate those below. Each SKU is marked{' '}
              <span className="text-ink">Live</span>,{' '}
              <span className="text-ink">In build</span>, or{' '}
              <span className="text-ink">Coming soon</span> so you know what
              works today.
            </p>
          </div>

          {resolvedGroups.length === 0 ? (
            <p className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-6 text-sm text-ink/65">
              Catalog is loading. Refresh the page. If this card persists,
              we&apos;re briefly between updates and will be back shortly.
            </p>
          ) : (
            <div className="space-y-12">
              {resolvedGroups.map((group) => (
                <div key={group.title}>
                  <h2 className="mb-5 font-display text-2xl font-medium tracking-tight text-ink">
                    {group.title}
                  </h2>
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.rows.map(({ sku, withPapic }) => (
                      <li
                        key={sku.service_code}
                        className={`flex flex-col gap-3 rounded-2xl border p-6 ${
                          sku.build_status === 'live'
                            ? 'border-terracotta/40 bg-cream'
                            : sku.build_status === 'partial'
                              ? 'border-ink/15 bg-cream'
                              : 'border-ink/10 bg-ink/[0.02]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta">
                            {sku.title}
                          </p>
                          <BuildStatusChip status={sku.build_status} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`font-sans text-3xl font-semibold tracking-tight ${
                              sku.build_status === 'not_built' ? 'text-ink/40' : 'text-ink'
                            }`}
                          >
                            {formatSkuPriceLabel(sku)}
                          </span>
                          {withPapic ? (
                            <span className="inline-flex items-center rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-terracotta">
                              with Papic
                            </span>
                          ) : null}
                          {/* The "Token Worthy" badge was removed here
                              2026-08-07 with the token retirement. It rendered
                              on `is_token_able`, which is false for every row
                              in prod — so it was dark, but one catalog flag
                              away from telling a couple on the PUBLIC pricing
                              page that a vendor could buy this with tokens. */}
                        </div>
                        {sku.description ? (
                          <p className="text-sm leading-relaxed text-ink/65">{sku.description}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Papic estimator — display only, no checkout */}
          <div className="mt-12">
            <PapicEstimator rates={estimatorRates} />
          </div>
        </div>
      </section>

      {/* Complete "Free, always" list */}
      <section id="free" className="border-b border-ink/5 bg-ink/[0.02]">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="m-eyebrow">Included · Free · Explore</p>
            <LineRevealHeading className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Everything you get for free.
            </LineRevealHeading>
            <p className="text-base leading-relaxed text-ink/65">
              The complete free plan — a full planning workspace, your wedding
              website, and the tools to capture and share the day. No card, no
              trial clock.
            </p>
          </div>
          <RevealBand className="grid grid-cols-1 gap-6 sm:grid-cols-3" stagger={0.07}>
            {FREE_COLUMNS.map((col) => (
              <div
                data-reveal-item
                key={col.title}
                className="rounded-2xl border border-ink/12 bg-cream p-6"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                  {col.title}
                </p>
                <ul className="mt-4 space-y-3">
                  {col.items.map((it) => (
                    <li key={it.n} className="flex items-start gap-2">
                      <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
                      <span className="text-sm text-ink">
                        {it.n}
                        {it.note ? (
                          <span className="block text-xs text-ink/55">{it.note}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </RevealBand>
        </div>
      </section>

      {/* Apply-then-pay line */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <LineRevealHeading
            as="p"
            className="max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
          >
            You apply, then pay. The money goes straight to the service.
          </LineRevealHeading>
          {/* ⚠ "No commission on vendor bookings" is CORRECT and stays (owner
              2026-08-06): the couple pays the vendor directly and Setnayan never
              touches that money. But this page ALSO sells vendor plans, and
              "no hidden fees" beside it read to a vendor as "Setnayan charges me
              nothing" — which stops being true the moment the syncing fee is
              switched on. The fee is charged to the VENDOR for the introduction
              and the in-app sync; it is not a cut of the couple↔vendor deal, so
              both sentences are true at once — but only if the second one is
              actually said. Owner ruled a disclosure is owed; this is it.
              It is written now, BEFORE the fee is on (zero charges exist), so a
              vendor never reads "no hidden fees" on Monday and gets a fee on
              Tuesday. */}
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink/65">
            Prices are in Philippine peso. Apply for a service, then pay by GCash
            or bank transfer against a unique reference. No commission on vendor
            bookings — couples pay their vendors directly and we never sit
            between you at checkout. Vendors pay a booking fee to Setnayan on
            clients we introduce them to; it is charged to the vendor, never
            added to what a couple pays.
          </p>
          <p className="mt-5 text-xs leading-relaxed text-ink/45">
            Prices render live from the Setnayan catalog and are admin-managed.
            The free single-camera livestream and the full planner always stay
            free. Provisional pending the holistic pricing review.
          </p>
        </div>
      </section>

      {/* Storytellers — Free callout. Storytellers publish real events as
          public Chapters on /u/[slug] at no cost, forever — there is no SKU
          here (deliberately outside the catalog-driven tables above), so this
          row is static copy + a pointer to /creators. */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-terracotta/30 bg-terracotta/[0.04] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                  Storytellers — Free
                </p>
                <p className="mt-2 text-base font-semibold text-ink">
                  Publish your events as bookable Chapters. ₱0, forever.
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {[
                    'Publish free — every Chapter, every event, no fees ever',
                    'Keep your own monetization — your edit stays embedded from your channel',
                    'Vendors court you with exclusive rates in exchange for a Chapter that credits them',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
                      <span className="text-ink/80">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href="/creators"
                className="m-btn m-btn-ghost inline-flex shrink-0 items-center justify-center gap-2 self-start text-sm"
              >
                For storytellers
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Vendor pointer */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-cream p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <p className="text-base font-semibold text-ink">
              Vendor? See the free business offering + your plans.
            </p>
            <Link
              href="/vendors"
              className="m-btn m-btn-ghost inline-flex shrink-0 items-center justify-center gap-2 text-sm"
            >
              For vendors
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
