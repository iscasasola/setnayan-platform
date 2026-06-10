import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, isEmailConfigured, type SendEmailResult } from '@/lib/email';
import { emitNotification } from '@/lib/notification-emit';
import {
  classifyClaimMatch,
  generateOtpCode,
  hmacOtp,
  OTP_TTL_MINUTES,
  CLAIM_COOLDOWN_SECONDS,
  CLAIM_MAX_ATTEMPTS,
  type SeedCandidate,
} from './guest-claim';
import type { GuestRole } from './guests';

/**
 * Server-only orchestration for the guest invite-claim flow. Pure matching +
 * OTP crypto live in ./guest-claim; this module is the DB + email side. Kept
 * OUT of the 'use server' action files so it can't be invoked as a client
 * action — the route actions call it after validating token + auth.
 */

export type ClaimOutcome =
  | { step: 'otp' } // confident single match w/ a seed email → code emailed
  | { step: 'pending' }; // ambiguous / unmatched / no seed email / throttled → couple review

function seedName(row: {
  first_name: string;
  last_name: string;
  display_name: string | null;
}): string {
  return (row.display_name?.trim() || `${row.first_name} ${row.last_name}`).trim();
}

/** Tell the couple a request is waiting (debounced: only on first entry to review). */
async function notifyCoupleOfPendingClaim(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  claimerName: string,
  role: GuestRole,
): Promise<void> {
  const { data: couples } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('member_type', 'couple');
  await Promise.all(
    (couples ?? []).map((c) =>
      emitNotification({
        userId: c.user_id as string,
        type: 'guest_claim_pending',
        title: 'Someone is asking to join your guest list',
        body: `${claimerName} requested the ${role.replace(/_/g, ' ')} role — review to confirm or decline.`,
        relatedUrl: `/dashboard/${eventId}/guests/claims`,
      }),
    ),
  );
}

/**
 * Match the claimer against the couple's unclaimed seed rows, persist a
 * guest_claims row, and (when there's a confident match with a recorded email)
 * email a one-time code. Returns the next step.
 *
 * NEVER auto-admits: the only paths to membership are a correct OTP (this flow)
 * or an explicit couple approval (review surface). Throttled per (user,event)
 * to blunt name-enumeration, email-bombing, and the O(n·m) match DoS — when
 * throttled it short-circuits to review WITHOUT scanning the seed list or
 * sending email, and (because the caller renders an identical screen for both
 * outcomes) leaks no matched/unmatched signal.
 */
