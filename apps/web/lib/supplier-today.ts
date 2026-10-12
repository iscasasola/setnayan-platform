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
        // 🔴 WAS the customer card's details — a page that has never carried
        // this answer (`vendorAgreeToDeletion` is mounted by Today alone), so
        // the button opened a card with nothing to press. The answer is given
        // on this page, in its own row; the button goes to it (2026-10-08).
        target: { to: 'today' },
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

/* ─── THE QUEUE — the Next card's place in it, and what is "Also waiting" ───
 *
 * Supplier dashboard redesign S-PR1 (corpus
 * `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2 "Today" + § 3; prototype
 * `supplier_dashboard_2026-10-08_fable.html` frames 01 · 02 · 15 · 31):
 *
 *   ONE Next card ("1 of 3") → three numbers → Coming up (3) → Also waiting
 *   (the rest of the queue) → one Shop row.
 *
 * `pickSupplierNext` above is UNCHANGED — the nine rules, in their order. This
 * section only says how the card is drawn (tone · icon · the second, grey
 * button) and which of the page's existing things sit under "Also waiting".
 *
 * 🔑 THE ASKS ARE NUMBERED; THE DOORS ARE NOT. "1 of 3" counts the answers this
 * shop owes customers (the desk, oldest first) — the same count as the
 * "waiting on you" number beside it. The rules that are not a customer's ask
 * (finish setting up · couples can't find you · a credit is about to expire ·
 * couples can't see where to pay you) are rows under the asks with no number:
 * each appears whenever its rule applies and it is not the Next card itself, so
 * none of them can be hidden by a busier rule above it.
 *
 * 💸 THE BOOKING FEE IS NOT ONE OF THOSE ROWS. `pickSupplierNext` knows ONE
 * bill (the first), and only when nothing above it applies; a shop can owe
 * several. Today therefore keeps the shipped `<BookingFeeBills>` — every unpaid
 * bill, each with its own Pay — which `the-fee-finds-the-supplier.test.ts`
 * holds on this page (owner 2026-09-20: "i never saw the payment screen to pay
 * us"). The page leaves out only the bill the Next card is already showing.
 */

/** One colour per meaning (`components/action-button.tsx`), named here as data. */
export type SupplierTone = 'brand' | 'ok' | 'info' | 'warn' | 'danger' | 'neutral';
export type SupplierIcon = 'reply' | 'check' | 'play' | 'send' | 'calendar' | 'wallet' | 'retry' | 'forward' | 'people' | 'eye';

/** A desk card's main verb: Reply is a message, Agree and money are a commit, the rest go forward. */
const ANSWER_LOOK: Record<WhatsNewCard['kind'], { tone: SupplierTone; icon: SupplierIcon }> = {
  inquiry: { tone: 'info', icon: 'reply' },
  message: { tone: 'info', icon: 'reply' },
  review: { tone: 'info', icon: 'reply' },
  lock_request: { tone: 'ok', icon: 'check' },
  lock: { tone: 'ok', icon: 'check' },
  mark_complete: { tone: 'ok', icon: 'check' },
  date_change: { tone: 'ok', icon: 'check' },
  // Removing an event is not a commit to celebrate — the button only OPENS the answer.
  delete_request: { tone: 'neutral', icon: 'forward' },
  meeting: { tone: 'brand', icon: 'calendar' },
  quote_draft: { tone: 'brand', icon: 'send' },
  contract_draft: { tone: 'brand', icon: 'send' },
  lock_request_lapsed: { tone: 'neutral', icon: 'forward' },
  dispute: { tone: 'neutral', icon: 'forward' },
};

