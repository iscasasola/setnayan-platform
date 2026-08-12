/**
 * Account-security pure helpers — shared by the change-password /
 * sign-out-other-devices server actions (lib/account-security-actions.ts)
 * and the password-recovery flow (/forgot-password + /reset-password).
 *
 * WHY a separate module from the actions file: a `'use server'` module may
 * only export async functions, so the synchronous helpers (and their unit
 * tests in account-security.test.ts) must live outside it.
 */

/**
 * Surfaces that may host the shared change-password / sign-out-others
 * forms. The forms post a hidden `return_to` field naming their own page so
 * one shared action can serve all three doorways (customer + admin share
 * /dashboard/profile; vendors have /vendor-dashboard/profile). Allowlisted —
 * never trust a raw user-supplied path in a redirect.
 */
export const SECURITY_RETURN_PATHS = [
  '/dashboard/profile',
  '/vendor-dashboard/profile',
] as const;

export type SecurityReturnPath = (typeof SECURITY_RETURN_PATHS)[number];

/** Coerce a form-supplied return path to the allowlist (default: customer profile). */
export function safeSecurityReturnPath(raw: unknown): SecurityReturnPath {
  if (
    typeof raw === 'string' &&
    (SECURITY_RETURN_PATHS as readonly string[]).includes(raw)
  ) {
    return raw as SecurityReturnPath;
  }
  return '/dashboard/profile';
}

/**
 * New-password validation shared by change-password AND reset-password.
 * Mirrors the original /dashboard/profile changePassword rules (min 8 +
 * confirm match). Returns a user-facing error string, or null when valid.
 */
export function validateNewPassword(
  newPassword: string,
  confirmPassword: string,
): string | null {
  if (newPassword.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (newPassword !== confirmPassword) {
    return 'Passwords do not match';
  }
  return null;
}

/**
 * Post-reset landing: route each account type to its own doorway. Mirrors
 * the /dashboard layout's vendor redirect (account_type='vendor' →
 * /vendor-dashboard) and the admin doorway at /admin. Everyone else —
 * customers, plus internal/team-pool members whose account_type stays
 * 'customer' — lands on /dashboard, which already knows how to route them.
 */
export function accountHomePath(accountType: string | null | undefined): string {
  if (accountType === 'vendor') return '/vendor-dashboard';
  if (accountType === 'admin') return '/admin';
  return '/dashboard';
}

/**
 * Detect Supabase Auth rate-limit responses ("For security purposes, you can
 * only request this after N seconds." / "Email rate limit exceeded" / HTTP
 * 429) so /forgot-password can show a friendly "please wait" message instead
 * of the neutral sent-confirmation. Every OTHER error collapses to the
 * neutral confirmation — never reveal whether an account exists.
 */
export function isAuthRateLimitError(
  status: number | undefined,
  message: string | undefined,
): boolean {
  if (status === 429) return true;
  if (!message) return false;
  return /rate limit|only request this after|too many requests/i.test(message);
}

/**
 * Detect a FAILED BOT CHECK from Supabase Auth ("captcha protection: request
 * disallowed (invalid-input-response)", "captcha verification process failed",
 * code `captcha_failed`).
 *
 * 🚨 WHY THIS EXISTS. /forgot-password deliberately collapses every error to the
 * neutral "if that email exists, we've sent a link" confirmation, so that the
 * page can never be used to discover whether an account exists. That rule is
 * correct and stays. But it also swallowed a failed BOT CHECK — so the moment
 * captcha is switched on, a real person who fails it would be told a link was
 * sent and nothing would be sent. They would wait forever, on the one page
 * someone reaches when they already cannot get into their account.
 *
 * 🔑 A CAPTCHA FAILURE IS SAFE TO NAME, AND THAT IS THE WHOLE POINT. It is
 * decided BEFORE any account lookup — GoTrue rejects the request outright — so
 * saying "the bot check didn't pass" reveals nothing about whether the email is
 * registered. It is the one error here that carries no enumeration risk, which
 * is exactly why it must not hide behind the neutral confirmation.
 *
 * Matched on the word "captcha" rather than a status code: a failed check is a
 * 400, and so are several errors that MUST stay neutral. Matching the message is
 * narrower than matching the status, not wider.
 */
export function isCaptchaVerificationError(
  status: number | undefined,
  message: string | undefined,
  code?: string | undefined,
): boolean {
  if (code && /captcha/i.test(code)) return true;
  if (!message) return false;
  return /captcha/i.test(message);
}
