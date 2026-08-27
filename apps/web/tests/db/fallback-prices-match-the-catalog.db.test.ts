/**
 * NO HARDCODED FALLBACK MAY DISAGREE WITH ITS CATALOG ROW.
 *
 * 🚨 THE SHAPE THIS EXISTS TO STOP, FOUND THREE TIMES IN ONE DAY (2026-08-27).
 * Every price in this product is admin-managed in `vendor_billing_catalog` /
 * `platform_retail_catalog_v2`, and almost every reader carries a hardcoded
 * literal it substitutes when the row is missing, inactive or unreadable. That
 * literal is a SECOND COPY of the price, and a second copy is a second place for
 * it to be wrong:
 *
 *   · `CUSTOM_UNIT_PRICE_FALLBACK.base` stayed ₱8,999 while the catalog row went
 *     to ₱11,000 to sit above a raised Enterprise. One failed read would have put
 *     a whole tier back BELOW the tier beneath it — through a door no
 *     catalog-only check can see.
 *   · `BRANCH_FEE_PHP` stayed ₱999 while its row went to ₱1,000.
 *   · `VENDOR_3D_BOOTH_FALLBACK_PHP` stayed ₱1,500 while its row went to ₱2,500.
 *
 * None of the three throws. None logs. The catalog reads correct the whole time.
 * The only symptom is a customer charged yesterday's price.
 *
 * ── WHY IT IS DERIVED AND NOT A LIST ───────────────────────────────────────
 * A hand-written registry is a list of the constants somebody thought of, and
 * the whole point is to catch the NEXT one. So the pairs are SCANNED out of
 * `lib/`: a file exporting exactly one `*_FALLBACK_PHP` / `*_FEE_PHP` and
 * exactly one `*_SKU_CODE` / `*_SKU` is paired automatically, and its literal is
 * compared to the live row.
 *
 * ⛔ AND A FILE THIS CANNOT PAIR IS A FAILURE, NEVER A SKIP. Ambiguous files
 * (several constants of either kind, or a fee that is not a catalog price at
 * all) must be named in UNPAIRED below WITH A REASON. A new unlisted file fails
 * the build and forces the choice to be made out loud — because "silently
 * skipped" is how a guard quietly stops covering the thing it was written for.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  CUSTOM_SKU_CODES,
  CUSTOM_UNIT_PRICE_FALLBACK,
} from '../../lib/vendor-custom-catalog';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIB = join(HERE, '../../lib');

/**
 * Files that declare a peso fallback the scan CANNOT pair, each with the reason
 * it is exempt. Keeping the reason next to the name is the point: a bare
 * allow-list is a bill nobody re-reads.
 */
const UNPAIRED: Record<string, string> = {
  // Two fallbacks (intro + renewal) and no SKU constant in the file — the codes
  // live in setnayan-ai-event-pricing.ts. The renewal figure is under separate
  // investigation (it disagrees with the live SETNAYAN_AI row by a wide margin)
  // and pairing it here would assert an answer nobody has established yet.
  'setnayan-ai-pricing.ts': 'two fallbacks, no SKU constant; renewal price under investigation',
  // SETNAYAN_PAY_MIN_FEE_PHP is a floor on a computed platform fee, not the
  // price of any catalog row. There is nothing to compare it to.
  'vendor-earnings.ts': 'a fee floor, not a catalog price',
  // Seven fallbacks and six SKU constants, most of them retired rungs kept for
  // lineage. Pairing them needs per-rung judgement about which are live, which
  // the Papic ladder guards already make.
  'papic-cameras.ts': 'many constants, mostly retired rungs — covered by the Papic ladder guards',
};

type Pair = { file: string; constName: string; php: number; sku: string };

/** Scan `lib/` and pair each fallback literal with the SKU code beside it. */
function scanPairs(): { pairs: Pair[]; unpairable: string[] } {
  const FALLBACK = /^export const ([A-Z0-9_]*(?:FALLBACK_PHP|FEE_PHP)) = (\d+);/gm;
  const SKU = /^export const [A-Z0-9_]*(?:SKU_CODE|SKU) = '([^']+)';/gm;

  const pairs: Pair[] = [];
  const unpairable: string[] = [];

  for (const file of readdirSync(LIB)) {
    if (!file.endsWith('.ts') || file.includes('.test.')) continue;
    const src = readFileSync(join(LIB, file), 'utf8');
    const fallbacks = [...src.matchAll(FALLBACK)];
    if (fallbacks.length === 0) continue;
    const skus = [...src.matchAll(SKU)];

    if (fallbacks.length === 1 && skus.length === 1) {
      pairs.push({
        file,
        constName: fallbacks[0]![1]!,
        php: Number(fallbacks[0]![2]),
        sku: skus[0]![1]!,
      });
    } else {
      unpairable.push(file);
    }
  }
  return { pairs, unpairable };
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

