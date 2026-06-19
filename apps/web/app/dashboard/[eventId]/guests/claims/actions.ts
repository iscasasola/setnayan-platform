'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { emitNotification } from '@/lib/notification-emit';

/** Throw unless the caller is a couple member of this event. */
async function assertCouple(eventId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('unauthenticated');
  const supabase = await createClient();
  const { data } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!data) throw new Error('forbidden');
  return user;
}

/**
 * Approve a claim. `mode=matched` binds to the fuzzy-matched seed row;
 * `mode=new` (or no match) mints a fresh seed row from the claimer's name.
 * Either way it's the couple's deliberate decision — the privacy gate.
 */
export async function approveClaimAction(eventId: string, formData: FormData) {
  const reviewer = await assertCouple(eventId);
  const claimId = String(formData.get('claim_id') ?? '');
  const mode = String(formData.get('mode') ?? 'matched');
  if (!claimId) return;

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from('guest_claims')
    .select('claim_id, event_id, target_guest_id, claimer_name, claimer_email, requested_role, status')
    .eq('claim_id', claimId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (!claim || claim.status === 'confirmed' || claim.status === 'rejected') {
    revalidatePath(`/dashboard/${eventId}/guests/claims`);
    return;
  }

  let guestId: string | null = claim.target_guest_id;

  if (mode === 'new' || !guestId) {
    const parts = claim.claimer_name.trim().split(/\s+/);
    const first = parts[0] || 'Guest';
    const last = parts.slice(1).join(' ') || '—';
    const { data: newGuest } = await admin
      .from('guests')
      .insert({
        event_id: eventId,
        first_name: first,
        last_name: last,
        side: 'both',
        group_category: 'friends',
        role: claim.requested_role,
        email: claim.claimer_email,
        rsvp_status: 'pending',
        photo_consent: true,
      })
      .select('guest_id')
      .single();
    guestId = newGuest?.guest_id ?? null;
  }

  if (!guestId) {
    revalidatePath(`/dashboard/${eventId}/guests/claims`);
    return;
  }

  const { data: result } = await admin.rpc('finalize_guest_claim', {
    p_claim_id: claim.claim_id,
    p_guest_id: guestId,
    p_reviewer: reviewer.id,
  });

  if (claim.claimer_email && (result as { linked?: boolean } | null)?.linked) {
    await sendEmail({
      to: claim.claimer_email,
      subject: "You're on the guest list 🎉",
      text: [
        `Good news — the couple confirmed you on their Setnayan guest list.`,
        ``,
        `Open your invite link again to see your details, schedule, and seat.`,
        ``,
        `—`,
        `Set na 'yan.`,
      ].join('\n'),
    });
  }

  revalidatePath(`/dashboard/${eventId}/guests/claims`);
  revalidatePath(`/dashboard/${eventId}/guests`);
}

/** Decline a pending claim. */
export async function rejectClaimAction(eventId: string, formData: FormData) {
  const reviewer = await assertCouple(eventId);
  const claimId = String(formData.get('claim_id') ?? '');
  if (!claimId) return;

  const admin = createAdminClient();

  // Read the claimer BEFORE flipping status so we know who to tell. The
  // approval path already notifies (email-on-link); rejection previously
  // flipped status silently, leaving the claimer waiting in /join/[eventId]/
  // pending forever. claimer_user_id is NOT NULL (the claimer is always an
  // authenticated Setnayan user), so an in-app notification reaches them.
  const { data: claim } = await admin
    .from('guest_claims')
    .select('claimer_user_id, status')
    .eq('claim_id', claimId)
    .eq('event_id', eventId)
    .maybeSingle();

  const { error: updateError } = await admin
    .from('guest_claims')
    .update({
      status: 'rejected',
      reviewed_by_user_id: reviewer.id,
      reviewed_at: new Date().toISOString(),
      otp_code_hmac: null,
      updated_at: new Date().toISOString(),
    })
    .eq('claim_id', claimId)
    .eq('event_id', eventId)
    .neq('status', 'confirmed');

  // Best-effort: tell the claimer their request was declined. A soft negative
  // (no name leak, no event details) — matches the inquiry_declined register.
  // Skip if the flip didn't apply (already confirmed) or the claim vanished.
  if (
    !updateError &&
    claim?.claimer_user_id &&
    claim.status !== 'confirmed' &&
    claim.status !== 'rejected'
  ) {
    await emitNotification({
      userId: claim.claimer_user_id as string,
      type: 'guest_claim_rejected',
      title: 'Your request to join the guest list was declined',
      body: "The couple reviewed your request and didn't add you to their guest list this time. If you think this was a mistake, reach out to them directly.",
      relatedUrl: `/join/${eventId}`,
    });
  }

  revalidatePath(`/dashboard/${eventId}/guests/claims`);
}
