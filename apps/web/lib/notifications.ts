import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isMissingRelationError,
  logQueryError,
} from '@/lib/supabase/error-detect';

export type NotificationType =
  // Account auto-surface (#7b, gap G6) — the RA 10173 "you were added" notice.
  // Fires ONLY behind FEATURE_ACCOUNT_AUTOSURFACE (default OFF) from
  // lib/account-autosurface.ts; inert in prod until counsel clears the flag.
  | 'event_auto_surfaced'
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
  // Exclusivity on lock (payment-gated lock): the couple locked another vendor
  // in a hard-single group, so this vendor's open inquiry is released (thread →
  // chat_inquiry_status 'displaced'). Vendor-recipient. Migration
  // 20270521628193_notification_type_inquiry_displaced.sql.
  | 'inquiry_displaced'
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
  | 'photo_delivery_failed'
  | 'vendor_token_purchase_pending'
  | 'vendor_tokens_credited'
  // Added 2026-06-10. Invite/Join v2 (2026-06-25) repurposed it: fired
  // (couple-recipient) from app/join/[eventId]/actions.ts (notifyCoupleUnlisted)
  // when an optimistically-admitted joiner didn't match the list and lands in the
  // couple's reconcile queue. (The original email-OTP claim flow it was created
  // for has been retired.)
  | 'guest_claim_pending'
  // Added 2026-06-12 alongside migration
  // 20261116000000_notification_type_security_alert.sql — the 10th 0028 V1
  // template, deliberately skipped in PR #1262 because this column is
  // enum-constrained. Fired (account-holder-recipient) from
  // lib/account-security-actions.ts → changePassword() and
  // app/reset-password/actions.ts → completePasswordReset() after the
  // password update succeeds: "Your password was changed — if this wasn't
  // you, reset it immediately and sign out other devices." NOT fired from
  // signOutOtherDevices (that's the remedy, not the threat).
  | 'security_alert'
  // Added 2026-06-15 (Alaala Lane 3 · Kwento P1) alongside migration
  // 20261227000000_kwento_flagged_notification_type.sql. Fired (couple-recipient)
  // from app/api/papic/kwento/route.ts when a guest's Kwento is HELD by Tier-1
  // moderation and needs review before it can appear on the wall. Clean Kwentos
  // do NOT notify (the queue/wall console surfaces them; no live-reception spam).
  | 'kwento_flagged'
  // Added 2026-06-18 (Kwento Monumental Upgrade · Flash tier).
  // kwento_story_batch: debounced batch email to the couple when a flagged Story
  // arrives (max 1 per 10 minutes per event — suppresses per-message spam during
  // a live reception). Fired from app/api/papic/kwento/route.ts.
  // kwento_flash_auto_walled: informational coordinator-only count shown in the
  // live console (not emailed). Logged as a notification row for the audit trail.
  | 'kwento_story_batch'
  | 'kwento_flash_auto_walled'
  // Added 2026-06-18 (Kwento Phase 3 · Assignment Board). Fired (guest-recipient)
  // from the nudge server action when a couple or delegate presses "Nudge" on an
  // assigned editorial moment. Capped at 3 nudges per assignment by the action.
  | 'kwento_assignment_nudge'
  // Added 2026-06-19 (Notification Foundation · Phase A) alongside migration
  // 20270129155743_add_notification_types.sql. Registered in the union + enum
  // now so the Phase-B emit-fix PRs can wire emitNotification() at their action
  // sites; Phase A itself emits NONE of these (safe to land before the migration
  // is applied — no code path INSERTs a brand-new type yet). Recipients/sites
  // land with the Phase-B PR that turns each one on:
  //   vendor_status_change  → vendor: verification / account status changed
  //   vendor_payout_update  → vendor: payout state advanced (EWT / Form 2307)
  //   dispute_resolved      → couple/vendor: an open dispute flag was closed
  //   vendor_review_reply   → couple: vendor replied to their review
  //   schedule_suggestion   → couple: vendor/coordinator suggested a timeline edit
  //   pax_surcharge_changed → couple: vendor adjusted the pax-based surcharge
  //   vendor_joined         → couple: an invited vendor claimed their profile
  //   editorial_decision    → vendor/couple: editorial/sponsored decision landed
  //   showcase_featured     → couple: their event was featured in the showcase
  //   guest_claim_rejected  → guest: couple rejected their invite-claim request
  | 'vendor_status_change'
  | 'vendor_payout_update'
  | 'dispute_resolved'
  | 'vendor_review_reply'
  | 'schedule_suggestion'
  | 'pax_surcharge_changed'
  | 'vendor_joined'
  | 'editorial_decision'
  | 'showcase_featured'
  | 'guest_claim_rejected'
  // Added 2026-06-20 (Vendor Transaction Lifecycle · Phase 2 · PR-B) alongside
  // migration 20270202160005_event_vendor_payment_plan.sql. The four
  // payment-lifecycle signals. PR-B emits ONLY payment_info_sent (couple, at
  // lock — "your payment info is ready"); payment_logged / payment_confirmed /
  // payment_cleared are registered now so PR-C/D just emit at their action
  // sites (DB enum + TS union already in place). Recipients:
  //   payment_info_sent  → couple: booking locked + payment plan ready to view
  //   payment_logged     → vendor: couple logged a payment against an installment
  //   payment_confirmed  → couple: vendor confirmed a logged payment
  //   payment_cleared    → couple: the full payment plan is settled
  | 'payment_info_sent'
  | 'payment_logged'
  | 'payment_confirmed'
  | 'payment_cleared'
  // Added 2026-06-20 (Vendor lifecycle Phase 3→4 spine) alongside migration
  // 20270205806123_add_completion_accepted_notification_type.sql. Fired
  // (vendor-recipient) from vendors/[vendorId]/review/actions.ts →
  // coupleConfirmReceived() once the couple confirms they received the vendor's
  // service. Closes the other side of the completion handshake: before this the
  // vendor only learned of a confirmation by happening to reopen the event
  // brief. Deep-links to their editorial-media page, so the confirmation
  // doubles as the invite to add a moment to the couple's story.
  | 'completion_accepted'
  // Added 2026-06-24 alongside migration
  // 20270221018919_add_order_reconciliation_notification_type.sql. Fired
  // (admin/internal-recipient) from lib/order-admin-notify.ts (couple
  // apply-then-pay orders) AND lib/subscription-purchase-notify.ts (vendor
  // subscription purchases). Both previously borrowed
  // 'vendor_token_purchase_pending', which made a couple's PHP order and a
  // vendor subscription both render the badge "TOKEN PURCHASE AWAITING PAYMENT"
  // (wrong — the customer token wallet is retired; a subscription isn't a token
  // pack). Its own type lets the badge read "Awaiting reconciliation".
  | 'order_awaiting_reconciliation'
  // Added 2026-06-24 (same migration). Fired (vendor-recipient) from
  // lib/subscription-purchase-notify.ts when a Pro/Enterprise plan goes live.
  // Replaces the borrowed 'vendor_tokens_credited' so a plan activation no
  // longer wears a "Tokens credited" badge (the body still mentions any bundled
  // vendor tokens — those are real and stay).
  | 'subscription_activated'
  // Added 2026-06-28 alongside migration
  // 20270308120000_mood_board_share_notification_type.sql. Fired
  // (vendor-recipient) from
  // app/dashboard/[eventId]/studio/mood-board/actions.ts →
  // shareMoodBoardWithVendors() when the couple presses "Share with vendors" on
  // their Mood Board. One notification per booked marketplace vendor, deep-linking
  // to the read-only /vendor-dashboard/clients/[eventId]/mood-board view they
  // already have access to (get_vendor_mood_board RPC). Informational nudge —
  // NOT on the email/push allowlists.
  | 'mood_board_share'
  // Added 2026-06-30 (Phase 3b delivery polish · migration
  // 20270327434080_vendor_feature_suggested_notification_type.sql). Fired
  // (COUPLE-recipient) from
  // app/vendor-dashboard/recommendations/share-actions.ts → suggestToCouple()
  // when a connected vendor suggests a buyable Studio add-on. One notification
  // per couple member, deep-linking to /dashboard/[eventId]/studio where the
  // "Suggested by your vendors" strip renders it. ON the email allowlist (reaches
  // a couple who isn't currently in the app); NOT on the push allowlist.
  | 'vendor_feature_suggested'
  // Added 2026-07-09 alongside migration
  // 20270527224949_setnayan_ai_guard_notifications.sql — the Setnayan AI GUARD
  // delivery layer (Setnayan_AI_Realtime_Notifications_2026-07-02 spec; the
  // 2026-07-08 recon verified the union had NO AI/guard member, making guard
  // notifications structurally impossible). Both are couple/host-recipient,
  // emitted from lib/setnayan-ai-notify.ts → sweepGuardNotifications() (the
  // cron-free lazy sweep mounted in the event dashboard layout), gated on
  // isSetnayanAiActiveForUser — no active Setnayan AI, no guard notifications.
  //   ai_payment_due → GRD-01: a vendor payment milestone is due within 7 days
  //                    (event_vendor_line_items due dates). ON the email
  //                    allowlist per spec § 4.1 ("payment due soon → email").
  //   ai_guard_alert → the other honestly-sourced guard templates today:
  //                    GRD-02 (statutory paperwork deadline) + GRD-05 (over
  //                    budget). In-app only — spec § 4.1 keeps non-payment
  //                    guards out of the interrupt channels.
  | 'ai_payment_due'
  | 'ai_guard_alert'
  // Added 2026-07-11 (Relationship Workspace + Appointments · PR 12 follow-ups)
  // alongside migration 20270719834517_appointment_reminder_notification_type.sql.
  // Fired (OTHER-party-recipient) from
  // app/_components/appointments-actions.ts → respondAppointment() on the CONFIRM
  // branch: "You're confirmed for {meeting} on {date}". ON the email allowlist —
  // a confirmed meeting is a transactional booking signal the counterparty should
  // get even when they're not in the app (same register as booking_confirmed /
  // rsvp_received). MVP = confirm-time reminder; a scheduled T-minus reminder is a
  // further follow-up (Resend scheduledAt / cron).
  | 'appointment_reminder'
  // Added 2026-07-16 (Creator "Adventure Chapter" · AUDIENCE layer) alongside
  // migration 20270815640306_creator_notification_type_new_chapter_from_followed.sql.
  // Fired (FOLLOWER-recipient) from the publishChapter server action → the
  // lib/creator-notify fan-out when a followed account PUBLISHES a new chapter.
  // In-app for every follower; email ONLY for followers who've opted into
  // marketing (MARKETING_GATED_EMAIL_TYPES in notification-emit) — this is an
  // engagement signal, not a transactional one, so it respects RA 10173 consent.
  | 'new_chapter_from_followed'
  // Creator Economy discount-collab (2026-07-16, migration
  // 20270817214733_vendor_creator_offers_collab_p1.sql). A vendor sent a
  // creator a discount offer (→ creator, in-app only); the creator responded
  // accept/decline (→ vendor). Both are transactional collab signals emitted
  // from the offer server actions.
  | 'creator_offer_received'
  | 'creator_offer_responded'
  // Creator Economy PR-C (migration 20270819553697). The creator's payoff loop:
  // a vendor UNLOCKED (spent a lead token on) an inquiry that came through the
  // creator's chapter Book CTA. In-app only — not on the email allowlist, so no
  // email fires regardless of consent; the tray row is the whole delivery.
  // Recipient = the chapter's creator; body names the chapter, never the couple.
  | 'chapter_drove_inquiry';

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  event_auto_surfaced: 'You were added to an event',
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
  inquiry_displaced: 'Inquiry released',
  force_majeure_filed: 'Force-majeure flag filed',
  new_chapter_from_followed: 'New chapter',
  creator_offer_received: 'Discount offer',
  creator_offer_responded: 'Offer answered',
  chapter_drove_inquiry: 'Your chapter drove an inquiry',
  booking_confirmed: 'Booking confirmed',
  review_received: 'New review',
  booking_cancelled: 'Booking cancelled',
  dispute_filed: 'Dispute filed',
  inquiry_awaiting_reply: 'Inquiry awaiting your reply',
  inquiry_no_response: 'Vendor hasn’t replied',
  photo_delivery_complete: 'Photos delivered',
  photo_delivery_failed: 'Photo delivery failed',
  vendor_token_purchase_pending: 'Token purchase awaiting payment',
  vendor_tokens_credited: 'Tokens credited',
  guest_claim_pending: 'Guest request to confirm',
  security_alert: 'Security alert',
  kwento_flagged: 'Guest story to review',
  kwento_story_batch: 'Guest stories to review',
  kwento_flash_auto_walled: 'Flash story auto-walled',
  kwento_assignment_nudge: 'Story assignment nudge',
  // Phase A (2026-06-19) — labels for the ten new types. Concise tray copy.
  vendor_status_change: 'Account status updated',
  vendor_payout_update: 'Payout update',
  dispute_resolved: 'Dispute resolved',
  vendor_review_reply: 'Vendor replied to your review',
  schedule_suggestion: 'Schedule suggestion',
  pax_surcharge_changed: 'Guest-count charge updated',
  vendor_joined: 'Vendor joined',
  editorial_decision: 'Editorial decision',
  showcase_featured: 'Featured in the showcase',
  guest_claim_rejected: 'Guest request declined',
  // Phase 2 PR-B (2026-06-20) — payment-lifecycle labels. Concise tray copy.
  payment_info_sent: 'Payment info ready',
  payment_logged: 'Payment logged',
  payment_confirmed: 'Payment confirmed',
  payment_cleared: 'Payment plan settled',
  // Vendor lifecycle Phase 3→4 spine (2026-06-20).
  completion_accepted: 'Service confirmed',
  // Admin reconciliation signal (2026-06-24) — couple orders + vendor
  // subscriptions awaiting payment confirmation. NOT a token purchase; kept
  // distinct from vendor_token_purchase_pending so the badge reads correctly.
  order_awaiting_reconciliation: 'Awaiting reconciliation',
  // Vendor subscription went live (2026-06-24). NOT "Tokens credited".
  subscription_activated: 'Plan active',
  // The couple shared their mood board with their booked vendors (2026-06-28).
  mood_board_share: 'Mood board shared',
  vendor_feature_suggested: 'A vendor suggested a service',
  // Setnayan AI guard delivery (2026-07-09) — concise tray copy; the rendered
  // GRD template body carries the specifics.
  ai_payment_due: 'Payment due soon',
  ai_guard_alert: 'Setnayan AI flagged something',
  // A meeting the other party confirmed (2026-07-11).
  appointment_reminder: 'Appointment confirmed',
};

