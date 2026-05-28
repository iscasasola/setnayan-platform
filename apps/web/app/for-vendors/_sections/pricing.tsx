import Link from 'next/link';
import { Check, ArrowRight, Coins, Globe } from 'lucide-react';
import { fetchV2VendorCatalog, formatPeso, type V2VendorSku } from '@/lib/v2-catalog';

// /for-vendors — Pricing section.
//
// Rewritten 2026-05-28 (V2 cutover) — async server component reading
// vendor_billing_catalog directly. Retires the V1 Pro Weekly ₱4,999 /
// Free-during-launch / Concierge ₱2,499-value-bundled-with-Pro framing.
// New thesis from the V2 lock:
//   - Free baseline · vendors can post on Setnayan for free (no listing fee)
//   - Pro Vendor    ₱1,999/mo  · 1 category · 5 sub-seats
//   - Enterprise    ₱5,499/mo  · unlimited categories · unlimited sub-seats
//   - Token packs   4 / 10 / 25 / 50 / 100 tokens
//   - 100 complimentary tokens on verification
//   - Vendor bookings are off-platform · 0% commission
//   - Free vendor subdomain at slug.setnayan.com

function describeSubscription(sub: V2VendorSku): { categories: string; seats: string } {
  const categories =
    sub.max_categories === null ? 'All categories' : `${sub.max_categories} category`;
  const seats =
    sub.max_sub_seats === null
      ? 'Unlimited sub-seats'
      : `${sub.max_sub_seats} sub-seats`;
  return { categories, seats };
}

export async function Pricing() {
  const skus = await fetchV2VendorCatalog();
  const subs = skus.filter((s) => s.offering_type === 'subscription_monthly');
  const packs = skus.filter((s) => s.offering_type === 'token_pack');

  return (
    <section className="border-b border-ink/5">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Vendor pricing — visible on purpose
          </p>
          <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
            Post free. Subscribe when you want more.
          </h2>
          <p className="text-base text-ink/65">
            Setnayan never takes a cut of your bookings. You keep 100% of what
            your couples pay you. Subscription and token packs below unlock
            multi-category presence, team seats, and software-SKU credits — they
            don&rsquo;t gate your earnings.
          </p>
        </div>

        {/* Free baseline · always-on */}
        <article className="mb-6 flex flex-col gap-3 rounded-2xl border border-ink/15 bg-cream p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
          <Globe aria-hidden className="h-6 w-6 shrink-0 text-terracotta" strokeWidth={1.75} />
          <div className="flex-1 space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
              Free baseline
            </p>
            <p className="font-display text-xl font-medium tracking-tight">
              your-slug.setnayan.com — your free vendor site
            </p>
            <p className="text-sm text-ink/65">
              Portfolio, packages, inquiry form, in-app messaging — included
              with every verified vendor account. No listing fee.
            </p>
          </div>
          <Link
            href="/signup?as=vendor"
            className="button-secondary inline-flex shrink-0 items-center justify-center gap-2 text-sm"
          >
            List your business
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </article>

        {/* Subscription tiers */}
        {subs.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {subs.map((sub) => {
              const { categories, seats } = describeSubscription(sub);
              const isEnterprise = sub.sku_code.toLowerCase().includes('enterprise');
              const features = [
                categories,
                seats,
                'Multi-service catalog + per-service calendars',
                'In-app chat with couples · in-app messaging',
                '100 complimentary tokens once verified',
                'Free vendor subdomain at slug.setnayan.com',
              ];
              return (
                <article
                  key={sub.sku_code}
                  className={
                    isEnterprise
                      ? 'flex flex-col gap-5 rounded-2xl border-2 border-terracotta bg-cream p-6 shadow-[0_30px_80px_-40px_rgba(122,31,43,0.25)]'
                      : 'flex flex-col gap-5 rounded-2xl border-2 border-terracotta/40 bg-cream p-6'
                  }
                >
                  <header className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                        {sub.title}
                      </p>
                      {isEnterprise ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-cream">
                          Unlimited
                        </span>
                      ) : null}
                    </div>
                    <p className="flex items-baseline gap-2">
                      <span className="font-display text-5xl font-medium tracking-tight text-ink sm:text-6xl">
                        ₱{formatPeso(sub.price_php)}
                      </span>
                      <span className="text-sm text-ink/55">/ month</span>
                    </p>
                  </header>

                  <ul className="space-y-2 border-t border-ink/5 pt-4">
                    {features.map((label) => (
                      <li key={label} className="flex items-start gap-2 text-sm">
                        <Check
                          aria-hidden
                          className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                          strokeWidth={2}
                        />
                        <span className="text-ink">{label}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/signup?as=vendor"
                    className={
                      isEnterprise
                        ? 'button-primary mt-auto inline-flex items-center justify-center gap-2 text-sm'
                        : 'button-secondary mt-auto inline-flex items-center justify-center gap-2 text-sm'
                    }
                  >
                    Subscribe to {sub.title}
                    <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </Link>
                </article>
              );
            })}
          </div>
        ) : null}

        {/* Token packs */}
        {packs.length > 0 ? (
          <div className="mt-12 rounded-2xl border border-ink/10 bg-ink/[0.02] p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <Coins aria-hidden className="h-6 w-6 shrink-0 text-terracotta" strokeWidth={1.75} />
              <div className="flex-1 space-y-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                  Token packs
                </p>
                <h3 className="font-display text-2xl font-medium tracking-tight">
                  Top up tokens. Redeem for software.
                </h3>
                <p className="text-sm text-ink/65">
                  Tokens redeem against{' '}
                  <span className="text-ink">Token Worthy</span> customer SKUs
                  (Animated Monogram, Today&rsquo;s Focus, High Res Archive, and
                  others). Use them on your own events, or gift them to couples
                  you&rsquo;ve booked.
                </p>
              </div>
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {packs.map((pack) => (
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

        <p className="mt-6 text-xs text-ink/55">
          Subscriptions and token packs are billed via the apply-then-pay rail
          (BDO transfer or GCash) — no card on file. Pause anytime from your
          dashboard. Setnayan keeps 0% commission on the packages couples book
          with you — that money goes straight from couple to vendor.
        </p>
      </div>
    </section>
  );
}
