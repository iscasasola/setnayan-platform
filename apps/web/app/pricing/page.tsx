import Link from 'next/link';
import { Check, ArrowRight, Sparkles, Gift } from 'lucide-react';
import { SiteHeader } from '@/app/_components/site-header';
import { Logo } from '@/app/_components/logo';
import { formatPromoEndDateShort, LAUNCH_PROMO_UNTIL } from '@/lib/sku-catalog';

// /pricing — couple-side pricing transparency.
//
// Per CLAUDE.md decision-log 2026-05-17 row 2 (Concierge single-SKU lock)
// + 2026-05-16 row 16 (Setnayan Pay flat 5.0%), this page is the canonical
// surface for the couple-facing price ladder:
//   1. Setnayan Concierge ₱4,999 — flagship full-service coordination
//   2. À la carte customer SKUs — opt into what you need
//   3. Setnayan Pay 5.0% disclosure — added at checkout when paying vendors
//
// Pricing values mirror supabase/migrations/20260518000000_v1_concierge_pay_flat_and_charm.sql
// (concierge_complete + charm-correct catalog). PHP centavos in DB; this
// page renders the human ₱ form.

export const metadata = {
  title: 'Pricing — Setnayan',
  description:
    'Setnayan Concierge ₱4,999 with 3-day free trial. Free planning tools forever. À la carte add-ons. Vendor bookings include a flat 5.0% Setnayan Pay convenience fee at checkout.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing — Setnayan',
    description:
      'Setnayan Concierge ₱4,999 with 3-day free trial. Free planning tools. À la carte add-ons. Flat 5.0% Setnayan Pay at checkout.',
    url: '/pricing',
    type: 'website',
    siteName: 'Setnayan',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing — Setnayan',
    description:
      'Concierge ₱4,999 · free planning tools · 5.0% Setnayan Pay at checkout.',
  },
};

type AddOn = {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  /** True if this SKU is included in the launch promo (free until LAUNCH_PROMO_UNTIL). */
  freeDuringLaunch: boolean;
};

// Mirrors public.service_catalog rows where purchaser_role='couple' AND
// is_active=TRUE AND category <> 'concierge'. Source: migrations
// 20260516000000 (initial seed), 20260518000000 (Concierge + charm),
// 20260518100000 (launch promo). Items with freeDuringLaunch=true are
// FREE until LAUNCH_PROMO_UNTIL (2027-03-31 23:59:59 +08:00).
const ADD_ONS: Array<AddOn> = [
  {
    name: 'Save-the-Date Video',
    price: '₱99',
    cadence: 'per render',
    blurb:
      'Vertical 30–60s MP4 made from 5–10 engagement photos with Setnayan-owned music. Ends with a landing-page link for guests.',
    freeDuringLaunch: true,
  },
  {
    name: 'Live Schedule Widget',
    price: '₱999',
    cadence: 'per event',
    blurb:
      'Premium "happening now" highlight on your public invitation page — updates live as your timeline moves through ceremony, photos, dinner, party.',
    freeDuringLaunch: true,
  },
  {
    name: 'Panood — Daily Broadcast',
    price: '₱499',
    cadence: 'per day',
    blurb:
      'Live-stream your ceremony or reception to your own YouTube channel. Bring-your-own YouTube — Setnayan handles the broadcaster.',
    freeDuringLaunch: true,
  },
  {
    name: 'Panood — Annual Streaming',
    price: '₱2,999',
    cadence: 'per year',
    blurb:
      'Annual unlimited broadcasts for the household — birthdays, baptisms, anniversaries, every event for 12 months.',
    freeDuringLaunch: true,
  },
  {
    name: 'Patiktok',
    price: '₱999',
    cadence: 'per day',
    blurb:
      'TikTok booth for your reception — guests record short clips that auto-post to Setnayan TikTok. Personal-TikTok BYO version available at ₱1,999/day.',
    freeDuringLaunch: true,
  },
  {
    name: 'Custom Monogram',
    price: '₱1,999',
    cadence: 'one-time',
    blurb:
      'Animated SVG hero with a Setnayan-designed monogram trace. Drop it on your invitation suite, save-the-date video, and event landing page.',
    freeDuringLaunch: false,
  },
  {
    name: 'AI Highlight (60s)',
    price: '₱1,999',
    cadence: 'one-time',
    blurb:
      'Auto-edited 60-second highlight reel from your event footage. AI cuts, music sync, no manual editing.',
    freeDuringLaunch: false,
  },
  {
    name: 'AI Edited Highlight (3 min)',
    price: '₱3,499',
    cadence: 'one-time',
    blurb:
      'Three-minute curated highlight reel — longer arc, story-paced. Same automated edit, more room to breathe.',
    freeDuringLaunch: false,
  },
];

