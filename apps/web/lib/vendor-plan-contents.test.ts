/**
 * 🧮 PLAN CONTENTS — the admin-edited numbers over the code values (owner 2026-11-13, "Yes, add both").
 * The database half (the seed equals TIER_CAPS; an edit changes vendor_tier_limit()) is
 * tests/db/vendor-plan-contents.db.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TIER_CAPS, VENDOR_TIERS } from './vendor-tier-caps';
import {
  EDITABLE_PLAN_KEYS,
  applyPlanContents,
  codeValue,
  isLowering,
  parsePlanValue,
  planContentKeyDef,
} from './vendor-plan-contents';

test('no rows → exactly the code values (TIER_CAPS is the fallback)', () => {
  for (const t of VENDOR_TIERS) assert.deepEqual(applyPlanContents(t, []), TIER_CAPS[t]);
  assert.deepEqual(applyPlanContents('pro', null), TIER_CAPS.pro);
});

test('a stored number replaces the code value for that plan only; "no limit" only where allowed', () => {
  const caps = applyPlanContents('pro', [
    { plan: 'pro', key: 'agent_accounts', value: 4 },
    { plan: 'solo', key: 'agent_accounts', value: 99 }, // another plan's row is ignored
    { plan: 'pro', key: 'services_per_leaf', value: null }, // no limit — allowed here
    { plan: 'pro', key: 'branches_included', value: null }, // no limit — NOT allowed: the code value stands
    { plan: 'pro', key: 'nonsense', value: 1 },
    { plan: 'pro', key: 'parent_categories', value: -3 }, // malformed: ignored
  ]);
  assert.equal(caps.agentAccounts, 4);
  assert.equal(caps.servicesPerLeaf, Infinity);
  assert.equal(caps.branchesIncluded, TIER_CAPS.pro.branchesIncluded);
  assert.equal(caps.parentCategories, TIER_CAPS.pro.parentCategories);
  assert.equal(TIER_CAPS.pro.agentAccounts !== 4, true, 'TIER_CAPS itself was mutated');
});

test('an unknown tier reads as Free — like vendor_tier_limit()', () => {
  assert.equal(
    applyPlanContents('platinum', [{ plan: 'free', key: 'agent_accounts', value: 2 }]).agentAccounts,
    2,
  );
});

test('every editable key names a real TierCaps number, and the seed in the migration equals TIER_CAPS', () => {
  const sql = readFileSync(
    join(__dirname, '../../../supabase/migrations/20271344452857_vendor_plan_contents.sql'),
    'utf8',
  );
  let seeded = 0;
  for (const def of EDITABLE_PLAN_KEYS) {
    for (const t of VENDOR_TIERS) {
      assert.equal(typeof TIER_CAPS[t][def.capKey], 'number', `${def.capKey} is not a number cap`);
      const v = codeValue(t, def.capKey);
      const line = `('${t}', '${def.key}', ${v === null ? 'NULL' : v})`;
      assert.ok(sql.includes(line), `the seed does not say ${line}`);
      seeded += 1;
    }
  }
  assert.equal(seeded, EDITABLE_PLAN_KEYS.length * VENDOR_TIERS.length);
  assert.ok(seeded >= 35, `only ${seeded} seed rows checked`);
});

test('the typed value: whole numbers; "no limit" refused for the four the database serves', () => {
  const seats = planContentKeyDef('agent_accounts')!;
  const branches = planContentKeyDef('branches_included')!;
  assert.deepEqual(parsePlanValue(seats, ' 4 ', false), { ok: true, value: 4 });
  assert.deepEqual(parsePlanValue(seats, '', true), { ok: true, value: null });
  assert.equal(parsePlanValue(branches, '', true).ok, false);
  assert.equal(parsePlanValue(seats, '', false).ok, false);
  assert.equal(parsePlanValue(seats, '2.5', false).ok, false);
  assert.equal(parsePlanValue(seats, '-1', false).ok, false);
  assert.equal(parsePlanValue(seats, '99999', false).ok, false);
});

test('lowering: no limit counts as the most', () => {
  assert.equal(isLowering(5, 4), true);
  assert.equal(isLowering(5, 6), false);
  assert.equal(isLowering(null, 25), true);
  assert.equal(isLowering(5, null), false);
});
