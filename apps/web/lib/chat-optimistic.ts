/**
 * A SENT MESSAGE SHOWS AT ONCE — and says so if it did not go (owner 2026-10-27, "CHAT MUST BE EFFICIENT AND FAST":
 * *"a sent message appears in the thread the moment Send is pressed and settles to Delivered (or says it failed —
 * never a silent loss)"*; chat prototype 2026-10-28 frame B: "Sending…" under the faded last bubble).
 *
 * The composer (`chat-send-form.tsx`) and the stream (`chat-message-stream.tsx`) are siblings that talk through window
 * events (the shipped `chat-stream:input` / `chat-stream:sent` pattern). This file is the pure half both import:
 *
 *   chat-stream:pending  — Send pressed: a `PendingSend` the stream paints at once, faded, "Sending…"
 *   chat-stream:settled  — the server action came back: `{ tempId, ok }`. ok=false → "Not sent · Try again"
 *
 * 🔑 A RETURN IS NOT A DELIVERY. On the JS path the send action RETURNS quietly when an attachment is refused (its own
 * note: "this returns and the composer keeps the user's text"), so `ok` from the action alone would paint a file that
 * never landed as sent. A pending bubble therefore leaves only when the REAL row arrives (`matchesPending`); if it has
 * not arrived {@link CONFIRM_WINDOW_MS} after an ok, the stream re-reads the thread once and, still absent, says
 * "Not sent". `lib/a-sent-message-shows-at-once.test.ts` holds the rules below.
 */

export type PendingSend = {
  tempId: string;
  threadId: string;
  body: string;
  /** The picked file's name, when the message carries one. */
  fileName: string | null;
  /** ms since epoch, when Send was pressed. */
  at: number;
  state: 'sending' | 'sent' | 'failed';
  /** Why it did not go, in words, when the composer knows (a file refused or too big — C2's sentences). */
  reason?: string;
};

export const CHAT_PENDING_EVENT = 'chat-stream:pending';
export const CHAT_SETTLED_EVENT = 'chat-stream:settled';

/** How long after an ok the real row has to arrive before the stream re-reads, then says "Not sent". */
export const CONFIRM_WINDOW_MS = 6000;

/** Retry callbacks live beside the composer that made them (a function cannot ride a CustomEvent's detail safely). */
const retries = new Map<string, () => void>();
export function registerRetry(tempId: string, fn: () => void): void {
  retries.set(tempId, fn);
}
export function runRetry(tempId: string): boolean {
  const fn = retries.get(tempId);
  if (!fn) return false;
  retries.delete(tempId);
  fn();
  return true;
}
export function forgetRetry(tempId: string): void {
  retries.delete(tempId);
}

let seq = 0;
export function newTempId(): string {
  seq += 1;
  return `pending-${Date.now().toString(36)}-${seq}`;
}

/** The shape of a stored row this file needs — kept narrow so the test can build one. */
export type SentRowLike = {
  sender_role: string;
  body: string | null;
  created_at: string;
  attachment_name?: string | null;
};

/**
 * Is `row` the real message a pending bubble stands for? Same side, same words (trimmed), a file when a file rode
 * it, and stored no earlier than a minute before Send was pressed (a clock skew allowance — never an older
 * identical "ok" from yesterday).
 */
export function matchesPending(row: SentRowLike, pending: PendingSend, viewerRole: string): boolean {
  if (row.sender_role !== viewerRole) return false;
  if ((row.body ?? '').trim() !== pending.body.trim()) return false;
  // A file rode it → the row must carry one. Not the same NAME: compression may rename it (photo.HEIC → photo.jpg).
  if (pending.fileName && !(row.attachment_name ?? '').trim()) return false;
  const stored = Date.parse(row.created_at);
  if (Number.isFinite(stored) && stored < pending.at - 60_000) return false;
  return true;
}

/** Drop every pending bubble whose real row is now in `rows`. Each row settles at most one pending bubble. */
export function settlePendings<R extends SentRowLike>(pendings: PendingSend[], rows: R[], viewerRole: string): PendingSend[] {
  const used = new Set<number>();
  return pendings.filter((p) => {
    const i = rows.findIndex((r, idx) => !used.has(idx) && matchesPending(r, p, viewerRole));
    if (i === -1) return true;
    used.add(i);
    return false;
  });
}

/**
 * THE ONE LINE UNDER YOUR LAST MESSAGE (owner 2026-10-28: *"yes show seen"*): a pending bubble last → its own state;
 * otherwise the last stored message is yours → "Seen" once the other side's read marker (`chat_thread_reads`) is at
 * or after it, else "Delivered"; the other side spoke last → nothing (their reply says it was read).
 */
export type LastLine = { kind: 'sending' } | { kind: 'failed'; tempId: string; reason?: string } | { kind: 'delivered' } | { kind: 'seen' } | null;

export function lastOwnLine(args: {
  lastStored: { sender_role: string; created_at: string } | null;
  pendings: PendingSend[];
  viewerRole: string;
  /** The other side's latest read, ISO — null when unknown or never. */
  theirLastReadAt: string | null;
}): LastLine {
  const last = args.pendings[args.pendings.length - 1];
  if (last) {
    if (last.state !== 'failed') return { kind: 'sending' };
    return last.reason ? { kind: 'failed', tempId: last.tempId, reason: last.reason } : { kind: 'failed', tempId: last.tempId };
  }
  const s = args.lastStored;
  if (!s || s.sender_role !== args.viewerRole) return null;
  if (args.theirLastReadAt && Date.parse(args.theirLastReadAt) >= Date.parse(s.created_at)) return { kind: 'seen' };
  return { kind: 'delivered' };
}

export const LAST_LINE_WORDS = {
  sending: 'Sending…',
  failed: 'Not sent',
  delivered: 'Delivered',
  seen: 'Seen',
} as const;
