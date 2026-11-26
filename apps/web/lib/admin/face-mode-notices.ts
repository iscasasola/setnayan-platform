/**
 * The words `setEventFaceMode` (app/admin/events/actions.ts) reports back with, by its `saved=` / `error=` key.
 * One copy, read by both places the switch sits: the event record page and Accounts › Events (A8·D-10 — the
 * Events tab used to drop both outcomes, so a refused change looked exactly like a saved one).
 */
export const FACE_MODE_NOTICE: Readonly<Record<string, string>> = {
  face_mode_on: 'Face auto-tagging is now ON for this event (unless the couple declined).',
  face_mode_off: 'Face auto-tagging is now OFF for this event.',
};

export const FACE_MODE_ERROR: Readonly<Record<string, string>> = {
  face_mode_failed: 'The database refused the face-tagging change. Nothing changed.',
  face_mode_not_applied: 'The face-tagging change did not land. Reload and check before trying again.',
};
