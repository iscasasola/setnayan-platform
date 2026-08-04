/**
 * GUESTS CAN BUY PAPIC — the schema half (owner-locked 2026-07-29).
 * End-to-end (test:db, every migration replayed into PGlite).
 *
 * Migration 20271019639608 does two things, and each has a way of going wrong
 * that no unit test can see:
 *
 *   1. It makes `orders.user_id` / `payments.user_id` / `receipts.user_id`
 *      NULLABLE, so an order can exist with no account behind it. THE RISK: a
 *      NULL-user order becoming visible or writable to a session role. It must
 *      not, and the reason is subtle — `user_id = auth.uid()` against NULL is
 *      NULL, which is not TRUE — so it is asserted here rather than reasoned
 *      about in a comment.
 *   2. It adds `public.papic_guest_orders`. THE RISK is the documented root
 *      cause of a past 368-table exposure: every new table in `public` ships
 *      OPEN, because the platform default ACL grants `arwdDxtm` to anon +
 *      authenticated. A missing REVOKE is invisible in review and total in
 *      effect.
 *
 * ── ⚠ WHY THIS SUITE IS NOT VACUOUS ────────────────────────────────────────
 * This repo has twice shipped DB tests that passed for the WRONG REASON,
 * because the connection OWNED the table (Postgres skips RLS and, for a
 * superuser, privilege checks for owners). So, mirroring
 * orders-payments-insert-revoke.db.test.ts:
 *
 *   • META runs FIRST — current_user really is 'authenticated', it does not own
 *     the tables, and it holds neither BYPASSRLS nor SUPERUSER.
 *   • POSITIVE CONTROL — the same session reads its OWN order successfully, so
 *     a denial below cannot be "the harness is broken".
 *   • DIFFERENTIAL CONTROL — everything denied to `authenticated` is re-run as
 *     `service_role` and asserted to SUCCEED, attributing the denial to the
 *     REVOKE and not to a typo or a CHECK.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let buyerUid: string;
/** A signed-in account with NO relationship to the event. */
let strangerUid: string;
let eventId: string;
let seatId: string;
/** An order minted the sanctioned way, owned by buyerUid. */
let ownedOrderId: string;
/** An order with NO account behind it — the thing this migration makes possible. */
let guestOrderId: string;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

async function asAuthenticated(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, buyerUid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}

/** A signed-in account that is neither the buyer nor a member of the event. */
async function asStranger(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, strangerUid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}

async function asAnon(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole('anon');
  await db.exec(`SET ROLE anon`);
}

async function asService(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole('service_role');
  await db.exec(`SET ROLE service_role`);
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

async function tryQuery(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return (e as Error).message ?? String(e);
  }
}

let refSeq = 0;
let tokSeq = 0;
/** 'SNG' + a zero-padded counter — the real reference_code shape, and UNIQUE. */
const nextRef = () => 'SNG' + (refSeq++).toString().padStart(6, '0');
/** >= 24 chars (the DB CHECK) and unique per call. */
const nextToken = () => 'GT' + 'A'.repeat(24) + (tokSeq++).toString().padStart(4, '0');

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ('papic-guest-buy@example.com') RETURNING id`,
  );
  buyerUid = u.rows[0]!.id;

  const stranger = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ('papic-guest-stranger@example.com') RETURNING id`,
  );
  strangerUid = stranger.rows[0]!.id;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Guest-buy Event', 'birthday') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
    [eventId, buyerUid],
  );

  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token)
     VALUES ($1, 900, 'PAPIC_CAMERA_MINI_DAY', 'guest-buy-token-1') RETURNING seat_id`,
    [eventId],
  );
  seatId = seat.rows[0]!.seat_id;

  await asService();
  const owned = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, 'PAPIC_GUEST', 'Owned order', 1000, 'submitted', $3)
     RETURNING order_id`,
    [eventId, buyerUid, nextRef()],
  );
  ownedOrderId = owned.rows[0]!.order_id;

  const guest = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, NULL, 'PAPIC_GUEST', 'Papic Pool — guest top-up', 1000, 'submitted', $2)
     RETURNING order_id`,
    [eventId, nextRef()],
  );
  guestOrderId = guest.rows[0]!.order_id;

  await db.query(
    `INSERT INTO public.papic_guest_orders
       (order_id, event_id, seat_id, purchase_kind, service_code, points, access_token)
     VALUES ($1, $2, $3, 'pool_topup', 'PAPIC_GUEST', 3000, $4)`,
    [guestOrderId, eventId, seatId, nextToken()],
  );

  await reset();
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

/* ── META — the suite can actually prove something ─────────────────────────── */

test('META: the session really is an unprivileged `authenticated`', async () => {
  await asAuthenticated();
  const who = await db.query<{ current_user: string }>(`SELECT current_user`);
  assert.equal(who.rows[0]!.current_user, 'authenticated');

  const priv = await db.query<{ rolbypassrls: boolean; rolsuper: boolean }>(
    `SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user`,
  );
  assert.equal(priv.rows[0]!.rolbypassrls, false, 'the role bypasses RLS — every denial is fake');
  assert.equal(priv.rows[0]!.rolsuper, false, 'the role is superuser — every denial is fake');

  const owns = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('orders', 'payments', 'papic_guest_orders')
        AND pg_get_userbyid(c.relowner) = current_user`,
  );
  assert.equal(owns.rows[0]!.n, 0, 'the role OWNS a table under test — RLS is skipped for owners');
  await reset();
});