/** Live price for a code, from whichever catalog holds it. `null` = no ACTIVE row. */
async function livePrice(code: string): Promise<number | null> {
  const v = await db.query<{ price_php: string }>(
    `SELECT price_php FROM public.vendor_billing_catalog WHERE sku_code = $1 AND is_active`,
    [code],
  );
  if (v.rows.length) return Number(v.rows[0]!.price_php);
  const r = await db.query<{ retail_price_php: string }>(
    `SELECT retail_price_php FROM public.platform_retail_catalog_v2 WHERE service_code = $1 AND is_active`,
    [code],
  );
  if (r.rows.length) return Number(r.rows[0]!.retail_price_php);
  return null;
}

test('the scan actually found pairs — this guard is not vacuous', () => {
  // 🔑 THE ANTI-VACUOUS CHECK. Every assertion below loops over `pairs`, so a
  // regex that stopped matching (a rename, a reformat, a `export const` moved
  // behind an `if`) would make the whole file pass while testing NOTHING. The
  // floor is deliberately below today's count so ordinary churn does not trip
  // it, but a collapse to zero or near-zero does.
  const { pairs } = scanPairs();
  assert.ok(
    pairs.length >= 5,
    `only ${pairs.length} fallback/SKU pairs were scanned out of lib/ — the scan has stopped seeing them, ` +
      `so every comparison below is vacuous. Fix the scan, do not lower this floor.`,
  );
});

test('every file with a peso fallback is either paired or exempt WITH A REASON', () => {
  // ⛔ The failure mode this closes: a new module lands with a hardcoded price,
  // the scan cannot pair it, and it is silently not covered. Here it fails loudly
  // instead, and whoever adds it has to say which it is.
  const { unpairable } = scanPairs();
  const undeclared = unpairable.filter((f) => !(f in UNPAIRED));
  assert.deepEqual(
    undeclared,
    [],
    `these lib files declare a peso fallback the scan cannot pair with a catalog SKU: ${undeclared.join(', ')}. ` +
      `Either give the file exactly one *_FALLBACK_PHP and one *_SKU_CODE so it pairs automatically, ` +
      `or add it to UNPAIRED with the reason it is not a catalog price.`,
  );

  // And the exemption list must not rot: a file listed here that no longer has a
  // fallback at all is a stale line, and a stale exemption is how a real one
  // sneaks back in under a name somebody already agreed to ignore.
  const stale = Object.keys(UNPAIRED).filter((f) => !unpairable.includes(f));
  assert.deepEqual(stale, [], `UNPAIRED lists files that no longer need exempting: ${stale.join(', ')}`);
});

test('no hardcoded fallback disagrees with its live catalog row', async () => {
  const { pairs } = scanPairs();
  const drift: string[] = [];
  let compared = 0;

  for (const p of pairs) {
    const live = await livePrice(p.sku);
    // No ACTIVE row is the retirement case — the fallback is what deliberately
    // covers it, so there is nothing to disagree with. Only a live row counts.
    if (live === null) continue;
    compared += 1;
    if (live !== p.php) {
      drift.push(`${p.file}: ${p.constName} = ₱${p.php} but ${p.sku} is ₱${live}`);
    }
  }

  // A second floor, for the case where every SKU stopped resolving (a rename in
  // the catalog, a replay that seeded nothing) — that would empty `drift` and
  // read as a pass.
  assert.ok(
    compared >= 4,
    `only ${compared} fallbacks had a live catalog row to compare against — the comparison is near-vacuous`,
  );

  assert.deepEqual(
    drift,
    [],
    `A HARDCODED FALLBACK HAS DRIFTED FROM ITS CATALOG ROW — ${drift.join('; ')}. ` +
      `These literals are what the product charges when the catalog read fails, so a stale one bills ` +
      `yesterday's price while the catalog looks correct. Move the literal in the SAME change as the migration.`,
  );
});

test("the Custom rate card's fallback object agrees with the catalog, axis by axis", async () => {
  /*
    The same rule for the one fallback that is an OBJECT rather than a constant,
    so the scan above cannot see it. Its own docblock says a deactivated row
    "keeps quoting, at the same price, with the catalog saying it is off" — which
    is exactly why each axis needs comparing.

    ⛔ Axes come from CUSTOM_SKU_CODES, never hand-listed here, so an axis added
    later is covered without anyone editing this test.
  */
  assert.ok(
    CUSTOM_UNIT_PRICE_FALLBACK && Object.keys(CUSTOM_UNIT_PRICE_FALLBACK).length >= 8,
    'CUSTOM_UNIT_PRICE_FALLBACK did not import intact — every assertion below would be vacuous',
  );

  const codes = Object.entries(CUSTOM_SKU_CODES) as [keyof typeof CUSTOM_SKU_CODES, string][];
  assert.ok(codes.length >= 8, `only ${codes.length} axes enumerated — near-vacuous`);

  const drift: string[] = [];
  for (const [axis, sku] of codes) {
    const live = await livePrice(sku);
    if (live === null) continue;
    const fallback = Number(CUSTOM_UNIT_PRICE_FALLBACK[axis]);
    if (fallback !== live) drift.push(`${axis} (${sku}): catalog ₱${live} vs fallback ₱${fallback}`);
  }

  assert.deepEqual(
    drift,
    [],
    `CUSTOM_UNIT_PRICE_FALLBACK has drifted from the catalog — ${drift.join('; ')}. ` +
      `Update lib/vendor-custom-catalog.ts in the SAME change as the migration.`,
  );
});
