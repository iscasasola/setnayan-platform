/**
 * 🚩 A REPORT NAMES ONLY YOUR SHOP — the supplier Report's origin, walked in SQL under RLS.
 *
 * Covers 20271325290605_a_supplier_report_says_where_it_came_from (owner 2026-11-08 "REPORT = SUBJECT · NOTE ·
 * ORIGIN"). A Report is a `help_messages` row (the shipped /admin/help inbox) that also says where it came from.
 * The public Help form's anyone-insert policy is load-bearing and untouched, so the origin is guarded by a trigger:
 *
 *   • a NULL-origin insert — every shipped /help submission, anon included — still lands;
 *   • an origin naming ANOTHER shop is refused;
 *   • an origin naming an event the shop does not talk to is refused;
 *   • the reporter is whoever is signed in — a typed user_id is overwritten;
 *   • the service role (server-side writers) passes.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function asRole(role: 'anon' | 'authenticated', uid: string | null): Promise<void> {
  await asOwner();
  await setAuthUid(db, uid);
  await setAuthRole(role);
  await db.exec(`SET ROLE ${role}`);
}
async function signUp(email: string, accountType: 'vendor' | 'customer'): Promise<string> {
  await asOwner();
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}
async function shopOf(uid: string): Promise<string> {
  await asOwner();
  const r = await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [uid]);
  return r.rows[0]!.v;
}

const INSERT = `INSERT INTO public.help_messages
  (user_id, sender_email, subject, body, topic, origin_vendor_profile_id, origin_event_id, origin_page)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;

async function report(
  role: 'anon' | 'authenticated',
  uid: string | null,
  vals: { userId?: string | null; shop?: string | null; event?: string | null; page?: string | null },
): Promise<string> {
  await asRole(role, uid);
  const out = await db
    .query(INSERT, [
      vals.userId ?? null,
      'someone@reports-e2e.test',
      'Subject',
      'A note',
      vals.shop ? 'supplier_report' : null,
      vals.shop ?? null,
      vals.event ?? null,
      vals.page ?? null,
    ])
    .then(
      () => 'ok',
      (e: Error) => `refused: ${e.message}`,
    );
  await asOwner();
  return out;
}

const F = { vendor: '', shop: '', rival: '', rivalShop: '', eventId: '', strangerEventId: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  F.vendor = await signUp('vendor@reports-e2e.test', 'vendor');
  F.rival = await signUp('rival@reports-e2e.test', 'vendor');
  F.shop = await shopOf(F.vendor);
  F.rivalShop = await shopOf(F.rival);
  await asOwner();
  const mk = async (n: string) =>
    (
      await db.query<{ e: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date)
         VALUES ($1, 'wedding', 'catholic', 'banquet_hall', DATE '2027-04-10') RETURNING event_id AS e`,
        [n],
      )
    ).rows[0]!.e;
  F.eventId = await mk('Eli & Fe');
  F.strangerEventId = await mk('Gio & Hana');
  await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1, $2, $3)`, [
    F.eventId,
    F.shop,
    F.vendor,
  ]);
});
after(async () => {
  await db?.close();
});

test('the public Help form (no origin) still posts — anon and signed in', async () => {
  assert.equal(await report('anon', null, {}), 'ok');
  assert.equal(await report('authenticated', F.vendor, { userId: F.vendor }), 'ok');
});

test('a report from your own shop, on an event you talk to, lands — and names you as the reporter', async () => {
  assert.equal(
    await report('authenticated', F.vendor, { userId: F.rival, shop: F.shop, event: F.eventId, page: 'clients.report' }),
    'ok',
  );
  const r = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.help_messages WHERE origin_vendor_profile_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [F.shop],
  );
  assert.equal(r.rows[0]!.user_id, F.vendor, 'a typed user_id survived — the reporter must be who is signed in');
});

test('another shop, or an event you do not work with, is refused', async () => {
  assert.match(await report('authenticated', F.rival, { shop: F.shop, page: 'clients.report' }), /your own/);
  assert.match(
    await report('authenticated', F.vendor, { shop: F.shop, event: F.strangerEventId, page: 'clients.report' }),
    /event you work with/,
  );
  assert.match(await report('anon', null, { shop: F.shop, page: 'clients.report' }), /^refused/);
  // An origin with no shop at all is not a report.
  assert.match(await report('authenticated', F.vendor, { event: F.eventId, page: 'clients.report' }), /^refused/);
  // The page is a slug, never prose.
  assert.match(await report('authenticated', F.vendor, { shop: F.shop, page: 'Clients › Report' }), /^refused/);
});

test('the service role passes (server-side writers)', async () => {
  await asOwner();
  await setAuthRole('service_role');
  const out = await db
    .query(INSERT, [null, 'x@reports-e2e.test', 'S', 'N', 'supplier_report', F.rivalShop, F.strangerEventId, 'clients.report'])
    .then(
      () => 'ok',
      (e: Error) => `refused: ${e.message}`,
    );
  await asOwner();
  assert.equal(out, 'ok');
});
