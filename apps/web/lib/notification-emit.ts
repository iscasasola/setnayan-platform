import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { renderBrandedEmail } from '@/lib/email-template';
import { isWebPushConfigured, sendWebPush } from '@/lib/web-push';
import { isPlaceholderEmail } from '@/lib/anon-onboarding';
import type { NotificationType } from '@/lib/notifications';

// Web Push is wired at the same funnel as email but kept deliberately MINIMAL:
// only the highest-signal, time-sensitive types fire a push on top of the
// in-app notification + email. Everything else stays in-app/email only (the
// rest of 0028 is untouched). `chat_message` is the canonical "new
// vendor/couple message"; `vendor_inquiry_received` is its vendor-facing
// counterpart (a new booking inquiry to answer). Add more types here later as
// per-channel preferences (0028 deferred item) land.
//
// NOTE (deviation): the brief named "wedding-day reminder" as the 2nd emit
// point, but no `wedding_day_reminder` notification type exists in the code —
// day-of mode (0031) is UI/cron-free and emits no notification. We wired
// `vendor_inquiry_received` instead as the second high-signal push type.
const PUSH_ENABLED_TYPES: ReadonlySet<NotificationType> = new Set([
  'chat_message',
  'vendor_inquiry_received',
  // security_alert (2026-06-12): "your password was changed" is exactly the
  // high-signal, time-sensitive class this allowlist exists for — if it
  // WASN'T the user, every second until they see it matters.
  'security_alert',
  // inquiry_accepted (inquiry-accepted-visibility 2026-06-16): a vendor taking
  // the couple's inquiry opens the thread + reveals the name — the moment the
  // couple has been waiting on. High-signal + time-sensitive (they'll want to
  // reply while the vendor is engaged), so it earns a push. The type already
  // exists in the NotificationType enum + is emitted on accept; this only adds
  // the push channel — no schema change.
  'inquiry_accepted',
]);

