/**
 * THE BOOKED QR, COMPLETED — its quote lines and the shop's void (Supplier Build 2 row #34,
 * migration 20271327929301_booked_qr_quote_lines_and_void).
 *
 * WHAT IS ASSERTED
 *   1. The quote lines are stored with the code, in the `vendor_proposals.line_items` shape; NULL stays NULL for a
 *      code that never said (not `[]`); a non-array is refused.
 *   2. The shop voids its own WAITING code (`void`, `voided_at` set) — and the answer says why when it cannot:
 *      `already_void`, `claimed` (a scanned code is a booking — never deleted from here), `not_found`.
 *   3. As the signed-in shop (RLS on, not the replay's superuser): another shop's code is `not_found` and stays pending.
 *   4. A status only moves forward: un-voiding and voiding a claimed code are refused for ANY caller; the claim's own
 *      pending → claimed still goes through.
 *   5. NEUTRALISED: drop the guard and the un-void goes through — case 4 measures the trigger, not a fixture.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let vendorUid = '';
let otherUid = '';
let shop = '';
let otherShop = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  vendorUid = await createUser('booked-qr-vendor@audit.test');
  otherUid = await createUser('booked-qr-other@audit.test');
  shop = await createVendor(vendorUid, 'Booked QR Studio');
  otherShop = await createVendor(otherUid, 'Another Booked Studio');
});

after(async () => {
  await db.close();
});

async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function createVendor(userId: string, name: string): Promise<string> {
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified'::public.vendor_verification_state, NOW())
     RETURNING vendor_profile_id`,
    [userId, name],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function code(vpid: string, uid: string, lines: unknown = undefined): Promise<string> {
  const r = await db.query<{ token: string }>(
    `INSERT INTO public.vendor_locked_qr_tokens (
       vendor_profile_id, created_by_user_id, category, service_description, event_date, total_php, initial_paid_php, quote_line_items
     ) VALUES ($1, $2, 'photographer', 'Full-day coverage', '2027-05-08', 80000, 20000, $3::jsonb)
     RETURNING token`,
    [vpid, uid, lines === undefined ? null : JSON.stringify(lines)],
  );
  return r.rows[0]!.token;
}

const statusOf = async (t: string) =>
  (await db.query<{ status: string; voided_at: string | null }>(`SELECT status, voided_at::text FROM public.vendor_locked_qr_tokens WHERE token = $1`, [t])).rows[0]!;

const voidAs = async (t: string) => (await db.query<{ r: string }>(`SELECT public.vendor_void_locked_qr($1) AS r`, [t])).rows[0]!.r;

async function asShop<T>(uid: string, run: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await run();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
  }
}

test('1 · the quote lines are stored with the code, in the one quote-line shape; NULL stays NULL', async () => {
  const lines = [
    { label: 'Full-day coverage', detail: '10 hours · 2 shooters', amount_centavos: 6_500_000 },
    { label: 'Same-day edit', detail: null, amount_centavos: 1_500_000 },
  ];
  const t = await code(shop, vendorUid, lines);
  const r = await db.query<{ q: unknown }>(`SELECT quote_line_items AS q FROM public.vendor_locked_qr_tokens WHERE token = $1`, [t]);
  assert.deepEqual(r.rows[0]!.q, lines, 'the lines did not survive the issue');
  const legacy = await code(shop, vendorUid);
  const l = await db.query<{ q: unknown }>(`SELECT quote_line_items AS q FROM public.vendor_locked_qr_tokens WHERE token = $1`, [legacy]);
  assert.equal(l.rows[0]!.q, null, 'a code that never said now claims "no lines"');
  await assert.rejects(code(shop, vendorUid, { label: 'not a list' }), /quote_lines_is_array/);
});

test('2 · the shop voids its own waiting code — and says why when it cannot', async () => {
  const t = await code(shop, vendorUid);
  assert.equal(await asShop(vendorUid, () => voidAs(t)), 'void');
  const s = await statusOf(t);
  assert.equal(s.status, 'void');
  assert.ok(s.voided_at, 'voided_at was not stamped — the list cannot say when it was deleted');
  assert.equal(await asShop(vendorUid, () => voidAs(t)), 'already_void');
  // A scanned code is a booking: never deleted from here (the claim's own write, as the superuser).
  const scanned = await code(shop, vendorUid);
  await db.query(`UPDATE public.vendor_locked_qr_tokens SET status = 'claimed', claimed_at = NOW() WHERE token = $1`, [scanned]);
  assert.equal(await asShop(vendorUid, () => voidAs(scanned)), 'claimed');
  assert.equal((await statusOf(scanned)).status, 'claimed');
  assert.equal(await asShop(vendorUid, () => voidAs('no-such-token')), 'not_found');
});

test('3 · as the signed-in shop, another shop’s code is not found and stays waiting (RLS decides whose)', async () => {
  const theirs = await code(otherShop, otherUid);
  assert.equal(await asShop(vendorUid, () => voidAs(theirs)), 'not_found');
  assert.equal((await statusOf(theirs)).status, 'pending', 'a shop voided another shop’s code');
  // And the new column rides the existing vendor-org policy: the other shop's lines are not readable.
  const n = await asShop(vendorUid, async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_locked_qr_tokens WHERE vendor_profile_id = $1`, [otherShop])).rows[0]!.n,
  );
  assert.equal(n, 0);
});

test('4 · a status only moves forward — for any caller — and the claim still goes through', async () => {
  const dead = await code(shop, vendorUid);
  await asShop(vendorUid, () => voidAs(dead));
  await assert.rejects(
    asShop(vendorUid, () => db.query(`UPDATE public.vendor_locked_qr_tokens SET status = 'pending' WHERE token = $1`, [dead])),
    /only moves forward/,
    'the shop un-voided a code it was told is dead',
  );
  await assert.rejects(db.query(`UPDATE public.vendor_locked_qr_tokens SET status = 'pending' WHERE token = $1`, [dead]), /only moves forward/);
  const scanned = await code(shop, vendorUid);
  await db.query(`UPDATE public.vendor_locked_qr_tokens SET status = 'claimed' WHERE token = $1 AND status = 'pending'`, [scanned]);
  assert.equal((await statusOf(scanned)).status, 'claimed', 'the claim’s pending → claimed was refused');
  await assert.rejects(
    asShop(vendorUid, () => db.query(`UPDATE public.vendor_locked_qr_tokens SET status = 'void' WHERE token = $1`, [scanned])),
    /only moves forward/,
    'a claimed code — a booking — was voided',
  );
  // Other columns of a waiting code still change (the guard is on status alone).
  const open = await code(shop, vendorUid);
  await db.query(`UPDATE public.vendor_locked_qr_tokens SET service_description = 'Half-day' WHERE token = $1`, [open]);
});

test('5 · neutralised: without the guard the un-void goes through — case 4 measures the trigger', async () => {
  await db.query('BEGIN');
  try {
    await db.query(`DROP TRIGGER vendor_locked_qr_status_forward ON public.vendor_locked_qr_tokens`);
    const t = await code(shop, vendorUid);
    await db.query(`UPDATE public.vendor_locked_qr_tokens SET status = 'void' WHERE token = $1`, [t]);
    await db.query(`UPDATE public.vendor_locked_qr_tokens SET status = 'pending' WHERE token = $1`, [t]);
    assert.equal((await statusOf(t)).status, 'pending');
  } finally {
    await db.query('ROLLBACK');
  }
  const t2 = await code(shop, vendorUid);
  await db.query(`UPDATE public.vendor_locked_qr_tokens SET status = 'void' WHERE token = $1`, [t2]);
  await assert.rejects(db.query(`UPDATE public.vendor_locked_qr_tokens SET status = 'pending' WHERE token = $1`, [t2]), /only moves forward/, 'the guard did not come back after the rollback');
});
