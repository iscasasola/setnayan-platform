// lib/papic-upload/shutter-timing.ts — how long the shutter is busy, measured.
//
// The brief (2026-10-23) asks for shutter-to-ready before/after. Each shot
// leaves a `papic:shutter-ready` performance measure (visible in any browser's
// performance timeline, and read by the walk script). No network, no storage —
// a mark costs microseconds.

let startedAt: number | null = null;

export function markShutter(): void {
  try {
    startedAt = performance.now();
    performance.mark('papic:shutter');
  } catch {
    startedAt = null;
  }
}

export function markShutterReady(): void {
  try {
    if (startedAt === null) return;
    performance.mark('papic:ready');
    performance.measure('papic:shutter-ready', 'papic:shutter', 'papic:ready');
  } catch {
    /* timeline unavailable */
  } finally {
    startedAt = null;
  }
}

/**
 * The shot is now kept on this phone (encoded + written to IndexedDB). Measured
 * from the shutter instant — the moment a tab death can no longer lose it.
 */
export function markSavedOnPhone(capturedAtMs: number): void {
  try {
    const d = Math.max(0, Date.now() - capturedAtMs);
    performance.measure('papic:saved-on-phone', { start: performance.now() - d, duration: d });
  } catch {
    /* timeline unavailable */
  }
}
