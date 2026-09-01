/**
 * THE RECOMMENDED CAP IS RAISABLE — a couple who sets 300 can deliver 300.
 *
 * Owner, 2026-08-31, verbatim: "yes it is raisable. but that is the recommended
 * cap. if cap is activated."
 *
 * ── WHAT WAS BROKEN ────────────────────────────────────────────────────────
 * `papic_record_guest_capture` carried `v_credits CONSTANT INTEGER := 150` and
 * refused there no matter what the couple had chosen. A couple could activate the
 * ceiling, set 300, and their guests were stopped at 150 — AND TOLD 150, a number
 * the couple never picked. Only a PAPIC_UNLOCK order lifted it, and production has
 * never sold one, so it bound on every celebration.
 *
 * 🔑 WHY THE HEADLINE TEST SPENDS IN LUMPS OF 100. A test that shoots once and
 * asserts "ok" passes on the broken code too. The only way to prove the 150 stopped
 * being a lid is to spend PAST it under a higher ceiling — so the second shot takes
 * the guest to 200, which the old code refused and the new code allows. Delete the
 * migration and this file goes red on that line.
 *
 * Migration: 20271186395500_the_recommended_cap_is_raisable.sql
 * Run: cd apps/web && npx tsx --test tests/db/papic-the-recommended-cap-is-raisable.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, T>>(sql, params);
  return Object.values(r.rows[0] ?? {})[0] as T;
}

type Reply = {
  status: string;
  reason?: string;
  total?: number;
  used?: number;
  remaining?: number;
  unlimited?: boolean;
  ceiling?: number | null;
};

async function seedPoolEvent(grantPoints = 5000) {
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type, estimated_pax)
     VALUES ($1, 'birthday', NULL) RETURNING event_id`,
    [`raisable cap ${n}`],
  );
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
     VALUES ($1, $2, 'admin', 'raisable cap test')`,
    [eventId, grantPoints],
  );
  return eventId;
}

async function seedGuest(eventId: string, name = 'Ana') {
  n += 1;
  return one<string>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category,
                                ugc_terms_accepted_at)
     VALUES ($1, $2, 'Cruz', 'both', 'friends', NOW()) RETURNING guest_id`,
    [eventId, name],
  );
}

const shoot = (guestId: string, cost = 1) =>
  one<Reply>(
    `SELECT public.papic_record_guest_capture($1, $2, false, 'photo', NULL, NULL, $3)`,
    [guestId, `r2://t/${Math.random()}`, cost],
  );

const setCeiling = (eventId: string, points: number | null) =>
  db.query(
    `UPDATE public.events
        SET papic_guest_spend_ceiling_on = $2, papic_guest_spend_ceiling_points = $3
      WHERE event_id = $1`,
    [eventId, points !== null, points],
  );

// ══ 1 · 🚨 THE HEADLINE — 150 IS NO LONGER A LID ═══════════════════════════

test('🚨 a couple who sets 300 can deliver 300 — the guest spends PAST 150', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId);

  const pool = await db.query<{ applies: boolean }>(
    `SELECT applies FROM public.papic_event_pool_status($1)`, [eventId],
  );
  assert.equal(pool.rows[0]!.applies, true, 'PRECONDITION: the pool must apply, or this proves nothing');

  await setCeiling(eventId, 300);
  assert.equal(await one<number>(`SELECT public.papic_guest_spend_ceiling($1)`, [guestId]), 300);

  const first = await shoot(guestId, 100);
  assert.equal(first.status, 'ok', 'the first 100 was always allowed');

  // 🚨 THE LINE THAT FAILS ON THE OLD CODE: this takes her to 200, past the flat 150.
  const second = await shoot(guestId, 100);
  assert.equal(
    second.status, 'ok',
    'the couple activated a 300 ceiling; the flat 150 must not refuse her at 200',
  );

  const third = await shoot(guestId, 100);
  assert.equal(third.status, 'ok', 'and 300 means 300 — the last credit the couple granted');
});

// ══ 2 · SHE IS TOLD THE COUPLE'S NUMBER, NEVER THE PLATFORM'S ═════════════

test('when she is finally refused, the reply names the couple’s figure — not 150', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId);
  await setCeiling(eventId, 300);

  for (let i = 0; i < 3; i += 1) {
    assert.equal((await shoot(guestId, 100)).status, 'ok');
  }

  const refused = await shoot(guestId, 100);
  assert.equal(refused.status, 'quota_exhausted', 'the ceiling still has to bind somewhere');
  assert.equal(
    refused.total, 300,
    'the number she is shown must be the one her couple chose — being told 150 was the original defect',
  );
  assert.notEqual(refused.total, 150);
});

// ══ 3 · RAISING THE FLOOR LOOSENED NOTHING ════════════════════════════════

test('a ceiling BELOW 150 still binds at the ceiling — the tighter gate keeps winning', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId);
  await setCeiling(eventId, 50);

  const ok = await shoot(guestId, 50);
  assert.equal(ok.status, 'ok');

  const refused = await shoot(guestId, 1);
  assert.equal(
    refused.status, 'quota_exhausted',
    'GREATEST(150, ceiling) must never let a 50-credit ceiling spend 150',
  );
  assert.equal(refused.total, 50, 'and it is still her couple’s number that is reported');
});

// ══ 4 · THE UNCAPPED CELEBRATION IS UNTOUCHED ═════════════════════════════

test('with no ceiling activated the behaviour is exactly what it was', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId);

  assert.equal(
    await one<number | null>(`SELECT public.papic_guest_spend_ceiling($1)`, [guestId]), null,
    'the switch is OFF by default and must stay so',
  );
  const r = await shoot(guestId, 100);
  assert.equal(r.status, 'ok');
  assert.equal(r.unlimited, true, 'the pool still stands the per-guest gate down when nothing is set');
});
