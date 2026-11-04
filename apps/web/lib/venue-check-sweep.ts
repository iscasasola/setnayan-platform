import 'server-only';
import { R2_BUCKETS, isR2Configured, r2List } from '@/lib/r2';
import { cleanupDelete } from '@/lib/cleanup-delete';
import { venueCheckProbeScope } from '@/lib/cleanup-delete-scope';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { VENUE_PROBE_SWEEP_GAP_MS } from '@/lib/periodic-job-registry';
import { PROBE_PREFIX, PROBE_SWEEP_AFTER_MS } from '@/lib/venue-check';

// ============================================================================
// lib/venue-check-sweep.ts — EVERY VENUE-CHECK TEST UPLOAD IS REMOVED.
//
// The venue connection check (lib/venue-check.ts) PUTs a test file to storage.
// Three ways it goes:
//   1. the check finishes  → its server action deletes the file at once;
//   2. the person cancels  → the same, through the discard action;
//   3. the phone leaves mid-run (tab closed, battery, no signal) → nothing runs,
//      and the file would stay for ever. THIS sweep is that case's cleanup.
//
// It reads STORAGE, not the table: it lists everything under PROBE_PREFIX and
// deletes what is older than PROBE_SWEEP_AFTER_MS — so a file can only escape it
// by not existing. Nothing under that prefix is ever kept: it holds test bytes
// and nothing else.
//
// Cron-free like every job here: claimed at most once per
// VENUE_PROBE_SWEEP_GAP_MS, from admin traffic and from each check that starts.
// ============================================================================

/** The one bucket the check uploads to — private, presigned-only. */
export const PROBE_BUCKET = R2_BUCKETS.threadFiles;

/** Returns how many test uploads it removed. Throws on a listing failure so the run records it. */
export async function runVenueProbeSweep(nowMs = Date.now()): Promise<number> {
  if (!isR2Configured()) return 0;
  const { objects } = await r2List({ bucket: PROBE_BUCKET, prefix: PROBE_PREFIX, maxKeys: 1000 });
  let removed = 0;
  const failed: string[] = [];
  for (const o of objects) {
    // No date is not "old": an object R2 could not date is left for the next run, never guessed at.
    if (!o.lastModified || nowMs - o.lastModified.getTime() < PROBE_SWEEP_AFTER_MS) continue;
    // Through the pinned executor: the scope is the event folder the key itself names, so a key outside
    // `venue-check/<event>/` is refused (and reported), never deleted.
    const eventId = o.key.slice(PROBE_PREFIX.length).split('/')[0];
    try {
      const done = await cleanupDelete(`r2://${PROBE_BUCKET}/${o.key}`, venueCheckProbeScope(eventId));
      if (done === 'deleted') removed += 1;
      else failed.push(o.key);
    } catch {
      failed.push(o.key);
    }
  }
  if (failed.length > 0) {
    // Recorded as a failed run (with the count of what DID go), never as a quiet success.
    throw new Error(`venue-probe-sweep removed ${removed}, could not delete ${failed.length}: ${failed.slice(0, 3).join(', ')}`);
  }
  return removed;
}

/** Fire from admin traffic and from each check that starts, at most once per window. */
export async function maybeRunVenueProbeSweep(): Promise<void> {
  await runClaimedJob('venue-probe-sweep', VENUE_PROBE_SWEEP_GAP_MS, () => runVenueProbeSweep());
}
