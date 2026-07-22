// Pure, dependency-free core for the 3-month full-res drop (no `server-only`,
// so it's unit-testable). The sweep in papic-fullres-drop.ts uses these.

// Type-only import (erased at runtime) so this stays a pure module — importing
// the R2_BUCKETS *value* would pull in r2.ts's `server-only` + AWS SDK and make
// this untestable. Bucket names are mirrored as literals below.
import type { R2BucketName, R2HeadResult } from '@/lib/r2';
// Pure, dependency-free helpers (no `server-only`) — safe to import here.
import { clipWebKeyDistinct, isClipRow } from '@/lib/papic-display-ref';

/** Free full-res window before OUR R2 original is dropped (owner 2026-07-11). */
export const DEFAULT_FULL_RES_RETENTION_DAYS = 90;

/**
 * A clip's web copy must have EXISTED for at least this long before its raw is
 * droppable (Papic storage · retention-lapse fresh-grace). Measured against the
 * R2 object's real LastModified — NOT a DB column, so a truncated/bad backfill
 * transcode PUT today cannot convert straight to raw loss even if the age fuse
 * (captured_at) has already elapsed (the backfill case). New capture-time web
 * copies are contemporaneous with the raw, so this is satisfied long before the
 * 90-day fuse ever fires.
 */
export const CLIP_WEB_DROP_GRACE_DAYS = 7;

/**
 * Byte floor for a clip web copy to count as a real playable derivative. Mirrors
 * MIN_CLIP_WEB_BYTES on the capture path (guest-capture route). A sub-floor
 * `clip_web_bytes` — or a HEAD size below it — means the web copy is not a real
 * object → refuse to drop the raw.
 */
export const CLIP_WEB_MIN_BYTES = 1024;

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
// CLIP full-res drop (Papic storage PR-2 — the cost win). A clip's raw video
// r2_object_key is ~2× the bytes of a 10s photo-equivalent and, unlike a photo,
// its `display_r2_key` is a POSTER STILL (an image), not a playable fallback. So
// clips CANNOT reuse isEligibleForDrop:
//   • isEligibleForDrop's `!display_r2_key → skip` guard would PASS for every
//     clip (poster is always present) and delete the ~8 MB motion clip while
//     only a still survives — the "poster trap".
// A clip's raw is droppable ONLY once a DISTINCT, real, HEAD-verified playable
// web copy (clip_web_r2_key) exists AND the couple's Drive custody clears (Guard
// B, in the sweep) AND a fresh-grace window has elapsed on the web object.
// ============================================================================

export type ClipDropCandidate = {
  /** papic_photos.photo_type — must be 'clip'. */
  photo_type?: string | null;
  /** papic_guest_captures.media_type — must be 'clip'. */
  media_type?: string | null;
  /** The raw video — the ONLY key this drop ever deletes. */
  r2_object_key: string | null;
  /** The poster still (display==poster for clips) — kept forever, never dropped. */
  poster_r2_key: string | null;
  display_r2_key: string | null;
  /** The small playable web copy — kept forever; its object is the custody proof. */
  clip_web_r2_key: string | null;
  /** The web copy's real object size, persisted at upload. */
  clip_web_bytes: number | null;
  captured_at: string;
  full_res_dropped_at: string | null;
};

/**
 * COLUMN-LEVEL eligibility to drop a CLIP's raw video. Pure — the OBJECT custody
 * proof (HEAD: exists / size matches / content-type video/* / grace age) is a
 * separate async step (clipWebCopyCustodyOk) because it needs R2. A wrong `true`
 * here would delete a motion clip leaving only a still, so every guard is a hard
 * gate:
 *   • already dropped → false (idempotent);
 *   • not a clip → false (photos use isEligibleForDrop — never cross the streams);
 *   • NO web copy (clip_web_r2_key null) → false. THIS is what keeps every
 *     existing / un-backfilled clip safe: before the deferred backfill (PR-3)
 *     writes web copies, every legacy clip has a null key and is INELIGIBLE;
 *   • web key not DISTINCT from poster / display / raw → false (poster-trap: a
 *     poster masquerading as the web copy would let the drop delete the still a
 *     play surface points at);
 *   • clip_web_bytes absent or below the floor → false (the HEAD size custody
 *     check depends on a real persisted size);
 *   • raw key absent or a `sample/…` seed key → false;
 *   • younger than the retention window → false.
 */
export function clipEligibleForDrop(
  row: ClipDropCandidate,
  opts: { retentionDays: number; nowMs: number },
): boolean {
  if (row.full_res_dropped_at) return false;
  if (!isClipRow(row)) return false;
  if (!row.r2_object_key || row.r2_object_key.startsWith('sample/')) return false;
  // Web copy must exist AND be a DISTINCT object from the poster/display still and
  // the raw video (clipWebKeyDistinct requires a non-empty key ≠ all three).
  if (
    !clipWebKeyDistinct(row.clip_web_r2_key, {
      poster_r2_key: row.poster_r2_key,
      display_r2_key: row.display_r2_key,
      r2_object_key: row.r2_object_key,
    })
  ) {
    return false;
  }
  // A real, persisted web-copy size at/above the floor. (Custody HEAD re-checks
  // the live object matches this exactly.) Coerce defensively — a bigint column
  // could arrive as a numeric string; a null/undefined/non-numeric value → NaN →
  // fail-closed (INELIGIBLE), never a drop.
  const bytes = row.clip_web_bytes == null ? Number.NaN : Number(row.clip_web_bytes);
  if (!Number.isFinite(bytes) || bytes < CLIP_WEB_MIN_BYTES) {
    return false;
  }
  const capturedMs = new Date(row.captured_at).getTime();
  if (!Number.isFinite(capturedMs)) return false;
  const ageDays = (opts.nowMs - capturedMs) / MS_PER_DAY;
  return ageDays >= opts.retentionDays;
}

/**
 * OBJECT-LEVEL custody proof for a clip web copy — the last gate before an
 * irreversible raw delete. Pure: the sweep does the r2Head() I/O, then this
 * decides. `true` ONLY when the live web object is proven durable AND aged:
 *   • the HEAD succeeded (a null head = missing / 403 / network → NEVER drop);
 *   • its size is finite, ≥ the byte floor, AND EXACTLY equals the persisted
 *     clip_web_bytes (a truncated / partial-PUT object mismatches → NEVER drop);
 *   • its content-type is video/* (a poster image mis-stored as the web copy
 *     would be an image/* → NEVER drop);
 *   • it was written ≥ graceMs ago (fresh-grace: a just-written web copy — e.g. a
 *     bad backfill transcode — must not convert straight to raw loss). A missing
 *     LastModified means we can't prove the age → NEVER drop.
 * Every failure path is fail-closed (keep the raw, retry a later sweep).
 */
export function clipWebCopyCustodyOk(
  head: R2HeadResult | null,
  expectedBytes: number,
  opts: { graceMs: number; nowMs: number },
): boolean {
  if (!head) return false;
  if (!Number.isFinite(head.size)) return false;
  if (head.size < CLIP_WEB_MIN_BYTES) return false;
  if (!Number.isFinite(expectedBytes) || head.size !== expectedBytes) return false;
  if (!head.contentType || !head.contentType.toLowerCase().startsWith('video/')) return false;
  if (!head.lastModified) return false;
  const ageMs = opts.nowMs - head.lastModified.getTime();
  if (!Number.isFinite(ageMs)) return false;
  return ageMs >= opts.graceMs;
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
