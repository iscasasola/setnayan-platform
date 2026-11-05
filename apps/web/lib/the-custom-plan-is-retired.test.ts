/**
 * THE CUSTOM SUPPLIER PLAN IS RETIRED FROM THE APP — DELETED, NOT HIDDEN.
 *
 * Owner, 2026-11-06 (DECISION_LOG), asked "Is the Custom plan gone only from this page, or from the app too?":
 * *"from the app"*. That reversed the 2026-08-27 ruling, which had HIDDEN Custom behind a flag
 * (`CUSTOM_TIER_OFFERED_PUBLICLY`) while the configurator, the composer, the activation hook and a hard-coded price
 * fallback stayed live — the file itself warned that flipping `is_active` on its catalogue rows would not retire
 * anything, because the fallback would keep quoting. So this time it was deleted, and this test fails the build if any
 * of it comes back:
 *
 *   1 · `custom` as a tier — in `VENDOR_TIERS`, or as a key of the plan tables (caps · label · price fallback);
 *   2 · a Custom route — the supplier configurator or the admin composer, as a folder or as a link to one;
 *   3 · a code read of a `vendor_custom_*` SKU or the `vendor_custom_plans` table, or a `tier === 'custom'` test,
 *       anywhere in shipped code (comments are stripped first — history may say the word).
 *
 * Its database twin is `tests/db/the-custom-plan-is-retired.db.test.ts`. Ultra's add-ons (extra branch, extra seat)
 * are the way past Ultra; they are not this test's business and it never names them.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { VENDOR_TIERS, TIER_CAPS, TIER_LABEL, TIER_PRICE_PHP, asVendorTier, tierRank } from './vendor-tier-caps';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The ONLY shipped files allowed to name a Custom-plan string, each with why. Both are about money that may already
 * exist, never about offering the plan.
 */
const ALLOWED: Record<string, string> = {
  'lib/vendor-pays-setnayan.ts':
    'keeps `vendor_custom_plan__` / `vendor_custom_plan_annual__` classified as a supplier paying Setnayan, so an ' +
    'order that already carries one can never be scheduled a payout',
  'lib/export-completeness.ts':
    'lists the `vendor_custom_plans` table (kept for rows it may already hold) so the data-export guard stays complete',
};

function sources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, acc);
    else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.test\.(ts|tsx|mjs)$/.test(name) && !/\.generated\./.test(name)) acc.push(full);
  }
  return acc;
}

/** Comments out, strings kept — the history in a docblock may say "Custom"; the code may not read it. */
const code = stripComments;

