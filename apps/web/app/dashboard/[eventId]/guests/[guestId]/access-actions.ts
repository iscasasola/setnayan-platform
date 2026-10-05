'use server';

/**
 * access-actions.ts — a co-host sets a guest's Access (None · Co-host ·
 * Limited helper). Called from ONE place since 2026-10-03: Event Details ›
 * People with access (its row's Access dropdown and its "Add a person").
 *
 * Owner 2026-09-28 (DECISION_LOG "CO-HOSTS COME FROM THE GUEST LIST — FINAL
 * MODEL"): "host can add another host and also remove a host at any point in
 * time with no need to accept" · "accepted guests can be assigned as host" ·
 * "the assigning is automatic". So this writes the SEAT and stops: whether it
 * is live yet — the guest has said YES and linked their account — is decided
 * by the database (`activate_guest_seats`, migration 20271251336140), which is
 * also what mints their membership and drops the "You are now a co-host…"
 * notice. One writer, every door.
 *
 * ── WHAT THIS REFUSES, AND WHERE ────────────────────────────────────────────
 *   · not a co-host → here (the `couple` membership is the co-host test; a
 *     limited helper or hired planner is `coordinator` and cannot grant).
 *   · the creator's own row → here (always the host).
 *   · removing or narrowing a CELEBRANT co-host → the database
 *     (`a_celebrant_cohost_stays`); we translate its error into words.
 *
 * ⚠ A WAITING SEAT IS WRITTEN WITH `accepted_at: null` EXPLICITLY. The column
 * is DEFAULT now(); leaving it out stamps "accepted" on a seat nobody has
 * joined — the first dry run of this flow skipped every seat on exactly that.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ACCESS_SEAT_KIND,
  creatorGuestIds,
  guestAccessState,
  type GuestAccessLevel,
  type GuestAccessState,
} from '@/lib/guest-access';

const LEVELS: readonly GuestAccessLevel[] = ['none', 'co_host', 'limited_helper'];

const FULL_PERMISSIONS = {
  edit_all: true,
  checkout: true,
  invite_hosts: true,
  remove_hosts: true,
};

/** View on every area, edit on none — and nothing else (owner: "may view but
 *  may not edit … role is to track the progress only"). */
const VIEW_ONLY_PERMISSIONS = {
  edit_all: false,
  checkout: false,
  invite_hosts: false,
  remove_hosts: false,
  areas: {
    guest_list: 'view',
    seat_plan: 'view',
    schedule: 'view',
    vendors: 'view',
    invitations: 'view',
    mood_board: 'view',
    budget: 'view',
    photos: 'view',
  },
};

export type SetGuestAccessResult =
  | { ok: true; state: GuestAccessState }
  | { ok: false; error: string };

export async function setGuestAccess(
  eventId: string,
  guestId: string,
  level: GuestAccessLevel,
): Promise<SetGuestAccessResult> {
  if (!LEVELS.includes(level)) return { ok: false, error: 'Pick an access level.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  // Only a co-host changes access. Read under RLS: the caller's own row.
  const { data: me } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!me) return { ok: false, error: 'Only a co-host can change who has access.' };

  const admin = createAdminClient();
  const { data: guest } = await admin
    .from('guests')
    .select('guest_id, event_id, email, role, person_id, first_name')
    .eq('guest_id', guestId)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!guest) return { ok: false, error: 'That guest is no longer on the list.' };
  const g = guest as {
    guest_id: string;
    email: string | null;
    role: string;
    person_id: string | null;
    first_name: string;
  };

  const isCreator = await guestIsCreator(admin, eventId, g.guest_id, g.person_id);
  if (isCreator) {
    return { ok: false, error: 'The person who created the event is always the host.' };
  }

  const { data: seatRow } = await admin
    .from('event_moderators')
    .select('moderator_id, role_subtype, user_id, removed_at')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const seat = seatRow as
    | { moderator_id: string; role_subtype: string; user_id: string | null; removed_at: string | null }
    | null;
  const now = new Date().toISOString();

  let error: { code?: string; message: string } | null = null;

  if (level === 'none') {
    if (seat && !seat.removed_at) {
      ({ error } = await admin
        .from('event_moderators')
        .update({ removed_at: now, removal_reason: 'removed_by_couple', updated_at: now })
        .eq('moderator_id', seat.moderator_id));
    }
  } else {
    const kind = ACCESS_SEAT_KIND[level];
    const permissions = level === 'co_host' ? FULL_PERMISSIONS : VIEW_ONLY_PERMISSIONS;
    if (seat && !seat.removed_at) {
      if (seat.role_subtype !== kind) {
        ({ error } = await admin
          .from('event_moderators')
          .update({ role_subtype: kind, permissions_json: permissions, updated_at: now })
          .eq('moderator_id', seat.moderator_id));
      }
    } else if (seat) {
      // A person keeps one seat row per event for life (UNIQUE event_id,
      // user_id), so re-adding REVIVES it; the database takes it live again
      // if they have already joined.
      ({ error } = await admin
        .from('event_moderators')
        .update({
          removed_at: null,
          removal_reason: null,
          role_subtype: kind,
          permissions_json: permissions,
          user_id: null,
          accepted_at: null,
          invited_by_user_id: user.id,
          invitation_email: g.email,
          updated_at: now,
        })
        .eq('moderator_id', seat.moderator_id));
    } else {
      ({ error } = await admin.from('event_moderators').insert({
        event_id: eventId,
        guest_id: guestId,
        role_subtype: kind,
        permissions_json: permissions,
        invited_by_user_id: user.id,
        invitation_email: g.email,
        invitation_sent_at: now,
        user_id: null,
        accepted_at: null,
      }));
    }
  }

  if (error) {
    if (/celebrant_cohost_locked/.test(error.message)) {
      return {
        ok: false,
        error: `${g.first_name} is a celebrant, so ${g.first_name} stays a co-host. A celebrant can change ${g.first_name}'s role first.`,
      };
    }
    console.error('[setGuestAccess]', error);
    return { ok: false, error: 'Could not change access. Try again.' };
  }

  // Read the seat back — the database decided whether it is live.
  const { data: after } = await admin
    .from('event_moderators')
    .select('role_subtype, user_id, removed_at')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  revalidatePath(`/dashboard/${eventId}/guests`);
  revalidatePath(`/dashboard/${eventId}/hosts`);
  revalidatePath(`/dashboard/${eventId}/details`);
  return {
    ok: true,
    state: guestAccessState({
      seat: (after as { role_subtype: string; user_id: string | null; removed_at: string | null } | null) ?? null,
      guestRole: g.role,
      isCreator: false,
    }),
  };
}

/**
 * Is this guest row the event creator's own? Their membership holds it, or its
 * person record is theirs — `creatorGuestIds`, the one rule the card reads too.
 */
async function guestIsCreator(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  guestId: string,
  personId: string | null,
): Promise<boolean> {
  const [{ data: person }, { data: creators }] = await Promise.all([
    personId
      ? admin.from('people').select('claimed_by_user_id').eq('person_id', personId).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('event_members')
      .select('user_id, guest_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple')
      .eq('joined_via', 'created_event'),
  ]);
  const list = (creators ?? []) as { user_id: string; guest_id: string | null }[];
  const claimer = (person as { claimed_by_user_id: string | null } | null)?.claimed_by_user_id;
  const personIsCreators = Boolean(claimer && list.some((c) => c.user_id === claimer));
  return creatorGuestIds({ creators: list, rowsOfCreatorPersons: personIsCreators ? [guestId] : [] }).has(guestId);
}
