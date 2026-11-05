/**
 * live-day-timing.ts — HOW A PHONE SPACES ITS ASKS ON THE DAY (2026-10-18, live-day polling).
 *
 * Client-safe and pure, so every live surface spaces its asks the same way and a test can pin the arithmetic.
 *
 * 🔑 WHY JITTER. A timer started at page load is already spread across guests (they opened the page at different
 * moments). What lines phones up is an EVENT they all see at once — a realtime ping, a reconnect after the venue's
 * Wi-Fi drops, a "something changed" answer — after which every phone asks at the same instant: a herd. So:
 *   · a repeating ask waits `jittered(base)` — base ± 20 %, a fresh draw each time, so phones drift apart instead of
 *     staying in step; and
 *   · an ask CAUSED by a shared event first waits `herdDelay(max)` — anywhere in [0, max) — so 200 phones reach the
 *     server over `max` instead of in the same few milliseconds.
 */

/** `baseMs` ± `spread` (a fraction), drawn fresh. Never below a quarter of the base. */
export function jittered(baseMs: number, spread = 0.2, rand: () => number = Math.random): number {
  const s = Math.min(Math.max(spread, 0), 0.75);
  return Math.round(baseMs * (1 - s + 2 * s * rand()));
}

/** A wait in [0, maxMs) before an ask that a shared event triggered on every phone at once. */
export function herdDelay(maxMs: number, rand: () => number = Math.random): number {
  return Math.floor(Math.max(maxMs, 0) * rand());
}
