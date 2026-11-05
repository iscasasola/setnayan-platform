// lib/papic-upload/shot-time.ts — WHEN a queued shot is judged against the
// event's capture window.
//
// 🚨 Review 2026-10-23, blocker 1: the server used to judge the window by the
// moment a shot ARRIVED. A guest who shot the reception at 23:00 with no signal
// and found signal the next afternoon — after the 12-hour tail closed — had
// every in-window photograph refused and erased from her phone. A save-first
// camera's whole promise is that arrival time does not matter.
//
// So the window is judged by the shot's OWN instant (the shutter, stamped on the
// phone, `captured_at_ms`), held to sane bounds the server can check:
//   · never later than the server's clock + CLOCK_SKEW_MS (a phone set to
//     tomorrow cannot shoot into tomorrow's window);
//   · never earlier than the server's clock − OLDEST_SHOT_MS (the phone keeps a
//     shot 7 days; older than its queue can hold is not a real queued shot).
// Outside those bounds — or no shutter at all — the server's own clock is used,
// exactly as before.
//
// ⚖ What this trusts, said plainly: the shutter time is the phone's word. A
// phone could claim an in-window time for a shot taken after the window closed;
// the bound caps that at OLDEST_SHOT_MS, credits are still charged, and the
// shot is still screened. Refusing in-window shots that arrive late is the
// failure the owner ruled out ("each phone can shoot continuously … uploading
// works on the background").

/** How far ahead of the server's clock a phone's clock may be. */
export const CLOCK_SKEW_MS = 10 * 60 * 1000;
/** The oldest shutter time a queued shot may carry (the queue TTL + a day). */
export const OLDEST_SHOT_MS = 8 * 24 * 60 * 60 * 1000;

/** The instant to judge a shot's window by. Pure. */
export function judgedShotInstant(capturedAtMs: unknown, serverNowMs: number): number {
  const t = typeof capturedAtMs === 'number' ? capturedAtMs : typeof capturedAtMs === 'string' ? Number(capturedAtMs) : NaN;
  if (!Number.isFinite(t)) return serverNowMs;
  if (t > serverNowMs + CLOCK_SKEW_MS) return serverNowMs;
  if (t < serverNowMs - OLDEST_SHOT_MS) return serverNowMs;
  return Math.min(t, serverNowMs);
}
