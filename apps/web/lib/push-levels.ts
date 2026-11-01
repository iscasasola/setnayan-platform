/**
 * push-levels.ts — ONE LEVEL FOR EVERY NOTIFICATION TYPE, AND THE QUIET HOURS.
 *
 * Owner, 2026-10-31: *"Yes, add them"* — three levels, one list, every push goes
 * through it. This module replaces the old four-type push allowlist.
 *
 *   URGENT — instant, always buzzes, ignores quiet hours.
 *   NORMAL — instant, collapses per kind; during quiet hours it waits and arrives
 *            at 7 am, collapsed per kind (`lib/push-schedule.server.ts`).
 *   LOW    — never buzzes: the bell only, plus ONE evening summary push a day
 *            ("Today on your event: 3 updates", opens the bell).
 *
 * QUIET HOURS are 10 pm to 7 am, Asia/Manila. Only Urgent buzzes.
 *
 * This list governs PUSH only. Email is `EMAIL_ENABLED_TYPES`, and a type's level
 * says nothing about it.
 *
 * ➕ A NEW NOTIFICATION TYPE DOES NOT COMPILE until it has a level here (the
 * `Record` below is exhaustive), and `lib/push-levels.test.ts` fails too.
 *
 * Pure, so the test runs every rule.
 */
import type { NotificationType } from './notifications';
import { formatCount } from './format-number';

export type PushLevel = 'urgent' | 'normal' | 'low';

export const PUSH_LEVEL: Record<NotificationType, PushLevel> = {
  // ── URGENT ── payment received or rejected · security · the event day · a booking cancelled
  order_paid: 'urgent',
  order_awaiting_reconciliation: 'urgent', // the console's "you have been paid"
  payment_matched: 'urgent',
  payment_logged: 'urgent', // the supplier's "a payment came in"
  payment_confirmed: 'urgent',
  payment_cleared: 'urgent',
  payment_rejected: 'urgent',
  payment_resubmit_requested: 'urgent', // a payment refused, asked again
  order_cancelled: 'urgent',
  booking_cancelled: 'urgent',
  force_majeure_filed: 'urgent', // a supplier cannot make it
  security_alert: 'urgent',
  schedule_shifted: 'urgent', // the floor retimed the day by +N — the event-day schedule change

  // ── NORMAL ── RSVPs · chat · inquiries and quotes · bookings · what somebody is waiting on
  rsvp_received: 'normal',
  chat_message: 'normal',
  vendor_inquiry_received: 'normal',
  inquiry_accepted: 'normal',
  inquiry_declined: 'normal',
  inquiry_displaced: 'normal',
  inquiry_awaiting_reply: 'normal',
  inquiry_no_response: 'normal',
  order_quoted: 'normal',
  quote_accepted: 'normal',
  quote_declined: 'normal',
  change_order_proposed: 'normal',
  change_order_answered: 'normal',
  booking_confirmed: 'normal',
  lock_request_received: 'normal',
  lock_request_nudge: 'normal',
  lock_request_agreed: 'normal',
  lock_request_declined: 'normal',
  lock_request_expired: 'normal',
  lock_request_withdrawn: 'normal',
  date_change_requested: 'normal',
  date_change_answered: 'normal',
  date_change_closed: 'normal',
  date_moved: 'normal',
  schedule_change_requested: 'normal',
  deletion_request_received: 'normal',
  deletion_request_nudge: 'normal',
  deletion_request_agreed: 'normal',
  deletion_request_declined: 'normal',
  event_deletion_answered: 'normal',
  dispute_filed: 'normal',
  dispute_resolved: 'normal',
  help_ticket_replied: 'normal',
  waitlist_picked: 'normal',
  appointment_reminder: 'normal',
  payment_info_sent: 'normal',
  payment_refunded: 'normal',
  vendor_payment_asked: 'normal',
  vendor_payout_update: 'normal',
  ai_payment_due: 'normal',
  papic_pool_spent: 'normal',
  pax_surcharge_changed: 'normal',
  photo_delivery_failed: 'normal',
  guest_claim_pending: 'normal',
  cohost_added: 'normal',
  event_invitation: 'normal',

  // ── LOW ── mood board · tips and reminders not due soon · reviews · photo approvals · small updates
  mood_board_share: 'low',
  mood_board_changed: 'low',
  colour_changed_in_lane: 'low',
  vendor_feature_suggested: 'low',
  schedule_suggestion: 'low',
  ai_guard_alert: 'low',
  review_request: 'low',
  review_received: 'low',
  vendor_review_reply: 'low',
  couple_photo_shared: 'low',
  couple_photo_answered: 'low',
  photo_delivery_complete: 'low',
  papic_challenge_pending: 'low',
  part_finalization_requested: 'low',
  part_finalization_agreed: 'low',
  part_finalization_declined: 'low',
  part_reopen_requested: 'low',
  part_reopen_answered: 'low',
  completion_accepted: 'low',
  booking_fee_waived: 'low',
  guest_takedown_honored: 'low',
  guest_claim_rejected: 'low',
  access_more_asked: 'low',
  event_auto_surfaced: 'low',
  vendor_status_change: 'low',
  vendor_credit_expiring: 'low',
  vendor_joined: 'low',
  vendor_invite_declined: 'low',
  subscription_activated: 'low',
  editorial_decision: 'low',
  showcase_featured: 'low',
  gift: 'low',
  kwento_flagged: 'low',
  kwento_story_batch: 'low',
  kwento_flash_auto_walled: 'low',
  kwento_assignment_nudge: 'low',
  new_chapter_from_followed: 'low',
  creator_offer_received: 'low',
  creator_offer_responded: 'low',
  chapter_drove_inquiry: 'low',
  connection_request: 'low',
  connection_confirmed: 'low',
  samahan_story: 'low',
  samahan_message: 'low',
  samahan_join: 'low',
};