export const NOTIFICATION_TYPE_TONE: Record<NotificationType, string> = {
  event_auto_surfaced: 'bg-sky-100 text-sky-800',
  chat_message: 'bg-sky-100 text-sky-800',
  order_quoted: 'bg-warn-100 text-warn-900',
  order_paid: 'bg-success-200 text-success-900',
  payment_matched: 'bg-success-100 text-success-800',
  payment_rejected: 'bg-danger-100 text-danger-800',
  payment_refunded: 'bg-violet-100 text-violet-800',
  // Amber matches the "still pending · action needed" register used by
  // payment_status='pending' (PAYMENT_STATUS_TONE in lib/orders.ts) — the
  // resubmit-requested state is operationally a return-to-pending after
  // admin review, not a hard rejection.
  payment_resubmit_requested: 'bg-warn-100 text-warn-900',
  rsvp_received: 'bg-terracotta/15 text-terracotta-700',
  review_request: 'bg-warn-100 text-warn-900',
  help_ticket_replied: 'bg-indigo-100 text-indigo-800',
  vendor_inquiry_received: 'bg-fuchsia-100 text-fuchsia-800',
  inquiry_accepted: 'bg-success-100 text-success-800',
  inquiry_declined: 'bg-ink/10 text-ink/70',
  inquiry_displaced: 'bg-ink/10 text-ink/70',
  force_majeure_filed: 'bg-danger-100 text-danger-800',
  // Booking confirmed is the couple's strongest positive commitment — match
  // the celebratory emerald used by order_paid/inquiry_accepted.
  booking_confirmed: 'bg-success-200 text-success-900',
  review_received: 'bg-warn-100 text-warn-900',
  booking_cancelled: 'bg-danger-100 text-danger-800',
  dispute_filed: 'bg-danger-100 text-danger-800',
  // Both ghosting nudges are "action needed, not an error" → amber, matching
  // review_request / resubmit-requested.
  inquiry_awaiting_reply: 'bg-warn-100 text-warn-900',
  inquiry_no_response: 'bg-warn-100 text-warn-900',
  photo_delivery_complete: 'bg-success-100 text-success-800',
  photo_delivery_failed: 'bg-danger-100 text-danger-800',
  // Pending purchase = admin action needed → amber (matches resubmit/awaiting).
  vendor_token_purchase_pending: 'bg-warn-100 text-warn-900',
  // Tokens credited = positive money-in confirmation → emerald (matches order_paid).
  vendor_tokens_credited: 'bg-success-200 text-success-900',
  // Guest request awaiting the couple's confirmation = action needed → amber.
  guest_claim_pending: 'bg-warn-100 text-warn-900',
  // Security alert = the alarm register — rose, matching payment_rejected /
  // dispute_filed. Benign for the user who made the change, urgent for the
  // one who didn't; the tray must read as "look at this now" either way.
  security_alert: 'bg-danger-100 text-danger-800',
  // A held guest story = the couple's okay is needed → amber (action-needed),
  // matching review_request / guest_claim_pending.
  kwento_flagged: 'bg-warn-100 text-warn-900',
  // Debounced batch story notify = same action-needed register as kwento_flagged.
  kwento_story_batch: 'bg-warn-100 text-warn-900',
  // Flash auto-walled = informational / positive → sky (matches chat_message).
  kwento_flash_auto_walled: 'bg-sky-100 text-sky-800',
  // A nudge to write their story = gentle action-needed → amber (same register).
  kwento_assignment_nudge: 'bg-warn-100 text-warn-900',
  // Phase A (2026-06-19) — tones for the ten new types, following the existing
  // register: emerald = positive/confirmation, rose = alarm/negative, amber =
  // action-needed, sky = informational, indigo = ops/reply.
  // Verification/account status can swing either way (verified vs suspended);
  // sky reads as a neutral "look at this status change" either way.
  vendor_status_change: 'bg-sky-100 text-sky-800',
  // Money-in confirmation → emerald, matching vendor_tokens_credited / order_paid.
  vendor_payout_update: 'bg-success-200 text-success-900',
  // A dispute closing is a resolution/relief, not an alarm → emerald.
  dispute_resolved: 'bg-success-100 text-success-800',
  // A reply to the couple's review = a conversational reply → indigo, matching
  // help_ticket_replied (the other "someone replied to you" type).
  vendor_review_reply: 'bg-indigo-100 text-indigo-800',
  // A suggested timeline edit needs the couple's okay → amber (action-needed),
  // matching schedule_suggestion's sibling review_request.
  schedule_suggestion: 'bg-warn-100 text-warn-900',
  // A changed guest-count charge needs the couple's attention/confirm → amber.
  pax_surcharge_changed: 'bg-warn-100 text-warn-900',
  // An invited vendor accepting/claiming = a positive arrival → emerald.
  vendor_joined: 'bg-success-100 text-success-800',
  // An editorial/sponsored decision is informational → sky.
  editorial_decision: 'bg-sky-100 text-sky-800',
  // Being featured in the showcase is celebratory → emerald.
  showcase_featured: 'bg-success-200 text-success-900',
  // A declined guest request is a soft negative → muted ink, matching
  // inquiry_declined (the other "your request was declined, no leak" type).
  guest_claim_rejected: 'bg-ink/10 text-ink/70',
  // Phase 2 PR-B (2026-06-20) — payment-lifecycle tones.
  // "Your payment plan is ready" = an informational, positive next-step → sky
  // (matches chat_message / the informational register).
  payment_info_sent: 'bg-sky-100 text-sky-800',
  // A logged payment awaiting the vendor's confirm = action-needed → amber.
  payment_logged: 'bg-warn-100 text-warn-900',
  // A confirmed payment = a positive money-in confirmation → emerald
  // (matches order_paid / vendor_tokens_credited).
  payment_confirmed: 'bg-success-100 text-success-800',
  // The whole plan settled = the strongest positive close → emerald.
  payment_cleared: 'bg-success-200 text-success-900',
  // The couple confirmed receipt = a positive close to the booking + an invite
  // to add a moment to their story → emerald (matches booking_confirmed).
  completion_accepted: 'bg-success-200 text-success-900',
  // A new paid order/subscription awaiting admin reconciliation = action-needed
  // → amber (same register as the vendor_token_purchase_pending it replaces here).
  order_awaiting_reconciliation: 'bg-warn-100 text-warn-900',
  // A plan going live = a positive money-in confirmation → emerald (matches
  // order_paid / the vendor_tokens_credited it replaces here).
  subscription_activated: 'bg-success-200 text-success-900',
  // The couple sharing their mood board = a positive, informational arrival in
  // the vendor's tray → sky (matches editorial_decision / the informational register).
  mood_board_share: 'bg-sky-100 text-sky-800',
  vendor_feature_suggested: 'bg-terracotta-100 text-terracotta-900',
  // Setnayan AI guard delivery (2026-07-09). Both are "action needed, not an
  // error" — amber, matching review_request / payment_logged. A payment coming
  // due or a budget/document flag needs the couple's attention, but nothing has
  // gone wrong yet (that register belongs to rose/danger).
  ai_payment_due: 'bg-warn-100 text-warn-900',
  ai_guard_alert: 'bg-warn-100 text-warn-900',
  // A confirmed meeting = a positive close-of-scheduling → emerald (matches
  // booking_confirmed / the confirmation register).
  appointment_reminder: 'bg-success-100 text-success-800',
  // A new chapter from someone you follow = a positive, informational arrival
  // (the audience-layer engagement signal) → sky, matching chat_message / the
  // informational register.
  new_chapter_from_followed: 'bg-sky-100 text-sky-900',
  // Creator-collab signals — the same warm register as bookings/partnerships.
  creator_offer_received: 'bg-amber-100 text-amber-900',
  creator_offer_responded: 'bg-amber-100 text-amber-900',
  // The creator's payoff signal ("inquiries driven" ticked up) — same warm
  // collab register as the offer pair.
  chapter_drove_inquiry: 'bg-amber-100 text-amber-900',
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
