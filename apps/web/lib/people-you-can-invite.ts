import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getPeopleRoster, ROSTER_UNNAMED } from '@/lib/people-roster';
import { fetchSamahanSecondDegree } from '@/lib/communities';
import { splitPersonName } from '@/lib/person-name-split';
import {
  assembleInvitable,
  isInvitableRosterEntry,
  nameKey,
  type InvitableCandidate,
  type InvitablePerson,
  type InvitableSource,
} from '@/lib/people-you-can-invite-core';

/**
 * people-you-can-invite.ts — THE GUEST LIST STOPS ASKING YOU TO RETYPE PEOPLE
 * SETNAYAN ALREADY KNOWS.
 *
 * Owner, 2026-08-21, on the add row: *"we want them to be able to add people
 * from the people's list as well and not just names."*
 *
 * ── WHAT "THE PEOPLE'S LIST" IS, MEASURED ─────────────────────────────────
 * Taken literally it is `/dashboard/people`, and on the day this was asked
 * production held **0 connections, 0 alaga and 0 samahan members** — so a
 * picker fed only from that page would have opened empty for the person who
 * asked for it, and read as broken rather than as new.
 *
 * Two lists hold somebody the host is CONNECTED to — "Setnayan knows this
 * person, and they are mine":
 *
 *   · `people`  — your connections and your alaga (your beloved: dependents
 *                 and valuables), the People page proper.
 *   · `samahan` — co-members of a samahan you are in.
 *
 * ⛔ A third, `event` (guests of ANOTHER event you organise), was offered from
 * 2026-08-21 and REMOVED 2026-09-30 by the owner: *"i should only see the
 * people that are connected to me. not the guest from events."* Being on some
 * other couple's list is not a connection. Do not bring it back.
 *
 * They merge into ONE list because that is what the host is looking for; the
 * `from` line on each row is what keeps them honestly different.
 *
 * ── 🚨 RLS IS A FLOOR, NOT A SCOPE — AND HERE IT IS THE WHOLE RISK ─────────
 * `guests` carries `couple_writes_guest`:
 *
 *     (event_id IN (SELECT current_couple_event_ids())) OR is_admin()
 *
 * **Production's admin is the owner's own account.** A read that leaned on
 * that policy would have handed him EVERY GUEST OF EVERY EVENT IN THE
 * DATABASE, in a picker whose whole job is to offer names to add to a wedding
 * — and it would have looked completely fine, because he has events of his
 * own for the rows to hide among. Same defect that made My Shop read every
 * other shop's correction requests (2026-08-12) and the same one
 * `your-people.ts` was written around.
 *
 * The only `guests` read left here is THIS event's own list (`.eq('event_id',
 * eventId)`, for "already here"). No other guest query belongs in this file —
 * `add-from-people-is-scoped.test.ts` fails if one comes back.
 *
 * ── WHAT TRAVELS WITH A ROW, AND WHAT DELIBERATELY DOES NOT ───────────────
 * `people` and `samahan` rows carry **NO email**. The roster never exposes one
 * to the client, `proposeSamahanConnection`'s own note says *"emails never
 * leave the server"*, and a co-member's address is not the host's to hold just
 * because they share a group. A name is enough to put somebody on a list.
 *
 * ⛔ **NOTHING HERE EVER RETURNS AN AUTH UUID OR A `person_id`.** The insert
 * path must not let a host name a person node — that is a claim about somebody
 * else's identity, and the trigger already makes it from the email when it is
 * legitimately there. Same reasoning as the `row is yours, the field is not`
 * family.
 *
 * ── A FAILED READ IS NOT AN EMPTY ONE ─────────────────────────────────────
 * Every source degrades on its own and sets `partial`, so the sheet can say
 * the list is short rather than draw a confident, wrong "that's everybody".
 */

export type { InvitableSource, InvitablePerson };

export type InvitablePeople = {
  people: InvitablePerson[];
  /** TRUE when at least one source was refused — the list is short, not whole. */
  partial: boolean;
};

const EMPTY: InvitablePeople = { people: [], partial: false };

