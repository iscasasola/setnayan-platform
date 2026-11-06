/**
 * countNoun — a count with its noun, singular or plural by the count (quality sweep 2026-10-19 row C8: "1 CATEGORIES").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { countNoun } from './format-number';
import { stripComments } from './strip-comments';

test('only exactly one is singular', () => {
  assert.equal(countNoun(1, 'category', 'categories'), '1 category');
  assert.equal(countNoun(0, 'category', 'categories'), '0 categories');
  assert.equal(countNoun(2, 'category', 'categories'), '2 categories');
  assert.equal(countNoun(15, 'category', 'categories'), '15 categories');
});

test('the figure keeps its thousands comma', () => {
  assert.equal(countNoun(1240, 'category', 'categories'), '1,240 categories');
});

test('the plural is the one passed, never a guessed "s"', () => {
  assert.equal(countNoun(3, 'person', 'people'), '3 people');
  assert.equal(countNoun(1, 'person', 'people'), '1 person');
});

test('the Suppliers bench folder line counts its categories through countNoun — no bare "N categories" template', () => {
  const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
  const src = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx'), 'utf8'));
  // A template that prints a number straight before the plural noun is "1 categories" on a one-category folder.
  assert.doesNotMatch(src, /\$\{[^}]*\}\s+categories\b/, 'a count is printed before a fixed plural "categories" — one folder reads "1 categories"');
  assert.match(src, /countNoun\(\s*folder\.tiles\.length\s*,\s*'category'\s*,\s*'categories'\s*\)/, 'the folder line no longer counts its categories');
});
