import 'server-only';
import sharp from 'sharp';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseStoredAsset } from '@/lib/uploads';
import { getR2Client, r2Upload } from '@/lib/r2';
import {
  asPapicFidelityTier,
  fidelityIngestParams,
  DEFAULT_PAPIC_FIDELITY,
  type PapicFidelityTier,
} from '@/lib/papic-fidelity';

/**
 * Papic ingest-fidelity seam — the READ half of brief PR-4's one-column
 * contract (`events.papic_quality_tier`; the setup surface writes it, THIS
 * module reads it).
 *
 * When the couple picked a downscaling tier (optimal / high_efficiency), the
 * capture ingest replaces the just-uploaded R2 original of a STILL photo with
 * a long-edge-capped JPEG, in place (same bucket + key, so every stored
 * `r2://` ref stays valid). From that moment the tiered copy IS the original —
 * derivatives, Drive sync, downloads, and the gallery all flow from it.
 *
 * Invariants:
 *   • full_res / absent / legacy / pre-migration → NO processing at all —
 *     byte-for-byte today's behavior (the migration default is inert).
 *   • Only ever DOWNSCALES: a photo already within the tier's long-edge cap is
 *     left verbatim (no upscale, no pointless second lossy pass — the
 *     one-compression-pass rule).
 *   • STILLS ONLY — callers never pass clip video bytes (no server ffmpeg);
 *     the clip poster is an already-compressed still and is left alone too.
 *   • EXIF (incl. GPS) is retained on the replaced R2 original via
 *     `.withMetadata()` — the corpus guarantee is "geo is stripped on OUTBOUND
 *     shares; the original on R2 retains it". Orientation is baked first by
 *     `.rotate()`, and sharp rewrites the orientation tag accordingly.
 *   • Best-effort, NEVER throws (same contract as papic-derivatives.ts): any
 *     failure leaves the full-res original in place — a graceful upgrade, not
 *     a data loss.
 */

export type IngestFidelityOutcome =
  | 'skipped' /* tier stores verbatim, or the ref/bytes were unusable */
  | 'within_tier' /* already at/below the cap — stored verbatim */
  | 'downscaled'; /* original replaced in place with the tiered copy */

/**
 * Read the event's fidelity tier — defensively. A pre-migration env (column
 * absent → PostgREST error), a missing row, or an unexpected value all resolve
 * to the default tier (full_res = today's behavior). Never throws.
 */
export async function readEventFidelityTier(
  eventId: string,
): Promise<PapicFidelityTier> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('events')
      .select('papic_quality_tier')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) return DEFAULT_PAPIC_FIDELITY;
    return asPapicFidelityTier(
      (data as { papic_quality_tier?: string } | null)?.papic_quality_tier,
    );
  } catch {
    return DEFAULT_PAPIC_FIDELITY;
  }
}

/**
 * Apply a fidelity tier to a still photo's R2 original, in place. See the
 * module header for the invariants. Returns what happened (for tests/logs);
 * callers may ignore the result.
 */
export async function applyIngestFidelity(
  originalRef: string,
  tier: PapicFidelityTier,
): Promise<IngestFidelityOutcome> {
  const params = fidelityIngestParams(tier);
  if (params.maxLongEdgePx === null) return 'skipped';

  try {
    const parsed = parseStoredAsset(originalRef);
    if (!parsed || parsed.kind !== 'r2') return 'skipped';
    const client = getR2Client();
    if (!client) return 'skipped';

    const res = await client.send(
      new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
    );
    const body = res.Body as unknown as {
      transformToByteArray?: () => Promise<Uint8Array>;
    } | null;
    if (!body || typeof body.transformToByteArray !== 'function') {
      return 'skipped';
    }
    const bytes = await body.transformToByteArray();

    // Long edge is rotation-invariant (max of the two axes), so the raw
    // pre-rotation dimensions are safe to compare against the cap.
    const meta = await sharp(bytes).metadata();
    const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (!longEdge) return 'skipped';
    if (longEdge <= params.maxLongEdgePx) return 'within_tier';

    const tiered = await sharp(bytes)
      .rotate() // bake EXIF orientation into pixels before the resize
      .resize({
        width: params.maxLongEdgePx,
        height: params.maxLongEdgePx,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: params.jpegQuality })
      // Retain EXIF (incl. GPS) on the stored original — the corpus strips geo
      // on OUTBOUND paths only (stripPhotoMetadata), never on the R2 original.
      .withMetadata()
      .toBuffer();

    await r2Upload({
      bucket: parsed.bucket,
      key: parsed.key,
      body: tiered,
      contentType: 'image/jpeg',
    });
    return 'downscaled';
  } catch (err) {
    console.warn(
      `[papic-ingest-fidelity] tier apply skipped (best-effort) — tier=${tier} ref=${originalRef.slice(0, 96)}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 'skipped';
  }
}

/**
 * One-call seam helper for the capture ingest paths: resolve the event's tier
 * from `events.papic_quality_tier` and apply it to the still's R2 original.
 * Best-effort, never throws. Call BEFORE derivative generation so display /
 * thumb / Drive / downloads all derive from the tiered original.
 */
export async function applyEventFidelityToOriginal(
  eventId: string,
  originalRef: string,
): Promise<IngestFidelityOutcome> {
  const tier = await readEventFidelityTier(eventId);
  return applyIngestFidelity(originalRef, tier);
}
