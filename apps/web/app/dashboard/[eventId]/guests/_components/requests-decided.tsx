'use client';

/**
 * 📥 THE REQUESTS JUST DECIDED, INSIDE GUESTS (R4 slice 11; owner 2026-10-31: accepting or declining a request keeps
 * the row in Guests, with a toast that carries Undo).
 *
 * Accept · Decline · Link inside Guests answer in place (`decideRequestInPlace`, `guests/claims/actions.ts`); the
 * refresh that follows drops the row from the Requests list, because it is no longer a request. So the row is kept
 * HERE — a tiny module store (the `undo-store.ts` shape) that the row's own form writes (`guests/claims/decide-in-place.tsx`)
 * and the Asking-to-join frame draws (`RequestsJustDecided`, in `guests-screen.tsx`) — the same words the Requests
 * page's "just decided" row says (frame G2). It lives above the Requests body, so it outlives the body itself: when the
 * last request is accepted the body goes, and the decided row stays.
 *
 * Undo (the toast's, `pushUndo`) takes the row back out; leaving Asking to join clears it. 🔒 lib/requests-are-inside-guests.test.ts
 */

import { useSyncExternalStore } from 'react';
import { ArrowLeftRight, Check, X } from 'lucide-react';
import { REQUEST_WORDS } from '@/lib/request-key';

export type DecidedRequest = { guestId: string; name: string; kind: 'accepted' | 'declined' | 'linked' };

const NONE: readonly DecidedRequest[] = [];
let decided: readonly DecidedRequest[] = NONE;
const listeners = new Set<() => void>();
const set = (next: readonly DecidedRequest[]) => {
  decided = next;
  for (const l of listeners) l();
};

/** A request just decided — newest first, once per person. */
export function noteDecided(d: DecidedRequest): void {
  set([d, ...decided.filter((x) => x.guestId !== d.guestId)]);
}
/** Undone — the request is a request again. */
export function forgetDecided(guestId: string): void {
  set(decided.filter((x) => x.guestId !== guestId));
}
/** Leaving Asking to join. */
export function clearDecided(): void {
  if (decided.length) set(NONE);
}

/** The rows decided now, read-only (the guard reads it, as it reads `getUndoToast`). */
export function decidedRequests(): readonly DecidedRequest[] {
  return decided;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
export function useDecidedRequests(): readonly DecidedRequest[] {
  return useSyncExternalStore(subscribe, () => decided, () => NONE);
}

/** The words of a decided row — the Requests page's own (frame G2). */
export const DECIDED_LINE: Readonly<Record<DecidedRequest['kind'], string>> = {
  accepted: 'Accepted · just now · their QR and link now open their invitation',
  declined: `Declined · just now · their QR will say “${REQUEST_WORDS.declined}”`,
  linked: 'Linked · just now · their QR and link now open their invitation',
};

export function RequestsJustDecided() {
  const rows = useDecidedRequests();
  if (rows.length === 0) return null;
  return (
    <ul className="mb-2 divide-y divide-ink/10 border-b border-ink/10" data-requests-decided="" role="status">
      {rows.map((d) => {
        const Icon = d.kind === 'declined' ? X : d.kind === 'linked' ? ArrowLeftRight : Check;
        return (
          <li key={d.guestId} className="flex min-h-11 items-center gap-3 px-1 py-3" data-request-decided={d.kind}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{d.name}</span>
              <span className={`mt-0.5 flex items-center gap-1.5 text-xs ${d.kind === 'declined' ? 'text-danger-800' : 'text-success-800'}`}>
                <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                {DECIDED_LINE[d.kind]}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
