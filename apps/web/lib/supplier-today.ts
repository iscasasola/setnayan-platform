/**
 * lib/supplier-today.ts — WHAT THE SUPPLIER'S PHONE "TODAY" SHOWS FIRST (pure).
 *
 * Owner-APPROVED 2026-10-01 (DECISION_LOG "THE SUPPLIER PHONE APP — APPROVED,
 * WITH THE THREE RECOMMENDED ANSWERS"; `Setnayan/prototypes/
 * supplier_app_simple_2026-10-01_fable.html`, frame 1 "Today"): the shop line →
 * ONE Next card (one button) → three numbers (new inquiries · events this week ·
 * ₱ owed to you) → the next three events. Nothing else above the fold.
 *
 * 🔑 THE SAME METHOD AS THE HOST'S PHONE HOME (`lib/home-first-screen.ts`), and
 * the card itself is the SAME component (`app/_components/next-card.tsx`) — this
 * file only decides which of the Today page's EXISTING things is first:
 *
 *   run_day  → a booked event is TODAY (owner answer 2: "Run the day" is a
 *              Next card, and on an event day it is THE Next card)
 *   answer   → the oldest answer this shop owes (the Needs-your-answer desk,
 *              already ordered oldest-waiting-first by `fetchVendorOverviewData`
 *              — never re-sorted here) — except a date-change request, which
 *              is first whenever one waits (`nextAnswerOf`: a 3-day deadline)
 *   unread   → the desk could not be fully read and shows nothing: never
 *              "all caught up" over a list that did not load
 *   setup    → the first-steps rail's current step (an unapproved shop)
 *   findable → the shop is approved but no couple can find it
 *   tomorrow → a booked event is tomorrow
 *   fee      → a booking fee is due to Setnayan
 *   payday   → money still to come in from booked customers
 *   clear    → nothing is waiting
 *
 * Everything the card does not show stays on the page, one tap below
 * ("See everything") — the desk with its answer-in-place forms, the fee bills,
 * the nudges, Ongoing and Upcoming. Nothing was removed.
 *
 * ⚠ THE DESTINATION IS NOT A STRING HERE. `target` is data; the page's
 * `supplier-today-first-screen.tsx` turns it into an `href:` literal where
 * `lint-port-no-lost-controls` can see it (the host learned this on its guided
 * flow's door).
 */
import type { UpcomingEventRow, WhatsNewCard } from '@/lib/vendor-overview';
import type { DueFeeBill, FeeDisclosure } from '@/lib/booking-fee-disclosure';
import { formatCount } from '@/lib/format-number';
import { formatLongDate } from '@/lib/format-date';
import { formatCentavosPhp, formatPhp } from '@/lib/php';
import { waitingAge } from '@/lib/waiting-age';
import { dateChangeWhen } from '@/lib/date-change';

export type SupplierNextKind =
  | 'run_day'
  | 'answer'
  | 'unread'
  | 'setup'
  | 'findable'
  | 'tomorrow'
  | 'fee'
  | 'payday'
  | 'clear';

/** The order the Next card is decided in — the first that applies wins. */
export const SUPPLIER_NEXT_ORDER: readonly SupplierNextKind[] = [
  'run_day',
  'answer',
  'unread',
  'setup',
  'findable',
  'tomorrow',
  'fee',
  'payday',
  'clear',
];

/** Where the one button goes — resolved to an `href` literal by the component. */
export type SupplierNextTarget =
  | { to: 'thread'; threadId: string }
  | { to: 'card'; eventId: string; tab: 'details' | 'quote' | 'schedule' }
  | { to: 'review'; reviewId: string }
  | { to: 'proposals' }
  | { to: 'contracts' }
  | { to: 'event-hub' }
  | { to: 'fee'; orderId: string }
  | { to: 'payday' }
  | { to: 'customers' }
  | { to: 'today' }
  /** A door another module already decided (first steps, findability, an upcoming row). */
  | { to: 'given'; href: string };

export type SupplierNext = {
  kind: SupplierNextKind;
  title: string;
  body: string;
  action: string;
  target: SupplierNextTarget;
};

export type SupplierNextInput = {
  /** The oldest answer owed — `needsAnswer[0]` — or null. */
  answer: WhatsNewCard | null;
  /** When that answer started waiting (`cardTimestamp`), for "Waiting 2 h". */
  answerSince: Date | null;
  /** The desk's booking-ask / deposit read did not reach the end. */
  deskIncomplete: boolean;
  /** The next booked events, soonest first (`upcoming`). */
  upcoming: readonly UpcomingEventRow[];
  /** The first-steps rail's current step, when the rail is showing. */
  setupStep: { title: string; body: string; cta: string | null; href: string | null } | null;
  /** Why couples cannot find the shop, when that notice is showing. */
  findability: { title: string; body: string; cta: { label: string; href: string } | null } | null;
  /** The first booking fee due, with its already-worded copy. */
  fee: { bill: DueFeeBill; copy: FeeDisclosure } | null;
  /** Money still to come in, or null when it was not measured. */
  owedPhp: number | null;
  now: number;
};

