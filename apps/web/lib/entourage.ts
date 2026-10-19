import { guestFullName, guestRoleLabel, type GuestRole } from '@/lib/guests';
import { roleNameMany, roleNameOne, sectionName, type RoleNames } from '@/lib/role-names';
import type { NameStyle } from '@/lib/name-style';
import { genderOfTitleWords, womanOrManOf, type TitleGender } from '@/lib/guest-title';

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
   * 'father' / 'mother' when the couple's own entry for THIS person says so — or, for one of exactly two parents
   * (grandparents) of a side, when the OTHER one's entry says the opposite word — else null. See `parentWordOf` and
   * `withThePairInferred`. Gender is not stored; nothing is guessed from a first name.
   */
  parentWord?: KinWord | null;
  /**
   * Woman / man as the couple entered it — picked WITH the title ("Atty. (Woman)", `guests.gender`), else a title
   * word that says it. Null when nothing does. Decides a LEGACY principal sponsor's column (`sideOf`). Never printed.
   */
  gender?: TitleGender | null;
  /** `guests.side`, when the read asked for it (the march's walk side — `walkSideOf`). */
  side?: string | null;
  /**
   * 🚶 In the march's "Not walking" tray (`march_not_walking`, owner 2026-10-06).
   * They still PRINT under their role — every print ignores this; only the
   * walking ORDER (`marchPlaceOf`, "You walk Nth") leaves them out.
   */
  notWalking?: true;
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
  /** The heading a guest reads — "Principal Sponsors", "Bridesmaids & Groomsmen" — or the couple's own word for it ("VIP"). */
  label: string;
  /**
   * 🏷 The heading as it reads WITHOUT the couple's section word — present only when they renamed this section (owner
   * 2026-10-19, "Immediate Family" → "VIP"). What "empty = the usual word" gives back; the Maker's Edit shows it as the
   * field's placeholder.
   */
  usual?: string;
  /** The printed lines, in order. */
  rows: EntourageRow[];
  /**
   * The role words this group was built with (`events.role_names`, owner
   * 2026-09-30). Carried so every renderer labels a person with the SAME words
   * the heading used: `roleLabel(person.role, group.names)`. `{}` = usual words.
   */
  names: RoleNames;
  /**
   * 🏷 THE TWO COLUMNS' WORDS — `[left, right]`, or absent when the group has no sides or only one column holds
   * anybody. Read-only, for the page's two-column styles (On the axis · Lines, owner 2026-10-15): one small row
   * at the head of the group says each side ONCE ("Ninong | Ninang", "Bride's Crew | Groom's Crew"). Built from the
   * SAME words the heading uses (`groupHeading`), so a role the couple renamed shows their word here too.
   */
  sideWords?: readonly [string, string];
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
  /** A group of data-paired couples — ONE line on the printed card, two columns on the page (2026-10-14). See `pairsShareALine`. */
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
  /**
   * 🚶 A SECTION OF THE WEDDING MARCH ONLY — never printed (owner 2026-10-06:
   * *"wedding march handles everyone including the groom and the bride … and
   * the parents"*). The Maker's march maker draws it (the builder with `{ march:
   * true }`); the invitation, The Entourage card and every public read never
   * see it, so `ENTOURAGE_ROLES` — the published fence — is unchanged. `at` says
   * where it walks: first or LAST, whatever order the printed sections are in.
   */
  marchOnly?: { at: 'first' | 'last' };
  /**
   * 🚶 Print the group's ROLE order before its walks' order (owner 2026-10-06).
   * "Parents" is walked in two march sections — the groom's side FIRST, the
   * bride's side LAST — so its print can never put the bride's parents first:
   * each side keeps the order its own march section gives it. Without this a
   * reorder on one side (which hands a never-placed groom a fresh, highest walk
   * number) could flip the printed Parents.
   */
  roleFirst?: true;
  /** A one-role group whose heading IS that role's plural ("Flower Girls"): the couple's `many` replaces it. */
  headingIsRole?: boolean;
  /**
   * 👵 A group added AFTER couples could arrange their sections (owner 2026-09-21): where it goes in a saved
   * `events.entourage_section_order` that predates it — right after this group — instead of the end. Every save
   * writes the full list, so the only keys a saved order ever lacks are groups added since. See `orderedGroupKeys`.
   */
  joinsSavedOrderAfter?: string;
};