test('POSITIVE CONTROL: the same session reads its OWN order', async () => {
  await asAuthenticated();
  const r = await db.query<{ order_id: string }>(
    `SELECT order_id FROM public.orders WHERE order_id = $1`,
    [ownedOrderId],
  );
  assert.equal(r.rows.length, 1, 'the RLS/JWT wiring is broken — denials below prove nothing');
  await reset();
});

/* ── 1 · a NULL-user order is INVISIBLE to every session role ──────────────── */

test('⭐ an account-less order is unreadable by an UNRELATED signed-in account', async () => {
  // `orders_owner_read` (20270920030000) reads
  //     user_id = auth.uid()
  //     OR event_id IN current_couple_or_coordinator_event_ids()
  //     OR is_admin()
  // A NULL user_id makes the FIRST arm NULL — not TRUE — so nulling the column
  // grants nobody anything. What is left is the event arm, which is scoped to
  // that event's host/coordinator. A stranger matches no arm.
  await asStranger();
  const r = await db.query(`SELECT order_id FROM public.orders WHERE order_id = $1`, [
    guestOrderId,
  ]);
  assert.equal(r.rows.length, 0, 'a guest order leaked to an unrelated signed-in account');
  await reset();
});

test('the HOST of the event does see their guests\' orders — host visibility, unchanged', async () => {
  // Owner-locked 2026-07-29: "the host is NOTIFIED, not asked". This is the
  // shipped `orders_owner_read` event arm doing that job with no new policy —
  // which is WHY no new policy was written. Pinned so a future narrowing of
  // that arm cannot silently take host visibility away.
  await asAuthenticated(); // buyerUid is a `couple` member of this event
  const r = await db.query(`SELECT order_id FROM public.orders WHERE order_id = $1`, [
    guestOrderId,
  ]);
  assert.equal(r.rows.length, 1, 'the host can no longer see a guest purchase on their own event');
  await reset();
});

test('⭐ an account-less order is unreadable by `anon`', async () => {
  // STRENGTHENED by 20271032407062 (stale-anon-grant revoke, batch 2). This used
  // to assert `rows.length === 0` — anon reached the table and RLS returned
  // nothing. anon now holds no privilege on `public.orders` at all, so the read
  // is refused one layer earlier and never reaches RLS. An empty read and a
  // denied read are the same VALUE but not the same guarantee: the denial is the
  // stronger one, because it does not depend on the policy set staying correct.
  await asAnon();
  const err = await tryQuery(`SELECT order_id FROM public.orders WHERE order_id = $1`, [
    guestOrderId,
  ]);
  assert.ok(err, 'anon can still reach public.orders — the batch-2 revoke did not land');
  assert.match(
    String(err),
    /permission denied/i,
    `anon was refused, but not by the privilege layer: ${err}`,
  );
  await reset();
});

