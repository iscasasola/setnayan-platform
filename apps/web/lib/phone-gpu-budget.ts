/**
 * 📱 The phone's 3D budget — the PURE half (no React, no three): the caps and the "is this a phone GPU?" reading.
 * The hooks and the fallback that use it live in `app/_components/plan3d/phone-gpu-budget.tsx`, whose docblock says
 * why (owner 2026-10-29: the iPhone app crashed when he pressed 3D plan). Held by `phone-gpu-budget.test.ts`.
 */

import { deviceOs } from './apple-device';

/** The phone tier's caps. `dprMax` 1.25 on a DPR-3 iPhone is 488×1055 drawing-buffer pixels instead of 1170×2532. */
export const PHONE_3D = {
  dprMax: 1.25,
  quality: 'low',
  /** After the last change, keep drawing this long so eases (a table's slide-lag, orbit damping) finish. */
  demandTailMs: 1500,
} as const;

/**
 * Is this a phone or tablet GPU? An iPhone / iPad (including an iPad that says Macintosh) / Android user agent, the
 * installed iOS/Android app's own marker (`SetnayanApp`, never the desktop app's `SetnayanApp/desktop`), or a coarse
 * primary pointer.
 */
export function phoneGpuFrom(userAgent: string, maxTouchPoints: number, coarsePointer: boolean): boolean {
  const os = deviceOs(userAgent, maxTouchPoints);
  if (os === 'iphone' || os === 'ipad' || os === 'android') return true;
  if (/SetnayanApp(?!\/desktop)/i.test(userAgent)) return true;
  return coarsePointer;
}

/** The `dpr` range for a Canvas: the surface's own desktop ceiling, capped on a phone. */
export function canvasDpr(phone: boolean, desktopMax: number): [number, number] {
  return [1, phone ? Math.min(desktopMax, PHONE_3D.dprMax) : desktopMax];
}
