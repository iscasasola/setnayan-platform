/**
 * The group chat's per-message id (walk 13 Nov 2026, F-W3-12). The composer mints it once per message and posts it
 * beside the words; `samahan_messages.message_id` is UNIQUE, so a second request for the same message cannot make a
 * second row, and the action answers that duplicate as already sent. Absent (an old page) → the database mints one.
 */
export const SAMAHAN_MESSAGE_ID_FIELD = 'message_id';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The posted id, if it is a well-formed UUID — never trusted beyond its shape (RLS still scopes the row). */
export function postedSamahanMessageId(raw: FormDataEntryValue | null): string | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return UUID_RE.test(s) ? s.toLowerCase() : null;
}

/** Postgres unique_violation — the same message sent twice. */
export const isDuplicateSend = (code: string | null | undefined) => code === '23505';
