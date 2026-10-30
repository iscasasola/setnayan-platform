/**
 * 🖼⏱ MOOD BOARD CHANGES: SUPPLIERS ASK, COORDINATORS APPLY, THE OWNERS HAVE 24 HOURS TO UNDO
 * (migration 20271299051148), asserted against the REPLAYED schema, every step through a real `authenticated` session.
 *
 * Owner 2026-10-30, verbatim: *"Suppliers need approval and coordinators auto apply and owners of the events has 24 hrs
 * to undo that change"* · *"Coordinators can also approve the changes made by suppliers?"* → *"Yes we want that"*.
 *
 *   1 · a coordinator the hosts set to Mood Board Edit uploads, replaces, moves and removes — each is ONE recorded
 *       change (who · when · what · the before/after of every row) and ONE in-app notice to each owner;
 *   2 · an owner's Undo within 24 hours puts every row back EXACTLY as it was — written as the owner, through the
 *       board's own RLS and column grant;
 *   3 · after 24 hours the Undo is refused and the change stands;
 *   4 · nobody but an owner can Undo — not the coordinator, not a guest, not another event's host — and the two
 *       definer halves cannot be used to fake one;
 *   5 · a later change to the same place makes the Undo refuse ('moved_on') and write nothing;
 *   6 · an owner's own change records nothing and tells nobody;
 *   7 · a write that skips the app's door is recorded all the same;
 *   8 · supplier suggestions: a coordinator with Edit may Keep / No thanks; one without, a guest and another supplier
 *       may not; a coordinator's Keep is a recorded change the owners can Undo (the suggestion then waits again); the
 *       coordinator's own toast Undo closes their change instead of recording a second;
 *   9 · Home's ONE read gives the owners both lists, the coordinator the suggestions only, a guest neither.
 *
 * 🛡 Sabotage: see the changelog fragment `changelog.d/mood-board-undo-24h.md` (run 2026-10-30).
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
  coordinator: '',
  viewCoordinator: '',
  plainSupplier: '',
  plainSupplierProfile: '',
  guest: '',
  stranger: '',
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
async function as<T = Record<string, unknown>>(
  uid: string,
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; error: string | null }> {
  await asUser(uid);
  try {
    const r = await db.query<T>(sql, params);
    return { rows: r.rows, error: null };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  } finally {
    await reset();
  }
}
async function newUser(email: string, name: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const id = r.rows[0]!.id;
  await db.query(`UPDATE public.users SET display_name = $2 WHERE user_id = $1`, [id, name]);
  return id;
}
async function seat(eventId: string, uid: string, role: string, perms: unknown, label: string | null = null): Promise<string> {
  const r = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators (event_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at, display_label)
     VALUES ($1, $2, $3::jsonb, $4, $5, now(), $6) RETURNING moderator_id`,
    [eventId, role, JSON.stringify(perms), W.creator, uid, label],
  );
  return r.rows[0]!.moderator_id;
}

// ── The app's writes, in shape ───────────────────────────────────────────────
type Begin = { status: string; change_id?: string };
async function begin(uid: string, kind: string, slot: string): Promise<Begin> {
  const r = await as<{ r: Begin }>(uid, `SELECT public.begin_mood_board_change($1, $2, $3) AS r`, [W.eventId, kind, slot]);
  assert.equal(r.error, null, `begin_mood_board_change: ${r.error}`);
  return r.rows[0]!.r;
}
async function insertAs(uid: string, slot: string, position: number): Promise<string> {
  const r = await as<{ inspiration_id: string }>(
    uid,
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url, r2_key,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1, $2, $3, $4, 'file_upload', 'https://media.example/up.jpg', 'inspiration/x/up.jpg', $5, $6, $7, $8, $9, $10)
     RETURNING inspiration_id`,
    [W.eventId, uid, slot, position, ...HEX6],
  );
  assert.equal(r.error, null, `insert refused: ${r.error}`);
  return r.rows[0]!.inspiration_id;
}
async function softRemoveAs(uid: string, slot: string, position: number): Promise<number> {
  const r = await as(
    uid,
    `UPDATE public.event_inspiration_assets SET removed_at = now()
      WHERE event_id = $1 AND slot_key = $2 AND slot_position = $3 AND removed_at IS NULL RETURNING 1`,
    [W.eventId, slot, position],
  );
  assert.equal(r.error, null, `remove refused: ${r.error}`);
  return r.rows.length;
}
/** uploadMoodboardSlot: begin, soft-remove whatever holds the cell, INSERT. */
async function uploadAs(uid: string, slot: string, position: number, kind = 'upload'): Promise<string> {
  await begin(uid, kind, slot);
  await softRemoveAs(uid, slot, position);
  return insertAs(uid, slot, position);
}
async function moveAs(uid: string, id: string, slot: string, position: number): Promise<void> {
  await begin(uid, 'move', slot);
  const r = await as(uid, `UPDATE public.event_inspiration_assets SET slot_key = $2, slot_position = $3 WHERE inspiration_id = $1 RETURNING 1`, [
    id,
    slot,
    position,
  ]);
  assert.equal(r.error, null, `move refused: ${r.error}`);
  assert.equal(r.rows.length, 1, 'the move wrote nothing');
}
async function removeAs(uid: string, slot: string, position: number): Promise<void> {
  await begin(uid, 'remove', slot);
  assert.equal(await softRemoveAs(uid, slot, position), 1, 'the remove wrote nothing');
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
type BoardRow = { inspiration_id: string; slot_key: string; slot_position: number; removed_at: string | null };
/** The whole board as the database holds it — every row, removed or not. */
async function board(): Promise<BoardRow[]> {
  await reset();
  const r = await db.query<BoardRow>(
    `SELECT inspiration_id, slot_key, slot_position, removed_at::text AS removed_at
       FROM public.event_inspiration_assets WHERE event_id = $1 ORDER BY inspiration_id`,
    [W.eventId],
  );
  return r.rows;
}
type Change = { change_id: string; kind: string; actor_label: string; touched: Record<string, unknown>; undone_at: string | null };
async function changes(): Promise<Change[]> {
  await reset();
  const r = await db.query<Change>(
    `SELECT change_id, kind, actor_label, touched, undone_at FROM public.event_mood_board_changes
      WHERE event_id = $1 AND first_row_at IS NOT NULL ORDER BY created_at`,
    [W.eventId],
  );
  return r.rows;
}
async function notices(): Promise<{ user_id: string; title: string; body: string; related_url: string }[]> {
  await reset();
  const r = await db.query<{ user_id: string; title: string; body: string; related_url: string }>(
    `SELECT user_id, title, body, related_url FROM public.notifications
      WHERE event_id = $1 AND type = 'mood_board_changed' ORDER BY created_at, user_id`,
    [W.eventId],
  );
  return r.rows;
}
async function undo(uid: string, changeId: string): Promise<{ status?: string; error?: string }> {
  const r = await as<{ r: { status: string } }>(uid, `SELECT public.undo_mood_board_change($1) AS r`, [changeId]);
  return r.error ? { error: r.error } : { status: r.rows[0]!.r.status };
}
/** Clear the board's rows so each test starts from its own fixture. */
async function clearBoard(): Promise<void> {
  await reset();
  await db.query(`DELETE FROM public.event_mood_board_changes WHERE event_id = $1`, [W.eventId]);
  await db.query(`DELETE FROM public.event_inspiration_assets WHERE event_id = $1`, [W.eventId]);
  await db.query(`DELETE FROM public.notifications WHERE event_id = $1`, [W.eventId]);
}

async function suggestion(slot = 'stage'): Promise<string> {
  await reset();
  const r = await db.query<{ suggestion_id: string }>(
    `INSERT INTO public.event_inspiration_suggestions
       (event_id, vendor_profile_id, shop_label, slot_key, state, image_url, screened_at,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1, $2, 'Bloom & Co.', $3, 'waiting', 'https://media.example/suggested.jpg', now(), $4, $5, $6, $7, $8, $9)
     RETURNING suggestion_id`,
    [W.eventId, W.plainSupplierProfile, slot, ...HEX6],
  );
  return r.rows[0]!.suggestion_id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  W.creator = await newUser('mbu-creator@mood-board-undo.test', 'Claire');
  W.cohost = await newUser('mbu-cohost@mood-board-undo.test', 'Ice');
  W.coordinator = await newUser('mbu-coordinator@mood-board-undo.test', 'Ana');
  W.viewCoordinator = await newUser('mbu-planner@mood-board-undo.test', 'Pia');
  W.plainSupplier = await newUser('mbu-florist@mood-board-undo.test', 'Flor');
  W.guest = await newUser('mbu-guest@mood-board-undo.test', 'Gina');
  W.stranger = await newUser('mbu-stranger@mood-board-undo.test', 'Sam');

  W.eventId = (await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Mood Board Undo', 'birthday') RETURNING event_id`,
  )).rows[0]!.event_id;
  W.otherEventId = (await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Another Event', 'birthday') RETURNING event_id`,
  )).rows[0]!.event_id;

  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`, [W.eventId, W.creator]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [W.eventId, W.cohost]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`, [W.eventId, W.guest]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [W.otherEventId, W.stranger]);

  // The coordinator the hosts set to Mood Board Edit (the shop's name on the seat, as the invite doors write it);
  // another coordinator left at View.
  await seat(W.eventId, W.coordinator, 'wedding_planner_external', { ...NARROW, areas: { ...ALL_VIEW, mood_board: 'edit' }, access_level: 'limited' }, 'Styled by Bea');
  await seat(W.eventId, W.viewCoordinator, 'wedding_planner_external', { ...NARROW, areas: { ...ALL_VIEW }, access_level: 'limited' });

  // A booked supplier with no grant — the one who suggests.
  W.plainSupplierProfile = (await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Bloom & Co.', 'Manila', ARRAY['stylist_decorator']::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
    [W.plainSupplier],
  )).rows[0]!.vendor_profile_id;
  await db.query(
    `INSERT INTO public.event_vendors (event_id, vendor_name, category, status, marketplace_vendor_id)
     VALUES ($1, 'Bloom & Co.', 'reception_decor'::public.vendor_category, 'contracted', $2)`,
    [W.eventId, W.plainSupplierProfile],
  );
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'vendor') ON CONFLICT DO NOTHING`, [W.eventId, W.plainSupplier]);
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('1 · a coordinator’s upload, replace, move and remove are each ONE recorded change and ONE notice per owner', async () => {
  await clearBoard();
  const couplePhoto = await seedRow('stage', 1);

  // upload into an empty place
  const up = await uploadAs(W.coordinator, 'stage', 2);
  let cs = await changes();
  assert.equal(cs.length, 1, 'the upload is not one recorded change');
  assert.equal(cs[0]!.kind, 'upload');
  assert.equal(cs[0]!.actor_label, 'Coordinator Styled by Bea', 'the change does not say who made it');
  assert.deepEqual(Object.keys(cs[0]!.touched), [up], 'the upload did not record its new row');
  assert.deepEqual((cs[0]!.touched[up] as { before: unknown }).before, { existed: false });
  let ns = await notices();
  assert.equal(ns.length, 2, `one notice per owner expected, got ${ns.length}`);
  assert.deepEqual(new Set(ns.map((n) => n.user_id)), new Set([W.creator, W.cohost]), 'the notices did not reach both owners');
  assert.match(ns[0]!.title, /^Coordinator Styled by Bea changed the Mood Board · /);
  assert.match(ns[0]!.body, /Added a photo\. You can undo it from Home for 24 hours\./);
  assert.equal(ns[0]!.related_url, `/dashboard/${W.eventId}`, 'the notice does not open Home, where its Undo is');

  // replace the couple's photo in place: TWO rows, one change
  const rep = await uploadAs(W.coordinator, 'stage', 1, 'replace');
  cs = await changes();
  assert.equal(cs.length, 2);
  assert.equal(cs[1]!.kind, 'replace');
  assert.deepEqual(new Set(Object.keys(cs[1]!.touched)), new Set([couplePhoto, rep]), 'the replace did not record both rows');
  const before = (cs[1]!.touched[couplePhoto] as { before: Record<string, unknown> }).before;
  assert.deepEqual(before, { existed: true, slot_key: 'stage', slot_position: 1, removed_at: null });
  assert.equal((await notices()).length, 4, 'the replace — two writes — sent more or fewer than one notice per owner');

  // move into an empty place, then remove
  await moveAs(W.coordinator, up, 'stage', 3);
  await removeAs(W.coordinator, 'stage', 3);
  cs = await changes();
  assert.deepEqual(cs.map((c) => c.kind), ['upload', 'replace', 'move', 'remove']);
  ns = await notices();
  assert.equal(ns.length, 8, 'four changes · two owners → eight notices');
  assert.match(ns[4]!.body, /^Moved a photo/);
  assert.match(ns[6]!.body, /^Removed a photo/);
});

test('2 · an owner’s Undo within 24 hours puts every row back exactly as it was', async () => {
  await clearBoard();
  const a = await seedRow('stage', 1);
  const b = await seedRow('ceiling', 1);
  const start = await board();

  await uploadAs(W.coordinator, 'stage', 1, 'replace'); // replace a
  await moveAs(W.coordinator, b, 'ceiling', 2); // move b
  await removeAs(W.coordinator, 'ceiling', 2); // remove b
  const cs = await changes();
  assert.equal(cs.length, 3);

  // Newest first — each is the latest touch on its rows.
  for (const c of [...cs].reverse()) {
    const r = await undo(W.cohost, c.change_id);
    assert.equal(r.error, undefined, `the co-host's Undo of the ${c.kind} raised: ${r.error}`);
    assert.equal(r.status, 'ok', `the co-host's Undo of the ${c.kind} answered ${r.status}`);
  }
  const now = await board();
  for (const row of start) {
    const back = now.find((x) => x.inspiration_id === row.inspiration_id);
    assert.deepEqual(back, row, `row ${row.slot_key}#${row.slot_position} is not back exactly as it was`);
  }
  const added = now.filter((x) => !start.some((s) => s.inspiration_id === x.inspiration_id));
  assert.equal(added.length, 1, 'the replace’s new row should still exist (soft-removed), never deleted');
  assert.notEqual(added[0]!.removed_at, null, 'the photo the coordinator added is still on the board after Undo');
  assert.ok((await changes()).every((c) => c.undone_at !== null), 'a change undone is not marked undone');
  assert.equal((await undo(W.creator, cs[0]!.change_id)).status, 'already', 'an Undo can be pressed twice');
  void a;
});

