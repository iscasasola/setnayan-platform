/**
 * THE SUPPLIER DASHBOARD WORKS OFFLINE AND CATCHES UP (owner 2026-11-24, DECISION_LOG "The supplier dashboard works
 * offline and catches up when back online"). Migration `supplier_offline_engine`. What a unit test cannot see:
 *
 *   1 · VERSIONED ITEMS — every update of a schedule item moves its version on (any writer); an offline edit against an
 *       old version is a typed clash naming who changed it, never a merge; the right version lands.
 *   2 · FIRST SAVE WINS — on a full day the second phone's outside client is a clash naming the first member; a retry
 *       of the first item is answered from the ledger and writes nothing twice.
 *   3 · EXPO MODE — a member's held dates refuse another member's offline write AND their online insert; the holder
 *       writes; released on sync, the others write again.
 *   4 · ONE CODE, ONE ENTRY (no stock — DECISION_LOG 7d618cb3) — client first or supplier first, one code id makes one
 *       schedule row; the same code id twice gives one entry; a code from a STOPPED phone makes nothing; a phone of
 *       another shop cannot sign for this shop; a payload edited after signing is refused by the phone's public key as
 *       the database keeps it; a clash gives the code id back.
 *   5 · DAY STATES are versioned the same way (base 0 = the phone saw none).
 *   6 · RLS — no session reads a phone's key row, writes a hold or a code use, or calls a door; another shop reads none.
 *
 * Sabotage (2026-11-24): dropping `AND h.member_user_id IS DISTINCT FROM p_member_user_id` from
 * supplier_offline_hold_in_the_way turns test 3 red (the holder is refused by their own hold); dropping
 * `ELSIF v_row.version <> v_base THEN` (the stale branch) turns test 1 red (a stale edit lands); dropping
 * `IF v_d.status <> 'active' THEN` from supplier_offline_code_use turns test 4 red (a stopped phone's code made an entry).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { createRequire } from 'node:module';
import { memberTagOf, newPhoneKey, parseOfflineQrToken, signOfflineQr } from '../../lib/supplier-offline/qr';

// `qr.server.ts` starts with `import 'server-only'` (Next's marker); under node:test it is a no-op stand-in.
{
  const Mod = createRequire(import.meta.url)('node:module') as { _load: (r: string, ...a: unknown[]) => unknown };
  const load = Mod._load;
  Mod._load = function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === 'server-only') return {};
    return load.call(this, request, ...rest);
  };
}
const serverQr = () => import('../../lib/supplier-offline/qr.server');

let replay: ReplayResult;
let db: PGlite;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<{ v: T }>(sql, params);
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error(`no row: ${sql}`);
  return (row.v ?? Object.values(row)[0]) as T;
}

async function newUser(email: string, accountType: 'customer' | 'vendor'): Promise<string> {
  return one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id AS v`,
    [email, accountType],
  );
}

async function shopOf(userId: string, name: string): Promise<string> {
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  if (existing.rows[0]) return existing.rows[0].vendor_profile_id;
  return one<string>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[]) RETURNING vendor_profile_id AS v`,
    [userId, name],
  );
}

async function poolOf(shop: string, capacity = 1): Promise<string> {
  return one<string>(
    `INSERT INTO public.vendor_schedule_pools (vendor_profile_id, pool_label, daily_booking_capacity)
     VALUES ($1, 'Photo', $2) RETURNING pool_id AS v`,
    [shop, capacity],
  );
}

type Answer = Record<string, unknown> & { status: string };

async function write(p: Record<string, unknown>): Promise<Answer> {
  return one<Answer>(`SELECT public.supplier_offline_schedule_write($1::jsonb) AS v`, [JSON.stringify(p)]);
}
async function hold(p: Record<string, unknown>): Promise<Answer> {
  return one<Answer>(`SELECT public.supplier_offline_hold($1::jsonb) AS v`, [JSON.stringify(p)]);
}
async function useCode(p: Record<string, unknown>): Promise<Answer> {
  return one<Answer>(`SELECT public.supplier_offline_code_use($1::jsonb) AS v`, [JSON.stringify(p)]);
}

/** A PH date `days` from today (the holds refuse a range already past). */
async function day(days: number): Promise<string> {
  return one<string>(`SELECT ((NOW() AT TIME ZONE 'Asia/Manila')::date + $1::int)::text AS v`, [days]);
}

const uuid = () => crypto.randomUUID();

