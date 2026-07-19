'use client';

/**
 * Client motion island for /pricing — the page itself stays an async Server
 * Component (it fetches the V2 catalog tables + emits the JSON-LD @graph, none
 * of which moves here). This file owns the ONLY motion on the surface and adds
 * NOTHING to its information architecture: every wrapper renders the
 * server-passed children verbatim and only attaches a reveal ref. The add-on
 * group `.map()`, build_status chips, formatSkuPriceLabel, and the JSON-LD all
 * stay in the server file — the already-fetched markup is passed DOWN as
 * `children`.
 *
 * a11y / SSR contract (same proven foundation as /about + the homepage panels):
 *   • Client components still SSR, so all pricing copy + prices ship in the
 *     static HTML and stay in the DOM/a11y tree (reveals are opacity-only,
 *     never visibility/display).
 *   • prefers-reduced-motion → the foundation hooks rest everything visible.
 */

import type { ReactNode } from 'react';
import {
  useReveal,
  useLineReveal,
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

