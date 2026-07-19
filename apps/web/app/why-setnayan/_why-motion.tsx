'use client';

/**
 * Client motion island for /why-setnayan — the page itself stays a force-static
 * Server Component (it owns the metadata + the two JSON-LD blocks, none of which
 * moves here). This file owns the ONLY motion on the surface and adds NOTHING to
 * its information architecture: every wrapper renders the server-passed children
 * verbatim and only attaches a reveal/settle ref. The FAQ/JUGGLE/BRINGS `.map()`s,
 * the copy, the routes, and the JSON-LD all stay in the server file — the markup is
 * passed DOWN as `children`.
 *
 * Signature (the page's ONE bold moment): the "What you'd otherwise juggle" 3-card
 * row is the thesis made visual — three fragmented apps that don't talk. On reveal
 * the three cards enter SEPARATED (outer two offset outward ~28px on x + a faint
 * ~1.2° tilt, middle card centered) then converge/settle into a clean aligned trio
 * in ONE GSAP beat via useSettle. It is the ONLY bold moment, and it lives in the
 * argument section — NOT the hero. Every other section is a quiet opacity/y rise.
 * No PanelThread anywhere on this page (gold-budget discipline).
 *
 * a11y / SSR contract (same proven foundation as /pricing + /about):
 *   • Client components still SSR, so all copy ships in the static HTML and stays in
 *     the DOM/a11y tree (reveals are opacity/transform-only, never visibility).
 *   • useSettle sets its start offsets synchronously before paint (no flash) and
 *     never starts a card hidden from the a11y tree — opacity-only, transform-only.
 *   • prefers-reduced-motion → the foundation hooks rest everything visible and
 *     pre-settled (cards already at their natural aligned position, no offset).
 *   • No new colour is introduced here; this island only orchestrates motion.
 */

import type { ReactNode } from 'react';
import { useReveal, useLineReveal, useSettle } from '@/app/_components/marketing/_premium';

/**
 * LineRevealHeading — the serif line-reveal on a single heading. The ref sits on the
 * REAL element so the copy ships in SSR HTML and stays in the a11y tree (opacity-only,
 * fonts.ready-guarded, try/catch → visible). `trigger:'mount'` is for the above-the-fold
 * hero <h1> only; the H1 here owns the page's one type moment. Additive: same element +
 * semantics as the source.
 */
export function LineRevealHeading({
  children,
  className,
  trigger = 'view',
}: {
  children: ReactNode;
  className?: string;
  trigger?: 'view' | 'mount';
}) {
  const ref = useLineReveal({ trigger });
  return (
    <h1 ref={ref as React.RefObject<HTMLHeadingElement>} className={className}>
      {children}
    </h1>
  );
}

/**
 * RevealBand — a quiet whole-group reveal with a short stagger across the marked
 * children. Used for the hero eyebrow + subcopy, the BRINGS 4-card grid, the
 * "part no one else has" copy + CTAs, and the FAQ rows. Each child carries
 * `data-reveal-item` in the server markup; the foundation hook does
 * clearProps:transform on finish so any CSS hover survives. Renders as the element
 * named by `as` so the page's existing semantics are preserved (additive-only).
 */
export function RevealBand({
  children,
  className,
  as = 'div',
  stagger = 0.06,
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'header' | 'dl';
  stagger?: number;
  y?: number;
}) {
  const ref = useReveal({ stagger, y });
  if (as === 'header') {
    return (
      <header ref={ref as React.RefObject<HTMLElement>} className={className}>
        {children}
      </header>
    );
  }
  if (as === 'dl') {
    return (
      <dl ref={ref as React.RefObject<HTMLDListElement>} className={className}>
        {children}
      </dl>
    );
  }
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </div>
  );
}

/**
 * SettleRow — THE signature. Wraps the 3-card "What you'd otherwise juggle" row in a
 * useSettle scope. The cards carry their START offsets in the server markup
 * (`data-settle-item` + `data-settle-x` / `data-settle-rotate`): the outer two enter
 * pushed ~28px outward with a faint ±1.2° tilt, the middle card centered — three
 * fragmented apps — then they converge/settle to their natural aligned grid position
 * in one GSAP beat. The hook sets the offsets synchronously before paint (no flash),
 * runs transform/opacity only (cards never leave the a11y tree), and on
 * prefers-reduced-motion / no-IO rests everything pre-settled.
 */
export function SettleRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useSettle();
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </div>
  );
}
