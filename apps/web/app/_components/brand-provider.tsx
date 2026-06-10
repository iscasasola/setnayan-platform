'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_BRAND_MARK_SVG } from '@/lib/brand-constants';

/**
 * Supplies the brand mark URL to the in-app <Logo>/<LogoMark> with ZERO
 * call-site churn (owner 2026-06-10).
 *
 * The root layout reads the admin brand icon once (server, cached) and passes
 * the resolved mark URL — already version-busted — into this provider via
 * <Providers>. <Logo> and <LogoMark> read it through `useBrandMark()` and fall
 * back to the canonical gold SVG when no admin icon is set. Because the value
 * is threaded as a serialized prop from the server, SSR and hydration agree
 * (no flash, no mismatch), and the ~23 existing call sites are untouched.
 *
 * Only the IMAGE mark switches — the "SET NA 'YAN" text wordmark in
 * brand-marks.tsx is unaffected.
 */
const BrandMarkContext = createContext<string>(DEFAULT_BRAND_MARK_SVG);

export function BrandProvider({
  markUrl,
  children,
}: {
  /** Admin mark URL (already version-busted), or null to use the gold default. */
  markUrl: string | null;
  children: React.ReactNode;
}) {
  return (
    <BrandMarkContext.Provider value={markUrl ?? DEFAULT_BRAND_MARK_SVG}>
      {children}
    </BrandMarkContext.Provider>
  );
}

/** The current brand mark URL — the admin icon when set, else the gold default. */
export function useBrandMark(): string {
  return useContext(BrandMarkContext);
}
