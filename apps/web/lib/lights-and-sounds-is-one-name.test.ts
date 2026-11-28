import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { WEDDING_TILE_LABEL } from './taxonomy';
import { HUB_TOOLS_SEED, nameKey, seedFor } from './hub-tools';
import { seedTileOf, unmappedSeedCategories } from './supplier-store';
import { PAY_PLAN_TEMPLATES } from './toolkit-templates';
import { PLAN_GROUPS } from './wedding-plan-groups';

/**
 * 🔊 ONE NAME FOR ONE CATEGORY (OLD-SMALL, MASTER-PLAN B18, 27 Nov 2026). Find showed "Lights & Sounds" (the live
 * taxonomy, owner-approved `TAXONOMY_PH_FULL_2026-11-07.md`, `WEDDING_TILE_LABEL.lights_sound`) while other screens
 * typed "Lights & Sound". The copies were not only words: the Hub-tools seed and the Toolkit templates MATCH BY NAME,
 * so "Lights & Sound" never met the live "Lights & Sounds" — those suppliers got the "Everything else" tools and no
 * template ever read as "for you".
 */

const WEB = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const THE_NAME = WEDDING_TILE_LABEL.lights_sound;

test('the one name is the taxonomy’s: Lights & Sounds', () => {
  assert.equal(THE_NAME, 'Lights & Sounds');
});

test('the Hub-tools seed and the Toolkit templates meet the live label', () => {
  const seed = seedFor(THE_NAME);
  assert.equal(seed.matched, true, 'a Lights & Sounds supplier fell back to "Everything else"');
  assert.ok(seed.row.tools.includes('tech_rider'));
  assert.ok(HUB_TOOLS_SEED.some((r) => r.category === THE_NAME));
  assert.equal(seedTileOf(THE_NAME), 'lights_sound');
  assert.ok(!unmappedSeedCategories().some((c) => nameKey(c).startsWith('lights and sound')), 'Lights & Sounds is listed as unmapped');
  for (const t of PAY_PLAN_TEMPLATES) {
    for (const c of t.forCategories) {
      if (nameKey(c).startsWith('lights and sound')) assert.equal(c, THE_NAME, `${t.name} tags “${c}”`);
    }
  }
});

test('the plan group says the taxonomy’s name', () => {
  const g = PLAN_GROUPS.find((x) => x.catalogTile === 'lights_sound');
  assert.ok(g, 'no plan group for lights_sound');
  assert.equal(g.label, THE_NAME);
});

/** Where a singular copy may stay: none of these are words a person reads as the category's name. */
const SKIP_DIRS = ['node_modules', '.next', `app${sep}dev`, 'scripts', 'tests', `lib${sep}blog-batches`];
// 🤝 Handed to the NEW account (MASTER-PLAN L10): the 3D booth sign sits beside the seat plan, which this lane never touches.
const HANDED_OVER = new Set([`app${sep}_components${sep}plan3d${sep}kit${sep}booth-templates.ts`]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(WEB, p);
    if (SKIP_DIRS.some((d) => rel === d || rel.startsWith(d + sep))) continue;
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|lab)\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('no screen types the singular “Lights & Sound” any more', () => {
  const singular = /lights\s*(?:&|and|&amp;)\s*sound(?!s)\b/i;
  const hits: string[] = [];
  for (const root of ['app', 'lib', 'components']) {
    for (const f of sourceFiles(join(WEB, root))) {
      const rel = relative(WEB, f);
      if (HANDED_OVER.has(rel)) continue;
      const code = stripComments(readFileSync(f, 'utf8'));
      code.split('\n').forEach((line, i) => {
        if (singular.test(line)) hits.push(`${rel}:${i + 1}`);
      });
    }
  }
  assert.deepEqual(hits, [], `say “${THE_NAME}” (WEDDING_TILE_LABEL.lights_sound)`);
});
