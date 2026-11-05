/**
 * 🎟 UNLIMITED and GROUP SESSION — asserted against the DATABASE (migration 20271317711533; DECISION_LOG 2026-09-25
 * "…A THIRD MODE: UNLIMITED" · "GROUP SESSIONS (photo booth group shots) — print count = guests scanned, adjustable").
 *
 *   1 · UNLIMITED: every scan counts with a new number, the same guest too; served ≠ unique;
 *   2 · GROUP: a session takes ONE number when it opens; everyone scanned joins it; a guest twice is "in session";
 *   3 · Done closes it with prints = guests by default, or the operator's own number (1–99, else refused);
 *   4 · an EMPTY session cancelled gives its number back — a mis-tap leaves no gap;
 *   5 · Ready never fires on an open session; after Done it tells each guest; each pickup reads "k of n";
 *   6 · a guest may be in many shots (group combines with unlimited); with nothing open and nothing waiting,
 *       the scan says "no session" and writes nothing.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

const F = { eventId: '', shop: '', unlimitedCov: 0, groupCov: 0, tokens: [] as string[] };
type J = Record<string, unknown>;

async function call(sql: string, args: unknown[]): Promise<J> {
  await asUser(F.shop);
  return (await db.query<{ a: J }>(sql, args)).rows[0]!.a;
}
const scan = (cov: number, t: string) => call(`SELECT public.supplier_scan_claim($1,$2,$3,'supplier_qr') AS a`, [F.eventId, cov, t]);
const open = () => call(`SELECT public.supplier_scan_session_open($1,$2) AS a`, [F.eventId, F.groupCov]);
const done = (prints: number | null) => call(`SELECT public.supplier_scan_session_done($1,$2,$3) AS a`, [F.eventId, F.groupCov, prints]);
const ready = async (n: number) => {
  await asUser(F.shop);
  return (await db.query<{ n: number }>(`SELECT public.supplier_scan_ready($1,$2,$3) AS n`, [F.eventId, F.groupCov, n])).rows[0]!.n;
};
const tally = (cov: number) => call(`SELECT public.supplier_scan_tally($1,$2) AS a`, [F.eventId, cov]);

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  F.shop = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('booth@group.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Sample Wedding','wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  const vp = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1,'Lumina Studio','Manila',ARRAY['photo_booth']::text[],'verified', NOW()) RETURNING vendor_profile_id`,
      [F.shop],
    )
  ).rows[0]!.vendor_profile_id;
  const cov = async (cs: string) =>
    Number((await db.query<{ id: string }>(`INSERT INTO public.vendor_coverages (vendor_profile_id, canonical_service) VALUES ($1,$2) RETURNING id`, [vp, cs])).rows[0]!.id);
  F.unlimitedCov = await cov('photo_booth');
  F.groupCov = await cov('mirror_booth');
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1,'photobooth','Lumina Studio','contracted',10000,$2)`,
    [F.eventId, vp],
  );
  for (let i = 0; i < 5; i++) {
    F.tokens.push(
      (
        await db.query<{ qr_token: string }>(
          `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status)
           VALUES ($1,$2,'Sample','bride','friends','attending') RETURNING qr_token`,
          [F.eventId, `Guest${i}`],
        )
      ).rows[0]!.qr_token,
    );
  }
  await asUser(F.shop);
  await db.query(`INSERT INTO public.supplier_scan_settings (coverage_id, enabled, mode) VALUES ($1, TRUE, 'unlimited'), ($2, TRUE, 'group_session')`, [
    F.unlimitedCov,
    F.groupCov,
  ]);
  await asOwner();
});

after(async () => {
  await replay?.db.close();
});

test('1 · unlimited: every scan counts with a new number, the same guest too', async () => {
  assert.deepEqual(await scan(F.unlimitedCov, F.tokens[0]!), { outcome: 'served', number: 1, served: 1, unique: 1 });
  assert.deepEqual(await scan(F.unlimitedCov, F.tokens[0]!), { outcome: 'served', number: 2, served: 2, unique: 1 });
  assert.deepEqual(await scan(F.unlimitedCov, F.tokens[1]!), { outcome: 'served', number: 3, served: 3, unique: 2 });
  const t = await tally(F.unlimitedCov);
  assert.equal(t.served, 3);
  assert.equal(t.unique, 2);
});

test('2 · a group session takes ONE number; everyone scanned joins it', async () => {
  assert.deepEqual(await scan(F.groupCov, F.tokens[0]!), { outcome: 'no_session' }, 'nothing open, nothing waiting');
  assert.deepEqual(await open(), { number: 1, guests: 0 });
  assert.deepEqual(await open(), { number: 1, guests: 0 }, 'a second phone joins the open session');
  for (let i = 0; i < 5; i++) assert.deepEqual(await scan(F.groupCov, F.tokens[i]!), { outcome: 'added', number: 1, guests: i + 1 });
  assert.deepEqual(await scan(F.groupCov, F.tokens[2]!), { outcome: 'in_session', number: 1, guests: 5 });
  const t = await tally(F.groupCov);
  assert.equal(t.open_number, 1);
  assert.equal(t.open_guests, 5);
});

test('3 · Ready is refused while the shot is open; Done sets prints = guests, or the operator’s own number', async () => {
  await assert.rejects(ready(1), /session_open/);
  await assert.rejects(done(0), /bad_prints/);
  assert.deepEqual(await done(null), { outcome: 'done', number: 1, guests: 5, prints: 5 });
  await open();
  await scan(F.groupCov, F.tokens[0]!);
  await scan(F.groupCov, F.tokens[1]!);
  assert.deepEqual(await done(3), { outcome: 'done', number: 2, guests: 2, prints: 3 }, 'the operator adds a print');
});

test('4 · an empty session cancelled gives its number back', async () => {
  assert.deepEqual(await open(), { number: 3, guests: 0 });
  assert.deepEqual(await done(null), { outcome: 'cancelled', number: 3 });
  assert.deepEqual(await open(), { number: 3, guests: 0 }, 'the next shot is #0003 again — no gap');
  assert.deepEqual(await done(null), { outcome: 'cancelled', number: 3 });
  assert.deepEqual(await done(null), { outcome: 'none_open' });
});

test('5 · Ready tells each guest of #0001; each pickup reads "k of n"', async () => {
  assert.equal(await ready(1), 5);
  assert.deepEqual(await scan(F.groupCov, F.tokens[3]!), { outcome: 'picked_up', number: 1, claimed: 1, of: 5 });
  assert.deepEqual(await scan(F.groupCov, F.tokens[4]!), { outcome: 'picked_up', number: 1, claimed: 2, of: 5 });
  assert.deepEqual(await scan(F.groupCov, F.tokens[4]!), { outcome: 'already', number: 1, claimed: null, total: null });
  await asOwner();
  const lines = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.coordinator_broadcasts WHERE event_id = $1 AND sender_role = 'supplier' AND body LIKE '#0001 is ready%'`,
    [F.eventId],
  );
  assert.equal(lines.rows[0]!.n, 5);
});

test('6 · a guest in two shots holds two; guest 0 picks up #0001 before #0002 is ready', async () => {
  assert.deepEqual(await scan(F.groupCov, F.tokens[0]!), { outcome: 'picked_up', number: 1, claimed: 3, of: 5 });
  assert.deepEqual(await scan(F.groupCov, F.tokens[0]!), { outcome: 'not_ready', number: 2 }, '#0002 is still being printed');
  const t = await tally(F.groupCov);
  assert.equal(t.sessions, 2);
  assert.equal(t.claimed, 3);
  assert.equal(t.ready, 2);
  assert.equal(t.ordered, 2);
  await asUser(F.shop);
  const nums = await db.query<{ scan_number: number; prints: number; open: boolean }>(
    `SELECT scan_number, prints, open FROM public.supplier_scan_numbers($1,$2)`,
    [F.eventId, F.groupCov],
  );
  assert.deepEqual(nums.rows.map((r) => [r.scan_number, r.prints, r.open]), [
    [2, 3, false],
    [1, 5, false],
  ]);
});
