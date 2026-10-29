/**
 * apps/web/lib/guest-roster-view.ts — THE GUEST LIST'S SECTIONS, SEARCH AND ROW
 * VERBS, as one pure module (Maker PR 4f, owner 2026-10-07; corpus
 * `HOME_AND_GUESTS_CHECK_2026-10-07_fable.md` G16–G19, G28, G34–G36, G38 and the
 * prototype `prototypes/home_and_guests_2026-10-07_fable.html?frame=1&page=guests`).
 *
 * ⚖ What the owner said, and where it lives here:
 *   · *"So we can group them by Last Name, Side, Role, Group, RSVP"* — ONE Sort
 *     dropdown (`ROSTER_VIEWS`) that changes the SECTIONS themselves.
 *   · *"But Celebrants/Bride and Groom will always be first"* — `rosterSections`
 *     pulls the honorees out before any bucketing; their section leads every view.
 *   · *"sort on map is different, we already have those choices: By side/role/
 *     RSVP/Group"* — `MAP_ARRANGE`: four, no Last name.
 *   · *"if we search attending it will already show all attending"* — the
 *     search reads WORDS (`rosterSearchMatches`): a reply, "to invite", a role, a
 *     group, a side, a table — on top of the one shipped matcher
 *     (`lib/guest-search.ts`), never a second one.
 *   · *"why is there nudge now?"* (no Nudge, ever) · and, 2026-10-27, *"share and
 *     delete only"* — `rowVerbsFor`: a row is Share (the ONE Send button, for a
 *     guest who has their own link) · Delete. The pencil went: the whole row opens
 *     the guest card, where editing happens.
 *
 * Pure: no React, no I/O. The client screen (`guests-screen.tsx`) and the map
 * (`guest-map-canvas.tsx`) both read it, so the list and the map can never
 * section the same people two ways.
 */

import {
  countsTowardEvent,
  RSVP_ROW_WORDS,
  SIDE_LABELS,
  SIDE_ORDER,
  type GuestRow,
  type RsvpStatus,
} from '@/lib/guests';
import { guestMatchesSearch, isSearchVocabulary, normalizeSearchText, replyStatusOf, type GuestSearchFacts } from '@/lib/guest-search';
import {
  importanceGroupOf,
  isHonoreeRole,
  roleGroupLabel,
  roleGroupOf,
  type RoleGroup,
} from '@/lib/role-groups';
import type { RoleNames } from '@/lib/role-names';
import { plusOneOfWords } from '@/lib/plus-one-of';
import { plusOneHasNoName, plusOneIsNamed } from '@/lib/extra-seats';

/** The 250 ms wait after the last key — the Guests thumb row's debounce (rule 4; the retired top-bar guest search used the same). */
export const SEARCH_WAIT_MS = 250;

/* ─── THE SORT (list) and THE ARRANGE (map) ─────────────────────────────── */

export type RosterView = 'role' | 'last_name' | 'side' | 'group' | 'rsvp';

/** The list's ONE Sort dropdown, in the owner's words and order (G16/G17). */
export const ROSTER_VIEWS: readonly { key: RosterView; label: string }[] = [
  { key: 'role', label: 'Role' },
  { key: 'last_name', label: 'Last name' },
  { key: 'side', label: 'Side' },
  { key: 'group', label: 'Group' },
  { key: 'rsvp', label: 'RSVP' },
];

export type MapArrange = 'side' | 'role' | 'rsvp' | 'group';

/** The map's own dropdown (G38) — four, never Last name. */
export const MAP_ARRANGE: readonly { key: MapArrange; label: string }[] = [
  { key: 'side', label: 'By side' },
  { key: 'role', label: 'By role' },
  { key: 'rsvp', label: 'By RSVP' },
  { key: 'group', label: 'By group' },
];

export function isRosterView(v: string | null | undefined): v is RosterView {
  return ROSTER_VIEWS.some((o) => o.key === v);
}
export function isMapArrange(v: string | null | undefined): v is MapArrange {
  return MAP_ARRANGE.some((o) => o.key === v);
}

/* ─── WHAT A ROW KNOWS THAT IS NOT ON THE ROW ───────────────────────────── */

export type RosterFacts = {
  roleNames?: RoleNames | null;
  /** A sideless event (birthday…): no Side view, no side words. */
  hasSides: boolean;
  /** The guest's custom groups' labels, alphabetical. */
  groupsOf: (guestId: string) => readonly string[];
  /** The table they are placed at, as printed. */
  tableOf: (guestId: string) => string | null;
  /** Their song requests ("Title Artist") — the shipped search reads them. */
  songsOf?: (guestId: string) => readonly string[];
  /** The names on their live +1 rows (`companionNamesByBringer`) — the search finds a guest by who they bring. */
  companionsOf?: (guestId: string) => readonly string[];
  /**
   * Any guest on the WHOLE list by id — so a +1 whose guest a search left out still sections with
   * that guest (`plusOneAnchor`). Absent → the guests handed to the call are the whole list.
   */
  guestById?: (guestId: string) => GuestRow | undefined;
};

/** What the invite rule reads off a guest — every field optional, so any guest read can ask it. */
export type InviteFacts = {
  role?: string | null;
  entry_source?: string | null;
  passed_away?: boolean | null;
  invitation_sent_at?: string | null;
  rsvp_status?: string | null;
  /** A +1 seat's facts — read only when the guest read carries `first_name` (see `ridesOnTheirGuest`). */
  guest_id?: string;
  plus_one_of_guest_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  plus_one_name_confirmed_at?: string | null;
};