export async function processGuestClaim(params: {
  eventId: string;
  userId: string;
  loginEmail: string | null;
  claimerName: string;
  role: GuestRole;
}): Promise<ClaimOutcome> {
  const { eventId, userId, loginEmail, claimerName, role } = params;
  const admin = createAdminClient();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // 0. Throttle gate — read the caller's existing claim first.
  const { data: existing } = await admin
    .from('guest_claims')
    .select('status, claim_attempts, last_claim_at')
    .eq('event_id', eventId)
    .eq('claimer_user_id', userId)
    .maybeSingle();

  const priorAttempts = existing?.claim_attempts ?? 0;
  const lastClaimMs = existing?.last_claim_at ? new Date(existing.last_claim_at).getTime() : 0;
  const throttled =
    priorAttempts >= CLAIM_MAX_ATTEMPTS ||
    nowMs - lastClaimMs < CLAIM_COOLDOWN_SECONDS * 1000;

  if (throttled) {
    // Record the attempt (so cap still advances) but do NOT scan or email.
    await admin
      .from('guest_claims')
      .update({ claim_attempts: priorAttempts + 1, last_claim_at: nowIso, updated_at: nowIso })
      .eq('event_id', eventId)
      .eq('claimer_user_id', userId);
    return { step: 'pending' };
  }

  // 1. Load active seed rows + already-linked guest_ids, compute unclaimed set.
  const [{ data: seeds }, { data: members }] = await Promise.all([
    admin
      .from('guests')
      .select('guest_id, first_name, last_name, display_name, email')
      .eq('event_id', eventId)
      .is('deleted_at', null),
    admin
      .from('event_members')
      .select('guest_id')
      .eq('event_id', eventId)
      .not('guest_id', 'is', null),
  ]);

  const claimed = new Set((members ?? []).map((m) => m.guest_id as string));
  const candidates: SeedCandidate[] = (seeds ?? [])
    .filter((s) => !claimed.has(s.guest_id))
    .map((s) => ({ guestId: s.guest_id, name: seedName(s), email: s.email }));

  const match = classifyClaimMatch(claimerName, candidates);

  // 2. Decide the claim shape.
  let targetGuestId: string | null = null;
  let matchScore: number | null = null;
  let status: 'pending_review' | 'otp_sent' = 'pending_review';
  let otpCode: string | null = null;
  let otpHmac: string | null = null;
  let otpSentTo: string | null = null;
  let otpExpiresAt: string | null = null;

  if (match.kind === 'confident') {
    targetGuestId = match.candidate.guestId;
    matchScore = Number(match.score.toFixed(3));
    // Only run the email-OTP handshake when we can actually deliver the code.
    if (match.candidate.email && isEmailConfigured()) {
      otpCode = generateOtpCode();
      otpHmac = hmacOtp(otpCode);
      otpSentTo = match.candidate.email;
      otpExpiresAt = new Date(nowMs + OTP_TTL_MINUTES * 60_000).toISOString();
      status = 'otp_sent';
    }
  }

  // 3. Upsert the claim ledger (one open claim per user per event).
  await admin.from('guest_claims').upsert(
    {
      event_id: eventId,
      claimer_user_id: userId,
      claimer_name: claimerName,
      claimer_email: loginEmail,
      requested_role: role,
      target_guest_id: targetGuestId,
      match_score: matchScore,
      status,
      otp_code_hmac: otpHmac,
      otp_sent_to: otpSentTo,
      otp_expires_at: otpExpiresAt,
      otp_attempts: 0,
      otp_last_sent_at: status === 'otp_sent' ? nowIso : null,
      claim_attempts: priorAttempts + 1,
      last_claim_at: nowIso,
      reviewed_by_user_id: null,
      reviewed_at: null,
      resolved_guest_id: null,
      updated_at: nowIso,
    },
    { onConflict: 'event_id,claimer_user_id' },
  );

  // 4. Email the code on the OTP path; if delivery fails, fall back to review
  //    rather than stranding the guest on a "we emailed you" screen.
  if (status === 'otp_sent' && otpCode && otpSentTo) {
    const { data: event } = await admin
      .from('events')
      .select('display_name')
      .eq('event_id', eventId)
      .maybeSingle();
    const result = await sendClaimOtpEmail(otpSentTo, otpCode, event?.display_name ?? 'a wedding');
    if (result.ok) {
      return { step: 'otp' };
    }
    // Delivery failed → downgrade to couple review.
    await admin
      .from('guest_claims')
      .update({
        status: 'pending_review',
        otp_code_hmac: null,
        otp_sent_to: null,
        otp_expires_at: null,
        otp_last_sent_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)
      .eq('claimer_user_id', userId);
  }

  // 5. Landing in review — notify the couple, but only on the FIRST transition
  //    into pending_review (the placeholder-guest signal the old auto-admit gave
  //    them is gone; this replaces it without per-resubmit spam).
  if (existing?.status !== 'pending_review') {
    await notifyCoupleOfPendingClaim(admin, eventId, claimerName, role);
  }

  return { step: 'pending' };
}

export async function sendClaimOtpEmail(
  to: string,
  code: string,
  eventName: string,
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: `Your Setnayan verification code: ${code}`,
    text: [
      `Someone is confirming they're you on the guest list for ${eventName}.`,
      ``,
      `Your verification code is: ${code}`,
      ``,
      `Enter it on the page you just opened. It expires in ${OTP_TTL_MINUTES} minutes.`,
      ``,
      `If this wasn't you, you can safely ignore this email — no one is added to`,
      `the guest list without this code.`,
      ``,
      `—`,
      `Set na 'yan.`,
    ].join('\n'),
  });
}
