import type { SupabaseClient } from '@supabase/supabase-js';
import {
  COORDINATOR_AREAS,
  PERMISSION_TEMPLATES,
  generateInvitationToken,
  type ModeratorPermissions,
} from './event-moderators';
import { isCoordinatorConsentGateEnabled } from './coordinator-consent-gate';
import { bookingIsACoordinators, isBookedEventVendorStatus } from './coordinator-trade';
import { emitNotification } from './notification-emit';
import {
  coordinatorInviteNotice,
  coordinatorInviteRecipient,
  coordinatorOpenedNotice,
  type AccountRow,
} from './coordinator-invite-notice';

const INVITE_TTL_DAYS = 7;
const MS_PER_DAY = 86_400_000;

/** What one call did — callers ignore it (best-effort); it is here so the answer is never a silent `void`. */
export type SeatForBookingOutcome =
  | 'opened' // a seat (or, for a coordinator not on Setnayan, a 7-day invite) was written by THIS call
  | 'unchanged' // the seat or invite is already there, or there is nobody to seat — nothing was written
  | 'not_booked' // the row is not in the booked set
  | 'not_a_coordinator' // booked, but the shop's services are not the coordinator trade
  | 'no_booking' // no such row
  | 'unread' // the booking could not be read — logged with its reason
  | 'failed'; // something threw — logged; the booking write that called this stands

/**
 * 🚪 "ACCESS IS AUTOMATIC ON BOOKING" — EVERY DOOR, THIS ONE PLACE (owner 2026-11-21; ship review of #8094, 22 Nov
 * 2026: the seat was opened from ONE action, `updateVendorStatus`, and only on the move into downpaid — a coordinator
 * booked by the supplier's yes, a booked-QR claim, the wizard, a package, the chat's Book or a logged payment got no
 * seat).
 *
 * Every server path that moves an `event_vendors` row into the booked set calls this, one line each, AFTER its own
 * write. It decides nothing from what the caller believes: it reads the row FRESH (service role) and
 *   · does nothing unless the status is BOOKED (`BOOKED_EVENT_VENDOR_STATUSES` — the same four the database opens and
 *     closes the seat by), so an ASK that booked nobody opens nothing;
 *   · does nothing unless the booking is a coordinator's (`bookingIsACoordinators` — the database's rule: the shop's
 *     services, never the couple's category alone);
 *   · then opens the seat through `autoInviteCoordinator`, stamped with the booking (`opened_by_event_vendor_id`), so
 *     the database closes THAT seat — and only it — when this booking is cancelled.
 *
 * IDEMPOTENT: a second call finds the seat (or the pending invite) and changes nothing — so the hosts' one switch is
 * never undone by a re-marked payment, and a door that runs twice is harmless.
 * BEST-EFFORT: it never throws into the booking write. A refused read is logged with its reason, never silent.
 *
 * `actorUserId` → `event_moderators.invited_by_user_id` (nullable, FK auth.users ON DELETE SET NULL): the HOST who
 * booked. A supplier-side door (the supplier's yes) passes `null` — the supplier did not invite themselves; the row's
 * own `lock_requested_by_user_id` (the host who asked) is used when the ask recorded one, else NULL.
 *
 * 🔒 `lib/the-coordinators-seat-follows-the-booking.test.ts` fails if a door stops calling this, if a booked-status
 * write appears in a file that is neither a door nor a named exemption, and if `autoInviteCoordinator` gains a second
 * call site.
 */
