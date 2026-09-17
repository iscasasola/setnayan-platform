'use server';

/**
 * /forgot-password server action — starts the Supabase password-recovery flow.
 *
 * ─── REBUILT 2026-09-18 · THE LINK NOW WORKS ON THE PHONE ────────────────
 * This used to call `supabase.auth.resetPasswordForEmail`, which under
 * `@supabase/ssr` is a **PKCE** flow: the code verifier is stored in a cookie
 * on the browser that asked, and the emailed `?code=` can only be exchanged
 * there. Measured on production that morning:
 *
 *   curl -sD - "https://www.setnayan.com/auth/callback?code=probe&next=%2Freset-password"
 *   → 307 /login?error=PKCE%20code%20verifier%20not%20found%20in%20storage…
 *
 * 🔑 ASK ON THE LAPTOP, OPEN THE MAIL ON THE PHONE — the single most ordinary
 * way anybody does this — AND THE RESET COULD NOT COMPLETE. Not flaky:
 * structurally unable to finish. This is the one page a locked-out person
 * reaches, so the failure had nowhere to fall through to.
 *
 * Now: mint the link with the admin API (`generateLink` → `hashed_token`) and
 * deliver it through Resend, landing on /auth/confirm, which verifies the
 * token server-side. Nothing is read from client storage, so any device works.
 * That is the shape lib/event-account-link.ts has shipped since June — this is
 * the sibling catching up, not a new mechanism.
 *
 * Anti-enumeration: every outcome except our own rate-limit still collapses to
 * the SAME neutral `?sent=1` confirmation — the page never reveals whether an
 * account exists for the submitted email.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { rateLimit } from '@/lib/rate-limit';
import { sendPasswordRecoveryLink } from '@/lib/password-recovery-link';
// 🔴 CAPTCHA (2026-08-11). Supabase's captcha switch is GLOBAL and it gates
// password RECOVERY as well as sign-in — and this route is THE WAY OUT of a
// lockout, linked straight off the sign-in card. Unwired, the one page someone
// reaches when they cannot get in is the page that silently refuses them.
import { captchaTokenFromForm } from '@/lib/turnstile';
import { verifyTurnstileToken } from '@/lib/turnstile-verify';

/**
 * 🚨 WE ARE NOW THE RATE LIMITER, BECAUSE WE ARE NOW THE MAILER.
 *
 * GoTrue used to cap this for us as a side effect of sending the mail. Moving
 * to `generateLink` + Resend took that cap away along with the browser
 * binding, and losing a protection while fixing a bug is how a fix becomes a
 * regression. Without this, one POST loop mails somebody a reset link as fast
 * as Resend will accept them.
 *
 * ⚠ HONEST LIMITATION, stated in lib/rate-limit.ts and repeated here because
 * this is a security control: the buckets are per-instance and in-memory on
 * Vercel, so this blunts a flood against one warm instance rather than
 * guaranteeing a global cap. It is defence in depth with zero new infra, not
 * the last word. The durable version is the same follow-up that file names.
 */
const PER_EMAIL_LIMIT = 3;
const PER_EMAIL_WINDOW_MS = 15 * 60_000;
const PER_IP_LIMIT = 10;
const PER_IP_WINDOW_MS = 15 * 60_000;

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) {
    return redirect('/forgot-password?error=missing');
  }

  // Turnstile token from the <TurnstileField> on ./page.tsx.
  //
  // 🔑 SOMEBODY HAS TO CHECK IT NOW. It used to ride along to GoTrue, which
  // verified it; this flow no longer reaches GoTrue, so the token would have
  // arrived and been believed by nobody — a bot check that renders and
  // protects nothing. verifyTurnstileToken() is inert while
  // TURNSTILE_SECRET_KEY is unset (identical to today) and fails closed once
  // it is set.
  const verdict = await verifyTurnstileToken(
    captchaTokenFromForm(formData),
    (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  );
  if (!verdict.ok) {
    // 🚨 A FAILED BOT CHECK MUST NOT BE TOLD "we've sent you a link".
    // The neutral copy is a lie here: nothing was sent, and the person is left
    // waiting on the one page they reach when they are already locked out.
    // Safe to say out loud — the check is decided before any account lookup,
    // so it reveals nothing about whether the address exists.
    return redirect('/forgot-password?error=captcha');
  }

  // Key on the lowercased address so case variants share one bucket.
  const emailKey = `pwreset:email:${email.toLowerCase()}`;
  if (!rateLimit(emailKey, PER_EMAIL_LIMIT, PER_EMAIL_WINDOW_MS).ok) {
    return redirect('/forgot-password?error=rate_limited');
  }
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim();
  if (ip && !rateLimit(`pwreset:ip:${ip}`, PER_IP_LIMIT, PER_IP_WINDOW_MS).ok) {
    return redirect('/forgot-password?error=rate_limited');
  }

  // ⚖ THE RESULT IS DELIBERATELY NOT BRANCHED ON. "No such account" and
  // "Resend refused" both return { sent: false }, and both show the neutral
  // confirmation — branching here is exactly how a reset form becomes an
  // account-existence oracle.
  const { sent } = await sendPasswordRecoveryLink(email);
  if (!sent) {
    // eslint-disable-next-line no-console
    console.error('[forgot-password] no recovery link sent for the submitted address');
  }

  return redirect('/forgot-password?sent=1');
}
