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

/** Who holds the entry on top — a layer's id, `true` (an entry marked before ids), or nothing. */
/** The layer id marked on a history state (pure — `the-layer-back-is-owned.test.ts`). */
export function layerHolder(state: unknown): unknown {
  return (state as Record<string, unknown> | null)?.[MARK];
}

/**
 * What a layer does to the history when it opens (pure): push its own entry when none is marked; take over an entry
 * another layer marked (the screen it replaced); nothing when the entry is already its own (React's dev double-effect).
 */
export function layerOpens(state: unknown, id: string): { push: Record<string, unknown> } | { replace: Record<string, unknown> } | null {
  const st = (state ?? {}) as Record<string, unknown>;
  const held = st[MARK];
  if (!held) return { push: { ...st, [MARK]: id } };
  if (held !== id) return { replace: { ...st, [MARK]: id } };
  return null;
}

/** Whether a layer's clean-up may step back through the entry on top: only while that layer still holds it (pure). */
export function layerMayStepBack(state: unknown, id: string): boolean {
  return layerHolder(state) === id;
}

let nextLayer = 0;

export function useBackCloses(open: boolean, onClose: () => void): () => void {
  /* 🪪 RW-146 (re-walk 14 Nov 2026): each layer marks the entry with ITS OWN id. A screen that is swapped for another
     (a Maker's loading screen → the loaded one) hands the entry over: the new layer finds it marked and claims it, so
     the old layer's deferred clean-up sees it is no longer the holder and does NOT step back — which used to close the
     new layer about a second after it opened. Only the current holder ever steps back through the entry. */
  const id = useRef(`layer-${++nextLayer}`);
  const ours = () => layerMayStepBack(window.history.state, id.current);
  const pushed = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!open) return;
    const st = window.history.state as Record<string, unknown> | null;
    /* React's dev double-effect must not stack two entries for one opening. */
    // An entry another layer marked (the screen this one replaced) is taken over, so that layer's clean-up leaves it be.
    const step = layerOpens(st, id.current);
    if (step && 'push' in step) window.history.pushState(step.push, '');
    else if (step) window.history.replaceState(step.replace, '');
    pushed.current = true;
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      /* 🧹 CLOSED BY ITS OWNER, NOT BY BACK — a sheet whose `open` prop went false (a Save, a Cancel the caller wired
         itself). Take our entry off so the next Back leaves the page as it should. Deferred one tick (React's dev
         double-effect), and only while our entry is still the top one. */
      window.setTimeout(() => {
        if (openRef.current || !pushed.current) return;
        pushed.current = false;
        if (ours()) window.history.back();
      }, 0);
    };
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
        if (ours()) window.history.back();
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
