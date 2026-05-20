import Link from 'next/link';
import { Check, Minus, ArrowRight, Gift } from 'lucide-react';
import { formatPromoEndDateShort } from '@/lib/sku-catalog';

const PROMO_END_SHORT = formatPromoEndDateShort();

// Pricing — exception to the homepage's hide-prices rule. Vendors decide
// on cost; couples don't yet (per CLAUDE.md decision log 2026-05-15
// "/for-vendors should ... include pricing visible (vendors decide on
// cost; couples don't yet)"). Free / Pro pulled from iteration 0022 § 3
// with the 2026-05-20 Free/Pro/Max relock. Max tier is NOT shown publicly
// during the launch promo — it launches as a marketing event on 2027-01-30.

type Tier = {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: Array<{ label: string; included: boolean; note?: string }>;
  cta: { label: string; href: string; primary: boolean };
};

const TIERS: Array<Tier> = [
  {
    name: 'Free',
    price: '₱0',
    cadence: 'forever — your baseline plan',
    blurb:
      'Everything you need to take a booking, get verified, and start showing up in front of Filipino couples planning a wedding.',
    features: [
      { label: 'Verified profile on the directory', included: true },
      { label: 'One service in your catalog', included: true },
      { label: 'In-app chat with couples', included: true },
      { label: 'Manual booking + payment tracking', included: true },
      { label: 'BIR-compliant receipts on Setnayan Pay bookings', included: true },
      { label: 'Multi-service catalog', included: false },
      { label: 'Per-service calendars + master calendar', included: false },
      { label: 'Proposal builder', included: false },
      { label: 'Team / agent invites', included: false },
      { label: 'Free Setnayan Concierge for every couple you book', included: false },
    ],
    cta: { label: 'Start with Free', href: '/signup?as=vendor', primary: false },
  },
  {
    name: 'Pro',
    price: '₱4,999',
    cadence: 'per week · pause anytime · ₱3,999/wk founder rate locked for life',
    blurb:
      'For vendors running multiple services, a real team, and a real pipeline. Cancel or pause weekly — no monthly lock-in, no annual contract. Pre-register during the launch promo and you lock the founder rate ₱3,999/wk for life when you convert.',
    features: [
      { label: 'Verified profile on the directory', included: true },
      { label: 'Unlimited services in your catalog', included: true, note: 'multi-service' },
      { label: 'In-app chat with couples', included: true },
      { label: 'Setnayan Pay + auto disbursement within 24h', included: true },
      { label: 'BIR-compliant receipts on every booking', included: true },
      { label: 'Multi-service catalog', included: true },
      { label: 'Per-service calendars + master calendar', included: true },
      { label: 'Proposal builder (per-client custom plans)', included: true },
      { label: 'Team / agent invites + per-service scoping', included: true },
      { label: 'Free Setnayan Concierge for every couple you book — ₱2,499 value per couple', included: true },
    ],
    cta: { label: 'Start with Pro', href: '/signup?as=vendor', primary: true },
  },
];

export function Pricing() {
  return (
    <section className="border-b border-ink/5">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Pricing — visible on purpose
          </p>
          <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
            Free to list. Pay weekly when you&rsquo;re ready for Pro.
          </h2>
          <p className="text-base text-ink/65">
            Most marketplaces charge a percentage of every booking. Setnayan
            doesn&rsquo;t — Pro is a flat weekly subscription, paused anytime,
            with <strong className="text-ink">unlimited bookings</strong> at
            every tier. A studio with 10 weddings in one week pays ₱4,999
            once.
          </p>
          <div className="flex items-start gap-3 rounded-2xl border-2 border-terracotta/40 bg-terracotta/5 p-4 sm:p-5">
            <Gift aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={2} />
            <p className="text-sm text-ink">
              <span className="font-semibold text-terracotta">Launch promo:</span>{' '}
              Pro tier and the All Tools Unlock annual bundle are{' '}
              <strong>free until {PROMO_END_SHORT}</strong>. List, accept bookings,
              and use every vendor tool without the weekly subscription kicking in.
              Boosted Ads and Sponsored Boost stay paid (competitive marketing slots).
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {TIERS.map((tier) => (
            <article
              key={tier.name}
              className={
                tier.cta.primary
                  ? 'flex flex-col gap-5 rounded-2xl border-2 border-terracotta bg-cream p-6 shadow-[0_30px_80px_-40px_rgba(122,31,43,0.25)]'
                  : 'flex flex-col gap-5 rounded-2xl border border-ink/10 bg-cream p-6'
              }
            >
              <header className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                    {tier.name}
                  </p>
                  {tier.cta.primary ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-cream">
                      Most vendors
                    </span>
                  ) : null}
                </div>
                <p className="flex items-baseline gap-2">
                  {tier.cta.primary ? (
                    <>
                      <span className="font-display text-5xl font-medium tracking-tight text-terracotta sm:text-6xl">
                        FREE
                      </span>
                      <span className="text-sm text-ink/55">
                        <span className="line-through">{tier.price}</span> · until {PROMO_END_SHORT}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-display text-5xl font-medium tracking-tight text-ink sm:text-6xl">
                        {tier.price}
                      </span>
                      <span className="text-sm text-ink/55">{tier.cadence}</span>
                    </>
                  )}
                </p>
                <p className="text-sm text-ink/65">{tier.blurb}</p>
              </header>

              <ul className="space-y-2 border-t border-ink/5 pt-4">
                {tier.features.map((f) => (
                  <li
                    key={f.label}
                    className="flex items-start gap-2 text-sm"
                  >
                    {f.included ? (
                      <Check
                        aria-hidden
                        className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                        strokeWidth={2}
                      />
                    ) : (
                      <Minus
                        aria-hidden
                        className="mt-0.5 h-4 w-4 shrink-0 text-ink/25"
                        strokeWidth={2}
                      />
                    )}
                    <span
                      className={f.included ? 'text-ink' : 'text-ink/45 line-through'}
                    >
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier.cta.href}
                className={
                  tier.cta.primary
                    ? 'button-primary mt-auto inline-flex items-center justify-center gap-2 text-sm'
                    : 'button-secondary mt-auto inline-flex items-center justify-center gap-2 text-sm'
                }
              >
                {tier.cta.label}
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-6 text-xs text-ink/55">
          Pro is billed weekly via the apply-then-pay rail (BDO transfer or
          GCash) — no card on file, no surprise renewals. Pause anytime
          from your dashboard. Marketing slots — Boosted Ads (5/10/20km
          weekly) and Sponsored Boost (Quarterly / Annual at 30km) —
          unlock once Setnayan reaches 1,000 verified vendors + 5,000
          weekly visitors. See the Sponsored Boost section below for the
          pricing preview and unlock criteria.
        </p>
      </div>
    </section>
  );
}
