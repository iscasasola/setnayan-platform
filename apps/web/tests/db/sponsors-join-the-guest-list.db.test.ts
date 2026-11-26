/**
 * sponsors-join-the-guest-list.db.test.ts — the migration 20271363480132_sponsors_join_the_guest_list.sql
 * (owner, brief Add 41 · final check A2-I14: "one list; a sponsor is a guest with the sponsor role").
 *
 * On a replayed database: seed `event_sponsors` rows and guests, run the migration's SQL, and hold its MATCH RULE —
 *   · a sponsor who is already a guest (same email ignoring case, or the same name ignoring case and spacing, or
 *     their display name) is LINKED to that guest, never copied a second time;
 *   · a sponsor who is nobody on the list is COPIED as a guest with the sponsor role, and linked;
 *   · a principal sponsor becomes `principal_sponsor` (not yet specified) — never ninong or ninang from the side;
 *   · a linked guest keeps their own role; the sponsor role goes to `extra_roles`;
 *   · another event's guest is never a match;
 *   · running it again changes nothing (idempotent).
 * Then the DROP (20271364844438, owner 27 Nov 2026): the table is gone and the live godparent edges
 * (generate_event_connections) read the guest list's accepted principal sponsors instead.
 *
 * The replay stops BEFORE the drop migration (and any later one), so `event_sponsors` exists to seed.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../../supabase/migrations');
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, '20271363480132_sponsors_join_the_guest_list.sql'), 'utf8');
const DROP_VERSION = '20271364844438';
const DROP = readFileSync(join(MIGRATIONS_DIR, `${DROP_VERSION}_drop_event_sponsors.sql`), 'utf8');
/** Every migration version before the drop — the database as it stood when the move ran. */
const BEFORE_DROP = new Set(
  readdirSync(MIGRATIONS_DIR)
    .map((f) => /^(\d+)_.*\.sql$/.exec(f)?.[1])
    .filter((v): v is string => !!v && v < DROP_VERSION),
);

let replay: ReplayResult;
let db: PGlite;
let ev: string;
let other: string;

const one = async <T>(sql: string, params: unknown[] = []): Promise<T> => (await db.query<T>(sql, params)).rows[0] as T;

async function newEvent(name: string): Promise<string> {
  return (await one<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [name],
  )).event_id;
}

async function guest(eventId: string, first: string, last: string, extra: { email?: string; role?: string; display?: string } = {}): Promise<string> {
  return (await one<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, display_name, side, group_category, role, email)
     VALUES ($1, $2, $3, $4, 'both', 'family', coalesce($5, 'guest')::public.guest_role, $6) RETURNING guest_id`,
    [eventId, first, last, extra.display ?? null, extra.role ?? null, extra.email ?? null],
  )).guest_id;
}

async function sponsor(eventId: string, fullName: string, extra: { tier?: string; side?: string; email?: string; pair?: number; status?: string } = {}): Promise<string> {
  return (await one<{ id: string }>(
    `INSERT INTO public.event_sponsors (event_id, sponsor_tier, side, full_name, email, pair_index, invitation_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [eventId, extra.tier ?? 'principal', extra.side ?? 'groom', fullName, extra.email ?? null, extra.pair ?? null, extra.status ?? 'pending'],
  )).id;
}

const linkOf = async (sponsorId: string) =>
  (await one<{ linked_guest_id: string | null }>(`SELECT linked_guest_id FROM public.event_sponsors WHERE id = $1`, [sponsorId])).linked_guest_id;

const guestRow = async (guestId: string) =>
  one<{ first_name: string; last_name: string; role: string; extra_roles: string[]; side: string; rsvp_status: string; entourage_order: number | null; pair_with_guest_id: string | null }>(
    `SELECT first_name, last_name, role::text, extra_roles::text[] AS extra_roles, side::text, rsvp_status::text, entourage_order, pair_with_guest_id
       FROM public.guests WHERE guest_id = $1`,
    [guestId],
  );

