'use client';

/**
 * Client motion island for /pricing — the page itself stays an async Server
 * Component (it fetches the 3 V2 catalog tables + emits the JSON-LD @graph,
 * none of which moves here). This file owns the ONLY motion on the surface and
 * adds NOTHING to its information architecture: every wrapper renders the
 * server-passed children verbatim and only attaches a reveal/panel ref. The
 * catalog group `.map()`, build_status grouping, formatSkuPriceLabel, the
 * onboarding-only bundle rule, and the JSON-LD all stay in the server file —
 * the already-fetched markup is passed DOWN as `children`.
 *
 * Signature (the page's ONE bold moment): the Software Catalog gets a single
 * champagne "build thread" (PanelThread) stitching its three build-status
 * groups — Live → In build → Coming soon — into one continuous vertical line,
 * drawn as the catalog scrolls into view. It visualizes "one continuous build
 * heading to Set na 'yan" and reinforces the page's honesty thesis. Exactly ONE
 * thread on the page (gold-budget discipline); every other section is a quiet
 * opacity/y rise.
 *
 * a11y / SSR contract (same proven foundation as /about + the homepage panels):
 *   • Client components still SSR, so all pricing copy + prices ship in the
 *     static HTML and stay in the DOM/a11y tree (reveals are opacity-only,
 *     never visibility/display).
 *   • prefers-reduced-motion → the foundation hooks rest everything visible,
 *     and PanelThread draws to its final (fully-drawn) state.
 *   • No new colour is introduced here — the thread reuses --m-orange-2 via
 *     PanelThread tone="light"; this island only orchestrates motion.
 */

import type { ReactNode } from 'react';
import {
  useReveal,
  useLineReveal,
  usePanelIntro,
  PanelThread,
} from '@/app/_components/marketing/_premium';

/**
 * RevealBand — a whole-group reveal with a short stagger across the marked
 * children. Used for the start-free 2-card band, the 4-tier ladder, the vendor
 * subscriptions/token packs, and the how-money-flows columns. Each child carries
 * `data-reveal-item` in the server markup; the foundation hook does
 * clearProps:transform on finish so any CSS hover-lift (e.g. the tier cards)
 * survives. `stagger`/`y` are tunable per band.
 */
export function RevealBand({
  children,
  className,
  stagger = 0.06,
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  y?: number;
}) {
  const ref = useReveal({ stagger, y });
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </div>
  );
}

/**
 * LineRevealHeading — the serif line-reveal on a single text element. The ref
 * sits on the REAL element so the copy ships in SSR HTML and stays in the a11y
 * tree (opacity-only, fonts.ready-guarded, try/catch → visible). `as` preserves
 * the page's existing semantics — the statement in the money-flow band is a
 * `<p>` in the source, so it stays a `<p>` here (additive-only: no element/IA
 * change). `trigger:'mount'` is for the above-the-fold hero <h1>; everything
 * else stays IO-gated 'view'.
 */
export function LineRevealHeading({
  children,
  className,
  as = 'h2',
  trigger = 'view',
}: {
  children: ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'p';
  trigger?: 'view' | 'mount';
}) {
  const ref = useLineReveal({ trigger });
  // Render the concrete element per `as` so each gets a correctly-typed ref
  // (a single polymorphic <As> would force an impossible ref-type union). The
  // ref is the SAME hook ref either way; only the element/semantics differ —
  // additive-only, matching the page's existing source element.
  if (as === 'h1') {
    return (
      <h1 ref={ref as React.RefObject<HTMLHeadingElement>} className={className}>
        {children}
      </h1>
    );
  }
  if (as === 'p') {
    return (
      <p ref={ref as React.RefObject<HTMLParagraphElement>} className={className}>
        {children}
      </p>
    );
  }
  return (
    <h2 ref={ref as React.RefObject<HTMLHeadingElement>} className={className}>
      {children}
    </h2>
  );
}

/**
 * CatalogPanel — THE signature. Wraps the WHOLE software-catalog container in a
 * usePanelIntro scope and renders one PanelThread inside it. Because PanelThread
 * uses preserveAspectRatio="none" + height:100%, the single thread STRETCHES to
 * the scope's full height and spans all three build-status groups as one
 * continuous line — not one-per-group.
 *
 * Structure rules that make the thread span correctly:
 *   • the scope root is `position: relative` (the thread is `position: absolute;
 *     height: 100%` per .sn-thread), so the thread fills the scope top-to-bottom;
 *   • children render in a `position: relative; z-index: 1` layer so cards sit
 *     above the decorative thread.
 *
 * The thread DRAWS (strokeDashoffset → 0) when the catalog enters view, while
 * the group chips/cards (server-marked `data-premium-item`) rise in document
 * order and the catalog H2 (`data-premium-headline`) does the serif line-reveal —
 * all orchestrated by usePanelIntro off this one scope.
 */
export function CatalogPanel({ children }: { children: ReactNode }) {
  const scope = usePanelIntro();
  return (
    <div ref={scope} style={{ position: 'relative' }}>
      <PanelThread tone="light" />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