/**
 * 🪑 A +1 SEAT WITH NO NAME YET RIDES ON THEIR GUEST'S INVITATION (owner 2026-10-27, DECISION_LOG "THE SEND RUN, REDRAWN
 * SIMPLE": the run's first card read "+1 · TBA — Send to TBA"). There is nobody to send it to, so it is not an
 * invitation of its own: not in "To invite", not in the run, not in any "Send N". Named, it is a person and is invited.
 * 🔒 Only a read that CARRIES the name can say "no name" — a read without `first_name` never drops a seat.
 */
function ridesOnTheirGuest(g: InviteFacts): boolean {
  if (!g.plus_one_of_guest_id || !('first_name' in g)) return false;
  return plusOneHasNoName({
    guest_id: g.guest_id,
    plus_one_of_guest_id: g.plus_one_of_guest_id,
    first_name: g.first_name ?? null,
    last_name: g.last_name ?? null,
    plus_one_name_confirmed_at: g.plus_one_name_confirmed_at ?? null,
  });
}

/**
 * MAY THIS GUEST BE SENT AN INVITATION AT ALL — sent already or not. A living,
 * accepted guest who is not the couple or the celebrant and has NOT declined
 * (owner 2026-10-08, verbatim: *"no. declined guests don't get an invitation"*).
 * The send run's "Everyone" is exactly these; nothing else decides it.
 */
export function mayBeInvited(g: InviteFacts): boolean {
  return (
    g.role !== 'bride' &&
    g.role !== 'groom' &&
    !isHonoreeRole(g.role as GuestRow['role']) &&
    countsTowardEvent(g) &&
    g.rsvp_status !== 'declined' &&
    !ridesOnTheirGuest(g)
  );
}

/**
 * 💬 HAS THIS GUEST ANSWERED — Attending, Can't come or Maybe, by the guest or marked by the host. Every reply but
 * 'pending' is an answer (the same line `hasNotAnswered` draws for "No reply"). A read that does not carry
 * `rsvp_status` says nothing, so it is never read as an answer.
 */
export function hasReplied(g: Pick<InviteFacts, 'rsvp_status'>): boolean {
  return g.rsvp_status != null && g.rsvp_status !== 'pending';
}

/**
 * 🔑 "TO INVITE" — ONE DEFINITION, EVERYWHERE (owner 2026-09-30 for the counts
 * line; made the only rule 2026-10-08): a guest who `mayBeInvited`, has no
 * invitation sent AND HAS NOT ANSWERED. The List's "N to invite" and its door, the "to invite" word
 * search ("Pick who"), Setup's "Send to N" (`toInviteCount`), the send run's
 * queue and its "N more to invite", and Home's "Send N
 * invitations" (`homeGuestsRead`) all ask THIS — so the numbers are one
 * number and a declined guest is never queued. A blank stamp is not a send.
 * 💬 A guest who already REPLIED is not "to invite" (owner 2026-10-29, live, on his own event: the run showed
 * "105 more to invite" and walked him to *Kat Arroyo · Attending* — "a guest who already replied must not be counted"):
 * an answer means the invitation reached them, stamped or not. They may still be SENT one (`mayBeInvited` — their row's
 * Share, or the run opened on them deliberately), they are just never counted or queued as "to invite".
 * Held by `lib/to-invite-is-one-rule.test.ts` and `lib/the-run-counts-only-who-is-left.test.ts`.
 */
export function isToInvite(g: InviteFacts): boolean {
  return mayBeInvited(g) && !hasReplied(g) && (!g.invitation_sent_at || String(g.invitation_sent_at).trim() === '');
}

/** "N to invite" off a guest read — `null` when the read was REFUSED (unknown, never 0). */
export function toInviteCount(rows: readonly InviteFacts[], measured: boolean): number | null {
  return measured ? rows.filter((g) => isToInvite(g)).length : null;
}

/**
 * THE SEND RUN'S PEOPLE — everyone who `mayBeInvited` (its "Everyone"); of
 * them, the ones `isToInvite` (no stamp, no answer) are its opening queue and its "more to invite".
 * `picked` (the List's "Invite N", `?ids=`) narrows to the ticked guests, in
 * the order they were ticked — a ticked guest who has declined is still left out.
 */
export function sendRunGuests<G extends InviteFacts & { guest_id: string }>(rows: readonly G[], picked: readonly string[] = []): G[] {
  const order = new Map(picked.map((id, i) => [id, i] as const));
  return rows
    .filter((g) => mayBeInvited(g))
    .filter((g) => picked.length === 0 || order.has(g.guest_id))
    .sort((a, b) => (order.get(a.guest_id) ?? 0) - (order.get(b.guest_id) ?? 0));
}

/**
 * A guest as the run holds them (`SendInviteGuest` has these). `replied` — they have answered (`hasReplied`), so they
 * are not "to invite": never queued, never counted, never a newcomer. Absent = not known to have answered.
 */
type RunGuest = { guestId: string; sentAt: string | null; replied?: boolean };

