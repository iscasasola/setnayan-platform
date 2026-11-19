import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

/**
 * SLIDERS IS THE ONE SORT / SHOW ICON, APP-WIDE.
 *
 * Owner, 19 Nov 2026, verbatim: "use that as the default icon for sort across
 * the app" (specs DECISION_LOG row 2026-11-19 "SLIDERS = THE ONE SORT / SHOW
 * ICON, APP-WIDE"). Every control whose job is to sort, show or filter a list
 * draws lucide `SlidersHorizontal`. Before this sweep the same job wore three
 * faces: the funnel (`Filter`), the stacked lines (`ListFilter`) and — nowhere
 * shipped, but one import away — the sort arrows.
 *
 * ── WHAT IT BANS ────────────────────────────────────────────────────────────
 *   A lucide-react import, in any file under app/, lib/ or components/ (tests
 *   included — a test that renders a sort control should render the real one),
 *   of a funnel, a list-filter or an arrow-sort icon.
 *
 * ── WHAT IT DOES NOT BAN ────────────────────────────────────────────────────
 *   • The WORD "Filter". It is a label, a type name and a PDF dictionary key
 *     across the tree; only names imported FROM 'lucide-react' are read.
 *   • `ArrowUpDown` that means REORDER / MOVE, which is a different job. Each
 *     such use is named in ALLOWED with its reason, and an entry that stops
 *     being true fails too, so the list cannot rot into a blanket pass.
 *
 * To add a sort / show / filter control: import `SlidersHorizontal`. To add a
 * genuine reorder / swap control: add ONE reasoned line to ALLOWED. Do not
 * widen the patterns or empty the list to get green.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/** Icons that draw "sort / show / filter" with a face other than the sliders. */
const BANNED = new Set([
  // the funnel family
  'Filter', 'FilterIcon', 'FilterX', 'Funnel', 'FunnelIcon', 'FunnelPlus', 'FunnelX',
  // the stacked-lines family
  'ListFilter', 'ListFilterIcon', 'ListFilterPlus',
  // the sort arrows
  'ArrowUpDown', 'ArrowDownUp',
  'ArrowUpWideNarrow', 'ArrowDownWideNarrow', 'ArrowUpNarrowWide', 'ArrowDownNarrowWide',
  'ArrowUpAZ', 'ArrowDownAZ', 'ArrowUpZA', 'ArrowDownZA',
  'ArrowUpAz', 'ArrowDownAz', 'ArrowUpZa', 'ArrowDownZa',
  'ArrowUp01', 'ArrowDown01', 'ArrowUp10', 'ArrowDown10',
  'SortAsc', 'SortDesc',
]);

/**
 * The only places a banned name may be imported — `file → icon → why`.
 * Every entry must still be in use, or the guard fails (see the last test).
 */
const ALLOWED: Record<string, Record<string, string>> = {
  'app/dashboard/[eventId]/schedule/_components/moment-inspector.tsx': {
    ArrowUpDown: 'MOVE — "Shift everything after" pushes later moments up or down the timeline; it edits times, it does not sort a list',
  },
  'lib/nav-icons.ts': {
    Filter: 'REGISTRY — the generated catalogue behind the /admin/menus icon picker; it offers icons for menu rows and draws no sort control itself',
    ListFilter: 'REGISTRY — same catalogue as above',
    ArrowUpDown: 'REGISTRY — same catalogue as above',
  },
};

function walk(dir: string, out: string[] = []): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Every name a source imports from lucide-react, by its IMPORTED (not local) name. */
export function lucideImports(source: string): string[] {
  const names: string[] = [];
  const code = stripComments(source);
  for (const m of code.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)) {
    for (const part of m[1]!.split(',')) {
      const imported = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]!.trim();
      if (imported) names.push(imported);
    }
  }
  return names;
}

const SELF = 'lib/sort-icon-is-sliders.test.ts';

