import { guestFullName, type GuestRole } from '@/lib/guests';
import { roleNameMany, roleNameOne, type RoleNames } from '@/lib/role-names';
import type { NameStyle } from '@/lib/name-style';

/**
 * THE ENTOURAGE, AS AN INVITATION PRINTS IT.
 *
 * The couple has been able to give every guest an entourage role since the role
 * vocabulary shipped (`GuestRole` in lib/guests.ts — ~30 values), and those roles
 * already drive the seating avatars, the emcee script and the day-of desk. What
 * has never existed is the one place a GUEST reads them: the invitation's
 * entourage list. This module is the pure half of that — rows in, ordered groups
 * out. It performs no I/O and asks no question about who may see it.
 *
 * ── WHERE THE ORDER COMES FROM (owner ask 2026-09-14: "look at the internet
 *    of the best approach other websites deliver this") ──────────────────────
 * Filipino invitations and programmes print one order, and it is NOT the
 * alphabetical or the tier order the dashboard happens to group by:
 *
 *   parents · principal sponsors (ninong & ninang) · secondary sponsors
 *   (candle · veil · cord · coin) · honour attendants · bridesmaids and
 *   groomsmen · bearers and flower girls · the ceremony's own voices
 *
 * The principal sponsors come FIRST of the sponsors — that is the part every
 * Filipino source agrees on. Western wedding-party pages converge on the same
 * two rules we follow here: group by ROLE, and put the name beside its role
 * rather than in a bare list.
 *
 * ⛔ NO CEREMONIAL LINES. The print convention gives each secondary sponsor a
 * line ("to light our path", "to bind us together"), but the sources disagree on
 * the coin sponsors' line and a wedding invitation is the worst possible place
 * to publish a sentence we invented. Role labels only, until the owner writes
 * the four lines himself.
 *
 * ── ONE SOURCE, MEASURED, NOT TWO ──────────────────────────────────────────
 * 🔑 `event_sponsors` — the table behind /dashboard/<eventId>/sponsors, with its
 * own tier, side and `pair_index` — held **ZERO rows in production** when this
 * was built (2026-09-14), while `guests.role` is in use and already carries
 * `principal_sponsor`. So the list is built from the guest rows ALONE. Reading
 * both would make two mechanisms answer one question, and they would disagree
 * the first time somebody used the sponsors page without touching the guest
 * list. If that page ever fills up, feed its rows THROUGH this builder — do not
 * add a second group here.
 */

/** One person, as the list needs them. Nothing else about a guest is read. */
export type EntouragePerson = {
  /** The guest row's own id — how a pair is resolved. */
  id: string | null;
  /** Already-composed display name. Never assembled from parts in here. */
  name: string;
  /** The role this appearance is for — a guest with `extra_roles` appears once per role. */
  role: GuestRole;
  /**
   * `march_walks.walk_no` — the WALK this person is in, which is both who they
   * walk with (everyone sharing the number) and the walk's place in the march
   * (ascending). Null = an entourage member nobody has placed yet: they walk
   * alone, after the placed walks, in the role-then-surname default. See
   * `pairUp` and `orderLines`. (Owner 2026-10-01: the march is its own entity.)
   */
  walk: number | null;
  /** `march_walks.place_in_walk` — who is named first inside a walk when the group has no columns. */
  place: number;
  /** `guests.plus_one_of_guest_id` — whose +1 this person is. See `isCouple`. */
  plusOneOf?: string | null;
  /** `guests.couple_with_guest_id` — the partner link. See `isCouple`. */
  coupleWith?: string | null;
  /** True when they are invited to the ceremony and nothing else. They still
   *  walk, and print normally; they simply have no chair. */
  ceremonyOnly: boolean;
  /**
   * What an UNPLACED line sorts by — surname, then first name, never a title.
   * From the name parts where the row has them; see `sortKeyOf`.
   */
  sortKey?: { last: string; first: string };
  /**
   * 'father' / 'mother' when the name's OWN title says so (Mr. → father; Mrs.,
   * Ms., Miss → mother), else null. Gender is not stored; the title the couple
   * typed is the only honest source, and without one nothing is guessed.
   */
  parentWord?: 'father' | 'mother' | null;
};

/**
 * One printed line: `[left, right]`. Either cell may be null.
 *
 * 🔑 A NULL IS A DELIBERATE BLANK, NOT A MISSING PERSON. The owner's ruling is
 * that an unpartnered name keeps its line and leaves the other side empty, so
 * the columns stay columns instead of re-flowing into two ragged lists.
 */
export type EntourageRow = readonly [EntouragePerson | null, EntouragePerson | null];

export type EntourageGroup = {
  /** Stable key, for the render's list identity and for tests. */
  key: string;
  /** The heading a guest reads — "Principal Sponsors", "Bridesmaids & Groomsmen". */
  label: string;
  /** The printed lines, in order. */
  rows: EntourageRow[];
  /**
   * The role words this group was built with (`events.role_names`, owner
   * 2026-09-30). Carried so every renderer labels a person with the SAME words
   * the heading used: `roleLabel(person.role, group.names)`. `{}` = usual words.
   */
  names: RoleNames;
};

/** Everyone in a group, in printed order — the flat view, for counting and tests. */
export function peopleOf(group: EntourageGroup): EntouragePerson[] {
  return group.rows.flatMap((r) => r.filter((p): p is EntouragePerson => p !== null));
}

/**
 * The roles this list prints, in the order it prints them, grouped the way an
 * invitation groups them.
 *
 * ⚠ EXHAUSTIVE OVER NOTHING ON PURPOSE. A `GuestRole` absent from here is
 * absent from the invitation — `guest`, `vip`, `family`, `helper` and the
 * generic non-wedding roles are not entourage and must never be published as
 * one. Adding a role to `GuestRole` therefore does NOT silently publish it.
 */
/**
 * A group's two columns, when it has two sides.
 *
 * ⚖ OWNER 2026-09-14: *"two columns, paired across. but if the other side is
 * left blank, then keep that line blank."* So a side is not decoration — it
 * decides which CELL a person occupies, and an unpartnered groomsman sits in
 * the RIGHT cell with the left one empty, rather than sliding left and pairing
 * himself with the next bridesmaid by accident.
 *
 * A group with no `sides` still pairs: the first of a pair takes the left cell
 * and the partner the right. That is the right answer for the secondary
 * sponsors, where BOTH halves hold the same role (two candle sponsors) and
 * nothing in the role can say which side anyone is on.
 */
