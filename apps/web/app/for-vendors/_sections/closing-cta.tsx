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
                Set na &lsquo;yan para sa business mo.
              </p>
              <h2 className="font-sans text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl">
                Run your wedding business in one app.
              </h2>
              <p className="text-base text-ink/65">
                Free to list. Verified within a week. Pro when you&rsquo;re
                ready, paused when you&rsquo;re not. We&rsquo;ll be here when
                you decide.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/signup?as=vendor"
                className="button-primary inline-flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <span className="flex flex-col items-start text-left">
                  <span className="font-semibold">List your business</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] opacity-80">
                    Free
                  </span>
                </span>
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </Link>
              <Link
                href="/help#contact"
                className="button-secondary inline-flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <span className="flex flex-col items-start text-left">
                  <span className="font-semibold">Talk to a human</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Same-day reply
                  </span>
                </span>
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </Link>
              <p className="text-[11px] text-ink/55">
                Already on Setnayan?{' '}
                <Link
                  href="/login"
                  className="font-medium text-terracotta underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
