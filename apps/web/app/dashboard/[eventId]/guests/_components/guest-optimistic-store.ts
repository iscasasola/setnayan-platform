'use client';

/**
 * guest-optimistic-store.ts — the CLIENT overlay store for the Living Roster
 * (P1). A thin, module-level `useSyncExternalStore` shell over the pure logic in
 * `lib/guest-optimistic.ts` (which carries all the unit-tested rules).
 *
 * Why a store and not `useOptimistic`: the roster's success signal is a URL
 * flag + a full SSR re-render (not a single form's pending state), and sibling
 * surfaces (desktop SelectionBar + mobile carousel) act on the same list. A
 * module store lets the delete button, the row, and the reconcile effect all
 * share ONE overlay without a common React ancestor — the same reason
 * `guest-selection-store.ts` exists.
 *
 * The overlay hides optimistically-removed guests (and, in P2, patches inline
 * field edits) until `reconcile(serverGuests)` confirms the server caught up.
 */

import { useSyncExternalStore } from 'react';
import {
  EMPTY_OPTIMISTIC,
  applyMutation,
  clearMutation,
  reconcile as reconcilePure,
  type GuestFieldOverride,
  type GuestMutation,
  type OptimisticState,
} from '@/lib/guest-optimistic';

let state: OptimisticState = EMPTY_OPTIMISTIC;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function commit(next: OptimisticState) {
  if (next === state) return; // pure helpers return the SAME ref on no-op
  state = next;
  emit();
}

export const guestOptimistic = {
  /** Reflect a mutation locally (hide a delete / patch a field) immediately. */
  apply(mutation: GuestMutation) {
    commit(applyMutation(state, mutation));
  },
  /** Drop a mutation from the overlay — used on undo and on server-error rollback. */
  clear(mutation: GuestMutation) {
    commit(clearMutation(state, mutation));
  },
  /** Reconcile-by-id against a freshly revalidated server list (idempotent).
   *  Generic over any row carrying `guest_id` + the override fields (GuestRow
   *  satisfies this — its side/role/rsvp_status are the fields reconcile reads). */
  reconcile<G extends { guest_id: string } & GuestFieldOverride>(
    serverGuests: readonly G[],
  ) {
    commit(reconcilePure(serverGuests, state));
  },
  /** Test/escape hatch — clear the whole overlay. */
  reset() {
    commit(EMPTY_OPTIMISTIC);
  },
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return state;
}

export function useGuestOptimistic(): OptimisticState {
  // Server snapshot === client initial (empty overlay) — pure client concern,
  // no hydration mismatch.
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_OPTIMISTIC);
}
