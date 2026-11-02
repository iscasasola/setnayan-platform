/**
 * apps/web/lib/sample-event/snapshot.ts
 *
 * 🎭 THE MARIA AND JOSE SAMPLE — ITS ONE READ PATH (owner GO 2026-11-02; corpus
 * SAMPLE_EVENT_BUILD_BRIEF_2026-11-02.md item 8).
 *
 * A signed-out stranger opens `/sample` with no login. Everything they see is
 * served from HERE — fixtures in this module (later a cached snapshot) — and
 * never from a real table:
 *
 *   · NO DATABASE. This file imports no Supabase client, no `server-only`
 *     reader, nothing that can reach a row. RLS is unchanged; there is no
 *     anonymous policy to add because nothing asks.
 *   · ONE KEY. `readSampleEvent(key)` answers for exactly `SAMPLE_EVENT_ID` and
 *     returns `null` for anything else — a real event's uuid, its S89E public
 *     id, its slug, even the sample's own slug. A page under /sample that is
 *     handed a key passes it through here and 404s on `null`.
 *   · A KEY THAT IS NO REAL ID. `SAMPLE_EVENT_ID` carries a `:` — no uuid, no
 *     `S89E-…` public id and no slug (`[a-z0-9-]`) can contain one — so the
 *     sample id can never name, match or cast to a real event's row. Handed to
 *     any server action by mistake, Postgres refuses it before RLS is asked.
 *   · NO SERVER ACTION KNOWS IT. No `'use server'` module imports this file;
 *     sample edits (slice S3) live in the visitor's sessionStorage only.
 *
 * Held by `app/sample/the-sample-is-sealed.test.ts` (both directions, the
 * action seal, noindex, the sitemaps, the app shell) and
 * `lib/sample-event/sample-event.test.ts`.
 *
 * S1 carried the shape and the keys. S2 (this slice) carries the CONTENT: the
 * 50 guests and their entourage, the six tables and every seat, the chapters
 * and the minute-level run of show with call times, the Wedding March order,
 * the light warm Classic theme in ivory · blush · plum · gold, and the dress
 * code with real hex colours. ⚠ NO DATE IS STORED: the wedding is the nearest
 * Saturday on or after today + 3 months (`./date.ts`), and every time below is
 * a wall-clock on THAT day — so the sample is always in preparation, whatever
 * day it is opened. `./hub.ts` turns these rows into the props the SHIPPED
 * Event Hub components read (`EntourageSection`, `ScheduleWidget`,
 * `YourSeatBlock`, `DressCodeWidget`, `GuestTicket`).
 *
 * Every person here is FICTIONAL: no real name, no email, no phone, no photo,
 * no payment. The names are the maria-and-jose cast the older seeds and the
 * Maker lab already use (`scripts/seed-sample-event-maria-jose*.sql`,
 * `app/dev/maker-lab/guest/lab-sample.ts`), re-cast to the brief's 17 + 33.
 *
 * The only imports are TYPE-ONLY (erased at build): the fixtures borrow the
 * Hub's row types so they cannot drift from what its components read.
 */

import type { GuestRow } from '@/app/[slug]/_lib/types';
import type { GuestGroupCategory, GuestRole, GuestSide, RsvpStatus } from '@/lib/guests';
import type { TableType } from '@/lib/seating';

/** The sample's one key. The `:` makes it impossible as a uuid, public id or slug. */
export const SAMPLE_EVENT_ID = 'sample:maria-and-jose';

/** The persona a stranger can step into (brief item 11: cousin · the bride's sister · host). */
export type SamplePersonaKey = 'guest' | 'guest-with-role' | 'host';

export type SamplePersona = {
  key: SamplePersonaKey;
  /** Who they are, in the visitor's words. */
  title: string;
  /** One line under the title. */
  line: string;
  /** The fixture guest they open as; null for the host. */
  guestKey: string | null;
};

/** The sample's six tables (brief item 4: 5–6 tables, one VIP). */
export type SampleTableKey = 'vip' | 't2' | 't3' | 't4' | 't5' | 't6';

