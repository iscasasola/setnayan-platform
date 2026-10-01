import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  CONNECTION_RELATIONS,
  peopleConnectionsEnabled,
  relationForViewer,
  type ConnectionRelation,
} from '@/lib/people-connections';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { lovedOnesInMyCare, myLovedOnes, spouseIdSet } from '@/lib/my-loved-ones';
import { labelAskFor, type LabelAsk } from '@/lib/people-label-handshake';

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
 *   waiting_you   they asked YOU; the row carries Accept / Decline
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
 * to nothing — and `connectionsUnavailable` (2026-09-28) does the same for the
 * list itself: a refused read used to print "Nobody here yet. Add the first
 * person above", byte-identical to a brand-new account (the #4579–#4585
 * disease). The page RENDERS it; a log line never changed a pixel.
 *
 * ── ALAGA LEFT THE PEOPLE LIST (owner 2026-09-28, People redesign) ────────
 * One alaga was drawn three times on one page — a roster row wearing four
 * labels ("You hold this", "in your care", "In your care · alaga", "My child"),
 * the card, and the rail's row. The Alaga VIEW owns them now
 * (`dependents-section.tsx`), so `people-roster-view.tsx` no longer draws them.
 * ⚠ THEY STAY IN THIS RESULT: the guest list's "Add from people" sheet
 * (`lib/people-you-can-invite.ts`) reads alaga rows from here to offer a child
 * or an elder as a guest. Dropping them HERE would have deleted that quietly.
 *
 * ── A REQUEST SAYS WHERE IT CAME FROM ──────────────────────────────────────
 * Owner: *"{name} is trying to add you from your {event} event · Accept /
 * Decline"*. The event is `person_connections.created_by_event_id`, and its
 * name is read through `connection_request_events()` under the reader's own
 * session — never `events` (`authenticated` is denied columns on the base
 * table). That function answers only the RECIPIENT of a pending request, only
 * with the event's name and kind, and only when they are a celebrant of it or
 * host it (owner 2026-09-28: a request from an event always names the event,
 * co-host or not). The database also refuses a request that names an event its
 * sender is not at — migration 20271253740454.
 */

export type RosterState = 'connected' | 'waiting_them' | 'waiting_you' | 'in_your_care';

export type { LabelAsk } from '@/lib/people-label-handshake';

export type RosterPerson = {
  /** Stable React key + the id an action needs. */
  key: string;
  kind: 'connection' | 'alaga';
  /** connection rows only — the id every connection action takes. */
  connectionId: string | null;
  /** alaga rows only. */
  dependentId: string | null;
  /** alaga rows only: `dependents.dependent_kind` ('person' · 'pet' · 'business'
   *  · 'item' · 'other'). What the guest-list picker filters on: only a person
   *  may be invited (owner 2026-09-30). Absent on connection rows. */
  dependentKind?: string | null;
  name: string;
  /**
   * The label, as it reads FROM MY SIDE — what they are to me. NULL means "on
   * your list, not yet said". On a row somebody else made, the stored word is
   * turned over (they said I am their Parent → they are my Child); showing the
   * stored word raw would call a daughter "Parent".
   */
  relation: ConnectionRelation | null;
  /** The label as STORED — what the other side of the row said. Only a request
   *  I am answering needs it ("Ice added you as their Sibling"). */
  storedRelation: ConnectionRelation | null;
  /** A label being asked on a connected row — see LabelAsk. */
  ask: LabelAsk | null;
  /** Partner rows only: do the two of us already share an event? NULL = not
   *  read, or not a partner row. Decides "Plan an event together". */
  sharesAnEvent: boolean | null;
  /** Alaga rows carry their own word ("My child"), which is not a ConnectionRelation. */
  careLabel: string | null;
  state: RosterState;
  /** A request made from one of YOUR events — its name and kind, for "…is
   *  trying to add you from your {name} {type} event". Null = a plain request,
   *  or an event you do not host (the name is then never shown). */
  fromEvent: { name: string; type: string } | null;
  /** Samahan this person is in, by name. Empty is a real answer; see `samahanUnavailable`. */
  samahan: string[];
  /** Only the person who made the claim may label it. */
  canLabel: boolean;
};

