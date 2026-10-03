/**
 * THE GUEST-DELETE UNDO RESTORES ONLY WHAT WAS DELETED, FROM WHAT THE DATABASE
 * KEPT — asserted against the REPLAYED schema (migration
 * 20271262484188_undo_restores_only_deleted_guests).
 *
 * ── THE TWO DEFECTS (review of train b #6314, shipped in #6311) ────────────
 *   1. `restoreDeletedGuests` un-deleted every id the browser listed, with no
 *      `deleted_at IS NOT NULL` filter — so a guest who was NEVER deleted
 *      counted as "restored", and song requests the browser sent for them were
 *      inserted with the service role.
 *   2. Those song requests — `decided_by_vendor_profile_id` and `decided_at`
 *      included — came back FROM THE BROWSER and were written verbatim, so a
 *      host could forge which supplier decided a request on their event.
 *
 * ── WHAT IS PINNED ─────────────────────────────────────────────────────────
 *   1. restoring a guest who is not deleted changes nothing: no guest row, no
 *      song request — even when the pen holds rows for that guest;
 *   2. the delete MOVES a deleted guest's requests into the pen with their
 *      attribution, and only for a guest who is really deleted;
 *   3. the Undo restores the attribution the database stored; a forged
 *      `decided_by_vendor_profile_id` / `decided_at` handed to the Undo is
 *      ignored (the function takes no song data — a call carrying it does not
 *      resolve), and the pen is unreachable from a browser role;
 *   4. a song somebody else asked for during the Undo window keeps THEIR
 *      request, and the Undo says one did not come back;
 *   5. a caller who may not write this event's guests is refused outright.
 *
 * 🛡 Sabotaged (see the PR): dropping `AND g.deleted_at IS NOT NULL` from the
 * restore's UPDATE turns 1 red; giving the restore a `p_songs` parameter whose
 * attribution it honours turns 3 red; dropping the `coalesce` in
 * `_may_write_guests` turns 5 red — and that one was caught for real while
 * writing this: a non-moderator's `moderator_area_level` is NULL, `NOT (false
 * OR NULL)` is NULL, and plpgsql's IF reads NULL as "not refused", so a
 * stranger could restore any event's guests.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

let EVENT = '';
let CREATOR = '';
let STRANGER = '';
let ACT = ''; // the supplier who really decided
let FORGED = ''; // the supplier a host would like to claim decided
let n = 0;

async function newUser(): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
    [`acct${n}@undo-restore.test`],
  );
  return u.rows[0]!.id;
}

async function guest(first: string): Promise<string> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, $2, 'Reyes', 'both', 'friends') RETURNING guest_id`,
    [EVENT, first],
  );
  return g.rows[0]!.guest_id;
}

async function song(title: string): Promise<number> {
  const r = await db.query<{ id: string }>(`SELECT public.resolve_song_id($1, 'The Band')::text AS id`, [title]);
  return Number(r.rows[0]!.id);
}

const DECIDED_AT = '2027-01-02T03:04:05+00:00';

/** An accepted guest-lane request, decided by ACT at DECIDED_AT. */
async function acceptedRequest(guestId: string, songId: number): Promise<string> {
  const r = await db.query<{ request_id: string }>(
    `INSERT INTO public.event_song_requests
       (event_id, song_id, origin, guest_id, requester_name, status, decided_by_vendor_profile_id, decided_at)
     VALUES ($1, $2, 'guest', $3, 'Lola', 'accepted', $4, $5::timestamptz) RETURNING request_id`,
    [EVENT, songId, guestId, ACT, DECIDED_AT],
  );
  return r.rows[0]!.request_id;
}

async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec('SET ROLE authenticated');
  await setAuthUid(db, uid);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
}

type Restored = { restored_guest_ids: string[]; songs_restored: number; songs_not_restored: number };

async function restore(uid: string, ids: string[]): Promise<Restored> {
  return as(uid, async () => {
    const r = await db.query<Restored>(`SELECT * FROM public.restore_deleted_guests($1, $2::uuid[])`, [EVENT, ids]);
    return r.rows[0]!;
  });
}

