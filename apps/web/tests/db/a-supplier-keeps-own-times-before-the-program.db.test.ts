/**
 * 🕕 A SUPPLIER'S OWN TIMES BEFORE THE PROGRAM — asserted against the DATABASE, through real sessions (migration
 * 20271346335702; owner-approved supplier cut 5, 2026-11-14 — DECISION_LOG "THE SEVEN SUPPLIER CUTS ARE APPROVED").
 *
 *   1 · The booked supplier keeps its own call time, arrival and finish on an event with NO chapters, and changes them.
 *   2 · The couple reads them; nobody but the supplier writes them — not the couple, not another supplier, not a shop
 *       that is not booked, and never under somebody else's name (`updated_by`).
 *   3 · A clock that is not a wall clock ('HH:MM') is refused by the table.
 *   4 · anon reaches nothing.
 *
 * Every refusal asserts the row is unchanged afterwards — a refusal that still wrote is not a refusal.
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

const F = { eventId: '', couple: '', supA: '', supB: '', stranger: '', vpA: '', vpB: '', vpStranger: '' };

async function stored(vp: string): Promise<{ call: string | null; arrive: string | null; done: string | null } | null> {
  await asOwner();
  const r = await db.query<{ call: string | null; arrive: string | null; done: string | null }>(
    `SELECT call_clock AS call, arrive_clock AS arrive, done_clock AS done FROM public.supplier_own_times WHERE event_id=$1 AND vendor_profile_id=$2`,
    [F.eventId, vp],
  );
  return r.rows[0] ?? null;
}

const UPSERT = `INSERT INTO public.supplier_own_times (event_id, vendor_profile_id, call_clock, arrive_clock, done_clock, updated_by)
  VALUES ($1,$2,$3,$4,$5,$6)
  ON CONFLICT (event_id, vendor_profile_id) DO UPDATE SET call_clock=EXCLUDED.call_clock, arrive_clock=EXCLUDED.arrive_clock,
    done_clock=EXCLUDED.done_clock, updated_by=EXCLUDED.updated_by, updated_at=now()`;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  const mkUser = async (email: string): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.couple = await mkUser('couple@owntimes.test');
  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Own Times Day','wedding','catholic','banquet_hall', DATE '2099-12-12', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, F.couple]);
  const mkShop = async (key: string, booked: boolean): Promise<{ uid: string; vp: string }> => {
    const uid = await mkUser(`sup${key}@owntimes.test`);
    const vp = (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
         VALUES ($1,$2,'Manila',ARRAY['florals']::text[],'verified', NOW()) RETURNING vendor_profile_id`,
        [uid, `Shop ${key}`],
      )
    ).rows[0]!.vendor_profile_id;
    if (booked) {
      await db.query(
        `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
         VALUES ($1,'catering',$2,'contracted',100000,$3)`,
        [F.eventId, `Shop ${key}`, vp],
      );
    }
    return { uid, vp };
  };
  const a = await mkShop('A', true);
  const b = await mkShop('B', true);
  const s = await mkShop('Stranger', false);
  Object.assign(F, { supA: a.uid, vpA: a.vp, supB: b.uid, vpB: b.vp, stranger: s.uid, vpStranger: s.vp });
  const chapters = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_schedule_blocks WHERE event_id=$1`, [F.eventId]);
  assert.equal(chapters.rows[0]!.n, 0, 'anti-vacuity: the event must have NO program — that is the case this table is for');
});

after(async () => {
  await db?.close?.();
});

test('1 · the booked supplier keeps its own times with no program, and changes them', async () => {
  await asUser(F.supA);
  await db.query(UPSERT, [F.eventId, F.vpA, '06:00', '07:30', '23:00', F.supA]);
  assert.deepEqual(await stored(F.vpA), { call: '06:00', arrive: '07:30', done: '23:00' });
  await asUser(F.supA);
  await db.query(UPSERT, [F.eventId, F.vpA, '05:30', '07:30', null, F.supA]);
  assert.deepEqual(await stored(F.vpA), { call: '05:30', arrive: '07:30', done: null });
  await asUser(F.supA);
  const own = await db.query(`SELECT call_clock FROM public.supplier_own_times WHERE event_id=$1`, [F.eventId]);
  assert.equal(own.rows.length, 1, 'the supplier reads its own row');
});

test('2 · the couple reads; nobody else writes, and never under another name', async () => {
  await asUser(F.couple);
  const seen = await db.query<{ call_clock: string }>(`SELECT call_clock FROM public.supplier_own_times WHERE event_id=$1`, [F.eventId]);
  assert.deepEqual(seen.rows.map((r) => r.call_clock), ['05:30'], 'the couple does not see their supplier’s times');

  const was = await stored(F.vpA);
  await asUser(F.couple);
  await assert.rejects(() => db.query(UPSERT, [F.eventId, F.vpA, '09:00', null, null, F.couple]), /row-level security|permission denied/, 'the couple wrote a supplier’s times');
  assert.deepEqual(await stored(F.vpA), was);

  await asUser(F.supB);
  await assert.rejects(() => db.query(UPSERT, [F.eventId, F.vpA, '09:00', null, null, F.supB]), /row-level security|permission denied/, 'another supplier wrote shop A’s times');
  assert.deepEqual(await stored(F.vpA), was);
  await asUser(F.supB);
  const bReads = await db.query(`SELECT 1 FROM public.supplier_own_times WHERE event_id=$1 AND vendor_profile_id=$2`, [F.eventId, F.vpA]);
  assert.equal(bReads.rows.length, 0, 'another supplier reads shop A’s times');

  await asUser(F.stranger);
  await assert.rejects(() => db.query(UPSERT, [F.eventId, F.vpStranger, '09:00', null, null, F.stranger]), /row-level security|permission denied/, 'a shop not booked kept times on the event');
  assert.equal(await stored(F.vpStranger), null);

  await asUser(F.supA);
  await assert.rejects(() => db.query(UPSERT, [F.eventId, F.vpA, '09:00', null, null, F.couple]), /row-level security|permission denied/, 'a write signed as somebody else');
  assert.deepEqual(await stored(F.vpA), was);

  await asUser(F.supA);
  await assert.rejects(() => db.query(`DELETE FROM public.supplier_own_times WHERE event_id=$1`, [F.eventId]), /permission denied/, 'DELETE was granted');
  assert.deepEqual(await stored(F.vpA), was);
});

test('3 · a clock that is not HH:MM is refused by the table', async () => {
  await asUser(F.supB);
  for (const bad of ['6:00', '24:00', '07:60', '7pm', '']) {
    await asUser(F.supB);
    await assert.rejects(() => db.query(UPSERT, [F.eventId, F.vpB, bad, null, null, F.supB]), /check constraint|violates/, `"${bad}" was kept`);
  }
  assert.equal(await stored(F.vpB), null);
});

test('4 · anon reaches nothing', async () => {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.exec(`SET ROLE anon`);
  await assert.rejects(() => db.query(`SELECT 1 FROM public.supplier_own_times`), /permission denied/);
  await asOwner();
});
