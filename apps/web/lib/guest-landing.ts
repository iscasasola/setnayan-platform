/**
 * lib/guest-landing.ts — THE GUEST'S OWN LANDING PAGE: what their personal link
 * opens (owner 2026-09-30, DECISION_LOG "THE PERSONAL LINK OPENS THE GUEST'S OWN
 * LANDING PAGE" and "THE TICKET GAINS THE SEAT ON THE DAY · A NEW OR CHANGED
 * TICKET POPS UP FIRST WITH SAVE"; prototype
 * `Setnayan/prototypes/guest_landing_page_2026-09-30.html`, frames 1–6).
 *
 * Owner, verbatim: *"a link where they have the message and the digital ticket
 * and the instructions and a button to open their RSVP (that closes when they
 * have filled it up already) and just the Digital Ticket is left"*.
 *
 * The page is `app/[slug]/invite/enter/page.tsx` — the door that already handed
 * over the ticket after a reply, so "after submitting the RSVP, return to this
 * page" is the redirect `submitInviteReply` already makes. This module holds its
 * rules, pure, so each is executed by `the-personal-link-opens-the-landing.test.ts`
 * rather than trusted:
 *
 *   · the ORDER of the page (`LANDING_ORDER`);
 *   · the reply state and the ticket state (`landingReplyOf` · `landingTicketOf`);
 *   · the couple's message, name as given (`landingMessage`);
 *   · the three "How to use it" lines (`howToUseLines`);
 *   · the ticket's fingerprint and the once-per-version pop-up (`ticketFingerprint`
 *     · `ticketPopupDue`);
 *   · the in-app browser hand-off (`inAppHandoff`).
 *
 * Pure: no React, no database, no `server-only` — the pop-up (a client
 * component) imports the pop-up rule from here.
 */
import { isInAppWebview } from '@/lib/guest-one-path';
import { defaultInviteTemplate, formatInviteDate, inviteEventPhrase, sanitizeInviteTemplate, type InviteEventFacts } from '@/lib/guest-invite-message';

/** The landing page, top to bottom (the prototype's frame 1 and frame 3). */
export const LANDING_ORDER = ['message', 'reply', 'ticket', 'guests', 'how', 'open'] as const;
export type LandingSection = (typeof LANDING_ORDER)[number];

/** The page's words (the prototype's own). */
export const LANDING_WORDS = {
  reply: 'Reply to the invitation',
  changeReply: 'Change my reply',
  changedPlans: 'Changed your plans?',
  replyToConfirm: 'Reply to confirm your ticket',
  saveTicket: 'Save my ticket',
  saveInSafari: 'Open in Safari to save',
  howTitle: 'How to use it',
  ticketUpdated: 'Your ticket was updated',
  missed: 'We’ll miss you.',
  missedSub: 'Thank you for letting us know.',
  openInSafari: 'Open in Safari',
  openInApp: 'Open in the Setnayan app',
  openInBrowser: 'Open in Chrome',
  inAppNote: 'You’re inside Messenger’s browser — replying works here.',
} as const;

// ─── Reply and ticket ───────────────────────────────────────────────────────

/** Where the guest's own reply stands. Anything but a Yes or a No is "not yet". */
export type LandingReply = 'unreplied' | 'yes' | 'no';

export function landingReplyOf(rsvpStatus: string | null | undefined): LandingReply {
  if (rsvpStatus === 'attending') return 'yes';
  if (rsvpStatus === 'declined') return 'no';
  return 'unreplied';
}

/**
 * The Digital ticket on the landing page:
 *   faded — before a Yes: the ticket is there, faded, "Reply to confirm your ticket";
 *   full  — after a Yes: the ticket and "Save my ticket";
 *   none  — after a No (no ticket for a guest who can't come), or no ticket at all.
 *   other — the ticket rule said something the reply cannot (a request still
 *           waiting on the couple, no code): the page keeps its old answer.
 *
 * `eligibility` is `passCardEligibility`, reused, never re-decided — a plus-one
 * follows their bringer's reply there, so a plus-one's own "unreplied" never
 * fades a ticket the bringer's Yes already confirmed.
 */
export type LandingTicket = 'faded' | 'full' | 'none' | 'other';

