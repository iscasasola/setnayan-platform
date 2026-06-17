/**
 * vendor-email-triggers.ts
 *
 * Threshold-action email notifications for the vendor quality system
 * (iteration 0022 § quality + 0023 § vendor action surfaces).
 *
 * All five functions follow the plain-text `sendEmail` pattern established
 * in `lib/email.ts` and `lib/notification-emit.ts`. No new email library is
 * introduced. HTML rendering is a follow-on (same comment as every other
 * template in this codebase).
 *
 * Vendor email resolution order:
 *   1. vendor_profiles.contact_email — vendor-entered business email
 *   2. users.email (via user_id) — auth account email (fallback when
 *      contact_email is null or blank)
 *
 * Every send is best-effort: failures log and return without throwing so the
 * calling server action / admin queue handler is never blocked.
 */

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, type SendEmailResult } from '@/lib/email';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

/**
 * Resolve the best-available email address for a vendor, plus the business
 * name for personalisation. Returns null when the vendor can't be found.
 */
async function fetchVendorContact(vendorProfileId: string): Promise<{
  email: string;
  businessName: string;
  userId: string;
} | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('vendor_profiles')
    .select('contact_email, business_name, user_id')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();

  if (error || !data) {
    console.error('[vendor-email] fetchVendorContact failed:', error?.message ?? 'not found', { vendorProfileId });
    return null;
  }

  // Prefer the vendor-entered contact email; fall back to the auth email.
  let email = data.contact_email?.trim() ?? '';
  if (!email) {
    const { data: user, error: userError } = await admin
      .from('users')
      .select('email')
      .eq('user_id', data.user_id)
      .maybeSingle();

    if (userError || !user?.email) {
      console.error('[vendor-email] auth email lookup failed:', userError?.message ?? 'not found', { vendorProfileId });
      return null;
    }
    email = user.email;
  }

  return {
    email,
    businessName: data.business_name ?? 'your business',
    userId: data.user_id,
  };
}

// ---------------------------------------------------------------------------
// 1. Vendor under review
//    Triggered by two-admin gate after Bayesian avg drops below 3.0.
// ---------------------------------------------------------------------------

/**
 * Notifies a vendor that their profile has been flagged for admin review
 * due to a low Bayesian rating average. Profile stays visible but carries
 * an "Under review" label on the marketplace.
 */
export async function sendVendorUnderReviewEmail(
  vendorProfileId: string,
): Promise<SendEmailResult> {
  const contact = await fetchVendorContact(vendorProfileId);
  if (!contact) return { ok: false, reason: 'send_failed', error: 'vendor contact not found' };

  const dashboardUrl = `${APP_URL}/vendor-dashboard/profile`;
  const helpUrl = `${APP_URL}/help`;

  const text = [
    `Hi ${contact.businessName},`,
    ``,
    `We've flagged your Setnayan profile for review because your average rating has dropped below our quality threshold (3.0).`,
    ``,
    `What this means:`,
    `  • Your profile remains visible on the marketplace`,
    `  • An "Under review" label is shown to couples until the review is resolved`,
    `  • The Setnayan HQ team will reach out if they need additional information`,
    ``,
    `What you can do:`,
    `  1. Check your recent reviews and respond thoughtfully to any feedback`,
    `  2. Reach out to couples you've worked with and invite them to share their experience`,
    `  3. Update your profile to better reflect your current services and portfolio`,
    ``,
    `To appeal this decision or speak with our team:`,
    helpUrl,
    ``,
    `Your dashboard:`,
    dashboardUrl,
    ``,
    `—`,
    `Set na 'yan.`,
    `Setnayan HQ`,
  ].join('\n');

  return sendEmail({
    to: contact.email,
    subject: 'Your Setnayan profile is under review',
    text,
  });
}

// ---------------------------------------------------------------------------
// 2. Vendor suspended
//    Triggered by two-admin gate after 2+ cancellations in 90 days.
// ---------------------------------------------------------------------------

/**
 * Notifies a vendor that their account has been temporarily suspended due
 * to repeated vendor-initiated cancellations. Includes the count, expected
 * duration, and an appeal path.
 */
export async function sendVendorSuspensionEmail(
  vendorProfileId: string,
  cancellationCount: number,
): Promise<SendEmailResult> {
  const contact = await fetchVendorContact(vendorProfileId);
  if (!contact) return { ok: false, reason: 'send_failed', error: 'vendor contact not found' };

  const helpUrl = `${APP_URL}/help`;
  const countWord = cancellationCount === 1 ? '1 cancellation' : `${cancellationCount} cancellations`;

  const text = [
    `Hi ${contact.businessName},`,
    ``,
    `Your Setnayan account has been temporarily suspended.`,
    ``,
    `Reason:`,
    `  ${countWord} initiated by your business in the last 90 days have been recorded.`,
    `  Couples rely on vendors honouring their commitments. Repeated cancellations`,
    `  damage the couple's planning and undermine trust on the platform.`,
    ``,
    `What happens next:`,
    `  • Your profile is hidden from the marketplace during the suspension`,
    `  • Existing active threads remain accessible for handover purposes`,
    `  • The Setnayan HQ team will review the circumstances and contact you`,
    `  • Duration is determined by the reviewing team based on context`,
    ``,
    `To appeal this decision:`,
    helpUrl,
    ``,
    `If you believe this is a mistake, please contact us immediately so we can`,
    `review the situation as quickly as possible.`,
    ``,
    `—`,
    `Set na 'yan.`,
    `Setnayan HQ`,
  ].join('\n');

  return sendEmail({
    to: contact.email,
    subject: 'Your Setnayan account has been temporarily suspended',
    text,
  });
}

