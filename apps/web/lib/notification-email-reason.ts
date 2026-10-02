/**
 * lib/notification-email-reason.ts — WHY THIS EMAIL CAME, ONE TRUE LINE PER
 * NOTIFICATION TYPE.
 *
 * 🔴 WHY THIS EXISTS (owner's live test, 2026-10-02): the couple's email
 * "<name> RSVP'd: attending" ended "You're receiving this because you started a
 * Papic gallery for your event." `emitNotification` (lib/notification-emit.ts)
 * passed no `footer`, so every allowlisted type — an RSVP, a payment, a
 * supplier's booking request, a security alert — inherited the branded
 * template's DEFAULT, which is the Papic gallery mail's own sentence. One
 * template, fifty-one kinds of mail, one reason line that was true of none of
 * them.
 *
 * 🔑 THE RULE: every type the email allowlist sends carries its OWN line here,
 * and no two types share one — so a line can never be borrowed again.
 * `every-notice-email-says-its-own-reason.test.ts` reads the allowlist out of
 * notification-emit.ts and fails if a type is missing here, if two types share
 * a line, or if any line is the Papic gallery's.
 *
 * Each line says what HAPPENED, in words true for whoever the type is sent to
 * (several go to a couple on one path and a supplier on another). An admin
 * mail still closes with the admin sentence (`ADMIN_EMAIL_FOOTER`).
 *
 * 📵 Guests get no email (DECISION_LOG "NO EMAIL TO GUESTS") — nothing here is
 * written to a guest; `rsvp_received` goes to the hosts.
 *
 * Pure. Type-only imports.
 */
import type { NotificationType } from '@/lib/notifications';

const R = (why: string) => `You're receiving this because ${why}.`;

export const NOTIFICATION_EMAIL_REASONS: Partial<Record<NotificationType, string>> = {
  order_quoted: R('an order on your Setnayan account is ready to pay'),
  order_paid: R('a payment on your Setnayan order went through'),
  order_awaiting_reconciliation: R('an order is waiting for its payment to be checked'),
  payment_matched: R('the payment you sent was matched to your order'),
  payment_rejected: R('a payment you sent could not be matched to your order'),
  order_cancelled: R('an order on your Setnayan account was cancelled'),
  payment_resubmit_requested: R('we need you to send your payment proof again'),
  payment_refunded: R('a payment on your Setnayan account was refunded'),
  papic_pool_spent: R("your guests' shared Papic photo credits have run out"),
  security_alert: R('something changed in the security of your Setnayan account'),
  vendor_status_change: R("your shop's standing on Setnayan changed"),
  rsvp_received: R('a guest replied to your invitation'),
  inquiry_accepted: R('your inquiry was answered'),
  booking_confirmed: R('a booking you are part of was confirmed'),
  review_received: R('a review was left on a booking you are part of'),
  dispute_filed: R('a dispute was opened on a booking you are part of'),
  dispute_resolved: R('a dispute on a booking you are part of was resolved'),
  chat_message: R('you have a new message on Setnayan'),
  waitlist_picked: R('a supplier is holding a date for you from their waitlist'),
  vendor_credit_expiring: R("your shop's prepaid credit is about to expire"),
  payment_info_sent: R('a payment plan for your booking is ready'),
  payment_confirmed: R('a payment on your booking was confirmed'),
  payment_cleared: R('the payments on your booking are complete'),
  completion_accepted: R('a booked service was confirmed as delivered'),
  vendor_feature_suggested: R('a supplier you booked suggested something for your event'),
  ai_payment_due: R('a supplier payment for your event is due soon'),
  appointment_reminder: R('a meeting you are part of was confirmed'),
  new_chapter_from_followed: R('someone you follow published a new chapter'),
  lock_request_received: R('a couple asked to book your service'),
  lock_request_nudge: R('a booking request to your shop is still waiting for your answer'),
  lock_request_agreed: R('a supplier agreed to your booking request'),
  lock_request_declined: R('a supplier declined your booking request'),
  lock_request_expired: R('your booking request expired without an answer'),
  lock_request_withdrawn: R('a couple withdrew their booking request'),
  deletion_request_received: R('a couple asked to remove a celebration you are booked for'),
  deletion_request_nudge: R('a request to remove a celebration is still waiting for your answer'),
  deletion_request_agreed: R('a supplier agreed to let your celebration be removed'),
  deletion_request_declined: R('a supplier did not agree to let your celebration be removed'),
  event_deletion_answered: R('we answered your request to remove a celebration'),
  part_finalization_requested: R('a couple asked you to finalize part of their design'),
  part_finalization_agreed: R('a supplier finalized part of your design'),
  part_finalization_declined: R('a supplier did not finalize part of your design yet'),
  part_reopen_requested: R('a couple asked to reopen a finalized part of their design'),
  part_reopen_answered: R('a supplier answered your request to reopen part of your design'),
  guest_takedown_honored: R("a guest's photo was taken down from your workspace at their request"),
  colour_changed_in_lane: R("someone you gave access changed your event's colours"),
  booking_fee_waived: R('a booking fee on your shop was waived'),
  date_change_requested: R('a couple asked to move the date of a booking you hold'),
  date_change_answered: R('a supplier answered your request to move a booking date'),
  date_change_closed: R('a request to move a booking date was closed'),
  date_moved: R('the date of a booking you are part of moved'),
};

/** Said when a type has no line of its own yet — true of every account mail. */
export const NOTIFICATION_EMAIL_FALLBACK_REASON = R('of activity on your Setnayan account');

/** The line under a notification email: the type's own reason. */
export function notificationEmailReason(type: NotificationType): string {
  return NOTIFICATION_EMAIL_REASONS[type] ?? NOTIFICATION_EMAIL_FALLBACK_REASON;
}