test('2b · a SWAP (two photos trading places through a parking cell) is one change, and its Undo trades them back', async () => {
  await clearBoard();
  const x = await seedRow('ceiling', 1);
  const y = await seedRow('ceiling', 2);
  const start = await board();
  // The shape of the drag-swap (#7092's swapMoodboardCells): the moving photo parks on a FREE real cell, the other
  // photo takes its place, then the moving photo lands. Three writes, one press.
  await begin(W.coordinator, 'move', 'ceiling');
  for (const [id, pos] of [[x, 3], [y, 1], [x, 2]] as const) {
    const r = await as(W.coordinator, `UPDATE public.event_inspiration_assets SET slot_position = $2 WHERE inspiration_id = $1 RETURNING 1`, [id, pos]);
    assert.equal(r.error, null, `swap step refused: ${r.error}`);
  }
  const cs = await changes();
  assert.equal(cs.length, 1, 'one swap recorded as more than one change');
  assert.equal(cs[0]!.kind, 'move');
  assert.equal((await notices()).length, 2, 'one swap sent more than one notice per owner');
  assert.equal((await undo(W.creator, cs[0]!.change_id)).status, 'ok');
  assert.deepEqual(await board(), start, 'the swap’s Undo did not trade the photos back exactly');
});

test('3 · after 24 hours the Undo is refused and the change stands', async () => {
  await clearBoard();
  await seedRow('stage', 1);
  await removeAs(W.coordinator, 'stage', 1);
  const [c] = await changes();
  await reset();
  await db.query(`UPDATE public.event_mood_board_changes SET first_row_at = now() - interval '24 hours 1 minute', created_at = now() - interval '25 hours' WHERE change_id = $1`, [c!.change_id]);
  const was = await board();
  assert.equal((await undo(W.creator, c!.change_id)).status, 'expired');
  assert.deepEqual(await board(), was, 'an expired Undo changed the board');

  // …and at 23 h 59 it still works.
  await db.query(`UPDATE public.event_mood_board_changes SET first_row_at = now() - interval '23 hours 59 minutes' WHERE change_id = $1`, [c!.change_id]);
  assert.equal((await undo(W.creator, c!.change_id)).status, 'ok', 'an Undo inside the 24 hours was refused');
});

