/**
 * THE GALLERY COPY (MB9) — one render, two objects, and they are not the same
 * bytes.
 *
 *   renders/<eventId>/<renderId>.<ext>        the couple's own copy. UNMARKED.
 *                                             Private bucket. What they paid for.
 *   render-gallery/<eventId>/<renderId>.jpg   the WATERMARKED copy. Private
 *                                             bucket too, until another couple
 *                                             picks it. What the pool lists.
 *
 * 🔑 THE TWO KEYS ARE PRODUCED BY DIFFERENT FUNCTIONS AND ARE NEVER EQUAL.
 * `renderObjectKey` (render-actions.ts) writes the first; `galleryObjectKey`
 * here writes the second, under a prefix that does not even start with the
 * same word. That is what makes "we did not accidentally mark the couple's own
 * copy" checkable rather than asserted: the marked bytes are only ever uploaded
 * to a key this function produced, and `moodboard_finish_render` — the writer
 * of `image_key` — is never handed them.
 *
 * ⚠ WHY THE GALLERY COPY IS STILL IN THE **PRIVATE** BUCKET. A render becomes
 * publishable only once its event consents (MB8's lock: consent gates
 * publication, never retention). Writing every render's marked copy to the
 * public `media` bucket at render time would put non-consented creations behind
 * a plain URL, which is exactly the decision consent exists to make. So the
 * marked copy is made eagerly — no backfill needed the day a couple says yes —
 * and read only through short-lived presigned GETs minted server-side. It
 * reaches the public bucket at PICK time, by which point consent has already
 * stood.
 */

import { watermarkImageBytes } from './watermark-server';

/** `render-gallery/<eventId>/<renderId>.jpg` — always .jpg; the marker outputs JPEG. */
export function galleryObjectKey(eventId: string, renderId: string): string {
  return `render-gallery/${eventId}/${renderId}.jpg`;
}

/**
 * Where a picked render lands on the PICKING couple's own board.
 *
 * Their copy, in their own inspiration prefix, exactly like a photo they
 * uploaded — because that is what it now is. Keyed on the source render so two
 * slots holding the same reference share one object, and so the tile can be
 * traced back without a second column.
 */
export function pickedRenderObjectKey(eventId: string, renderId: string): string {
  return `inspiration/${eventId}/render-${renderId}.jpg`;
}

export type GalleryCopy = {
  key: string;
  bytes: Buffer;
  contentType: 'image/jpeg';
};

/**
 * Build the watermarked gallery copy of a render.
 *
 * Returns the KEY AND THE BYTES TOGETHER, in one object, so the upload call
 * site cannot pair a gallery key with unmarked bytes — there is no arrangement
 * of this function's output that produces an unmarked object at a
 * `render-gallery/` key.
 *
 * Throws if the bytes cannot be decoded or marked. The caller's answer to that
 * is "this render has no gallery copy", never "publish the original".
 */
export async function buildGalleryCopy(args: {
  eventId: string;
  renderId: string;
  bytes: Uint8Array | Buffer;
}): Promise<GalleryCopy> {
  const marked = await watermarkImageBytes(args.bytes);
  return {
    key: galleryObjectKey(args.eventId, args.renderId),
    bytes: marked.bytes,
    contentType: marked.contentType,
  };
}
