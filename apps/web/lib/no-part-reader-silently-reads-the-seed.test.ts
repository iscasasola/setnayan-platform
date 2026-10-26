/**
 * no-part-reader-silently-reads-the-seed.test.ts — 🌳 ③0-b, "one source for the parts" (owner 2026-10-26,
 * DECISION_LOG "APPROVED — BUILD THE TAXONOMY"; corpus prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md
 * § 8.3 ③0-b, audit A17).
 *
 * MEASURED BEFORE THIS: twelve exported helpers took the parts snapshot as `parts = fallbackInspirationParts()`.
 * Every caller that forgot it read the consts the table was seeded from — sign-off (`moodboard-finalization`),
 * supplier suggestions (`inspiration-suggestion-parts`, `suggestion-actions`) and the library's nav gate (five
 * vendor-dashboard files) — so an admin who re-homed, renamed or hid a part moved the couple's picker and the
 * upload gate but not those. The default is gone and `tsc` now refuses a call with no snapshot.
 *
 * THIS GUARD HOLDS THE TWO PROPERTIES `tsc` CANNOT:
 *   1 · no part helper DEFAULTS a snapshot to the seed again (a default param compiles happily);
 *   2 · the seed is named only where reading it is the point (audit class C, each with its reason below) — a server
 *       page that writes `fallbackInspirationParts()` to make a type error go away is the same leak with extra steps.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');

/** Where naming the seed is the point. Each line says why; adding a file here is a decision a reviewer sees. */
const MAY_NAME_THE_SEED: Readonly<Record<string, string>> = {
  'lib/inspiration-parts.ts': 'defines it',
  'lib/inspiration-parts-db.ts': 'the reader’s documented fallback when the read fails or finds nothing (held by inspiration-parts-seed-equals-the-consts.db.test.ts)',
  'lib/inspiration-parts-seed.ts': 'the seed IS generated from the consts',
  'lib/moodboard-finalization.ts': 'a module-load STRUCTURAL assert over two code maps — it runs before any request exists',
  'app/dev/supplier-lab/page.tsx': 'dev lab — reaches no database',
  'app/dev/supplier-lab/library-lab-server.ts': 'dev lab — reaches no database',
  'app/dev/details-lab/details-lab-node.tsx': 'dev lab — reaches no database (the-mood-board-lab-cannot-reach-the-database.test.ts)',
  'app/dev/categories-lab/page.tsx': 'dev lab (404 in production) — signed out, the parts read is refused, so the lab draws the seed and says so on the page',
};

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.test-helper\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = [...sources(join(WEB, 'lib')), ...sources(join(WEB, 'app'))].map((p) => ({
  rel: relative(WEB, p),
  code: stripComments(readFileSync(p, 'utf8')),
}));

test('1 · no helper defaults a parts snapshot to the seed', () => {
  assert.ok(FILES.length > 500, `only ${FILES.length} source files were read — the walk is broken, not the guard`);
  const offenders = FILES.filter((f) => /=\s*fallbackInspirationParts\s*\(\s*\)\s*[,)]/.test(f.code)).map((f) => f.rel);
  assert.deepEqual(offenders, [], `a parts snapshot defaults to the seed again — make it a required argument and pass await getInspirationParts(): ${offenders.join(', ')}`);
});

test('2 · the seed is named only where reading it is the point', () => {
  const naming = FILES.filter((f) => /\bfallbackInspirationParts\s*\(/.test(f.code)).map((f) => f.rel).sort();
  assert.ok(naming.includes('lib/inspiration-parts-db.ts'), 'premise: the reader names its fallback — the scan is not seeing code');
  const stray = naming.filter((rel) => !(rel in MAY_NAME_THE_SEED));
  assert.deepEqual(stray, [], `these read the seed instead of the live parts — pass await getInspirationParts(): ${stray.join(', ')}`);
  const stale = Object.keys(MAY_NAME_THE_SEED).filter((rel) => !naming.includes(rel));
  assert.deepEqual(stale, [], `allowlisted but no longer naming the seed — drop the line: ${stale.join(', ')}`);
});