type GroupSpec = {
  key: string;
  label: string;
  roles: readonly GuestRole[];
  /** `[left, right]` — roles that belong in each column. Omit when the group has one side. */
  sides?: readonly [readonly GuestRole[], readonly GuestRole[]];
  /**
   * Roles this group's HEADING already names, so the page does not repeat them
   * beside every name. See `roleBesideName`. A role missing from here (a
   * Matron under "Maid of Honour & Best Man") keeps its word beside the name —
   * the heading would misdescribe her without it.
   */
  headingNames?: readonly GuestRole[];
  /** Print the group as one small sub-heading per role, names under it. See `roleBlocks`. */
  byRole?: true;
  /** A pair the data pairs prints as ONE line on every screen and on the card. See `pairsShareALine`. */
  pairsOnOneLine?: true;
  /**
   * ⚖ THE HEADING FOLLOWS THE COUPLE'S WORDS (owner 2026-09-30). A sided group
   * whose heading NAMES its roles ("Maid of Honour & Best Man") gives each
   * column's usual word here; `groupHeading` swaps a column's word for the
   * couple's own when they renamed a role in it, or when a role in it is one of
   * `unusual` (a best woman must not stand under "Best Man"). Groups whose
   * heading is a CATEGORY ("Principal Sponsors", "Bearers") have none, and keep
   * their heading whatever the roles inside are called.
   */
  sideWords?: readonly [string, string];
  /** Roles whose presence alone changes their column's word — see `sideWords`. */
  unusual?: readonly GuestRole[];
  /** In the heading, a renamed role reads as its word for SEVERAL (`many`) or for ONE. */
  headingForm?: 'one' | 'many';
  /** A one-role group whose heading IS that role's plural ("Flower Girls"): the couple's `many` replaces it. */
  headingIsRole?: boolean;
};

const GROUPS: ReadonlyArray<GroupSpec> = [
  /*
    ⚖ OWNER 2026-09-20: the groom's parents print FIRST. This group's `roles`
    order IS the printed order — `buildEntourage` walks `spec.roles` outermost —
    so the swap below is the whole change, and nothing in the component decides
    it.
  */
  { key: 'parents', label: 'Parents', roles: ['groom_parents', 'bride_parents'] },
  /*
    ⚖ OWNER 2026-09-20. Immediate family PUBLISHES for the first time. These two
    roles existed in the dashboard from the start and appeared in NO group here,
    so a couple who had carefully marked their siblings and grandparents found
    them on no page — `bride_immediate_family` was even this file's own example
    of a role that must never print. That was the bug, not the design.

    🔴 THIS IS A VISIBILITY CHANGE, NOT A LAYOUT ONE. `ENTOURAGE_ROLES` is
    derived from this list and is also the query's `role.in.(…)` filter, so
    adding a role here makes those people's real names readable by anyone who
    can open the invitation — the entourage section is NOT behind the
    recognised-viewer gate that hides the plain guest list. A couple whose page
    is public is now publishing their siblings' names. `landing_page_visibility`
    remains the only control that closes that door.
  */
  {
    key: 'immediate_family',
    label: 'Immediate Family',
    /* Groom's side first, following the owner's 2026-09-20 ruling on Parents
       one group above. That ruling named Parents; printing the two families in
       OPPOSITE orders on one invitation would be the odder reading of it. Flip
       this line alone if the ruling was meant to stop at Parents. */
    roles: ['groom_immediate_family', 'bride_immediate_family'],
  },
  /*
    ⚖ OWNER 2026-09-20, verbatim order: "1. Maid of Honor & Best Man ... 2.
    Principal Sponsors ... 3. Secondary Sponsors ... 4. Bride's Crew & Groom's
    Crew ... 5. Bearers ... 6. Flower Girls", with family placed above all of
    them. The honour attendants therefore lead the entourage proper — they sat
    fourth until today, under both sponsor groups.
  */
  {
    key: 'honour',
    label: 'Maid of Honor & Best Man',
    /* ⚖ Owner 2026-09-30: "We can pick either best man or best woman and maid
       or matron of honor." `best_woman` stands where the best man stands — the
       groom's column — so she pairs across from the maid/matron exactly as he
       does. Nothing makes the pairs exclusive: a couple may have both. */
    roles: ['maid_of_honor', 'matron_of_honor', 'best_man', 'best_woman'],
    sides: [['maid_of_honor', 'matron_of_honor'], ['best_man', 'best_woman']],
    sideWords: ['Maid of Honor', 'Best Man'],
    unusual: ['best_woman'],
    headingForm: 'one',
    /* 🚂 Train 2026-09-30 (#6165 + #6170): a best woman makes the heading say
       "Best Woman" (`unusual`), so the heading names her too — no word beside
       her name. A Matron keeps hers: the column still reads "Maid of Honor". */
    headingNames: ['maid_of_honor', 'best_man', 'best_woman'],
  },
  {
    key: 'principal_sponsors',
    label: 'Principal Sponsors',
    /*
      ⚖ THREE ROLES, ONE GROUP. `principal_sponsor` was split into a Ninong and
      a Ninang half on 2026-09-14 (migration 20271225194308) so that pairing has
      halves to pair. The legacy value is KEPT and deliberately NOT backfilled —
      47 live rows hold it and gender is stored nowhere, `side` being which
      family rather than who — so all three must publish or a couple loses
      people from their invitation depending on which value they happened to
      use.

      🔴 THIS ENTRY IS THE FIX FOR A REAL, LIVE DEFECT. Between the split
      merging and this landing, a guest set to Ninong or Ninang was DROPPED from
      the invitation: the published-role list is also the query's `role.in.(…)`
      filter, so those rows were never even read. No error, no gap, the page
      looked perfect — and the 47 legacy rows kept printing, so it would not
      have shown on day one. It would have surfaced weeks later as "we changed
      her to Ninang and she vanished". `entourage-covers-the-cast.test.ts` is
      what stops the next role doing the same thing.
    */
    roles: ['principal_sponsor', 'principal_sponsor_ninong', 'principal_sponsor_ninang'],
    /* Ninong left, Ninang right — the order a Filipino invitation prints a pair.
       ⚠ The LEGACY `principal_sponsor` sits on the left with its right cell
       empty, and that is honest rather than tidy: gender is stored nowhere for
       those rows (`side` is which family, not who), so putting them on a side
       would be a guess printed on an invitation. A couple who wants them paired
       re-types the role; nothing here invents it for them. */
    sides: [['principal_sponsor', 'principal_sponsor_ninong'], ['principal_sponsor_ninang']],
    /* ⚖ OWNER 2026-09-30, looking at this section: *"the sub text Ninong can
       be removed"*. The heading says Principal Sponsors; a grey "Ninong" under
       every name said it again. All three roles are principal sponsors, so the
       heading names every one of them. */
    headingNames: ['principal_sponsor', 'principal_sponsor_ninong', 'principal_sponsor_ninang'],
    /* ⚖ OWNER 2026-09-30, asked how a pair should read once the role word was
       gone: option **1** — each Ninong with his paired Ninang on ONE line, on
       every screen size and on the printed card: "Hon. Ricardo & Mrs. Jessica
       Villahermosa". Supersedes the 2026-09-14 two-column pairing for this
       group; unpaired sponsors still list alone. */
    pairsOnOneLine: true,
  },
  {
    key: 'secondary_sponsors',
    label: 'Secondary Sponsors',
    roles: ['candle_sponsor', 'veil_sponsor', 'cord_sponsor', 'coin_sponsor'],
    /* ⚖ OWNER 2026-09-30: grouped BY ROLE — "Candle" once, the pair(s) under
       it — instead of "Candle Sponsor" beside every name. Here the role is the
       only thing that tells the pairs apart, so it moves up into a sub-heading
       rather than disappearing. */
    byRole: true,
  },
  /*
    ⚖ ONE GROUP, TWO COLUMNS — they were two separate groups until 2026-09-15.
    The owner's pairing ruling covers "sponsors AND the entourage", and a
    bridesmaid pairs with a GROOMSMAN — two different roles. While they were two
    groups, a pair could never share a row: each half sat under its own heading,
    and the pairing the couple had entered was invisible. They walk in pairs on
    the day; they print in pairs here.
  */
  {
    key: 'bridesmaids_groomsmen',
    // ⚖ Owner 2026-09-20: "Bride's Crew & Groom's Crew". Since 2026-09-30 no
    // role prints beside these names (see `headingNames` below); Bridesmaid /
    // Groomsman are still the words the dress code's "You are …" line uses.
    label: "Bride's Crew & Groom's Crew",
    roles: ['bridesmaid', 'groomsman'],
    sides: [['bridesmaid'], ['groomsman']],
    /* The Bride's crew ARE the bridesmaids, the Groom's crew the groomsmen —
       owner 2026-09-30 brief: no "Bridesmaid" repeated under each name. */
    headingNames: ['bridesmaid', 'groomsman'],
    // Owner 2026-09-30 option 1: a walking pair shares one line, as the sponsors do.
    pairsOnOneLine: true,
    // ⚖ Owner 2026-09-30: a couple who renames Bridesmaid prints THEIR word
    // here; an untouched column keeps "Bride's Crew" / "Groom's Crew".
    sideWords: ["Bride's Crew", "Groom's Crew"],
    headingForm: 'many',
  },
  /* ⚖ Owner 2026-09-20 split these into two headings ("5. Bearers ... 6. Flower
     Girls"). They shared one group until today, which printed a flower girl
     under a heading that called her a bearer. */
  {
    key: 'bearers',
    label: 'Bearers',
    roles: ['ring_bearer', 'bible_bearer', 'coin_bearer'],
  },
  {
    key: 'flower_girls',
    label: 'Flower Girls',
    roles: ['flower_girl'],
    headingNames: ['flower_girl'],
    headingIsRole: true,
  },
  {
    key: 'ceremony',
    label: 'The Ceremony',
    roles: ['officiant', 'reader_lector', 'soloist_musician'],
  },
  {
    key: 'nikah',
    label: 'The Nikah',
    roles: ['wali', 'witness', 'imam', 'wakil'],
  },
];

