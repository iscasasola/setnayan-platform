/**
 * The per-field match lines on Payments to confirm say what the photo showed, and never decide (owner 17 Nov 2026).
 * SABOTAGE (run 2026-11-16): mapping `null` to 'mismatch' turns test 2 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { receiptMatchLines } from './receipt-match-lines';

const base = { status: 'ok' as const, seen_references: ['9031 2284 117'], seen_amounts: [1990] };

test('1 · a clean read says Matches ✓ per field; a mismatch names the field and what the photo shows', () => {
  assert.deepEqual(
    receiptMatchLines({ ...base, reference_matches: true, amount_matches: true }).map((l) => l.text),
    ['Matches ✓', 'Matches ✓'],
  );
  const lines = receiptMatchLines({ ...base, reference_matches: true, amount_matches: false });
  assert.equal(lines[1]!.tone, 'mismatch');
  assert.match(lines[1]!.text, /^Doesn’t match: amount · the photo shows ₱1,990\.00$/);
});

test('2 · a field the reader could not answer is never a mismatch, and a failed read draws no lines', () => {
  const lines = receiptMatchLines({ ...base, reference_matches: null, amount_matches: null });
  assert.deepEqual(lines.map((l) => l.tone), ['unknown', 'unknown']);
  assert.deepEqual(receiptMatchLines({ ...base, status: 'failed', reference_matches: null, amount_matches: null }), []);
  assert.deepEqual(receiptMatchLines(undefined), []);
});

test('3 · the lines decide nothing — the helper imports no action and confirms nothing', () => {
  const src = readFileSync(path.join(import.meta.dirname, 'receipt-match-lines.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(src, /import\s/);
  assert.doesNotMatch(src, /approve|confirm\(/i);
});