/** 📨 Is this run guest still TO INVITE — no stamp and no answer (`isToInvite`, as the run holds them). */
export function runToInvite(g: RunGuest): boolean {
  return !g.sentAt && !g.replied;
}

/**
 * WHERE THE RUN STANDS AGAINST THE LATEST READ. The queue is a snapshot (a send
 * must not reshuffle it under the couple's thumb), but every read after it can
 * take people OUT: `latest` is `sendRunGuests` again, so a guest who declined —
 * or was removed — since the run opened is no longer in it and is stepped over,
 * never offered. Counting is over the people still in it ("1 of N").
 */
export function runStanding<G extends RunGuest>(
  queue: readonly G[],
  latest: readonly RunGuest[],
  at: number,
): { index: number; current: G | null; upNext: G | null; position: number; total: number } {
  const live = new Set(latest.map((g) => g.guestId));
  const stillIn = (g: G | undefined): g is G => Boolean(g) && live.has(g!.guestId);
  let index = Math.max(0, at);
  while (index < queue.length && !stillIn(queue[index])) index += 1;
  let next = index + 1;
  while (next < queue.length && !stillIn(queue[next])) next += 1;
  return {
    index,
    current: queue[index] ?? null,
    upNext: queue[next] ?? null,
    position: queue.slice(0, index).filter((g) => stillIn(g)).length + 1,
    total: queue.filter((g) => stillIn(g)).length,
  };
}

/**
 * WHO JOINED SINCE THE RUN LAST LOOKED — a guest the run has never been handed
 * (their "can't come" was changed back, or they were just added). They go on
 * the END of the queue: under 'unsent' only while they are still to invite (nothing sent, no answer — `runToInvite`).
 */
export function runArrivals<G extends RunGuest>(known: ReadonlySet<string>, latest: readonly G[], who: 'unsent' | 'everyone'): G[] {
  return latest.filter((g) => !known.has(g.guestId) && (who === 'everyone' || runToInvite(g)));
}

/**
 * 🔑 "NO REPLY" — ONE DEFINITION, in the owner's words (2026-10-07: *"no reply will
 * show all guest who have not yet answered"*): every counted guest who has not
 * answered, invited or not — never the couple or the celebrants, who are not asked.
 * Home's "no reply" tile, this counts line and the "no reply" search word all read
 * THIS, so the tile's number is exactly the rows its filter shows.
 */
export function hasNotAnswered(g: Pick<GuestRow, 'role' | 'rsvp_status' | 'entry_source' | 'passed_away'>): boolean {
  return (
    countsTowardEvent(g) &&
    g.rsvp_status === 'pending' &&
    g.role !== 'bride' &&
    g.role !== 'groom' &&
    !isHonoreeRole(g.role)
  );
}

/**
 * THE COUNTS LINE, from the same list the rows are drawn from. "No reply" =
 * `hasNotAnswered` (every guest who has not answered — a guest still to invite is
 * ALSO "to invite"; the two overlap, owner 2026-10-07); requests and the
 * passed-away are not counted.
 */
export function rosterStats(guests: readonly GuestRow[]): {
  total: number;
  yes: number;
  no: number;
  none: number;
  toInvite: number;
} {
  const counted = guests.filter((g) => countsTowardEvent(g));
  return {
    total: counted.length,
    // The three reply counts ARE their filters' rows (`replyFilterMatches`) — a tap shows exactly what was said.
    yes: guests.filter((g) => replyFilterMatches(g, 'attending')).length,
    no: guests.filter((g) => replyFilterMatches(g, 'declined')).length,
    none: guests.filter((g) => replyFilterMatches(g, 'none')).length,
    // The carousel's "To invite" door leaves exactly these rows (`replyFilterMatches(g, 'toinvite')` reads `isToInvite`).
    toInvite: counted.filter((g) => isToInvite(g)).length,
  };
}

/**
 * 👆 THE COUNTS ARE DOORS (owner 2026-10-21, verbatim: *"How do we double check those who did not answer yet. so we can
 * manually accept them in case they just forgot to say yes?"* → *"tappable counts that filter"*). "N attending · N not
 * coming · N no reply" each filter the list to exactly the guests they count — and the search words for the same
 * replies ("attending", "not coming", "no reply"…) read this SAME predicate (`rosterSearchMatches`), so the tap, the
 * typed word and the number can never disagree. A guest who is not counted (a request, the passed-away) is in none.
 * 🔒 guests/_components/the-counts-filter-what-they-count.test.ts
 */
export type ReplyFilter = 'attending' | 'declined' | 'none' | 'toinvite';

/**
 * 🎠 `toinvite` (owner 2026-10-27, "APPROVED — GUESTS CAROUSEL STYLE A"): the carousel's fourth count, "To invite", is a
 * door like the other three — it filters to exactly the guests `isToInvite` names, the same rule its number counts
 * (`rosterStats().toInvite`) and the "to invite" search word reads.
 */
export function replyFilterMatches(
  g: Pick<GuestRow, 'role' | 'rsvp_status' | 'entry_source' | 'passed_away'> & { invitation_sent_at?: string | null },
  f: ReplyFilter | null,
): boolean {
  if (f === null) return true;
  if (!countsTowardEvent(g)) return false;
  if (f === 'toinvite') return isToInvite(g);
  return f === 'none' ? hasNotAnswered(g) : g.rsvp_status === f;
}

