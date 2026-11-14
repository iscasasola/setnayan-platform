'use client';

import { useEffect, useRef } from 'react';

/**
 * 📐 DESIGN TEMPLATE (14 Nov 2026, rule 9): the seat plan's small menus (the table's ⋯, Auto Arrange's ▾, the
 * frame's bar menus) close on a press outside them or on Escape — the way the shared `PickMenu` does — instead of
 * laying a hand-made invisible `fixed inset-0` sheet over the whole page to catch that press.
 *
 * The returned ref goes on the element that holds BOTH the opener and its menu, so pressing the opener again
 * still toggles it (the opener's own click runs, not this).
 */
export function useCloseOutside<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return ref;
}
