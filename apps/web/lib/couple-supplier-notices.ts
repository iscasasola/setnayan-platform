/**
 * lib/couple-supplier-notices.ts — EVERY NOTICE THAT CARRIES A COUPLE ↔ SUPPLIER
 * CONNECTION, AND WHETHER IT REACHES SOMEBODY WHO IS NOT IN THE APP.
 *
 * 🔴 WHY THIS EXISTS (2026-10-10). The owner: "what we are building is the
 * connection of the supplier and user on their events." A read-only map of every
 * round trip between a couple and a supplier found the notices that open or
 * move a booking were tray badges only: the supplier's FIRST inquiry, "a payment
 * is waiting for you to confirm", "your supplier asked for a payment", "your
 * booking was cancelled", the supplier's no to an inquiry, the request to
 * confirm delivery, and "your supplier joined Setnayan". A supplier who was not
 * looking at the app heard none of them. One of them — the cancelled booking —
 * USED to be an email and lost it silently when it was moved onto
 * `emitNotification` without an allowlist line.
 *
 * 🔑 THE NOTIFICATION AND THE ALLOWLIST ARE TWO HALVES OF ONE MECHANISM; having
 * one is indistinguishable from having neither. This file is the ONE place that
 * says which half each connection notice is meant to have, with the reason, so
 * `couple-supplier-notices-reach-email.test.ts` can hold both halves together:
 *
 *   · `reach: 'email'`    → on the email allowlist in notification-emit.ts, NOT
 *                           in the marketing-gated set, and carrying its own
 *                           reason line (notification-email-reason.ts) — the
 *                           three parts the shared layout needs from a type.
 *   · `reach: 'app_only'` → deliberately a tray badge, with the reason written
 *                           down, and the guard fails if it is emailed anyway
 *                           (so this file cannot quietly go stale).
 *
 * A notice type emitted from a couple ↔ supplier file that is in NEITHER list
 * fails the guard: nobody gets to add a new round trip without deciding whether
 * it has to reach a person.
 *
 * Pure. Type-only imports besides the date formatter.
 */
import type { NotificationType } from '@/lib/notifications';
import type { BrandedEmailSection } from '@/lib/email-template';
import { formatEventDateWithPrecision, type EventDatePrecision } from '@/lib/events';

/** Who the notice is written to. 'either' = sent to both sides on different paths. */
export type NoticeParty = 'supplier' | 'couple' | 'either';

/**
 * What the email says about the event.
 *   name_and_date — "Event · Ana & Ben" and "Date · Saturday, March 6, 2027".
 *   date_only     — the date, never the name. A first inquiry is PRE-accept:
 *                   the notice's own title drops the event's name on purpose
 *                   (anonymization-until-accept, lib/chat-actions.ts), so the
 *                   email must not print it underneath.
 *   none          — no event rows (a chat message is a conversation, not a
 *                   booking event; a waitlist pick has no event at all).
 */
export type NoticeEventFacts = 'name_and_date' | 'date_only' | 'none';

export type CoupleSupplierNotice =
  | { to: NoticeParty; reach: 'email'; event: NoticeEventFacts; why: string }
  | { to: NoticeParty; reach: 'app_only'; why: string };

