/**
 * lib/couple-supplier-notices.ts — EVERY NOTICE THAT CARRIES A COUPLE ↔ SUPPLIER
 * CONNECTION, AND WHETHER IT IS EMAILED OR TOLD IN THE APP.
 *
 * 🔴 WHY THIS EXISTS (2026-10-10). The owner: "what we are building is the
 * connection of the supplier and user on their events." A read-only map of every
 * round trip between a couple and a supplier found that nobody had written down
 * which of their notices reach an inbox and which are a tray badge — and that
 * three comments in the code claimed an email that was never sent.
 *
 * 📵 AND WHAT IT IS NOT (owner 2026-10-11: "i thought we can manage without
 * emails?"). On 2026-10-10 eight of these notices were put on the email
 * allowlist; the next day they came back off. Emails cost money and the
 * direction is fewer, not more. So this file does not ADD email to anything: it
 * records what main already emailed, declares everything else app-only with the
 * reason, and lets the guard hold both.
 *
 *   · `reach: 'email'`    → ALREADY on the email allowlist on main. Stays on
 *                           it, NOT marketing-gated, with its own reason line
 *                           (notification-email-reason.ts).
 *   · `reach: 'app_only'` → a tray notice, with the reason written down. The
 *                           guard FAILS if it is emailed.
 *
 * A notice type emitted from a couple ↔ supplier file that is in NEITHER list
 * fails the guard: nobody adds a round trip without saying how it is told. And
 * `the-email-allowlist-is-frozen.test.ts` fails if the allowlist itself grows.
 *
 * Pure. Type-only imports besides the date formatter.
 */
import type { NotificationType } from '@/lib/notifications';
import type { BrandedEmailSection } from '@/lib/email-template';
import { formatEventDateWithPrecision, type EventDatePrecision } from '@/lib/events';

/** Who the notice is written to. 'either' = sent to both sides on different paths. */
export type NoticeParty = 'supplier' | 'couple' | 'either';

/**
 * What an EMAILED notice says about the event, under its sentence.
 *   name_and_date — "Event · Ana & Ben" and "Date · Saturday, March 6, 2027".
 *   none          — no event rows (a chat message is a conversation, not a
 *                   booking event; a waitlist pick has no event at all).
 */
export type NoticeEventFacts = 'name_and_date' | 'none';

export type CoupleSupplierNotice =
  | { to: NoticeParty; reach: 'email'; event: NoticeEventFacts; why: string }
  | { to: NoticeParty; reach: 'app_only'; why: string };

/**
 * 📵 Owner, 2026-10-11, verbatim: "i thought we can manage without emails?" —
 * emails cost money and the direction is fewer, not more (DECISION_LOG
 * 2026-09-29 "NO EMAIL TO GUESTS", 2026-10-02 "yes stop emails"). Every
 * couple ↔ supplier notice that did NOT already email on main carries this
 * reason: it is told in the app, and the guard fails if it is emailed.
 */
const NO_NEW_EMAILS = 'owner 2026-10-11: we manage without new emails — the app tells them';

export const COUPLE_SUPPLIER_NOTICES = {
  // ── Asking, answering, quoting ────────────────────────────────────────────
  vendor_inquiry_received: { to: 'supplier', reach: 'app_only', why: NO_NEW_EMAILS },
  inquiry_accepted: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the answer the couple is waiting on; it opens the conversation',
  },
  inquiry_declined: { to: 'couple', reach: 'app_only', why: NO_NEW_EMAILS },
  quote_accepted: { to: 'supplier', reach: 'app_only', why: NO_NEW_EMAILS },
  quote_declined: { to: 'supplier', reach: 'app_only', why: NO_NEW_EMAILS },
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
  booking_cancelled: { to: 'supplier', reach: 'app_only', why: NO_NEW_EMAILS },
  // ── Money ─────────────────────────────────────────────────────────────────
  payment_info_sent: {
    to: 'couple',
    reach: 'email',
    event: 'name_and_date',
    why: 'the payment plan the couple has to follow is ready',
  },
  payment_logged: { to: 'supplier', reach: 'app_only', why: NO_NEW_EMAILS },
  vendor_payment_asked: { to: 'couple', reach: 'app_only', why: NO_NEW_EMAILS },
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
  change_order_proposed: { to: 'either', reach: 'app_only', why: NO_NEW_EMAILS },
  change_order_answered: { to: 'either', reach: 'app_only', why: NO_NEW_EMAILS },
  pax_surcharge_changed: { to: 'couple', reach: 'app_only', why: NO_NEW_EMAILS },
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
  vendor_joined: { to: 'couple', reach: 'app_only', why: NO_NEW_EMAILS },
  // ── After the event ───────────────────────────────────────────────────────
  review_request: { to: 'couple', reach: 'app_only', why: NO_NEW_EMAILS },
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
    why: 'written at the supplier’s own sign-in, so they are in the app when it lands (the ghost-warning email in lib/ghosting.ts is about a booked event a week away, not an unanswered inquiry)',
  },
  vendor_review_reply: {
    to: 'couple',
    reach: 'app_only',
    why: 'news with nothing to answer — a supplier replied to a review already left',
  },
  /*
    One type, six things: schedule answers, meeting asks, terms, a handover.
    lib/notifications.ts keeps it in-app. Until 2026-10-10 it ALSO carried the
    four change-order notices, which move what the couple owes — those now have
    their own two types above (migration 20271267016300), told in the app.
    Six emit sites remain (2026-10-10); guard test 8 names the four that left.
  */
  schedule_suggestion: {
    to: 'either',
    reach: 'app_only',
    why: 'schedule answers, meeting asks, terms and a handover — none moves money; lib/notifications.ts keeps the generic schedule register in-app',
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
        ...(name ? [{ label: 'Event', value: name }] : []),
        { label: 'Date', value: when },
      ],
    },
  ];
}
