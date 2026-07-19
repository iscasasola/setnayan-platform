import 'server-only';
import { renderBrandedEmail } from '@/lib/email-template';

// Renewal-reminder email (owner 2026-07-10 · recurring-billing scaffold).
//
// A daily CRON-FREE job (runRenewalReminders in lib/daily-email-jobs.ts, fired
// from public-page after() traffic) finds paid subscription orders
// whose prepaid window (`orders.expires_at`) is within N days and sends the buyer
// this "renew before {date}" note. V1 has NO auto-charge — renewal is a manual
// prepaid re-purchase, so the CTA points at pricing/checkout. This module only
// SHAPES the email; the cron does the DB read, the idempotency lock, and sendEmail.
//
// buildRenewalReminderEmail() is pure + side-effect-free (the 'server-only' guard
// keeps it off the client bundle, mirroring the other email modules).

export const RENEWAL_SUPPORT_EMAIL = 'support@setnayan.com';

export type RenewalReminderParts = {
  /** Buyer's display name (couple or vendor); falls back to "there". */
  name: string | null;
  /** Friendly product name, e.g. "Custom Subdomain". */
  productTitle: string;
  /** When access lapses (absolute). */
  expiresAt: Date;
  /** Absolute URL to renew (pricing / the item's checkout). */
  renewUrl: string;
};

export type RenewalReminderEmail = {
  subject: string;
  text: string;
  html: string;
};

/** "in 6 days" / "tomorrow" / "today" — pure, Manila-agnostic (caller passes the date). */
function daysPhrase(expiresAt: Date, now: Date): string {
  const ms = expiresAt.getTime() - now.getTime();
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/** Human date, Manila-local (PH audience). Pure. */
function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/**
 * Build the renewal-reminder email for one buyer. Pure: the caller pairs the
 * returned parts in sendEmail() and adds the RFC 8058 unsubscribe headers.
 */
export function buildRenewalReminderEmail(
  parts: RenewalReminderParts,
  now: Date = new Date(),
): RenewalReminderEmail {
  const { productTitle, expiresAt, renewUrl } = parts;
  const who = (parts.name ?? '').trim() || 'there';
  const when = daysPhrase(expiresAt, now);
  const dateStr = formatDate(expiresAt);

  const subject = `Your ${productTitle} renews ${when}`;

  const greeting = `Hi ${who},`;
  const p1 = `Your ${productTitle} on Setnayan is active through ${dateStr} — that's ${when}.`;
  const p2 = `To keep it running without interruption, renew before then. Renewal is a one-time prepaid year (no automatic charge — you're always in control of when you pay).`;
  const p3 = `If you'd rather let it lapse, no action is needed — it simply won't renew.`;

  const text = [greeting, '', p1, '', p2, '', p3, '', `Renew: ${renewUrl}`].join('\n');

  const html = renderBrandedEmail({
    heading: `Renew your ${productTitle}`,
    paragraphs: [greeting, p1, p2, p3],
    ctaLabel: 'Renew now',
    ctaHref: renewUrl,
    footnote: `Active through ${dateStr}. Questions? ${RENEWAL_SUPPORT_EMAIL}`,
  });

  return { subject, text, html };
}

/** RFC 8058 one-click-unsubscribe headers for this relationship mail. */
export function renewalUnsubscribeHeaders(): Record<string, string> {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/+$/, '');
  return {
    'List-Unsubscribe': `<${base}/settings/notifications>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
