/**
 * Pure, client-safe rules for a file shared in a conversation — what may be
 * sent, how big, and which of them the browser compresses first.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The allowlist lived in `lib/chat-send.ts` (server-only) and the composer kept
 * its OWN hand-typed copy, under a comment saying so: *"Kept in sync with it by
 * hand (a client component can't import the server-only chat-send module)."*
 * Two hand-typed lists that must agree is the shape this repo keeps paying for
 * — the server refuses a type the picker happily offered, and the only symptom
 * is a file that will not send.
 *
 * Same split as `lib/bucket-routing.ts` out of `lib/storage.ts`: the
 * deterministic rules live here with no I/O and no `server-only`, and both
 * sides import THEM.
 *
 * ── THE OWNER'S RULE (2026-09-09) ───────────────────────────────────────────
 * *"all files uploaded on chat should be compressed and minimum."*
 *
 * Images are compressed IN THE BROWSER before they are uploaded — a phone photo
 * goes from ~4 MB to a few hundred KB, it costs us no compute, and it is far
 * faster to send on a venue's weak signal.
 *
 * ⚠ DOCUMENTS ARE NOT RE-ENCODED, AND THAT IS NOT AN OVERSIGHT. A PDF or Word
 * contract is EVIDENCE: it has to arrive byte-for-byte as it was sent, and
 * re-encoding one in a browser risks handing somebody a corrupt file at the
 * moment they most need it. They get a tighter cap instead.
 *
 * ⚠ AND "MINIMUM" HAS A FLOOR. People photograph contracts, receipts and bank
 * slips. Squeeze one of those and the numbers stop being readable, which
 * destroys the only reason the file was sent — so the image ceiling below is
 * deliberately generous for text on paper, not tuned for the smallest possible
 * byte count.
 */

/** Every MIME a conversation accepts. The SERVER enforces this list. */
export const CHAT_ATTACHMENT_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
] as const;

/**
 * What the OS file dialog offers. DERIVED from the list above plus the file
 * extensions some browsers need, so the picker can no longer offer a type the
 * server refuses.
 */
export const CHAT_ATTACHMENT_ACCEPT = [
  ...CHAT_ATTACHMENT_MIME,
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
].join(',');

/**
 * A document's ceiling — 25 MB → 10 MB (2026-09-09). It could come down
 * because photographs, which is what actually filled that headroom, no longer
 * arrive at their original size.
 */
export const CHAT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * The ceiling on an image BEFORE compression. Not a product limit — a guard on
 * the browser: decoding an enormous file into a canvas is what makes a phone
 * stall, and no camera on a phone produces one this large.
 */
export const CHAT_IMAGE_SOURCE_MAX_BYTES = 40 * 1024 * 1024;

/**
 * The hard server-side ceiling on what is finally stored, whatever route it
 * arrived by. A compressed photo lands far under it; a document is already
 * capped tighter. This exists so a caller that skips the browser step — the
 * native app, a future API — still cannot write something enormous.
 */
export const CHAT_ATTACHMENT_MAX_BYTES = CHAT_DOCUMENT_MAX_BYTES;

/**
 * Is this something the browser should shrink before uploading?
 *
 * ⚠ GIF IS EXCLUDED ON PURPOSE. It is the one image type here that can be
 * ANIMATED, and drawing it to a canvas keeps a single frame — so "compressing"
 * a reaction GIF silently turns it into a still. Losing the animation is worse
 * than the bytes it saves.
 */
export function isCompressibleImage(mime: string | null | undefined): boolean {
  return mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp';
}

/** Is this an image at all (compressible or not)? */
export function isChatImage(mime: string | null | undefined): boolean {
  return typeof mime === 'string' && mime.startsWith('image/');
}

/**
 * The size ceiling that applies to THIS file, and the sentence to show when it
 * is over. One function so the picker, the composer and the server cannot
 * disagree about which limit a given file is being judged against.
 */
export function chatAttachmentLimit(mime: string | null | undefined): {
  maxBytes: number;
  tooLargeMessage: string;
} {
  if (isChatImage(mime)) {
    return {
      maxBytes: CHAT_IMAGE_SOURCE_MAX_BYTES,
      tooLargeMessage: 'That picture is too large to open — try taking it again.',
    };
  }
  return {
    maxBytes: CHAT_DOCUMENT_MAX_BYTES,
    tooLargeMessage: 'That file is too large — documents are capped at 10 MB.',
  };
}
