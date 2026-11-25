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
 *     to ₱11,000 to sit above a raised Enterprise. (That plan and its fallback
 *     were deleted 2026-11-06.)
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

/**
 * 🔒 THE PAIRED FALLBACKS, BY NAME (controller ruling 24 Nov 2026, on #8265). The scan below still DERIVES the pairs;
 * this list says which ones it must find. A scan that goes blind, a pair that vanishes, or a new one that lands
 * unannounced each fails by name — a floor on a count could only fail the collapse to near-zero.
 * Adding or deleting a `*_FALLBACK_PHP` / `*_FEE_PHP` next to one `*_SKU_CODE` edits this list in the same change.
 */
const EXPECTED_PAIRS = [
  'VENDOR_3D_BOOTH_FALLBACK_PHP',
  'VENDOR_AI_ADDON_FALLBACK_PHP',
  'VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP',
] as const;

/**
 * A paired fallback whose code has NO ACTIVE catalogue row — the retirement case, where the fallback is what covers a
 * code no longer on sale and there is nothing live to disagree with. Each is named WITH THE REASON its row is off sale.
 * Every other pair is compared against its live row; a pair with no live row and no line here fails.
 */
const NO_LIVE_ROW: Record<string, string> = {
  VENDOR_3D_BOOTH_FALLBACK_PHP:
    'vendor_3d_booth retired 2026-11-09 when the Specialized tools unlock went on sale (20271331982978, "BUILD 4 ANSWERS"); paid ones are honoured',
  VENDOR_AI_ADDON_FALLBACK_PHP:
    'vendor_ai_addon went off sale 2026-11-14: the AI chatbot is included on Pro and Ultra (20271346711828, "SIMPLER SUPPLIER PLANS")',
  VENDOR_PHOTO_CHALLENGE_FALLBACK_PHP:
    'vendor_photo_challenge retired 2026-11-09 with the Specialized tools unlock (20271331982978, "BUILD 4 ANSWERS")',
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
  //
  // 💰 2026-11-13 (truth sweep, owner: "no typed prices"): three paired fallbacks were DELETED — `SEAT_FEE_PHP`,
  // `BRANCH_FEE_PHP`, `VENDOR_3D_BOOTH_EVENT_FALLBACK_PHP` — their readers now answer null and the sale is refused.
  // A deleted fallback cannot drift, so the count fell 7 → 4 by removing prices, not by the scan going blind. The
  // floor follows that deletion, and a SECOND, independent check below now catches the blindness itself: a loose
  // count of every `export const …FALLBACK_PHP / …FEE_PHP` in lib/ must equal what the strict scan saw.
  // ✂️ 2026-11-24 (#8265, DECISION_LOG 2026-11-22 "DEEP SEARCH IS RETIRED — 'NO ADD-ONS' MEANS NONE", owner: *"Retire it"*):
  // `VENDOR_DEEP_SEARCH_FALLBACK_PHP` (₱499) was DELETED with the sale — Deep Search is a monthly allowance inside the
  // plans, never sold — so the count fell 4 → 3 by removing a price, the same case as 2026-11-13. The floor follows the
  // deletion, and the exact list below now pins WHICH three, so the floor is no longer the only thing standing.
  const { pairs } = scanPairs();
  assert.ok(
    pairs.length >= 3,
    `only ${pairs.length} fallback/SKU pairs were scanned out of lib/ — the scan has stopped seeing them, ` +
      `so every comparison below is vacuous. Fix the scan, do not lower this floor.`,
  );
  assert.deepEqual(
    pairs.map((p) => p.constName).sort(),
    [...EXPECTED_PAIRS].sort(),
    `the scan paired ${pairs.map((p) => p.constName).join(', ') || 'nothing'} — not the named list. A missing name means ` +
      `the scan went blind to it (or it was deleted: then delete it from EXPECTED_PAIRS, saying why); an extra name is a ` +
      `new fallback: add it to EXPECTED_PAIRS in the same change.`,
  );
});