const RULE_LOOK: Record<Exclude<SupplierNextKind, 'answer'>, { tone: SupplierTone; icon: SupplierIcon }> = {
  run_day: { tone: 'brand', icon: 'play' },
  unread: { tone: 'neutral', icon: 'retry' },
  setup: { tone: 'brand', icon: 'forward' },
  findable: { tone: 'brand', icon: 'forward' },
  tomorrow: { tone: 'brand', icon: 'calendar' },
  fee: { tone: 'ok', icon: 'wallet' },
  payday: { tone: 'brand', icon: 'wallet' },
  clear: { tone: 'neutral', icon: 'people' },
};

/** The Next card's main button — its colour and its icon. */
export function nextLook(kind: SupplierNextKind, answer: WhatsNewCard | null): { tone: SupplierTone; icon: SupplierIcon } {
  if (kind === 'answer') return answer ? ANSWER_LOOK[answer.kind] : { tone: 'brand', icon: 'forward' };
  return RULE_LOOK[kind];
}

/**
 * The second, grey button (the plan: "Their brief / Chat"). A card whose main
 * button opens the CHAT gets the customer's brief; on an event day it is that
 * event's chat. `null` when there is no second place to go.
 *
 * ⚠ NO "Chat" WITHOUT A THREAD ID. A booking ask, a logged payment, a meeting
 * and a date change carry the event, not the thread, and a bare client route
 * only reaches the chat by a redirect (`the-upcoming-row-opens-the-customer-
 * card.test.ts`: "a bare route IS the chat" — by accident). A grey button that
 * lands somewhere by accident is worse than none, so those cards have one
 * button until the desk reads carry the thread.
 */
export type SupplierNextSecond =
  | { label: 'Their brief'; to: 'card'; eventId: string }
  | { label: 'Chat'; to: 'given'; href: string };

export function nextSecond(next: SupplierNext, answer: WhatsNewCard | null, upcoming: readonly UpcomingEventRow[]): SupplierNextSecond | null {
  if (next.kind === 'run_day') {
    const first = upcoming[0];
    return first?.threadHref && first.threadHref !== first.href ? { label: 'Chat', to: 'given', href: first.threadHref } : null;
  }
  if (next.kind !== 'answer' || !answer) return null;
  // A pre-accept inquiry has no customer card yet — the thread is the whole brief.
  if (answer.kind === 'message' && answer.eventId) return { label: 'Their brief', to: 'card', eventId: answer.eventId };
  return null;
}

/**
 * The few words after the Next card's eyebrow — "waiting 2 h" (prototype frame
 * 01: "Next · waiting 2 h"). Only for an ask whose own line does not already
 * say it: an inquiry, a reply owed and a meeting carry "Waiting 2 h." in the
 * body, and a date change carries its deadline there. `null` otherwise — the
 * card never says one thing twice.
 */
export function nextMeta(answer: WhatsNewCard | null, since: Date | null, now: number): string | null {
  if (!answer || !since) return null;
  if (answer.kind === 'inquiry' || answer.kind === 'message' || answer.kind === 'meeting' || answer.kind === 'date_change') return null;
  return waitingAge(since.toISOString(), now)?.label ?? null;
}

/**
 * 🗝 THE TWO ANSWERS GIVEN ONLY ON TODAY. Every other answer has a second home
 * (the thread, the customer card, the reviews page, the Customers folds). These
 * two are mounted by no other page — measured 2026-10-08: `vendorAnswerDateChange`
 * and `vendorAgreeToDeletion` / `vendorDeclineDeletion` are imported by Today
 * alone. A date change is answered ON the Next card (prototype frame 31: Move ·
 * Unlock · Chat); a delete request, when it is the Next card, also keeps its
 * row under "Also waiting", open, so the card's button has somewhere to land.
 */
export const ANSWERED_ONLY_ON_TODAY: readonly WhatsNewCard['kind'][] = ['date_change', 'delete_request'];

export type SupplierWaitingAsk = {
  card: WhatsNewCard;
  /** The same words the Next card would say for this ask. */
  label: string;
  line: string;
  /** "2 of 3" — its place among the asks. */
  position: number;
  /** Starts open: it is the Next card's own ask, and it is answered here. */
  open: boolean;
};

