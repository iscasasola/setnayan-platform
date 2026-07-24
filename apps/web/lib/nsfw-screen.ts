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
export function parseR2Ref(ref: string): { bucket: string | null; key: string } {
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

    // papic_photos flags clips via photo_type; papic_guest_captures via
    // media_type (Option A — guest-recorded clips). Both are the screen's signal
    // to classify the POSTER frame, not the video bytes.
    const selectCols =
      opts.table === 'papic_photos'
        ? `${idColumn}, moderation_state, photo_type`
        : `${idColumn}, moderation_state, media_type`;
    let row: Record<string, unknown> | null = null;
    {
      const { data, error: rowError } = await admin
        .from(opts.table)
        .select(selectCols)
        .eq('r2_object_key', opts.r2ObjectKey)
        .maybeSingle();
      if (rowError) {
        // A pre-migration guest-captures env (no media_type column) fails the
        // select — retry without it so the photo path still screens. Clips on
        // that env stay 'unscreened' (excluded from guest surfaces) until the
        // migration lands.
        if (opts.table === 'papic_guest_captures') {
          const { data: retry } = await admin
            .from(opts.table)
            .select(`${idColumn}, moderation_state`)
            .eq('r2_object_key', opts.r2ObjectKey)
            .maybeSingle();
          row = (retry as Record<string, unknown> | null) ?? null;
        }
      } else {
        row = (data as Record<string, unknown> | null) ?? null;
      }
    }
    if (!row) return; // row gone / pre-migration env — nothing to do
    const record = row;
    if (record.moderation_state !== 'unscreened') return; // already decided

    // Clips: swap the classification target to the poster frame. Queried
    // separately (not in selectCols) so an env without the poster_r2_key
    // migration degrades to clip-skip without disturbing the photo path.
    let classifyRef = opts.r2ObjectKey;
    let bytes = opts.bytes;
    const isClip =
      (opts.table === 'papic_photos' && record.photo_type === 'clip') ||
      (opts.table === 'papic_guest_captures' && record.media_type === 'clip');
    if (isClip) {
      const { data: posterRow, error: posterError } = await admin
        .from(opts.table)
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

// Re-screen grace + bound. The grace keeps a freshly-captured row (whose
// first screenCapture may still be in flight) out of the sweep; the limit
// keeps each opportunistic pass cheap.
const RESCREEN_GRACE_MS = 15 * 60_000; // 15 min
const RESCREEN_LIMIT = 10; // per table, per sweep

/**
 * Heal captures stuck in 'unscreened'. screenCapture() runs fail-open AND
 * fire-and-forget from the capture after() hook — so if it drops (an R2 hiccup,
 * a cold lambda, a killed request) the row stays 'unscreened' FOREVER. That row
 * is then permanently invisible on every guest-facing allowlist surface
 * (guest-live-gallery + the Live Wall show only moderation_state='clean') even
 * though the couple's own private gallery still shows it — a silent screening
 * gap, not just a tag-leg issue. This bounded, never-throwing, cron-free sweep
 * re-runs the screen on rows 'unscreened' past the grace window, across BOTH
 * capture tables. screenCapture re-fetches the bytes from R2, re-decides, and
 * writes ONLY where still 'unscreened' — fully idempotent + safe to re-run.
 * Fire from after() on a Papic surface. Returns how many rows it re-screened.
 */
export async function reScreenStuckCaptures(eventId: string): Promise<number> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - RESCREEN_GRACE_MS).toISOString();
    const tables: ScreenCaptureTable[] = ['papic_photos', 'papic_guest_captures'];
    let healed = 0;
    for (const table of tables) {
      // Exclude poster-LESS clips: screenCapture() classifies a clip by its
      // poster frame and BAILS without writing state when there's no poster, so
      // such rows sit 'unscreened' forever. In a fixed RESCREEN_LIMIT window with
      // no order they'd re-fill it every run and starve genuinely-screenable
      // photos (which then stay dark on every guest surface). Keep a row iff it's
      // NOT a clip OR it has a poster; order oldest-first so the window advances.
      const clipCol = table === 'papic_photos' ? 'photo_type' : 'media_type';
      const { data: stuck, error } = await admin
        .from(table)
        .select('r2_object_key')
        .eq('event_id', eventId)
        .eq('moderation_state', 'unscreened')
        .lt('created_at', cutoff)
        .or(`${clipCol}.is.null,${clipCol}.neq.clip,poster_r2_key.not.is.null`)
        .order('created_at', { ascending: true })
        .limit(RESCREEN_LIMIT);
      // Pre-migration (missing column → 42703) or any read error → skip this
      // table, never the whole sweep.
      if (error || !stuck || stuck.length === 0) continue;
      for (const row of stuck) {
        const key = (row as { r2_object_key: string | null }).r2_object_key;
        if (!key) continue;
        await screenCapture({ table, r2ObjectKey: key });
        healed += 1;
      }
    }
    return healed;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Periodic GLOBAL heal — reScreenAllStuckCaptures.
//
// reScreenStuckCaptures() above is only fired from TWO after() sites, and both
// are COUPLE-SIDE (the Papic moderation page + the Life-Flash account page). So
// if a capture's first screenCapture() drops (fail-open leaves it 'unscreened')
// AND no couple ever opens either page, the row stays 'unscreened' FOREVER —
// permanently dark on every guest-facing allowlist surface (guest-live-gallery
// + Live Wall show only moderation_state='clean'), a safe photo lost to a screen
// hiccup with nothing to heal it. Guest surfaces fail CLOSED, so this is bounded
// (an unscreened row never *projects*) but it never self-heals absent a couple.
//
// This sweep closes the hole WITHOUT a couple visit: it discovers the events
// that still have grace-aged 'unscreened' captures and re-runs the existing
// per-event heal on each. It is fired cron-free from admin traffic (the central
// periodic-job site, alongside the Papic full-res drop that works these same
// tables) via maybeRunPapicNsfwRescreen() — see lib/papic-nsfw-rescreen-sweep.ts.
// ─────────────────────────────────────────────────────────────────────────

/** Cap on events healed per global sweep — keeps one opportunistic pass cheap;
 *  a larger backlog drains over successive sweeps (fully idempotent). */
export const RESCREEN_SWEEP_MAX_EVENTS = 25;
/** Rows scanned per table when discovering stuck events (partial-index-backed). */
const RESCREEN_SWEEP_SCAN_LIMIT = 500;

/**
 * PURE: from raw (event_id, created_at) capture rows, pick the DISTINCT events
 * that have at least one capture older than the grace window — deduped,
 * oldest-first (input order preserved), capped at maxEvents. Extracting the
 * selection keeps the grace-window guard unit-testable without a DB: a row only
 * seconds old (its first screen may still be in flight) must NOT pull its event
 * into the sweep, so we never fight a normal async screen that's still running.
 */
export function selectStuckEventIds(
  rows: ReadonlyArray<{ event_id?: string | null; created_at?: string | null }>,
  opts: { nowMs: number; graceMs: number; maxEvents: number },
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const eventId = row.event_id;
    if (typeof eventId !== 'string' || eventId.length === 0) continue;
    if (seen.has(eventId)) continue;
    const createdMs = row.created_at ? Date.parse(row.created_at) : NaN;
    if (!Number.isFinite(createdMs)) continue; // unparseable timestamp → skip (never sweep blind)
    // Strictly older than the grace window — matches the DB discovery query's
    // `.lt('created_at', now - graceMs)`, so a row exactly at the edge (or newer,
    // its first screen possibly still in flight) is NOT swept.
    if (opts.nowMs - createdMs <= opts.graceMs) continue;
    seen.add(eventId);
    out.push(eventId);
    if (out.length >= opts.maxEvents) break;
  }
  return out;
}

