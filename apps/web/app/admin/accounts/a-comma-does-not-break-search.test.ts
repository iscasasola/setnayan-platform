/**
 * A8·D-8 (final check 25 Nov). A comma in the Users or Venues search ("Dela Cruz, Maria") broke the PostgREST `.or()`
 * filter: the read was refused and the tab said "Couldn't read". The Events tab already sanitised the term
 * (`eventWordFilters` → `sanitizeIlikeTerm`); Users and Venues now do too. Behaviour of the sanitiser + wiring.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { sanitizeIlikeTerm } from '@/lib/ugat/data-pure';

const here = dirname(fileURLToPath(import.meta.url));

test('the sanitiser removes the characters that split an .or() filter', () => {
  const t = sanitizeIlikeTerm('Dela Cruz, Maria (Ria)');
  assert.doesNotMatch(t, /[(),"]/);
  assert.equal(t, 'Dela Cruz Maria Ria');
});

for (const file of ['_surfaces/users-surface.tsx', '_surfaces/venues-surface.tsx']) {
  test(`${file}: the .or() filter is built from the sanitised term, never the raw query`, () => {
    const src = stripComments(readFileSync(resolve(here, file), 'utf8'));
    assert.match(src, /const term = sanitizeIlikeTerm\(q\)/);
    const ors = [...src.matchAll(/\.or\(\s*`([^`]*)`/g)].map((m) => m[1] ?? '').filter((f) => f.includes('ilike'));
    assert.ok(ors.length > 0);
    for (const f of ors) {
      assert.doesNotMatch(f, /\$\{q\}/, `raw query in ${f}`);
      assert.match(f, /\$\{term\}/);
    }
  });
}
