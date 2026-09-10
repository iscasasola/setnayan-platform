import 'server-only';
import { r2GetBytes, r2SignedGet, R2_BUCKETS } from '@/lib/r2';
import { RENDER_BUCKET_KEY } from '@/lib/bucket-routing';
import {
  isOwnRenderImageKey,
  isPooledRenderGalleryKey,
} from '@/lib/moodboard-render-keys';

/**
 * THE ONLY DOORS FROM A RENDER ROW TO STORAGE.
 *
 * A render's keys are read back with the ADMIN R2 credentials from the PRIVATE
 * bucket that also holds payment proofs and chat files. Each door below asks
 * the one question first — "is this key the object THIS row may name?"
 * (lib/moodboard-render-keys.ts) — and returns `null` without touching storage
 * when it is not. The database refuses such a key at the write (migration
 * 20271220579615); this is the serve half, so a row that ever held one — or a
 * future writer that forgets — still cannot turn it into a signed link or a copy.
 *
 * `lib/every-render-read-is-pinned.test.ts` refuses any other file that names
 * the render bucket AND a raw read primitive (`r2SignedGet` / `r2GetBytes`).
 */

const RENDER_BUCKET = R2_BUCKETS[RENDER_BUCKET_KEY];

/** A signed GET of a render's own unmarked image — or null (refused, or signing failed). */
export async function signOwnRenderImage(args: {
  eventId: string;
  renderId: string;
  key: string | null | undefined;
  expiresIn?: number;
}): Promise<string | null> {
  if (!isOwnRenderImageKey(args.key, { eventId: args.eventId, renderId: args.renderId })) {
    return null;
  }
  return await r2SignedGet({
    bucket: RENDER_BUCKET,
    key: args.key,
    expiresIn: args.expiresIn ?? 60 * 60,
  }).catch(() => null);
}

/**
 * A signed GET of a POOLED render's watermarked copy, for another couple.
 * The pool does not return the source event, so the key is held to this row's
 * render id (see `isPooledRenderGalleryKey`).
 */
export async function signPooledGalleryImage(args: {
  renderId: string;
  key: string | null | undefined;
  expiresIn?: number;
}): Promise<string | null> {
  if (!isPooledRenderGalleryKey(args.key, args.renderId)) return null;
  return await r2SignedGet({
    bucket: RENDER_BUCKET,
    key: args.key,
    expiresIn: args.expiresIn ?? 60 * 60,
  }).catch(() => null);
}

/**
 * The bytes of a POOLED render's watermarked copy — the COPY path (a pick
 * re-uploads them into the picker's own public folder). Returns null when the
 * key is not this render's own; THROWS only when an in-scope read fails, so the
 * caller can tell "not allowed" from "try again".
 */
export async function readPooledGalleryBytes(args: {
  renderId: string;
  key: string | null | undefined;
}): Promise<{ bytes: Uint8Array; contentType: string | null } | null> {
  if (!isPooledRenderGalleryKey(args.key, args.renderId)) return null;
  return await r2GetBytes({ bucket: RENDER_BUCKET, key: args.key });
}
