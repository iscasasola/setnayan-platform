/**
 * Guard: the quiet-start card stays a PORT, and stays out of the admin register.
 *
 * AP-12 asked that empty screens read as deliberate rather than unfinished, and
 * said explicitly: DO NOT DESIGN A NEW EMPTY STATE — the pattern already exists
 * on `app/dashboard/(account)/samahan`, PORT IT. So `<QuietStart>` reproduces
 * that card's marks exactly. This pins the marks, because the failure mode of a
 * port is that somebody "improves" it into a third register a month later.
 *
 * ⚠ AND IT PINS THE BOUNDARY WITH `<EmptyState>`, which already ships and is
 * CORRECT — for the ADMIN register. That one draws a terracotta ring, demands
 * `readPermitted: true`, and prints "Verified: read permitted · 0 rows", which
 * is engineering language on a screen a couple reads. Merging the two is the
 * likeliest wrong simplification here, so both directions are asserted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');

const strip = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

const QUIET = strip(readFileSync(join(HERE, 'quiet-start.tsx'), 'utf8'));

test('🎨 every mark is the samahan card’s, unchanged', () => {
  /* Measured off `(account)/samahan/page.tsx` before extraction. If a redesign
     is genuinely wanted, change it HERE deliberately — do not let it drift. */
  for (const mark of [
    /sn-tile p-8 text-center/,          // the card
    /h-8 w-8 text-ink\/35/,             // the muted glyph, NOT a terracotta ring
    /mt-4 text-sm font-semibold text-ink/, // the headline
    /mt-2 max-w-sm text-sm text-ink\/60/,  // the teaching sentence
  ]) {
    assert.match(QUIET, mark, `the ported card lost ${mark}`);
  }
});

test('⛔ it never grows the admin register’s audit line', () => {
  for (const forbidden of [/readPermitted/, /Verified:/, /0 rows/, /border-terracotta\/30/]) {
    assert.ok(
      !forbidden.test(QUIET),
      `QuietStart is drifting into <EmptyState>'s admin register (${forbidden}). ` +
        'Two registers, two components — a couple must never read an audit line.',
    );
  }
});

test('🚪 the samahan page renders through it rather than inline', () => {
  const samahan = strip(
    readFileSync(join(WEB, 'app/dashboard/(account)/samahan/page.tsx'), 'utf8'),
  );
  assert.match(samahan, /<QuietStart/, 'the pattern’s own page stopped using it');
  assert.ok(
    !/sn-tile p-8 text-center/.test(samahan),
    'the samahan page kept its inline copy of the card as well — one home, or ' +
      'the two drift apart, which is the whole reason this was extracted',
  );
});

test('📈 adoption only ever grows', () => {
  const files: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.tsx') && !p.includes('.test.')) files.push(p);
    }
  })(join(WEB, 'app'));

  const adopters = files.filter(
    (f) => !f.endsWith('quiet-start.tsx') && /<QuietStart/.test(strip(readFileSync(f, 'utf8'))),
  );
  assert.ok(
    adopters.length >= 4,
    `only ${adopters.length} screens wear the quiet-start card; 4 wore it when ` +
      'this shipped. A screen may only leave this list by being deleted — ' +
      'raise the floor when more adopt it, never lower it.',
  );
});
