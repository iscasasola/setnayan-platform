/**
 * THE EVENT'S CREATOR IS THEIR OWN COUPLE ROW — the database half
 * (owner 2026-10-04; migration 20271264924551_the_creator_is_their_couple_row).
 *
 * Measured read-only on prod first: the creator's `event_members` row held
 * `guest_id = NULL`, so his Groom row read "Not linked", and a host's card has
 * no Invite — there was no way to say "that row is me".
 *
 *   1 · THE BACKFILL — run here from the COMMITTED migration text (not a copy),
 *       so a reword of the file is what is tested. It links a creator to a
 *       bride/groom row only when exactly one row matches them and they are
 *       that row's only match; never a row somebody holds or another account's
 *       person owns; and a second run changes nothing.
 *   2 · "THIS IS ME" — `claim_my_couple_row`, called AS `authenticated`, links
 *       a host's own membership to an unlinked couple row of that event and
 *       refuses everything else with a word, never by touching another row.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', '..', '..', '..', 'supabase', 'migrations');
const MIGRATION_FILE = readdirSync(MIGRATIONS).find((f) => f.endsWith('_the_creator_is_their_couple_row.sql'));

/** The backfill statement exactly as committed: section 1 of the migration. */
function backfillSql(): string {
  assert.ok(MIGRATION_FILE, 'the migration is gone — this test is pinning a ghost');
  const src = readFileSync(join(MIGRATIONS, MIGRATION_FILE), 'utf8');
  const start = src.indexOf('-- ── 1 · backfill');
  const end = src.indexOf('-- ── 2 ·');
  assert.ok(start > -1 && end > start, 'the migration no longer has its two marked sections');
  const sql = src.slice(start, end);
  assert.match(sql, /UPDATE public\.event_members/, 'section 1 no longer writes the membership');
  return sql;
}

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});

async function newUser(email: string, first?: string, last?: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer'::text)) RETURNING id`,
    [email],
  );
  const id = u.rows[0]!.id;
  await db.query(`INSERT INTO public.users (user_id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, email]);
  if (first || last) {
    await db.query(`UPDATE public.users SET first_name = $2, last_name = $3 WHERE user_id = $1`, [id, first ?? null, last ?? null]);
  }
  return id;
}

async function newEvent(label: string, creator: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'celebration') RETURNING event_id`,
    [`Event ${label}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
     VALUES ($1, $2, 'couple', 'created_event')`,
    [eventId, creator],
  );
  return eventId;
}

