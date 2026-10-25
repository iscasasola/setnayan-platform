import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Check, Sparkles, Brush, Clock3 } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PAPIC_FREE_CREDIT_CONDITION } from '@/lib/papic-free-credit-promise';
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
import { COMMISSION_PCT, supplierCommissionShort } from '@/lib/commission-promise';
import { getLiveBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import { resolveAiPrices } from '@/app/_components/home/pricing-data';
import { BRAND_OG_IMAGES, BRAND_TWITTER_IMAGES } from '@/lib/brand-og';
import { HUB_PARTS, HUB_PART_SKUS } from '@/lib/hub-parts';
import { PASS_CARD_DESIGNS } from '@/lib/pass-card';
import { AI_TIER_SKU } from '@/lib/setnayan-ai-type-pricing';
import { ELSEWHERE, aboutPhp, elsewhereOneEventPhp } from '@/lib/pricing-elsewhere';
// The page's two dropdowns (Event Hub "Get it as", Setnayan AI's event type) — client; figures arrive formatted.
import { HubProWays, AiTypeItem, type AiTypeOption } from './_pricing-pickers';

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
/*
  ⚠ `dynamic` IS DECLARED ONCE, ON `app/(shell)/layout.tsx`, NOT HERE.
  The shared shell reads the session, so every route in this group must be
  dynamic — and a layout's `dynamic` DOES cover its children (measured: with
  the pages declaring nothing, `force-dynamic` on the group layout alone moved
  them from `○ Static` to `ƒ Dynamic` in the build table). This file used to
  carry its own copy, along with a docblock asserting a layout could not do
  this. That assertion was false. Twenty copies of one rule is twenty places
  for it to disagree with itself — do not re-add it here.
*/

/*
  ⚖ THE AUDIENCE RULE (owner 2026-09-22, R7; audit 2026-10-12 E4). This page
  sells couple software AND supplier plans, so its share lines are read by
  both. "0% commission" is a couple's unqualified truth and needs nothing beside
  it; "Suppliers keep 100%" / "Setnayan takes 0%" were SUPPLIER claims with no
  fee sentence — a supplier keeps 100% of the couple's payment and still pays
  a booking fee on couples we introduce. Those lines now carry the fee sentence;
  the couple's zero is left alone.
*/
export const metadata = {
  title: 'Pricing',
  description:
    `Plan for free. Add Setnayan AI and the software you actually use at your event, at transparent PHP prices. ${COMMISSION_PCT}% commission on supplier bookings — couples pay suppliers directly. Suppliers pay Setnayan a booking fee only on couples we introduce.`,
  alternates: { canonical: '/pricing' },
  openGraph: {
    images: BRAND_OG_IMAGES,
    title: 'Pricing · Setnayan',
    description:
      `Plan free, add the magic as you go. Transparent PHP prices. Couples pay suppliers directly — ${COMMISSION_PCT}% commission. Suppliers pay a booking fee only on couples we introduce.`,
    url: '/pricing',
    type: 'website',
    siteName: 'Setnayan',
  },
  twitter: {
    images: BRAND_TWITTER_IMAGES,
    card: 'summary_large_image',
    title: 'Pricing · Setnayan',
    description: `Plan free · add software à la carte · ${COMMISSION_PCT}% commission · suppliers pay a booking fee only on couples we introduce.`,
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

/**
 * The rows /pricing reads that `fetchV2CustomerCatalog` leaves out ON PURPOSE: the eleven Event Hub Pro parts (kept off
 * the add-on grid — they are listed inside the Event Hub Pro item's "Just the parts you need", owner 2026-10-25,
 * prototype revision 4) and Setnayan AI's price-source rows B · C · D (is_active=false — they price an event type, they
 * are not sold on their own). Read-only; an unreadable read returns no rows, and a missing row draws no figure.
 */
type PricingExtraRow = {
  service_code: string;
  retail_price_php: number | null;
  onboarding_price_php: number | null;
  is_active: boolean | null;
};
async function readPricingExtras(): Promise<PricingExtraRow[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const aiCodes = Object.values(AI_TIER_SKU).filter((c): c is string => c !== null);
  const { data, error } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code, retail_price_php, onboarding_price_php, is_active')
    .in('service_code', [...HUB_PART_SKUS, ...aiCodes]);
  if (error || !data) {
    if (error) console.error('[supabase-error] app/(shell)/pricing/page.tsx · from:platform_retail_catalog_v2 (parts + AI tiers)', error);
    return [];
  }
  return (data as PricingExtraRow[]).map((r) => ({
    service_code: r.service_code,
    retail_price_php: r.retail_price_php == null ? null : Number(r.retail_price_php),
    onboarding_price_php: r.onboarding_price_php == null ? null : Number(r.onboarding_price_php),
    is_active: r.is_active,
  }));
}

/** Setnayan AI's event-type bands, in the dropdown's words (prototype revision 4; bands `lib/setnayan-ai-type-pricing.ts`). */
const AI_TYPE_WORDS: ReadonlyArray<{ band: 'A' | 'B' | 'C' | 'D'; label: string }> = [
  { band: 'A', label: 'wedding' },
  { band: 'B', label: 'debut, corporate or gala' },
  { band: 'C', label: 'birthday, christening, most events' },
  { band: 'D', label: 'date, hangout, small get-together' },
];

/** What Event Hub Pro (everything) gives — prototype revision 4, the ten lines, each a gate of `HUB_PRO_GATES`. */
const PRO_GIVES: ReadonlyArray<{ n: string; note?: string }> = [
  { n: '7 Pro themes, for every event type', note: 'Classic, Modern and Cyber Neon stay free' },
  { n: 'Your own photos and video on the Event Hub', note: 'behind the page, behind a scene, in a scene' },
  { n: 'Background music and a video at the top' },
  { n: 'The cinematic reveal', note: 'every opening and its effects' },
  { n: 'Style, decorations and animation for every part', note: 'and the \u201cWhen yes\u201d moment — confetti, fireworks, petals, sparklers' },
  { n: 'Your logo animated, and on every QR', note: 'shape, pattern and colour too' },
  { n: '500 MB of your own media', note: 'instead of 10 MB' },
  { n: 'Prints in your Event Hub look, the whole designed set in one download', note: 'one guest ticket at a time, and the QR sheet, stay free' },
  { n: 'Photos in your Love Story, and more than 5 moments' },
  { n: 'No \u201cPowered by Setnayan\u201d where your guests look' },
];

/** One "What you can add" item: name (with its ⓘ when it has one), a one-line what, and the figure + its billing. */
function AddItem({
  code,
  name,
  tip,
  what,
  price,
  from = false,
  bill,
  star = false,
  children,
}: {
  code: string;
  name: string;
  tip?: ReactNode;
  what: string;
  price: string | null;
  from?: boolean;
  bill: string;
  star?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="border-t border-ink/10 pb-[15px] pt-4 first:border-t-0 first:pt-1" data-pricing-item={code}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {tip ? (
            <InfoTip label={name} labelClassName="text-[17px] font-semibold leading-tight tracking-[-0.01em]" align="start">
              {tip}
            </InfoTip>
          ) : (
            <p className="text-[17px] font-semibold leading-tight tracking-[-0.01em]">
              {star ? (
                <span aria-hidden className="mr-1 align-[2px] text-[13px] text-terracotta-700">
                  ◆
                </span>
              ) : null}
              {name}
            </p>
          )}
          <p className="mt-[3px] text-[13.5px] leading-snug text-ink/65">{what}</p>
        </div>
        {price ? (
          <div className="shrink-0 text-right">
            <span className="block whitespace-nowrap text-[19px] font-bold leading-none tracking-[-0.02em]">
              {from ? <span className="mr-[3px] text-xs font-medium tracking-normal text-ink/65">from</span> : null}
              {price}
            </span>
            <span className="mt-1 block whitespace-nowrap text-[11px] text-ink/65">{bill}</span>
          </div>
        ) : null}
      </div>
      {children}
    </li>
  );
}

/** One "What you'd pay for elsewhere" line: the free thing, FREE, and the elsewhere fact in bold before our line. */
function ElsewhereLine({ n, elsewhere, here, tip }: { n: string; elsewhere: ReactNode; here: string; tip: ReactNode }) {
  return (
    <li className="border-t border-ink/10 pb-[13px] pt-3.5 first:border-t-0 first:pt-0.5" data-elsewhere-line>
      <div className="flex items-baseline justify-between gap-2.5">
        <InfoTip label={n} labelClassName="text-xl font-semibold leading-tight tracking-[-0.015em]" align="start">
          {tip}
        </InfoTip>
        <span className="whitespace-nowrap font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-terracotta-700">
          Free
        </span>
      </div>
      <p className="mt-[5px] text-[13.5px] leading-snug text-ink/65">
        <b className="font-semibold text-ink">{elsewhere}</b> {here}
      </p>
    </li>
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
      // PABATI was RETIRED on 2026-08-21 (owner: "we do not need pabati. retire
      // it because it is part of papic"), superseding the free ruling made
      // hours earlier the same day. It is GONE, not merely off sale — the
      // surface, the API, the table and the RPCs are deleted — so unlike KWENTO
      // below its code is NOT kept listed here: this list drives what a couple
      // can be shown, and a row for a product that no longer exists is a fake
      // door. The lineage lives in lib/v2-catalog.ts, the same place the LED
      // wall backdrop's does.
      // KWENTO is FREE for every event since 2026-08-21 (owner: "kwento is
      // free") — is_active=false, so it drops out of resolvedGroups
      // automatically and no longer appears among the paid rows, which is
      // correct: this page lists what you PAY for. The feature is still on for
      // everyone (entitlements FREE_FOR_ALL_SKUS) and llms.txt describes it as
      // free. Code kept listed — same convention as LIVE_WALL below — so the
      // change is legible here rather than looking like an accidental deletion.
      { code: 'KWENTO', withPapic: true }, // FREE 2026-08-21 — no longer a paid row
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
      // ⭐ THE UNIFIED LIVE STUDIO SKU — ₱3,000 PER EVENT (owner-locked 2026-07-25 ·
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
      { code: 'LIVE_STUDIO' }, // Live Studio — once per event, unlimited streams (LS6, 2026-09-02) — the unified switching SKU
      // ~~PANOOD_SYSTEM~~ (Cast, ₱2,500/day) is **RETIRED** — is_active=false via
      // migration 20271005180040 (PR #3716), because Wave 6's ownership alias
      // LIVE_STUDIO ← PANOOD_SYSTEM let a ₱2,500 Cast order collect the ₱3,000 unified
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
      { code: 'SEATING_3D' }, // FREE 2026-09-05 — no longer a paid row (was activated 2026-07-10)
    ],
  },
  {
    title: 'Your Event Hub',
    items: [
      // Website PRO REACTIVATED (owner 2026-07-22): the umbrella
      // and the ONLY way to get Editorial PRO + the Cinematic Reveal, both now
      // bundle-only (is_active=false → their standalone rows auto-drop from
      // resolvedGroups). COUPLE_WEBSITE_PRO must be LISTED here or the reactivated
      // umbrella never appears (resolvedGroups only renders codes in a group).
      { code: 'COUPLE_WEBSITE_PRO' }, // Website PRO — price read from the catalogue; includes Reveal + Editorial PRO
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
  const [customerSkus, vendorSkus, papicTierConfig, papicOneTiers, papicFreeOnePoints, feeSchedule, pricingExtras] =
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
      // The LIVE supplier booking-fee schedule, for the supplier-plan
      // structured data (never the code default — audit 2026-10-12, item 5).
      getLiveBookingFeeSchedule(),
      // The Event Hub Pro parts + Setnayan AI's event-type bands (see `readPricingExtras`).
      readPricingExtras(),
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
  // (1 photo = 1 pt · one 10-second clip = the constant in lib/papic-cameras-pure.ts),
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
            `A camera of its own for someone you trust — its own QR, and credits ` +
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
      // Short bucket label from the catalog title ("Papic — add 3,000 credits" →
      // "add 3,000 credits"); never a hardcoded shot count.
      //
      // ⚠ The old strip was /^Papic Pool\s*[—-]\s*/ and the titles were renamed
      // to "Papic — add N shots" when the two products became one. It stopped
      // matching, so the page rendered "₱1,000 to Papic — add 3,000 credits".
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
            `One shared pool of credits that every guest's phone can spend from — ` +
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

  // ── FREE HERE, PAID ELSEWHERE · PAY ONLY FOR THE UPGRADES YOU NEED (owner 2026-10-25) ─────────────────
  // Approved prototype `prototypes/pricing_free_plus_addons_2026-10-25/index.html` (corpus 20b2a55c, revision 4).
  // 🔑 EVERY PESO OF OURS IS READ from platform_retail_catalog_v2 (an unreadable row draws no figure); every OTHER
  // site's figure is `lib/pricing-elsewhere.ts`, sourced and dated, and no competitor is named.
  //
  // Event Hub Pro (COUPLE_WEBSITE_PRO): both prices through the SAME resolver as Setnayan AI's (`resolveAiPrices` is
  // generic over the row: NULL sign-up = no discount, a sign-up at/above regular is ignored, unreadable = no figure).
  const proRow = customerSkus.find((s) => s.service_code === 'COUPLE_WEBSITE_PRO');
  const pro = resolveAiPrices(proRow);
  const proRegularLabel = pro.regularPhp > 0 ? `₱${formatPeso(pro.regularPhp)}` : null;
  const proSignupLabel = pro.hasSignupPrice ? `₱${formatPeso(pro.introPhp)}` : null;
  const rowPrice = (code: string): string | null => {
    const row = customerSkus.find((s) => s.service_code === code);
    const php = row ? Number(row.retail_price_php) : NaN;
    return Number.isFinite(php) && php > 0 ? `₱${formatPeso(php)}` : null;
  };
  // Live Watch (LIVE_STUDIO): absent from the catalogue read while its launch switch is off — then the item is not drawn.
  const liveWatchRow = customerSkus.find((s) => s.service_code === 'LIVE_STUDIO');
  const liveWatchPrice = rowPrice('LIVE_STUDIO');
  // Patiktok is PAID PER DAY (owner 2026-10-25: "Patiktok has a per day amount.") — the figure AND its billing words
  // come from the row (`billing_period`).
  const patiktokRow = customerSkus.find((s) => s.service_code === 'PATIKTOK_COMPILER');
  const patiktokPrice = rowPrice('PATIKTOK_COMPILER');
  const patiktokPerDay = patiktokRow?.billing_period === 'per_day';
  const patiktokBill = patiktokPerDay
    ? 'per day of your event'
    : `one-time${formatBillingPeriodSuffix(patiktokRow?.billing_period)}`;
  const musicMakerRow = customerSkus.find((s) => s.service_code === 'PAKANTA');
  const musicMakerPrice = rowPrice('PAKANTA');
  const papicFromLabel = papicPoolBuckets.length
    ? `₱${formatPeso(papicPoolBuckets[0]!.pricePhp)}`
    : null;
  // "₱70 adds 100 credits, ₱700 adds 1,000, ₱4,500 adds 10,000 — bigger packs too." — every rung read, first three said.
  const papicRungWords = papicPoolBuckets
    .slice(0, 3)
    .map((b) => `₱${formatPeso(b.pricePhp)} ${b.label.replace(/^add\b/i, 'adds')}`)
    .join(', ');

  // The parts (COUPLE_HUB_PART_*) and Setnayan AI's bands — one extra read, see `readPricingExtras`.
  const extraByCode = new Map(pricingExtras.map((r) => [r.service_code, r]));
  const hubParts = HUB_PARTS.map((part) => {
    const row = extraByCode.get(part.sku);
    const php = row && row.is_active ? Number(row.retail_price_php) : NaN;
    return Number.isFinite(php) && php > 0 ? { part, php } : null;
  }).filter((x): x is { part: (typeof HUB_PARTS)[number]; php: number } => x !== null);
  const hubPartFromLabel = hubParts.length ? `₱${formatPeso(Math.min(...hubParts.map((x) => x.php)))}` : null;
  const aiOptions: AiTypeOption[] = AI_TYPE_WORDS.map(({ band, label }) => {
    const code = AI_TIER_SKU[band];
    const row = code === 'SETNAYAN_AI' ? setnayanAi : code ? extraByCode.get(code) : undefined;
    const prices = resolveAiPrices(row ? { retail_price_php: Number(row.retail_price_php), onboarding_price_php: row.onboarding_price_php } : null);
    if (prices.regularPhp <= 0) return null;
    return {
      key: band,
      label,
      regular: `₱${formatPeso(prices.regularPhp)}`,
      signup: prices.hasSignupPrice ? `₱${formatPeso(prices.introPhp)}` : null,
    };
  }).filter((o): o is AiTypeOption => o !== null);

  // What other event sites charge — `lib/pricing-elsewhere.ts` (sources + read date there). Numbers only, formatted here.
  const elsewhereGuests = `${ELSEWHERE.freeGuestCapLow.value}–${ELSEWHERE.freeGuestCapHigh.value} guests`;
  const elsewhereSiteAbout = `₱${formatPeso(aboutPhp(ELSEWHERE.siteFull.value))}`;
  const elsewhereLiveAbout = `₱${formatPeso(aboutPhp(ELSEWHERE.livestreamBusiness.value))}–₱${formatPeso(aboutPhp(ELSEWHERE.livestreamPersonal.value))}`;

  // Estimator inputs — the SAME derived ladder the description above renders
  // (rungs + rates + per-rung capacity + per-rung WEDDING cap). Nothing about
  // Papic capacity or caps is spelled here. Add-on prices come from the catalog.
  const rateOf = (code: string, fb: number) =>
    Number(customerSkus.find((s) => s.service_code === code)?.retail_price_php ?? fb);
  const estimatorAddonDefs: Array<{ key: string; code: string; label: string; fb: number }> = [
    { key: 'cb', code: 'CAMERA_BRIDGE', label: 'Camera Bridge · DSLR', fb: 500 }, // owner 2026-07-11 (was 499)
    // Kwento owner-locked FREE 2026-07-08 → deactivating the catalog row drops
    // it from the estimator (filter below); fb 0 guards a lingering
    // null-priced row from showing a stale paid figure. Pabati sat beside it
    // until 2026-08-21, when it was retired out of the product entirely.
    { key: 'kwento', code: 'KWENTO', label: 'Photo Notes', fb: 0 },
    // Pakanta (custom wedding song, 0036) is NOT a Papic add-on — deliberately
    // excluded from the per-camera Papic estimator (owner 2026-07-10).
  ];
  // ⚠ THE ESTIMATOR NO LONGER PRICES A SECOND PRODUCT. It used to carry a
  // dedicated-camera rung (`one`) plus its free-camera allowance, and drew a
  // two-way switch between that and the shared pot. Owner 2026-08-26: *"we do
  // not have papic one or papic pool. no 2 ways of papic service. just 1."*
  // Setting shots aside for one camera is a FEATURE of the single pot, done
  // inside the event — not a thing to choose between here.
  const estimatorRates: EstimatorRates = {
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
        { n: 'Seat plan', note: '2D layout + 3D walkthrough' },
        { n: 'Mood board' },
        { n: 'Printable plans' },
      ],
    },
    {
      title: 'Your free Event Hub',
      items: [
        { n: 'Save-the-Date page' },
        { n: 'RSVP page', note: 'unlimited RSVP collection' },
        { n: 'Event / on-the-day page' },
        { n: 'Story page' },
      ],
    },
    {
      title: 'Capture & share',
      items: [
        { n: 'Browse suppliers + match preview' },
        { n: 'Single-camera livestream', note: 'to YouTube, auto-archived' },
        { n: 'Custom QR for every guest', note: 'free per-guest QR' },
        { n: 'Memories', note: 'every event’s photos in one place' },
        { n: '0% commission on supplier bookings' },
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
          // A supplier plan, read by suppliers: the zero owes its second
          // sentence, at the LIVE rate (audit 2026-10-12, items 5 + 6).
          description: `${s.title} · Setnayan supplier subscription ${cadence.shortLabel}. ${supplierCommissionShort(feeSchedule)}.`,
          provider: ORGANIZATION_REF,
          category: 'Wedding supplier subscription',
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
    /*
      The shared shell. ⚠ THIS PAGE OWNS NO <main> — measured live, main=0 — so
      the wrapper below becomes one: the doorway variant yields the landmark to
      the host, and a page with none would end up with zero.
    */
    <main className="min-h-screen bg-cream text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />

      {/* HERO · the one message (owner 2026-10-25, verbatim: "make sure they see that while Other websites pay for these
          services, we give it for free. And only pay what you need to upgrade."). Prototype
          `pricing_free_plus_addons_2026-10-25`, revision 4. */}
      <section className="border-b border-ink/5">
        <div /* The tall top padding existed to clear the FIXED glass nav. That nav no
             longer renders here (this page left NAV_ROUTES with the shell
             conversion), so keeping it would leave ~128px of dead cream above
             the first heading. */
          className="mx-auto w-full max-w-5xl px-4 pt-10 pb-11 sm:px-6 sm:pt-10 sm:pb-16 lg:px-8 lg:pb-20">
          <p className="m-eyebrow">Set na &apos;yan · Pricing</p>
          <LineRevealHeading
            as="h1"
            trigger="mount"
            className="mt-4 text-balance font-display text-[46px] font-medium leading-[1.02] tracking-[-0.035em] sm:text-7xl lg:text-[88px]"
          >
            Free here. Paid elsewhere.{' '}
            <span className="text-ink/55">Pay only for the upgrades you need.</span>
          </LineRevealHeading>
          <p className="mt-6 max-w-2xl text-[19px] leading-[1.45] text-ink/65">
            Unlimited guests, the Event Hub your guests open, the whole planner — what other event sites charge for,
            you get free. Add an upgrade only when you want one.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="m-btn m-btn-primary">
              Start free
            </Link>
            <Link href="#add" className="m-btn m-btn-ghost">
              What you can add ↓
            </Link>
          </div>
        </div>
      </section>

      {/* FREE · proves the first half. Five sourced "elsewhere" lines (figures + sources: lib/pricing-elsewhere.ts — no
          competitor is named), the printables, one place instead of several tools, then the rest of the planner. Nothing
          here is pressable but the ⓘ and the two buttons, so nothing else wears a frame. Guarded by
          `pricing-free-plus-addons.test.ts`. */}
      <section id="plans" className="border-b border-ink/5 bg-ink/[0.02]" data-pricing-free>
        <div className="mx-auto w-full max-w-3xl px-4 pb-9 pt-11 sm:px-6 sm:py-20 lg:px-8">
          <p className="m-eyebrow">Free</p>
          <LineRevealHeading className="mt-4 text-balance text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-5xl">
            What you&rsquo;d pay for elsewhere.
          </LineRevealHeading>
          <p className="mt-2.5 text-[15.5px] leading-normal text-ink/65">
            Five things other event sites charge for — free here, for every event, with no guest cap and no trial clock.
          </p>
          <ul className="mt-5">
            <ElsewhereLine
              n="Unlimited guests & RSVPs"
              elsewhere={`Elsewhere, free plans stop at ${elsewhereGuests}.`}
              here="Here every guest replies by link, no sign-in, no cap."
              tip={
                <>
                  Other event sites&rsquo; free plans cap the guest list at {ELSEWHERE.freeGuestCapLow.value} to{' '}
                  {ELSEWHERE.freeGuestCapHigh.value} guests and charge about {elsewhereSiteAbout} to lift it. Ours has
                  no cap: as many guests and replies as your event has, free.
                </>
              }
            />
            <ElsewhereLine
              n="The Event Hub your guests open"
              elsewhere={`Elsewhere, about ${elsewhereSiteAbout} for the full version.`}
              here="Free here in its plain design — Save-the-Date, RSVP, the day’s page and your story."
              tip={
                <>
                  The plain design is complete and free: the page is written from your details, in Classic, Modern or
                  Cyber Neon, with our pictures and your words. Making it <b>yours</b> — your photos, music, themes and
                  logo — is{' '}
                  <a href="#add" className="font-semibold text-mulberry">
                    Event Hub Pro ↓
                  </a>
                  , or just the parts you need.
                </>
              }
            />
            <ElsewhereLine
              n="Seat plan, with the 3D walkthrough"
              elsewhere={`Elsewhere, seating charts are a paid upgrade past ${ELSEWHERE.seatingTrialGuests.value} guests, and 3D seating is an enterprise feature.`}
              here="Here both are free."
              tip="Lay the room out in 2D, then walk it in 3D before you publish. Guests find their seat on their own pass once the plan is published."
            />
            <ElsewhereLine
              n="Door check-in by QR"
              elsewhere="Elsewhere, check-in comes with a paid plan."
              here="Here the door scans each guest’s own QR, on the day, free."
              tip="Every accepted guest carries their own QR on their pass. On the day, your door crew opens the check-in desk on a phone and scans — arrivals, plus-ones and tables, live, no app to install."
            />
            <ElsewhereLine
              n="Livestream from one camera"
              elsewhere={`Elsewhere, about ${elsewhereLiveAbout} per event.`}
              here="Here one camera streams free, for everyone who can’t be there."
              tip={
                <>
                  One camera, live to your guests, free. Every camera at once — a directed Main Stage plus switchable
                  guest cameras — is{' '}
                  <a href="#add" className="font-semibold text-mulberry">
                    Live Watch ↓
                  </a>
                  .
                </>
              }
            />
            <ElsewhereLine
              n="Printables for your event"
              elsewhere="Guest registry, guest QR codes, seat plan, table signs & place cards, entrance chart, caterer meal counts, event QR"
              here="— print-ready, free."
              tip={
                <>
                  Save each as a PDF (the seat plan in your colours or as a blueprint; meal counts as a spreadsheet too)
                  and print it anywhere. <b>Prints dressed in your Event Hub look</b> — your theme on every sheet — are{' '}
                  <a href="#add" className="font-semibold text-mulberry">
                    Event Hub Pro ↓
                  </a>
                  , or its Prints part.
                </>
              }
            />
          </ul>

          <p className="mt-[18px] font-mono text-[11px] uppercase tracking-[0.14em] text-ink/65">
            One place, instead of several tools
          </p>
          <ul className="mt-2.5 text-[13.5px]" data-elsewhere-combo>
            {[
              { n: 'Event website, unlimited guests & RSVPs', elsewhere: `₱${formatPeso(ELSEWHERE.siteFull.value)}` },
              { n: 'Livestream, one camera', elsewhere: `₱${formatPeso(ELSEWHERE.livestreamPersonal.value)}` },
              { n: 'Seating chart, 2D and 3D', elsewhere: 'extra' },
              { n: 'Door check-in by QR', elsewhere: 'extra' },
            ].map((r) => (
              <li key={r.n} className="grid grid-cols-[1fr_92px_44px] items-baseline gap-2 border-t border-ink/5 py-[7px] first:border-t-0">
                <span>{r.n}</span>
                <span className="whitespace-nowrap text-right text-ink/65">{r.elsewhere}</span>
                <span className="whitespace-nowrap text-right font-bold text-terracotta-700">₱0</span>
              </li>
            ))}
            <li className="mt-1 grid grid-cols-[1fr_92px_44px] items-baseline gap-2 border-t border-ink pt-2.5 text-sm">
              <InfoTip label="For one event" align="start">
                The &ldquo;elsewhere&rdquo; figure adds two per-event prices from other event sites: a site with
                unlimited guests, and a one-camera livestream. Seating and check-in are sold there as business
                subscriptions, so they are left out of the sum and marked &ldquo;extra&rdquo; — the real gap is wider.
                Here all four are free, for every event.
              </InfoTip>
              <span className="whitespace-nowrap text-right">
                <b>at least ₱{formatPeso(elsewhereOneEventPhp())}</b>
                <small className="block text-[10.5px] font-normal tracking-[0.02em] text-ink/65">elsewhere</small>
              </span>
              <span className="whitespace-nowrap text-right font-bold text-terracotta-700">
                <b>₱0</b>
                <small className="block text-[10.5px] font-normal tracking-[0.02em] text-ink/65">here</small>
              </span>
            </li>
          </ul>

          <p className="mt-[18px] font-mono text-[11px] uppercase tracking-[0.14em] text-ink/65">
            And the rest of the planner
          </p>
          <ul className="mt-2.5 grid grid-cols-2 gap-x-3.5 gap-y-2 text-[13.5px] leading-tight">
            {[
              { n: 'Budget & schedule' },
              { n: 'Suppliers', note: `find, compare, book · ${COMMISSION_PCT}% commission` },
              { n: 'Guest tickets', note: `each guest’s own pass, ${PASS_CARD_DESIGNS.length} styles` },
              { n: 'Memories', note: 'every photo in one place' },
              {
                n: 'Papic · unlimited cameras',
                note: `every photo uses credits · free credits ${PAPIC_FREE_CREDIT_CONDITION}`,
                wide: true,
              },
            ].map((r) => (
              <li key={r.n} className={`flex items-start gap-[7px]${r.wide ? ' col-span-2' : ''}`}>
                <span aria-hidden className="-mt-px shrink-0 font-bold text-terracotta-700">
                  ✓
                </span>
                <span>
                  {r.n}
                  {r.note ? <small className="mt-px block text-[11.5px] leading-tight text-ink/65">{r.note}</small> : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="m-btn m-btn-primary">
              Start free
            </Link>
            <Link href="#free" className="text-sm font-semibold text-ink/65 hover:text-ink">
              Everything that&rsquo;s free ↓
            </Link>
          </div>
        </div>
      </section>

      {/* WHAT YOU CAN ADD · proves the second half: each upgrade its own purchase, its own figure from its own catalogue
          row. Event Hub Pro as Everything or part by part (one dropdown). Guarded by `pricing-free-plus-addons.test.ts`. */}
      <section id="add" className="border-b border-ink/5" data-pricing-add>
        <div className="mx-auto w-full max-w-3xl px-4 pb-9 pt-11 sm:px-6 sm:py-20 lg:px-8">
          <p className="m-eyebrow">What you can add</p>
          <LineRevealHeading className="mt-4 text-balance text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-5xl">
            Pay only for the upgrades you need.
          </LineRevealHeading>
          <p className="mt-2.5 text-[15.5px] leading-normal text-ink/65">
            Each one is its own purchase — none of them includes another. For this event and everyone on it.
          </p>
          <ul className="mt-5">
            {proRegularLabel ? (
              <AddItem
                code="COUPLE_WEBSITE_PRO"
                name="Event Hub Pro"
                star
                what="Make the Event Hub yours — your photos, music, themes and logo, no Setnayan mark."
                price={proRegularLabel}
                bill="one-time · per event"
              >
                {proSignupLabel ? (
                  <p className="mt-[9px] text-[13px] leading-snug text-ink">
                    <b className="font-bold text-mulberry">{proSignupLabel} while you set up your event</b>
                    {' '}— {proRegularLabel} after.
                  </p>
                ) : null}
                <HubProWays
                  everythingLabel={`Everything · ${proRegularLabel}`}
                  partsLabel={hubPartFromLabel ? `Just the parts you need · from ${hubPartFromLabel}` : null}
                  everything={
                    <>
                      <ul className="mt-3 text-[13.5px] leading-snug">
                        {PRO_GIVES.map((g) => (
                          <li key={g.n} className="flex items-start gap-2 border-t border-ink/5 py-1.5 first:border-t-0">
                            <span aria-hidden className="mt-1 shrink-0 text-[10px] text-terracotta-700">
                              ◆
                            </span>
                            <span>
                              {g.n}
                              {g.note ? <small className="mt-px block text-xs leading-snug text-ink/65">{g.note}</small> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2.5 border-t border-ink/10 pt-2.5 text-[12.5px] leading-snug text-ink/65">
                        <b className="font-semibold text-ink">One unlock covers everyone on the event</b> — every host
                        sees the Pro version.
                      </p>
                    </>
                  }
                  parts={
                    <>
                      <ul className="mt-3 text-[13.5px]" data-hub-parts>
                        {hubParts.map(({ part, php }) => (
                          <li key={part.id} className="flex items-start justify-between gap-2.5 border-t border-ink/5 py-[7px] first:border-t-0">
                            <span className="font-semibold leading-tight">
                              {part.name}
                              <small className="mt-px block text-xs font-normal leading-snug text-ink/65">{part.blurb}</small>
                            </span>
                            <span className="whitespace-nowrap font-bold tracking-[-0.01em]">
                              <i aria-hidden className="mr-1 align-[1px] text-[10px] not-italic text-terracotta-700">
                                ◆
                              </i>
                              ₱{formatPeso(php)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2.5 border-t border-ink/10 pt-2.5 text-[12.5px] leading-snug text-ink/65">
                        <b className="font-semibold text-ink">What you pay for parts counts toward {proRegularLabel}.</b>{' '}
                        At {proRegularLabel} everything unlocks, and the &ldquo;Powered by Setnayan&rdquo; footer comes
                        off. Each part is for this event and everyone on it.
                      </p>
                    </>
                  }
                />
              </AddItem>
            ) : null}
            {papicFromLabel ? (
              <AddItem
                code="PAPIC_GUEST"
                name="Papic credits"
                tip={
                  <>
                    <b>One shared pot.</b> Every guest&rsquo;s camera spends from it; every top-up stacks on what the
                    event already holds. {papicRungWords}
                    {papicPoolBuckets.length > 3 ? ' — bigger packs too' : ''}. Free credits {PAPIC_FREE_CREDIT_CONDITION}.
                  </>
                }
                what="Top up the pot every guest’s camera spends from."
                price={papicFromLabel}
                from
                bill="credits · top up any time"
              />
            ) : null}
            {liveWatchRow && liveWatchPrice ? (
              <AddItem
                code="LIVE_STUDIO"
                name="Live Watch"
                tip={
                  <>
                    Every camera streams live for the guests who can&rsquo;t be there — one directed Main Stage plus
                    switchable guest cameras; phones join by the event QR, no install. Unlimited streams, no day limit.{' '}
                    <b>Livestream from one camera stays free.</b>
                  </>
                }
                what="Every camera live, for everyone who can’t be there."
                price={liveWatchPrice}
                bill="one unlock · stays with the event"
              />
            ) : null}
            {patiktokPrice ? (
              <AddItem
                code="PATIKTOK_COMPILER"
                name="Patiktok"
                tip={`Turns the moments from your event into a short, vertical highlight reel, set to music — you pick the moments, the length and a song, and it renders in your browser.${patiktokPerDay ? ' Paid per day of your event.' : ''}`}
                what="Your moments cut into short, vertical highlight reels."
                price={patiktokPrice}
                bill={patiktokBill}
              />
            ) : null}
            {musicMakerRow && musicMakerPrice ? (
              <AddItem
                code="PAKANTA"
                name="Music Maker"
                what="Your own song, made for the event."
                price={musicMakerPrice}
                bill="one-time · per event"
              />
            ) : null}
            {aiOptions.length > 0 ? (
              <AiTypeItem
                name="Setnayan AI"
                tip={
                  <>
                    <b>Priced by event type.</b> A paid planner, not a chatbot: it suggests a team of verified suppliers
                    by fit, then tracks your deadlines, payments, budget and dates and tells you the one thing to do
                    next. One unlock, until the event day. Cheaper while you set up your event.
                  </>
                }
                what="Suggests your best-fit team, then watches your plan."
                bill={`one-time · until the event day${aiPeriod}`}
                options={aiOptions}
              />
            ) : null}
          </ul>
          <p className="mt-[18px] border-t border-ink pt-3.5 text-[13.5px] leading-normal text-ink">
            <b className="font-semibold">Each of these is bought on its own, Event Hub Pro included.</b> Buying one never
            includes another, and there is no bundle. Paid once for the event and everyone on it
            {patiktokPerDay ? ' — except Patiktok, which is paid per day' : ''}.
          </p>
          <p className="mt-3.5 text-[12.5px] leading-normal text-ink/65">
            <i className="font-semibold text-terracotta-700">Set na &rsquo;yan</i> — no subscription. Prices are in
            Philippine peso, read live from the Setnayan catalogue.
          </p>
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
              The complete free plan — a full planning workspace, your Event
              Hub, and the tools to capture and share the day. No card, no
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
            or bank transfer against a unique reference. No commission on supplier
            bookings — couples pay their suppliers directly and we never sit
            between you at checkout. Suppliers pay a booking fee to Setnayan on
            clients we introduce them to; it is charged to the supplier, never
            added to what a couple pays.
          </p>
          <p className="mt-5 text-xs leading-relaxed text-ink/45">
            Prices render live from the Setnayan catalog and are admin-managed.
            The free single-camera livestream and the full planner always stay
            free.
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
                    'Suppliers court you with exclusive rates in exchange for a Chapter that credits them',
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
              Supplier? See the free business offering + your plans.
            </p>
            <Link
              href="/for-suppliers"
              className="m-btn m-btn-ghost inline-flex shrink-0 items-center justify-center gap-2 text-sm"
            >
              For suppliers
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
