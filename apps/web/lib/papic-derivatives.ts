import 'server-only';
import sharp from 'sharp';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseStoredAsset, encodeR2Ref } from '@/lib/uploads';
import { getR2Client, r2Upload, R2_BUCKETS, type R2BucketName } from '@/lib/r2';

/**
 * Papic display-derivative pipeline.
 *
 * Originals are stored at full resolution (multi-MB). Serving them as gallery
 * thumbnails meant a 250-tile gallery shipped 250 full-res files — slow + costly
 * to keep. This module derives two compressed JPEGs server-side, in the capture
 * after() hook, and records their `r2://` refs on the row:
 *
 *   display_r2_key — long-edge 1280, q~80 (lightbox / full view)
 *   thumb_r2_key   — long-edge 320, q~70 (grid tiles)
 *
 * Server has NO ffmpeg (Vercel), so CLIPS are never transcoded: the thumb is
 * derived from the existing poster frame and the display ref IS the poster.
 *
 * EVERYTHING here is best-effort: every export is fully wrapped so a failure
 * (R2 hiccup, decode error, pre-migration column) returns nulls and NEVER
 * throws. The caller fires this fire-and-forget after the capture is saved.
 */

const DISPLAY_LONG_EDGE = 1280;
const DISPLAY_QUALITY = 80;
const THUMB_LONG_EDGE = 320;
const THUMB_QUALITY = 70;

type PapicDerivativeTable = 'papic_photos' | 'papic_guest_captures';

type DerivativeKeys = {
  displayKey: string | null;
  thumbKey: string | null;
};

const NULL_KEYS: DerivativeKeys = { displayKey: null, thumbKey: null };

/**
 * Fetch the raw bytes of an `r2://bucket/key` ref via the S3 GetObject client.
 * Returns the bucket alongside the bytes so derivatives can land in the same
 * bucket as the original.
 */
async function fetchR2Bytes(
  ref: string,
): Promise<{ bytes: Uint8Array; bucket: R2BucketName; key: string } | null> {
  const parsed = parseStoredAsset(ref);
  if (!parsed || parsed.kind !== 'r2') return null;
  const client = getR2Client();
  if (!client) return null;
  const res = await client.send(
    new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
  );
  const body = res.Body as unknown as {
    transformToByteArray?: () => Promise<Uint8Array>;
  } | null;
  if (!body || typeof body.transformToByteArray !== 'function') return null;
  const bytes = await body.transformToByteArray();
  return { bytes, bucket: parsed.bucket, key: parsed.key };
}

/** Resize `input` to a long-edge cap and re-encode as JPEG. */
async function toJpeg(
  input: Uint8Array,
  longEdge: number,
  quality: number,
): Promise<Buffer> {
  return await sharp(input)
    .rotate() // honour EXIF orientation before stripping metadata
    .resize({
      width: longEdge,
      height: longEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

/** Build a sibling derivative key next to the original's object key. */
function derivativeKey(originalKey: string, suffix: string): string {
  return `derivatives/${originalKey}.${suffix}.jpg`;
}

/**
 * Generate DISPLAY + THUMB derivatives for a still photo, upload both to the
 * original's bucket under `derivatives/…`, and persist the refs on the row.
 *
 * Best-effort: any failure returns {null, null} and leaves the columns NULL
 * (readers fall back to the original). Never throws.
 */
export async function generatePhotoDerivatives(
  originalRef: string,
  table: PapicDerivativeTable,
  idColumn: string,
  idValue: string,
): Promise<DerivativeKeys> {
  try {
    const fetched = await fetchR2Bytes(originalRef);
    if (!fetched) return NULL_KEYS;
    const { bytes, bucket, key } = fetched;

    const [displayBuf, thumbBuf] = await Promise.all([
      toJpeg(bytes, DISPLAY_LONG_EDGE, DISPLAY_QUALITY),
      toJpeg(bytes, THUMB_LONG_EDGE, THUMB_QUALITY),
    ]);

    const displayObjKey = derivativeKey(key, 'display');
    const thumbObjKey = derivativeKey(key, 'thumb');

    await Promise.all([
      r2Upload({
        bucket,
        key: displayObjKey,
        body: displayBuf,
        contentType: 'image/jpeg',
      }),
      r2Upload({
        bucket,
        key: thumbObjKey,
        body: thumbBuf,
        contentType: 'image/jpeg',
      }),
    ]);

    const displayKey = encodeR2Ref(bucket, displayObjKey);
    const thumbKey = encodeR2Ref(bucket, thumbObjKey);

    await persistDerivativeRefs(table, idColumn, idValue, {
      display_r2_key: displayKey,
      thumb_r2_key: thumbKey,
    });

    return { displayKey, thumbKey };
  } catch (err) {
    console.warn(
      `[papic-derivatives] photo derivatives skipped (best-effort) — table=${table} id=${idValue}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NULL_KEYS;
  }
}

/**
 * Generate a THUMB derivative for a CLIP from its existing poster frame (no
 * video transcode — Vercel has no ffmpeg). The display ref IS the poster.
 * Persists thumb_r2_key + display_r2_key on the row.
 *
 * Best-effort: any failure returns {null, null} and leaves the columns NULL
 * (readers fall back to the poster / original). Never throws.
 */
export async function generateClipThumb(
  posterRef: string,
  table: PapicDerivativeTable,
  idColumn: string,
  idValue: string,
): Promise<DerivativeKeys> {
  try {
    const fetched = await fetchR2Bytes(posterRef);
    if (!fetched) return NULL_KEYS;
    const { bytes, bucket, key } = fetched;

    const thumbBuf = await toJpeg(bytes, THUMB_LONG_EDGE, THUMB_QUALITY);
    const thumbObjKey = derivativeKey(key, 'thumb');

    await r2Upload({
      bucket,
      key: thumbObjKey,
      body: thumbBuf,
      contentType: 'image/jpeg',
    });

    const thumbKey = encodeR2Ref(bucket, thumbObjKey);
    // Display = the poster itself (already a compressed still). Persist the
    // poster's own ref verbatim so the lightbox serves the poster, not the
    // video bytes.
    const displayKey = posterRef;

    await persistDerivativeRefs(table, idColumn, idValue, {
      display_r2_key: displayKey,
      thumb_r2_key: thumbKey,
    });

    return { displayKey, thumbKey };
  } catch (err) {
    console.warn(
      `[papic-derivatives] clip thumb skipped (best-effort) — table=${table} id=${idValue}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NULL_KEYS;
  }
}

/**
 * Write the derivative refs onto the capture row via the admin client. Only
 * over an unset value would be ideal, but a straight UPDATE is fine here — the
 * generator runs once per capture and the columns are derivative-only.
 * Swallows a pre-migration PGRST204 (column absent) so an un-migrated env
 * degrades silently.
 */
async function persistDerivativeRefs(
  table: PapicDerivativeTable,
  idColumn: string,
  idValue: string,
  patch: { display_r2_key: string; thumb_r2_key: string },
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from(table).update(patch).eq(idColumn, idValue);
  if (error && error.code !== 'PGRST204') {
    throw new Error(error.message);
  }
}
