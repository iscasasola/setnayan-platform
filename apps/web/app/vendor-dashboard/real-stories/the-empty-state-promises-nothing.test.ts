/**
 * Supplier go-live audit (2026-11-02): the empty "Featured in Stories" page wore a literal "Coming soon" tag and
 * promised editorials "with the wedding season ahead". The page works today — it is simply empty until a couple
 * publishes — so its empty state says what will appear and when, and nothing else.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const code = stripComments(readFileSync(join(__dirname, 'page.tsx'), 'utf8'));

test('the empty Stories page carries no "Coming soon" tag and no season promise', () => {
  assert.doesNotMatch(code, /coming soon/i);
  assert.doesNotMatch(code, /data-coming-soon/);
  assert.doesNotMatch(code, /season ahead/i);
});

test('the empty state still says what appears here', () => {
  assert.match(code, /Your featured events will appear here\./);
});
