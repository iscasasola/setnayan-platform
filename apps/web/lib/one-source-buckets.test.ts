/**
 * ONE SOURCE · BUCKETS — no product file reads the tile → services buckets from the const.
 *
 * ③0-a (corpus `prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md` § 8.3). Product code
 * awaits `getCanonicalBuckets()` (the live taxonomy) and calls `servicesInTile` /
 * `servicesInFolder` / `servicesForPlanGroup`. The const answer — `canonicalServicesForTile` and
 * `fallbackCanonicalBuckets` — is blind to every admin edit after the seed
 * (`tests/db/one-source-buckets.db.test.ts` proves that), so a new product importer of it is a new
 * surface that ignores /admin/categories. This fails it, by FILE.
 *
 * The allowlist only shrinks. Each line says why it is still here and what removes it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { CONST_BUCKET_READERS } from './taxonomy-surfaces-agree';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

const CONST_SYMBOLS = ['canonicalServicesForTile', 'fallbackCanonicalBuckets'] as const;

/** Product files still allowed to read the const buckets — each with its exit. ONE list, shared with the page's
 *  runtime "Surfaces disagreeing" line (lib/taxonomy-surfaces-agree.ts), which names these files when they disagree. */
const ALLOWED: Readonly<Record<string, string>> = CONST_BUCKET_READERS;

/** Dev labs and fixtures are not shipped to anybody (audit B4). */
const isDevOnly = (rel: string) => rel.startsWith(`app${sep}dev${sep}`) || rel.startsWith('app/dev/');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** The names a file imports from lib/vendor-counts (any path spelling). */
function importedFromVendorCounts(src: string): string[] {
  const names: string[] = [];
  const re = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"](?:@\/lib\/|\.\.?\/(?:[\w.-]+\/)*)vendor-counts['"]/g;
  for (const m of src.matchAll(re)) {
    for (const part of m[1]!.split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]!.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

test('the import scan actually sees imports (anchor)', () => {
  const src = readFileSync(join(WEB, 'lib/moodboard-gallery.ts'), 'utf8');
  assert.ok(
    importedFromVendorCounts(src).includes('canonicalServicesForTile'),
    'the scanner no longer recognises the import in an allowlisted file — it would pass vacuously',
  );
  const page = readFileSync(join(WEB, 'app/dashboard/[eventId]/vendors/page.tsx'), 'utf8');
  assert.ok(importedFromVendorCounts(page).includes('getCanonicalBuckets'), 'anchor: the Suppliers page reads the live buckets');
});

test('no product file outside the allowlist reads the const tile → services buckets', () => {
  const offenders: string[] = [];
  for (const file of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const rel = relative(WEB, file).split(sep).join('/');
    if (rel in ALLOWED || isDevOnly(rel)) continue;
    const used = importedFromVendorCounts(readFileSync(file, 'utf8')).filter((n) =>
      (CONST_SYMBOLS as readonly string[]).includes(n),
    );
    if (used.length) offenders.push(`${rel}: ${used.join(', ')}`);
  }
  assert.deepEqual(
    offenders,
    [],
    '\nThese files read the CONST buckets, so they ignore every category / service an admin adds or moves.\n' +
      'Await getCanonicalBuckets() and call servicesInTile / servicesInFolder / servicesForPlanGroup instead.\n  ' +
      offenders.join('\n  '),
  );
});

test('the allowlist is self-cleaning — a file that stopped reading the const must leave it', () => {
  const stale = Object.keys(ALLOWED).filter((rel) => {
    if (rel === 'lib/vendor-counts.ts') return false;
    const used = importedFromVendorCounts(readFileSync(join(WEB, rel), 'utf8'));
    return !used.some((n) => (CONST_SYMBOLS as readonly string[]).includes(n));
  });
  assert.deepEqual(stale, [], `stale ALLOWED entries — delete them: ${stale.join(', ')}`);
});

test('the module-load constants and the hand list are gone for good', () => {
  // Comments stripped: the docblock may name what was deleted; the code may not hold it.
  const counts = stripComments(readFileSync(join(WEB, 'lib/vendor-counts.ts'), 'utf8'));
  for (const gone of ['CANONICAL_SERVICES_BY_TILE', 'CANONICAL_SERVICES_BY_FOLDER', 'TAXONOMY_MAP', "'filipiniana_barongs'"]) {
    assert.ok(!counts.includes(gone), `lib/vendor-counts.ts holds ${gone} again — a second derivation beside the reader`);
  }
  const tax = readFileSync(join(WEB, 'lib/taxonomy.ts'), 'utf8');
  assert.ok(!/export const FILIPINIANA_BARONG_CANONICALS/.test(tax), 'the Filipiniana hand list is back — cross-list through secondary_tiles');
});
