/**
 * THE BRIEF NAMES THE HOSTS (test:db) — THE ONE BUILD, lane C2 (owner 8 Nov 2026; spec
 * plans/supplier_one_build_2026-11-08 §5.1 + §9 #1, B1 §5 guard 4).
 *
 * `public.event_chat_hosts(event)` is the ONE answer to "who are the hosts" — for the supplier brief's `hosts`
 * key (picked client → Details → Hosts, Today's "N hosts in chat") and for the supplier thread page's head and
 * avatar strip.
 *
 * 🔑 THE TRAP THIS FILE EXISTS FOR: `public.users.id` is a BIGSERIAL. `event_members.user_id` is the auth UUID.
 * A join written `u.id = em.user_id` does not even type-check in Postgres, and one written to emit `u.id` hands
 * the app a row number where every reader expects the host's auth uid — the uid a chat message's
 * `sender_user_id` carries, which is how a bubble finds its sender's first name. So the returned `user_id` is
 * asserted EQUAL to the couple's auth uid, not merely present.
 *
 * Also pinned:
 *   · hosts is present at inquiry, requested and booked (first names only; never fee-gated);
 *   · only member_type = 'couple' is a host — a coordinator (a limited helper) is not;
 *   · a member with hidden_at set is still a host (spec §4: hiding is a list preference);
 *   · first_name falls back to the first word of display_name;
 *   · event_chat_hosts is NOT executable by `authenticated` or `anon` (service_role only).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

type Row = Record<string, unknown>;

async function newUser(email: string, type = 'customer'): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type',$2::text)) RETURNING id`,
    [email, type],
  );
  return u.rows[0]!.id;
}

async function nameUser(uid: string, displayName: string | null, firstName: string | null): Promise<void> {
  const r = await db.query(
    `UPDATE public.users SET display_name = COALESCE($2, display_name), first_name = $3 WHERE user_id = $1`,
    [uid, displayName, firstName],
  );
  assert.equal(r.affectedRows, 1, `public.users has no row for ${uid} — the auth trigger did not create it`);
}

async function newVendor(email: string): Promise<{ vpid: string; uid: string }> {
  const uid = await newUser(email, 'vendor');
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, 'Hosts Co', 'Manila', ARRAY['photography']::text[], 'verified', NOW(), 'verified')
     ON CONFLICT (user_id) DO UPDATE
       SET business_name = EXCLUDED.business_name,
           verification_state = EXCLUDED.verification_state,
           last_verified_at = EXCLUDED.last_verified_at
     RETURNING vendor_profile_id`,
    [uid],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, uid };
}

async function newEvent(label: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`Hosts ${label}`],
  );
  return e.rows[0]!.event_id;
}

async function member(eventId: string, uid: string, type: 'couple' | 'coordinator', hidden = false): Promise<void> {
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, hidden_at)
     VALUES ($1, $2, $3::public.member_type, CASE WHEN $4 THEN now() ELSE NULL END)`,
    [eventId, uid, type, hidden],
  );
}

async function booking(eventId: string, vpid: string, status: string, pending = false): Promise<void> {
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, lock_request_state, lock_requested_at)
     VALUES ($1, 'photographer', 'Hosts Co', $2::public.vendor_status, $3, $4, $5)`,
    [eventId, status, vpid, pending ? 'pending' : null, pending ? new Date().toISOString() : null],
  );
}

async function brief(eventId: string, asUid: string): Promise<Row> {
  await setAuthUid(db, asUid);
  const r = await db.query<{ b: Row }>(`SELECT public.get_vendor_event_brief($1) AS b`, [eventId]);
  await setAuthUid(db, null);
  return r.rows[0]!.b;
}

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

test('event_chat_hosts lists the couple members, keyed by their AUTH uid, never the users BIGSERIAL', async () => {
  const eventId = await newEvent('uid');
  const bride = await newUser('bride@hosts.test');
  const groom = await newUser('groom@hosts.test');
  const helper = await newUser('helper@hosts.test');
  await nameUser(bride, 'Maria Clara Santos', 'Maria');
  await nameUser(groom, 'Jose Rizal', null); // no first_name → first word of display_name
  await nameUser(helper, 'Tita Helper', 'Tita');
  await member(eventId, bride, 'couple');
  await member(eventId, groom, 'couple', true); // hidden_at set: still a host
  await member(eventId, helper, 'coordinator'); // a limited helper: not a host

  const r = await db.query<{ h: Row[] }>(`SELECT public.event_chat_hosts($1) AS h`, [eventId]);
  const hosts = r.rows[0]!.h;

  assert.equal(hosts.length, 2, 'exactly the two couple members — the coordinator is not a host');
  const ids = hosts.map((h) => h.user_id).sort();
  assert.deepEqual(ids, [bride, groom].sort(), 'user_id must EQUAL the couple’s auth uid (u.user_id), not users.id');

  // Anti-vacuity: the BIGSERIAL really is a different value, so the equality above could have failed.
  const big = await db.query<{ id: string }>(`SELECT id::text AS id FROM public.users WHERE user_id = $1`, [bride]);
  assert.notEqual(String(big.rows[0]!.id), bride, 'users.id and users.user_id must differ for this test to mean anything');

  const byId = Object.fromEntries(hosts.map((h) => [h.user_id as string, h]));
  assert.equal(byId[bride]!.first_name, 'Maria');
  assert.equal(byId[groom]!.first_name, 'Jose', 'first_name falls back to the first word of display_name');
  assert.equal(byId[groom]!.name, 'Jose Rizal');
});

test('hosts rides the brief at inquiry, requested and booked — the same list on every rung', async () => {
  const { vpid, uid: vendorUid } = await newVendor('vendor@hosts.test');
  const host = await newUser('rungs-host@hosts.test');
  await nameUser(host, 'Ana Reyes', 'Ana');

  const rungs: Array<[string, () => Promise<void>, string]> = [];
  const inquiry = await newEvent('inquiry');
  await member(inquiry, host, 'couple');
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'pending')`,
    [inquiry, vpid, host],
  );
  rungs.push([inquiry, async () => {}, 'inquiry']);

  const requested = await newEvent('requested');
  await member(requested, host, 'couple');
  rungs.push([requested, () => booking(requested, vpid, 'considering', true), 'requested']);

  const booked = await newEvent('booked');
  await member(booked, host, 'couple');
  rungs.push([booked, () => booking(booked, vpid, 'contracted'), 'booked']);

  for (const [eventId, seed, stage] of rungs) {
    await seed();
    const b = await brief(eventId, vendorUid);
    assert.equal(b.stage, stage, `seeded rung ${stage} came back as ${String(b.stage)}`);
    const hosts = b.hosts as Row[];
    assert.ok(Array.isArray(hosts), `hosts missing at ${stage}`);
    assert.equal(hosts.length, 1, `hosts at ${stage}`);
    assert.equal(hosts[0]!.user_id, host, `hosts[0].user_id at ${stage} must be the host's auth uid`);
    assert.equal(hosts[0]!.first_name, 'Ana');
  }
});

test('event_chat_hosts is service_role only — no signed-in caller and no anon may run it directly', async () => {
  const r = await db.query<{ role: string; ok: boolean }>(
    `SELECT r AS role, has_function_privilege(r, 'public.event_chat_hosts(uuid)', 'EXECUTE') AS ok
       FROM unnest(ARRAY['anon','authenticated','service_role']) AS r`,
  );
  const ok = Object.fromEntries(r.rows.map((x) => [x.role, x.ok]));
  assert.equal(ok.anon, false, 'anon must not execute event_chat_hosts');
  assert.equal(ok.authenticated, false, 'authenticated must not execute event_chat_hosts');
  assert.equal(ok.service_role, true, 'service_role (the thread page’s admin read) must execute it');
});
