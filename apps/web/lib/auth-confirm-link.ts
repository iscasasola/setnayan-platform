/**
 * auth-confirm-link.ts — the shape of a recovery/sign-in link that works in
 * ANY browser.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────
 * Measured on production 2026-09-18:
 *
 *   curl -sD - "https://www.setnayan.com/auth/callback?code=probe&next=%2Freset-password"
 *   → 307 /login?error=PKCE%20code%20verifier%20not%20found%20in%20storage…
 *
 * `supabase.auth.resetPasswordForEmail()` called from an `@supabase/ssr`
 * client is a **PKCE** flow: it mints a code verifier and stores it in a
 * cookie on the browser that asked. The email then carries a `?code=`, and
 * `exchangeCodeForSession` can only complete it **in that same browser**.
 *
 * 🔑 THAT IS EXACTLY THE BROWSER A LOCKED-OUT PERSON IS NOT IN. They ask for
 * the reset on a laptop and open the mail on their phone; or they ask in a
 * private window; or the cookie is simply gone by the time the mail arrives.
 * The flow is not flaky — it is structurally unable to finish for the most
 * ordinary way anybody uses it.
 *
 * ✅ THE OTHER HALF OF THE SAME SDK IS BROWSER-INDEPENDENT. `verifyOtp({
 * type, token_hash })` carries its whole proof in the URL: nothing is stored
 * client-side, so any browser on any device can complete it. This module holds
 * the two decisions that link is made of — which OTP types we are willing to
 * accept, and how the URL is spelled — as PURE functions, because
 * `app/auth/confirm/route.ts` is `server-only` and a guard can then only grep
 * it. Here they can be EXECUTED.
 */

/**
 * OTP types `/auth/confirm` will accept.
 *
 * ⚖ AN ALLOWLIST, NOT A CAST. `type` arrives on a query string, so anyone can
 * type anything into it. Passing it through to `verifyOtp` unchecked hands a
 * stranger the choice of which verification ceremony runs — so the route
 * accepts only the ceremonies WE issue links for and refuses everything else.
 *
 * `recovery` is the one this was built for. The rest are the other email
 * links Supabase can mint for us and are listed so a later sender does not
 * have to reopen this decision — each is still a single-use, server-verified
 * token; none of them is a password.
 */
export const CONFIRM_OTP_TYPES = [
  'recovery',
  'magiclink',
  'email',
  'invite',
  'email_change',
] as const;

export type ConfirmOtpType = (typeof CONFIRM_OTP_TYPES)[number];

/**
 * The `type` query param as one of ours, or `null`.
 *
 * ⚠ `null` MEANS REFUSE. The caller must not fall back to a default: guessing
 * `recovery` for an unrecognised type would run the password-recovery
 * ceremony on a token minted for something else.
 */
export function parseConfirmOtpType(raw: unknown): ConfirmOtpType | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  return (CONFIRM_OTP_TYPES as readonly string[]).includes(s)
    ? (s as ConfirmOtpType)
    : null;
}

/**
 * Spell the link we email.
 *
 * Every part is encoded: `token_hash` is opaque bytes from GoTrue and `next`
 * is a path that routinely carries its own query string. An unencoded `next`
 * of `/reset-password?x=1` would otherwise end the `token_hash` early and the
 * link would arrive with no proof on it at all.
 */
export function buildConfirmUrl(params: {
  appUrl: string;
  tokenHash: string;
  type: ConfirmOtpType;
  next: string;
}): string {
  const base = params.appUrl.replace(/\/+$/, '');
  const q = new URLSearchParams({
    token_hash: params.tokenHash,
    type: params.type,
    next: params.next,
  });
  return `${base}/auth/confirm?${q.toString()}`;
}
