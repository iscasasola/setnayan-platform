import Link from 'next/link';
import { Radio, Zap, ShieldCheck, Hourglass } from 'lucide-react';

// Sponsored Boost — pulled from iteration 0022 § 5b. Positions the boost
// as the way to scale once you're verified and the local market is dense
// enough.
//
// 2026-05-20 owner relock: marketing SKUs (Boosted Ads + Sponsored Boost)
// are DISABLED until the platform hits 1,000 verified vendors + 5,000
// weekly unique visits sustained for 4 consecutive weeks. The pricing
// numbers are kept in copy as a forward indicator so vendors know what
// to expect, but the "Coming soon" notice at the top of the section is
// the load-bearing UX — a vendor visiting today can't buy a slot.
// Counter wiring (current vendor count + weekly visits) deferred to a
// follow-up — copy lives here without the live numbers until then.

export function SponsoredBoost() {
  return (
    <section className="border-b border-ink/5">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            When you&rsquo;re ready to scale
          </p>
          <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
            Sponsored Boost — 10km becomes 30km.
          </h2>
          <p className="text-base text-ink/65">
            Standard listings show to couples within 10km of your pin. Boost
            extends that to 30km — roughly a 3× catchment area — and ranks
            you at the top of search inside the boosted zone.
          </p>

          <div className="mt-2 flex items-start gap-3 rounded-2xl border-2 border-terracotta/40 bg-terracotta/5 p-4 sm:p-5">
            <Hourglass aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={2} />
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-terracotta">
                Marketing tools — coming soon
              </p>
              <p className="text-sm text-ink/75">
                Boosted Ads and Sponsored Boost unlock once Setnayan reaches{' '}
                <strong className="text-ink">1,000 verified vendors</strong>{' '}
                <span className="text-ink/50">and</span>{' '}
                <strong className="text-ink">5,000 weekly visitors</strong>,{' '}
                sustained for four straight weeks. Selling marketing slots
                before couples are actually browsing would waste your spend
                — so we keep it off until the audience is there.
              </p>
              <p className="text-xs text-ink/65">
                <Link
                  href="/signup?as=vendor"
                  className="font-semibold text-terracotta underline-offset-4 hover:underline"
                >
                  Pre-register today
                </Link>{' '}
                — first 30 vendors when marketing unlocks get a 20% off
                first-month promo code waiting in their dashboard.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <article className="flex flex-col gap-5 rounded-2xl border border-ink/10 bg-cream p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                  Sponsored Boost · pricing preview
                </p>
                <p className="font-display text-2xl font-medium tracking-tight text-ink sm:text-3xl">
                  <strong>₱249,999</strong>
                  <span className="font-sans text-base font-normal text-ink/55"> / quarter</span>
                  <span className="block text-base font-normal text-ink/55 sm:inline">
                    {' '}or <strong className="text-ink">₱799,999</strong> / year
                  </span>
                </p>
                <p className="text-sm text-ink/55">
                  30km catchment · verified vendors only · long-commit pricing for production-tier studios
                </p>
                <p className="text-xs text-ink/50">
                  Weekly Boosted Ads also available when marketing
                  unlocks — 5km ₱4,999/wk · 10km ₱7,999/wk · 20km ₱14,999/wk.
                </p>
              </div>
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
                <Radio aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </span>
            </div>

            <ul className="grid gap-3 sm:grid-cols-3">
              <li className="rounded-xl border border-ink/10 bg-cream p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                  10 → 30 km
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  Reach 3× the catchment
                </p>
                <p className="mt-1 text-xs text-ink/55">
                  Tagaytay base reaches Alfonso, Silang, Indang, parts of Cavite, southern Las Piñas.
                </p>
              </li>
              <li className="rounded-xl border border-ink/10 bg-cream p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                  Top of search
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  Rank above organic
                </p>
                <p className="mt-1 text-xs text-ink/55">
                  Shows with a small &ldquo;Sponsored&rdquo; pill — same card design otherwise.
                </p>
              </li>
              <li className="rounded-xl border border-ink/10 bg-cream p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                  Per-zone
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  Boost where it pays
                </p>
                <p className="mt-1 text-xs text-ink/55">
                  Multi-pin vendors enable boost per pin — e.g. Manila on, Tagaytay off.
                </p>
              </li>
            </ul>
          </article>

          <article className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-cream p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Two rules to know
            </p>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                <ShieldCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold tracking-tight text-ink">
                  Certified-vendor gate
                </h3>
                <p className="text-xs text-ink/65">
                  Boost is only available to verified vendors. Pending verification?
                  Finish onboarding first — you&rsquo;ll unlock boost the same day
                  the team flips you to Verified.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                <Zap aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold tracking-tight text-ink">
                  Density gate
                </h3>
                <p className="text-xs text-ink/65">
                  Boost is hidden until 20+ vendors in your category exist within
                  20km. No point paying to outrank an empty market — the feature
                  unlocks per pin as the local pool grows.
                </p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