test('4 · nobody but an owner can Undo, and the two halves cannot fake one', async () => {
  await clearBoard();
  await seedRow('stage', 1);
  await removeAs(W.coordinator, 'stage', 1);
  const [c] = await changes();
  const was = await board();
  for (const [who, uid] of [
    ['the coordinator who made it', W.coordinator],
    ['a coordinator at View', W.viewCoordinator],
    ['a guest', W.guest],
    ['a booked supplier', W.plainSupplier],
    ['the host of another event', W.stranger],
  ] as const) {
    const r = await undo(uid, c!.change_id);
    assert.match(r.error ?? `answered ${r.status}`, /not_your_event/, `${who} could Undo the change`);
  }
  // The definer halves, called alone.
  const mark = await as(W.coordinator, `SELECT public.mood_board_change_mark_undone($1)`, [c!.change_id]);
  assert.match(mark.error ?? 'no error', /not_your_event/, 'the coordinator marked their own change undone');
  const fake = await as(W.creator, `SELECT public.mood_board_change_mark_undone($1)`, [c!.change_id]);
  assert.match(fake.error ?? 'no error', /not_restored/, 'an owner marked a change undone without putting anything back');
  const open = await as(W.coordinator, `SELECT public.mood_board_change_open($1, 'upload', 'stage')`, [W.eventId]);
  assert.match(open.error ?? 'no error', /permission denied/, 'a signed-in person may open a change directly');
  const write = await as(W.coordinator, `UPDATE public.event_mood_board_changes SET undone_at = now() RETURNING 1`);
  assert.ok(write.error || write.rows.length === 0, 'the coordinator wrote the changes table directly');
  assert.deepEqual(await board(), was, 'a refused Undo changed the board');
  assert.equal((await changes())[0]!.undone_at, null);
  // The coordinator cannot even read the changes table; the owners can.
  assert.equal((await as(W.coordinator, `SELECT 1 FROM public.event_mood_board_changes`)).rows.length, 0);
  assert.equal((await as(W.cohost, `SELECT 1 FROM public.event_mood_board_changes WHERE event_id = $1`, [W.eventId])).rows.length, 1);
});