test('DIFFERENTIAL: service_role DOES see the account-less order', async () => {
  // Without this, the two denials above could be "the row does not exist".
  await asService();
  const r = await db.query(`SELECT order_id FROM public.orders WHERE order_id = $1`, [
    guestOrderId,
  ]);
  assert.equal(r.rows.length, 1, 'the admin queue could not see a guest order — it must');
  await reset();
});

test('a session role still cannot claim an account-less order by UPDATE', async () => {
  await asAuthenticated();
  const r = await db.query(
    `UPDATE public.orders SET user_id = $1 WHERE order_id = $2 RETURNING order_id`,
    [buyerUid, guestOrderId],
  );
  assert.equal(r.rows.length, 0, 'a signed-in user adopted a guest order');
  await reset();
});

/* ── 2 · SEC-4b is untouched ───────────────────────────────────────────────── */

test('SEC-4b holds: no session role may INSERT an order — including a NULL-user one', async () => {
  for (const impersonate of [asAuthenticated, asAnon]) {
    await impersonate();
    const err = await tryQuery(
      `INSERT INTO public.orders
         (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
       VALUES ($1, NULL, 'PAPIC_GUEST', 'forged guest order', 1, 'submitted', $2)`,
      [eventId, nextRef()],
    );
    assert.ok(err, 'a session role minted an account-less order — nullable user_id became a hole');
    await reset();
  }
});

/* ── 3 · the new table ships CLOSED ────────────────────────────────────────── */

test('⭐ papic_guest_orders grants NOTHING to anon or authenticated', async () => {
  // The 368-table exposure in one assertion: `public` tables ship OPEN unless a
  // migration says otherwise, and a missing REVOKE reads identically to a
  // present one in a diff.
  await reset();
  const r = await db.query<{ role: string; priv: string }>(
    `SELECT r.rolname AS role, p AS priv
       FROM unnest(ARRAY['anon','authenticated']) AS role_name
       JOIN pg_roles r ON r.rolname = role_name
       CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS p
      WHERE has_table_privilege(r.rolname, 'public.papic_guest_orders', p)`,
  );
  assert.deepEqual(
    r.rows,
    [],
    'anon/authenticated hold privileges on papic_guest_orders — add REVOKE ALL to the migration',
  );
});

test('papic_guest_orders has RLS enabled and no policies', async () => {
  const r = await db.query<{ relrowsecurity: boolean; policies: number }>(
    `SELECT c.relrowsecurity,
            (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'papic_guest_orders'`,
  );
  assert.equal(r.rows.length, 1, 'papic_guest_orders does not exist');
  assert.equal(r.rows[0]!.relrowsecurity, true, 'RLS is off');
  assert.equal(
    r.rows[0]!.policies,
    0,
    'a policy appeared — this table is service-role only; a policy implies a session-role reader',
  );
});

test('DIFFERENTIAL: service_role CAN read papic_guest_orders', async () => {
  await asService();
  const r = await db.query(
    `SELECT order_id FROM public.papic_guest_orders WHERE order_id = $1`,
    [guestOrderId],
  );
  assert.equal(r.rows.length, 1, 'the server cannot read its own provenance table');
  await reset();
});

/* ── 4 · the CHECKs that replace `user_id NOT NULL` ────────────────────────── */

test('⭐ a guest order row with NEITHER owner axis is REJECTED', async () => {
  // The owner axis IS the replacement for the dropped NOT NULL. An order nobody
  // can be shown to have placed must not be representable.
  await asService();
  const orphan = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, NULL, 'PAPIC_GUEST', 'orphan', 1000, 'submitted', $2) RETURNING order_id`,
    [eventId, nextRef()],
  );
  const err = await tryQuery(
    `INSERT INTO public.papic_guest_orders
       (order_id, event_id, seat_id, guest_id, purchase_kind, service_code, points, access_token)
     VALUES ($1, $2, NULL, NULL, 'pool_topup', 'PAPIC_GUEST', 3000, $3)`,
    [orphan.rows[0]!.order_id, eventId, nextToken()],
  );
  assert.ok(err, 'a guest order with no owner was accepted');
  assert.match(String(err), /owner_axis/i, `unexpected rejection reason: ${err}`);
  await reset();
});

test('⭐ a One RELOAD without a camera is REJECTED', async () => {
  // "Reload, but we don't know which camera" is an order the approval hook
  // could not fulfil — so it must not exist.
  await asService();
  const o = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, NULL, 'PAPIC_ONE_100', 'reload', 100, 'submitted', $2) RETURNING order_id`,
    [eventId, nextRef()],
  );
  const guestRow = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Tita', 'Baby', 'both', 'family') RETURNING guest_id`,
    [eventId],
  );
  const err = await tryQuery(
    `INSERT INTO public.papic_guest_orders
       (order_id, event_id, seat_id, guest_id, purchase_kind, service_code, points, access_token)
     VALUES ($1, $2, NULL, $3, 'one_reload', 'PAPIC_ONE_100', 100, $4)`,
    [o.rows[0]!.order_id, eventId, guestRow.rows[0]!.guest_id, nextToken()],
  );
  assert.ok(err, 'a camera-less reload was accepted');
  assert.match(String(err), /reload_needs_seat/i, `unexpected rejection reason: ${err}`);
  await reset();
});

