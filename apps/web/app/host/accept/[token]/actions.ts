'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPendingHostInvite } from '@/lib/event-moderators';
import { stampCoordinatorConsentRevoked } from '@/lib/coordinator-consent-revoke';

// Iteration 0048 — V1 multi-host accept-invite server action.
//
// The /host/accept/[token] page renders the invitation details and a form
// posting here. We verify:
//   1. The caller is signed in (page redirects them to sign in / up first).
//   2. The token still resolves to a pending invite (not expired, accepted,
//      or revoked).
//   3. The caller's email matches the invitation_email (loose check —
//      prevents a casual stolen-link from landing in someone else's plan;
//      not a strict security boundary because the token itself IS the
//      secret).
//
// On success: stamps user_id + accepted_at, clears invitation_token (so
// the link can't be re-used or shared), revalidates the event home, and
// redirects the new host into the dashboard.

export async function acceptHostInvite(formData: FormData) {
  const token = formData.get('token');
  if (typeof token !== 'string' || token.length < 32) {
    redirect('/');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/host/accept/${token}`)}`);
  }

  const admin = createAdminClient();
  const invite = await fetchPendingHostInvite(admin, token as string);
  if (!invite) {
    redirect(`/host/accept/${token}?error=not_found_or_terminal`);
  }

  // Terminal-state guards.
  if (invite.accepted_at) {
    redirect(`/host/accept/${token}?error=already_accepted`);
  }
  if (invite.removed_at) {
    redirect(`/host/accept/${token}?error=revoked`);
  }
  if (
    invite.invitation_expires_at &&
    new Date(invite.invitation_expires_at).getTime() < Date.now()
  ) {
    redirect(`/host/accept/${token}?error=expired`);
  }

  // Loose email match — defensive UX, not security. The token IS the secret;
  // we just steer accidental wrong-account-on-shared-device cases.
  const inviteeEmail = (invite.invitation_email ?? '').toLowerCase().trim();
  const userEmail = (user.email ?? '').toLowerCase().trim();
  if (inviteeEmail && userEmail && inviteeEmail !== userEmail) {
    redirect(
      `/host/accept/${token}?error=email_mismatch&expected=${encodeURIComponent(inviteeEmail)}`,
    );
  }

  // Stamp accept.
  const { error } = await admin
    .from('event_moderators')
    .update({
      user_id: user.id,
      accepted_at: new Date().toISOString(),
      invitation_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq('moderator_id', invite.moderator_id);

  if (error) {
    redirect(
      `/host/accept/${token}?error=accept_failed&msg=${encodeURIComponent(error.message.slice(0, 80))}`,
    );
  }

  // The coordinator event_members row is minted by the DATABASE now —
  // trigger `sync_delegate_membership` (migration 20271161203067), owner
  // ruling 2026-08-24 ("an accepted delegate is a member"). It used to be
  // upserted HERE, which is why the access-request approval door — a second
  // writer of accepted_at that never had this block — shipped a live planner
  // who read an EMPTY checklist on an event with 94 items. One write body,
  // two doors: the body lives on the table so every door present and future
  // (including a straight SQL seed, which is how that row actually arrived)
  // mints the same membership. tests/db/an-accepted-delegate-is-a-member
  // proves THIS door still mints via the UPDATE above.

  revalidatePath(`/dashboard/${invite.event_id}`);
  revalidatePath(`/dashboard/${invite.event_id}/hosts`);
  redirect(`/dashboard/${invite.event_id}?host_joined=1`);
}

/**
 * Decline an invitation. Marks the row removed_at + clears the token so
 * the link goes terminal. Soft "no thanks" — doesn't notify the inviter
 * automatically (V1.1 follow-up).
 */
export async function declineHostInvite(formData: FormData) {
  const token = formData.get('token');
  if (typeof token !== 'string' || token.length < 32) {
    redirect('/');
  }

  const admin = createAdminClient();
  const invite = await fetchPendingHostInvite(admin, token as string);
  if (!invite) {
    redirect(`/host/accept/${token}?error=not_found_or_terminal`);
  }

  await admin
    .from('event_moderators')
    .update({
      removed_at: new Date().toISOString(),
      removal_reason: 'invitation_declined_by_invitee',
      invitation_token: null,
    })
    .eq('moderator_id', invite.moderator_id);

  // Close the RA 10173 audit loop (corpus Coordinator_Whats_Next § 4): a
  // declined invite means the consented share never becomes access — stamp
  // the consent revoked. Best-effort no-op when no consent row exists.
  await stampCoordinatorConsentRevoked(admin, invite.event_id, invite.moderator_id);

  redirect(`/host/accept/${token}?declined=1`);
}
