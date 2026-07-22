'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction as requireAdmin } from '@/lib/admin/require-admin';
import {
  getNpcTask,
  COUNSEL_REVIEW_TASK,
  FILE_DPS_TASK,
  type NpcTaskStatus,
} from '@/lib/npc-filing-tasks';

const VALID_STATUS = new Set<NpcTaskStatus>([
  'not_started',
  'in_progress',
  'blocked_on_counsel',
  'resolved',
  'not_applicable',
]);

export type NpcTaskResult = { status: 'ok' | 'error'; message: string };

/**
 * Update one NPC filing task's status/note/evidence. Records the resolver +
 * timestamp on resolve. Enforces the anti-false-assurance guards (verdict §5):
 *   (2) counsel-gated tasks can't resolve without a written counsel reference;
 *   (3) the FILE-the-DPS task (t3-13) can't resolve until external counsel
 *       review (t0-1) is itself resolved.
 *
 * Returns a per-submission result (no redirect) so the checklist tab of the
 * compliance hub updates IN PLACE via useActionState — no page navigation/blank.
 */
export async function setNpcFilingTask(formData: FormData): Promise<NpcTaskResult> {
  const { userId } = await requireAdmin();

  const key = String(formData.get('task_key') ?? '');
  const status = String(formData.get('status') ?? '') as NpcTaskStatus;
  const note = (String(formData.get('note') ?? '').trim() || null)?.slice(0, 2000) ?? null;
  const evidence = (String(formData.get('evidence') ?? '').trim() || null)?.slice(0, 500) ?? null;

  const def = getNpcTask(key);
  if (!def) return { status: 'error', message: 'Unknown task.' };
  if (!VALID_STATUS.has(status)) return { status: 'error', message: 'Invalid status.' };

  const admin = createAdminClient();

  // Guard (2): a counsel-gated task can't be resolved without a written counsel
  // reference — the owner physically cannot mark it done without citing counsel.
  if (def.counselGated && status === 'resolved' && !note) {
    return {
      status: 'error',
      message:
        'This item needs external counsel sign-off. Add a written counsel reference (name + memo date) in the note before resolving.',
    };
  }

  // Guard (3): filing the DPS on an unreviewed packet is the one irreversible
  // mistake — t3-13 can't resolve until t0-1 (counsel review) is resolved.
  if (key === FILE_DPS_TASK && status === 'resolved') {
    const { data: gate } = await admin
      .from('npc_filing_tasks')
      .select('status')
      .eq('task_key', COUNSEL_REVIEW_TASK)
      .maybeSingle();
    if ((gate as { status?: string } | null)?.status !== 'resolved') {
      return {
        status: 'error',
        message:
          'You can’t mark the NPC filing done before external counsel review (t0-1) is resolved.',
      };
    }
  }

  const nowIso = new Date().toISOString();
  const { error } = await admin.from('npc_filing_tasks').upsert(
    {
      task_key: key,
      // Self-seed the immutable catalog fields so a first write on a pre-seed DB
      // still satisfies NOT NULL (mirrors the Data Privacy board action).
      title: def.title,
      detail: def.detail,
      tier: def.tier,
      kind: def.kind,
      severity: def.severity,
      counsel_gated: def.counselGated,
      source_refs: def.sourceRefs,
      related_control_key: def.relatedControlKey ?? null,
      sort_order: def.sortOrder,
      status,
      note,
      evidence,
      resolved_by: status === 'resolved' ? userId : null,
      resolved_at: status === 'resolved' ? nowIso : null,
      updated_at: nowIso,
    },
    { onConflict: 'task_key' },
  );
  if (error) return { status: 'error', message: error.message };

  revalidatePath('/admin/data-privacy');
  return { status: 'ok', message: `Updated “${def.title}”.` };
}
