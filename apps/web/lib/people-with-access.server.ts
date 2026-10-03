import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { planGroupLabelForCategory } from '@/lib/lock-impact-inputs';
import { ENTOURAGE_COLUMNS } from '@/lib/entourage';
import type { ModeratorPermissions } from '@/lib/delegate-areas';
import {
  buildPeopleWithAccess,
  type HostInput,
  type PersonRow,
  type SeatGuestInput,
  type SeatInput,
  type SupplierInput,
} from '@/lib/people-with-access';

/** The statuses that make a booking real (the Hosts page's, `promote-coordinator-card`'s). */
const BOOKED = ['contracted', 'deposit_paid', 'delivered', 'complete'] as const;

export type AddableGuest = { guestId: string; name: string };

export type PeopleWithAccess =
  | { measured: true; rows: PersonRow[]; addable: AddableGuest[] }
  | { measured: false };

/**
 * The reads behind Event Details › People with access — one round of queries.
 *
 * Admin client, scoped by event: `event_moderators` and `users` are read the
 * way every host door reads them (their RLS is the seat holder's own row). The
 * CALLER must already know the viewer is a host of this event — the page asks
 * `fetchEventViewer` first and only a `couple` member reaches this.
 *
 * ⚠ A REFUSED READ IS `measured: false`, NEVER AN EMPTY LIST. "Nobody else has
 * access" over a read that failed would tell a couple their coordinator is
 * gone while they still hold the guest list.
 */
export async function loadPeopleWithAccess(eventId: string, viewerUserId: string): Promise<PeopleWithAccess> {
  const admin = createAdminClient();
  const [membersRes, seatsRes, guestsRes, vendorsRes, eventRes] = await Promise.all([
    admin.from('event_members').select('user_id, joined_via').eq('event_id', eventId).eq('member_type', 'couple'),
    admin
      .from('event_moderators')
      .select(
        'moderator_id, user_id, guest_id, role_subtype, display_label, invitation_email, invitation_token, invitation_expires_at, permissions_json, created_at',
      )
      .eq('event_id', eventId)
      .is('removed_at', null)
      .order('created_at', { ascending: true }),
    admin
      .from('guests')
      // The canonical guest-name read (`ENTOURAGE_COLUMNS`) — never a narrower copy.
      .select(ENTOURAGE_COLUMNS)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('first_name', { ascending: true }),
    admin
      .from('event_vendors')
      .select('vendor_id, vendor_name, category, status')
      .eq('event_id', eventId)
      .is('archived_at', null)
      .in('status', BOOKED as unknown as string[]),
    admin.from('events').select('event_date, event_end_date, event_date_precision').eq('event_id', eventId).maybeSingle(),
  ]);
  const failed = membersRes.error ?? seatsRes.error ?? guestsRes.error ?? vendorsRes.error ?? eventRes.error;
  if (failed) {
    logQueryError('loadPeopleWithAccess', failed, { eventId }, 'graceful_degrade');
    return { measured: false };
  }

  const members = (membersRes.data ?? []) as { user_id: string; joined_via: string | null }[];
  const seatRows = (seatsRes.data ?? []) as {
    moderator_id: string;
    user_id: string | null;
    guest_id: string | null;
    role_subtype: string;
    display_label: string | null;
    invitation_email: string | null;
    invitation_token: string | null;
    invitation_expires_at: string | null;
    permissions_json: ModeratorPermissions | null;
  }[];
  const guests = (guestsRes.data ?? []) as unknown as {
    guest_id: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    role: string | null;
  }[];

  const userIds = [...new Set([...members.map((m) => m.user_id), ...seatRows.map((s) => s.user_id)].filter((u): u is string => !!u))];
  const userNames = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await admin
      .from('users')
      .select('user_id, display_name, email')
      .in('user_id', userIds);
    if (usersError) {
      logQueryError('loadPeopleWithAccess.users', usersError, { eventId }, 'graceful_degrade');
      return { measured: false };
    }
    for (const u of (users ?? []) as { user_id: string; display_name: string | null; email: string | null }[]) {
      const name = u.display_name?.trim() || u.email?.trim();
      if (name) userNames.set(u.user_id, name);
    }
  }

  const guestName = (g: (typeof guests)[number]) =>
    g.display_name?.trim() || [g.first_name, g.last_name].filter(Boolean).join(' ').trim() || 'A guest';
  const seatGuests = new Map<string, SeatGuestInput>();
  for (const g of guests) {
    seatGuests.set(g.guest_id, {
      guestId: g.guest_id,
      name: guestName(g),
      firstName: g.first_name?.trim() || guestName(g),
      role: g.role ?? 'guest',
    });
  }

  const hosts: HostInput[] = members.map((m) => ({
    userId: m.user_id,
    name: userNames.get(m.user_id) ?? 'A co-host',
    isCreator: m.joined_via === 'created_event',
  }));
  const seats: SeatInput[] = seatRows.map((s) => ({
    moderatorId: s.moderator_id,
    userId: s.user_id,
    guestId: s.guest_id,
    roleSubtype: s.role_subtype,
    displayLabel: s.display_label,
    invitationEmail: s.invitation_email,
    invitationToken: s.invitation_token,
    invitationExpiresAt: s.invitation_expires_at,
    permissions: s.permissions_json,
  }));
  const suppliers: SupplierInput[] = (
    (vendorsRes.data ?? []) as { vendor_id: string; vendor_name: string | null; category: string | null; status: string }[]
  )
    .filter((v) => (v.vendor_name ?? '').trim())
    .map((v) => ({
      vendorId: v.vendor_id,
      name: (v.vendor_name ?? '').trim(),
      categoryLabel: planGroupLabelForCategory(v.category),
      isPlanner: v.category === 'planner_coordinator',
    }));
  const ev = (eventRes.data ?? null) as {
    event_date: string | null;
    event_end_date: string | null;
    event_date_precision: string | null;
  } | null;

  const rows = buildPeopleWithAccess({
    hosts,
    seats,
    seatGuests,
    userNames,
    suppliers,
    window: {
      eventDate: ev?.event_date ?? null,
      eventEndDate: ev?.event_end_date ?? null,
      precision: ev?.event_date_precision ?? null,
    },
    viewerUserId,
    now: new Date(),
  });

  // Anyone on the guest list without a seat can be added (owner 2026-09-28:
  // co-hosts and helpers come FROM the guest list — `setGuestAccess`).
  const seated = new Set(seatRows.map((s) => s.guest_id).filter(Boolean));
  const hostGuestIds = new Set(rows.map((r) => r.guestId).filter(Boolean));
  const addable = guests
    .filter((g) => !seated.has(g.guest_id) && !hostGuestIds.has(g.guest_id))
    .map((g) => ({ guestId: g.guest_id, name: guestName(g) }));

  return { measured: true, rows, addable };
}
