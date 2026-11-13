import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { approvalActionLabel } from '@/lib/admin-approvals';
import { areaForApprovalAction } from './areas';
import { isOwnerProfile } from './owner';
import { SELF_APPROVAL_WORD, expiryAfterConfirm } from './self-approval';
import { emailOwnerWaiting } from './self-approval-email';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * ONE door for "the owner typed the word on his own request": used by
 * /admin/approvals (on the row) and /admin/team (typed on the save). Not a
 * server action — callers pass a session-proved user id after their own gate.
 *
 * The database stamps the time and sets run_after = now + 24 h
 * (guard_owner_self_approval), and refuses it for anyone but the owner, so the
 * checks here are for a plain sentence, not the only line of defence.
 */
export async function startOwnerWait(
  admin: AdminClient,
  args: { approvalId: string; ownerId: string },
): Promise<{ runAfter: string }> {
  const { data: me, error: meErr } = await admin
    .from('users')
    .select('email, is_internal')
    .eq('user_id', args.ownerId)
    .maybeSingle();
  if (meErr) throw new Error('Couldn’t read your account, so nothing was changed. Reload and try again.');
  if (!isOwnerProfile(me)) {
    throw new Error('Only the owner may approve his own request. A different admin must decide this one.');
  }

  const { data: row, error: rowErr } = await admin
    .from('admin_approval_requests')
    .select('approval_id, public_id, action_type, initiated_by, status, expires_at, self_confirmed_at')
    .eq('approval_id', args.approvalId)
    .maybeSingle();
  if (rowErr) throw new Error(`Couldn’t read the request: ${rowErr.message}`);
  if (!row || row.initiated_by !== args.ownerId) throw new Error('This is not your request.');
  if (row.status !== 'pending') throw new Error('This request is already closed.');
  if (row.self_confirmed_at) throw new Error('The 24-hour wait has already started.');

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const { data: updated, error: updErr } = await admin
    .from('admin_approval_requests')
    .update({
      // A request opened late in its week would otherwise expire mid-wait.
      expires_at: expiryAfterConfirm(row.expires_at as string, nowMs),
      // Both overwritten by the database clock in the trigger.
      self_confirmed_at: nowIso,
      run_after: nowIso,
    })
    .eq('approval_id', args.approvalId)
    .eq('status', 'pending')
    .is('self_confirmed_at', null)
    .select('run_after')
    .maybeSingle();
  if (updErr) throw new Error(`Could not start the wait: ${updErr.message}`);
  if (!updated?.run_after) throw new Error('The request changed while you were typing — reload and look again.');
  const runAfter = updated.run_after as string;

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: `approval_self_confirmed:${row.action_type as string}`,
    area: areaForApprovalAction(row.action_type as string),
    target_table: 'admin_approval_requests',
    target_id: args.approvalId,
    actor_user_id: args.ownerId,
    reason: `Typed ${SELF_APPROVAL_WORD} — runs after a 24-hour wait.`,
    after_json: { run_after: runAfter },
  });
  if (auditErr) console.error('[owner self-approval] audit insert failed', auditErr.message);

  await emailOwnerWaiting({
    what: approvalActionLabel(row.action_type as string),
    publicId: (row.public_id as string | null) ?? args.approvalId,
    runAfter,
  });
  return { runAfter };
}
