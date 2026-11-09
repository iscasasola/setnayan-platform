/**
 * 🔁 The card row's switch refusal gets its own line (owner screenshot 10 Nov, "Toggle issue").
 * StayForm prints a refused save as a SIBLING of its form — inside the services list that is a flex child of the card
 * row, which crushed the card into a one-word column. The row must wrap and push `[data-stay-error]` to a full line.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '_components', 'services-manager.tsx'), 'utf8');

test('the card row wraps and gives a refusal its own full-width line', () => {
  const row = src.match(/<div className="(flex [^"]*gap-3 p-4[^"]*)">\s*<div className="min-w-0 flex-1 space-y-2">/);
  assert.ok(row, 'the card row was not found — re-anchor this guard');
  const cls = row![1]!;
  assert.match(cls, /\bflex-wrap\b/, 'the row must wrap');
  assert.match(cls, /\[&>\[data-stay-error\]\]:basis-full/, 'the refusal must take the full width');
  assert.match(cls, /\[&>\[data-stay-error\]\]:order-last/, 'the refusal must sit under the card');
});

test('StayForm still prints its refusal with the data-stay-error hook this row targets', () => {
  const stay = readFileSync(join(__dirname, '..', '..', '_components', 'stay-form.tsx'), 'utf8');
  assert.match(stay, /data-stay-error=\{door\}/);
});
