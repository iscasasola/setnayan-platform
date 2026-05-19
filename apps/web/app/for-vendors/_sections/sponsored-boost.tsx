import { Radio, Zap, ShieldCheck } from 'lucide-react';

// Sponsored Boost — pulled from iteration 0022 § 5b. Positions the boost
// as the way to scale once you're verified and the local market is dense
// enough. Three rules surface here: visibility radius, certified-vendor
// gate, density gate. Pricing is shown because it's a vendor decision.

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
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <article className="flex flex-col gap-5 rounded-2xl border border-ink/10 bg-cream p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                  Sponsored Boost
                </p>
                <p className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
                  ₱1,499 <span className="font-sans text-base font-normal text-ink/55">/ week</span>
                </p>
                <p className="text-sm text-ink/55">
                  Per boosted pin · stacks weekly with Pro · pause anytime
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
