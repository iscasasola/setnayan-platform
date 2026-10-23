import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { DAILY_GAP_MS } from '@/lib/periodic-job-registry';
import { deleteStagingObject, type IntentRow } from '@/lib/papic-upload-intents.server';
import { SHOT_TTL_MS } from '@/lib/papic-upload/replayer';

// ============================================================================
// lib/papic-upload-sweep.ts — ANYTHING UPLOADED BUT NEVER RECORDED IS REMOVED.
//
// Owner relay 2026-10-23 ("clean and safe", c): a phone PUTs a shot's pieces
// straight to R2 on presigned URLs (lib/papic-upload/). A piece that landed but
// was never recorded — the phone died before the record call, the credits ran
// out between the PUT and the record, the event closed — is an object nothing
// points at. papic_upload_intents remembers every key we signed; this deletes
// the unsettled ones once the phone could no longer send them.
//
// 🛡 GUARD A (corpus Papic_Storage_Sustainability_Spec_2026-07-22): never delete
// a full-res original or raw clip unless a verified, durable, playable copy
// exists. What this deletes is NEVER a key a row points at: only the phone's
// STAGING upload (`…/incoming/…`), which the server copies to a final key before
// any row may reference it (lib/papic-upload/tiers.ts stagingKeyFor). A staging
// object whose shot WAS recorded has already been promoted — its row holds the
// final copy. One that was never recorded is a shot the event never accepted.
//
// ⏱ WAITS LONGER THAN THE PHONE: the phone keeps a shot 7 days
// (SHOT_TTL_MS); this waits 8, so it never deletes a piece a phone is about to
// record. A phone that does come back after that gets `object_missing` and PUTs
// it again from its own copy.
//
// Every delete goes through the pinned executor (lib/cleanup-delete.ts),
// scoped to the folder the intent's own owner files in.
// ============================================================================

/** Unsettled pieces older than this are swept — the phone's TTL plus a day. */
export const UNSETTLED_SWEEP_AFTER_MS = SHOT_TTL_MS + 24 * 60 * 60 * 1000;
/** Settled intents are bookkeeping only after this; their rows are removed. */
export const SETTLED_FORGET_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
const BATCH = 200;

/** Pure: which intents the sweep deletes now. */
export function intentsToSweep<T extends { signed_at: string; settled_at: string | null }>(
  rows: readonly T[],
  nowMs: number,
): { unsettled: T[]; settled: T[] } {
  const unsettled: T[] = [];
  const settled: T[] = [];
  for (const r of rows) {
    const signed = Date.parse(r.signed_at);
    if (!Number.isFinite(signed)) continue; // never act on a row we cannot read
    if (r.settled_at === null && nowMs - signed > UNSETTLED_SWEEP_AFTER_MS) unsettled.push(r);
    if (r.settled_at !== null && nowMs - signed > SETTLED_FORGET_AFTER_MS) settled.push(r);
  }
  return { unsettled, settled };
}

export async function runPapicUploadSweep(nowMs = Date.now()): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('papic_upload_intents')
    .select('intent_id, lane, event_id, owner_id, tier, r2_ref, size_bytes, content_type, signed_at, settled_at')
    .lt('signed_at', new Date(nowMs - SETTLED_FORGET_AFTER_MS).toISOString())
    .order('signed_at', { ascending: true })
    .limit(BATCH);
  if (error) throw new Error(`papic_upload_intents read: ${error.message}`);
  const rows = (data ?? []) as Array<IntentRow & { intent_id: number; signed_at: string }>;
  const { unsettled, settled } = intentsToSweep(rows, nowMs);

  let removed = 0;
  const forget: number[] = [];
  for (const r of unsettled) {
    try {
      const outcome = await deleteStagingObject(r);
      // A refusal is counted, never cleared: the row stays for a human to see.
      if (outcome === 'deleted') {
        removed += 1;
        forget.push(r.intent_id);
      }
    } catch {
      // A failed delete leaves an orphan for the next run, never lost data.
    }
  }
  for (const r of settled) {
    // Already promoted; its staging copy was dropped at promotion (best-effort,
    // so drop it again — deleting a missing object is a no-op).
    await deleteStagingObject(r).catch(() => 'refused');
    forget.push(r.intent_id);
  }
  if (forget.length > 0) {
    const { error: delErr } = await admin.from('papic_upload_intents').delete().in('intent_id', forget);
    if (delErr) throw new Error(`papic_upload_intents forget: ${delErr.message}`);
  }
  return removed;
}

/** Fire from admin traffic (cron-free), at most once a day across the fleet. */
export async function maybeRunPapicUploadSweep(): Promise<void> {
  await runClaimedJob('papic-upload-sweep', DAILY_GAP_MS, () => runPapicUploadSweep());
}
