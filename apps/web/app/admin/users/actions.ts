'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

export async function toggleTeamMember(formData: FormData) {
  await requireAdmin();
  const targetUserId = formData.get('user_id');
  const desiredRaw = formData.get('desired');
  if (typeof targetUserId !== 'string' || typeof desiredRaw !== 'string') {
    throw new Error('Invalid input');
  }
  const desired = desiredRaw === 'true';

  const admin = createAdminClient();
  const { error } = await admin
    .from('users')
    .update({ is_team_member: desired, updated_at: new Date().toISOString() })
    .eq('user_id', targetUserId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/users');
}

/**
 * Soft-delete a user account. Sets `deleted_at` on public.users AND bans the
 * auth.users row so the user cannot sign back in. Reversible via
 * `restoreUserAccount`. Internal/team-pool callers only.
 *
 * Safety guards:
 * - Cannot delete yourself.
 * - Cannot delete an internal account (owner/§ 10a). Use Supabase dashboard
 *   for that — it requires escalated intentionality.
 */
export async function softDeleteUser(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const targetUserId = formData.get('user_id');
  if (typeof targetUserId !== 'string') {
    throw new Error('Invalid input');
  }
  if (targetUserId === adminUserId) {
    throw new Error('You cannot delete your own account from this page');
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('users')
    .select('is_internal')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (target?.is_internal) {
    throw new Error('Cannot delete an internal account');
  }

  const now = new Date().toISOString();
  const { error: dbError } = await admin
    .from('users')
    .update({ deleted_at: now, updated_at: now })
    .eq('user_id', targetUserId);
  if (dbError) throw new Error(dbError.message);

  // 100-year ban — effectively forever. Lifted by `restoreUserAccount`.
  await admin.auth.admin.updateUserById(targetUserId, {
    ban_duration: `${100 * 365 * 24}h`,
  });

  revalidatePath('/admin/users');
}

/**
 * Permanently delete a user account. Removes the row from auth.users — which
 * cascades to public.users via the FK. The user's auth identity is gone
 * forever; you can't restore from here.
 *
 * Only allowed on users that have already been soft-deleted. Forces a
 * two-step intentionality model: soft-delete first (which gives a recovery
 * window via Restore), then come back and confirm permanent removal.
 */
export async function permanentDeleteUser(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const targetUserId = formData.get('user_id');
  if (typeof targetUserId !== 'string') {
    throw new Error('Invalid input');
  }
  if (targetUserId === adminUserId) {
    throw new Error('You cannot delete your own account from this page');
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('users')
    .select('is_internal, deleted_at')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (!target) {
    throw new Error('User not found');
  }
  if (target.is_internal) {
    throw new Error('Cannot delete an internal account');
  }
  if (!target.deleted_at) {
    throw new Error('Soft-delete first, then come back to permanently delete');
  }

  const { error } = await admin.auth.admin.deleteUser(targetUserId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/users');
}

/**
 * Restore a soft-deleted account. Clears `deleted_at` AND lifts the auth ban
 * so the user can sign in again. Internal/team-pool only.
 */
export async function restoreUserAccount(formData: FormData) {
  await requireAdmin();
  const targetUserId = formData.get('user_id');
  if (typeof targetUserId !== 'string') {
    throw new Error('Invalid input');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('users')
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq('user_id', targetUserId);
  if (error) throw new Error(error.message);

  // Lift the auth ban so the user can sign in again.
  await admin.auth.admin.updateUserById(targetUserId, {
    ban_duration: 'none',
  });

  revalidatePath('/admin/users');
}

/**
 * Generates a 12-char temporary password (no ambiguous chars like 0/O/1/l),
 * sets it on the target account via the admin API, and redirects with the
 * temp password in a transient query param so the admin can copy + share it.
 *
 * Useful when Supabase's outbound email isn't wired (no Resend SMTP yet)
 * and a user can't reset their own password. Internal/team-pool only.
 */
export async function resetUserPassword(formData: FormData) {
  await requireAdmin();
  const targetUserId = formData.get('user_id');
  if (typeof targetUserId !== 'string') {
    throw new Error('Invalid input');
  }

  const tempPassword = generateTempPassword();

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('users')
    .select('email')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (!existing?.email) {
    throw new Error('User not found');
  }

  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    password: tempPassword,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/admin/users');
  redirect(
    `/admin/users?temp_password=${encodeURIComponent(tempPassword)}&for_email=${encodeURIComponent(existing.email)}`,
  );
}

function generateTempPassword(): string {
  // Drop visually ambiguous chars (0, O, 1, I, l) so the password is easy to
  // dictate over the phone if needed.
  const alphabet =
    'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => alphabet[b % alphabet.length])
    .join('');
}

/**
 * Manually confirm a user's email — useful when Supabase's outbound email
 * doesn't arrive (rate limit, spam folder, misconfigured SMTP, etc.).
 * Internal/team-pool only.
 */
export async function confirmUserEmail(formData: FormData) {
  await requireAdmin();
  const targetUserId = formData.get('user_id');
  if (typeof targetUserId !== 'string') {
    throw new Error('Invalid input');
  }

  const admin = createAdminClient();
  // GoTrue admin API: PUT /auth/v1/admin/users/{id} { email_confirm: true }.
  // The supabase-js SDK exposes this via auth.admin.updateUserById.
  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    email_confirm: true,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/admin/users');
}
