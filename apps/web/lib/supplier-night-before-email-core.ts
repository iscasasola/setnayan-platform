/**
 * The night-before supplier email — pure copy + arithmetic (S5, ships OFF).
 *
 * Split from `supplier-night-before-email.ts` the same way
 * `anniversary-emails-core.ts` is split from `anniversary-emails.ts`: no
 * `server-only`, so this half is unit-testable without a database.
 *
 * ⚠ THE CALL-TIME TRAP THIS FILE EXISTS TO AVOID. `event_schedule_blocks.
 * start_at` (and `deriveCallTime`'s output, derived from it) stores the
 * VENUE'S OWN WALL CLOCK in a column typed `TIMESTAMPTZ` — i.e. a 2 PM
 * ceremony is the literal string `14:00+00`, not a real UTC instant
 * (`[[project_setnayan_wall_clock_vs_instant]]`). Formatting it with
 * `timeZone: 'Asia/Manila'` re-shifts an already-local number and is exactly
 * the mistake that once emailed a 2 PM ceremony as 10 PM. `formatVenueClock`
 * reads the stored wall-clock digits back out with `timeZone: 'UTC'` —
 * no conversion, because none is needed.
 */

/** Today's date as YYYY-MM-DD in Asia/Manila (UTC+8, no DST). Mirrors the
 * identical one-off in `daily-email-jobs.ts` — too small to be worth a shared
 * export, and every other cron-free job in this file keeps its own copy too. */
export function manilaTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Reads the stored wall-clock instant's own digits — never re-zones them. */
export function formatVenueClock(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export type SupplierNightBeforeEmail = {
  subject: string;
  text: string;
  html: string;
};

export type SupplierNightBeforeEmailParts = {
  /** The supplier's own business name (their vendor_profiles row, not what the couple typed). */
  businessName: string;
  /** The event's display name, e.g. "Maria & Jose". */
  eventDisplayName: string;
  /** "Wed 16 Dec 2026" — already formatted by the caller from the event's own date. */
  eventDayLabel: string;
  /** A suggested call time in "h:mm AM/PM" venue-local form, or null when none could be derived. */
  callTimeLabel: string | null;
  /** Deep link into the vendor's own event brief page. */
  ctaHref: string;
};

/** Pure builder — the copy for the night-before reminder. No I/O, no flag check. */
export function buildSupplierNightBeforeEmail(parts: SupplierNightBeforeEmailParts): SupplierNightBeforeEmail {
  const { businessName, eventDisplayName, eventDayLabel, callTimeLabel, ctaHref } = parts;
  const who = businessName.trim() || 'there';
  const event = eventDisplayName.trim() || 'the celebration';

  const subject = `Tomorrow is ${event}'s day`;
  const callTimeLine = callTimeLabel
    ? `Your suggested call time is around ${callTimeLabel}.`
    : `Check your call time and the full day-of schedule on your event page.`;

  const text = [
    `Hi ${who},`,
    ``,
    `${event} is tomorrow — ${eventDayLabel}.`,
    callTimeLine,
    ``,
    `Open your event page for the guest count, the run-of-show and everyone else who's booked: ${ctaHref}`,
    ``,
    `— Setnayan`,
  ].join('\n');

  // Deliberately not using renderBrandedEmail() here — kept as a plain,
  // dependency-free multipart body until this ships; wiring the branded shell
  // is a one-line change once the owner clears the send.
  const html = `<p>Hi ${escapeHtml(who)},</p><p>${escapeHtml(event)} is tomorrow — ${escapeHtml(
    eventDayLabel,
  )}. ${escapeHtml(callTimeLine)}</p><p><a href="${ctaHref}">Open your event page</a></p><p>— Setnayan</p>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
