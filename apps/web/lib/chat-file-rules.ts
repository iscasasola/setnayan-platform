/**
 * THE CHAT FILES RULE — sizes, what is kept forever, and when a file goes.
 * Pure, client-safe, no I/O: the server, the sweep and the screens all import
 * THIS, so the number a screen prints is the number the server refuses at.
 *
 * ── THE OWNER'S RULINGS ─────────────────────────────────────────────────────
 * DECISION_LOG 2026-10-28 "CHAT FILES: SIZE LIMITS, AND EXPIRY 90 DAYS AFTER THE
 * EVENT" — owner, verbatim: *"(B) size limits plus expire after 90 days
 * post-event (recommended)"*. Amended the same day: *"alway compress files when
 * sending on chat. never keep original size"*.
 *
 *   1. Limits are judged AFTER compression (the phone shrinks first —
 *      `lib/chat-file-prepare.ts`): a video ≤ 50 MB, a document ≤ 20 MB, a photo
 *      ≤ 20 MB. Over = refused, in these words, by the server too.
 *   2. KEPT FOREVER: contracts, payment proofs, anything pinned to Decisions.
 *   3. Every other chat file is deleted 90 days after the event; from 14 days
 *      before, the thread shows one line. In-app only — no email.
 *   4. An expired file stays in the thread as "File expired", its name kept.
 *
 * ── HOW "KEPT FOREVER" IS DECIDED (no new column — Rule 0 rule 3) ───────────
 * • A CONTRACT lives in `vendor_contracts` (its own table and bucket) and a
 *   PAYMENT PROOF in `event_vendor_payments.proof_r2_key` / order proofs. None
 *   of them is a `chat_messages.attachment_r2_key`, so the sweep — which reads
 *   only that column — cannot reach them by construction. The sweep also skips
 *   any chat file whose ref is ALSO named by a proof column (one object, two
 *   owners: the longer promise wins).
 * • PINNED TO DECISIONS = a message that carries a decision card:
 *   `proposal_id` (quote), `appointment_id` (meeting), `amendment_id`
 *   (adjustment) — the three message-borne kinds in `lib/thread-decisions.ts`.
 *   `offered_service_id` is kept too: it renders a card, and deleting the file
 *   under a card is not the sweep's call. A message carrying ANY of them keeps
 *   its file. {@link isKeptForever} is the one predicate; the sweep's query
 *   filters on the same columns and its test proves the two agree.
 *
 * ── HOW "EXPIRED" IS WRITTEN (no new column) ────────────────────────────────
 * The sweep clears `attachment_r2_key` and keeps `attachment_name`. Every
 * writer sets the two together (`lib/chat-send.ts`), and `attachment_url` has
 * been retired since 2026-09-09, so "a name with no ref and no url" can only
 * mean the file was taken away by the sweep. {@link isExpired} reads exactly
 * that.
 */

import { manilaTodayISO } from '@/lib/event-board';
import { formatLongDate } from '@/lib/format-date';

// ── 1 · SIZES (after compression) ───────────────────────────────────────────

const MB = 1024 * 1024;

/** A video, after the phone has compressed it. */
export const CHAT_VIDEO_MAX_MB = 50;
/** A PDF / Word / Excel / text file. Not re-encoded — it is evidence. */
export const CHAT_DOCUMENT_MAX_MB = 20;
/** A photo, after the phone has compressed it (a 2000 px JPEG is ~1 MB). */
export const CHAT_PHOTO_MAX_MB = 20;

export const CHAT_VIDEO_MAX_BYTES = CHAT_VIDEO_MAX_MB * MB;
export const CHAT_FILE_DOCUMENT_MAX_BYTES = CHAT_DOCUMENT_MAX_MB * MB;
export const CHAT_PHOTO_MAX_BYTES = CHAT_PHOTO_MAX_MB * MB;

