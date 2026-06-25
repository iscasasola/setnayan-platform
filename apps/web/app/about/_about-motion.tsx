'use client';

/**
 * Client motion island for /about — the page stays a force-static Server
 * Component; this file owns the only motion on the surface. It imports the
 * shared premium primitives (read-only foundation in `_premium.tsx`) and adds
 * NOTHING to the page's information architecture: every wrapper just renders the
 * server-passed children and attaches a reveal ref.
 *
 * Signature (the ONE bold moment): the hero <h1> gets the serif line-reveal —
 * the page's only type moment, since the heading literally composes the brand
 * thesis ("Set na 'yan. Your wedding, all set …"). Everything else is a quiet
 * opacity/y rise.
 *
 * a11y / SSR contract:
 *   • Client components still SSR, so the hero h1 text ships in the static HTML
 *     and stays in the DOM/a11y tree (line-reveal is opacity-only, never
 *     visibility/display).
 *   • prefers-reduced-motion → the foundation hooks rest everything visible.
 *   • No new colour is introduced here (gold-budget discipline lives in the
 *     server markup); this island only orchestrates motion.
 */

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useReveal, useLineReveal } from '@/app/_components/marketing/_premium';

/**
 * AboutHero — renders the hero block so `useLineReveal`'s ref can sit directly on
 * the real <h1>. The eyebrow + breadcrumb + lead paragraphs share one quiet
 * `useReveal` group (each marked `data-reveal-item`); the h1 is NOT a reveal-item
 * (the line-reveal owns it), so the two hooks never fight over the same element.
 * Above the fold → both fire on load (line-reveal on `mount`, the group's IO
 * resolves immediately).
 */
export function AboutHero() {
  const headingRef = useLineReveal({ trigger: 'mount' });
  const groupRef = useReveal({ stagger: 0.08, y: 14 });

  return (
    <section
      ref={groupRef as React.RefObject<HTMLElement>}
      className="mx-auto w-full max-w-4xl px-4 pb-12 pt-16 sm:px-6 sm:pt-20 lg:px-8"
    >
      <nav
        aria-label="Breadcrumb"
        data-reveal-item
        className="mb-8 flex items-center justify-between gap-4 text-sm text-ink/50"
      >
        <span>
          <Link href="/" className="hover:text-ink hover:underline">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink/80">About</span>
        </span>
        {/* Locale switch — Taglish edition (hreflang reciprocal) */}
        <Link
          href="/tl/about"
          hrefLang="tl-PH"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 underline-offset-4 hover:text-ink hover:underline"
        >
          Taglish
        </Link>
      </nav>

      <p
        data-reveal-item
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta"
      >
        <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        About Setnayan
      </p>
      <h1
        ref={headingRef as React.RefObject<HTMLHeadingElement>}
        className="max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl"
      >
        Set na &rsquo;yan. Your wedding, all set — on one Filipino platform.
      </h1>
      <p
        data-reveal-item
        className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/75"
      >
        Setnayan (<span className="font-medium">SET-na-yan</span>, from the
        Tagalog <em>&ldquo;Set na &rsquo;yan.&rdquo;</em> — &ldquo;that&rsquo;s
        all set&rdquo;) is the Philippines&rsquo; own all-in-one wedding and
        life-events platform — and the first built here to do the whole
        celebration in one place: plan the event, hire from a 0%-commission
        marketplace of verified local vendors, and capture the day so every
        guest goes home with their own highlight reel.
      </p>
      <p
        data-reveal-item
        className="mt-4 max-w-2xl text-lg leading-relaxed text-ink/75"
      >
        Not a foreign directory with a Philippine filter — software built and
        operated entirely in the Philippines, for the way Filipino couples
        actually plan: a free planning workspace, verified local vendors,
        transparent peso pricing, and zero commission on what you pay your
        suppliers.
      </p>
    </section>
  );
}

/**
 * RevealGrid — a whole-group reveal with a short stagger across direct children.
 * Used for the fact grid (4 cards); each card carries `data-reveal-item` in the
 * server markup. Keeps the grid's CSS hover-lift alive (the foundation hook does
 * clearProps:transform on finish).
 */
export function RevealGrid({ children }: { children: ReactNode }) {
  const ref = useReveal({ stagger: 0.05, y: 16 });
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {children}
    </div>
  );
}

/**
 * RevealSection — single whole-section reveal (no inner stagger): the ref element
 * itself rises once on scroll-in. Used for the "Software, not an agency" block,
 * the FAQ list, and the closing CTA card — each a coherent scannable unit that
 * should arrive as one quiet beat, not row-by-row.
 */
export function RevealSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useReveal();
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </div>
  );
}
