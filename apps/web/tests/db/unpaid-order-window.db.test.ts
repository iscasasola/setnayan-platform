/**
 * The unpaid-order window, proved against a replayed schema.
 *
 * Owner ruling 2026-08-20: an unpaid order cancels itself after 15 days, the
 * buyer is warned first, and it is CANCELLED rather than deleted.
 *
 * Three things are asserted here rather than in a unit test, because all three
 * are properties of the DATABASE and would be invisible to one:
 *   1. the deadline is stamped by the column DEFAULT, so no creation path can
 *      forget it — the failure mode this repo calls "a gate with no handle";
 *   2. a buyer cannot move their own deadline or silence their own reminder,
 *      even though `authenticated` holds a table-level UPDATE grant on orders;
 *   3. the guard lets a trusted caller (the sweep) through.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.query(`SET TIME ZONE 'UTC'`);
});
after(async () => { await db.close(); });

/**
 * 🪤 `SET LOCAL ROLE` OUTSIDE A TRANSACTION IS A NO-OP. The first cut of this
 * file used it, stayed the superuser, and reported the guard as broken when the
 * guard was fine — the TEST was vacuous. So the role change is made with
 * `exec` and then PROVEN, exactly as the anon-RPC suite does: an unasserted
 * SET ROLE turns every denial below into a tautology.
 */
async function asBuyer(uid: string | null, fn: () => Promise<void>) {
  if (uid) {
    await setAuthUid(db, uid);
    await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  }
  await db.exec('SET ROLE authenticated');
  const who = await db.query<{ cu: string }>(`SELECT current_user AS cu`);
  assert.equal(
    who.rows[0]!.cu,
    'authenticated',
    'SET ROLE did not take — every assertion in this test would be vacuous',
  );
  try {
    await fn();
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await setAuthUid(db, null);
  }
}

let n = 0;
async function anOrder(): Promise<{ id: string; uid: string }> {
  n += 1;
  const uid = `00000000-0000-4000-8000-${String(900 + n).padStart(12, '0')}`;
  await db.query(`INSERT INTO auth.users (id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [
    uid,
    `w${n}@t.invalid`,
  ]);
  const r = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders (user_id, service_key, description, requested_total_php, reference_code)
     VALUES ($1, 'SETNAYAN_AI', 'Setnayan AI', 499, $2)
     RETURNING order_id`,
    [uid, `REF${String(n).padStart(6, '0')}`],
  );
  return { id: r.rows[0]!.order_id, uid };
}

test('the deadline is stamped by the DEFAULT — no creation path can forget it', async () => {
  const { id, uid } = await anOrder();
  const r = await db.query<{ days: number; reminder: string | null }>(
    `SELECT EXTRACT(DAY FROM (payment_due_at - created_at))::int AS days,
            payment_reminder_sent_at AS reminder
       FROM public.orders WHERE order_id = $1`,
    [id],
  );
  // The insert above names NEITHER new column — exactly like every existing
  // creation path in the app, none of which knows they exist.
  assert.equal(r.rows[0]!.days, 15, 'an order must be born with a 15-day window');
  assert.equal(r.rows[0]!.reminder, null, 'nobody has been nudged yet');
});

test('a buyer cannot move their own deadline', async () => {
  const { id, uid } = await anOrder();
  const before_ = await db.query<{ d: string }>(
    `SELECT payment_due_at::text AS d FROM public.orders WHERE order_id = $1`, [id],
  );

  await asBuyer(uid, async () => {
    await db.query(
      `UPDATE public.orders SET payment_due_at = now() + INTERVAL '10 years' WHERE order_id = $1`,
      [id],
    );
  });

  const after_ = await db.query<{ d: string }>(
    `SELECT payment_due_at::text AS d FROM public.orders WHERE order_id = $1`, [id],
  );
  assert.equal(
    after_.rows[0]!.d,
    before_.rows[0]!.d,
    'a buyer moved their own payment deadline — orders carries a table-level ' +
      'UPDATE grant, so PostgREST would accept this without the guard trigger',
  );
});

test('a buyer cannot silence their own reminder', async () => {
  const { id, uid } = await anOrder();
  await asBuyer(uid, async () => {
    await db.query(
      `UPDATE public.orders SET payment_reminder_sent_at = now() WHERE order_id = $1`, [id],
    );
  });
  const r = await db.query<{ s: string | null }>(
    `SELECT payment_reminder_sent_at AS s FROM public.orders WHERE order_id = $1`, [id],
  );
  assert.equal(r.rows[0]!.s, null, 'a buyer stamped their own reminder as already sent');
});

test('the guard reverts ONLY these two fields — a legitimate edit still lands', async () => {
  const { id, uid } = await anOrder();
  await asBuyer(uid, async () => {
    // The couple cancelling their own order is a real, permitted action. It
    // must not error just because the guard is watching two other columns.
    // Both at once: the permitted change AND a forbidden one. The permitted
    // half must land, the forbidden half must not, in the SAME statement.
    await db.query(
      `UPDATE public.orders
          SET status = 'cancelled', payment_due_at = now() + INTERVAL '10 years'
        WHERE order_id = $1`,
      [id],
    );
  });
  const r = await db.query<{ s: string; far: boolean }>(
    `SELECT status::text AS s, (payment_due_at > now() + INTERVAL '1 year') AS far
       FROM public.orders WHERE order_id = $1`,
    [id],
  );
  assert.equal(r.rows[0]!.s, 'cancelled', 'the guard blocked an unrelated, legitimate update');
  assert.equal(r.rows[0]!.far, false, 'the deadline rode in on a permitted update');
});

test('the sweep (a trusted role) CAN stamp the reminder', async () => {
  const { id, uid } = await anOrder();
  // No SET ROLE — this is the admin/service path the sweep actually uses.
  await db.query(
    `UPDATE public.orders SET payment_reminder_sent_at = now() WHERE order_id = $1`, [id],
  );
  const r = await db.query<{ s: string | null }>(
    `SELECT payment_reminder_sent_at AS s FROM public.orders WHERE order_id = $1`, [id],
  );
  assert.ok(
    r.rows[0]!.s !== null,
    'the guard also blocked the sweep — then the reminder can never be sent and ' +
      'every page load would re-email the buyer',
  );
});
