'use server';

/**
 * Shared account-security server actions — change password (with current-
 * password verification) + sign out other devices. One module serves all
 * three doorways: the customer + admin profile at /dashboard/profile and the
 * vendor profile at /vendor-dashboard/profile. Each form posts a hidden
 * `return_to` field (allowlisted via safeSecurityReturnPath) so notices land
 * back on the page the user was on, using each surface's existing
 * query-param notice pattern.
 *
 * WHY a throwaway stateless client for current-password verification: the
 * repo's cookie-backed server client (lib/supabase/server.ts) persists every
 * auth write into the sb-* cookies via setAll — which WORKS inside a server
 * action. Calling signInWithPassword through it would mint a brand-new
 * session and clobber the user's real session cookies. A bare
 * @supabase/supabase-js client with persistSession:false keeps the
 * verification completely stateless; the throwaway session it mints is
 * revoked server-side immediately after (scope:'local' — never 'global',
 * which would sign the user out everywhere).
 *
 * 0028 security email: changePassword() emits a `security_alert`
 * notification (in-app + email via the emitNotification funnel) after the
 * password update succeeds — wired 2026-06-12 alongside migration
 * 20261116000000_notification_type_security_alert.sql (the enum change PR
 * #1262 deliberately skipped). Fire-and-forget via Next's after() so a slow
 * Resend call can never delay the redirect. signOutOtherDevices()
 * intentionally does NOT emit — it's the remedy, not the threat.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient as createStatelessClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { emitNotification } from '@/lib/notification-emit';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import {
  safeSecurityReturnPath,
  validateNewPassword,
} from '@/lib/account-security';

export async function changePassword(formData: FormData) {
  const returnTo = safeSecurityReturnPath(formData.get('return_to'));
  const currentPassword = formData.get('current_password');
  const newPassword = formData.get('new_password');
  const confirmPassword = formData.get('confirm_password');

  if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
    return redirect(`${returnTo}?error=${encodeURIComponent('Invalid input')}`);
  }
  if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
    return redirect(
      `${returnTo}?error=${encodeURIComponent('Enter your current password')}`,
    );
  }
  const validationError = validateNewPassword(newPassword, confirmPassword);
  if (validationError) {
    return redirect(`${returnTo}?error=${encodeURIComponent(validationError)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!user.email) {
    // OAuth-only identities without an email can't be password-verified.
    return redirect(
      `${returnTo}?error=${encodeURIComponent(
        'Your account signs in without a password. Use the reset link on the sign-in page to set one.',
      )}`,
    );
  }

  // Verify the CURRENT password on a throwaway stateless client so the
  // verification sign-in can never rewrite the real session cookies.
  const stateless = createStatelessClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const { error: verifyError } = await stateless.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return redirect(
      `${returnTo}?error=${encodeURIComponent(
        'Current password is incorrect. If you signed up with Google/Facebook or a magic link, use the reset link on the sign-in page instead.',
      )}`,
    );
  }
  // Best-effort: revoke the throwaway verification session server-side so it
  // doesn't linger as a live refresh token. scope:'local' kills ONLY that
  // session — never the user's real one.
  try {
    await stateless.auth.signOut({ scope: 'local' });
  } catch {
    // Non-fatal — the orphan session expires on its own.
  }

  // supabase.auth.updateUser works for the signed-in user to set their own
  // password — no admin client needed, the session token authorizes the call.
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Change password',
      file_path: 'lib/account-security-actions.ts',
      error_message: error.message,
      payload_snapshot: { userId: user.id },
    });
    return redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);
  }

  // 0028 template #10 — security_alert. Best-effort + non-blocking: after()
  // runs once the response is sent, and emitNotification itself never throws
  // (it logs and continues), so the redirect is never held hostage by a slow
  // notifications insert or Resend call. relatedUrl = the profile page that
  // hosts the Security section (allowlisted returnTo), so the email's "Open
  // Setnayan" link and the in-app notification both land there.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://setnayan-platform-web.vercel.app';
  const alertUserId = user.id;
  after(() =>
    emitNotification({
      userId: alertUserId,
      type: 'security_alert',
      title: 'Your Setnayan password was changed',
      body:
        'Your password was just changed from your profile’s Security section. ' +
        'If this was you, no action is needed. If this wasn’t you, reset your ' +
        `password immediately (${appUrl}/forgot-password) and use “Sign out ` +
        'other devices” in the Security section of your profile.',
      relatedUrl: returnTo,
    }),
  );

  revalidatePath(returnTo);
  redirect(`${returnTo}?password_changed=1`);
}

/**
 * "Sign out other devices" — revokes every session EXCEPT the current one
 * (scope:'others' never touches the local session, so the sb-* cookies and
 * the page the user is on stay intact).
 */
export async function signOutOtherDevices(formData: FormData) {
  const returnTo = safeSecurityReturnPath(formData.get('return_to'));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Sign out other devices',
      file_path: 'lib/account-security-actions.ts',
      error_message: error.message,
      payload_snapshot: { userId: user.id },
    });
    return redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`${returnTo}?signed_out_others=1`);
}
