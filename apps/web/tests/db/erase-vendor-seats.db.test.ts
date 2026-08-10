/**
 * Erasure can finally remove the last admin of a shop — and only erasure can.
 *
 * ── WHAT WAS ACTUALLY BROKEN ────────────────────────────────────────────────
 * Erasure enumerates a delete of the person's seat in their own shop, described
 * in our own coverage list as *"a credential that must not outlive the
 * account."* That delete cascades into `vendor_team_guard()`, which refuses to
 * remove the last admin — and every shop in production has exactly one: whoever
 * opened it.
 *
 * The refusal arrives as a RETURNED ERROR, not an exception, so `purge.ts`'s
 * `step()` wrote an audit line and carried on. Erasure then completed and
 * recorded `user_erased`. **We told the person, and our own audit trail, that
 * they had been erased while their account was still an admin of a live shop.**
 *
 * Owner ruling 2026-08-10: *"Yes, allow wipe."*
 *
 * ── WHY THESE ARE DATABASE TESTS AND NOT UNIT TESTS ─────────────────────────
 * Every part of this defect lived in the database: a trigger raising, a
 * PostgREST client resolving that into `{ error }` instead of throwing, and a
 * caller treating a returned error as a non-event. No amount of reading the
 * TypeScript would have shown it, and no unit test could have caught it —
 * exactly like the RPC-argument and phantom-column defects before it. So the
 * assertions below RUN the SQL.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db.close();
});

let n = 0;
async function shopWithOneAdmin(): Promise<{ shop: string; user: string }> {
  n += 1;
  const user = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  // The seat FKs to public.users, which FKs to auth.users. A seat with no
  // person behind it is not a state the product can produce, so the fixture
  // must not invent one — a test that seeds an impossible row proves something
  // about a database we do not have.
  await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
    user,
    `shop${n}@test.invalid`,
  ]);
  await db.query(
    `INSERT INTO public.users (user_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [user, `shop${n}@test.invalid`],
  );
  const s = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (business_name, business_slug)
     VALUES ($1, $2) RETURNING vendor_profile_id`,
    [`Shop ${n}`, `shop${n}`],
  );
  const shop = s.rows[0]!.vendor_profile_id;
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1, $2, 'admin')`,
    [shop, user],
  );
  return { shop, user };
}

async function seatCount(shop: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_team_members WHERE vendor_profile_id = $1`,
    [shop],
  );
  return r.rows[0]!.n;
}

test('META: the guard is installed — otherwise every result below is meaningless', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_trigger
      WHERE tgname = 'vendor_team_guard_trg' AND NOT tgisinternal`,
  );
  assert.equal(r.rows[0]!.n, 1, 'the last-admin guard is missing');
});

test('the rule still holds for everyone else: a plain delete of the last admin is refused', async () => {
  const { shop, user } = await shopWithOneAdmin();
  await assert.rejects(
    () => db.query(`DELETE FROM public.vendor_team_members WHERE user_id = $1`, [user]),
    /VENDOR_LAST_ADMIN/,
    'the guard stopped refusing ordinary last-admin removals',
  );
  assert.equal(await seatCount(shop), 1, 'the seat was removed anyway');
});

test('erasure removes it', async () => {
  const { shop, user } = await shopWithOneAdmin();
  const r = await db.query<{ erase_vendor_seats: number }>(
    `SELECT public.erase_vendor_seats($1) AS erase_vendor_seats`,
    [user],
  );
  assert.equal(r.rows[0]!.erase_vendor_seats, 1, 'the function reported removing nothing');
  assert.equal(await seatCount(shop), 0, 'the seat survived erasure — the original defect');
});

test('the exemption does not leak past the transaction that used it', async () => {
  // 🔑 THE DANGEROUS FAILURE MODE. A session-level flag would outlive the
  // erasure and leave the last-admin rule disabled for whatever ran next on the
  // same pooled connection — turning a narrow exemption into a silent hole.
  const a = await shopWithOneAdmin();
  await db.query(`SELECT public.erase_vendor_seats($1)`, [a.user]);
  assert.equal(await seatCount(a.shop), 0);

  // Immediately after, on the same connection, the ordinary rule must be back.
  const b = await shopWithOneAdmin();
  await assert.rejects(
    () => db.query(`DELETE FROM public.vendor_team_members WHERE user_id = $1`, [b.user]),
    /VENDOR_LAST_ADMIN/,
    'the erasure exemption is still in force after erasure finished',
  );
  assert.equal(await seatCount(b.shop), 1);
});

test('a shop with two admins is unaffected — erasure takes one seat, not the shop', async () => {
  const { shop, user } = await shopWithOneAdmin();
  const other = '00000000-0000-4000-8000-0000000000ff';
  await db.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
    other,
    'coadmin@test.invalid',
  ]);
  await db.query(
    `INSERT INTO public.users (user_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [other, 'coadmin@test.invalid'],
  );
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1, $2, 'admin')`,
    [shop, other],
  );
  await db.query(`SELECT public.erase_vendor_seats($1)`, [user]);
  assert.equal(await seatCount(shop), 1, 'the co-admin was removed too');
});

test('erasing someone who holds no seat is not an error', async () => {
  // Most people erased will never have opened a shop. A function that throws on
  // the common case would fail the whole erasure for everybody.
  const r = await db.query<{ erase_vendor_seats: number }>(
    `SELECT public.erase_vendor_seats($1) AS erase_vendor_seats`,
    ['00000000-0000-4000-8000-00000000dead'],
  );
  assert.equal(r.rows[0]!.erase_vendor_seats, 0);
});

test('a null subject is refused rather than deleting every seat with a null user', async () => {
  await assert.rejects(
    () => db.query(`SELECT public.erase_vendor_seats(NULL)`),
    /p_user_id is required/,
  );
});

test('demoting the last admin is still refused — erasure deletes, it never demotes', async () => {
  const { shop, user } = await shopWithOneAdmin();
  await assert.rejects(
    () =>
      db.query(`UPDATE public.vendor_team_members SET role = 'viewer' WHERE user_id = $1`, [user]),
    /VENDOR_LAST_ADMIN/,
    'the demotion arm was exempted too — it should not have been',
  );
  assert.equal(await seatCount(shop), 1);
});

test('a closed shop can record its held address', async () => {
  // The other half of the same owner ruling: the address is held for a year so
  // nobody else can take it. This proves the CHECK constraint accepts the new
  // entity type — without it the insert is refused and, PostgREST being
  // PostgREST, the caller would see `{ error }` and carry on none the wiser.
  const { shop } = await shopWithOneAdmin();
  await db.query(
    `INSERT INTO public.slug_change_log
       (entity_type, entity_id, old_slug, new_slug, redirect_until)
     VALUES ('vendor_closed', $1, 'someshop', 'someshop', now() + interval '365 days')`,
    [shop],
  );
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.slug_change_log
      WHERE entity_type = 'vendor_closed' AND entity_id = $1`,
    [shop],
  );
  assert.equal(r.rows[0]!.n, 1);
});

test('an unknown entity type is still refused — the CHECK was widened, not dropped', async () => {
  const { shop } = await shopWithOneAdmin();
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.slug_change_log
           (entity_type, entity_id, old_slug, new_slug)
         VALUES ('whatever', $1, 'x', 'y')`,
        [shop],
      ),
    /entity_type/,
  );
});
