'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * DesktopRedirect — the /dashboard/[eventId]/more landing is a mobile-only
 * affordance (CustomerMobileLanding is wrapped in `lg:hidden`), so a desktop
 * user who reaches /more by direct URL would otherwise see a blank page. On
 * `lg` viewports (≥1024px · Tailwind's lg breakpoint) bounce them back to the
 * event dashboard root, where the sidebar already surfaces every group. Below
 * `lg` this is a no-op and the mobile landing renders.
 *
 * Mirrors the vendor doorway's
 * app/vendor-dashboard/more/_components/desktop-redirect.tsx, but takes the
 * destination as a prop because the customer dashboard root is event-scoped
 * (`/dashboard/[eventId]`), not a static path.
 *
 * Client-side because the breakpoint is a viewport property the server can't
 * read. `router.replace` keeps the dead /more URL out of history.
 */
export function DesktopRedirect({ to }: { to: string }) {
  const router = useRouter();

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    if (mql.matches) {
      router.replace(to);
      return;
    }
    // If the viewport crosses into lg while the page is open (rotate /
    // resize), redirect then too so the user never sits on a blank page.
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) router.replace(to);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [router, to]);

  return null;
}