/** What counts as reading the retired plan. Exported shape is local; the self-test below proves each one bites. */
const READS: [string, RegExp][] = [
  ['a vendor_custom_* SKU or the vendor_custom_plans table', /['"`]vendor_custom_[a-z_]*['"`]/],
  ['a tier compared to custom', /\b(tier|tier_state|currentTier|t)\s*[!=]==?\s*['"]custom['"]|['"]custom['"]\s*[!=]==?\s*(tier|tier_state|currentTier)\b/],
  ['custom in a tier list', /['"]enterprise['"]\s*,\s*['"]custom['"]/],
  ['a Custom-plan route', /subscription\/custom\b|admin\/custom-plans|tab=custom-plans/],
];

test('1 · custom is not a tier, in the list or in any plan table', () => {
  assert.ok(!(VENDOR_TIERS as readonly string[]).includes('custom'), "VENDOR_TIERS lists 'custom' again");
  assert.deepEqual([...VENDOR_TIERS], ['free', 'verified', 'solo', 'pro', 'enterprise']);
  for (const [name, table] of [['TIER_CAPS', TIER_CAPS], ['TIER_LABEL', TIER_LABEL], ['TIER_PRICE_PHP', TIER_PRICE_PHP]] as const) {
    assert.ok(!Object.prototype.hasOwnProperty.call(table, 'custom'), `${name} has a custom row again`);
  }
  // A stray 'custom' (an old row, a typo) reads as Free — the bottom of the ladder, never a paid plan.
  assert.equal(asVendorTier('custom'), 'free');
  assert.equal(tierRank('custom'), tierRank('free'));
});

test('2 · the Custom doors are gone — no configurator, no composer, no pricing tab', () => {
  for (const dir of ['app/vendor-dashboard/subscription/custom', 'app/admin/custom-plans']) {
    assert.ok(!existsSync(join(WEB, dir)), `${dir} exists again`);
  }
  for (const file of [
    'lib/custom-tier-offered.ts',
    'lib/vendor-custom-catalog.ts',
    'lib/vendor-custom-pricing.ts',
    'lib/vendor-effective-caps.ts',
    'app/admin/pricing/_surfaces/custom-plans-surface.tsx',
  ]) {
    assert.ok(!existsSync(join(WEB, file)), `${file} exists again — the Custom plan was deleted, not hidden`);
  }
});

test('3 · no shipped code reads the Custom plan', () => {
  const files = [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib')), ...sources(join(WEB, 'components'))];
  // Anti-vacuity: a scan that walks nothing passes forever.
  assert.ok(files.length > 1000, `only ${files.length} source files scanned — the walk has gone blind`);

  const offenders: string[] = [];
  for (const full of files) {
    const rel = relative(WEB, full).split('\\').join('/');
    if (rel in ALLOWED) continue;
    const c = code(readFileSync(full, 'utf8'));
    for (const [what, re] of READS) if (re.test(c)) offenders.push(`${rel} — ${what}`);
  }
  assert.deepEqual(
    offenders,
    [],
    'The Custom supplier plan was retired from the app on 2026-11-06 (owner: "from the app"). These files read it ' +
      'again. Ultra\'s add-ons are the way past Ultra — do not bring Custom back without the owner:\n  ' +
      offenders.join('\n  '),
  );
});

test('3b · every allowance still names the plan — a stale exemption is deleted, not kept', () => {
  for (const [rel, why] of Object.entries(ALLOWED)) {
    assert.ok(why.length > 40, `${rel}: an exemption must say why`);
    assert.ok(existsSync(join(WEB, rel)), `${rel} is gone — delete its exemption`);
    assert.match(code(readFileSync(join(WEB, rel), 'utf8')), /vendor_custom_/, `${rel} no longer names the plan — delete its exemption`);
  }
});

test('the scan bites — each pattern catches the shape it is for, and comments are not code', () => {
  const caught = (s: string) => READS.filter(([, re]) => re.test(code(s))).map(([w]) => w);
  assert.equal(caught(`const x = 'vendor_custom_base';`).length, 1);
  assert.equal(caught(`.from('vendor_custom_plans')`).length, 1);
  assert.equal(caught(`if (tier === 'custom') go();`).length, 1);
  assert.equal(caught(`v.tier_state === 'custom'`).length, 1);
  assert.equal(caught(`['solo', 'pro', 'enterprise', 'custom']`).length, 1);
  assert.equal(caught(`href="/vendor-dashboard/subscription/custom"`).length, 1);
  assert.equal(caught(`// the old 'vendor_custom_base' row\nconst y = 1;`).length, 0, 'a comment was read as code');
  assert.equal(caught(`/* tier === 'custom' */ const z = 2;`).length, 0, 'a block comment was read as code');
  // Not the plan: other features legitimately use the word "custom".
  assert.equal(caught(`if (type === 'custom') label();`).length, 0, 'an appointment type was mistaken for the plan');
  assert.equal(caught(`website: 'custom',`).length, 0);
  assert.equal(caught(`const current = 'a'; if (current === 'custom') x();`).length, 0, 'a paper-size picker was mistaken for the plan');
  assert.equal(caught(`const rank = t === 'custom' ? 3 : 0;`).length, 1);
});
