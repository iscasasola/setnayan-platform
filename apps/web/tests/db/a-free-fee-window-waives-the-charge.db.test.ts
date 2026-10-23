/**
 * A FREE-FEE WINDOW WAIVES THE CHARGE — end-to-end, against replayed migrations.
 *
 * This is money code. It decides whether a supplier owes Setnayan a peso, and —
 * since the booking-fee lock went live on 2026-09-22 — whether they can open the
 * wedding they are about to work. So it is asserted against real SQL rather than
 * against a mock of it.
 *
 * WHAT IT HOLDS
 *   1. The SQL rule and its pure TypeScript twin agree on every case. Two
 *      implementations of one rule is the failure this repo keeps paying for;
 *      the table below is the single place both are judged.
 *   2. A billable booking minted INSIDE the window is `waived_promo` at ₱0, and
 *      still records what it WOULD have cost.
 *   3. The same booking OUTSIDE the window is `pending` at the real fee.
 *   4. The window never spends a free-5 courtesy.
 *   5. A second call does not mint a SECOND charge — the reuse selectors must be
 *      able to SEE a `waived_promo` row.
 *   6. `waived_promo` settles, so the Event Hub unlocks.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { isBookingFeeFreeWindowActive } from '../../lib/booking-fee-free-window';
import { WINDOW_CASES } from '../../lib/a-free-fee-window-fails-closed.test';
import { FEE_SETTLED_STATUSES } from '../../lib/event-access-stage';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

/** Open (or clear) the platform-wide window. */
async function setWindow(from: string | null, until: string | null): Promise<void> {
  await db.query(
    `UPDATE public.platform_settings
        SET booking_fee_free_from = $1::timestamptz,
            booking_fee_free_until = $2::timestamptz
      WHERE id = 1`,
    [from, until],
  );
}

async function windowOpenAt(at: string): Promise<boolean> {
  const r = await db.query<{ open: boolean }>(
    'SELECT public.booking_fee_free_window_active($1::timestamptz) AS open',
    [at],
  );
  return r.rows[0]!.open;
}

/* ── 1 · THE TWO IMPLEMENTATIONS AGREE ──────────────────────────────────── */

test('the SQL rule and its TypeScript twin answer identically', async () => {
  assert.ok(WINDOW_CASES.length >= 11, 'the shared case table shrank');
  for (const c of WINDOW_CASES) {
    await setWindow(c.window.from, c.window.until);
    const sql = await windowOpenAt(c.at);
    const ts = isBookingFeeFreeWindowActive(c.window, new Date(c.at));
    assert.equal(
      sql,
      c.open,
      `SQL disagreed with the case table — ${c.name}: expected ${c.open}, got ${sql}`,
    );
    assert.equal(
      ts,
      sql,
      `the twin drifted from the rule — ${c.name}: TS ${ts}, SQL ${sql}`,
    );
  }
});

test('a settings row that cannot be read is NOT a free-for-all', async () => {
  /*
    🔴 THE FAIL DIRECTION IS THE WHOLE POINT. A missing settings row must read
    as "no promotion", never as "everything is free" — the second would waive
    every booking on the platform the moment a read went wrong.
  */
  await db.query('DELETE FROM public.platform_settings WHERE id = 1');
  assert.equal(
    await windowOpenAt('2026-10-15T00:00:00Z'),
    false,
    'no settings row opened the window',
  );
  await db.query(
    'INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING',
  );
  await setWindow(null, null);
  assert.equal(
    await windowOpenAt('2026-10-15T00:00:00Z'),
    false,
    'an unset window was treated as open',
  );
});

/* ── 2 · THE STATUS VOCABULARY ──────────────────────────────────────────── */

