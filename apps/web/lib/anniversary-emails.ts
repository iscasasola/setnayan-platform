import 'server-only';
import { renderBrandedEmail } from '@/lib/email-template';

// Anniversary "on this day" re-engagement email (PR-G).
//
// A daily CRON-FREE job (runAnniversaryDigest in lib/daily-email-jobs.ts, fired
// from public-page after() traffic) resolves the couples whose
// wedding anniversary is TODAY (via the couples_with_anniversary_today RPC) and
// sends each this warm "N years ago today — relive your day" recap. This module
// only SHAPES the email; the cron does the DB read, the idempotency lock, and
// the actual sendEmail() call.
//
// buildAnniversaryEmail() is pure + side-effect-free (the 'server-only' guard
// just keeps it off the client bundle, mirroring the other email modules). The
// copy is worded so it still reads right if a couple opens it late.

export const ANNIVERSARY_SUPPORT_EMAIL = 'support@setnayan.com';

export type AnniversaryEmailParts = {
  /** The couple's display name, e.g. "Maria & Jose". */
  coupleName: string;
  /** The event's display name (used as a gentle fallback in copy). */
  eventName: string;
  /** Whole years since the wedding (>= 1). */
  yearsAgo: number;
  /** Absolute URL to relive the day (their gallery / library). */
  ctaHref: string;
};

export type AnniversaryEmail = {
  subject: string;
  text: string;
  html: string;
};

/** "1 year" vs "3 years" — keep the plural honest. Pure. */
function yearsPhrase(yearsAgo: number): string {
  const n = Math.max(1, Math.trunc(yearsAgo));
  return n === 1 ? '1 year' : `${n} years`;
}

/**
 * Build the anniversary recap email for one couple. Pure: the caller pairs the
 * returned parts in sendEmail() and adds the RFC 8058 unsubscribe headers.
 */
export function buildAnniversaryEmail(
  parts: AnniversaryEmailParts,
): AnniversaryEmail {
  const { coupleName, eventName, yearsAgo, ctaHref } = parts;
  const yp = yearsPhrase(yearsAgo);
  const who = (coupleName ?? '').trim() || (eventName ?? '').trim() || 'you';

  const subject = `${yp} ago today 💛`;

  const greeting = `Hi ${who},`;
  const p1 = `${yp} ago today, you said "I do." We hope this finds you smiling at the memory.`;
  const p2 = `Every photo, every clip, every moment from your wedding is still waiting for you on Setnayan. Take a few minutes today to scroll back through it — relive your day exactly as it happened.`;
  const p3 = `Here's to many more. 💛`;

  const text = [
    greeting,
    '',
    p1,
    '',
    p2,
    '',
    `Relive your day:`,
    ctaHref,
    '',
    p3,
    '',
    `— Set na 'yan.`,
    '',
    `You're receiving this because you celebrated your wedding with Setnayan. To stop anniversary reminders, reply with "unsubscribe" or email ${ANNIVERSARY_SUPPORT_EMAIL}.`,
  ].join('\n');

  const html = renderBrandedEmail({
    heading: `${yp} ago today 💛`,
    paragraphs: [greeting, p1, p2, p3],
    ctaLabel: 'Relive your day',
    ctaHref,
    footnote: `You're receiving this because you celebrated your wedding with Setnayan. To stop anniversary reminders, reply with "unsubscribe" or email ${ANNIVERSARY_SUPPORT_EMAIL}.`,
  });

  return { subject, text, html };
}

/** RFC 8058 one-click unsubscribe headers for the anniversary send. Pure. */
export function anniversaryUnsubscribeHeaders(): Record<string, string> {
  return {
    'List-Unsubscribe': `<mailto:${ANNIVERSARY_SUPPORT_EMAIL}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