// ---------------------------------------------------------------------------
// EMAIL allowlist (Notification Foundation · Phase A · 2026-06-19).
//
// THE BUG this fixes: previously emitNotification() emailed the recipient on
// EVERY notification type whenever RESEND_API_KEY was set, using one generic
// untemplated plaintext body. Couples + vendors got a spammy email for every
// in-app signal (kwento flash counts, informational badges, etc.). 0028 only
// ever specified email for the transactional set.
//
// This Set mirrors PUSH_ENABLED_TYPES: email fires ONLY for types in here.
// Everything else stays in-app/push-only (NO email). Gating to an allowlist
// can only REDUCE sends — it never emails a type that wasn't already being
// emailed — so this is a backward-safe, additive-direction change.
//
// Membership = the 0028 transactional templates + the clearly-transactional
// money/booking/account events, restricted to types that exist in the union
// today. Deliberately EXCLUDED because no such notification type exists in the
// code (they're sent via other paths or aren't emitted at all): a standalone
// `payment_instructions` type (instructions go out via the checkout email
// path, not emitNotification) and `wedding_day_reminder` (day-of mode 0031 is
// cron-free and emits no notification). "new vendor message" IS `chat_message`
// (see PUSH_ENABLED_TYPES note above). The two NEW Phase-A types listed here
// (vendor_status_change, dispute_resolved) are transactional and belong on the
// allowlist now even though Phase A doesn't yet emit them — Phase B wires the
// emit sites.
const EMAIL_ENABLED_TYPES: ReadonlySet<NotificationType> = new Set([
  // Payments + orders (0028 transactional core).
  'order_quoted',
  'order_paid',
  // Admin-side, and the reason this list exists: without it the alert is a tray
  // badge only, so "you have been paid" reaches nobody who is not already
  // looking at the console. This type covers BOTH the order submission and the
  // payment-proof notification.
  'order_awaiting_reconciliation',
  'payment_matched',
  'payment_rejected',
  // An order the buyer no longer has any way to see MUST reach them off-app —
  // its event is gone, so there is no screen left to notice a tray badge on.
  'order_cancelled',
  'payment_resubmit_requested',
  'payment_refunded',
  // Account + security.
  'security_alert',
  'vendor_status_change',
  // Bookings + vendor relationship.
  'rsvp_received',
  'inquiry_accepted',
  'booking_confirmed',
  'review_received',
  // Disputes.
  'dispute_filed',
  'dispute_resolved',
  // New vendor/couple message (the canonical "new_vendor_message").
  'chat_message',
  /*
    A SHOP HAS KEPT A DATE FOR THIS COUPLE — email, not just the tray.
    The three "a slot opened" waitlist paths already email every couple waiting
    on a date; this is the ONE waitlist event that told nobody, and it is the
    time-critical half: `max_waitlist_acceptances` lets the shop pick somebody
    else, so a couple who never hears loses a date that was being held for them.
    Transactional, so deliberately NOT in MARKETING_GATED_EMAIL_TYPES.
  */
  'waitlist_picked',
  /*
    THE SHOP IS ABOUT TO LOSE MONEY IT ALREADY PAID FOR, AND THE WHOLE POINT IS
    TO REACH SOMEBODY WHO IS NOT IN THE APP. A shop drifting toward a lapse is
    by definition one that is not opening its dashboard, so an in-app-only
    notice would land for exactly the suppliers who do not need it.

    ⚠ Transactional — their own balance, their own money — so deliberately NOT
    in MARKETING_GATED_EMAIL_TYPES. That set suppresses unless
    `users.marketing_opt_in = TRUE`, which is NOT NULL DEFAULT FALSE, and
    putting a transactional type in it silenced all six lock_request_* types for
    every user (see the note on that set). `credit-warning-emails.test.ts`
    asserts NON-membership for exactly that reason.
  */
  'vendor_credit_expiring',
  // Payment lifecycle (Phase 2 PR-B, 2026-06-20). The transactional money
  // signals the couple should get an email for: their payment plan is ready
  // (info_sent), a payment was confirmed by the vendor, and the plan cleared.
  // payment_logged is deliberately EXCLUDED — it's the vendor-facing
  // "couple logged a payment" nudge (in-app/push register), not a transactional
  // email to the couple. PR-B emits payment_info_sent now; the other two are
  // wired by PR-C/D, but belong on the allowlist up front.
  'payment_info_sent',
  'payment_confirmed',
  'payment_cleared',
  // Vendor lifecycle Phase 3→4 spine (2026-06-20). The couple confirming a
  // vendor's service is a transactional close-of-booking signal that also
  // invites the vendor to add a moment to the couple's editorial — worth an
  // email (same booking-relationship register as booking_confirmed / review_received).
  'completion_accepted',
  // Vendor → couple suggestion (Phase 3b delivery polish, 2026-06-30). A 1:1
  // vendor suggesting a buyable Studio add-on is high-signal + actionable — the
  // couple should hear about it even when they're not in the app. (Sibling
  // mood_board_share stays in-app-only; this earns email because it's a
  // paid-service nudge the couple acts on, not an informational fan-out.)
  'vendor_feature_suggested',
  // Setnayan AI guard delivery (2026-07-09,
  // Setnayan_AI_Realtime_Notifications_2026-07-02 § 4.1): "payment due soon
  // (GRD-01) → email" is the ONE guard the spec puts on the email channel — a
  // missed vendor payment is the highest-stakes thing the Guard watches, and
  // the couple may not be in the app when the window opens. ai_guard_alert
  // (GRD-02 statutory / GRD-05 over-budget) is deliberately NOT here: per the
  // spec's restraint rules everything non-payment stays in-app + weekly digest.
  // Neither AI type joins PUSH_ENABLED_TYPES — the push-worthy guards
  // (GRD-09/10 booked-out, GRD-03 price change) have no data source yet
  // (availability/price-change log = the MI spec's net-new table).
  'ai_payment_due',
  // Appointment confirmed (2026-07-11, Relationship Workspace + Appointments · PR
  // 12 follow-ups). When either side confirms a proposed meeting, the OTHER party
  // gets a "You're confirmed for {meeting} on {date}" email — a transactional
  // booking signal (same register as booking_confirmed / rsvp_received) worth
  // reaching them outside the app. Branded HTML + plaintext via the shared
  // renderer below. A scheduled T-minus reminder is a further follow-up.
  'appointment_reminder',
  // Creator audience layer (2026-07-16). A followed account published a new
  // chapter → their followers hear about it. UNLIKE every other allowlisted
  // type this one is an ENGAGEMENT signal, not transactional, so its email is
  // additionally gated on marketing consent (MARKETING_GATED_EMAIL_TYPES below)
  // — the in-app notification always lands; the email only reaches followers who
  // opted into marketing (RA 10173).
  'new_chapter_from_followed',
  // PR-H lock handshake (2026-07-27). ALL SIX are transactional and all six
  // must reach a person who is not in the app:
  //   · received/nudge → the SUPPLIER, who has 48 hours to answer and may never
  //     open the dashboard. An in-app-only nudge reaches exactly the suppliers
  //     who do not need it, which is the whole reason the owner ordered it.
  //   · agreed/declined/expired → the COUPLE, who is waiting on an answer they
  //     cannot get any other way. There is no SMS in V1, so email plus one card
  //     is the entire channel.
  //   · withdrawn → the SUPPLIER again, and for the same reason as received:
  //     they set a date aside for this and are owed the fact that they no
  //     longer need to.
  // Deliberately NOT in PUSH_ENABLED_TYPES: that list is four types and a 7-day
  // fuse is not that urgent.
  'lock_request_received',
  'lock_request_nudge',
  'lock_request_agreed',
  'lock_request_declined',
  'lock_request_expired',
  // slice B · the SIXTH. → the SUPPLIER, who was holding a hard-single slot on
  // the strength of the ask. A card that simply vanishes from their Overview
  // cannot tell them whether they lost the work or the app broke.
  'lock_request_withdrawn',
  /*
    The deletion handshake (owner 2026-08-21). All four are transactional and
    must reach somebody who is not in the app — the supplier is holding a
    couple's celebration in place by not answering, and the couple cannot
    proceed until they do. Deliberately NOT added to MARKETING_GATED_EMAIL_TYPES:
    that is the mistake which silenced all six lock_request types for every user
    (fixed the same day), and `transactional-email-is-not-marketing.test.ts`
    fails if a deletion_request_* type ever lands there.
  */
  'deletion_request_received',
  'deletion_request_nudge',
  'deletion_request_agreed',
  'deletion_request_declined',
  /*
    Our answer to a couple who asked us to remove a celebration. Transactional
    by any reading — they asked a question about their own money and are waiting
    on it — and it must reach somebody who is not in the app, because the whole
    point of the request is that they could not do the thing themselves.
    Deliberately NOT marketing-gated, same as the four above.
  */
  'event_deletion_answered',
  /*
    MB12 · the per-part design handshake (2026-09-04). All five are
    transactional and all five must reach somebody who is not in the app:

      · part_finalization_requested / part_reopen_requested → the SUPPLIER, who
        has 48 hours to answer. A supplier who is not opening the dashboard is
        exactly who these exist for, so an in-app-only badge reaches precisely
        the people who do not need it.
      · part_finalization_agreed / part_finalization_declined /
        part_reopen_answered → the COUPLE, who asked a question about their own
        design and cannot get the answer any other way. There is no SMS in V1.

    🔑 THE NOTIFICATION AND THIS LINE ARE TWO HALVES OF ONE MECHANISM. Shipping
    the emit without the allowlist entry is indistinguishable from shipping
    neither — that is the lesson the six lock_request_* types cost, and
    `part-finalization-notifications.test.ts` fails if any of these five drops
    off this set or lands in MARKETING_GATED_EMAIL_TYPES below.

    ⚠ Deliberately NOT in PUSH_ENABLED_TYPES: that list is four types, and a
    48-hour fuse on a design detail is not a 2am buzz.
    ⚠ Deliberately NOT in MARKETING_GATED_EMAIL_TYPES: that set suppresses
    unless users.marketing_opt_in = TRUE, which is NOT NULL DEFAULT FALSE — the
    mistake that silenced all six lock_request_* types for every user.
  */
  'part_finalization_requested',
  'part_finalization_agreed',
  'part_finalization_declined',
  'part_reopen_requested',
  'part_reopen_answered',
]);

