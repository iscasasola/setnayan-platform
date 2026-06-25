'use client';

/**
 * Client motion island for /monogram — the page stays a force-static Server
 * Component; this file owns the only motion on the surface and imports the shared
 * premium primitives (read-only foundation in `_premium.tsx`). It adds NOTHING to
 * the page's information architecture, copy, routes, or CTAs: every wrapper just
 * renders the server-passed markup and attaches a reveal ref.
 *
 * The live Monogram Studio is NOT touched here — it mounts imperatively (innerHTML
 * via paper.js/opentype.js) and is remount-sensitive, so it must never be wrapped
 * in any reveal/ref/state. All motion below lives on page siblings ABOVE and BELOW
 * the studio.
 *
 * Two moments:
 *   • Header H1 — a one-shot serif line-reveal on `mount` (above the fold, fast),
 *     so the tool stays instantly reachable. Everything else in the header is
 *     static SSR markup.
 *   • Closing "Make it official" CTA — THE signature: a single champagne PanelThread
 *     stitches up the card's left gutter as that card's serif headline resolves
 *     (usePanelIntro draws thread + headline together — a monogram is two strokes
 *     interlocked into one).
 *
 * a11y / SSR contract:
 *   • Client components still SSR, so all heading + body text ships in the static
 *     HTML and stays in the DOM/a11y tree (reveals are opacity-only, never
 *     visibility/display).
 *   • prefers-reduced-motion → the foundation hooks rest everything visible.
 *   • No new colour is introduced here (gold-budget discipline lives in the server
 *     markup + the single PanelThread); this island only orchestrates motion.
 */

import type { ReactNode } from 'react';
import {
  useReveal,
  useLineReveal,
  usePanelIntro,
  PanelThread,
} from '@/app/_components/marketing/_premium';

/**
 * MonogramHeadline — the above-the-fold H1 gets the serif line-reveal on `mount`
 * (NOT IntersectionObserver-gated, so it never waits on scroll and the tool stays
 * reachable). The ref sits directly on the real <h1>; reduced-motion rests it
 * visible. Copy is passed from the server page so the IA stays server-owned.
 */
export function MonogramHeadline({ children }: { children: ReactNode }) {
  const ref = useLineReveal({ trigger: 'mount', duration: 0.8 });
  return (
    <h1
      ref={ref as React.RefObject<HTMLHeadingElement>}
      className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[var(--m-ink)] sm:text-5xl"
    >
      {children}
    </h1>
  );
}

/**
 * StepsReveal — the 3-step "how it works" <ol> gets a restrained staggered rise;
 * each <li> carries `data-reveal-item` in the server markup. NO thread here (the
 * gold budget is spent on the closing card). clearProps:transform on finish keeps
 * any CSS hover behaviour alive.
 */
export function StepsReveal({ children }: { children: ReactNode }) {
  const ref = useReveal({ stagger: 0.07, y: 16 });
  return (
    <ol ref={ref as React.RefObject<HTMLOListElement>} className="grid gap-6 sm:grid-cols-3">
      {children}
    </ol>
  );
}

/**
 * ClosingCta — THE signature. `usePanelIntro` scopes this card; the single
 * `<PanelThread tone="light"/>` stitches up the left gutter while the card's serif
 * headline (`data-premium-headline`) resolves in lines — thread draw + headline
 * land together. The CTA button + supporting copy are server-passed children, so
 * copy/route/CTA stay untouched; the body paragraph + button are marked
 * `data-premium-item` for the quiet rise. The card itself is `position: relative`
 * so the absolutely-positioned `.sn-thread` anchors to it.
 */
export function ClosingCta({
  heading,
  children,
}: {
  heading: ReactNode;
  children: ReactNode;
}) {
  const ref = usePanelIntro();
  return (
    <section
      ref={ref}
      className="relative mx-auto mt-14 max-w-2xl overflow-hidden rounded-3xl border border-[var(--m-orange)]/40 bg-[var(--m-orange-4)] px-6 py-10 text-center"
    >
      <PanelThread tone="light" />
      <div className="relative">
        <h2
          data-premium-headline
          className="font-serif text-2xl text-[var(--m-ink)] sm:text-3xl"
        >
          {heading}
        </h2>
        {children}
      </div>
    </section>
  );
}
