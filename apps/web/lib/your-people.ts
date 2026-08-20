import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { peopleConnectionsEnabled } from '@/lib/people-connections';

/**
 * your-people.ts — WHICH PUBLIC STORIES ON THE FRONT DOOR WERE WRITTEN BY
 * SOMEBODY THE VIEWER ALREADY KNOWS.
 *
 * Owner 2026-08-20, on the front door's chip row: *"view all events around the
 * people you are with"*, and — asked what to call it, having rejected his own
 * word — *"your people - yes"*.
 *
 * ─── THE ONE PROPERTY THAT MAKES THIS SAFE ───────────────────────────────
 * **THIS NARROWS AN ALREADY-PUBLIC SHELF. IT NEVER FETCHES A STORY.** The
 * caller has already loaded the pieces every stranger sees; this module only
 * answers "and which of those were written by one of your people?" A bug here
 * can hide a public story from its own author's friend. It cannot surface a
 * private one, because no query in this file reads a story at all.
 *
 * Keep that property. The moment this module is asked to LOAD something, the
 * reasoning below stops holding and the privacy review starts again.
 *
 * ─── 🚨 RLS IS A FLOOR, NOT A SCOPE — AND HERE IT WOULD HAVE BEEN THE BUG ──
 * Both policies this file's reads sit behind carry a SECOND DISJUNCT:
 *
 *   member_reads_membership      user_id = auth.uid()
 *                                OR event_id IN current_couple_event_ids()
 *                                OR is_admin()
 *   community_roster_member_read community_id IN current_community_ids()
 *                                OR is_admin()
 *
 * **Production has a vendor who IS an admin — the owner's own account.** So a
 * read that leaned on RLS to scope it would have handed him EVERY event
 * membership and EVERY samahan roster in the database, and "Your people" would
 * have meant "everybody" for exactly one person: the one who asked for it, on
 * the account he tests with. Silent, and it looks completely fine.
 *
 * This is the same defect that made My Shop read every OTHER shop's correction
 * requests (2026-08-12) — same shape, same `OR is_admin()`, same account. So
 * **every query below scopes itself explicitly** by ids derived from a
 * `user_id = me` read. RLS stays as defence-in-depth and is never the fence.
 *
 * ─── WHO COUNTS, AND THE ONE GROUP DELIBERATELY LEFT OUT ─────────────────
 * Only people the viewer CAN ALREADY SEE:
 *
 *   1 · co-members of events the viewer ORGANISES (`member_type = 'couple'`) —
 *       they already read that whole member list;
 *   2 · co-members of the viewer's samahans — any member may already read the
 *       full roster (`community_roster_member_read`);
 *   3 · confirmed person-connections — mutual by construction, and only when
 *       `peopleConnectionsEnabled()` is on (Phase 2, still counsel-gated).
 *
 * ⛔ **NOT the other guests at an event the viewer merely ATTENDS.** A guest
 * cannot read that member list — `member_reads_membership` gives them their own
 * row and nothing else — so counting those people would let a guest infer that
 * a stranger is also attending, from a chip. That is a disclosure the product
 * does not make anywhere else, and widening it is an owner/DPO call, not a
 * filtering convenience. **Do not "fix" this by reaching for the admin client:
 * the omission is the decision.**
 *
 * The admin client IS used, for one thing only — turning ids the viewer is
 * already entitled to into PUBLIC PROFILE SLUGS. Same posture as
 * `fetchSamahanSecondDegree`: entitlement decided by a user-client read,
 * lookup done with admin, and **no auth UUID is ever returned.**
 */

export type YourPeople = {
  /**
   * Public profile slugs of people the viewer already shares something with.
   * Slugs, never UUIDs — this value is compared against `FrontDoorStory.
   * ownerSlug`, which is public by construction.
   */
  slugs: ReadonlySet<string>;
  /**
   * `false` when a read FAILED. Distinct from an empty set, which means "we
   * looked and you have nobody yet".
   *
   * 🔑 THE CALLER MUST TELL THESE APART. Prod on 2026-08-20 held 9 accounts,
   * 9 events with exactly ONE member each, zero samahans and zero connections
   * — so the empty set is the NORMAL answer today, and it must read as a
   * written invitation. A failed read wearing the same face would tell a
   * person with twenty friends that they have none.
   */
  ok: boolean;
};

const NOBODY: YourPeople = { slugs: new Set(), ok: true };
const UNREADABLE: YourPeople = { slugs: new Set(), ok: false };

/** Rows are ids the viewer is already entitled to; caps keep one huge samahan
 *  from turning a front-page render into an unbounded read. */
const MAX_SCOPES = 200;
const MAX_PEOPLE = 2000;

/**
 * The viewer's people, as public profile slugs.
 *
 * Signed out returns `NOBODY` on the first line — a stranger has no people,
 * and that is not a failure.
 *
 * ⚠ EVERY READ CHECKS `error` EXPLICITLY. A rejected query is not a thrown
 * error: Supabase resolves with `{ data: null, error }`, so a phantom column
 * or a missing grant returns quietly and a `catch` never runs. Each failure
 * below returns `UNREADABLE` rather than collapsing into "you have nobody".
 */
