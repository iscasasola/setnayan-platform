'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withArea } from '@/lib/delegate-areas';
import {
  ROLE_SUBTYPES,
  PERMISSION_TEMPLATES,
  COORDINATOR_AREAS,
  generateInvitationToken,
  isRoleSubtype,
  type ModeratorPermissions,
  type RoleSubtype,
} from '@/lib/event-moderators';
import { isCoordinatorConsentGateEnabled } from '@/lib/coordinator-consent-gate';
import { stampCoordinatorConsentRevoked } from '@/lib/coordinator-consent-revoke';
import { seatIsFullCohost } from '@/lib/guest-access';
import { seatReturnPath, seatReturnScreen } from '@/lib/seat-return-path';

/**
 * 🔑 A GRANT IS A COORDINATOR'S, NEVER A CO-HOST'S. A full co-host seat is a
 * `couple` member (20271251336140) with the same access as the creator —
 * nothing reads its permissions_json — so writing a budget or photo grant on
 * one would change nothing and say something ("Hide budget" on the Groom).
 * The page no longer offers it; this refuses it at the door too.
 */
const COHOST_NEEDS_NO_GRANT = 'A co-host already has the same access as you.';

// Iteration 0048 — V1 multi-host invite server actions.
//
// Shipped 2026-05-20 alongside the V1 promotion. Since the Hosts fold
// (2026-09-30) the forms that post here live on the hired planner's supplier
// workspace (`promote-coordinator-card.tsx`) — `/hosts` itself is redirect-only.
// These actions stay HERE (moved callers, never a duplicated action: the
// server-action budget is at its ceiling).
//
// Inviter check: caller must be a host — `requireCoupleMembership` below.
// Every accepted host is a `couple` member (20271251336140); a hired
// planner (`coordinator`) is not, and cannot add hosts.

/** Every screen a seat action can change, refreshed together. */
function revalidateSeatScreens(eventId: string, formData: FormData) {
  revalidatePath(`/dashboard/${eventId}/guests`);
  revalidatePath(`/dashboard/${eventId}`);
  revalidatePath(seatReturnScreen(formData, eventId));
}

const INVITE_TTL_DAYS = 7;
const MS_PER_DAY = 86_400_000;

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
 * Invite the HIRED PLANNER by email (the "Promote your coordinator" doors).
 * Co-hosts are NOT invited here — they are chosen from the guest list
 * (owner 2026-09-28). Returns by redirect with the share URL: the planner
 * accepts from their link after the RA 10173 consent step.
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
    // 🔑 ONLY A CO-HOST INVITES (owner 2026-09-28: "being a host gives the
    // same power to add new hosts as well"). A co-host is `couple`; the old
    // gate also admitted any accepted seat — a planner or a limited helper —
    // which could then hand out access they do not hold.
    const userId = await requireCoupleMembership(eventId);
    email = parseEmail(formData.get('invitation_email'));
    role = parseRole(formData.get('role_subtype'));
    displayLabel = nullIfBlank(formData.get('display_label'), 80);
    // 🔑 THIS DOOR IS THE HIRED PLANNER'S ONLY (owner 2026-09-28: "accepted
    // guests can be assigned as host" — co-hosts come FROM THE GUEST LIST,
    // `setGuestAccess` in guests/[guestId]/access-actions.ts). A planner is a
    // supplier, "not host supplier": they still come in by email, through the
    // RA 10173 consent step, and accept from their link.
    if (role !== 'wedding_planner_external') {
      throw new Error('Co-hosts are chosen from your guest list.');
    }

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

    // RA 10173 consent gate (corpus spec § 3a) — a coordinator invite shares
    // guest PII, so require the couple's data-privacy consent when the flag is
    // ON. Flag OFF = unchanged behavior. Server-side defense-in-depth behind
    // the client consent modal, and it covers BOTH invite entry points.
    if (
      (await isCoordinatorConsentGateEnabled()) &&
      isCoordinatorDelegate &&
      formData.get('coordinator_consent') !== '1'
    ) {
      redirect(
        seatReturnPath(formData, eventId, {
          invite_error: 'Data-privacy consent is required to invite a coordinator.',
        }),
      );
    }

    const { data: inserted, error } = await admin.from('event_moderators').insert({
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
    }).select('moderator_id').single();

    if (error) {
      redirect(seatReturnPath(formData, eventId, { invite_error: error.message.slice(0, 80) }));
    }

    // Record the RA 10173 consent (corpus spec § 3a) now that the invite row
    // exists. Best-effort: consent was already required above, so this audit
    // copy failing must never undo a successful invite.
    if ((await isCoordinatorConsentGateEnabled()) && isCoordinatorDelegate && inserted) {
      // Owner 2026-07-19 #5 — consent-SCOPED money authority. The consent
      // modal's two default-OFF toggles arrive as '1' when granted; anything
      // else records the scope as NOT granted (fail-closed). scope_version
      // 'v2' = the disclosure that includes the optional money-authority
      // section (vendor_lock · checkout); 'v1' rows predate it and carry no
      // money scopes.
      const scopes = {
        vendor_lock: formData.get('consent_scope_vendor_lock') === '1',
        checkout: formData.get('consent_scope_checkout') === '1',
      };
      const { error: consentError } = await admin
        .from('coordinator_access_consents')
        .insert({
          event_id: eventId,
          moderator_id: inserted.moderator_id,
          consented_by_user_id: userId,
          coordinator_email: email,
          coordinator_label: displayLabel,
          scope_version: 'v2',
          scopes,
        });
      if (consentError) {
        console.error('[inviteHost] consent record insert failed', consentError);
      }
    }

    revalidateSeatScreens(eventId, formData);
    redirect(seatReturnPath(formData, eventId, { invite_sent: '1', token, planner: '1' }));
  } catch (e) {
    // redirect() works by throwing a NEXT_REDIRECT error. The success and
    // insert-error redirects above live inside this try, so without this
    // guard the catch swallows them and re-redirects to invite_error=
    // NEXT_REDIRECT — the couple sees "Could not send invitation:
    // NEXT_REDIRECT" on every invite, even when it succeeded. Re-throw the
    // control-flow error so Next handles it; only genuine failures
    // (Forbidden, bad email/role, DB errors) fall through to invite_error.
    if (isRedirectError(e)) throw e;
    redirect(seatReturnPath(formData, eventId, { invite_error: (e as Error).message.slice(0, 80) }));
  }
}

