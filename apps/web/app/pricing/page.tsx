import Link from 'next/link';
import { Check, ArrowRight, Sparkles, Gift } from 'lucide-react';
import { SiteHeader } from '@/app/_components/site-header';
import { Logo } from '@/app/_components/logo';
import { formatPromoEndDateShort, LAUNCH_PROMO_UNTIL } from '@/lib/sku-catalog';

// /pricing — couple-side pricing.
//
// Trimmed aggressively 2026-05-18 per owner directive ("too heavy, too many
// words"). Concise marketing page only — full add-on catalog (Custom Monogram,
// AI Highlights, Contract Intelligence, etc.) lives inside the authenticated
// dashboard add-on picker where it's discoverable at the point of decision.
//
// Pricing mirrors supabase/migrations/20260516000000_v1_sku_lock_service_catalog.sql
// and 20260518100000_launch_promo_until_mar_2027.sql.

export const metadata = {
  title: 'Pricing — Setnayan',
  description:
    'Setnayan Concierge ₱4,999 with 3-day free trial. Free planning tools. Most add-ons free until Mar 31, 2027. Flat 5.0% at checkout.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing — Setnayan',
    description:
      'Setnayan Concierge ₱4,999. Free planning tools. Add-ons free until Mar 31, 2027.',
    url: '/pricing',
    type: 'website',
    siteName: 'Setnayan',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing — Setnayan',
    description: 'Concierge ₱4,999 · planning free · 5.0% at checkout.',
  },
};

type AddOn = {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  freeDuringLaunch: boolean;
};

const ADD_ONS: Array<AddOn> = [
  {
    name: 'Save-the-Date Video',
    price: '₱99',
    cadence: 'per render',
    blurb: 'Vertical 30–60s MP4 from your engagement photos.',
    freeDuringLaunch: true,
  },
  {
    name: 'Live Schedule Widget',
    price: '₱999',
    cadence: 'per event',
    blurb: 'Live "happening now" highlight on your invitation page.',
    freeDuringLaunch: true,
  },
  {
    name: 'Panood — Daily Broadcast',
    price: '₱499',
    cadence: 'per day',
    blurb: 'Live-stream your ceremony to your own YouTube channel.',
    freeDuringLaunch: true,
  },
  {
    name: 'Panood — Annual Streaming',
    price: '₱2,999',
    cadence: 'per year',
    blurb: 'Unlimited broadcasts for 12 months of household events.',
    freeDuringLaunch: true,
  },
  {
    name: 'Patiktok',
    price: '₱999',
    cadence: 'per day',
    blurb: 'TikTok booth — guests record clips that auto-post.',
    freeDuringLaunch: true,
  },
];

const PROMO_END_SHORT = formatPromoEndDateShort(LAUNCH_PROMO_UNTIL);

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <SiteHeader />

      {/* Hero — tight */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 pt-20 pb-12 sm:px-6 sm:pt-28 sm:pb-16 lg:px-8 lg:pt-32 lg:pb-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Pricing
          </p>
          <h1 className="mt-4 text-balance font-sans text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-[88px]">
            Free to plan.{' '}
            <span className="text-ink/55">Pay only for what you opt into.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-ink/65">
            Most add-ons are <strong className="text-ink">free until {PROMO_END_SHORT}</strong>{' '}
            during launch. Vendor bookings include a flat 5.0% at checkout.
          </p>
        </div>
      </section>

      {/* Concierge flagship — lightweight card */}
      <section className="border-b border-ink/5 bg-ink/[0.02]">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <article className="overflow-hidden rounded-3xl border-2 border-terracotta bg-cream p-8 shadow-[0_30px_80px_-40px_rgba(122,31,43,0.25)] sm:p-12">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cream">
                <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
                Flagship
              </span>
              <span className="inline-flex items-center rounded-full border border-terracotta/30 bg-terracotta/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                3-day free trial
              </span>
            </div>
            <h2 className="mt-6 font-sans text-4xl font-semibold tracking-tight sm:text-5xl">
              Setnayan Concierge
            </h2>
            <p className="mt-4 flex items-baseline gap-3">
              <span className="font-sans text-6xl font-semibold tracking-tight text-ink sm:text-7xl">
                ₱4,999
              </span>
              <span className="text-base text-ink/55">one-time</span>
            </p>
            <p className="mt-6 max-w-xl text-lg text-ink/70">
              A real coordinator stays with your event from activation through
              30 days after your wedding date.
            </p>
            <ul className="mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
              {[
                'Dedicated coordinator',
                'Vendor sourcing + shortlists',
                'Day-of run-of-show',
                'Post-event wrap-up',
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
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup?intent=concierge"
                className="button-primary inline-flex min-h-[52px] items-center justify-center gap-2 px-8 text-base font-semibold"
              >
                Start 3-day free trial
                <ArrowRight aria-hidden className="h-5 w-5" strokeWidth={2} />
              </Link>
              <Link
                href="/signup"
                className="text-sm font-medium text-ink/55 underline-offset-4 hover:text-terracotta hover:underline self-center"
              >
                Or plan it yourself — free
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* À la carte — 5 cards, 1-sentence blurbs */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mb-12 max-w-2xl space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              À la carte
            </p>
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Free during launch.
            </h2>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ADD_ONS.map((addOn) => (
              <li
                key={addOn.name}
                className="flex flex-col gap-3 rounded-2xl border-2 border-terracotta/40 bg-cream p-6"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                    {addOn.name}
                  </p>
                  <Gift
                    aria-hidden
                    className="h-4 w-4 text-terracotta"
                    strokeWidth={2}
                  />
                </div>
                <p className="flex items-baseline gap-2">
                  <span className="font-sans text-3xl font-semibold tracking-tight text-terracotta">
                    FREE
                  </span>
                  <span className="text-xs text-ink/55">
                    <span className="line-through">{addOn.price}</span> · {addOn.cadence}
                  </span>
                </p>
                <p className="text-sm leading-relaxed text-ink/65">{addOn.blurb}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-ink/55">
            Premium add-ons (Custom Monogram, AI Highlights, Save-the-Date Video Premium) live inside your event dashboard after sign-up.
          </p>
        </div>
      </section>

      {/* Setnayan Pay — one sentence */}
      <section className="border-b border-ink/5 bg-ink/[0.02]">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Setnayan Pay
          </p>
          <p className="mt-4 max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Flat 5.0% at checkout. Same rate on every rail. Your vendor still receives 100% of their listed price.
          </p>
        </div>
      </section>

      {/* Vendor pointer */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-cream p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <p className="text-base font-semibold text-ink">
              Vendor? Pioneer-vendor spot, Pro free until {PROMO_END_SHORT}.
            </p>
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

      <footer className="border-t border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Logo />
            <p className="text-xs text-ink/55">
              PHP only · BIR receipts on every Setnayan Pay transaction · © Setnayan
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