export async function loadYourPeople(): Promise<YourPeople> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NOBODY;

    const me = user.id;

    // ── 1 · the scopes the viewer is entitled to, read as THEIR OWN rows ──
    const [myEvents, myCommunities] = await Promise.all([
      supabase
        .from('event_members')
        .select('event_id')
        // `member_type = 'couple'` is what `current_couple_event_ids()` means
        // by an organiser — matched here rather than trusted from the policy.
        .eq('user_id', me)
        .eq('member_type', 'couple')
        .is('hidden_at', null)
        .limit(MAX_SCOPES),
      supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', me)
        .limit(MAX_SCOPES),
    ]);

    if (myEvents.error) {
      logQueryError('loadYourPeople.myEvents', myEvents.error, {}, 'graceful_degrade');
      return UNREADABLE;
    }
    if (myCommunities.error) {
      logQueryError('loadYourPeople.myCommunities', myCommunities.error, {}, 'graceful_degrade');
      return UNREADABLE;
    }

    const eventIds = [
      ...new Set((myEvents.data ?? []).map((r) => (r as { event_id: string }).event_id)),
    ];
    const communityIds = [
      ...new Set(
        (myCommunities.data ?? []).map((r) => (r as { community_id: string }).community_id),
      ),
    ];

    // ── 2 · the other people inside those scopes, EXPLICITLY scoped ───────
    const userIds = new Set<string>();

    const [eventPeople, samahanPeople] = await Promise.all([
      eventIds.length > 0
        ? supabase
            .from('event_members')
            .select('user_id')
            // `.in(...)` on ids derived above — NOT a bare read trusting RLS.
            .in('event_id', eventIds)
            .is('hidden_at', null)
            .limit(MAX_PEOPLE)
        : null,
      communityIds.length > 0
        ? supabase
            .from('community_members')
            .select('user_id')
            .in('community_id', communityIds)
            .limit(MAX_PEOPLE)
        : null,
    ]);

    if (eventPeople?.error) {
      logQueryError('loadYourPeople.eventPeople', eventPeople.error, {}, 'graceful_degrade');
      return UNREADABLE;
    }
    if (samahanPeople?.error) {
      logQueryError('loadYourPeople.samahanPeople', samahanPeople.error, {}, 'graceful_degrade');
      return UNREADABLE;
    }

    for (const r of (eventPeople?.data ?? []) as Array<{ user_id: string | null }>) {
      if (r.user_id && r.user_id !== me) userIds.add(r.user_id);
    }
    for (const r of (samahanPeople?.data ?? []) as Array<{ user_id: string | null }>) {
      if (r.user_id && r.user_id !== me) userIds.add(r.user_id);
    }

    // ── 3 · confirmed connections, only behind their own flag ────────────
    if (peopleConnectionsEnabled()) {
      const connected = await confirmedConnectionUserIds(supabase, me);
      if (connected === null) return UNREADABLE;
      for (const id of connected) if (id !== me) userIds.add(id);
    }

    if (userIds.size === 0) return NOBODY;

    // ── 4 · ids → PUBLIC slugs. The only admin read, and it can only shrink
    //        the set: a person with no public page has no story on this shelf.
    const admin = createAdminClient();
    const { data: profiles, error: profileErr } = await admin
      .from('users')
      .select('slug, public_profile_enabled, deleted_at')
      .in('user_id', [...userIds])
      .eq('public_profile_enabled', true)
      .is('deleted_at', null);

    if (profileErr) {
      logQueryError('loadYourPeople.profiles', profileErr, {}, 'graceful_degrade');
      return UNREADABLE;
    }

    const slugs = new Set<string>();
    for (const r of (profiles ?? []) as Array<{ slug: string | null }>) {
      const s = (r.slug ?? '').trim();
      if (s) slugs.add(s);
    }
    return { slugs, ok: true };
  } catch (e) {
    // Reached only by a genuine throw (a broken client, not a rejected query).
    logQueryError('loadYourPeople', e, {}, 'graceful_degrade');
    return UNREADABLE;
  }
}

/**
 * User ids behind CONFIRMED person-connections, or `null` when a read failed.
 *
 * ⚠ `person_connections` is keyed on `people.person_id`, NOT on `user_id` —
 * two hops, and skipping the first is how this would silently match nothing.
 * Only `status = 'confirmed'` counts: a pending edge is one person's claim
 * about a relationship the other has not agreed to.
 */
async function confirmedConnectionUserIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  me: string,
): Promise<string[] | null> {
  const { data: mine, error: meErr } = await supabase
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', me)
    .is('deleted_at', null)
    .maybeSingle();
  if (meErr) {
    logQueryError('loadYourPeople.myPerson', meErr, {}, 'graceful_degrade');
    return null;
  }
  const myPerson = (mine as { person_id: string } | null)?.person_id;
  if (!myPerson) return [];

  const { data: edges, error: edgeErr } = await supabase
    .from('person_connections')
    .select('from_person_id, to_person_id')
    .or(`from_person_id.eq.${myPerson},to_person_id.eq.${myPerson}`)
    .eq('status', 'confirmed')
    .is('deleted_at', null)
    .limit(MAX_PEOPLE);
  if (edgeErr) {
    logQueryError('loadYourPeople.connections', edgeErr, {}, 'graceful_degrade');
    return null;
  }

  const otherPersonIds = [
    ...new Set(
      (edges ?? [])
        .map((e) => {
          const r = e as { from_person_id: string; to_person_id: string };
          return r.from_person_id === myPerson ? r.to_person_id : r.from_person_id;
        })
        .filter(Boolean),
    ),
  ];
  if (otherPersonIds.length === 0) return [];

  const { data: claimed, error: claimErr } = await supabase
    .from('people')
    .select('claimed_by_user_id')
    .in('person_id', otherPersonIds)
    .is('deleted_at', null);
  if (claimErr) {
    logQueryError('loadYourPeople.claimed', claimErr, {}, 'graceful_degrade');
    return null;
  }

  return (claimed ?? [])
    .map((r) => (r as { claimed_by_user_id: string | null }).claimed_by_user_id)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}
