/**
 * money-wears-the-ledger-face.test.ts — on the budget screen, a money figure a
 * person SCANS is set in the ledger face; a money figure they READ may not be.
 *
 * ── The defect this pins ───────────────────────────────────────────────────
 * The binding Ledger archetype (prototypes/archetype_data_roster_ledger_
 * comparison_2026-08-01.html, route chip `/dashboard/[event]/budget`) says it
 * in its own words: "Money rows, grouped by category, every numeral
 * right-aligned in Space Mono like a bank book… Magnitude scans down one edge."
 *
 * Each supplier's Budget / Paid / Remaining set its LABEL in mono and its
 * FIGURE in the body face, so the word "Paid" appeared twice on one screen in
 * two different typefaces: once over a mono figure in payment progress, once
 * over a body-face figure on every supplier card below. Caught by the
 * adversarial audit of W4-A, not by review — a stream that swept for a colour's
 * NAME could not see a typeface at all.
 *
 * ── ⚠ WHY THIS FILE WAS WIDENED — READ BEFORE EXTENDING IT ────────────────
 * Rev 1 of this guard found money stats BY SHAPE: a component taking both a
 * `label` and a `value`. That is three components on this screen, and it
 * matched all three — so it reported the screen clean.
 *
 * It was not clean. The "Next payments" list renders a divided column of
 * amounts, right-aligned down one edge — the archetype's `.l-amt .a` exactly —
 * and its row component takes a `payment`, not a label and a value. **One
 * shape is not a survey.** Same family as the sweep that matched one SPELLING
 * of a colour and reported the colour delta closed.
 *
 * So rule B below does not look for a shape at all. It CENSUSES every rendered
 * `formatPhp(...)` in the resolved file set, works out which element actually
 * encloses it with a real JSX scan, and demands the ledger face — unless the
 * figure is billed as prose.
 *
 * ── Why a bill rather than a blanket rule ─────────────────────────────────
 * Money inside a sentence is body copy: "₱120,000 of ₱400,000 paid",
 * "Suggested ₱45,000 · typical range ₱30,000–₱60,000". Setting those in mono
 * would be wrong, and a blanket rule that banned them would cry wolf — which
 * is how a guard teaches you to skim past the one time it is right. Each
 * exception is billed with its reason, keyed by file + count, and checked in
 * BOTH directions: a new body-face figure fails, and so does a fixed one whose
 * bill line was left behind.
 *
 * ── Why the subject list is RESOLVED, not written down ─────────────────────
 * The original defect lived in `_components/vendor-itemization-card.tsx`, one
 * directory ABOVE the budget tree, reached only through the page's own import —
 * exactly the file a hand-written list of "the budget screen" omits. The file
 * set follows the budget tree's imports into `_components/`.
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

/**
 * A census that finds nothing passes rule B in silence. This floor is the
 * number of rendered money figures found today (21); it only ever goes UP as
 * the screen grows, and it going DOWN unexpectedly means the scan broke.
 */
const CENSUS_FLOOR = 18;

/**
 * Money figures that are deliberately NOT in the ledger face, keyed by file,
 * with the count and the reason. This is a BILL, not a decision — do not add a
 * line to make this test pass unless the figure is genuinely one of these two
 * things.
 */
const PROSE_BILL: ReadonlyArray<{
  readonly file: string;
  readonly count: number;
  readonly reason: string;
}> = [
  {
    file: 'budget/_components/budget-allocation-planner.tsx',
    count: 6,
    reason:
      'Sentences, not columns: "Suggested ₱45,000 · typical range ₱30,000–₱60,000" and the ' +
      'same line in the tilt editor. The archetype governs the column of amounts the eye scans, ' +
      'never money inside prose.',
  },
  {
    file: 'budget/_components/budget-live-summary.tsx',
    count: 2,
    reason:
      'The progress sentence "₱120,000 of ₱400,000 paid" above the bar. Prose. Its three stat ' +
      'figures and its Next-payments column are both in the ledger face.',
  },
  {
    file: '_components/vendor-itemization-card.tsx',
    count: 3,
    reason:
      '<option> text inside native <select> menus (which installment · which line item). A native ' +
      'select renders its options with platform chrome and honours a font family unreliably, so ' +
      'the mono face is not something this can promise. Not a column, and never scanned.',
  },
];

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

/** A note that merely NAMES a class must not satisfy — or fire — the rules. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ---------------------------------------------------------------------------
// RULE A — a stat component sets BOTH its label and its figure in the ledger
// face. Kept from rev 1: it catches the pairing directly, which is what made
// "Paid" appear twice in two typefaces.
// ---------------------------------------------------------------------------

type Cell = { file: string; component: string; slot: 'label' | 'value'; mono: boolean };

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

// ---------------------------------------------------------------------------
// RULE B — the census. Every rendered money figure, whatever shape renders it.
// ---------------------------------------------------------------------------

type Figure = { file: string; line: number; tag: string; mono: boolean };

/**
 * Walk the source as JSX and report, for each `formatPhp(` occurrence, the
 * element that actually encloses it.
 *
 * ⚠ Two things a naive regex gets wrong here, both proved while writing this:
 *  · "the nearest `<` before the match" is the WRONG element when the figure
 *    follows a closing tag — `{formatPhp(a)}–{formatPhp(b)}` after a </strong>
 *    reports <strong> for the second one. Hence the element stack.
 *  · "is there a `>` between?" cannot tell an attribute from content, because
 *    a JSX attribute expression contains `>` all the time (`saveAmt > 0`,
 *    `() =>`). Hence the brace/quote-aware walk to the real end of the tag.
 * A figure passed to a component as a PROP (`<Money value={formatPhp(x)} />`)
 * is counted as in-attribute here and is covered by rule A instead, where the
 * component actually renders it.
 */