export type SampleTable = {
  key: SampleTableKey;
  /** `event_tables.table_label`, as a guest reads it. */
  label: string;
  tableType: TableType;
  capacity: number;
  /** The VIP table (brief: the maid of honor sits there). */
  vip: boolean;
  /** Where it stands on the floor plan, in PERCENT of the room (as `event_tables.x_pos` / `y_pos`). */
  x: number;
  y: number;
};

/**
 * 🎫 A sample guest, in the Event Hub's OWN row shape (`GuestRow`, app/[slug]/_lib/types.ts),
 * so `/sample/hub/[guestKey]` hands it straight to the shipped [slug] Hub and ticket
 * components — never a second, drawn copy of them — plus the sample's own facts the
 * Hub reads from other tables (the seat, the march walk, the partner link).
 *
 * `guest_id` is `sample:<guestKey>` — like the event id, no uuid or `S89G-` id can
 * contain a `:`, so a sample guest can never name, match or cast to a real row.
 */
export type SampleGuest = Pick<
  GuestRow,
  'guest_id' | 'first_name' | 'last_name' | 'display_name' | 'role' | 'side' | 'group_category' | 'plus_one_of_guest_id' | 'plus_one_mode' | 'plus_one_allowed'
> & {
  /** The address key: `/sample/hub/<guestKey>`. */
  guestKey: string;
  name_prefix: string | null;
  rsvp_status: RsvpStatus;
  /** `guests.attire` — how the 3D figure and the dress code dress them. */
  attire: 'gown' | 'suit';
  gender: 'woman' | 'man';
  /** The named +1 (`guests.plus_one_name`) — only on the bringer. */
  plus_one_name: string | null;
  /** `guests.couple_with_guest_id` — a sponsor couple walks and prints as a pair. */
  couple_with_guest_id: string | null;
  /** Their seat: the table and the 1-based seat number (`event_seat_assignments`). */
  table: SampleTableKey;
  seat: number;
  /** Their place in the Wedding March (`march_walks.walk_no` / `place_in_walk`), or null — they do not walk. */
  walk: { no: number; place: number } | null;
  /** What the guest list says they are to the couple — the host's own note, never shown to a guest. */
  relation: string;
};

/** One moment of the run of show, on the wedding day (`HH:MM`, the venue's clock). */
export type SampleMoment = { key: string; label: string; at: string; until: string | null; spot: string | null };

/** A chapter of the day — a top-level schedule block that is on the invitation, with its moments under it. */
export type SampleChapter = {
  key: string;
  label: string;
  at: string;
  until: string;
  location: string;
  spot: string | null;
  moments: readonly SampleMoment[];
};

export type SampleEventSnapshot = {
  /** Always `SAMPLE_EVENT_ID` — never a real event's id. */
  id: typeof SAMPLE_EVENT_ID;
  displayName: string;
  /** The sample is always in preparation; it never reaches the day (DECISION_LOG 2026-11-02). */
  stage: 'preparation';
  personas: readonly SamplePersona[];
  /** Every sample guest, by address key — all 50. */
  guests: Readonly<Record<string, SampleGuest>>;
  couple: { bride: { first: string; last: string }; groom: { first: string; last: string } };
  /** The free Classic look (`house`) dressed in the couple's four colours. */
  theme: 'house';
  /** The four colours, named — the dress code's palette and the Mood Board's. */
  colours: { ivory: string; blush: string; plum: string; gold: string; ink: string };
  /** `events.role_palette` — the Mood Board, by role group. */
  rolePalette: Readonly<Record<string, readonly string[]>>;
  /** `events.dress_code_config` — the couple's dress code, with every role group's call time. */
  dressCode: Readonly<Record<string, unknown>>;
  tables: readonly SampleTable[];
  /** `events.entourage_section_order` — the march as a Filipino church wedding walks it. */
  entourageSectionOrder: readonly string[];
  chapters: readonly SampleChapter[];
  /** When guests are asked to arrive (`HH:MM`) — half an hour before the march; a role's own call time wins over it. */
  guestsArrive: string;
  /**
   * 🪑 THE SAMPLE'S "SEATS PUBLISHED" OVERRIDE (brief item 4). A real event shows a guest
   * their table only on the day (`guestsMaySeeSeatsFor`). The sample is never on the day,
   * so it says — HERE, as a fact of the sample, never by faking the date — that its seats
   * are published: the Hub, the ticket and the Wallet preview show Table and Seat.
   */
  seatsPublished: true;
};

