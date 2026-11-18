/**
 * an-event-address-names-its-creator.db.test.ts — THE ADDRESS MOVE, PART 2 (owner 2026-11-15, specs DECISION_LOG
 * d7910b5d; migration 20271350564435_event_address_owner_and_usernames).
 *
 * An event's address is `setnayan.com/{the creator's username}/{event}`. Held here, against the replayed schema:
 *   1. the FIRST couple member an event gets is its creator (`events.created_by_user_id`), and a second one never
 *      takes it over;
 *   2. that creator gets a username made from their name, stamped `username_minted_at` so the app says it once;
 *   3. a chosen username is never replaced, an empty name mints nothing, and a taken word gets a number;
 *   4. the reserved words the move needs are reserved in the database too.
 *
 * (The creator column is service-role only — held by scripts/lint-events-column-grants.mjs, which reads the
 * migration text; the replay grants everything, so a privilege check here could never fail.)
 *
 * MUTATIONS (each turns this red): drop `AND created_by_user_id IS NULL` from the trigger (test 1); drop the
 * `IF v_existing IS NOT NULL` early return (test 3); remove 'invite' from business_slug_is_reserved (test 4).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let seq = 0;

async function person(displayName: string | null, slug: string | null = null): Promise<string> {
  seq += 1;
  const u = await db.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, [
    `address-move-${seq}@example.test`,
  ]);
  const id = u.rows[0]!.id;
  await db.query(`UPDATE public.users SET display_name = $2, slug = $3 WHERE user_id = $1`, [id, displayName, slug]);
  return id;
}

async function newEvent(): Promise<string> {
  const r = await db.query<{ e: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Address Move', 'birthday') RETURNING event_id AS e`,
  );
  return r.rows[0]!.e;
}

async function addMember(eventId: string, userId: string, type: 'couple' | 'guest'): Promise<void> {
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, $3)`, [
    eventId,
    userId,
    type,
  ]);
}

async function row(userId: string) {
  return (
    await db.query<{ slug: string | null; minted: string | null }>(
      `SELECT slug, username_minted_at AS minted FROM public.users WHERE user_id = $1`,
      [userId],
    )
  ).rows[0]!;
}

async function creatorOf(eventId: string): Promise<string | null> {
  return (await db.query<{ c: string | null }>(`SELECT created_by_user_id AS c FROM public.events WHERE event_id = $1`, [eventId]))
    .rows[0]!.c;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('1 · the first couple member is the creator — a co-host added later never takes the address over', async () => {
  const ana = await person('Ana Reyes');
  const ben = await person('Ben Cruz');
  const guest = await person('Guest Person');
  const ev = await newEvent();
  assert.equal(await creatorOf(ev), null, 'precondition: a new event has no creator yet');
  await addMember(ev, guest, 'guest');
  assert.equal(await creatorOf(ev), null, 'a guest is never the creator');
  await addMember(ev, ana, 'couple');
  assert.equal(await creatorOf(ev), ana);
  await addMember(ev, ben, 'couple');
  assert.equal(await creatorOf(ev), ana, 'a second couple member took over the address');
  assert.equal((await row(ben)).slug, null, 'a co-host who did not create the event gets no username from it');
});

test('2 · the creator gets a username made from their name, marked to be shown once', async () => {
  const p = await person('Maria Clara Santos');
  const ev = await newEvent();
  await addMember(ev, p, 'couple');
  const r = await row(p);
  assert.equal(r.slug, 'mariaclarasantos');
  assert.ok(r.minted, 'username_minted_at is not stamped — the app cannot say it once');
  assert.match(r.slug!, /^[a-z0-9-]{3,32}$/);
});

test('3 · a chosen username is kept, an empty name mints nothing, a taken word gets a number', async () => {
  const chosen = await person('Lorenzo Diaz', 'enzo-d');
  await addMember(await newEvent(), chosen, 'couple');
  const c = await row(chosen);
  assert.equal(c.slug, 'enzo-d', 'a chosen username was replaced');
  assert.equal(c.minted, null, 'a chosen username was marked as made by us');

  const nameless = await person(null);
  await addMember(await newEvent(), nameless, 'couple');
  assert.equal((await row(nameless)).slug, null, 'a username was minted from no name');

  const tooShort = await person('Jo');
  await addMember(await newEvent(), tooShort, 'couple');
  assert.equal((await row(tooShort)).slug, null, 'a two-letter name borrowed a machine code');

  await person('Taken Already', 'josereyes');
  const second = await person('Jose Reyes');
  await addMember(await newEvent(), second, 'couple');
  assert.equal((await row(second)).slug, 'josereyes2', 'a taken word was not given a number');

  // The one pool: a shop's address and an event's slug are taken words too.
  await db.query(`UPDATE public.events SET slug = 'luzvaldez' WHERE event_id = $1`, [await newEvent()]);
  const third = await person('Luz Valdez');
  await addMember(await newEvent(), third, 'couple');
  assert.equal((await row(third)).slug, 'luzvaldez2', "an event's word was handed out as a username");
});

test('4 · the words under a person or a shop are reserved in the database too', async () => {
  for (const w of ['invite', 'dates', 'booth', 'review', 'guest-review', 'cached', 'c']) {
    const r = await db.query<{ r: boolean }>(`SELECT public.business_slug_is_reserved($1) AS r`, [w]);
    assert.equal(r.rows[0]!.r, true, `${w} is not reserved in the database`);
  }
  const free = await db.query<{ r: boolean }>(`SELECT public.business_slug_is_reserved('cale-ice') AS r`);
  assert.equal(free.rows[0]!.r, false, 'cale-ice must stay a usable word');
});