let owner: string;
let ana: string;
let ben: string;
let stranger: string;
let shop: string;
let otherShop: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
  owner = await newUser('offline-owner@example.com', 'vendor');
  ana = await newUser('offline-ana@example.com', 'vendor');
  ben = await newUser('offline-ben@example.com', 'vendor');
  stranger = await newUser('offline-stranger@example.com', 'vendor');
  shop = await shopOf(owner, 'Offline Studio');
  otherShop = await shopOf(stranger, 'Elsewhere');
});

after(async () => {
  await replay?.db.close();
});

test('1 · a schedule item is versioned: a stale offline edit is a clash naming who changed it', async () => {
  const pool = await poolOf(shop, 3);
  const d = await day(20);
  const made = await write({ op: 'add_client', vendor_profile_id: shop, member_user_id: ana, item_id: uuid(), pool_id: pool, start_date: d, client_name: 'Liza' });
  assert.equal(made.status, 'applied');
  assert.equal(made.version, 1);
  const block = String(made.block_id);

  // Ben changes it online (any writer): the version moves on and he is named.
  await setAuthUid(db, ben);
  await db.query(`UPDATE public.vendor_calendar_blocks SET client_note = 'deposit next week' WHERE block_id = $1`, [block]);
  await setAuthUid(db, null);
  assert.equal(await one<number>(`SELECT version AS v FROM public.vendor_calendar_blocks WHERE block_id = $1`, [block]), 2);

  const stale = await write({ op: 'edit', vendor_profile_id: shop, member_user_id: ana, item_id: uuid(), block_id: block, base_version: 1, client_name: 'Liza M.' });
  assert.equal(stale.status, 'clash', 'a stale edit landed');
  assert.equal(stale.why, 'changed');
  assert.equal(stale.by, ben, 'the clash does not name who changed it');
  assert.ok(stale.at, 'the clash says no time');
  assert.equal(await one<string>(`SELECT client_name AS v FROM public.vendor_calendar_blocks WHERE block_id = $1`, [block]), 'Liza', 'the stale edit was merged');

  const fresh = await write({ op: 'edit', vendor_profile_id: shop, member_user_id: ana, item_id: uuid(), block_id: block, base_version: 2, client_name: 'Liza M.' });
  assert.equal(fresh.status, 'applied');
  assert.equal(fresh.version, 3);

  const staleRemove = await write({ op: 'remove', vendor_profile_id: shop, member_user_id: ben, item_id: uuid(), block_id: block, base_version: 2 });
  assert.equal(staleRemove.status, 'clash', 'a stale remove deleted a teammate’s newer change');
  const remove = await write({ op: 'remove', vendor_profile_id: shop, member_user_id: ben, item_id: uuid(), block_id: block, base_version: 3 });
  assert.equal(remove.status, 'applied');
  const gone = await write({ op: 'edit', vendor_profile_id: shop, member_user_id: ana, item_id: uuid(), block_id: block, base_version: 3, client_name: 'x' });
  assert.equal(gone.why, 'removed', 'an edit of a removed item is not said as removed');
});

test('2 · first save wins on a full day, and a retry writes nothing twice', async () => {
  const pool = await poolOf(shop, 1);
  const d = await day(30);
  const first = uuid();
  const a = await write({ op: 'add_client', vendor_profile_id: shop, member_user_id: ana, item_id: first, pool_id: pool, start_date: d, client_name: 'Ana’s client', phone_time: '2026-11-24T02:00:00Z' });
  assert.equal(a.status, 'applied');
  const b = await write({ op: 'add_client', vendor_profile_id: shop, member_user_id: ben, item_id: uuid(), pool_id: pool, start_date: d, client_name: 'Ben’s client' });
  assert.equal(b.status, 'clash', 'two phones took the one seat of a day');
  assert.equal(b.why, 'booked');
  assert.equal(b.by, ana, 'the clash does not name who booked first');

  const again = await write({ op: 'add_client', vendor_profile_id: shop, member_user_id: ana, item_id: first, pool_id: pool, start_date: d, client_name: 'Ana’s client' });
  assert.equal(again.status, 'applied');
  assert.equal(again.repeat, true, 'a retry was applied again instead of answered');
  assert.equal(
    Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.vendor_calendar_blocks WHERE pool_id = $1`, [pool])),
    1,
    'a retried item wrote a second row',
  );
  const marked = await db.query<{ made_offline: boolean; created_by: string; phone_time: string | null }>(
    `SELECT made_offline, created_by, phone_time FROM public.vendor_calendar_blocks WHERE offline_item_id = $1`,
    [first],
  );
  assert.equal(marked.rows[0]?.made_offline, true, 'the made-offline mark is not kept on the row');
  assert.equal(marked.rows[0]?.created_by, ana, 'the member is not kept on the row');
  assert.ok(marked.rows[0]?.phone_time, 'the phone’s time is not kept on the row');
  assert.equal(
    Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.vendor_offline_writes WHERE item_id = $1 AND outcome IS NOT NULL`, [first])),
    1,
  );
});