export const COUPLE_SUPPLIER_NOTICES = {
  // ── Asking, answering, quoting ────────────────────────────────────────────
  vendor_inquiry_received: {
    to: 'supplier',
    reach: 'email',
    event: 'date_only',
    why: 'the first ask — a supplier who is not looking at the app never learns a couple wrote, and the couple waits on a reply that cannot come',
  },
  inquiry_accepted: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the answer the couple is waiting on; it opens the conversation',
  },
  inquiry_declined: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the couple is waiting on this supplier and must look elsewhere — a no they never read costs them days',
  },
  chat_message: {
    to: 'either',
    reach: 'email',
    event: 'none',
    why: 'every message, quote and nudge between the two travels as this; one email per message, as it ships today',
  },
  // ── Booking: the ask and the yes ──────────────────────────────────────────
  lock_request_received: {
    to: 'supplier',
    reach: 'email',
    event: 'name_and_date',
    why: 'the supplier has 48 hours to agree or decline',
  },
  lock_request_nudge: {
    to: 'supplier',
    reach: 'email',
    event: 'name_and_date',
    why: 'about a day is left before the booking request closes',
  },
  lock_request_agreed: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the yes that makes the booking',
  },
  lock_request_declined: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the couple must pick someone else',
  },
  lock_request_expired: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the request closed unanswered; the couple must ask again or pick someone else',
  },
  lock_request_withdrawn: {
    to: 'supplier',
    reach: 'email',
    event: 'name_and_date',
    why: 'the supplier was holding a date for this and no longer needs to',
  },
  booking_confirmed: {
    to: 'either',
    reach: 'email',
    event: 'name_and_date',
    why: 'a booking was marked on one side and the other side has to agree the details',
  },
  booking_cancelled: {
    to: 'supplier',
    reach: 'email',
    event: 'name_and_date',
    why: 'the supplier loses a booking and gets a date back — it was an email until it moved onto the shared notice path without an allowlist line',
  },
  // ── Money ─────────────────────────────────────────────────────────────────
  payment_info_sent: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the payment plan the couple has to follow is ready',
  },
  payment_logged: {
    to: 'supplier',
    reach: 'email',
    event: 'name_and_date',
    why: 'money was sent and waits for the supplier to confirm it arrived — the one money step that had no email',
  },
  vendor_payment_asked: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the one notice that tells a couple an amount is owed',
  },
  payment_confirmed: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the supplier confirmed the money arrived',
  },
  payment_rejected: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the supplier says the money did not arrive; the couple must send it again',
  },
  payment_cleared: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'nothing more is owed on the booking',
  },
  pax_surcharge_changed: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the total the couple owes on a booking changed',
  },
  // ── The date ──────────────────────────────────────────────────────────────
  date_change_requested: {
    to: 'supplier',
    reach: 'email',
    event: 'name_and_date',
    why: 'the supplier has 3 days to move or unlock before the couple may release the booking',
  },
  date_change_answered: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the couple cannot move their date until each supplier answers',
  },
  date_change_closed: {
    to: 'supplier',
    reach: 'email',
    event: 'name_and_date',
    why: 'the ask was withdrawn, or the booking was released',
  },
  date_moved: {
    to: 'supplier',
    reach: 'email',
    event: 'name_and_date',
    why: 'the day the supplier is booked for changed',
  },
  schedule_change_requested: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'a supplier asked to change the schedule and nothing moves until somebody answers',
  },
  // ── The claim link ────────────────────────────────────────────────────────
  vendor_joined: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the supplier the couple added by hand is now on Setnayan and can be messaged, booked and paid there',
  },
  // ── After the event ───────────────────────────────────────────────────────
  review_request: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the supplier marked the service delivered and the couple must confirm they received everything',
  },
  review_received: {
    to: 'supplier',
    reach: 'email',
    event: 'name_and_date',
    why: 'a public review landed and the supplier has one reply',
  },
  completion_accepted: {
    to: 'supplier',
    reach: 'email',
    event: 'name_and_date',
    why: 'the couple confirmed the service was delivered',
  },
  // ── Other emailed round trips between the two ─────────────────────────────
  waitlist_picked: {
    to: 'couple',
    reach: 'email',
    event: 'none',
    why: 'a supplier is holding a date and can hold it only so long',
  },
  vendor_feature_suggested: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'a booked supplier suggested something the couple acts on',
  },
  part_finalization_requested: {
    to: 'supplier',
    reach: 'email',
    event: 'name_and_date',
    why: 'the supplier has 48 hours to answer about a part of the design',
  },
  part_finalization_agreed: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the answer about their own design',
  },
  part_finalization_declined: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the answer about their own design',
  },
  part_reopen_requested: {
    to: 'supplier',
    reach: 'email',
    event: 'name_and_date',
    why: 'the supplier’s answer is what reopens a finalized part',
  },
  part_reopen_answered: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the answer about their own design',
  },
  order_quoted: {
    to: 'couple',
    reach: 'email',
    event: 'none',
    why: 'Setnayan’s own order type, borrowed by a supplier’s re-quote on a re-booking (lib/reusable-bookings.server.ts); already emailed, left exactly as it ships',
  },
  // The deletion handshake: an event money is holding cannot be removed until
  // each paid supplier answers.
  deletion_request_received: {
    to: 'supplier',
    reach: 'email',
    event: 'name_and_date',
    why: 'the couple cannot remove their event until this supplier answers',
  },
  deletion_request_nudge: {
    to: 'supplier',
    reach: 'email',
    event: 'name_and_date',
    why: 'the couple is still waiting on this supplier’s answer',
  },
  deletion_request_agreed: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the answer that lets the couple go ahead',
  },
  deletion_request_declined: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the answer the couple is waiting on, with the supplier’s reason',
  },
  // ── Deliberately a tray badge ─────────────────────────────────────────────
  inquiry_displaced: {
    to: 'supplier',
    reach: 'app_only',
    why: 'nothing to do and nothing lost — an open inquiry closed because the couple booked someone else',
  },
  inquiry_no_response: {
    to: 'couple',
    reach: 'app_only',
    why: 'written at the couple’s own sign-in, so they are in the app when it lands',
  },
  inquiry_awaiting_reply: {
    to: 'supplier',
    reach: 'app_only',
    why: 'written at the supplier’s own sign-in, so they are in the app when it lands; the away-from-app word is the first-inquiry email (the ghost-warning email in lib/ghosting.ts is about a booked event a week away, not an unanswered inquiry)',
  },
  vendor_review_reply: {
    to: 'couple',
    reach: 'app_only',
    why: 'news with nothing to answer — a supplier replied to a review already left',
  },
  schedule_suggestion: {
    to: 'either',
    reach: 'app_only',
    why: 'one type carries six different things (schedule answers, meeting asks, terms, handovers, change orders); lib/notifications.ts keeps it in-app until it is split — an owner decision, because change orders move money',
  },
  papic_challenge_pending: {
    to: 'couple',
    reach: 'app_only',
    why: 'a photo challenge waiting for the couple’s approval; in-app by design (Papic Games §3.6)',
  },
} satisfies Partial<Record<NotificationType, CoupleSupplierNotice>>;

