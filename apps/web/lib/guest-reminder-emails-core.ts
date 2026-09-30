import { daysUntil, type ChecklistItem } from '@/lib/guest-checklist';
import { renderBrandedEmail } from '@/lib/email-template';
import { formatWeddingDate, stdGuestGreetingName, type StdGuestRow } from '@/lib/save-the-date-emails-core';
import { SUPPORT_EMAIL } from '@/lib/contact-addresses';

/**
 * GUEST REMINDER EMAILS — 30 · 7 · 1 DAYS BEFORE THE EVENT. The pure half.
 *
 * Owner 2026-09-26 (DECISION_LOG "THE LAST 30 DAYS: EACH GUEST GETS YOUR
 * CHECKLIST"): *"Plus optional reminder EMAILS at 30 / 7 / 1 days to guests with
 * an email (no SMS in V1; couple can switch off; links to their own page)"*;
 * and ("THE GUEST CHECKLIST IS INTERACTIVE"): *"Reminder emails (30/7/1) list
 * only the unticked items."*
 *
 * Split from `guest-reminder-emails.ts` the way `save-the-date-emails-core.ts`
 * is split from its sender: no `server-only`, no I/O, so every decision here —
 * WHICH day is a milestone, WHICH items are still to do, WHAT the email says —
 * runs under `tsx --test` instead of being described.
 *
 * ── THE MILESTONE RULE, AND WHY IT HAS A SMALL CATCH-UP WINDOW ─────────────
 * The sender is a cron-free job: it wins a window every ~6 hours off request
 * traffic (`GUEST_REMINDER_GAP_MS`), and a quiet site can skip a day. A rule
 * of "exactly 30 days" would then lose that day's reminder for good. So the
 * 30- and 7-day milestones are due for THREE calendar days each (30…28,
 * 7…5) and the lock table makes the send once — a missed day is caught up the
 * next, never repeated. The day-before milestone has no catch-up: day 0 is the
 * event, and "tomorrow" sent on the day is wrong.
 *
 * 🔑 A LATE-CREATED EVENT DOES NOT BACK-SEND. An event set up 20 days out
 * gets no "30 days to go" — 20 is outside 28…30 — and picks up at 7. The rule
 * is "is a milestone due TODAY", never "has a milestone passed unsent".
 *
 * Days are counted in the EVENT'S OWN calendar (`events.timezone`, else the
 * venue's, else Manila): the job runs in UTC on Vercel, and 7am Manila on the
 * day before is still two days out in UTC (`lib/venue-disclosure.ts` learnt
 * this the expensive way on 2026-09-20).
 */

/**
 * 📵 OFF FOR GUESTS (owner 2026-09-29, DECISION_LOG "NO EMAIL TO GUESTS — THE QR
 * AND THE LINK DO EVERYTHING", item 5): *"But we have expenses for these
 * emails"* → *"No email. Either use the qr and link only"*. Reminders are now
 * the couple's own messages (Copy message on the Guest list), and the guest's
 * page always shows the current time and venue.
 *
 * A CONSTANT, NOT A SETTING — the couple's "Reminder emails" switch is gone from
 * the Maker (a switch that sends nothing would be a lie). The sender returns
 * before it reads anything while this is false. Emails to couples, hosts and
 * suppliers are untouched (item 6 of the same row).
 */
export const GUEST_REMINDER_EMAILS_ON = false as boolean;

export const REMINDER_MILESTONES = [30, 7, 1] as const;
export type ReminderMilestone = (typeof REMINDER_MILESTONES)[number];

/** How many days AFTER the exact milestone the 30- and 7-day reminders may still go. */
export const MILESTONE_CATCH_UP_DAYS = 2;

export const DEFAULT_REMINDER_TZ = 'Asia/Manila';

/** Today as `YYYY-MM-DD` in a zone, falling back to Manila for an unknown zone. */
export function todayInZone(timeZone: string | null | undefined, now: Date = new Date()): string {
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  try {
    return fmt((timeZone ?? '').trim() || DEFAULT_REMINDER_TZ);
  } catch {
    return fmt(DEFAULT_REMINDER_TZ);
  }
}

