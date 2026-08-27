import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { capturerName } from '@/lib/capture-credit-pure';

/**
 * lib/capture-credit.ts — resolving "who took this" to a NAME.
 *
 * The gallery archetype credits every tile. The capture tables record the
 * capturer as an id (`captured_by_person_id`, stamped by a trigger since
 * 2026-08-26; `guest_id`; the seat's `claimer_user_id`) and never as a name, so
 * something has to turn ids into words.
 *
 * ── WHY THIS USES THE ADMIN CLIENT, AND THE LINE IT DOES NOT CROSS ──────────
 *
 * 🔴 THE COUPLE CANNOT READ `people` AT ALL. Measured, not assumed: its only
 * policies are `is_admin()` and *"you claimed or created this person"*. A couple
 * resolving their own paparazzo's name through their own session gets ZERO ROWS
 * — and an RLS denial is byte-identical to an empty read, so the credit would
 * have shipped permanently blank with nothing anywhere reporting a problem.
 *
 * ⚖ So the lookup runs with the service role, under one hard constraint: it
 * resolves ONLY ids the caller has already read out of rows its own gate let it
 * see, and it returns ONLY names. It cannot widen anything — you have to already
 * hold the id to get the word. Authorization reads may be service-role scoped by
 * an id resolved from the session; EVENT CONTENT never is, and a name attached to
 * an id you already hold is neither.
 *
 * ⚠ AND IT IS EMPTY IN PRODUCTION TODAY, which is not the same as broken. 32 of
 * 34 people rows have no name at all. Every rung of the ladder is tried and the
 * honest answer is usually "we do not know" — see `capture-credit-pure.ts`.
 */

export type CapturerLookup = {
  /** person_id → the name to print (already laddered), or absent when unknown. */
  byPerson: Map<string, string>;
  /** guest_id → the name to print. */
  byGuest: Map<string, string>;
  /** user_id (a seat claimer's account) → the name to print. */
  byUser: Map<string, string>;
  /**
   * Guests at this event who have asked not to be shown — `faceblock_enabled`.
   * Carries BOTH their guest id and their person id where they have one, so a
   * caller can suppress the credit whichever id it holds.
   *
   * 🔒 The wall already refuses to name a faceblocked guest as a CAPTION AUTHOR
   * (lib/live-wall.ts). Naming them as a photographer on the same screen, to the
   * same room, would be the same disclosure through a different label.
   */
  hidden: Set<string>;
};

const EMPTY: CapturerLookup = {
  byPerson: new Map(),
  byGuest: new Map(),
  byUser: new Map(),
  hidden: new Set(),
};

function ids(values: Iterable<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const v of values) if (typeof v === 'string' && v.length > 0) out.add(v);
  return [...out];
}

/**
 * Batch-resolve capturer names for ONE event.
 *
 * Never throws: a failed lookup degrades to no credits, which is the same
 * rendering as "nobody has a name yet". A gallery must not fail to draw because
 * a name query stumbled.
 */
export async function resolveCapturerNames(
  eventId: string,
  sources: {
    personIds?: Iterable<string | null | undefined>;
    guestIds?: Iterable<string | null | undefined>;
    userIds?: Iterable<string | null | undefined>;
  },
): Promise<CapturerLookup> {
  const personIds = ids(sources.personIds ?? []);
  const guestIds = ids(sources.guestIds ?? []);
  const userIds = ids(sources.userIds ?? []);
  if (personIds.length === 0 && guestIds.length === 0 && userIds.length === 0) return EMPTY;

  try {
    const admin = createAdminClient();

    // The guest read is scoped to THIS EVENT and then to the ids in hand, so a
    // guest id from another celebration resolves to nothing even if one were
    // somehow passed in.
    const guestFilter: string[] = [];
    if (guestIds.length > 0) guestFilter.push(`guest_id.in.(${guestIds.join(',')})`);
    if (personIds.length > 0) guestFilter.push(`person_id.in.(${personIds.join(',')})`);

    const [peopleRes, guestRes, userRes] = await Promise.all([
      personIds.length > 0
        ? admin
            .from('people')
            .select('person_id, display_name, first_name')
            .in('person_id', personIds)
            .is('deleted_at', null)
        : Promise.resolve({ data: [], error: null }),
      guestFilter.length > 0
        ? admin
            .from('guests')
            .select('guest_id, person_id, display_name, first_name, faceblock_enabled')
            .eq('event_id', eventId)
            .or(guestFilter.join(','))
        : Promise.resolve({ data: [], error: null }),
      userIds.length > 0
        ? admin.from('users').select('user_id, display_name').in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const guestRows = (guestRes.error ? [] : (guestRes.data ?? [])) as {
      guest_id: string;
      person_id: string | null;
      display_name: string | null;
      first_name: string | null;
      faceblock_enabled: boolean | null;
    }[];
    const peopleRows = (peopleRes.error ? [] : (peopleRes.data ?? [])) as {
      person_id: string;
      display_name: string | null;
      first_name: string | null;
    }[];
    const userRows = (userRes.error ? [] : (userRes.data ?? [])) as {
      user_id: string;
      display_name: string | null;
    }[];

    const guestByPerson = new Map<string, (typeof guestRows)[number]>();
    for (const g of guestRows) if (g.person_id) guestByPerson.set(g.person_id, g);

    const hidden = new Set<string>();
    for (const g of guestRows) {
      if (!g.faceblock_enabled) continue;
      hidden.add(g.guest_id);
      if (g.person_id) hidden.add(g.person_id);
    }

    const byPerson = new Map<string, string>();
    for (const p of peopleRows) {
      const guest = guestByPerson.get(p.person_id);
      const name = capturerName({
        personDisplay: p.display_name,
        personFirst: p.first_name,
        guestDisplay: guest?.display_name,
        guestFirst: guest?.first_name,
      });
      if (name) byPerson.set(p.person_id, name);
    }
    // A person id with no `people` row (or a nameless one) can still be known by
    // the guest list — the commonest case in production, where the spine is
    // nameless and the host typed a name onto the list.
    for (const [personId, guest] of guestByPerson) {
      if (byPerson.has(personId)) continue;
      const name = capturerName({ guestDisplay: guest.display_name, guestFirst: guest.first_name });
      if (name) byPerson.set(personId, name);
    }

    const byGuest = new Map<string, string>();
    for (const g of guestRows) {
      const name = capturerName({ guestDisplay: g.display_name, guestFirst: g.first_name });
      if (name) byGuest.set(g.guest_id, name);
    }

    const byUser = new Map<string, string>();
    for (const u of userRows) {
      const name = capturerName({ userDisplay: u.display_name });
      if (name) byUser.set(u.user_id, name);
    }

    return { byPerson, byGuest, byUser, hidden };
  } catch {
    return EMPTY;
  }
}