test('5 · a later change to the same place makes the Undo refuse in words, and write nothing', async () => {
  await clearBoard();
  await seedRow('stage', 1);
  await uploadAs(W.coordinator, 'stage', 1, 'replace');
  const [first] = await changes();
  // A later change touches the same place — the coordinator's own…
  await removeAs(W.coordinator, 'stage', 1);
  let was = await board();
  assert.equal((await undo(W.creator, first!.change_id)).status, 'moved_on');
  assert.deepEqual(await board(), was, 'a moved-on Undo wrote to the board');

  // Undo the later one first, and the earlier one is undoable again.
  const [, second] = await changes();
  assert.equal((await undo(W.creator, second!.change_id)).status, 'ok');
  assert.equal((await undo(W.creator, first!.change_id)).status, 'ok', 'with the later change undone, the earlier one still refuses');

  // A later change by an OWNER (recorded nowhere) counts just the same: a new photo where the removed one was.
  await clearBoard();
  await seedRow('stage', 1);
  await removeAs(W.coordinator, 'stage', 1);
  const [rm] = await changes();
  await insertAs(W.cohost, 'stage', 1); // an owner puts a new photo where the removed one was
  was = await board();
  assert.equal((await undo(W.creator, rm!.change_id)).status, 'moved_on', 'Undo would have put a photo on top of a newer one');
  assert.deepEqual(await board(), was);
});

