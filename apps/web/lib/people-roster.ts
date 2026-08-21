import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { peopleConnectionsEnabled, type ConnectionRelation } from '@/lib/people-connections';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';

/**
 * people-roster.ts — ONE LIST OF EVERYONE, shaped like the guest list.
 *
 * Owner, 2026-08-21: *"we want the interface of people and guest list to be
 * similar"*, and before that: *"just add them first. Then you can set a label.
 * or a samahan, just like the guest list."*
 *
 * So this module answers the roster's question — WHO is on my page, what have I
 * called them, which samahan are they in, and where does each one stand — for
 * the two populations that were previously two disconnected boxes on the page:
 * person-connections and alaga. They merge into one sorted list because that is
 * what a roster is; the STATE column is what keeps them honestly different.
 *
 * ── FOUR STATES, AND THEY ARE NOT DECORATION ───────────────────────────────
 *   connected     both sides said yes — the only state kinship derives from
 *   waiting_them  you asked; they have not answered
 *   waiting_you   they asked YOU; the row carries Confirm / Decline
 *   in_your_care  an alaga — their profile lives inside yours
 *
 * ── WHY A NAME IS SOMETIMES THE ONE YOU TYPED ──────────────────────────────
 * `visible_connection_names` refuses to resolve a real display name TO the
 * declarer before confirmation (owner-signed rule 2026-07-05, narrowed once on
 * 2026-08-21 so the person being ASKED can see who is asking). That is correct
 * and stays. It also means an outgoing pending row has no name to render, which
 * is why the declarer's own `declared_name` exists — the roster shows the name
 * YOU gave them until the real one is allowed.
 *
 * ── RLS IS A FLOOR, NOT A SCOPE ────────────────────────────────────────────
 * The samahan read leans on ids derived from a `user_id = me` read, never on
 * `community_roster_member_read` alone — that policy carries `OR is_admin()`,
 * and production's admin is the owner's own account, so a policy-scoped read
 * would hand him every roster in the database and it would look completely
 * fine. Same defect shape as My Shop reading every other shop's corrections
 * (2026-08-12).
 *
 * ── A FAILED READ IS NOT AN EMPTY ONE ──────────────────────────────────────
 * Every optional read degrades to "unknown" and is logged; the roster renders
 * what it could prove. `samahanUnavailable` is surfaced so the page can say the
 * groups could not be loaded rather than silently drawing everybody as belonging
 * to nothing.
 */

export type RosterState = 'connected' | 'waiting_them' | 'waiting_you' | 'in_your_care';

export type RosterPerson = {
  /** Stable React key + the id an action needs. */
  key: string;
  kind: 'connection' | 'alaga';
  /** connection rows only — the id every connection action takes. */
  connectionId: string | null;
  /** alaga rows only. */
  dependentId: string | null;
  name: string;
  /** The label. NULL means "on your list, not yet said" — the whole point. */
  relation: ConnectionRelation | null;
  /** Alaga rows carry their own word ("My child"), which is not a ConnectionRelation. */
  careLabel: string | null;
  state: RosterState;
  /** Samahan this person is in, by name. Empty is a real answer; see `samahanUnavailable`. */
  samahan: string[];
  /** Only the person who made the claim may label it. */
  canLabel: boolean;
};

export type PeopleRoster = {
  people: RosterPerson[];
  /** The samahan this account can put somebody into, for the "+ Samahan" control. */
  mySamahan: Array<{ id: string; name: string }>;
  /** TRUE when the samahan read failed — the chips are unknown, not absent. */
  samahanUnavailable: boolean;
  counts: {
    all: number;
    connected: number;
    waitingThem: number;
    waitingYou: number;
    inYourCare: number;
    unlabelled: number;
  };
};

const EMPTY: PeopleRoster = {
  people: [],
  mySamahan: [],
  samahanUnavailable: false,
  counts: { all: 0, connected: 0, waitingThem: 0, waitingYou: 0, inYourCare: 0, unlabelled: 0 },
};

