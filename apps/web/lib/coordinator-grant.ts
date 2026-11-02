import type { SupabaseClient } from '@supabase/supabase-js';
import {
  COORDINATOR_AREAS,
  PERMISSION_TEMPLATES,
  generateInvitationToken,
  type ModeratorPermissions,
} from './event-moderators';
import { isCoordinatorConsentGateEnabled } from './coordinator-consent-gate';
import { emitNotification } from './notification-emit';
import { coordinatorInviteNotice, coordinatorInviteRecipient, type AccountRow } from './coordinator-invite-notice';

const INVITE_TTL_DAYS = 7;
const MS_PER_DAY = 86_400_000;

// Auto-grant a coordinator delegate (owner 2026-06-22): the moment a booked
// planner_coordinator's downpayment is marked, auto-create the SAME pending
// delegate the manual "Promote your coordinator" makes — role
// wedding_planner_external with the COORDINATOR_AREAS grants (full planning edit ·
// mood board view · budget OFF). The coordinator activates it via the existing
// /host/accept flow, so access is never granted without their acceptance.
//
// Idempotent: skips if an active (non-removed) wedding-planner row for this event
// already covers this coordinator (same invitation email, case-insensitive) — so
// re-marking the payment, or a couple who already clicked Promote, never spawns a
// duplicate invite. Requires an ADMIN client (writes event_moderators directly,
// bypassing RLS like inviteHost). Best-effort by contract — callers wrap this so a
// failure never blocks the booking-status write that triggered it.
//
// 🤝 AND THE COORDINATOR IS TOLD (supplier gate audit 2026-11-02, E1). The invite used to reach nobody — the couple had
// to copy the link by hand. A NEW invite now sends `coordinator_invited` (in the app only, never email) to the account
// whose email the invite is for, opening `/host/accept/<token>` (`lib/coordinator-invite-notice.ts`). A re-marked
// payment that finds the invite already there tells nobody again.
export async function autoInviteCoordinator(
  admin: SupabaseClient,
  params: {
    eventId: string;
    email: string;
    displayLabel: string | null;
    invitedByUserId: string;
    /** The booked shop (`event_vendors.marketplace_vendor_id`), when the coordinator is on Setnayan. */
    shopProfileId?: string | null;
  },
): Promise<{ created: boolean; told?: boolean }> {
  const email = params.email.trim().toLowerCase();
  if (!email) return { created: false };

  // RA 10173 consent gate (corpus Coordinator_Role_Feature_Spec § 3a). Unlike
  // the manual "Promote your coordinator" flow (inviteHost), this path fires as
  // a side effect of a booking-status write — there is NO couple consent
  // interaction here, so it can't record the couple's data-privacy consent for
  // sharing guest PII. When the `coordinator_consent_money` Data Privacy control
  // is ACTIVE, silently auto-creating that PII-sharing delegate would bypass the
  // recorded-consent requirement the control exists to enforce — so we SUPPRESS
  // the auto-invite (fail-closed) and leave the couple to promote the
  // coordinator through the consent-gated manual form, which captures consent +
  // writes coordinator_access_consents. INACTIVE (default) = exact prior
  // behavior (auto-grant as before; no consent system is live anyway).
  if (await isCoordinatorConsentGateEnabled()) return { created: false };

  // Dedupe against any active wedding-planner delegate already covering this email.
  const { data: existing } = await admin
    .from('event_moderators')
    .select('invitation_email')
    .eq('event_id', params.eventId)
    .eq('role_subtype', 'wedding_planner_external')
    .is('removed_at', null);
  const already = (existing ?? []).some(
    (r) => (r as { invitation_email: string | null }).invitation_email?.trim().toLowerCase() === email,
  );
  if (already) return { created: false };

  const now = new Date();
  const permissions: ModeratorPermissions = {
    ...PERMISSION_TEMPLATES.wedding_planner_external,
    areas: { ...COORDINATOR_AREAS },
  };
  const { data: made, error } = await admin.from('event_moderators').insert({
    event_id: params.eventId,
    user_id: null,
    role_subtype: 'wedding_planner_external',
    display_label: params.displayLabel,
    permissions_json: permissions,
    invited_by_user_id: params.invitedByUserId,
    invitation_email: email,
    invitation_phone: null,
    invitation_sent_at: now.toISOString(),
    invitation_expires_at: new Date(now.getTime() + INVITE_TTL_DAYS * MS_PER_DAY).toISOString(),
    invitation_token: generateInvitationToken(),
    accepted_at: null,
  }).select('invitation_token').maybeSingle();
  if (error || !made) {
    // Said, never silent: the booking-status write goes on, but a refused invite is logged with its reason.
    console.error('[autoInviteCoordinator] invite not written:', error?.message ?? 'no row', { event_id: params.eventId });
    return { created: false };
  }
  const token = (made as { invitation_token: string | null }).invitation_token;
  const told = token ? await tellTheCoordinator(admin, { eventId: params.eventId, email, shopProfileId: params.shopProfileId ?? null, token }) : false;
  return { created: true, told };
}

/** Best-effort: the invite is written; a failed notice never undoes it (the couple's Promote card still has the link). */
async function tellTheCoordinator(
  admin: SupabaseClient,
  p: { eventId: string; email: string; shopProfileId: string | null; token: string },
): Promise<boolean> {
  try {
    const [eventRes, byEmailRes, shopRes] = await Promise.all([
      admin.from('events').select('display_name').eq('event_id', p.eventId).maybeSingle(),
      admin.from('users').select('user_id, email').ilike('email', p.email).limit(5),
      p.shopProfileId
        ? admin.from('vendor_profiles').select('user_id').eq('vendor_profile_id', p.shopProfileId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    const ownerId = (shopRes.data as { user_id: string | null } | null)?.user_id ?? null;
    let shopOwner: AccountRow | null = null;
    if (ownerId) {
      const { data: owner } = await admin.from('users').select('user_id, email').eq('user_id', ownerId).maybeSingle();
      shopOwner = (owner as AccountRow | null) ?? null;
    }
    const userId = coordinatorInviteRecipient({
      inviteEmail: p.email,
      shopOwner,
      byEmail: (byEmailRes.data ?? []) as AccountRow[],
    });
    if (!userId) return false;
    const notice = coordinatorInviteNotice({
      token: p.token,
      eventName: (eventRes.data as { display_name: string | null } | null)?.display_name ?? null,
      days: INVITE_TTL_DAYS,
    });
    await emitNotification({ userId, type: 'coordinator_invited', eventId: p.eventId, ...notice });
    return true;
  } catch (e) {
    console.error('[autoInviteCoordinator] notice failed:', e instanceof Error ? e.message : e);
    return false;
  }
}