export type PeopleRoster = {
  people: RosterPerson[];
  /** The samahan this account can INVITE somebody into — organiser-only, because
   *  the standing invite link is organiser-only by RLS. See the note in the
   *  "+ Samahan" action: nobody is ever put into a samahan, they are asked. */
  mySamahan: Array<{ id: string; name: string }>;
  /** TRUE when the samahan read failed — the chips are unknown, not absent. */
  samahanUnavailable: boolean;
  /** TRUE when the list itself could not be read — "we couldn't load", never
   *  "nobody here yet". */
  connectionsUnavailable: boolean;
  counts: {
    /** Connection rows (alaga are counted on their own, below). */
    all: number;
    connected: number;
    waitingThem: number;
    waitingYou: number;
    /** Labels waiting on MY answer — part of the Requests count. */
    labelAsksForYou: number;
    unlabelled: number;
    /** Alaga in your care — the Alaga view's count. Null = could not be read. */
    alaga: number | null;
    /** Samahan you are in — the Samahan view's count. Null = could not be read. */
    samahan: number | null;
  };
};

const EMPTY: PeopleRoster = {
  people: [],
  mySamahan: [],
  samahanUnavailable: false,
  connectionsUnavailable: false,
  counts: {
    all: 0,
    connected: 0,
    waitingThem: 0,
    waitingYou: 0,
    labelAsksForYou: 0,
    unlabelled: 0,
    alaga: 0,
    samahan: 0,
  },
};

type ConnRow = {
  connection_id: string;
  relation: string | null;
  proposed_relation: string | null;
  proposed_status: string | null;
  status: string;
  declared_name: string | null;
  from_person_id: string;
  to_person_id: string;
  created_by_event_id: string | null;
};

