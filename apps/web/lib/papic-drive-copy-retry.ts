import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { runDriveCopyBatch } from '@/lib/drive-copy';
import { claimPeriodicJob, DAILY_GAP_MS } from '@/lib/periodic-jobs';
import {
  DRIVE_COPY_RETRY_CEILING,
  driveCopyRetryDue,
} from '@/lib/papic-drive-copy-retry-core';

// ============================================================================
// Autonomous Drive-copy RETRY sweep (Papic storage PR-4 · Drive resilience).
//
// A transient Google-Drive failure must be RETRIED, not silently lost. The
// capture/release path (lib/drive-copy.ts runDriveCopyBatch) only retries a
// failed copy when a NEW capture/release fires it AND only while
// attempt_count < 5 — so a file that fails 5× (or belongs to an event with no
// further captures) is stranded forever, and the full-res drop's Guard B then
// DEFERS its raw forever (a permanent hot R2 leak nothing clears).
//
// This sweep, fired cron-free from admin after() via claimPeriodicJob, re-drives
// those failed copies with exponential back-off up to a hard ceiling, and
// surfaces the copies stranded past the ceiling so an admin can see & act
// (listStrandedDriveCopies → the /admin/papic-storage readout).
//
// NON-DESTRUCTIVE: it only ever ATTEMPTS uploads and increments attempt_count on
// failure (idempotent — a confirmed copy sets drive_file_id and is skipped). It
// never deletes anything.
// ============================================================================

/** Events re-driven per sweep run (bounds the work on one request's after()). */
const MAX_EVENTS_PER_RUN = 10;
/** Candidate rows scanned to find due events (bounded read). */
const CANDIDATE_SCAN_LIMIT = 500;

export type DriveCopyRetrySummary = {
  /** Distinct events that had at least one back-off-DUE failed copy. */
  dueEvents: number;
  /** Events actually re-driven this run (capped at MAX_EVENTS_PER_RUN). */
  eventsProcessed: number;
  uploaded: number;
  failed: number;
  /** Copies stranded past the ceiling (surfaced to admin, not retried here). */
  stranded: number;
};

export type StrandedDriveCopy = {
  eventId: string;
  artifactType: string;
  fileName: string;
  attemptCount: number;
  lastErrorText: string | null;
  lastErrorAt: string | null;
};

/**
 * ADMIN READ — Drive copies stranded past the retry ceiling (drive_file_id still
 * NULL, attempt_count >= DRIVE_COPY_RETRY_CEILING). Each one is a full-res raw
 * the drop is deferring forever, so an admin needs it visible to act (reconnect
 * Drive, hand off originals, or accept the hot cost). Consumed by the
 * /admin/papic-storage readout. Newest failure first.
 */
export async function listStrandedDriveCopies(
  limit = 100,
): Promise<{ total: number; rows: StrandedDriveCopy[] }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('drive_copy_artifacts')
    .select('event_id, artifact_type, file_name, attempt_count, last_error_text, last_error_at')
    .is('drive_file_id', null)
    .gte('attempt_count', DRIVE_COPY_RETRY_CEILING)
    .order('last_error_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error || !data) return { total: 0, rows: [] };
  const rows: StrandedDriveCopy[] = data.map((r) => ({
    eventId: r.event_id as string,
    artifactType: (r.artifact_type as string | null) ?? '—',
    fileName: (r.file_name as string | null) ?? '—',
    attemptCount: (r.attempt_count as number | null) ?? 0,
    lastErrorText: (r.last_error_text as string | null) ?? null,
    lastErrorAt: (r.last_error_at as string | null) ?? null,
  }));
  return { total: rows.length, rows };
}

/**
 * One retry pass. Finds events with a back-off-due failed copy, re-drives each
 * (raised attemptCap = the ceiling, so it reaches rows the normal batch left at
 * 5, plus the back-off gate), then surfaces what's stranded past the ceiling.
 * Best-effort per event; never throws for one bad event.
 */
