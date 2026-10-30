/**
 * 🖼🔑 THE MOOD BOARD IS CHANGED BY THE HOSTS — AND BY WHOEVER THEY GIVE MOOD BOARD ACCESS (migration 20271297714074),
 * asserted against the REPLAYED schema, every step through a real `authenticated` session.
 *
 * Owner 2026-10-30: *"Only the host and whoever supplier they give access to and not all"* · *"The rest can view but
 * not edit"* · *"Host is the owners of the event"*. The grant is the seat's own `permissions_json.areas.mood_board`
 * (Event details › Event access → `setDelegateArea`), read by `current_moderator_area_levels('mood_board')`.
 *
 *   1 · a supplier the hosts let in and set to Mood Board Edit, a Limited coordinator set to Edit, and a helper set to
 *       Edit each make the app's exact writes — upload, replace in place, move, remove;
 *   2 · a booked supplier with no grant, a coordinator left at View, a guest, a host of another event and a person
 *       granted Edit on ANOTHER event are refused every write — and every one of them who could read the board still
 *       reads it;
 *   3 · a granted person changes only the three columns a host can (removed_at · slot_key · slot_position) and cannot
 *       stamp a photo as somebody else's;
 *   4 · taking the grant back takes effect on the very next write — Edit → View, and the seat removed;
 *   5 · `can_change_mood_board_photos` (what the server actions ask first) gives the policies' answer for every person,
 *       and anon cannot call it;
 *   6 · the palette stays the hosts' — a person given Mood Board Edit changes no column of the event row.
 *
 * 🛡 Sabotage (run 2026-10-30): dropping the `current_moderator_area_levels` arm from the INSERT and UPDATE policies
 *    → test 1 goes red ("the granted supplier could not upload"), and test 5 goes red (the function says yes, the
 *    policy says no). Widening the arm to `level IN ('edit','view')` → test 2 goes red ("the coordinator left at
 *    View added a photo"). Restored → green.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const W = {
  eventId: '',
  otherEventId: '',
  creator: '',
  grantedSupplier: '',
  grantedCoordinator: '',
  grantedHelper: '',
  plainSupplier: '',
  viewCoordinator: '',
  guest: '',
  stranger: '',
  elsewhere: '',
  seedRow: '',
  grantedSupplierSeat: '',
};

const HEX6 = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F', '#FFFFFF'];
const NARROW = { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false };
const ALL_VIEW = {
  guest_list: 'view', seat_plan: 'view', schedule: 'view', vendors: 'view',
  invitations: 'view', mood_board: 'view', budget: 'view', photos: 'view',
};

async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
async function as(uid: string, sql: string, params: unknown[] = []): Promise<{ rows: number; error: string | null }> {
  await asUser(uid);
  try {
    const r = await db.query(sql, params);
    return { rows: r.rows.length, error: null };
  } catch (e) {
    return { rows: 0, error: (e as Error).message };
  } finally {
    await reset();
  }
}

async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
async function seat(eventId: string, uid: string, role: string, perms: unknown): Promise<string> {
  const r = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators (event_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, now()) RETURNING moderator_id`,
    [eventId, role, JSON.stringify(perms), W.creator, uid],
  );
  return r.rows[0]!.moderator_id;
}
/** A shop owned by `uid`, booked (contracted) on this event, and a 'vendor' member of it. */
async function bookedShop(uid: string, name: string): Promise<void> {
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['styling']::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
    [uid, name],
  );
  await db.query(
    `INSERT INTO public.event_vendors (event_id, vendor_name, category, status, marketplace_vendor_id)
     VALUES ($1, $2, 'reception_decor'::public.vendor_category, 'contracted', $3)`,
    [W.eventId, name, vp.rows[0]!.vendor_profile_id],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'vendor') ON CONFLICT DO NOTHING`,
    [W.eventId, uid],
  );
}
async function seedRow(slot: string, position: number): Promise<string> {
  await reset();
  const r = await db.query<{ inspiration_id: string }>(
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1, $2, $3, $4, 'url_paste', 'https://media.example/couple.jpg', $5, $6, $7, $8, $9, $10)
     RETURNING inspiration_id`,
    [W.eventId, W.creator, slot, position, ...HEX6],
  );
  return r.rows[0]!.inspiration_id;
}
async function rowOf(id: string) {
  await reset();
  const r = await db.query<Record<string, unknown>>(
    `SELECT event_id, added_by_user_id, slot_key, slot_position, image_url, sampled_hex_1, removed_at
       FROM public.event_inspiration_assets WHERE inspiration_id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}
async function activeAt(slot: string) {
  await reset();
  const r = await db.query<{ inspiration_id: string; slot_position: number; added_by_user_id: string }>(
    `SELECT inspiration_id, slot_position, added_by_user_id FROM public.event_inspiration_assets
      WHERE event_id = $1 AND slot_key = $2 AND removed_at IS NULL ORDER BY slot_position`,
    [W.eventId, slot],
  );
  return r.rows;
}

/** uploadMoodboardSlot's two writes: soft-remove whatever holds the cell, then INSERT as myself. */
async function uploadAs(uid: string, slot: string, position: number, eventId = W.eventId) {
  const removed = await as(
    uid,
    `UPDATE public.event_inspiration_assets SET removed_at = now()
      WHERE event_id = $1 AND slot_key = $2 AND slot_position = $3 AND removed_at IS NULL RETURNING inspiration_id`,
    [eventId, slot, position],
  );
  const inserted = await as(
    uid,
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url, r2_key,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1, $2, $3, $4, 'file_upload', 'https://media.example/up.jpg', 'inspiration/x/up.jpg', $5, $6, $7, $8, $9, $10)
     RETURNING inspiration_id`,
    [eventId, uid, slot, position, ...HEX6],
  );
  return { removed: removed.rows, inserted: inserted.rows, error: removed.error ?? inserted.error };
}
async function asks(uid: string, eventId = W.eventId): Promise<boolean | string> {
  await asUser(uid);
  try {
    const r = await db.query<{ ok: boolean }>(`SELECT public.can_change_mood_board_photos($1) AS ok`, [eventId]);
    return r.rows[0]!.ok;
  } catch (e) {
    return (e as Error).message;
  } finally {
    await reset();
  }
}
async function setMoodBoardArea(moderatorId: string, level: 'edit' | 'view'): Promise<void> {
  await reset();
  // setDelegateArea's write, in shape: the one area changed on the seat's areas map.
  await db.query(
    `UPDATE public.event_moderators
        SET permissions_json = jsonb_set(permissions_json, '{areas,mood_board}', to_jsonb($2::text), true)
      WHERE moderator_id = $1`,
    [moderatorId, level],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  W.creator = await newUser('mbg-creator@mood-board-grant.test');
  W.grantedSupplier = await newUser('mbg-stylist@mood-board-grant.test');
  W.grantedCoordinator = await newUser('mbg-coordinator@mood-board-grant.test');
  W.grantedHelper = await newUser('mbg-helper@mood-board-grant.test');
  W.plainSupplier = await newUser('mbg-florist@mood-board-grant.test');
  W.viewCoordinator = await newUser('mbg-planner@mood-board-grant.test');
  W.guest = await newUser('mbg-guest@mood-board-grant.test');
  W.stranger = await newUser('mbg-stranger@mood-board-grant.test');
  W.elsewhere = await newUser('mbg-elsewhere@mood-board-grant.test');

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Mood Board Grant', 'birthday') RETURNING event_id`,
  );
  W.eventId = ev.rows[0]!.event_id;
  const other = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Another Event', 'birthday') RETURNING event_id`,
  );
  W.otherEventId = other.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`,
    [W.eventId, W.creator],
  );
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`, [W.eventId, W.guest]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`, [W.eventId, W.elsewhere]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [W.otherEventId, W.stranger]);

  // Two booked shops. The stylist asked for access and the hosts said yes — the access-request door's seat
  // (answerAccessRequest: wedding_planner_external, the narrow template, the lines granted) — then set Mood Board to
  // Edit in Event access. The florist is booked and was given nothing.
  await bookedShop(W.grantedSupplier, 'Styled by Bea');
  await bookedShop(W.plainSupplier, 'Bloom & Co.');
  W.grantedSupplierSeat = await seat(W.eventId, W.grantedSupplier, 'wedding_planner_external', { ...NARROW, areas: { mood_board: 'edit' } });

  // A coordinator on Limited, given Mood Board; another left on Limited (View everywhere).
  await seat(W.eventId, W.grantedCoordinator, 'wedding_planner_external', { ...NARROW, areas: { ...ALL_VIEW, mood_board: 'edit' }, access_level: 'limited' });
  await seat(W.eventId, W.viewCoordinator, 'wedding_planner_external', { ...NARROW, areas: { ...ALL_VIEW }, access_level: 'limited' });
  // A limited helper given Mood Board.
  await seat(W.eventId, W.grantedHelper, 'viewer', { ...NARROW, areas: { ...ALL_VIEW, mood_board: 'edit' } });
  // Granted Mood Board Edit — on ANOTHER event.
  await seat(W.otherEventId, W.elsewhere, 'viewer', { ...NARROW, areas: { mood_board: 'edit' } });

  W.seedRow = await seedRow('stage', 1);
});

after(async () => {
  await reset();
  await db?.close?.();
});

const GRANTED = () =>
  [
    ['granted supplier', W.grantedSupplier],
    ['granted Limited coordinator', W.grantedCoordinator],
    ['granted helper', W.grantedHelper],
  ] as const;
const REFUSED = () =>
  [
    ['booked supplier with no grant', W.plainSupplier],
    ['coordinator left at View', W.viewCoordinator],
    ['guest', W.guest],
    ['host of another event', W.stranger],
    ['person granted Edit on another event', W.elsewhere],
  ] as const;

test('1 · a supplier, a coordinator and a helper the hosts set to Mood Board Edit upload, replace, move and remove', async () => {
  for (const [label, uid] of GRANTED()) {
    const first = await uploadAs(uid, 'palette', 1);
    assert.equal(first.error, null, `${label}: upload refused — ${first.error}`);
    assert.equal(first.inserted, 1, `the ${label} could not upload`);
    const again = await uploadAs(uid, 'palette', 1);
    assert.equal(again.removed, 1, `${label}: the replace did not soft-remove the photo it replaced`);
    assert.equal(again.inserted, 1, `${label}: the replace inserted nothing`);
    const live = await activeAt('palette');
    assert.equal(live.length, 1, `${label}: the replace left two photos in one cell`);
    assert.equal(live[0]!.added_by_user_id, uid, `${label}: the photo is not stamped as theirs`);

    const move = await as(uid, `UPDATE public.event_inspiration_assets SET slot_key = 'palette', slot_position = 2 WHERE inspiration_id = $1 RETURNING 1`, [live[0]!.inspiration_id]);
    assert.equal(move.rows, 1, `the ${label} could not move a photo — ${move.error}`);
    assert.deepEqual((await activeAt('palette')).map((r) => r.slot_position), [2]);

    const rm = await as(
      uid,
      `UPDATE public.event_inspiration_assets SET removed_at = now()
        WHERE event_id = $1 AND slot_key = 'palette' AND slot_position = 2 AND removed_at IS NULL RETURNING 1`,
      [W.eventId],
    );
    assert.equal(rm.rows, 1, `the ${label} could not remove a photo — ${rm.error}`);
    assert.equal((await activeAt('palette')).length, 0);
  }
  // …including a photo the HOSTS put there.
  const hostPhoto = await seedRow('flowers', 1);
  const r = await as(W.grantedSupplier, `UPDATE public.event_inspiration_assets SET removed_at = now() WHERE inspiration_id = $1 RETURNING 1`, [hostPhoto]);
  assert.equal(r.rows, 1, 'a granted supplier cannot remove the hosts’ photo');
});

test('🔒 2 · everyone without the grant is refused every write — and still reads the board', async () => {
  const before = await rowOf(W.seedRow);
  for (const [label, uid] of REFUSED()) {
    const up = await uploadAs(uid, 'stage', 2);
    assert.equal(up.inserted, 0, `the ${label} added a photo to the Mood Board`);
    assert.equal(up.removed, 0, `the ${label} removed a photo while uploading`);
    for (const [col, val] of [
      ['removed_at', new Date().toISOString()],
      ['slot_position', '3'],
      ['slot_key', 'palette'],
    ] as const) {
      const u = await as(uid, `UPDATE public.event_inspiration_assets SET ${col} = $2 WHERE inspiration_id = $1 RETURNING 1`, [W.seedRow, val]);
      assert.equal(u.rows, 0, `the ${label} changed ${col} on the Mood Board`);
    }
    assert.deepEqual(await rowOf(W.seedRow), before, `the ${label} left the row changed`);
  }
  // READ is untouched: every member of the event still sees the board.
  for (const [label, uid] of [
    ['booked supplier with no grant', W.plainSupplier],
    ['coordinator left at View', W.viewCoordinator],
    ['guest', W.guest],
    ['person granted elsewhere (a guest here)', W.elsewhere],
    ...GRANTED(),
  ] as const) {
    await asUser(uid);
    const r = await db.query(`SELECT 1 FROM public.event_inspiration_assets WHERE inspiration_id = $1`, [W.seedRow]);
    await reset();
    assert.equal(r.rows.length, 1, `the ${label} can no longer SEE the Mood Board`);
  }
});

test('🔒 3 · a granted person changes only what a host can — never the photo, its provenance or its event', async () => {
  const before = await rowOf(W.seedRow);
  for (const [col, val] of [
    ['image_url', 'https://elsewhere.example/x.jpg'],
    ['sampled_hex_1', '#000000'],
    ['added_by_user_id', W.grantedSupplier],
    ['event_id', W.otherEventId],
  ] as const) {
    const u = await as(W.grantedSupplier, `UPDATE public.event_inspiration_assets SET ${col} = $2 WHERE inspiration_id = $1 RETURNING 1`, [W.seedRow, val]);
    assert.equal(u.rows, 0, `a granted supplier rewrote ${col}`);
    assert.match(u.error ?? '', /permission denied/i, `${col}: refused, but not by the column grant — ${u.error}`);
  }
  assert.deepEqual(await rowOf(W.seedRow), before);
  const forged = await as(
    W.grantedSupplier,
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1, $2, 'stage', 3, 'url_paste', 'https://media.example/x.jpg', $3, $4, $5, $6, $7, $8) RETURNING 1`,
    [W.eventId, W.creator, ...HEX6],
  );
  assert.equal(forged.rows, 0, 'a granted supplier inserted a photo stamped as the host’s');
  // …and their grant here opens no other event's board.
  const cross = await uploadAs(W.grantedSupplier, 'stage', 1, W.otherEventId);
  assert.equal(cross.inserted, 0, 'a grant on this event opened another event’s board');
});

