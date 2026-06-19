'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ROLE_SUBTYPES,
  PERMISSION_TEMPLATES,
  COORDINATOR_AREAS,
  generateInvitationToken,
  isRoleSubtype,
  type ModeratorPermissions,
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

    // Feature-access program Phase 2: a coordinator invite carries the
    // per-area grants template (planning areas Edit · mood board View ·
    // budget OFF per locked D1) instead of the coarse edit_all fallback.
    // Applies to the "Promote your coordinator" path and to any planner
    // invite from the generic form.
    const isCoordinatorDelegate =
      formData.get('delegate_kind') === 'coordinator' ||
      role === 'wedding_planner_external';
    const permissions: ModeratorPermissions = isCoordinatorDelegate
      ? { ...PERMISSION_TEMPLATES[role], areas: { ...COORDINATOR_AREAS } }
      : PERMISSION_TEMPLATES[role];

    const { error } = await admin.from('event_moderators').insert({
      event_id: eventId,
      user_id: null,
      role_subtype: role,
      display_label: displayLabel,
      permissions_json: permissions,
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
    // redirect() works by throwing a NEXT_REDIRECT error. The success and
    // insert-error redirects above live inside this try, so without this
    // guard the catch swallows them and re-redirects to invite_error=
    // NEXT_REDIRECT — the couple sees "Could not send invitation:
    // NEXT_REDIRECT" on every invite, even when it succeeded. Re-throw the
    // control-flow error so Next handles it; only genuine failures
    // (Forbidden, bad email/role, DB errors) fall through to invite_error.
    if (isRedirectError(e)) throw e;
    redirect(
      `/dashboard/${eventId}/hosts?invite_error=${encodeURIComponent((e as Error).message.slice(0, 80))}`,
    );
  }
}

/**
 * Couple-only gate for grant changes + host removal. Stricter than
 * requireHostMembership: per locked D1 only the COUPLE raises/lowers a
 * delegate's budget visibility, and only the couple removes an accepted
 * host (a planner shouldn't be able to remove the bride).
 */
async function requireCoupleMembership(eventId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!data) {
    throw new Error('Forbidden — only the couple can change host access.');
  }
  return user.id;
}

/**
 * Toggle a delegate's budget visibility between OFF and View (locked D1:
 * OFF by default, couple-raiseable to View, Edit never in V1). Writes
 * permissions_json.areas.budget; everything else in the JSON is preserved.
 */
export async function setDelegateBudget(formData: FormData) {
  const rawEventId = formData.get('event_id');
  const rawModeratorId = formData.get('moderator_id');
  const grant = formData.get('budget_grant'); // 'view' | 'off'
  if (typeof rawEventId !== 'string' || typeof rawModeratorId !== 'string') {
    redirect('/dashboard');
  }
  const eventId = rawEventId as string;
  const moderatorId = rawModeratorId as string;

  await requireCoupleMembership(eventId);

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('event_moderators')
    .select('permissions_json')
    .eq('moderator_id', moderatorId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (row) {
    const perms = ((row as { permissions_json: ModeratorPermissions | null })
      .permissions_json ?? {
      edit_all: false,
      checkout: false,
      invite_hosts: false,
      remove_hosts: false,
    }) as ModeratorPermissions;
    const areas = { ...(perms.areas ?? {}) };
    areas.budget = grant === 'view' ? 'view' : null;
    await admin
      .from('event_moderators')
      .update({
        permissions_json: { ...perms, areas },
        updated_at: new Date().toISOString(),
      })
      .eq('moderator_id', moderatorId)
      .eq('event_id', eventId);
  }

  revalidatePath(`/dashboard/${eventId}/hosts`);
  redirect(`/dashboard/${eventId}/hosts?grant_updated=1`);
}

/**
 * Remove an ACCEPTED host (locked doc § 3: "revocation is one toggle,
 * effective immediately"). Soft-removes the moderator row (audit trail
 * preserved) and drops their event_members coordinator row so the event
 * leaves their picker. Couple-only.
 */
export async function removeHost(formData: FormData) {
  const rawEventId = formData.get('event_id');
  const rawModeratorId = formData.get('moderator_id');
  if (typeof rawEventId !== 'string' || typeof rawModeratorId !== 'string') {
    redirect('/dashboard');
  }
  const eventId = rawEventId as string;
  const moderatorId = rawModeratorId as string;

  const callerId = await requireCoupleMembership(eventId);

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('event_moderators')
    .select('user_id')
    .eq('moderator_id', moderatorId)
    .eq('event_id', eventId)
    .maybeSingle();
  const removedUserId = (row as { user_id: string | null } | null)?.user_id ?? null;

  // Self-removal guard — the couple manages their own rows elsewhere.
  if (removedUserId && removedUserId === callerId) {
    redirect(`/dashboard/${eventId}/hosts?invite_error=${encodeURIComponent('You cannot remove yourself.')}`);
  }

  await admin
    .from('event_moderators')
    .update({
      removed_at: new Date().toISOString(),
      removal_reason: 'removed_by_couple',
      invitation_token: null,
    })
    .eq('moderator_id', moderatorId)
    .eq('event_id', eventId);

  // Drop the coordinator membership (never a couple row — guarded above by
  // member_type check at insert time; we only delete coordinator rows).
  if (removedUserId) {
    await admin
      .from('event_members')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', removedUserId)
      .eq('member_type', 'coordinator');
  }

  revalidatePath(`/dashboard/${eventId}/hosts`);
  redirect(`/dashboard/${eventId}/hosts?host_removed=1`);
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
