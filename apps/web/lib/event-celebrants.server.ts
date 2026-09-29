import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isHonoreeRole } from '@/lib/role-groups';
import type { GuestRole } from '@/lib/guests';

/**
 * event-celebrants.server.ts — "The celebrants" on a guest's own Me tab
 * (owner 2026-09-28, FOLLOWERS vs CONNECTED PEOPLE, rule 2):
 *
 *   *"They have an option to add the celebrants from the event. So when they
 *   add someone. The host/celebrants will have a request list (X person is
 *   trying to add you from your X event. [Accept]/[Decline] … They can follow
 *   without request but adding them will be connected people."*
 *
 * ── WHO IS A CELEBRANT — ONE RULE ACROSS THE PRODUCT ───────────────────────
 * A guest-list row whose MAIN role (`guests.role`) is an honoree role —
 * `isHonoreeRole`: celebrant · bride · groom. The person the day is FOR, never
 * who runs it. Extra roles do NOT count (controller ruling 2026-09-28): this is
 * the same rule as `public.is_event_celebrant` — which holds the celebrant lock
 * and decides whether a request names its event — so "celebrant" means one
 * thing everywhere. Counting extra roles here would list somebody whose request
 * then arrives without the event's name. Bride and groom are always main roles
 * (one each per event), so nobody real is lost.
 *
 * ── WHO "HAS A SETNAYAN ACCOUNT" ────────────────────────────────────────────
 * Only a link the database already made, never a guess from an email:
 *   · `event_members.guest_id` — the account that holds that guest row;
 *   · `event_moderators.guest_id` — a live co-host seat tied to that row;
 *   · the event's own co-hosts (`event_members` 'couple') whose account email is
 *     the row's email — the creator's seat carries no guest link, and a groom who
 *     made the event is still a celebrant on it.
 * A celebrant with none of these is left off: there is no account to follow
 * or to ask.
 *
 * ── WHAT IS EXPOSED ─────────────────────────────────────────────────────────
 * THIS EVENT's celebrants only, to a signed-in account already linked to a seat
 * at this event (the caller checks). Per celebrant: the name the host wrote on
 * the guest list, a photo, the public handle, and whether a Follow or an Add
 * would be accepted. Nothing else about them — no email, no user_id.
 */

type Admin = ReturnType<typeof createAdminClient>;

/** The honoree roles, spelled for the PostgREST filter. Held to
 *  `isHonoreeRole` below, so a role added there cannot silently miss here. */
const HONOREE_ROLES: readonly GuestRole[] = ['celebrant', 'bride', 'groom'];

export type CelebrantAccount = { userId: string; guestName: string };