// Consent gate for the ENGAGEMENT (non-transactional) subset of the email
// allowlist. V1's rule is "transactional emails send regardless of marketing
// preference" — but a "someone you follow posted" email is marketing-adjacent,
// so it additionally requires users.marketing_opt_in = TRUE. Membership here can
// only SUPPRESS a send (an opted-out follower still gets the in-app notification),
// never widen one.
const MARKETING_GATED_EMAIL_TYPES: ReadonlySet<NotificationType> = new Set([
  'new_chapter_from_followed',
  /*
    🚨 THE SIX `lock_request_*` TYPES WERE IN HERE, AND IT SUPPRESSED EVERY ONE
    OF THEM FOR EVERY USER.

    They are in `EMAIL_ENABLED_TYPES` above with a long comment arguing that all
    six are TRANSACTIONAL and must reach somebody who is not in the app. That
    same comment was pasted in HERE — into the set whose only effect is to
    SUPPRESS the send unless `users.marketing_opt_in = TRUE`. The column is
    `NOT NULL DEFAULT FALSE`, and production carries 9 users with 0 opted in, so
    the suppression was total: a supplier with seven days to answer a booking
    request was never emailed, and the couple waiting on that answer never heard
    either.

    🔑 THE GATE'S OWN COMMENT ASSERTED THE OPPOSITE — "Transactional types are
    unaffected (they're not in the gated set)" — while six transactional types
    sat in it. A sentence is not a mechanism.

    🔑 AND THE TEST COULD NOT SEE IT. `lock-request-notifications.test.ts`
    asserts membership of the EMAIL set and never looks at this one, so both
    halves agreed with each other and the suite stayed green. Two lists, one
    checked.

    Membership here means "marketing-adjacent, needs consent". A booking request
    is not marketing. Only genuinely engagement-shaped types belong.
  */
]);