test('3 · expo mode: held dates refuse the others, offline and online; released on sync', async () => {
  const pool = await poolOf(shop, 5);
  const d1 = await day(40);
  const d3 = await day(42);
  const claim = await hold({ op: 'claim', vendor_profile_id: shop, member_user_id: ana, pool_id: pool, start_date: d1, end_date: d3 });
  assert.equal(claim.status, 'applied');
  const clash = await hold({ op: 'claim', vendor_profile_id: shop, member_user_id: ben, pool_id: null, start_date: d3, end_date: d3 });
  assert.equal(clash.status, 'clash', 'two members held the same dates');

  const d2 = await day(41);
  const benOffline = await write({ op: 'add_client', vendor_profile_id: shop, member_user_id: ben, item_id: uuid(), pool_id: pool, start_date: d2, client_name: 'x' });
  assert.equal(benOffline.status, 'clash', 'another member wrote into held dates');
  assert.equal(benOffline.why, 'held');
  assert.equal(benOffline.by, ana);

  await setAuthUid(db, ben);
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_calendar_blocks (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label, block_source)
       VALUES ($1, $2, ($3::text || ' 00:00:00+08')::timestamptz, ($3::text || ' 23:30:00+08')::timestamptz, 'x', 'manual')`,
      [shop, pool, d2],
    ),
    /date_held/,
    'an online member wrote into another member’s held dates',
  );
  await setAuthUid(db, null);

  const anaOwn = await write({ op: 'add_client', vendor_profile_id: shop, member_user_id: ana, item_id: uuid(), pool_id: pool, start_date: d2, client_name: 'Ana’s' });
  assert.equal(anaOwn.status, 'applied', 'the holder was refused by their own hold');

  const released = await hold({ op: 'synced', vendor_profile_id: shop, member_user_id: ana });
  assert.equal(released.released, 1);
  const benAfter = await write({ op: 'add_client', vendor_profile_id: shop, member_user_id: ben, item_id: uuid(), pool_id: pool, start_date: d2, client_name: 'Ben’s' });
  assert.equal(benAfter.status, 'applied', 'a released hold still refuses');

  const h = await hold({ op: 'claim', vendor_profile_id: shop, member_user_id: ben, pool_id: pool, start_date: d3, end_date: d3 });
  const notYours = await hold({ op: 'release', vendor_profile_id: shop, member_user_id: ana, hold_id: h.hold_id });
  assert.equal(notYours.status, 'refused', 'a member released another member’s hold without the right');
  const manager = await hold({ op: 'release', vendor_profile_id: shop, member_user_id: owner, hold_id: h.hold_id, may_release_any: true });
  assert.equal(manager.status, 'applied');
});

/** A phone of `member` on `onShop`, with a real P-256 key: its public half in the database, its private half here. */
async function phone(member: string, onShop: string): Promise<{ deviceId: string; privateKey: CryptoKey }> {
  const k = await newPhoneKey();
  await db.query(
    `INSERT INTO public.vendor_offline_devices (device_id, vendor_profile_id, member_user_id, public_key) VALUES ($1, $2, $3, $4::jsonb)`,
    [k.deviceId, onShop, member, JSON.stringify(k.publicJwk)],
  );
  return { deviceId: k.deviceId, privateKey: k.privateKey };
}

test('4 · one code, one entry — whoever arrives first; a stopped phone, an edited code and another shop’s phone are refused', async () => {
  const pool = await poolOf(shop, 3);
  const d = await day(50);
  const couple = await newUser('offline-couple@example.com', 'customer');
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_date, created_by) VALUES ('Liza & Paolo', $1, $2) RETURNING event_id AS v`,
    [d, couple],
  ).catch(() => null);
  const anaPhone = await phone(ana, shop);

  // the client's phone first, then the supplier's own sync of the same code
  const c1 = uuid();
  const byClient = await useCode({ code_id: c1, device_id: anaPhone.deviceId, via: 'client', booked_date: d, pool_id: pool, event_id: eventId, label: 'Liza & Paolo', phone_time: '2026-11-24T03:10:00Z', amount_php: 15000 });
  assert.equal(byClient.status, 'applied');
  const item = uuid();
  const bySupplier = await useCode({ code_id: c1, device_id: anaPhone.deviceId, via: 'supplier', booked_date: d, pool_id: pool, item_id: item, client_name: 'Liza Santos', client_contact: '0917 555 1234' });
  assert.equal(bySupplier.status, 'applied');
  assert.equal(bySupplier.deduped, true, 'the supplier’s later sync of the same code was not matched');
  const again = await useCode({ code_id: c1, device_id: anaPhone.deviceId, via: 'client', booked_date: d, pool_id: pool, event_id: eventId });
  assert.equal(again.status, 'applied');
  assert.equal(again.deduped, true);
  assert.equal(
    Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.vendor_calendar_blocks WHERE offline_code_id = $1`, [c1])),
    1,
    'the same code id made two entries',
  );
  assert.equal(Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.vendor_offline_code_uses WHERE code_id = $1`, [c1])), 1);
  assert.equal(
    await one<string>(`SELECT client_name AS v FROM public.vendor_calendar_blocks WHERE offline_code_id = $1`, [c1]),
    'Liza Santos',
    'the supplier’s copy did not fill in the client’s name',
  );
  const mark = await db.query<{ made_offline: boolean; created_by: string }>(`SELECT made_offline, created_by FROM public.vendor_calendar_blocks WHERE offline_code_id = $1`, [c1]);
  assert.equal(mark.rows[0]?.made_offline, true, 'the made-offline mark is not kept');
  assert.equal(mark.rows[0]?.created_by, ana, 'the member is not kept');

  // the supplier's phone first, the client later
  const benPhone = await phone(ben, shop);
  const c2 = uuid();
  assert.equal((await useCode({ code_id: c2, device_id: benPhone.deviceId, via: 'supplier', booked_date: d, pool_id: pool, item_id: uuid(), client_name: 'Mara' })).status, 'applied');
  const later = await useCode({ code_id: c2, device_id: benPhone.deviceId, via: 'client', booked_date: d, pool_id: pool, event_id: eventId });
  assert.equal(later.deduped, true);
  assert.equal(Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.vendor_calendar_blocks WHERE offline_code_id = $1`, [c2])), 1);
  assert.equal((await useCode({ code_id: c2, device_id: benPhone.deviceId, via: 'client', booked_date: await day(51), pool_id: pool })).status, 'invalid', 'a used code answered for another date');

  // a lost phone, stopped: its unscanned codes are refused
  const lost = await phone(ana, shop);
  await db.query(`UPDATE public.vendor_offline_devices SET status = 'stopped', stopped_at = NOW(), stopped_by = $2, stop_reason = 'lost' WHERE device_id = $1`, [lost.deviceId, owner]);
  const dead = await useCode({ code_id: uuid(), device_id: lost.deviceId, via: 'client', booked_date: d, pool_id: pool, event_id: eventId });
  assert.equal(dead.status, 'stopped', 'a stopped phone’s code made an entry');

  // a phone of ANOTHER shop cannot sign for this shop: its entry could only ever be its own shop's — this shop's
  // schedule is refused and nothing lands here
  const theirs = await phone(stranger, otherShop);
  const before = Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.vendor_calendar_blocks WHERE vendor_profile_id = $1`, [shop]));
  const foreign = await useCode({ code_id: uuid(), device_id: theirs.deviceId, via: 'client', booked_date: d, pool_id: pool, event_id: eventId });
  assert.notEqual(foreign.status, 'applied', 'another shop’s phone wrote onto this shop’s schedule');
  assert.equal(Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.vendor_calendar_blocks WHERE vendor_profile_id = $1`, [shop])), before);

  // a payload edited after signing is refused — checked against the public key exactly as the database keeps it
  const { verifyOfflineQrSignature } = await serverQr();
  const fields = { codeId: uuid(), deviceId: anaPhone.deviceId, shop, member: await memberTagOf(ana), date: d, time: '14:00', poolId: pool, amountPhp: 15000, madeOffline: true as const, phoneTime: '2026-11-24T06:00:00.000Z' };
  const token = (await signOfflineQr(fields, anaPhone.privateKey))!;
  const kept = await one<unknown>(`SELECT public_key AS v FROM public.vendor_offline_devices WHERE device_id = $1`, [anaPhone.deviceId]);
  assert.equal(verifyOfflineQrSignature(parseOfflineQrToken(token)!, kept), true, 'a genuine code fails against the kept key');
  const edited = token.replace(`.${d.replace(/-/g, '')}.`, `.${(await day(52)).replace(/-/g, '')}.`).replace('.15000.', '.1.');
  assert.ok(parseOfflineQrToken(edited), 'the edited code no longer parses — the test is not testing the signature');
  assert.equal(verifyOfflineQrSignature(parseOfflineQrToken(edited)!, kept), false, 'a code edited after signing was accepted');
  const benKey = await one<unknown>(`SELECT public_key AS v FROM public.vendor_offline_devices WHERE device_id = $1`, [benPhone.deviceId]);
  assert.equal(verifyOfflineQrSignature(parseOfflineQrToken(token)!, benKey), false, 'another phone’s key verified the code');

  // a clash gives the code id back
  const fullPool = await poolOf(shop, 1);
  await write({ op: 'add_client', vendor_profile_id: shop, member_user_id: ben, item_id: uuid(), pool_id: fullPool, start_date: d, client_name: 'taken' });
  const c4 = uuid();
  const clash = await useCode({ code_id: c4, device_id: anaPhone.deviceId, via: 'client', booked_date: d, pool_id: fullPool, event_id: eventId });
  assert.equal(clash.status, 'clash');
  assert.equal(clash.why, 'booked');
  assert.equal(Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.vendor_offline_code_uses WHERE code_id = $1`, [c4])), 0, 'a clashed code was spent');
});