async function newGuest(
  eventId: string,
  first: string,
  last: string,
  role: string,
  email: string | null = null,
): Promise<string> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, email)
     VALUES ($1, $2, $3, 'both', 'other', $4::public.guest_role, $5) RETURNING guest_id`,
    [eventId, first, last, role, email],
  );
  return g.rows[0]!.guest_id;
}

async function heldBy(eventId: string, uid: string): Promise<{ guest_id: string | null; role: string | null; t: string; via: string } | null> {
  const r = await db.query<{ guest_id: string | null; role: string | null; t: string; via: string }>(
    `SELECT guest_id, role, member_type::text AS t, joined_via::text AS via
     FROM public.event_members WHERE event_id = $1 AND user_id = $2`,
    [eventId, uid],
  );
  return r.rows[0] ?? null;
}

async function runBackfill(): Promise<void> {
  await db.exec(backfillSql());
}

async function claimAs(uid: string | null, eventId: string, guestId: string): Promise<string> {
  await setAuthUid(db, uid);
  await db.exec('SET ROLE authenticated');
  try {
    const r = await db.query<{ w: string }>(`SELECT public.claim_my_couple_row($1, $2) AS w`, [eventId, guestId]);
    return r.rows[0]!.w;
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
}

// ── 1 · the backfill ────────────────────────────────────────────────────────

test('backfill: the one row that is the creator (email · person · name) is linked; the other is not', async () => {
  // Shaped on cale-ice: the groom row carries the creator's own address and
  // name; the bride row is somebody else.
  const owner = await newUser('ice-shape@creator.test', 'Indalecio', 'Casasola');
  const ev = await newEvent('cale-shape', owner);
  const groom = await newGuest(ev, 'Indalecio', 'Casasola', 'groom', 'ice-shape@creator.test');
  const bride = await newGuest(ev, 'Claire', 'Buanhog', 'bride');

  await runBackfill();
  const m = await heldBy(ev, owner);
  assert.equal(m?.guest_id, groom, 'the creator now holds the groom row');
  assert.equal(m?.role, 'groom', 'and the membership mirrors the row role');
  assert.equal(m?.t, 'couple', 'still a couple member — the creator is never downgraded');
  assert.equal(m?.via, 'created_event', 'still the creator');
  const brideHolders = await db.query(`SELECT 1 FROM public.event_members WHERE guest_id = $1`, [bride]);
  assert.equal(brideHolders.rows.length, 0, 'the bride row is untouched');

  // Idempotent: a second run is a no-op.
  await runBackfill();
  assert.equal((await heldBy(ev, owner))?.guest_id, groom, 'a re-run changes nothing');
});

test('backfill: a name-only match links too (rows seeded by onboarding carry no email)', async () => {
  const owner = await newUser('name-only@creator.test', 'Rosa', 'Reyes');
  const ev = await newEvent('name-only', owner);
  const bride = await newGuest(ev, 'rosa', ' Reyes ', 'bride');
  await newGuest(ev, 'Ben', 'Cruz', 'groom');
  await runBackfill();
  assert.equal((await heldBy(ev, owner))?.guest_id, bride, 'first + last name (case/space-insensitive) is a match');
});

test('backfill: two candidate rows → nothing (never guess between two)', async () => {
  const owner = await newUser('two@creator.test', 'Sam', 'Lee');
  const ev = await newEvent('two', owner);
  await newGuest(ev, 'Sam', 'Lee', 'groom'); // matches by name
  await newGuest(ev, 'Alex', 'Tan', 'bride', 'two@creator.test'); // matches by email
  await runBackfill();
  assert.equal((await heldBy(ev, owner))?.guest_id, null, 'ambiguous → left for "This is me"');
});

test('backfill: no match → nothing; a row another account holds → never touched', async () => {
  const owner = await newUser('nomatch@creator.test', 'Nobody', 'Here');
  const ev = await newEvent('nomatch', owner);
  await newGuest(ev, 'Maria', 'Santos', 'bride');
  await newGuest(ev, 'Jose', 'Rizal', 'groom');
  await runBackfill();
  assert.equal((await heldBy(ev, owner))?.guest_id, null, 'no row is the creator → nothing');

  // The only matching row is already held by another account.
  const owner2 = await newUser('held@creator.test', 'Kai', 'Lim');
  const partner = await newUser('partner@creator.test');
  const ev2 = await newEvent('held', owner2);
  const groom2 = await newGuest(ev2, 'Kai', 'Lim', 'groom');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest_signup', $3)`,
    [ev2, partner, groom2],
  );
  await runBackfill();
  assert.equal((await heldBy(ev2, owner2))?.guest_id, null, 'a held row is never taken');
  assert.equal((await heldBy(ev2, partner))?.guest_id, groom2, 'and its holder keeps it');
});

test('backfill: a row whose person another account owns is never taken, even on a name match', async () => {
  const owner = await newUser('claimed@creator.test', 'Lia', 'Ong');
  const other = await newUser('lia-other@creator.test');
  const ev = await newEvent('claimed', owner);
  const bride = await newGuest(ev, 'Lia', 'Ong', 'bride');
  const p = await db.query<{ person_id: string }>(`SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`, [other]);
  assert.ok(p.rows[0], 'fixture: the other account has a claimed person');
  await db.query(`UPDATE public.guests SET person_id = $2 WHERE guest_id = $1`, [bride, p.rows[0]!.person_id]);
  await runBackfill();
  assert.equal((await heldBy(ev, owner))?.guest_id, null, 'another account\'s person → not the creator\'s row');
});

