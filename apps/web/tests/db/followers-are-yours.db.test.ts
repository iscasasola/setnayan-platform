/**
 * FOLLOWERS ARE YOURS, AND A REQUEST SAYS WHERE IT CAME FROM — the People
 * redesign's database half (owner 2026-09-28, people-redesign.html; migration
 * 20271253740454).
 *
 *   · "the Followers list is visible ONLY to the account owner" — you read the
 *     edges that point at you, and nobody reads an edge that does not touch them;
 *   · names come through one door that answers only for a live edge;
 *   · "{name} is trying to add you from your {event} event" is only ever true —
 *     a request can name an event only when its sender belongs to it.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

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

async function newUser(email: string, name: string, opts: { publicProfile?: boolean } = {}): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
    [email],
  );
  const id = u.rows[0]!.id;
  await db.query(
    `UPDATE public.users SET display_name = $2, public_profile_enabled = $3 WHERE user_id = $1`,
    [id, name, opts.publicProfile ?? false],
  );
  return id;
}

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec('SET ROLE authenticated');
  await setAuthUid(db, uid);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
}

async function follow(a: string, b: string): Promise<void> {
  await db.query(
    `INSERT INTO public.user_follows (follower_user_id, followed_user_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [a, b],
  );
}

async function personOf(uid: string): Promise<string> {
  const r = await db.query<{ person_id: string }>(
    `SELECT person_id FROM public.people WHERE claimed_by_user_id = $1 AND deleted_at IS NULL`,
    [uid],
  );
  assert.equal(r.rows.length, 1, 'every account has its own person row');
  return r.rows[0]!.person_id;
}

async function newEvent(label: string, creator: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
     VALUES ($1, 'birthday', '2027-06-06'::date, 'day', 'NCR') RETURNING event_id`,
    [label],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
     VALUES ($1, $2, 'couple', 'created_event')`,
    [eventId, creator],
  );
  return eventId;
}

// ── 1 · the followers policy ────────────────────────────────────────────────

test('I read the follows that point at me — and a third party reads none of them', async () => {
  const ice = await newUser('ice-f@follows.test', 'Ice');
  const ana = await newUser('ana-f@follows.test', 'Ana');
  const ben = await newUser('ben-f@follows.test', 'Ben');
  const outsider = await newUser('out-f@follows.test', 'Outsider');
  await follow(ana, ice);
  await follow(ben, ice);

  const mine = await asUser(ice, async () =>
    (await db.query<{ follower_user_id: string }>(
      `SELECT follower_user_id FROM public.user_follows WHERE followed_user_id = $1`,
      [ice],
    )).rows.map((r) => r.follower_user_id).sort(),
  );
  assert.deepEqual(mine, [ana, ben].sort(), 'the followed person sees who follows them');

  const peek = await asUser(outsider, async () =>
    (await db.query(`SELECT 1 FROM public.user_follows WHERE followed_user_id = $1`, [ice])).rows,
  );
  assert.equal(peek.length, 0, 'a stranger reads nothing of somebody else’s followers');

  // A follower still sees their OWN edge (the shipped policy), and nothing more:
  // Ana cannot see that Ben also follows Ice.
  const anaSees = await asUser(ana, async () =>
    (await db.query<{ follower_user_id: string }>(
      `SELECT follower_user_id FROM public.user_follows WHERE followed_user_id = $1`,
      [ice],
    )).rows.map((r) => r.follower_user_id),
  );
  assert.deepEqual(anaSees, [ana], 'a follower sees their own edge and not the other followers');
});

test('the followed person may READ the edge, never delete or rewrite it', async () => {
  const ice = await newUser('ice-w@follows.test', 'Ice');
  const ana = await newUser('ana-w@follows.test', 'Ana');
  await follow(ana, ice);
  await asUser(ice, async () => {
    await db.query(`DELETE FROM public.user_follows WHERE follower_user_id = $1 AND followed_user_id = $2`, [ana, ice]);
  });
  const still = await db.query(
    `SELECT 1 FROM public.user_follows WHERE follower_user_id = $1 AND followed_user_id = $2`,
    [ana, ice],
  );
  assert.equal(still.rows.length, 1, 'only the follower can take a follow away');
});

// ── 2 · the names door ──────────────────────────────────────────────────────

test('names come back for people on either end of my edges — never for anybody else', async () => {
  const ice = await newUser('ice-n@follows.test', 'Ice Casasola', { publicProfile: true });
  const ana = await newUser('ana-n@follows.test', 'Ana Reyes');
  const ben = await newUser('ben-n@follows.test', 'Ben Santos', { publicProfile: true });
  const stranger = await newUser('str-n@follows.test', 'Stranger');
  await follow(ana, ice); // Ana follows me
  await follow(ice, ben); // I follow Ben

  const rows = await asUser(ice, async () =>
    (await db.query<{ user_id: string; display_name: string; public_profile: boolean; public_id: string | null }>(
      `SELECT user_id, display_name, public_profile, public_id FROM public.follow_people_names($1::uuid[])`,
      [[ana, ben, stranger, ice]],
    )).rows,
  );
  const byId = new Map(rows.map((r) => [r.user_id, r]));
  assert.equal(byId.get(ana)?.display_name, 'Ana Reyes', 'a follower is named');
  assert.equal(byId.get(ben)?.display_name, 'Ben Santos', 'somebody I follow is named');
  assert.equal(byId.get(ben)?.public_profile, true);
  assert.equal(byId.get(ana)?.public_profile, false, 'the public flag is carried, so no Follow back is offered');
  assert.ok(byId.get(ana)?.public_id, 'the public handle is what the page acts on');
  assert.equal(byId.has(stranger), false, '🔴 an id with no edge returns NOTHING');
  assert.equal(byId.has(ice), false, 'and never myself');

  // The stranger asking about Ice gets nothing either — the door answers per caller.
  const theirs = await asUser(stranger, async () =>
    (await db.query(`SELECT user_id FROM public.follow_people_names($1::uuid[])`, [[ice, ana, ben]])).rows,
  );
  assert.equal(theirs.length, 0, 'a caller with no edges resolves nobody');
});

test('an unfollow takes the name away with the edge', async () => {
  const ice = await newUser('ice-u@follows.test', 'Ice');
  const ben = await newUser('ben-u@follows.test', 'Ben');
  await follow(ice, ben);
  await asUser(ice, async () => {
    await db.query(`DELETE FROM public.user_follows WHERE follower_user_id = $1 AND followed_user_id = $2`, [ice, ben]);
  });
  const rows = await asUser(ice, async () =>
    (await db.query(`SELECT user_id FROM public.follow_people_names($1::uuid[])`, [[ben]])).rows,
  );
  assert.equal(rows.length, 0);
});

test('anon cannot call the names door', async () => {
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_function_privilege('anon', 'public.follow_people_names(uuid[])', 'EXECUTE') AS ok`,
  );
  assert.equal(r.rows[0]!.ok, false);
});

// ── 3 · a request from an event ────────────────────────────────────────────

test('a request sent from an event carries that event — when its sender belongs to it', async () => {
  const bride = await newUser('bride-e@follows.test', 'Claire');
  const guest = await newUser('guest-e@follows.test', 'Tito Ben');
  const eventId = await newEvent('Cale & Ice', bride);
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
     VALUES ($1, $2, 'guest', 'guest_signup')`,
    [eventId, guest],
  );
  const from = await personOf(guest);
  const to = await personOf(bride);

  const made = await asUser(guest, async () =>
    (await db.query<{ connection_id: string }>(
      `INSERT INTO public.person_connections
         (from_person_id, to_person_id, status, created_by_user_id, created_by_event_id)
       VALUES ($1, $2, 'pending', $3, $4) RETURNING connection_id`,
      [from, to, guest, eventId],
    )).rows,
  );
  assert.equal(made.length, 1);
  const row = await db.query<{ created_by_event_id: string | null }>(
    `SELECT created_by_event_id FROM public.person_connections WHERE connection_id = $1`,
    [made[0]!.connection_id],
  );
  assert.equal(row.rows[0]!.created_by_event_id, eventId, 'the request remembers the event it came from');
});

test('🔴 a request cannot name an event its sender is not at', async () => {
  const bride = await newUser('bride-x@follows.test', 'Claire');
  const outsider = await newUser('out-x@follows.test', 'Outsider');
  const eventId = await newEvent('Not yours', bride);
  const from = await personOf(outsider);
  const to = await personOf(bride);
  await assert.rejects(
    asUser(outsider, () =>
      db.query(
        `INSERT INTO public.person_connections
           (from_person_id, to_person_id, status, created_by_user_id, created_by_event_id)
         VALUES ($1, $2, 'pending', $3, $4)`,
        [from, to, outsider, eventId],
      ),
    ),
    /belongs to/,
    'an outsider stamped somebody else’s event on a request',
  );

  // …and cannot add it afterwards to a plain request either.
  const plain = await asUser(outsider, async () =>
    (await db.query<{ connection_id: string }>(
      `INSERT INTO public.person_connections (from_person_id, to_person_id, status, created_by_user_id)
       VALUES ($1, $2, 'pending', $3) RETURNING connection_id`,
      [from, to, outsider],
    )).rows[0]!.connection_id,
  );
  await assert.rejects(
    asUser(outsider, () =>
      db.query(`UPDATE public.person_connections SET created_by_event_id = $2 WHERE connection_id = $1`, [
        plain,
        eventId,
      ]),
    ),
    /belongs to/,
  );
});

test('the recipient reads the event’s name only through events_host — and only for an event they host', async () => {
  const bride = await newUser('bride-h@follows.test', 'Claire');
  const guest = await newUser('guest-h@follows.test', 'Tito Ben');
  const eventId = await newEvent('Cale & Ice', bride);
  const seen = await asUser(bride, async () =>
    (await db.query<{ display_name: string; event_type: string }>(
      `SELECT display_name, event_type::text AS event_type FROM public.events_host WHERE event_id = $1`,
      [eventId],
    )).rows,
  );
  assert.equal(seen.length, 1, 'the host resolves their own event');
  assert.equal(seen[0]!.display_name, 'Cale & Ice');
  assert.equal(seen[0]!.event_type, 'birthday');
  const notTheirs = await asUser(guest, async () =>
    (await db.query(`SELECT 1 FROM public.events_host WHERE event_id = $1`, [eventId])).rows,
  );
  assert.equal(notTheirs.length, 0, 'an event the reader does not host never names itself');
});

// ── 4 · a request from an event ALWAYS names the event (owner 2026-09-28) ────

/** A guest row on the event with this role, linked to this account. */
async function seatAs(eventId: string, uid: string, role: 'bride' | 'guest', first: string): Promise<void> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role)
     VALUES ($1, $2, 'Reyes', 'both', 'friends', $3::public.guest_role) RETURNING guest_id`,
    [eventId, first, role],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest_signup', $3)
     ON CONFLICT (event_id, user_id) DO UPDATE SET guest_id = EXCLUDED.guest_id`,
    [eventId, uid, g.rows[0]!.guest_id],
  );
}

