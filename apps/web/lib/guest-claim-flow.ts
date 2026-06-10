import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import {
  classifyClaimMatch,
  generateOtpCode,
  hmacOtp,
  OTP_TTL_MINUTES,
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
  | { step: 'pending' }; // ambiguous / unmatched / no seed email → couple review

function seedName(row: {
  first_name: string;
  last_name: string;
  display_name: string | null;
}): string {
  return (row.display_name?.trim() || `${row.first_name} ${row.last_name}`).trim();
}

/**
 * Match the claimer against the couple's unclaimed seed rows, persist a
 * guest_claims row, and (when there's a confident match with a recorded email)
 * email a one-time code. Returns the next step for the caller to redirect to.
 *
 * NEVER auto-admits: the only paths to membership are a correct OTP (this flow)
 * or an explicit couple approval (review surface).
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
    // If Resend isn't configured, fall through to couple review so the guest is
    // never stranded waiting on an email that will never arrive.
    if (match.candidate.email && isEmailConfigured()) {
      otpCode = generateOtpCode();
      otpHmac = hmacOtp(otpCode);
      otpSentTo = match.candidate.email;
      otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
      status = 'otp_sent';
    }
  }

  // 3. Upsert the claim ledger (one open claim per user per event).
  const nowIso = new Date().toISOString();
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
      reviewed_by_user_id: null,
      reviewed_at: null,
      resolved_guest_id: null,
      updated_at: nowIso,
    },
    { onConflict: 'event_id,claimer_user_id' },
  );

  // 4. Email the code on the OTP path.
  if (status === 'otp_sent' && otpCode && otpSentTo) {
    const { data: event } = await admin
      .from('events')
      .select('display_name')
      .eq('event_id', eventId)
      .maybeSingle();
    await sendClaimOtpEmail(otpSentTo, otpCode, event?.display_name ?? 'a wedding');
    return { step: 'otp' };
  }

  return { step: 'pending' };
}

export async function sendClaimOtpEmail(
  to: string,
  code: string,
  eventName: string,
): Promise<void> {
  await sendEmail({
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
