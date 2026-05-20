import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HeroBackdrop } from '@/app/_components/hero-backdrop';

// Section 2 — Hero (iteration 0015 § Section 2). Couples-primary CTA per
// spec; vendor demoted to secondary. Subhead now reflects multi-host event
// access (iteration 0048) — anyone planning can sign up, then invite a
// partner / parent / coordinator. Trust strip notes Tagalog as "soon" until
// the TL bundle ships.

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-ink/5 bg-cream"
    >
      <HeroBackdrop />
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8 lg:pb-28 lg:pt-24">
        {/*
         * Staggered entrance — each block fades up with a small delay.
         * `animate-in fade-in slide-in-from-bottom-4` is from
         * tailwindcss-animate (Phase 1 install). `fill-mode-backwards` is
         * critical: without it the elements would flash at their final
         * position before the animation starts. Per-block delays push
         * each subsequent element 80ms behind the previous one (eyebrow
         * 0, headline 80ms, subhead 240ms, CTAs 360ms, trust strip 480ms)
         * — fast enough to feel responsive, staggered enough to read as
         * intentional motion rather than a single jump.
         *
         * `prefers-reduced-motion: reduce` is handled by the global
         * `globals.css` block — these animations collapse to a 0.001ms
         * no-op for visitors with that OS setting.
         */}
        <p
          className="font-mono text-[11px] uppercase tracking-[0.28em] text-terracotta animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-backwards sm:text-xs"
        >
          SET NA &lsquo;YAN
          <span aria-hidden className="mx-2 text-ink/30">
            ·
          </span>
          <span className="text-ink/55">/sɛt na jan/</span>
        </p>

        <h1
          id="hero-heading"
          className="mt-5 max-w-4xl text-balance font-display text-[44px] font-medium leading-[1.02] tracking-tight text-ink animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-backwards sm:text-[60px] lg:text-[88px]"
          style={{ animationDelay: '80ms' }}
        >
          <span className="block">Planning a wedding?</span>
          <span className="mt-1 block text-ink/65">
            We&rsquo;ll set everything up.
          </span>
        </h1>

        <p
          className="mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-ink/70 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-backwards sm:text-xl lg:text-[22px]"
          style={{ animationDelay: '240ms' }}
        >
          The only Filipino-built platform with real operating tools for the
          whole day — guest list, vendors, budget, invitations, livestream,
          same-day highlight reel. Sign up free, then invite your partner,
          parents, or coordinator to help plan.
        </p>

        <div
          className="mt-10 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-backwards sm:flex-row sm:items-center"
          style={{ animationDelay: '360ms' }}
        >
          <Link
            href="/signup"
            className="button-primary inline-flex min-h-[48px] items-center justify-center gap-2 px-7 text-sm font-semibold transition-transform hover:scale-[1.02] sm:text-base"
          >
            Start planning
            <span aria-hidden className="mx-1 opacity-60">
              ·
            </span>
            <span className="opacity-90">free</span>
            <ArrowRight aria-hidden className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
          </Link>
          <Link
            href="/for-vendors"
            className="button-secondary inline-flex min-h-[44px] items-center justify-center gap-2 px-6 text-sm font-medium transition-transform hover:scale-[1.02] sm:text-base"
          >
            I&rsquo;m a vendor
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>

        <p
          className="mt-8 max-w-2xl text-sm text-ink/55 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-backwards"
          style={{ animationDelay: '480ms' }}
        >
          Built in the Philippines{' '}
          <span aria-hidden className="mx-1 text-ink/30">
            ·
          </span>{' '}
          BIR-compliant receipts{' '}
          <span aria-hidden className="mx-1 text-ink/30">
            ·
          </span>{' '}
          English today, Tagalog soon
        </p>
      </div>
    </section>
  );
}
