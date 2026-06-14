// NSFW / objectionable-content screening engine — iteration 0012 Papic.
//
// Completes Apple guideline 1.2 (UGC: filter + report + block). Report + block
// shipped in PR #1230; this is the FILTER. Corpus hard constraint: "NSFW filter
// is on by default and CANNOT be disabled" — there is intentionally no event-
// level or account-level toggle anywhere in this module.
//
// Architecture (locked for this PR — NO schema changes):
//   * Classifier: nsfwjs (quantized MobileNetV2-mid graph model) on
//     @tensorflow/tfjs with the pure-JS CPU backend. NOT @tensorflow/tfjs-node —
//     native bindings break on Vercel serverless.
//   * Model files are SELF-HOSTED (OSS/self-host preference): committed under
//     apps/web/models/nsfw/ and read with node:fs via a custom tf.io.IOHandler.
//     `outputFileTracingIncludes` in next.config.ts traces them into the
//     serverless bundle. The load is cached module-level so each lambda
//     instance pays the ~4.4 MB model load once.
//   * Decode: sharp (already a dependency, serverExternalPackages) turns the
//     JPEG into a raw 224×224 RGB tensor — no DOM, no canvas.
//   * Verdicts land in the EXISTING `moderation_state` column on both capture
//     tables (migration 20261104000959): 'unscreened' → 'clean' | 'nsfw_blocked'.
//     The UPDATE only matches rows still 'unscreened', so a couple's manual
//     override (moderation page "Approve — show this photo") is never clobbered
//     by a late-finishing background screen.
//   * FAIL-OPEN: on ANY error (model load, R2 fetch, decode, video input) the
//     row stays 'unscreened' — captures are never lost to a classifier hiccup.
//     'unscreened' rows remain visible on guest/public surfaces (the display
//     gates exclude only the explicit *_blocked / *_withheld states); the
//     couple's moderation surface always sees everything.
//
// Heavy imports (tf, nsfwjs, sharp, fs, supabase, r2) are all DYNAMIC so the
// pure decision function below stays importable from node:test (tsx) without a
// server context, and so the model/tf graph never loads on requests that don't
// screen anything.

import type { Tensor3D } from '@tensorflow/tfjs';
import type { NSFWJS } from 'nsfwjs';

// ─────────────────────────────────────────────────────────────────────────
// Decision thresholds (named exports so tests + future tuning reference one
// source of truth). Weddings are full of dancing, gowns, and beachwear —
// "Sexy" alone NEVER blocks; only explicit-content classes do.
// ─────────────────────────────────────────────────────────────────────────

/** Block when the Porn class probability is at or above this. */
export const NSFW_PORN_THRESHOLD = 0.7;
/** Block when the Hentai class probability is at or above this. */
export const NSFW_HENTAI_THRESHOLD = 0.75;
/** Block when Porn + Hentai combined are at or above this. */
export const NSFW_COMBINED_THRESHOLD = 0.8;

export type NsfwDecision = 'clean' | 'nsfw_blocked';

/**
 * Pure decision function over nsfwjs class probabilities
 * {Drawing, Hentai, Neutral, Porn, Sexy}. Missing classes count as 0.
 *
 * Blocks when:  Porn ≥ 0.7  OR  Hentai ≥ 0.75  OR  (Porn + Hentai) ≥ 0.8.
 * "Sexy" alone never blocks (false-positive magnet at weddings).
 */
export function decideNsfw(scores: Record<string, number>): NsfwDecision {
  const porn = scores.Porn ?? 0;
  const hentai = scores.Hentai ?? 0;
  if (porn >= NSFW_PORN_THRESHOLD) return 'nsfw_blocked';
  if (hentai >= NSFW_HENTAI_THRESHOLD) return 'nsfw_blocked';
  if (porn + hentai >= NSFW_COMBINED_THRESHOLD) return 'nsfw_blocked';
  return 'clean';
}

// ─────────────────────────────────────────────────────────────────────────
// Model loading — custom node:fs IOHandler over the committed graph-model
// files, cached module-level so a warm lambda loads once.
// ─────────────────────────────────────────────────────────────────────────

const MODEL_INPUT_SIZE = 224;

let modelPromise: Promise<NSFWJS> | null = null;

async function loadNsfwModel(): Promise<NSFWJS> {
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    const [tf, { NSFWJS: NsfwjsClass }, fs, path] = await Promise.all([
      import('@tensorflow/tfjs'),
      import('nsfwjs'),
      import('node:fs/promises'),
      import('node:path'),
    ]);
    // Pure-JS CPU backend — no WebGL in a lambda, no native bindings.
    await tf.setBackend('cpu');
    await tf.ready();

    const dir = path.join(process.cwd(), 'models', 'nsfw');
    const ioHandler = {
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
          weightSpecs,
          weightData: weightData.buffer,
        };
      },
    };

    const model = new NsfwjsClass(
      // The IOHandler shape matches tf.io.IOHandler; nsfwjs re-exports the
      // same tf types (same @tensorflow/tfjs instance via peerDependency).
      ioHandler as ConstructorParameters<typeof NsfwjsClass>[0],
      { size: MODEL_INPUT_SIZE, type: 'graph' },
    );
    await model.load();
    return model;
  })();
  // A failed load must not poison every later attempt on this instance.
  modelPromise.catch(() => {
    modelPromise = null;
  });
  return modelPromise;
}

