import 'server-only';

export type SendEmailArgs = {
  to: string;
  subject: string;
  /** Plain-text body — the fallback + canonical content. Always required. */
  text: string;
  /**
   * Optional branded HTML body. When set, Resend sends multipart — HTML-capable
   * clients render the branded version, the rest fall back to `text`. Build via
   * `lib/email-template.ts` → renderBrandedEmail().
   */
  html?: string;
  replyTo?: string;
  /**
   * Optional future send time (ISO 8601). Resend holds the email and delivers
   * it at this moment — up to 30 days out — so timed notifications need no cron
   * on our side. Omit for immediate send.
   */
  scheduledAt?: string;
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
      ...(args.html ? { html: args.html } : {}),
      replyTo: args.replyTo,
      ...(args.scheduledAt ? { scheduledAt: args.scheduledAt } : {}),
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

/**
 * Cancel a previously-scheduled (future-dated) Resend email by id. Used to pull
 * back the Papic sampler T-7/T-1 expiry warnings once the couple converts — their
 * photos became permanent, so the "your free photos roll off" reminder would be
 * wrong. Gated on the key and best-effort; returns whether the cancel succeeded.
 */
export async function cancelScheduledEmail(id: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !id) return false;
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    await resend.emails.cancel(id);
    return true;
  } catch (e) {
    console.error('[email] resend cancel failed:', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Vendor invite — couple-initiated claim invite (iterations 0006 + 0022,
// locked 2026-05-19). Plain-text body with the claim link. HTML template
// can be layered on later without touching callers.
// ---------------------------------------------------------------------------

export type VendorInviteEmailArgs = {
  to: string;
  businessName: string;
  coupleDisplayName: string;
  serviceCategory: string;
  eventDate: string | null;
  claimUrl: string;
};

export async function sendVendorInviteEmail(
  args: VendorInviteEmailArgs,
): Promise<SendEmailResult> {
  const dateLine = args.eventDate
    ? new Date(args.eventDate).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'their upcoming wedding';

  return sendEmail({
    to: args.to,
    subject: `${args.coupleDisplayName} added you as their ${args.serviceCategory} on Setnayan`,
    text: [
      `Hi ${args.businessName},`,
      ``,
      `${args.coupleDisplayName} is planning their wedding on ${dateLine} using Setnayan, and added you as their ${args.serviceCategory}.`,
      ``,
      `Claim your free Setnayan profile here:`,
      args.claimUrl,
      ``,
      `On signup you'll see everything they've recorded so far, and the in-app chat unlocks immediately so you can confirm details.`,
      ``,
      `Not the right vendor? Just ignore this email — we won't follow up.`,
      ``,
      `—`,
      `Set na 'yan.`,
    ].join('\n'),
  });
}
