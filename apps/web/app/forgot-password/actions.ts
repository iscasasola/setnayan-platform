'use server';

/**
 * /forgot-password server action — starts the Supabase password-recovery
 * flow. The recovery email lands the user on the EXISTING /auth/callback
 * route (the same code-exchange mechanics the magic-link flow uses:
 * exchangeCodeForSession on `?code=`), which then forwards to
 * /reset-password where the new password is set.
 *
 * Anti-enumeration: every outcome except a rate-limit collapses to the SAME
 * neutral `?sent=1` confirmation — the page never reveals whether an account
 * exists for the submitted email.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAuthRateLimitError } from '@/lib/account-security';

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) {
    return redirect('/forgot-password?error=missing');
  }

  // Same site-URL convention as the magic-link + OAuth flows
  // (app/login/actions.ts · app/auth/oauth-actions.ts).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
  });

  if (error) {
    if (isAuthRateLimitError(error.status, error.message)) {
      return redirect('/forgot-password?error=rate_limited');
    }
    // Anything else (including any "user not found"-shaped response) still
    // shows the neutral confirmation. Log server-side for ops visibility.
    // eslint-disable-next-line no-console
    console.error('[forgot-password] resetPasswordForEmail failed:', error.message);
  }

  return redirect('/forgot-password?sent=1');
}