export function landingTicketOf(input: {
  reply: LandingReply;
  eligibility: 'pass' | 'awaiting' | 'cannotCome' | 'none';
  isPlusOne?: boolean;
}): LandingTicket {
  if (input.eligibility === 'cannotCome') return 'none';
  if (input.eligibility !== 'pass') return 'other';
  if (input.reply === 'no') return 'none';
  if (input.reply === 'yes' || input.isPlusOne) return 'full';
  return 'faded';
}

/** The small link at the foot once they replied — "Change my reply", or after a No "Changed your plans?". */
export function changeReplyWords(reply: LandingReply): string | null {
  if (reply === 'yes') return LANDING_WORDS.changeReply;
  if (reply === 'no') return LANDING_WORDS.changedPlans;
  return null;
}

// ─── The couple's message ───────────────────────────────────────────────────

/**
 * THE COUPLE'S MESSAGE, NAME AS GIVEN — the first paragraph of the SAME words
 * they send (`events.print_details.invite_message`, or ours), with `{name}` the
 * guest's name exactly as the couple entered it (owner 2026-09-30: *"we want
 * the copy to indicate the name as given"*). The link lines are the message's
 * delivery, not its words — the guest is already standing on the link — so
 * only the opening paragraph is shown, and never a `{link}`.
 *
 * Before a reply it closes on the prototype's own line: "Please reply below —
 * your ticket is ready once you do."
 */
export function landingMessage(input: InviteEventFacts & {
  /** The couple's reworded text (placeholders {name} {event} {date} {link}); null = ours. */
  template?: string | null;
  /** `guestFullName` — the name as the couple entered it. */
  formalName: string | null | undefined;
  reply: LandingReply;
  now?: Date;
}): string {
  const template = sanitizeInviteTemplate(input.template) ?? defaultInviteTemplate({ solemn: input.solemn });
  const first =
    template
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !/\{link\}/i.test(p)) ?? '';
  const name = (input.formalName ?? '').replace(/\s+/g, ' ').trim();
  const date = formatInviteDate(input.eventDate, input.datePrecision, input.now);
  let t = first;
  if (!name) t = t.replace(/[ \t]*\{name\}/gi, '');
  if (!date) t = t.replace(/[ \t]+on[ \t]+\{date\}/gi, '').replace(/[ \t]*\{date\}/gi, '');
  const filled = t
    .replace(/\{(name|event|date|link)\}/gi, (_m, key: string) => {
      const k = key.toLowerCase();
      if (k === 'name') return name;
      if (k === 'event') return inviteEventPhrase(input, 'hosts');
      if (k === 'date') return date ?? '';
      return '';
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  if (input.reply !== 'unreplied') return filled;
  const ask = input.solemn ? 'Please reply below.' : 'Please reply below — your ticket is ready once you do.';
  return filled ? `${filled} ${ask}` : ask;
}

// ─── How to use it ──────────────────────────────────────────────────────────

/**
 * The three lines under the ticket. Before the day the third promises the seat
 * ON the day (it is not on the ticket yet — `ticketShowsTable`); on the day it
 * names the table when the guest has one.
 */
export function howToUseLines(input: {
  /** `ticketShowsTable` — the event's day has begun in Manila. */
  seatDay: boolean;
  /** "March 13" — the day, as `formatInviteDate` writes it; null when not a real day. */
  dateLabel: string | null;
  /** "Table 7" — only on the day, only when they have one. */
  table?: string | null;
}): [string, string, string] {
  if (input.seatDay) {
    return [
      'Save it to your photos.',
      'Show it at the door.',
      input.table ? `Find ${input.table} in the reception.` : 'Your seat shows on it once you’re placed.',
    ];
  }
  return [
    'Save it to your photos.',
    'Show it at the door.',
    input.dateLabel ? `On ${input.dateLabel} it will also show your seat.` : 'On the day it will also show your seat.',
  ];
}

/** "March 13" — the day, month and date only (the prototype's line); null without a real day. Read as text, in UTC, so it never slides a day. */
export function landingDayLabel(eventDate: string | null | undefined, precision: string | null | undefined): string | null {
  if (precision !== 'day') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(eventDate ?? '');
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime()) || d.getUTCMonth() !== Number(m[2]) - 1) return null;
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric' });
}

// ─── The pop-up: a new or changed ticket, once per version ─────────────────

