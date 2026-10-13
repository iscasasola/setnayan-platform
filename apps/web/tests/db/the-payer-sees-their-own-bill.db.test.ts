/**
 * `order_basket_lines` — the payer sees what their sign-up bill covers, and
 * NOBODY else does.
 *
 * ── THE DEFECT (measured 2026-10-13 by the Papic end-to-end tester) ─────────
 * `/pay/[reference]` lists a basket bill's lines on the PAYER'S OWN session.
 * It read `onboarding_order_items` directly, and that table is shut to every
 * session role — so every view logged "permission denied for table
 * onboarding_order_items" and drew a bill made during sign-up (Papic + Setnayan
 * AI + Pro on one reference) as a total with nothing under it.
 *
 * The fix keeps the table shut and asks a SECURITY DEFINER function instead.
 * A source guard (`lib/the-payer-sees-their-own-bill.test.ts`) can only read
 * the migration's text; these tests run the function as each role in turn,
 * which is the only way to see who actually gets the lines.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = {
  buyer: '',
  partner: '',
  guest: '',
  stranger: '',
  eventId: '',
  basketId: '',
  plainId: '',
};

type Line = { service_code: string; title: string | null; quantity: number; unit_price_php: string };

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

/** Call the RPC as `uid` under the `authenticated` role — the /pay session. */
async function linesAs(uid: string | null, orderId: string): Promise<Line[]> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
  try {
    const r = await db.query<Line>(`SELECT * FROM public.order_basket_lines($1::uuid)`, [orderId]);
    return r.rows;
  } finally {
    await reset();
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.buyer = await createUser('payer-buyer@audit.test');
  F.partner = await createUser('payer-partner@audit.test');
  F.guest = await createUser('payer-guest@audit.test');
  F.stranger = await createUser('payer-stranger@audit.test');

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ('Payer Bill Test', 'wedding', 'civil', 'banquet_hall') RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;

  for (const [uid, kind] of [
    [F.buyer, 'couple'],
    [F.partner, 'couple'],
    // A LEGITIMATELY invited guest — still must not learn what the couple was billed.
    [F.guest, 'guest'],
  ] as const) {
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,$3)`,
      [F.eventId, uid, kind],
    );
  }

  const basket = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, 'ONBOARDING_SERVICES', 'Papic · Setnayan AI', 3200, 'submitted', 'PAYBILL-1')
     RETURNING order_id`,
    [F.eventId, F.buyer],
  );
  F.basketId = basket.rows[0]!.order_id;

  // Two lines: one the catalog names, one it does not (the title comes back null
  // and the page falls back to the code — never an invented name).
  await db.query(
    `INSERT INTO public.platform_retail_catalog_v2 (service_code, title, retail_price_php, saas_overhead_cost_php)
     VALUES ('PAYBILL_TEST_AI', 'Setnayan AI (test)', 2499, 0)
     ON CONFLICT (service_code) DO UPDATE SET title = EXCLUDED.title`,
  );
  await db.query(
    `INSERT INTO public.onboarding_order_items (order_id, service_code, quantity, unit_price_php)
     VALUES ($1, 'PAYBILL_TEST_AI', 1, 2499), ($1, 'PAYBILL_TEST_NO_TITLE', 2, 350.5)`,
    [F.basketId],
  );

  const plain = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, 'PAPIC_GUEST_100', 'Papic — adds 100 credits', 70, 'submitted', 'PAYBILL-2')
     RETURNING order_id`,
    [F.eventId, F.buyer],
  );
  F.plainId = plain.rows[0]!.order_id;
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('the BUYER sees every line of their own bill, with the catalog name', async () => {
  const rows = await linesAs(F.buyer, F.basketId);
  assert.equal(rows.length, 2, 'the payer cannot see what their bill covers — the 2026-10-13 fault');
  const byCode = new Map(rows.map((r) => [r.service_code, r]));
  assert.equal(byCode.get('PAYBILL_TEST_AI')?.title, 'Setnayan AI (test)');
  assert.equal(byCode.get('PAYBILL_TEST_AI')?.quantity, 1);
  assert.equal(Number(byCode.get('PAYBILL_TEST_NO_TITLE')?.unit_price_php), 350.5);
  assert.equal(byCode.get('PAYBILL_TEST_NO_TITLE')?.quantity, 2);
  assert.equal(byCode.get('PAYBILL_TEST_NO_TITLE')?.title, null, 'a missing title must not be invented');
});

test('the other half of the couple sees it too', async () => {
  const rows = await linesAs(F.partner, F.basketId);
  assert.equal(rows.length, 2);
});

test('an invited GUEST on the same event gets nothing', async () => {
  const rows = await linesAs(F.guest, F.basketId);
  assert.equal(rows.length, 0, 'a guest can read what the couple was billed');
});

test('a STRANGER gets nothing', async () => {
  const rows = await linesAs(F.stranger, F.basketId);
  assert.equal(rows.length, 0, 'a stranger can read somebody else’s bill');
});

test('a signed-out caller gets nothing', async () => {
  const rows = await linesAs(null, F.basketId);
  assert.equal(rows.length, 0);
});

test('an ordinary single-item order has no lines — the same empty answer', async () => {
  assert.equal((await linesAs(F.buyer, F.plainId)).length, 0);
});

test('the elevated server client still gets the lines', async () => {
  await setAuthUid(db, null);
  await setAuthRole('service_role');
  try {
    const r = await db.query(`SELECT * FROM public.order_basket_lines($1::uuid)`, [F.basketId]);
    assert.equal(r.rows.length, 2);
  } finally {
    await reset();
  }
});

test('🔑 the table itself is STILL unreadable by every session role', async () => {
  for (const role of ['anon', 'authenticated']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege($1, 'public.onboarding_order_items', 'SELECT') AS ok`,
      [role],
    );
    assert.equal(r.rows[0]?.ok, false, `${role} can read onboarding_order_items`);
  }
});

test('anon cannot even EXECUTE the function; authenticated can', async () => {
  const r = await db.query<{ anon: boolean; authed: boolean }>(
    `SELECT has_function_privilege('anon', 'public.order_basket_lines(uuid)', 'EXECUTE') AS anon,
            has_function_privilege('authenticated', 'public.order_basket_lines(uuid)', 'EXECUTE') AS authed`,
  );
  assert.equal(r.rows[0]?.anon, false, 'anon holds EXECUTE on the bill RPC');
  assert.equal(r.rows[0]?.authed, true, 'the payer cannot call the bill RPC — every /pay read would fail');
});
