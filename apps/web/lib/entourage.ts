import { guestFullName, type GuestRole } from '@/lib/guests';

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
  /** Their partner's guest id, when the couple paired them. */
  pairId: string | null;
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
};

const GROUPS: ReadonlyArray<GroupSpec> = [
  { key: 'parents', label: 'Parents', roles: ['bride_parents', 'groom_parents'] },
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
    roles: ['bride_immediate_family', 'groom_immediate_family'],
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
    label: 'Maid of Honour & Best Man',
    roles: ['maid_of_honor', 'matron_of_honor', 'best_man'],
    sides: [['maid_of_honor', 'matron_of_honor'], ['best_man']],
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
  },
  {
    key: 'secondary_sponsors',
    label: 'Secondary Sponsors',
    roles: ['candle_sponsor', 'veil_sponsor', 'cord_sponsor', 'coin_sponsor'],
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
    // ⚖ Owner 2026-09-20: "Bride's Crew & Groom's Crew". The roles beside each
    // name stay Bridesmaid / Groomsman — only the heading is the couple's word.
    label: "Bride's Crew & Groom's Crew",
    roles: ['bridesmaid', 'groomsman'],
    sides: [['bridesmaid'], ['groomsman']],
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
  maid_of_honor: 'Maid of Honour',
  matron_of_honor: 'Matron of Honour',
  best_man: 'Best Man',
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

/** The label beside one name, or null when this role is not published. */
export function roleLabel(role: GuestRole): string | null {
  return ROLE_LABEL[role] ?? null;
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
 * and `pair_with_guest_id` (every pair invisible).
 */
export const ENTOURAGE_COLUMNS =
  'guest_id, pair_with_guest_id, display_name, name_prefix, first_name, middle_name, last_name, name_suffix, role, extra_roles';

/** Every role the invitation publishes — the fence, as a set, for the reader. */
export const ENTOURAGE_ROLES: readonly GuestRole[] = GROUPS.flatMap((g) => [...g.roles]);

/** One guest row, reduced to what this builder reads. */
export type EntourageGuestRow = {
  guest_id?: string | null;
  /** `guests.pair_with_guest_id` — written ONLY through the `pair_guests` /
   *  `unpair_guest` SQL functions, which write both halves in one statement.
   *  Never write this column directly: mutuality is not expressible as a row
   *  constraint, so two round trips leave a half-pair. */
  pair_with_guest_id?: string | null;
  display_name?: string | null;
  name_prefix?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  name_suffix?: string | null;
  role?: string | null;
  extra_roles?: readonly string[] | null;
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
 */
export function personName(row: EntourageGuestRow): string | null {
  return guestFullName(row);
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
  return (
    by(a.last_name, b.last_name) ||
    by(a.first_name, b.first_name) ||
    // Final tiebreak so two people with identical names never swap places.
    by(a.guest_id, b.guest_id)
  );
}

export function buildEntourage(rows: readonly EntourageGuestRow[]): EntourageGroup[] {
  const groups: EntourageGroup[] = [];
  for (const spec of GROUPS) {
    const people: EntouragePerson[] = [];
    for (const role of spec.roles) {
      // Sorted per ROLE, never across the group: the role order inside `spec`
      // is itself meaningful (ninong before ninang, maid before matron), so
      // sorting the whole group by name would discard it.
      const holders = rows
        .filter((row) => row.role === role || (row.extra_roles ?? []).includes(role))
        .sort(comparePrinted);
      for (const row of holders) {
        const name = personName(row);
        if (!name) continue;
        people.push({ id: row.guest_id ?? null, name, role, pairId: row.pair_with_guest_id ?? null });
      }
    }
    const built = pairUp(people, spec.sides);
    if (built.length > 0) groups.push({ key: spec.key, label: spec.label, rows: built });
  }
  return groups;
}

/** Which column a person belongs in, or null when the group has one side. */
function sideOf(
  person: EntouragePerson,
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
 *
 * · A pair whose two halves are BOTH in this group shares one line, each in the
 *   column their role says (or first-then-partner when the group has no sides —
 *   two candle sponsors hold the same role and nothing in it can say which side
 *   anyone is on).
 * · Everyone else keeps their own line, in their own column, with the other
 *   cell empty.
 * · 🔑 A PAIR THAT SPANS TWO GROUPS IS NOT A PAIR ON THE PAGE. Each half prints
 *   in its own group, unpartnered. That is why bridesmaids and groomsmen were
 *   merged into ONE group: while they were two, every bridesmaid↔groomsman pair
 *   the couple had entered was invisible, and nothing said so.
 * · A half-pair — A points at B, B points at nobody or at someone else — still
 *   prints both people, once each. The SQL functions make that unreachable by
 *   writing both halves in one statement; this is what the page does if one
 *   ever appears anyway, and it is "show everybody", never "drop one".
 */
function pairUp(people: readonly EntouragePerson[], sides: GroupSpec['sides']): EntourageRow[] {
  const byId = new Map<string, EntouragePerson>();
  for (const p of people) if (p.id) byId.set(p.id, p);

  const placed = new Set<EntouragePerson>();
  const out: EntourageRow[] = [];

  for (const person of people) {
    if (placed.has(person)) continue;
    const partner = person.pairId ? byId.get(person.pairId) : undefined;
    /* Mutual only. A dangling pointer prints as two singles rather than
       silently adopting somebody who is paired elsewhere. */
    const mutual = partner && partner !== person && partner.pairId === person.id ? partner : null;

    if (mutual && !placed.has(mutual)) {
      placed.add(person);
      placed.add(mutual);
      const mine = sideOf(person, sides);
      if (mine === 1) out.push([mutual, person]);
      else out.push([person, mutual]);
      continue;
    }

    placed.add(person);
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
export function plainGuestNames(rows: readonly EntourageGuestRow[]): string[] {
  const cast = new Set<string>(ENTOURAGE_ROLES);
  const names: string[] = [];
  for (const row of rows) {
    const role = row.role ?? '';
    if (cast.has(role) || role === 'bride' || role === 'groom') continue;
    if ((row.extra_roles ?? []).some((r) => cast.has(r))) continue;
    const name = personName(row);
    if (name) names.push(name);
  }
  return names;
}
