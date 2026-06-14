// FaceBlock blur baker — Salamisim Live Photo Wall P2 (iteration 0012).
//
// The P1 wall shipped with a fail-closed FaceBlock STUB: any event with one
// `guests.faceblock_enabled` guest withholds EVERY photo from the venue
// projection. This module is the replacement — it bakes a SERVER-SIDE blurred
// derivative (every detected face blurred into the pixels, never CSS) and
// records it as `wall_safe_r2_key`, which `wall_ingest` / `wall_visible_photos`
// then require before a photo may project on a FaceBlock event.
//
// Architecture (mirrors lib/nsfw-screen.ts — the shipped self-hosted pattern):
//   * Detector: MediaPipe full-range face detector (tfjs graph model) on
//     @tensorflow/tfjs with the pure-JS CPU backend. NOT @tensorflow/tfjs-node
//     (native bindings break on Vercel serverless).
//   * Model files SELF-HOSTED: committed under apps/web/models/face-detection/
//     (~1.2 MB), read with node:fs via a custom tf.io.IOHandler, traced into
//     the serverless bundle by `outputFileTracingIncludes`. Cached
//     module-level so a warm lambda loads once (~16 ms).
//   * Recall: the detector squeezes its input to 192×192, so distant
//     reception-photo faces vanish on a single pass. We run a TILED sweep
//     (full frame + 4 overlapping quadrants), map boxes back to global
//     coordinates and IoU-dedupe. Spike result on a 6-face fixture: 2/6
//     single-pass → 5/5 frontal tiled (~3.2 s on CPU).
//   * Blur: sharp extracts each detected box expanded 1.6× (hair/ears/
//     near-miss margin), Gaussian-blurs it relative to face size, and
//     composites it back. Output is a fresh JPEG derivative — the original
//     bytes in R2 are never touched.
//
// FAIL-CLOSED — the OPPOSITE of the NSFW screen's fail-open rule. The NSFW
// screen protects capture durability (an error leaves the row visible to the
// couple). This baker protects a PRIVACY PROMISE ("my face will not be
// projected at the venue"): on ANY error — model load, R2 fetch, decode,
// upload, RPC — no bake markers are written, `wall_ingest` keeps withholding,
// and the read path keeps hiding. A pipeline hiccup costs a tile, never a
// face.
//
// Honest residual risk (documented, not hidden): no detector has perfect
// recall — extreme profiles and heavily occluded faces at frame edges can be
// missed (the spike's foreground head turned ~120° away was). Mitigations:
// tiled sweep, 1.6× box expansion, the couple/coordinator one-tap
// `wall_retract` kill switch, and the wall being a couple-moderated surface.
// The flip side is accepted BY DESIGN: the recall-tuned sweep occasionally
// boxes a face-like object (the test fixture's brass candlestick) — a
// blurred candlestick costs aesthetics, a missed face breaks the promise.
//
// Heavy imports (tf, the detector, sharp, fs, supabase, r2) are all DYNAMIC so
// the pure geometry below stays importable from tsx tests without a server
// context, and so the model never loads on requests that don't bake.

import type { Tensor3D } from '@tensorflow/tfjs';
import type { MediaPipeFaceDetectorTfjs } from '@tensorflow-models/face-detection/dist/tfjs/detector';

// ─────────────────────────────────────────────────────────────────────────
// Pure geometry — exported for the test suite.
// ─────────────────────────────────────────────────────────────────────────

export type FaceBox = { x: number; y: number; w: number; h: number };

/** Wall derivatives are capped at this long edge (the projection's own cap). */
export const WALL_SAFE_MAX_EDGE = 1600;
/** Detected boxes are expanded by this factor before blurring. */
export const FACE_BOX_EXPANSION = 1.6;
/** Overlapping-quadrant tile fraction (62% of each dimension, per corner). */
export const TILE_FRACTION = 0.62;
/** Boxes overlapping at or above this IoU are the same face. */
export const FACE_IOU_DEDUPE = 0.3;

export function iou(a: FaceBox, b: FaceBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union <= 0 ? 0 : inter / union;
}

/** Largest-first greedy IoU dedupe across tile passes. */
export function dedupeBoxes(boxes: FaceBox[], threshold = FACE_IOU_DEDUPE): FaceBox[] {
  const kept: FaceBox[] = [];
  for (const box of [...boxes].sort((p, q) => q.w * q.h - p.w * p.h)) {
    if (!kept.some((k) => iou(k, box) > threshold)) kept.push(box);
  }
  return kept;
}

/**
 * Tile layout for the recall sweep: the full frame plus four overlapping
 * corner quadrants (62% of each dimension). The quadrants overlap each other
 * across the center, so center faces get up to five looks.
 */
