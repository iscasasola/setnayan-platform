import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isPlaceholderEmail } from '@/lib/anon-onboarding';
import {
  escapeLikeQuery,
  MAX_RESULTS,
  MIN_QUERY_LENGTH,
  type PersonHit,
} from '@/lib/people-search-query';

/**
 * people-search.ts — FIND SOMEBODY BY NAME, and everything the result may not
 * carry.
 *
 * Owner, 2026-08-21: *"we can search all users of that name as well. so they can
 * also add manually instead of email address"* · *"it will show all people with
 * that name and pick the person they want to add"* · *"just like facebook."*
 *
 * ── WHAT A RESULT IS ALLOWED TO BE ─────────────────────────────────────────
 * A display name, a photo if they have one, a public id to add them by, and a
 * HINT about why you might know them ("Both at Maria & Jose", "In Barkada '08").
 * That is the whole row.
 *
 * ⛔ **NEVER** an email, a phone number, a slug, a raw `user_id`, a list of
 * their events, or anybody else's connections. `visible_connection_names`'
 * owner-signed rule of 2026-07-05 loses exactly one clause here — "never a
 * browsable directory", which the owner has now asked for by name — and keeps
 * the rest: name only, and a relationship still requires the other person to
 * confirm. Finding somebody lets you ASK them. It does nothing else.
 *
 * ── FIVE REFUSALS, AND ONLY ONE OF THEM IS A PREFERENCE ────────────────────
 *   1. `discoverable_by_name = false` — their own choice (the migration).
 *   2. No display name — nothing to match and nothing to show.
 *   3. An anonymous draft — somebody who has not even secured their account
 *      has not chosen to be anywhere. `isPlaceholderEmail` is the same test the
 *      email sender uses, so the two can never disagree about who is real.
 *   4. Yourself.
 *   5. Anybody already on your list — offering to add them twice is a bug
 *      wearing a feature's clothes.
 *
 * ── 🚨 THE ESCAPE THAT THIS CODEBASE HAS ALREADY PAID FOR ──────────────────
 * `%` and `_` are WILDCARDS in ILIKE. An unescaped `%` types a search for
 * EVERYBODY, and `_` quietly matches any character — which is precisely how the
 * admin shop-address correction could move a different shop (2026-08-12). The
 * query is escaped here, once, and a test types the characters that would prove
 * it if it were not.
 *
 * ── A SEARCH IS NOT AN ORACLE ──────────────────────────────────────────────
 * The result never says whether somebody exists but is hidden: an opted-out
 * account, a non-existent name, and a name that only anonymous drafts carry all
 * return the same empty list.
 */

export type { PersonHit };

export async function searchPeopleByName(
  rawQuery: string,
  viewerUserId: string,
): Promise<PersonHit[]> {
  const q = (rawQuery ?? '').trim().slice(0, 60);
  if (q.length < MIN_QUERY_LENGTH) return [];

  const supabase = await createClient();
  const admin = createAdminClient();

  // Who is already on my list — so nobody is offered twice. Read under MY
  // session; a failure here degrades to "offer everyone", which is a worse list
  // but never a disclosure.
  const alreadyThere = new Set<string>();
  {
    const { data: me, error: meError } = await supabase
      .from('people')
      .select('person_id')
      .eq('claimed_by_user_id', viewerUserId)
      .is('deleted_at', null)
      .maybeSingle();
    if (meError) logQueryError('searchPeopleByName.me', meError, {}, 'graceful_degrade');
    const myPerson = (me as { person_id: string } | null)?.person_id;
    if (myPerson) {
      const { data: edges } = await supabase
        .from('person_connections')
        .select('from_person_id, to_person_id')
        .or(`from_person_id.eq.${myPerson},to_person_id.eq.${myPerson}`)
        .is('deleted_at', null);
      for (const e of (edges ?? []) as Array<{ from_person_id: string; to_person_id: string }>) {
        alreadyThere.add(e.from_person_id === myPerson ? e.to_person_id : e.from_person_id);
      }
    }
  }

  // The search itself. Admin-read because another account's row is invisible
  // under `users` RLS by design — and NOTHING from this read leaves this
  // function except the four fields of PersonHit.
  const { data, error } = await admin
    .from('users')
    .select('user_id, public_id, display_name, profile_photo_url, email, discoverable_by_name')
    .ilike('display_name', `%${escapeLikeQuery(q)}%`)
    .eq('discoverable_by_name', true)
    .not('display_name', 'is', null)
    .neq('user_id', viewerUserId)
    .limit(MAX_RESULTS * 3);
  if (error) {
    logQueryError('searchPeopleByName.users', error, {}, 'graceful_degrade');
    return [];
  }

  const rows = (data ?? []) as Array<{
    user_id: string;
    public_id: string;
    display_name: string | null;
    profile_photo_url: string | null;
    email: string | null;
  }>;

  // Their person rows, to drop anybody already on my list.
  const userIds = rows.map((r) => r.user_id);
  const personByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: people } = await admin
      .from('people')
      .select('person_id, claimed_by_user_id')
      .in('claimed_by_user_id', userIds)
      .is('deleted_at', null);
    for (const p of (people ?? []) as Array<{ person_id: string; claimed_by_user_id: string }>) {
      personByUser.set(p.claimed_by_user_id, p.person_id);
    }
  }

  const keep = rows.filter((r) => {
    const name = (r.display_name ?? '').trim();
    if (!name) return false;
    if (isPlaceholderEmail(r.email ?? '')) return false;
    const person = personByUser.get(r.user_id);
    if (person && alreadyThere.has(person)) return false;
    return true;
  });

  const hints = await mutualHints(
    viewerUserId,
    keep.map((r) => r.user_id),
  );

  return keep.slice(0, MAX_RESULTS).map((r) => ({
    publicId: r.public_id,
    name: (r.display_name ?? '').trim(),
    photoUrl: r.profile_photo_url,
    hint: hints.get(r.user_id) ?? null,
  }));
}