test('a short access token is REJECTED — the bearer capability must be unguessable', async () => {
  await asService();
  const o = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, NULL, 'PAPIC_GUEST', 'short token', 1000, 'submitted', $2) RETURNING order_id`,
    [eventId, nextRef()],
  );
  const err = await tryQuery(
    `INSERT INTO public.papic_guest_orders
       (order_id, event_id, seat_id, purchase_kind, service_code, points, access_token)
     VALUES ($1, $2, $3, 'pool_topup', 'PAPIC_GUEST', 3000, 'short')`,
    [o.rows[0]!.order_id, eventId, seatId],
  );
  assert.ok(err, 'a 5-character bearer token was accepted');
  assert.match(String(err), /access_token_len/i, `unexpected rejection reason: ${err}`);
  await reset();
});

test('an unknown purchase_kind is REJECTED', async () => {
  await asService();
  const o = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, NULL, 'PAPIC_GUEST', 'bad kind', 1000, 'submitted', $2) RETURNING order_id`,
    [eventId, nextRef()],
  );
  const err = await tryQuery(
    `INSERT INTO public.papic_guest_orders
       (order_id, event_id, seat_id, purchase_kind, service_code, points, access_token)
     VALUES ($1, $2, $3, 'free_grant', 'PAPIC_GUEST', 3000, $4)`,
    [o.rows[0]!.order_id, eventId, seatId, nextToken()],
  );
  assert.ok(err, 'an invented purchase_kind was accepted');
  await reset();
});

test('the access token is UNIQUE — one token can never address two orders', async () => {
  await asService();
  const dupToken = nextToken();
  const o1 = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, NULL, 'PAPIC_GUEST', 'dup 1', 1000, 'submitted', $2) RETURNING order_id`,
    [eventId, nextRef()],
  );
  const o2 = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, NULL, 'PAPIC_GUEST', 'dup 2', 1000, 'submitted', $2) RETURNING order_id`,
    [eventId, nextRef()],
  );
  const ok = await tryQuery(
    `INSERT INTO public.papic_guest_orders
       (order_id, event_id, seat_id, purchase_kind, service_code, points, access_token)
     VALUES ($1, $2, $3, 'pool_topup', 'PAPIC_GUEST', 3000, $4)`,
    [o1.rows[0]!.order_id, eventId, seatId, dupToken],
  );
  assert.equal(ok, null, `the first insert should have succeeded: ${ok}`);
  const err = await tryQuery(
    `INSERT INTO public.papic_guest_orders
       (order_id, event_id, seat_id, purchase_kind, service_code, points, access_token)
     VALUES ($1, $2, $3, 'pool_topup', 'PAPIC_GUEST', 3000, $4)`,
    [o2.rows[0]!.order_id, eventId, seatId, dupToken],
  );
  assert.ok(err, 'two orders share one bearer token');
  await reset();
});

/* ── 5 · payments + receipts follow ────────────────────────────────────────── */

