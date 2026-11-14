/**
 * the-old-hub-plan-name-is-gone.test.ts — THE COUPLE'S PLAN IS CALLED WHAT THE CATALOGUE CALLS IT (RW-306, 2026-11-14).
 *
 * Owner, 13 Nov 2026: couples see Free · Event Plus · Event Pro · Event Ultra. The plan sold as `COUPLE_WEBSITE_PRO` was
 * called "Event Hub Pro" / "Event Hub PRO" for months, and after the rename the live site still showed the old name on
 * screens nobody had swept (RW-306, live `d71f4db`). Nothing failed, because words are not code.
 *
 * Two properties, held here:
 *   1. NO FILE under apps/web — screen copy, labels, catalogue maps, tests, comments — names the old plan. A comment is
 *      read by the next session and copied back into copy, so comments count too. Migrations (outside apps/web) are
 *      history and are never edited.
 *   2. EVERY HAND-TYPED NAME OF THE PLAN EQUALS THE CATALOGUE'S TITLE — read from the repo's one mirror of the live
 *      catalogue (`lib/llms-txt-guard-input.ts`, whose own rule is "import this, do not paste rows"). When the owner
 *      renames the plan in the catalogue and the mirror follows, every typed copy below fails until it follows too.
 *
 * MUTATION: type "Event Hub Pro" into any app/ or lib/ file (a string or a comment) → test 1 fails, naming file:line.
 * Change `PLAN_NAME.pro`, the editorial "Powered by" label, the Studio tile's label or the App Store name to anything
 * but the catalogue title → test 2 fails.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RETAIL } from './llms-txt-guard-input';
import { PLAN_NAME } from './plan-buy-doors';
import { EVERY_ADD_ON } from './add-ons-catalog';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SELF = 'lib/the-old-hub-plan-name-is-gone.test.ts';
/** The old name in any spelling a person or a comment has used: "Event Hub Pro", "EVENT HUB PRO", "Event\n * Hub Pro". */
const OLD_NAME = /\bEvent[\s*/]+Hub\s+Pro\b/gi;

const rel = (f: string) => relative(WEB, f).split(sep).join('/');
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs|cjs|js|css|md|json|txt)$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * The ONE allowance — admin-managed DATA, not our copy (controller, RW-306: "leave the catalogue's own part titles
 * alone"). The off-sale part rows of `platform_retail_catalog_v2` are still titled "Event Hub Pro · …" in production,
 * and the catalogue mirror must equal production row for row. Only a COUPLE_HUB_PART_* row of that mirror is excused;
 * the day the catalogue retitles its parts, the mirror follows and this allowance stops matching anything (test 1b).
 */
const CATALOGUE_DATA: ReadonlyArray<{ file: string; row: RegExp }> = [
  { file: 'lib/llms-txt-guard-input.ts', row: /^\s*\{ service_code: 'COUPLE_HUB_PART_[A-Z_]+', title: 'Event Hub Pro · [^']+', retail_price_php: \d+, is_active: (?:true|false) \},$/ },
];

const CATALOGUE_TITLE = RETAIL.find((r) => r.service_code === 'COUPLE_WEBSITE_PRO')?.title ?? null;

test('0 · the catalogue mirror names the plan — or every comparison below is against nothing', () => {
  assert.ok(CATALOGUE_TITLE, 'COUPLE_WEBSITE_PRO is not in lib/llms-txt-guard-input.ts — re-point this guard');
  assert.doesNotMatch(CATALOGUE_TITLE!, OLD_NAME, 'the catalogue mirror itself still carries the old name');
});

test('1 · no file under apps/web names the old Hub plan (copy, labels, tests and comments alike)', () => {
  const files = ['app', 'lib', 'components', 'tests', 'scripts'].flatMap((d) => {
    try {
      return walk(join(WEB, d));
    } catch {
      return [];
    }
  });
  assert.ok(files.length > 3000, `only ${files.length} files walked — the scan is blind`);
  const offenders: string[] = [];
  for (const f of files) {
    if (rel(f) === SELF) continue;
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(OLD_NAME)) {
      const line = text.slice(0, m.index).split('\n').length;
      if (CATALOGUE_DATA.some((a) => a.file === rel(f) && a.row.test(text.split('\n')[line - 1] ?? ''))) continue;
      offenders.push(`${rel(f)}:${line} — "${m[0].replace(/\s+/g, ' ')}"`);
    }
  }
  assert.deepEqual(offenders, [], `The old plan name is back. Say "${CATALOGUE_TITLE}" (the catalogue's title):\n  ${offenders.join('\n  ')}`);
});

test('1b · the one allowance still points at a catalogue row (or it is deleted)', () => {
  for (const a of CATALOGUE_DATA) {
    const lines = readFileSync(join(WEB, a.file), 'utf8').split('\n');
    assert.ok(lines.some((l) => a.row.test(l)), `${a.file}: no catalogue part row carries the old title any more — delete its allowance`);
  }
});

test('2 · every hand-typed name of the plan equals the catalogue title', () => {
  const t = CATALOGUE_TITLE!;
  assert.equal(PLAN_NAME.pro, t, 'lib/plan-buy-doors.ts PLAN_NAME.pro is not the catalogue title');
  const tile = EVERY_ADD_ON.find((a) => a.serviceKey === 'COUPLE_WEBSITE_PRO');
  assert.ok(tile, 'the Studio tile for COUPLE_WEBSITE_PRO is gone — re-point this guard');
  assert.equal(tile!.label.toLowerCase(), t.toLowerCase(), 'the Studio tile (lib/add-ons-catalog.ts) is not labelled with the catalogue title');
  const powered = readFileSync(join(WEB, 'app/[slug]/_components/editorial/data.ts'), 'utf8');
  assert.match(powered, new RegExp(`COUPLE_WEBSITE_PRO: '${t}'`), 'the editorial "Powered by" label is not the catalogue title');
  const iap = readFileSync(join(WEB, 'lib/iap/products.ts'), 'utf8');
  assert.match(iap, new RegExp(`productId: \`\\$\\{PREFIX\\}event_pro\`[\\s\\S]{0,400}appStoreName: '${t}'`), 'the App Store product is not named with the catalogue title');
});

test('3 · the pattern bites every spelling and spares today’s names', () => {
  const hits = (s: string) => [...s.matchAll(OLD_NAME)].length;
  assert.equal(hits('part of Event Hub Pro'), 1);
  assert.equal(hits('Unlock EVENT HUB PRO'), 1);
  assert.equal(hits("label: 'Event Hub PRO'"), 1);
  assert.equal(hits('// part of Event\n * Hub Pro'), 1);
  assert.equal(hits('Event Pro · Event Plus · Event Ultra · Event Hub'), 0);
  assert.equal(hits('COUPLE_WEBSITE_PRO event-hub-pro.ts hubPro'), 0);
});