/**
 * The words beside each name. Singular, because it sits next to ONE person —
 * the group heading carries the plural.
 *
 * 🔑 A role with no label here cannot be printed: `roleLabel` returning null is
 * what keeps a future `GuestRole` from appearing on a guest's screen as a raw
 * enum value like `bride_immediate_family`.
 */
const ROLE_LABEL: Partial<Record<GuestRole, string>> = {
  bride_parents: 'Parents of the Bride',
  groom_parents: 'Parents of the Groom',
  /* Short on purpose: this sits BESIDE a name, and the heading above already
     says Immediate Family. The dashboard's longer "Bride's Immediate Family"
     is a picker label, where it has a dropdown to disambiguate in. */
  bride_immediate_family: "Bride's Family",
  groom_immediate_family: "Groom's Family",
  principal_sponsor: 'Principal Sponsor',
  /* The couple's own words, not the enum's. `guests.ts` labels these "Principal
     Sponsor (Ninong)" for the dashboard's role picker, where the prefix is what
     groups them in a long dropdown; on the invitation the bare word is what a
     Filipino guest reads, and the heading above already says Principal
     Sponsors. */
  principal_sponsor_ninong: 'Ninong',
  principal_sponsor_ninang: 'Ninang',
  candle_sponsor: 'Candle Sponsor',
  veil_sponsor: 'Veil Sponsor',
  cord_sponsor: 'Cord Sponsor',
  coin_sponsor: 'Coin Sponsor',
  maid_of_honor: 'Maid of Honor',
  matron_of_honor: 'Matron of Honor',
  best_man: 'Best Man',
  best_woman: 'Best Woman',
  bridesmaid: 'Bridesmaid',
  groomsman: 'Groomsman',
  ring_bearer: 'Ring Bearer',
  bible_bearer: 'Bible Bearer',
  coin_bearer: 'Coin Bearer',
  flower_girl: 'Flower Girl',
  officiant: 'Officiant',
  reader_lector: 'Reader',
  soloist_musician: 'Soloist',
  wali: 'Wali',
  witness: 'Witness',
  imam: 'Imam',
  wakil: 'Wakil',
};

/**
 * The label beside one name, or null when this role is not published.
 *
 * `names` is the event's `events.role_names` (owner 2026-09-30 — a couple may
 * call their bridesmaids "Bride's Crew"). The couple's word wins; the usual one
 * is the fallback. 🔑 The PUBLISHED check comes first and is not the couple's
 * to override: renaming a role never makes an unpublished role print.
 */
export function roleLabel(role: GuestRole, names?: RoleNames | null): string | null {
  const usual = ROLE_LABEL[role];
  if (!usual) return null;
  return roleNameOne(role, names) ?? usual;
}

/**
 * The heading over one printed group, in THIS couple's words.
 *
 * `present` is the set of roles actually printed in the group (so a column's
 * word describes who is standing in it). With no renames and no `unusual` role
 * present, the heading is byte-identical to the built-in `label` — a couple who
 * changed nothing sees nothing change.
 */
function groupHeading(
  spec: GroupSpec,
  names: RoleNames | null | undefined,
  present: ReadonlySet<string>,
): string {
  if (spec.headingIsRole && spec.roles.length === 1) {
    return roleNameMany(spec.roles[0], names) ?? spec.label;
  }
  if (!spec.sides || !spec.sideWords) return spec.label;
  const unusual = new Set<string>(spec.unusual ?? []);
  const words = spec.sides.map((sideRoles, i) => {
    const here = sideRoles.filter((r) => present.has(r));
    const custom = here.some((r) => roleNameOne(r, names) !== null || unusual.has(r));
    if (!custom) return spec.sideWords![i]!;
    const shown = here.map((r) =>
      (spec.headingForm === 'many' ? roleNameMany(r, names) : roleNameOne(r, names)) ??
      (ROLE_LABEL[r] as string),
    );
    return [...new Set(shown)].join(' / ');
  });
  return words.join(' & ');
}

