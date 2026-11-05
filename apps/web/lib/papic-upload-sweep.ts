import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { PAPIC_UPLOAD_SWEEP_GAP_MS } from '@/lib/periodic-job-registry';
import {
  deleteFinalIfUnreferenced,
  deleteStagingObject,
  refIsReferenced,
  type IntentRow,
} from '@/lib/papic-upload-intents.server';
import { SHOT_TTL_MS } from '@/lib/papic-upload/replayer';
import { sweepUnsettledIntent } from '@/lib/papic-upload/sweep-plan';

// ============================================================================
// lib/papic-upload-sweep.ts — ANYTHING UPLOADED BUT NEVER RECORDED IS REMOVED.
//
// Owner relay 2026-10-23 ("clean and safe", c): a phone PUTs a shot's pieces
// straight to R2 on presigned URLs (lib/papic-upload/). papic_upload_intents
// remembers every key we signed (the STAGING upload) and, once promoted, the
// FINAL copy that attempt wrote. Three jobs, each in batches until done or the
// time budget runs out (review 2026-10-23, major 6 — it must keep up):
//
//   1. SETTLED rows (a row points at the final copy) older than the signed
//      URL's life: drop the staging upload (again — a late re-PUT on a
//      still-valid URL lands there and nowhere else) and forget the row.
//   2. UNSETTLED rows older than the phone's TTL + a day: the shot was never
//      recorded. Drop the staging upload; drop the attempt's final copy ONLY if
//      no capture row points at it (a crash between the row and the settle
//      leaves a referenced final — that one is kept: Guard A).
//   3. A row the pinned executor REFUSES is set aside (sweep_refused_at), so one
//      bad key never blocks the head of the queue.
//
// 🛡 GUARD A (corpus Papic_Storage_Sustainability_Spec_2026-07-22): never delete
// a copy a row points at. Staging keys are never pointed at; a final key is
// deleted only after a reference check across every key column.
//
// Run cron-free from admin traffic AND from the capture routes themselves (a
// claimed window, so it runs at most once per PAPIC_UPLOAD_SWEEP_GAP_MS).
// ============================================================================

/** Unsettled pieces older than this are swept — the phone's TTL plus a day. */
export const UNSETTLED_SWEEP_AFTER_MS = SHOT_TTL_MS + 24 * 60 * 60 * 1000;
/** A settled row is kept just past its presigned URL's life (5 min), then forgotten. */
export const SETTLED_FORGET_AFTER_MS = 15 * 60 * 1000;
const BATCH = 200;
const BUDGET_MS = 20_000;

type SweepRow = IntentRow & { intent_id: number; signed_at: string; final_ref: string | null };

export async function runPapicUploadSweep(nowMs = Date.now()): Promise<number> {
  const admin = createAdminClient();
  const started = Date.now();
  let removed = 0;

  // 1 · settled rows — drop the staging upload again, forget the row.
  for (;;) {
    if (Date.now() - started > BUDGET_MS) return removed;
    const { data, error } = await admin
      .from('papic_upload_intents')
      .select('intent_id, lane, event_id, owner_id, tier, r2_ref, size_bytes, content_type, signed_at, settled_at, final_ref')
      .not('settled_at', 'is', null)
      .lt('settled_at', new Date(nowMs - SETTLED_FORGET_AFTER_MS).toISOString())
      .order('settled_at', { ascending: true })
      .limit(BATCH);
    if (error) throw new Error(`papic_upload_intents settled read: ${error.message}`);
    const rows = (data ?? []) as SweepRow[];
    if (rows.length === 0) break;
    await Promise.all(rows.map((r) => deleteStagingObject(r).catch(() => 'refused')));
    const { error: delErr } = await admin
      .from('papic_upload_intents')
      .delete()
      .in('intent_id', rows.map((r) => r.intent_id));
    if (delErr) throw new Error(`papic_upload_intents forget: ${delErr.message}`);
    if (rows.length < BATCH) break;
  }

  // 2 · unsettled rows past the phone's TTL — the shot was never recorded.
  for (;;) {
    if (Date.now() - started > BUDGET_MS) return removed;
    const { data, error } = await admin
      .from('papic_upload_intents')
      .select('intent_id, lane, event_id, owner_id, tier, r2_ref, size_bytes, content_type, signed_at, settled_at, final_ref')
      .is('settled_at', null)
      .is('sweep_refused_at', null)
      .lt('signed_at', new Date(nowMs - UNSETTLED_SWEEP_AFTER_MS).toISOString())
      .order('signed_at', { ascending: true })
      .limit(BATCH);
    if (error) throw new Error(`papic_upload_intents unsettled read: ${error.message}`);
    const rows = (data ?? []) as SweepRow[];
    if (rows.length === 0) break;
    const forget: number[] = [];
    const refused: number[] = [];
    for (const r of rows) {
      const outcome = await sweepUnsettledIntent(r.final_ref, {
        deleteStaging: () => deleteStagingObject(r),
        isReferenced: (ref) => refIsReferenced(admin, r.lane, ref),
        // deleteFinalIfUnreferenced checks again — the row could have arrived in between.
        deleteFinal: async (ref) => ((await deleteFinalIfUnreferenced(admin, r, ref)) === 'refused' ? 'refused' : 'deleted'),
      });
      if (outcome === 'forget') {
        removed += 1;
        forget.push(r.intent_id);
      } else {
        refused.push(r.intent_id); // set aside: the next batch moves past it
      }
    }
    if (forget.length > 0) {
      const { error: delErr } = await admin.from('papic_upload_intents').delete().in('intent_id', forget);
      if (delErr) throw new Error(`papic_upload_intents forget: ${delErr.message}`);
    }
    if (refused.length > 0) {
      const { error: setErr } = await admin
        .from('papic_upload_intents')
        .update({ sweep_refused_at: new Date(nowMs).toISOString() })
        .in('intent_id', refused);
      if (setErr) throw new Error(`papic_upload_intents set aside: ${setErr.message}`);
    }
    if (rows.length < BATCH) break;
  }
  return removed;
}

/** Fire from admin traffic and the capture routes (cron-free), at most once per window. */
export async function maybeRunPapicUploadSweep(): Promise<void> {
  await runClaimedJob('papic-upload-sweep', PAPIC_UPLOAD_SWEEP_GAP_MS, () => runPapicUploadSweep());
}
