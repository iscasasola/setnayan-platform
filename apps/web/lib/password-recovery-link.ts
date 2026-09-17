import 'server-only';

/**
 * password-recovery-link.ts — mint a recovery link and post it ourselves.
 *
 * EXTENDS the shape already shipped in lib/event-account-link.ts: generate the
 * link with the ADMIN API (which does not send mail), deliver through Resend.
 * That file's reasoning applies here word for word — "Supabase's built-in
 * mailer is rate-limited + spam-prone here" — and one more reason it did not
 * have to state:
 *
 * 🔑 THE ADMIN API'S LINK IS NOT BOUND TO A BROWSER. `resetPasswordForEmail`
 * is PKCE: the verifier lives in a cookie on the machine that asked, so the
 * mail only works if opened there. `generateLink` hands back a `hashed_token`
 * instead, which /auth/confirm verifies server-side on any device. See
 * lib/auth-confirm-link.ts for the production measurement.
 *
 * ⚖ ANTI-ENUMERATION IS PRESERVED BY THE CALLER, NOT HERE. `generateLink`
 * errors for an address with no account, so this returns `{ sent: false }` for
 * both "no such user" and "Resend is down" — the caller shows the same neutral
 * confirmation either way and never branches on which.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { buildConfirmUrl } from '@/lib/auth-confirm-link';

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function sendPasswordRecoveryLink(
  rawEmail: string,
): Promise<{ sent: boolean }> {
  const email = rawEmail.trim();
  if (!email) return { sent: false };

  let tokenHash: string | undefined;
  try {
    const { data, error } = await createAdminClient().auth.admin.generateLink({
      type: 'recovery',
      email,
    });
    if (error) return { sent: false };
    tokenHash = data?.properties?.hashed_token;
  } catch {
    // createAdminClient() THROWS on a missing/misconfigured service-role key —
    // it does not return {error}. Same treatment as auth/callback's promotion
    // block: a throw is an outcome, not a crash.
    return { sent: false };
  }
  if (!tokenHash) return { sent: false };

  // ⚠ NOT `data.properties.action_link`. That one points at GoTrue's own
  // /auth/v1/verify and lands back on redirect_to carrying an implicit-flow
  // fragment (#access_token=…) that a SERVER route cannot read — the same
  // class of dead end as the PKCE code, reached a different way. We spell our
  // own URL at our own route, which reads the token from the query string.
  const link = buildConfirmUrl({
    appUrl: appUrl(),
    tokenHash,
    type: 'recovery',
    next: '/reset-password',
  });

  const result = await sendEmail({
    to: email,
    subject: 'Reset your Setnayan password',
    text: [
      `Someone asked to reset the password for this Setnayan account.`,
      ``,
      `Open the link below to choose a new one. It works once, on any device —`,
      `you can safely open it on your phone even if you asked from a computer:`,
      ``,
      link,
      ``,
      `The link expires shortly. If you didn't ask for this, you can ignore this`,
      `email — your password stays exactly as it is.`,
      ``,
      `—`,
      `Set na 'yan.`,
    ].join('\n'),
  });

  return { sent: result.ok };
}
