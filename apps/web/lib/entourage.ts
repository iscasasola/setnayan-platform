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
  /** Already-composed display name. Never assembled from parts in here. */
  name: string;
  /** The role this appearance is for — a guest with `extra_roles` appears once per role. */
  role: GuestRole;
};

export type EntourageGroup = {
  /** Stable key, for the render's list identity and for tests. */
  key: string;
  /** The heading a guest reads — "Principal Sponsors", "Bridesmaids". */
  label: string;
  people: EntouragePerson[];
};

/**
 * The roles this list prints, in the order it prints them, grouped the way an
 * invitation groups them.
 *
 * ⚠ EXHAUSTIVE OVER NOTHING ON PURPOSE. A `GuestRole` absent from here is
 * absent from the invitation — `guest`, `vip`, `family`, `helper` and the
 * generic non-wedding roles are not entourage and must never be published as
 * one. Adding a role to `GuestRole` therefore does NOT silently publish it.
 */
const GROUPS: ReadonlyArray<{ key: string; label: string; roles: readonly GuestRole[] }> = [
  { key: 'parents', label: 'Parents', roles: ['bride_parents', 'groom_parents'] },
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
  },
  {
    key: 'secondary_sponsors',
    label: 'Secondary Sponsors',
    roles: ['candle_sponsor', 'veil_sponsor', 'cord_sponsor', 'coin_sponsor'],
  },
  {
    key: 'honour',
    label: 'Maid of Honour & Best Man',
    roles: ['maid_of_honor', 'matron_of_honor', 'best_man'],
  },
  { key: 'bridesmaids', label: 'Bridesmaids', roles: ['bridesmaid'] },
  { key: 'groomsmen', label: 'Groomsmen', roles: ['groomsman'] },
  {
    key: 'bearers',
    label: 'Bearers & Flower Girls',
    roles: ['ring_bearer', 'bible_bearer', 'coin_bearer', 'flower_girl'],
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

/** Every role the invitation publishes — the fence, as a set, for the reader. */
export const ENTOURAGE_ROLES: readonly GuestRole[] = GROUPS.flatMap((g) => [...g.roles]);

/** One guest row, reduced to what this builder reads. */
export type EntourageGuestRow = {
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
export function buildEntourage(rows: readonly EntourageGuestRow[]): EntourageGroup[] {
  const groups: EntourageGroup[] = [];
  for (const spec of GROUPS) {
    const people: EntouragePerson[] = [];
    for (const role of spec.roles) {
      for (const row of rows) {
        const held = row.role === role || (row.extra_roles ?? []).includes(role);
        if (!held) continue;
        const name = personName(row);
        if (!name) continue;
        people.push({ name, role });
      }
    }
    if (people.length > 0) groups.push({ key: spec.key, label: spec.label, people });
  }
  return groups;
}
