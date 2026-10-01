'use client';

import { useEffect, useState, type CSSProperties, type RefObject } from 'react';

/**
 * 🖥📱 THE "BOTH" VIEW — the phone and the desktop, side by side, both live.
 *
 * DECISION_LOG 2026-09-28 ("THE MAKER'S TOOLBARS ARE BUILT AFTER KEYNOTE +
 * PAGES"): *"View ▾ (Desktop · Phone · Both)"*. Hidden on 2026-09-28 (#6075)
 * because it was not built; built here.
 *
 * 🔑 NO SECOND EDITING MECHANISM. The desktop pane IS the Maker's one canvas
 * (`frameRef`, its warm stages, its hold) drawn at 1280 px and scaled to fit
 * (`bothLayout` — the PAIR fits the room the row actually has);
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
/** …and its height: a 16:10 laptop screen. The desktop keeps this shape. */
export const BOTH_DESKTOP_HEIGHT = 800;
/** The phone render's width (an iPhone's 390 CSS px). */
export const BOTH_PHONE_WIDTH = 390;
/** …and its height (an iPhone's 844 CSS px). The phone keeps this shape. */
export const BOTH_PHONE_HEIGHT = 844;
/** The space between the two frames. */
export const BOTH_GAP = 16;
/** The phone never takes more than this share of the row — the desktop needs the room. */
export const BOTH_PHONE_SHARE = 0.4;
/** Below this the phone's text is too small to read — Both is drawn as Desktop. */
export const BOTH_PHONE_MIN_SCALE = 0.6;
/** Below this (≈ 358 px wide) the desktop is a thumbnail — Both is drawn as Desktop. */
export const BOTH_DESKTOP_MIN_SCALE = 0.28;

/** One frame of the pair: drawn at `width` × `height`, scaled by `scale` into a `boxWidth` × `boxHeight` box. */
export type BothFrame = { width: number; height: number; scale: number; boxWidth: number; boxHeight: number };

/**
 * 📐 HOW THE PAIR FITS THE ROW (owner 2026-09-30: *"the desktop and mobile on
 * view must adjust on the screen showing both side to side just exceeded the
 * screen"*). `width` × `height` is the room the canvas row ACTUALLY has — the
 * window minus the scenes list and the inspector, whichever are open (the row
 * is measured, so it follows both). Both frames keep their shape (the desktop
 * 1280 × 800, the phone 390 × 844) and are scaled so that
 * `phone.boxWidth + gap + desktop.boxWidth ≤ width` and each box ≤ `height`:
 * never a sideways scroll.
 *
 * The phone is scaled to the room's height (never past 1, never more than
 * `BOTH_PHONE_SHARE` of the row); the desktop takes the rest. A desktop with
 * room to spare is drawn at scale 1 and WIDER than 1280 (still 16:10) — never
 * stretched. Null — draw Desktop instead, as a narrow window already does —
 * when the room is unmeasured, or when either frame would be too small to read
 * (`BOTH_PHONE_MIN_SCALE`, `BOTH_DESKTOP_MIN_SCALE`). Pure.
 */
export function bothLayout(width: number, height: number): { desktop: BothFrame; phone: BothFrame; gap: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  const phoneScale = Math.min(1, height / BOTH_PHONE_HEIGHT, (width * BOTH_PHONE_SHARE) / BOTH_PHONE_WIDTH);
  if (phoneScale < BOTH_PHONE_MIN_SCALE) return null;
  const phoneBox = Math.floor(BOTH_PHONE_WIDTH * phoneScale);
  const deskRoom = width - BOTH_GAP - phoneBox;
  const deskScale = Math.min(deskRoom / BOTH_DESKTOP_WIDTH, height / BOTH_DESKTOP_HEIGHT);
  if (!(deskScale >= BOTH_DESKTOP_MIN_SCALE)) return null;
  let desktop: BothFrame;
  if (deskScale >= 1) {
    const drawn = Math.floor(Math.min(deskRoom, (height * BOTH_DESKTOP_WIDTH) / BOTH_DESKTOP_HEIGHT));
    const tall = Math.floor((drawn * BOTH_DESKTOP_HEIGHT) / BOTH_DESKTOP_WIDTH);
    desktop = { width: drawn, height: tall, scale: 1, boxWidth: drawn, boxHeight: tall };
  } else {
    desktop = {
      width: BOTH_DESKTOP_WIDTH,
      height: BOTH_DESKTOP_HEIGHT,
      scale: deskScale,
      boxWidth: Math.floor(BOTH_DESKTOP_WIDTH * deskScale),
      boxHeight: Math.floor(BOTH_DESKTOP_HEIGHT * deskScale),
    };
  }
  const phone: BothFrame = {
    width: BOTH_PHONE_WIDTH,
    height: BOTH_PHONE_HEIGHT,
    scale: phoneScale,
    boxWidth: phoneBox,
    boxHeight: Math.floor(BOTH_PHONE_HEIGHT * phoneScale),
  };
  return { desktop, phone, gap: BOTH_GAP };
}

/** A frame drawn at its own size and scaled into its box (top-left; the browser maps taps through the scale). */
export function scaledFrame(f: BothFrame): CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    width: f.width,
    height: f.height,
    transform: `scale(${f.scale})`,
    transformOrigin: '0 0',
  };
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