test('4 · taking the grant back takes effect on the very next write', async () => {
  const ok = await uploadAs(W.grantedSupplier, 'cake', 1);
  assert.equal(ok.inserted, 1, `precondition: the granted supplier uploads — ${ok.error}`);

  await setMoodBoardArea(W.grantedSupplierSeat, 'view');
  const after = await uploadAs(W.grantedSupplier, 'cake', 2);
  assert.equal(after.inserted, 0, 'Mood Board set back to View — the supplier still adds photos');
  const [{ inspiration_id: id }] = await activeAt('cake');
  const rm = await as(W.grantedSupplier, `UPDATE public.event_inspiration_assets SET removed_at = now() WHERE inspiration_id = $1 RETURNING 1`, [id]);
  assert.equal(rm.rows, 0, 'Mood Board set back to View — the supplier still removes photos');
  assert.equal(await asks(W.grantedSupplier), false, 'the action gate still says yes after the grant was taken back');

  // Given again, then the seat removed altogether.
  await setMoodBoardArea(W.grantedSupplierSeat, 'edit');
  assert.equal((await uploadAs(W.grantedSupplier, 'cake', 2)).inserted, 1, 'the grant given again does not work again');
  await reset();
  await db.query(`UPDATE public.event_moderators SET removed_at = now() WHERE moderator_id = $1`, [W.grantedSupplierSeat]);
  assert.equal((await uploadAs(W.grantedSupplier, 'cake', 3)).inserted, 0, 'a removed seat still adds photos');
  assert.equal(await asks(W.grantedSupplier), false);
  // Restore for any test that runs after.
  await db.query(`UPDATE public.event_moderators SET removed_at = NULL WHERE moderator_id = $1`, [W.grantedSupplierSeat]);
});