/** This event's celebrants who hold a Setnayan account, keyed by account. */
export async function celebrantAccountsFor(admin: Admin, eventId: string): Promise<CelebrantAccount[]> {
  const { data: guestRows, error: guestErr } = await admin
    .from('guests')
    // Deliberately NARROW, not ENTOURAGE_COLUMNS: this list may expose only a name, so it reads only what names and matches a celebrant.
    .select('guest_id, first_name, last_name, display_name, email, role')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .in('role', [...HONOREE_ROLES]);
  if (guestErr) {
    logQueryError('celebrantAccountsFor.guests', guestErr, {}, 'graceful_degrade');
    return [];
  }
  const guests = ((guestRows ?? []) as Array<{
    guest_id: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    email: string | null;
    role: GuestRole | null;
  }>).filter((g) => g.role !== null && isHonoreeRole(g.role));
  if (guests.length === 0) return [];
  const guestIds = guests.map((g) => g.guest_id);

  const [members, seats, cohosts] = await Promise.all([
    admin.from('event_members').select('guest_id, user_id').eq('event_id', eventId).in('guest_id', guestIds),
    admin
      .from('event_moderators')
      .select('guest_id, user_id')
      .eq('event_id', eventId)
      .in('guest_id', guestIds)
      .not('accepted_at', 'is', null)
      .is('removed_at', null),
    admin.from('event_members').select('user_id').eq('event_id', eventId).eq('member_type', 'couple'),
  ]);
  if (members.error) logQueryError('celebrantAccountsFor.members', members.error, {}, 'graceful_degrade');
  if (seats.error) logQueryError('celebrantAccountsFor.seats', seats.error, {}, 'graceful_degrade');
  if (cohosts.error) logQueryError('celebrantAccountsFor.cohosts', cohosts.error, {}, 'graceful_degrade');

  const byGuest = new Map<string, string>();
  for (const r of [...(members.data ?? []), ...(seats.data ?? [])] as Array<{
    guest_id: string | null;
    user_id: string | null;
  }>) {
    if (r.guest_id && r.user_id && !byGuest.has(r.guest_id)) byGuest.set(r.guest_id, r.user_id);
  }

  // The co-hosts' own emails, matched to a celebrant row that no link reached.
  const cohostIds = ((cohosts.data ?? []) as Array<{ user_id: string | null }>)
    .map((r) => r.user_id)
    .filter((id): id is string => Boolean(id));
  if (cohostIds.length > 0 && guests.some((g) => !byGuest.has(g.guest_id) && g.email)) {
    const { data: users, error } = await admin.from('users').select('user_id, email').in('user_id', cohostIds);
    if (error) logQueryError('celebrantAccountsFor.cohostEmails', error, {}, 'graceful_degrade');
    const byEmail = new Map<string, string>();
    for (const u of (users ?? []) as Array<{ user_id: string; email: string | null }>) {
      const e = (u.email ?? '').trim().toLowerCase();
      if (e) byEmail.set(e, u.user_id);
    }
    for (const g of guests) {
      if (byGuest.has(g.guest_id)) continue;
      const hit = byEmail.get((g.email ?? '').trim().toLowerCase());
      if (hit) byGuest.set(g.guest_id, hit);
    }
  }

  const out: CelebrantAccount[] = [];
  const seen = new Set<string>();
  for (const g of guests) {
    const userId = byGuest.get(g.guest_id);
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    const guestName =
      (g.display_name ?? '').trim() || `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim() || 'A celebrant';
    out.push({ userId, guestName });
  }
  return out;
}

export type CelebrantRow = {
  /** `users.public_id` — what Follow and Add act on. */
  publicId: string;
  name: string;
  photoUrl: string | null;
  /** Their profile is public — the only case a Follow is accepted. */
  followable: boolean;
  following: boolean;
  /** Where a connection between you already stands. */
  connection: 'none' | 'asked' | 'connected';
};

/** The Me tab's list for one viewer. Empty when there is nobody to show. */
export async function celebrantsForViewer(
  admin: Admin,
  eventId: string,
  viewerUserId: string,
): Promise<CelebrantRow[]> {
  const accounts = (await celebrantAccountsFor(admin, eventId)).filter((a) => a.userId !== viewerUserId);
  if (accounts.length === 0) return [];
  const ids = accounts.map((a) => a.userId);

  const [users, follows, viewerPerson, theirPeople] = await Promise.all([
    admin.from('users').select('user_id, public_id, profile_photo_url, public_profile_enabled').in('user_id', ids),
    admin.from('user_follows').select('followed_user_id').eq('follower_user_id', viewerUserId).in('followed_user_id', ids),
    admin.from('people').select('person_id').eq('claimed_by_user_id', viewerUserId).is('deleted_at', null).maybeSingle(),
    admin.from('people').select('person_id, claimed_by_user_id').in('claimed_by_user_id', ids).is('deleted_at', null),
  ]);
  if (users.error) {
    logQueryError('celebrantsForViewer.users', users.error, {}, 'graceful_degrade');
    return [];
  }
  if (follows.error) logQueryError('celebrantsForViewer.follows', follows.error, {}, 'graceful_degrade');
  if (viewerPerson.error) logQueryError('celebrantsForViewer.me', viewerPerson.error, {}, 'graceful_degrade');
  if (theirPeople.error) logQueryError('celebrantsForViewer.people', theirPeople.error, {}, 'graceful_degrade');

  const following = new Set(
    ((follows.data ?? []) as Array<{ followed_user_id: string }>).map((r) => r.followed_user_id),
  );
  const personOfUser = new Map<string, string>();
  for (const p of (theirPeople.data ?? []) as Array<{ person_id: string; claimed_by_user_id: string }>) {
    personOfUser.set(p.claimed_by_user_id, p.person_id);
  }

  // Where a connection already stands, either direction. Scoped to MY person
  // and THEIR persons explicitly — the admin client sees every edge.
  const myPerson = (viewerPerson.data as { person_id: string } | null)?.person_id ?? null;
  const stateByPerson = new Map<string, 'asked' | 'connected'>();
  const theirPersons = [...personOfUser.values()];
  if (myPerson && theirPersons.length > 0) {
    const { data: edges, error } = await admin
      .from('person_connections')
      .select('from_person_id, to_person_id, status')
      .or(
        `and(from_person_id.eq.${myPerson},to_person_id.in.(${theirPersons.join(',')})),` +
          `and(to_person_id.eq.${myPerson},from_person_id.in.(${theirPersons.join(',')}))`,
      )
      .is('deleted_at', null)
      .in('status', ['pending', 'confirmed']);
    if (error) logQueryError('celebrantsForViewer.edges', error, {}, 'graceful_degrade');
    for (const e of (edges ?? []) as Array<{ from_person_id: string; to_person_id: string; status: string }>) {
      const other = e.from_person_id === myPerson ? e.to_person_id : e.from_person_id;
      if (e.status === 'confirmed' || !stateByPerson.has(other)) {
        stateByPerson.set(other, e.status === 'confirmed' ? 'connected' : 'asked');
      }
    }
  }

  const userById = new Map(
    ((users.data ?? []) as Array<{
      user_id: string;
      public_id: string | null;
      profile_photo_url: string | null;
      public_profile_enabled: boolean | null;
    }>).map((u) => [u.user_id, u]),
  );

  const rows: CelebrantRow[] = [];
  for (const a of accounts) {
    const u = userById.get(a.userId);
    if (!u?.public_id) continue;
    const person = personOfUser.get(a.userId);
    rows.push({
      publicId: u.public_id,
      name: a.guestName,
      photoUrl: u.profile_photo_url,
      followable: u.public_profile_enabled === true,
      following: following.has(a.userId),
      connection: (person && stateByPerson.get(person)) || 'none',
    });
  }
  return rows;
}