/**
 * The HOST gate — adding, revoking and removing hosts, and grant changes.
 * A host's membership is `couple` whatever their role (owner 2026-09-28,
 * migration 20271251336140), so this admits every host and never a hired
 * planner (`coordinator`): per locked D1 only a host raises/lowers a
 * delegate's budget visibility, and a planner shouldn't be able to remove
 * the bride — or add hosts above themselves.
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
    throw new Error('Forbidden — only a host can change who hosts this event.');
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
    .select('permissions_json, role_subtype')
    .eq('moderator_id', moderatorId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (row && seatIsFullCohost((row as { role_subtype: string }).role_subtype)) {
    redirect(seatReturnPath(formData, eventId, { invite_error: COHOST_NEEDS_NO_GRANT }));
  }
  if (row) {
    const perms = ((row as { permissions_json: ModeratorPermissions | null })
      .permissions_json ?? {
      edit_all: false,
      checkout: false,
      invite_hosts: false,
      remove_hosts: false,
    }) as ModeratorPermissions;
    // ⚠ NOT `{ ...(perms.areas ?? {}) }` — that spread is what turned this
    // button into a withdrawal. A host row minted by the invite door carries no
    // `areas` map at all, so setting one key wrote a map naming ONE area, and
    // since 2026-08-25 an area a map does not name resolves to nothing. See
    // `materializeAreas`.
    const permissions = withArea(perms, 'budget', grant === 'view' ? 'view' : null);
    await admin
      .from('event_moderators')
      .update({
        permissions_json: permissions,
        updated_at: new Date().toISOString(),
      })
      .eq('moderator_id', moderatorId)
      .eq('event_id', eventId);
  }

  revalidateSeatScreens(eventId, formData);
  redirect(seatReturnPath(formData, eventId, { grant_updated: '1' }));
}

/**
 * Grant or withdraw a delegate's access to the couple's guest photos.
 *
 * Owner ruling 2026-08-06: a coordinator may see them **"but only upon
 * approval"**. This IS the approval — the couple presses it, per delegate.
 *
 * 🔑 THE CONTROL EXISTS BECAUSE THE PERMISSION DOES. The `photos` area, its
 * database policies and its fail-closed default all shipped together; without
 * this the couple would hold a right they could never exercise, which is the
 * shape this codebase keeps re-discovering — a column with readers and no
 * writer, a gate with no handle.
 *
 * Mirrors `setDelegateBudget` exactly, including the couple-only check: a
 * coordinator must never be able to widen their own access.
 *
 * VIEW only, never EDIT. Photos are the guests' likenesses; letting a delegate
 * DELETE them is a different decision that was not made.
 */