const PERSONAS: readonly SamplePersona[] = [
  {
    key: 'guest',
    title: 'The bride’s cousin',
    line: 'A guest with a plus-one. Her pass, her seat and the day’s schedule.',
    guestKey: 'sample-guest-bride-cousin',
  },
  {
    key: 'guest-with-role',
    title: 'The bride’s sister',
    line: 'The maid of honor. Her role, her table and when she walks.',
    guestKey: 'sample-guest-maid-of-honor',
  },
  {
    key: 'host',
    title: 'Maria and Jose',
    line: 'The couple planning it. Guests, suppliers, budget and the day.',
    guestKey: null,
  },
];

/** Ivory paper, plum ink-accent (≈6.8:1 on ivory), gold only as ornament (≈2.7:1 — never a label). Brief "Guest pass + Apple Wallet". */
const COLOURS = Object.freeze({ ivory: '#FBF7F1', blush: '#E8C4C0', plum: '#8E3B4E', gold: '#B8935A', ink: '#3A2E2A' });

const TABLES: readonly SampleTable[] = [
  { key: 'vip', label: 'VIP Table', tableType: 'round_10', capacity: 10, vip: true, x: 50, y: 24 },
  { key: 't2', label: 'Table 2', tableType: 'round_10', capacity: 10, vip: false, x: 24, y: 40 },
  { key: 't3', label: 'Table 3', tableType: 'round_10', capacity: 10, vip: false, x: 76, y: 40 },
  { key: 't4', label: 'Table 4', tableType: 'round_10', capacity: 10, vip: false, x: 24, y: 72 },
  { key: 't5', label: 'Table 5', tableType: 'round_10', capacity: 10, vip: false, x: 50, y: 80 },
  { key: 't6', label: 'Table 6', tableType: 'round_10', capacity: 10, vip: false, x: 76, y: 72 },
];

/**
 * [key, prefix, first, last, role, side, group, attire, table, seat, walk, place, relation]
 * `walk` 0 = does not walk. Keys are `sample-guest-<name>`; the two personas keep S1's keys.
 */
type CastRow = [
  key: string,
  prefix: string | null,
  first: string,
  last: string,
  role: GuestRole,
  side: GuestSide,
  group: GuestGroupCategory,
  attire: 'gown' | 'suit',
  table: SampleTableKey,
  seat: number,
  walk: number,
  place: number,
  relation: string,
];