/** The largest thing a conversation ever stores — the storage-layer backstop. */
export const CHAT_FILE_LARGEST_BYTES = Math.max(
  CHAT_VIDEO_MAX_BYTES,
  CHAT_FILE_DOCUMENT_MAX_BYTES,
  CHAT_PHOTO_MAX_BYTES,
);

/** The videos a conversation accepts (what `compressVideoForWeb` reads and writes). */
export const CHAT_VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

export type ChatFileKind = 'photo' | 'video' | 'document';

export function chatFileKind(mime: string | null | undefined): ChatFileKind {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'photo';
  if (m.startsWith('video/')) return 'video';
  return 'document';
}

/** The refusal, in the owner's words. */
export function chatFileTooLargeMessage(maxMb: number): string {
  return `That file is over ${maxMb} MB. Send a Drive or YouTube link instead.`;
}

/**
 * The ceiling for THIS file once compressed, and the sentence when it is over.
 * Unknown types fall to the document cap (the tighter of the non-video caps).
 */
export function chatFileLimitFor(mime: string | null | undefined): {
  kind: ChatFileKind;
  maxBytes: number;
  maxMb: number;
  tooLargeMessage: string;
} {
  const kind = chatFileKind(mime);
  const maxMb =
    kind === 'video' ? CHAT_VIDEO_MAX_MB : kind === 'photo' ? CHAT_PHOTO_MAX_MB : CHAT_DOCUMENT_MAX_MB;
  return { kind, maxBytes: maxMb * MB, maxMb, tooLargeMessage: chatFileTooLargeMessage(maxMb) };
}

/** null when the file may be sent; otherwise the words to show. */
export function chatFileRefusal(mime: string | null | undefined, sizeBytes: number): string | null {
  const limit = chatFileLimitFor(mime);
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return limit.tooLargeMessage;
  return sizeBytes > limit.maxBytes ? limit.tooLargeMessage : null;
}

// ── 2 · KEPT FOREVER ────────────────────────────────────────────────────────

/**
 * The `chat_messages` columns that pin a message to Decisions. A message with
 * any of them set keeps its file. The sweep's query filters `.is(col, null)` on
 * EVERY one of these — `lib/chat-file-expiry-sweep.ts` imports this list.
 */
export const CHAT_KEPT_FOREVER_COLUMNS = [
  'proposal_id',
  'appointment_id',
  'amendment_id',
  'offered_service_id',
] as const;

export type ChatFileMessage = {
  attachment_name?: string | null;
  attachment_r2_key?: string | null;
  attachment_url?: string | null;
} & Partial<Record<(typeof CHAT_KEPT_FOREVER_COLUMNS)[number], string | null>>;

export function isKeptForever(message: ChatFileMessage): boolean {
  return CHAT_KEPT_FOREVER_COLUMNS.some((c) => {
    const v = message[c];
    return typeof v === 'string' && v.length > 0;
  });
}

// ── 3 · EXPIRY ──────────────────────────────────────────────────────────────