const GROUPS: ReadonlyArray<GroupSpec> = [
  /*
    🚶 OWNER 2026-10-06 — THE MARCH IS EVERYONE WHO WALKS: "the groom (and his
    parents) … the bride (and her parents) — the bride LAST." The couple are guest
    rows (`role` 'groom' / 'bride', the singleton roles), so the march reads them
    like anyone else; their walks live in `march_walks` like anyone else's. In
    the MARCH these two sections take the place of "Parents" (each parent walks
    with their own child's side); the PRINTED list keeps "Parents" and never
    names the couple (they are the masthead — `plainGuestNames`).
  */
  {
    key: 'groom_side',
    label: 'The Groom & his parents',
    roles: ['groom_parents', 'groom'],
    marchOnly: { at: 'first' },
  },
  /*
    ⚖ OWNER 2026-09-20: the groom's parents print FIRST. This group's `roles`
    order IS the printed order — `buildEntourage` walks `spec.roles` outermost —
    so the swap below is the whole change, and nothing in the component decides
    it.
  */
  { key: 'parents', label: 'Parents', roles: ['groom_parents', 'bride_parents'], roleFirst: true },
  /*
    👵 OWNER 2026-10-17: *"the 2 grandparents should not be named immediate
    family on the wedding march list."* Asked "Grandparents of the Bride /
    Groom as roles, the same way Parents works (own heading, own march place,
    each reads 'Grandmother of the Groom' etc.)", he answered "Okay". So this
    group is Parents' twin: right after Parents and BEFORE Immediate Family,
    the groom's side first (the 2026-09-20 Parents ruling), print in role order
    (`roleFirst`), and each person named per person by the SAME resolver as a
    parent (`parentBesideOne` → "Grandfather / Grandmother / Grandparent of the
    Groom"). In the march it is not replaced by the couple's sides (only the
    parents walk with their child), so it walks right after "The Groom & his
    parents".

    🔴 THIS IS A VISIBILITY CHANGE, NOT A LAYOUT ONE — the same note as
    Immediate Family below, and the same class as Parents. `ENTOURAGE_ROLES` is
    derived from this list and is also the query's `role.in.(…)` filter, so a
    grandparent's real name is readable by anyone who can open the invitation
    — the entourage section is NOT behind the recognised-viewer gate that
    hides the plain guest list. Nothing new is exposed on day one: every
    grandparent recorded until today holds `*_immediate_family`, which already
    publishes; a couple who re-picks the role moves the name from one heading
    to another. `landing_page_visibility` remains the only control that closes
    that door.

    ⛔ A GRANDPARENT IS NEVER "IMMEDIATE FAMILY" ON ANY LOOK — held by
    `lib/grandparents-are-never-immediate-family.test.ts`.
  */
  {
    key: 'grandparents',
    label: 'Grandparents',
    roles: ['groom_grandparents', 'bride_grandparents'],
    roleFirst: true,
    /* A couple who arranged their sections before today has no "grandparents" in that list: it joins after THEIR
       Parents, wherever they put Parents — never after the Nikah. */
    joinsSavedOrderAfter: 'parents',
  },
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
       does. Nothing makes the pairs exclusive: a couple may have both.
       🤵‍♂️ Owner 2026-10-19: "maid/matron/man of honor … like bestman and best
       woman". `man_of_honor` stands where the maid stands — the bride's column —
       the mirror of the best woman, and like her (`unusual`) he makes the
       heading name him: "Man of Honor & Best Man". */
    roles: ['maid_of_honor', 'matron_of_honor', 'man_of_honor', 'best_man', 'best_woman'],
    sides: [['maid_of_honor', 'matron_of_honor', 'man_of_honor'], ['best_man', 'best_woman']],
    sideWords: ['Maid of Honor', 'Best Man'],
    unusual: ['best_woman', 'man_of_honor'],
    headingForm: 'one',
    /* 🚂 Train 2026-09-30 (#6165 + #6170): a best woman makes the heading say
       "Best Woman" (`unusual`), so the heading names her too — no word beside
       her name. A Matron keeps hers: the column still reads "Maid of Honor". */
    headingNames: ['maid_of_honor', 'man_of_honor', 'best_man', 'best_woman'],
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
       group; unpaired sponsors still list alone.
       ⚖ OWNER 2026-10-14, on the Wedding March scene's Roll call: *"The names
       feel too crowded. Maybe have their pairing show in 2 columns without the
       &."* — on the PAGE a pair is two columns again, now holding at 375
       (`PairRow`, `entourage-section.tsx`); the printed card keeps option 1. */
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
    // A walking pair is drawn as the sponsors' are: one line on the card, two columns on the page (owner 2026-10-14).
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
  {
    key: 'bride_side',
    label: 'The Bride & her parents',
    roles: ['bride_parents', 'bride'],
    marchOnly: { at: 'last' },
  },
];

