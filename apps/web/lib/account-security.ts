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
