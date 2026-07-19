'use client';

/**
 * Shared client motion island for the five "Pa-" public marketing landing pages
 * — /panood, /pa3d, /palogo, /pawebsite, /patiktok (Pa- naming LOCKED, owner
 * 2026-06-27). Each page's page.tsx stays a force-static Server Component that
 * owns ALL copy, routes, metadata, and the two JSON-LD blocks; this file adds
 * NOTHING to any page's information architecture. Every wrapper renders the
 * server-passed children verbatim and only attaches a reveal / panel ref.
 *
 * These are the SAME premium primitives /papic already factors out in its own
 * `_papic-motion.tsx` (LineRevealHeading / RevealBand / RevealList /
 * HowItWorksPanel), hoisted here once so the five new pages share one island
 * instead of duplicating it five times. They wrap the read-only foundation hooks
 * in `_premium.tsx`; no new motion behaviour is introduced.
 *
 * a11y / SSR contract (same proven foundation as /papic + /setnayan-ai):
 *   • Client components still SSR, so all copy ships in the static HTML and stays
 *     in the DOM / a11y tree. Reveals are opacity/transform only (never
 *     visibility/display), so nothing leaves the screen-reader tree.
 *   • prefers-reduced-motion → the foundation hooks rest everything visible.
 *   • Gold budget: exactly ONE PanelThread per page (the "How it works" panel).
 */

import type { ReactNode } from 'react';
import {
  useReveal,
  useLineReveal,
  usePanelIntro,
  PanelThread,
} from '@/app/_components/marketing/_premium';

/**
 * LineRevealHeading — the serif line-reveal on a single text element. The ref
 * sits on the REAL element so the copy ships in SSR HTML and stays in the a11y
 * tree (opacity-only, fonts.ready-guarded, try/catch → visible). `as` preserves
 * each page's semantics (h1 for the hero, h2 for section headings).
 * `trigger:'mount'` is for the above-the-fold hero <h1>; everything else stays
 * IO-gated 'view'.
 */
export function LineRevealHeading({
  children,
  className,
  as = 'h2',
  trigger = 'view',
}: {
  children: ReactNode;
  className?: string;
  as?: 'h1' | 'h2';
  trigger?: 'view' | 'mount';
}) {
  const ref = useLineReveal({ trigger });
  if (as === 'h1') {
    return (
      <h1 ref={ref as React.RefObject<HTMLHeadingElement>} className={className}>
        {children}
      </h1>
    );
  }
  return (
    <h2 ref={ref as React.RefObject<HTMLHeadingElement>} className={className}>
      {children}
    </h2>
  );
}

/**
 * RevealBand — a whole-group quiet rise with a short stagger across the marked
 * children. Each child carries `data-reveal-item` in the server markup; the
 * foundation hook does clearProps:transform on finish so any CSS hover-lift
 * survives. Used for the hero subhead/CTAs and the benefit-card grids.
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
 * RevealList — same as RevealBand but renders a `<ul>` so the before/after
 * differentiator rows stay valid `<ul>`/`<li>`. Children carry `data-reveal-item`.
 */
export function RevealList({
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
    <ul ref={ref as React.RefObject<HTMLUListElement>} className={className}>
      {children}
    </ul>
  );
}

/**
 * HowItWorksPanel — wraps the WHOLE "How it works" SECTION in a usePanelIntro
 * scope and renders one PanelThread inside it (the page's single gold moment).
 * The H2 carries `data-premium-headline` (serif line-reveal) and the step <li>s
 * carry `data-premium-item` (staggered rise) — all orchestrated off this scope.
 * Scope root is position:relative (the thread is absolute + height:100%); the
 * cards render in a relative z-1 layer so they sit above the decorative thread.
 */
export function HowItWorksPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const scope = usePanelIntro();
  return (
    <div ref={scope} className={className} style={{ position: 'relative' }}>
      <PanelThread tone="light" />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
