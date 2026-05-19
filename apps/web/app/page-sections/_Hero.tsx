import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HeroBackdrop } from '@/app/_components/hero-backdrop';

// Section 2 — Hero (three-question framing) (iteration 0015 § Section 2)
// Above-the-fold conversion module. Problem-aware framing per CXL awareness-
// stage research — 95% of homepage visitors are problem-aware, not solution-
// aware.
//
// Spec essentials:
//   - Eyebrow (small, all-caps, muted, brand-accent): SET NA 'YAN · /sɛt na jan/
//   - Headline stack (3 lines, h1; large 64–96px desktop, 40–56px mobile)
//   - Subhead (h2-size 22–28px)
//   - Primary CTA `Start planning · free` → /apply  (signup in this codebase)
//   - Secondary CTA `I'm a vendor →` → /for-vendors
//   - Trust strip: Built in the Philippines · BIR-compliant receipts · EN / Tagalog
//
// Visual treatment: full-bleed photography + brand-color overlay (Zola
// pattern from the spec) when NEXT_PUBLIC_HERO_IMAGE_URL is set; falls back
// to the brand radial-gradient wash when no photo is configured. See
// `app/_components/hero-backdrop.tsx` for the "how to ship a real photo"
// runbook.

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
          <span className="mt-1 block">Or a vendor</span>
          <span className="mt-1 block text-ink/65">
            looking for customers?
          </span>
        </h1>

        <p
          className="mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-ink/70 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-backwards sm:text-xl lg:text-[22px]"
          style={{ animationDelay: '240ms' }}
        >
          Setnayan is the only Filipino-built platform with real operating
          tools for both sides — from your guest list to your same-day
          highlight reel. Vendors pre-register today.{' '}
          <strong className="text-ink">Couples launch December 1, 2026.</strong>
        </p>

        <div
          className="mt-10 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-backwards sm:flex-row sm:items-center"
          style={{ animationDelay: '360ms' }}
        >
          <Link
            href="/signup?as=vendor"
            className="button-primary inline-flex min-h-[48px] items-center justify-center gap-2 px-7 text-sm font-semibold transition-transform hover:scale-[1.02] sm:text-base"
          >
            I&rsquo;m a vendor
            <span aria-hidden className="mx-1 opacity-60">
              ·
            </span>
            <span className="opacity-90">pre-register</span>
            <ArrowRight aria-hidden className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
          </Link>
          <Link
            href="/waitlist"
            className="button-secondary inline-flex min-h-[44px] items-center justify-center gap-2 px-6 text-sm font-medium transition-transform hover:scale-[1.02] sm:text-base"
          >
            I&rsquo;m a couple — join waitlist
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
          EN / Tagalog
        </p>
      </div>
    </section>
  );
}
