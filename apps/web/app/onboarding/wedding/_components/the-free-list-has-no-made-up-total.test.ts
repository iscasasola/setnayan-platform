/**
 * ⚖ Owner tracker d12 (2026-10-02): *"keep the list, drop the ₱ and hours total
 * … this is not a real measurement."* The free-tools block on Your Plan used to
 * open with ~₱63.5K + ~290 hours summed from `FREE_TOOL_DRIVERS`, a table with
 * no cited source for any row (corpus FREE_TOOLS_MARKET_VALUE_2026-10-02.md).
 *
 * 🔑 THE PROPERTY: the free list carries NO money and NO hours — not as a total,
 * not per card. A value line may return only with cited figures, and that is a
 * new decision, not a revert of this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(process.cwd(), 'app/onboarding/wedding/_components/onboarding-shell.tsx'),
  'utf8',
);
const code = SRC.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

function block(startRe: RegExp): string {
  const m = startRe.exec(code);
  assert.ok(m, `could not find ${startRe}`);
  const from = m.index;
  const end = code.indexOf('\n}\n', from);
  return code.slice(from, end === -1 ? undefined : end);
}

test('the free list is labels and blurbs only — no money, no hours', () => {
  const list = /const FREE_TOOLS: ReadonlyArray<FreeTool> = \[([\s\S]*?)\n\];/.exec(code);
  assert.ok(list, 'the FREE_TOOLS list must exist (the list itself is kept)');
  const rows = list[1]!.split('\n').filter((l) => l.includes("key: '"));
  assert.ok(rows.length >= 10, `the list must still be there — found ${rows.length} rows`);
  for (const r of rows) {
    assert.doesNotMatch(r, /\b(money|hours|vsRole)\s*:/, `a free-tool row carries a made-up figure: ${r.trim()}`);
  }
});

test('the Your Plan block renders no ₱ and no hours', () => {
  const slider = block(/function FreeValueSlider\(/);
  assert.doesNotMatch(slider, /₱|prefix="₱"|pesoB\(|hours|CountUp/, 'the free block prints a total again');
  assert.match(slider, /Everything you get · free/, 'the headline words stay');
});

test('nothing sums the old drivers anywhere in the shell', () => {
  assert.doesNotMatch(code, /FREE_TOOL_DRIVERS|computeOnboardingSavings|grandMoney/);
});