/** The printed groups — what the invitation, the card and every public read know. */
const PRINTED = GROUPS.filter((g) => !g.marchOnly);
/** The march's own sections (the couple's sides). */
const MARCH_ONLY = GROUPS.filter((g) => g.marchOnly);
/** Printed groups the march draws inside the couple's sides instead ("Parents"). */
const MARCH_REPLACED = new Set(
  PRINTED.filter((g) => g.roles.every((r) => MARCH_ONLY.some((m) => m.roles.includes(r)))).map((g) => g.key),
);

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
  /* 👵 Owner 2026-10-17. Beside ONE name a grandparent is named per person
     (`parentBesideOne`); this plural is what two whose entries say neither
     grandfather nor grandmother share on one march line. */
  bride_grandparents: 'Grandparents of the Bride',
  groom_grandparents: 'Grandparents of the Groom',
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
  man_of_honor: 'Man of Honor',
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
  /* 🏷 THE COUPLE'S WORD FOR THE SECTION WINS (owner 2026-10-19: *"Immediate Family change it to VIP"*). The one place
     a section heading is decided — every surface that prints one reads it through here (`buildEntourage`,
     `entourageGroupLabel`, the Wedding March's own sections) and `role-groups.ts` reads the SAME word through
     `sectionName`. Empty / never renamed = the heading below, byte-identical to before. */
  return sectionName(spec.key, names) ?? usualGroupHeading(spec, names, present);
}

/** The heading in the couple's ROLE words only — what a section reads with no word of its own. */
function usualGroupHeading(
  spec: GroupSpec,
  names: RoleNames | null | undefined,
  present: ReadonlySet<string>,
): string {
  if (spec.headingIsRole && spec.roles.length === 1) {
    return roleNameMany(spec.roles[0], names) ?? spec.label;
  }
  if (!spec.sides || !spec.sideWords) return spec.label;
  return columnWordLists(spec, names, present)
    .map((words) => words.join(' / '))
    .join(' & ');
}

/**
 * Each column's words, `[left, right]` — the heading's own rule, shared with `sideWordsOf`. A column the couple did
 * not rename (and holding no `unusual` role) is its usual `sideWords` word; otherwise the words of the roles
 * standing in it. A sided group with no `sideWords` (Principal Sponsors, whose heading is a category) is always the
 * words of the roles standing in each column ("Ninong", "Ninang").
 */
function columnWordLists(
  spec: GroupSpec,
  names: RoleNames | null | undefined,
  present: ReadonlySet<string>,
): string[][] {
  const unusual = new Set<string>(spec.unusual ?? []);
  return (spec.sides ?? []).map((sideRoles, i) => {
    const here = sideRoles.filter((r) => present.has(r));
    const custom = here.some((r) => roleNameOne(r, names) !== null || unusual.has(r));
    if (spec.sideWords && !custom) return [spec.sideWords[i]!];
    const shown = here.map((r) =>
      (spec.headingForm === 'many' ? roleNameMany(r, names) : roleNameOne(r, names)) ??
      (ROLE_LABEL[r] as string),
    );
    return [...new Set(shown)];
  });
}

/** The group's two column words (see `EntourageGroup.sideWords`) — null with no sides, or a column nobody stands in. */
function sideWordsOf(
  spec: GroupSpec,
  names: RoleNames | null | undefined,
  present: ReadonlySet<string>,
): readonly [string, string] | null {
  if (!spec.sides || !spec.sides.every((roles) => roles.some((r) => present.has(r)))) return null;
  const [l, r] = columnWordLists(spec, names, present).map((words) => words.join(' · '));
  return l && r ? [l, r] : null;
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
  /* 👪 A PARENT IS NAMED PER PERSON ON EVERY LOOK (owner 2026-10-17: *"It needs to be identified as the mother or
     father of the bride or groom."*). Before the one-role check on purpose: a page holding only the groom's parents
     is one role, and the heading "Parents" says neither whose nor which. A grandparent the same way (owner
     2026-10-17, "Grandmother of the Groom"). */
  const parent = parentBesideOne(person, group.names);
  if (parent) return parent;
  const distinct = new Set(peopleOf(group).map((p) => p.role));
  if (distinct.size <= 1) return null;
  return roleLabel(person.role, group.names);
}

