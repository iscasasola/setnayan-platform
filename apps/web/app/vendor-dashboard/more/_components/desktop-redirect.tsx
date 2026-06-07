'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * DesktopRedirect — the /vendor-dashboard/more landing is a mobile-only
 * affordance (VendorMobileLanding is wrapped in `lg:hidden`), so a desktop
 * user who reaches /more by direct URL would otherwise see a blank page.
 * On `lg` viewports (≥1024px · Tailwind's lg breakpoint) bounce them back
 * to the vendor dashboard root, where the sidebar already surfaces every
 * group. Below `lg` this is a no-op and the mobile landing renders.
 *
 * Client-side because the breakpoint is a viewport property the server
 * can't read. `router.replace` keeps the dead /more URL out of history.
 */
export function DesktopRedirect() {
  const router = useRouter();

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    if (mql.matches) {
      router.replace('/vendor-dashboard');
      return;
    }
    // If the viewport crosses into lg while the page is open (rotate /
    // resize), redirect then too so the user never sits on a blank page.
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) router.replace('/vendor-dashboard');
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [router]);

  return null;
}