export const CHAT_FILE_EXPIRY_DAYS = 90;
export const CHAT_FILE_WARNING_DAYS = 14;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function addDays(isoDay: string, days: number): string | null {
  const m = ISO_DAY.exec(isoDay.slice(0, 10));
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * The day (YYYY-MM-DD) a conversation's ordinary files go: 90 days after the
 * event. NO DATE → null → NEVER EXPIRES. A date that is only a month or a year
 * (`event_date_precision` ≠ 'day') is also null — expiring on a guessed day
 * would delete files earlier than the rule promises. A multi-day event counts
 * from its LAST day (`event_end_date`) when given.
 */
export function expiryDateFor(
  eventDate: string | null | undefined,
  opts: { endDate?: string | null; precision?: string | null } = {},
): string | null {
  if (opts.precision != null && opts.precision !== 'day') return null;
  const base = (opts.endDate && ISO_DAY.test(opts.endDate.slice(0, 10)) ? opts.endDate : eventDate) ?? null;
  if (!base) return null;
  return addDays(base, CHAT_FILE_EXPIRY_DAYS);
}

/** Has this expiry day arrived (Manila calendar day)? */
export function isPastExpiry(now: Date, expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  return manilaTodayISO(now) >= expiryDate;
}

/** True from 14 days before the files go, until they go. Never without a date. */
export function showsExpiryWarning(
  now: Date,
  eventDate: string | null | undefined,
  opts: { endDate?: string | null; precision?: string | null } = {},
): boolean {
  const expiry = expiryDateFor(eventDate, opts);
  if (!expiry) return false;
  const warnFrom = addDays(expiry, -CHAT_FILE_WARNING_DAYS);
  if (!warnFrom) return false;
  const today = manilaTodayISO(now);
  return today >= warnFrom && today < expiry;
}

/** The thread's one line, in-app only. */
export function expiryWarningLine(expiryDate: string): string {
  return `These files go on ${formatLongDate(expiryDate)}. Save any you need.`;
}

// ── 4 · EXPIRED ─────────────────────────────────────────────────────────────

export const CHAT_FILE_EXPIRED_LABEL = 'File expired';

/** A message whose file the sweep took away: its name is kept, its ref is gone. */
export function isExpired(message: ChatFileMessage): boolean {
  const name = message.attachment_name?.trim();
  return Boolean(name) && !message.attachment_r2_key && !message.attachment_url;
}

// ── 5 · A FILE THE PHONE ALREADY UPLOADED ───────────────────────────────────

/**
 * Big files cannot ride the send action (a server action body is capped at
 * 6 MB in `next.config.ts`, and a Vercel function request at ~4.5 MB), so the
 * phone PUTs them straight to R2 through `/api/upload` and the send carries
 * only the ref. The server then MEASURES the stored object (an R2 HEAD — its
 * real size and type, never the client's claim) and judges it here.
 */
export const CHAT_FILE_REF_PREFIX = 'r2://setnayan-thread-files/';

/** The sender's own folder — the only place the database accepts a chat file from them. */
export function chatFileOwnFolder(threadId: string, userId: string): string {
  return `chat/${threadId}/${userId}/`;
}

export type StoredChatFileVerdict =
  | {
      ok: true;
      attachment: {
        attachment_r2_key: string;
        attachment_name: string;
        attachment_mime: string;
        attachment_size_bytes: number;
      };
    }
  /** `discard`: the object is the sender's own fresh upload and must not be left behind. */
  | { ok: false; message: string; discard: boolean };

export const CHAT_FILE_TYPE_REFUSAL =
  'That file type isn’t supported — attach a photo, a video, a PDF, or a common document.';
export const CHAT_FILE_UPLOAD_FAILED = 'Couldn’t upload your file. Please try again.';

export function judgeStoredChatFile(args: {
  ref: string;
  name: string;
  threadId: string;
  userId: string;
  /** The R2 HEAD of the object, or null when it could not be read. */
  head: { size: number; contentType: string | null } | null;
  allowedMime: readonly string[];
}): StoredChatFileVerdict {
  const own = CHAT_FILE_REF_PREFIX + chatFileOwnFolder(args.threadId, args.userId);
  if (!args.ref.startsWith(own) || args.ref.length <= own.length || args.ref.includes('..')) {
    return { ok: false, message: CHAT_FILE_UPLOAD_FAILED, discard: false };
  }
  if (!args.head) return { ok: false, message: CHAT_FILE_UPLOAD_FAILED, discard: false };
  const mime = (args.head.contentType ?? '').split(';')[0].trim().toLowerCase();
  if (!args.allowedMime.includes(mime)) {
    return { ok: false, message: CHAT_FILE_TYPE_REFUSAL, discard: true };
  }
  const refusal = chatFileRefusal(mime, args.head.size);
  if (refusal) return { ok: false, message: refusal, discard: true };
  const name = args.name.trim().slice(0, 255) || 'Attachment';
  return {
    ok: true,
    attachment: {
      attachment_r2_key: args.ref,
      attachment_name: name,
      attachment_mime: mime,
      attachment_size_bytes: args.head.size,
    },
  };
}