/**
 * ✋ MAY A HOST SET THIS GUEST'S REPLY? Everyone but the couple and the honoree — they are always attending (the DB
 * trigger, owner 2026-06-03). The ONE answer Select → Set reply ▾ (the screen's optimistic draw) and the server's write
 * (`setGuestRsvp`, guests/inline-actions.ts) both read, so the list never draws a reply the server will not write.
 */
export function hostMaySetReply(g: Pick<GuestRow, 'role'>): boolean {
  return g.role !== 'bride' && g.role !== 'groom' && !isHonoreeRole(g.role);
}

/* ─── THE +1s: WHO HAS A NAME, WHO HAS NONE YET ─────────────────────────── */

/**
 * 🪑 FINALIZING THE LIST: WHICH +1 HAS A NAME (owner 2026-10-21, verbatim: *"when we finalize the guest list. how do I
 * know which +1 has names and has no names? so we can alot the seat to another person in case they said no or they
 * will not add a +1 anymore"* → *"Yes, build it: count at the top, +1 ▾ Named / No name yet filter, Release seat with
 * Undo and bulk Select"*). The counts line's "+1s: N named · M no name yet", the Sort dropdown's "+1 ▾" and the rows
 * it leaves all read `plusOneFilterMatches` — the number said IS the rows shown (`plusOneTally` counts the filter).
 * 🔒 guests/_components/a-seat-with-no-name-can-be-released.test.ts
 */
export type PlusOneFilter = 'named' | 'unnamed';

export const PLUS_ONE_FILTERS: readonly { key: PlusOneFilter; label: string }[] = [
  { key: 'named', label: 'Named' },
  { key: 'unnamed', label: 'No name yet' },
];

type PlusFilterFields = Pick<GuestRow, 'guest_id' | 'plus_one_of_guest_id' | 'first_name' | 'last_name' | 'plus_one_name_confirmed_at'>;

/** Is this row one of the +1s the filter shows? `null` → every row (no +1 filter). */
export function plusOneFilterMatches(g: PlusFilterFields, f: PlusOneFilter | null): boolean {
  if (f === null) return true;
  return f === 'unnamed' ? plusOneHasNoName(g) : plusOneIsNamed(g);
}

/** The counts line's "+1s: N named · M no name yet" — the filter's own rows, counted. */
export function plusOneTally(roster: readonly PlusFilterFields[]): { named: number; unnamed: number } {
  return {
    named: roster.filter((g) => plusOneFilterMatches(g, 'named')).length,
    unnamed: roster.filter((g) => plusOneFilterMatches(g, 'unnamed')).length,
  };
}

/* ─── THE SECTIONS ──────────────────────────────────────────────────────── */

/** What a section's round marker draws — the screen maps it to an icon. */
export type SectionMark =
  | { kind: 'icon'; icon: SectionIcon }
  | { kind: 'letter'; letter: string };

export type SectionIcon =
  | 'celebrant'
  | 'star'
  | 'home'
  | 'party'
  | 'people'
  | 'attending'
  | 'pending'
  | 'maybe'
  | 'declined'
  | 'invite'
  | 'side'
  | 'none';

export type RosterSection<G> = {
  /** Stable across renders: `${view}:${label}` (the celebrants: `celebrants`). */
  key: string;
  label: string;
  mark: SectionMark;
  guests: G[];
  /** The honorees — first in every view. */
  celebrants?: boolean;
};

/** The roster's curated role hierarchy (the shipped `SECTION_CONFIG` order). */
const ROLE_ORDER: readonly (RoleGroup | 'guest')[] = [
  'vip_family',
  'muslim_principals',
  'groomsmen',
  'bridesmaids',
  'principal_sponsors',
  'secondary_sponsors',
  'bearers_flower_girl',
  'officiants',
  'guest',
];

const ROLE_ICON: Partial<Record<RoleGroup | 'guest', SectionIcon>> = {
  vip_family: 'star',
  muslim_principals: 'star',
  groomsmen: 'people',
  bridesmaids: 'people',
  principal_sponsors: 'home',
  secondary_sponsors: 'home',
  bearers_flower_girl: 'party',
  officiants: 'people',
  guest: 'party',
};

const RSVP_SECTIONS: readonly { status: RsvpStatus | 'to_invite'; label: string; icon: SectionIcon }[] = [
  { status: 'attending', label: RSVP_ROW_WORDS.attending, icon: 'attending' },
  { status: 'pending', label: RSVP_ROW_WORDS.pending, icon: 'pending' },
  { status: 'maybe', label: RSVP_ROW_WORDS.maybe, icon: 'maybe' },
  { status: 'declined', label: RSVP_ROW_WORDS.declined, icon: 'declined' },
  { status: 'to_invite', label: 'To invite', icon: 'invite' },
];

/** A guest's bucket under the RSVP view: a reply, or "To invite" while nothing is sent and nothing answered. */
export function rsvpBucketOf(g: GuestRow): RsvpStatus | 'to_invite' {
  if (g.rsvp_status === 'pending' && isToInvite(g)) return 'to_invite';
  return g.rsvp_status;
}

function roleBucket(g: GuestRow): RoleGroup | 'guest' {
  const grp = importanceGroupOf([g.role, ...(g.extra_roles ?? [])]);
  return grp === 'other_roles' || grp === 'couple' || grp === 'honoree' ? 'guest' : grp;
}

