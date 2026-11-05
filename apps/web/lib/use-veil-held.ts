'use client';

import { useSyncExternalStore } from 'react';
import { HUB_VEIL_RELEASED_EVENT, isVeilHeld } from './hub-veil';

/*
 * 🙈 The React half of `lib/hub-veil.ts` — its own module because a hook beside the hold script would pull
 * `useSyncExternalStore` into the server component that writes the script (`RevealMount`).
 */
function subscribe(cb: () => void): () => void {
  window.addEventListener(HUB_VEIL_RELEASED_EVENT, cb);
  return () => window.removeEventListener(HUB_VEIL_RELEASED_EVENT, cb);
}

/**
 * For a JS clock that ticks on its own (the countdown): true while the veil holds the page — hold the tick,
 * start it when this turns false. False on the server and wherever no opening is shown.
 */
export function useVeilHeld(): boolean {
  return useSyncExternalStore(subscribe, isVeilHeld, () => false);
}
