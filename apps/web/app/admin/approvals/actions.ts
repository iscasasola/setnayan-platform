'use server';

/**
 * /admin/approvals server actions — two-admin (four-eyes) approval queue.
 *
 * Security model (mirrors the other admin surfaces — see force-majeure/actions.ts):
 *   - requireAdmin() asserts the CALLER is an admin (is_internal || is_team_member
 *     || account_type==='admin') via the authenticated client, server-side.
 *   - All reads/writes then go through the service-role client (createAdminClient),
 *     which bypasses RLS; the admin_approval_requests RLS (is_admin()) is
 *     defense-in-depth.
 *   - FOUR-EYES is enforced redundantly: the atomic claim UPDATE carries a
 *     `.neq('initiated_by', me)` predicate AND the table has a CHECK
 *     (decided_by <> initiated_by). A self-decision can never land.
 *   - The claim UPDATE is gated on `status='pending'` + `expires_at > now`, so a
 *     request can be decided at most once and never after expiry (no TOCTOU /
 *     double-execute).
 *
 * Every mutation best-effort logs to admin_audit_log (failure logs to console,
 * never rolls back — the canonical pattern).
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isApprovalActionType, type ApprovalActionType } from '@/lib/admin-approvals';

async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { userId: user.id };
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function audit(
  admin: AdminClient,
  row: {
    action: string;
    target_id?: string | null;
    actor_user_id: string;
    reason?: string | null;
    before_json?: unknown;
    after_json?: unknown;
  },
) {
  const { error } = await admin.from('admin_audit_log').insert({
    action: row.action,
    target_table: 'admin_approval_requests',
    target_id: row.target_id ?? null,
    actor_user_id: row.actor_user_id,
    reason: row.reason ?? null,
    before_json: row.before_json ?? null,
    after_json: row.after_json ?? null,
  });
  if (error) console.error('[approvals audit] insert failed', error.message);
}

/**
 * Initiate a privileged-role grant request. Created in `pending`; a DIFFERENT
 * admin must approve it before it executes.
 */
