/**
 * 🔭 REVEAL ON OPEN — WAS THIS OPEN THE USER'S? (owner 2026-11-04, app-wide). Kept apart from `reveal-engine.ts` so the
 * hook every fold mounts carries only this line; the engine and its DOM side load on the first open (`reveal-dom.ts`).
 *
 * Only a closed → open CHANGE (never mounting open: a default-open fold, restored state), and only when the opener's own
 * press (`pressedAt`) — or, for an opener that does not own its press, any tap or key (`gestureAt`) — came just before
 * it. A `#hash` or a controlled open sets neither, so it never reveals.
 */
export function isUserOpen(a: { was: boolean; open: boolean; cause: 'press' | 'gesture'; pressedAt: number; gestureAt: number; now: number; windowMs: number }): boolean {
  if (!a.open || a.was) return false;
  return a.now - (a.cause === 'gesture' ? a.gestureAt : a.pressedAt) < a.windowMs;
}
