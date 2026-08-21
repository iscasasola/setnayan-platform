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
 * It is also not what a host means. THREE lists in this product already hold
 * somebody's name, and all three are the same sentence — "Setnayan knows this
 * person, and they are mine":
 *
 *   · `event`   — a guest of ANOTHER event you organise. 40 rows in prod, the
 *                 only non-empty source today, and the obvious one: the same
 *                 tita is at the graduation and the anniversary.
 *   · `people`  — your connections and your alaga, the People page proper.
 *   · `samahan` — co-members of a samahan you are in.
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
 * So the event source scopes itself EXPLICITLY: the event ids come from a
 * `user_id = me AND member_type = 'couple'` read first, and the guest query is
 * `.in('event_id', thoseIds)`. RLS stays as defence in depth and is never the
 * fence. **Do not "simplify" this by dropping the `.in()`.**
 *
 * ── WHAT TRAVELS WITH A ROW, AND WHAT DELIBERATELY DOES NOT ───────────────
 * `email` is carried ONLY on an `event` row, because that address is the
 * host's own record — they typed it, on their own guest list. It matters: the
 * `guests` BEFORE-INSERT trigger resolves `person_id` from the email, so
 * re-inviting somebody by email relinks them to the same person node instead
 * of minting a stranger.
 *
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
    sort. The order below is the priority: `event` first, because its row is
    the richest we can offer — a real first/last split and, sometimes, the
    address that relinks the same person node.
  */
  const candidates: InvitableCandidate[] = [];
  const push = (c: InvitableCandidate) => candidates.push(c);

  // ── 1 · people you have already invited to your OTHER events ───────────
  {
    const { data: mine, error: mineError } = await supabase
      .from('event_members')
      .select('event_id')
      .eq('user_id', userId)
      .eq('member_type', 'couple');
    if (mineError) {
      logQueryError('getPeopleYouCanInvite.myEvents', mineError, { userId }, 'graceful_degrade');
      partial = true;
    }
    const myEventIds = [...new Set(
      ((mine ?? []) as Array<{ event_id: string }>).map((r) => r.event_id),
    )].filter((id) => id && id !== eventId);

    if (myEventIds.length > 0) {
      const [titles, rows] = await Promise.all([
        /*
          🪤 `events` HAS NO `title`. The first cut of this read asked for one,
          and the repo's own column scan caught it before it shipped. PostgREST
          rejects the WHOLE query with 42703 rather than throwing, so `.data`
          would have been null, `titleById` empty, and EVERY row in the picker
          would have said "another event" — a feature that looks finished and
          silently never worked. The event's name is `display_name`, same
          column `calendar-feed.ts` and `chat-actions.ts` read.
        */
        supabase.from('events').select('event_id, display_name').in('event_id', myEventIds),
        supabase
          .from('guests')
          .select('guest_id, first_name, last_name, email, event_id')
          // 🔒 THE EXPLICIT SCOPE. Never remove — see the RLS note above.
          .in('event_id', myEventIds)
          .is('deleted_at', null)
          .order('last_name', { ascending: true })
          .limit(500),
      ]);
      if (titles.error) {
        logQueryError('getPeopleYouCanInvite.titles', titles.error, {}, 'graceful_degrade');
        partial = true;
      }
      if (rows.error) {
        logQueryError('getPeopleYouCanInvite.guests', rows.error, {}, 'graceful_degrade');
        partial = true;
      }
      const titleById = new Map(
        (
          (titles.data ?? []) as Array<{ event_id: string; display_name: string | null }>
        ).map((e) => [e.event_id, (e.display_name ?? '').trim() || 'another event']),
      );
      for (const g of (rows.data ?? []) as Array<{
        guest_id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        event_id: string;
      }>) {
        const first = (g.first_name ?? '').trim();
        const last = (g.last_name ?? '').trim();
        if (!first && !last) continue;
        push({
          key: `event:${g.guest_id}`,
          firstName: first,
          lastName: last,
          name: `${first} ${last}`.trim(),
          source: 'event',
          from: titleById.get(g.event_id) ?? 'another event',
          email: (g.email ?? '').trim() || null,
        });
      }
    }
  }

  // ── 2 · your people — connections + alaga ──────────────────────────────
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

  // ── 3 · co-members of your samahan ─────────────────────────────────────
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
          from: m.via[0] ?? 'Your samahan',
          email: null,
        });
      }
    }
  }

  return { people: assembleInvitable(candidates, here), partial };
}
