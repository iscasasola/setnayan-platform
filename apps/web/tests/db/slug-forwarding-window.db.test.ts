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
import { RETIRED_SLUG_HOLD_MONTHS } from '../../lib/closed-shop-slug';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(import.meta.dirname, '../..');

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

test('the retirement holds set their OWN expiry, not the column default', () => {
  // ⚠ THIS TEST USED TO ASSERT THE TWO NUMBERS DIFFERED — "if these ever
  // coincide, re-verify by hand that the hold still sets its own expiry". Owner
  // 2026-08-12 made them coincide ("make it 2 years"), so that check has fired
  // and has been honoured: re-verified, and replaced with the property it was
  // only ever a proxy for.
  //
  // 🔑 THE REAL RISK is a retirement path silently starting to INHERIT the
  // column default. Today that would be invisible — the numbers match — and if
  // the forwarding window is ever changed alone, every held address would move
  // with it without anyone deciding that. So assert the write, not the number.
  // The closed-SHOP hold is written in app code and must set its own expiry.
  const shop = readFileSync(join(WEB, 'lib/erasure/purge.ts'), 'utf8');
  assert.match(
    shop,
    /redirect_until:\s*closedShopSlugHeldUntil\(\)/,
    'lib/erasure/purge.ts (a closed shop) no longer sets redirect_until explicitly — the ' +
      "hold would silently inherit the forwarding window's default and move with it",
  );

  // ⚠ THE DELETED-WEDDING HOLD IS NO LONGER APP CODE. It moved into a BEFORE
  // DELETE trigger (migration 20271138150255) because prod's own RLS lets a
  // couple delete their wedding with no server action running — an app-side
  // hold covered the admin path only. So the explicit-expiry property is
  // asserted where it now lives: in the migration.
  const migrations = join(WEB, '../../supabase/migrations');
  const trigger = readdirSync(migrations)
    .filter((f) => f.startsWith('20271138150255'))
    .map((f) => readFileSync(join(migrations, f), 'utf8'))[0];
  assert.ok(trigger, 'the trigger migration is missing');
  assert.match(
    trigger!,
    /now\(\)\s*\+\s*'24 months'::interval/,
    'the deleted-wedding trigger no longer sets its own expiry — it would inherit the ' +
      'column default and move with any future change to the forwarding window',
  );

  assert.equal(
    RETIRED_SLUG_HOLD_MONTHS,
    SLUG_FORWARDING_MONTHS,
    'owner 2026-08-12: a retired address is held for the same span a renamed one forwards',
  );
});
