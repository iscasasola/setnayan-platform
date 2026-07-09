import Link from 'next/link';
import { ArrowRight, Check, Sparkles, Brush, Clock3, Coins } from 'lucide-react';
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
      { code: 'PAPIC_CAMERAS' }, // synthetic "from ₱30/camera" row (see below)
      { code: 'CAMERA_BRIDGE', withPapic: true },
      { code: 'PABATI', withPapic: true },
      { code: 'KWENTO', withPapic: true },
      { code: 'PAKANTA', withPapic: true },
    ],
  },
  {
    title: 'Go live & interactive',
    items: [
      { code: 'PANOOD_SYSTEM_MOBILE' }, // Live Studio — Mobile Controller ₱1,299/day
      { code: 'PANOOD_SYSTEM' }, // Live Studio — Desktop Controller ₱2,499/day
      { code: 'LIVE_WALL' },
      { code: 'PATIKTOK_COMPILER' },
      { code: 'LIVE_BACKGROUND' },
    ],
  },
  {
    title: 'Your website',
    items: [
      { code: 'COUPLE_WEBSITE_PRO' },
      { code: 'EDITORIAL_PRO' },
      { code: 'STD_PREMIUM_OPENINGS' }, // Cinematic Reveal
      { code: 'WEBSITE_UPGRADE', gate: true }, // only if active in the catalog
    ],
  },
  {
    title: 'Personal touches',
    items: [{ code: 'ANIMATED_MONOGRAM' }],
  },
];