function roleLabel(grp: RoleGroup | 'guest', names?: RoleNames | null): string {
  return grp === 'guest' ? 'Guests' : roleGroupLabel(grp, names);
}

/** The celebrants' heading — "Bride & Groom" at a wedding, "Celebrant" otherwise. */
function celebrantLabel(g: GuestRow, names?: RoleNames | null): string {
  const grp = roleGroupOf(g.role);
  return grp === 'guest' ? 'Celebrant' : roleGroupLabel(grp, names);
}

function lastInitial(g: GuestRow): string {
  const ln = (g.last_name ?? '').trim() || (g.first_name ?? '').trim();
  const c = normalizeSearchText(ln).charAt(0).toUpperCase();
  return c && /[A-Z]/.test(c) ? c : '#';
}

/**
 * THE SECTIONS FOR ONE VIEW. The celebrants (Bride & Groom — the Celebrant on a
 * birthday) are pulled out FIRST and lead every view; everyone else is bucketed
 * by the view. Order WITHIN a section is the caller's (the page sorts by
 * importance, then name), so a view never reshuffles people inside a heading.
 *
 * The Role view keeps its empty headings out; every view drops an empty bucket.
 */
export function rosterSections(
  guests: readonly GuestRow[],
  view: RosterView,
  facts: RosterFacts,
): RosterSection<GuestRow>[] {
  // 🤝 A +1 IS SECTIONED AS THEIR GUEST IS (owner 2026-10-19: "the plus 1 did not connect properly to the guest"):
  // every bucket below reads `at(g)` — the guest who brings them — never the +1's own role, side, name or group.
  const at = plusOneAnchorOf(guests, facts);
  const celebrants: GuestRow[] = [];
  const rest: GuestRow[] = [];
  for (const g of guests) (isHonoreeRole(at(g).role) ? celebrants : rest).push(g);
  const rank = new Map(guests.map((g, i) => [g.guest_id, i] as const));
  const beside = (list: GuestRow[]) => besideTheirGuest(list, rank);

  const out: RosterSection<GuestRow>[] = [];
  if (celebrants.length) {
    out.push({
      key: 'celebrants',
      label: celebrantLabel(celebrants[0]!, facts.roleNames),
      mark: { kind: 'icon', icon: 'celebrant' },
      guests: beside(celebrants),
      celebrants: true,
    });
  }

  const push = (key: string, label: string, mark: SectionMark, list: GuestRow[]) => {
    if (list.length) out.push({ key: `${view}:${key}`, label, mark, guests: beside(list) });
  };

  if (view === 'role') {
    for (const grp of ROLE_ORDER) {
      push(grp, roleLabel(grp, facts.roleNames), { kind: 'icon', icon: ROLE_ICON[grp] ?? 'party' }, rest.filter((g) => roleBucket(at(g)) === grp));
    }
  } else if (view === 'last_name') {
    const by = new Map<string, GuestRow[]>();
    for (const g of rest) {
      const k = lastInitial(at(g));
      by.set(k, [...(by.get(k) ?? []), g]);
    }
    for (const k of [...by.keys()].sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))) {
      const list = by
        .get(k)!
        .slice()
        .sort((a, b) =>
          `${at(a).last_name ?? ''} ${at(a).first_name ?? ''}`.localeCompare(`${at(b).last_name ?? ''} ${at(b).first_name ?? ''}`),
        );
      push(k, k, { kind: 'letter', letter: k }, list);
    }
  } else if (view === 'side') {
    for (const side of SIDE_ORDER) {
      push(side, SIDE_LABELS[side], { kind: 'icon', icon: 'side' }, rest.filter((g) => at(g).side === side));
    }
  } else if (view === 'group') {
    const groupOf = (g: GuestRow) => facts.groupsOf(at(g).guest_id);
    const names = [...new Set(rest.flatMap((g) => groupOf(g).slice(0, 1)))].sort((a, b) => a.localeCompare(b));
    for (const n of names) {
      push(n, n, { kind: 'letter', letter: (n.charAt(0) || '·').toUpperCase() }, rest.filter((g) => groupOf(g)[0] === n));
    }
    push('none', 'No group', { kind: 'icon', icon: 'none' }, rest.filter((g) => groupOf(g).length === 0));
  } else {
    // ⚖ The ONE view that reads the +1's OWN answer: a heading here is a reply, and a +1 who has not answered is
    // not "Attending" because their guest is. Beside their guest when they share the heading; named with them always.
    for (const s of RSVP_SECTIONS) {
      push(s.status, s.label, { kind: 'icon', icon: s.icon }, rest.filter((g) => rsvpBucketOf(g) === s.status));
    }
  }
  return out;
}

/** The map's tree: the same sections, Side nesting each side's groups (role when ungrouped). */
export type MapBranch = { key: string; label: string; mark: SectionMark; kids: MapBranch[]; guests: GuestRow[] };

