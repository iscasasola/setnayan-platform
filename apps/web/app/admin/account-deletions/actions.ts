'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { blacklistUser, deleteUser } from '@/app/admin/users/actions';

/**
 * /admin/account-deletions — review queue for self-serve account-deletion
 * requests (App Store guideline 5.1.1(v) + Google Play data-deletion).
 *
 * Design "Request + admin review ≤24h" (owner-locked): a couple/vendor files
 * a deletion request from Profile → Privacy & data. It lands in
 * `account_deletion_requests` as `pending`. An admin reviews here and either:
 *
 *   • Approve → runs the EXISTING hard-delete (or delete-and-blacklist) logic
 *     from app/admin/users/actions.ts. We do NOT reimplement deletion — we
 *     delegate to deleteUser() / blacklistUser() so there's one source of
 *     truth for what "delete an account" means (auth.users removal → cascade,
 *     email freed or permanently blocked).
 *   • Reject → records a status + admin note; the account stays active.
 *
 * Keeping a human in the loop is the whole point of the chosen design: the
 * admin can check for active events / bookings / outstanding balances before
 * approving (that business guard already lived on the admin Delete action).
 */

async function requireAdmin() {
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
  return { adminUserId: user.id };
}

/**
 * Load the pending request + verify it's still actionable, then mark it
 * approved/rejected. Shared front-half of approve + reject so a stale request
 * (already actioned by another admin, or cancelled by the user) is caught
 * before we touch anything.
 */
async function loadPendingRequest(requestId: string) {
  const admin = createAdminClient();
  const { data: req, error } = await admin
    .from('account_deletion_requests')
    .select('request_id, user_id, status')
    .eq('request_id', requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!req) throw new Error('Deletion request not found.');
  if (req.status !== 'pending') {
    throw new Error(
      `This request is already ${req.status} — refresh the queue to see the current state.`,
    );
  }
  return { admin, req };
}

/**
 * Approve a deletion request. `mode` decides which existing admin action runs:
 *   • 'delete'    → deleteUser()     (email freed for re-signup)
 *   • 'blacklist' → blacklistUser()  (email permanently blocked)
 *
 * Order: mark the request approved FIRST (capturing the reviewer + note), THEN
 * run the deletion. The deletion cascades auth.users → public.users and the
 * request row (account_deletion_requests.user_id → auth.users ON DELETE
 * CASCADE) goes with it, so the approved-state write has to happen before the
 * row disappears. If the deletion itself fails, the request is left as
 * approved-but-not-executed and surfaces an error for the admin to retry — far
 * better than a deleted account with a still-pending request.
 */
async function approveRequest(formData: FormData, mode: 'delete' | 'blacklist') {
  const { adminUserId } = await requireAdmin();
  const requestId = formData.get('request_id');
  if (typeof requestId !== 'string' || requestId.length === 0) {
    throw new Error('Invalid input');
  }
  const noteRaw = formData.get('admin_note');
  const note =
    typeof noteRaw === 'string' && noteRaw.trim().length > 0 ? noteRaw.trim() : null;

  const { admin, req } = await loadPendingRequest(requestId);

  // Mark approved before the cascade removes the row.
  const { error: updErr } = await admin
    .from('account_deletion_requests')
    .update({
      status: 'approved',
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      admin_note: note,
    })
    .eq('request_id', requestId)
    .eq('status', 'pending');
  if (updErr) throw new Error(updErr.message);

  // Delegate to the EXISTING admin deletion logic. Both actions re-check admin
  // auth + their own safety guards (can't delete self / internal accounts) and
  // read `user_id` off the FormData.
  const proxyForm = new FormData();
  proxyForm.set('user_id', req.user_id);
  if (mode === 'blacklist') {
    if (note) proxyForm.set('reason', note);
    await blacklistUser(proxyForm);
  } else {
    await deleteUser(proxyForm);
  }

  revalidatePath('/admin/account-deletions');
  revalidatePath('/admin/users');
  redirect('/admin/account-deletions?actioned=approved');
}

export async function approveAndDelete(formData: FormData) {
  await approveRequest(formData, 'delete');
}

export async function approveAndBlacklist(formData: FormData) {
  await approveRequest(formData, 'blacklist');
}

/**
 * Reject a deletion request (account stays active). A note is required so the
 * audit trail explains why — e.g. "active booking · asked couple to settle the
 * balance first".
 */
export async function rejectRequest(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const requestId = formData.get('request_id');
  if (typeof requestId !== 'string' || requestId.length === 0) {
    throw new Error('Invalid input');
  }
  const noteRaw = formData.get('admin_note');
  if (typeof noteRaw !== 'string' || noteRaw.trim().length < 5) {
    throw new Error('Write a short reason (at least 5 characters) for the rejection.');
  }
  const note = noteRaw.trim();

  const { admin } = await loadPendingRequest(requestId);

  const { error } = await admin
    .from('account_deletion_requests')
    .update({
      status: 'rejected',
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      admin_note: note,
    })
    .eq('request_id', requestId)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);

  revalidatePath('/admin/account-deletions');
  redirect('/admin/account-deletions?actioned=rejected');
}
