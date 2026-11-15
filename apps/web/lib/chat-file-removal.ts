/**
 * 👈 REMOVING YOUR OWN FILE FROM A CHAT — the words and the clock, pure (client-safe, no I/O).
 *
 * DECISION_LOG 2026-11-13 "CHAT FILE: UNDO RING SHOWS AT ONCE ON SEND (10 S, INSTANT DELETE) · SWIPE = DELETE FOR
 * EVERYONE (FIRST 5 MIN) OR DELETE FOR ME" + "CHAT FILE UNDO DRAWING APPROVED" (prototype
 * chat_file_undo_ring_2026-11-13 v3). The DATABASE enforces both windows against the row's own created_at
 * (`remove_my_chat_file`, migration 20271342335343); these numbers only decide what the screen offers.
 */

/** The ↺ ring stands this long after you send a file. */
export const CHAT_FILE_UNDO_SECONDS = 10;
/** Delete for everyone is offered this long after sending. */
export const CHAT_FILE_EVERYONE_MINUTES = 5;

export const CHAT_FILE_SHEET_TITLE = 'Delete this file?';
export const CHAT_FILE_DELETE_EVERYONE = 'Delete for everyone';
export const CHAT_FILE_DELETE_ME = 'Delete for me';
export const CHAT_FILE_EVERYONE_CLOSED = 'Delete for everyone is open for 5 minutes after sending.';
export const CHAT_FILE_BOOKING_LINE = 'This file is part of the booking, so it stays for everyone.';
export const CHAT_FILE_REMOVE_FAILED = 'Couldn’t delete your file. Try again.';
export const CHAT_FILE_REMOVED_FOR_ME = 'You removed a file for yourself';
/** Drawn when a file left a message and the line that says who took it could not be read. */
export const CHAT_FILE_REMOVED_UNKNOWN = 'A file was removed';

export type ChatFileRemoveMode = 'undo' | 'everyone' | 'me';
export type ChatFileRemoveOutcome = 'file_removed' | 'removed_for_everyone' | 'hidden_for_me';
export type ChatFileRemoveRefusal = 'booking' | 'window' | 'refused';

/** Seconds the ring still has, whole, 0 when it has ended. The phone's clock — the server re-decides. */
export function undoSecondsLeft(createdAtIso: string, nowMs: number): number {
  const sent = Date.parse(createdAtIso);
  if (!Number.isFinite(sent)) return 0;
  const left = CHAT_FILE_UNDO_SECONDS - Math.floor((nowMs - sent) / 1000);
  return Math.max(0, Math.min(CHAT_FILE_UNDO_SECONDS, left));
}

/** Whole minutes Delete for everyone is still open, from the SERVER's "sent N seconds ago". 0 = closed. */
export function everyoneMinutesLeft(sentSecondsAgo: number): number {
  if (!Number.isFinite(sentSecondsAgo) || sentSecondsAgo < 0) return 0;
  return Math.max(0, CHAT_FILE_EVERYONE_MINUTES - Math.floor(sentSecondsAgo / 60));
}

/** "You removed a file · 10:42" / "Mara removed a file · 10:42". */
export function removedForEveryoneLine(who: string | null, at: string): string {
  return `${who ?? 'You'} removed a file${at ? ` · ${at}` : ''}`;
}

/** The database's refusal word → what the screen does next. */
export function refusalFromError(message: string | null | undefined): ChatFileRemoveRefusal {
  const m = message ?? '';
  if (/BOOKING_FILE/.test(m)) return 'booking';
  if (/WINDOW_CLOSED/.test(m)) return 'window';
  return 'refused';
}

// ── the OTHER side, live (controller audit 13 Nov: "deleted at once for both") ──────────────────────────────────

type FileCols = { message_id: string; attachment_r2_key?: string | null; attachment_url?: string | null };

/**
 * An UPDATE where the file left the message (its sender removed it — the undo ring and Delete for everyone are both a
 * soft removal, so the other side hears it on the thread-filtered, RLS-checked UPDATE): re-read the removal lines.
 */
export function fileLeftMessage(before: FileCols | undefined, after: FileCols): boolean {
  return !!before && !!(before.attachment_r2_key || before.attachment_url) && !after.attachment_r2_key && !after.attachment_url;
}