/**
 * 🧍 THE WORD UNDER SOMEONE CENTRED ALONE ON THE AXIS (controller 2026-10-17, found live on /maria-and-jose after
 * #6593) — or null for none.
 *
 * A centred name stands in neither column, and the column words are drawn only over a pair, so in a group whose
 * HEADING names its two columns ("Maid of Honor & Best Man", "Bride's Crew & Groom's Crew" — a spec with
 * `sideWords`) a lone person could be either. He carries the word his column would have said. A group whose heading
 * is a category (Principal Sponsors) or that says the role per sub-heading (Secondary Sponsors) adds nothing — the
 * owner's 2026-09-30 "the sub text Ninong can be removed" holds.
 */
export function loneRoleWord(group: EntourageGroup, person: EntouragePerson): string | null {
  const beside = roleBesideName(group, person);
  if (beside) return beside;
  const spec = GROUPS.find((g) => g.key === group.key);
  if (!spec?.sideWords || !spec.sides) return null;
  const side = sideOf(person, spec.sides) ?? 0;
  const words = columnWordLists(spec, group.names, new Set([person.role]))[side] ?? [];
  return words.length ? words.join(' · ') : null;
}

/**
 * THE WORDS UNDER ONE MARCH LINE, in name order — e.g. "Father of the Groom · Mother of the Groom", "Ninong · Ninang".
 *
 * Each parent — and each grandparent — is named per person (owner 2026-10-17); any other word is said once
 * ("Bridesmaid", not twice). People on one line who are the SAME word share it in the plural (`kinWordForSeveral`):
 * "Grandmothers of the Groom", "Mothers of the Bride", and two whose entries say neither father nor mother
 * "Parents of the Groom" / "Grandparents of the Groom": a
 * singular beside two names is the defect "ONE NAME IS ONE PARENT" was written against, and repeating it twice
 * says nothing more.
 */
export function marchLineWords(people: readonly EntouragePerson[], group: Pick<EntourageGroup, 'names' | 'label'>): string {
  const parentWords = people.map((p) => parentBesideOne(p, group.names));
  const shared = kinWordForSeveral(parentWords);
  if (shared) return shared;
  const words: string[] = [];
  people.forEach((p, i) => {
    const w = parentWords[i] ?? roleLabel(p.role, group.names) ?? group.label;
    if (parentWords[i] || !words.includes(w)) words.push(w);
  });
  return words.join(' · ');
}

/**
 * THE WORD UNDER SOMEONE WHO STANDS ALONE, CENTRED (Lines, owner 2026-10-15) — or null for none.
 *
 * A centred name sits in neither column, so the column words cannot say what he is: he carries his own role word
 * ("Ninong", "Maid of Honor"). Where `roleBesideName` already gives one, that is it. Only a group whose people all
 * hold one role (Flower Girls) carries none — its heading already says it.
 */
export function entourageCellWord(group: EntourageGroup, person: EntouragePerson): string | null {
  const beside = loneRoleWord(group, person);
  if (beside) return beside;
  if (GROUPS.find((g) => g.key === group.key)?.byRole) return null;
  const distinct = new Set(peopleOf(group).map((p) => p.role));
  return distinct.size > 1 ? roleLabel(person.role, group.names) : null;
}

/**
 * 👪 ONE NAME IS ONE PARENT (guest text audit 2026-09-30). "Parents of the
 * Bride" sat beside a single name — a plural beside one person. Beside ONE
 * name the word is singular: "Father of the Bride" / "Mother of the Bride"
 * when the couple's entry says which (title, attire — or the other of the two
 * parents, `withThePairInferred`), "Parent of the Bride" when nothing does
 * (nothing is guessed from a first name). The plural is for two, and the
 * group heading already carries it. The couple's own word still wins.
 */
function parentBesideOne(person: EntouragePerson, names: RoleNames | null | undefined): string | null {
  const kin = KIN_OF_ROLE[person.role];
  if (!kin) return null;
  if (roleNameOne(person.role, names) !== null) return null;
  const who = person.parentWord === 'father' ? 'father' : person.parentWord === 'mother' ? 'mother' : 'parent';
  const word = kin.grand ? `Grand${who}` : who.charAt(0).toUpperCase() + who.slice(1);
  return `${word} of the ${kin.side}`;
}

