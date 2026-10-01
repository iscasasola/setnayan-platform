'use client';

/**
 * Client motion wrapper for /vendors. The page stays a Server Component
 * (force-dynamic, owns metadata + JSON-LD); this thin island gives each below-the-fold
 * section ONE quiet entrance without touching the bespoke section components — it just
 * renders the server-passed section as children and reveals the wrapper on scroll-in.
 *
 * The page's signature is the existing interactive VendorDoorScenario (left alone except
 * for a contained arrival pulse + a line-reveal on its static H2), so every other section
 * gets only a restrained fade+rise — nothing competes. The hero is intentionally NOT
 * wrapped (it's above the fold / the LCP element, kept static). opacity-only (content
 * stays in the a11y tree), prefers-reduced-motion rests visible, useGSAP cleanup.
 */

import type { ReactNode } from 'react';
import { useReveal } from '@/app/_components/marketing/_premium';

/** Reveals the wrapped section as one quiet fade+rise when it scrolls into view. */
export function RevealOnView({ children, y = 20 }: { children: ReactNode; y?: number }) {
  const ref = useReveal({ y });
  return <div ref={ref as React.RefObject<HTMLDivElement>}>{children}</div>;
}
