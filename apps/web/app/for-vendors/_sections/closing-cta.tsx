import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// Final dual CTA — `List your business · free` repeated as the primary,
// `Talk to a human →` as the ghost secondary. Per CLAUDE.md decision-log
// pattern (DesignStudioUIUX / NerdCow CTA-hierarchy research), 1 primary
// + 1 visually subordinate secondary lifts conversion ~42% over equal-
// weight CTAs.

export function ClosingCta() {
  return (
    <section className="border-b border-ink/5 bg-cream">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="rounded-3xl border border-terracotta/30 bg-cream p-8 shadow-[0_30px_80px_-40px_rgba(122,31,43,0.18)] sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div className="space-y-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
                Set na &lsquo;yan.
              </p>
              <h2 className="font-sans text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
                Pioneer vendor spot.{' '}
                <span className="text-ink/55">Free for 10 months.</span>
              </h2>
              <p className="text-base text-ink/65">
                Pre-register today. We&rsquo;ll verify within a week. Couples
                land on a marketplace already stocked with photographers,
                caterers, florists, and coordinators by December 1.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/signup?as=vendor"
                className="button-primary inline-flex min-h-[52px] items-center justify-center gap-2 px-6 text-base font-semibold"
              >
                Pre-register your business
                <ArrowRight aria-hidden className="h-5 w-5" strokeWidth={2} />
              </Link>
              <Link
                href="/help#contact"
                className="text-center text-sm font-medium text-ink/55 underline-offset-4 hover:text-terracotta hover:underline"
              >
                Talk to a human — same-day reply
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