test('6 · an owner’s own change records nothing and tells nobody', async () => {
  await clearBoard();
  await seedRow('stage', 1);
  for (const owner of [W.creator, W.cohost]) {
    const r = await begin(owner, 'replace', 'stage');
    assert.equal(r.status, 'host');
    await softRemoveAs(owner, 'stage', 1);
    await insertAs(owner, 'stage', 1);
  }
  await reset();
  const all = await db.query(`SELECT 1 FROM public.event_mood_board_changes WHERE event_id = $1`, [W.eventId]);
  assert.equal(all.rows.length, 0, 'an owner’s change was recorded');
  assert.equal((await notices()).length, 0, 'an owner’s change sent a notice');
});

test('7 · a write that skips the app’s door is recorded all the same, and the door refuses whoever may not write', async () => {
  await clearBoard();
  await seedRow('stage', 1);
  assert.equal(await softRemoveAs(W.coordinator, 'stage', 1), 1);
  const cs = await changes();
  assert.equal(cs.length, 1, 'a direct write by the coordinator went unrecorded');
  assert.equal(cs[0]!.kind, 'change');
  assert.equal((await notices()).length, 2);
  for (const uid of [W.viewCoordinator, W.guest, W.plainSupplier, W.stranger]) {
    assert.equal((await begin(uid, 'upload', 'stage')).status, 'refused');
  }
});