test('a payment and a receipt can exist for an account-less order', async () => {
  // The whole reason a guest order rides the ORDINARY spine: it must reach
  // /admin/payments and produce the receipt artifact like any other order.
  await asService();
  const payErr = await tryQuery(
    `INSERT INTO public.payments (order_id, user_id, amount_php, channel, paid_at)
     VALUES ($1, NULL, 1000, 'gcash', CURRENT_DATE)`,
    [guestOrderId],
  );
  assert.equal(payErr, null, `an account-less payment was rejected: ${payErr}`);

  const recErr = await tryQuery(
    `INSERT INTO public.receipts
       (order_id, user_id, issued_to_email, issued_to_name,
        pre_vat_php, vat_amount_php, gross_total_php)
     VALUES ($1, NULL, 'unknown@setnayan.com', 'Guest of Guest-buy Event',
             892.86, 107.14, 1000.00)`,
    [guestOrderId],
  );
  assert.equal(recErr, null, `an account-less receipt was rejected: ${recErr}`);
  await reset();
});

test('⭐ an account-less payment is unreadable by every session role', async () => {
  // `payments_owner_read` has ONLY the user_id arm — no event arm — so a guest
  // payment is invisible even to the host, who sees the ORDER but not the
  // payer's uploaded proof. That asymmetry is deliberate and worth pinning: the
  // screenshot is a stranger's bank receipt, and the host has no business in it.
  //
  // The `anon` arm is split out since 20271032407062 (stale-anon-grant revoke,
  // batch 2): anon no longer holds ANY privilege on `public.payments`, so its
  // read is refused by the privilege layer before RLS is consulted. Same
  // conclusion, one layer earlier, and it no longer rests on the policy set.
  for (const impersonate of [asAuthenticated, asStranger]) {
    await impersonate();
    const r = await db.query(`SELECT payment_id FROM public.payments WHERE order_id = $1`, [
      guestOrderId,
    ]);
    assert.equal(r.rows.length, 0, 'a guest payment leaked to a session role');
    await reset();
  }

  await asAnon();
  const err = await tryQuery(`SELECT payment_id FROM public.payments WHERE order_id = $1`, [
    guestOrderId,
  ]);
  assert.ok(err, 'anon can still reach public.payments — the batch-2 revoke did not land');
  assert.match(
    String(err),
    /permission denied/i,
    `anon was refused, but not by the privilege layer: ${err}`,
  );
  await reset();
});

/* ── 6 · NEUTRALISATION — the closure is the REVOKE, not luck ──────────────── */

test('⭐ NEUTRALISATION: a table in `public` really does ship OPEN here', async () => {
  // Without this, "anon holds nothing on papic_guest_orders" could be true
  // because the harness never grants anything to anyone — and the suite would
  // be proving nothing at all. This asserts the harness reproduces the
  // production default ACL (ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES),
  // which is the 368-table exposure's root cause, so the emptiness above is
  // attributable to the migration's REVOKE.
  await reset();
  await db.exec(`BEGIN`);
  try {
    await db.exec(`CREATE TABLE public.papic_guest_orders_acl_probe (id int)`);
    const r = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM unnest(ARRAY['anon','authenticated']) AS role_name
        WHERE has_table_privilege(role_name, 'public.papic_guest_orders_acl_probe', 'SELECT')`,
    );
    assert.equal(
      r.rows[0]!.n,
      2,
      'a fresh public table did NOT ship open in this harness — the REVOKE assertions above are vacuous',
    );
  } finally {
    await db.exec(`ROLLBACK`);
  }
});

test('NEUTRALISATION: re-granting SELECT would immediately expose the table', async () => {
  // The other direction: if the deny above came from something other than the
  // ACL, this grant would not change the outcome. It does — so the ACL is the
  // control, and a stray future `GRANT` re-opens it.
  await reset();
  await db.exec(`BEGIN`);
  try {
    await db.exec(`GRANT SELECT ON public.papic_guest_orders TO anon`);
    const granted = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege('anon', 'public.papic_guest_orders', 'SELECT') AS ok`,
    );
    assert.equal(granted.rows[0]!.ok, true, 'the fix has become a no-op');
  } finally {
    await db.exec(`ROLLBACK`);
  }
  const after = await db.query<{ ok: boolean }>(
    `SELECT has_table_privilege('anon', 'public.papic_guest_orders', 'SELECT') AS ok`,
  );
  assert.equal(after.rows[0]!.ok, false, 'the rollback did not restore the closed state');
});
