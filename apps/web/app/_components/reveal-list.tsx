'use client';

/**
 * RevealList — the SHARED dashboard entrance wrapper (Premium-UI Phase C).
 *
 * The single, narrow premium motion allowed on lock-constrained dashboard surfaces:
 * a quiet staggered settle of a BELOW-THE-FOLD content list/grid. Wrap a server-rendered
 * `<ul>`/`<div>` of cards in this thin client component and mark each row/card with
 * `data-reveal-item`; the host page.tsx stays a Server Component (only this wrapper is
 * 'use client'). It reuses the shared `useReveal` hook, so it inherits the whole
 * contract: opacity-only (rows stay in the a11y tree), IntersectionObserver-gated,
 * clearProps:transform (CSS hover survives), prefers-reduced-motion rests static,
 * useGSAP/gsap.context cleanup.
 *
 * RULES (Premium_UI_Standard_2026-06-25 dashboard adaptation): use ONLY on a below-the-fold
 * list/grid — NEVER on above-the-fold/fold content, headers, nav, forms, or status banners.
 * Defaults are deliberately gentle (near-invisible on phones).
 */

import type { ReactNode } from 'react';
import { useReveal } from '@/app/_components/marketing/_premium';

export function RevealList({
  children,
  className,
  as = 'ul',
  stagger = 0.05,
  y = 12,
}: {
  children: ReactNode;
  className?: string;
  as?: 'ul' | 'div';
  stagger?: number;
  y?: number;
}) {
  const ref = useReveal({ stagger, y });
  if (as === 'div') {
    return (
      <div ref={ref as React.RefObject<HTMLDivElement>} className={className}>
        {children}
      </div>
    );
  }
  return (
    <ul ref={ref as React.RefObject<HTMLUListElement>} className={className}>
      {children}
    </ul>
  );
}
