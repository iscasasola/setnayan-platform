/**
 * ✋ A SUPPLIER PROPOSES; A HOST OR THE COORDINATOR DECIDES — asserted against the REPLAYED schema, every step through
 * a real `authenticated` session (owner rule, 8 Nov 2026, verbatim: *"so each supplier or coordinator can request for
 * access for different parts of the event. they only see these specific parts and edit it as needed. only coordinator
 * and hosts has the final say. so any supplier that is not a coordinator still has to request a host or coordinator to
 * accept the change."*).
 *
 * Migrations 20271329284628 (one booked-coordinator fact) · 20271329978605 (a supplier's seat is capped at view) ·
 * 20271330396757 (the coordinator answers a supplier's ask) · 20271331202840 (a supplier proposes a change).
 *
 *   1 · ONE FACT: `is_booked_coordinator` agrees with `current_coordinator_booked_event_ids` for every person; a
 *       `wedding_planner_external` SEAT does not make a photographer the coordinator.
 *   2 · ACCESS: a photographer's ask is stamped answerable by the coordinator (they cannot stamp it themselves); the
 *       coordinator reads it and answers it; the coordinator cannot share a part they do not hold; nobody answers
 *       their own ask; a coordinator's own ask is the hosts' alone; a stranger reads and answers nothing.
 *   3 · PER PART (guest list · seat plan · suppliers · schedule · mood board): the granted photographer READS the part
 *       and cannot WRITE it directly — even with the seat set to Edit; the coordinator writes directly.
 *   4 · CHANGE REQUESTS: the photographer's proposal waits (nothing changed); a host accepts it and it is applied in
 *       place; the coordinator accepts one; a decline changes nothing; the proposer cannot accept their own; a supplier
 *       without the part cannot propose; a stranger sees none; the payload whitelist refuses a price.
 *   5 · WHAT A "SUPPLIERS" GRANT SHOWS (verified, not changed): the granted photographer reads the other suppliers'
 *       prices and contact details.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const NARROW = { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false };
const COORDINATOR_AREAS = {
  guest_list: 'edit', seat_plan: 'edit', schedule: 'edit', vendors: 'edit',
  invitations: 'edit', mood_board: 'view', budget: null, photos: null,
};

const W = {
  eventId: '',
  otherEventId: '',
  host: '',
  coordinator: '',
  coordinator2: '',
  photographer: '',
  florist: '',
  stranger: '',
  photoShop: '',
  coordShop: '',
  floristShop: '',
  coordShop2: '',
  guestId: '',
  guest2Id: '',
  tableId: '',
  floristRow: '',
  blockId: '',
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
async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
async function bookedShop(uid: string, name: string, services: string[], category: string, eventId = W.eventId): Promise<string> {
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', $3::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
    [uid, name, services],
  );
  const shop = vp.rows[0]!.vendor_profile_id;
  await db.query(
    `INSERT INTO public.event_vendors (event_id, vendor_name, category, status, marketplace_vendor_id, total_cost_php, contact_phone, contact_email)
     VALUES ($1, $2, $3::public.vendor_category, 'contracted', $4, 50000, '09170000001', 'shop@example.test')`,
    [eventId, name, category, shop],
  );
  return shop;
}
async function seat(uid: string, perms: unknown, role = 'wedding_planner_external'): Promise<void> {
  await db.query(
    `INSERT INTO public.event_moderators (event_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, now())
     ON CONFLICT (event_id, user_id) DO UPDATE SET permissions_json = EXCLUDED.permissions_json, removed_at = NULL`,
    [W.eventId, role, JSON.stringify(perms), W.host, uid],
  );
}
async function ask(uid: string, shop: string, areas: string[]): Promise<{ id: string | null; error: string | null }> {
  const r = await as<{ request_id: string }>(
    uid,
    `INSERT INTO public.event_access_requests (event_id, requester_user_id, vendor_profile_id, requested_areas)
     VALUES ($1, $2, $3, $4::text[]) RETURNING request_id`,
    [W.eventId, uid, shop, areas],
  );
  return { id: r.rows[0]?.request_id ?? null, error: r.error };
}
async function answer(uid: string, requestId: string, verdicts: Record<string, string>) {
  return as<{ r: Record<string, unknown> }>(uid, `SELECT public.answer_area_access_request($1, $2::jsonb) AS r`, [
    requestId,
    JSON.stringify(verdicts),
  ]);
}
async function levelOf(uid: string, area: string): Promise<string | null> {
  const r = await as<{ l: string | null }>(uid, `SELECT public.moderator_area_level($1, $2) AS l`, [W.eventId, area]);
  return r.rows[0]?.l ?? null;
}
async function propose(uid: string, shop: string, area: string, op: string, target: string | null, payload: unknown) {
  return as<{ change_id: string }>(
    uid,
    `INSERT INTO public.event_change_requests (event_id, area, op, target_id, payload, summary, proposer_user_id, vendor_profile_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, 'A change', $6, $7) RETURNING change_id`,
    [W.eventId, area, op, target, JSON.stringify(payload), uid, shop],
  );
}
async function decide(uid: string, changeId: string, accept: boolean) {
  return as<{ r: Record<string, unknown> }>(uid, `SELECT public.answer_event_change_request($1, $2, NULL) AS r`, [changeId, accept]);
}
async function owner<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  await reset();
  return (await db.query<T>(sql, params)).rows;
}
async function guestName(guestId: string): Promise<string> {
  const r = await owner<{ n: string }>(`SELECT first_name AS n FROM public.guests WHERE guest_id = $1`, [guestId]);
  return r[0]!.n;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  W.host = await newUser('host@final-say.test');
  W.coordinator = await newUser('coordinator@final-say.test');
  W.coordinator2 = await newUser('coordinator2@final-say.test');
  W.photographer = await newUser('photographer@final-say.test');
  W.florist = await newUser('florist@final-say.test');
  W.stranger = await newUser('stranger@final-say.test');

  W.eventId = (await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Final Say', 'birthday') RETURNING event_id`,
  )).rows[0]!.event_id;
  W.otherEventId = (await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Elsewhere', 'birthday') RETURNING event_id`,
  )).rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`,
    [W.eventId, W.host],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`,
    [W.otherEventId, W.stranger],
  );

  W.coordShop = await bookedShop(W.coordinator, 'Planned by Ana', ['planner_coordinator', 'day_of_coordinator'], 'planner_coordinator');
  // A second coordinator shop, booked under another category (one coordinator booking per category is the lock) —
  // the trade fact reads the shop's services, never the booking's category.
  W.coordShop2 = await bookedShop(W.coordinator2, 'Second Planner', ['planner_coordinator'], 'misc');
  W.photoShop = await bookedShop(W.photographer, 'Shots by Ben', ['photographer'], 'photographer');
  W.floristShop = await bookedShop(W.florist, 'Bloom & Co.', ['florist'], 'florist');
  W.floristRow = (await owner<{ v: string }>(
    `SELECT vendor_id AS v FROM public.event_vendors WHERE marketplace_vendor_id = $1`,
    [W.floristShop],
  ))[0]!.v;

  // The coordinator holds the coordinator grant (the claim approval's seat). Budget: not held.
  await seat(W.coordinator, { ...NARROW, areas: COORDINATOR_AREAS });

  W.guestId = (await owner<{ g: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1, 'Lorna', 'Reyes', 'both', 'family') RETURNING guest_id AS g`,
    [W.eventId],
  ))[0]!.g;
  W.guest2Id = (await owner<{ g: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1, 'Mario', 'Cruz', 'both', 'friends') RETURNING guest_id AS g`,
    [W.eventId],
  ))[0]!.g;
  W.tableId = (await owner<{ t: string }>(
    `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity) VALUES ($1, 'Table 4', 'round_8', 8) RETURNING table_id AS t`,
    [W.eventId],
  ))[0]!.t;
  W.blockId = (await owner<{ b: string }>(
    `INSERT INTO public.event_schedule_blocks (event_id, label, block_type, start_at) VALUES ($1, 'Ceremony', 'ceremony', '2027-02-14 15:00+08') RETURNING block_id AS b`,
    [W.eventId],
  ))[0]!.b;
});

after(async () => {
  await reset();
  await db?.close?.();
});

// ─── 1 · one fact ─────────────────────────────────────────────────────────

test('1 · is_booked_coordinator is the trade fact, for every person — a planner seat does not make a photographer the coordinator', async () => {
  // The photographer gets the supplier's seat, exactly as the access answer writes it.
  await seat(W.photographer, { ...NARROW, areas: { guest_list: 'view' } });
  for (const [label, uid, expected] of [
    ['coordinator', W.coordinator, true],
    ['second coordinator', W.coordinator2, true],
    ['photographer with a planner seat', W.photographer, false],
    ['florist', W.florist, false],
    ['host', W.host, false],
    ['stranger', W.stranger, false],
  ] as const) {
    const r = await as<{ fact: boolean; via_set: boolean }>(
      uid,
      `SELECT public.is_booked_coordinator($1) AS fact, $1 IN (SELECT public.current_coordinator_booked_event_ids()) AS via_set`,
      [W.eventId],
    );
    assert.equal(r.error, null, `${label}: ${r.error}`);
    assert.equal(r.rows[0]!.fact, expected, `${label}: is_booked_coordinator`);
    assert.equal(r.rows[0]!.fact, r.rows[0]!.via_set, `${label}: the two answers disagree`);
  }
  // anon cannot ask; the per-user helpers are not a browser's to call.
  await reset();
  await db.exec(`SET ROLE anon`);
  const anon = await db.query(`SELECT public.is_booked_coordinator($1)`, [W.eventId]).then(() => null, (e: Error) => e.message);
  await reset();
  assert.match(anon ?? '', /permission denied/i);
  for (const fn of ['is_booked_coordinator_for', 'supplier_proposes_only_for']) {
    const r = await as(W.photographer, `SELECT public.${fn}($1, $2)`, [W.eventId, W.photographer]);
    assert.match(r.error ?? '', /permission denied/i, `${fn} is callable by a browser`);
  }
});

// ─── 2 · access asks ─────────────────────────────────────────────────────

test('🔒 2 · the photographer asks; the coordinator answers; nobody answers their own; a coordinator’s ask is the hosts’', async () => {
  await owner(`DELETE FROM public.event_moderators WHERE user_id = $1`, [W.photographer]);

  const photoAsk = await ask(W.photographer, W.photoShop, ['guest_list', 'seat_plan', 'vendors', 'schedule', 'mood_board', 'budget']);
  assert.equal(photoAsk.error, null, `the photographer could not ask: ${photoAsk.error}`);
  const stamped = await owner<{ a: boolean }>(`SELECT answerable_by_coordinator AS a FROM public.event_access_requests WHERE request_id = $1`, [photoAsk.id]);
  assert.equal(stamped[0]!.a, true, 'a non-coordinator’s ask must be answerable by the coordinator');

  // The asker cannot re-stamp it; nobody reads it but the hosts, the coordinators and the asker.
  // Refused outright by the column grants, or kept by the trigger — either way the stamp never moves.
  await as(W.photographer, `UPDATE public.event_access_requests SET answerable_by_coordinator = false WHERE request_id = $1`, [photoAsk.id]);
  await owner(`UPDATE public.event_access_requests SET answerable_by_coordinator = false WHERE request_id = $1`, [photoAsk.id]);
  const kept = await owner<{ a: boolean }>(`SELECT answerable_by_coordinator AS a FROM public.event_access_requests WHERE request_id = $1`, [photoAsk.id]);
  assert.equal(kept[0]!.a, true, 'the stamp moved after the ask was made');

  for (const [label, uid, sees] of [
    ['host', W.host, true],
    ['coordinator', W.coordinator, true],
    ['florist', W.florist, false],
    ['stranger', W.stranger, false],
  ] as const) {
    const r = await as(uid, `SELECT 1 FROM public.event_access_requests WHERE request_id = $1`, [photoAsk.id]);
    assert.equal(r.rows.length === 1, sees, `${label} ${sees ? 'cannot' : 'can'} read the photographer’s ask`);
  }

  // Nobody answers their own; a stranger and another supplier answer nothing.
  assert.match((await answer(W.photographer, photoAsk.id!, { guest_list: 'granted' })).error ?? '', /their own ask/);
  assert.match((await answer(W.stranger, photoAsk.id!, { guest_list: 'granted' })).error ?? '', /only a host or the coordinator/);
  assert.match((await answer(W.florist, photoAsk.id!, { guest_list: 'granted' })).error ?? '', /only a host or the coordinator/);
  // The coordinator cannot share what they do not hold (Budget & payments).
  assert.match((await answer(W.coordinator, photoAsk.id!, { budget: 'granted' })).error ?? '', /do not hold/);

  // The coordinator answers: shares four, declines the budget.
  const ok = await answer(W.coordinator, photoAsk.id!, {
    guest_list: 'granted', seat_plan: 'granted', vendors: 'granted', schedule: 'granted', mood_board: 'granted', budget: 'declined',
  });
  assert.equal(ok.error, null, `the coordinator could not answer: ${ok.error}`);
  assert.equal((ok.rows[0]!.r as { answered_as: string }).answered_as, 'coordinator');
  const seatRow = await owner<{ p: { areas: Record<string, string | null> }; role: string }>(
    `SELECT permissions_json AS p, role_subtype AS role FROM public.event_moderators WHERE event_id = $1 AND user_id = $2`,
    [W.eventId, W.photographer],
  );
  assert.equal(seatRow[0]!.role, 'wedding_planner_external');
  for (const a of ['guest_list', 'seat_plan', 'vendors', 'schedule', 'mood_board']) {
    assert.equal(seatRow[0]!.p.areas[a], 'view', `${a}: a non-coordinator is granted VIEW — see and propose`);
  }
  assert.equal(seatRow[0]!.p.areas.budget ?? null, null, 'a declined line was granted');

  // A coordinator's own ask: stamped hosts-only; the other coordinator cannot read or answer it; the host answers.
  await owner(`DELETE FROM public.event_moderators WHERE user_id = $1`, [W.coordinator2]);
  const coordAsk = await ask(W.coordinator2, W.coordShop2, ['guest_list', 'budget']);
  assert.equal(coordAsk.error, null, coordAsk.error ?? '');
  const st2 = await owner<{ a: boolean }>(`SELECT answerable_by_coordinator AS a FROM public.event_access_requests WHERE request_id = $1`, [coordAsk.id]);
  assert.equal(st2[0]!.a, false, 'a coordinator’s ask must be the hosts’ alone');
  assert.equal((await as(W.coordinator, `SELECT 1 FROM public.event_access_requests WHERE request_id = $1`, [coordAsk.id])).rows.length, 0,
    'one coordinator reads another coordinator’s ask');
  assert.match((await answer(W.coordinator, coordAsk.id!, { guest_list: 'granted' })).error ?? '', /only a host or the coordinator/,
    'a coordinator approved a coordinator’s ask');
  assert.match((await answer(W.coordinator2, coordAsk.id!, { guest_list: 'granted' })).error ?? '', /their own ask/, 'self-approval');
  const hostOk = await answer(W.host, coordAsk.id!, { guest_list: 'granted', budget: 'granted' });
  assert.equal(hostOk.error, null, hostOk.error ?? '');
  assert.equal(await levelOf(W.coordinator2, 'guest_list'), 'edit', 'the booked coordinator is granted Edit');
  assert.equal(await levelOf(W.coordinator2, 'budget'), 'view', 'Budget is never more than View');
});

// ─── 3 · per part: see, never write directly ─────────────────────────────

test('🔒 3 · per part — the granted photographer reads and cannot write, even set to Edit; the coordinator writes', async () => {
  // The host raises every part to Edit in People with access — the cap must hold anyway.
  await seat(W.photographer, {
    ...NARROW,
    areas: { guest_list: 'edit', seat_plan: 'edit', vendors: 'edit', schedule: 'edit', mood_board: 'edit', budget: 'view' },
  });
  for (const a of ['guest_list', 'seat_plan', 'vendors', 'schedule', 'mood_board']) {
    assert.equal(await levelOf(W.photographer, a), 'view', `${a}: a non-coordinator’s Edit was not capped`);
  }

  const reads: [string, string, unknown[]][] = [
    ['guest list', `SELECT 1 FROM public.guests WHERE guest_id = $1`, [W.guestId]],
    ['seat plan', `SELECT 1 FROM public.event_tables WHERE table_id = $1`, [W.tableId]],
    ['suppliers', `SELECT 1 FROM public.event_vendors WHERE vendor_id = $1`, [W.floristRow]],
    ['schedule', `SELECT 1 FROM public.event_schedule_blocks WHERE block_id = $1`, [W.blockId]],
  ];
  for (const [label, sql, params] of reads) {
    assert.equal((await as(W.photographer, sql, params)).rows.length, 1, `the granted photographer cannot SEE the ${label}`);
    assert.equal((await as(W.stranger, sql, params)).rows.length, 0, `a stranger sees the ${label}`);
  }

  const writes: [string, string, unknown[]][] = [
    ['guest list', `UPDATE public.guests SET first_name = 'Hacked' WHERE guest_id = $1 RETURNING 1`, [W.guestId]],
    ['seat plan', `INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id) VALUES ($1, $2, $3) RETURNING 1`, [W.eventId, W.tableId, W.guestId]],
    ['suppliers', `UPDATE public.event_vendors SET contact_phone = '000' WHERE vendor_id = $1 RETURNING 1`, [W.floristRow]],
    ['schedule', `UPDATE public.event_schedule_blocks SET label = 'Moved' WHERE block_id = $1 RETURNING 1`, [W.blockId]],
  ];
  for (const [label, sql, params] of writes) {
    const r = await as(W.photographer, sql, params);
    assert.equal(r.rows.length, 0, `the photographer wrote the ${label} directly`);
  }
  assert.equal(await guestName(W.guestId), 'Lorna');
  const mood = await as<{ ok: boolean }>(W.photographer, `SELECT public.can_change_mood_board_photos($1) AS ok`, [W.eventId]);
  assert.equal(mood.rows[0]!.ok, false, 'the photographer may change the Mood Board directly');

  // The coordinator writes directly — their own changes apply.
  const c = await as(W.coordinator, `UPDATE public.guests SET dietary_restrictions = 'No pork' WHERE guest_id = $1 RETURNING 1`, [W.guestId]);
  assert.equal(c.rows.length, 1, `the coordinator could not write the guest list: ${c.error}`);
  const cs = await as(W.coordinator, `UPDATE public.event_schedule_blocks SET label = 'Ceremony (church)' WHERE block_id = $1 RETURNING 1`, [W.blockId]);
  assert.equal(cs.rows.length, 1, `the coordinator could not write the schedule: ${cs.error}`);

  // …a HOST whose own shop is booked on their own event is never "a supplier who proposes".
  await owner(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'invited')
     ON CONFLICT (event_id, user_id) DO UPDATE SET member_type = 'couple'`,
    [W.eventId, W.florist],
  );
  const hostSupplier = await as<{ p: boolean }>(W.florist, `SELECT public.supplier_proposes_only($1) AS p`, [W.eventId]);
  assert.equal(hostSupplier.rows[0]!.p, false, 'a host with a booked shop on their own event was told to propose');
  await owner(`DELETE FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [W.eventId, W.florist]);
  const plainSupplier = await as<{ p: boolean }>(W.florist, `SELECT public.supplier_proposes_only($1) AS p`, [W.eventId]);
  assert.equal(plainSupplier.rows[0]!.p, true);

  // …and a seat the couple gave a booked supplier in ANOTHER role (best man) keeps its Edit — the hosts' own choice.
  await seat(W.florist, { ...NARROW, areas: { guest_list: 'edit' } }, 'best_man');
  assert.equal(await levelOf(W.florist, 'guest_list'), 'edit', 'a co-host seat held by a supplier was capped');
  await owner(`DELETE FROM public.event_moderators WHERE user_id = $1`, [W.florist]);
});

// ─── 4 · change requests ─────────────────────────────────────────────────

test('🔒 4 · a proposal waits; a host or the coordinator accepts it in place; nobody accepts their own', async () => {
  await seat(W.photographer, { ...NARROW, areas: { guest_list: 'view', seat_plan: 'view', vendors: 'view' } });

  // Edit a guest — waits, nothing changed.
  const edit = await propose(W.photographer, W.photoShop, 'guest_list', 'guest_edit', W.guestId, { changes: { first_name: 'Lorena', meal_preference: 'fish' } });
  assert.equal(edit.error, null, `the photographer could not propose: ${edit.error}`);
  const editId = edit.rows[0]!.change_id;
  assert.equal(await guestName(W.guestId), 'Lorna', 'a proposal changed the guest before anybody accepted it');

  // Nobody accepts their own; a stranger and another supplier cannot.
  assert.match((await decide(W.photographer, editId, true)).error ?? '', /their own change/);
  assert.match((await decide(W.stranger, editId, true)).error ?? '', /only a host or the coordinator/);
  assert.match((await decide(W.florist, editId, true)).error ?? '', /only a host or the coordinator/);
  // The proposer cannot flip it to accepted by hand.
  const forge = await as(W.photographer, `UPDATE public.event_change_requests SET status = 'accepted' WHERE change_id = $1 RETURNING 1`, [editId]);
  assert.equal(forge.rows.length, 0, 'the proposer marked their own change accepted');

  // The host accepts — applied in place.
  const hostAccept = await decide(W.host, editId, true);
  assert.equal(hostAccept.error, null, hostAccept.error ?? '');
  const g = await owner<{ f: string; m: string }>(`SELECT first_name AS f, meal_preference::text AS m FROM public.guests WHERE guest_id = $1`, [W.guestId]);
  assert.deepEqual(g[0], { f: 'Lorena', m: 'fish' }, 'the accepted change did not land');
  assert.match((await decide(W.host, editId, true)).error ?? '', /already answered/);

  // Seat plan: the coordinator accepts.
  const move = await propose(W.photographer, W.photoShop, 'seat_plan', 'seat_move', W.guest2Id, { table_id: W.tableId });
  assert.equal(move.error, null, move.error ?? '');
  assert.equal((await owner(`SELECT 1 FROM public.event_seat_assignments WHERE guest_id = $1`, [W.guest2Id])).length, 0);
  const coordAccept = await decide(W.coordinator, move.rows[0]!.change_id, true);
  assert.equal(coordAccept.error, null, coordAccept.error ?? '');
  assert.equal((coordAccept.rows[0]!.r as { answered_as: string }).answered_as, 'coordinator');
  assert.equal((await owner(`SELECT 1 FROM public.event_seat_assignments WHERE guest_id = $1 AND table_id = $2`, [W.guest2Id, W.tableId])).length, 1,
    'the coordinator’s accept did not seat the guest');

  // Suppliers: declined — nothing changes.
  const sup = await propose(W.photographer, W.photoShop, 'vendors', 'supplier_edit', W.floristRow, { changes: { contact_phone: '09999999999' } });
  assert.equal(sup.error, null, sup.error ?? '');
  assert.equal((await decide(W.host, sup.rows[0]!.change_id, false)).error, null);
  const phone = await owner<{ p: string }>(`SELECT contact_phone AS p FROM public.event_vendors WHERE vendor_id = $1`, [W.floristRow]);
  assert.equal(phone[0]!.p, '09170000001', 'a declined change was applied');

  // Add and remove a guest — the host accepts both.
  const add = await propose(W.photographer, W.photoShop, 'guest_list', 'guest_add', null, { first_name: 'Nena', last_name: 'Santos' });
  assert.equal(add.error, null, add.error ?? '');
  assert.equal((await decide(W.host, add.rows[0]!.change_id, true)).error, null);
  assert.equal((await owner(`SELECT 1 FROM public.guests WHERE event_id = $1 AND first_name = 'Nena' AND deleted_at IS NULL`, [W.eventId])).length, 1);
  const rm = await propose(W.photographer, W.photoShop, 'guest_list', 'guest_remove', W.guest2Id, {});
  assert.equal(rm.error, null, rm.error ?? '');
  assert.equal((await decide(W.coordinator, rm.rows[0]!.change_id, true)).error, null);
  assert.equal((await owner(`SELECT 1 FROM public.guests WHERE guest_id = $1 AND deleted_at IS NOT NULL`, [W.guest2Id])).length, 1);

  // The whitelist: a price, a status and an unknown op are refused at INSERT.
  for (const [label, area, op, target, payload] of [
    ['a price', 'vendors', 'supplier_edit', W.floristRow, { changes: { total_cost_php: '1' } }],
    ['a status', 'vendors', 'supplier_edit', W.floristRow, { changes: { status: 'cancelled' } }],
    ['an empty edit', 'guest_list', 'guest_edit', W.guestId, {}],
    ['a seat change in the guest list', 'guest_list', 'seat_move', W.guestId, { table_id: null }],
  ] as const) {
    const r = await propose(W.photographer, W.photoShop, area, op, target, payload);
    assert.ok(r.error, `${label} was accepted as a proposal`);
  }

  // A supplier without the part cannot propose; a stranger sees none of it.
  const noPart = await propose(W.florist, W.floristShop, 'guest_list', 'guest_add', null, { first_name: 'X' });
  assert.ok(noPart.error, 'a supplier with no guest-list grant proposed a guest');
  assert.equal((await as(W.stranger, `SELECT 1 FROM public.event_change_requests WHERE event_id = $1`, [W.eventId])).rows.length, 0,
    'a stranger reads the change requests');
  assert.ok((await as(W.host, `SELECT 1 FROM public.event_change_requests WHERE event_id = $1`, [W.eventId])).rows.length >= 4);
  assert.ok((await as(W.coordinator, `SELECT 1 FROM public.event_change_requests WHERE event_id = $1`, [W.eventId])).rows.length >= 4);
  // The proposer withdraws their own open change.
  const w = await propose(W.photographer, W.photoShop, 'guest_list', 'guest_add', null, { first_name: 'Withdrawn' });
  const wd = await as(W.photographer, `UPDATE public.event_change_requests SET status = 'withdrawn' WHERE change_id = $1 RETURNING 1`, [w.rows[0]!.change_id]);
  assert.equal(wd.rows.length, 1, `the proposer could not withdraw: ${wd.error}`);
});

// ─── 5 · what a suppliers grant shows (verified, not changed) ────────────

test('5 · a "Suppliers" grant shows the other suppliers’ contact details; the money reader hides their prices', async () => {
  // #5936 · migration 20271342818285 (migration A of two): the app reads the five booking amounts only through
  // event_vendor_money_read, which hides them from a seat without Budget & payments. The direct column is still
  // selectable until migration B (the per-column close, a follow-up PR) — that PR turns the price assertion below
  // into "refused".
  const hidden = await as<{ total_cost_php: string | null; money_shown: boolean }>(
    W.photographer,
    `SELECT total_cost_php, money_shown FROM public.event_vendor_money_read($1) WHERE vendor_id = $2`,
    [W.eventId, W.floristRow],
  );
  assert.deepEqual(hidden.rows, [{ total_cost_php: null, money_shown: false }], 'the reader hides the price from a Suppliers-only seat');
  const r = await as<{ total_cost_php: string | null; contact_phone: string | null; contact_email: string | null }>(
    W.photographer,
    `SELECT total_cost_php, contact_phone, contact_email FROM public.event_vendors WHERE vendor_id = $1`,
    [W.floristRow],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(Number(r.rows[0]!.total_cost_php), 50000, 'the florist’s price is still readable directly until migration B closes the column');
  assert.equal(r.rows[0]!.contact_email, 'shop@example.test', 'the florist’s contact is readable to a supplier holding Suppliers');
});
