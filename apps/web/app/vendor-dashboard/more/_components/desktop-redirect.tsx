'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useIsDesktop } from '@/lib/use-responsive';

/**
 * DesktopRedirect — the /vendor-dashboard/more landing is a mobile-only
 * affordance (VendorMobileLanding is wrapped in `lg:hidden`), so a desktop
 * user who reaches /more by direct URL would otherwise see a blank page.
 * On `lg` viewports (≥1024px · Tailwind's lg breakpoint) bounce them back
 * to the vendor dashboard root, where the sidebar already surfaces every
 * group. Below `lg` this is a no-op and the mobile landing renders.
 *
 * Client-side because the breakpoint is a viewport property the server
 * can't read. `useIsDesktop()` (SYS-1 shared hook) stays live, so this also
 * fires if the viewport crosses into `lg` while the page is open (rotate /
 * resize). `router.replace` keeps the dead /more URL out of history.
 */
export function DesktopRedirect() {
  const router = useRouter();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (isDesktop) router.replace('/vendor-dashboard');
  }, [isDesktop, router]);

  return null;
}
