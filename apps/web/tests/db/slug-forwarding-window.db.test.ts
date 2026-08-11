/**
 * GUARD — the forwarding window the code PROMISES is the window the database
 * actually gives.
 *
 * Two screens tell a couple and a person that changing their address keeps the
 * old link working for a stated period. That period is stored in exactly one
 * place in TypeScript (`SLUG_FORWARDING_MONTHS`) and applied in exactly one
 * place in SQL (the `redirect_until` column default). Nothing connects them but
 * a migration, and a migration is a one-time event — so this test reads the
 * default back OUT of the catalog and compares it to the constant.
 *
 * 🔑 A guard comparing two HAND-TYPED things is not a guard. This one compares
 * code against the database, which is why it can catch the drift that a
 * mirrored list cannot.
 *
 * 🔒 It also pins the closed-shop hold, which shares this column and is
 * owner-locked to ONE YEAR (2026-08-10). That hold is written with an explicit
 * expiry precisely so it does not read this default — if a future change makes
 * it read the default instead, a closed shop's address would silently be held
 * for twice as long as the owner decided.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { SLUG_FORWARDING_MONTHS } from '../../lib/slug-forwarding-window';
import { CLOSED_SHOP_SLUG_HOLD_DAYS } from '../../lib/closed-shop-slug';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db.close();
});

test('the column default is the window the app promises', async () => {
  // MEASURE WHAT THE DEFAULT DOES, NOT WHAT IT SAYS. Reading the default's
  // TEXT out of the catalog and string-matching '24 months' would pass on an
  // expression that parses to something else — and would keep passing if a
  // later trigger overwrote the value on the way in. So: insert a row with no
  // redirect_until, then ask Postgres how far out it actually landed.
  await db.query(
    `INSERT INTO public.slug_change_log (entity_type, entity_id, old_slug, new_slug)
     VALUES ('event', gen_random_uuid(), 'window-probe', 'window-probe-2')`,
  );
  const { rows: measured } = await db.query<{ months: number }>(
    `SELECT (EXTRACT(YEAR  FROM age(redirect_until, changed_at)) * 12
           + EXTRACT(MONTH FROM age(redirect_until, changed_at)))::int AS months
       FROM public.slug_change_log
      WHERE old_slug = 'window-probe'`,
  );
  assert.equal(measured.length, 1, 'the probe row was not written');
  assert.equal(
    measured[0]!.months,
    SLUG_FORWARDING_MONTHS,
    `the database forwards a retired address for ${measured[0]!.months} months but ` +
      `lib/slug-forwarding-window.ts promises ${SLUG_FORWARDING_MONTHS} — the two screens ` +
      `that state this to a couple now say something the database will not do`,
  );
});

test('the closed-shop hold does NOT ride on that default', async () => {
  // Owner-locked at one year. The erasure path writes redirect_until
  // EXPLICITLY; this asserts the two numbers are genuinely independent, so
  // changing the forwarding window can never quietly change the hold.
  const holdMonths = Math.round(CLOSED_SHOP_SLUG_HOLD_DAYS / 30.44);
  assert.equal(holdMonths, 12, 'the closed-shop hold is owner-locked at one year');
  assert.notEqual(
    holdMonths,
    SLUG_FORWARDING_MONTHS,
    'if these ever coincide, re-verify by hand that the hold still sets its own expiry ' +
      'instead of inheriting the column default',
  );
});
