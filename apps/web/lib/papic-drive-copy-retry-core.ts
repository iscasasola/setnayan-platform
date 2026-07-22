// Pure, dependency-free core for the autonomous Drive-copy RETRY sweep (Papic
// storage PR-4 · Drive resilience). No `server-only`, so it's unit-testable.
// The sweep in papic-drive-copy-retry.ts uses these predicates; the tests drive
// them directly.
//
// THE LEAK THIS CLOSES: lib/drive-copy.ts copies each artifact to the couple's
// Drive at capture/release, but its batch only retries rows with
// attempt_count < 5 (DRIVE_COPY_BATCH_CAP), and ONLY when a new capture/release
// fires it. So a file that fails 5× is stranded forever — and the full-res drop's
// Guard B then (correctly) DEFERS its raw forever because the Drive copy never
// confirms = a permanent hot R2 leak that nothing ever clears. This module adds a
// bounded, backed-off retry ABOVE the batch cap plus a hard ceiling past which a
// copy is surfaced to admin instead of retried in a hot loop.

/**
 * The batch cap inside lib/drive-copy.ts (`MAX_ATTEMPTS`). Mirrored here as a
 * pure constant so the retry sweep can reason about "already past the normal
 * batch's reach". Kept in lockstep with drive-copy.ts (a unit test pins it).
 */
export const DRIVE_COPY_BATCH_CAP = 5;

/**
 * Hard retry ceiling. A copy at attempt_count >= this is STRANDED: never
 * auto-retried again (no hot-loop against a permanently-broken Drive), only
 * surfaced to admin to see & act. Sits above DRIVE_COPY_BATCH_CAP so the retry
 * sweep reaches the rows the normal batch abandoned (5..ceiling-1) before giving
 * up.
 */
export const DRIVE_COPY_RETRY_CEILING = 10;

/** Base back-off before the first retry of a failed copy (30 min). */
export const DRIVE_COPY_RETRY_BASE_MS = 30 * 60 * 1000;

/** Back-off never grows past this (24 h) — a stuck row still gets a daily poke. */
export const DRIVE_COPY_RETRY_MAX_MS = 24 * 60 * 60 * 1000;

/**
 * Exponential back-off for a failed Drive copy: base · 2^(attemptCount-1),
 * capped at DRIVE_COPY_RETRY_MAX_MS. attemptCount is the number of failures so
 * far (>= 1). A transient outage is retried gently and then increasingly
 * sparsely, never in a tight loop.
 *   attempt 1 → 30m · 2 → 1h · 3 → 2h · 4 → 4h · 5 → 8h · 6 → 16h · 7+ → 24h (cap)
 */
export function driveCopyRetryBackoffMs(attemptCount: number): number {
  if (!Number.isFinite(attemptCount) || attemptCount < 1) return DRIVE_COPY_RETRY_BASE_MS;
  const raw = DRIVE_COPY_RETRY_BASE_MS * 2 ** (attemptCount - 1);
  return Math.min(raw, DRIVE_COPY_RETRY_MAX_MS);
}

/** The subset of a drive_copy_artifacts row the retry predicates read. */
export type DriveCopyRetryRow = {
  attempt_count: number;
  last_error_at: string | null;
  drive_file_id?: string | null;
};

/**
 * Is this failed Drive copy DUE for another retry right now? Pure, so the sweep
 * and its test share one definition.
 *   • already copied (drive_file_id set) → false;
 *   • never attempted (attempt_count < 1) → false — a fresh enqueue is the normal
 *     batch's job, not the retry sweep's;
 *   • at/over the ceiling → false — STRANDED, surfaced not retried (no hot loop);
 *   • no last_error_at → true — can't prove it's too soon, so allow the retry;
 *   • else → due once the exponential back-off since last_error_at has elapsed.
 */
export function driveCopyRetryDue(row: DriveCopyRetryRow, nowMs: number): boolean {
  if (row.drive_file_id) return false;
  const a = Number(row.attempt_count);
  if (!Number.isFinite(a) || a < 1) return false;
  if (a >= DRIVE_COPY_RETRY_CEILING) return false;
  if (!row.last_error_at) return true;
  const last = Date.parse(row.last_error_at);
  if (!Number.isFinite(last)) return true;
  return nowMs - last >= driveCopyRetryBackoffMs(a);
}

/**
 * Is this copy STRANDED — past the retry ceiling and still not on the couple's
 * Drive? These are surfaced to admin (listStrandedDriveCopies) rather than
 * retried; each one is also a raw the full-res drop is deferring forever.
 */
export function driveCopyStranded(row: {
  attempt_count: number;
  drive_file_id?: string | null;
}): boolean {
  if (row.drive_file_id) return false;
  const a = Number(row.attempt_count);
  return Number.isFinite(a) && a >= DRIVE_COPY_RETRY_CEILING;
}
