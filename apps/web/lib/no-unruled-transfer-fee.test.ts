/**
 * no-unruled-transfer-fee.test.ts — the pay page quoted a bank charge nobody ruled.
 *
 * The pay page told a couple that sending to BDO from another bank "usually costs
 * you" a peso range, and that GCash to GCash is free. Setnayan does not set or
 * charge that fee; no owner ruling stands behind the figure (owner, 16 Nov 2026:
 * remove it until it is set). This guard keeps that sentence out of the pay page
 * in any spelling: the entity form, a real dash, or "to".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAY_PANEL = join(__dirname, '..', 'app', 'pay', '[reference]', '_components', 'pay-panel.tsx');

/** Strip comments so an explanatory note never counts as the copy. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FEE_RANGE = /₱\s*10\s*(?:&ndash;|–|-|to)\s*₱?\s*15/i;
const TRANSFER_FEE = /transfer\s+fee/i;

test('the pay page still exists where this guard looks', () => {
  const src = readFileSync(PAY_PANEL, 'utf8');
  assert.ok(src.includes('Save the code to your photos'), 'anchor sentence moved — re-point this guard');
});

test('the pay page quotes no bank transfer fee range', () => {
  const body = stripComments(readFileSync(PAY_PANEL, 'utf8'));
  assert.equal(FEE_RANGE.test(body), false, 'an unruled ₱10–₱15 fee range is back on the pay page');
  assert.equal(TRANSFER_FEE.test(body), false, 'a "transfer fee" claim is back on the pay page');
});
