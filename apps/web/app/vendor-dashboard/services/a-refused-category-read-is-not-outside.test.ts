/**
 * a-refused-category-read-is-not-outside.test.ts — the shop's own categories keep their failure.
 *
 * THE DEFECT (supplier dashboard audit, 2026-11-17): `fetchVendorCoverages(...).catch(() => [])` read a refusal as
 * "this shop covers nothing". Every card then carried "not in what you do", and "Your coverage" said "Nothing yet".
 * Also: `decodeURIComponent(search.error)` decoded an already-decoded param and threw on a bare `%`.
 * Source scan, comments stripped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANAGER = stripComments(readFileSync(join(HERE, '_components', 'services-manager.tsx'), 'utf8'));
const PANEL = stripComments(readFileSync(join(HERE, '_components', 'coverage-panel.tsx'), 'utf8'));

test('a refused coverage read is null, not []', () => {
  assert.doesNotMatch(MANAGER, /fetchVendorCoverages\([^)]*\)\.catch\(\(\) => \[\]\)/);
  assert.match(MANAGER, /const coveragesUnread = vendorCoveragesRead === null;/);
});

test('no card says "not in what you do" from an unread list', () => {
  const calls = MANAGER.match(/\{[^{}]*cardIsOutsideCoverage\(/g) ?? [];
  assert.ok(calls.length >= 1, 'the outside line is still drawn somewhere');
  for (const c of calls) assert.match(c, /!coveragesUnread &&/, `ungated: ${c}`);
});

test('the coverage panel says it could not load, before "Nothing yet"', () => {
  assert.match(MANAGER, /coveragesUnread=\{coveragesUnread\}/);
  const unread = PANEL.indexOf('data-coverage-unread=""');
  assert.ok(unread > 0 && unread < PANEL.indexOf('Nothing yet'));
});

test('the error banner never double-decodes', () => {
  assert.doesNotMatch(MANAGER, /\{decodeURIComponent\(search\.error\)\}/);
});

test('an unread list draws no parent count and no picker (review, 19 Nov)', () => {
  // "Parents 0 of N" came from `[]`, and the browse drew every category as not picked.
  const count = PANEL.match(/\{coveragesUnread \? null : \(\s*<span[^>]*data-coverage-parent-count=""/);
  assert.ok(count, 'the parent count is drawn from an unread list');
  assert.equal((PANEL.match(/formatCount\(parentUsage\.used\)/g) ?? []).length, 1, 'a second, ungated count');
  const browse = PANEL.match(/<CoverageBrowse\b/g) ?? [];
  assert.equal(browse.length, 1);
  assert.match(PANEL, /\{coveragesUnread \? null : \(\s*<CoverageBrowse\b/, 'the picker is drawn from an unread list');
});