test('5 · the server actions’ question gives the policies’ answer, for every person', async () => {
  assert.equal(await asks(W.creator), true, 'the host is told no');
  for (const [label, uid] of GRANTED()) assert.equal(await asks(uid), true, `the ${label} is told no`);
  for (const [label, uid] of REFUSED()) assert.equal(await asks(uid), false, `the ${label} is told yes`);
  // The same answer as the INSERT policy, person by person — an upload into a fresh cell.
  let cell = 1;
  for (const [label, uid] of [['host', W.creator] as const, ...GRANTED(), ...REFUSED()]) {
    const said = await asks(uid);
    const did = (await uploadAs(uid, 'palette', ((cell++ - 1) % 3) + 1)).inserted === 1;
    assert.equal(did, said, `${label}: the gate says ${String(said)} but the policy ${did ? 'took' : 'refused'} the photo`);
  }
  // anon cannot ask at all.
  await reset();
  await db.exec(`SET ROLE anon`);
  const anon = await db.query(`SELECT public.can_change_mood_board_photos($1)`, [W.eventId]).then(
    () => null,
    (e: Error) => e.message,
  );
  await reset();
  assert.match(anon ?? '', /permission denied/i, 'anon may call can_change_mood_board_photos');
});

test('🔒 6 · the palette stays the hosts’ — Mood Board Edit changes no column of the event row', async () => {
  for (const [label, uid] of GRANTED()) {
    const u = await as(uid, `UPDATE public.events SET role_palette = '{}'::jsonb WHERE event_id = $1 RETURNING 1`, [W.eventId]);
    assert.equal(u.rows, 0, `the ${label} changed the event’s palette`);
  }
  const host = await as(W.creator, `UPDATE public.events SET mood_board_updated_at = now() WHERE event_id = $1 RETURNING 1`, [W.eventId]);
  assert.equal(host.rows, 1, `precondition: the host can still save the palette — ${host.error}`);
});
