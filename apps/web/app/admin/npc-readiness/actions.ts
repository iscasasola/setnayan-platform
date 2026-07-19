'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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

function done(msg: string) {
  redirect(`/admin/npc-readiness?flash=${encodeURIComponent(msg)}`);
}
function fail(msg: string): never {
  redirect(`/admin/npc-readiness?error=${encodeURIComponent(msg)}`);
}

/**
 * Update one NPC filing task's status/note/evidence. Records the resolver +
 * timestamp on resolve. Enforces the council's structural anti-false-assurance
 * guards (verdict §5) so the board can never quietly imply the filing is cleared:
 *
 *   (2) counsel-gated tasks can't resolve without a written counsel reference in
 *       the note;
 *   (3) the FILE-the-DPS task (t3-13) can't resolve until external counsel
 *       review (t0-1) is itself resolved.
 */
export async function setNpcFilingTask(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();

  const key = String(formData.get('task_key') ?? '');
  const status = String(formData.get('status') ?? '') as NpcTaskStatus;
  const note = (String(formData.get('note') ?? '').trim() || null)?.slice(0, 2000) ?? null;
  const evidence = (String(formData.get('evidence') ?? '').trim() || null)?.slice(0, 500) ?? null;

  const def = getNpcTask(key);
  if (!def) fail('Unknown task.');
  if (!VALID_STATUS.has(status)) fail('Invalid status.');

  const admin = createAdminClient();

  // Guard (2): a counsel-gated task can't be resolved without a written counsel
  // reference — the owner physically cannot mark it done without citing counsel.
  if (def.counselGated && status === 'resolved' && !note) {
    fail('This item needs external counsel sign-off. Add a written counsel reference (name + memo date) in the note before resolving.');
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
      fail('You can’t mark the NPC filing done before external counsel review (t0-1) is resolved.');
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
  if (error) fail(error.message);

  revalidatePath('/admin/npc-readiness');
  done(`Updated “${def.title}”.`);
}
