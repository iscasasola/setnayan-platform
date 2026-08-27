/**
 * THE TIER ABOVE ENTERPRISE MUST NOT COST LESS THAN ENTERPRISE.
 *
 * 🚨 THE FAILURE THIS EXISTS TO STOP, AND IT ALREADY HAPPENED ONCE. On
 * 2026-08-27 the owner raised `enterprise_vendor_monthly` ₱8,000 → ₱10,000.
 * `vendor_custom_base` — the entry price of the tier every document describes as
 * "the unlimited tier ABOVE Enterprise" — was ₱8,999 and was not part of that
 * price sheet. For the length of one migration, the tier above cost ₱1,001 LESS
 * than the tier below it. Nobody was quoted the inverted ladder only because
 * production happened to hold two vendor profiles and both were `solo`.
 *
 * ⚠ IT WAS ALSO PREDICTED, IN WRITING, AND THE PREDICTION CHANGED NOTHING.
 * `Vendor_Subscription_Ladder_2026-07-22.md:27` had carried, for five weeks:
 * "⚠ With Enterprise now ₱8,000, round Custom's floor to ₱9,000 for
 * consistency." It was never actioned. **A note in a document cannot fail a
 * build** — which is the entire reason this file exists rather than a third
 * sentence in a fourth markdown file. The owner asked for exactly this: "tie it
 * to Enterprise so it can never invert again."
 *
 * ── WHY IT READS THE DATABASE, AND WHY BOTH SIDES COME FROM ONE QUERY ───────
 * A guard that compares two HAND-TYPED numbers is two humans agreeing with each
 * other, and this codebase has already paid for that shape more than once (it is
 * how `llms.txt` drifted for three weeks with green CI). So neither figure is
 * written down here. Both are SELECTed out of `vendor_billing_catalog` in the
 * replayed schema, which means the guard tracks whatever the catalog says after
 * every future migration — including ones written by someone who has never read
 * this comment. That is the point.
 *
 * ⛔ IT PINS THE RELATIONSHIP, NEVER THE AMOUNTS. Either price may move to any
 * value the owner likes; only the ORDER is enforced. A guard that pinned ₱11,000
 * would fail on his next reprice and teach people to edit guards to go green.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import {
  CUSTOM_SKU_CODES,
  CUSTOM_UNIT_PRICE_FALLBACK,
} from '../../lib/vendor-custom-catalog';

/**
 * The two rows this rule is about. Named as constants so the query below reads
 * as a relationship rather than as two magic strings, and so a rename of either
 * SKU surfaces here as a missing row (asserted) instead of as a silent pass.
 *
 * ⚠ These are SKU CODES, not amounts — the amounts are deliberately absent from
 * this file. See the docblock.
 */
const CUSTOM_BASE_SKU = 'vendor_custom_base';
const ENTERPRISE_28D_SKU = 'enterprise_vendor_monthly';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

/** Both prices, in one read, straight out of the replayed catalog. */
async function ladderPrices() {
  const r = await db.query<{ sku_code: string; price_php: string; is_active: boolean }>(
    `SELECT sku_code, price_php, is_active
       FROM public.vendor_billing_catalog
      WHERE sku_code = $1 OR sku_code = $2`,
    [CUSTOM_BASE_SKU, ENTERPRISE_28D_SKU],
  );
  const by = new Map(r.rows.map((x) => [x.sku_code, x]));
  return { custom: by.get(CUSTOM_BASE_SKU), enterprise: by.get(ENTERPRISE_28D_SKU) };
}

test('both rungs of the top of the ladder still exist', async () => {
  // 🔑 THE ANTI-VACUOUS CHECK, and it is not decoration. The rule below is
  // expressed as "custom must be greater than enterprise". If either row were
  // renamed or dropped, that comparison would have nothing to compare and the
  // guard would pass while enforcing nothing — the exact way a guard becomes
  // decoration without anybody editing it.
  const { custom, enterprise } = await ladderPrices();
  assert.ok(
    custom,
    `${CUSTOM_BASE_SKU} is not in the catalog — either it was renamed (point this guard at the new code) ` +
      `or the Custom tier was genuinely retired (delete this guard, and say so out loud)`,
  );
  assert.ok(
    enterprise,
    `${ENTERPRISE_28D_SKU} is not in the catalog — the ladder's top paid tier is missing`,
  );
});

test('the tier above Enterprise does not cost less than Enterprise', async () => {
  const { custom, enterprise } = await ladderPrices();
  const customPhp = Number(custom!.price_php);
  const enterprisePhp = Number(enterprise!.price_php);

  // Sanity: two real, positive numbers. `Number(undefined)` is NaN and every
  // comparison against NaN is false, so a column rename would otherwise read as
  // "not less than" and pass.
  assert.ok(
    Number.isFinite(customPhp) && customPhp > 0,
    `Custom's base price read back as ${custom!.price_php} — not a usable number`,
  );
  assert.ok(
    Number.isFinite(enterprisePhp) && enterprisePhp > 0,
    `Enterprise's 28-day price read back as ${enterprise!.price_php} — not a usable number`,
  );

  // ⚖ STRICTLY GREATER, not >=. Equal prices are their own defect: two tiers at
  // the same money, one of which is documented as the bigger one, is a choice
  // nobody can make sensibly — the same reasoning that removed the 40,000 Papic
  // rung when it was priced level with 50,000.
  assert.ok(
    customPhp > enterprisePhp,
    `THE TIER ABOVE ENTERPRISE COSTS LESS THAN ENTERPRISE. ` +
      `The Custom base (${CUSTOM_BASE_SKU}) is ₱${customPhp.toLocaleString()} while Enterprise's ` +
      `28-day price (${ENTERPRISE_28D_SKU}) is ₱${enterprisePhp.toLocaleString()}. ` +
      `Custom is sold everywhere as the unlimited tier ABOVE Enterprise, so a shop comparing them ` +
      `is asked to pay more for less. This happened for real on 2026-08-27 when Enterprise was raised ` +
      `and Custom's base was left behind. Fix the PRICE — do not relax this guard.`,
  );
});