export function tileRects(width: number, height: number): FaceBox[] {
  const tw = Math.round(width * TILE_FRACTION);
  const th = Math.round(height * TILE_FRACTION);
  return [
    { x: 0, y: 0, w: width, h: height },
    { x: 0, y: 0, w: tw, h: th },
    { x: width - tw, y: 0, w: tw, h: th },
    { x: 0, y: height - th, w: tw, h: th },
    { x: width - tw, y: height - th, w: tw, h: th },
  ];
}

/** Expand a box around its center, clamped to the image, integer coords. */
export function expandBox(
  box: FaceBox,
  width: number,
  height: number,
  factor = FACE_BOX_EXPANSION,
): FaceBox {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const w = box.w * factor;
  const h = box.h * factor;
  const x = Math.max(0, Math.floor(cx - w / 2));
  const y = Math.max(0, Math.floor(cy - h / 2));
  return {
    x,
    y,
    w: Math.max(1, Math.min(width - x, Math.ceil(w))),
    h: Math.max(1, Math.min(height - y, Math.ceil(h))),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Detector loading — committed graph model + node:fs IOHandler, cached.
// ─────────────────────────────────────────────────────────────────────────

let detectorPromise: Promise<MediaPipeFaceDetectorTfjs> | null = null;

async function loadDetector(): Promise<MediaPipeFaceDetectorTfjs> {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    const [tf, faceDetection, fs, path] = await Promise.all([
      import('@tensorflow/tfjs'),
      import('@tensorflow-models/face-detection'),
      import('node:fs/promises'),
      import('node:path'),
    ]);
    await tf.setBackend('cpu');
    await tf.ready();

    const dir = path.join(process.cwd(), 'models', 'face-detection');
    const ioHandler: import('@tensorflow/tfjs').io.IOHandler = {
      load: async () => {
        const modelJson = JSON.parse(
          await fs.readFile(path.join(dir, 'model.json'), 'utf8'),
        ) as {
          format?: string;
          generatedBy?: string;
          convertedBy?: string;
          modelTopology: object;
          weightsManifest: Array<{ paths: string[]; weights: object[] }>;
        };
        const weightSpecs: object[] = [];
        const shards: Buffer[] = [];
        for (const group of modelJson.weightsManifest) {
          for (const shardPath of group.paths) {
            shards.push(await fs.readFile(path.join(dir, shardPath)));
          }
          weightSpecs.push(...group.weights);
        }
        const weightData = new Uint8Array(
          shards.reduce((sum, b) => sum + b.byteLength, 0),
        );
        let offset = 0;
        for (const shard of shards) {
          weightData.set(shard, offset);
          offset += shard.byteLength;
        }
        return {
          modelTopology: modelJson.modelTopology,
          format: modelJson.format,
          generatedBy: modelJson.generatedBy,
          convertedBy: modelJson.convertedBy,
          weightSpecs: weightSpecs as import('@tensorflow/tfjs').io.WeightsManifestEntry[],
          weightData: weightData.buffer as ArrayBuffer,
        };
      },
    };

    const detector = await faceDetection.createDetector(
      faceDetection.SupportedModels.MediaPipeFaceDetector,
      {
        runtime: 'tfjs',
        modelType: 'full',
        maxFaces: 16,
        detectorModelUrl: ioHandler,
      },
    );
    return detector as MediaPipeFaceDetectorTfjs;
  })();
  // A failed load must not poison every later attempt on this instance.
  detectorPromise.catch(() => {
    detectorPromise = null;
  });
  return detectorPromise;
}

// ─────────────────────────────────────────────────────────────────────────
// Detection + bake over raw bytes.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Tiled face detection over a raw RGB buffer. Returns deduped boxes in the
 * buffer's coordinate space. Throws on detector failure (caller fails CLOSED).
 */
export async function detectFacesTiled(
  raw: Buffer,
  width: number,
  height: number,
): Promise<FaceBox[]> {
  const [tf, detector] = await Promise.all([import('@tensorflow/tfjs'), loadDetector()]);
  const found: FaceBox[] = [];
  for (const rect of tileRects(width, height)) {
    // Crop out of the full raw buffer row-by-row (no second decode).
    const crop = Buffer.alloc(rect.w * rect.h * 3);
    for (let row = 0; row < rect.h; row++) {
      const srcStart = ((rect.y + row) * width + rect.x) * 3;
      raw.copy(crop, row * rect.w * 3, srcStart, srcStart + rect.w * 3);
    }
    const tensor = tf.tensor3d(
      new Int32Array(crop),
      [rect.h, rect.w, 3],
      'int32',
    ) as Tensor3D;
    try {
      const faces = await detector.estimateFaces(tensor, { flipHorizontal: false });
      for (const f of faces) {
        found.push({
          x: rect.x + f.box.xMin,
          y: rect.y + f.box.yMin,
          w: f.box.width,
          h: f.box.height,
        });
      }
    } finally {
      tensor.dispose();
    }
  }
  return dedupeBoxes(found);
}

