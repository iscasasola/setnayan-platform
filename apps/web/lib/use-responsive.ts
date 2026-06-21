'use client';

import { useEffect, useState } from 'react';

/**
 * SYS-1 — the single source of truth for runtime breakpoint + motion reads
 * (Responsive_and_Mobile_UI_Ruleset_2026-06-21 · SYS-1).
 *
 * The values mirror the Tailwind `screens` in tailwind.config.ts (sm 640 /
 * md 768 / lg 1024 / xl 1280 / 2xl 1536) so a JS branch point can never drift
 * from the CSS one. Use these hooks instead of hand-rolling
 * `window.matchMedia(...)` in a component — the audit found ~16 inlined copies
 * of the same query; this is where new code reads the viewport.
 *
 * The master mobile↔desktop switch is `lg` (1024px): below it the floating
 * BottomNav owns navigation, at/above it the desktop sidebar takes over.
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * SSR-safe media-query subscription. Returns `false` on the server and the
 * first client render (so markup matches), then resolves to the real match
 * after mount and stays live on resize / rotate.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * True at or above the given breakpoint (min-width). Defaults to `lg` — the
 * app's master mobile↔desktop switch.
 */
export function useIsDesktop(breakpoint: Breakpoint = 'lg'): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[breakpoint]}px)`);
}

/** True below the given breakpoint (max-width). Defaults to `lg`. */
export function useIsMobile(breakpoint: Breakpoint = 'lg'): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`);
}

/**
 * Honors the OS "reduce motion" setting. The one shared reader — new
 * come-and-go animations gate on this instead of inlining the query.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
