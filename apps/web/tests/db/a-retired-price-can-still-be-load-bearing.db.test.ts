/**
 * THE EIGHT RETIRED PRICES THAT MUST SURVIVE THE DELETE — AND STILL CARRY A PRICE.
 *
 * The owner ruled 2026-08-28, of the 43 switched-off prices: "delete them."
 * Migration `the_catalogue_forgets_what_it_retired` removes 35. Eight stay,
 * because application code reads them by literal string with no `is_active`
 * filter and falls back to a hardcoded constant if the row is gone — so
 * deleting one moves no number today and silently takes the price out of the
 * owner's reach forever.
 *
 * ── WHAT THIS FILE CAN PROVE, AND WHAT IT CANNOT ─────────────────────────────
 * ⚠ THE REPLAY CANNOT PROVE THE DELETION, AND PRETENDING OTHERWISE WOULD MAKE
 * THIS GUARD VACUOUS. Measured 2026-08-29: production holds 68 catalogue rows
 * (43 retired); the PGlite replay holds 33 (9 retired). Most of the 43 were
 * created by an ADMIN ON THE PRICING SCREEN and exist only in production, so
 * asserting "the 35 are gone" here would pass against rows that were never
 * there. That half was proved instead by running the migration's own statements
 * against PRODUCTION inside a rolled-back transaction — 1 activation + 35
 * catalogue rows, no foreign key refused it, exactly these 8 left — and the
 * transcript is in the PR body.
 *
 * What the replay CAN prove, and what this file asserts:
 *   1. all eight locked codes still exist after every migration has run;
 *   2. each still carries a usable price (the thing the code reads);
 *   3. the four camera rates equal the hardcoded fallbacks that stand in for
 *      them — a pair NOTHING else checks, because
 *      `fallback-prices-match-the-catalog.db.test.ts` explicitly EXEMPTS
 *      `papic-cameras.ts` from its automatic pairing ("many constants, mostly
 *      retired rungs"). The AI half is already covered by
 *      `ai-tier-ladder-matches-the-catalog.db.test.ts`; this closes the other.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAPIC_CAMERAS = join(HERE, '../../lib/papic-cameras.ts');

/** Every code the delete migration deliberately spares. */
const LOCKED = [
  'SETNAYAN_AI_B',
  'SETNAYAN_AI_C',
  'SETNAYAN_AI_D',
  'SETNAYAN_AI_RENEW',
  'PAPIC_CAMERA_ROLL_DAY',
  'PAPIC_CAMERA_MINI_DAY',
  'PAPIC_CAMERA_LTD_DAY',
  'PAPIC_CAMERA_UNLIMITED_DAY',
] as const;

/**
 * The camera rate SKU -> its hardcoded stand-in, READ OUT OF THE SOURCE rather
 * than re-typed here. Re-typing would make this file a third copy of a price,
 * which is the very defect the fallback guards exist to catch.
 */
function cameraFallbacks(): Array<{ sku: string; php: number }> {
  const src = readFileSync(PAPIC_CAMERAS, 'utf8');
  const rungs = ['ROLL', 'MINI', 'LTD', 'UNLIMITED'];
  return rungs.map((rung) => {
    const sku = new RegExp(`export const PAPIC_CAMERA_${rung}_SKU = '([^']+)';`).exec(src);
    const php = new RegExp(`export const PAPIC_CAMERA_${rung}_FALLBACK_PHP = (\\d+);`).exec(src);
    assert.ok(sku, `PAPIC_CAMERA_${rung}_SKU literal not found — the scan is blind`);
    assert.ok(php, `PAPIC_CAMERA_${rung}_FALLBACK_PHP literal not found — the scan is blind`);
    return { sku: sku[1]!, php: Number(php[1]) };
  });
}

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('the replay actually holds a catalogue — this guard is not vacuous', async () => {
  const { rows } = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.platform_retail_catalog_v2`,
  );
  assert.ok(Number(rows[0]!.n) > 0, 'no catalogue rows replayed — every assertion below is empty');
});

test('all eight locked prices survive every migration', async () => {
  const { rows } = await db.query<{ service_code: string }>(
    `SELECT service_code FROM public.platform_retail_catalog_v2 WHERE service_code = ANY($1)`,
    [LOCKED as unknown as string[]],
  );
  const found = new Set(rows.map((r) => r.service_code));
  for (const code of LOCKED) {
    assert.ok(found.has(code), `${code} was deleted — the app reads its price by name`);
  }
});

test('each locked price is still a usable number, not a hole', async () => {
  // A surviving row carrying NULL or 0 would read as "no price" to the callers
  // that skip is_active — the same outcome as deleting it, one step later.
  for (const code of LOCKED) {
    const { rows } = await db.query<{ retail_price_php: string | null }>(
      `SELECT retail_price_php FROM public.platform_retail_catalog_v2 WHERE service_code = $1`,
      [code],
    );
    assert.equal(rows.length, 1, `${code} missing`);
    const php = Number(rows[0]!.retail_price_php);
    assert.ok(Number.isFinite(php) && php > 0, `${code} has no usable price (${rows[0]!.retail_price_php})`);
  }
});

test('the camera rates match the constants that stand in for them', async () => {
  const pairs = cameraFallbacks();
  assert.equal(pairs.length, 4, 'the camera fallback scan should find four rungs');
  for (const { sku, php } of pairs) {
    // Deliberately NOT filtered on is_active: these rows are retired BY DESIGN,
    // and `fetchCameraRates` reads them exactly this way.
    const { rows } = await db.query<{ retail_price_php: string }>(
      `SELECT retail_price_php FROM public.platform_retail_catalog_v2 WHERE service_code = $1`,
      [sku],
    );
    assert.equal(rows.length, 1, `${sku} has no catalogue row to compare against`);
    assert.equal(
      Number(rows[0]!.retail_price_php),
      php,
      `${sku} costs ${rows[0]!.retail_price_php} but the code substitutes ${php} when the row is unreadable`,
    );
  }
});