/** `YYYY-MM-DD` shifted by whole days — calendar arithmetic, no zone in play. */
export function shiftIsoDay(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Which milestone (if any) a guest of this event is owed TODAY. `null` when
 * none is: no date, day passed, between milestones, or outside every window.
 */
export function dueMilestone(input: { eventDate: string | null | undefined; today: string }): ReminderMilestone | null {
  const days = daysUntil(input);
  if (days == null) return null;
  for (const m of REMINDER_MILESTONES) {
    const catchUp = m === 1 ? 0 : MILESTONE_CATCH_UP_DAYS;
    if (days <= m && days >= m - catchUp) return m;
  }
  return null;
}

/**
 * Every event date that could owe a reminder on `today` — what the sender asks
 * the database for, so it never scans events whose day is months away.
 */
export function reminderEventDates(today: string): string[] {
  const out: string[] = [];
  for (const m of REMINDER_MILESTONES) {
    const catchUp = m === 1 ? 0 : MILESTONE_CATCH_UP_DAYS;
    for (let d = m - catchUp; d <= m; d += 1) out.push(shiftIsoDay(today, d));
  }
  return out;
}

/** The checklist items this guest has NOT ticked — the only ones the email lists. */
export function untickedItems(items: readonly ChecklistItem[], ticks: readonly string[]): ChecklistItem[] {
  const done = new Set(ticks);
  return items.filter((i) => !done.has(i.key));
}

/**
 * "Reply by <date>" — FIRST in the email for a guest who has not answered
 * (owner). Null when the guest has replied, when the couple's list is already
 * final (a reply can no longer change — asking for one would be a lie), or when
 * the reply-by date has passed.
 */
export function replyByLine(input: {
  rsvpStatus: string | null | undefined;
  replyBy: { date: string } | null;
  today: string;
  listClosed: boolean;
}): string | null {
  const replied = input.rsvpStatus === 'attending' || input.rsvpStatus === 'declined' || input.rsvpStatus === 'maybe';
  if (replied || input.listClosed || !input.replyBy) return null;
  if (input.replyBy.date < input.today) return null;
  const label = formatWeddingDate(input.replyBy.date);
  return label ? `Reply by ${label}` : null;
}

export type GuestReminderEmailParts = {
  guest: StdGuestRow;
  coupleName: string;
  /** `YYYY-MM-DD` — the event's own day. */
  eventDateIso: string;
  /** Whole days from today to the event, in the event's own calendar. */
  daysLeft: number;
  milestone: ReminderMilestone;
  /** Items still to do — already filtered to the unticked ones. */
  pending: readonly ChecklistItem[];
  /** "Reply by 18 November 2026", or null. Goes FIRST. */
  replyBy: string | null;
  /** The guest's OWN page (their invite key in the link). */
  pageUrl: string;
};

export type GuestReminderEmail = {
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
};

/** "30 days to go" · "One week to go" · "Tomorrow" — by the MILESTONE, so a catch-up day still reads right. */
export function reminderHeadline(milestone: ReminderMilestone, daysLeft: number): string {
  if (milestone === 1) return 'Tomorrow';
  if (milestone === 7 && daysLeft === 7) return 'One week to go';
  return `${daysLeft} day${daysLeft === 1 ? '' : 's'} to go`;
}

/**
 * One line per unticked item, for both the text and the HTML body. The motif
 * is colours, and an email body here is text — a guest is sent to the swatches
 * on their page rather than handed hex codes.
 */
export function pendingLine(item: ChecklistItem): string {
  if (item.key === 'motif') {
    const n = item.swatches?.length ?? 0;
    return `${item.title} — ${n > 0 ? `${n} colour${n === 1 ? '' : 's'}, ` : ''}see them on your page`;
  }
  return item.sub ? `${item.title} — ${item.sub}` : item.title;
}

/** RFC 8058 one-click unsubscribe, the same mailto shape every guest mail carries. */
export function guestReminderUnsubscribeHeaders(): Record<string, string> {
  return {
    'List-Unsubscribe': `<mailto:${SUPPORT_EMAIL}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/** Pure builder — the copy for one guest's reminder. No I/O. */
export function buildGuestReminderEmail(parts: GuestReminderEmailParts): GuestReminderEmail {
  const greet = stdGuestGreetingName(parts.guest);
  const hello = greet ? `Hi ${greet},` : 'Hi,';
  const couple = parts.coupleName.trim() || 'The couple';
  const dateLine = formatWeddingDate(parts.eventDateIso) ?? parts.eventDateIso;
  const headline = reminderHeadline(parts.milestone, parts.daysLeft);
  const subject = `${headline} — ${couple}`;

  const when =
    parts.milestone === 1
      ? `${couple}'s day is tomorrow, ${dateLine}.`
      : `${couple}'s day is ${dateLine} — ${headline.toLowerCase()}.`;

  // The reply ask goes FIRST (owner), then only what is still unticked.
  const replyPara = parts.replyBy ? `${parts.replyBy} — ${couple} need your answer for the seats and the food.` : null;
  const listIntro = parts.pending.length > 0 ? 'Still to do on your checklist:' : 'Your checklist is all ticked — see you there.';
  const bullets = parts.pending.map((item) => `• ${pendingLine(item)}`);

  const paragraphs: string[] = [hello, when, ...(replyPara ? [replyPara] : []), listIntro, ...bullets];

  const footerLine = `You're receiving this because ${couple} added you to their guest list on Setnayan. To stop these, reply with "unsubscribe" or email ${SUPPORT_EMAIL}.`;

  const text = [
    hello,
    '',
    when,
    ...(replyPara ? ['', replyPara] : []),
    '',
    listIntro,
    ...bullets,
    '',
    'Open your checklist and tick what is ready:',
    parts.pageUrl,
    '',
    `— Set na 'yan.`,
    '',
    footerLine,
  ].join('\n');

  const html = renderBrandedEmail({
    heading: `${headline} — ${couple}`,
    paragraphs,
    ctaLabel: 'Open your checklist',
    ctaHref: parts.pageUrl,
    footnote: 'Tick what is ready on your page — the next reminder lists only what is left.',
    footer: footerLine,
  });

  return { subject, text, html, headers: guestReminderUnsubscribeHeaders() };
}