export type EmitNotificationArgs = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  relatedUrl?: string | null;
};

/**
 * Server-only helper that drops a row into public.notifications via the
 * service-role client. Called from server actions immediately after the
 * underlying state change (chat insert, order update, payment decision).
 *
 * Also fires an email to the recipient via Resend when RESEND_API_KEY is
 * configured (and the user's marketing_opt_in flag isn't disqualifying —
 * V1 sends transactional regardless of marketing preference).
 *
 * Designed to fail soft: a failed notification or email never rolls back
 * the primary action. We log and continue.
 */
export async function emitNotification(args: EmitNotificationArgs): Promise<void> {
  const { userId, type, title, body = null, relatedUrl = null } = args;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('notifications').insert({
      user_id: userId,
      type,
      title: title.slice(0, 160),
      body,
      related_url: relatedUrl,
    });
    if (error) {
      console.error('[notifications] emit failed:', error.message);
    }
  } catch (e) {
    console.error('[notifications] emit threw:', e);
  }

  // Send email ONLY for allowlisted transactional types when Resend is
  // configured — fire-and-forget; failures here never affect the in-app
  // notification that already landed. The allowlist is the critical fix: it
  // stops the prior behavior of emailing the recipient on EVERY type.
  // (isEmailConfigured is async now — Integration Console DB-first resolver.)
  if ((await isEmailConfigured()) && EMAIL_ENABLED_TYPES.has(type)) {
    try {
      const admin = createAdminClient();
      const { data: recipient } = await admin
        .from('users')
        .select('email, marketing_opt_in')
        .eq('user_id', userId)
        .maybeSingle();
      // Engagement (non-transactional) types additionally require marketing
      // consent. Transactional types are unaffected (they're not in the gated
      // set). The in-app notification already landed above regardless; this only
      // suppresses the EMAIL for opted-out followers (Web Push below is
      // untouched — this type isn't push-enabled anyway).
      const marketingConsentOk =
        !MARKETING_GATED_EMAIL_TYPES.has(type) ||
        recipient?.marketing_opt_in === true;
      // Anon-draft: skip the send when the recipient is still anonymous — their
      // address is the non-routable placeholder (anon+<uuid>@anon.setnayan.local)
      // and Resend would bounce. The in-app notification row already landed
      // above, so they see it the moment they secure their account (same uid).
      if (
        marketingConsentOk &&
        recipient?.email &&
        !isPlaceholderEmail(recipient.email)
      ) {
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ??
          'https://setnayan-platform-web.vercel.app';
        const link = relatedUrl ? `${appUrl}${relatedUrl}` : appUrl;
        const text = [
          title,
          '',
          body ?? '',
          '',
          `Open Setnayan: ${link}`,
          '',
          '—',
          "You're receiving this because of activity on your Setnayan account.",
          `Manage notifications: ${appUrl}/dashboard/profile`,
        ]
          .filter((line) => line !== null && line !== undefined)
          .join('\n');

        // Branded multipart: HTML-capable clients render the Setnayan-styled
        // template (lib/email-template.ts), the rest fall back to `text`. The
        // branded renderer applies to every allowlisted type — there's one
        // shared layout, so no per-type renderer is needed.
        const html = renderBrandedEmail({
          heading: title,
          paragraphs: body ? [body] : [],
          ctaLabel: 'Open Setnayan',
          ctaHref: link,
          footnote:
            "You're receiving this because of activity on your Setnayan account.",
        });

        await sendEmail({
          to: recipient.email,
          subject: title,
          text,
          html,
        });
      }
    } catch (e) {
      console.error('[notifications] email-on-emit failed:', e);
    }
  }

  // Best-effort Web Push for the high-signal types only. Gated on VAPID env
  // (no-ops when unset) and fully fire-and-forget — a push failure never
  // affects the in-app notification or the email that already landed.
  if (isWebPushConfigured() && PUSH_ENABLED_TYPES.has(type)) {
    try {
      await sendWebPush(userId, {
        title,
        body,
        url: relatedUrl,
        tag: type,
      });
    } catch (e) {
      console.error('[notifications] push-on-emit failed:', e);
    }
  }
}
