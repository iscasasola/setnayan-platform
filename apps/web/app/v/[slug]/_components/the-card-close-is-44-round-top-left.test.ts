/**
 * ✖️ THE SERVICE CARD FULL SCREEN'S ✕ IS 44px, ROUND, TOP LEFT — DECISION_LOG 2026-11-15 "ONE CLOSE BUTTON FOR EVERY FULL
 * SCREEN: A 44px ROUND ✕, TOP LEFT, DARK GLASS WITH AN IVORY RING" (names "the service card full screen"). W1, 15 Nov:
 * it measured 40px (`h-10 w-10`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const SHEET = stripComments(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'service-details-sheet.tsx'), 'utf8'));

test('the ✕ is 44 × 44 and round', () => {
  const btn = SHEET.match(/const roundBtn = `([^`$]*)/)?.[1] ?? '';
  assert.match(btn, /\bh-11\b/, 'the ✕ is not 44px tall');
  assert.match(btn, /\bw-11\b/, 'the ✕ is not 44px wide');
  assert.match(btn, /\brounded-full\b/, 'the ✕ is not round');
  assert.doesNotMatch(btn, /\b[hw]-(?:[0-9]|10)\b/, 'a smaller size is still on the ✕');
});

test('the ✕ is the first thing in the top bar — top left', () => {
  const bar = SHEET.slice(SHEET.indexOf('data-grown-bar='));
  const first = bar.indexOf('<button');
  assert.ok(first > 0, 'the bar has no button');
  assert.match(bar.slice(first, bar.indexOf('</button>', first)), /onClick=\{close\} aria-label="Close" className=\{roundBtn\}/, 'the first button in the bar is not the close');
  assert.match(SHEET, /className="absolute inset-x-0 top-0 z-\[4\] flex items-center gap-2 px-4/, 'the bar left the top');
});