test('the imported fallback is really there — this guard cannot run on an empty module', () => {
  // 🪤 A KNOWN TRAP IN THIS REPO, AND THE WHOLE FILE BELOW DEPENDS ON IT NOT
  // BITING: under `tsx --test` an import has been observed returning EMPTY named
  // exports, at which point a guard runs zero checks and reports a clean pass.
  // `Object.values(undefined)` throws, but `CUSTOM_UNIT_PRICE_FALLBACK` arriving
  // as `{}` would make every comparison below vacuous instead. So assert the
  // shape arrived before trusting anything derived from it.
  assert.ok(
    CUSTOM_UNIT_PRICE_FALLBACK && typeof CUSTOM_UNIT_PRICE_FALLBACK === 'object',
    'CUSTOM_UNIT_PRICE_FALLBACK did not import — every assertion below would be vacuous',
  );
  assert.ok(
    Object.keys(CUSTOM_UNIT_PRICE_FALLBACK).length >= 8,
    `the fallback imported with only ${Object.keys(CUSTOM_UNIT_PRICE_FALLBACK).length} axes — expected the full rate card`,
  );
  assert.equal(
    CUSTOM_SKU_CODES.base,
    CUSTOM_BASE_SKU,
    'the module and this guard disagree about which SKU is the Custom base',
  );
});

test('THE BACK DOOR: the hardcoded fallback base is also above Enterprise', async () => {
  /*
    🚨 THIS IS THE ASSERTION THE FIRST VERSION OF THIS GUARD WAS MISSING, and
    missing it made the guard incomplete in exactly the way that matters.

    `fetchCustomUnitPrices` filters on `is_active` and then `read()` substitutes
    CUSTOM_UNIT_PRICE_FALLBACK for any axis whose row came back missing. So a
    Custom base row that is inactive, deleted, or simply unreadable makes the
    product quote the LITERAL — and a catalog-only comparison cannot see that
    path at all. It would sit green while the configurator quoted ₱8,999 against
    an Enterprise tier at ₱10,000: the inversion restored through a door the
    catalog does not know about.

    The fallback is a SECOND COPY of the price, so it needs the same rule.
  */
  const { enterprise } = await ladderPrices();
  const enterprisePhp = Number(enterprise!.price_php);
  const fallbackBase = Number(CUSTOM_UNIT_PRICE_FALLBACK.base);

  assert.ok(
    Number.isFinite(fallbackBase) && fallbackBase > 0,
    `the fallback base read as ${CUSTOM_UNIT_PRICE_FALLBACK.base} — not a usable number`,
  );
  assert.ok(
    fallbackBase > enterprisePhp,
    `THE FALLBACK PRICE PUTS CUSTOM BACK BELOW ENTERPRISE. ` +
      `CUSTOM_UNIT_PRICE_FALLBACK.base in lib/vendor-custom-catalog.ts is ₱${fallbackBase.toLocaleString()} ` +
      `while Enterprise's 28-day price is ₱${enterprisePhp.toLocaleString()}. ` +
      `That literal is what the Custom quote uses whenever the catalog row is inactive or unreadable, ` +
      `so the ladder would invert with the catalog looking correct. Raise the literal to match the catalog.`,
  );
});

// ⤷ THE AXIS-BY-AXIS COMPARISON THAT USED TO LIVE HERE MOVED to
// `fallback-prices-match-the-catalog.db.test.ts`, where it sits beside the same
// rule applied to every other hardcoded fallback in lib/. It was a special case
// of "no fallback may disagree with its catalog row", and a general guard
// catches the next one; this file keeps only the LADDER rule.

test('the rule survives a reprice of either side, because neither amount is written here', async () => {
  // 🔑 A GUARD THAT PINS A NUMBER GETS EDITED THE FIRST TIME THE OWNER MOVES IT,
  // and an edited guard is a guard nobody trusts. This asserts the property the
  // docblock promises: that the enforcement is a comparison of two live values,
  // not a comparison against a literal. It reads THIS FILE and fails if a peso
  // amount is ever hardcoded into it.
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL(import.meta.url), 'utf8'),
  );
  // Strip the docblocks and comments before matching, or the prose above — which
  // legitimately quotes ₱8,999 and ₱10,000 as HISTORY — fails the check it is
  // explaining. Same stripping discipline the doors guard uses.
  //
  // 🪤 AND STRIP STRING/TEMPLATE LITERALS TOO — THIS GUARD CRIED WOLF ON ITSELF
  // ON ITS FIRST RUN. The failure message above says "this happened for real on
  // 2026-08-27", and `2026` is a four-digit number, so the check went RED over a
  // DATE inside its own error text. Caught by running it, not by reading it.
  // The fix is the matcher, never the message: a hardcoded PRICE would appear as
  // a bare number in expression position (`> 11000`), never inside quotes, so
  // removing string contents loses nothing this is meant to catch.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
  const literals = code.match(/\b\d{4,}(?:\.\d+)?\b/g) ?? [];
  assert.deepEqual(
    literals,
    [],
    `a peso-sized literal was hardcoded into this guard (${literals.join(', ')}). ` +
      `Both prices must come from the catalog — see the docblock.`,
  );
});
