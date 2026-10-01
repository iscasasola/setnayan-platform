/**
 * The sentences "Add name" can fail with — ONE copy, read by the action that
 * throws them (`app/[slug]/actions.ts`, the reply's `seat_names_only` branch)
 * and by the boxes that show them (`add-name-in-place.tsx`).
 *
 * Guest text audit 2026-09-30: the boxes said "check your connection" whatever
 * went wrong. The action cannot RETURN a reason (it is the reply form's own
 * action, typed for `<form action>`), and a thrown message is hidden in
 * production — so the boxes show a thrown message only when it is one of these,
 * blame the connection only when the request never arrived, and otherwise say
 * plainly that the name did not save.
 */
export const SEAT_NAME_DID_NOT_SAVE = 'Their name did not save — try again.';
export const SEAT_NAME_MISSING = 'Type their first or last name, then Save name.';
export const SEAT_NAME_OFFLINE = 'Their name did not save — check your connection and try again.';

const KNOWN: readonly string[] = [SEAT_NAME_DID_NOT_SAVE, SEAT_NAME_MISSING];

/** What the boxes say for a failed save — the real reason, never a guess. */
export function seatNameFailure(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (KNOWN.includes(message)) return message;
  // A request that never reached the server rejects with a TypeError from fetch.
  if (err instanceof TypeError && /fetch|network|load failed/i.test(message)) return SEAT_NAME_OFFLINE;
  return SEAT_NAME_DID_NOT_SAVE;
}
