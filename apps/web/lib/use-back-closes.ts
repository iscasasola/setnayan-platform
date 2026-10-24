'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * ← THE PHONE'S BACK CLOSES THE LAYER, NOT THE PAGE.
 *
 * Owner 2026-10-24, on a gift QR that opened as a bare picture: *"when i opened the QR Code, there is no way to go
 * back."* A picture opened IN PLACE over the Event Hub must be dismissed the way a phone dismisses things — Back
 * (Android's button, iOS's edge swipe, the browser's ←, the app shell's hardware back, which `native-bridge.tsx`
 * turns into `history.back()`).
 *
 * This is the shape `theme-preview-overlay.tsx` already shipped (owner 2026-09-28, "no way of getting back"), lifted
 * so every viewer shares ONE copy instead of a hand-rolled one each:
 *
 *   · opening pushes ONE history entry of our own, with the same address — Next's router copies its own state into it
 *     (its `pushState` patch), so stepping back restores the page without a reload and without moving the Hub's tab
 *     (`?tab=` is untouched);
 *   · `popstate` (Back) closes the layer;
 *   · every OTHER way out (✕, Escape, a tap outside, swipe-down) calls the returned `close`, which steps back through
 *     the entry we pushed — so Back never has to be pressed twice, and never lands on a dead entry later.
 *
 * Mount = open: call it from a component that exists only while the layer is up, or pass `open`.
 */
const MARK = 'snLayer';

export function useBackCloses(open: boolean, onClose: () => void): () => void {
  const pushed = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const st = window.history.state as Record<string, unknown> | null;
    /* React's dev double-effect must not stack two entries for one opening. */
    if (!(st && st[MARK])) window.history.pushState({ ...(st ?? {}), [MARK]: true }, '');
    pushed.current = true;
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [open]);

  /* 🧹 UNMOUNTED WITHOUT BEING CLOSED — the photo it showed went away under it ("Not me" took the tag off and the list
     redrew), so nobody stepped back through our entry. Take it off now, or the guest's next Back would do nothing.
     Deferred one tick so React's dev double-effect (unmount → mount at once) is not mistaken for a real unmount. */
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.setTimeout(() => {
        if (alive.current || !pushed.current) return;
        pushed.current = false;
        window.history.back();
      }, 0);
    };
  }, []);

  return useCallback(() => {
    if (pushed.current) {
      /* Back through our own entry — `popstate` above then closes the layer. */
      window.history.back();
      return;
    }
    closeRef.current();
  }, []);
}
