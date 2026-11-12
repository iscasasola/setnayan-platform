/**
 * NO HARD-CODED TAXONOMY — every group, category and service list reads the ONE
 * taxonomy (Admin › Categories), and no new copy can land.
 *
 * Owner, 26 Oct: Admin › Categories is "the foundation of all suppliers".
 * Owner, 9 Nov: "make sure the services are not hard coded and other codes that
 * should live based on the taxonomy."
 *
 * ── WHAT WENT WRONG ────────────────────────────────────────────────────────
 * The labels came from the database, but the KEYS did not: a 2026-11-09 audit
 * (spec corpus `plans/one_source_taxonomy_2026-11-09/00-AUDIT-AND-PLAN.md`)
 * found ~95 product files holding their own list of category / service slugs,
 * comparing against one category's name, or reading the seed constants
 * (`TAXONOMY_MAP`, `TILE_PARENT`, `WEDDING_*_LABEL`) where `getTaxonomy()`
 * belongs. Each one is a screen that does not follow an admin's rename, move or
 * new category — and every existing guard (`one-source-buckets`,
 * `one-word-per-category`, `shortlist-taxonomy-coverage`) fences ONE shape, so a
 * new copy in any other shape went green. Supplier Build 3's
 * `TAXONOMY_MAP[first]?.tile` in `lib/supplier-hero.server.ts` is the one that
 * prompted this: nothing failed.
 *
 * ── HOW IT HOLDS ───────────────────────────────────────────────────────────
 * `lib/taxonomy-literal-scan.ts` parses every product file with the TypeScript
 * compiler and reports three kinds (list · compare · import). The copies that
 * existed when this landed are in `no-taxonomy-literals.baseline.txt`, each with
 * a reason; that file may only SHRINK. A deliberate product list (a curated
 * "Popular" order, a privacy gate) keeps its line with its reason — it is a
 * decision, written down, not a silent copy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { currentCounts, readBaseline } from '../scripts/gen-taxonomy-literals-baseline';
import {
  AMBIGUOUS_SLUGS,
  SEED_OWNERS,
  isScannedPath,
  scanTaxonomyLiterals,
  taxonomyVocabulary,
} from '@/lib/taxonomy-literal-scan';

const WEB = join(import.meta.dirname, '..');
const REGEN = 'pnpm exec tsx scripts/gen-taxonomy-literals-baseline.ts';

const NOW = currentCounts();
const BASE = readBaseline();
const BASE_BY_KEY = new Map(BASE.map((r) => [`${r.file}\t${r.kind}`, r]));

test('the scan reads the tree and knows the vocabulary (a zero-file sweep is a green lie)', () => {
  const vocab = taxonomyVocabulary();
  assert.ok(vocab.size > 300, `vocabulary has only ${vocab.size} slugs`);
  for (const s of ['photo_video', 'catering', 'hmua', 'funeral_home']) assert.ok(vocab.has(s), `${s} missing from vocabulary`);
  const files = new Set([...NOW.keys()].map((k) => k.split('\t')[0]));
  assert.ok(files.size > 50, `only ${files.size} files have findings — the walk or the scanner is broken`);
  assert.ok(isScannedPath('lib/supplier-find.ts'));
  assert.ok(!isScannedPath('lib/taxonomy.ts'), 'the seed owns the taxonomy and must not be scanned');
  assert.ok(!isScannedPath('lib/supplier-find.test.ts'));
  assert.ok(!isScannedPath('app/dev/supplier-lab/page.tsx'));
});

test('the scanner goes red on each kind, and not on prose or on an ambiguous word', () => {
  const kinds = (src: string) => scanTaxonomyLiterals('x.ts', src).map((f) => f.kind);
  assert.deepEqual(kinds(`const A = ['catering', 'hmua', 'photo_video'];`), ['list']);
  assert.deepEqual(kinds(`const A = { catering: 1, hmua: 2, cake: 3 };`), ['list']);
  assert.deepEqual(kinds(`type T = 'catering' | 'hmua' | 'cake';`), ['list']);
  assert.deepEqual(kinds(`const R = [{ tile: 'catering' }, { tile: 'hmua' }, { tile: 'cake' }];`), ['list']);
  assert.deepEqual(kinds(`if (c === 'crew_meals') x();`), ['compare']);
  assert.deepEqual(kinds(`switch (c) { case 'florist': break; }`), ['compare']);
  assert.deepEqual(kinds(`s.has('photo_video');`), ['compare']);
  assert.deepEqual(kinds(`import { TAXONOMY_MAP } from '@/lib/taxonomy';`), ['import']);
  assert.deepEqual(kinds(`async function f() { const { TILE_PARENT } = await import('@/lib/taxonomy'); }`), ['import']);
  // Not a copy:
  assert.deepEqual(kinds(`import { type WeddingTile, getLabel } from '@/lib/taxonomy';`), []);
  assert.deepEqual(kinds(`import type { TAXONOMY_MAP } from '@/lib/taxonomy';`), []);
  assert.deepEqual(kinds(`// ['catering', 'hmua', 'photo_video'] and c === 'crew_meals'`), []);
  assert.deepEqual(kinds(`const A = ['catering', 'hmua'];`), [], 'two is a pair, not a list');
  assert.deepEqual(kinds(`if (role === 'coordinator') x();`), [], 'coordinator is also a member role');
  assert.deepEqual(kinds(`const P = ['reception', 'venue', 'catering'];`), [], 'needs two unambiguous slugs');
  for (const w of ['coordinator', 'reception', 'editorial', 'venue']) assert.ok(AMBIGUOUS_SLUGS.has(w));
});

test('🔑 no NEW hard-coded copy of the taxonomy', () => {
  const fresh: string[] = [];
  for (const [k, actual] of NOW) {
    const allowed = BASE_BY_KEY.get(k)?.count ?? 0;
    if (actual <= allowed) continue;
    const [file, kind] = k.split('\t') as [string, string];
    const where = scanTaxonomyLiterals(file, readFileSync(join(WEB, file), 'utf8'))
      .filter((f) => f.kind === kind)
      .map((f) => `    ${file}:${f.line}  ${f.text}`)
      .join('\n');
    fresh.push(`  ${file} — ${kind}: ${actual} (allowed ${allowed})\n${where}`);
  }
  assert.deepEqual(
    fresh,
    [],
    `a hard-coded copy of the service taxonomy appeared:\n${fresh.join('\n')}\n\n` +
      'Read the live taxonomy instead — `await getTaxonomy()` (lib/taxonomy-db.ts) and its ' +
      '`map` / `tileParent` / `tileLabel` / `folderOrder` / `hiddenCategories`, or the ' +
      'lib/coordinator-trade.ts helpers. If the list is a deliberate product choice (a curated ' +
      'order, a privacy gate), add ONE line to lib/no-taxonomy-literals.baseline.txt by hand ' +
      'with the reason — never by re-seeding.',
  );
});

test('the baseline may only SHRINK — a fixed copy must be struck off', () => {
  const stale: string[] = [];
  for (const r of BASE) {
    const actual = NOW.get(`${r.file}\t${r.kind}`) ?? 0;
    if (actual >= r.count) continue;
    if (r.reason.startsWith('PENDING')) continue; // an integrating PR's file — waits for it
    stale.push(`${r.file} ${r.kind}: baseline ${r.count}, now ${actual}`);
  }
  assert.deepEqual(stale, [], `stale baseline rows (a fixed copy re-permits itself): ${stale.join('; ')}. Run: ${REGEN}`);
});

test('every baseline row names a reason, and every seed owner exists', () => {
  for (const r of BASE) {
    assert.ok(['list', 'compare', 'import'].includes(r.kind), `bad kind on ${r.file}`);
    assert.ok(Number.isInteger(r.count) && r.count > 0, `bad count on ${r.file}`);
    assert.ok(r.reason.length > 10, `${r.file} has no reason`);
  }
  for (const f of Object.keys(SEED_OWNERS)) assert.ok(existsSync(join(WEB, f)), `seed owner ${f} is gone — update SEED_OWNERS`);
});

test('the rows moved on 2026-11-09 stay on the live taxonomy', () => {
  const src = (f: string) => readFileSync(join(WEB, f), 'utf8');
  const imports = (f: string) => scanTaxonomyLiterals(f, src(f)).filter((x) => x.kind === 'import');

  // Find a supplier — the search words come from the snapshot it is handed.
  assert.deepEqual(imports('lib/supplier-find-read.ts'), []);
  assert.match(src('lib/supplier-find-read.ts'), /servicesByTileFrom\(taxonomy\.map\)/);
  // The supplier sheet's "also does" chips — live labels.
  assert.deepEqual(imports('lib/supplier-sheet-read.ts'), []);
  assert.match(src('lib/supplier-sheet-read.ts'), /getTaxonomy\(\)/);
  // The front door's "What you run" group word — live group label (moved once #7416 landed).
  assert.deepEqual(imports('app/_components/frontdoor/data.ts'), []);
  // Since the shop card (#7454) the label comes from the shelf's one batched snapshot (`tax`), via folderLabelOf.
  assert.match(src('app/_components/frontdoor/data.ts'), /\btax\.folderLabel\[folder\]/);
  // /explore — the JSON-LD group list and the ?folder= filter read the live order.
  const explore = src('app/(shell)/explore/_lib/marketplace-view.tsx'); // 2026-11-12: the marketplace pipeline moved from explore/page.tsx to _lib/marketplace-view.tsx (shared with Discover)
  assert.match(explore, /buildVendorsItemListJsonLd\(vendorsSiteUrl, pageTax\)/);
  // 2026-11-12: parseFilters gained a third argument (the base address — `/explore` or Discover's `/`); the
  // live folder order is still what it is handed.
  assert.match(explore, /parseFilters\(raw, pageTax\.folderOrder, /);
});
