import { googleCalendarUrl } from '@/lib/calendar-links';
import { renderBrandedEmail } from '@/lib/email-template';

// Save-the-Date → guest-email — PURE core (no 'server-only', no DB/email runtime
// imports), so it's unit-testable under `tsx --test`. The server-only wrapper
// `save-the-date-emails.ts` reads guests via the admin client and sends through
// sendEmail(), delegating the content shaping here.
//
// Pure content-shaping core (split out for unit testing): edges that surface on a guest-
// facing email (a wrong greeting, a leaked stale date, a junk recipient) are
// pinned by the core's unit suite.

export const STD_SUPPORT_EMAIL = 'support@setnayan.com';

export type StdGuestRow = {
  guest_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
};

export type StdEventContext = {
  coupleName: string;
  /** 'YYYY-MM-DD' wedding date, or null when not set yet. */
  weddingDateIso: string | null;
  /** Absolute URL of the now-public landing page. */
  pageUrl: string;
  venue: string | null;
};

/** A guest's first name for greeting, falling back gracefully. Pure. */
export function stdGuestGreetingName(g: StdGuestRow): string {
  const display = (g.display_name ?? '').trim();
  if (display) return display.split(/\s+/)[0] ?? display;
  return (g.first_name ?? '').trim();
}

/** Whether a guest email is shaped well enough to attempt a send. Pure. */
export function isSendableEmail(email: string | null | undefined): boolean {
  const e = (email ?? '').trim();
  // Minimal shape check — an @ with a dotted domain. The send provider does the
  // real validation; this just skips obvious junk + blanks.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** Human wedding date line, e.g. "Saturday, December 12, 2026". Pure. */
export function formatWeddingDate(weddingDateIso: string | null): string | null {
  if (!weddingDateIso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(weddingDateIso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export type StdGuestEmail = {
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
};

/**
 * Build the save_the_date_sent email for one guest. Pure + side-effect-free so
 * it's unit-testable; the caller pairs the parts in sendEmail(). Carries the
 * couple names, the wedding date, a link to the now-public /[slug] page, an
 * add-to-calendar (Google Calendar) link, and the RFC 8058 unsubscribe header.
 */
export function buildSaveTheDateGuestEmail(
  guest: StdGuestRow,
  ctx: StdEventContext,
): StdGuestEmail {
  const greet = stdGuestGreetingName(guest);
  const dateLine = formatWeddingDate(ctx.weddingDateIso);
  const calUrl = googleCalendarUrl({
    title: ctx.coupleName,
    dateIso: ctx.weddingDateIso,
    location: ctx.venue,
    details: `Save the date — ${ctx.coupleName}. ${ctx.pageUrl}`,
  });

  const subject = dateLine
    ? `Save the date — ${ctx.coupleName} · ${dateLine}`
    : `Save the date — ${ctx.coupleName}`;

  const hello = greet ? `Hi ${greet},` : 'Hi,';
  const dateSentence = dateLine
    ? `${ctx.coupleName} are getting married on ${dateLine}${ctx.venue ? ` at ${ctx.venue}` : ''}. Please save the date!`
    : `${ctx.coupleName} are getting married — please save the date!`;

  const text = [
    hello,
    '',
    dateSentence,
    '',
    `See their Save-the-Date and follow along here:`,
    ctx.pageUrl,
    ...(calUrl ? ['', `Add it to your calendar:`, calUrl] : []),
    '',
    `— Set na 'yan.`,
    '',
    `You're receiving this because ${ctx.coupleName} added you to their guest list on Setnayan. To stop these, reply with "unsubscribe" or email ${STD_SUPPORT_EMAIL}.`,
  ].join('\n');

  const html = renderBrandedEmail({
    heading: dateLine ? `Save the date — ${dateLine}` : 'Save the date',
    paragraphs: [hello, dateSentence],
    ctaLabel: 'View the Save-the-Date',
    ctaHref: ctx.pageUrl,
    footnote: calUrl
      ? `Add it to your calendar: ${calUrl}`
      : `You're on ${ctx.coupleName}'s guest list on Setnayan.`,
  });

  // RFC 8058 one-click unsubscribe. mailto is honored by Gmail/Apple Mail and
  // needs no new endpoint/token table.
  const headers: Record<string, string> = {
    'List-Unsubscribe': `<mailto:${STD_SUPPORT_EMAIL}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };

  return { subject, text, html, headers };
}

/**
 * Resolve the couple's display name for the email from the event row, with the
 * same fallback chain used on the public page (display_name → bride & groom →
 * a neutral default). Pure.
 */
export function resolveCoupleName(ev: {
  display_name: string | null;
  bride_name: string | null;
  groom_name: string | null;
}): string {
  const display = (ev.display_name ?? '').trim();
  if (display) return display;
  const pair = [ev.bride_name, ev.groom_name]
    .map((n) => (n ?? '').trim())
    .filter(Boolean)
    .join(' & ');
  return pair || 'Our wedding';
}