/**
 * "Why you might know them" — the one thing that makes a list of strangers
 * usable, and the reason Facebook shows mutual friends.
 *
 * 🔒 IT ONLY EVER NAMES SOMETHING BOTH OF YOU ARE ALREADY IN. A samahan the
 * viewer belongs to, or an event they are both members of. It never counts
 * connections (that would leak somebody's tree), never names an event the
 * viewer is not in, and returns null rather than guessing.
 */
async function mutualHints(
  viewerUserId: string,
  otherUserIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (otherUserIds.length === 0) return out;
  const supabase = await createClient();

  // Samahan: my groups first (scoped by a `user_id = me` read — RLS on the
  // roster also admits is_admin(), and prod's admin is the owner's own
  // account), then who among the hits is in them.
  const { data: mine } = await supabase
    .from('community_members')
    .select('community_id')
    .eq('user_id', viewerUserId);
  const myCommunityIds = [
    ...new Set(((mine ?? []) as Array<{ community_id: string }>).map((m) => m.community_id)),
  ];
  if (myCommunityIds.length > 0) {
    const [{ data: names }, { data: members }] = await Promise.all([
      supabase.from('communities').select('community_id, name').in('community_id', myCommunityIds),
      supabase
        .from('community_members')
        .select('community_id, user_id')
        .in('community_id', myCommunityIds)
        .in('user_id', otherUserIds),
    ]);
    const nameById = new Map(
      ((names ?? []) as Array<{ community_id: string; name: string }>).map((c) => [
        c.community_id,
        c.name,
      ]),
    );
    for (const m of (members ?? []) as Array<{ community_id: string; user_id: string }>) {
      const label = nameById.get(m.community_id);
      if (label && !out.has(m.user_id)) out.set(m.user_id, `In ${label}`);
    }
  }

  // Events: only ones I am a member of, and only to say that they are too.
  const stillUnhinted = otherUserIds.filter((id) => !out.has(id));
  if (stillUnhinted.length > 0) {
    const { data: myEvents } = await supabase
      .from('event_members')
      .select('event_id')
      .eq('user_id', viewerUserId);
    const myEventIds = [
      ...new Set(((myEvents ?? []) as Array<{ event_id: string }>).map((e) => e.event_id)),
    ];
    if (myEventIds.length > 0) {
      const admin = createAdminClient();
      // Admin-read, scoped to events the viewer is already IN — the same
      // membership list they can read themselves; the elevation is only to see
      // the other party's row on it.
      const [{ data: shared }, { data: eventNames }] = await Promise.all([
        admin
          .from('event_members')
          .select('event_id, user_id')
          .in('event_id', myEventIds)
          .in('user_id', stillUnhinted),
        admin.from('events').select('event_id, display_name').in('event_id', myEventIds),
      ]);
      const titleById = new Map(
        ((eventNames ?? []) as Array<{ event_id: string; display_name: string | null }>).map((e) => [
          e.event_id,
          (e.display_name ?? '').trim(),
        ]),
      );
      for (const s of (shared ?? []) as Array<{ event_id: string; user_id: string }>) {
        const title = titleById.get(s.event_id);
        if (title && !out.has(s.user_id)) out.set(s.user_id, `Both at ${title}`);
      }
    }
  }

  return out;
}
