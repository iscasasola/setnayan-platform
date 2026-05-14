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
 * Hard-delete a user. Removes the auth.users row, which cascades to
 * public.users. The email is then free for re-signup — e.g., a vendor who
 * wants to re-register as a customer.
 *
 * To also block the email from being re-used, call `blacklistUser` instead.
 *
 * Safety guards:
 * - Cannot delete yourself
 * - Cannot delete is_internal accounts (owner / § 10a)
 */
export async function deleteUser(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const targetUserId = formData.get('user_id');
  if (typeof targetUserId !== 'string') throw new Error('Invalid input');
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

  const { error } = await admin.auth.admin.deleteUser(targetUserId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/users');
}

/**
 * Hard-delete a user AND add their email to the permanent blacklist. The
 * email is then rejected by the signup server action. Reverse with
 * `unblacklistEmail`.
 *
 * Safety guards:
 * - Cannot blacklist yourself
 * - Cannot blacklist is_internal accounts
 */
export async function blacklistUser(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const targetUserId = formData.get('user_id');
  const reasonRaw = formData.get('reason');
  if (typeof targetUserId !== 'string') throw new Error('Invalid input');
  if (targetUserId === adminUserId) {
    throw new Error('You cannot blacklist your own account from this page');
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('users')
    .select('is_internal, email')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (!target) throw new Error('User not found');
  if (target.is_internal) {
    throw new Error('Cannot blacklist an internal account');
  }
  if (!target.email) {
    throw new Error('User has no email to blacklist');
  }

  const reason =
    typeof reasonRaw === 'string' && reasonRaw.trim().length > 0
      ? reasonRaw.trim()
      : null;

  // Insert blacklist row FIRST so a failure here doesn't leave the user
  // deleted but not blacklisted. Duplicate-key just means the email is
  // already blacklisted — proceed to delete anyway.
  const { error: bError } = await admin.from('blacklisted_emails').insert({
    email: target.email.toLowerCase(),
    reason,
    blacklisted_by_user_id: adminUserId,
  });
  if (bError && !bError.message.toLowerCase().includes('duplicate')) {
    throw new Error(bError.message);
  }

  const { error: dError } = await admin.auth.admin.deleteUser(targetUserId);
  if (dError) throw new Error(dError.message);

  revalidatePath('/admin/users');
}

/**
 * Remove an email from the blacklist so it can be used to sign up again.
 * The associated auth/user record is already gone (was hard-deleted at
 * blacklist time), so this only clears the gate at the signup action.
 */
export async function unblacklistEmail(formData: FormData) {
  await requireAdmin();
  const blacklistId = formData.get('blacklist_id');
  if (typeof blacklistId !== 'string') throw new Error('Invalid input');

  const admin = createAdminClient();
  const { error } = await admin
    .from('blacklisted_emails')
    .delete()
    .eq('id', blacklistId);
  if (error) throw new Error(error.message);

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
  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    email_confirm: true,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/admin/users');
}