test('backfill: the claimed-person signal alone links (no email, a different name)', async () => {
  const owner = await newUser('person-only@creator.test', 'Profile', 'Name');
  const ev = await newEvent('person-only', owner);
  const groom = await newGuest(ev, 'Nick', 'Name', 'groom');
  await newGuest(ev, 'Other', 'Person', 'bride');
  const p = await db.query<{ person_id: string }>(`SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`, [owner]);
  await db.query(`UPDATE public.guests SET person_id = $2 WHERE guest_id = $1`, [groom, p.rows[0]!.person_id]);
  await runBackfill();
  assert.equal((await heldBy(ev, owner))?.guest_id, groom, 'the row whose person the creator claimed is theirs');
});

test('backfill: a soft-deleted or passed-away row is never linked', async () => {
  const owner = await newUser('gone@creator.test', 'Gone', 'Row');
  const ev = await newEvent('gone', owner);
  const deleted = await newGuest(ev, 'Gone', 'Row', 'groom');
  await db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [deleted]);
  await runBackfill();
  assert.equal((await heldBy(ev, owner))?.guest_id, null, 'a deleted row is not the creator\'s');

  const owner2 = await newUser('passed@creator.test', 'Lolo', 'Row');
  const ev2 = await newEvent('passed', owner2);
  const passed = await newGuest(ev2, 'Lolo', 'Row', 'bride');
  await db.query(`UPDATE public.guests SET passed_away = true WHERE guest_id = $1`, [passed]);
  await runBackfill();
  assert.equal((await heldBy(ev2, owner2))?.guest_id, null, 'a passed-away row is not the creator\'s');
});

