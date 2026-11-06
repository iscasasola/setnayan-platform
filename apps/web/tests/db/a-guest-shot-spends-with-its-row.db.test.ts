/**
 * A GUEST SHOT SPENDS ITS POINTS IN THE SAME TRANSACTION AS ITS ROW — migration
 * 20271276810836, `papic_record_guest_capture_and_spend` run against the
 * REPLAYED schema.
 *
 * Before: the guest-capture route booked the points in one round trip and wrote
 * the row in a second. A function that died between them left the points spent
 * and no photograph. Now one function does both, so they commit together or not
 * at all.
 *
 * The three proofs the build asked for, on BOTH ledgers a guest can draw (the
 * pot alone, and her own camera split with the pot):
 *   (a) a capture that dies mid-way leaves every balance as it was — the fault
 *       is injected AFTER the row and AFTER the booking, the latest point a
 *       death can happen, and a control shows the same fault on the old
 *       two-call shape DOES leak (so the reads can see a leak at all);
 *   (b) a normal capture spends exactly once;
 *   (c) a retry with the same shutter id spends nothing.
 *
 * ⚠ PGlite is one session: a "death" here is an error raised inside the call,
 * which is what a timeout or a dropped connection is to Postgres — the
 * transaction never commits.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

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

type Reply = { status: string; duplicate?: boolean; capture_id?: string; reason?: string };

type Guest = { eventId: string; guestId: string; seatId: string | null };

/** A guest at a celebration whose pot holds `pot`; with `own` > 0 she holds a camera with that many of her own. */
async function seedGuest(pot: number, own = 0, termsAccepted = true): Promise<Guest> {
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`spends with its row ${n}`],
  );
  if (pot > 0) {
    await db.query(
      `INSERT INTO public.papic_event_point_grants (event_id, points, source, note) VALUES ($1, $2, 'admin', 'spends with its row')`,
      [eventId, pot],
    );
  }
  const guestId = await one<string>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, ugc_terms_accepted_at)
     VALUES ($1, $2, 'Reyes', 'both', 'friends', ${termsAccepted ? 'NOW()' : 'NULL'}) RETURNING guest_id`,
    [eventId, `Row${n}`],
  );
  let seatId: string | null = null;
  if (own > 0) {
    seatId = await one<string>(
      `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, tier, guest_id)
       VALUES ($1, $2, 'PAPIC_CAMERA_MINI_DAY', $3, 'unlimited', $4) RETURNING seat_id`,
      [eventId, 200 + n, randomUUID().replace(/-/g, ''), guestId],
    );
    await db.query(
      `INSERT INTO public.papic_event_point_grants (event_id, seat_id, points, source, note)
       VALUES ($1, $2, $3, 'camera_grant', 'her own camera')`,
      [eventId, seatId, own],
    );
  }
  return { eventId, guestId, seatId };
}

async function shoot(g: Guest, cost: number, clientId: string | null = randomUUID()): Promise<Reply> {
  return one<Reply>(
    `SELECT public.papic_record_guest_capture_and_spend(
       p_guest_id => $1, p_r2_object_key => $2, p_media_type => $3,
       p_duration_ms => $4, p_points_cost => $5, p_client_capture_id => $6::uuid)`,
    [
      g.guestId,
      `r2://media/papic/guest/${g.guestId}/papic-${clientId ?? Math.random()}.jpg`,
      cost > 1 ? 'clip' : 'photo',
      cost > 1 ? 10000 : null,
      cost,
      clientId,
    ],
  );
}

type Balances = { pot: number; own: number; rows: number; rowCost: number };
async function balances(g: Guest): Promise<Balances> {
  return {
    pot: await one<number>(
      `SELECT COALESCE((SELECT points_used FROM public.papic_event_pool_usage WHERE event_id = $1), 0)::int`,
      [g.eventId],
    ),
    own: g.seatId
      ? await one<number>(
          `SELECT COALESCE((SELECT points_used FROM public.papic_seat_point_usage WHERE seat_id = $1), 0)::int`,
          [g.seatId],
        )
      : 0,
    rows: await one<number>(`SELECT COUNT(*)::int FROM public.papic_guest_captures WHERE guest_id = $1`, [g.guestId]),
    rowCost: await one<number>(
      `SELECT COALESCE(SUM(points_cost), 0)::int FROM public.papic_guest_captures WHERE guest_id = $1`,
      [g.guestId],
    ),
  };
}

/** Raise from an AFTER trigger on `table` — a death after that write, inside the call. */
async function withFaultAfter(table: string, op: 'INSERT' | 'UPDATE', run: () => Promise<unknown>) {
  await db.query(`CREATE OR REPLACE FUNCTION public.zz_test_die() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'the function died here'; END $$`);
  await db.query(`CREATE TRIGGER zz_test_die AFTER ${op} ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.zz_test_die()`);
  try {
    await assert.rejects(run, /the function died here/, 'the injected fault did not fire — this test proves nothing');
  } finally {
    await db.query(`DROP TRIGGER zz_test_die ON public.${table}`);
    await db.query(`DROP FUNCTION public.zz_test_die()`);
  }
}