/**
 * THE TICKET'S FINGERPRINT — what makes a saved picture out of date: a fresh
 * code (a new QR key, e.g. after Unlink), the couple accepting a request, the
 * party ("+N") changing, and on the day the seat being added. Never the build,
 * the look or the time — a redeploy or a new logo is not a new ticket to the
 * guest, and a pop-up for it would nag.
 *
 * FNV-1a, 32-bit, as base36 — pure and the same in the browser and the server.
 * The input is the guest's own code; the output names a version, nothing else.
 */
export function ticketFingerprint(input: {
  qrToken: string | null | undefined;
  /** 'pass' once the couple accepted them — a request turning into a ticket is a new ticket. */
  eligibility: string;
  party: number | null | undefined;
  seat: string | null | undefined;
  seatNumber: string | null | undefined;
}): string {
  const s = JSON.stringify([input.qrToken ?? '', input.eligibility, input.party ?? 0, input.seat ?? '', input.seatNumber ?? '']);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Where a browser remembers the last ticket version it showed this guest. */
export function ticketSeenKey(guestId: string): string {
  return `setnayan:ticket-seen:${guestId}`;
}

/**
 * Pop up first? Once per ticket fingerprint, never nagging:
 *   · a version this browser has already shown → never;
 *   · a DIFFERENT version than the one it showed → yes (the ticket changed);
 *   · nothing shown here before → no — the page itself is showing the ticket,
 *     which is the first sight (it is remembered, so the next change pops);
 *     unless the arrival itself says the ticket is new (`fresh`: a request the
 *     couple just accepted, `?in=1`).
 */
export function ticketPopupDue(input: { current: string; seen: string | null | undefined; fresh?: boolean }): boolean {
  if (input.seen === input.current) return false;
  if (!input.seen) return Boolean(input.fresh);
  return true;
}

// ─── In-app browsers (Messenger · Facebook · Instagram) ─────────────────────

/**
 * A link opened inside Messenger / Facebook / Instagram opens in THEIR browser,
 * which cannot be forced out. Replying works there, so nothing is blocked:
 *   · Android → one tap jumps out with an `intent://` (Chrome, or the Setnayan
 *     app when it holds the link);
 *   · iPhone  → a one-tap bar: "Open in Safari" (`x-safari-https://`) or
 *     "Open in the Setnayan app" (`setnayan://`, the app's own linking
 *     contract — `native-bridge.tsx` reads host + path as the path), and
 *     "Save my ticket" reads "Open in Safari to save" — saving a picture from
 *     that browser does not work;
 *   · anywhere else → nothing (`none`).
 *
 * The hand-off carries the guest's OWN link (`buildInvitationUrl`), because the
 * browser they land in holds no session yet — the link is what signs them in.
 */
export type InAppHandoff =
  | { kind: 'none' }
  | { kind: 'android'; href: string }
  | { kind: 'ios'; safariHref: string; appHref: string };

const ANDROID = /Android/i;
const APPLE = /iPhone|iPad|iPod/i;

export function inAppHandoff(userAgent: string | null | undefined, personalLink: string): InAppHandoff {
  const ua = userAgent ?? '';
  if (!isInAppWebview(ua)) return { kind: 'none' };
  let url: URL;
  try {
    url = new URL(personalLink);
  } catch {
    return { kind: 'none' };
  }
  if (url.protocol !== 'https:') return { kind: 'none' };
  const rest = `${url.host}${url.pathname}${url.search}`;
  if (ANDROID.test(ua)) {
    return {
      kind: 'android',
      href: `intent://${rest}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(url.toString())};end`,
    };
  }
  if (APPLE.test(ua)) {
    return {
      kind: 'ios',
      safariHref: `x-safari-${url.toString()}`,
      appHref: `setnayan://${url.pathname.replace(/^\//, '')}${url.search}`,
    };
  }
  return { kind: 'none' };
}

/** "Open the invitation" before a reply: the Event Hub, past the reply gate (frame 1). */
export const LANDING_OPEN_PARAM = 'from' as const;
export const LANDING_OPEN_VALUE = 'landing' as const;
export function openBeforeReplyHref(slug: string): string {
  return `/${slug}?${LANDING_OPEN_PARAM}=${LANDING_OPEN_VALUE}`;
}
