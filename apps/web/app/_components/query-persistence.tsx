'use client';

/**
 * QueryPersistence — starts the query cache's IndexedDB copy (`lib/query-persistence.ts`) once the page has loaded and
 * gone idle (`whenPageSettles`). Draws nothing. Its module, TanStack Query and idb-keyval load only then, never in a
 * page's first load (speed pass 2026-11-18; 🔒 `lib/the-query-cache-waits-for-the-page.test.ts`).
 */
import { useEffect } from 'react';
import { whenPageSettles } from '@/lib/when-page-settles';

export function QueryPersistence() {
  useEffect(() => {
    let stop: (() => void) | null = null;
    let gone = false;
    const cancel = whenPageSettles(() => {
      void import('@/lib/query-persistence')
        .then(({ startQueryPersistence }) => startQueryPersistence())
        .then((unsubscribe) => {
          if (gone) unsubscribe();
          else stop = unsubscribe;
        })
        .catch(() => {
          /* IndexedDB blocked or the chunk failed: the app works without a persisted cache, as before. */
        });
    });
    return () => {
      gone = true;
      cancel();
      stop?.();
    };
  }, []);
  return null;
}