// ---------------------------------------------------------------------------
// 3. Ghost warning — confirmed booking, 7 days out, vendor silent
//    Triggered by the ghost detection sweep that marks at-risk vendors.
// ---------------------------------------------------------------------------

/**
 * Warns a vendor they have a confirmed booking in 7 days with no recent
 * activity in the thread. They need to confirm they're ready to proceed.
 */
export async function sendVendorGhostWarningEmail(
  vendorProfileId: string,
  eventId: string,
): Promise<SendEmailResult> {
  const contact = await fetchVendorContact(vendorProfileId);
  if (!contact) return { ok: false, reason: 'send_failed', error: 'vendor contact not found' };

  // Fetch the event details: couple display name + event date.
  const admin = createAdminClient();
  const { data: eventData } = await admin
    .from('events')
    .select('event_date, display_name, event_id')
    .eq('event_id', eventId)
    .maybeSingle();

  const eventDateStr = eventData?.event_date
    ? new Date(eventData.event_date as string).toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'your upcoming event';

  const coupleName = (eventData?.display_name as string | null | undefined)?.trim() || 'your couple';

  const threadUrl = `${APP_URL}/vendor-dashboard/clients`;

  const text = [
    `Hi ${contact.businessName},`,
    ``,
    `This is a reminder that you have a confirmed booking coming up.`,
    ``,
    `  Couple: ${coupleName}`,
    `  Event date: ${eventDateStr}`,
    ``,
    `We haven't seen recent activity in your thread with this couple. As the event`,
    `is 7 days away, please log in and confirm you're ready to proceed.`,
    ``,
    `Why this matters:`,
    `  The couple is counting on your confirmation to finalize their day-of plans.`,
    `  If something has changed, let them know as early as possible so they can`,
    `  make alternative arrangements.`,
    ``,
    `Open your client threads:`,
    threadUrl,
    ``,
    `If you're all set, a quick message in the thread to confirm is all we need.`,
    ``,
    `—`,
    `Set na 'yan.`,
    `Setnayan HQ`,
  ].join('\n');

  return sendEmail({
    to: contact.email,
    subject: 'Action required — you have a booking in 7 days',
    text,
  });
}

// ---------------------------------------------------------------------------
// 4a. Review flag outcome → vendor who flagged
// ---------------------------------------------------------------------------

/**
 * Notifies the vendor that their fake-review report has been resolved.
 * Sent when an admin makes a final decision on the flagged review.
 */
export async function sendReviewFlagOutcomeToVendorEmail(
  vendorProfileId: string,
  outcome: 'kept' | 'removed',
  reason: string,
): Promise<SendEmailResult> {
  const contact = await fetchVendorContact(vendorProfileId);
  if (!contact) return { ok: false, reason: 'send_failed', error: 'vendor contact not found' };

  const helpUrl = `${APP_URL}/help`;
  const outcomeWord = outcome === 'removed' ? 'upheld' : 'dismissed';
  const outcomeDetail =
    outcome === 'removed'
      ? 'The review has been removed from your profile.'
      : 'The review will remain on your profile.';

  const text = [
    `Hi ${contact.businessName},`,
    ``,
    `Your fake-review report has been reviewed by the Setnayan HQ team.`,
    ``,
    `Outcome: Your report was ${outcomeWord}.`,
    outcomeDetail,
    ``,
    `Reason:`,
    reason,
    ``,
    `If you have questions about this decision:`,
    helpUrl,
    ``,
    `—`,
    `Set na 'yan.`,
    `Setnayan HQ`,
  ].join('\n');

  return sendEmail({
    to: contact.email,
    subject: `Your fake review report has been ${outcomeWord}`,
    text,
  });
}

// ---------------------------------------------------------------------------
// 4b. Review flag outcome → couple whose review was flagged
// ---------------------------------------------------------------------------

/**
 * Notifies a couple that a vendor flagged their review for investigation
 * and that a decision has been made. The couple's user_id is resolved via
 * the vendor_reviews table.
 */
