'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

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
 * event page — carries only this context, never the store.
 */
export type LastSeenScopeValue = { userId: string; eventId: string };

const Scope = createContext<LastSeenScopeValue | null>(null);

export function LastSeenScope({
  userId,
  eventId,
  children,
}: LastSeenScopeValue & { children: ReactNode }) {
  const value = useMemo(() => ({ userId, eventId }), [userId, eventId]);
  return <Scope.Provider value={value}>{children}</Scope.Provider>;
}

export function useLastSeenScope(): LastSeenScopeValue | null {
  return useContext(Scope);
}
