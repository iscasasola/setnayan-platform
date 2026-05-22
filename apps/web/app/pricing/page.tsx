import Link from 'next/link';
import { Check, ArrowRight, Sparkles, Gift, Brush } from 'lucide-react';
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
    'Setnayan Concierge ₱2,499 with 3-day free trial. Free planning tools. Most add-ons free until Jan 30, 2027. Flat 5.0% at checkout.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing — Setnayan',
    description:
      'Setnayan Concierge ₱2,499. Free planning tools. Add-ons free until Jan 30, 2027.',
    url: '/pricing',
    type: 'website',
    siteName: 'Setnayan',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing — Setnayan',
    description: 'Concierge ₱2,499 · planning free · 5.0% at checkout.',
  },
};

type AddOn = {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  freeDuringLaunch: boolean;
};

// Personalization SKUs — paid full price (NOT in LAUNCH_PROMO_SKU_CODES).
// Made visible on /pricing 2026-05-22 per invitation-pricing-boundary
// memory rule audit: Monogram Hero was load-bearing but invisible; Bespoke
// Monogram was vaguely mentioned ("Custom Monogram") risking confusion with
// the retired CMP ₱1,999 SKU (superseded by Bespoke Monogram per CLAUDE.md
// 2026-05-14 row).
type PaidPersonalization = {
  name: string;
  sku: string;
  price: string;
  cadence: string;
  blurb: string;
};

const ADD_ONS: Array<AddOn> = [
  {
    name: 'Save-the-Date Video',
    price: '₱199',
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
    price: '₱2,499',
    cadence: 'per day',
    blurb: 'Always multi-cam (up to 6) — live-stream to your own YouTube channel.',
    freeDuringLaunch: true,
  },
  {
    name: 'Panood — Annual Streaming',
    price: '₱19,999',
    cadence: 'per year, all events',
    blurb: 'Unlimited multi-cam broadcasts for vendors and event organizers.',
    freeDuringLaunch: true,
  },
  {
    name: 'Patiktok (Setnayan)',
    price: '₱999',
    cadence: 'per day',
    blurb: 'TikTok booth — guests auto-post to @SetnayanWeddings.',
    freeDuringLaunch: true,
  },
  {
    name: 'Patiktok (Personal)',
    price: '₱1,999',
    cadence: 'per day',
    blurb: 'TikTok booth that auto-posts to your own TikTok account.',
    freeDuringLaunch: true,
  },
];

const PERSONALIZATION: Array<PaidPersonalization> = [
  {
    name: 'Monogram Hero',
    sku: 'monogram_hero_upgrade',
    price: '₱1,999',
    cadence: 'one-time, per event',
    blurb:
      'Animated SVG-trace monogram reveal + custom video OR photo background on your invitation Hero. PNG uploads convert to SVG via our Potrace preview gate before checkout.',
  },
  {
    name: 'Bespoke Monogram',
    sku: 'bespoke_monogram',
    price: '₱2,999',
    cadence: 'one-time, per event',
    blurb:
      'AI-generated custom monogram with a 30-refinement loop, then vectorized — replaces the auto-generated monogram across your QR, invitation hero, save-the-date, and post-event highlights.',
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
          <h1 className="mt-4 text-balance font-display text-5xl font-medium leading-[1.02] tracking-tight sm:text-7xl lg:text-[96px]">
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
            <h2 className="mt-6 font-display text-4xl font-medium tracking-tight sm:text-5xl">
              Setnayan Concierge
            </h2>
            <p className="mt-4 flex items-baseline gap-3">
              <span className="font-sans text-6xl font-semibold tracking-tight text-ink sm:text-7xl">
                ₱2,499
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
            AI Highlights and other dashboard add-ons live inside your event dashboard after sign-up.
          </p>
        </div>
      </section>

      {/* Personalization — paid full price (not in launch promo).
          Added 2026-05-22 per invitation-pricing-boundary memory rule audit
          (Sweep 1 + Sweep 2 drift on /features + /pricing). These two SKUs
          are the ONLY paid customization layers on top of the free landing
          page + QR + Basic invitation widgets. */}
      <section className="border-b border-ink/5">
        <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mb-12 max-w-2xl space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Personalization
            </p>
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Make it yours.
            </h2>
            <p className="text-base text-ink/65">
              Your landing page + QR + invitation widgets are{' '}
              <strong className="text-ink">free forever</strong>. These two
              add-ons upgrade the visual identity on top of that baseline.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PERSONALIZATION.map((item) => (
              <li
                key={item.sku}
                className="flex flex-col gap-3 rounded-2xl border border-ink/15 bg-cream p-6"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                    {item.name}
                  </p>
                  <Brush
                    aria-hidden
                    className="h-4 w-4 text-ink/45"
                    strokeWidth={1.75}
                  />
                </div>
                <p className="flex items-baseline gap-2">
                  <span className="font-sans text-3xl font-semibold tracking-tight text-ink">
                    {item.price}
                  </span>
                  <span className="text-xs text-ink/55">{item.cadence}</span>
                </p>
                <p className="text-sm leading-relaxed text-ink/65">
                  {item.blurb}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Setnayan Pay — headline + worked example */}
      <section className="border-b border-ink/5 bg-ink/[0.02]">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Setnayan Pay
          </p>
          <p className="mt-4 max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Flat 5.0% at checkout. Same rate on every rail. Your vendor still receives 100% of their listed price.
          </p>

          {/* Worked example — mirrors the homepage _TransparentPricing card.
              Locked 2026-05-22 (Task #17) to close audit Sweep 4 drift —
              prior copy stated the rate but never showed the math. */}
          <div className="mt-10 flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5 sm:p-6 lg:max-w-2xl">
            <p className="text-base font-semibold tracking-tight text-ink">
              Worked example — ₱100,000 vendor booking
            </p>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink/65">Vendor&rsquo;s listed price</dt>
                <dd className="font-mono text-sm text-ink">₱100,000</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink/65">Setnayan Pay convenience fee (5.0%)</dt>
                <dd className="font-mono text-sm text-ink">₱5,000</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-ink/10 pt-2">
                <dt className="text-ink/65">You pay at checkout</dt>
                <dd className="font-mono text-sm font-semibold text-terracotta">
                  ₱105,000
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink/65">Vendor receives</dt>
                <dd className="font-mono text-sm text-ink">₱100,000</dd>
              </div>
            </dl>
            <p className="text-xs text-ink/55">
              Setnayan Pay covers the fee end-to-end — your vendor sees no
              platform deduction on their listed price (terminal fee + BIR
              withholding apply the same as on any payment platform).
            </p>
          </div>
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