const guestsOn = async (eventId: string) =>
  (await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.guests WHERE event_id = $1 AND deleted_at IS NULL`, [eventId])).n;

const ids = { gTito: '', gTita: '', gLola: '', gAunt: '', gElsewhere: '', sTito: '', sTita: '', sLola: '', sAunt: '', sNew: '', sNew2: '', sRizal: '' };
type IdKey = keyof typeof ids;

before(async () => {
  replay = await createReplayedDb({ only: BEFORE_DROP });
  db = replay.db;
  ev = await newEvent('Bea & Paolo');
  other = await newEvent('Another wedding');

  // Already guests on this event:
  ids.gTito = await guest(ev, 'Ramon', 'Cruz', { email: 'Tito.Ramon@Example.com' });                  // email match
  ids.gTita = await guest(ev, 'Elena', 'Reyes');                                                       // name match
  ids.gLola = await guest(ev, 'Lourdes', 'Santos', { display: 'Lola Ludy' });                          // display-name match
  ids.gAunt = await guest(ev, 'Maria', 'Lim', { role: 'bridesmaid' });                                 // keeps her own role
  ids.gElsewhere = await guest(other, 'Jose', 'Rizal');                                                // another event

  // The sponsors list:
  ids.sTito = await sponsor(ev, 'Ramon C. Cruz', { email: '  tito.ramon@example.com ', pair: 1, side: 'groom' });
  ids.sTita = await sponsor(ev, '  elena   REYES ', { pair: 1, side: 'bride' });
  ids.sLola = await sponsor(ev, 'lola ludy', { tier: 'candle', side: 'neutral' });
  ids.sAunt = await sponsor(ev, 'Maria Lim', { tier: 'veil', side: 'bride' });
  ids.sNew = await sponsor(ev, 'Andres Bonifacio', { pair: 2, side: 'groom', status: 'accepted' });
  ids.sNew2 = await sponsor(ev, 'Gabriela Silang', { pair: 2, side: 'bride', status: 'declined' });
  ids.sRizal = await sponsor(ev, 'Jose Rizal', { tier: 'coin', side: 'neutral' });                    // not the other event's
  await db.query(`UPDATE public.event_sponsors SET invitation_status = 'invited', invitation_sent_at = '2026-11-20T08:00:00Z' WHERE id = $1`, [ids.sRizal]);

  await db.exec(MIGRATION);
});

after(async () => {
  await db.close();
});

test('a sponsor who is already a guest is linked to that guest — by email, by name, by display name', async () => {
  assert.equal(await linkOf(ids.sTito), ids.gTito, 'email match, ignoring case and spaces');
  assert.equal(await linkOf(ids.sTita), ids.gTita, 'name match, ignoring case and repeated spaces');
  assert.equal(await linkOf(ids.sLola), ids.gLola, 'display-name match');
  assert.equal((await guestRow(ids.gTito)).role, 'principal_sponsor');
  assert.equal((await guestRow(ids.gLola)).role, 'candle_sponsor');
});

test('a linked guest keeps their own role; the sponsor role is added beside it', async () => {
  const aunt = await guestRow(ids.gAunt);
  assert.equal(aunt.role, 'bridesmaid');
  assert.deepEqual(aunt.extra_roles, ['veil_sponsor']);
  assert.equal(await linkOf(ids.sAunt), ids.gAunt);
});

test('a sponsor who is nobody on the list is copied once, as a guest with the sponsor role', async () => {
  const newId = (await linkOf(ids.sNew))!;
  assert.ok(newId && newId !== ids.gTito);
  const g = await guestRow(newId);
  assert.deepEqual(
    { first: g.first_name, last: g.last_name, role: g.role, side: g.side, rsvp: g.rsvp_status, pair: g.entourage_order },
    { first: 'Andres', last: 'Bonifacio', role: 'principal_sponsor', side: 'groom', rsvp: 'attending', pair: 2 },
  );
  assert.equal((await guestRow((await linkOf(ids.sNew2))!)).rsvp_status, 'declined');
});

test('a principal sponsor is never made a ninong or ninang from the side', async () => {
  const roles = (await db.query<{ role: string }>(
    `SELECT DISTINCT g.role::text AS role FROM public.guests g WHERE g.event_id = $1 AND g.role::text LIKE 'principal_sponsor%'`,
    [ev],
  )).rows.map((r) => r.role);
  assert.deepEqual(roles, ['principal_sponsor']);
});

test('another event’s guest is never a match', async () => {
  const rizal = (await linkOf(ids.sRizal))!;
  assert.notEqual(rizal, ids.gElsewhere);
  assert.equal((await guestRow(ids.gElsewhere)).role, 'guest');
  assert.equal((await guestRow(rizal)).role, 'coin_sponsor');
});

test('being asked to be a sponsor lands in sponsor_asked_at — never the RSVP invitation’s invitation_sent_at', async () => {
  const r = await one<{ asked: string | null; sent: string | null; rsvp: string }>(
    `SELECT sponsor_asked_at::text AS asked, invitation_sent_at::text AS sent, rsvp_status::text AS rsvp FROM public.guests WHERE guest_id = $1`,
    [(await linkOf(ids.sRizal))!],
  );
  assert.ok(r.asked && r.asked.startsWith('2026-11-20'), 'the asked moment is kept');
  assert.equal(r.sent, null, 'the RSVP invitation was not sent');
  assert.equal(r.rsvp, 'pending');
});

test('an ANSWERED sponsor was asked — an accepted one keeps the public band’s consent (asked + their own yes)', async () => {
  const r = await one<{ asked: string | null; by: string | null; rsvp: string }>(
    `SELECT sponsor_asked_at::text AS asked, rsvp_set_by AS by, rsvp_status::text AS rsvp FROM public.guests WHERE guest_id = $1`,
    [(await linkOf(ids.sNew))!],
  );
  assert.ok(r.asked, 'accepted with no sent time recorded: still asked');
  assert.deepEqual({ by: r.by, rsvp: r.rsvp }, { by: 'guest', rsvp: 'attending' });
});

test('a principal pair walks together', async () => {
  const a = await linkOf(ids.sNew);
  const b = await linkOf(ids.sNew2);
  assert.equal((await guestRow(a!)).pair_with_guest_id, b);
  assert.equal((await guestRow(b!)).pair_with_guest_id, a);
});

test('running it again changes nothing — no second copy of anyone', async () => {
  const before = await guestsOn(ev);
  const linksBefore = await Promise.all((Object.keys(ids) as IdKey[]).filter((k) => k.startsWith('s')).map((k) => linkOf(ids[k])));
  await db.exec(MIGRATION);
  assert.equal(await guestsOn(ev), before);
  const linksAfter = await Promise.all((Object.keys(ids) as IdKey[]).filter((k) => k.startsWith('s')).map((k) => linkOf(ids[k])));
  assert.deepEqual(linksAfter, linksBefore);
  assert.deepEqual((await guestRow(ids.gAunt)).extra_roles, ['veil_sponsor'], 'the extra role is not added twice');
  // 7 seeded guests on this event = 4 already there + 3 copies (Andres, Gabriela, Jose).
  assert.equal(before, 4 + 3);
});

test('the DROP: event_sponsors is gone, and godparent edges come from the guest list', async () => {
  // a wedding: bride + groom resolve to people; one accepted principal sponsor (a guest) does too
  const wed = (await one<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type) VALUES ('Wedding', 'wedding', 'civil') RETURNING event_id`,
  )).event_id;
  // a person WITH an account (the kin pilot stores a connection only between two account holders)
  const person = async (name: string) => {
    const uid = (await one<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [`${name.toLowerCase()}@sponsors-drop.test`],
    )).id;
    return (await one<{ person_id: string }>(`SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`, [uid])).person_id;
  };
  const [pBride, pGroom, pNinong, pDeclined] = [await person('Bride'), await person('Groom'), await person('Ninong'), await person('No')];
  const bride = await guest(wed, 'Bea', 'Cruz', { role: 'bride' });
  const groom = await guest(wed, 'Paolo', 'Reyes', { role: 'groom' });
  const ninong = await guest(wed, 'Ramon', 'Lim', { role: 'principal_sponsor' });
  const declined = await guest(wed, 'Elena', 'Tan', { role: 'guest' });
  for (const [g, p] of [[bride, pBride], [groom, pGroom], [ninong, pNinong], [declined, pDeclined]] as const) {
    await db.query(`UPDATE public.guests SET person_id = $2 WHERE guest_id = $1`, [g, p]);
  }
  await db.query(`UPDATE public.guests SET rsvp_status = 'attending' WHERE guest_id = $1`, [ninong]);
  await db.query(
    `UPDATE public.guests SET extra_roles = ARRAY['principal_sponsor']::public.guest_role[], rsvp_status = 'declined' WHERE guest_id = $1`,
    [declined],
  );

  await db.exec(DROP);
  assert.equal((await one<{ t: string | null }>(`SELECT to_regclass('public.event_sponsors')::text AS t`)).t, null);
  await db.exec(DROP); // idempotent

  await db.query(`SELECT public.generate_event_connections($1, NULL)`, [wed]);
  const godparents = (await db.query<{ from_person_id: string }>(
    `SELECT from_person_id FROM public.person_connections WHERE created_by_event_id = $1 AND relation = 'godparent'`,
    [wed],
  )).rows.map((r) => r.from_person_id);
  assert.deepEqual([...new Set(godparents)], [pNinong], 'the accepted principal sponsor only — never a declined one');
  assert.equal(godparents.length, 2, 'one edge to each principal');
});