/** THE ENTOURAGE — 17, exactly as the brief lists it, with `ROLE_LABELS` role keys. */
const ENTOURAGE: readonly CastRow[] = [
  // 2 principal-sponsor couples, each one line in the march (paired by `couple_with_guest_id`).
  ['sample-guest-eduardo-reyes', 'Mr.', 'Eduardo', 'Reyes', 'principal_sponsor_ninong', 'bride', 'family', 'suit', 'vip', 1, 1, 0, 'Ninong · the bride’s godfather'],
  ['sample-guest-corazon-reyes', 'Mrs.', 'Corazon', 'Reyes', 'principal_sponsor_ninang', 'bride', 'family', 'gown', 'vip', 2, 1, 1, 'Ninang · the bride’s godmother'],
  ['sample-guest-ramon-aquino', 'Mr.', 'Ramon', 'Aquino', 'principal_sponsor_ninong', 'groom', 'friends', 'suit', 'vip', 3, 2, 0, 'Ninong · the groom’s mentor'],
  ['sample-guest-teresita-aquino', 'Mrs.', 'Teresita', 'Aquino', 'principal_sponsor_ninang', 'groom', 'friends', 'gown', 'vip', 4, 2, 1, 'Ninang · the groom’s mentor'],
  // Best man, then the maid of honor (the BRIDE'S SISTER — Family, bride's side, VIP table, she walks 4th).
  ['sample-guest-daniel-ramos', 'Mr.', 'Daniel', 'Ramos', 'best_man', 'groom', 'friends', 'suit', 'vip', 5, 3, 0, 'Best man · the groom’s best friend'],
  ['sample-guest-maid-of-honor', 'Ms.', 'Ana', 'Santos', 'maid_of_honor', 'bride', 'family', 'gown', 'vip', 6, 4, 0, 'Maid of honor · the bride’s sister'],
  // 3 secondary sponsors — one person each (brief: "confirm people vs couples"; people, so the 17 hold).
  ['sample-guest-miguel-dela-cruz', 'Mr.', 'Miguel', 'Dela Cruz', 'candle_sponsor', 'groom', 'family', 'suit', 'vip', 7, 5, 0, 'Candle · the groom’s brother'],
  ['sample-guest-angela-mercado', 'Ms.', 'Angela', 'Mercado', 'veil_sponsor', 'bride', 'family', 'gown', 'vip', 8, 6, 0, 'Veil · the bride’s cousin'],
  ['sample-guest-luis-bautista', 'Mr.', 'Luis', 'Bautista', 'cord_sponsor', 'groom', 'friends', 'suit', 'vip', 9, 7, 0, 'Cord · the groom’s college friend'],
  // 2 groomsmen and 2 bridesmaids, walking in pairs.
  ['sample-guest-gabriel-castillo', 'Mr.', 'Gabriel', 'Castillo', 'groomsman', 'groom', 'friends', 'suit', 't2', 1, 8, 0, 'Groomsman · barkada'],
  ['sample-guest-sofia-navarro', 'Ms.', 'Sofia', 'Navarro', 'bridesmaid', 'bride', 'friends', 'gown', 't2', 2, 8, 1, 'Bridesmaid · college roommate'],
  ['sample-guest-paolo-mendoza', 'Mr.', 'Paolo', 'Mendoza', 'groomsman', 'groom', 'friends', 'suit', 't2', 3, 9, 0, 'Groomsman · barkada'],
  ['sample-guest-joana-cruz', 'Ms.', 'Joana', 'Cruz', 'bridesmaid', 'bride', 'friends', 'gown', 't2', 4, 9, 1, 'Bridesmaid · high-school friend'],
  // 3 bearers and 1 flower girl.
  ['sample-guest-nico-dela-cruz', null, 'Nico', 'Dela Cruz', 'ring_bearer', 'groom', 'family', 'suit', 't2', 5, 10, 0, 'Ring bearer · the groom’s nephew'],
  ['sample-guest-paco-reyes', null, 'Paco', 'Reyes', 'bible_bearer', 'bride', 'family', 'suit', 't2', 6, 11, 0, 'Bible bearer · the bride’s godson'],
  ['sample-guest-inigo-garcia', null, 'Iñigo', 'Garcia', 'coin_bearer', 'groom', 'family', 'suit', 't2', 7, 12, 0, 'Coin bearer · the groom’s cousin'],
  ['sample-guest-lia-santos', null, 'Lia', 'Santos', 'flower_girl', 'bride', 'family', 'gown', 't2', 8, 13, 0, 'Flower girl · the bride’s niece'],
];

