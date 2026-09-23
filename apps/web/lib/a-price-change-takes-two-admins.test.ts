/**
 * a-price-change-takes-two-admins.test.ts — § 9.1's pricing row.
 *
 * `platform_retail_catalog_v2` is admin-managed and is the ONLY price a
 * customer is charged. Vendor Agreement § 9.1 gates changing it.
 *
 * ── 🔑 THE FINDING: THERE IS MORE THAN ONE DOOR, AGAIN ──────────────────────
 * `saveRetailRow` is the obvious one — the per-SKU editor. But
 * `app/admin/pricing/price-control-actions.ts` ALSO writes `retail_price_php`
 * and `onboarding_price_php`, from `savePapicLadder` and `saveFamilyDiscount`,
 * which recompute many rows at once and never touch the row editor.
 *
 * This is the third time today the same shape has appeared: the comp gate, the
 * receiving-account gate (where a QR image turned out to be a destination), and
 * now this. **The obvious action is never the only writer.**
 *
 * ── What is gated, and what is HONESTLY NOT ─────────────────────────────────
 * ✅ `saveRetailRow` — the per-SKU editor. Gated.
 * ⚠ `price-control-actions.ts` — the bulk ladder / discount surfaces. **NOT
 *   gated yet**, and named below rather than left for someone to discover.
 *   They write N rows from one derivation, so they need a multi-row payload
 *   rather than the single-SKU one the executor takes today. Recorded as a
 *   known door, not hidden by a guard that would otherwise read "one writer".
 *
 * 🔒 The list below is exact. A FOURTH writer fails this test, which is the
 * point: the gap is bounded and visible, and it cannot quietly grow.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { stripComments } from './strip-comments';
import {
  CUSTOMER_PRICE_FIELDS,
  NON_PRICE_FIELDS,
  changedPriceFields,
  priceChangeNeedsTwoAdmins,
} from './retail-price-change';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const EDITOR = 'app/admin/pricing/actions.ts';
const BULK = 'app/admin/pricing/price-control-actions.ts';
const DISPATCHER = 'app/admin/approvals/actions.ts';

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the rule tells a price from copy', () => {
  // Unchanged is unchanged, however it is spelled.
  assert.deepEqual(changedPriceFields({ retail_price_php: 2999 }, { retail_price_php: 2999 }), []);
  assert.deepEqual(changedPriceFields({ onboarding_price_php: null }, { onboarding_price_php: null }), []);

  assert.deepEqual(changedPriceFields({ retail_price_php: 2999 }, { retail_price_php: 3000 }), ['retail_price_php']);
  assert.equal(priceChangeNeedsTwoAdmins({ retail_price_php: 2999 }, { retail_price_php: 3000 }), true);

  // 🔑 A PRICING MODEL CHANGE MOVES NO PESO FIGURE AND STILL CHANGES THE BILL.
  // Flipping one-time → monthly, or flat → per-head, changes what a customer
  // pays without editing a number. A gate watching only amounts misses both.
  assert.deepEqual(changedPriceFields({ billing_period: 'one_time' }, { billing_period: 'monthly' }), ['billing_period']);
  assert.deepEqual(changedPriceFields({ is_pax_priced: false }, { is_pax_priced: true }), ['is_pax_priced']);

  // 🔒 Copy and our own cost are NOT prices, and must never become gated —
  // an admin fixing a typo must not wait on a colleague.
  for (const f of NON_PRICE_FIELDS) {
    assert.ok(
      !(CUSTOMER_PRICE_FIELDS as readonly string[]).includes(f),
      `${f} is copy or internal cost, not a customer price. Gating it would make a typo fix ` +
        'need two admins, and saas_overhead_cost_php moves OUR margin, not anyone\'s bill.',
    );
  }
});

test('every writer of a customer-price column is known — exactly', () => {
  const SKIP = new Set(['node_modules', '.next', 'dist']);
  const writers: string[] = [];
  let scanned = 0;

  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (SKIP.has(e)) continue;
      const abs = join(dir, e);
      if (statSync(abs).isDirectory()) { walk(abs); continue; }
      if (!/\.(ts|tsx)$/.test(abs) || abs.includes('.test.')) continue;
      scanned += 1;
      const body = stripComments(readFileSync(abs, 'utf8'));
      if (!body.includes('platform_retail_catalog_v2')) continue;
      // An UPDATE on this table that names a price column, within reach of the
      // table reference — not merely a file that reads it and writes elsewhere.
      // 🪤 ANY WRITE COUNTS — DO NOT ALSO REQUIRE A PRICE COLUMN BY NAME.
      // The first version of this asked for `.update(` AND a named price
      // column in the same window, and reported ONE writer: the bulk surface.
      // It missed `saveRetailRow` — the very function this PR gates — because
      // that writes `.update({ ...nextRow })`, and **a spread names no
      // column**. A guard that cannot see the code it was written for is the
      // most expensive kind of green.
      //
      // So the net is every write to this table. A file that only ever writes
      // a non-price column belongs in the list below WITH A REASON, rather
      // than being silently excluded by a heuristic.
      let i = body.indexOf("from('platform_retail_catalog_v2')");
      let writes = false;
      while (i >= 0 && !writes) {
        if (/\.(update|insert|upsert)\(/.test(body.slice(i, i + 300))) writes = true;
        i = body.indexOf("from('platform_retail_catalog_v2')", i + 1);
      }
      if (writes) writers.push(abs.slice(WEB.length + 1));
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));

  console.log(`[price-gate] scanned ${scanned} files · ${writers.length} write a customer-price column`);
  assert.ok(scanned > 500, `only ${scanned} files scanned — the walk is not reaching the tree`);

  assert.deepEqual(
    writers.sort(),
    [EDITOR, BULK].sort(),
    'A file outside the two known pricing surfaces writes what a customer is charged. That is a ' +
      'new door onto § 9.1, and a gate with another door is decoration. Either route it through ' +
      'approve_retail_price_change, or add it here with a reason.\n  ' + writers.join('\n  '),
  );
});

test('the per-SKU editor gates the price and saves the copy', () => {
  const body = read(EDITOR);
  const gateAt = body.indexOf('changedPriceFields(');
  assert.ok(gateAt >= 0, 'saveRetailRow no longer consults the § 9.1 rule');

  // The gate must precede the unconditional write, or the price would already
  // be live by the time anyone was asked.
  const writeAt = body.indexOf('.update({ ...nextRow');
  assert.ok(writeAt > gateAt, 'saveRetailRow writes the full row BEFORE testing the § 9.1 rule');

  // 🪤 ASSERT THE CONDITION, NOT THE TEXT. Sabotaging `if (changed.length > 0)`
  // to `if (false)` left every string below in place — the approval insert, the
  // copy-only strip, the rule call — and this test stayed GREEN. A dead branch
  // still contains its own source. Pin what the branch is entered ON.
  assert.match(
    body,
    /const changed = changedPriceFields\(prior, nextRow\);/,
    'saveRetailRow no longer derives `changed` from the § 9.1 rule',
  );
  assert.match(
    body,
    /if \(changed\.length > 0\) \{/,
    'the § 9.1 branch is no longer entered on the rule\'s result. A constant condition (`if ' +
      '(false)`) leaves the approval code in the file and unreachable, which reads exactly like ' +
      'a working gate to every text-matching check.',
  );
  assert.match(body, /action_type: 'approve_retail_price_change'/, 'the gated branch opens no approval');
  // Copy still saves immediately — the deliberate half.
  assert.match(
    body,
    /delete copyOnly\[f\]/,
    'the gated branch no longer strips just the price fields. If it now withholds the whole row, ' +
      'an admin fixing a SKU blurb is blocked by an unrelated pending price change.',
  );
});

test('the EXECUTOR is reachable only from the approvals dispatcher', () => {
  const SKIP = new Set(['node_modules', '.next', 'dist']);
  const callers: string[] = [];
  let scanned = 0;
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (SKIP.has(e)) continue;
      const abs = join(dir, e);
      if (statSync(abs).isDirectory()) { walk(abs); continue; }
      if (!/\.(ts|tsx)$/.test(abs) || abs.includes('.test.')) continue;
      scanned += 1;
      const rel = abs.slice(WEB.length + 1);
      if (rel === EDITOR) continue;
      const body = stripComments(readFileSync(abs, 'utf8'));
      if (!body.includes('executeRetailPriceChange')) continue;
      // Naming is not reaching — a generated registry lists every exported
      // admin function as data. Ask whether it CALLS or IMPORTS it.
      const calls = /executeRetailPriceChange\s*\(/.test(body);
      const imports = /import[^;]*executeRetailPriceChange/.test(body) ||
        /await import\([^)]*\)[^;]*executeRetailPriceChange/.test(body);
      if (!calls && !imports) continue;
      callers.push(rel);
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));

  console.log(`[price-gate] scanned ${scanned} files for executeRetailPriceChange callers`);
  assert.ok(scanned > 500, `only ${scanned} files scanned`);
  assert.deepEqual(callers.sort(), [DISPATCHER], 'a second door onto the executor');
});

test('the executor writes only price columns, and records both admins', () => {
  const body = read(EDITOR);
  const start = body.indexOf('export async function executeRetailPriceChange');
  const end = body.indexOf('export async function retireRetailRow', start);
  assert.ok(start >= 0 && end > start, 'the executor moved');
  const fn = body.slice(start, end);

  assert.match(
    fn,
    /names non-price column/,
    'the executor no longer rejects payload keys outside CUSTOMER_PRICE_FIELDS. A pending row ' +
      'could then name any column in the catalogue and have a second admin approve a write they ' +
      'were never shown.',
  );
  assert.match(fn, /confirmed_by: params\.confirmingAdminId/, 'the audit row no longer names the confirming admin');
  assert.match(fn, /initiated_by: params\.initiatedByAdminId/, 'the audit row no longer names the initiator');
});
