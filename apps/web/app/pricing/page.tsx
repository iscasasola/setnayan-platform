import Link from 'next/link';
import { ArrowRight, Check, Sparkles, Brush, Clock3, Globe, Coins, Radio, Users } from 'lucide-react';
import { Logo } from '@/app/_components/logo';
import {
  fetchV2CustomerCatalog,
  fetchV2BundleCatalog,
  fetchV2VendorCatalog,
  formatPeso,
  formatSkuPriceLabel,
  BUILD_STATUS_LABEL,
  type V2CustomerSku,
  type BuildStatus,
} from '@/lib/v2-catalog';
// Client motion island — the page stays an async Server Component (data fetch +
// JSON-LD @graph below are untouched); these thin wrappers only attach the
// premium reveal/panel refs to server-passed children. See _pricing-motion.tsx.
import {
  RevealBand,
  LineRevealHeading,
  CatalogPanel,
} from './_pricing-motion';

/**
 * Force dynamic rendering · skip static prerender.
 *
 * WHY: this page calls fetchV2CustomerCatalog / fetchV2BundleCatalog /
 * fetchV2VendorCatalog from lib/v2-catalog.ts. Those helpers call
 * createAdminClient (lib/supabase/admin.ts) which throws "Missing SUPABASE
 * env vars for admin client" when SUPABASE_SERVICE_ROLE_KEY is unset — the
 * case in GitHub Actions `production build` (.github/workflows/ci.yml runs
 * `next build` with placeholder NEXT_PUBLIC_* env only · no service-role
 * key). Static prerender invokes the page at build time, hits the throw,
 * fails the build · the same failure repeats on every PR merge to main,
 * which the owner observed as an "endless loop" of red CI runs.
 *
 * Per-request rendering is also semantically correct: catalog rows live in
 * setnayan-prod and shift without a redeploy (V2 cutover-day SKU swaps,
 * eleventh-row annual subscriptions, etc.). Baking the catalog into static
 * HTML would stale on every catalog edit until the next deploy.
 *
 * Locked CLAUDE.md 2026-05-28 row "fix endless loop error on vercel".
 * Pairs with the try/catch around createAdminClient in lib/v2-catalog.ts
 * fetchers — if a future page forgets this directive, the fetcher still
 * degrades to empty array instead of 500'ing the prerender.
 */
export const dynamic = 'force-dynamic';

/**
 * /pricing — V2 customer-side pricing surface.
 *
 * Sourced live from the 3 V2 catalog tables:
 *   - platform_retail_catalog_v2  (19 customer SKUs · is_token_able flag)
 *   - platform_package_catalog    (2 bundles · Guided Pack + Media Pack)
 *   - vendor_billing_catalog      (2 vendor subs + 5 token packs)
 *
 * What changed from the V1 page (rewritten 2026-05-28):
 *   - Removed Setnayan Concierge ₱2,499 / 3-day trial hero · Setnayan AI is
 *     now a paid software SKU bought from the customer catalog like any other
 *   - Removed launch promo · the V2 SKUs are paid full price
 *   - Removed flat 5.0% Setnayan Pay worked example · per owner directive,
 *     Setnayan takes ZERO commission on vendor bookings · vendors transact
 *     directly with customers off-platform
 *   - Added free website surfaces for both audiences:
 *       customer site at setnayan.com/{slug}
 *       vendor site  at {slug}.setnayan.com
 *   - Each customer SKU carries a build_status chip (Live · Partial · Coming
 *     soon) so we render what actually works, not what we wish worked
 */

// Pricing copy realigned 2026-06-13 to the owner-locked 2026-06-07 4-tier
// model (Pricing.md § 00): start free on the planning workspace, pay for
// Setnayan AI + the software you add. No "free website / free RSVP" claims —
// those SKUs are paid (owner reversals § 00.D).
export const metadata = {
  title: 'Pricing — Setnayan',
  description:
    'Start planning free. Software you actually use at your event, at transparent PHP prices. No commission on vendor bookings — vendors keep 100%.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing — Setnayan',
    description:
      'Start free, add the software you want. Transparent PHP prices. Vendors transact directly — Setnayan takes 0%.',
    url: '/pricing',
    type: 'website',
    siteName: 'Setnayan',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing — Setnayan',
    description: 'Software at retail · vendors keep 100% · 0% commission on bookings.',
  },
};