/** THE OTHER 33 — in `GROUP_CATEGORY_LABELS` groups across the sides: Family 12 · Friends 10 · Work 6 · School 4 · Officiant 1. */
const OTHERS: readonly CastRow[] = [
  // Family · bride's side — Table 3, mid-room. The bride's cousin and her named +1 (the persona).
  ['sample-guest-bride-cousin', 'Ms.', 'Bea', 'Villanueva', 'guest', 'bride', 'family', 'gown', 't3', 3, 0, 0, 'The bride’s cousin, on her mother’s side'],
  ['sample-guest-rafael-torres', 'Mr.', 'Rafael', 'Torres', 'guest', 'bride', 'family', 'suit', 't3', 4, 0, 0, 'Bea’s partner'],
  ['sample-guest-lorna-villanueva', 'Mrs.', 'Lorna', 'Villanueva', 'guest', 'bride', 'family', 'gown', 't3', 1, 0, 0, 'The bride’s aunt'],
  ['sample-guest-rosa-santos', 'Mrs.', 'Rosa', 'Santos', 'guest', 'bride', 'family', 'gown', 't3', 2, 0, 0, 'The bride’s aunt'],
  ['sample-guest-manuel-santos', 'Mr.', 'Manuel', 'Santos', 'guest', 'bride', 'family', 'suit', 't3', 5, 0, 0, 'The bride’s uncle'],
  ['sample-guest-divina-mercado', 'Mrs.', 'Divina', 'Mercado', 'guest', 'bride', 'family', 'gown', 't3', 6, 0, 0, 'The bride’s godmother at baptism'],
  ['sample-guest-tomas-mercado', 'Mr.', 'Tomas', 'Mercado', 'guest', 'bride', 'family', 'suit', 't3', 7, 0, 0, 'Divina’s husband'],
  // Family · groom's side — Table 4.
  ['sample-guest-rodrigo-dela-cruz', 'Mr.', 'Rodrigo', 'Dela Cruz', 'guest', 'groom', 'family', 'suit', 't4', 1, 0, 0, 'The groom’s uncle'],
  ['sample-guest-estrella-dela-cruz', 'Mrs.', 'Estrella', 'Dela Cruz', 'guest', 'groom', 'family', 'gown', 't4', 2, 0, 0, 'The groom’s aunt'],
  ['sample-guest-benigno-garcia', 'Mr.', 'Benigno', 'Garcia', 'guest', 'groom', 'family', 'suit', 't4', 3, 0, 0, 'The groom’s uncle'],
  ['sample-guest-patricia-garcia', 'Mrs.', 'Patricia', 'Garcia', 'guest', 'groom', 'family', 'gown', 't4', 4, 0, 0, 'The groom’s aunt'],
  ['sample-guest-alfredo-dela-cruz', 'Mr.', 'Alfredo', 'Dela Cruz', 'guest', 'groom', 'family', 'suit', 't4', 5, 0, 0, 'The groom’s cousin'],
  // Friends — Table 5.
  ['sample-guest-bianca-lim', 'Ms.', 'Bianca', 'Lim', 'guest', 'bride', 'friends', 'gown', 't5', 1, 0, 0, 'College barkada'],
  ['sample-guest-carla-domingo', 'Ms.', 'Carla', 'Domingo', 'guest', 'bride', 'friends', 'gown', 't5', 2, 0, 0, 'College barkada'],
  ['sample-guest-mika-soriano', 'Ms.', 'Mika', 'Soriano', 'guest', 'bride', 'friends', 'gown', 't5', 3, 0, 0, 'Choir friend'],
  ['sample-guest-trisha-valdez', 'Ms.', 'Trisha', 'Valdez', 'guest', 'bride', 'friends', 'gown', 't5', 4, 0, 0, 'Neighbour since childhood'],
  ['sample-guest-nina-robles', 'Ms.', 'Nina', 'Robles', 'guest', 'bride', 'friends', 'gown', 't5', 5, 0, 0, 'Travel buddy'],
  ['sample-guest-marco-tan', 'Mr.', 'Marco', 'Tan', 'guest', 'groom', 'friends', 'suit', 't5', 6, 0, 0, 'Basketball team'],
  ['sample-guest-jun-salazar', 'Mr.', 'Jun', 'Salazar', 'guest', 'groom', 'friends', 'suit', 't5', 7, 0, 0, 'Basketball team'],
  ['sample-guest-enzo-pascual', 'Mr.', 'Enzo', 'Pascual', 'guest', 'groom', 'friends', 'suit', 't5', 8, 0, 0, 'Childhood friend'],
  ['sample-guest-rico-manalo', 'Mr.', 'Rico', 'Manalo', 'guest', 'groom', 'friends', 'suit', 't5', 9, 0, 0, 'Band mate'],
  ['sample-guest-kim-ocampo', 'Ms.', 'Kim', 'Ocampo', 'guest', 'both', 'friends', 'gown', 't5', 10, 0, 0, 'Introduced the couple'],
  // Work — the bride's at Table 6, the groom's at Table 4.
  ['sample-guest-grace-lacson', 'Ms.', 'Grace', 'Lacson', 'guest', 'bride', 'work', 'gown', 't6', 1, 0, 0, 'The bride’s manager'],
  ['sample-guest-hazel-ferrer', 'Ms.', 'Hazel', 'Ferrer', 'guest', 'bride', 'work', 'gown', 't6', 2, 0, 0, 'The bride’s teammate'],
  ['sample-guest-ivy-santiago', 'Ms.', 'Ivy', 'Santiago', 'guest', 'bride', 'work', 'gown', 't6', 3, 0, 0, 'The bride’s teammate'],
  ['sample-guest-leo-bernardo', 'Mr.', 'Leo', 'Bernardo', 'guest', 'groom', 'work', 'suit', 't4', 6, 0, 0, 'The groom’s manager'],
  ['sample-guest-rey-agustin', 'Mr.', 'Rey', 'Agustin', 'guest', 'groom', 'work', 'suit', 't4', 7, 0, 0, 'The groom’s teammate'],
  ['sample-guest-vic-samonte', 'Mr.', 'Vic', 'Samonte', 'guest', 'groom', 'work', 'suit', 't4', 8, 0, 0, 'The groom’s teammate'],
  // School — Table 6.
  ['sample-guest-pia-yap', 'Ms.', 'Pia', 'Yap', 'guest', 'bride', 'school', 'gown', 't6', 4, 0, 0, 'Grade-school classmate'],
  ['sample-guest-abby-co', 'Ms.', 'Abby', 'Co', 'guest', 'bride', 'school', 'gown', 't6', 5, 0, 0, 'Grade-school classmate'],
  ['sample-guest-carlo-uy', 'Mr.', 'Carlo', 'Uy', 'guest', 'groom', 'school', 'suit', 't6', 6, 0, 0, 'High-school classmate'],
  ['sample-guest-dino-sy', 'Mr.', 'Dino', 'Sy', 'guest', 'groom', 'school', 'suit', 't6', 7, 0, 0, 'High-school classmate'],
  // Officiant — at the VIP table.
  ['sample-guest-fr-jaime-belmonte', 'Fr.', 'Jaime', 'Belmonte', 'officiant', 'both', 'officiant', 'suit', 'vip', 10, 0, 0, 'Parish priest officiating'],
];

