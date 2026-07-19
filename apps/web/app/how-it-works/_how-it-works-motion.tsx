'use client';

import Link from 'next/link';

/**
 * Client motion island for /how-it-works — the page itself stays a
 * force-dynamic Server Component (metadata + JSON-LD + hreflang live there).
 * This file owns the ONLY motion on the surface and imports the shared,
 * read-only premium primitives from `_premium.tsx`. It adds NOTHING to the
 * information architecture: every wrapper renders server-passed children and
 * only attaches a motion ref / marker attributes.
 *
 * Signature (the ONE bold moment): the champagne PanelThread stitch is drawn
 * down the numbered "How everyone connects, in order" flow — synced to a serif
 * line-reveal on that section's H2 via usePanelIntro. The thread literally
 * traces the six ordered hand-offs. Gold appears in exactly one place on the
 * page (this one thread); everything else is a quiet opacity/y rise.
 *
 * Scope discipline (the documented risk): usePanelIntro reveals only ONE
 * `[data-premium-headline]` per scope. So the hero H1 is NOT inside any
 * usePanelIntro scope — it gets its own `useLineReveal({ trigger: 'mount' })`.
 * The flow H2 is the single `data-premium-headline` inside the flow's
 * usePanelIntro scope. The two type-moments never share a scope or an element.
 *
 * a11y / SSR contract:
 *   • Client components still SSR, so all heading + body text ships in the
 *     static HTML and stays in the DOM / a11y tree.
 *   • Motion is opacity (+ transform) only — never visibility/display — so the
 *     flow <ol> stays in the accessibility tree throughout.
 *   • prefers-reduced-motion → the foundation hooks rest everything visible.
 *   • No new colour is introduced here; the single gold thread is the
 *     PanelThread primitive. Gold-budget discipline holds.
 */

import type { ReactNode } from 'react';
import {
  useReveal,
  useLineReveal,
  usePanelIntro,
  PanelThread,
} from '@/app/_components/marketing/_premium';

/**
 * HeroReveal — wraps the hero section so `useLineReveal`'s ref sits directly on
 * the real <h1> (passed in as `heading`). The eyebrow / locale switch / lede /
 * CTAs share one quiet `useReveal` group (each marked `data-reveal-item` in the
 * server markup). The <h1> is NOT a reveal-item — the line-reveal owns it — so
 * the two hooks never fight over the same element. Above the fold → both fire on
 * load (line-reveal on `mount`; the group's IO resolves immediately). NO thread
 * here: the gold budget is spent entirely on the flow section below.
 */
export function HeroReveal({
  children,
}: {
  children: (headingRef: React.RefObject<HTMLHeadingElement>) => ReactNode;
}) {
  const headingRef = useLineReveal({ trigger: 'mount' });
  const groupRef = useReveal({ stagger: 0.08, y: 14 });

  return (
    <section
      ref={groupRef as React.RefObject<HTMLElement>}
      className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
    >
      {children(headingRef as React.RefObject<HTMLHeadingElement>)}
    </section>
  );
}


/**
 * HowItWorksHero — the hero moved INTO client land (2026-07-12). The page
 * (a Server Component) used to pass a render-prop FUNCTION as HeroReveal's
 * children, which is not serializable across the server→client boundary and
 * 500'd the whole route in production ("Functions are not valid as a child
 * of Client Components"). The hero content is static, so it now lives here
 * beside the hooks it needs; the page renders <HowItWorksHero /> plainly.
 */
export function HowItWorksHero() {
  return (
    <HeroReveal>
      {(headingRef) => (
        <>
          <div data-reveal-item className="mb-3 flex items-center justify-end gap-4">
            <Link
              href="/tl/how-it-works"
              hrefLang="tl-PH"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55 underline-offset-4 hover:text-ink hover:underline"
            >
              Taglish
            </Link>
          </div>
          <h1
            ref={headingRef}
            className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl"
          >
            One platform, six kinds of people. Here&rsquo;s the map.
          </h1>
          <p data-reveal-item className="mt-4 max-w-2xl text-base text-ink/70 sm:text-lg">
            Setnayan brings couples, their vendors, and their guests onto one platform —
            with an admin team behind the scenes. This page is the cheat-sheet for who
            does what and where they go.
          </p>
          <div data-reveal-item className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="button-primary inline-flex h-11 items-center px-5 text-sm">
              Start planning — free
            </Link>
            <Link
              href="/vendors"
              className="inline-flex h-11 items-center rounded-md border border-ink/15 px-5 text-sm font-medium text-ink hover:bg-ink/5"
            >
              I&rsquo;m a vendor
            </Link>
          </div>
        </>
      )}
    </HeroReveal>
  );
}

/**
 * RoleGridReveal — one `useReveal` group across the six role cards. Each card
 * carries `data-reveal-item` in the server markup; they rise in a short stagger
 * once on scroll-in. The hook's clearProps:transform on finish keeps each card's
 * CSS hover-lift alive. No thread, no per-card spectacle.
 */
export function RoleGridReveal({ children }: { children: ReactNode }) {
  const ref = useReveal({ stagger: 0.06, y: 16 });
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {children}
    </div>
  );
}

/**
 * FlowPanel — THE signature. Wraps the "How everyone connects, in order"
 * section in a `usePanelIntro` scope and renders the single `PanelThread`
 * (tone="light"). The scope is positioned relative so the absolutely-positioned
 * thread stretches the full section height (the thread runs down the gutter,
 * tracing the numbered <ol> that dominates the section body).
 *
 * Inside, the server markup marks the section H2 `data-premium-headline` (the
 * one type-moment for this scope — serif line-reveal synced to the thread draw)
 * and each of the six numbered rows `data-premium-item` (the quiet staggered
 * rise). Exactly ONE headline + ONE thread per the primitive's contract.
 */
export function FlowPanel({ children }: { children: ReactNode }) {
  const scope = usePanelIntro();
  return (
    <section
      ref={scope}
      aria-label="How everyone connects"
      className="relative mx-auto mt-16 w-full max-w-6xl px-4 sm:px-6 lg:px-8"
    >
      <PanelThread tone="light" />
      {children}
    </section>
  );
}

/**
 * RevealBlock — a single whole-section quiet reveal (no inner stagger): the ref
 * element rises once on scroll-in. Used for the "Coming next" V1.2 card. Passes
 * through className + aria-label so the server markup keeps its exact layout +
 * a11y labelling.
 */
export function RevealBlock({
  children,
  className,
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  const ref = useReveal();
  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </section>
  );
}

/**
 * FinalCtaReveal — the paired two-up closing CTA. One `useReveal` group with a
 * slight stagger across the two cards (each `data-reveal-item` in the server
 * markup). CTAs themselves are untouched — no magnetic effect, mulberry buttons
 * as-is.
 */
export function FinalCtaReveal({
  children,
  className,
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  const ref = useReveal({ stagger: 0.1, y: 16 });
  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </section>
  );
}