export type CoupleSupplierNoticeType = keyof typeof COUPLE_SUPPLIER_NOTICES;

/** The declaration for a type, or null when the type is not a couple ↔ supplier notice. */
export function coupleSupplierNotice(type: NotificationType): CoupleSupplierNotice | null {
  return (COUPLE_SUPPLIER_NOTICES as Partial<Record<NotificationType, CoupleSupplierNotice>>)[type] ?? null;
}

/** What `emitNotification` reads from the event row for these emails. */
export type NoticeEventRow = {
  display_name: string | null;
  event_date: string | null;
  event_date_precision: string | null;
};

/** Said when the event has no date yet — never a blank, never a guess. */
export const NOTICE_DATE_NOT_SET = 'Not set yet';

const precisionOf = (raw: string | null): EventDatePrecision =>
  raw === 'year' || raw === 'month' ? raw : 'day';

/**
 * The labelled rows a couple ↔ supplier email carries under its sentence: which
 * event, and when. Returns `[]` for a type that is not one of these notices, is
 * app-only, or declares no event rows — the caller then sends the mail exactly
 * as it always did.
 */
export function coupleSupplierEventSections(
  type: NotificationType,
  event: NoticeEventRow,
): BrandedEmailSection[] {
  const notice = coupleSupplierNotice(type);
  if (!notice || notice.reach !== 'email' || notice.event === 'none') return [];
  const when =
    formatEventDateWithPrecision(event.event_date, precisionOf(event.event_date_precision)) ||
    NOTICE_DATE_NOT_SET;
  const name = event.display_name?.trim();
  return [
    {
      rows: [
        ...(notice.event === 'name_and_date' && name ? [{ label: 'Event', value: name }] : []),
        { label: 'Date', value: when },
      ],
    },
  ];
}