/**
 * GLOBAL cron-free heal. Discovers every Papic event that still has a grace-aged
 * 'unscreened' capture (across BOTH capture tables), then runs the existing
 * per-event reScreenStuckCaptures on each. Bounded (RESCREEN_SWEEP_MAX_EVENTS)
 * and never-throwing; the discovery query is served by a partial index over the
 * transient 'unscreened' set (migration `papic_captures_unscreened_sweep_idx`).
 * The per-event heal is idempotent (UPDATEs only rows still 'unscreened'), so
 * this is safe to re-run and safe to race the couple-side after() sites.
 * Returns how many events it swept.
 */
export async function reScreenAllStuckCaptures(): Promise<number> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const nowMs = Date.now();
    const cutoff = new Date(nowMs - RESCREEN_GRACE_MS).toISOString();
    const tables: ScreenCaptureTable[] = ['papic_photos', 'papic_guest_captures'];
    const rows: Array<{ event_id?: string | null; created_at?: string | null }> = [];
    for (const table of tables) {
      // Same poster-less-clip exclusion as reScreenStuckCaptures — otherwise an
      // event whose ONLY unscreened rows are unscreenable clips looks "stuck"
      // forever and this sweep re-picks it every run for a no-op per-event heal.
      const clipCol = table === 'papic_photos' ? 'photo_type' : 'media_type';
      const { data, error } = await admin
        .from(table)
        .select('event_id, created_at')
        .eq('moderation_state', 'unscreened')
        .lt('created_at', cutoff)
        .or(`${clipCol}.is.null,${clipCol}.neq.clip,poster_r2_key.not.is.null`)
        .order('created_at', { ascending: true })
        .limit(RESCREEN_SWEEP_SCAN_LIMIT);
      // Pre-migration (missing column → 42703) or any read error → skip this
      // table, never the whole sweep.
      if (error || !data) continue;
      rows.push(
        ...(data as Array<{ event_id?: string | null; created_at?: string | null }>),
      );
    }
    const eventIds = selectStuckEventIds(rows, {
      nowMs,
      graceMs: RESCREEN_GRACE_MS,
      maxEvents: RESCREEN_SWEEP_MAX_EVENTS,
    });
    let swept = 0;
    for (const eventId of eventIds) {
      await reScreenStuckCaptures(eventId);
      swept += 1;
    }
    return swept;
  } catch {
    return 0;
  }
}