export function mapTree(guests: readonly GuestRow[], arrange: MapArrange, facts: RosterFacts): MapBranch[] {
  if (arrange === 'side' && facts.hasSides) {
    const at = plusOneAnchorOf(guests, facts);
    const rank = new Map(guests.map((g, i) => [g.guest_id, i] as const));
    return SIDE_ORDER.map((side) => {
      const mine = guests.filter((g) => at(g).side === side);
      const kidsBy = new Map<string, GuestRow[]>();
      for (const g of mine) {
        const a = at(g);
        const k = isHonoreeRole(a.role)
          ? celebrantLabel(a, facts.roleNames)
          : (facts.groupsOf(a.guest_id)[0] ?? roleLabel(roleBucket(a), facts.roleNames));
        kidsBy.set(k, [...(kidsBy.get(k) ?? []), g]);
      }
      return {
        key: `side:${side}`,
        label: SIDE_LABELS[side],
        mark: { kind: 'icon', icon: 'side' } as SectionMark,
        guests: [],
        kids: [...kidsBy.entries()].map(([label, list]) => ({
          key: `side:${side}:${label}`,
          label,
          mark: { kind: 'letter', letter: label.charAt(0).toUpperCase() } as SectionMark,
          kids: [],
          guests: besideTheirGuest(list, rank),
        })),
      };
    }).filter((b) => b.kids.length > 0);
  }
  const view: RosterView = arrange === 'side' ? 'role' : arrange;
  return rosterSections(guests, view, facts).map((s) => ({
    key: s.key,
    label: s.label,
    mark: s.mark,
    kids: [],
    guests: s.guests,
  }));
}

/**
 * The map's centre — the celebrants' first names, joined with "&"
 * as the prototype draws ("Cale & Ice"); with no celebrant on the list, the
 * event's word ("Birthday"). A HEADING for the map, never a guest row.
 */
export function mapRootLabel(guests: readonly Pick<GuestRow, 'role' | 'first_name'>[], eventWord: string): string {
  const names = guests.filter((g) => isHonoreeRole(g.role)).map((g) => (g.first_name ?? '').trim()).filter(Boolean);
  if (names.length) return names.join(' & ');
  return eventWord.charAt(0).toUpperCase() + eventWord.slice(1);
}

/* ─── A +1 SITS WITH THEIR GUEST ─────────────────────────────────────────── */

/**
 * 🤝 OWNER 2026-10-19, on a run of identical "+1 · TBA" rows under GUESTS: *"the plus 1 did not connect
 * properly to the guest"*. The rows WERE linked (`guests.plus_one_of_guest_id`) — the list just never read
 * the link. Now, in every view:
 *   · a +1 is SECTIONED as their guest is — the guest's role, side, last name, group (`plusOneAnchorOf`);
 *     the RSVP view alone reads the +1's own answer, because its headings ARE answers;
 *   · a +1 is DRAWN right after their guest (`besideTheirGuest`), their seats in seat order;
 *   · a +1 is NAMED with their guest (`plusOneWords`) — "Juanita Sacdalan’s +1 · TBA" while the seat is
 *     unnamed (the seat's own label, `seatPlaceholderLabel`), "· +1 of Juanita Sacdalan" once it is;
 *   · searching the guest's NAME brings their +1s with them (`withTheirPlusOnes`).
 * Counts are untouched: every +1 is still one guest row, counted wherever it is drawn.
 * 🔒 guests/_components/a-plus-one-sits-with-their-guest.test.ts
 */
type PlusLinked = Pick<GuestRow, 'guest_id' | 'plus_one_of_guest_id'>;

/** The guest a row is sectioned as: the guest who brings them (followed to the root), else the row itself. */
export function plusOneAnchorOf(
  guests: readonly GuestRow[],
  facts: Pick<RosterFacts, 'guestById'> = {},
): (g: GuestRow) => GuestRow {
  const own = new Map(guests.map((g) => [g.guest_id, g] as const));
  const find = (id: string) => facts.guestById?.(id) ?? own.get(id);
  return (g) => {
    let cur = g;
    // A +1 of a +1 is not a shape the app writes, but a chain never loops and never runs away.
    for (let hop = 0; hop < 4 && cur.plus_one_of_guest_id && cur.plus_one_of_guest_id !== cur.guest_id; hop++) {
      const host = find(cur.plus_one_of_guest_id);
      if (!host) break;
      cur = host;
    }
    return cur;
  };
}

/**
 * One section's rows with every +1 moved to right after their guest — when that guest is in the same list.
 * Everyone else keeps the caller's order; a +1 whose guest is elsewhere keeps its place (still named with
 * them). A guest's +1s follow in `rank` order (the whole list's order — the order their seats are numbered in).
 */
export function besideTheirGuest<G extends PlusLinked>(list: readonly G[], rank?: ReadonlyMap<string, number>): G[] {
  const here = new Set(list.map((g) => g.guest_id));
  const kids = new Map<string, G[]>();
  const attached = (g: G) =>
    Boolean(g.plus_one_of_guest_id) && g.plus_one_of_guest_id !== g.guest_id && here.has(g.plus_one_of_guest_id!);
  for (const g of list) if (attached(g)) kids.set(g.plus_one_of_guest_id!, [...(kids.get(g.plus_one_of_guest_id!) ?? []), g]);
  if (kids.size === 0) return [...list];
  if (rank) for (const k of kids.values()) k.sort((a, b) => (rank.get(a.guest_id) ?? 0) - (rank.get(b.guest_id) ?? 0));
  const out: G[] = [];
  const seen = new Set<string>();
  const emit = (g: G) => {
    if (seen.has(g.guest_id)) return;
    seen.add(g.guest_id);
    out.push(g);
    for (const k of kids.get(g.guest_id) ?? []) emit(k);
  };
  for (const g of list) if (!attached(g)) emit(g);
  for (const g of list) emit(g); // a loop of +1s (never written) still draws every row once
  return out;
}