function waitedLine(since: Date | null, now: number): string | null {
  if (!since) return null;
  const w = waitingAge(since.toISOString(), now);
  if (!w) return null;
  // `waitingAge` speaks in lower case for a meta line; a sentence starts upper.
  return `${w.label.charAt(0).toUpperCase()}${w.label.slice(1)}.`;
}

/** "answer within 2 days" · "answer today" · "the 3 days are up" — the request's own deadline. */
function dueLine(dueAt: string, now: number): string {
  const hours = Math.ceil((new Date(dueAt).getTime() - now) / 3_600_000);
  if (!Number.isFinite(hours) || hours <= 0) return 'the 3 days are up';
  if (hours < 24) return 'answer today';
  const days = Math.ceil(hours / 24);
  return `answer within ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * 🗓 WHICH ANSWER IS NEXT. The desk is oldest-waiting-first, and the Next card
 * has always been its first row — EXCEPT a date-change request (owner
 * 2026-10-01): it carries a 3-day deadline after which the couple may release
 * the booking, so it is the Next card whenever one is waiting (the soonest
 * deadline first). Nothing is re-sorted on the desk itself.
 */
export function nextAnswerOf<T extends { kind: string }>(needsAnswer: readonly T[]): T | null {
  const dated = needsAnswer.filter((c) => c.kind === 'date_change') as Array<T & { dueAt?: string }>;
  if (dated.length > 0) return [...dated].sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))[0]!;
  return needsAnswer[0] ?? null;
}

function join(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(' · ');
}

/**
 * One desk card → the Next card. Every kind the desk calls an ANSWER has a line
 * here; the closed kinds (lapsed ask · passed meeting · dispute) never reach it
 * because `splitDesk` files them under "Nothing to answer".
 *
 * 🔒 The button OPENS the place the answer is given — the thread, the customer
 * card, the review — it never answers by itself. The desk's own answer-in-place
 * forms stay on the page below, exactly as shipped, with the booking fee shown
 * BEFORE Agree.
 */
export function answerNext(card: WhatsNewCard, since: Date | null, now: number): SupplierNext {
  const waited = waitedLine(since, now);
  switch (card.kind) {
    case 'inquiry':
      return {
        kind: 'answer',
        title: 'Reply to a new inquiry',
        body: join([card.descriptor, card.eventDate ? formatLongDate(card.eventDate) : null, card.paxAtInquiry ? `~${formatCount(card.paxAtInquiry)} guests` : null]) + (waited ? `. ${waited}` : '.'),
        action: 'Reply',
        target: { to: 'thread', threadId: card.threadId },
      };
    case 'message':
      return {
        kind: 'answer',
        title: `Reply to ${card.coupleName}`,
        body: card.excerpt ? `“${card.excerpt}”${waited ? ` ${waited}` : ''}` : waited ?? 'They are waiting on your reply.',
        action: 'Reply',
        target: { to: 'thread', threadId: card.threadId },
      };
    case 'lock_request':
      return {
        kind: 'answer',
        // The approved words (prototype frame 1/3: "Agree to this booking", button
        // "Agree"). The couple's name moves to the body so the card still says whose.
        title: 'Agree to this booking',
        body: join([card.coupleName, card.eventDate ? formatLongDate(card.eventDate) : null, 'Agree before the window closes']) + '.',
        action: 'Agree',
        target: { to: 'card', eventId: card.eventId, tab: 'details' },
      };
    case 'lock':
      return {
        kind: 'answer',
        title: `Confirm ${card.coupleName}’s payment`,
        body: join([card.eventDate ? formatLongDate(card.eventDate) : null, 'They logged a payment to you']) + '.',
        action: 'Check the payment',
        target: { to: 'card', eventId: card.eventId, tab: 'quote' },
      };
    case 'date_change':
      return {
        kind: 'answer',
        title: 'Date change request',
        body: `${card.coupleName} asks to move from ${card.fromDate ? dateChangeWhen(card.fromDate, card.fromPrecision) : 'their date'} to ${dateChangeWhen(card.proposedDate, card.proposedPrecision)}. Move, or unlock your service — ${dueLine(card.dueAt, now)}.`,
        action: 'Answer',
        target: { to: 'today' },
      };
    case 'delete_request':
      return {
        kind: 'answer',
        title: 'A couple wants to remove a celebration',
        body: 'Only you can release it. Read what they asked first.',
        action: 'Answer',
        target: { to: 'card', eventId: card.eventId, tab: 'details' },
      };
    case 'mark_complete':
      return {
        kind: 'answer',
        title: `${card.eventName} has finished`,
        body: 'Confirm you delivered your service — that is what opens your review.',
        action: 'Confirm it',
        target: { to: 'card', eventId: card.eventId, tab: 'details' },
      };
    case 'review':
      return {
        kind: 'answer',
        title: `Reply to ${card.coupleName}’s review`,
        body: card.quote ? `“${card.quote}”` : 'One public reply, shown under their review.',
        action: 'Reply',
        target: { to: 'review', reviewId: card.reviewId },
      };
    case 'meeting':
      return {
        kind: 'answer',
        title: `${card.coupleName} proposed a time`,
        body: card.label + (waited ? `. ${waited}` : '.'),
        action: 'Answer',
        target: { to: 'card', eventId: card.eventId, tab: 'schedule' },
      };
    case 'quote_draft':
      return {
        kind: 'answer',
        title: 'Send your quote',
        body: join([card.title, card.totalCentavos != null ? formatCentavosPhp(card.totalCentavos) : null]) + '. You wrote it and never sent it.',
        action: 'Send quote',
        target: { to: 'proposals' },
      };
    case 'contract_draft':
      return {
        kind: 'answer',
        title: 'Send your contract',
        body: `${card.title}. You drafted it and never sent it.`,
        action: 'Send contract',
        target: { to: 'contracts' },
      };
    case 'lock_request_lapsed':
    case 'dispute':
      // Closed lines — never an answer (`deskDisposition`). Kept total so a
      // future disposition change cannot render an empty card.
      return {
        kind: 'answer',
        title: card.kind === 'dispute' ? 'A delivery delay was flagged' : 'A booking window closed',
        body: 'Nothing to answer — it is listed below.',
        action: 'See it',
        target: { to: 'today' },
      };
  }
}

/**
 * ONE card, always — the first that applies in `SUPPLIER_NEXT_ORDER`.
 */
export function pickSupplierNext(input: SupplierNextInput): SupplierNext {
  const first = input.upcoming[0] ?? null;
  if (first && first.inDays <= 0) {
    return {
      kind: 'run_day',
      title: `Today: ${first.eventName}`,
      body: join([first.place, 'Your schedule, list and headcount are in the Event Hub']) + '.',
      action: 'Run the day',
      target: { to: 'event-hub' },
    };
  }
  if (input.answer) return answerNext(input.answer, input.answerSince, input.now);
  if (input.deskIncomplete) {
    return {
      kind: 'unread',
      title: 'Some answers couldn’t load',
      body: 'This list may be missing a booking ask or a payment. Nothing is lost.',
      action: 'Try again',
      target: { to: 'today' },
    };
  }
  if (input.setupStep) {
    return {
      kind: 'setup',
      title: input.setupStep.title,
      body: input.setupStep.body,
      action: input.setupStep.cta ?? 'Continue',
      target: input.setupStep.href ? { to: 'given', href: input.setupStep.href } : { to: 'today' },
    };
  }
  if (input.findability) {
    return {
      kind: 'findable',
      title: input.findability.title,
      body: input.findability.body,
      action: input.findability.cta?.label ?? 'See why',
      target: input.findability.cta ? { to: 'given', href: input.findability.cta.href } : { to: 'today' },
    };
  }
  if (first && first.inDays === 1) {
    return {
      kind: 'tomorrow',
      title: `${first.eventName} is tomorrow`,
      body: join([first.place, 'Check the plan before the day']) + '.',
      action: 'See the day',
      target: { to: 'given', href: first.href },
    };
  }
  if (input.fee) {
    return {
      kind: 'fee',
      title: input.fee.copy.headline,
      body: input.fee.copy.detail,
      action: 'Pay the fee',
      target: { to: 'fee', orderId: input.fee.bill.orderId },
    };
  }
  if (input.owedPhp !== null && input.owedPhp > 0) {
    return {
      kind: 'payday',
      title: `${formatPhp(input.owedPhp)} still to come in`,
      body: 'From your booked customers’ payment plans.',
      action: 'See money in',
      target: { to: 'payday' },
    };
  }
  return {
    kind: 'clear',
    title: 'You’re all caught up',
    body: 'New inquiries land here the moment a couple asks.',
    action: 'See your customers',
    target: { to: 'customers' },
  };
}

/* ─── THE THREE NUMBERS ──────────────────────────────────────────────────── */

/** How many upcoming rows the overview reads (`fetchVendorOverviewData` — next 5). */
export const UPCOMING_READ_CAP = 5;

/**
 * Booked events in the next seven days (today included).
 *
 * ⚠ The overview reads only the next five booked events. When all five fall
 * inside the week the true number may be higher, so it says "5+" — never a
 * count that is quietly capped.
 */
export function eventsThisWeek(upcoming: readonly UpcomingEventRow[]): string {
  const n = upcoming.filter((r) => r.inDays >= 0 && r.inDays <= 6).length;
  if (n >= UPCOMING_READ_CAP && upcoming.length >= UPCOMING_READ_CAP) return `${formatCount(n)}+`;
  return formatCount(n);
}

/**
 * ₱ still owed to the shop — booked installments not yet confirmed. `null` when
 * the payday read was refused or short: the tile then prints "—", never ₱0.
 */
export function owedToYouPhp(
  earnings: { confirmedPhp: number; expectedPhp: number; paydayMeasured: boolean } | null,
): number | null {
  if (!earnings || !earnings.paydayMeasured) return null;
  return Math.max(0, earnings.expectedPhp - earnings.confirmedPhp);
}
