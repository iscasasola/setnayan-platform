/**
 * ONE INVITATION, ONE ACCOUNT — asserted against the REPLAYED schema, because
 * the thing that refuses a second account is the database, not a screen.
 *
 * ⚖ Owner, 2026-10-01 (verbatim): *"save to my account. adds it to a user. if
 * someone tries to sync it to a different email. they cannot. we will say this
 * event QR is already assigned to someone."*
 *
 * ── What is pinned ─────────────────────────────────────────────────────────
 * A guest row (the invitation, the event QR) that account A has saved is
 * REFUSED to account B by every write shape the app uses to link one, and A's
 * link is left exactly as it was — never re-pointed, never doubled:
 *
 *   1. the "Save to my account" binders — `linkGuestSessionToUser` and
 *      `connectEventForUser` — upsert `ON CONFLICT (event_id, user_id) DO
 *      NOTHING`. That conflict target absorbs only B's OWN duplicate; the
 *      partial unique `event_members_event_guest_uniq` (event_id, guest_id)
 *      still fires 23505, which they report as `guest_already_claimed`;
 *   2. the plain inserts — the join door's seed bind, a couple's Keep/Link
 *      (`issueRequestKey`), the account auto-surface — 23505;
 *   3. moving an EXISTING membership of B's onto A's row (the claims-merge
 *      shape, `UPDATE … SET guest_id`) — 23505;
 *   4. B's own client, straight at PostgREST — there is NO self-join INSERT
 *      policy since 20271014300000 (only `couple_can_add_member`, for the
 *      couple's own event), so RLS refuses it before the index is reached;
 *   5. the incoming-request YES (`answer_incoming_request`) — the row is not
 *      B's request at all once A holds it ('not_your_request', 42501), even
 *      when the invitation carries B's email.
 *
 * 🔑 THE CONTROL that makes the refusals mean something: B's identical write
 * on a FREE row succeeds. A schema that refused every guest link would pass
 * every refusal above and be a different product.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

let EVENT = '';
let A = '';
let B = '';
let HELD = '';
let FREE = '';

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

async function guest(first: string, email: string | null): Promise<string> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, email)
     VALUES ($1, $2, 'Reyes', 'both', 'friends', $3) RETURNING guest_id`,
    [EVENT, first, email],
  );
  return g.rows[0]!.guest_id;
}

/** Run a write; return the SQLSTATE it was refused with, or null when it landed. */
async function refusedWith(sql: string, params: unknown[]): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return String((e as { code?: string }).code ?? 'unknown');
  }
}

async function holdersOf(guestId: string): Promise<string[]> {
  const r = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.event_members WHERE event_id = $1 AND guest_id = $2 ORDER BY id`,
    [EVENT, guestId],
  );
  return r.rows.map((x) => x.user_id);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const creator = await newUser('creator@one-invite.test');
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
     VALUES ('One Invite Party', 'birthday', '2027-06-06'::date, 'day', 'NCR') RETURNING event_id`,
  );
  EVENT = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
     VALUES ($1, $2, 'couple', 'created_event')`,
    [EVENT, creator],
  );
  A = await newUser('first@one-invite.test');
  B = await newUser('second@one-invite.test');
  // The held invitation carries B's email — the strongest case: even the
  // address on the row does not let a second account take it.
  HELD = await guest('Ana', 'second@one-invite.test');
  FREE = await guest('Bea', null);
  // A saves it first (the join door's seed-bind shape).
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, role, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest', 'guest_signup', $3)`,
    [EVENT, A, HELD],
  );
});

after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});

test('the first account holds the invitation', async () => {
  assert.deepEqual(await holdersOf(HELD), [A]);
});

test('1 · the Save binders’ upsert (ON CONFLICT (event_id, user_id) DO NOTHING) is refused 23505 — A unchanged', async () => {
  const code = await refusedWith(
    `INSERT INTO public.event_members (event_id, user_id, member_type, role, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest', 'guest_signup', $3)
     ON CONFLICT (event_id, user_id) DO NOTHING`,
    [EVENT, B, HELD],
  );
  assert.equal(code, '23505', 'a second account’s Save is no longer refused by the database');
  assert.deepEqual(await holdersOf(HELD), [A], 'the first link moved or doubled');
});

test('2 · a plain insert (join door · Keep/Link · auto-surface) is refused 23505 — A unchanged', async () => {
  const code = await refusedWith(
    `INSERT INTO public.event_members (event_id, user_id, member_type, role, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest', 'invite_claim', $3)`,
    [EVENT, B, HELD],
  );
  assert.equal(code, '23505');
  assert.deepEqual(await holdersOf(HELD), [A]);
});

test('3 · moving B’s existing membership onto A’s invitation is refused 23505 — A unchanged', async () => {
  const other = await newUser('third@one-invite.test');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, role, joined_via)
     VALUES ($1, $2, 'guest', 'guest', 'qr_scan')`,
    [EVENT, other],
  );
  const code = await refusedWith(
    `UPDATE public.event_members SET guest_id = $3 WHERE event_id = $1 AND user_id = $2`,
    [EVENT, other, HELD],
  );
  assert.equal(code, '23505');
  assert.deepEqual(await holdersOf(HELD), [A]);
  await db.query(`DELETE FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [EVENT, other]);
});

test('4 · B’s own client cannot write a guest link at all (RLS — no self-join policy)', async () => {
  await db.exec('SET ROLE authenticated');
  await setAuthUid(db, B);
  let code: string | null = null;
  try {
    code = await refusedWith(
      `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
       VALUES ($1, $2, 'guest', 'qr_scan', $3)`,
      [EVENT, B, HELD],
    );
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
  assert.equal(code, '42501', 'an account may self-insert a guest link to a held invitation');
  assert.deepEqual(await holdersOf(HELD), [A]);
});

test('5 · the incoming-request YES does not offer — or take — an invitation A holds, even on B’s email', async () => {
  await db.exec('SET ROLE authenticated');
  await setAuthUid(db, B);
  let offered = -1;
  let code: string | null = null;
  try {
    offered = (
      await db.query(`SELECT 1 FROM public.incoming_requests_for_me() q WHERE q.guest_id = $1`, [HELD])
    ).rows.length;
    code = await refusedWith(`SELECT * FROM public.answer_incoming_request($1, true)`, [HELD]);
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
  assert.equal(offered, 0, 'a held invitation is still offered to the account its email matches');
  assert.equal(code, '42501', 'a held invitation is not refused as not_your_request');
  assert.deepEqual(await holdersOf(HELD), [A]);
});

test('🔑 control — the same Save on a FREE invitation lands for B (the refusal is about A, not about B)', async () => {
  const code = await refusedWith(
    `INSERT INTO public.event_members (event_id, user_id, member_type, role, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest', 'guest_signup', $3)
     ON CONFLICT (event_id, user_id) DO NOTHING`,
    [EVENT, B, FREE],
  );
  assert.equal(code, null, 'the database now refuses every guest link — not the rule');
  assert.deepEqual(await holdersOf(FREE), [B]);
  assert.deepEqual(await holdersOf(HELD), [A], 'and A still holds theirs');
});
