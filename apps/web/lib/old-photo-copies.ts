/**
 * old-photo-copies.ts — THE RULES of "Make small copies of old photos" (owner 2026-10-23), pure so they are tested
 * without R2 or a database. The server half is `lib/old-photo-copies.server.ts`; the tool lives on Admin › Papic
 * storage; the database half (the ledger and the two functions) is migration 20271284663331.
 *
 *   · OVERSIZED: an original over {@link OVERSIZED_BYTES}. Today's uploaders shrink a photo in the browser
 *     (`compressImage`) to well under this, so what crosses it is, in practice, a photo from before that.
 *   · THE COPY: long edge {@link WEB_LONG_EDGE} px, JPEG q{@link WEB_JPEG_QUALITY} — sharp enough for a full-screen
 *     background on a desktop, a fraction of the bytes. Written BESIDE the original ({@link webCopyKey}: same folder,
 *     so every prefix rule that admits the original admits the copy), never over it.
 *   · KEPT ONLY WHEN SMALLER — a copy that is not smaller is not written and not pointed at.
 */
import { formatCount } from './format-number';

export const OVERSIZED_BYTES = 1_000_000;
export const WEB_LONG_EDGE = 2048;
export const WEB_JPEG_QUALITY = 82;
/** Copies written per press — each decodes and re-encodes a large image inside one server invocation. */
export const COPIES_PER_PRESS = 6;

/** The copy's object key: the original's, with its extension replaced by `.web.jpg`, in the same folder. */
export function webCopyKey(originalKey: string): string {
  const slash = originalKey.lastIndexOf('/');
  const dir = originalKey.slice(0, slash + 1);
  const name = originalKey.slice(slash + 1);
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${dir}${stem}.web.jpg`;
}

/** Is an original of this size worth a copy? Unknown size (a HEAD that failed) is never "oversized". */
export function isOversized(bytes: number | null | undefined): boolean {
  return typeof bytes === 'number' && Number.isFinite(bytes) && bytes > OVERSIZED_BYTES;
}

/** "4.3 MB" / "820 KB" — the admin page's sizes. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${formatCount(bytes / 1_000_000, 1)} MB`;
  return `${formatCount(Math.max(1, Math.round(bytes / 1000)))} KB`;
}
