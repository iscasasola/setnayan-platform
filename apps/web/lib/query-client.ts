// Singleton TanStack Query client for the web app.
//
// Per the Caching & Offline Strategy spec § 6, the default tier is "warm
// data" (vendor profiles, mood board, budget, save-the-date previews etc.)
// at 5-minute staleTime. Hot lists override down to 60s; cold/immutable
// surfaces override up to 1 hr. gcTime is set to 24h so a query that has
// no active subscribers stays in memory long enough to short-circuit a
// return visit within the same browser session before the IndexedDB
// persister rehydrates.
//
// We cache the client in a module-level variable so HMR + RSC streaming
// don't churn it on every render. The pattern intentionally avoids module
// reinitialisation across requests by relying on Node module caching.

import { QueryClient } from '@tanstack/react-query';

const DEFAULT_STALE_TIME_MS = 5 * 60 * 1000; // 5 min — warm tier per spec § 6
const DEFAULT_GC_TIME_MS = 24 * 60 * 60 * 1000; // 24 h

let client: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (client) return client;
  client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        gcTime: DEFAULT_GC_TIME_MS,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
  return client;
}
