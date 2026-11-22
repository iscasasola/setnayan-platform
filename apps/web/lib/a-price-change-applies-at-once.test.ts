/**
 * a-price-change-applies-at-once.test.ts — what a customer is charged, and who changes it.
 *
 * `platform_retail_catalog_v2` is admin-managed and is the ONLY price a customer is charged.
 *
 * ⚖ THE RULE, OWNER 23 NOV 2026: *"no need for a second admin. auto approve"* — said of his Live Watch save that sat
 * in /admin/approvals. One admin's price change is live on save. (Until then this file was
 * `a-price-change-takes-two-admins.test.ts` and held the opposite: Vendor Agreement § 9.1's two-admin price row.)
 *
 * What stays held, because the ruling removed a person, not the controls:
 *  · ONE writer of a customer price per surface, exactly listed — a new door still fails here;
 *  · the per-SKU editor applies through THE executor (`executeRetailPriceChange`), which writes only
 *    CUSTOMER_PRICE_FIELDS and leaves an audit row (before → after, who, `applied_directly`);
 *  · a request still pending from before the ruling is CLOSED on save, so a later approval cannot put the old
 *    figure back over the new one;
 *  · no new `approve_retail_price_change` request is opened by the editor.
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
  changesWhatACustomerPays,
} from './retail-price-change';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const EDITOR = 'app/admin/pricing/actions.ts';
const BULK = 'app/admin/pricing/price-control-actions.ts';
const DISPATCHER = 'app/admin/approvals/actions.ts';
// Owner 2026-11-13 (plan contents): writes ONE non-price column — `included_papic_credits`, what Event Plus / Event Pro
// include — and only as the executor of its own two-admin approval (`approve_plan_contents_change`). Never a price.
const PLAN_CONTENTS = 'lib/plan-contents-execute.server.ts';

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the rule tells a price from copy', () => {
  // Unchanged is unchanged, however it is spelled.
  assert.deepEqual(changedPriceFields({ retail_price_php: 2999 }, { retail_price_php: 2999 }), []);
  assert.deepEqual(changedPriceFields({ onboarding_price_php: null }, { onboarding_price_php: null }), []);

  assert.deepEqual(changedPriceFields({ retail_price_php: 2999 }, { retail_price_php: 3000 }), ['retail_price_php']);
  assert.equal(changesWhatACustomerPays({ retail_price_php: 2999 }, { retail_price_php: 3000 }), true);

  // 🔑 A PRICING MODEL CHANGE MOVES NO PESO FIGURE AND STILL CHANGES THE BILL.
  // Flipping one-time → monthly, or flat → per-head, changes what a customer
  // pays without editing a number. A gate watching only amounts misses both.
  assert.deepEqual(changedPriceFields({ billing_period: 'one_time' }, { billing_period: 'monthly' }), ['billing_period']);
  assert.deepEqual(changedPriceFields({ is_pax_priced: false }, { is_pax_priced: true }), ['is_pax_priced']);

  // 🔒 Copy and our own cost are NOT prices: the executor must never write them, and the audit row must not
  // report a typo fix as a price change.
  for (const f of NON_PRICE_FIELDS) {
    assert.ok(
      !(CUSTOMER_PRICE_FIELDS as readonly string[]).includes(f),
      `${f} is copy or internal cost, not a customer price. saas_overhead_cost_php moves OUR margin, ` +
        'not anyone\'s bill.',
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
    [EDITOR, BULK, PLAN_CONTENTS].sort(),
    'A file outside the known pricing surfaces writes what a customer is charged. Route it through ' +
      'executeRetailPriceChange (one writer, one audit row), or add it here with a reason.\n  ' + writers.join('\n  '),
  );
});

test('the per-SKU editor applies a price at once, through the executor, and saves the copy', () => {
  const body = read(EDITOR);
  const start = body.indexOf('export async function saveRetailRow');
  const end = body.indexOf('export async function executeRetailPriceChange', start);
  assert.ok(start >= 0 && end > start, 'saveRetailRow moved');
  const fn = body.slice(start, end);

  // 🪤 ASSERT THE CONDITION, NOT THE TEXT: the price branch is entered on the rule's result.
  assert.match(fn, /const changed = changedPriceFields\(prior, nextRow\);/, 'saveRetailRow no longer derives `changed`');
  assert.match(fn, /if \(changed\.length > 0\) \{/, 'the price branch is no longer entered on the rule\'s result');

  const branch = fn.slice(fn.indexOf('if (changed.length > 0) {'));
  // The price goes through THE executor — one writer, one audit row — never a bare update of the price fields.
  assert.match(branch, /await executeRetailPriceChange\(admin, \{/, 'a price change no longer goes through the executor');
  assert.match(branch, /appliedDirectly: true/, 'the direct apply is no longer marked in the audit row');
  // Copy still saves first, apart from the price.
  assert.match(branch, /delete copyOnly\[f\]/, 'the price branch no longer separates the copy from the price');
  // A request still pending from before the ruling is closed, so it cannot be approved later over this save.
  assert.match(
    branch,
    /from\('admin_approval_requests'\)\s*\.update\(\{ status: 'expired'[^}]*decision_reason: PRICE_APPLIED_DIRECTLY \}\)\s*\.eq\('action_type', 'approve_retail_price_change'\)\s*\.eq\('target_id', code\)\s*\.eq\('status', 'pending'\)/,
    'saving a price no longer closes the pending request for that SKU — an old approval could put the old price back',
  );
  // The close comes BEFORE the apply: a failed close must leave the price unchanged, not half-decided.
  assert.ok(branch.indexOf("status: 'expired'") < branch.indexOf('executeRetailPriceChange('), 'the price applies before the old request is closed');
  // The editor opens no new request, and says the price is live — read through lib/php.ts.
  assert.doesNotMatch(fn, /action_type: 'approve_retail_price_change'/, 'saveRetailRow opens a two-admin request again');
  assert.match(branch, /message: `Live — \$\{formatPhp\(nextRow\.retail_price_php\)\}\.`/, 'the success line no longer says what is live');
});

test('the EXECUTOR is reached only from the editor and the approvals dispatcher', () => {
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
  assert.deepEqual(callers.sort(), [DISPATCHER], 'a new door onto the executor (the editor is its own file and is held above)');
});

test('the executor writes only price columns, and records who and how', () => {
  const body = read(EDITOR);
  const start = body.indexOf('export async function executeRetailPriceChange');
  const end = body.indexOf('export async function retireRetailRow', start);
  assert.ok(start >= 0 && end > start, 'the executor moved');
  const fn = body.slice(start, end);

  assert.match(
    fn,
    /names non-price column/,
    'the executor no longer rejects payload keys outside CUSTOMER_PRICE_FIELDS. A pending row ' +
      'could then name any column in the catalogue and have it written.',
  );
  assert.match(fn, /confirmed_by: params\.confirmingAdminId/, 'the audit row no longer names the confirming admin');
  assert.match(fn, /initiated_by: params\.initiatedByAdminId/, 'the audit row no longer names the initiator');
  assert.match(fn, /applied_directly: PRICE_APPLIED_DIRECTLY/, 'the audit row no longer says the change was applied directly');
});