/** What a +1 row says about whose +1 it is. `name` replaces the row's name (an unnamed seat); `of` follows a name. */
export type PlusOneWords = {
  hostId: string;
  /** "Juanita Sacdalan’s +1 · TBA" — an unnamed seat is named by its guest. */
  name: string | null;
  /** "+1 of Juanita Sacdalan" — after a named +1's own name. */
  of: string | null;
  /** The side the row shows: their guest's (a +1's side follows their guest). */
  side: GuestRow['side'];
  /** Their guest as the row's "On Daniel’s invitation" says it — the first name, else the name as shown. */
  host: string;
};

type SeatFields = Pick<GuestRow, 'guest_id' | 'plus_one_of_guest_id' | 'first_name'>;

/**
 * Every +1 row's words, from the WHOLE list (a search for "TBA" must still know whose seat each is). Seats are
 * numbered per guest in list order, the way their seats are everywhere ("+2 · TBA" is the second seat,
 * `seatPlaceholderLabel`); the stored display name ("+1 · TBA", or an older "+ TBA · brought by …") is
 * never read for it.
 */
export function plusOneWordsFrom<G extends SeatFields & Pick<GuestRow, 'display_name' | 'last_name' | 'side'>>(
  roster: readonly G[],
): Map<string, PlusOneWords> {
  const byId = new Map(roster.map((g) => [g.guest_id, g] as const));
  const seatNo = new Map<string, number>();
  const out = new Map<string, PlusOneWords>();
  for (const g of roster) {
    const hostId = g.plus_one_of_guest_id;
    if (!hostId || hostId === g.guest_id) continue;
    const host = byId.get(hostId);
    if (!host) continue;
    const i = seatNo.get(hostId) ?? 0;
    seatNo.set(hostId, i + 1);
    // The one wording (lib/plus-one-of.ts) — the card's title and eyebrow say the same.
    const w = plusOneOfWords(g, host, i);
    out.set(g.guest_id, { hostId, name: w.name, of: w.name ? null : w.of, side: w.side, host: host.first_name?.trim() || w.hostName });
  }
  return out;
}

/**
 * 🪑 How many of each guest's seats are ROWS on the list — so a "+1" whose seat row is gone (removed before
 * 2026-10-20, when Remove left the number standing; or a number never given its seats) is SAID on the guest's row
 * ("+1 not added yet", the card's own words) instead of drawn as a +1 nobody can find.
 */
export function seatRowsByGuest(roster: readonly PlusLinked[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const g of roster) {
    const h = g.plus_one_of_guest_id;
    if (h && h !== g.guest_id) out.set(h, (out.get(h) ?? 0) + 1);
  }
  return out;
}

/** Every word of `q` lands in the guest's name. */
function nameHas(q: string, g: Pick<GuestRow, 'name_prefix' | 'first_name' | 'middle_name' | 'last_name' | 'name_suffix' | 'display_name'>): boolean {
  const hay = normalizeSearchText([g.name_prefix, g.first_name, g.middle_name, g.last_name, g.name_suffix, g.display_name].filter(Boolean).join(' '));
  return q.split(' ').every((t) => t && hay.includes(t));
}

/**
 * The search's hits, plus the +1s of every hit found BY NAME — searching "Juanita" shows Juanita and her +1.
 * Only a name brings them: a reply, a role or "to invite" matches each +1 on its own answer, so "Pick who"
 * never ticks a +1 who is already invited. Kept in the whole list's order.
 */
export function withTheirPlusOnes<G extends GuestRow>(query: string, hits: readonly G[], roster: readonly G[]): G[] {
  const q = normalizeSearchText(query ?? '');
  if (!q) return [...hits];
  const byName = new Set(hits.filter((g) => nameHas(q, g)).map((g) => g.guest_id));
  if (byName.size === 0) return [...hits];
  const got = new Set(hits.map((g) => g.guest_id));
  const added = roster.filter((g) => !got.has(g.guest_id) && g.plus_one_of_guest_id && byName.has(g.plus_one_of_guest_id));
  if (added.length === 0) return [...hits];
  for (const g of added) got.add(g.guest_id);
  return roster.filter((g) => got.has(g.guest_id));
}

/* ─── THE SEARCH UNDERSTANDS WORDS ──────────────────────────────────────── */

const TO_INVITE_WORDS = ['to invite', 'not invited', 'uninvited', 'invite'];
const INVITED_WORDS = ['invited', 'sent'];
/** "No reply" = `hasNotAnswered` — every guest who has not answered yet (owner 2026-10-07). */
const NO_REPLY_WORDS = ['no reply', 'pending', 'not replied', 'no answer', 'waiting', 'awaiting'];
const SIDE_WORDS: Record<string, GuestRow['side']> = {
  bride: 'bride',
  brides: 'bride',
  'brides side': 'bride',
  groom: 'groom',
  grooms: 'groom',
  'grooms side': 'groom',
};