/**
 * THE WORD BESIDE ONE NAME ON THE INVITATION — or null for none.
 *
 * ⚖ OWNER 2026-09-30, on the Principal Sponsors: *"the sub text Ninong can be
 * removed"*. A role is printed beside a name only when nothing else on the page
 * says it:
 *   · the heading already names it (`headingNames`) → no;
 *   · the group prints a sub-heading per role (`byRole`) → no, the sub-heading
 *     says it once;
 *   · everyone in the group holds the same role → no, the heading carries it;
 *   · otherwise (Parents, Immediate Family, Bearers, a Matron under "Maid of
 *     Honour & Best Man") → yes: there the word is the only way to tell two
 *     names apart.
 *
 * 🔑 THIS IS DISPLAY ONLY. `roleLabel` is untouched — the guest's own "You are
 * Ninang" line on the dress code, and screen readers (the component keeps the
 * role as visually-hidden text), still read it.
 */
export function roleBesideName(group: EntourageGroup, person: EntouragePerson): string | null {
  const spec = GROUPS.find((g) => g.key === group.key);
  if (spec?.byRole) return null;
  if (spec?.headingNames?.includes(person.role)) return null;
  const distinct = new Set(peopleOf(group).map((p) => p.role));
  if (distinct.size <= 1) return null;
  return parentBesideOne(person, group.names) ?? roleLabel(person.role, group.names);
}

/**
 * 👪 ONE NAME IS ONE PARENT (guest text audit 2026-09-30). "Parents of the
 * Bride" sat beside a single name — a plural beside one person. Beside ONE
 * name the word is singular: "Father of the Bride" / "Mother of the Bride"
 * when the typed title says which, "Parent of the Bride" when it does not
 * (nothing is guessed from a first name). The plural is for two, and the
 * group heading already carries it. The couple's own word still wins.
 */
function parentBesideOne(person: EntouragePerson, names: RoleNames | null | undefined): string | null {
  if (person.role !== 'bride_parents' && person.role !== 'groom_parents') return null;
  if (roleNameOne(person.role, names) !== null) return null;
  const side = person.role === 'bride_parents' ? 'Bride' : 'Groom';
  const who = person.parentWord === 'father' ? 'Father' : person.parentWord === 'mother' ? 'Mother' : 'Parent';
  return `${who} of the ${side}`;
}

/**
 * The short sub-heading word for a by-role group — "Candle", not "Candle
 * Sponsor": the section heading above already says Secondary Sponsors.
 */
const ROLE_SHORT: Partial<Record<GuestRole, string>> = {
  candle_sponsor: 'Candle',
  veil_sponsor: 'Veil',
  cord_sponsor: 'Cord',
  coin_sponsor: 'Coin',
};

/**
 * How a by-role group is drawn. Owner 2026-09-30 showed both:
 *   · `stacked` (B, the default) — "Candle" on its own line, the names under it;
 *   · `inline`  (A) — "Candle: names" on one line.
 * The Maker will offer this later as a Preset on the Entourage scene; until
 * then nothing passes it and every page is `stacked`.
 */
export type EntourageRoleLayout = 'stacked' | 'inline';
export const DEFAULT_ENTOURAGE_ROLE_LAYOUT: EntourageRoleLayout = 'stacked';

/** One sub-heading of a by-role group and the lines under it. */
export type EntourageRoleBlock = { key: string; label: string; rows: EntourageRow[] };

/**
 * A by-role group (Secondary Sponsors) as one block per role, in the order the
 * roles first appear in the group's printed lines — so a hand-set march order
 * still decides which role comes first, and every line keeps its place within
 * its role. Returns null for a group that does not print by role.
 *
 * A pair stays ONE line. A pair whose halves hold two different roles (a
 * candle sponsor paired with a veil sponsor) gets its own block labelled with
 * both — "Candle & Veil" — rather than splitting the pair or labelling one
 * half wrongly.
 */
export function roleBlocks(group: EntourageGroup): EntourageRoleBlock[] | null {
  const spec = GROUPS.find((g) => g.key === group.key);
  if (!spec?.byRole) return null;
  const blocks: EntourageRoleBlock[] = [];
  for (const row of group.rows) {
    const roles = [...new Set(row.filter((p): p is EntouragePerson => p !== null).map((p) => p.role))].sort(
      (a, b) => spec.roles.indexOf(a) - spec.roles.indexOf(b),
    );
    if (roles.length === 0) continue;
    const key = roles.join('+');
    let block = blocks.find((b) => b.key === key);
    if (!block) {
      const label = roles.map((r) => roleNameOne(r, group.names) ?? ROLE_SHORT[r] ?? roleLabel(r) ?? r).join(' & ');
      block = { key, label, rows: [] };
      blocks.push(block);
    }
    block.rows.push(row);
  }
  return blocks;
}

/**
 * Are two people a real COUPLE? A fact about the PEOPLE, read only from the
 * guest rows — never from the march.
 *
 * ⚖ OWNER 2026-09-30 / 2026-10-01 (DECISION_LOG "WALKING TOGETHER IS NOT BEING A
 * COUPLE" + "A WALK AND A COUPLE ARE INDEPENDENT"): walking beside someone
 * implies NOTHING about a relationship, and the march editor never sets or shows
 * it. A couple is exactly one of:
 *   · one is the other's +1 in the Guest list (`plus_one_of_guest_id`);
 *   · the partner link `couple_with_guest_id`, read as MUTUAL (A → B and B → A).
 * 🔑 A SHARED SURNAME IS NEVER EVIDENCE. Two Reyes sponsors are two people.
 * ⛔ `lineNames` does not ask this: a march line is both full names, always.
 */
export function isCouple(
  a: Pick<EntouragePerson, 'id' | 'plusOneOf' | 'coupleWith'> | null | undefined,
  b: Pick<EntouragePerson, 'id' | 'plusOneOf' | 'coupleWith'> | null | undefined,
): boolean {
  if (!a?.id || !b?.id || a.id === b.id) return false;
  if (a.plusOneOf === b.id || b.plusOneOf === a.id) return true;
  return a.coupleWith === b.id && b.coupleWith === a.id;
}