export async function getPeopleRoster(userId: string): Promise<PeopleRoster> {
  const supabase = await createClient();
  const people: RosterPerson[] = [];
  let samahanUnavailable = false;
  let connectionsUnavailable = false;

  // ── connections ──────────────────────────────────────────────────────────
  let myPerson: string | null = null;
  if (peopleConnectionsEnabled()) {
    const { data: me, error: meError } = await supabase
      .from('people')
      .select('person_id')
      .eq('claimed_by_user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    if (meError) {
      connectionsUnavailable = true;
      logQueryError('getPeopleRoster.me', meError, {}, 'graceful_degrade');
    }
    myPerson = (me as { person_id: string } | null)?.person_id ?? null;
  }

  const personIdsToResolve: string[] = [];
  const pendingRows: ConnRow[] = [];

  if (myPerson) {
    const { data, error } = await supabase
      .from('person_connections')
      .select(
        'connection_id, relation, proposed_relation, proposed_status, status, declared_name, from_person_id, to_person_id, created_by_event_id',
      )
      .or(`from_person_id.eq.${myPerson},to_person_id.eq.${myPerson}`)
      .is('deleted_at', null)
      .neq('status', 'declined')
      .order('created_at', { ascending: true });
    if (error) {
      connectionsUnavailable = true;
      logQueryError('getPeopleRoster.connections', error, {}, 'graceful_degrade');
    }
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
    if (error) {
      connectionsUnavailable = true;
      logQueryError('getPeopleRoster.names', error, {}, 'graceful_degrade');
    }
    for (const r of (data ?? []) as Array<{ person_id: string; display_name: string | null }>) {
      const label = (r.display_name ?? '').trim();
      if (label) names.set(r.person_id, label);
    }
  }

  // The events requests came FROM — only those asking ME, through the one
  // narrow door (`connection_request_events`, migration 20271253740454): the
  // event's name and kind, for a pending request addressed to me, when I am a
  // celebrant of that event or host it. Owner 2026-09-28: "a connection request
  // from an event always names the event" — co-host or not, which `events_host`
  // (hosts only) could not do. A refusal, or nothing returned, leaves the plain
  // request copy, which is still true: somebody is trying to add you.
  const eventByConnection = new Map<string, { name: string; type: string }>();
  const askedFromAnEvent = pendingRows.some(
    (r) => r.status === 'pending' && r.to_person_id === myPerson && r.created_by_event_id,
  );
  if (askedFromAnEvent) {
    const { data, error } = await supabase.rpc('connection_request_events');
    if (error) logQueryError('getPeopleRoster.fromEvents', error, {}, 'graceful_degrade');
    for (const e of (data ?? []) as Array<{
      connection_id: string;
      event_name: string | null;
      event_type: string | null;
    }>) {
      const name = (e.event_name ?? '').trim();
      if (name) eventByConnection.set(e.connection_id, { name, type: e.event_type ?? '' });
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
  let samahanCount = 0;
  {
    const { data: mine, error: mineError } = await supabase
      .from('community_members')
      .select('community_id, role')
      .eq('user_id', userId);
    if (mineError) {
      samahanUnavailable = true;
      logQueryError('getPeopleRoster.myCommunities', mineError, {}, 'graceful_degrade');
    }
    const myRows = (mine ?? []) as Array<{ community_id: string; role: string | null }>;
    const ids = [...new Set(myRows.map((m) => m.community_id))];
    // Only the ones I ORGANISE can carry an invitation — `invite_tokens_organizer_all`
    // is the policy that decides it, so anything else would render a control
    // whose action the database refuses.
    const organiserIds = new Set(
      myRows.filter((m) => m.role === 'organizer').map((m) => m.community_id),
    );
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
        if (organiserIds.has(c.community_id)) {
          mySamahan.push({ id: c.community_id, name: c.name });
        }
      }
      samahanCount = nameById.size;
      for (const m of (members ?? []) as Array<{ community_id: string; user_id: string }>) {
        const label = nameById.get(m.community_id);
        if (!label || m.user_id === userId) continue;
        const list = samahanByUser.get(m.user_id) ?? [];
        list.push(label);
        samahanByUser.set(m.user_id, list);
      }
    }
  }

  // ── partners: do we already share an event? ───────────────────────────────
  // Only for an AGREED partner row, and only to decide one line ("Plan an
  // event together"). Admin-read, scoped to exactly the two accounts, and
  // nothing but a boolean leaves this function. A refused read leaves NULL,
  // which holds the line back rather than offering a door they may have used.
  const sharedEventByPerson = new Map<string, boolean | null>();
  {
    const partnerRows = pendingRows.filter(
      (r) => r.status === 'confirmed' && r.relation === 'partner',
    );
    for (const r of partnerRows) {
      const otherId = r.from_person_id === myPerson ? r.to_person_id : r.from_person_id;
      const otherUser = userIdByPerson.get(otherId);
      if (!otherUser) {
        sharedEventByPerson.set(otherId, null);
        continue;
      }
      sharedEventByPerson.set(otherId, await shareAnEvent(userId, otherUser));
    }
  }

  for (const r of pendingRows) {
    const otherId = r.from_person_id === myPerson ? r.to_person_id : r.from_person_id;
    const iDeclared = r.from_person_id === myPerson;
    const state: RosterState =
      r.status === 'confirmed' ? 'connected' : iDeclared ? 'waiting_them' : 'waiting_you';
    const otherUser = userIdByPerson.get(otherId);
    const stored = asRelation(r.relation);
    const ask: LabelAsk | null = labelAskFor(r, iDeclared);
    people.push({
      key: r.connection_id,
      kind: 'connection',
      connectionId: r.connection_id,
      dependentId: null,
      // Their real name when the rule allows it; otherwise, on a row I made, the
      // name I typed. ⚠ NEVER `declared_name` on a row somebody else made: that
      // is the name THEY typed for ME, and printing it as theirs would show me
      // my own name on their request.
      name: names.get(otherId) ?? (iDeclared ? r.declared_name?.trim() : null) ?? 'Someone',
      relation: relationForViewer(stored, iDeclared),
      storedRelation: stored,
      ask,
      sharesAnEvent:
        r.status === 'confirmed' && stored === 'partner'
          ? (sharedEventByPerson.get(otherId) ?? null)
          : null,
      careLabel: null,
      state,
      fromEvent: state === 'waiting_you' ? (eventByConnection.get(r.connection_id) ?? null) : null,
      samahan: (otherUser && samahanByUser.get(otherUser)) || [],
      canLabel: iDeclared,
    });
  }

  // ── alaga ────────────────────────────────────────────────────────────────
  // 🔒 WHOSE ROWS — `lib/my-loved-ones.ts`, the SAME rule the Loved ones view
  // lists by. RLS admits an ADMIN to every dependent on the platform (prod's
  // admin is the owner), so the raw read is everybody's: on 2026-09-29 another
  // user's business ("Indigo Caterers") was counted here as "Loved ones 1" while
  // the view — which applies the rule — said "No loved ones yet."
  //   · the COUNT is exactly what the view lists (mine · handed over · my actual
  //     spouse's shared rows) — it can never claim a row the list cannot show;
  //   · the ROWS (read by the guest list's "Add from people" sheet) are the ones
  //     still in my care.
  let alagaCount: number | null = 0;
  if (dependentPeopleEnabled() && (await isDataPrivacyControlActive('dependent_minor_profiles'))) {
    const [{ data, error }, { data: spouseIds, error: spouseError }] = await Promise.all([
      supabase
        .from('dependents')
        .select(
          'dependent_id, name, relationship, dependent_kind, handed_over_at, owner_user_id, handed_over_by_user_id, shared_with_spouse',
        )
        .order('created_at', { ascending: true }),
      supabase.rpc('current_spouse_user_ids'),
    ]);
    if (error) logQueryError('getPeopleRoster.alaga', error, {}, 'graceful_degrade');
    // Refused, a spouse's shared rows are left out — exactly as the view leaves
    // them out, so the count and the list still agree.
    if (spouseError) logQueryError('getPeopleRoster.alagaSpouse', spouseError, {}, 'graceful_degrade');
    const rows = (data ?? []) as Array<{
      dependent_id: string;
      name: string;
      relationship: string | null;
      dependent_kind: string | null;
      handed_over_at: string | null;
      owner_user_id: string | null;
      handed_over_by_user_id: string | null;
      shared_with_spouse: boolean | null;
    }>;
    const spouses = spouseIdSet(spouseIds);
    alagaCount = error ? null : myLovedOnes(rows, userId, spouses).length;
    for (const d of lovedOnesInMyCare(rows, userId, spouses)) {
      people.push({
        key: d.dependent_id,
        kind: 'alaga',
        connectionId: null,
        dependentId: d.dependent_id,
        dependentKind: d.dependent_kind,
        name: d.name,
        relation: null,
        storedRelation: null,
        ask: null,
        sharesAnEvent: null,
        careLabel: careLabelFor(d.relationship, d.dependent_kind),
        state: 'in_your_care',
        fromEvent: null,
        samahan: [],
        canLabel: false,
      });
    }
  }

  const connections = people.filter((p) => p.kind === 'connection');
  const counts = {
    all: connections.length,
    connected: connections.filter((p) => p.state === 'connected').length,
    waitingThem: connections.filter((p) => p.state === 'waiting_them').length,
    waitingYou: connections.filter((p) => p.state === 'waiting_you').length,
    labelAsksForYou: connections.filter((p) => p.ask?.state === 'waiting_you').length,
    unlabelled: connections.filter((p) => p.state !== 'waiting_you' && p.relation === null).length,
    alaga: alagaCount,
    samahan: samahanUnavailable ? null : samahanCount,
  };

  return { people, mySamahan, samahanUnavailable, connectionsUnavailable, counts };
}

