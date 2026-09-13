/**
 * A BUYER CANNOT REPOINT THEIR PAYMENT SCREENSHOT — measured as a REAL
 * `authenticated` session (SET ROLE + JWT claims), never the replay's superuser.
 *
 * N4 (#5432) noted that `authenticated` holds UPDATE on `payments.screenshot_url`
 * and that the admin's AI receipt reader fetched whatever bucket that column
 * names. N5 re-measured before building: the GRANT is there (table-level), but
 * `payments` has RLS on and NO UPDATE policy, so a buyer's UPDATE matches zero
 * rows — even on their own payment, which the same session can read. INSERT is
 * not granted at all. The column is written only by server code that binds the
 * ref to the order's own folder first.
 *
 * So the finding's second half was not reachable, and this file keeps it that
 * way: a future UPDATE policy, or a returned INSERT grant, would open the column
 * to the browser and fail here. The reader now holds the line on its own as
 * well (lib/the-receipt-reader-reads-only-its-own-folder.test.ts).
 *
 * 🔑 The refusal is NEUTRALISED once — hand the table a permissive UPDATE policy
 * inside a rolled-back transaction and the same UPDATE lands — so "0 rows" is
 * the missing policy, not a fixture that never matched.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = { buyer: '', eventId: '', orderId: '', paymentId: '', ownRef: '' };
const STRANGERS_ID = 'r2://setnayan-vendor-verification/vendors/00000000-0000-4000-8000-000000000000/verification/id.jpg';

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function asBuyer<T>(fn: () => Promise<T>, extraSql = ''): Promise<T | { err: string }> {
  await db.exec('BEGIN');
  try {
    if (extraSql) await db.exec(extraSql);
    await setAuthUid(db, F.buyer);
    await setRole('authenticated');
    await db.exec('SET ROLE authenticated');
    return await fn();
  } catch (e) {
    return { err: (e as Error).message };
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  F.buyer = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('buyer@payments.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  F.eventId = (await db.query<{ e: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('Paid Wedding', 'birthday') RETURNING event_id AS e`)).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.eventId, F.buyer]);
  F.orderId = (
    await db.query<{ o: string }>(
      `INSERT INTO public.orders (user_id, event_id, description, requested_total_php, reference_code)
       VALUES ($1, $2, 'Papic pack', 1499, 'N5PAYREF1') RETURNING order_id AS o`,
      [F.buyer, F.eventId],
    )
  ).rows[0]!.o;
  F.ownRef = `r2://setnayan-thread-files/payments/${F.orderId}/0b6c6f1e-gcash.jpg`;
  F.paymentId = (
    await db.query<{ p: string }>(
      `INSERT INTO public.payments (order_id, user_id, amount_php, channel, screenshot_url)
       VALUES ($1, $2, 1499, 'gcash', $3) RETURNING payment_id AS p`,
      [F.orderId, F.buyer, F.ownRef],
    )
  ).rows[0]!.p;
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('META: the probing role is authenticated, not the owner, and has no BYPASSRLS', async () => {
  const r = await asBuyer(() =>
    db.query<{ me: string; owner: string; bypass: boolean; super: boolean }>(
      `SELECT current_user AS me, pg_get_userbyid(c.relowner) AS owner,
              (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
              (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS super
         FROM pg_class c WHERE c.oid = 'public.payments'::regclass`,
    ),
  );
  assert.ok(!('err' in r), JSON.stringify(r));
  const row = r.rows[0]!;
  assert.equal(row.me, 'authenticated');
  assert.notEqual(row.owner, 'authenticated');
  assert.equal(row.bypass, false);
  assert.equal(row.super, false);
});

test('POSITIVE CONTROL: the buyer can read their own payment — RLS admits the row', async () => {
  const r = await asBuyer(() => db.query(`SELECT payment_id FROM public.payments WHERE payment_id = $1`, [F.paymentId]));
  assert.ok(!('err' in r), JSON.stringify(r));
  assert.equal(r.rows.length, 1, 'the buyer cannot even see their own payment — the probe below would prove nothing');
});

test('the buyer cannot point their own payment’s screenshot at somebody else’s file', async () => {
  const r = await asBuyer(() =>
    db.query(`UPDATE public.payments SET screenshot_url = $2 WHERE payment_id = $1`, [F.paymentId, STRANGERS_ID]),
  );
  if ('err' in r) {
    assert.match(r.err, /permission denied|row-level security/);
  } else {
    assert.equal(r.affectedRows ?? 0, 0, 'a buyer rewrote payments.screenshot_url');
  }
  const after = await db.query<{ s: string }>(`SELECT screenshot_url AS s FROM public.payments WHERE payment_id = $1`, [F.paymentId]);
  assert.equal(after.rows[0]!.s, F.ownRef);
  console.log('# buyer UPDATE of screenshot_url: 0 rows');
});

test('the buyer cannot insert a payment row at all', async () => {
  const r = await asBuyer(() =>
    db.query(
      `INSERT INTO public.payments (order_id, user_id, amount_php, channel, screenshot_url) VALUES ($1, $2, 1, 'gcash', $3)`,
      [F.orderId, F.buyer, STRANGERS_ID],
    ),
  );
  assert.ok('err' in r, 'a buyer inserted a payment row directly');
  assert.match(r.err, /permission denied for table payments/);
});

test('NEUTRALISED: give the table an UPDATE policy and the same write lands — so the 0 is the missing policy', async () => {
  const r = await asBuyer(
    () => db.query(`UPDATE public.payments SET screenshot_url = $2 WHERE payment_id = $1`, [F.paymentId, STRANGERS_ID]),
    `CREATE POLICY n5_probe_update ON public.payments FOR UPDATE TO authenticated USING (user_id = auth.uid())`,
  );
  assert.ok(!('err' in r), JSON.stringify(r));
  assert.equal(r.affectedRows, 1, 'with an UPDATE policy the write still did not land — the fixture is broken');
});

test('the shape that keeps it closed: no UPDATE/ALL policy and no INSERT grant for a browser role', async () => {
  const pol = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_policy
      WHERE polrelid = 'public.payments'::regclass AND polcmd IN ('w', '*')`,
  );
  assert.equal(pol.rows[0]!.n, 0, 'payments gained an UPDATE (or ALL) policy — a buyer can now rewrite screenshot_url');
  const ins = await db.query<{ a: boolean; b: boolean }>(
    `SELECT has_table_privilege('authenticated', 'public.payments', 'INSERT') AS a,
            has_table_privilege('anon', 'public.payments', 'INSERT') AS b`,
  );
  assert.deepEqual(ins.rows[0], { a: false, b: false });
});
