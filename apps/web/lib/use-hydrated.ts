'use client';

import { useSyncExternalStore } from 'react';

/**
 * lib/use-hydrated.ts — FALSE ON THE SERVER AND DURING HYDRATION, TRUE AFTER.
 *
 * ── WHY (measured 2026-10-16, the owner's events list at 375 px) ───────────
 * `/dashboard` threw React error #418 on EVERY phone load. Each board card's
 * remove frame rendered `typeof document === 'undefined' ? null : createPortal(…)`:
 * nothing on the server, a `<dialog>` on the first client render. React cannot
 * hydrate a tree that disagrees with its HTML, so it threw the server HTML away
 * and rendered the board again on the phone — one 662–676 ms long task at 4× CPU,
 * 709–754 ms of blocking time, while the owner's tap on a card did nothing
 * (`app_fault_issues` DEAD_TAP, 2026-10-14).
 *
 * `typeof document` is a question about WHERE the code runs, and the answer
 * changes between the server pass and the hydration pass — which is exactly the
 * one thing a render may not depend on. This asks the right question instead:
 * "has this tree finished hydrating?" — `false` for the server snapshot (which
 * React also uses while hydrating), `true` on the render right after. No effect,
 * no state, no extra render on later client-side mounts.
 *
 * 🔒 `lib/a-portal-waits-for-hydration.test.ts`.
 */
const subscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