export async function openTheCoordinatorsSeatForBooking(
  admin: SupabaseClient,
  p: {
    eventVendorId: string | null | undefined;
    actorUserId: string | null;
    /**
     * ✋ THE HOSTS' OWN ANSWER (controller ruling, 22 Nov 2026): a seat made when the hosts approve a supplier's claim
     * (`answer_claim_access_request`) is treated as HAND-ADDED — no `opened_by_event_vendor_id` stamp, so it survives a
     * cancel of that booking like any seat the hosts added themselves.
     */
    hostsOwnAnswer?: boolean;
  },
): Promise<SeatForBookingOutcome> {
  try {
    if (!p.eventVendorId) return 'no_booking';
    const { data, error } = await admin
      .from('event_vendors')
      .select('event_id, status, category, marketplace_vendor_id, contact_email, vendor_name, lock_requested_by_user_id')
      .eq('vendor_id', p.eventVendorId)
      .maybeSingle();
    if (error) {
      console.error('[openTheCoordinatorsSeatForBooking] booking unread — no seat opened:', error.message, { event_vendor_id: p.eventVendorId });
      return 'unread';
    }
    const row = data as {
      event_id: string;
      status: string | null;
      category: string | null;
      marketplace_vendor_id: string | null;
      contact_email: string | null;
      vendor_name: string | null;
      lock_requested_by_user_id: string | null;
    } | null;
    if (!row) return 'no_booking';
    if (!isBookedEventVendorStatus(row.status)) return 'not_booked';
    if (!(await bookingIsACoordinators(admin, { category: row.category, marketplaceVendorId: row.marketplace_vendor_id }))) {
      return 'not_a_coordinator';
    }
    const { created } = await autoInviteCoordinator(admin, {
      eventId: row.event_id,
      email: row.contact_email ?? '',
      displayLabel: row.vendor_name ?? null,
      invitedByUserId: p.actorUserId ?? row.lock_requested_by_user_id ?? null,
      // 🧭 A booked SHOP needs no contact email: its owner's account gets the seat, accepted (owner 2026-11-21).
      shopProfileId: row.marketplace_vendor_id ?? null,
      // 🔒 The booking that opens the seat — the database closes that seat when this booking is cancelled. Not on the
      // hosts' own answer to a claim: that seat is theirs and is never closed by the database.
      eventVendorId: p.hostsOwnAnswer ? null : p.eventVendorId,
    });
    return created ? 'opened' : 'unchanged';
  } catch (e) {
    console.error('[openTheCoordinatorsSeatForBooking] failed — the booking stands, no seat opened:', e instanceof Error ? e.message : e, {
      event_vendor_id: p.eventVendorId,
    });
    return 'failed';
  }
}

// Auto-grant a coordinator delegate (owner 2026-06-22; every booking door since 22 Nov 2026): the moment a
// coordinator's booking is BOOKED, auto-create the SAME pending
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
//
// 🚪 ONE CALLER: `openTheCoordinatorsSeatForBooking` above — the one place every booking door goes through. Not
// exported, so a second call site cannot appear in another file.
async function autoInviteCoordinator(
  admin: SupabaseClient,
  params: {
    eventId: string;
    email: string;
    displayLabel: string | null;
    /** The host who booked, or NULL when no host's press completed the booking (see the door above). */
    invitedByUserId: string | null;
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

  // Dedupe against any wedding-planner delegate already covering this email — a LIVE one, and one the HOSTS took away
  // (every booking door calls this since 22 Nov 2026: a later payment or a status moved along must never re-invite
  // somebody the hosts removed). Only an invite the booking's own cancel closed (`booking_cancelled`) may be made anew.
  // An unread list is never "nobody is invited": said in the log, and nothing is written.
  const { data: existing, error: existingError } = await admin
    .from('event_moderators')
    .select('invitation_email, removed_at, removal_reason')
    .eq('event_id', params.eventId)
    .eq('role_subtype', 'wedding_planner_external');
  if (existingError) {
    console.error('[autoInviteCoordinator] invites unread — none written:', existingError.message, { event_id: params.eventId });
    return { created: false };
  }
  const already = ((existing ?? []) as Array<{ invitation_email: string | null; removed_at: string | null; removal_reason: string | null }>).some(
    (r) => r.invitation_email?.trim().toLowerCase() === email && (r.removed_at === null || r.removal_reason !== 'booking_cancelled'),
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
 *   · 'removed_by_host' — the hosts took this person's seat away: NOTHING is written (it is theirs to bring back);
 *   · 'no_owner' — no owner account could be read; the caller falls back to the emailed invite;
 *   · 'refused'  — the write was refused; said in the log, never retried as "done".
 */
async function openForTheBookedShop(
  admin: SupabaseClient,
  p: { eventId: string; email: string; displayLabel: string | null; invitedByUserId: string | null; shopProfileId: string; eventVendorId?: string | null },
): Promise<'opened' | 'already' | 'removed_by_host' | 'no_owner' | 'refused'> {
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
  // with the ruled grant. A seat a HOST removed is theirs to bring back — it is never revived here, and (every booking
  // door calls this since 22 Nov 2026) a later payment or a status moved along never re-opens it either.
  const { data: gone, error: goneError } = await admin
    .from('event_moderators')
    .select('moderator_id, role_subtype, removal_reason')
    .eq('event_id', p.eventId)
    .eq('user_id', ownerId)
    .not('removed_at', 'is', null)
    .limit(1);
  if (goneError) {
    console.error('[autoInviteCoordinator] closed seats unread:', goneError.message, { event_id: p.eventId });
    return 'refused';
  }
  const closed = ((gone ?? [])[0] as { moderator_id: string; role_subtype: string | null; removal_reason: string | null } | undefined) ?? null;
  const closedByCancel = closed?.role_subtype === 'wedding_planner_external' && closed.removal_reason === 'booking_cancelled';
  if (closed && !closedByCancel) return 'removed_by_host';
  const revive = pending ? null : closedByCancel ? closed : null;
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