// ── (b) a normal capture spends exactly once ────────────────────────────────

test('(b) the pot: one shot is one row and its cost booked once', async () => {
  const g = await seedGuest(100);
  const r = await shoot(g, 1);
  assert.equal(r.status, 'ok');
  assert.ok(r.capture_id, 'the reply no longer names its row');
  assert.deepEqual(await balances(g), { pot: 1, own: 0, rows: 1, rowCost: 1 });
});

test('(b) her own camera: "spend 2 and take 6" — her credits first, the pot for the rest, once', async () => {
  const g = await seedGuest(100, 2);
  const r = await shoot(g, 8);
  assert.equal(r.status, 'ok');
  assert.deepEqual(await balances(g), { pot: 6, own: 2, rows: 1, rowCost: 8 });
});

// ── (c) a retry with the same shutter id spends nothing ─────────────────────

test('(c) the same shutter again books nothing, on either ledger', async () => {
  for (const own of [0, 2]) {
    const g = await seedGuest(100, own);
    const id = randomUUID();
    const first = await shoot(g, 8, id);
    const before = await balances(g);
    const again = await shoot(g, 8, id);
    assert.equal(again.status, 'ok', 'a retry of a landed shot was refused');
    assert.equal(again.duplicate, true, 'a retry was recorded as a new shot');
    assert.equal(again.capture_id, first.capture_id);
    assert.deepEqual(await balances(g), before, `a retry spent points (own camera: ${own > 0})`);
  }
});

// ── (a) a capture that dies mid-way leaves the balances as before ───────────

test('(a) the pot: dying AFTER the row and AFTER the booking leaves nothing spent', async () => {
  const g = await seedGuest(100);
  await shoot(g, 1); // a live pot row, so the booking is an UPDATE the fault can follow
  const before = await balances(g);
  // The pot is booked LAST on this path — after the insert — so a fault on its
  // update is the latest moment the call can die.
  await withFaultAfter('papic_event_pool_usage', 'UPDATE', () => shoot(g, 1));
  assert.deepEqual(await balances(g), before, 'a death between booking and commit kept points or a row');
});

test('(a) her own camera: dying AFTER both bookings and the row leaves nothing spent', async () => {
  const g = await seedGuest(100, 2);
  const before = await balances(g);
  // The split books first on this path; the row is the last write, so a fault
  // on its insert comes after her credits AND the pot have both moved.
  await withFaultAfter('papic_guest_captures', 'INSERT', () => shoot(g, 8));
  assert.deepEqual(await balances(g), before, 'a death after the split kept her credits or the pot spent');
});

test('(a) control: the SAME fault on the old two-call shape leaks — these reads can see a leak', async () => {
  const g = await seedGuest(100);
  const before = await balances(g);
  // What the route did: book in one statement (it commits), record in the next.
  assert.equal(await one<boolean>(`SELECT public.papic_reserve_event_points($1, 1)`, [g.eventId]), true);
  await withFaultAfter('papic_guest_captures', 'INSERT', () =>
    one(`SELECT public.papic_record_guest_capture(p_guest_id => $1, p_r2_object_key => 'r2://x', p_points_cost => 1)`, [g.guestId]),
  );
  const leaked = await balances(g);
  assert.equal(leaked.rows, before.rows, 'control: the record should have died');
  assert.equal(leaked.pot, before.pot + 1, 'control: the two-call shape no longer leaks — the fault is not where this test thinks');
});

// ── refusals undo whichever side already moved ──────────────────────────────

test('a pot that cannot cover the shot leaves no row and no spend', async () => {
  const g = await seedGuest(1);
  assert.equal((await shoot(g, 1)).status, 'ok');
  const before = await balances(g);
  const r = await shoot(g, 1);
  assert.equal(r.status, 'camera_points_exhausted');
  assert.deepEqual(await balances(g), before, 'the refused shot kept its row or its ceiling spend');
});

test('a record that refuses after her camera was booked gives the booking back', async () => {
  const g = await seedGuest(100, 2, /* termsAccepted */ false);
  const before = await balances(g);
  const r = await shoot(g, 8);
  assert.equal(r.status, 'terms_required', 'the record’s own refusal must reach the route unchanged');
  assert.deepEqual(await balances(g), before, 'a refused shot kept points booked');
});

test('one function, service-role only', async () => {
  assert.equal(
    await one<number>(
      `SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
        WHERE ns.nspname = 'public' AND p.proname = 'papic_record_guest_capture_and_spend'`,
    ),
    1,
  );
  const sig = `public.papic_record_guest_capture_and_spend(uuid,text,boolean,text,integer,text,integer,timestamp with time zone,uuid)`;
  for (const [role, can] of [['anon', false], ['authenticated', false], ['service_role', true]] as const) {
    assert.equal(await one<boolean>(`SELECT has_function_privilege($1, $2, 'EXECUTE')`, [role, sig]), can, role);
  }
});
