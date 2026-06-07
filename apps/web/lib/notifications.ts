import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isMissingRelationError,
  logQueryError,
} from '@/lib/supabase/error-detect';

export type NotificationType =
  | 'chat_message'
  | 'order_quoted'
  | 'order_paid'
  | 'payment_matched'
  | 'payment_rejected'
  // Added 2026-06-07 alongside migration 20260607060000_iteration_0023_order_refunds.sql
  // for the /admin/payments refund action (CLAUDE.md 2026-05-23 row). Fired
  // from /admin/payments/actions.ts → refundOrder() after the orders row is
  // flipped to 'refunded' + the order_refunds audit row is inserted.
  | 'payment_refunded'
  // Added 2026-05-29 Day 3 of the voucher + inline-checkout sprint, alongside
  // migration 20260529030000_voucher_system_day3_admin_resubmit.sql. Fired
  // from /admin/payments/actions.ts → requestPaymentResubmit() when an admin
  // picks the 3rd option (Approve / Reject / Request resubmit) on a pending
  // payment that doesn't match the expected reference + needs the couple to
  // resubmit with corrected proof (wrong amount, blurry screenshot, missing
  // ref code). Distinct from 'payment_rejected' so the notification tray +
  // email subject can render the right copy (a polite "can you upload again"
  // vs. a hard "your payment did not match"). See sprint brief Day 3 scope.
  | 'payment_resubmit_requested'
  | 'rsvp_received'
  | 'review_request'
  | 'help_ticket_replied'
  | 'vendor_inquiry_received'
  // Added 2026-06-02 alongside migration 20260722000000_chat_inquiry_accept_gate.sql
  // for the chat accept-gate (CLAUDE.md 2026-06-02: "the chat will only reveal
  // when the vendor accepts the inquiry"). Fired from lib/chat-actions.ts →
  // acceptInquiry()/declineInquiry() to tell the couple the vendor's decision.
  // accepted → chat opens + vendor name revealed; declined → no name leak +
  // pointed at alternatives on the Services tab.
  | 'inquiry_accepted'
  | 'inquiry_declined'
  | 'force_majeure_filed'
  // Added 2026-06-07 alongside migration
  // 20260907000000_notification_types_cross_actor_signals.sql — cross-actor
  // interaction audit. These close silent one-way breaks where a couple
  // action mutated the couple↔vendor relationship but never reached the
  // vendor (event_vendors is couple-only by RLS, so the vendor had no read
  // path either). All four are vendor-recipient:
  //   booking_confirmed → finalizeVendor locks a marketplace vendor
  //   review_received   → couple posts a vendor review (submitCoupleReview)
  //   booking_cancelled → host cancels a pre-downpayment booking
  //                       (cancelBookingAsHost; consolidates the prior
  //                       email-only path onto emitNotification)
  //   dispute_filed     → couple files a force-majeure flag naming the vendor
  | 'booking_confirmed'
  | 'review_received'
  | 'booking_cancelled'
  | 'dispute_filed'
  // Added 2026-06-07 alongside migration 20260909000000_login_ghosting_check.sql
  // — login-driven ghosting escalation (no cron). Fired lazily, once per login,
  // from apps/web/lib/ghosting.ts via the dashboard layouts:
  //   inquiry_awaiting_reply → VENDOR logs in, has inquiries unanswered past
  //                            the threshold (nudge to reply)
  //   inquiry_no_response    → COUPLE logs in, their inquiry is still
  //                            unanswered past the threshold (nudge to explore
  //                            alternatives)
  | 'inquiry_awaiting_reply'
  | 'inquiry_no_response'
  | 'photo_delivery_complete'
  | 'photo_delivery_failed';

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  chat_message: 'New message',
  order_quoted: 'Order quoted',
  order_paid: 'Order paid',
  payment_matched: 'Payment matched',
  payment_rejected: 'Payment rejected',
  payment_refunded: 'Refund issued',
  payment_resubmit_requested: 'Please resubmit payment',
  rsvp_received: 'RSVP received',
  review_request: 'Review request',
  help_ticket_replied: 'Help ticket reply',
  vendor_inquiry_received: 'New booking inquiry',
  inquiry_accepted: 'Inquiry accepted',
  inquiry_declined: 'Inquiry declined',
  force_majeure_filed: 'Force-majeure flag filed',
  booking_confirmed: 'Booking confirmed',
  review_received: 'New review',
  booking_cancelled: 'Booking cancelled',
  dispute_filed: 'Dispute filed',
  inquiry_awaiting_reply: 'Inquiry awaiting your reply',
  inquiry_no_response: 'Vendor hasn’t replied',
  photo_delivery_complete: 'Photos delivered',
  photo_delivery_failed: 'Photo delivery failed',
};