export async function getPeopleYouCanInvite(
  eventId: string,
  userId: string,
): Promise<InvitablePeople> {
  if (!eventId || !userId) return EMPTY;

  const supabase = await createClient();
  let partial = false;

  // ── who is already on THIS list ────────────────────────────────────────
  // Read first: a name we already have is shown as "already here" rather than
  // hidden, so a host who cannot find somebody learns why.
  const here = new Set<string>();
  {
    const { data, error } = await supabase
      .from('guests')
      .select('first_name, last_name')
      .eq('event_id', eventId)
      .is('deleted_at', null);
    if (error) {
      logQueryError('getPeopleYouCanInvite.here', error, { eventId }, 'graceful_degrade');
      partial = true;
    }
    for (const g of (data ?? []) as Array<{ first_name: string; last_name: string }>) {
      here.add(nameKey(g.first_name ?? '', g.last_name ?? ''));
    }
  }

  /*
    Collected in SOURCE-PRIORITY ORDER and merged at the end by
    `assembleInvitable`, which owns de-duplication, the email rule and the
    sort. The order below is the priority.
  */
  const candidates: InvitableCandidate[] = [];
  const push = (c: InvitableCandidate) => candidates.push(c);

  // ⛔ NO GUESTS FROM YOUR OTHER EVENTS (owner 2026-09-30: *"when adding
  // people. i should only see the people that are connected to me. not the
  // guest from events. only connected people, samahan … and my beloved"*).
  // The `event` source (2026-08-21) filled this sheet with every guest of every
  // other event the host organises — 34 "Maria & Jose" names in front of the
  // one person they actually know. A guest of another event is on THAT couple's
  // list, not in the host's people; only a connection makes them theirs.

  // ── 1 · your people — connections + alaga (your beloved) ───────────────
  // `getPeopleRoster` owns the flags, the name-visibility rule and its own
  // graceful degradation; this only reshapes what it returns.
  {
    const roster = await getPeopleRoster(userId);
    if (roster.samahanUnavailable) partial = true;
    for (const p of roster.people) {
      // ⚖ Owner 2026-09-30: "business and pets and gadgets are not people. so
      // not allowed to be invited". A loved one is offered only when it IS a
      // person; `dependent_kind` NOT NULL DEFAULT 'person'.
      if (!isInvitableRosterEntry(p)) continue;
      // 🔒 ONLY ACCEPTED CONNECTIONS (walk 13 Nov 2026, F-W3-20 — privacy): a request nobody has answered is not "your
      // people". Indalecio, whose connect request was still pending, was offered as a guest. Loved ones have no
      // request to accept and stay.
      if (p.kind === 'connection' && p.state !== 'connected') continue;
      // 🪪 THE ROSTER'S "Someone" IS A PLACEHOLDER, NOT A NAME (F-W3-22): a connection whose name the rule does not show
      // reads "Someone" on People — taken as a first name here, it made a guest literally called "Someone".
      if (p.name === ROSTER_UNNAMED) continue;
      const { first, last } = splitPersonName(p.name);
      if (!first) continue;
      push({
        key: `people:${p.key}`,
        firstName: first,
        lastName: last,
        name: p.name,
        source: 'people',
        from: p.kind === 'alaga' ? (p.careLabel ?? 'In your care') : 'Your people',
        email: null,
      });
    }
  }

  // ── 2 · co-members of your samahan ─────────────────────────────────────
  {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      admin = null;
    }
    if (admin) {
      // 👥 ONE ROW PER PERSON (F-W3-20): a group co-member who is ALSO an accepted connection is already offered above
      // as "Your people" — `known` marks them, and they are not listed a second time under the group.
      const confirmed = await confirmedConnectionUserIds(supabase, admin, userId);
      const members = await fetchSamahanSecondDegree(supabase, admin, userId, confirmed);
      for (const m of members) {
        if (m.known) continue;
        const { first, last } = splitPersonName(m.display_name);
        if (!first) continue;
        push({
          key: `samahan:${m.member_row_id}`,
          firstName: first,
          lastName: last,
          name: m.display_name,
          source: 'samahan',
          from: m.via[0] ?? 'Your group',
          email: null,
          // The `from` line shows one; the FILTER needs all of them — a person
          // in two of your samahans belongs to both chips, and the alphabetical
          // first is not a membership fact.
          groups: m.via,
        });
      }
    }
  }

  return { people: assembleInvitable(candidates, here), partial };
}

/**
 * The accounts this person has an ACCEPTED connection with — so a group co-member already offered as "Your people" is
 * not offered twice (F-W3-20). The same two reads as the People page's samahan section (`fetchKnownConnectionUserIds`),
 * narrowed to `status = 'confirmed'`. A refused read is an empty set: the person is then listed under both, which is
 * the old behaviour, never a hidden guest.
 */
async function confirmedConnectionUserIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<Set<string>> {
  const out = new Set<string>();
  const { data: me, error: meError } = await supabase
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (meError) logQueryError('peopleYouCanInvite.me', meError, {}, 'graceful_degrade');
  const myPerson = (me as { person_id: string } | null)?.person_id;
  if (!myPerson) return out;
  const { data: edges, error: edgesError } = await supabase
    .from('person_connections')
    .select('from_person_id, to_person_id')
    .or(`from_person_id.eq.${myPerson},to_person_id.eq.${myPerson}`)
    .is('deleted_at', null)
    .eq('status', 'confirmed');
  if (edgesError) logQueryError('peopleYouCanInvite.edges', edgesError, {}, 'graceful_degrade');
  const others = [
    ...new Set(
      ((edges ?? []) as Array<{ from_person_id: string; to_person_id: string }>).map((e) =>
        e.from_person_id === myPerson ? e.to_person_id : e.from_person_id,
      ),
    ),
  ];
  if (others.length === 0) return out;
  const { data: rows, error } = await admin
    .from('people')
    .select('claimed_by_user_id')
    .in('person_id', others)
    .not('claimed_by_user_id', 'is', null);
  if (error) logQueryError('peopleYouCanInvite.people', error, {}, 'graceful_degrade');
  for (const r of (rows ?? []) as Array<{ claimed_by_user_id: string | null }>) {
    if (r.claimed_by_user_id) out.add(r.claimed_by_user_id);
  }
  return out;
}
