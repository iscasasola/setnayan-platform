/**
 * Guest QR token rotation — rotate_guest_qr_token RPC (build ④ · migration
 * 20270917400000), proven against the FULL replayed prod schema.
 *
 * Covers:
 *   • couple host rotation: new 32-hex token, rotated_at stamped, count
 *     incremented, audit row typed 'couple' with sha256(old token) — never raw;
 *   • authz: a couple on a DIFFERENT event is rejected; an anonymous caller
 *     claiming guest_self without the service_role claim is rejected;
 *   • guest_self via service_role (the cookie-validated server-action path):
 *     accepted, audit actor_kind='guest_self', actor_user_id NULL;
 *   • durable rate limit: the 4th rotation of the same guest inside 24h
 *     returns rate_limited and does NOT change the token;
 *   • not_found on a soft-deleted guest.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = {
  event: '' as string,
  otherEvent: '' as string,
  host: '' as string,
  stranger: '' as string,
  guest: '' as string,
  deletedGuest: '' as string,
};

type RpcRow = {
  ok: boolean;
  reason?: string;
  qr_token?: string;
  actor_kind?: string;
};

async function setRoleClaim(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

async function rotate(guestId: string, actorKind: string | null = null): Promise<RpcRow> {
  const r = await db.query<{ res: RpcRow }>(
    `SELECT public.rotate_guest_qr_token($1, $2) AS res`,
    [guestId, actorKind],
  );
  return r.rows[0]!.res;
}

async function guestRow(guestId: string) {
  const r = await db.query<{
    qr_token: string;
    qr_token_rotated_at: string | null;
    qr_rotation_count: number;
  }>(
    `SELECT qr_token, qr_token_rotated_at, qr_rotation_count
       FROM public.guests WHERE guest_id = $1`,
    [guestId],
  );
  return r.rows[0]!;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const mkUser = async (email: string) => {
    const r = await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
      [email],
    );
    return r.rows[0]!.id;
  };
  F.host = await mkUser('host@qr-rotation.test');
  F.stranger = await mkUser('stranger@qr-rotation.test');

  await setAuthUid(db, null);
  await setRoleClaim(null);

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('QR Rotation Event', 'birthday') RETURNING event_id`,
  );
  F.event = ev.rows[0]!.event_id;
  const other = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Other Event', 'birthday') RETURNING event_id`,
  );
  F.otherEvent = other.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
    [F.event, F.host],
  );
  // The stranger is a REAL couple — just on a different event.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
    [F.otherEvent, F.stranger],
  );

  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Rota', 'Ted', 'both', 'friends') RETURNING guest_id`,
    [F.event],
  );
  F.guest = g.rows[0]!.guest_id;

  const dg = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, deleted_at)
     VALUES ($1, 'Ghost', 'Gone', 'both', 'friends', now()) RETURNING guest_id`,
    [F.event],
  );
  F.deletedGuest = dg.rows[0]!.guest_id;
});

after(async () => {
  await db?.close();
});

test('couple host rotation: new token, stamp, count, sha256-only audit', async () => {
  const beforeRow = await guestRow(F.guest);
  assert.match(beforeRow.qr_token, /^[0-9a-f]{32}$/, 'seeded token is 32-hex');

  await setAuthUid(db, F.host);
  const res = await rotate(F.guest);
  assert.equal(res.ok, true, `host rotation succeeds (got ${JSON.stringify(res)})`);
  assert.equal(res.actor_kind, 'couple', 'actor kind derived server-side as couple');

  const afterRow = await guestRow(F.guest);
  assert.match(afterRow.qr_token, /^[0-9a-f]{32}$/, 'new token keeps the 32-hex contract');
  assert.notEqual(afterRow.qr_token, beforeRow.qr_token, 'token actually changed');
  assert.equal(res.qr_token, afterRow.qr_token, 'RPC returns the new token');
  assert.ok(afterRow.qr_token_rotated_at, 'rotated_at stamped');
  assert.equal(afterRow.qr_rotation_count, 1, 'rotation count incremented');

  await setAuthUid(db, null);
  const audit = await db.query<{
    actor_kind: string;
    actor_user_id: string | null;
    old_token_sha256: string;
    matches: boolean;
  }>(
    `SELECT actor_kind, actor_user_id, old_token_sha256,
            old_token_sha256 = encode(extensions.digest($2::text, 'sha256'), 'hex') AS matches
       FROM public.guest_qr_rotations WHERE guest_id = $1`,
    [F.guest, beforeRow.qr_token],
  );
  assert.equal(audit.rows.length, 1, 'exactly one audit row');
  assert.equal(audit.rows[0]!.actor_kind, 'couple');
  assert.equal(audit.rows[0]!.actor_user_id, F.host);
  assert.equal(audit.rows[0]!.matches, true, 'audit stores sha256 of the OLD token');
  assert.notEqual(
    audit.rows[0]!.old_token_sha256,
    beforeRow.qr_token,
    'raw token never lands in the audit',
  );
});

test('a couple on a different event cannot rotate this guest', async () => {
  const beforeRow = await guestRow(F.guest);
  await setAuthUid(db, F.stranger);
  const res = await rotate(F.guest);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'not_authorized');
  const afterRow = await guestRow(F.guest);
  assert.equal(afterRow.qr_token, beforeRow.qr_token, 'token untouched');
  await setAuthUid(db, null);
});

test('guest_self is rejected without the service_role claim', async () => {
  await setAuthUid(db, null);
  await setRoleClaim(null); // anon shape: no uid, no service_role
  const res = await rotate(F.guest, 'guest_self');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'not_authorized');
});

test('guest_self via service_role succeeds and audits with NULL actor', async () => {
  await setAuthUid(db, null);
  await setRoleClaim('service_role');
  const res = await rotate(F.guest, 'guest_self');
  assert.equal(res.ok, true, `guest_self via service_role (got ${JSON.stringify(res)})`);
  assert.equal(res.actor_kind, 'guest_self');
  await setRoleClaim(null);

  const audit = await db.query<{ actor_user_id: string | null }>(
    `SELECT actor_user_id FROM public.guest_qr_rotations
      WHERE guest_id = $1 AND actor_kind = 'guest_self'`,
    [F.guest],
  );
  assert.equal(audit.rows.length, 1);
  assert.equal(audit.rows[0]!.actor_user_id, null, 'no user behind a guest_self rotation');

  const row = await guestRow(F.guest);
  assert.equal(row.qr_rotation_count, 2);
});

test('durable rate limit: 4th rotation in 24h is rejected, token unchanged', async () => {
  // Rotations so far: couple (1) + guest_self (2). The 3rd passes, the 4th hits
  // the >=3-in-24h ceiling.
  await setAuthUid(db, F.host);
  const third = await rotate(F.guest);
  assert.equal(third.ok, true, '3rd rotation still inside the budget');

  const beforeRow = await guestRow(F.guest);
  const fourth = await rotate(F.guest);
  assert.equal(fourth.ok, false);
  assert.equal(fourth.reason, 'rate_limited');
  const afterRow = await guestRow(F.guest);
  assert.equal(afterRow.qr_token, beforeRow.qr_token, 'rate-limited call changes nothing');
  assert.equal(afterRow.qr_rotation_count, 3, 'count stays at 3');
  await setAuthUid(db, null);
});

test('soft-deleted guest → not_found', async () => {
  await setAuthUid(db, F.host);
  const res = await rotate(F.deletedGuest);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'not_found');
  await setAuthUid(db, null);
});
