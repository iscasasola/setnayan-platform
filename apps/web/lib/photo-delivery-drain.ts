import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimPeriodicJob } from '@/lib/periodic-jobs';
import { processBatchForEvent } from '@/lib/photo-delivery-release';

/**
 * Autonomous "Release to Drive" DRAINER (gap audit 2026-07-23 · B2).
 *
 * A couple's manual release copies their Papic media to Google Drive in the
 * background via an after() drain on the release click — but that drain is
 * BOUNDED (40 ticks × 6 = 240 uploads) and there is no scheduler, so a release
 * of >240 photos stalls: the job stays 'running', ~160+ artifacts keep
 * drive_file_id IS NULL, and nothing ever advances it without another user
 * click. (The `/api/cron/photo-delivery-tick` route was never wired.)
 *
 * This is the missing advancer — CRON-FREE, matching every other sweep in
 * admin/layout.tsx: admin traffic + a short DB claim. It finds events with an
 * UNFINISHED delivery job and keeps calling the SAME `processBatchForEvent`
 * primitive the click-time drain uses (it operates on the existing job — no
 * re-enqueue, so no duplicate jobs), bounded per invocation so a single admin
 * pageview never runs unbounded Drive uploads (Vercel function ceiling).
 *
 * Non-destructive; the batch processor keeps its own OAuth-token + retry-cap
 * safety, and a dead token flips the job 'failed' (which ends this loop for that
 * event). Never throws.
 */

// A release is a burst the couple wants done soon, so drain more often than
// daily — but above claimPeriodicJob's 5-min in-memory check throttle.
const DRAIN_GAP_MS = 10 * 60 * 1000;

// Per-invocation bounds (one admin pageview's after()). Mirrors the click-time
// after()'s shape (40×6) but spread across a few stalled events.
const DRAIN_MAX_EVENTS = 3;
const DRAIN_TICKS_PER_EVENT = 20; // ×6 batch ⇒ up to 120 uploads / event / invocation
const DRAIN_BATCH_SIZE = 6;

export async function runPhotoDeliveryDrain(): Promise<{ events: number; uploaded: number }> {
  const admin = createAdminClient();

  // Events with an unfinished job (oldest stalled release first). One active job
  // per event is the norm; dedupe + cap guards against any stragglers.
  const { data: jobs, error } = await admin
    .from('photo_delivery_jobs')
    .select('event_id')
    .in('status', ['queued', 'running', 'paused'])
    .order('started_at', { ascending: true })
    .limit(DRAIN_MAX_EVENTS * 8);
  if (error || !Array.isArray(jobs)) return { events: 0, uploaded: 0 };

  const eventIds = Array.from(
    new Set(jobs.map((j) => (j as { event_id: string }).event_id).filter(Boolean)),
  ).slice(0, DRAIN_MAX_EVENTS);

  let uploaded = 0;
  for (const eventId of eventIds) {
    for (let i = 0; i < DRAIN_TICKS_PER_EVENT; i += 1) {
      const tick = await processBatchForEvent({ eventId, batchSize: DRAIN_BATCH_SIZE }).catch(
        () => null,
      );
      // 'complete' / 'failed' / 'idle' → nothing more to do for this event.
      if (!tick || tick.status !== 'running') break;
      uploaded += tick.uploaded;
    }
  }

  return { events: eventIds.length, uploaded };
}

/**
 * CRON-FREE drain tick — fired from admin-layout after(); a short DB claim keeps
 * it to ~once / DRAIN_GAP_MS across the fleet. Best-effort, never throws.
 */
export async function maybeRunPhotoDeliveryDrain(): Promise<void> {
  try {
    if (await claimPeriodicJob('photo-delivery-drain', DRAIN_GAP_MS)) await runPhotoDeliveryDrain();
  } catch {
    /* best-effort — the next admin request retries */
  }
}