/** Four guests who have not replied yet — so the couple's side (S3) has someone to nudge. Never a persona, never the entourage. */
const NOT_YET_REPLIED: ReadonlySet<string> = new Set([
  'sample-guest-nina-robles',
  'sample-guest-rico-manalo',
  'sample-guest-vic-samonte',
  'sample-guest-dino-sy',
]);

/** The sponsor couples (`couple_with_guest_id`, both directions). */
const PARTNERS: Readonly<Record<string, string>> = {
  'sample-guest-eduardo-reyes': 'sample-guest-corazon-reyes',
  'sample-guest-corazon-reyes': 'sample-guest-eduardo-reyes',
  'sample-guest-ramon-aquino': 'sample-guest-teresita-aquino',
  'sample-guest-teresita-aquino': 'sample-guest-ramon-aquino',
};

const COUSIN = 'sample-guest-bride-cousin';
const COUSINS_PLUS_ONE = 'sample-guest-rafael-torres';

const idOf = (key: string) => `sample:${key}`;

function sampleGuest(r: CastRow): SampleGuest {
  const [key, prefix, first, last, role, side, group, attire, table, seat, walk, place, relation] = r;
  return Object.freeze({
    guestKey: key,
    guest_id: idOf(key),
    name_prefix: prefix,
    first_name: first,
    last_name: last,
    display_name: null,
    role,
    side,
    group_category: group,
    rsvp_status: NOT_YET_REPLIED.has(key) ? 'pending' : 'attending',
    attire,
    gender: attire === 'gown' ? 'woman' : 'man',
    // The cousin may bring one, and named him; he is a guest row of his own, linked back.
    plus_one_allowed: key === COUSIN,
    plus_one_name: key === COUSIN ? 'Rafael Torres' : null,
    plus_one_of_guest_id: key === COUSINS_PLUS_ONE ? idOf(COUSIN) : null,
    plus_one_mode: key === COUSINS_PLUS_ONE ? 'full' : null,
    couple_with_guest_id: PARTNERS[key] ? idOf(PARTNERS[key]!) : null,
    table,
    seat,
    walk: walk > 0 ? Object.freeze({ no: walk, place }) : null,
    relation,
  } satisfies SampleGuest);
}

const GUESTS: Readonly<Record<string, SampleGuest>> = Object.freeze(
  Object.fromEntries([...ENTOURAGE, ...OTHERS].map((r) => [r[0], sampleGuest(r)])),
);