/**
 * The names of one printed line, a walk kept together, in the line's own order
 * (left then right — Ninong then Ninang, bridesmaid then groomsman).
 *
 * ⚖ OWNER 2026-10-01 (DECISION_LOG "A WALK AND A COUPLE ARE INDEPENDENT"):
 * *"the pair in the wedding march does not mean they are a couple."* Every march
 * line shows EACH PERSON'S OWN FULL NAME, couple or not — *"Dr. Eduardo Bautista
 * & Ms. Carmen Reyes"*, and a married ninong and ninang print as two full names
 * too. There is no couple short form in the march; titles stay exactly as
 * entered; someone walking alone is just their name.
 */
export function lineNames(row: EntourageRow): string {
  const [l, r] = row;
  if (l && r) return `${l.name} & ${r.name}`;
  return (l ?? r)?.name ?? '';
}

/** Does this group print a data-paired couple on ONE line? (Principal Sponsors, the crews.) */
export function pairsShareALine(group: EntourageGroup): boolean {
  return GROUPS.find((g) => g.key === group.key)?.pairsOnOneLine === true;
}

/**
 * THE COLUMNS EVERY ENTOURAGE READ ASKS FOR — named once, used by both routes.
 *
 * 🔑 TWO ROUTES READ THIS AND THEY MAY NOT DRIFT. `/[slug]` renders the section
 * and `/[slug]/everyone` renders the full page, and `_lib/loaders.ts` forbids
 * cross-route imports of its cached loaders ("the loaders assume this route's
 * gating has already run"), so each route runs its OWN query. The column list
 * is the one thing that must be identical — a column named in one and not the
 * other renders a DIFFERENT entourage on two pages of the same invitation,
 * with nothing red.
 *
 * ⚠ Every name here is load-bearing and each was added after it went missing:
 * the five name parts (a ninong printed without his "Atty."), then `guest_id`
 * and who walks with whom (every pair invisible).
 *
 * 🚶 THE MARCH IS ITS OWN TABLE (owner 2026-10-01, "THE WEDDING MARCH IS ITS OWN
 * ENTITY"). `march:march_walks(…)` embeds the person's ONE walk row through the
 * composite FK — it REPLACES the retired `pair_with_guest_id` + `entourage_order`
 * one for one, so every reader that printed pairs before still does. The public
 * pages read with the service role; a host reads under `march_walks`' own RLS.
 */
/**
 * ⚠ DO NOT WIDEN THIS FOR ONE READER. `lint:dup-rule` treats this list as the
 * reference for the `guests` table, so every column added here is a column
 * every OTHER guest read in the app now appears to be "dropping". Adding
 * `invited_to_blocks` for the walking-order panel's ceremony-only flag flagged
 * 32 unrelated reads — none of which had changed, and none of which needed it —
 * and put the column into the PUBLIC invitation's entourage query, which never
 * uses it. The one reader that needs an extra column asks for it itself:
 * `${ENTOURAGE_COLUMNS}, invited_to_blocks`.
 */
export const ENTOURAGE_COLUMNS =
  'guest_id, display_name, name_prefix, first_name, middle_name, last_name, name_suffix, role, extra_roles, march:march_walks(walk_no, place_in_walk)';

/**
 * + what `isCouple` reads — the guest-row facts about who is a couple, asked for
 * by the readers that print the entourage:
 * `${ENTOURAGE_COLUMNS}, ${ENTOURAGE_COUPLE_FIELDS}`.
 *
 * Deliberately NOT inside `ENTOURAGE_COLUMNS` (see its "DO NOT WIDEN" note) and
 * deliberately not named `*_COLUMNS`. The march never reads it (a march line is
 * both full names, always — `lineNames`).
 */
export const ENTOURAGE_COUPLE_FIELDS = 'plus_one_of_guest_id, couple_with_guest_id';

/** Every role the invitation publishes — the fence, as a set, for the reader. */
export const ENTOURAGE_ROLES: readonly GuestRole[] = GROUPS.flatMap((g) => [...g.roles]);

/** One `march_walks` row, as a guest read embeds it. */
export type MarchSpot = { walk_no: number; place_in_walk?: number | null };

/** The walk row of a guest read, whichever shape PostgREST returned it in. */
export function marchSpotOf(row: Pick<EntourageGuestRow, 'march'>): MarchSpot | null {
  const m = row.march;
  const spot = Array.isArray(m) ? (m as readonly MarchSpot[])[0] : (m as MarchSpot | null | undefined);
  return spot && typeof spot.walk_no === 'number' ? spot : null;
}

/** One guest row, reduced to what this builder reads. */
export type EntourageGuestRow = {
  guest_id?: string | null;
  /**
   * The person's ONE row in `march_walks` (embedded by `ENTOURAGE_COLUMNS`),
   * or null/absent when nobody has placed them. PostgREST hands a one-to-one
   * embed back as an object; an array is accepted too, so a change in how it
   * reports the relationship cannot silently unpair the whole march.
   */
  march?: MarchSpot | readonly MarchSpot[] | null;
  /** `guests.plus_one_of_guest_id` — see `ENTOURAGE_COUPLE_FIELDS` / `isCouple`. */
  plus_one_of_guest_id?: string | null;
  /** `guests.couple_with_guest_id` — the partner link. See `isCouple`. */
  couple_with_guest_id?: string | null;
  display_name?: string | null;
  name_prefix?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  name_suffix?: string | null;
  role?: string | null;
  extra_roles?: readonly string[] | null;
  /** `guests.invited_to_blocks` — a ceremony-only sponsor still walks. */
  invited_to_blocks?: readonly string[] | null;
};

/**
 * The name a guest is printed under — THE WHOLE NAME, prefix and all.
 *
 * 🔑 DELEGATED, NEVER RE-COMPOSED. `guestFullName` in lib/guests.ts is the one
 * place that knows the printed order of a name's five parts; a second copy here
 * would be a second mechanism answering one question, and they would disagree
 * the first time somebody added a part to only one of them.
 *
 * ⚠ RETURNS null RATHER THAN AN EMPTY LINE. A row with no usable name is
 * dropped, because a bullet with nothing beside it reads as a person whose name
 * we lost.
 *
 * 🔤 `style` — the event's Name style (`lib/name-style.ts`, owner 2026-09-30).
 * Omitted = Full, the line this printed before the style existed.
 */
export function personName(row: EntourageGuestRow, style?: NameStyle): string | null {
  return guestFullName(row, style);
}

/**
 * Build the printed list.
 *
 * A guest holding `extra_roles` appears once under EACH role they hold — a
 * bridesmaid who is also a candle sponsor stands in both places on a real
 * programme, and collapsing her to one would silently drop a role the couple
 * assigned on purpose.
 *
 * Within a group, names keep the order they arrive in; the caller sorts. Empty
 * groups are dropped, so the render never draws a heading over nothing.
 */
