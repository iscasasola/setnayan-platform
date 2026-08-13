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
 * to keep. This module derives two compressed AVIFs server-side, in the capture
 * after() hook, and records their `r2://` refs on the row:
 *
 *   display_r2_key — long-edge 1280, AVIF q~60 (lightbox / full view)
 *   tile_r2_key    — long-edge  640, AVIF q~55 (grid WALLS)
 *   thumb_r2_key   — long-edge  320, AVIF q~50 (dense peek strips)
 *
 * ONE compression pass (owner 2026-07-11): the web copy is born AVIF straight
 * from the full-res original — a single lossy pass, ~2× smaller than the old
 * JPEG derivative at equal visible quality, and no later re-encode cron needed.
 * AVIF is decoded natively by every current browser.
 *
 * Server has NO ffmpeg (Vercel), so CLIPS are never transcoded: the thumb is
 * derived (AVIF) from the existing poster frame and the display ref IS the
 * poster (kept verbatim — already compressed once, so recompressing it would be
 * a second pass).
 *
 * EVERYTHING here is best-effort: every export is fully wrapped so a failure
 * (R2 hiccup, decode error, pre-migration column) returns nulls and NEVER
 * throws. The caller fires this fire-and-forget after the capture is saved.
 */

// 🔒 1280 — the documented plan (`Papic_Pricing_Plan_of_Action_2026-07-20.md`:
// "compressed gallery (AVIF long-edge 1280)"), reaffirmed by the owner 2026-08-07.
//
// I briefly raised this to 1920 to match a 42" LED TV (1920×1080 native, so 1280
// is upscaled ~1.5× there). The owner declined — *"no. let's stay with 720p"* —
// keeping the gallery on plan. Recorded rather than silently reverted so the same
// case is not re-derived: the trade was ~₱7.1 → ~₱10.6/event/yr, and raising it is
// an OWNER decision, not an engineering one.
//
// 🔑 STILL TRUE AND WORTH KNOWING: this is the ONLY copy the gallery ever shows.
// The full-res original is a DOWNLOAD, never displayed, and after the retention
// window it is replaced by this file.
//
// ⚠ THE SENTENCE THAT USED TO END THIS PARAGRAPH — "Grid tiles use thumb_r2_key
// (320px), so this copy loads only when a photo is opened" — WAS MADE FALSE BY
// PR #4399 and is corrected here rather than left to rot. The Alaala wall
// renders grid tiles at 310–383 DEVICE px, which the 320px thumb cannot serve
// (object-cover on a square crops a landscape by its 240px height, so every
// breakpoint upscaled 1.3×–1.6×). The wall briefly used THIS 1280px copy, at
// 27× the bytes — measured in prod: thumb 4 KB avg vs display 96 KB avg, max
// 780 KB. TILE (below) is the size that actually fits.
const DISPLAY_LONG_EDGE = 1280;
// AVIF quality (0–100). ~60 ≈ JPEG q80 to the eye at roughly half the bytes —
// the single-pass web copy (owner 2026-07-11).
const DISPLAY_QUALITY = 60;
// 🖼 640 — the WALL size, added 2026-08-13 because neither existing size fits a
// grid tile. The largest tile the app renders is 383 device px (home
// lg:grid-cols-6 at 2× DPR); a landscape 640×480 covers that square by its 480
// HEIGHT, i.e. a 1.25× DOWNSCALE with headroom, where the 320px thumb was a
// 1.6× UPSCALE. Bytes scale with pixel count — 640²/1280² — so this lands at
// roughly a QUARTER of the display copy while staying ~6× richer than the
// thumb. q55 sits between the two on purpose: it is looked AT, unlike a peek
// strip, but it is not the full view.
const TILE_LONG_EDGE = 640;
const TILE_QUALITY = 55;
const THUMB_LONG_EDGE = 320;
const THUMB_QUALITY = 50;

type PapicDerivativeTable = 'papic_photos' | 'papic_guest_captures';

type DerivativeKeys = {
  displayKey: string | null;
  tileKey: string | null;
  thumbKey: string | null;
};

const NULL_KEYS: DerivativeKeys = { displayKey: null, tileKey: null, thumbKey: null };

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

/**
 * Resize `input` to a long-edge cap and encode as AVIF — the ONE compression
 * pass (owner 2026-07-11 "so we only do 1 compression"). The web copy is born
 * AVIF straight from the full-res original: a single lossy pass (no JPEG→AVIF
 * double-compression), ~2× smaller than the old JPEG derivative at equal visible
 * quality, and it removes the need for a later re-encode cron entirely. AVIF is
 * decoded natively by every current browser. `effort` trades encode speed for
 * size; derivative generation is async best-effort (off the capture path), so a
 * moderate effort is fine.
 */
