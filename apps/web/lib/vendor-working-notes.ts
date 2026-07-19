/**
 * Coordinator P4 — per-vendor working-folder notes (private vs shared).
 *
 * Pure TS mirror of the event_vendor_working_notes RLS predicates (migration
 * 20270825279091) so the UI and server actions reason about access the same
 * way the database enforces it, and so the predicate is unit-testable without
 * a database.
 *
 * The load-bearing (and UNUSUAL) direction: a 'coordinator_private' note on
 * the couple's OWN event is hidden from the couple. RLS is the real wall —
 * these helpers only keep the UI honest (what to render, which composer
 * options to offer).
 *
 * Flag posture — NEXT_PUBLIC_COORDINATOR_VENDOR_NOTES_ENABLED (default OFF):
 * the whole panel is couple-facing new UI, so per the repo rule it ships dark.
 * Flag OFF/absent = today's workspace page byte-for-byte (no reads, no panel).
 * The migration ships the table regardless; it is inert until the flag flips.
 */

export const WORKING_NOTE_VISIBILITIES = ['coordinator_private', 'shared'] as const;
export type WorkingNoteVisibility = (typeof WORKING_NOTE_VISIBILITIES)[number];

export type WorkingNoteAuthorRole = 'coordinator' | 'couple';

/** What the viewer is on this event — derived from event_members (couple) and
 *  event_moderators (accepted, not removed). Both false ⇒ no folder access. */
export type WorkingNoteViewer = {
  isCouple: boolean;
  isCoordinator: boolean;
};

export type WorkingNoteRow = {
  note_id: string;
  author_user_id: string;
  author_role: WorkingNoteAuthorRole;
  visibility: WorkingNoteVisibility;
  body: string;
  created_at: string;
};

export const WORKING_NOTE_BODY_MAX = 4000;

export const WORKING_NOTE_VISIBILITY_LABEL: Readonly<
  Record<WorkingNoteVisibility, string>
> = {
  coordinator_private: 'Private to coordinators',
  shared: 'Shared with the couple',
};

export function isWorkingNoteVisibility(v: unknown): v is WorkingNoteVisibility {
  return (
    typeof v === 'string' &&
    (WORKING_NOTE_VISIBILITIES as readonly string[]).includes(v)
  );
}

/**
 * Mirror of the SELECT policies (evwn_moderator_select + evwn_couple_select):
 *   • coordinator on the event → every note (private + shared);
 *   • couple on the event      → 'shared' only — NEVER coordinator_private;
 *   • anyone else              → nothing.
 */
export function canReadWorkingNote(
  viewer: WorkingNoteViewer,
  visibility: WorkingNoteVisibility,
): boolean {
  if (viewer.isCoordinator) return true;
  if (viewer.isCouple) return visibility === 'shared';
  return false;
}

/**
 * Mirror of the INSERT policies (evwn_moderator_insert + evwn_couple_insert):
 *   • coordinator → either visibility;
 *   • couple      → 'shared' only;
 *   • anyone else → nothing.
 * A viewer who is BOTH (a couple member also accepted as a delegate — edge
 * case) gets the coordinator's wider grant, matching permissive-OR RLS.
 */
export function canWriteWorkingNote(
  viewer: WorkingNoteViewer,
  visibility: WorkingNoteVisibility,
): boolean {
  if (viewer.isCoordinator) return true;
  if (viewer.isCouple) return visibility === 'shared';
  return false;
}

/** Which author_role a write from this viewer must stamp (RLS WITH CHECK). */
export function workingNoteAuthorRole(
  viewer: WorkingNoteViewer,
): WorkingNoteAuthorRole | null {
  if (viewer.isCoordinator) return 'coordinator';
  if (viewer.isCouple) return 'couple';
  return null;
}

/** UI filter — belt to the RLS suspenders. RLS already withholds the rows;
 *  this keeps a couple viewer's render honest even if a wider row set ever
 *  reaches the client (e.g. an admin lens reusing the component). */
export function visibleWorkingNotes<T extends { visibility: WorkingNoteVisibility }>(
  viewer: WorkingNoteViewer,
  notes: readonly T[],
): T[] {
  return notes.filter((n) => canReadWorkingNote(viewer, n.visibility));
}

/** Mirror of evwn_author_delete: only the author removes their own note. */
export function canDeleteWorkingNote(
  viewerUserId: string,
  note: Pick<WorkingNoteRow, 'author_user_id'>,
): boolean {
  return viewerUserId.length > 0 && viewerUserId === note.author_user_id;
}

/** Default-OFF feature flag for the whole working-folder panel. */
export function isCoordinatorVendorNotesEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_COORDINATOR_VENDOR_NOTES_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