/**
 * 👪 ONE READER'S OWN KIN WORD, by the SAME per-person resolver the entourage prints with (controller 2026-10-17, the
 * owner's #6598 ruling "each parent named per person"): the Dress code's "You are …" reads "You are Father of the
 * Bride", never "Parents of the Bride". Title → attire (`parentWordOf`), then the word (`parentBesideOne`) —
 * "Parent of the Bride" when nothing says which; null for a role that is not a parent / grandparent, or one the couple
 * renamed (their word wins, as it does beside a name).
 */
export function kinWordOfReader(
  role: GuestRole,
  /* 👤 `gender` too (owner 2026-10-19, cale-ice: an "Atty. (Woman)" mother of the groom read "Parent of the Groom" on
     her Me page because only title and attire reached here) — the same row the entourage prints with. */
  person: Pick<EntourageGuestRow, 'name_prefix' | 'display_name' | 'attire'> & { gender: string | null | undefined },
  names?: RoleNames | null,
): string | null {
  return parentBesideOne({ role, parentWord: parentWordOf(person as EntourageGuestRow) } as EntouragePerson, names);
}

/**
 * 👪 ONE GUEST'S OWN ROLE WORD, as every "you" line says it (the Welcome's "You're joining us as …", Event details'
 * "Your role") — their kin word by the one per-person resolver (`kinWordOfReader`: gender → title → attire), else the
 * role's own word. Owner 2026-10-19: the groom's "Atty. (Woman)" mother is "Mother of the Groom" on every line.
 */
export function roleWordOfGuest(
  guest: { role: GuestRole; name_prefix?: string | null; display_name?: string | null; gender?: string | null; attire?: string | null },
  names?: RoleNames | null,
): string {
  const g = guest.gender === 'woman' || guest.gender === 'man' ? guest.gender : null;
  return (
    kinWordOfReader(guest.role, { name_prefix: guest.name_prefix ?? null, display_name: guest.display_name ?? null, attire: guest.attire ?? null, gender: g }, names) ??
    guestRoleLabel(guest.role, names)
  );
}

/**
 * 👪 SEVERAL PEOPLE ON ONE LINE WHO ARE THE SAME WORD SAY IT ONCE, IN THE PLURAL (controller 2026-10-17, on #6600: the
 * owner's two grandmothers, both "Ms.", read "Grandmother of the Groom · Grandmother of the Groom"). Two mothers of
 * the bride → "Mothers of the Bride"; two grandfathers → "Grandfathers of the Bride"; two whose entries say neither →
 * "Parents / Grandparents of the …" (the older plural, now the same rule). Null when any person has no kin word, or
 * the words differ — those stay "X · Y", one per person.
 */
function kinWordForSeveral(words: readonly (string | null)[]): string | null {
  if (words.length < 2 || !words.every(Boolean) || new Set(words).size !== 1) return null;
  return words[0]!.replace(/^(\S+) of the /, '$1s of the ');
}

/**
 * 👵 THE ROLES NAMED PER PERSON, and whose: a parent, and — owner 2026-10-17 — a grandparent, read by the one
 * resolver (`parentBesideOne`, the per-person word; `parentWordOf`, father/mother from the couple's own entry).
 * "Grandfather / Grandmother of the Groom", "Grandparent of the Groom" when nothing says which.
 */
const KIN_OF_ROLE: Partial<Record<GuestRole, { side: 'Bride' | 'Groom'; grand: boolean }>> = {
  bride_parents: { side: 'Bride', grand: false },
  groom_parents: { side: 'Groom', grand: false },
  bride_grandparents: { side: 'Bride', grand: true },
  groom_grandparents: { side: 'Groom', grand: true },
};

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

/**
 * Is this a group of data-paired couples? (Principal Sponsors, the crews.) The
 * printed card draws each pair as ONE line (2026-09-30 option 1); the page's
 * Roll call draws it as two columns with no "&" (owner 2026-10-14).
 */
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

/**
 * + what tells a parent's "Mother of the Groom" from "Father of the Groom" when the title cannot (`parentWordOf`):
 * the woman / man picked WITH the title ("Atty. (Woman)", `guests.gender`, owner 2026-10-17), then the guest card's
 * attire pick. Asked by the readers that print the entourage, beside the couple fields —
 * `${ENTOURAGE_COLUMNS}, ${ENTOURAGE_COUPLE_FIELDS}, ${ENTOURAGE_PARENT_FIELDS}` — never inside `ENTOURAGE_COLUMNS`
 * (its "DO NOT WIDEN" note).
 */
