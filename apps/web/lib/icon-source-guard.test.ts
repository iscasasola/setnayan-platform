/**
 * icon-source-guard.test.ts — `lint-icon-source` counts every icon-library import outside the one
 * icon map, spares the map and the guest Event Hub, and ratchets only downward (brand refresh step 3,
 * owner 2026-10-26). The repo-wide run is the CI step (`Lint icon source`, blocking aggregator).
 *
 * 🛡 Sabotage (watched before this shipped): adding `import { Heart } from 'lucide-react';` to
 * app/_components/icon/icon.tsx turned the CLI red (exit 1) naming that file and line; reverting it
 * turned it green with the baseline byte-unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BASELINE_PATH,
  MIN_FILES,
  NOT_SCANNED,
  THE_MAP,
  compare,
  countOf,
  formatBaseline,
  iconImports,
  namesIn,
  parseBaseline,
  scan,
} from '../scripts/lint-icon-source.mjs';

test('every name imported from an icon library counts — value, type, namespace, dynamic', () => {
  assert.equal(namesIn('{ Users, Store as Shop }'), 2);
  assert.equal(namesIn('type { LucideIcon }'), 1);
  assert.equal(namesIn('* as Icons'), 1);
  assert.equal(namesIn('Default, { A, B }'), 3);
  const src = [
    "import { Users,",
    "  Store } from 'lucide-react';",
    "import type { LucideIcon } from 'lucide-react';",
    "import { Add } from '@carbon/icons-react';",
    "import { ArrowLeft } from '@carbon/icons-react/es/arrow--left';",
    "export { X } from 'lucide-react';",
    "const L = await import('lucide-react');",
  ].join('\n');
  assert.equal(countOf(iconImports(src)), 7);
});

test('other imports, comments and `icon-source-ok` lines do not count', () => {
  const src = [
    "import React from 'react';",
    "// import { Users } from 'lucide-react';",
    "/* import { Store } from 'lucide-react'; */",
    "import { glyph } from './lucide-react-notes';",
    "import { Apple } from 'lucide-react'; // icon-source-ok: brand mark the map has no role for yet",
  ].join('\n');
  assert.equal(countOf(iconImports(src)), 0);
});

test('the one map and the guest Event Hub are not counted', () => {
  assert.equal(THE_MAP, 'app/_components/icon/icon-map.ts');
  assert.ok(NOT_SCANNED.some((re: RegExp) => re.test(THE_MAP)));
  assert.ok(NOT_SCANNED.some((re: RegExp) => re.test('app/[slug]/_components/rsvp-sheet.tsx')));
  assert.ok(!NOT_SCANNED.some((re: RegExp) => re.test('app/_components/icon/icon.tsx')), 'the wrapper is scanned');
});

test('the ratchet: a rise fails, holding or falling passes, a new file may import none', () => {
  const baseline = { 'a.tsx': 3 };
  assert.deepEqual(compare({ 'a.tsx': 3 }, baseline), []);
  assert.deepEqual(compare({ 'a.tsx': 2 }, baseline), []);
  assert.deepEqual(compare({ 'a.tsx': 4 }, baseline), [{ rel: 'a.tsx', count: 4, allowed: 3 }]);
  assert.deepEqual(compare({ 'b.tsx': 1 }, baseline), [{ rel: 'b.tsx', count: 1, allowed: 0 }]);
  assert.deepEqual(parseBaseline(formatBaseline({ 'apps/web/app/(x)/y.tsx': 4 })), { 'apps/web/app/(x)/y.tsx': 4 });
});

test('the committed baseline matches the tree; the map imports, the seams do not', () => {
  const { files, counts, mapImports } = scan();
  assert.ok(files >= MIN_FILES, `scanned ${files} files — the walk has gone blind`);
  assert.ok(mapImports > 200, `the map imports only ${mapImports} icons — the matcher or the map broke`);
  const baseline = parseBaseline(readFileSync(BASELINE_PATH, 'utf8'));
  assert.ok(Object.keys(baseline).length > 1000, 'the baseline is suspiciously empty');
  assert.deepEqual(compare(counts, baseline), [], 'a file imports more icons than the baseline allows');
  for (const seam of [
    'lib/nav-icons.ts',
    'lib/nav-line-icon.ts',
    'app/_components/nav/nav-icon-component.tsx',
    'app/_components/nav/dynamic-icon.tsx',
    'app/features/_icons.ts',
    'app/_components/icon/icon.tsx',
    'app/_components/icon/legacy-icon-names.ts',
  ]) {
    assert.equal(counts[`apps/web/${seam}`], undefined, `${seam} must read icons through the map`);
  }
});