test('8 · suggestions: Edit may Keep / No thanks; a coordinator’s Keep is a change the owners can Undo', async () => {
  await clearBoard();
  // Who may not answer.
  for (const [who, uid] of [
    ['a coordinator at View', W.viewCoordinator],
    ['a guest', W.guest],
    ['the supplier who suggested it', W.plainSupplier],
    ['the host of another event', W.stranger],
  ] as const) {
    const s = await suggestion();
    const keep = await as(uid, `SELECT public.couple_decide_inspiration_suggestion($1, true, NULL)`, [s]);
    assert.match(keep.error ?? 'no error', /not_your_event/, `${who} kept a supplier’s suggestion`);
    const no = await as(uid, `SELECT public.couple_decide_inspiration_suggestion($1, false, NULL)`, [s]);
    assert.match(no.error ?? 'no error', /not_your_event/, `${who} declined a supplier’s suggestion`);
  }
  await reset();
  await db.query(`DELETE FROM public.event_inspiration_suggestions WHERE event_id = $1`, [W.eventId]);

  // The coordinator with Edit reads them, and declines one.
  const declined = await suggestion();
  assert.equal((await as(W.coordinator, `SELECT 1 FROM public.event_inspiration_suggestions WHERE suggestion_id = $1`, [declined])).rows.length, 1, 'Edit cannot read the suggestion it may answer');
  assert.equal((await as(W.viewCoordinator, `SELECT 1 FROM public.event_inspiration_suggestions WHERE suggestion_id = $1`, [declined])).rows.length, 0, 'View reads the suggestions');
  const no = await as<{ r: { status: string } }>(W.coordinator, `SELECT public.couple_decide_inspiration_suggestion($1, false, NULL) AS r`, [declined]);
  assert.equal(no.error, null, `the coordinator could not decline: ${no.error}`);
  assert.equal(no.rows[0]!.r.status, 'ok');

  // …and keeps one, replacing the couple's photo: a recorded change, the owners told.
  const couplePhoto = await seedRow('stage', 1);
  const kept = await suggestion();
  const k = await as<{ r: { status: string; inspiration_id: string } }>(W.coordinator, `SELECT public.couple_decide_inspiration_suggestion($1, true, 1::smallint) AS r`, [kept]);
  assert.equal(k.error, null, `the coordinator could not keep: ${k.error}`);
  assert.equal(k.rows[0]!.r.status, 'ok');
  const [c] = await changes();
  assert.equal(c?.kind, 'keep', 'a coordinator’s Keep is not a recorded change');
  assert.deepEqual(new Set(Object.keys(c!.touched)), new Set([couplePhoto, k.rows[0]!.r.inspiration_id]));
  const ns = await notices();
  assert.equal(ns.length, 2);
  assert.match(ns[0]!.body, /^Kept a photo from Bloom & Co\./);

  // The owner undoes it: the couple's photo is back, the kept one is off, the suggestion waits again.
  assert.equal((await undo(W.creator, c!.change_id)).status, 'ok');
  const rows = await board();
  assert.equal(rows.find((r) => r.inspiration_id === couplePhoto)!.removed_at, null, 'the couple’s photo is not back');
  assert.notEqual(rows.find((r) => r.inspiration_id === k.rows[0]!.r.inspiration_id)!.removed_at, null);
  await reset();
  const st = await db.query<{ state: string }>(`SELECT state FROM public.event_inspiration_suggestions WHERE suggestion_id = $1`, [kept]);
  assert.equal(st.rows[0]!.state, 'waiting', 'an undone Keep does not wait for an answer again');

  // The coordinator keeps it again and takes it back from their own toast: their change closes, no second one.
  await as(W.coordinator, `SELECT public.couple_decide_inspiration_suggestion($1, true, NULL)`, [kept]);
  const t = await as<{ r: { status: string } }>(W.coordinator, `SELECT public.couple_undo_kept_inspiration_suggestion($1) AS r`, [kept]);
  assert.equal(t.error, null, `the coordinator’s toast Undo raised: ${t.error}`);
  assert.equal(t.rows[0]!.r.status, 'ok');
  const after = await changes();
  assert.equal(after.length, 2, 'the toast Undo recorded a change of its own');
  assert.notEqual(after[1]!.undone_at, null, 'the coordinator’s own take-back did not close their change');
  assert.equal((await notices()).length, 4, 'one notice per owner for the second Keep, none for the take-back');
});