test('the strict scan sees every fallback a loose read of lib/ can find — a reformat cannot hide one', () => {
  // Numeric declarations only, in any spelling (`: number`, `1_490`, odd spacing). Object-shaped fallbacks (the AI tier
  // ladders in setnayan-ai-type-pricing.ts) are a different shape, held by ai-tier-ladder-matches-the-catalog.db.test.ts.
  const loose = /export\s+const\s+[A-Z0-9_]*(?:FALLBACK_PHP|FEE_PHP)\s*(?::\s*number\s*)?=\s*[0-9]/g;
  const strict = /^export const [A-Z0-9_]*(?:FALLBACK_PHP|FEE_PHP) = \d+;/gm;
  const missed: string[] = [];
  for (const file of readdirSync(LIB)) {
    if (!file.endsWith('.ts') || file.includes('.test.')) continue;
    const src = readFileSync(join(LIB, file), 'utf8');
    const a = (src.match(loose) ?? []).length;
    const b = (src.match(strict) ?? []).length;
    if (a !== b) missed.push(`${file} (${a} declared, ${b} scanned)`);
  }
  assert.deepEqual(missed, [], `fallback(s) the scan cannot read, so nothing compares them: ${missed.join(', ')}`);
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
  const unexplained: string[] = [];
  const staleReason: string[] = [];

  for (const p of pairs) {
    const live = await livePrice(p.sku);
    if (live === null) {
      // No ACTIVE row is the retirement case — but only when it is SAID, by name, in NO_LIVE_ROW. A pair that stopped
      // resolving with no reason (a rename in the catalogue, a replay that seeded nothing) fails here instead of
      // quietly dropping out of the comparison. (This replaced a `compared >= 1` floor, 24 Nov 2026, #8265: once
      // Deep Search was deleted every remaining pair is retired, and a floor of 0 would have tested nothing.)
      if (!(p.constName in NO_LIVE_ROW)) unexplained.push(`${p.file}: ${p.constName} → ${p.sku}`);
      continue;
    }
    if (p.constName in NO_LIVE_ROW) staleReason.push(`${p.constName} → ${p.sku} is on sale at ₱${live}`);
    if (live !== p.php) {
      drift.push(`${p.file}: ${p.constName} = ₱${p.php} but ${p.sku} is ₱${live}`);
    }
  }

  assert.deepEqual(
    unexplained,
    [],
    `paired fallback(s) whose code has no ACTIVE catalogue row and no reason in NO_LIVE_ROW: ${unexplained.join('; ')}`,
  );
  assert.deepEqual(staleReason, [], `NO_LIVE_ROW says these are off sale, but their row is live — drop the line so the price is compared: ${staleReason.join('; ')}`);
  const stale = Object.keys(NO_LIVE_ROW).filter((n) => !pairs.some((p) => p.constName === n));
  assert.deepEqual(stale, [], `NO_LIVE_ROW names fallbacks the scan no longer pairs: ${stale.join(', ')}`);

  assert.deepEqual(
    drift,
    [],
    `A HARDCODED FALLBACK HAS DRIFTED FROM ITS CATALOG ROW — ${drift.join('; ')}. ` +
      `These literals are what the product charges when the catalog read fails, so a stale one bills ` +
      `yesterday's price while the catalog looks correct. Move the literal in the SAME change as the migration.`,
  );
});

/*
 * (A second test lived here: "the Custom rate card's fallback object agrees with the catalog, axis by axis". The
 * object it held — `CUSTOM_UNIT_PRICE_FALLBACK` in lib/vendor-custom-catalog.ts — was DELETED 2026-11-06 with the
 * Custom supplier plan itself, owner: "from the app". A deleted fallback cannot drift, and the scan above still covers
 * every `*_FALLBACK_PHP` / `*_FEE_PHP` constant left in lib/.)
 */

test('every paired fallback names a code the catalogue actually has (active or retired) — a rename cannot hide it', async () => {
  const { pairs } = scanPairs();
  const unknown: string[] = [];
  for (const p of pairs) {
    const v = await db.query(`SELECT 1 FROM public.vendor_billing_catalog WHERE sku_code = $1`, [p.sku]);
    if (v.rows.length) continue;
    const r = await db.query(`SELECT 1 FROM public.platform_retail_catalog_v2 WHERE service_code = $1`, [p.sku]);
    if (!r.rows.length) unknown.push(`${p.file}: ${p.constName} → ${p.sku}`);
  }
  assert.deepEqual(unknown, [], `fallback(s) paired with a code no catalogue row carries: ${unknown.join('; ')}`);
});
