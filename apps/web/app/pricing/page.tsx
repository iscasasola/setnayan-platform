import Link from 'next/link';
import { ArrowRight, Check, Sparkles, Brush, Clock3, Globe, Coins } from 'lucide-react';
import { SiteHeader } from '@/app/_components/site-header';
import { Logo } from '@/app/_components/logo';
import {
  fetchV2CustomerCatalog,
  fetchV2BundleCatalog,
  fetchV2VendorCatalog,
  formatPeso,
  BUILD_STATUS_LABEL,
  type V2CustomerSku,
  type BuildStatus,
} from '@/lib/v2-catalog';

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
 *   - Removed Setnayan Concierge ₱2,499 / 3-day trial hero · Today's Focus is
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

export const metadata = {
  title: 'Pricing — Setnayan',
  description:
    'Software you actually use at your event. Free wedding website. No commission on vendor bookings — vendors keep 100%.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing — Setnayan',
    description:
      'Free website at setnayan.com/your-slug. Software you opt into. Vendors transact directly — Setnayan takes 0%.',
    url: '/pricing',
    type: 'website',
    siteName: 'Setnayan',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing — Setnayan',
    description: 'Software at retail · vendors keep 100% · free wedding website.',
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
  // Three reads in parallel · helpers return [] on error, so the page still
  // renders a polite empty state rather than 500'ing.
  const [customerSkus, bundles, vendorSkus] = await Promise.all([
    fetchV2CustomerCatalog(),
    fetchV2BundleCatalog(),
    fetchV2VendorCatalog(),
  ]);

  const grouped = groupByStatus(customerSkus);
  const vendorSubs = vendorSkus.filter((s) => s.offering_type === 'subscription_monthly');
  const tokenPacks = vendorSkus.filter((s) => s.offering_type === 'token_pack');

  return (
    <div className="min-h-screen bg-cream text-ink">
      <SiteHeader />

      {/* Hero */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 pt-20 pb-12 sm:px-6 sm:pt-28 sm:pb-16 lg:px-8 lg:pt-32 lg:pb-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Pricing
          </p>
          <h1 className="mt-4 text-balance font-display text-5xl font-medium leading-[1.02] tracking-tight sm:text-7xl lg:text-[96px]">
            Real software prices.{' '}
            <span className="text-ink/55">Zero commission on vendor bookings.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-ink/65">
            You buy software at retail. Your vendors keep 100% of what you pay
            them — Setnayan never sits between you and them at checkout.
          </p>
        </div>
      </section>

      {/* Two free websites — customer + vendor */}
      <section className="border-b border-ink/5 bg-ink/[0.02]">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Included with every account
            </p>
            <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Free website. Free QR. Free forever.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border-2 border-terracotta/30 bg-cream p-6 sm:p-8">
              <Globe aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                For couples
              </p>
              <p className="mt-2 font-display text-2xl font-medium tracking-tight">
                setnayan.com/your-slug
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">
                Your wedding landing page · RSVP · branded guest QR · monogram
                · event details. Live the moment you create an event.
              </p>
            </article>
            <article className="rounded-2xl border-2 border-terracotta/30 bg-cream p-6 sm:p-8">
              <Globe aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                For vendors
              </p>
              <p className="mt-2 font-display text-2xl font-medium tracking-tight">
                your-slug.setnayan.com
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">
                Your business landing page · portfolio · packages · inquiry
                form · direct messaging. Visible to every couple browsing
                Setnayan.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Customer software catalog — grouped by build_status */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mb-12 max-w-2xl space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Software catalog
            </p>
            <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Pick what you actually need.
            </h2>
            <p className="text-base leading-relaxed text-ink/65">
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
                  <div className="mb-4 flex items-center gap-3">
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
                            ₱{formatPeso(sku.retail_price_php)}
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

          <p className="mt-10 text-sm text-ink/55">
            Token Worthy SKUs can also be redeemed using vendor tokens — see
            the vendor pricing below for how tokens work.
          </p>
        </div>
      </section>

      {/* Bundles */}
      {bundles.length > 0 ? (
        <section className="border-b border-ink/5 bg-ink/[0.02]">
          <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <div className="mb-12 max-w-2xl space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
                Bundles
              </p>
              <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                Curated packs.
              </h2>
              <p className="text-base leading-relaxed text-ink/65">
                If you&apos;d rather not pick à la carte, two opinionated
                bundles cover the most-asked-for combinations.
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {bundles.map((bundle) => (
                <li
                  key={bundle.package_code}
                  className="flex flex-col gap-3 rounded-2xl border-2 border-terracotta/40 bg-cream p-6 sm:p-8"
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                    {bundle.title}
                  </p>
                  <p className="flex items-baseline gap-2">
                    <span className="font-sans text-4xl font-semibold tracking-tight text-ink">
                      ₱{formatPeso(bundle.retail_price_php)}
                    </span>
                    <span className="text-xs text-ink/55">one-time, per event</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Vendor pricing */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mb-12 max-w-2xl space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              For vendors
            </p>
            <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Subscription + token packs.
            </h2>
            <p className="text-base leading-relaxed text-ink/65">
              Vendors subscribe monthly for marketplace presence, and top up
              tokens to redeem the same software SKUs couples buy at retail.
              Verified vendors receive <strong className="text-ink">100 complimentary tokens</strong>{' '}
              once their verification is approved.
            </p>
          </div>

          {/* Subscriptions */}
          {vendorSubs.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {vendorSubs.map((sub) => {
                const isPro = sub.sku_code.toLowerCase().includes('pro');
                const seatsLine =
                  sub.max_sub_seats === null
                    ? 'Unlimited sub-seats'
                    : `${sub.max_sub_seats} sub-seats`;
                const catsLine =
                  sub.max_categories === null
                    ? 'All categories'
                    : `${sub.max_categories} category`;
                return (
                  <article
                    key={sub.sku_code}
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
                      <span className="text-sm text-ink/55">/ month</span>
                    </p>
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
                        <span className="text-ink">Your free vendor site at slug.setnayan.com</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check
                          aria-hidden
                          className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                          strokeWidth={2}
                        />
                        <span className="text-ink">100 complimentary tokens once verified</span>
                      </li>
                    </ul>
                  </article>
                );
              })}
            </div>
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
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {tokenPacks.map((pack) => (
                  <li
                    key={pack.sku_code}
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
          <p className="mt-4 max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Setnayan only sells you software. Vendor bookings are between you and them.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-ink/10 bg-cream p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                You → Setnayan
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">
                Software SKUs above (Animated Monogram, Pro Website, Panood,
                Patiktok, etc.) — paid at 100% retail. PHP only · BIR
                receipts on every transaction.
              </p>
            </div>
            <div className="rounded-xl border border-ink/10 bg-cream p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                You → Vendor (off-platform)
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">
                Vendor packages settle directly with the vendor — bank
                transfer, GCash, in-person — whatever you arrange. Setnayan
                takes 0% commission.
              </p>
            </div>
            <div className="rounded-xl border border-ink/10 bg-cream p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                Vendor → Setnayan
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/70">
                Vendors pay a monthly subscription (above) for marketplace
                presence, and top up tokens to redeem software for their own
                events.
              </p>
            </div>
          </div>
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
              PHP only · BIR receipts on every software purchase · © Setnayan
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