export type WallSafeBake = {
  jpeg: Buffer;
  facesFound: number;
  width: number;
  height: number;
};

/**
 * Bake the wall-safe derivative for one image: EXIF-normalize, cap at
 * 1600px, detect faces (tiled), blur every detected face into the pixels,
 * re-encode as JPEG. Always returns a fresh derivative — even with zero
 * faces found — so a baked object is always distinct from the original
 * (provenance: `wall_safe_r2_key` ≠ `r2_object_key` ⟺ actually baked).
 *
 * Throws on undecodable input or detector failure — the caller fails CLOSED.
 */
export async function bakeWallSafeJpeg(bytes: Uint8Array): Promise<WallSafeBake> {
  const { default: sharp } = await import('sharp');

  // .rotate() bakes EXIF orientation in BEFORE detection — a sideways raw
  // decode would hide every face from the detector AND display sideways.
  const normalized = await sharp(Buffer.from(bytes))
    .rotate()
    .resize(WALL_SAFE_MAX_EDGE, WALL_SAFE_MAX_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .removeAlpha()
    .toBuffer();

  const { data: raw, info } = await sharp(normalized)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const faces = await detectFacesTiled(raw, width, height);

  if (faces.length === 0) {
    const jpeg = await sharp(normalized).jpeg({ quality: 82 }).toBuffer();
    return { jpeg, facesFound: 0, width, height };
  }

  const overlays: Array<{ input: Buffer; left: number; top: number }> = [];
  for (const face of faces) {
    const region = expandBox(face, width, height);
    // Blur strength scales with face size; the floor keeps small faces
    // unrecognizable at projection size.
    const sigma = Math.max(12, Math.round(region.w / 4));
    const blurred = await sharp(normalized)
      .extract({ left: region.x, top: region.y, width: region.w, height: region.h })
      .blur(sigma)
      .toBuffer();
    overlays.push({ input: blurred, left: region.x, top: region.y });
  }

  const jpeg = await sharp(normalized)
    .composite(overlays)
    .jpeg({ quality: 82 })
    .toBuffer();
  return { jpeg, facesFound: faces.length, width, height };
}

// ─────────────────────────────────────────────────────────────────────────
// bakeFaceBlurForCapture — the background hook (called from after(), between
// the NSFW screen and ingestToWall).
// ─────────────────────────────────────────────────────────────────────────

export type FaceBlurTable = 'papic_photos' | 'papic_guest_captures';

const TABLE_ID_COLUMN: Record<FaceBlurTable, string> = {
  papic_photos: 'photo_id',
  papic_guest_captures: 'capture_id',
};

/** Parse a stored `r2://<bucket>/<key>` ref into bucket + bare key. */
function parseR2Ref(ref: string): { bucket: string | null; key: string } {
  const match = /^r2:\/\/([^/]+)\/(.+)$/.exec(ref);
  if (!match) return { bucket: null, key: ref };
  return { bucket: match[1] ?? null, key: match[2] ?? ref };
}

export type BakeResult =
  | { baked: true; facesFound: number }
  | { baked: false; reason: string };

/**
 * Bake the FaceBlock derivative for one capture, if (and only if) the wall
 * needs it. The cheap gates run first — no model load, no R2 fetch — unless
 * the event actually has a FaceBlock guest AND owns the Live Wall AND the
 * row is screened 'clean' (only 'clean' ever projects, so anything else
 * would be wasted compute).
 *
 * On success, `wall_record_bake` (service-role RPC) stamps
 * `faceblock_baked_at` + `faceblock_faces_found` + `wall_safe_r2_key` on the
 * capture row and syncs any existing wall_feed row.
 *
 * FAIL-CLOSED: any error returns { baked: false } WITHOUT writing markers —
 * `wall_ingest` keeps withholding and `wall_visible_photos` keeps hiding.
 * Never throws — safe to fire-and-forget from after().
 */
export async function bakeFaceBlurForCapture(opts: {
  table: FaceBlurTable;
  sourceId: string;
}): Promise<BakeResult> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const idColumn = TABLE_ID_COLUMN[opts.table];

    const selectCols =
      opts.table === 'papic_photos'
        ? `${idColumn}, event_id, r2_object_key, moderation_state, hidden_at, faceblock_baked_at, photo_type`
        : `${idColumn}, event_id, r2_object_key, moderation_state, hidden_at, faceblock_baked_at`;
    const { data: row, error: rowError } = await admin
      .from(opts.table)
      .select(selectCols)
      .eq(idColumn, opts.sourceId)
      .maybeSingle();
    if (rowError || !row) return { baked: false, reason: 'row_not_found' };
    const record = row as unknown as Record<string, unknown>;

    if (record.faceblock_baked_at) {
      return { baked: true, facesFound: -1 }; // already baked — idempotent
    }
    if (record.hidden_at) return { baked: false, reason: 'hidden' };
    if (opts.table === 'papic_photos' && record.photo_type === 'clip') {
      return { baked: false, reason: 'clip' }; // photo collage only (P1 rule)
    }
    if (record.moderation_state !== 'clean') {
      return { baked: false, reason: 'not_clean' }; // only 'clean' projects
    }
    const eventId = record.event_id as string;
    const r2Ref = record.r2_object_key as string | null;
    if (!r2Ref) return { baked: false, reason: 'no_object' };

    // Cheap gates: a FaceBlock guest exists AND the event owns the wall.
    const { count: fbCount } = await admin
      .from('guests')
      .select('guest_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('faceblock_enabled', true)
      .is('deleted_at', null);
    if (!fbCount) return { baked: false, reason: 'no_faceblock_guest' };

    // Ownership reads off orders.status via eventOwnsSku() (PR4 dead-unlock
    // repair, 2026-06-15) — bundle-aware, so a Media Pack buyer's FaceBlock
    // guests still get wall-safe blurred derivatives baked. The old
    // event_software_activations_v2 read had no payment-path writer, so a
    // paid wall never baked. Dynamic import matches this module's lazy-load
    // posture for its heavy static graph.
    const { eventOwnsSku } = await import('@/lib/entitlements');
    const ownsWall = await eventOwnsSku(admin, eventId, 'LIVE_WALL');
    if (!ownsWall) return { baked: false, reason: 'no_live_wall' };

    // Fetch originals back from R2 by the stored ref (same as nsfw-screen).
    const { readR2Object } = await import('@/lib/drive-upload');
    const { R2_BUCKETS, r2Upload } = await import('@/lib/r2');
    const { bucket, key } = parseR2Ref(r2Ref);
    const bytes = await readR2Object(key, bucket ?? R2_BUCKETS.media);

    const bake = await bakeWallSafeJpeg(bytes);

    // Timestamp suffix: a re-bake never collides with a stale CDN-cached
    // object under the same key.
    const safeKey = `${key.replace(/\.[a-z0-9]+$/i, '')}.wallsafe-${Date.now()}.jpg`;
    const safeBucket = (bucket ?? R2_BUCKETS.media) as Parameters<
      typeof r2Upload
    >[0]['bucket'];
    await r2Upload({
      bucket: safeBucket,
      key: safeKey,
      body: bake.jpeg,
      contentType: 'image/jpeg',
    });
    const safeRef = bucket ? `r2://${bucket}/${safeKey}` : safeKey;

    const { error: rpcError } = await admin.rpc('wall_record_bake', {
      p_source_table: opts.table,
      p_source_id: opts.sourceId,
      p_safe_key: safeRef,
      p_faces_found: bake.facesFound,
    });
    if (rpcError) return { baked: false, reason: `rpc:${rpcError.message.slice(0, 60)}` };

    return { baked: true, facesFound: bake.facesFound };
  } catch (err) {
    console.warn(
      `[face-blur] bake skipped (fail-closed, photo stays withheld from wall) — table=${opts.table}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { baked: false, reason: 'error' };
  }
}

/**
 * Bounded re-bake sweep for one event — called via after() when a guest's
 * FaceBlock toggle flips ON. Existing wall tiles go un-baked at that instant
 * (the read path hides them immediately — fail-closed), so this restores the
 * NEWEST tiles as blurred derivatives. Bounded because each bake costs
 * seconds of CPU; older tiles simply stay off the wall.
 */
export async function rebakeWallForEvent(eventId: string, limit = 25): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from('wall_feed')
      .select('source_table, source_id')
      .eq('event_id', eventId)
      .is('wall_hidden_at', null)
      .order('sort_at', { ascending: false })
      .limit(limit);
    for (const row of rows ?? []) {
      await bakeFaceBlurForCapture({
        table: row.source_table as FaceBlurTable,
        sourceId: row.source_id as string,
      });
    }
  } catch (err) {
    console.warn(
      `[face-blur] rebake sweep skipped — event=${eventId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