export async function toAvif(
  input: Uint8Array,
  longEdge: number,
  quality: number,
  effort = 4,
): Promise<Buffer> {
  return await sharp(input)
    .rotate() // honour EXIF orientation before stripping metadata
    .resize({
      width: longEdge,
      height: longEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .avif({ quality, effort })
    .toBuffer();
}

/**
 * Strip ALL metadata (EXIF incl. GPS lat/lng, XMP, IPTC) from a still photo's
 * bytes for an OUTBOUND share/download, keeping full resolution. This is the
 * privacy guarantee behind CLAUDE.md's "geo is stripped on outbound shares;
 * original on R2 retains it" (RA 10173): the R2 original is untouched, but no
 * recipient ever receives the venue's/home's exact coordinates baked into a file.
 *
 * sharp drops all metadata by DEFAULT — we deliberately never call
 * `withMetadata()`/`keepMetadata()`. `.rotate()` (no arg) bakes EXIF orientation
 * into the pixels FIRST, so the stripped file still displays upright even though
 * the orientation tag is gone. Re-encodes to JPEG at high quality; dimensions are
 * preserved (no resize) so the download is full-res, just geo-free.
 *
 * Used ONLY on outbound paths as the fallback when a pre-built, already-stripped
 * `display_r2_key` derivative is absent — so an original is NEVER handed out raw.
 */
export async function stripPhotoMetadata(input: Uint8Array): Promise<Buffer> {
  return await sharp(input)
    .rotate() // bake EXIF orientation before metadata is dropped
    .jpeg({ quality: 90 })
    .toBuffer();
}

/** Build a sibling derivative key next to the original's object key. */
function derivativeKey(originalKey: string, suffix: string): string {
  return `derivatives/${originalKey}.${suffix}.avif`;
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

    const [displayBuf, tileBuf, thumbBuf] = await Promise.all([
      toAvif(bytes, DISPLAY_LONG_EDGE, DISPLAY_QUALITY),
      toAvif(bytes, TILE_LONG_EDGE, TILE_QUALITY),
      toAvif(bytes, THUMB_LONG_EDGE, THUMB_QUALITY),
    ]);

    const displayObjKey = derivativeKey(key, 'display');
    const tileObjKey = derivativeKey(key, 'tile');
    const thumbObjKey = derivativeKey(key, 'thumb');

    await Promise.all([
      r2Upload({
        bucket,
        key: displayObjKey,
        body: displayBuf,
        contentType: 'image/avif',
      }),
      r2Upload({
        bucket,
        key: tileObjKey,
        body: tileBuf,
        contentType: 'image/avif',
      }),
      r2Upload({
        bucket,
        key: thumbObjKey,
        body: thumbBuf,
        contentType: 'image/avif',
      }),
    ]);

    const displayKey = encodeR2Ref(bucket, displayObjKey);
    const tileKey = encodeR2Ref(bucket, tileObjKey);
    const thumbKey = encodeR2Ref(bucket, thumbObjKey);

    // WS4 telemetry: full byte accounting for a still — the original is the
    // full-res, so display_bytes/orig_bytes is the real "~8%" web-copy ratio.
    await persistDerivativeRefs(table, idColumn, idValue, {
      display_r2_key: displayKey,
      thumb_r2_key: thumbKey,
      tile_r2_key: tileKey,
      orig_bytes: bytes.length,
      display_bytes: displayBuf.length,
      thumb_bytes: thumbBuf.length,
      tile_bytes: tileBuf.length,
    });

    return { displayKey, tileKey, thumbKey };
  } catch (err) {
    console.warn(
      `[papic-derivatives] photo derivatives skipped (best-effort) — table=${table} id=${idValue}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NULL_KEYS;
  }
}

/**
 * Generate TILE + THUMB derivatives for a CLIP from its existing poster frame
 * (no video transcode — Vercel has no ffmpeg). The display ref IS the poster.
 * Persists thumb_r2_key + tile_r2_key + display_r2_key on the row.
 *
 * The clip needs the tile for the same reason a photo does: the wall renders
 * its still at 310–383 device px, and a clip that stayed on the 320px thumb
 * would be the one visibly soft square in an otherwise sharp grid.
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

    const [tileBuf, thumbBuf] = await Promise.all([
      toAvif(bytes, TILE_LONG_EDGE, TILE_QUALITY),
      toAvif(bytes, THUMB_LONG_EDGE, THUMB_QUALITY),
    ]);
    const tileObjKey = derivativeKey(key, 'tile');
    const thumbObjKey = derivativeKey(key, 'thumb');

    await Promise.all([
      r2Upload({ bucket, key: tileObjKey, body: tileBuf, contentType: 'image/avif' }),
      r2Upload({ bucket, key: thumbObjKey, body: thumbBuf, contentType: 'image/avif' }),
    ]);

    const tileKey = encodeR2Ref(bucket, tileObjKey);
    const thumbKey = encodeR2Ref(bucket, thumbObjKey);
    // Display = the poster itself (already a compressed still). Persist the
    // poster's own ref verbatim so the lightbox serves the poster, not the
    // video bytes.
    const displayKey = posterRef;

    // WS4 telemetry: record display (poster) + thumb bytes. orig_bytes is left
    // NULL for clips — `bytes` here is the poster, NOT the video original, so
    // writing it as orig would corrupt the photo web-copy ratio.
    await persistDerivativeRefs(table, idColumn, idValue, {
      display_r2_key: displayKey,
      thumb_r2_key: thumbKey,
      tile_r2_key: tileKey,
      display_bytes: bytes.length,
      thumb_bytes: thumbBuf.length,
      tile_bytes: tileBuf.length,
    });

    return { displayKey, tileKey, thumbKey };
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
  patch: {
    display_r2_key: string;
    thumb_r2_key: string;
    /** The wall-sized copy (long-edge 640). Absent on a pre-migration deploy. */
    tile_r2_key?: string | null;
    // WS4 storage telemetry — real byte sizes, best-effort. Omitted keys are not
    // written (legacy behaviour); NULL is a valid "unmeasured" value.
    orig_bytes?: number | null;
    display_bytes?: number | null;
    thumb_bytes?: number | null;
    tile_bytes?: number | null;
  },
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from(table).update(patch).eq(idColumn, idValue);
  // PGRST204 = a byte column doesn't exist yet on this deploy (migration not
  // applied) → the derivative keys still need to land, so retry without the
  // telemetry fields. Keeps derivative generation working ahead of the migration.
  // 🪤 `tile_r2_key` MUST BE STRIPPED HERE TOO. This retry exists because code
  // and migration land at different times; if the new KEY column stayed in the
  // patch, the retry would fail on the same PGRST204 and the display/thumb refs
  // — which the deploy CAN store — would be lost with it. Stripping only the
  // byte columns would have made this fallback silently useless for exactly the
  // window it was built for.
  if (error?.code === 'PGRST204') {
    const { orig_bytes, display_bytes, thumb_bytes, tile_bytes, tile_r2_key, ...keysOnly } =
      patch;
    void orig_bytes;
    void display_bytes;
    void thumb_bytes;
    void tile_bytes;
    void tile_r2_key;
    const retry = await admin
      .from(table)
      .update(keysOnly)
      .eq(idColumn, idValue);
    if (retry.error && retry.error.code !== 'PGRST204') {
      throw new Error(retry.error.message);
    }
    return;
  }
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Generate ONLY the tile derivative for a row that predates it, and persist
 * `tile_r2_key` / `tile_bytes`.
 *
 * Separate from `generatePhotoDerivatives` on purpose: a backfill must not
 * re-encode and re-upload the display + thumb copies that already exist —
 * that is three times the compute and R2 writes for no change.
 *
 * `sourceRef` should be the best still available for the row: the ORIGINAL for
 * a photo that still has one, otherwise its `display_r2_key`. Deriving from
 * display is a second lossy pass, which is why it is the fallback and not the
 * default — but a slightly-soft 640 still beats shipping a 1280 into a 383px
 * tile, and a dropped original cannot be recovered.
 *
 * Best-effort, like everything else here: any failure returns null and NEVER
 * throws, so one unreadable object cannot stop a batch.
 */
export async function generateTileDerivative(
  sourceRef: string,
  table: PapicDerivativeTable,
  idColumn: string,
  idValue: string,
): Promise<string | null> {
  try {
    const fetched = await fetchR2Bytes(sourceRef);
    if (!fetched) return null;
    const { bytes, bucket, key } = fetched;

    const tileBuf = await toAvif(bytes, TILE_LONG_EDGE, TILE_QUALITY);
    // Keyed off the SOURCE object, so re-running is idempotent: the same row
    // always writes the same object key and simply overwrites itself.
    const tileObjKey = derivativeKey(key, 'tile');
    await r2Upload({ bucket, key: tileObjKey, body: tileBuf, contentType: 'image/avif' });
    const tileKey = encodeR2Ref(bucket, tileObjKey);

    const admin = createAdminClient();
    const { error } = await admin
      .from(table)
      .update({ tile_r2_key: tileKey, tile_bytes: tileBuf.length })
      .eq(idColumn, idValue);
    // The column not existing yet is the one failure worth naming: the object
    // is uploaded but unreferenced, and a later run re-uploads it harmlessly.
    if (error) {
      console.warn(
        `[papic-derivatives] tile persisted to R2 but not to the row — table=${table} id=${idValue}: ${error.code ?? ''} ${error.message}`,
      );
      return null;
    }
    return tileKey;
  } catch (err) {
    console.warn(
      `[papic-derivatives] tile backfill skipped (best-effort) — table=${table} id=${idValue}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}