async function release(uid: string, ids: string[]): Promise<number> {
  return as(uid, async () => {
    const r = await db.query<{ n: number }>(
      `SELECT public.release_deleted_guest_song_requests($1, $2::uuid[]) AS n`,
      [EVENT, ids],
    );
    return r.rows[0]!.n;
  });
}

/** The delete's shape: the couple's own session soft-deletes, then releases. */
async function deleteGuest(g: string): Promise<number> {
  await as(CREATOR, () => db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [g]));
  return release(CREATOR, [g]);
}

async function requestsOf(g: string) {
  const r = await db.query<{
    request_id: string;
    status: string;
    decided_by_vendor_profile_id: string | null;
    decided_at: string | null;
  }>(
    `SELECT request_id, status, decided_by_vendor_profile_id, to_char(decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') AS decided_at
       FROM public.event_song_requests WHERE guest_id = $1`,
    [g],
  );
  return r.rows;
}

async function deletedAt(g: string): Promise<string | null> {
  const r = await db.query<{ d: string | null }>(`SELECT deleted_at::text AS d FROM public.guests WHERE guest_id = $1`, [g]);
  return r.rows[0]!.d;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  CREATOR = await newUser();
  STRANGER = await newUser();
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
     VALUES ('Undo Party', 'birthday', '2027-07-07'::date, 'day', 'NCR') RETURNING event_id`,
  );
  EVENT = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
     VALUES ($1, $2, 'couple', 'created_event')`,
    [EVENT, CREATOR],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (business_name) VALUES ('The Real Act'), ('Somebody Else')
     RETURNING vendor_profile_id`,
  );
  ACT = v.rows[0]!.vendor_profile_id;
  FORGED = v.rows[1]!.vendor_profile_id;
});

after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});

test('1 · restoring a guest who was never deleted changes nothing', async () => {
  const live = await guest('NeverDeleted');
  const req = await acceptedRequest(live, await song('Live One'));
  const songsBefore = await db.query(`SELECT count(*)::int AS c FROM public.event_song_requests`);

  // The delete's release refuses a guest who is not deleted — the request stays put.
  assert.equal(await release(CREATOR, [live]), 0, 'a live guest’s song request was moved out of the act’s inbox');
  assert.deepEqual((await requestsOf(live)).map((r) => r.request_id), [req]);

  const out = await restore(CREATOR, [live]);
  assert.deepEqual(out.restored_guest_ids, [], 'a guest who was never deleted was reported as restored');
  assert.equal(out.songs_restored, 0);
  assert.equal(await deletedAt(live), null);
  const songsAfter = await db.query(`SELECT count(*)::int AS c FROM public.event_song_requests`);
  assert.deepEqual(songsAfter.rows, songsBefore.rows, 'the Undo of a live guest wrote song requests');

  // The pen holds rows for a guest who is ALREADY back (restored by another
  // path): the Undo of that live guest still writes nothing.
  const back = await guest('BackAlready');
  await acceptedRequest(back, await song('Held For Back'));
  assert.equal(await deleteGuest(back), 1, 'fixture: the delete did not take the request');
  await as(CREATOR, () => db.query(`UPDATE public.guests SET deleted_at = NULL WHERE guest_id = $1`, [back]));
  const again = await restore(CREATOR, [back]);
  assert.deepEqual(again.restored_guest_ids, [], 'a live guest was "restored"');
  assert.deepEqual(await requestsOf(back), [], 'held song requests were written for a guest who was not deleted');
});

test('2 · the delete moves a deleted guest’s request into the pen, attribution and all', async () => {
  const g = await guest('Moved');
  const req = await acceptedRequest(g, await song('Moved Song'));
  assert.equal(await deleteGuest(g), 1);
  assert.deepEqual(await requestsOf(g), [], 'the warning says the song request goes — it stayed in the act’s inbox');
  const held = await db.query<{ decided_by_vendor_profile_id: string; status: string }>(
    `SELECT decided_by_vendor_profile_id, status FROM public.guest_released_song_requests WHERE request_id = $1`,
    [req],
  );
  assert.deepEqual(held.rows, [{ decided_by_vendor_profile_id: ACT, status: 'accepted' }]);
});

test('3 · the Undo restores the attribution the database stored — a forged one is ignored', async () => {
  const g = await guest('Forged');
  const req = await acceptedRequest(g, await song('Forged Song'));
  assert.equal(await deleteGuest(g), 1);

  // The browser's forgery, shaped as an RPC call with a song payload. The Undo
  // takes no song data at all, so this must not resolve to anything that
  // honours it.
  const forged = JSON.stringify([
    { request_id: req, guest_id: g, song_id: 1, status: 'accepted', decided_by_vendor_profile_id: FORGED, decided_at: '2020-01-01T00:00:00Z' },
  ]);
  await as(CREATOR, async () => {
    try {
      await db.query(
        `SELECT * FROM public.restore_deleted_guests(p_event_id => $1, p_guest_ids => $2::uuid[], p_songs => $3::jsonb)`,
        [EVENT, [g], forged],
      );
    } catch (e) {
      assert.match(String((e as Error).message), /does not exist/, `unexpected refusal: ${(e as Error).message}`);
    }
  });
  if ((await deletedAt(g)) !== null) await restore(CREATOR, [g]);

  const rows = await requestsOf(g);
  assert.equal(rows.length, 1, 'the song request did not come back');
  assert.equal(rows[0]!.request_id, req);
  assert.equal(rows[0]!.decided_by_vendor_profile_id, ACT, 'the Undo wrote a supplier the browser chose');
  assert.equal(rows[0]!.decided_at, DECIDED_AT.slice(0, 19), 'the Undo wrote a decision time the browser chose');
  assert.equal(rows[0]!.status, 'accepted');
  const held = await db.query(`SELECT 1 FROM public.guest_released_song_requests WHERE guest_id = $1`, [g]);
  assert.equal(held.rows.length, 0, 'the pen kept a row the Undo already restored');

  // The only way to rewrite what the pen holds would be to reach it — no browser role can.
  const sig = await db.query<{ a: string }>(
    `SELECT pg_get_function_arguments('public.restore_deleted_guests'::regproc) AS a`,
  );
  assert.equal(sig.rows[0]!.a, 'p_event_id uuid, p_guest_ids uuid[]', 'the Undo takes data from the caller again');
  const grants = await db.query(
    `SELECT grantee, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'guest_released_song_requests'
        AND grantee IN ('anon', 'authenticated', 'PUBLIC')`,
  );
  assert.deepEqual(grants.rows, [], 'a browser role can reach the pen');
});

test('4 · a song somebody else asked for meanwhile keeps their request — and the Undo says so', async () => {
  const g = await guest('Collided');
  const other = await guest('Meanwhile');
  const s = await song('Everybody Wants It');
  await acceptedRequest(g, s);
  assert.equal(await deleteGuest(g), 1);
  const theirs = await db.query<{ request_id: string }>(
    `INSERT INTO public.event_song_requests (event_id, song_id, origin, guest_id) VALUES ($1, $2, 'guest', $3) RETURNING request_id`,
    [EVENT, s, other],
  );
  const out = await restore(CREATOR, [g]);
  assert.deepEqual(out.restored_guest_ids, [g]);
  assert.equal(out.songs_restored, 0);
  assert.equal(out.songs_not_restored, 1, 'a request that did not come back was not reported');
  assert.deepEqual((await requestsOf(other)).map((r) => r.request_id), [theirs.rows[0]!.request_id]);
});

test('5 · a caller who may not write this event’s guests is refused, and anon cannot call either door', async () => {
  const g = await guest('NotYours');
  await as(CREATOR, () => db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [g]));
  await assert.rejects(restore(STRANGER, [g]), /guests:not_allowed/);
  await assert.rejects(release(STRANGER, [g]), /guests:not_allowed/);
  assert.notEqual(await deletedAt(g), null, 'a stranger restored a guest on somebody else’s event');

  const anon = await db.query<{ f: string }>(
    `SELECT p.proname AS f FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public'
        AND p.proname IN ('restore_deleted_guests', 'release_deleted_guest_song_requests', '_may_write_guests')
        AND has_function_privilege('anon', p.oid, 'EXECUTE')`,
  );
  assert.deepEqual(anon.rows, [], 'anon may execute an Undo door');
});