function moneyFigures(src: string): Array<{ index: number; kind: 'attribute' | 'content'; tag: string; className: string }> {
  const out: Array<{ index: number; kind: 'attribute' | 'content'; tag: string; className: string }> = [];
  const stack: Array<{ name: string; className: string }> = [];
  const tagStart = /<(\/?)([A-Za-z][A-Za-z0-9._]*)?/y;
  let i = 0;
  while (i < src.length) {
    if (src[i] === '<') {
      tagStart.lastIndex = i;
      const m = tagStart.exec(src);
      if (!m) {
        i += 1;
        continue;
      }
      const closing = m[1] === '/';
      const name = m[2] ?? '';
      let j = tagStart.lastIndex;
      let depth = 0;
      let quote: string | null = null;
      while (j < src.length) {
        const ch = src[j] as string;
        if (quote) {
          if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'" || ch === '`') {
          quote = ch;
        } else if (ch === '{') {
          depth += 1;
        } else if (ch === '}') {
          depth -= 1;
        } else if (ch === '>' && depth === 0) {
          break;
        }
        if (src.startsWith('formatPhp(', j)) {
          out.push({ index: j, kind: 'attribute', tag: name, className: '' });
        }
        j += 1;
      }
      const tag = src.slice(i, j + 1);
      const selfClosing = tag.trimEnd().endsWith('/>');
      if (closing) {
        for (let k = stack.length - 1; k >= 0; k -= 1) {
          if (stack[k]?.name === name) {
            stack.length = k;
            break;
          }
        }
      } else if (!selfClosing) {
        const cm = /className=(?:"([^"]*)"|\{`([^`]*)`|\{([^}]*)\})/s.exec(tag);
        stack.push({ name, className: (cm?.[1] ?? cm?.[2] ?? cm?.[3] ?? '') });
      }
      i = j + 1;
      continue;
    }
    if (src.startsWith('formatPhp(', i)) {
      const top = stack[stack.length - 1];
      out.push({
        index: i,
        kind: 'content',
        tag: top?.name ?? '(none)',
        className: top?.className ?? '',
      });
      i += 'formatPhp('.length;
      continue;
    }
    i += 1;
  }
  return out;
}

function census(): { mono: Figure[]; body: Figure[] } {
  const mono: Figure[] = [];
  const body: Figure[] = [];
  for (const file of filesUnderGuard()) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const f of moneyFigures(src)) {
      if (f.kind === 'attribute') continue;
      const entry: Figure = {
        file: relative(EVENT_ROOT, file),
        line: src.slice(0, f.index).split('\n').length,
        tag: f.tag,
        mono: f.className.includes('font-mono'),
      };
      (entry.mono ? mono : body).push(entry);
    }
  }
  return { mono, body };
}

// ---------------------------------------------------------------------------

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

test('the census still SEES the screen', () => {
  const { mono, body } = census();
  const total = mono.length + body.length;
  assert.ok(
    total >= CENSUS_FLOOR,
    `the money census found only ${total} rendered figures (floor ${CENSUS_FLOOR}). ` +
      `A scan that stops matching reports a clean screen it never looked at — fix the scan, do not lower the floor.`,
  );
});

test('every money figure a person SCANS is in the ledger face; the rest are billed as prose', () => {
  const { body } = census();
  const counted = new Map<string, number>();
  for (const f of body) counted.set(f.file, (counted.get(f.file) ?? 0) + 1);

  const billed = new Map(PROSE_BILL.map((b) => [b.file, b.count]));

  // Direction 1 — a body-face figure that nobody has justified.
  const unbilled = [...counted.entries()]
    .filter(([file, n]) => (billed.get(file) ?? 0) < n)
    .map(([file, n]) => `${file}: ${n} body-face figures, ${billed.get(file) ?? 0} billed`);
  assert.deepEqual(
    unbilled,
    [],
    'A money figure renders in the body face and is not billed as prose. If it is a column a person ' +
      'scans, give it `font-mono … tabular-nums`; if it is genuinely a sentence, add it to PROSE_BILL ' +
      'with the reason. The "Next payments" column was missed for exactly this reason.',
  );

  // Direction 2 — a bill line left behind after the figure was fixed or removed.
  const stale = PROSE_BILL.filter((b) => (counted.get(b.file) ?? 0) < b.count).map(
    (b) => `${b.file}: bill says ${b.count}, screen has ${counted.get(b.file) ?? 0}`,
  );
  assert.deepEqual(
    stale,
    [],
    'A prose bill line outlived its figure. The bill only ever gets SHORTER — shrink it in the same commit.',
  );
});