test('9 · Home’s ONE read: the owners get both lists, the coordinator the suggestions, a guest neither', async () => {
  await clearBoard();
  await reset();
  await db.query(`DELETE FROM public.event_inspiration_suggestions WHERE event_id = $1`, [W.eventId]);
  await suggestion('stage');
  await seedRow('stage', 1);
  await removeAs(W.coordinator, 'stage', 1);
  type Asks = { editor: boolean; owner: boolean; suggestions: { shop_label: string; part_label: string }[]; changes: { actor_label: string; kind: string; undo_until: string }[] };
  const read = async (uid: string) => {
    const r = await as<{ r: Asks }>(uid, `SELECT public.mood_board_home_asks($1) AS r`, [W.eventId]);
    assert.equal(r.error, null, r.error ?? '');
    return r.rows[0]!.r;
  };
  const owner = await read(W.cohost);
  assert.equal(owner.suggestions.length, 1, 'the owner’s Home does not list the waiting suggestion');
  assert.equal(owner.suggestions[0]!.shop_label, 'Bloom & Co.');
  assert.equal(owner.changes.length, 1, 'the owner’s Home does not list the coordinator’s change');
  assert.equal(owner.changes[0]!.actor_label, 'Coordinator Styled by Bea');
  assert.equal(owner.changes[0]!.kind, 'remove');
  const coord = await read(W.coordinator);
  assert.equal(coord.suggestions.length, 1, 'the coordinator with Edit does not see what they may Keep');
  assert.equal(coord.changes.length, 0, 'the coordinator sees the owners’ Undo list');
  const guest = await read(W.guest);
  assert.equal(guest.suggestions.length + guest.changes.length, 0, 'a guest sees Mood Board asks');
  // An undone change leaves Home.
  const [c] = await changes();
  await undo(W.creator, c!.change_id);
  assert.equal((await read(W.creator)).changes.length, 0, 'an undone change is still on Home');
});
