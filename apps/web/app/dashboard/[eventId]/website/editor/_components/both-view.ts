'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * 🖥📱 THE "BOTH" VIEW — the phone and the desktop, side by side, both live.
 *
 * DECISION_LOG 2026-09-28 ("THE MAKER'S TOOLBARS ARE BUILT AFTER KEYNOTE +
 * PAGES"): *"View ▾ (Desktop · Phone · Both)"*. Hidden on 2026-09-28 (#6075)
 * because it was not built; built here.
 *
 * 🔑 NO SECOND EDITING MECHANISM. The desktop pane IS the Maker's one canvas
 * (`frameRef`, its warm stages, its hold) drawn at 1280 px and scaled to fit;
 * the phone pane is ONE more `BufferedCanvasFrame` of the same address, keyed
 * on the same held stamp, reached by the same broadcast. A pick the bridge
 * draws goes to both at once; a save that reloads reloads both, buffered; a
 * tap in either selects the same part (`editor-shell.tsx`).
 *
 * ⚖ ONE EXTRA FRAME, ONLY WHILE BOTH IS ON — the phone pane never holds warm
 * stages of its own (`warmMax` 0), whatever the device, and it unmounts the
 * moment the view changes. Offered at 1024 px and wider only
 * (`makerViewOptions`, `maker-bar.ts`).
 */

/** The desktop render's width — a common laptop page, scaled down to the pane. */
export const BOTH_DESKTOP_WIDTH = 1280;
/** The phone render's width (an iPhone's 390 CSS px). */
export const BOTH_PHONE_WIDTH = 390;

/**
 * How the 1280 px desktop page fits a pane of `width` × `height`: drawn at
 * 1280 (or the pane's own width, when wider — never stretched past it), then
 * scaled so its width is the pane's, and made as tall as the pane holds at
 * that scale. Null until the pane has been measured. Pure.
 */
export function bothDesktopFit(width: number, height: number): { width: number; height: number; scale: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  const drawn = Math.max(BOTH_DESKTOP_WIDTH, Math.round(width));
  const scale = width / drawn;
  return { width: drawn, height: Math.round(height / scale), scale };
}

/** The pane's measured size while `on` (a ResizeObserver), else null. */
export function usePaneSize(ref: RefObject<HTMLElement | null>, on: boolean): { width: number; height: number } | null {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!on || !el || typeof ResizeObserver === 'undefined') {
      setSize(null);
      return;
    }
    const read = () => {
      const r = el.getBoundingClientRect();
      setSize((prev) => (prev && prev.width === r.width && prev.height === r.height ? prev : { width: r.width, height: r.height }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, on]);
  return size;
}
