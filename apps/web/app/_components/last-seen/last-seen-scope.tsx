'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

/**
 * 💾 WHOSE LAST-SEEN DATA THIS IS — the signed-in host and the event, handed
 * down by `app/dashboard/[eventId]/layout.tsx` (which has already admitted
 * them as a host: a couple or an accepted coordinator; anyone else 404s).
 *
 * The layout is the authority on identity: it is rendered by the server for
 * the session the request carries, and a different account means a fresh
 * sign-in and a fresh layout. Both halves of the feature read from here — the
 * snapshot is saved under, and only ever read back for, this account + event
 * (`lib/last-seen/store.ts`). No scope (any page outside an event) → the
 * feature does nothing.
 *
 * Kept apart from the fallback/capture so the layout chunk — paid by every
 * event page — carries only this context; the store is an `import()` away
 * (`lib/last-seen/client.ts`), warmed here on idle.
 */
export type LastSeenScopeValue = { userId: string; eventId: string };

const Scope = createContext<LastSeenScopeValue | null>(null);

export function LastSeenScope({
  userId,
  eventId,
  children,
}: LastSeenScopeValue & { children: ReactNode }) {
  const value = useMemo(() => ({ userId, eventId }), [userId, eventId]);
  // Bring the (lazy) store's CODE to the phone once the event is idle, so the
  // next loading screen can paint from it at once. Code only — no data is
  // fetched — and nothing at all with Save-Data on.
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const warm = () => void import('@/lib/last-seen/client').catch(() => {});
    if (w.requestIdleCallback) w.requestIdleCallback(warm, { timeout: 5000 });
    else window.setTimeout(warm, 2000);
  }, []);
  return <Scope.Provider value={value}>{children}</Scope.Provider>;
}

export function useLastSeenScope(): LastSeenScopeValue | null {
  return useContext(Scope);
}