export async function sendReviewFlagOutcomeToCoupleEmail(
  reviewId: string,
  outcome: 'kept' | 'removed',
  reason: string,
): Promise<SendEmailResult> {
  const admin = createAdminClient();

  // Fetch the review to get the couple's user_id.
  const { data: review, error: reviewError } = await admin
    .from('vendor_reviews')
    .select('couple_user_id')
    .eq('review_id', reviewId)
    .maybeSingle();

  if (reviewError || !review?.couple_user_id) {
    console.error('[vendor-email] review lookup failed for couple email:', reviewError?.message ?? 'no couple_user_id', { reviewId });
    return { ok: false, reason: 'send_failed', error: 'couple not found for review' };
  }

  const { data: user, error: userError } = await admin
    .from('users')
    .select('email')
    .eq('user_id', review.couple_user_id)
    .maybeSingle();

  if (userError || !user?.email) {
    console.error('[vendor-email] couple email lookup failed:', userError?.message ?? 'not found', { reviewId });
    return { ok: false, reason: 'send_failed', error: 'couple email not found' };
  }

  const appUrl = APP_URL;
  const outcomeWord = outcome === 'kept' ? 'kept' : 'removed';
  const outcomeDetail =
    outcome === 'kept'
      ? 'After reviewing your submission, we found no violations and your review remains on the vendor\'s profile.'
      : 'After reviewing your submission, we found that the review did not meet our guidelines and it has been removed.';

  const helpUrl = `${appUrl}/help`;

  const text = [
    `Hi,`,
    ``,
    `A vendor flagged one of your Setnayan reviews for investigation.`,
    `The Setnayan HQ team has completed their review.`,
    ``,
    `Outcome: Your review has been ${outcomeWord}.`,
    outcomeDetail,
    ``,
    `Reason:`,
    reason,
    ``,
    `If you have questions or would like to appeal:`,
    helpUrl,
    ``,
    `—`,
    `Set na 'yan.`,
    `Setnayan HQ`,
  ].join('\n');

  return sendEmail({
    to: user.email,
    subject: `Update on your Setnayan review — it has been ${outcomeWord}`,
    text,
  });
}

// ---------------------------------------------------------------------------
// 4. Combined convenience wrapper: send BOTH flag outcome emails in one call
// ---------------------------------------------------------------------------

/**
 * Sends both the vendor-who-flagged email and the couple-who-reviewed email
 * for a review flag outcome decision. Both sends are attempted; the first
 * failure doesn't skip the second.
 *
 * Returns the couple's outcome result (the caller's most likely interest).
 */
export async function sendReviewFlagOutcomeEmail(
  reviewId: string,
  outcome: 'kept' | 'removed',
  reason: string,
): Promise<void> {
  const admin = createAdminClient();

  // Fetch review to get vendor_profile_id.
  const { data: review } = await admin
    .from('vendor_reviews')
    .select('vendor_profile_id')
    .eq('review_id', reviewId)
    .maybeSingle();

  const sends: Promise<unknown>[] = [];

  if (review?.vendor_profile_id) {
    sends.push(
      sendReviewFlagOutcomeToVendorEmail(review.vendor_profile_id, outcome, reason)
        .catch((e) => console.error('[vendor-email] vendor flag outcome email failed:', e)),
    );
  }

  sends.push(
    sendReviewFlagOutcomeToCoupleEmail(reviewId, outcome, reason)
      .catch((e) => console.error('[vendor-email] couple flag outcome email failed:', e)),
  );

  await Promise.allSettled(sends);
}

// ---------------------------------------------------------------------------
// 5. Slow to respond
//    Triggered from recomputeVendorActivityStats when response_rate_pct
//    crosses below 50 for the first time (edge-trigger, not level-trigger).
// ---------------------------------------------------------------------------

/**
 * Nudges a vendor whose response rate has dropped below the 50% threshold.
 * The email links to their dashboard and the push notification settings page.
 */
export async function sendVendorSlowResponseEmail(
  vendorProfileId: string,
  responseRatePct: number,
): Promise<SendEmailResult> {
  const contact = await fetchVendorContact(vendorProfileId);
  if (!contact) return { ok: false, reason: 'send_failed', error: 'vendor contact not found' };

  const dashboardUrl = `${APP_URL}/vendor-dashboard`;
  const notifUrl = `${APP_URL}/vendor-dashboard/settings/notifications`;

  const text = [
    `Hi ${contact.businessName},`,
    ``,
    `Your current response rate on Setnayan is ${responseRatePct}%.`,
    ``,
    `We recommend keeping your response rate above 70% to stay competitive.`,
    `Vendors who respond quickly to couple inquiries receive more bookings and`,
    `rank higher in Setnayan search results.`,
    ``,
    `Quick tips to improve your response rate:`,
    `  • Enable push notifications so you're alerted the moment a couple reaches out`,
    `  • Check your Setnayan inbox at least once a day`,
    `  • Even a brief "Thanks, I'll get back to you shortly" counts as a response`,
    ``,
    `Enable push notifications (takes 30 seconds):`,
    notifUrl,
    ``,
    `Open your dashboard:`,
    dashboardUrl,
    ``,
    `—`,
    `Set na 'yan.`,
    `Setnayan HQ`,
  ].join('\n');

  return sendEmail({
    to: contact.email,
    subject: 'Improve your response rate on Setnayan',
    text,
  });
}
