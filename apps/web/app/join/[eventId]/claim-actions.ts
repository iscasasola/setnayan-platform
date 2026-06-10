'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendClaimOtpEmail } from '@/lib/guest-claim-flow';
import {
  generateOtpCode,
  hmacOtp,
  verifyOtp,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
} from '@/lib/guest-claim';

const J = (eventId: string, sub: string, token: string, extra = '') =>
  `/join/${eventId}/${sub}?token=${encodeURIComponent(token)}${extra}`;

/**
 * Submit the 6-digit code → finalize the claim on success.
 *
 * Every failure mode (no claim · expired · attempt budget spent · wrong code ·
 * pending-review claim) redirects to the SAME /verify?error=bad_code so the
 * response can't be used to distinguish "name is on the list" from "isn't" —
 * the only distinguishable terminal state is /success, which requires the code
 * that was emailed to the real guest. The attempt budget + expiry are enforced
 * ATOMICALLY inside register_guest_claim_otp_attempt (no read-modify-write race).
 */
export async function verifyClaimOtpAction(eventId: string, token: string, formData: FormData) {
  const code = String(formData.get('code') ?? '').replace(/\D/g, '').slice(0, 6);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect(`/login?next=${encodeURIComponent(`/join/${eventId}/verify?token=${token}`)}`);
  }

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from('guest_claims')
    .select('claim_id')
    .eq('event_id', eventId)
    .eq('claimer_user_id', user.id)
    .maybeSingle();

  if (!claim) {
    return redirect(J(eventId, 'verify', token, '&error=bad_code'));
  }

  // Atomic increment-and-check: returns the hmac+target only while a try is
  // allowed (status=otp_sent, not expired, under the cap). No row → reject.
  const { data: att } = await admin.rpc('register_guest_claim_otp_attempt', {
    p_claim_id: claim.claim_id,
  });
  const attempt = att as { ok?: boolean; hmac?: string | null; target_guest_id?: string | null } | null;

  if (!attempt?.ok || !attempt.target_guest_id || !verifyOtp(code, attempt.hmac ?? null)) {
    return redirect(J(eventId, 'verify', token, '&error=bad_code'));
  }

  // Correct code → atomically bind to the seed row (service-role RPC).
  const { data: result } = await admin.rpc('finalize_guest_claim', {
    p_claim_id: claim.claim_id,
    p_guest_id: attempt.target_guest_id,
    p_reviewer: null,
  });

  if (!(result as { linked?: boolean } | null)?.linked) {
    // Seed row got claimed by someone else in the meantime → couple review.
    await admin
      .from('guest_claims')
      .update({ status: 'pending_review', otp_code_hmac: null, updated_at: new Date().toISOString() })
      .eq('claim_id', claim.claim_id);
    return redirect(J(eventId, 'pending', token, '&reason=conflict'));
  }

  // Best-effort: seed a Gmail avatar as the display photo (display-only; never a
  // face enrollment). Only fills NULL / a prior oauth photo — never a selfie.
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;
  if (avatarUrl) {
    await admin
      .from('guests')
      .update({
        photo_url: avatarUrl,
        photo_source: 'oauth_google',
        photo_updated_at: new Date().toISOString(),
        photo_set_by_user_id: user.id,
      })
      .eq('guest_id', attempt.target_guest_id)
      .or('photo_url.is.null,photo_source.eq.oauth_google');
  }

  return redirect(J(eventId, 'success', token));
}

/** Re-send a fresh code (rate-limited). */
export async function resendClaimOtpAction(eventId: string, token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect(`/login?next=${encodeURIComponent(`/join/${eventId}/verify?token=${token}`)}`);
  }

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from('guest_claims')
    .select('claim_id, status, otp_sent_to, otp_last_sent_at')
    .eq('event_id', eventId)
    .eq('claimer_user_id', user.id)
    .maybeSingle();

  // No OTP in flight → bounce back generically (no matched/unmatched signal).
  if (!claim || claim.status !== 'otp_sent' || !claim.otp_sent_to) {
    return redirect(J(eventId, 'verify', token));
  }

  const lastSent = claim.otp_last_sent_at ? new Date(claim.otp_last_sent_at).getTime() : 0;
  if (Date.now() - lastSent < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
    return redirect(J(eventId, 'verify', token, '&notice=cooldown'));
  }

  const { data: event } = await admin
    .from('events')
    .select('display_name')
    .eq('event_id', eventId)
    .maybeSingle();

  const code = generateOtpCode();
  const nowIso = new Date().toISOString();
  await admin
    .from('guest_claims')
    .update({
      otp_code_hmac: hmacOtp(code),
      otp_expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
      otp_attempts: 0,
      otp_last_sent_at: nowIso,
      updated_at: nowIso,
    })
    .eq('claim_id', claim.claim_id);

  const result = await sendClaimOtpEmail(claim.otp_sent_to, code, event?.display_name ?? 'a wedding');
  return redirect(J(eventId, 'verify', token, result.ok ? '&notice=resent' : '&notice=send_failed'));
}

/** "I can't access that email" → drop to the couple's review queue. */
export async function requestCoupleReviewAction(eventId: string, token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect(`/login?next=${encodeURIComponent(`/join/${eventId}/verify?token=${token}`)}`);
  }

  const admin = createAdminClient();
  await admin
    .from('guest_claims')
    .update({ status: 'pending_review', otp_code_hmac: null, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('claimer_user_id', user.id)
    .eq('status', 'otp_sent');

  return redirect(J(eventId, 'pending', token, '&reason=requested'));
}
