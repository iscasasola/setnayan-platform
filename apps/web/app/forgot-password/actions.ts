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
// 🔴 CAPTCHA (2026-08-11). Supabase's captcha switch is GLOBAL and it gates
// password RECOVERY as well as sign-in — and this route is THE WAY OUT of a
// lockout, linked straight off the sign-in card. Unwired, the one page someone
// reaches when they cannot get in is the page that silently refuses them. It
// was missed because OWNER_ACTIONS.md said every auth form was wired; this
// route is younger than that sentence and was never in it.
import { captchaOptions, captchaTokenFromForm } from '@/lib/turnstile';

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) {
    return redirect('/forgot-password?error=missing');
  }

  // Same site-URL convention as the magic-link + OAuth flows
  // (app/login/actions.ts · app/auth/oauth-actions.ts).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const supabase = await createClient();
  // Turnstile token from the <TurnstileField> on ./page.tsx. Empty (no site key)
  // → captchaOptions() yields {} → byte-identical to the pre-captcha call.
  const captchaToken = captchaTokenFromForm(formData);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
    ...captchaOptions(captchaToken),
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
