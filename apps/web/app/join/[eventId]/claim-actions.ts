'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendClaimOtpEmail } from '@/lib/guest-claim-flow';
import {
  generateOtpCode,
  hmacOtp,
  verifyOtp,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
} from '@/lib/guest-claim';

const J = (eventId: string, sub: string, token: string, extra = '') =>
  `/join/${eventId}/${sub}?token=${encodeURIComponent(token)}${extra}`;

/** Submit the 6-digit code → finalize the claim on success. */
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
    .select('claim_id, target_guest_id, status, otp_code_hmac, otp_expires_at, otp_attempts')
    .eq('event_id', eventId)
    .eq('claimer_user_id', user.id)
    .maybeSingle();

  if (!claim || claim.status !== 'otp_sent' || !claim.target_guest_id) {
    return redirect(J(eventId, 'pending', token));
  }

  const expired = claim.otp_expires_at && new Date(claim.otp_expires_at) < new Date();
  if (expired || claim.otp_attempts >= OTP_MAX_ATTEMPTS) {
    await admin
      .from('guest_claims')
      .update({ status: 'pending_review', otp_code_hmac: null, updated_at: new Date().toISOString() })
      .eq('claim_id', claim.claim_id);
    return redirect(J(eventId, 'pending', token, '&reason=otp_expired'));
  }

  // Count the attempt before checking, so brute force burns the 5-try budget.
  await admin
    .from('guest_claims')
    .update({ otp_attempts: claim.otp_attempts + 1, updated_at: new Date().toISOString() })
    .eq('claim_id', claim.claim_id);

  if (!verifyOtp(code, claim.otp_code_hmac)) {
    return redirect(J(eventId, 'verify', token, '&error=bad_code'));
  }

  // Correct code → atomically bind to the seed row (service-role RPC).
  const { data: result } = await admin.rpc('finalize_guest_claim', {
    p_claim_id: claim.claim_id,
    p_guest_id: claim.target_guest_id,
    p_reviewer: null,
  });

  const linked = (result as { linked?: boolean } | null)?.linked;
  if (!linked) {
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
      .eq('guest_id', claim.target_guest_id)
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

  if (!claim || claim.status !== 'otp_sent' || !claim.otp_sent_to) {
    return redirect(J(eventId, 'pending', token));
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

  await sendClaimOtpEmail(claim.otp_sent_to, code, event?.display_name ?? 'a wedding');
  return redirect(J(eventId, 'verify', token, '&notice=resent'));
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
