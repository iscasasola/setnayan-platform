'use server';

/**
 * /reset-password server action — completes the password-recovery flow.
 *
 * The user arrives with a recovery session (the email link went through the
 * existing /auth/callback exchangeCodeForSession route, same mechanics as
 * magic-link login). With that session in the cookies we can:
 *   1. set the new password via supabase.auth.updateUser
 *   2. revoke every OTHER session (scope:'others') — a reset implies
 *      possible compromise, so any device holding the old session gets
 *      signed out; the just-established recovery session stays
 *   3. emit the 0028 `security_alert` notification (in-app + email) —
 *      "your password was changed" — wired 2026-06-12 alongside migration
 *      20261116000000_notification_type_security_alert.sql (the enum change
 *      PR #1262 deliberately skipped). Fire-and-forget via after().
 *   4. land the user on the right doorway for their account type
 *      (customer → /dashboard · vendor → /vendor-dashboard · admin → /admin)
 */

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { emitNotification } from '@/lib/notification-emit';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { accountHomePath, validateNewPassword } from '@/lib/account-security';
import { logQueryError } from '@/lib/supabase/error-detect';

export async function completePasswordReset(formData: FormData) {
  const newPassword = formData.get('new_password');
  const confirmPassword = formData.get('confirm_password');

  if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
    return redirect(
      `/reset-password?error=${encodeURIComponent('Invalid input')}`,
    );
  }
  const validationError = validateNewPassword(newPassword, confirmPassword);
  if (validationError) {
    return redirect(
      `/reset-password?error=${encodeURIComponent(validationError)}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // No session → the page itself renders the "link expired" state.
  if (!user) redirect('/reset-password');

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Reset password',
      file_path: 'app/reset-password/actions.ts',
      error_message: error.message,
      payload_snapshot: { userId: user.id },
    });
    return redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  // Security: a reset implies the old password may be compromised — revoke
  // every other session. Best-effort: a failure here must never strand the
  // user after their password already changed.
  const { error: signOutErr } = await supabase.auth.signOut({ scope: 'others' });
  if (signOutErr) {
    // eslint-disable-next-line no-console
    console.error(
      '[reset-password] signOut(others) failed:',
      signOutErr.message,
    );
  }

  // Land on the right doorway for the account type.
  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileErr) {
    logQueryError(
      'completePasswordReset (users)',
      profileErr,
      { user_id: user.id },
      'graceful_degrade',
    );
  }

  // 0028 template #10 — security_alert. Best-effort + non-blocking: after()
  // runs once the response is sent, and emitNotification itself never throws
  // (it logs and continues), so the redirect is never delayed by the
  // notifications insert or the Resend call. relatedUrl = the profile page
  // hosting the Security section for this doorway (customer + admin share
  // /dashboard/profile, mirroring SECURITY_RETURN_PATHS).
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://setnayan-platform-web.vercel.app';
  const securityProfilePath =
    profile?.account_type === 'vendor'
      ? '/vendor-dashboard/profile'
      : '/dashboard/profile';
  const alertUserId = user.id;
  after(() =>
    emitNotification({
      userId: alertUserId,
      type: 'security_alert',
      title: 'Your Setnayan password was changed',
      body:
        'Your password was just reset via the email recovery link, and all ' +
        'other devices were signed out. If this was you, no action is ' +
        'needed. If this wasn’t you, reset your password again immediately ' +
        `(${appUrl}/forgot-password) — your email inbox may also be ` +
        'compromised, so secure it first.',
      relatedUrl: securityProfilePath,
    }),
  );

  redirect(accountHomePath(profile?.account_type ?? null));
}