type Findings = { offenders: string[]; used: Set<string>; scanned: number };
let memo: Findings | null = null;

/** One walk of the tree, shared by the tests below. */
function findings(): Findings {
  if (memo) return memo;
  const offenders: string[] = [];
  const used = new Set<string>();
  let scanned = 0;
  for (const root of ['app', 'lib', 'components']) {
    for (const file of walk(join(WEB, root))) {
      const rel = relative(WEB, file).split('\\').join('/');
      if (rel === SELF) continue;
      const source = readFileSync(file, 'utf8');
      if (!source.includes('lucide-react')) continue;
      scanned += 1;
      for (const name of lucideImports(source)) {
        if (!BANNED.has(name)) continue;
        if (ALLOWED[rel]?.[name]) used.add(`${rel} → ${name}`);
        else offenders.push(`${rel} imports ${name}`);
      }
    }
  }
  memo = { offenders, used, scanned };
  return memo;
}

test('the parser reads real lucide imports — aliases, multi-line, and not the word', () => {
  assert.deepEqual(lucideImports(`import { Plus, Filter as FilterIcon } from 'lucide-react';`), ['Plus', 'Filter']);
  assert.deepEqual(lucideImports(`import {\n  ListFilter,\n  type LucideIcon,\n} from "lucide-react";`), ['ListFilter', 'LucideIcon']);
  assert.deepEqual(lucideImports(`// import { Filter } from 'lucide-react';\ntype Filter = 'all';\nimport { type ListFilter } from '@/lib/budget-page-view';`), []);
});

test('no sort / show / filter control wears a funnel, list-filter or sort-arrow icon', () => {
  const { offenders, scanned } = findings();
  assert.ok(scanned > 200, `only ${scanned} lucide-importing files were scanned — the walk is not reading the tree`);
  assert.deepEqual(
    offenders,
    [],
    'Sort, show and filter all use lucide SlidersHorizontal (owner, 19 Nov 2026). ' +
      'Swap the icon; if this one truly means REORDER / SWAP / MOVE, add one reasoned line to ALLOWED.',
  );
});

test('every allowlist line is still true and says why', () => {
  const { used } = findings();
  for (const [file, icons] of Object.entries(ALLOWED)) {
    for (const [name, why] of Object.entries(icons)) {
      assert.ok(BANNED.has(name), `${file} → ${name} is allowlisted but is not a banned icon`);
      assert.ok(why.trim().length > 20, `${file} → ${name} has no real reason`);
      assert.ok(used.has(`${file} → ${name}`), `${file} no longer imports ${name} — delete its allowlist line`);
    }
  }
});

test('the thumb row rounds wear ONE dot, in ONE colour (owner 19 Nov: "circle + dot on the thumb row")', () => {
  const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
  // Today and Shop services draw the shared face, and say when it is on.
  assert.match(read('app/vendor-dashboard/_components/today-thumb-row.tsx'), /face: <SortFace on=\{show !== 'all'\} \/>/);
  assert.match(read('app/vendor-dashboard/shop/_components/shop-services-thumb.tsx'), /face: <SortFace on=\{show !== 'all' \|\| sort !== 'listed'\} size=\{20\} \/>/);
  // The four faces' dot is the same dot: 8 px, top right, terracotta — never a second colour.
  const DOT = /\{on \? <i className="absolute -right-1 -top-1 h-2 w-2 rounded-full ([a-z-]+)" \/> : null\}/;
  for (const rel of [
    'components/sort-face.tsx',
    'app/dashboard/[eventId]/guests/_components/guests-filter-menu.tsx',
    'app/vendor-dashboard/collections/_components/portfolio-view.tsx',
  ]) {
    const m = read(rel).match(DOT);
    assert.ok(m, `${rel} draws no dot`);
    assert.equal(m![1], 'bg-terracotta', `${rel}: the dot is ${m![1]}`);
  }
});