/**
 * Screen one editorial_vendor_media row (the "From Your Vendors" submissions)
 * and persist the verdict. Mirrors screenCapture() but for the editorial table,
 * which is keyed by `media_id` and screened by its `still_r2_key` JPEG — the
 * photo itself OR a clip's freeze-still (nsfwjs is image-only, so the still is
 * the screening proxy for both photo and clip submissions).
 *
 * Same value-set + UPDATE-only-over-'unscreened' guarantee as screenCapture.
 * FAIL-OPEN: any error leaves the row 'unscreened' (one console.warn). Never
 * throws — safe to fire-and-forget from after(). The PUBLIC editorial render
 * excludes 'unscreened' for vendor media (fail-CLOSED on the public surface),
 * so an unscreened row simply doesn't show until the verdict lands.
 */
export async function screenEditorialVendorMedia(opts: {
  mediaId: string;
  stillR2Key: string;
}): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const { data: row, error: rowError } = await admin
      .from('editorial_vendor_media')
      .select('media_id, moderation_state')
      .eq('media_id', opts.mediaId)
      .maybeSingle();
    if (rowError || !row) return; // row gone / pre-migration env
    if ((row as Record<string, unknown>).moderation_state !== 'unscreened') return;

    const { readR2Object } = await import('@/lib/drive-upload');
    const { R2_BUCKETS } = await import('@/lib/r2');
    const { bucket, key } = parseR2Ref(opts.stillR2Key);
    const bytes = await readR2Object(key, bucket ?? R2_BUCKETS.media);

    const scores = await classifyImageBytes(bytes);
    const decision = decideNsfw(scores);

    await admin
      .from('editorial_vendor_media')
      .update({ moderation_state: decision })
      .eq('media_id', opts.mediaId)
      .eq('moderation_state', 'unscreened');
  } catch (err) {
    console.warn(
      `[nsfw-screen] editorial vendor media screening skipped (fail-open) — media_id=${opts.mediaId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// screenStdVideo — the Save-the-Date "video island" gate (iteration 0024).
//
// The couple may close their STD film on an uploaded video. Per the platform
// NSFW lock ("on by default and CANNOT be disabled") a video plays on the
// PUBLIC /[slug] page ONLY when events.std_media.nsfw === 'approved'
// (stdVideoIsLive). This screens it.
//
// nsfwjs is image-only and the lambda has no ffmpeg, so — exactly like a Papic
// clip — the video is screened by its POSTER FRAME: one JPEG the browser
// extracted at upload time (std_media.posterKey). No poster ⇒ the screen can't
// run and the video stays 'pending' (never goes live — fail-CLOSED on the
// public surface, the gallery shows instead).
//
// Verdict mapping: 'clean' → 'approved' (goes live) · 'nsfw_blocked' →
// 'rejected' (never live). FAIL-OPEN on any error: the row stays 'pending'
// (the couple can re-render to retry; an admin can approve manually later).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Screen one Save-the-Date video by its poster frame and persist the verdict
 * to events.std_media.nsfw. Safe to fire-and-forget from after().
 *
 * The verdict is written ONLY when the row is still the same pending video
 * (same videoKey, nsfw==='pending') — so a late-finishing screen never
 * approves a video the couple has since replaced or switched away from.
 */
export async function screenStdVideo(opts: {
  eventId: string;
  /** The video this screen is for — guards against approving a superseded upload. */
  videoKey: string;
  /** R2 ref of the client-extracted poster frame to classify. */
  posterR2Key: string;
}): Promise<void> {
  try {
    if (!opts.posterR2Key) return; // no poster → leave 'pending' (won't go live)
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const { resolveStdMedia } = await import('@/lib/std-media');
    const admin = createAdminClient();

    const { data: row, error: rowError } = await admin
      .from('events')
      .select('std_media')
      .eq('event_id', opts.eventId)
      .maybeSingle();
    if (rowError || !row) return; // event gone / pre-migration env
    const media = resolveStdMedia((row as Record<string, unknown>).std_media);
    // Only screen the still-pending video this call was fired for.
    if (
      media.type !== 'video' ||
      media.videoKey !== opts.videoKey ||
      media.nsfw !== 'pending'
    ) {
      return;
    }

    const { readR2Object } = await import('@/lib/drive-upload');
    const { R2_BUCKETS } = await import('@/lib/r2');
    const { bucket, key } = parseR2Ref(opts.posterR2Key);
    const bytes = await readR2Object(key, bucket ?? R2_BUCKETS.media);

    const scores = await classifyImageBytes(bytes);
    const decision = decideNsfw(scores);
    const nsfw = decision === 'clean' ? 'approved' : 'rejected';

    // Persist — re-checking it's still the same pending video right before the
    // write keeps the verdict from racing a couple's concurrent change.
    const { data: fresh } = await admin
      .from('events')
      .select('std_media')
      .eq('event_id', opts.eventId)
      .maybeSingle();
    const freshMedia = resolveStdMedia((fresh as Record<string, unknown> | null)?.std_media);
    if (
      freshMedia.type !== 'video' ||
      freshMedia.videoKey !== opts.videoKey ||
      freshMedia.nsfw !== 'pending'
    ) {
      return;
    }
    await admin
      .from('events')
      .update({ std_media: { ...freshMedia, nsfw } })
      .eq('event_id', opts.eventId);
  } catch (err) {
    console.warn(
      `[nsfw-screen] STD video screening skipped (fail-open, stays pending) — event_id=${opts.eventId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
