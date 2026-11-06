/**
 * 🖼🔒 THE MOOD BOARD IS CHANGED BY ITS HOSTS — asserted against the REPLAYED schema, every step through a real
 * `authenticated` session (migration 20271297469032).
 *
 * WHO WRITES `event_inspiration_assets` (measured 2026-10-30): the hosts, through their OWN session client —
 * `uploadMoodboardSlot` / `removeMoodboardSlot` (wizard-actions.ts) and `reorderMoodboardSlot` / `applyGalleryPick` /
 * `applyMoodboardTemplate` (studio/mood-board/actions.ts) — and the couple's ✓ Keep on a supplier's suggestion, a
 * SECURITY DEFINER function gated on `colour_access_caller_is_couple`. Nothing writes it with the service-role
 * client; nothing deletes it.
 *
 *   1 · the creator and a full co-host each make the app's exact writes: the upload (replace-in-place soft-remove +
 *       INSERT), the remove, the drag-reorder’s move — so the fixture is not vacuous;
 *   2 · a GUEST of the event, a SUPPLIER member, a hired planner, a limited helper and a signed-in stranger can
 *       neither INSERT, UPDATE (any column) nor DELETE a board row — the row is unchanged afterwards;
 *   3 · a host can UPDATE only removed_at / slot_key / slot_position — not the photo, the swatches, who added it, or
 *       which event it is on;
 *   4 · the supplier-suggestion Keep and its Undo still write the board;
 *   5 · READS ARE UNCHANGED: the guest, the supplier, the planner and the helper still see the board;
 *   6 · an admin still removes a photo (admin_all).
 *
 * 🛡 Sabotage (run 2026-10-30): re-opening the UPDATE + INSERT policies to the old "any event_members row" predicate
 *    and re-granting table-wide UPDATE → tests 2 and 3 go red ("the guest added a photo to the couple's Mood
 *    Board"; "a host rewrote image_url on a board row"). Restored → green.
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
  cohost: '',
  guest: '',
  supplier: '',
  planner: '',
  helper: '',
  stranger: '',
  admin: '',
  seedRow: '',
};

const HEX6 = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F', '#FFFFFF'];

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
/** Run one statement as `uid`; an error is RETURNED (an RLS refusal on INSERT, a missing column grant on UPDATE). */
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
async function seat(uid: string, role: string, perms: unknown): Promise<void> {
  await db.query(
    `INSERT INTO public.event_moderators (event_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, now())`,
    [W.eventId, role, JSON.stringify(perms), W.creator, uid],
  );
}
async function memberType(uid: string): Promise<string | null> {
  const r = await db.query<{ t: string }>(
    `SELECT member_type::text AS t FROM public.event_members WHERE event_id = $1 AND user_id = $2`,
    [W.eventId, uid],
  );
  return r.rows[0]?.t ?? null;
}

