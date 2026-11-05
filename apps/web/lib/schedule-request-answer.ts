/**
 * 🔁 THE REQUESTS SHEET'S ANSWER (event-dashboard audit 2026-11-02 #15): Approve, Noted, Decline and Approve all SAVE IN
 * PLACE. `resolveScheduleSuggestion` answers in words instead of redirecting — a redirect closed the sheet after every
 * press and sent any refusal to the error page (a thrown message is also blanked in production). The page behind the
 * sheet re-renders in place from the action's revalidation; the sheet stays open and says what did not save.
 */
export type ScheduleRequestAnswer = { ok: true } | { ok: false; error: string };

export const REQUEST_NOT_SENT = 'That didn’t reach the schedule — check your connection and try again.';

/** Whatever the door answered → an answer. Nothing (a stand-in door) = done; anything unreadable = not done, said. */
export function requestAnswerOf(raw: unknown): ScheduleRequestAnswer {
  if (raw === undefined) return { ok: true };
  if (raw && typeof raw === 'object' && 'ok' in raw) {
    const r = raw as { ok: unknown; error?: unknown };
    if (r.ok === true) return { ok: true };
    return { ok: false, error: typeof r.error === 'string' && r.error.trim() ? r.error : REQUEST_NOT_SENT };
  }
  return { ok: false, error: REQUEST_NOT_SENT };
}