export const ENTOURAGE_PARENT_FIELDS = 'attire, gender';

/** Every role the invitation publishes — the fence, as a set, for the reader. */
export const ENTOURAGE_ROLES: readonly GuestRole[] = PRINTED.flatMap((g) => [...g.roles]);

/** Everyone the Wedding MARCH reads — the published roles + the couple (`marchOnly`). */
export const MARCH_ROLES: readonly GuestRole[] = [...new Set(GROUPS.flatMap((g) => [...g.roles]))];

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
  /** `guests.attire` ('neutral' · 'gown' · 'suit') — asked by `ENTOURAGE_PARENT_FIELDS`; see `parentWordOf`. */
  attire?: string | null;
  /** `guests.gender` ('woman' · 'man' · null) — picked with the title; asked by `ENTOURAGE_PARENT_FIELDS`. */
  gender?: string | null;
  /**
   * `guests.side` ('groom' · 'bride' · 'both') — read by the Wedding MARCH only
   * (its walk side, owner 2026-10-06 "Brides crew should be on right and grooms
   * crew on the left"); never asked by a print, which keeps its own columns.
   */
  side?: string | null;
  /** 🚶 Marked by the reader that asked `march_not_walking` — see `EntouragePerson.notWalking`. */
  not_walking?: boolean;
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
    if (spec.roleFirst) {
      const rx = rolePos(x);
      const ry = rolePos(y);
      if (rx !== ry) return rx - ry;
    }
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
 * surname — whatever their walks say. A Reset would write this order back as
 * the section's walk numbers, keeping who walks with whom (the panel's Reset was
 * retired with it on 2026-10-06; the drag maker's Undo hands back one move).
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
export const ENTOURAGE_GROUP_KEYS: readonly string[] = PRINTED.map((g) => g.key);

/** Every section a march move may name — the printed groups + the march's own (`readMarchLines`). */
export const MARCH_GROUP_KEYS: readonly string[] = GROUPS.map((g) => g.key);

/** Every printed group's key and heading, in printing order. */
export const ENTOURAGE_GROUP_LIST: ReadonlyArray<{ key: string; label: string }> =
  PRINTED.map((g) => ({ key: g.key, label: g.label }));

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

/**
 * 🏷 Every section a couple may give its own heading (owner 2026-10-19) — every printed group and the march's own
 * sides ("The Groom & his parents"): each is a heading somebody reads.
 */
export const RENAMABLE_SECTION_KEYS: readonly string[] = MARCH_GROUP_KEYS;

/** May the couple give this section its own heading? (The sanitiser's `isKnownSection`.) */
export function isRenamableSection(key: string): boolean {
  return RENAMABLE_SECTION_KEYS.includes(key);
}

/**
 * A section's heading WITHOUT the couple's word for it — what an empty field gives back ("Immediate Family"), in their
 * role words where the heading is built from them. Null for an unknown key.
 */
export function sectionUsualHeading(key: string, names?: RoleNames | null): string | null {
  const spec = GROUPS.find((g) => g.key === key);
  // Every role but the `unusual` ones: a best woman nobody holds must not make the usual heading name her.
  return spec ? usualGroupHeading(spec, names, new Set(spec.roles.filter((r) => !spec.unusual?.includes(r)))) : null;
}

