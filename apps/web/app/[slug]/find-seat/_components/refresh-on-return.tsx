'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Re-reads the page when the guest comes BACK to it — the tab or the app
 * returning to the foreground after at least a minute away. Renders nothing.
 *
 * A4 promises "No need to check back — this updates by itself", and the page is
 * often left open in a phone's browser for days before the couple seats anyone.
 * `LiveRefresher` covers the wedding day only, so without this the promise held
 * for one day in a hundred: the tab would keep showing "not set yet" after the
 * couple had seated them, until the guest thought to pull to refresh.
 *
 * Pull-only and quiet, like the day-of tick: one `router.refresh()` per return,
 * never on a timer, never a toast.
 */
export function RefreshOnReturn({ minAwayMs = 60_000 }: { minAwayMs?: number }) {
  const router = useRouter();
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        return;
      }
      const since = hiddenAt.current;
      hiddenAt.current = null;
      if (since !== null && Date.now() - since >= minAwayMs) router.refresh();
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [router, minAwayMs]);

  return null;
}