export type SupplierWaitingDoorId = 'setup' | 'findable' | 'credit' | 'payout';

export type SupplierWaitingDoor = {
  id: SupplierWaitingDoorId;
  label: string;
  line: string;
  target: SupplierNextTarget;
};

export type SupplierWaiting = {
  /** How many answers this shop owes customers. */
  total: number;
  /** "1 of 3" for the Next card, or null when the Next card is not one of the asks (or it is the only one). */
  counter: string | null;
  /** The Next card's own ask — skipped from the rows unless it is answered only here. */
  nextAskId: string | null;
  asks: SupplierWaitingAsk[];
  doors: SupplierWaitingDoor[];
};

export function supplierWaiting(args: {
  next: SupplierNext;
  /** The Needs-your-answer half of the desk, oldest waiting first (never re-sorted here). */
  needsAnswer: readonly WhatsNewCard[];
  since: (card: WhatsNewCard) => Date | null;
  setupStep: SupplierNextInput['setupStep'];
  findability: SupplierNextInput['findability'];
  /** The credit-about-to-expire notice (`todayCreditNotice`) — it has no rule above, so it is always a row. */
  credit: { title: string; body: string; href: string } | null;
  /** Couples cannot see where to pay this shop (`PayoutMethodNudge`'s rule) — no rule above either. */
  payout: { title: string; body: string; href: string } | null;
  now: number;
}): SupplierWaiting {
  const { next, needsAnswer, now } = args;
  const nextAsk = next.kind === 'answer' ? nextAnswerOf(needsAnswer) : null;
  const total = needsAnswer.length;
  // The Next ask is number 1; the rest keep the desk's own order after it.
  const ordered = nextAsk ? [nextAsk, ...needsAnswer.filter((c) => c.id !== nextAsk.id)] : [...needsAnswer];
  const asks: SupplierWaitingAsk[] = [];
  ordered.forEach((card, i) => {
    const isNext = nextAsk !== null && card.id === nextAsk.id;
    // The Next card already says it — unless its answer is given only on this
    // page and the card itself cannot take it (a delete request).
    if (isNext && card.kind !== 'delete_request') return;
    const said = answerNext(card, args.since(card), now);
    asks.push({ card, label: said.title, line: said.body, position: i + 1, open: isNext });
  });

  const doors: SupplierWaitingDoor[] = [];
  if (args.setupStep && next.kind !== 'setup') {
    doors.push({
      id: 'setup',
      label: args.setupStep.title,
      line: args.setupStep.body,
      target: args.setupStep.href ? { to: 'given', href: args.setupStep.href } : { to: 'today' },
    });
  }
  if (args.findability && next.kind !== 'findable') {
    doors.push({
      id: 'findable',
      label: args.findability.title,
      line: args.findability.body,
      target: args.findability.cta ? { to: 'given', href: args.findability.cta.href } : { to: 'today' },
    });
  }
  if (args.credit) {
    doors.push({ id: 'credit', label: args.credit.title, line: args.credit.body, target: { to: 'given', href: args.credit.href } });
  }
  if (args.payout) {
    doors.push({ id: 'payout', label: args.payout.title, line: args.payout.body, target: { to: 'given', href: args.payout.href } });
  }

  return {
    total,
    counter: nextAsk && total > 1 ? `1 of ${formatCount(total)}` : null,
    nextAskId: nextAsk?.id ?? null,
    asks,
    doors,
  };
}

/**
 * The first number — "waiting on you". `null` when the desk could not be fully
 * read AND shows nothing: the tile then says "couldn't load", never 0. A short
 * read that still found some says "2+", never a count that is quietly short.
 */
export function waitingOnYou(count: number, deskIncomplete: boolean): string | null {
  if (!deskIncomplete) return formatCount(count);
  return count > 0 ? `${formatCount(count)}+` : null;
}