type ConnRow = {
  connection_id: string;
  relation: string | null;
  status: string;
  declared_name: string | null;
  from_person_id: string;
  to_person_id: string;
};

export async function getPeopleRoster(userId: string): Promise<PeopleRoster> {
  const supabase = await createClient();
  const people: RosterPerson[] = [];
  let samahanUnavailable = false;

  // ── connections ──────────────────────────────────────────────────────────
  let myPerson: string | null = null;
  if (peopleConnectionsEnabled()) {
    const { data: me, error: meError } = await supabase
      .from('people')
      .select('person_id')
      .eq('claimed_by_user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    if (meError) logQueryError('getPeopleRoster.me', meError, {}, 'graceful_degrade');
    myPerson = (me as { person_id: string } | null)?.person_id ?? null;
  }

  const personIdsToResolve: string[] = [];
  const pendingRows: ConnRow[] = [];

  if (myPerson) {
    const { data, error } = await supabase
      .from('person_connections')
      .select('connection_id, relation, status, declared_name, from_person_id, to_person_id')
      .or(`from_person_id.eq.${myPerson},to_person_id.eq.${myPerson}`)
      .is('deleted_at', null)
      .neq('status', 'declined')
      .order('created_at', { ascending: true });
    if (error) logQueryError('getPeopleRoster.connections', error, {}, 'graceful_degrade');
    for (const r of (data ?? []) as ConnRow[]) {
      pendingRows.push(r);
      personIdsToResolve.push(r.from_person_id === myPerson ? r.to_person_id : r.from_person_id);
    }
  }

  // Names, through the one function allowed to resolve them.
  const names = new Map<string, string>();
  if (personIdsToResolve.length > 0) {
    const { data, error } = await supabase.rpc('visible_connection_names', {
      p_person_ids: [...new Set(personIdsToResolve)],
    });
    if (error) logQueryError('getPeopleRoster.names', error, {}, 'graceful_degrade');
    for (const r of (data ?? []) as Array<{ person_id: string; display_name: string | null }>) {
      const label = (r.display_name ?? '').trim();
      if (label) names.set(r.person_id, label);
    }
  }

  // Their accounts, so samahan membership can be matched. Admin-read and scoped
  // to people I am already connected to; nothing about them is returned to the
  // browser beyond what the roster renders.
  const userIdByPerson = new Map<string, string>();
  if (personIdsToResolve.length > 0) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('people')
        .select('person_id, claimed_by_user_id')
        .in('person_id', [...new Set(personIdsToResolve)])
        .not('claimed_by_user_id', 'is', null);
      if (error) logQueryError('getPeopleRoster.accounts', error, {}, 'graceful_degrade');
      for (const r of (data ?? []) as Array<{ person_id: string; claimed_by_user_id: string }>) {
        userIdByPerson.set(r.person_id, r.claimed_by_user_id);
      }
    } catch {
      // An admin client that cannot be built must not empty the roster.
    }
  }

  // ── samahan: my groups, then who else is in them ─────────────────────────
  // ⚠ `community_members.community_id` is the UUID key, NOT `communities.id`
  // (which is a separate bigint). Joining on the wrong one returns an ERROR, not
  // a crash — a silently empty samahan column. Verified against production
  // before this query was written.
  const mySamahan: Array<{ id: string; name: string }> = [];
  const samahanByUser = new Map<string, string[]>();
  {
    const { data: mine, error: mineError } = await supabase
      .from('community_members')
      .select('community_id')
      .eq('user_id', userId);
    if (mineError) {
      samahanUnavailable = true;
      logQueryError('getPeopleRoster.myCommunities', mineError, {}, 'graceful_degrade');
    }
    const ids = [...new Set(((mine ?? []) as Array<{ community_id: string }>).map((m) => m.community_id))];
    if (ids.length > 0) {
      const [{ data: comms, error: commsError }, { data: members, error: membersError }] =
        await Promise.all([
          supabase.from('communities').select('community_id, name, archived').in('community_id', ids),
          supabase.from('community_members').select('community_id, user_id').in('community_id', ids),
        ]);
      if (commsError || membersError) {
        samahanUnavailable = true;
        logQueryError(
          'getPeopleRoster.samahan',
          commsError ?? membersError,
          {},
          'graceful_degrade',
        );
      }
      const nameById = new Map<string, string>();
      for (const c of (comms ?? []) as Array<{
        community_id: string;
        name: string;
        archived: boolean | null;
      }>) {
        if (c.archived) continue;
        nameById.set(c.community_id, c.name);
        mySamahan.push({ id: c.community_id, name: c.name });
      }
      for (const m of (members ?? []) as Array<{ community_id: string; user_id: string }>) {
        const label = nameById.get(m.community_id);
        if (!label || m.user_id === userId) continue;
        const list = samahanByUser.get(m.user_id) ?? [];
        list.push(label);
        samahanByUser.set(m.user_id, list);
      }
    }
  }

  for (const r of pendingRows) {
    const otherId = r.from_person_id === myPerson ? r.to_person_id : r.from_person_id;
    const iDeclared = r.from_person_id === myPerson;
    const state: RosterState =
      r.status === 'confirmed' ? 'connected' : iDeclared ? 'waiting_them' : 'waiting_you';
    const otherUser = userIdByPerson.get(otherId);
    people.push({
      key: r.connection_id,
      kind: 'connection',
      connectionId: r.connection_id,
      dependentId: null,
      // Their real name when the rule allows it; otherwise the name I typed.
      name: names.get(otherId) ?? r.declared_name?.trim() ?? 'Someone',
      relation: (r.relation as ConnectionRelation | null) ?? null,
      careLabel: null,
      state,
      samahan: (otherUser && samahanByUser.get(otherUser)) || [],
      canLabel: iDeclared,
    });
  }

  // ── alaga ────────────────────────────────────────────────────────────────
  if (dependentPeopleEnabled() && (await isDataPrivacyControlActive('dependent_minor_profiles'))) {
    const { data, error } = await supabase
      .from('dependents')
      .select('dependent_id, name, relationship, dependent_kind, handed_over_at')
      .is('handed_over_at', null)
      .order('created_at', { ascending: true });
    if (error) logQueryError('getPeopleRoster.alaga', error, {}, 'graceful_degrade');
    for (const d of (data ?? []) as Array<{
      dependent_id: string;
      name: string;
      relationship: string | null;
      dependent_kind: string | null;
    }>) {
      people.push({
        key: d.dependent_id,
        kind: 'alaga',
        connectionId: null,
        dependentId: d.dependent_id,
        name: d.name,
        relation: null,
        careLabel: careLabelFor(d.relationship, d.dependent_kind),
        state: 'in_your_care',
        samahan: [],
        canLabel: false,
      });
    }
  }

  const counts = {
    all: people.length,
    connected: people.filter((p) => p.state === 'connected').length,
    waitingThem: people.filter((p) => p.state === 'waiting_them').length,
    waitingYou: people.filter((p) => p.state === 'waiting_you').length,
    inYourCare: people.filter((p) => p.state === 'in_your_care').length,
    unlabelled: people.filter((p) => p.kind === 'connection' && p.relation === null).length,
  };

  return { people, mySamahan, samahanUnavailable, counts };
}

/** The alaga's own word, which is not one of the seven stored relations. */
function careLabelFor(relationship: string | null, kind: string | null): string {
  if (kind && kind !== 'person') {
    return kind === 'pet' ? 'Pet' : kind === 'business' ? 'Business' : 'In my care';
  }
  switch (relationship) {
    case 'child':
      return 'My child';
    case 'parent':
      return 'My parent';
    case 'grandparent':
      return 'My grandparent';
    case 'sibling':
      return 'My sibling';
    default:
      return 'In my care';
  }
}

export const EMPTY_ROSTER = EMPTY;
