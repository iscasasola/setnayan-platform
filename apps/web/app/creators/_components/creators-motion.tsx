'use client';

/**
 * Client motion wrapper for /creators — the same thin island /vendors ships
 * (for-vendors-motion.tsx): the page stays a Server Component (metadata +
 * JSON-LD); each below-the-fold section gets ONE quiet fade+rise entrance via
 * the shared useReveal. The hero is intentionally NOT wrapped (LCP element).
 * opacity-only (content stays in the a11y tree), prefers-reduced-motion rests
 * visible, useGSAP cleanup — all inside useReveal.
 */

import type { ReactNode } from 'react';
import { useReveal } from '@/app/_components/marketing/_premium';

/** Reveals the wrapped section as one quiet fade+rise when it scrolls into view. */
export function RevealOnView({ children, y = 20 }: { children: ReactNode; y?: number }) {
  const ref = useReveal({ y });
  return <div ref={ref as React.RefObject<HTMLDivElement>}>{children}</div>;
}