/**
 * THE DAY — two chapters on the invitation, each with its minute-level moments
 * (`schedule_blocks`: a top-level block per chapter, its parts under it). Times
 * are the venue's clock on the derived day. Call times live in the dress code
 * below, by role group — the field the ticket, Me › Arrive by and the checklist
 * all read (`guestArriveBy`).
 */
const CHAPTERS: readonly SampleChapter[] = [
  {
    key: 'ceremony',
    label: 'Ceremony',
    at: '15:00',
    until: '16:15',
    location: 'Kapilya ng Liwanag, Tagaytay',
    spot: 'Garden chapel',
    moments: [
      { key: 'march', label: 'The Wedding March begins', at: '15:00', until: '15:12', spot: 'Centre aisle' },
      { key: 'welcome', label: 'Welcome and opening prayer', at: '15:12', until: '15:20', spot: null },
      { key: 'readings', label: 'Readings and homily', at: '15:20', until: '15:40', spot: null },
      { key: 'vows', label: 'Exchange of vows', at: '15:40', until: '15:48', spot: null },
      { key: 'rings', label: 'Rings, arrhae, candle, veil and cord', at: '15:48', until: '15:58', spot: null },
      { key: 'kiss', label: 'Pronouncement and the kiss', at: '15:58', until: '16:02', spot: null },
      { key: 'recessional', label: 'Recessional', at: '16:02', until: '16:08', spot: 'Centre aisle' },
      { key: 'photos', label: 'Family and entourage photos', at: '16:08', until: '16:15', spot: 'Chapel steps' },
    ],
  },
  {
    key: 'reception',
    label: 'Reception',
    at: '17:00',
    until: '22:30',
    location: 'The Glasshouse at Hacienda Alon, Tagaytay',
    spot: 'Main hall',
    moments: [
      { key: 'cocktails', label: 'Cocktails and the photo booth', at: '17:00', until: '17:55', spot: 'Garden terrace' },
      { key: 'entrance', label: 'Grand entrance of the newlyweds', at: '18:00', until: '18:10', spot: null },
      { key: 'dinner', label: 'Dinner is served', at: '18:15', until: '19:15', spot: null },
      { key: 'toasts', label: 'Toasts from the best man and the maid of honor', at: '19:15', until: '19:35', spot: 'Stage' },
      { key: 'first-dance', label: 'First dance', at: '19:35', until: '19:45', spot: 'Dance floor' },
      { key: 'money-dance', label: 'Money dance', at: '19:45', until: '20:05', spot: 'Dance floor' },
      { key: 'cake', label: 'Cake cutting and wine toast', at: '20:05', until: '20:15', spot: 'Stage' },
      { key: 'bouquet', label: 'Bouquet and garter toss', at: '20:15', until: '20:30', spot: 'Dance floor' },
      { key: 'party', label: 'Open dance floor', at: '20:30', until: '22:15', spot: 'Dance floor' },
      { key: 'send-off', label: 'Sparkler send-off', at: '22:15', until: '22:30', spot: 'Front lawn' },
    ],
  },
];

/** The Mood Board (`events.role_palette`) — the shape `app/dev/maker-lab/guest/lab-sample.ts` already uses. */
const ROLE_PALETTE: Readonly<Record<string, readonly string[]>> = Object.freeze({
  reception: [COLOURS.ivory, COLOURS.blush, COLOURS.gold],
  bride: [COLOURS.ivory],
  groom: [COLOURS.plum],
  bridesmaids: [COLOURS.blush],
  groomsmen: [COLOURS.plum],
  principal_sponsors: [COLOURS.gold],
  guest: [COLOURS.blush, COLOURS.plum],
});

/**
 * The dress code (`events.dress_code_config`), with real hex colours and every
 * role group's CALL TIME (`RoleAttireRule.callTime`, `HH:MM` on the day). The
 * maid of honor's own row wins over her group's (`resolveAttireFor`).
 */