/**
 * Classify raw image bytes (any sharp-decodable format). Returns the nsfwjs
 * class-probability map. Throws on undecodable input (caller fail-opens).
 */
export async function classifyImageBytes(
  bytes: Uint8Array,
): Promise<Record<string, number>> {
  const [tf, { default: sharp }, model] = await Promise.all([
    import('@tensorflow/tfjs'),
    import('sharp'),
    loadNsfwModel(),
  ]);
  const raw = await sharp(Buffer.from(bytes))
    .resize(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer();
  const tensor = tf.tensor3d(
    new Int32Array(raw),
    [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3],
    'int32',
  ) as Tensor3D;
  try {
    const predictions = await model.classify(tensor, 5);
    const scores: Record<string, number> = {};
    for (const p of predictions) scores[p.className] = p.probability;
    return scores;
  } finally {
    tensor.dispose();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// screenCapture — the background hook (called from after()).
// ─────────────────────────────────────────────────────────────────────────

export type ScreenCaptureTable = 'papic_guest_captures' | 'papic_photos';

const TABLE_ID_COLUMN: Record<ScreenCaptureTable, string> = {
  papic_guest_captures: 'capture_id',
  papic_photos: 'photo_id',
};

/** Parse a stored `r2://<bucket>/<key>` ref into bucket + bare key. */
function parseR2Ref(ref: string): { bucket: string | null; key: string } {
  const match = /^r2:\/\/([^/]+)\/(.+)$/.exec(ref);
  if (!match) return { bucket: null, key: ref };
  return { bucket: match[1] ?? null, key: match[2] ?? ref };
}

/**
 * Screen one capture and persist the verdict.
 *
 * 1. Confirms the row exists and is still 'unscreened'.
 * 2. Classifies the bytes (provided, or fetched back from R2 by the stored
 *    `r2://bucket/key` ref). VIDEO CLIPS (papic_photos.photo_type='clip')
 *    are classified by their POSTER FRAME (poster_r2_key — one JPEG the
 *    client extracted at capture time); nsfwjs is image-only and the lambda
 *    has no ffmpeg, so the poster is the clip's screening proxy. A clip with
 *    no poster (legacy rows, extraction failure) stays 'unscreened' — every
 *    guest-facing surface excludes clips structurally, so it never projects.
 * 3. UPDATEs moderation_state ONLY where it is still 'unscreened' — never
 *    clobbers a couple's override or a concurrent consent/faceblock verdict.
 *
 * FAIL-OPEN: any error leaves the row 'unscreened' with one console.warn.
 * Never throws — safe to fire-and-forget from after().
 */
export async function screenCapture(opts: {
  table: ScreenCaptureTable;
  r2ObjectKey: string;
  bytes?: Uint8Array;
}): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const idColumn = TABLE_ID_COLUMN[opts.table];

    const selectCols =
      opts.table === 'papic_photos'
        ? `${idColumn}, moderation_state, photo_type`
        : `${idColumn}, moderation_state`;
    const { data: row, error: rowError } = await admin
      .from(opts.table)
      .select(selectCols)
      .eq('r2_object_key', opts.r2ObjectKey)
      .maybeSingle();
    if (rowError || !row) return; // row gone / pre-migration env — nothing to do
    const record = row as unknown as Record<string, unknown>;
    if (record.moderation_state !== 'unscreened') return; // already decided

    // Clips: swap the classification target to the poster frame. Queried
    // separately (not in selectCols) so an env without the poster_r2_key
    // migration degrades to clip-skip without disturbing the photo path.
    let classifyRef = opts.r2ObjectKey;
    let bytes = opts.bytes;
    if (opts.table === 'papic_photos' && record.photo_type === 'clip') {
      const { data: posterRow, error: posterError } = await admin
        .from('papic_photos')
        .select('poster_r2_key')
        .eq('r2_object_key', opts.r2ObjectKey)
        .maybeSingle();
      const posterRef =
        !posterError && typeof posterRow?.poster_r2_key === 'string'
          ? posterRow.poster_r2_key.trim()
          : '';
      if (!posterRef) return; // no poster → clip stays 'unscreened' (guest surfaces exclude clips)
      classifyRef = posterRef;
      bytes = undefined; // opts.bytes would be the VIDEO bytes — never classify those
    }

    if (!bytes) {
      const { readR2Object } = await import('@/lib/drive-upload');
      const { R2_BUCKETS } = await import('@/lib/r2');
      const { bucket, key } = parseR2Ref(classifyRef);
      bytes = await readR2Object(key, bucket ?? R2_BUCKETS.media);
    }

    const scores = await classifyImageBytes(bytes);
    const decision = decideNsfw(scores);

    // Persist — but only over 'unscreened'. A couple override (or any other
    // concurrent verdict) wins over this background result.
    await admin
      .from(opts.table)
      .update({ moderation_state: decision })
      .eq('r2_object_key', opts.r2ObjectKey)
      .eq('moderation_state', 'unscreened');
  } catch (err) {
    console.warn(
      `[nsfw-screen] screening skipped (fail-open, row stays unscreened) — table=${opts.table}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
