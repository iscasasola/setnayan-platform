import type { SupabaseClient } from '@supabase/supabase-js';
import {
  COORDINATOR_AREAS,
  PERMISSION_TEMPLATES,
  generateInvitationToken,
  type ModeratorPermissions,
} from './event-moderators';
import { isCoordinatorConsentGateEnabled } from './coordinator-consent-gate';
import { emitNotification } from './notification-emit';
import {
  coordinatorInviteNotice,
  coordinatorInviteRecipient,
  coordinatorOpenedNotice,
  type AccountRow,
} from './coordinator-invite-notice';

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
    /**
     * 🔒 The booking itself (`event_vendors.vendor_id`). Written on the seat this call opens
     * (`opened_by_event_vendor_id`), so the database closes THAT seat — and only it — when the booking is cancelled.
     */
    eventVendorId?: string | null;
  },
): Promise<{ created: boolean; told?: boolean }> {
  const email = params.email.trim().toLowerCase();
  if (!email && !params.shopProfileId) return { created: false };

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

  // 🧭 AUTOMATIC ON BOOKING (owner 2026-11-21): a booked shop whose owner account is known gets the seat ALREADY
  // ACCEPTED — no link to copy, nothing to accept. Only a coordinator who is not on Setnayan yet (no shop) still gets
  // the 7-day emailed invite below.
  if (params.shopProfileId) {
    const opened = await openForTheBookedShop(admin, { ...params, shopProfileId: params.shopProfileId, email });
    if (opened !== 'no_owner') return { created: opened === 'opened', told: opened === 'opened' };
  }
  if (!email) return { created: false };

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
    opened_by_event_vendor_id: params.eventVendorId ?? null,
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

/**
 * 🧭 The booked shop's owner gets the coordinator's seat, ACCEPTED, with the ruled grant (`COORDINATOR_AREAS`). Pure
 * outcomes:
 *   · 'opened'   — a seat was written (or a pending invite for this shop was activated) and the owner was told;
 *   · 'already'  — they already hold a live seat here: NOTHING is rewritten, so the hosts' one switch is never undone
 *                  by a re-marked payment;
 *   · 'no_owner' — no owner account could be read; the caller falls back to the emailed invite;
 *   · 'refused'  — the write was refused; said in the log, never retried as "done".
 */
async function openForTheBookedShop(
  admin: SupabaseClient,
  p: { eventId: string; email: string; displayLabel: string | null; invitedByUserId: string; shopProfileId: string; eventVendorId?: string | null },
): Promise<'opened' | 'already' | 'no_owner' | 'refused'> {
  const { data: shop, error: shopError } = await admin
    .from('vendor_profiles')
    .select('user_id')
    .eq('vendor_profile_id', p.shopProfileId)
    .maybeSingle();
  const ownerId = (shop as { user_id: string | null } | null)?.user_id ?? null;
  if (shopError) console.error('[autoInviteCoordinator] shop owner unread:', shopError.message, { event_id: p.eventId });
  if (shopError || !ownerId) return 'no_owner';

  const { data: seats, error: seatsError } = await admin
    .from('event_moderators')
    .select('moderator_id, user_id, accepted_at, invitation_email')
    .eq('event_id', p.eventId)
    .eq('role_subtype', 'wedding_planner_external')
    .is('removed_at', null);
  if (seatsError) {
    console.error('[autoInviteCoordinator] seats unread:', seatsError.message, { event_id: p.eventId });
    return 'refused';
  }
  type Seat = { moderator_id: string; user_id: string | null; accepted_at: string | null; invitation_email: string | null };
  const rows = (seats ?? []) as Seat[];
  if (rows.some((r) => r.user_id === ownerId && r.accepted_at)) return 'already';

  const now = new Date().toISOString();
  const pending = rows.find(
    (r) => !r.accepted_at && (r.user_id === ownerId || r.invitation_email?.trim().toLowerCase() === p.email),
  );
  const ruled = (): ModeratorPermissions => ({
    ...PERMISSION_TEMPLATES.wedding_planner_external,
    areas: { ...COORDINATOR_AREAS },
  });
  // 🔁 Booked again after a cancel: the seat that cancel closed (`removal_reason = 'booking_cancelled'`) comes back
  // with the ruled grant. A seat a HOST removed is theirs to bring back — it is never revived here.
  const { data: closed } = await admin
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', p.eventId)
    .eq('user_id', ownerId)
    .eq('role_subtype', 'wedding_planner_external')
    .eq('removal_reason', 'booking_cancelled')
    .not('removed_at', 'is', null)
    .limit(1);
  const revive = pending ? null : ((closed ?? [])[0] as { moderator_id: string } | undefined) ?? null;
  let wrote = false;
  if (revive) {
    const { data, error } = await admin
      .from('event_moderators')
      .update({
        removed_at: null,
        removal_reason: null,
        accepted_at: now,
        permissions_json: ruled(),
        opened_by_event_vendor_id: p.eventVendorId ?? null,
        updated_at: now,
      })
      .eq('moderator_id', revive.moderator_id)
      .select('moderator_id');
    wrote = !error && (data ?? []).length > 0;
    if (error) console.error('[autoInviteCoordinator] revive refused:', error.message, { event_id: p.eventId });
  } else if (pending) {
    const { data, error } = await admin
      .from('event_moderators')
      .update({ user_id: ownerId, accepted_at: now, invitation_token: null, updated_at: now })
      .eq('moderator_id', pending.moderator_id)
      .is('accepted_at', null)
      .select('moderator_id');
    wrote = !error && (data ?? []).length > 0;
    if (error) console.error('[autoInviteCoordinator] activate refused:', error.message, { event_id: p.eventId });
  } else {
    const permissions = ruled();
    const { data, error } = await admin
      .from('event_moderators')
      .insert({
        event_id: p.eventId,
        user_id: ownerId,
        role_subtype: 'wedding_planner_external',
        display_label: p.displayLabel,
        permissions_json: permissions,
        invited_by_user_id: p.invitedByUserId,
        invitation_email: p.email,
        invitation_phone: null,
        invitation_sent_at: now,
        invitation_expires_at: null,
        invitation_token: null,
        accepted_at: now,
        opened_by_event_vendor_id: p.eventVendorId ?? null,
      })
      .select('moderator_id');
    wrote = !error && (data ?? []).length > 0;
    if (error) console.error('[autoInviteCoordinator] seat refused:', error.message, { event_id: p.eventId });
  }
  if (!wrote) return 'refused';

  try {
    const { data: ev } = await admin.from('events').select('display_name').eq('event_id', p.eventId).maybeSingle();
    const notice = coordinatorOpenedNotice({
      eventId: p.eventId,
      eventName: (ev as { display_name: string | null } | null)?.display_name ?? null,
    });
    await emitNotification({ userId: ownerId, type: 'coordinator_invited', eventId: p.eventId, ...notice });
  } catch (e) {
    console.error('[autoInviteCoordinator] notice failed:', e instanceof Error ? e.message : e);
  }
  return 'opened';
}