export async function setDelegatePhotos(formData: FormData) {
  const rawEventId = formData.get('event_id');
  const rawModeratorId = formData.get('moderator_id');
  const grant = formData.get('photos_grant'); // 'view' | 'off'
  if (typeof rawEventId !== 'string' || typeof rawModeratorId !== 'string') {
    redirect('/dashboard');
  }
  const eventId = rawEventId as string;
  const moderatorId = rawModeratorId as string;

  await requireCoupleMembership(eventId);

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('event_moderators')
    .select('permissions_json, role_subtype')
    .eq('moderator_id', moderatorId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (row && seatIsFullCohost((row as { role_subtype: string }).role_subtype)) {
    redirect(seatReturnPath(formData, eventId, { invite_error: COHOST_NEEDS_NO_GRANT }));
  }
  if (row) {
    const perms = ((row as { permissions_json: ModeratorPermissions | null })
      .permissions_json ?? {
      edit_all: false,
      checkout: false,
      invite_hosts: false,
      remove_hosts: false,
    }) as ModeratorPermissions;
    // An explicit null, never a deleted key. Absence would fall through to the
    // resolver's tail, which FAILS OPEN for a delegate with edit_all —
    // withdrawal has to be written down, not implied.
    // ⚠ And every OTHER area is written down at the same time, or granting one
    // silently withdraws the rest — see `materializeAreas`.
    const permissions = withArea(perms, 'photos', grant === 'view' ? 'view' : null);
    await admin
      .from('event_moderators')
      .update({
        permissions_json: permissions,
        updated_at: new Date().toISOString(),
      })
      .eq('moderator_id', moderatorId)
      .eq('event_id', eventId);
  }

  revalidateSeatScreens(eventId, formData);
  redirect(seatReturnPath(formData, eventId, { grant_updated: '1' }));
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

  // Why the couple is removing this coordinator (owner 2026-06-22: capture the
  // reason; 'abuse_misuse' is an admin signal). Falls back to the generic value
  // if the form omits it.
  const rawReason = formData.get('reason');
  const ALLOWED_REASONS = new Set([
    'no_longer_availing',
    'abuse_misuse',
    'new_coordinator',
    'other',
  ]);
  const reason =
    typeof rawReason === 'string' && ALLOWED_REASONS.has(rawReason)
      ? rawReason
      : 'removed_by_couple';

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
    redirect(seatReturnPath(formData, eventId, { invite_error: 'You cannot remove yourself.' }));
  }

  // 🔑 READ THE ANSWER. A celebrant co-host cannot be removed — the database
  // refuses it (`a_celebrant_cohost_stays`, 20271251336140). Ignoring this
  // error used to fall through to "Host removed — their access ended
  // immediately", a success banner over a refusal.
  const { error: removeError } = await admin
    .from('event_moderators')
    .update({
      removed_at: new Date().toISOString(),
      removal_reason: reason,
      invitation_token: null,
    })
    .eq('moderator_id', moderatorId)
    .eq('event_id', eventId);
  if (removeError) {
    const msg = /celebrant_cohost_locked/.test(removeError.message)
      ? 'A celebrant stays a co-host. A celebrant can change their role first.'
      : 'Could not remove them. Try again.';
    redirect(seatReturnPath(formData, eventId, { invite_error: msg }));
  }

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

  // Close the RA 10173 audit loop (corpus Coordinator_Whats_Next § 4): the
  // consent recorded at invite time is now revoked. Best-effort no-op when no
  // consent row exists (e.g. the gate flag was off at invite time).
  await stampCoordinatorConsentRevoked(admin, eventId, moderatorId);

  revalidateSeatScreens(eventId, formData);
  redirect(seatReturnPath(formData, eventId, { host_removed: '1' }));
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

  await requireCoupleMembership(eventId);

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

  // Close the RA 10173 audit loop (corpus Coordinator_Whats_Next § 4): a
  // revoked pending invite ends the consented share before access ever
  // began. Best-effort no-op when no consent row exists.
  await stampCoordinatorConsentRevoked(admin, eventId, moderatorId);

  revalidateSeatScreens(eventId, formData);
  redirect(seatReturnPath(formData, eventId, { invite_revoked: '1' }));
}
