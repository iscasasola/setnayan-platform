import 'server-only';

/**
 * Escalate ▸ (DECISION_LOG 2026-11-13). A Basic admin sends an item up to an
 * Escalated admin in the same area — or the owner — with a note. Nothing is
 * decided by escalating: the item shows "Waiting for an Escalated admin" with
 * the name and the note until someone who may decide it resolves it.
 *
 *   escalate  → can(area, 'basic')
 *   resolve   → can(area, 'escalated')
 *
 * Both are written to admin_audit_log with the area and the actor.
 *
 * Not a "use server" file: reached through the ONE dispatcher `adminTeamAct`
 * (app/admin/approvals/actions.ts). Each function runs its own session gate.
 */

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminCan } from '@/lib/admin/can.server';
import { isAdminArea } from '@/lib/admin/areas';

export async function escalateItemOp(formData: FormData) {
  const area = formData.get('area');
  if (!isAdminArea(area)) throw new Error('Unknown area');
  const { userId } = await requireAdminCan(area, 'basic');

  const itemKind = String(formData.get('item_kind') ?? '').trim();
  const itemId = String(formData.get('item_id') ?? '').trim();
  const itemLabel = String(formData.get('item_label') ?? '').trim() || null;
  const note = String(formData.get('note') ?? '').trim();
  if (!itemKind || !itemId) throw new Error('Nothing to escalate');
  if (note.length < 3) throw new Error('Add a note — what you saw, and what you suggest.');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('work_escalations')
    .insert({
      area,
      item_kind: itemKind.slice(0, 80),
      item_id: itemId.slice(0, 200),
      item_label: itemLabel ? itemLabel.slice(0, 300) : null,
      note: note.slice(0, 2000),
      escalated_by: userId,
    })
    .select('escalation_id')
    .maybeSingle();
  if (error) {
    // The one-open-per-item index: it is already waiting, which is the state asked for.
    if (error.code === '23505') throw new Error('This is already waiting for an Escalated admin.');
    throw new Error(`Could not escalate: ${error.message}`);
  }

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'work_escalated',
    area,
    target_table: 'work_escalations',
    target_id: (data?.escalation_id as string | undefined) ?? itemId,
    actor_user_id: userId,
    reason: note.slice(0, 2000),
    after_json: { item_kind: itemKind, item_id: itemId },
  });
  if (auditErr) console.error('[escalate audit] insert failed', auditErr.message);

  revalidatePath('/admin/approvals');
}

export async function resolveEscalationOp(formData: FormData) {
  const escalationId = String(formData.get('escalation_id') ?? '');
  if (!escalationId) throw new Error('Invalid escalation');
  const admin = createAdminClient();
  const { data: row, error: readErr } = await admin
    .from('work_escalations')
    .select('area, resolved_at')
    .eq('escalation_id', escalationId)
    .maybeSingle();
  if (readErr) throw new Error(`Couldn’t read the escalation: ${readErr.message}`);
  if (!row) throw new Error('That escalation no longer exists.');
  if (row.resolved_at) throw new Error('Already resolved.');
  if (!isAdminArea(row.area)) throw new Error('Unknown area');
  const { userId } = await requireAdminCan(row.area, 'escalated');

  const note = String(formData.get('note') ?? '').trim() || null;
  const { data: done, error } = await admin
    .from('work_escalations')
    .update({ resolved_by: userId, resolved_at: new Date().toISOString(), resolution_note: note })
    .eq('escalation_id', escalationId)
    .is('resolved_at', null)
    .select('escalation_id')
    .maybeSingle();
  if (error) throw new Error(`Could not resolve: ${error.message}`);
  if (!done) throw new Error('Someone resolved it a moment ago.');

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'work_escalation_resolved',
    area: row.area,
    target_table: 'work_escalations',
    target_id: escalationId,
    actor_user_id: userId,
    reason: note,
  });
  if (auditErr) console.error('[escalate audit] insert failed', auditErr.message);

  revalidatePath('/admin/approvals');
}