export async function runDriveCopyRetrySweep(
  opts: { maxEvents?: number; nowMs?: number } = {},
): Promise<DriveCopyRetrySummary> {
  const admin = createAdminClient();
  const nowMs = opts.nowMs ?? Date.now();
  const maxEvents = Math.min(Math.max(1, opts.maxEvents ?? MAX_EVENTS_PER_RUN), 100);

  // Candidate failed rows below the ceiling that were previously attempted. Order
  // by oldest failure so the longest-waiting copies get retried first.
  const { data: candidates } = await admin
    .from('drive_copy_artifacts')
    .select('event_id, attempt_count, last_error_at')
    .is('drive_file_id', null)
    .gte('attempt_count', 1)
    .lt('attempt_count', DRIVE_COPY_RETRY_CEILING)
    .order('last_error_at', { ascending: true, nullsFirst: true })
    .limit(CANDIDATE_SCAN_LIMIT);

  // Distinct events with at least one back-off-DUE row (preserve fetch order so
  // the longest-waiting events are re-driven first).
  const dueEventIds: string[] = [];
  const seen = new Set<string>();
  for (const r of candidates ?? []) {
    const due = driveCopyRetryDue(
      {
        attempt_count: (r.attempt_count as number | null) ?? 0,
        last_error_at: (r.last_error_at as string | null) ?? null,
      },
      nowMs,
    );
    if (!due) continue;
    const eventId = r.event_id as string;
    if (seen.has(eventId)) continue;
    seen.add(eventId);
    dueEventIds.push(eventId);
  }

  const retryDue = (row: { attempt_count: number; last_error_at: string | null }) =>
    driveCopyRetryDue(row, nowMs);

  let uploaded = 0;
  let failed = 0;
  let eventsProcessed = 0;
  for (const eventId of dueEventIds.slice(0, maxEvents)) {
    const r = await runDriveCopyBatch({
      eventId,
      attemptCap: DRIVE_COPY_RETRY_CEILING,
      retryDue,
    }).catch(() => null);
    if (r) {
      uploaded += r.uploaded;
      failed += r.failed;
      eventsProcessed += 1;
    }
  }

  // Surface what's stranded past the ceiling — an admin-visible signal, not a
  // silent skip. A number that never falls means those events' Drive sync is
  // permanently broken (the raws stay hot forever).
  const stranded = await listStrandedDriveCopies(50).catch(() => ({ total: 0, rows: [] as StrandedDriveCopy[] }));
  if (stranded.total > 0) {
    const byEvent = new Map<string, number>();
    for (const s of stranded.rows) byEvent.set(s.eventId, (byEvent.get(s.eventId) ?? 0) + 1);
    const worst = [...byEvent.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, n]) => `${id}=${n}`)
      .join(', ');
    console.warn(
      `[papic-drive-copy-retry] ${stranded.total} Drive copy(ies) stranded past ` +
        `${DRIVE_COPY_RETRY_CEILING} attempts across ${byEvent.size} event(s) — ` +
        `NOT auto-retried (no hot loop). Each is a full-res raw the drop defers forever; ` +
        `see /admin/papic-storage. Top: ${worst}.`,
    );
  }

  return {
    dueEvents: dueEventIds.length,
    eventsProcessed,
    uploaded,
    failed,
    stranded: stranded.total,
  };
}

/**
 * CRON-FREE Drive-copy retry — fired from admin-layout after() alongside the
 * full-res drop (its coupled sibling: the drop DEFERS exactly the raws this
 * unsticks). A DAILY DB claim guarantees ~once/day across the fleet and survives
 * deploys; the back-off gate spaces per-row retries finer than the daily cadence.
 * Best-effort, never throws.
 */
export async function maybeRunDriveCopyRetry(): Promise<void> {
  try {
    if (await claimPeriodicJob('papic-drive-copy-retry', DAILY_GAP_MS)) {
      await runDriveCopyRetrySweep();
    }
  } catch {
    /* best-effort — a missed day retries on the next eligible admin request */
  }
}