/** A board row written past RLS (the fixture), at (slot, position). */
async function seedRow(slot: string, position: number, by: string): Promise<string> {
  await reset();
  const r = await db.query<{ inspiration_id: string }>(
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1, $2, $3, $4, 'url_paste', 'https://media.example/couple.jpg', $5, $6, $7, $8, $9, $10)
     RETURNING inspiration_id`,
    [W.eventId, by, slot, position, ...HEX6],
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
  const r = await db.query<{ inspiration_id: string; slot_position: number; source_kind: string }>(
    `SELECT inspiration_id, slot_position, source_kind FROM public.event_inspiration_assets
      WHERE event_id = $1 AND slot_key = $2 AND removed_at IS NULL ORDER BY slot_position`,
    [W.eventId, slot],
  );
  return r.rows;
}

/** uploadMoodboardSlot's two writes, verbatim in shape: soft-remove whatever holds the cell, then INSERT as myself. */
async function uploadAs(uid: string, slot: string, position: number): Promise<{ removed: number; inserted: number; error: string | null }> {
  const removed = await as(
    uid,
    `UPDATE public.event_inspiration_assets SET removed_at = now()
      WHERE event_id = $1 AND slot_key = $2 AND slot_position = $3 AND removed_at IS NULL RETURNING inspiration_id`,
    [W.eventId, slot, position],
  );
  const inserted = await as(
    uid,
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url, r2_key,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1, $2, $3, $4, 'file_upload', 'https://media.example/up.jpg', 'inspiration/x/up.jpg', $5, $6, $7, $8, $9, $10)
     RETURNING inspiration_id, image_url`,
    [W.eventId, uid, slot, position, ...HEX6],
  );
  return { removed: removed.rows, inserted: inserted.rows, error: removed.error ?? inserted.error };
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  W.creator = await newUser('mb-creator@mood-board-hosts.test');
  W.cohost = await newUser('mb-cohost@mood-board-hosts.test');
  W.guest = await newUser('mb-guest@mood-board-hosts.test');
  W.supplier = await newUser('mb-supplier@mood-board-hosts.test');
  W.planner = await newUser('mb-planner@mood-board-hosts.test');
  W.helper = await newUser('mb-helper@mood-board-hosts.test');
  W.stranger = await newUser('mb-stranger@mood-board-hosts.test');
  W.admin = await newUser('mb-admin@mood-board-hosts.test');
  await db.query(`UPDATE public.users SET is_team_member = TRUE WHERE user_id = $1`, [W.admin]);

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Mood Board Hosts', 'birthday') RETURNING event_id`,
  );
  W.eventId = ev.rows[0]!.event_id;
  const other = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Somebody Else', 'birthday') RETURNING event_id`,
  );
  W.otherEventId = other.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`,
    [W.eventId, W.creator],
  );
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`, [W.eventId, W.guest]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'vendor')`, [W.eventId, W.supplier]);
  // The stranger is the couple of a DIFFERENT event — a host, just not of this one.
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [W.otherEventId, W.stranger]);

  // Real seats: the trigger mints each membership by the seat's kind.
  await seat(W.cohost, 'co_host', { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: false });
  await seat(W.planner, 'wedding_planner_external', { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { seat_plan: 'edit', mood_board: 'view' } });
  await seat(W.helper, 'viewer', { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { guest_list: 'edit' } });

  assert.equal(await memberType(W.cohost), 'couple', 'a full co-host is not a couple member — the fixture is wrong');
  assert.equal(await memberType(W.planner), 'coordinator', 'the hired planner is not a coordinator member');
  assert.equal(await memberType(W.helper), 'coordinator', 'the limited helper is not a coordinator member');

  W.seedRow = await seedRow('stage', 1, W.creator);
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('1 · the creator and a full co-host make the app’s exact writes — upload, remove, drag-reorder', async () => {
  for (const host of [W.creator, W.cohost]) {
    const label = host === W.creator ? 'creator' : 'co-host';
    // Upload into an empty cell, then replace it in place.
    const first = await uploadAs(host, 'palette', 1);
    assert.equal(first.error, null, `${label}: upload refused — ${first.error}`);
    assert.equal(first.inserted, 1, `${label}: upload inserted nothing`);
    const again = await uploadAs(host, 'palette', 1);
    assert.equal(again.error, null, `${label}: replace refused — ${again.error}`);
    assert.equal(again.removed, 1, `${label}: the replace did not soft-remove the photo it replaced`);
    assert.equal((await activeAt('palette')).length, 1, `${label}: the replace left two photos in one cell`);

    // reorderMoodboardSlot's move (its steps 2 and 3: SET slot_key, slot_position) into the empty cell 2.
    // ⚠ Its step 1 parks the photo at slot_position = -1, which the table's own CHECK
    // (event_inspiration_assets_slot_position_check_v2: IN (1,2,3)) refuses for EVERY caller, before and after
    // 20271297469032 — a pre-existing defect in the reorder, not a permission, so it is not exercised here.
    const placed = (await activeAt('palette'))[0];
    assert.ok(placed, `${label}: the uploaded photo is not on the board`);
    const id = placed.inspiration_id;
    const land = await as(host, `UPDATE public.event_inspiration_assets SET slot_key = 'palette', slot_position = 2 WHERE inspiration_id = $1 RETURNING 1`, [id]);
    assert.equal(land.rows, 1, `${label}: land moved nothing — ${land.error}`);
    assert.deepEqual((await activeAt('palette')).map((r) => r.slot_position), [2]);

    // removeMoodboardSlot.
    const rm = await as(
      host,
      `UPDATE public.event_inspiration_assets SET removed_at = now()
        WHERE event_id = $1 AND slot_key = 'palette' AND slot_position = 2 AND removed_at IS NULL RETURNING 1`,
      [W.eventId],
    );
    assert.equal(rm.rows, 1, `${label}: remove changed nothing — ${rm.error}`);
    assert.equal((await activeAt('palette')).length, 0);
  }
});

test('🔒 2 · a guest, a supplier, a hired planner, a limited helper and a stranger cannot insert, update or delete', async () => {
  const people: [string, string][] = [
    ['guest', W.guest],
    ['supplier', W.supplier],
    ['hired planner', W.planner],
    ['limited helper', W.helper],
    ['stranger', W.stranger],
  ];
  const before = await rowOf(W.seedRow);
  for (const [label, uid] of people) {
    const ins = await uploadAs(uid, 'stage', 2);
    assert.equal(ins.inserted, 0, `the ${label} added a photo to the couple’s Mood Board`);
    assert.equal(ins.removed, 0);

    for (const [col, val] of [
      ['image_url', 'https://elsewhere.example/x.jpg'],
      ['removed_at', new Date().toISOString()],
      ['slot_position', '3'],
      ['added_by_user_id', uid],
    ] as const) {
      const u = await as(uid, `UPDATE public.event_inspiration_assets SET ${col} = $2 WHERE inspiration_id = $1 RETURNING 1`, [W.seedRow, val]);
      assert.equal(u.rows, 0, `the ${label} changed ${col} on the couple’s Mood Board`);
    }
    const d = await as(uid, `DELETE FROM public.event_inspiration_assets WHERE inspiration_id = $1 RETURNING 1`, [W.seedRow]);
    assert.equal(d.rows, 0, `the ${label} deleted a photo from the couple’s Mood Board`);
    assert.deepEqual(await rowOf(W.seedRow), before, `the ${label} left the row changed`);
  }
  // A removed photo stays removed: un-removing is an UPDATE too.
  const removed = await seedRow('stage', 3, W.creator);
  await reset();
  await db.query(`UPDATE public.event_inspiration_assets SET removed_at = now() WHERE inspiration_id = $1`, [removed]);
  const back = await as(W.guest, `UPDATE public.event_inspiration_assets SET removed_at = NULL WHERE inspiration_id = $1 RETURNING 1`, [removed]);
  assert.equal(back.rows, 0, 'a guest brought back a photo the couple removed');
  assert.notEqual((await rowOf(removed))!.removed_at, null);
});

test('🔒 3 · a host updates only removed_at / slot_key / slot_position — never the photo, who added it, or the event', async () => {
  const before = await rowOf(W.seedRow);
  for (const [col, val] of [
    ['image_url', 'https://elsewhere.example/x.jpg'],
    ['sampled_hex_1', '#000000'],
    ['added_by_user_id', W.cohost],
    ['event_id', W.otherEventId],
  ] as const) {
    const u = await as(W.creator, `UPDATE public.event_inspiration_assets SET ${col} = $2 WHERE inspiration_id = $1 RETURNING 1`, [W.seedRow, val]);
    assert.equal(u.rows, 0, `a host rewrote ${col} on a board row`);
    assert.match(u.error ?? '', /permission denied/i, `${col}: refused, but not by the column grant — ${u.error}`);
  }
  assert.deepEqual(await rowOf(W.seedRow), before);
  // …and a host of ANOTHER event inserting into this one is refused (the stranger is a couple elsewhere — test 2).
  const cross = await as(
    W.creator,
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1, $2, 'stage', 1, 'url_paste', 'https://media.example/x.jpg', $3, $4, $5, $6, $7, $8) RETURNING 1`,
    [W.otherEventId, W.creator, ...HEX6],
  );
  assert.equal(cross.rows, 0, 'a host added a photo to somebody else’s Mood Board');
  // …and a host cannot stamp a photo as added by somebody else.
  const forged = await as(
    W.creator,
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1, $2, 'stage', 2, 'url_paste', 'https://media.example/x.jpg', $3, $4, $5, $6, $7, $8) RETURNING 1`,
    [W.eventId, W.cohost, ...HEX6],
  );
  assert.equal(forged.rows, 0, 'a host inserted a photo stamped as another host’s');
});

test('4 · the supplier-suggestion Keep and its Undo still write the board', async () => {
  await reset();
  const shopOwner = await newUser('mb-florist@mood-board-hosts.test');
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Bloom & Co.', 'Manila', ARRAY['florals']::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
    [shopOwner],
  );
  await db.query(
    `INSERT INTO public.event_vendors (event_id, vendor_name, category, status, marketplace_vendor_id)
     VALUES ($1, 'Bloom & Co.', 'florist'::public.vendor_category, 'contracted', $2)`,
    [W.eventId, vp.rows[0]!.vendor_profile_id],
  );
  await asUser(shopOwner);
  const begun = await db.query<{ out: { status: string; suggestion_id?: string } }>(
    `SELECT public.vendor_begin_inspiration_suggestion($1, 'entourage_bouquets') AS out`,
    [W.eventId],
  );
  await reset();
  const sid = begun.rows[0]!.out.suggestion_id;
  assert.equal(begun.rows[0]!.out.status, 'ok', `the florist could not begin a suggestion: ${JSON.stringify(begun.rows[0]!.out)}`);
  await db.query(
    `UPDATE public.event_inspiration_suggestions SET state='waiting', image_url='https://media.example/f.jpg', screened_at=NOW(),
       sampled_hex_1=$2, sampled_hex_2=$3, sampled_hex_3=$4, sampled_hex_4=$5, sampled_hex_5=$6, sampled_hex_6=$7
     WHERE suggestion_id=$1`,
    [sid, ...HEX6],
  );

  await asUser(W.creator);
  const kept = await db.query<{ out: { status: string } }>(`SELECT public.couple_decide_inspiration_suggestion($1, TRUE) AS out`, [sid]);
  await reset();
  assert.equal(kept.rows[0]!.out.status, 'ok', `Keep: ${JSON.stringify(kept.rows[0]!.out)}`);
  assert.deepEqual((await activeAt('entourage_bouquets')).map((r) => r.source_kind), ['supplier_suggestion']);

  await asUser(W.creator);
  const undo = await db.query<{ out: { status: string } }>(`SELECT public.couple_undo_kept_inspiration_suggestion($1) AS out`, [sid]);
  await reset();
  assert.equal(undo.rows[0]!.out.status, 'ok', `Undo: ${JSON.stringify(undo.rows[0]!.out)}`);
  assert.equal((await activeAt('entourage_bouquets')).length, 0);
});

test('5 · reads are unchanged — everyone who saw the board still sees it', async () => {
  for (const uid of [W.creator, W.cohost, W.guest, W.supplier, W.planner, W.helper]) {
    await asUser(uid);
    const r = await db.query(`SELECT inspiration_id FROM public.event_inspiration_assets WHERE inspiration_id = $1`, [W.seedRow]);
    await reset();
    assert.equal(r.rows.length, 1, `a member lost READ on the board (${uid})`);
  }
  await asUser(W.stranger);
  const s = await db.query(`SELECT inspiration_id FROM public.event_inspiration_assets WHERE inspiration_id = $1`, [W.seedRow]);
  await reset();
  assert.equal(s.rows.length, 0, 'a stranger reads the board — that was never allowed');
});

test('6 · an admin still removes a photo (admin_all)', async () => {
  const id = await seedRow('flowers', 1, W.creator);
  const r = await as(W.admin, `UPDATE public.event_inspiration_assets SET removed_at = now() WHERE inspiration_id = $1 RETURNING 1`, [id]);
  assert.equal(r.error, null, `admin remove refused — ${r.error}`);
  assert.equal(r.rows, 1, 'an admin can no longer remove a board photo');
});