// Build-status chip — honest about what's wired vs catalog-only.
function BuildStatusChip({ status }: { status: BuildStatus }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cream">
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

// Group customer SKUs by build_status so the page renders Live first, then
// Partial, then Coming soon. Within each group, alphabetic by title for
// scanability.
function groupByStatus(skus: Array<V2CustomerSku>): Record<BuildStatus, Array<V2CustomerSku>> {
  const groups: Record<BuildStatus, Array<V2CustomerSku>> = {
    live: [],
    partial: [],
    not_built: [],
  };
  for (const sku of skus) {
    groups[sku.build_status].push(sku);
  }
  for (const key of Object.keys(groups) as Array<BuildStatus>) {
    groups[key].sort((a, b) => a.title.localeCompare(b.title));
  }
  return groups;
}

export default async function PricingPage() {
  // Reads in parallel · helpers return [] on error, so the page still
  // renders a polite empty state rather than 500'ing.
  // Bundles (Essentials/Complete) stay PURCHASABLE ONLY during onboarding
  // (owner 2026-06-08 — "never sold outside"): the tier overview below
  // PRESENTS the locked 4-tier model (Pricing.md § 00 · 2026-06-07) for price
  // transparency + GEO coherence, but carries no buy path — the only place a
  // bundle can be bought remains the onboarding flow.
  const [customerSkus, bundles, vendorSkus] = await Promise.all([
    fetchV2CustomerCatalog(),
    fetchV2BundleCatalog(),
    fetchV2VendorCatalog(),
  ]);

  const grouped = groupByStatus(customerSkus);

  // 4-tier model (owner-locked 2026-06-07 · Pricing.md § 00.A). Tier prices
  // read live: Setnayan AI from platform_retail_catalog_v2 · Essentials
  // (GUIDED_PACK) + Complete (MEDIA_PACK) from platform_package_catalog.
  const setnayanAi = customerSkus.find((s) => s.service_code === 'SETNAYAN_AI');
  const essentialsBundle = bundles.find((b) => b.package_code === 'GUIDED_PACK');
  const completeBundle = bundles.find((b) => b.package_code === 'MEDIA_PACK');

  // Panood is TWO tiers, not one paid product (owner-locked model):
  //   (a) FREE single-camera livestream — the couple goes live to their own
  //       YouTube from a phone/laptop, it embeds free on the event page, and
  //       auto-archives. ₱0, available to everyone, no purchase.
  //   (b) PAID multicam control room (PANOOD_SYSTEM) — multiple phone cameras,
  //       live switching, one-tap Moment-Director, overlays, routing to every
  //       venue screen. The upgrade. Price reads LIVE from the catalog row
  //       (formatSkuPriceLabel · never hardcoded).
  // The dedicated callout below frames both; the PANOOD_SYSTEM card also still
  // appears in the software catalog grid as the upgrade's catalog listing.
  const panoodSystem = customerSkus.find((s) => s.service_code === 'PANOOD_SYSTEM');

  const vendorSubs = vendorSkus.filter((s) => s.offering_type === 'subscription_monthly');
  const vendorAnnualSubs = vendorSkus.filter((s) => s.offering_type === 'subscription_annual');
  const tokenPacks = vendorSkus.filter((s) => s.offering_type === 'token_pack');

  // Branch add-on price, read from the catalog (₱999 fallback only if the row
  // is missing) — keeps the intro copy in sync with /admin/pricing.
  const branchSku = vendorSkus.find((s) => s.sku_code === 'vendor_branch_28day');
  const branchPriceLabel = `₱${formatPeso(branchSku?.price_php ?? 999)}`;

  // Annual counterpart lookup by SKU naming convention.
  // Convention: pro_vendor_monthly ↔ pro_vendor_annual ·
  // enterprise_vendor_monthly ↔ enterprise_vendor_annual. Per migration
  // 20260712000000_iteration_0006_vendor_subscription_annual_skus.sql.
  const annualByTier = new Map(
    vendorAnnualSubs.map((a) => [a.sku_code.replace(/_annual$/, ''), a]),
  );
  // Cadence is 28-day prepaid blocks (NOT calendar months) per CLAUDE.md
  // 2026-05-30 "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED" row § 1(a) cadence
  // correction · 13 cycles/year (NOT 12). Sticker sum:
  //   Pro 28-day × 13   = ₱2,499 × 13 = ₱32,487/yr · Annual ₱24,999 = ~23% off
  //   Enterprise × 13   = ₱5,499 × 13 = ₱71,487/yr · Annual ₱54,999 = ~23% off
  // Both tiers land symmetric at ~23% off annual vs 28-day cycle aggregate.
  function annualFor(blockSku: { sku_code: string; price_php: number }) {
    const tierKey = blockSku.sku_code.replace(/_monthly$/, '');
    const annual = annualByTier.get(tierKey);
    if (!annual) return null;
    const cycleTotal = blockSku.price_php * 13; // 28-day × 13 = full year
    const savings = Math.max(0, Math.round(cycleTotal - annual.price_php));
    const savingsPct = cycleTotal > 0
      ? Math.round((savings / cycleTotal) * 100)
      : 0;
    return { annual, savings, savingsPct };
  }

  // SEO/GEO Bucket 7 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) — Product +
  // Offer + Service JSON-LD reading from the V2 catalogs (lib/v2-catalog.ts ·
  // fetches above). Each SKU becomes one entity in a single @graph block so
  // Google + AI engines (ChatGPT, Perplexity, Claude, Gemini) can extract
  // concrete PHP prices when couples ask "how much does Setnayan cost" or
  // "is Setnayan free for couples".
  //
  // Composition rules:
  //   - Customer SKUs (19)         → @type Product · brand → Organization
  //   - Customer Bundles (2)       → @type Product · brand → Organization
  //   - Vendor Monthly Subs (2)    → @type Service · provider → Organization ·
  //                                  PriceSpecification with billingDuration P1M
  //   - Token Packs (5)            → @type Product · brand → Organization
  //
  // availability:
  //   - build_status = 'live'      → InStock
  //   - build_status = 'partial'   → InStock (active build + already deliverable)
  //   - build_status = 'not_built' → PreOrder (catalog-only · honest signal)
  //
  // Annual subscription SKUs (Pro ₱19,999/yr + Enterprise ₱54,999/yr per
  // CLAUDE.md eleventh 2026-05-28 row) are now live in vendor_billing_catalog
  // as of migration 20260712000000 (2026-05-29 follow-up). Both monthly +
  // annual surface as separate @type Service entities with their own
  // billingDuration: P1M for monthly + P1Y for annual · unitText carries
  // the cadence verbally for AI engines that don't parse ISO-8601
  // durations. The llms.txt v4 (Bucket 1 PR #605) mentions annual SKUs in
  // the tier structure paragraph so the price anchor is consistent across
  // structured + unstructured AI extraction surfaces.
  //
  // All entities reference https://www.setnayan.com/#organization for
  // brand grounding · composes with the layout-level Organization JSON-LD
  // from Bucket 2 PR #607.
  const SITE_URL = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
  ).replace(/\/$/, '');
  const ORGANIZATION_REF = { '@id': `${SITE_URL}/#organization` };

  const buildAvailability = (status: BuildStatus): string =>
    status === 'not_built'
      ? 'https://schema.org/PreOrder'
      : 'https://schema.org/InStock';

  // Use `Record<string, unknown>` for the JSON-LD payload (mixed strings,
  // arrays of nested objects). Same fix pattern as
  // app/venue/[slug]/page.tsx · the project's ESLint config (next/core-
  // web-vitals only) doesn't register the @typescript-eslint plugin so
  // the `eslint-disable-next-line @typescript-eslint/no-explicit-any`
  // directive that used to wrap a `Record<string, any>` here caused
  // `next build` to fail with `Definition for rule '@typescript-eslint/
  // no-explicit-any' was not found` — silently breaking every Vercel
  // deploy from PR #616 (2026-05-29 SEO/GEO Bucket 7) onward.
  const pricingJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@graph': [
      // Customer software SKUs · @type Product
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
        },
      })),
      // Customer tiers (Essentials/Complete) · @type Product. Re-listed
      // 2026-06-13 for GEO coherence with the visible tier overview below —
      // AI engines were citing stale tier pricing. The offer URL points at
      // the onboarding flow because that is the ONLY purchase point
      // (owner 2026-06-08 "never sold outside" is unchanged).
      ...bundles.map((b) => ({
        '@type': 'Product',
        '@id': `${SITE_URL}/pricing#tier-${b.package_code}`,
        name: b.title,
        description: `${b.title} — Setnayan planning tier, offered when you start your wedding plan.`,
        brand: ORGANIZATION_REF,
        category: 'Wedding planning software',
        offers: {
          '@type': 'Offer',
          url: `${SITE_URL}/onboarding/wedding`,
          price: String(Math.round(b.retail_price_php)),
          priceCurrency: 'PHP',
          availability: 'https://schema.org/InStock',
          seller: ORGANIZATION_REF,
        },
      })),
      // Vendor subscriptions · @type Service with PriceSpecification ·
      // both 28-day prepaid + annual cadence per CLAUDE.md 2026-05-30 row
      // "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED" § 1(a) cadence correction +
      // § 7(d) JSON-LD schema.org billingDuration update. Pro/Enterprise
      // 28-day blocks (13 cycles/year · NOT calendar months).
      // billingDuration: P28D (28-day prepaid block) OR P1Y (annual) ·
      // unitText carries the cadence verbally for AI engines that don't
      // parse ISO-8601 durations.
      ...[...vendorSubs, ...vendorAnnualSubs].map((s) => {
        const isAnnual = s.offering_type === 'subscription_annual';
        const cadence = isAnnual
          ? { billingDuration: 'P1Y', unitText: 'annual subscription', shortLabel: 'per year' }
          : { billingDuration: 'P28D', unitText: '28-day prepaid block', shortLabel: 'per 28 days' };
        return {
          '@type': 'Service',
          '@id': `${SITE_URL}/pricing#vendor-${s.sku_code}`,
          name: s.title,
          description: `${s.title} — Setnayan vendor subscription ${cadence.shortLabel}. 0% commission on bookings.`,
          provider: ORGANIZATION_REF,
          category: 'Wedding vendor subscription',
          offers: {
            '@type': 'Offer',
            url: `${SITE_URL}/for-vendors`,
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
      // Token packs · @type Product (commodity goods · vendors stockpile)
      ...tokenPacks.map((t) => ({
        '@type': 'Product',
        '@id': `${SITE_URL}/pricing#tokens-${t.sku_code}`,
        name: t.title,
        description:
          t.token_grant_count !== null
            ? `${t.title} · ${t.token_grant_count} Setnayan vendor tokens.`
            : `${t.title} — Setnayan vendor token pack.`,
        brand: ORGANIZATION_REF,
        category: 'Wedding vendor tokens',
        offers: {
          '@type': 'Offer',
          url: `${SITE_URL}/for-vendors`,
          price: String(Math.round(t.price_php)),
          priceCurrency: 'PHP',
          availability: 'https://schema.org/InStock',
          seller: ORGANIZATION_REF,
        },
      })),
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
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Pricing
          </p>
          <LineRevealHeading
            as="h1"
            trigger="mount"
            className="mt-4 text-balance font-display text-5xl font-medium leading-[1.02] tracking-tight sm:text-7xl lg:text-[96px]"
          >
            Real software prices.{' '}
            <span className="text-ink/55">Zero commission on vendor bookings.</span>
          </LineRevealHeading>
          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-ink/65">
            You buy software at retail. Your vendors keep 100% of what you pay
            them — Setnayan never sits between you and them at checkout.
          </p>
        </div>
      </section>

      {/* Start free — what ₱0 actually includes (couple + vendor sides).
          Realigned 2026-06-13: the old "Free website. Free QR. Free forever."
          card promised paid SKUs (Event Website ₱1,999 · Custom QR ₱999 ·
          RSVP) as free — reversed by the owner-locked 2026-06-07 reprice
          (Pricing.md § 00.D). */}
      <section className="border-b border-ink/5 bg-ink/[0.02]">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Included with every account
            </p>
            <LineRevealHeading className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Start free. Stay free as long as you like.
            </LineRevealHeading>
          </div>
          <RevealBand className="grid grid-cols-1 gap-4 sm:grid-cols-2" stagger={0.06}>
            <article data-reveal-item className="rounded-2xl border-2 border-terracotta/30 bg-cream p-6 sm:p-8">
              <Globe aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                For couples
              </p>
              <p className="mt-2 font-display text-2xl font-medium tracking-tight">
                The planning workspace
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">
                Schedule · budget · guest list · seat plan · mood board — plus
                the full vendor marketplace and a personalized match preview.
                Free with every account, no card required.
              </p>
            </article>
            <article data-reveal-item className="rounded-2xl border-2 border-terracotta/30 bg-cream p-6 sm:p-8">
              <Globe aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                For vendors
              </p>
              <p className="mt-2 font-display text-2xl font-medium tracking-tight">
                Sign up free · subscribe to go live
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">
                Create your account and set up your profile at no cost. Solo
                at ₱2,000/28d activates your marketplace presence — verified
                profile, in-app chat, bid pipeline, and your vendor microsite.
              </p>
            </article>
          </RevealBand>
        </div>
      </section>

      {/* The 4-tier ladder — owner-locked 2026-06-07 (Pricing.md § 00.A).
          Display-only price transparency: Setnayan AI is bought in-app like
          any SKU; Essentials + Complete are offered ONLY while you set up
          your plan (onboarding · owner 2026-06-08), so no buy CTA here. */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mb-12 max-w-2xl space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              How couples pay
            </p>
            <LineRevealHeading className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              One free tier. Three ways to go further.
            </LineRevealHeading>
            <p className="text-base leading-relaxed text-ink/65">
              Everything is à la carte below — or pick a tier when you start
              your plan. Setnayan Essentials and Setnayan Complete are offered
              while you set up your wedding, at a packaged price below their
              à-la-carte total.
            </p>
          </div>
          <RevealBand className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.07}>
            <article data-reveal-item className="flex flex-col gap-3 rounded-2xl border border-ink/15 bg-cream p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Free — Explore
              </p>
              <p className="font-sans text-3xl font-semibold tracking-tight text-ink">₱0</p>
              <p className="text-sm leading-relaxed text-ink/65">
                Browse the marketplace, see your match preview, and plan with
                the free workspace: schedule, budget, guest list, seat plan,
                mood board, and a live single-camera stream on your event page —
                to your own YouTube — so everyone who can&rsquo;t be there can
                watch.
              </p>
            </article>
            <article data-reveal-item className="flex flex-col gap-3 rounded-2xl border-2 border-terracotta/40 bg-cream p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Setnayan AI
              </p>
              <p className="font-sans text-3xl font-semibold tracking-tight text-ink">
                {setnayanAi ? `₱${formatPeso(setnayanAi.retail_price_php)}` : 'See catalog'}
              </p>
              <p className="text-sm leading-relaxed text-ink/65">
                The full matchmaking engine — date, availability, budget,
                venue, guest count, religion, and reviews cross-referenced —
                plus the guided planning workspace. One purchase per event.
              </p>
            </article>
            <article data-reveal-item className="flex flex-col gap-3 rounded-2xl border border-ink/15 bg-cream p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Setnayan Essentials
              </p>
              <p className="font-sans text-3xl font-semibold tracking-tight text-ink">
                {essentialsBundle ? `₱${formatPeso(essentialsBundle.retail_price_php)}` : '—'}
              </p>
              <p className="text-sm leading-relaxed text-ink/65">
                Setnayan AI + Animated Monogram + Custom QR + Pro RSVP + Papic
                Guest + Event Website + Editorial Website. Offered when you
                start your plan.
              </p>
            </article>
            <article data-reveal-item className="flex flex-col gap-3 rounded-2xl border border-ink/15 bg-cream p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Setnayan Complete
              </p>
              <p className="font-sans text-3xl font-semibold tracking-tight text-ink">
                {completeBundle ? `₱${formatPeso(completeBundle.retail_price_php)}` : '—'}
              </p>
              <p className="text-sm leading-relaxed text-ink/65">
                Every paid Setnayan service for your event, in one package.
                Offered when you start your plan.
              </p>
            </article>
          </RevealBand>
        </div>
      </section>

      {/* Panood — two tiers, framed honestly. The FREE single-camera
          livestream is available to everyone with no purchase; the multicam
          control room is the paid upgrade, priced LIVE from the catalog. This
          callout exists so Panood never reads as a single paid product. */}
      <section className="border-b border-ink/5 bg-ink/[0.02]">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Panood · livestream
            </p>
            <LineRevealHeading className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Livestream your wedding free. Run a control room when you want more.
            </LineRevealHeading>
            <p className="text-base leading-relaxed text-ink/65">
              Going live so lola abroad can watch is free for everyone. When you
              want a true broadcast — multiple cameras with live cuts, multi-cam
              to YouTube or an in-house offline stream, Photowall and LED-Wall
              routed to every venue screen, overlays, and live replays as the
              moments happen — that&apos;s the upgrade.
            </p>
          </div>
          <RevealBand className="grid grid-cols-1 gap-4 sm:grid-cols-2" stagger={0.07}>
            <article
              data-reveal-item
              className="flex flex-col gap-3 rounded-2xl border-2 border-terracotta/30 bg-cream p-6 sm:p-8"
            >
              <Radio aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Free · single camera
              </p>
              <p className="font-sans text-3xl font-semibold tracking-tight text-ink">₱0</p>
              <p className="text-sm leading-relaxed text-ink/65">
                Go live from your phone or laptop so family abroad can watch.
                It streams straight to your own YouTube, embeds free on your
                event page, and saves itself for later. Available to everyone,
                no purchase.
              </p>
            </article>
            <article
              data-reveal-item
              className="flex flex-col gap-3 rounded-2xl border-2 border-terracotta/40 bg-cream p-6 sm:p-8"
            >
              <Users aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                {panoodSystem?.title ?? 'Multicam control room'} · upgrade
              </p>
              <p className="font-sans text-3xl font-semibold tracking-tight text-ink">
                {panoodSystem ? formatSkuPriceLabel(panoodSystem) : 'See catalog'}
              </p>
              <p className="text-sm leading-relaxed text-ink/65">
                {panoodSystem?.description
                  ?? 'A full control room for one event-day. Connect multiple cameras and cut between them live, broadcast multi-cam to YouTube or run an in-house offline stream, route Photowall and LED-Wall content to every venue screen, add overlays, and fire a live highlight generator for instant replays.'}
              </p>
              <ul className="mt-1 space-y-1 text-xs leading-relaxed text-ink/60">
                <li>
                  <span className="font-medium text-ink/75">Cameras</span> · connect
                  multiple cameras, live switching, one-tap camera switch
                </li>
                <li>
                  <span className="font-medium text-ink/75">Streaming</span> ·
                  multi-cam YouTube live, live streaming, in-house (offline) stream
                </li>
                <li>
                  <span className="font-medium text-ink/75">Screens</span> ·
                  Photowall → screen, LED Wall → screen, multi-screen control
                </li>
                <li>
                  <span className="font-medium text-ink/75">Production</span> ·
                  overlays + live highlight generator (replays during the broadcast)
                </li>
              </ul>
              <p className="text-[11px] leading-relaxed text-ink/45">
                Live replays are during the broadcast — post-event edits (AI
                Highlight · SDE · Thank-You) and the standalone PhotoWall /
                Live-Background content services are separate.
              </p>
            </article>
          </RevealBand>
        </div>
      </section>

      {/* Customer software catalog — grouped by build_status.
          THE signature: the whole catalog is wrapped in one CatalogPanel
          (usePanelIntro scope + a single PanelThread). Because PanelThread
          stretches to its container's full height, that one champagne thread
          spans all three build-status groups (Live → In build → Coming soon) as
          one continuous "build" line, drawn as the catalog scrolls in. The H2 is
          the panel's `data-premium-headline`; the group chips + every SKU card
          carry `data-premium-item` so they rise in document order as the thread
          draws past. */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <CatalogPanel>
          <div className="mb-12 max-w-2xl space-y-3">
            <p data-premium-item className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Software catalog
            </p>
            <h2 data-premium-headline className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Pick what you actually need.
            </h2>
            <p data-premium-item className="text-base leading-relaxed text-ink/65">
              Every SKU lives in your dashboard. We mark each one with{' '}
              <span className="text-ink">Live</span>,{' '}
              <span className="text-ink">In build</span>, or{' '}
              <span className="text-ink">Coming soon</span> so you know what
              works today before you buy.
            </p>
          </div>

          {customerSkus.length === 0 ? (
            <p className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-6 text-sm text-ink/65">
              Catalog is loading. Refresh the page — if this card persists,
              we&apos;re briefly between updates and will be back shortly.
            </p>
          ) : (
            (['live', 'partial', 'not_built'] as Array<BuildStatus>).map((status) => {
              const items = grouped[status];
              if (items.length === 0) return null;
              return (
                <div key={status} className="mt-10 first:mt-0">
                  <div data-premium-item className="mb-4 flex items-center gap-3">
                    <BuildStatusChip status={status} />
                    <p className="text-xs text-ink/55">
                      {BUILD_STATUS_LABEL[status]} · {items.length} item
                      {items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((sku) => (
                      <li
                        key={sku.service_code}
                        data-premium-item
                        className={`flex flex-col gap-3 rounded-2xl border p-6 ${
                          status === 'live'
                            ? 'border-terracotta/40 bg-cream'
                            : status === 'partial'
                              ? 'border-ink/15 bg-cream'
                              : 'border-ink/10 bg-ink/[0.02]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta">
                            {sku.title}
                          </p>
                          {sku.is_token_able ? (
                            <span
                              title="Token Worthy — can be purchased with vendor tokens"
                              className="inline-flex items-center gap-1 rounded-full bg-ink/[0.04] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/55"
                            >
                              <Coins aria-hidden className="h-2.5 w-2.5" strokeWidth={2} />
                              Token
                            </span>
                          ) : null}
                        </div>
                        <p className="flex items-baseline gap-2">
                          <span
                            className={`font-sans text-3xl font-semibold tracking-tight ${
                              status === 'not_built' ? 'text-ink/40' : 'text-ink'
                            }`}
                          >
                            {/* Pax-priced SKUs (PAPIC_GUEST) show "from ₱X" off
                                the floor — no event context on the public page.
                                Flat SKUs render "₱X" exactly as before. */}
                            {formatSkuPriceLabel(sku)}
                          </span>
                        </p>
                        {sku.description ? (
                          <p className="text-sm leading-relaxed text-ink/65">
                            {sku.description}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}

          <p data-premium-item className="mt-10 text-sm text-ink/55">
            Token Worthy SKUs can also be redeemed using vendor tokens — see
            the vendor pricing below for how tokens work.
          </p>
          </CatalogPanel>
        </div>
      </section>

      {/* Vendor pricing */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mb-12 max-w-2xl space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              For vendors
            </p>
            <LineRevealHeading className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Subscription + token packs.
            </LineRevealHeading>
            <p className="text-base leading-relaxed text-ink/65">
              Vendors subscribe in 28-day prepaid blocks for marketplace
              presence, and top up tokens to redeem the same software SKUs
              couples buy at retail. Boost individual features
              for 7 days · 4–100 tokens · Pro+ vendors can add branches at
              {branchPriceLabel} / 28 days each.
            </p>
          </div>

          {/* Subscriptions · monthly + annual paired per tier (Solo / Pro / Enterprise) */}
          {vendorSubs.length > 0 ? (
            <RevealBand className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.07}>
              {vendorSubs.map((sub) => {
                const isPro = sub.sku_code.toLowerCase().includes('pro');
                const seatsLine =
                  sub.max_sub_seats === null
                    ? 'Unlimited agent seats'
                    : sub.max_sub_seats === 0
                    ? 'Solo operator · no agent seats'
                    : `Up to ${sub.max_sub_seats} agent seats`;
                const catsLine =
                  sub.max_categories === null
                    ? 'All categories'
                    : sub.max_categories === 1
                    ? '1 category'
                    : `${sub.max_categories} categories`;
                const annualDeal = annualFor(sub);
                return (
                  <article
                    key={sub.sku_code}
                    data-reveal-item
                    className={`flex flex-col gap-4 rounded-2xl border-2 p-6 sm:p-8 ${
                      isPro
                        ? 'border-terracotta/40 bg-cream'
                        : 'border-terracotta bg-cream shadow-[0_30px_80px_-40px_rgba(122,31,43,0.25)]'
                    }`}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                      {sub.title}
                    </p>
                    <p className="flex items-baseline gap-2">
                      <span className="font-sans text-5xl font-semibold tracking-tight text-ink">
                        ₱{formatPeso(sub.price_php)}
                      </span>
                      <span className="text-sm text-ink/55">/ 28 days</span>
                    </p>
                    {/* Annual deal callout · paired with 28-day per tier ·
                        added 2026-05-29 per CLAUDE.md eleventh 2026-05-28 row ·
                        updated 2026-05-30 per CLAUDE.md "🔒 V2.1 BRIEF
                        AMENDMENT #2 LOCKED" row § 4 (Pro Annual ₱24,999 ·
                        symmetric ~23% off Pro 28-day × 13 and Enterprise
                        28-day × 13 sticker totals).
                        Renders only when annual counterpart exists in
                        vendor_billing_catalog (lookup by SKU naming
                        convention via annualFor() helper). Standard SaaS
                        retention lever · mid-range 23% off. */}
                    {annualDeal ? (
                      <p className="rounded-lg border border-terracotta/30 bg-terracotta/[0.06] px-3 py-2 text-xs leading-relaxed">
                        <span className="text-ink">
                          Or <span className="font-semibold">₱{formatPeso(annualDeal.annual.price_php)}/yr
                          </span> billed annually
                        </span>
                        <span className="ml-1 text-terracotta">
                          · save ₱{formatPeso(annualDeal.savings)} ({annualDeal.savingsPct}%)
                        </span>
                      </p>
                    ) : null}
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <Check
                          aria-hidden
                          className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                          strokeWidth={2}
                        />
                        <span className="text-ink">{catsLine}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check
                          aria-hidden
                          className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                          strokeWidth={2}
                        />
                        <span className="text-ink">{seatsLine}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check
                          aria-hidden
                          className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                          strokeWidth={2}
                        />
                        <span className="text-ink">Verified profile + vendor microsite</span>
                      </li>
                    </ul>
                  </article>
                );
              })}
            </RevealBand>
          ) : null}

          {/* Token packs */}
          {tokenPacks.length > 0 ? (
            <div className="mt-12">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Token packs
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">
                Top up tokens any time. Tokens redeem against any{' '}
                <span className="text-ink">Token Worthy</span> customer SKU at
                the rate set in your dashboard.
              </p>
              <RevealBand stagger={0.05} y={12}>
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {tokenPacks.map((pack) => (
                  <li
                    key={pack.sku_code}
                    data-reveal-item
                    className="flex flex-col gap-2 rounded-xl border border-ink/15 bg-cream p-4"
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                      {pack.token_grant_count} tokens
                    </p>
                    <p className="font-sans text-2xl font-semibold tracking-tight text-ink">
                      ₱{formatPeso(pack.price_php)}
                    </p>
                  </li>
                ))}
              </ul>
              </RevealBand>
            </div>
          ) : null}
        </div>
      </section>

      {/* How money flows */}
      <section className="border-b border-ink/5 bg-ink/[0.02]">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            How money flows
          </p>
          <LineRevealHeading
            as="p"
            className="mt-4 max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
          >
            Setnayan only sells you software. Vendor bookings are between you and them.
          </LineRevealHeading>
          <RevealBand className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3" stagger={0.07}>
            <div data-reveal-item className="rounded-xl border border-ink/10 bg-cream p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                You → Setnayan
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">
                Software SKUs above (Animated Monogram, Editorial Website,
                Patiktok, the Panood control room, etc.) — paid at 100% retail.
                PHP only · itemized receipts on every transaction.
              </p>
            </div>
            <div data-reveal-item className="rounded-xl border border-ink/10 bg-cream p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                You → Vendor (off-platform)
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">
                Vendor packages settle directly with the vendor — bank
                transfer, GCash, in-person — whatever you arrange. Setnayan
                takes 0% commission.
              </p>
            </div>
            <div data-reveal-item className="rounded-xl border border-ink/10 bg-cream p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                Vendor → Setnayan
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">
                Vendors pay a 28-day prepaid subscription (above) for
                marketplace presence, and top up tokens to redeem software
                for their own events.
              </p>
            </div>
          </RevealBand>
        </div>
      </section>

      {/* Vendor pointer */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-cream p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <p className="text-base font-semibold text-ink">
              Vendor? See the full marketplace + verification flow.
            </p>
            <Link
              href="/for-vendors"
              className="button-secondary inline-flex shrink-0 items-center justify-center gap-2 text-sm"
            >
              For vendors
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Logo />
            <p className="text-xs text-ink/55">
              PHP only · itemized receipts on every software purchase · © Setnayan
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