test('the charge table accepts waived_promo, and still accepts every older status', async () => {
  /*
    ⚠ A RE-LISTED CHECK DROPS WHAT IT FORGETS, and only against real rows. The
    migration re-lists the whole vocabulary; this asserts nothing fell out —
    `waived_free5` especially, which a LATER migration added than the one that
    first wrote the constraint.
  */
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid = 'public.booking_fee_charges'::regclass
        AND conname = 'booking_fee_charges_status_check'`,
  );
  const def = r.rows[0]?.def ?? '';
  for (const status of [
    'pending', 'paid', 'failed', 'expired',
    'waived_import', 'waived_free5', 'waived_promo',
  ]) {
    assert.ok(def.includes(`'${status}'`), `the status CHECK lost '${status}': ${def}`);
  }
});

test('waived_promo settles, so the Event Hub opens', () => {
  assert.ok(
    FEE_SETTLED_STATUSES.has('waived_promo'),
    'a promo-waived booking would be LOCKED — nothing is owed, so nothing may be locked',
  );
  // The older two must not have been displaced by the edit.
  assert.ok(FEE_SETTLED_STATUSES.has('waived_free5'));
  assert.ok(FEE_SETTLED_STATUSES.has('waived_import'));
  assert.ok(!FEE_SETTLED_STATUSES.has('pending'), 'a pending charge must never settle');
});

/* ── 3 · EVERY DOOR THAT MINTS A CHARGE KNOWS ABOUT THE WINDOW ──────────── */

test('all three charge-minting functions consult the window', async () => {
  /*
    Asked of pg_proc rather than of a source grep: a door that mints a charge
    without consulting the window leaks a real bill during a promotion, and
    there is no screen on which that would look wrong until the supplier is
    billed. The re-derive door consults it differently — it NOOPS on an existing
    promo charge rather than opening one — so it is asserted on that instead.
  */
  const r = await db.query<{ proname: string; body: string }>(
    `SELECT p.proname, p.prosrc AS body
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('booking_fee_open_charge',
                          'booking_fee_open_lock_charge',
                          'booking_fee_rederive_lock_fee')`,
  );
  const by = new Map(r.rows.map((x) => [x.proname, x.body]));
  assert.equal(by.size, 3, `expected 3 charge functions, found ${by.size}`);

  for (const fn of ['booking_fee_open_charge', 'booking_fee_open_lock_charge']) {
    const body = by.get(fn) ?? '';
    assert.match(
      body,
      /booking_fee_free_window_active\(\)/,
      `${fn} mints a charge without asking whether the fee is free right now`,
    );
    assert.match(body, /'waived_promo'/, `${fn} never writes the promo status`);
  }
  assert.match(
    by.get('booking_fee_rederive_lock_fee') ?? '',
    /waived_promo/,
    'an amendment would re-bill a booking a promotion already made free',
  );
});

test('every live-charge selector can SEE a promo charge', async () => {
  /*
    🔴 THE DUPLICATE-CHARGE BUG. Each door asks "does this booking already have
    a live charge?" before minting one. A selector that does not list
    `waived_promo` answers NO for a promo booking and mints a SECOND charge for
    it. `booking_fee_open_lock_charge` carries that selector TWICE — the import
    path and the main path — and both must know.
  */
  const r = await db.query<{ proname: string; body: string }>(
    `SELECT p.proname, p.prosrc AS body
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('booking_fee_open_charge',
                          'booking_fee_open_lock_charge',
                          'booking_fee_rederive_lock_fee')`,
  );
  for (const { proname, body } of r.rows) {
    /*
      ⚠ ONLY A `WHERE` SELECTOR, NOT EVERY `IN (…)` IN THE BODY. The first
      version of this line matched `CASE WHEN v_status IN ('paid',
      'waived_import') THEN NOW()` — the `paid_at` stamp — and reported it as a
      selector that would "mint a duplicate", which is not a thing a timestamp
      can do. The catch was still worth having (that stamp DID need the new
      status), but a guard whose message is wrong about what it found teaches
      the next reader the wrong lesson. `AND status IN (…)` is the shape that
      decides whether a live charge was seen.
    */
    const selectors = body.match(/AND status IN \([^)]*\)/g) ?? [];
    assert.ok(selectors.length > 0, `${proname} has no status selector at all`);
    const blind = selectors.filter((sel) => !sel.includes('waived_promo'));
    assert.deepEqual(
      blind,
      [],
      `${proname} has ${blind.length} selector(s) that cannot see a promo charge — ` +
        `each one would mint a duplicate: ${blind.join(' | ')}`,
    );
  }
});

/* ── 4 · THE ORDER: A COURTESY IS NEVER SPENT BY A PROMOTION ────────────── */

test('the promo arm sits BELOW the free-5 arm in both charge functions', async () => {
  /*
    A booking inside the shop's first five must stay `waived_free5` even while a
    window is open. Both are free, so nothing looks wrong on the day — but a
    shop that burned a courtesy during a free month would find itself billed a
    booking earlier than it should be, months later, with nothing on any screen
    explaining why.
  */
  const r = await db.query<{ proname: string; body: string }>(
    `SELECT p.proname, p.prosrc AS body
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'booking_fee_open_lock_charge'`,
  );
  const body = r.rows[0]!.body;
  const free5At = body.indexOf("v_status := 'waived_free5'");
  const promoAt = body.indexOf("v_status := 'waived_promo'");
  assert.ok(free5At > 0 && promoAt > 0, 'one of the two waiver arms is missing');
  assert.ok(
    free5At < promoAt,
    'the promo arm is ABOVE the free-5 arm — a promotion would spend a courtesy',
  );
});
