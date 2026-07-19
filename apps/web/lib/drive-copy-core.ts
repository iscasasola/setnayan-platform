// Pure, dependency-free core for the Drive-copy layer — no `server-only`, so it
// is unit-testable (drive-copy-core.test.ts). drive-copy.ts re-exports these.

/** The two Drive slots per event (owner 2026-07-11 · up to 2 Drives per event). */
export type DriveProvider = 'drive' | 'drive_overflow';

/**
 * Is this a "the target Drive is full" error? Google returns HTTP 403 with
 * reason `storageQuotaExceeded` when a Drive's quota is exhausted;
 * uploadFileToDrive surfaces that verbatim in the thrown message
 * (`drive_upload_403:{…"reason":"storageQuotaExceeded"…}`). Pure + shared so the
 * overflow-failover branch and its test use one definition. Case-insensitive to
 * survive any casing drift in Google's payload.
 */
export function isDriveQuotaExceededError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /storageQuotaExceeded/i.test(msg);
}