export default async function PricingPage() {
  // Reads in parallel · helpers return [] on error, so the page still renders a
  // polite empty state rather than 500'ing. The Essentials/Complete bundle tiers
  // were removed 2026-06-29 (both deactivated).
  const [customerSkus, vendorSkus] = await Promise.all([
    fetchV2CustomerCatalog(),
    fetchV2VendorCatalog(),
  ]);

  // Setnayan AI renewal price (owner-locked: ₱499 first 28 days per event, then
  // ₱799 / 28 days). SETNAYAN_AI_RENEW is a DORMANT catalog row (is_active=false)
  // so it isn't in the active customer catalog above — read it directly so the
  // ₱799 stays admin-managed; the ₱799 fallback only renders if the row is
  // missing.
  let aiRenewalPhp = 799; // owner-locked fallback; the catalog wins when readable
  try {
    const { data: aiRenewRow } = await createAdminClient()
      .from('platform_retail_catalog_v2')
      .select('retail_price_php')
      .eq('service_code', 'SETNAYAN_AI_RENEW')
      .maybeSingle();
    const p = Number((aiRenewRow as { retail_price_php?: number | null } | null)?.retail_price_php);
    if (Number.isFinite(p) && p > 0) aiRenewalPhp = p;
  } catch {
    // Admin client unavailable (e.g. missing env at build) → keep the ₱799
    // fallback, mirroring lib/v2-catalog's resilient createAdminClient handling.
  }
  const aiRenewalLabel = `₱${formatPeso(aiRenewalPhp)}`;

  // Setnayan AI (the one paid planner tier above Free) reads live from the
  // active catalog — the ACTIVE SETNAYAN_AI row is the ₱499 intro.
  const setnayanAi = customerSkus.find((s) => s.service_code === 'SETNAYAN_AI');
  const aiIntroLabel = setnayanAi ? `₱${formatPeso(setnayanAi.retail_price_php)}` : '₱499';
  const aiPeriod = setnayanAi ? formatBillingPeriodSuffix(setnayanAi.billing_period) : ' / 28 days';

  // Collapse the two per-camera Papic rate SKUs into ONE synthetic "from ₱30/
  // camera" catalog row for the grouped list + JSON-LD keeps the raw rows.
  const papicRoll = customerSkus.find((s) => s.service_code === 'PAPIC_CAMERA_ROLL_DAY');
  const papicUnlimited = customerSkus.find((s) => s.service_code === 'PAPIC_CAMERA_UNLIMITED_DAY');
  const papicCamerasSynthetic: V2CustomerSku | null =
    papicRoll || papicUnlimited
      ? {
          service_code: 'PAPIC_CAMERAS',
          title: 'Papic Cameras',
          retail_price_php: papicRoll?.retail_price_php ?? 30,
          saas_overhead_cost_php: 0,
          is_token_able: false,
          description: `Turn your guests into paparazzi — every candid lands in your shared gallery. Ltd ₱${formatPeso(papicRoll?.retail_price_php ?? 30)} (30 photos + 10 videos) or Unli ₱${formatPeso(papicUnlimited?.retail_price_php ?? 100)} per camera, per day · first 5 free, capped at ₱15,000/day.`,
          build_status: 'live',
          billing_period: 'one_time',
          is_pax_priced: true, // drives the "from ₱X" label
          pax_floor: null,
          pax_floor_price_php: null,
          pax_increment_size: null,
          pax_increment_price_php: null,
        }
      : null;

  // Look up table for the grouped add-on renderer — includes the synthetic row.
  const skuByCode = new Map<string, V2CustomerSku>(
    customerSkus.map((s) => [s.service_code, s]),
  );
  if (papicCamerasSynthetic) skuByCode.set('PAPIC_CAMERAS', papicCamerasSynthetic);

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

  // Estimator rates — read from the catalog where available (₱30 Ltd / ₱100 Unli
  // / ₱15,000 cap fallbacks only if a row is missing). Add-on prices for the
  // ticklist likewise come from the catalog.
  const rateOf = (code: string, fb: number) =>
    Number(customerSkus.find((s) => s.service_code === code)?.retail_price_php ?? fb);
  const estimatorAddonDefs: Array<{ key: string; code: string; label: string; fb: number }> = [
    { key: 'cb', code: 'CAMERA_BRIDGE', label: 'Camera Bridge · DSLR', fb: 499 }, // owner 2026-07-08 (was 1299)
    // Kwento + Pabati owner-locked FREE 2026-07-08 → deactivating the catalog row
    // drops them from the estimator (filter below); fb 0 guards a lingering
    // null-priced row from showing a stale paid figure.
    { key: 'pabati', code: 'PABATI', label: 'Pabati', fb: 0 },
    { key: 'kwento', code: 'KWENTO', label: 'Kwento', fb: 0 },
    { key: 'pakanta', code: 'PAKANTA', label: 'Pakanta', fb: 2499 },
  ];
  const estimatorRates: EstimatorRates = {
    ltd: rateOf('PAPIC_CAMERA_ROLL_DAY', 30),
    unli: rateOf('PAPIC_CAMERA_UNLIMITED_DAY', 100),
    capPerDay: 15000,
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
  // ₱30 + ₱100 Papic rates + every vendor sub stay in structured data. ──
  const SITE_URL = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
  ).replace(/\/$/, '');
  const ORGANIZATION_REF = { '@id': `${SITE_URL}/#organization` };
  const buildAvailability = (status: BuildStatus): string =>
    status === 'not_built' ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock';

  const vendorSubs = vendorSkus.filter((s) => s.offering_type === 'subscription_monthly');
  const vendorAnnualSubs = vendorSkus.filter((s) => s.offering_type === 'subscription_annual');
  const tokenPacks = vendorSkus.filter((s) => s.offering_type === 'token_pack');

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
      ...tokenPacks.map((t) => ({
        '@type': 'Product',
        '@id': `${SITE_URL}/pricing#tokens-${t.sku_code}`,
        name: t.title,
        description:
          t.token_grant_count !== null
            ? `${t.title} · ${t.token_grant_count} Setnayan vendor tokens.`
            : `${t.title} · Setnayan vendor token pack.`,
        brand: ORGANIZATION_REF,
        category: 'Wedding vendor tokens',
        offers: {
          '@type': 'Offer',
          url: `${SITE_URL}/vendors`,
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
              <p className="flex items-baseline gap-2">
                <span className="font-sans text-4xl font-semibold tracking-tight text-ink">
                  {aiRenewalLabel}
                </span>
                <span className="text-sm text-ink/55">{aiPeriod}</span>
              </p>
              <p className="text-sm font-medium text-ink/70">
                {aiIntroLabel} for your first cycle.
              </p>
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
                          {sku.is_token_able ? (
                            <span
                              title="Token Worthy: can be purchased with vendor tokens"
                              className="inline-flex items-center gap-1 rounded-full bg-ink/[0.04] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/55"
                            >
                              <Coins aria-hidden className="h-2.5 w-2.5" strokeWidth={2} />
                              Token
                            </span>
                          ) : null}
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
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink/65">
            Prices are in Philippine peso. Apply for a service, then pay by GCash
            or bank transfer against a unique reference. No commission on vendor
            bookings, no hidden fees. Setnayan never sits between you and your
            vendor at checkout.
          </p>
          <p className="mt-5 text-xs leading-relaxed text-ink/45">
            Prices render live from the Setnayan catalog and are admin-managed.
            The free single-camera livestream and the full planner always stay
            free. Provisional pending the holistic pricing review.
          </p>
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
