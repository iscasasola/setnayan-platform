import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * suggested-never-applied.test.ts — C5's second ruling condition, held
 * structurally: nothing in the READ/TRIGGER side of the signup coverage
 * suggestion may write `vendor_profiles`. The only place that may EVER
 * add a suggested trade to a shop's coverage is
 * `applySuggestedCoverage` (`app/vendor-dashboard/shop/suggested-coverage-actions.ts`),
 * gated behind a signed-in shop admin pressing "Add" on a suggestion it was
 * actually shown.
 *
 * A comment can say "suggested, never applied" forever without it being
 * true — this asserts the shape instead of trusting the docblock.
 */

const GUARDED_FILES = [
  'lib/vendor-signup-coverage-suggest.ts',
  'lib/vendor-signup-coverage-suggest-flag.ts',
  'lib/vendor-signup-coverage-suggest-server.ts',
  'lib/vendor-signup-coverage-suggest-reader.ts',
];

const REPO_ROOT = path.resolve(__dirname, '..');

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('no file on the read/trigger side of C5 ever writes vendor_profiles', () => {
  for (const rel of GUARDED_FILES) {
    const full = path.join(REPO_ROOT, rel);
    assert.ok(fs.existsSync(full), `expected ${rel} to exist`);
    const stripped = stripComments(fs.readFileSync(full, 'utf8'));
    assert.doesNotMatch(
      stripped,
      /from\(\s*['"]vendor_profiles['"]\s*\)/,
      `${rel} must never touch vendor_profiles — suggested coverage is applied only by ` +
        'suggested-coverage-actions.ts, on an explicit shop-admin press',
    );
  }
});

test('the ONE writer of applied suggestions requires a picked key, never applies all', () => {
  const actionsFile = path.join(
    REPO_ROOT,
    'app/vendor-dashboard/shop/suggested-coverage-actions.ts',
  );
  const src = fs.readFileSync(actionsFile, 'utf8');
  assert.match(src, /from\(\s*['"]vendor_profiles['"]\s*\)/, 'the apply action must write vendor_profiles');
  // The picked keys must come from the FORM, not be inferred from every
  // suggestion the dossier produced.
  assert.match(src, /getAll\(\s*['"]trade_key['"]\s*\)/);
  assert.doesNotMatch(
    src,
    /pending\.suggestions\.map\(\(s\)\s*=>\s*s\.key\)/,
    'applying every suggestion without a pick would defeat "suggested, never applied"',
  );
});