export function typesAtLevel(level: PushLevel): NotificationType[] {
  return (Object.keys(PUSH_LEVEL) as NotificationType[]).filter((t) => PUSH_LEVEL[t] === level);
}

// ── quiet hours — Asia/Manila is UTC+8 all year, with no daylight saving ─────

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 7;
/** When the one evening summary may go out: from 7 pm until quiet hours begin. */
export const EVENING_SUMMARY_HOUR = 19;

function manilaHour(nowMs: number): number {
  return new Date(nowMs + MANILA_OFFSET_MS).getUTCHours();
}

/** 00:00 of today in Manila, as an instant. */
function manilaMidnight(nowMs: number): number {
  return Math.floor((nowMs + MANILA_OFFSET_MS) / DAY_MS) * DAY_MS - MANILA_OFFSET_MS;
}

export function isQuietHours(nowMs: number): boolean {
  const h = manilaHour(nowMs);
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

export type PushDecision = 'send' | 'hold' | 'bell-only';

/**
 * THE ONE DECISION every emitted notice passes through.
 *   send      — buzz now.
 *   hold      — Normal in quiet hours: nothing now; the 7 am release carries it.
 *   bell-only — Low: never buzzes; the evening summary counts it.
 */
export function pushDecision(type: NotificationType, nowMs: number): PushDecision {
  const level = PUSH_LEVEL[type];
  if (level === 'urgent') return 'send';
  if (level === 'low') return 'bell-only';
  return isQuietHours(nowMs) ? 'hold' : 'send';
}

/** May the morning release run now? From 7 am until quiet hours begin. */
export function morningReleaseOpen(nowMs: number): boolean {
  return !isQuietHours(nowMs);
}

/** May the evening summary run now? From 7 pm until quiet hours begin. */
export function eveningSummaryOpen(nowMs: number): boolean {
  const h = manilaHour(nowMs);
  return h >= EVENING_SUMMARY_HOUR && h < QUIET_START_HOUR;
}

/** The quiet window that last ended: 10 pm yesterday → 7 am today, Manila. */
export function lastQuietWindow(nowMs: number): { startMs: number; endMs: number } {
  const midnight = manilaMidnight(nowMs);
  return { startMs: midnight - (24 - QUIET_START_HOUR) * HOUR_MS, endMs: midnight + QUIET_END_HOUR * HOUR_MS };
}

/** Today so far in Manila — the evening summary's day. */
export function manilaToday(nowMs: number): { startMs: number; endMs: number } {
  return { startMs: manilaMidnight(nowMs), endMs: nowMs };
}

/** "Today on your event: 3 updates" — and "your events" when they span more than one. */
export function eveningSummarySentence(f: { count: number; events: number }): string {
  const noun = f.count === 1 ? 'update' : 'updates';
  return `Today on your ${f.events > 1 ? 'events' : 'event'}: ${formatCount(f.count)} ${noun}`;
}
