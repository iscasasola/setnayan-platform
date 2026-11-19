/**
 * a-refused-plan-read-is-not-free.test.ts — the Plan screen keeps the error of the read that names the plan.
 *
 * THE DEFECT (supplier dashboard audit, 2026-11-17): `let { data: tierRow } = await readTierRow();` dropped the error.
 * A refused read left `tierRow` null, `asVendorTier(undefined)` answered 'free', and a paying Pro/Ultra shop read
 * "You are on Free · nothing to pay" in the Plan screen and in the Shop ⚙ fold that mounts it.
 * A source scan with comments stripped, the same shape as `the-plan-is-rows.test.ts` beside it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const SRC = stripComments(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '_components', 'plan-screen.tsx'), 'utf8'),
);

test('the first tier read is never destructured without its error', () => {
  assert.doesNotMatch(SRC, /\{\s*data:\s*tierRow\s*\}\s*=\s*await readTierRow\(\)/);
});

test('a refused tier read draws "Couldn\'t load your plan", before any row', () => {
  const at = SRC.indexOf('if (firstTierRead.error)');
  assert.ok(at > 0, 'the plan screen checks the first tier read');
  assert.ok(at < SRC.indexOf('asVendorTier('), 'it checks before the tier becomes a plan');
  assert.match(SRC.slice(at, at + 600), /data-plan-unread=""/);
});
