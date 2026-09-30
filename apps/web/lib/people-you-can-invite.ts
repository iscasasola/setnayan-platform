import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getPeopleRoster } from '@/lib/people-roster';
import { fetchSamahanSecondDegree } from '@/lib/communities';
import { splitPersonName } from '@/lib/person-name-split';
import {
  assembleInvitable,
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
      const members = await fetchSamahanSecondDegree(supabase, admin, userId);
      for (const m of members) {
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
