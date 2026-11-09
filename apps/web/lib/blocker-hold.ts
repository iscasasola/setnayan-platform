/**
 * ⏳ THE BLOCKER'S HOLD — like a skippable ad (owner, DECISION_LOG ⏳ 2026-11-09).
 *
 * While the hold runs there is NO way back, only quiet text "Return to chat in N"; at 0 a "Return to chat" button
 * appears. The hold is 5 s the first time a given unanswered blocker is shown, 30 s the second, 60 s on the third and
 * every later showing. The count lives on the server (`chat_blocker_shows` · `chat_blocker_shown()`), so a reload or a
 * second device cannot reset it. 🔑 The ACTION buttons (Agree and book · Turn down · Pay · Set call time) are NEVER
 * held — only the way back waits.
 */
export function blockerHoldSeconds(shownCount: number | null | undefined): number {
  // Unknown (the count could not be read) holds the longest: an unreadable counter must not become a free skip.
  if (shownCount == null || !Number.isFinite(shownCount)) return 60;
  if (shownCount <= 1) return 5;
  if (shownCount === 2) return 30;
  return 60;
}

/** Whole seconds left, never negative. */
export function holdLeft(startedMs: number, holdSeconds: number, nowMs: number): number {
  return Math.max(0, Math.ceil((startedMs + holdSeconds * 1000 - nowMs) / 1000));
}

/** The quiet line while the hold runs. */
export function holdLine(left: number): string {
  return `Return to chat in ${left}`;
}

/** The action buttons' state during the hold — always free. A function so the guard can assert it over every second. */
export function actionHeld(_left: number): false {
  return false;
}
