/**
 * money-wears-the-ledger-face.test.ts — on the budget screen, a money figure
 * that sits under its own micro-label is a LEDGER CELL, and a ledger cell is
 * set in the mono face.
 *
 * ── The defect this pins ───────────────────────────────────────────────────
 * The binding Ledger archetype (prototypes/archetype_data_roster_ledger_
 * comparison_2026-08-01.html, route chip `/dashboard/[event]/budget`) says it
 * in its own words: "Money rows, grouped by category, every numeral
 * right-aligned in Space Mono like a bank book… Magnitude scans down one edge."
 *
 * Three stat components render money under a mono uppercase micro-label on
 * this one screen. Two of them set the figure in Space Mono. The third — each
 * supplier's Budget / Paid / Remaining — set its LABEL in mono and its FIGURE
 * in the body face, so the word "Paid" appeared twice on one screen in two
 * different typefaces: once as a mono label over a mono figure ("Paid so far",
 * payment progress) and once as a mono label over a body-face figure (the
 * supplier card). Caught by the adversarial audit of W4-A, not by review —
 * a stream that swept for a colour's NAME could not see a typeface at all.
 *
 * ── Why the subject list is RESOLVED, not written down ─────────────────────
 * A hand-enumerated list is a list of the components somebody thought of. The
 * defect above lived in `_components/vendor-itemization-card.tsx`, one
 * directory ABOVE the budget tree, reached only through the page's own import
 * — exactly the file a hand-written list of "the budget screen" omits. So the
 * file set follows the budget tree's imports into `_components/`, and the stat
 * components are found by SHAPE: a component that takes both a `label` and a
 * `value`. Add a fourth and it is guarded the moment it exists.
 *
 * ── The floor ─────────────────────────────────────────────────────────────
 * A sweep that finds nothing passes silently, which is how a guard becomes
 * decoration. STAT_FLOOR asserts the shape still matches at least the three
 * components that exist today; rename the shape and the guard fails loudly
 * instead of reporting a clean screen it never looked at.
 *
 * ⚠ Scope, deliberately: this governs LEDGER CELLS, never prose. Money inside
 * a sentence ("₱120,000 of ₱400,000 paid", "Suggested ₱45,000 · typical
 * range…") is body copy and stays in the body face — the archetype's rule is
 * about the column of amounts the eye scans, not about words.
 *
 * 🛡 Mutation-checked by printed occurrence count, before → after.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const EVENT_ROOT = join(__dirname, '..');
const BUDGET_TREE = __dirname;

/** The three that exist on 2026-08-25: SummaryStat · Stat · Money. */
const STAT_FLOOR = 3;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/**
 * The budget screen as it RENDERS: its own tree, plus every component it
 * imports out of the shared `_components/` directory one level up.
 */
function filesUnderGuard(): string[] {
  const treeFiles = walk(BUDGET_TREE);
  const shared = new Set<string>();
  const importRe = /_components\/([a-z0-9-]+)'/g;
  for (const f of treeFiles) {
    for (const m of readFileSync(f, 'utf8').matchAll(importRe)) {
      const candidate = join(EVENT_ROOT, '_components', `${m[1]}.tsx`);
      if (existsSync(candidate)) shared.add(candidate);
    }
  }
  return [...treeFiles, ...shared];
}

/** A note that merely NAMES a class must not satisfy — or fire — the rule. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

type Cell = { file: string; component: string; slot: 'label' | 'value'; mono: boolean };

/**
 * A stat component is one that takes BOTH `label` and `value` — the shape of a
 * ledger cell. For each, find where `{label}` and `{value}` are rendered and
 * read the className of the element enclosing them.
 */
function ledgerCells(): Cell[] {
  const cells: Cell[] = [];
  const fnRe = /function\s+([A-Z][A-Za-z0-9]*)\s*\(\s*\{([^}]*)\}/g;
  for (const file of filesUnderGuard()) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(fnRe)) {
      const declared = m[2] ?? '';
      const params = declared.split(',').map((p) => (p.split('=')[0] ?? '').trim());
      if (!params.includes('label') || !params.includes('value')) continue;
      const start = (m.index ?? 0) + m[0].length;
      const next = src.indexOf('\nfunction ', start);
      const body = src.slice(start, next > 0 ? next : src.length);
      for (const slot of ['label', 'value'] as const) {
        const at = body.indexOf(`{${slot}}`);
        assert.ok(
          at >= 0,
          `${relative(EVENT_ROOT, file)}::${m[1]} takes \`${slot}\` and never renders {${slot}} — the shape moved; teach this guard the new one rather than deleting it.`,
        );
        const before = body.slice(0, at);
        const openTag = before.slice(before.lastIndexOf('<'));
        cells.push({
          file: relative(EVENT_ROOT, file),
          component: m[1] ?? '(anonymous)',
          slot,
          mono: openTag.includes('font-mono'),
        });
      }
    }
  }
  return cells;
}

test('the budget screen still HAS ledger cells to guard', () => {
  const components = new Set(ledgerCells().map((c) => `${c.file}::${c.component}`));
  assert.ok(
    components.size >= STAT_FLOOR,
    `found ${components.size} money-stat components, expected at least ${STAT_FLOOR}. ` +
      `An empty sweep passes every other rule in this file silently — fix the shape match, do not lower the floor.`,
  );
});

test('every ledger cell — label AND figure — is set in the mono face', () => {
  const body = ledgerCells().filter((c) => !c.mono);
  assert.deepEqual(
    body.map((c) => `${c.file}::${c.component} ${c.slot}`),
    [],
    'A money figure under a mono label renders in the body face. The Ledger archetype sets every numeral in Space Mono so magnitude scans down one edge; a mono label over a body-face figure is how "Paid" came to appear twice on one screen in two typefaces.',
  );
});