const PROMO_END_SHORT = formatPromoEndDateShort(LAUNCH_PROMO_UNTIL);

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <SiteHeader />

      {/* Hero */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-20 sm:pb-16 lg:px-8 lg:pt-28 lg:pb-20">
          <div className="max-w-3xl space-y-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Pricing
            </p>
            <h1 className="text-balance font-sans text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Transparent prices. PHP only. Pay only for what you opt into.
            </h1>
            <p className="text-base text-ink/65 sm:text-lg">
              Planning tools are free forever. Add Setnayan Concierge if you want
              full-service coordination. Opt into individual add-ons à la carte.
              Vendor bookings include a flat 5.0% Setnayan Pay convenience fee at
              checkout — same rate on every rail, disclosed before you confirm.
            </p>
            <div className="mt-6 flex max-w-2xl items-start gap-3 rounded-2xl border-2 border-terracotta/40 bg-terracotta/5 p-4 sm:p-5">
              <Gift aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={2} />
              <p className="text-sm text-ink">
                <span className="font-semibold text-terracotta">
                  Launch promo:
                </span>{' '}
                most add-ons are <strong>free until {PROMO_END_SHORT}</strong> —
                including Save-the-Date Video, Panood live broadcasts, Patiktok,
                and the Live Schedule widget. Setnayan Concierge, AI Highlights,
                and Custom Monogram are not included.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Concierge flagship */}
      <section className="border-b border-ink/5 bg-ink/[0.02]">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <article className="overflow-hidden rounded-3xl border-2 border-terracotta bg-cream shadow-[0_30px_80px_-40px_rgba(122,31,43,0.25)]">
            <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-6 p-8 sm:p-10 lg:p-12">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cream">
                    <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
                    Flagship
                  </span>
                  <span className="inline-flex items-center rounded-full border border-terracotta/30 bg-terracotta/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                    3-day free trial
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
                    Setnayan Concierge
                  </p>
                  <h2 className="text-balance font-sans text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                    Full-service event coordination, one flat price.
                  </h2>
                  <p className="text-base text-ink/65 sm:text-lg">
                    A real coordinator stays with your event from activation
                    through 30 days after your wedding date. Vendor sourcing,
                    timeline building, day-of execution, post-event wrap-up —
                    handled.
                  </p>
                </div>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {[
                    'Dedicated Setnayan coordinator',
                    'Curated vendor shortlists',
                    'Timeline + run-of-show building',
                    'Contract review on every vendor',
                    'Day-of point-of-contact',
                    'Post-event vendor wrap-up + payouts',
                    'Wedding-anchored runway (12–24 months)',
                    'Unlimited in-app chat with your coordinator',
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2 text-sm">
                      <Check
                        aria-hidden
                        className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                        strokeWidth={2}
                      />
                      <span className="text-ink">{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    href="/signup?intent=concierge"
                    className="button-primary inline-flex items-center justify-center gap-2 text-sm"
                  >
                    Start 3-day free trial
                    <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </Link>
                  <Link
                    href="/signup"
                    className="button-secondary inline-flex items-center justify-center gap-2 text-sm"
                  >
                    Plan it yourself — free
                  </Link>
                </div>
                <p className="text-xs text-ink/55">
                  One trial per account · card-less · cancel anytime. Trial converts
                  to ₱4,999 only when you choose to activate.
                </p>
              </div>
              <div className="space-y-6 border-t border-ink/10 bg-terracotta/5 p-8 sm:p-10 lg:border-t-0 lg:border-l lg:p-12">
                <div className="space-y-1">
                  <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
                    Price
                  </p>
                  <p className="flex items-baseline gap-2">
                    <span className="font-sans text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
                      ₱4,999
                    </span>
                  </p>
                  <p className="text-sm text-ink/65">
                    one-time · wedding-anchored access
                  </p>
                </div>
                <dl className="space-y-3 border-t border-ink/10 pt-4 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-ink/65">Access window</dt>
                    <dd className="font-mono text-ink">12–24 months</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-ink/65">Formula</dt>
                    <dd className="font-mono text-xs text-ink/65 text-right">
                      max(wedding+30d, +12mo)
                      <br />capped at +24mo
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-ink/65">Trial</dt>
                    <dd className="font-mono text-ink">3 days · card-less</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-ink/65">Renewal</dt>
                    <dd className="font-mono text-ink">Full price, no discount</dd>
                  </div>
                </dl>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* À la carte */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              À la carte
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Pay only for what you opt into.
            </h2>
            <p className="text-base text-ink/65">
              Mix and match the add-ons you actually need. Every SKU is a one-time
              or per-event purchase — no subscriptions, no recurring couple-side
              charges.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ADD_ONS.map((addOn) => (
              <li
                key={addOn.name}
                className={
                  addOn.freeDuringLaunch
                    ? 'flex flex-col gap-3 rounded-2xl border-2 border-terracotta/40 bg-cream p-5'
                    : 'flex flex-col gap-3 rounded-2xl border border-ink/10 bg-cream p-5'
                }
              >
                <header className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                      {addOn.name}
                    </p>
                    {addOn.freeDuringLaunch ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-cream">
                        <Gift aria-hidden className="h-3 w-3" strokeWidth={2} />
                        Free during launch
                      </span>
                    ) : null}
                  </div>
                  <p className="flex items-baseline gap-2">
                    {addOn.freeDuringLaunch ? (
                      <>
                        <span className="font-sans text-3xl font-semibold tracking-tight text-terracotta">
                          FREE
                        </span>
                        <span className="text-xs text-ink/55">
                          <span className="line-through">{addOn.price}</span> ·{' '}
                          {addOn.cadence}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-sans text-3xl font-semibold tracking-tight text-ink">
                          {addOn.price}
                        </span>
                        <span className="text-xs text-ink/55">{addOn.cadence}</span>
                      </>
                    )}
                  </p>
                </header>
                <p className="text-sm text-ink/65">{addOn.blurb}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-ink/55">
            Browse every customer add-on inside your event dashboard after
            sign-up. New SKUs ship as we roll them out — no surprise pricing
            changes mid-event.
          </p>
        </div>
      </section>

      {/* Setnayan Pay 5.0% disclosure */}
      <section className="border-b border-ink/5 bg-ink/[0.02]">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <div className="space-y-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
                Setnayan Pay
              </p>
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                A flat 5.0% at checkout. Same rate on every rail.
              </h2>
              <p className="text-base text-ink/65">
                When you book a vendor through Setnayan Pay, we add a flat 5.0%
                convenience fee on top of the vendor&rsquo;s listed price. That
                funds BIR-compliant receipts, in-app messaging, milestone-protected
                payments, and platform safety. Your vendor still receives 100% of
                their listed price.
              </p>
              <p className="text-xs text-ink/55">
                Rate locked 2026-05-16. Disclosed on every order summary before
                you confirm.
              </p>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-cream p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
                Worked example
              </p>
              <p className="mt-3 text-sm text-ink/65">
                Booking a ₱100,000 photographer.
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink/65">Vendor&rsquo;s listed price</dt>
                  <dd className="font-mono text-ink">₱100,000</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink/65">Setnayan Pay (5.0%)</dt>
                  <dd className="font-mono text-ink">₱5,000</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-ink/10 pt-2">
                  <dt className="text-ink/65">You pay at checkout</dt>
                  <dd className="font-mono text-sm font-semibold text-terracotta">
                    ₱105,000
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Vendor pricing pointer */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-cream p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
                For vendors
              </p>
              <p className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
                Free to list. Pro ₱499/week — pause anytime.
              </p>
              <p className="text-sm text-ink/65">
                Verification, boosted ads, sponsored boost, and the All Tools
                Unlock bundle live on /for-vendors.
              </p>
            </div>
            <Link
              href="/for-vendors"
              className="button-secondary inline-flex shrink-0 items-center justify-center gap-2 text-sm"
            >
              See vendor pricing
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer with logo */}
      <footer className="border-t border-ink/5">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Logo />
            <p className="text-xs text-ink/55">
              Prices in PHP. BIR-compliant receipts issued on every Setnayan Pay
              transaction. © Setnayan.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
