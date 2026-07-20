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

// ============================================================================
// Drive-aware defer guard (Papic_Build_Brief_2026-07-17.md ruling #4 — MANDATORY)
//
// The age + web-copy guards above only prove the GALLERY survives the drop.
// They say nothing about the couple's FULL-RES second copy. The retention model
// is "we drop our R2 original because the couple's Google Drive holds the
// full-res" — so if the couple pointed a Drive at this event and that Drive copy
// is queued / retrying / failed / missing, deleting our original leaves the
// full-res original NOWHERE. Unrecoverable.
//
// So: when Drive is in play, a photo may only be dropped once its high-res Drive
// copy is CONFIRMED. Everything else DEFERS (skip, keep, retry next sweep).
//
// ⚠ FAIL SAFE: a read failure must never authorize a deletion. If the Drive
// state can't be read, or is ambiguous, the state is `unknown` and EVERY photo
// for that event defers. Deleting is the irreversible branch; deferring costs
// storage for a week.
// ============================================================================

/** What we know about an event's Drive-side full-res copy. */
export type DriveCopyState =
  /** The couple never pointed a Drive at this event → guard is a no-op. */
  | { kind: 'not_connected' }
  /** Drive is in play; these r2 keys have a CONFIRMED high-res copy on it. */
  | { kind: 'connected'; confirmedKeys: ReadonlySet<string> }
  /** Read failed / ambiguous → defer everything (never delete on ignorance). */
  | { kind: 'unknown'; reason: string };

/**
 * One copy-tracking row, shaped to cover BOTH Drive tables:
 *   • drive_copy_artifacts    (universal copy layer — has copied_high_res)
 *   • photo_delivery_artifacts (0009 manual "Release to Drive" — no such column;
 *     it uploads the ORIGINAL r2_object_key bytes, so absent = high-res).
 * `drive_file_id` is the repo's canonical "this file is on the couple's Drive"
 * predicate (see runDriveCopyBatch/markUploaded + the release-worker dedup).
 */
export type DriveArtifactRow = {
  r2_object_key: string | null;
  drive_file_id: string | null;
  copied_high_res?: boolean | null;
};

/**
 * Is this row a CONFIRMED high-res Drive copy? Deliberately strict — anything
 * short of "the bytes are on the couple's Drive, at full res" is a NO:
 *   • no drive_file_id → queued, retrying, failed, or retry-capped → NOT copied;
 *   • copied_high_res === false → a post-compression copy, i.e. the full-res
 *     original is NOT on Drive → dropping ours would lose it.
 */
export function isDriveCopyConfirmed(row: DriveArtifactRow): boolean {
  if (!row.r2_object_key) return false;
  if (!row.drive_file_id) return false;
  if (row.copied_high_res === false) return false;
  return true;
}

/** Collect the confirmed keys out of a mixed batch of copy-tracking rows. */
export function confirmedDriveKeys(rows: readonly DriveArtifactRow[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    if (isDriveCopyConfirmed(row)) keys.add(row.r2_object_key as string);
  }
  return keys;
}

/**
 * THE guard. `true` = DEFER (keep our original this sweep). Pure so the sweep
 * and its test share one definition.
 *   • Drive not connected → false (unchanged pre-guard behaviour);
 *   • Drive connected + copy confirmed → false (safe to drop, two copies exist);
 *   • Drive connected + copy queued/failed/missing → true (DEFER);
 *   • Drive state unknown → true (DEFER — a read failure must never authorize
 *     a deletion).
 */
export function isDriveDeferred(r2ObjectKey: string, state: DriveCopyState): boolean {
  switch (state.kind) {
    case 'not_connected':
      return false;
    case 'connected':
      return !state.confirmedKeys.has(r2ObjectKey);
    case 'unknown':
      return true;
    default:
      // Unreachable today, but an unrecognised state is ignorance → defer.
      return true;
  }
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