test('5 · a day state is versioned the same way', async () => {
  const pool = await poolOf(shop, 1);
  const d = await day(60);
  const a = await write({ op: 'day_state', vendor_profile_id: shop, member_user_id: ana, item_id: uuid(), pool_id: pool, state_date: d, day_state: 'locked', base_version: 0 });
  assert.equal(a.status, 'applied');
  const b = await write({ op: 'day_state', vendor_profile_id: shop, member_user_id: ben, item_id: uuid(), pool_id: pool, state_date: d, day_state: 'whitelist', base_version: 0 });
  assert.equal(b.status, 'clash', 'a second phone overwrote a day state it never saw');
  assert.equal(b.by, ana);
  const closed = await write({ op: 'add_client', vendor_profile_id: shop, member_user_id: ben, item_id: uuid(), pool_id: pool, start_date: d, client_name: 'x' });
  assert.equal(closed.why, 'closed', 'an outside client landed on a locked day');
});

test('6 · RLS: no session reads a phone’s key row, writes a hold or a code use, or calls a door; another shop reads nothing', async () => {
  const p = await phone(ana, shop);
  await useCode({ code_id: uuid(), device_id: p.deviceId, via: 'supplier', booked_date: await day(71), pool_id: await poolOf(shop, 2), item_id: uuid(), client_name: 'x' });
  await hold({ op: 'claim', vendor_profile_id: shop, member_user_id: ana, pool_id: null, start_date: await day(70), end_date: await day(70) });
  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, owner);
    await assert.rejects(db.query(`SELECT public_key FROM public.vendor_offline_devices WHERE device_id = $1`, [p.deviceId]), /permission denied/, 'a session read a phone’s key row');
    assert.ok(Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.vendor_offline_holds WHERE vendor_profile_id = $1`, [shop])) >= 1, 'the shop cannot read its own holds');
    assert.ok(Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.vendor_offline_code_uses WHERE vendor_profile_id = $1`, [shop])) >= 1, 'the shop cannot read its own code uses');
    await assert.rejects(
      db.query(`INSERT INTO public.vendor_offline_holds (vendor_profile_id, member_user_id, start_date, end_date) VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE)`, [shop, owner]),
      /permission denied/,
      'a session wrote a hold past the server',
    );
    await assert.rejects(
      db.query(`INSERT INTO public.vendor_offline_code_uses (code_id, device_id, vendor_profile_id, member_user_id, used_via, booked_date) VALUES ($1, $2, $3, $4, 'client', CURRENT_DATE)`, [uuid(), p.deviceId, shop, owner]),
      /permission denied/,
      'a session spent a code past the server',
    );
    for (const fn of ['supplier_offline_schedule_write', 'supplier_offline_hold', 'supplier_offline_code_use']) {
      await assert.rejects(db.query(`SELECT public.${fn}('{}'::jsonb)`), /permission denied/, `a session called ${fn}`);
    }
    await setAuthUid(db, stranger);
    for (const t of ['vendor_offline_holds', 'vendor_offline_code_uses', 'vendor_offline_writes']) {
      assert.equal(Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.${t} WHERE vendor_profile_id = $1`, [shop])), 0, `another shop reads ${t}`);
    }
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }

});