/**
 * Two people holding the SAME role, in a stable printed order.
 *
 * 🔑 THERE WAS NO ORDER AT ALL. Neither entourage query carries an `ORDER BY`,
 * so within one role the names arrived in whatever order Postgres happened to
 * return — which is not stable across page loads. An invitation that lists the
 * ninongs differently each time you open it is not a layout preference; it is
 * the page having no opinion. Surname then given name is the convention a
 * printed programme uses, and it is derived from columns
 * `ENTOURAGE_COLUMNS` already asks for.
 *
 * This is the DEFAULT, not the last word: when a couple can drag these into
 * their own order, that override sorts first and this stays as the tiebreak
 * for everyone who has not touched it.
 */
function comparePrinted(a: EntourageGuestRow, b: EntourageGuestRow): number {
  const by = (x?: string | null, y?: string | null) =>
    (x ?? '').localeCompare(y ?? '', 'en', { sensitivity: 'base' });

  /*
    ⚖ THE COUPLE'S OWN ORDER WINS, AND ONLY WHERE THEY GAVE ONE. A hand-placed
    name sorts above every unplaced one; two unplaced names fall through to the
    surname default below. A couple who drags three of their twelve ninongs
    gets exactly those three at the top, in their order, and an unsurprising
    alphabetical tail — rather than an all-or-nothing rule that would force
    them to place all twelve before the first drag meant anything.

    🔑 NULL IS NOT ZERO. Treating an unplaced name as 0 would silently rank it
    ABOVE everyone the couple actually placed.
  */
  const placed = (r: EntourageGuestRow) => marchSpotOf(r)?.walk_no ?? null;
  const pa = placed(a);
  const pb = placed(b);
  if (pa !== null && pb !== null && pa !== pb) return pa - pb;
  if (pa !== null && pb === null) return -1;
  if (pa === null && pb !== null) return 1;

  return (
    by(a.last_name, b.last_name) ||
    by(a.first_name, b.first_name) ||
    // Final tiebreak so two people with identical names never swap places.
    by(a.guest_id, b.guest_id)
  );
}

/**
 * Everyone holding one role, in the order the invitation prints them.
 *
 * 🔑 EXPORTED BECAUSE TWO SURFACES MUST AGREE. The public page prints this
 * order and the dashboard's Move ↑ / Move ↓ acts on it. If the dashboard
 * sorted even slightly differently — its own `sort` param, or the raw DB
 * order — then "move her up" would move whoever the DASHBOARD happened to show
 * above her, and the invitation would change somewhere the couple was not
 * looking. One rule, imported by both, is the only way that cannot happen.
 */
export function holdersOfRoleInPrintOrder(
  rows: readonly EntourageGuestRow[],
  role: string,
): EntourageGuestRow[] {
  return rows
    .filter((row) => row.role === role || (row.extra_roles ?? []).includes(role))
    .sort(comparePrinted);
}

/**
 * ⚖ OWNER 2026-09-20 — THE ORDER BELONGS TO THE LINE, NOT TO THE PERSON.
 *
 * A Filipino entourage walks in pairs, and a pair is ONE thing in a
 * processional: a ninong and his ninang step off together. Until now
 * `entourage_order` was compared inside a single ROLE, which could not express
 * that at all — ninong and ninang are two different roles, so "move her up"
 * moved her past other ninangs while he stayed where he was, and the pair came
 * apart on the page that exists to show them together.
 *
 * So the unit of ordering is the LINE: a walk, or a single who walks alone.
 * Since 2026-10-01 a line IS a walk (`march_walks`, owner: "the wedding march
 * is a different entity"): both people share one `walk_no`, and walks print in
 * `walk_no` order.
 *
 * 🔑 THIS IS NOT THE SEAT PLAN. `walk_no` is the line in the aisle;
 * `event_seat_assignments` + `seating_priority` are the chair. Moving a pair up
 * the processional must never move a chair, and nothing here touches one.
 *
 * Placed walks lead, in their own order; anyone with no walk yet falls back to
 * the role-then-surname default. `ignorePlacement` sorts EVERY line by that
 * default — what the Reset link hands a section back to (`defaultLineOrder`).
 */
function orderLines(
  lines: readonly EntourageRow[],
  spec: GroupSpec,
  ignorePlacement = false,
): EntourageRow[] {
  const lead = (ln: EntourageRow) => ln[0] ?? ln[1];
  /*
    🪤 THE ROLE CONVENTION SURVIVES THE MOVE TO LINES. `spec.roles` order is
    meaningful — ninong before ninang, maid before matron — and the first draft
    of this sorted unplaced lines by surname ALONE, which put Abad the ninang
    above Zamora the ninong and silently discarded it. An existing test caught
    that, and it was right to: changing the UNIT of ordering from the role to
    the line must not change the default ORDER within a group.
  */
  const rolePos = (ln: EntourageRow) => {
    const l = lead(ln);
    const at = l ? (spec.roles as readonly string[]).indexOf(l.role) : -1;
    return at === -1 ? Number.MAX_SAFE_INTEGER : at;
  };
  const placedAt = (ln: EntourageRow): number | null => {
    if (ignorePlacement) return null;
    for (const half of ln) {
      if (half && typeof half.walk === 'number') return half.walk;
    }
    return null;
  };
  return [...lines].sort((x, y) => {
    const px = placedAt(x);
    const py = placedAt(y);
    if (px !== null && py !== null && px !== py) return px - py;
    if (px !== null && py === null) return -1;
    if (px === null && py !== null) return 1;
    // Then the group's own role order, then the per-person comparator's
    // tiebreak applied to the line's lead.
    const rx = rolePos(x);
    const ry = rolePos(y);
    if (rx !== ry) return rx - ry;
    /* ⚖ Controller 2026-09-30: surname, then first name — never the printed
       string, whose first word is often a title ("Dr." sorted every doctor
       above "Antonio Garcia", and "Dr." above "Hon."). See `sortKeyOf`. */
    const by = (a?: string, b?: string) => (a ?? '').localeCompare(b ?? '', 'en', { sensitivity: 'base' });
    const kx = lead(x)?.sortKey;
    const ky = lead(y)?.sortKey;
    return (
      by(kx?.last, ky?.last) ||
      by(kx?.first, ky?.first) ||
      by(lead(x)?.name, lead(y)?.name) ||
      by(lead(x)?.id ?? '', lead(y)?.id ?? '')
    );
  });
}

/**
 * One printed group's LINES, in the order the invitation prints them.
 *
 * 🔑 EXPORTED BECAUSE THREE SURFACES MUST AGREE — the invitation, the dashboard
 * panel that reorders it, and the action behind Move ↑. If any of them derived
 * its own order, "move this pair up" would swap it with whatever a DIFFERENT
 * surface happened to show above it.
 */
