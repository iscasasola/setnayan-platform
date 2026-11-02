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
 * S1 (this slice) carries the shape and the keys: the event's name and stage,
 * the three personas, and the two persona guests' identities in the Hub's own
 * `GuestRow` shape (`readSampleGuest`, for `/sample/hub/[guestKey]`). S2 brings
 * the content — the other guests, entourage, seats, schedule, the march, theme,
 * logo, cover, an `EventRow`-shaped event, and the date derived at read time
 * (nearest Saturday ≥ today + 3 months). S3 hands them to the SHIPPED [slug]
 * Hub and ticket components (owner 2026-11-02: "the actual page", not drawings).
 *
 * The only import is TYPE-ONLY (erased at build): the fixtures borrow the Hub's
 * row types so they cannot drift from what its components read.
 */

import type { GuestRow } from '@/app/[slug]/_lib/types';

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
  /** The fixture guest they open as (S2 fills the guest list); null for the host. */
  guestKey: string | null;
};

/**
 * 🎫 A sample guest, in the Event Hub's OWN row shape (`GuestRow`, app/[slug]/_lib/types.ts),
 * so `/sample/hub/[guestKey]` hands it straight to the shipped [slug] Hub and ticket
 * components (slice S3) — never a second, drawn copy of them. S1 carries only the
 * identity fields of the two persona guests; S2 fills the other 48 guests and every
 * remaining field (plus-ones, table, seat, meal, entourage order).
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
};

export type SampleEventSnapshot = {
  /** Always `SAMPLE_EVENT_ID` — never a real event's id. */
  id: typeof SAMPLE_EVENT_ID;
  displayName: string;
  /** The sample is always in preparation; it never reaches the day (DECISION_LOG 2026-11-02). */
  stage: 'preparation';
  personas: readonly SamplePersona[];
  /** Every sample guest, by address key. S1: the two persona guests only. */
  guests: Readonly<Record<string, SampleGuest>>;
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

const sampleGuest = (g: Omit<SampleGuest, 'guest_id' | 'plus_one_of_guest_id' | 'plus_one_mode'>): SampleGuest =>
  Object.freeze({ ...g, guest_id: `sample:${g.guestKey}`, plus_one_of_guest_id: null, plus_one_mode: null });

/** The two persona guests (DECISION_LOG 2026-11-02; brief item 3). Names are S2's to finalise. */
const GUESTS: Readonly<Record<string, SampleGuest>> = Object.freeze({
  'sample-guest-bride-cousin': sampleGuest({
    guestKey: 'sample-guest-bride-cousin',
    first_name: 'Bea',
    last_name: 'Villanueva',
    display_name: null,
    role: 'guest',
    side: 'bride',
    group_category: 'family',
    plus_one_allowed: true,
  }),
  'sample-guest-maid-of-honor': sampleGuest({
    guestKey: 'sample-guest-maid-of-honor',
    first_name: 'Ana',
    last_name: 'Dela Cruz',
    display_name: null,
    role: 'maid_of_honor',
    side: 'bride',
    group_category: 'family',
    plus_one_allowed: false,
  }),
});

const SNAPSHOT: SampleEventSnapshot = Object.freeze({
  id: SAMPLE_EVENT_ID,
  displayName: 'Maria and Jose',
  stage: 'preparation',
  personas: Object.freeze(PERSONAS.map((p) => Object.freeze({ ...p }))),
  guests: GUESTS,
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
