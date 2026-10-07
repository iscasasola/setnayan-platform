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
 *   · *"why is there nudge now?"* · *"so again. you still kept the invite here.
 *     how do we invite?"* · *"but no account, no chat"* — `rowVerbsFor`: a row is
 *     Message (only with a Setnayan account AND a chat to open) · Edit · Remove.
 *     No Invite, no Nudge, ever.
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
import { guestMatchesSearch, normalizeSearchText, type GuestSearchFacts } from '@/lib/guest-search';
import {
  importanceGroupOf,
  isHonoreeRole,
  ROLE_GROUP_LABELS,
  roleGroupOf,
  sectionHeadingInTheirWords,
  type RoleGroup,
} from '@/lib/role-groups';
import type { RoleNames } from '@/lib/role-names';

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
};

/**
 * "To invite" — the shipped counts line's own definition (page.tsx, owner
 * 2026-09-30): a living guest, never the couple, never a request, whose
 * invitation is not sent and who has not said they can't come.
 */
export function isToInvite(g: Pick<GuestRow, 'role' | 'entry_source' | 'passed_away' | 'invitation_sent_at' | 'rsvp_status'>): boolean {
  return (
    g.role !== 'bride' &&
    g.role !== 'groom' &&
    !isHonoreeRole(g.role) &&
    countsTowardEvent(g) &&
    !g.invitation_sent_at &&
    g.rsvp_status !== 'declined'
  );
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
  return grp === 'guest' ? 'Guests' : sectionHeadingInTheirWords(ROLE_GROUP_LABELS[grp], names);
}

/** The celebrants' heading — "Bride & Groom" at a wedding, "Celebrant" otherwise. */
function celebrantLabel(g: GuestRow, names?: RoleNames | null): string {
  const grp = roleGroupOf(g.role);
  return grp === 'guest' ? 'Celebrant' : sectionHeadingInTheirWords(ROLE_GROUP_LABELS[grp], names);
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
  const celebrants: GuestRow[] = [];
  const rest: GuestRow[] = [];
  for (const g of guests) (isHonoreeRole(g.role) ? celebrants : rest).push(g);

  const out: RosterSection<GuestRow>[] = [];
  if (celebrants.length) {
    out.push({
      key: 'celebrants',
      label: celebrantLabel(celebrants[0]!, facts.roleNames),
      mark: { kind: 'icon', icon: 'celebrant' },
      guests: celebrants,
      celebrants: true,
    });
  }

  const push = (key: string, label: string, mark: SectionMark, list: GuestRow[]) => {
    if (list.length) out.push({ key: `${view}:${key}`, label, mark, guests: list });
  };

  if (view === 'role') {
    for (const grp of ROLE_ORDER) {
      push(grp, roleLabel(grp, facts.roleNames), { kind: 'icon', icon: ROLE_ICON[grp] ?? 'party' }, rest.filter((g) => roleBucket(g) === grp));
    }
  } else if (view === 'last_name') {
    const by = new Map<string, GuestRow[]>();
    for (const g of rest) {
      const k = lastInitial(g);
      by.set(k, [...(by.get(k) ?? []), g]);
    }
    for (const k of [...by.keys()].sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))) {
      const list = by
        .get(k)!
        .slice()
        .sort((a, b) =>
          `${a.last_name ?? ''} ${a.first_name ?? ''}`.localeCompare(`${b.last_name ?? ''} ${b.first_name ?? ''}`),
        );
      push(k, k, { kind: 'letter', letter: k }, list);
    }
  } else if (view === 'side') {
    for (const side of SIDE_ORDER) {
      push(side, SIDE_LABELS[side], { kind: 'icon', icon: 'side' }, rest.filter((g) => g.side === side));
    }
  } else if (view === 'group') {
    const names = [...new Set(rest.flatMap((g) => facts.groupsOf(g.guest_id).slice(0, 1)))].sort((a, b) =>
      a.localeCompare(b),
    );
    for (const n of names) {
      push(n, n, { kind: 'letter', letter: (n.charAt(0) || '·').toUpperCase() }, rest.filter((g) => facts.groupsOf(g.guest_id)[0] === n));
    }
    push('none', 'No group', { kind: 'icon', icon: 'none' }, rest.filter((g) => facts.groupsOf(g.guest_id).length === 0));
  } else {
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
    return SIDE_ORDER.map((side) => {
      const mine = guests.filter((g) => g.side === side);
      const kidsBy = new Map<string, GuestRow[]>();
      for (const g of mine) {
        const k = isHonoreeRole(g.role)
          ? celebrantLabel(g, facts.roleNames)
          : (facts.groupsOf(g.guest_id)[0] ?? roleLabel(roleBucket(g), facts.roleNames));
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
          guests: list,
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

/* ─── THE SEARCH UNDERSTANDS WORDS ──────────────────────────────────────── */

const TO_INVITE_WORDS = ['to invite', 'not invited', 'uninvited', 'invite'];
const INVITED_WORDS = ['invited', 'sent'];
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
 *   · "to invite" / "invited" → the invite state (not on the guest row's words).
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
  };
  return guestMatchesSearch(q, g, searchFacts);
}

/* ─── A ROW'S VERBS ─────────────────────────────────────────────────────── */

export type RowVerb = 'message' | 'edit' | 'remove';

/**
 * The verbs a guest row carries, in order. `💬 Message` only when the guest's
 * name is linked to a Setnayan account AND there is a chat to open (G35: "no
 * account, no chat"); `✕ Remove` never on the couple (the server refuses them).
 * There is NO invite and NO nudge here — inviting is the one run (G28, G34).
 */
export function rowVerbsFor(
  g: Pick<GuestRow, 'role'>,
  opts: { linked: boolean | null; chatHref: string | null },
): RowVerb[] {
  const verbs: RowVerb[] = [];
  if (opts.linked === true && opts.chatHref) verbs.push('message');
  verbs.push('edit');
  if (g.role !== 'bride' && g.role !== 'groom') verbs.push('remove');
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
