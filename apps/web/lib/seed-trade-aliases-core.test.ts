/**
 * GUARD — the pure/testable half of scripts/seed-trade-aliases.ts (C2,
 * 2026-08-28). Split into lib/ specifically so this file runs in CI —
 * test:unit globs lib/** and app/** ONLY; a test dropped under scripts/
 * would silently never execute (see the module's own docblock).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { humanize, parseProposals, type LiveTrade } from './seed-trade-aliases-core';

const BATCH: LiveTrade[] = [
  { key: 'sorbetes_cart', label: 'Sorbetes Cart', branchLabel: 'Food Cart', folderLabel: 'Booths, carts & bars' },
  { key: 'generator_rental', label: 'Generator Rental', branchLabel: 'Outdoor', folderLabel: 'Styling, flowers & lights' },
];

test('humanize turns a snake_case key into Title Case', () => {
  assert.equal(humanize('generator_rental'), 'Generator Rental');
});

test('a clean, well-shaped model reply parses fully', () => {
  const text = JSON.stringify([
    { key: 'sorbetes_cart', aliases: ['sorbetero', 'ice cream vendor'] },
    { key: 'generator_rental', aliases: ['genset', 'kuryente generator'] },
  ]);
  const out = parseProposals(text, BATCH);
  assert.equal(out.length, 2);
  assert.deepEqual(
    out.find((p) => p.key === 'sorbetes_cart')?.aliases,
    ['sorbetero', 'ice cream vendor'],
  );
});

test('a reply wrapped in prose is still found — the model does not always obey "JSON only"', () => {
  const text = `Sure, here it is:\n\n${JSON.stringify([{ key: 'sorbetes_cart', aliases: ['sorbetero'] }])}\n\nHope this helps!`;
  const out = parseProposals(text, BATCH);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.key, 'sorbetes_cart');
});

test('a proposal naming a trade NOT in the batch is dropped — the model must not invent one', () => {
  const text = JSON.stringify([
    { key: 'sorbetes_cart', aliases: ['sorbetero'] },
    { key: 'made_up_trade', aliases: ['whatever'] },
  ]);
  const out = parseProposals(text, BATCH);
  assert.equal(out.length, 1);
  assert.ok(!out.some((p) => p.key === 'made_up_trade'));
});

test('non-string, too-short and too-long alias entries are filtered, not just the whole row', () => {
  const text = JSON.stringify([
    {
      key: 'sorbetes_cart',
      aliases: ['sorbetero', 'x', 123, '  ', 'a'.repeat(81), 'ok phrase'],
    },
  ]);
  const out = parseProposals(text, BATCH);
  assert.deepEqual(out[0]!.aliases, ['sorbetero', 'ok phrase']);
});

test('a proposal with zero survivable aliases after filtering is dropped entirely', () => {
  const text = JSON.stringify([{ key: 'sorbetes_cart', aliases: ['x', 'y'] }]);
  const out = parseProposals(text, BATCH);
  assert.equal(out.length, 0);
});

test('malformed JSON, an empty string, and a non-array top level all return [] rather than throwing', () => {
  assert.deepEqual(parseProposals('not json at all {{{', BATCH), []);
  assert.deepEqual(parseProposals('', BATCH), []);
  assert.deepEqual(parseProposals(JSON.stringify({ key: 'sorbetes_cart' }), BATCH), []);
});

test('a row missing "aliases" entirely, or with a non-array aliases, is skipped', () => {
  const text = JSON.stringify([{ key: 'sorbetes_cart' }, { key: 'generator_rental', aliases: 'not an array' }]);
  assert.deepEqual(parseProposals(text, BATCH), []);
});