export async function requestPrivilegedGrant(formData: FormData) {
  const { userId } = await requireAdmin();

  const actionType = formData.get('action_type');
  const targetEmail = formData.get('target_email');
  const rationale = formData.get('rationale');

  if (!isApprovalActionType(actionType)) throw new Error('Invalid action type');
  if (typeof targetEmail !== 'string' || !targetEmail.trim()) {
    throw new Error('Target email is required');
  }
  if (typeof rationale !== 'string' || rationale.trim().length < 3) {
    throw new Error('A rationale (≥3 chars) is required');
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from('users')
    .select('user_id, email')
    .ilike('email', targetEmail.trim())
    .maybeSingle();
  if (!target) throw new Error('No Setnayan account with that email');
  // Hardening: an admin can't initiate a privileged grant for their OWN
  // account. Not a four-eyes bypass (a different admin still approves), but it
  // removes the self-elevation request pattern entirely.
  if (target.user_id === userId) {
    throw new Error(
      'You cannot request a privileged grant for your own account — ask another admin to initiate it.',
    );
  }

  const { error: insErr } = await admin.from('admin_approval_requests').insert({
    action_type: actionType,
    target_user_id: target.user_id,
    rationale: rationale.trim().slice(0, 2000),
    initiated_by: userId,
  });
  if (insErr) throw new Error(`Could not create request: ${insErr.message}`);

  await audit(admin, {
    action: 'approval_request_created',
    target_id: target.user_id,
    actor_user_id: userId,
    reason: rationale.trim(),
    after_json: { action_type: actionType, target_email: target.email },
  });

  revalidatePath('/admin/approvals');
  revalidatePath('/admin');
}

/** Execute the underlying privileged-role change. Service-role only. */
async function executeApproved(
  admin: AdminClient,
  row: { action_type: ApprovalActionType; target_user_id: string | null },
): Promise<void> {
  if (!row.target_user_id) throw new Error('Request has no target user');
  const t = row.target_user_id;

  if (row.action_type === 'grant_internal_account') {
    // Mutually exclusive with team-pool (§10a XOR §10b) — clear the other flag.
    const { error } = await admin
      .from('users')
      .update({ is_internal: true, is_team_member: false })
      .eq('user_id', t);
    if (error) throw new Error(`Grant internal failed: ${error.message}`);
  } else if (row.action_type === 'grant_team_pool') {
    const { error } = await admin
      .from('users')
      .update({ is_team_member: true, is_internal: false })
      .eq('user_id', t);
    if (error) throw new Error(`Grant team-pool failed: ${error.message}`);
  } else if (row.action_type === 'promote_to_admin') {
    const { error } = await admin
      .from('users')
      .update({ account_type: 'admin' })
      .eq('user_id', t);
    if (error) throw new Error(`Promote to admin failed: ${error.message}`);
  } else {
    throw new Error(`Unknown action type: ${row.action_type as string}`);
  }
}

/**
 * Approve a pending request AS A SECOND ADMIN, then execute it. The atomic
 * claim (status='pending' + expires_at>now + initiated_by<>me) guarantees the
 * request is decided once, never after expiry, never by its initiator.
 */
export async function approveRequest(formData: FormData) {
  const { userId } = await requireAdmin();
  const approvalId = formData.get('approval_id');
  if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid request');

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: claimed, error: claimErr } = await admin
    .from('admin_approval_requests')
    .update({ status: 'approved', decided_by: userId, decided_at: nowIso })
    .eq('approval_id', approvalId)
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .neq('initiated_by', userId)
    .select('approval_id, action_type, target_user_id, initiated_by')
    .maybeSingle();

  if (claimErr) throw new Error(`Could not approve: ${claimErr.message}`);
  if (!claimed) {
    throw new Error(
      'Could not approve — the request was already decided, has expired, or you initiated it (a different admin must approve).',
    );
  }

  try {
    await executeApproved(admin, claimed as { action_type: ApprovalActionType; target_user_id: string | null });
  } catch (e) {
    // Execution failed AFTER the claim — roll the request back to pending so it
    // isn't stuck "approved" but unexecuted, and surface the error.
    // Status-guarded rollback: only reopen the row THIS call claimed
    // (status is still 'approved' — nobody else can have touched it, since a
    // competing claim requires status='pending'). Prevents clobbering any
    // other state. (A future hardening folds claim+execute into one
    // SECURITY DEFINER transaction so no compensating reset is needed.)
    await admin
      .from('admin_approval_requests')
      .update({ status: 'pending', decided_by: null, decided_at: null })
      .eq('approval_id', approvalId)
      .eq('status', 'approved');
    await audit(admin, {
      action: 'approval_execute_failed',
      target_id: claimed.target_user_id,
      actor_user_id: userId,
      reason: e instanceof Error ? e.message : String(e),
      before_json: { action_type: claimed.action_type },
    });
    throw e;
  }

  await audit(admin, {
    action: `approval_approved:${claimed.action_type}`,
    target_id: claimed.target_user_id,
    actor_user_id: userId,
    before_json: { initiated_by: claimed.initiated_by, status: 'pending' },
    after_json: { status: 'approved', executed: true },
  });

  revalidatePath('/admin/approvals');
  revalidatePath('/admin');
}

/** Reject a pending request (second admin). No execution. */
export async function rejectRequest(formData: FormData) {
  const { userId } = await requireAdmin();
  const approvalId = formData.get('approval_id');
  const reason = formData.get('reason');
  if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid request');

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: claimed, error: claimErr } = await admin
    .from('admin_approval_requests')
    .update({
      status: 'rejected',
      decided_by: userId,
      decided_at: nowIso,
      decision_reason:
        typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 2000) : null,
    })
    .eq('approval_id', approvalId)
    .eq('status', 'pending')
    .neq('initiated_by', userId)
    .select('approval_id, action_type, target_user_id, initiated_by')
    .maybeSingle();

  if (claimErr) throw new Error(`Could not reject: ${claimErr.message}`);
  if (!claimed) {
    throw new Error(
      'Could not reject — the request was already decided or you initiated it (a different admin must decide).',
    );
  }

  await audit(admin, {
    action: `approval_rejected:${claimed.action_type}`,
    target_id: claimed.target_user_id,
    actor_user_id: userId,
    reason: typeof reason === 'string' ? reason : null,
    before_json: { initiated_by: claimed.initiated_by, status: 'pending' },
    after_json: { status: 'rejected' },
  });

  revalidatePath('/admin/approvals');
  revalidatePath('/admin');
}
