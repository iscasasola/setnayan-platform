import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { runClaimedJob, DAILY_GAP_MS } from '@/lib/periodic-jobs';
import { cleanupDelete } from '@/lib/cleanup-delete';
import { chatAttachmentScope } from '@/lib/cleanup-delete-scope';
import { r2HeadOutcome, R2_BUCKETS } from '@/lib/r2';
import {
  KEPT_FOREVER_FILTER_COLUMNS,
  runChatFileExpirySweepWith,
  type ChatFileCandidate,
  type ChatFileExpiryIO,
  type ChatFileExpirySummary,
} from '@/lib/chat-file-expiry-sweep-core';

/**
 * chat-file-expiry-sweep.ts — CHAT FILES GO 90 DAYS AFTER THE EVENT.
 * (Owner 2026-10-28, DECISION_LOG "CHAT FILES".) The rule and the order of
 * operations live in `-core.ts`; this file only binds them to the database and
 * R2.
 *
 * 🔒 SHIPS OFF. `CHAT_FILE_EXPIRY_ENABLED` is server-side and opt-in
 * (`=== 'true'`): this permanently deletes people's files, so the owner turns
 * it on after reviewing the PR. Off, the job still claims its window and runs
 * as a DRY RUN — it deletes nothing, records 0, and logs what it would have
 * deleted (a switched-off job that reports nothing looks exactly like a broken
 * one).
 *
 * The run record (`cron_job_runs.rows_affected`) is `deleted` — objects R2
 * confirmed gone by a HEAD 404 after the delete. Never "attempted".
 *
 * CRON-FREE: a DAILY claim fired from admin-layout `after()`, like the other
 * retention sweeps. Never throws.
 */

export function chatFileExpiryEnabled(): boolean {
  return process.env.CHAT_FILE_EXPIRY_ENABLED === 'true';
}

const THREAD_FILES_REF = `r2://${R2_BUCKETS.threadFiles}/`;

function bindIO(admin: ReturnType<typeof createAdminClient>): ChatFileExpiryIO {
  return {
    async listCandidates(cutoff, limit) {
      let q = admin
        .from('chat_messages')
        .select(
          `message_id, thread_id, attachment_name, attachment_r2_key, attachment_url, ${KEPT_FOREVER_FILTER_COLUMNS.join(', ')}, events!inner(event_date, event_end_date, event_date_precision)`,
        )
        .not('attachment_r2_key', 'is', null)
        .eq('events.event_date_precision', 'day')
        .lte('events.event_date', cutoff);
      for (const c of KEPT_FOREVER_FILTER_COLUMNS) q = q.is(c, null);
      const { data, error } = await q.order('created_at', { ascending: true }).limit(limit);
      if (error) throw new Error(`chat file candidates: ${error.message}`);
      return (data ?? []) as unknown as ChatFileCandidate[];
    },
    async refsKeptElsewhere(refs) {
      const kept = new Set<string>();
      if (refs.length === 0) return kept;
      const reads = await Promise.all([
        admin.from('event_vendor_payments').select('proof_r2_key').in('proof_r2_key', refs),
        admin.from('vendor_contracts').select('file_url').in('file_url', refs),
        admin.from('event_vendors').select('deposit_proof_url').in('deposit_proof_url', refs),
      ]);
      for (const r of reads) {
        if (r.error) throw new Error(`kept-forever read: ${r.error.message}`);
        for (const row of (r.data ?? []) as Record<string, unknown>[]) {
          for (const v of Object.values(row)) if (typeof v === 'string') kept.add(v);
        }
      }
      return kept;
    },
    async deleteObject(ref, threadId) {
      return cleanupDelete(ref, chatAttachmentScope(threadId));
    },
    async headObject(ref) {
      if (!ref.startsWith(THREAD_FILES_REF)) return 'unknown';
      const out = await r2HeadOutcome({
        bucket: R2_BUCKETS.threadFiles,
        key: ref.slice(THREAD_FILES_REF.length),
      });
      return out.kind;
    },
    async markExpired(messageId, ref) {
      const { data, error } = await admin
        .from('chat_messages')
        .update({ attachment_r2_key: null })
        .eq('message_id', messageId)
        .eq('attachment_r2_key', ref)
        .select('message_id');
      if (error) {
        console.error('[chat-file-expiry] mark failed:', error.message);
        return false;
      }
      return (data ?? []).length === 1;
    },
  };
}

export async function runChatFileExpirySweep(
  opts: { dryRun?: boolean; limit?: number; now?: Date } = {},
): Promise<ChatFileExpirySummary> {
  const dryRun = opts.dryRun ?? !chatFileExpiryEnabled();
  const summary = await runChatFileExpirySweepWith(bindIO(createAdminClient()), {
    dryRun,
    limit: opts.limit,
    now: opts.now,
  });
  console.info(
    `[chat-file-expiry] ${dryRun ? 'DRY RUN — would delete' : 'deleted (HEAD-confirmed)'} ` +
      `${dryRun ? summary.wouldDelete : summary.deleted}; scanned ${summary.scanned}, ` +
      `kept forever ${summary.keptForever}, unconfirmed ${summary.unconfirmed}, ` +
      `refused ${summary.refused}, marked ${summary.marked}, failed ${summary.failed}.`,
  );
  return summary;
}

/** CRON-FREE daily claim, fired from admin-layout after(). Records MEASURED deletes. */
export async function maybeRunChatFileExpiry(): Promise<void> {
  await runClaimedJob('chat-file-expiry', DAILY_GAP_MS, async () => {
    const summary = await runChatFileExpirySweep();
    if (summary.failed > 0 && summary.deleted === 0 && summary.wouldDelete === 0) {
      throw new Error(`chat file expiry: ${summary.failed} failed, nothing deleted`);
    }
    return summary.deleted;
  });
}
