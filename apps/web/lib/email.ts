import 'server-only';

export type SendEmailArgs = {
  to: string;
  subject: string;
  /** Plain-text body. HTML rendering is a follow-on. */
  text: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string; via: 'resend' }
  | { ok: false; reason: 'not_configured' | 'send_failed'; error?: string };

/**
 * Sends a single email via Resend. Gated entirely on env vars — when
 * RESEND_API_KEY is missing, the call no-ops and returns
 * { ok: false, reason: 'not_configured' } so callers can log and move on
 * without throwing. The day the owner pastes a Resend key into Vercel,
 * every notification emit also fires an email without code changes.
 *
 * From address comes from RESEND_FROM_ADDRESS (e.g. "Setnayan <noreply@
 * setnayan.com>") — the canonical name used in `.env.example` and
 * `OWNER_ACTIONS.md` Phase 2. `RESEND_FROM_EMAIL` is also accepted as a
 * legacy alias. If neither is set, falls back to Resend's verified sandbox
 * domain via `onboarding@resend.dev` — useful for smoke-testing, but the
 * sandbox only delivers to the Resend account holder's own email address.
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: 'not_configured' };
  }

  const fromEmail =
    process.env.RESEND_FROM_ADDRESS ??
    process.env.RESEND_FROM_EMAIL ??
    'onboarding@resend.dev';

  try {
    // Lazy-import so the bundle stays clean for builds where Resend isn't used.
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      replyTo: args.replyTo,
    });
    if (error || !data) {
      console.error('[email] resend send failed:', error);
      return { ok: false, reason: 'send_failed', error: error?.message };
    }
    return { ok: true, id: data.id, via: 'resend' };
  } catch (e) {
    console.error('[email] resend send threw:', e);
    return { ok: false, reason: 'send_failed', error: String(e) };
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