/** Which printed group a role belongs to, or null when it never prints. */
export function entourageGroupOfRole(role: string): string | null {
  return PRINTED.find((g) => (g.roles as readonly string[]).includes(role))?.key ?? null;
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

/**
 * 'father' / 'mother' from what the couple entered for THIS person, else null:
 *   0. the woman / man picked WITH the title — "Atty. (Woman)" (`guests.gender`, owner 2026-10-17: "let them choose
 *      Atty (Female) or Atty (Male)") — FIRST, whenever it is set;
 *   1. the typed title — every title word of the prefix, then the display name's leading title words — Mr. → father;
 *      Mrs., Ms., Miss → mother. A professional or honorific title (Atty., Dr., Engr., Hon., Judge, USec., Comm.,
 *      Gen., Ombudsman …) is NOT a gender word: it is stepped over, so "Atty. Mrs. Luz Abad" is still a mother
 *      (`titleWordsOf`, lib/guest-title.ts — one reading for the resolver and the Guests page's prompt);
 *   2. else the guest card's "Attire · 3D seat plan" pick (`guests.attire`) — Gown → mother, Suit → father.
 * Nothing of these → null, and then the PAIR may still tell (`withThePairInferred`, in `kinWordsOfHolders`): gender →
 * title → attire → pair → the neutral word. Nothing is guessed from a first name. `needsWomanOrMan`
 * (lib/guest-title.ts) lists exactly the people steps 0–1 leave null.
 */
export function parentWordOf(row: EntourageGuestRow): KinWord | null {
  /* 👤 Steps 0–2 are the one per-person reading (`womanOrManOf`, lib/guest-title.ts): gender → title → attire. */
  const said = womanOrManOf(row);
  return said === 'woman' ? 'mother' : said === 'man' ? 'father' : null;
}

export type KinWord = 'father' | 'mother';
const OTHER_KIN: Record<KinWord, KinWord> = { father: 'mother', mother: 'father' };

/* The title words that say (and do not say) father or mother, and how a row's are read, live in lib/guest-title.ts
   (`titleWordsOf`, `genderOfTitleWords`) — ONE reading for this resolver and the Guests page's prompt. */

/**
 * 👪 THE OTHER PARENT IS NAMED (owner 2026-10-17, live /cale-ice: "Mr. … — FATHER OF THE GROOM" beside "Atty. … —
 * PARENT OF THE GROOM"; the owner's word: "mother of the groom").
 *
 * `words` are what each holder of ONE kin role (one side's parents, or one side's grandparents) says on their own
 * entry. When they are exactly TWO and one says father / mother while the other says nothing, the other is the
 * other word. Nobody whose own entry says something is ever changed; two unknowns stay unknown ("Parents of the …");
 * one person alone, or three or more, are left exactly as their entries say.
 */
function withThePairInferred(words: readonly (KinWord | null)[]): (KinWord | null)[] {
  if (words.length !== 2) return [...words];
  const [a, b] = words as [KinWord | null, KinWord | null];
  if (a && !b) return [a, OTHER_KIN[a]];
  if (b && !a) return [OTHER_KIN[b], b];
  return [a, b];
}

/** Everyone who holds `role` and prints (has a name), in print order — with each one's kin word, pair included. */
function kinWordsOfHolders(
  rows: readonly EntourageGuestRow[],
  role: GuestRole,
  style?: NameStyle,
): Array<{ row: EntourageGuestRow; name: string; word: KinWord | null }> {
  const holders = holdersOfRoleInPrintOrder(rows, role).flatMap((row) => {
    const name = personName(row, style);
    return name ? [{ row, name }] : [];
  });
  /* gender → title → attire → PAIR → the neutral word. The attire is the couple's own entry about THIS person, so
     the pair (an inference from the other holder) never overrides it — #6611's rule, "nobody whose own entry says
     something is ever changed", held by grandparents-are-never-immediate-family.test.ts (a Mr. beside an Atty. in a
     Suit are two grandfathers). */
  const own = holders.map((h) => parentWordOf(h.row));
  const words = KIN_OF_ROLE[role] ? withThePairInferred(own) : own;
  return holders.map((h, i) => ({ ...h, word: words[i] ?? null }));
}

/** The people of one group, in `spec.roles` order — the sequence pairing sees. */
function peopleForSpec(
  rows: readonly EntourageGuestRow[],
  spec: GroupSpec,
  style?: NameStyle,
): EntouragePerson[] {
  const people: EntouragePerson[] = [];
  for (const role of spec.roles) {
    /* 👪 One role's holders together, so the pair can name the other parent (`withThePairInferred`). */
    for (const { row, name, word } of kinWordsOfHolders(rows, role, style)) {
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
        parentWord: word,
        gender: row.gender === 'woman' || row.gender === 'man' ? row.gender : genderOfTitleWords(row),
        ...(row.side !== undefined ? { side: row.side } : {}),
        ...(row.not_walking ? { notWalking: true as const } : {}),
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
 * groups the list lacks (added since) are appended in the built-in order — or,
 * for a group that names one (`joinsSavedOrderAfter`), placed right after that
 * group. So a stale value can never hide a section, duplicate one, or print a
 * heading for nothing — and there is no SQL copy of the key set to drift.
 */
export function orderedGroupKeys(saved?: readonly string[] | null): string[] {
  const known = new Set(ENTOURAGE_GROUP_KEYS);
  const out: string[] = [];
  for (const key of saved ?? []) {
    if (known.has(key) && !out.includes(key)) out.push(key);
  }
  for (const key of ENTOURAGE_GROUP_KEYS) {
    if (out.includes(key)) continue;
    const after = saved ? out.indexOf(PRINTED.find((g) => g.key === key)?.joinsSavedOrderAfter ?? '') : -1;
    if (after === -1) out.push(key);
    else out.splice(after + 1, 0, key);
  }
  return out;
}

/**
 * 🚶 THE MARCH'S SECTION ORDER — the printed order (the couple's own, else the
 * built-in), with the couple's sides in their place: the groom's side FIRST, the
 * bride's side LAST, and the printed groups they stand in for ("Parents") not
 * drawn twice. Owner 2026-10-06: *"Groom + his parents first, bride + her
 * parents last."*
 */
export function marchGroupKeys(saved?: readonly string[] | null): string[] {
  const middle = orderedGroupKeys(saved).filter((k) => !MARCH_REPLACED.has(k));
  const at = (where: 'first' | 'last') => MARCH_ONLY.filter((g) => g.marchOnly!.at === where).map((g) => g.key);
  return [...at('first'), ...middle, ...at('last')];
}

/** Is this section the march's own (never printed)? */
export function isMarchOnlyGroup(key: string): boolean {
  return MARCH_ONLY.some((g) => g.key === key);
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
  /** 🚶 The Maker's march: the couple's sides too (`marchGroupKeys`). Omitted → what prints. */
  opts?: { march?: boolean },
): EntourageGroup[] {
  const groups: EntourageGroup[] = [];
  const byKey = new Map(GROUPS.map((g) => [g.key, g]));
  for (const key of opts?.march ? marchGroupKeys(sectionOrder) : orderedGroupKeys(sectionOrder)) {
    const spec = byKey.get(key)!;
    // The SAME function the dashboard reorders with — see `entourageLines`.
    const built = entourageLines(rows, spec.key, style);
    if (built.length === 0) continue;
    const present = new Set<string>();
    for (const line of built) for (const p of line) if (p) present.add(p.role);
    const sideWords = sideWordsOf(spec, names, present);
    const renamed = sectionName(spec.key, names) !== null;
    groups.push({
      key: spec.key,
      label: groupHeading(spec, names, present),
      ...(renamed ? { usual: usualGroupHeading(spec, names, present) } : {}),
      rows: built,
      names: names ?? {},
      ...(sideWords ? { sideWords } : {}),
    });
  }
  return groups;
}

/** Which column a person belongs in, or null when the group has one side. */
function sideOf(
  person: Pick<EntouragePerson, 'role' | 'gender'>,
  sides: GroupSpec['sides'],
): 0 | 1 | null {
  if (!sides) return null;
  /* 👔 A LEGACY principal sponsor (from before the Ninong / Ninang split) whose entry SAYS woman or man — picked with
     the title ("Atty. (Woman)"), or a Mr. / Mrs. — stands in that column: no longer a guess (owner 2026-10-17). One
     whose entry says neither keeps the left column, as before. */
  if (person.role === 'principal_sponsor' && person.gender) {
    const col = sides.findIndex((s) => s.includes(person.gender === 'woman' ? 'principal_sponsor_ninang' : 'principal_sponsor_ninong'));
    if (col === 0 || col === 1) return col;
  }
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
 * "ALSO COMING" MEANS THEY SAID YES.
 *
 * A guest's walk, 2026-10-11 (fault N19): the page's "Also coming" list was
 * every plain guest ON THE LIST — people who had not replied, people who had
 * declined, and the reader themself before they had answered. A name under
 * "coming" is a statement about that person, and the only one who can make it
 * is the person: their own yes (`guests.rsvp_status = 'attending'`). Not
 * replied, maybe and declined are not "coming".
 *
 * Pure, and the caller's read asks for the one extra column itself
 * (`${ENTOURAGE_COLUMNS}, rsvp_status`) — see the "DO NOT WIDEN" note above.
 * WHO may read these names at all is still the 2026-09-15 ruling and still the
 * page's gate (`plainGuestNames` below): this only decides WHICH names.
 */
export function guestsWhoSaidYes<T extends { rsvp_status?: string | null }>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.rsvp_status === 'attending');
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