export const NOTIFICATION_TYPE_TONE: Record<NotificationType, string> = {
  chat_message: 'bg-sky-100 text-sky-800',
  order_quoted: 'bg-amber-100 text-amber-900',
  order_paid: 'bg-emerald-200 text-emerald-900',
  payment_matched: 'bg-emerald-100 text-emerald-800',
  payment_rejected: 'bg-rose-100 text-rose-800',
  payment_refunded: 'bg-violet-100 text-violet-800',
  // Amber matches the "still pending · action needed" register used by
  // payment_status='pending' (PAYMENT_STATUS_TONE in lib/orders.ts) — the
  // resubmit-requested state is operationally a return-to-pending after
  // admin review, not a hard rejection.
  payment_resubmit_requested: 'bg-amber-100 text-amber-900',
  rsvp_received: 'bg-terracotta/15 text-terracotta-700',
  review_request: 'bg-amber-100 text-amber-900',
  help_ticket_replied: 'bg-indigo-100 text-indigo-800',
  vendor_inquiry_received: 'bg-fuchsia-100 text-fuchsia-800',
  inquiry_accepted: 'bg-emerald-100 text-emerald-800',
  inquiry_declined: 'bg-ink/10 text-ink/70',
  force_majeure_filed: 'bg-rose-100 text-rose-800',
  // Booking confirmed is the couple's strongest positive commitment — match
  // the celebratory emerald used by order_paid/inquiry_accepted.
  booking_confirmed: 'bg-emerald-200 text-emerald-900',
  review_received: 'bg-amber-100 text-amber-900',
  booking_cancelled: 'bg-rose-100 text-rose-800',
  dispute_filed: 'bg-rose-100 text-rose-800',
  // Both ghosting nudges are "action needed, not an error" → amber, matching
  // review_request / resubmit-requested.
  inquiry_awaiting_reply: 'bg-amber-100 text-amber-900',
  inquiry_no_response: 'bg-amber-100 text-amber-900',
  photo_delivery_complete: 'bg-emerald-100 text-emerald-800',
  photo_delivery_failed: 'bg-rose-100 text-rose-800',
};

export type NotificationRow = {
  notification_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  related_url: string | null;
  read_at: string | null;
  created_at: string;
};

export async function fetchOwnNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('notification_id,user_id,type,title,body,related_url,read_at,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    // 4th hotfix pass (2026-05-23): missing-relation → graceful empty
    // list. The notifications table + every type enum value has been in
    // prod since 2026-05-13, but a future ADD VALUE to `NotificationType`
    // (most recent: `photo_delivery_*` 2026-05-19) lands on code-before-
    // SQL by 1 push cycle. The bell badge calling `fetchOwnNotifications`
    // shouldn't crash the entire /dashboard/notifications page when the
    // schema cache hasn't caught up. Empty list is the safer fallback.
    if (isMissingRelationError(error)) {
      logQueryError(
        'fetchOwnNotifications',
        error,
        { user_id: userId, limit },
        'graceful_degrade',
      );
      return [];
    }
    // Real bug (auth, RLS denial, real network failure) — log structured
    // context BEFORE throwing so the breadcrumb survives even if the
    // request-error hook misses it. Previous shape threw without
    // logging, which left the call_site invisible in Sentry.
    logQueryError(
      'fetchOwnNotifications',
      error,
      { user_id: userId, limit },
      'will_throw',
    );
    throw new Error(`fetchOwnNotifications failed: ${error.message}`);
  }
  return (data ?? []) as NotificationRow[];
}

// Wrapped in React `cache()` so the dashboard chrome's unread-bell badge
// (shown in both the outer layout AND the per-event layout AND queried again
// inside the home page) reduces from 3 count(*) queries per nav down to one.
//
// 4th hotfix pass (2026-05-23): countUnread sits on the chrome path of
// EVERY authenticated dashboard surface — outer DashboardLayout, inner
// per-event layout, and home page bell. A silent failure here would
// mean the badge reads 0 (acceptable), but a thrown Postgres error
// would crash the entire /dashboard/[eventId]/* subtree including the
// guests page that's been failing for 4 hotfix cycles. Capture the
// error explicitly, log it, fall back to 0. Never throw from chrome.
export const countUnread = cache(async (
  supabase: SupabaseClient,
  userId: string,
): Promise<number> => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) {
    logQueryError(
      'countUnread',
      error,
      { user_id: userId },
      'graceful_degrade',
    );
    return 0;
  }
  return count ?? 0;
});

export function relativeTime(iso: string, now = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}