/**
 * Does `query` match this guest? Empty → yes.
 *
 *   · "to invite" / "invited" → the invite state (not on the guest row's words);
 *     "no reply" → `hasNotAnswered`, every guest who has not answered yet.
 *   · "bride" / "groom" (and "… side") → that side, plus the bride or groom themselves.
 *   · everything else → the ONE shipped matcher, `guestMatchesSearch`: every
 *     name part, the reply in every word for it ("attending", "no reply",
 *     "maybe", "not coming"), the role however spelled, the groups, the table,
 *     the tags, the RSVP answers.
 */
export function rosterSearchMatches(query: string, g: GuestRow, facts: RosterFacts): boolean {
  const q = normalizeSearchText(query ?? '');
  if (!q) return true;
  if (TO_INVITE_WORDS.includes(q)) return isToInvite(g);
  if (INVITED_WORDS.includes(q)) return Boolean(g.invitation_sent_at);
  if (NO_REPLY_WORDS.includes(q)) return replyFilterMatches(g, 'none');
  // "attending" / "not coming" (and every other word for them) — the counts' own filter (`replyFilterMatches`).
  const reply = replyStatusOf(q);
  if (reply === 'attending' || reply === 'declined') return replyFilterMatches(g, reply);
  if (facts.hasSides && SIDE_WORDS[q]) {
    const side = SIDE_WORDS[q]!;
    return g.side === side || g.side === 'both' || g.role === side;
  }
  const searchFacts: GuestSearchFacts = {
    roleNames: facts.roleNames,
    hasSides: facts.hasSides,
    groupLabels: facts.groupsOf(g.guest_id),
    tableLabel: facts.tableOf(g.guest_id),
    songRequests: facts.songsOf?.(g.guest_id),
    companionNames: facts.companionsOf?.(g.guest_id),
  };
  return guestMatchesSearch(q, g, searchFacts);
}

/**
 * A LINE TYPED INTO "SEARCH OR ADD" THAT IS A FILTER, NOT A NAME (2026-10-19). Every word `rosterSearchMatches` reads as a
 * filter — to invite · invited · no reply · a side · a reply · a role · VIP (`isSearchVocabulary`) — and this event's own
 * group and table labels. When such a line matches nobody, Enter must NOT add it as a guest; the box says nobody matches.
 * 🔒 guests/_components/one-enter-adds-one-guest-at-once.test.ts
 */
export function typedLineIsAFilter(query: string, facts: Pick<RosterFacts, 'roleNames' | 'hasSides'>, labels: readonly string[] = []): boolean {
  const q = normalizeSearchText(query ?? '');
  if (!q) return false;
  if (TO_INVITE_WORDS.includes(q) || INVITED_WORDS.includes(q) || NO_REPLY_WORDS.includes(q)) return true;
  if (SIDE_WORDS[q]) return true;
  if (isSearchVocabulary(q, facts.roleNames)) return true;
  return labels.some((l) => {
    const n = normalizeSearchText(l);
    return n === q || n.replace(/\s+/g, '') === q.replace(/\s+/g, '');
  });
}

/* ─── A ROW'S VERBS ─────────────────────────────────────────────────────── */

export type RowVerb = 'share' | 'remove' | 'release';

/**
 * THE VERBS A GUEST ROW CARRIES, in order — SHARE · DELETE, and nothing else (owner 2026-10-27, DECISION_LOG "GUEST ROW
 * = SHARE + DELETE; THE PENCIL GOES": *"okay that makes more sense. share and delete only"*).
 *   · 📤 `share` — the ONE Send button (DECISION_LOG "ONE SEND BUTTON FOR EVERY INVITE"), only for a guest the page
 *     handed a personal link (`shareable`: they may be invited, have a QR token, and the event has an address). A +1
 *     with no name rides on their guest's invitation, so never theirs.
 *   · 🗑 `remove` — the shipped remove with its warning and Undo; never on the couple (the server refuses them).
 *   · 🪑 `release` — a +1 with no name yet is a SEAT, not a person: "Release seat" (gone at once, with Undo; their
 *     guest's "+N" one lower) in place of Delete. A named +1 is a person — the shipped remove (owner 2026-10-21).
 * There is NO edit (the row itself opens the card), NO message, NO nudge.
 */
export function rowVerbsFor(
  g: Pick<GuestRow, 'role'> & Partial<PlusFilterFields>,
  opts: { shareable: boolean },
): RowVerb[] {
  const verbs: RowVerb[] = [];
  const seat = plusOneHasNoName({ ...g, first_name: g.first_name ?? null });
  if (opts.shareable && !seat) verbs.push('share');
  if (seat) verbs.push('release');
  else if (g.role !== 'bride' && g.role !== 'groom') verbs.push('remove');
  return verbs;
}

/* ─── THE ROW STATE (one state for a whole group of rows) ───────────────── */

export type RowState = 'full' | 'text' | 'icon';

/** The fit order, one step at a time: icon + word → word only → icon only (BUTTON_RULE 3a). */
export const ROW_STATES: readonly RowState[] = ['full', 'text', 'icon'];

/**
 * THE TIGHTEST ROW DECIDES FOR EVERY ROW (G36). Given, for each state in fit
 * order, whether ANY row of the group overflows in it, return the first state in
 * which none does — the last one if every state is tight. One answer for the
 * whole group, never one per row.
 */
export function pickRowState(anyTight: (state: RowState) => boolean): RowState {
  for (const s of ROW_STATES) if (!anyTight(s)) return s;
  return 'icon';
}
