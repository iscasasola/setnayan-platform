import 'server-only';

import type { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { peopleConnectionsEnabled } from '@/lib/people-connections';
import { firstNameOf } from '@/lib/people-add';
import { requestConnection } from '@/lib/people-connection-request.server';
import { connectHostsLine } from '@/lib/guest-connects-hosts';

/**
 * guest-connects-hosts.server.ts — the server half of "Also connect with <the hosts>" (pure half and the ruling:
 * `lib/guest-connects-hosts.ts`).
 *
 * ── WHO THE HOSTS ARE ───────────────────────────────────────────────────────
 * The event's `couple` members: the account that made it, the partner who joined it, and any co-host — co-hosts
 * hold "equal access to the event as the one who created it" (owner 2026-09-28) and the same membership kind. Every
 * one of them is an account by construction (an `event_members` row IS an account on the event), so the tick names
 * nobody who might not be on Setnayan, and hiding or drawing it says nothing about anybody else's account.
 *
 * ── THE NAME THE TICK SAYS ─────────────────────────────────────────────────
 * The event's own name for each host: the first name on the guest-list row that host holds (their member row's
 * `guest_id`, their co-host seat's `guest_id`, or the row carrying their account's email — the creator's own row has
 * no link). Only when the list has no row for them, their account's first name. Never an email, never a handle the
 * guest could not already read on the invitation.
 *
 * ── WHO IS ASKED ───────────────────────────────────────────────────────────
 * Each host the guest has NO live row with, in EITHER direction — not pending, not confirmed, not a decline still on
 * file (a host who declined is not asked again by a tick). The guest who IS a host asks nobody and sees no tick.
 * Nobody to ask → no tick.
 */

type Admin = ReturnType<typeof createAdminClient>;
type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type HostToAsk = { userId: string; firstName: string; fullName: string };

export type HostsToAsk = {
  hosts: HostToAsk[];
  /** The tick's words — "Also connect with Ice and Claire". */
  line: string;
  event: { name: string; type: string };
  guestPersonId: string;
};

/**
 * The hosts this guest would ask, or null when the tick must not be drawn: connections off, the guest is a host,
 * the guest has no person node yet, every host is already on a row with them, or a read was refused (unread is
 * never "nobody is connected" — a refusal hides the tick rather than offering to ask somebody already asked).
 */
export async function hostsToAsk(admin: Admin, eventId: string, guestUserId: string): Promise<HostsToAsk | null> {
  if (!peopleConnectionsEnabled()) return null;
  try {
    const [members, event] = await Promise.all([
      admin.from('event_members').select('user_id, guest_id').eq('event_id', eventId).eq('member_type', 'couple'),
      admin.from('events').select('display_name, event_type').eq('event_id', eventId).maybeSingle(),
    ]);
    if (members.error || event.error || !event.data) {
      if (members.error) logQueryError('hostsToAsk.members', members.error, {}, 'graceful_degrade');
      if (event.error) logQueryError('hostsToAsk.event', event.error, {}, 'graceful_degrade');
      return null;
    }
    const hostRows = (members.data ?? []) as Array<{ user_id: string | null; guest_id: string | null }>;
    const hostIds = [...new Set(hostRows.map((r) => r.user_id).filter((id): id is string => Boolean(id)))];
    if (hostIds.length === 0 || hostIds.includes(guestUserId)) return null;

    const [people, users, seats] = await Promise.all([
      admin
        .from('people')
        .select('person_id, claimed_by_user_id')
        .in('claimed_by_user_id', [guestUserId, ...hostIds])
        .is('deleted_at', null),
      admin.from('users').select('user_id, email, first_name, display_name').in('user_id', hostIds),
      admin
        .from('event_moderators')
        .select('user_id, guest_id')
        .eq('event_id', eventId)
        .in('user_id', hostIds)
        .not('accepted_at', 'is', null)
        .is('removed_at', null),
    ]);
    if (people.error || users.error) {
      if (people.error) logQueryError('hostsToAsk.people', people.error, {}, 'graceful_degrade');
      if (users.error) logQueryError('hostsToAsk.users', users.error, {}, 'graceful_degrade');
      return null;
    }
    if (seats.error) logQueryError('hostsToAsk.seats', seats.error, {}, 'graceful_degrade');

    const personOf = new Map<string, string>();
    for (const p of (people.data ?? []) as Array<{ person_id: string; claimed_by_user_id: string }>) {
      personOf.set(p.claimed_by_user_id, p.person_id);
    }
    const guestPersonId = personOf.get(guestUserId) ?? null;
    if (!guestPersonId) return null;

    // Any live row between the guest and a host, either direction, any status.
    const hostPersons = hostIds.map((id) => personOf.get(id)).filter((id): id is string => Boolean(id));
    const onARow = new Set<string>();
    if (hostPersons.length > 0) {
      const list = hostPersons.join(',');
      const { data: edges, error } = await admin
        .from('person_connections')
        .select('from_person_id, to_person_id')
        .or(
          `and(from_person_id.eq.${guestPersonId},to_person_id.in.(${list})),` +
            `and(to_person_id.eq.${guestPersonId},from_person_id.in.(${list}))`,
        )
        .is('deleted_at', null);
      if (error) {
        logQueryError('hostsToAsk.edges', error, {}, 'graceful_degrade');
        return null;
      }
      for (const e of (edges ?? []) as Array<{ from_person_id: string; to_person_id: string }>) {
        onARow.add(e.from_person_id === guestPersonId ? e.to_person_id : e.from_person_id);
      }
    }

    const names = await hostNamesFromTheList(admin, eventId, hostRows, (seats.data ?? []) as typeof hostRows, users.data ?? []);
    const userById = new Map(
      ((users.data ?? []) as Array<{ user_id: string; first_name: string | null; display_name: string | null }>).map(
        (u) => [u.user_id, u],
      ),
    );

    const hosts: HostToAsk[] = [];
    for (const id of hostIds) {
      const person = personOf.get(id);
      if (!person || onARow.has(person)) continue;
      const u = userById.get(id);
      const listed = names.get(id) ?? null;
      const fullName = (listed ?? (u?.display_name ?? '')).trim();
      const firstName =
        firstNameOf(listed) ?? ((u?.first_name ?? '').trim() || null) ?? firstNameOf(u?.display_name) ?? null;
      if (!firstName) continue;
      hosts.push({ userId: id, firstName, fullName: fullName || firstName });
    }
    if (hosts.length === 0) return null;

    const ev = event.data as { display_name: string | null; event_type: string | null };
    return {
      hosts,
      line: connectHostsLine(hosts.map((h) => h.firstName)),
      event: { name: (ev.display_name ?? '').trim(), type: (ev.event_type ?? '').replace(/_/g, ' ') },
      guestPersonId,
    };
  } catch {
    return null;
  }
}

/** Each host's name as the event's own guest list writes it, keyed by account. Missing → no entry. */
async function hostNamesFromTheList(
  admin: Admin,
  eventId: string,
  members: ReadonlyArray<{ user_id: string | null; guest_id: string | null }>,
  seats: ReadonlyArray<{ user_id: string | null; guest_id: string | null }>,
  users: ReadonlyArray<{ user_id: string; email: string | null }>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  type Row = { guest_id: string; first_name: string | null; last_name: string | null; display_name: string | null; email: string | null };
  // Deliberately NARROW: the tick may show a first name, so it reads only what names and matches a row.
  const COLUMNS = 'guest_id, first_name, last_name, display_name, email';
  const nameOf = (g: Row) => {
    const first = (g.first_name ?? '').trim();
    const formal = [first, (g.last_name ?? '').trim()].filter((v) => v && v.toLowerCase() !== 'tba').join(' ');
    return (first && first.toLowerCase() !== 'tba' ? formal : '') || (g.display_name ?? '').trim();
  };

  const links = [...members, ...seats].filter((l): l is { user_id: string; guest_id: string } => Boolean(l.user_id && l.guest_id));
  if (links.length > 0) {
    const { data, error } = await admin
      .from('guests')
      .select(COLUMNS)
      .eq('event_id', eventId)
      .in('guest_id', [...new Set(links.map((l) => l.guest_id))])
      .is('deleted_at', null);
    if (error) logQueryError('hostsToAsk.guests', error, {}, 'graceful_degrade');
    const byGuest = new Map(((data ?? []) as Row[]).map((g) => [g.guest_id, g]));
    for (const link of links) {
      if (out.has(link.user_id)) continue;
      const g = byGuest.get(link.guest_id);
      const name = g ? nameOf(g) : '';
      if (name) out.set(link.user_id, name);
    }
  }

  // The creator's own row carries no link — matched by their account's email, as `celebrantAccountsFor` does.
  for (const u of users) {
    if (out.has(u.user_id)) continue;
    const email = (u.email ?? '').trim();
    if (!email) continue;
    const { data, error } = await admin
      .from('guests')
      .select(COLUMNS)
      .eq('event_id', eventId)
      .ilike('email', email)
      .is('deleted_at', null)
      .limit(1);
    if (error) logQueryError('hostsToAsk.guestByEmail', error, {}, 'graceful_degrade');
    const g = ((data ?? []) as Row[])[0];
    const name = g ? nameOf(g) : '';
    if (name) out.set(u.user_id, name);
  }
  return out;
}

/**
 * SEND THE ASK — after a bind that succeeded, and only when the guest left the tick on (the caller checks
 * `connectHostsTicked`). The hosts are RE-DECIDED here, never taken from the page. Each one goes through the one
 * writer, `requestConnection`, with no invitation sender (📵 in-app only) and the event stamped, so their Requests
 * row reads "<guest> is trying to add you from your <event> event".
 *
 * 🔒 NEVER THROWS, NEVER BLOCKS. Every caller has already bound the seat; a refused ask costs the guest nothing and
 * their landing is unchanged. Returns how many asks were written, for the caller's telemetry only.
 */
export async function askEventHostsToConnect(input: {
  supabase: SupabaseServer;
  eventId: string;
  guestUserId: string;
}): Promise<{ asked: number }> {
  try {
    const admin = createAdminClient();
    const found = await hostsToAsk(admin, input.eventId, input.guestUserId);
    if (!found) return { asked: 0 };
    let asked = 0;
    for (const host of found.hosts) {
      const res = await requestConnection({
        supabase: input.supabase,
        userId: input.guestUserId,
        fromPerson: found.guestPersonId,
        toUserId: host.userId,
        theirName: host.fullName,
        theirEmail: null,
        relation: null,
        fromEvent: { eventId: input.eventId, name: found.event.name, type: found.event.type },
      }).catch(() => ({ ok: false as const, error: 'threw' }));
      if (res.ok) asked += 1;
    }
    return { asked };
  } catch {
    return { asked: 0 };
  }
}
