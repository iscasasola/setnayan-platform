'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ROLE_SUBTYPES,
  PERMISSION_TEMPLATES,
  generateInvitationToken,
  isRoleSubtype,
  type RoleSubtype,
} from '@/lib/event-moderators';

// Iteration 0048 — V1 multi-host invite server actions.
//
// Shipped 2026-05-20 alongside the V1 promotion. The hosts page on
// /dashboard/[eventId]/hosts surfaces the invite form + the list of
// pending/accepted hosts. These actions are the form posts.
//
// Inviter check: caller must be a current host on the event. We accept
// rows from EITHER event_moderators (the V1.2 source of truth, backfilled
// by PR #135) OR event_members.member_type='couple' (V1 backwards-compat
// for events created before the 0048 invite UI existed).

const INVITE_TTL_DAYS = 7;
const MS_PER_DAY = 86_400_000;

async function requireHostMembership(eventId: string): Promise<{
  userId: string;
  email: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Source 1 — event_moderators (canonical going forward).
  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();

  if (moderator) {
    return { userId: user.id, email: user.email ?? '' };
  }

  // Source 2 — event_members couple row (V1 backwards-compat).
  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (legacy && (legacy as { member_type: string }).member_type === 'couple') {
    return { userId: user.id, email: user.email ?? '' };
  }

  throw new Error('Forbidden — only current hosts can invite new hosts.');
}

function nullIfBlank(raw: FormDataEntryValue | null, max = 80): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

function parseEmail(raw: FormDataEntryValue | null): string {
  if (typeof raw !== 'string') throw new Error('Email is required.');
  const t = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
    throw new Error('Enter a valid email address.');
  }
  return t.slice(0, 200);
}

function parseRole(raw: FormDataEntryValue | null): RoleSubtype {
  if (!isRoleSubtype(raw)) throw new Error('Pick a host role.');
  return raw;
}

/**
 * Create a pending host invitation. Returns by redirect with an URL
 * search param the page picks up to surface the share URL inline (V1
 * doesn't send the email automatically — the inviter copies the URL
 * and sends it via whatever channel they prefer; Resend integration
 * is a V1.1 follow-up).
 */
export async function inviteHost(formData: FormData) {
  const rawEventId = formData.get('event_id');
  if (typeof rawEventId !== 'string' || rawEventId.length === 0) {
    redirect('/dashboard');
  }
  const eventId = rawEventId as string;

  let email: string;
  let role: RoleSubtype;
  let displayLabel: string | null;
  try {
    const { userId } = await requireHostMembership(eventId);
    email = parseEmail(formData.get('invitation_email'));
    role = parseRole(formData.get('role_subtype'));
    displayLabel = nullIfBlank(formData.get('display_label'), 80);

    const admin = createAdminClient();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * MS_PER_DAY);
    const token = generateInvitationToken();

    const { error } = await admin.from('event_moderators').insert({
      event_id: eventId,
      user_id: null,
      role_subtype: role,
      display_label: displayLabel,
      permissions_json: PERMISSION_TEMPLATES[role],
      invited_by_user_id: userId,
      invitation_email: email,
      invitation_phone: null,
      invitation_sent_at: now.toISOString(),
      invitation_expires_at: expiresAt.toISOString(),
      invitation_token: token,
      accepted_at: null,
    });

    if (error) {
      redirect(
        `/dashboard/${eventId}/hosts?invite_error=${encodeURIComponent(error.message.slice(0, 80))}`,
      );
    }

    revalidatePath(`/dashboard/${eventId}/hosts`);
    redirect(
      `/dashboard/${eventId}/hosts?invite_sent=1&token=${encodeURIComponent(token)}`,
    );
  } catch (e) {
    redirect(
      `/dashboard/${eventId}/hosts?invite_error=${encodeURIComponent((e as Error).message.slice(0, 80))}`,
    );
  }
}

/**
 * Revoke a pending invite (set removed_at) so the token stops resolving
 * to a usable accept page. Idempotent — re-running on an already-revoked
 * row is a no-op.
 */
export async function revokeHostInvite(formData: FormData) {
  const rawEventId = formData.get('event_id');
  const rawModeratorId = formData.get('moderator_id');
  if (typeof rawEventId !== 'string' || typeof rawModeratorId !== 'string') {
    redirect('/dashboard');
  }
  const eventId = rawEventId as string;
  const moderatorId = rawModeratorId as string;

  await requireHostMembership(eventId);

  const admin = createAdminClient();
  await admin
    .from('event_moderators')
    .update({
      removed_at: new Date().toISOString(),
      removal_reason: 'invitation_revoked_by_inviter',
      invitation_token: null,
    })
    .eq('moderator_id', moderatorId)
    .eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}/hosts`);
  redirect(`/dashboard/${eventId}/hosts?invite_revoked=1`);
}
