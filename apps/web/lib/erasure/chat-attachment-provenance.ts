/**
 * chat-attachment-provenance.ts — MAY ERASING ONE PERSON DELETE THIS CHAT FILE?
 *
 * Pure, client-safe (no `server-only`, no I/O) so the rule is a unit test. The
 * caller is `purgeUserAuthoredChat` (lib/erasure/purge.ts).
 *
 * ─── THE HOLE (review of PR #5414, 2026-09-10) ─────────────────────────────
 * Erasure deletes the attachment of every message the leaving person AUTHORED,
 * held by `chatAttachmentScope` to the message's own `chat/<thread_id>/`
 * folder. That folder is the THREAD's, not the sender's: `sendChatMessageCore`
 * (lib/chat-send.ts) files every upload at `chat/<thread_id>/<uuid>-<name>`, so
 * the key names no sender. And `authenticated` holds column INSERT on
 * `chat_messages.attachment_r2_key`. So a thread member could post a message
 * whose attachment_r2_key is a copy of the OTHER party's file ref — a contract,
 * an ID scan — ask for their own account to be erased, and our admin client
 * would delete the other party's file. The folder pin cannot tell the two apart.
 *
 * ─── THE RULE: THE FILE BELONGS TO WHOEVER SENT IT FIRST ───────────────────
 * The key cannot say who uploaded it, but the table can. A file's genuine
 * sender is the author of the EARLIEST message carrying it:
 *   • the key is minted server-side from `randomUUID()` at upload, so nobody
 *     can reference it before the uploader's own message exists;
 *   • anyone else learns it only by READING that message, so their copy is
 *     inserted in a later transaction;
 *   • `created_at` is not writable by `authenticated` (column INSERT is not
 *     granted; the default `now()` stamps it), so a copy cannot be backdated;
 *   • `sender_user_id` is derived from `auth.uid()` by
 *     tg_chat_messages_derive_sender, so a copy cannot claim another author.
 * So erasure deletes the object only when EVERY earliest message carrying that
 * exact object was authored by the person being erased.
 *
 * ⚠ THE COMPARISON IS ON THE OBJECT, NOT THE STRING. A copy spelled
 * `r2://…/x.pdf ` (trailing space) is a different string but `planCleanupDelete`
 * trims it onto the same object. Every row is therefore canonicalised through
 * the same planner the delete itself uses before it is compared — otherwise a
 * padded copy would be "first" to its own spelling and delete the original.
 *
 * 🔒 FAILS CLOSED, in the direction that KEEPS the file: no matching row, an
 * unreadable timestamp, a tie with anyone else, or a NULL author (an already
 * erased account) all refuse. The caller counts the refusal in the audit log.
 * The residual cost is retention, never somebody else's file.
 *
 * Defence in depth, not a substitute: N1 (the chat door) binds a message's
 * thread_id to the sender's own pair and pins attachment_r2_key at write time.
 * This rule holds whether or not that lands.
 */
import { planCleanupDelete, type CleanupScope } from '@/lib/cleanup-delete-scope';

/** One `chat_messages` row, as the provenance lookup reads it. */
export type ChatAttachmentRow = {
  attachment_r2_key?: string | null;
  sender_user_id?: string | null;
  /** timestamptz — an ISO string from PostgREST, a Date from PGlite. */
  created_at?: string | Date | null;
};

export type ChatAttachmentProvenance =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | 'out_of_scope'
        | 'no_provenance'
        | 'first_sent_by_someone_else';
    };

/**
 * A lookup that came back at or above this many rows is not trusted: PostgREST
 * caps a response (1000 by default), and a flood of copies could push the
 * genuine first message out of an unordered page. No real file is attached to
 * this many messages, so the whole batch fails closed instead.
 */
export const PROVENANCE_ROW_CEILING = 500;

function toMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' && value.trim().length > 0) return Date.parse(value);
  return Number.NaN;
}

/**
 * The canonical `r2://<bucket>/<key>` a ref names under `scope`, or null when the
 * planner refuses it. This is also the string the genuine sender's row holds
 * (`encodeR2Ref`), which is why the lookup can query for it exactly.
 */
export function canonicalChatRef(ref: unknown, scope: CleanupScope): string | null {
  const decision = planCleanupDelete(ref, scope);
  return decision.ok ? `r2://${decision.target.bucket}/${decision.target.key}` : null;
}

/**
 * May erasing `subjectUserId` delete the object `ref` names?
 *
 * `rows` — the `chat_messages` rows (any thread, any author) whose
 * `attachment_r2_key` could name the same object, read BEFORE the subject's own
 * messages are deleted. Rows naming other objects may be included; they are
 * ignored.
 */
export function chatAttachmentIsSubjectsOwn(
  ref: unknown,
  scope: CleanupScope,
  rows: readonly ChatAttachmentRow[],
  subjectUserId: string,
): ChatAttachmentProvenance {
  const target = canonicalChatRef(ref, scope);
  if (target === null) return { ok: false, reason: 'out_of_scope' };

  let earliest = Number.POSITIVE_INFINITY;
  let earliestAuthors = new Set<string | null>();
  for (const row of rows) {
    if (canonicalChatRef(row.attachment_r2_key, scope) !== target) continue;
    const at = toMs(row.created_at);
    // A matching row we cannot place in time could be the first one.
    if (!Number.isFinite(at)) return { ok: false, reason: 'no_provenance' };
    const author = typeof row.sender_user_id === 'string' ? row.sender_user_id : null;
    if (at < earliest) {
      earliest = at;
      earliestAuthors = new Set([author]);
    } else if (at === earliest) {
      earliestAuthors.add(author);
    }
  }
  if (!Number.isFinite(earliest)) return { ok: false, reason: 'no_provenance' };
  if (earliestAuthors.size === 1 && earliestAuthors.has(subjectUserId)) return { ok: true };
  return { ok: false, reason: 'first_sent_by_someone_else' };
}