const DRESS_CODE: Readonly<Record<string, unknown>> = Object.freeze({
  title: 'Garden formal in ivory, blush and plum',
  description: 'Long dresses, Filipiniana, barong or a suit, in the colours below. Soft shades suit a garden in the afternoon.',
  dos: ['Barong Tagalog or a suit', 'Long or midi dresses', 'Block heels for the lawn'],
  donts: ['White or ivory (the bride’s)', 'Jeans and sneakers'],
  palette: [
    { name: 'Ivory', hex: COLOURS.ivory },
    { name: 'Blush', hex: COLOURS.blush },
    { name: 'Plum', hex: COLOURS.plum },
    { name: 'Gold', hex: COLOURS.gold },
  ],
  roles: {
    bride: { style: 'long_gown' },
    groom: { style: 'barong_tagalog' },
    maid_of_honor: { style: 'long_gown', note: 'Plum, floor length', callTime: '13:00' },
    best_man: { style: 'barong_tagalog', callTime: '13:30' },
    officiant: { style: 'formal', callTime: '14:00' },
    guest: { style: 'formal', note: 'In the wedding colours', callTime: '14:30' },
  },
  groups: {
    principal_sponsors: { style: 'barong_tagalog', note: 'Gold accents welcome', callTime: '14:00' },
    secondary_sponsors: { style: 'barong_tagalog', callTime: '14:00' },
    bridesmaids: { style: 'long_gown', note: 'Blush', callTime: '13:30' },
    groomsmen: { style: 'barong_tagalog', callTime: '13:30' },
    bearers_flower_girl: { style: 'formal', note: 'Ivory', callTime: '14:00' },
  },
  women: {
    groups: { principal_sponsors: { style: 'filipiniana', colours: [COLOURS.gold] }, secondary_sponsors: { style: 'long_gown' } },
    roles: { guest: { style: 'cocktail_dress' } },
  },
});

/**
 * 🚶 The march as a Filipino church wedding walks it: the principal sponsors,
 * the best man and the maid of honor, the secondary sponsors, the bridesmaids
 * and groomsmen, the bearers and the flower girl — the couple's own section
 * order, exactly as `events.entourage_section_order` holds one.
 */
const ENTOURAGE_SECTION_ORDER: readonly string[] = ['principal_sponsors', 'honour', 'secondary_sponsors', 'bridesmaids_groomsmen', 'bearers', 'flower_girls'];

const SNAPSHOT: SampleEventSnapshot = Object.freeze({
  id: SAMPLE_EVENT_ID,
  displayName: 'Maria and Jose',
  stage: 'preparation',
  personas: Object.freeze(PERSONAS.map((p) => Object.freeze({ ...p }))),
  guests: GUESTS,
  couple: Object.freeze({ bride: { first: 'Maria', last: 'Santos' }, groom: { first: 'Jose', last: 'Dela Cruz' } }),
  theme: 'house',
  colours: COLOURS,
  rolePalette: ROLE_PALETTE,
  dressCode: DRESS_CODE,
  tables: Object.freeze(TABLES.map((t) => Object.freeze({ ...t }))),
  entourageSectionOrder: Object.freeze([...ENTOURAGE_SECTION_ORDER]),
  chapters: Object.freeze(CHAPTERS.map((c) => Object.freeze({ ...c, moments: Object.freeze(c.moments.map((m) => Object.freeze({ ...m }))) }))),
  guestsArrive: '14:30',
  seatsPublished: true,
});

/** Is `key` the sample's own id? Exact match only — no trimming, no case folding. */
export function isSampleEventId(key: unknown): key is typeof SAMPLE_EVENT_ID {
  return key === SAMPLE_EVENT_ID;
}

/**
 * The sample, for its one key; `null` for every other key. Never reads a table.
 * A /sample page that gets `null` calls `notFound()`.
 */
export function readSampleEvent(key: unknown): SampleEventSnapshot | null {
  return isSampleEventId(key) ? SNAPSHOT : null;
}

/**
 * One sample guest by address key, or `null` — `/sample/hub/[guestKey]`'s read.
 * Only a key in the fixture resolves: a real guest's uuid, `S89G-` id or QR
 * token, or any other string, is `null` (→ 404). Own-property lookup only, so
 * `constructor` / `__proto__` resolve nothing either.
 */
export function readSampleGuest(guestKey: unknown): SampleGuest | null {
  if (typeof guestKey !== 'string' || !Object.prototype.hasOwnProperty.call(GUESTS, guestKey)) return null;
  return GUESTS[guestKey] ?? null;
}