async function requestFrom(sender: string, recipient: string, eventId: string): Promise<string> {
  const from = await personOf(sender);
  const to = await personOf(recipient);
  const r = await asUser(sender, async () =>
    (await db.query<{ connection_id: string }>(
      `INSERT INTO public.person_connections
         (from_person_id, to_person_id, status, created_by_user_id, created_by_event_id)
       VALUES ($1, $2, 'pending', $3, $4) RETURNING connection_id`,
      [from, to, sender, eventId],
    )).rows,
  );
  return r[0]!.connection_id;
}

async function namedEvents(uid: string) {
  return asUser(uid, async () =>
    (await db.query<{ connection_id: string; event_name: string; event_type: string }>(
      `SELECT connection_id, event_name, event_type FROM public.connection_request_events()`,
    )).rows,
  );
}

test('🔴 a celebrant who is NOT a co-host still reads which event the request came from', async () => {
  const groom = await newUser('groom-n@follows.test', 'Indalecio');
  const bride = await newUser('bride-n@follows.test', 'Claire');
  const ana = await newUser('ana-n2@follows.test', 'Ana');
  const eventId = await newEvent('Indalecio & Claire', groom);
  await seatAs(eventId, bride, 'bride', 'Claire'); // a bride, NOT a host
  await seatAs(eventId, ana, 'guest', 'Ana');
  const conn = await requestFrom(ana, bride, eventId);

  const hosted = await asUser(bride, async () =>
    (await db.query(`SELECT 1 FROM public.events_host WHERE event_id = $1`, [eventId])).rows,
  );
  assert.equal(hosted.length, 0, 'fixture: the bride is not a host — events_host would name nothing');

  const rows = await namedEvents(bride);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.connection_id, conn);
  assert.equal(rows[0]!.event_name, 'Indalecio & Claire');
  assert.equal(rows[0]!.event_type, 'birthday');
});

test('🔴 a recipient who is not a celebrant, and anybody else, reads nothing', async () => {
  const host = await newUser('host-z@follows.test', 'Host');
  const tito = await newUser('tito-z@follows.test', 'Tito');
  const ana = await newUser('ana-z@follows.test', 'Ana');
  const outsider = await newUser('out-z@follows.test', 'Outsider');
  const eventId = await newEvent('Not about Tito', host);
  await seatAs(eventId, tito, 'guest', 'Tito'); // a guest, not a celebrant
  await seatAs(eventId, ana, 'guest', 'Ana');
  await requestFrom(ana, tito, eventId);
  assert.equal((await namedEvents(tito)).length, 0, 'a non-celebrant recipient is told nothing about the event');
  assert.equal((await namedEvents(outsider)).length, 0, 'a third party reads nothing');
  assert.equal((await namedEvents(ana)).length, 0, 'the SENDER reads nothing through the recipient’s door');
  const anon = await db.query<{ ok: boolean }>(
    `SELECT has_function_privilege('anon', 'public.connection_request_events()', 'EXECUTE') AS ok`,
  );
  assert.equal(anon.rows[0]!.ok, false, 'anon can call it');
});
