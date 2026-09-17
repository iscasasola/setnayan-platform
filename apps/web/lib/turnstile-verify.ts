import 'server-only';

/**
 * turnstile-verify.ts — verify a Turnstile token OURSELVES.
 *
 * ─── WHY THIS HAD TO EXIST ───────────────────────────────────────────────
 * lib/turnstile.ts says, correctly for every flow it was written for:
 *
 *   "The Turnstile *secret* is never in the app — it lives only in Supabase's
 *    captcha config, which is where GoTrue verifies the token."
 *
 * That holds while every protected call is a `supabase.auth.*` call. It stops
 * holding the moment a flow leaves GoTrue. /forgot-password did exactly that
 * on 2026-09-18: it now mints the recovery link with the ADMIN API and posts
 * the mail through Resend, because the GoTrue path could only ever complete in
 * the browser that asked. Nobody was left to check the captcha.
 *
 * 🔑 A BOT CHECK NOBODY VERIFIES IS INDISTINGUISHABLE FROM NO BOT CHECK — and
 * it looks *more* protected than having none, because the widget still renders
 * and the hidden field still arrives. This module is the missing verifier.
 *
 * ⚖ SAME GRACEFUL-OFF INVARIANT AS ITS SIBLING. With no secret set, this is
 * inert and reports `configured: false` — behaviour identical to today, so
 * shipping it changes nothing until the owner sets `TURNSTILE_SECRET_KEY`.
 * With a secret set it fails CLOSED: an absent, malformed, or rejected token
 * is a refusal, and so is a Cloudflare outage. A captcha that passes when the
 * verifier is unreachable protects nobody.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileVerdict = {
  /** False when no secret is set — the check is switched off, not passed. */
  configured: boolean;
  /** May this request proceed? `true` when unconfigured (inert). */
  ok: boolean;
};

const secret = () => (process.env.TURNSTILE_SECRET_KEY ?? '').trim();

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileVerdict> {
  const key = secret();
  if (!key) return { configured: false, ok: true };

  const t = (token ?? '').trim();
  // Configured but nothing submitted → refuse. This is the fail-closed half:
  // a bot that simply omits the field must not be treated as a person whose
  // widget had not finished.
  if (!t) return { configured: true, ok: false };

  try {
    const body = new URLSearchParams({ secret: key, response: t });
    if (remoteIp) body.set('remoteip', remoteIp);
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
    if (!res.ok) return { configured: true, ok: false };
    const json = (await res.json()) as { success?: boolean };
    return { configured: true, ok: json.success === true };
  } catch {
    // Network failure, DNS, timeout. Refuse — see the fail-closed note above.
    return { configured: true, ok: false };
  }
}
