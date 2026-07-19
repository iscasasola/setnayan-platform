// Pure, dependency-free core for the 3-month full-res drop (no `server-only`,
// so it's unit-testable). The sweep in papic-fullres-drop.ts uses these.

// Type-only import (erased at runtime) so this stays a pure module — importing
// the R2_BUCKETS *value* would pull in r2.ts's `server-only` + AWS SDK and make
// this untestable. Bucket names are mirrored as literals below.
import type { R2BucketName } from '@/lib/r2';

/** Free full-res window before OUR R2 original is dropped (owner 2026-07-11). */
export const DEFAULT_FULL_RES_RETENTION_DAYS = 90;

const MS_PER_DAY = 86_400_000;

// Mirror of R2_BUCKETS (lib/r2.ts) — kept as literals so this module is pure. If
// a bucket name ever changes there, update here (a drift guard test could pin it).
const MEDIA_BUCKET: R2BucketName = 'setnayan-media';
const KNOWN_BUCKETS: readonly string[] = [
  'setnayan-media',
  'setnayan-thread-files',
  'setnayan-vendor-contracts',
  'setnayan-samples',
  'setnayan-vendor-verification',
];

export type DropCandidate = {
  r2_object_key: string;
  display_r2_key: string | null;
  captured_at: string;
  full_res_dropped_at: string | null;
};

/**
 * Is this capture eligible to have OUR R2 full-res original dropped? Pure, so the
 * sweep and its test share one definition. Photo/clip filtering happens in the
 * QUERY (clips are excluded entirely — their r2_object_key is the video). The
 * guards here are the safety net that makes a wrong delete impossible:
 *   • already dropped → skip (idempotent);
 *   • NO web copy (display_r2_key null) → skip — dropping would LOSE the photo;
 *   • a `sample/...` key → skip — never touch seed/demo data;
 *   • younger than the retention window → skip.
 * The couple's Drive copy is never involved here (this only decides OUR R2 copy).
 */
export function isEligibleForDrop(
  row: DropCandidate,
  opts: { retentionDays: number; nowMs: number },
): boolean {
  if (row.full_res_dropped_at) return false;
  if (!row.display_r2_key) return false;
  if (!row.r2_object_key || row.r2_object_key.startsWith('sample/')) return false;
  const capturedMs = new Date(row.captured_at).getTime();
  if (!Number.isFinite(capturedMs)) return false;
  const ageDays = (opts.nowMs - capturedMs) / MS_PER_DAY;
  return ageDays >= opts.retentionDays;
}

/**
 * Resolve r2_object_key → {bucket, key} for deletion. Legacy raw keys live in the
 * `media` bucket (where papic originals upload); an `r2://bucket/key` ref carries
 * its own bucket. Returns null for anything we can't cleanly resolve — the sweep
 * then declines to delete (never delete blindly).
 */
export function resolveOriginalRef(
  r2ObjectKey: string,
): { bucket: R2BucketName; key: string } | null {
  if (!r2ObjectKey) return null;
  if (r2ObjectKey.startsWith('r2://')) {
    const rest = r2ObjectKey.slice('r2://'.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) return null;
    const bucket = rest.slice(0, slash);
    const key = rest.slice(slash + 1);
    return KNOWN_BUCKETS.includes(bucket) && key
      ? { bucket: bucket as R2BucketName, key }
      : null;
  }
  return { bucket: MEDIA_BUCKET, key: r2ObjectKey };
}
