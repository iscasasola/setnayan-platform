/**
 * 👆👆 DOUBLE-TAP FILES A MESSAGE (owner 11 Nov 2026: *"tap to heart double tap to sync this to a decision"* →
 * *"Yes add or update an existing decision"*; DECISION_LOG 2026-11-11 🗳 — it REVERSES the v111 "a message can never
 * become a decision" line for FILING only).
 *
 * 🔒 THE ONE RULE: a double-tap never slows or blocks the single tap. EVERY tap toggles the heart at once, exactly as
 * before; a second tap on the same bubble inside `DOUBLE_TAP_MS` toggles it back (so the pair leaves the heart where it
 * was) and ALSO opens the filing picker. There is no waiting to see whether a second tap comes.
 * Held by lib/chat-double-tap.test.ts.
 */

export const DOUBLE_TAP_MS = 300;

export type LastTap = { id: string | null; at: number };
export const NO_TAP: LastTap = { id: null, at: 0 };

export type BubbleTap = {
  /** Always true — the heart toggles on every tap (the double's second tap takes the first one's heart back). */
  heart: true;
  /** The second tap of a double on the same bubble. */
  openPicker: boolean;
  next: LastTap;
};

export function bubbleTap(last: LastTap, id: string, nowMs: number): BubbleTap {
  const double = last.id === id && nowMs - last.at >= 0 && nowMs - last.at < DOUBLE_TAP_MS;
  return { heart: true, openPicker: double, next: double ? NO_TAP : { id, at: nowMs } };
}