export function entourageLines(
  rows: readonly EntourageGuestRow[],
  groupKey: string,
  /** The event's Name style — omitted = Full. It changes the WORDS, never the order. */
  style?: NameStyle,
): EntourageRow[] {
  const spec = GROUPS.find((g) => g.key === groupKey);
  if (!spec) return [];
  return orderLines(pairUp(peopleForSpec(rows, spec, style), spec.sides), spec);
}

/**
 * A section's lines in the DEFAULT order — the group's role order, then
 * surname — whatever their walks say. The Reset link writes this order back as
 * the section's walk numbers (`clearEntourageOrder`); who walks with whom is
 * kept, only the order is handed back.
 */
export function defaultLineOrder(lines: readonly EntourageRow[], groupKey: string): EntourageRow[] {
  const spec = GROUPS.find((g) => g.key === groupKey);
  if (!spec) return [...lines];
  return orderLines(lines, spec, true);
}

/** Has the couple arranged this section — does it print in anything but the default order? (Drives Reset.) */
export function linesAreArranged(lines: readonly EntourageRow[], groupKey: string): boolean {
  const lead = (ln: EntourageRow) => (ln[0] ?? ln[1])?.id ?? '';
  const fallback = defaultLineOrder(lines, groupKey);
  return lines.some((ln, i) => lead(ln) !== lead(fallback[i]!));
}

/** Every printed group key, in printing order. */
export const ENTOURAGE_GROUP_KEYS: readonly string[] = GROUPS.map((g) => g.key);

/** Every printed group's key and heading, in printing order. */
export const ENTOURAGE_GROUP_LIST: ReadonlyArray<{ key: string; label: string }> =
  GROUPS.map((g) => ({ key: g.key, label: g.label }));

/**
 * The heading the invitation prints above a group — never a raw key.
 *
 * Pass the event's `names` and the group's `rows` and the heading is the
 * couple's (see `groupHeading`); omit them and it is the built-in heading.
 */
export function entourageGroupLabel(
  key: string,
  names?: RoleNames | null,
  rows?: readonly EntourageGuestRow[] | null,
): string | null {
  const spec = GROUPS.find((g) => g.key === key);
  if (!spec) return null;
  if (!rows) return groupHeading(spec, names, new Set(spec.roles));
  const present = new Set<string>();
  for (const line of entourageLines(rows, key)) for (const p of line) if (p) present.add(p.role);
  return groupHeading(spec, names, present);
}

/** Which printed group a role belongs to, or null when it never prints. */
export function entourageGroupOfRole(role: string): string | null {
  return GROUPS.find((g) => (g.roles as readonly string[]).includes(role))?.key ?? null;
}

/**
 * Which printed column a role stands in within a group — 0 left, 1 right — or
 * null when the group has ONE side and a pair fills left-then-right.
 *
 * Exported for the Wedding March's drag-and-tap moves (`lib/march-moves.ts`):
 * "can she take that empty place?" is only honest if it asks the same rule
 * `pairUp` prints by. A second copy of the side lists would agree today and
 * drift the first time a role moves.
 */
export function columnOfRole(groupKey: string, role: string): 0 | 1 | null {
  const spec = GROUPS.find((g) => g.key === groupKey);
  if (!spec?.sides) return null;
  return sideOf({ role: role as GuestRole }, spec.sides);
}