/** A stored word we recognise, or null — never a cast of whatever arrived. */
function asRelation(v: string | null): ConnectionRelation | null {
  return v && (CONNECTION_RELATIONS as readonly string[]).includes(v)
    ? (v as ConnectionRelation)
    : null;
}

/**
 * Do these two accounts already host an event together — both a couple or
 * coordinator member, or an accepted co-host, of one event? Admin-read, scoped
 * to exactly these two ids; only the boolean leaves. NULL = could not read.
 */
async function shareAnEvent(me: string, them: string): Promise<boolean | null> {
  try {
    const admin = createAdminClient();
    const [members, mods] = await Promise.all([
      admin
        .from('event_members')
        .select('event_id, user_id')
        .in('user_id', [me, them])
        .in('member_type', ['couple', 'coordinator']),
      admin
        .from('event_moderators')
        .select('event_id, user_id')
        .in('user_id', [me, them])
        .not('accepted_at', 'is', null)
        .is('removed_at', null),
    ]);
    if (members.error || mods.error) {
      logQueryError(
        'getPeopleRoster.sharedEvent',
        members.error ?? mods.error,
        {},
        'graceful_degrade',
      );
      return null;
    }
    const mine = new Set<string>();
    const theirs = new Set<string>();
    for (const r of [...(members.data ?? []), ...(mods.data ?? [])] as Array<{
      event_id: string;
      user_id: string;
    }>) {
      (r.user_id === me ? mine : theirs).add(r.event_id);
    }
    for (const e of mine) if (theirs.has(e)) return true;
    return false;
  } catch {
    return null;
  }
}

/** The alaga's own word, which is not one of the stored relations. */
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

/**
 * How many people are waiting on MY answer — the rail's Requests row, read on
 * every People page. Null when it could not be read: the rail then still draws
 * Requests (a refused read must never hide a request), just without a number.
 */
export async function waitingRequestCount(userId: string): Promise<number | null> {
  if (!peopleConnectionsEnabled()) return 0;
  const supabase = await createClient();
  const { data: me, error: meError } = await supabase
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (meError) {
    logQueryError('waitingRequestCount.me', meError, {}, 'graceful_degrade');
    return null;
  }
  const myPerson = (me as { person_id: string } | null)?.person_id;
  if (!myPerson) return 0;
  // A request to connect, OR a label asked on a connection I already have —
  // both wait on my answer, and both live in Requests (owner 2026-09-29: "it
  // will show to their requests on people as well").
  const { count, error } = await supabase
    .from('person_connections')
    .select('connection_id', { count: 'exact', head: true })
    .eq('to_person_id', myPerson)
    .or('status.eq.pending,proposed_status.eq.pending')
    .is('deleted_at', null);
  if (error) {
    logQueryError('waitingRequestCount.requests', error, {}, 'graceful_degrade');
    return null;
  }
  return count ?? 0;
}

export const EMPTY_ROSTER = EMPTY;