test('backfill: two creators matching one row → neither is linked (and the migration never trips the unique index)', async () => {
  // Two creators who share a name (a parent and child, say): one row named so
  // is each creator's only match — and it belongs to neither account's person.
  const a = await newUser('two-a@creator.test', 'Ben', 'Dos');
  const b = await newUser('two-b@creator.test', 'Ben', 'Dos');
  const ev = await newEvent('two-creators', a);
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
     VALUES ($1, $2, 'couple', 'created_event')`,
    [ev, b],
  );
  const row = await newGuest(ev, 'Ben', 'Dos', 'groom');
  await db.query(`UPDATE public.guests SET person_id = NULL WHERE guest_id = $1`, [row]);
  await runBackfill();
  assert.equal((await heldBy(ev, a))?.guest_id, null);
  assert.equal((await heldBy(ev, b))?.guest_id, null);
});

// ── 2 · "This is me" ────────────────────────────────────────────────────────

test('"This is me": a host links their own membership to an unlinked couple row', async () => {
  const host = await newUser('tim@creator.test');
  const ev = await newEvent('tim', host);
  const groom = await newGuest(ev, 'Unknown', 'Person', 'groom');
  const bride = await newGuest(ev, 'Other', 'Person', 'bride');

  assert.equal(await claimAs(host, ev, groom), 'linked');
  const m = await heldBy(ev, host);
  assert.equal(m?.guest_id, groom);
  assert.equal(m?.role, 'groom');
  assert.equal(m?.t, 'couple', 'still a couple member');
  assert.equal(m?.via, 'created_event', 'still the creator');

  assert.equal(await claimAs(host, ev, groom), 'already_yours', 'again → already yours, nothing moves');
  assert.equal(await claimAs(host, ev, bride), 'you_hold_another_row', 'one account, one row');
  assert.equal((await heldBy(ev, host))?.guest_id, groom, 'the first row stays');
});

test('"This is me" refuses: not a host · not a couple row · another event\'s row · a held row · another account\'s person · signed out', async () => {
  const host = await newUser('ref-host@creator.test');
  const guestUser = await newUser('ref-guest@creator.test');
  const bridesAccount = await newUser('ref-bride@creator.test');
  const ev = await newEvent('refusals', host);
  const groom = await newGuest(ev, 'G', 'Row', 'groom');
  const bride = await newGuest(ev, 'B', 'Row', 'bride');
  const friend = await newGuest(ev, 'F', 'Row', 'guest');
  const friendOfGuest = await newGuest(ev, 'H', 'Row', 'guest');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest_signup', $3)`,
    [ev, guestUser, friendOfGuest],
  );

  assert.equal(await claimAs(guestUser, ev, groom), 'not_the_creator', 'a guest member cannot claim a couple row');

  // An INVITED co-host (couple, joined_via 'invited') is not the creator.
  const cohost = await newUser('ref-cohost@creator.test');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
     VALUES ($1, $2, 'couple', 'invited')`,
    [ev, cohost],
  );
  assert.equal(await claimAs(cohost, ev, groom), 'not_the_creator', 'a co-host must never take the bride\'s or groom\'s row');
  assert.equal((await heldBy(ev, cohost))?.guest_id, null);

  // A soft-deleted or passed-away couple row is not claimable.
  const otherHost2 = await newUser('ref-gone@creator.test');
  const evGone = await newEvent('refusals-gone', otherHost2);
  const goneRow = await newGuest(evGone, 'X', 'Row', 'groom');
  await db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [goneRow]);
  assert.equal(await claimAs(otherHost2, evGone, goneRow), 'not_a_couple_row', 'a deleted row');
  const passedRow = await newGuest(evGone, 'Y', 'Row', 'bride');
  await db.query(`UPDATE public.guests SET passed_away = true WHERE guest_id = $1`, [passedRow]);
  assert.equal(await claimAs(otherHost2, evGone, passedRow), 'not_a_couple_row', 'a passed-away row');
  assert.equal(await claimAs(host, ev, friend), 'not_a_couple_row', 'only bride / groom rows');

  const otherHost = await newUser('ref-other@creator.test');
  const otherEv = await newEvent('refusals-other', otherHost);
  const otherGroom = await newGuest(otherEv, 'O', 'Row', 'groom');
  assert.equal(await claimAs(host, ev, otherGroom), 'not_a_couple_row', 'a row of another event is not this event\'s');

  // The bride row is held by the bride's account.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest_signup', $3)`,
    [ev, bridesAccount, bride],
  );
  assert.equal(await claimAs(host, ev, bride), 'already_linked', 'never a row somebody holds');
  assert.equal((await heldBy(ev, bridesAccount))?.guest_id, bride, 'and the holder keeps it');

  // The groom row's person is another account's.
  const p = await db.query<{ person_id: string }>(`SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`, [guestUser]);
  await db.query(`UPDATE public.guests SET person_id = $2 WHERE guest_id = $1`, [groom, p.rows[0]!.person_id]);
  assert.equal(await claimAs(host, ev, groom), 'someone_else', 'never a row another account\'s person owns');

  assert.equal(await claimAs(null, ev, groom), 'not_signed_in');
  assert.equal((await heldBy(ev, host))?.guest_id, null, 'after every refusal the host holds nothing');
});

test('"This is me" is not callable by anon', async () => {
  const host = await newUser('anon-host@creator.test');
  const ev = await newEvent('anon', host);
  const groom = await newGuest(ev, 'A', 'Row', 'groom');
  await db.exec('SET ROLE anon');
  try {
    await assert.rejects(
      db.query(`SELECT public.claim_my_couple_row($1, $2)`, [ev, groom]),
      /permission denied/,
      'anon must not reach the function at all',
    );
  } finally {
    await db.exec('RESET ROLE');
  }
});