/** 'father' / 'mother' from the typed title (prefix, else the display name's first word). */
function parentWordOf(row: EntourageGuestRow): 'father' | 'mother' | null {
  const title = (row.name_prefix ?? row.display_name?.trim().split(/\s+/)[0] ?? '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  if (title === 'mr') return 'father';
  if (title === 'mrs' || title === 'ms' || title === 'miss') return 'mother';
  return null;
}

/** The people of one group, in `spec.roles` order — the sequence pairing sees. */
function peopleForSpec(
  rows: readonly EntourageGuestRow[],
  spec: GroupSpec,
  style?: NameStyle,
): EntouragePerson[] {
  const people: EntouragePerson[] = [];
  for (const role of spec.roles) {
    for (const row of holdersOfRoleInPrintOrder(rows, role)) {
      const name = personName(row, style);
      if (!name) continue;
      people.push({
        id: row.guest_id ?? null,
        name,
        role,
        walk: marchSpotOf(row)?.walk_no ?? null,
        place: marchSpotOf(row)?.place_in_walk ?? 0,
        plusOneOf: row.plus_one_of_guest_id ?? null,
        coupleWith: row.couple_with_guest_id ?? null,
        ceremonyOnly: isCeremonyOnly(row),
        sortKey: sortKeyOf(row, name),
        parentWord: parentWordOf(row),
      });
    }
  }
  return people;
}

/**
 * Titles and suffixes that must never decide an order. Only used on the
 * FALLBACK path — a row with name parts sorts by `last_name` / `first_name`,
 * which never contain a title.
 */
const LEADING_TITLE =
  /^(?:(?:mr|mrs|ms|miss|mx|dr|dra|hon|atty|engr|arch|rev|fr|msgr|sr|sra|srta|gen|col|capt|maj|lt|prof|judge|justice|sen|gov|mayor|rep|dean|sis|bro)\.?\s+)+/i;
const TRAILING_SUFFIX = /(?:,?\s+(?:jr|sr|ii|iii|iv|v)\.?)+$/i;

/**
 * ⚖ CONTROLLER 2026-09-30: a title never decides order. An unplaced line
 * sorts by SURNAME, then first name — "Dr. Eduardo Bautista" before "Antonio
 * Garcia", and "Hon." never ahead of "Dr." on the title alone. Name parts
 * where the row has them; only when `last_name` is missing, the printed name
 * minus a leading title and a trailing suffix stands in as the surname key.
 */
function sortKeyOf(row: EntourageGuestRow, printed: string): { last: string; first: string } {
  const last = row.last_name?.trim();
  if (last) return { last, first: row.first_name?.trim() ?? '' };
  const bare = printed.replace(LEADING_TITLE, '').replace(TRAILING_SUFFIX, '').trim();
  return { last: bare || printed, first: '' };
}

/**
 * Invited to the ceremony and nothing else.
 *
 * ⚖ Owner 2026-09-20: such a sponsor "prints normally and shows ceremony only ·
 * not at the reception". They are a guest like any other — they simply have no
 * chair, which is a fact about the seat plan and not a reason to hide them from
 * the processional.
 */
function isCeremonyOnly(row: EntourageGuestRow): boolean {
  const blocks = row.invited_to_blocks;
  return Array.isArray(blocks) && blocks.length === 1 && blocks[0] === 'ceremony';
}

/**
 * The Wedding March's SECTION order for one event.
 *
 * ⚖ Owner 2026-09-21: *"we should be able to arrange the parents, immediate
 * family and other roles and modify its sequence."* `saved` is
 * `events.entourage_section_order` — the couple's keys, or NULL for never
 * arranged.
 *
 * 🔑 FORGIVING BY DESIGN. A saved list is a snapshot of the groups that existed
 * when the couple arranged them. Keys this build no longer knows are dropped;
 * groups the list lacks (added since) are appended in the built-in order. So a
 * stale value can never hide a section, duplicate one, or print a heading for
 * nothing — and there is no SQL copy of the key set to drift.
 */
export function orderedGroupKeys(saved?: readonly string[] | null): string[] {
  const known = new Set(ENTOURAGE_GROUP_KEYS);
  const out: string[] = [];
  for (const key of saved ?? []) {
    if (known.has(key) && !out.includes(key)) out.push(key);
  }
  for (const key of ENTOURAGE_GROUP_KEYS) if (!out.includes(key)) out.push(key);
  return out;
}

/** Has the couple arranged the sections themselves? (Drives the Reset control.) */
export function sectionsAreArranged(saved?: readonly string[] | null): boolean {
  const mine = orderedGroupKeys(saved);
  return mine.some((key, i) => key !== ENTOURAGE_GROUP_KEYS[i]);
}

export function buildEntourage(
  rows: readonly EntourageGuestRow[],
  /** `events.entourage_section_order` — omitted or NULL prints the built-in order. */
  sectionOrder?: readonly string[] | null,
  /** `events.role_names` — the couple's words for roles (owner 2026-09-30). Omitted → the usual words. */
  names?: RoleNames | null,
  /** `events.print_details.name_style` — the event's Name style (owner 2026-09-30). Omitted → Full. */
  style?: NameStyle,
): EntourageGroup[] {
  const groups: EntourageGroup[] = [];
  const byKey = new Map(GROUPS.map((g) => [g.key, g]));
  for (const key of orderedGroupKeys(sectionOrder)) {
    const spec = byKey.get(key)!;
    // The SAME function the dashboard reorders with — see `entourageLines`.
    const built = entourageLines(rows, spec.key, style);
    if (built.length === 0) continue;
    const present = new Set<string>();
    for (const line of built) for (const p of line) if (p) present.add(p.role);
    groups.push({ key: spec.key, label: groupHeading(spec, names, present), rows: built, names: names ?? {} });
  }
  return groups;
}

/** Which column a person belongs in, or null when the group has one side. */
function sideOf(
  person: Pick<EntouragePerson, 'role'>,
  sides: GroupSpec['sides'],
): 0 | 1 | null {
  if (!sides) return null;
  if (sides[0].includes(person.role)) return 0;
  if (sides[1].includes(person.role)) return 1;
  /* A role in the group but on neither side. Left column — visible and
     unpaired — rather than dropped. Losing somebody from an invitation to keep
     a layout tidy is the trade this whole module exists to refuse. */
  return 0;
}

/**
 * Lay a group out as printed lines.
 *
 * ⚖ OWNER 2026-09-14: *"two columns, paired across. but if the other side is
 * left blank, then keep that line blank."*
 * ⚖ OWNER 2026-10-01: who walks with whom is the march's own row
 * (`march_walks`) — the people of this group sharing a `walk` are one line.
 *
 * · A walk whose people are in this group shares one line, each in the column
 *   their role says (or by `place` when the group has no sides — two candle
 *   sponsors hold the same role and nothing in it can say which side anyone is
 *   on).
 * · Everyone else keeps their own line, in their own column, with the other
 *   cell empty — including anyone with no walk yet.
 * · 🔑 A WALK THAT SPANS TWO GROUPS IS NOT A PAIR ON THE PAGE. Each person
 *   prints in their own group, alone. That is why bridesmaids and groomsmen were
 *   merged into ONE group: while they were two, every bridesmaid↔groomsman pair
 *   the couple had entered was invisible, and nothing said so.
 * · A walk of three or more in one group (the table allows it; no move here
 *   writes it) prints its first two together and the rest alone — "show
 *   everybody", never "drop one".
 */
function pairUp(people: readonly EntouragePerson[], sides: GroupSpec['sides']): EntourageRow[] {
  const byWalk = new Map<number, EntouragePerson[]>();
  for (const p of people) {
    if (typeof p.walk !== 'number') continue;
    const walkers = byWalk.get(p.walk) ?? [];
    walkers.push(p);
    byWalk.set(p.walk, walkers);
  }
  for (const walkers of byWalk.values()) walkers.sort((a, b) => a.place - b.place);

  const placed = new Set<EntouragePerson>();
  const out: EntourageRow[] = [];

  for (const person of people) {
    if (placed.has(person)) continue;
    placed.add(person);
    const mate =
      typeof person.walk === 'number'
        ? byWalk.get(person.walk)!.find((w) => w !== person && !placed.has(w))
        : undefined;

    if (mate) {
      placed.add(mate);
      const [a, b] = person.place <= mate.place ? [person, mate] : [mate, person];
      // The left column holds whoever's role says left; with no sides, `place` decides.
      if (sideOf(a, sides) === 1 && sideOf(b, sides) !== 1) out.push([b, a]);
      else out.push([a, b]);
      continue;
    }

    out.push(sideOf(person, sides) === 1 ? [null, person] : [person, null]);
  }
  return out;
}

/**
 * THE GUESTS WHO HOLD NO ROLE — the other half of "everyone who will be there".
 *
 * ⚖ OWNER 2026-09-15, asked who may read these names: **guests and hosts only.**
 * The entourage is invitation content and is public; a plain guest's name is
 * not. On a PUBLIC event page "everybody" means anyone with the link and the
 * search engines behind them — and 77 people who never agreed to that.
 *
 * 🔑 THE GATE IS THE CALLER'S, NOT THIS FUNCTION'S, and that is deliberate.
 * This is pure shaping; it cannot see a session and must not pretend to. The
 * page decides whether to ASK for these names at all, so a refusal is a read
 * that never happens rather than a filter somebody can forget to apply.
 *
 * ⛔ The couple themselves are excluded — their names are the masthead, and
 * printing them in a guest list reads as a mistake.
 */
export function plainGuestNames(rows: readonly EntourageGuestRow[], style?: NameStyle): string[] {
  const cast = new Set<string>(ENTOURAGE_ROLES);
  const names: string[] = [];
  for (const row of rows) {
    const role = row.role ?? '';
    if (cast.has(role) || role === 'bride' || role === 'groom') continue;
    if ((row.extra_roles ?? []).some((r) => cast.has(r))) continue;
    const name = personName(row, style);
    if (name) names.push(name);
  }
  return names;
}
