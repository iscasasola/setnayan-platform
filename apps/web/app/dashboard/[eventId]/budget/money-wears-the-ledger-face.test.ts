/**
 * money-wears-the-ledger-face.test.ts — on the Budget page, money is set in the
 * APP font with tabular numerals. Never monospace.
 *
 * ── ⚠ THIS FILE USED TO PIN THE OPPOSITE, AND WAS REWRITTEN ON PURPOSE ─────
 * Until 2026-10-08 it demanded `font-mono` on every figure a person scans: the
 * Ledger archetype of 2026-08-01 said "every numeral right-aligned in Space
 * Mono like a bank book". The owner approved a different Budget page on
 * 2026-10-08 (`BUDGET_PAGE_2026-10-08_fable.md`, "budget looks good!") whose
 * prototype sets money in Hanken Grotesk with `font-variant-numeric:
 * tabular-nums` — its own CSS comment: "Count: the app font, tabular — never
 * monospace". The plan row (B1) says this guard "pins the OPPOSITE of what the
 * owner asked; it must be rewritten … never deleted silently". So the name
 * stays — the ledger still has ONE face — and the face changed.
 *
 * What survived the rewrite is the part that was always the point: magnitude
 * must scan down one edge. That needs digits of equal width, which tabular
 * numerals give in any font. What went is the typeface.
 *
 * ── The three rules ───────────────────────────────────────────────────────
 *  A · NO MONOSPACE. `font-mono` (or a mono font variable) appears nowhere in
 *      the `budget/` tree — .tsx or .css, comments stripped.
 *  B · EVERY FIGURE A PERSON SCANS IS TABULAR. A census of every rendered
 *      `formatPhp(...)` / `formatPhpRounded(...)`, located with a real JSX scan
 *      (not "the nearest `<`"), must sit in an element that asks for tabular
 *      numerals — `tabular-nums`, or this page's `styles.num`. `<Peso>` (the
 *      page's own figure component) is tabular by construction and counts as
 *      one. Money inside a SENTENCE is billed as prose, with a reason, and the
 *      bill is checked in both directions.
 *  C · THE PAGE DOES NOT SAY "WEDDING". The owner's standing word rule: "event",
 *      and the event's own kind where a kind is meant. A birthday, a debut or a
 *      wake opens this same page.
 *
 * ── Scope: the `budget/` tree, and only it ────────────────────────────────
 * The old guard followed the page's imports into the shared
 * `_components/vendor-itemization-card.tsx`. That card is the supplier
 * workspace's; since plan row B2 the Budget page no longer mounts it (its job
 * here moved into the supplier's payments sheet).
 *
 * 🛡 Each rule was sabotaged and seen red before being trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const BUDGET_TREE = __dirname;

/**
 * A census that finds nothing passes rule B in silence. This is the number of
 * rendered money figures found on the day it was last counted; it going DOWN
 * unexpectedly means the scan broke, not that the screen got cleaner.
 */
const CENSUS_FLOOR = 18;

/**
 * Money figures that are deliberately NOT tabular, keyed by file, with the
 * count and the reason. A BILL, not a decision — do not add a line to make
 * this test pass unless the figure is genuinely inside a sentence.
 */
const PROSE_BILL: ReadonlyArray<{
  readonly file: string;
  readonly count: number;
  readonly reason: string;
}> = [
  {
    file: '_components/budget-allocation-planner.tsx',
    count: 6,
    reason:
      'Sentences, not columns: "Suggested ₱45,000 · typical range ₱30,000–₱60,000" and the same ' +
      'line in the tilt editor. Tabular numerals are for the column the eye scans, never for ' +
      'money inside prose. (Unmounted from the page in plan row B2 — owner: "not this one" — and ' +
      'kept as a file for whichever surface draws the estimates next.)',
  },
];

function walk(dir: string, ext: readonly string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, ext));
    else if (ext.some((e) => entry.name.endsWith(e)) && !entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

const rel = (file: string) => relative(BUDGET_TREE, file);
const code = (file: string) => stripComments(readFileSync(file, 'utf8'));

// ---------------------------------------------------------------------------
// RULE A — no monospace anywhere in the tree.
// ---------------------------------------------------------------------------

/** Every way this codebase can ask for the mono face. */
const MONO = /\bfont-mono\b|--font-space-mono|--font-mono\b|font-family:[^;]*\bmono/i;

test('rule A can see the sabotage it exists to catch', () => {
  assert.match('<p className="font-mono text-2xl">', MONO);
  assert.match('.v { font-family: var(--font-space-mono); }', MONO);
  assert.match('.v { font-family: ui-monospace, monospace; }', MONO);
  assert.doesNotMatch('<p className="tabular-nums text-2xl">', MONO);
});

test('no file under budget/ sets anything in the monospace face', () => {
  const files = walk(BUDGET_TREE, ['.tsx', '.ts', '.css']);
  assert.ok(files.length >= 5, `only ${files.length} files found under budget/ — the walk broke`);
  const offenders = files
    .filter((f) => MONO.test(code(f)))
    .map(rel);
  assert.deepEqual(
    offenders,
    [],
    'The Budget page sets money in the app font with tabular numerals — "never monospace" (prototype ' +
      'budget_page_2026-10-08). Use `tabular-nums` (or this page\'s `styles.num`), not `font-mono`.',
  );
});

// ---------------------------------------------------------------------------
// RULE B — the census. Every rendered money figure, whatever shape renders it.
// ---------------------------------------------------------------------------

type Occurrence = { index: number; kind: 'attribute' | 'content'; tag: string; open: string };

/**
 * Walk the source as JSX and report, for each `token` occurrence, the element
 * that actually encloses it, with that element's whole opening tag.
 *
 * ⚠ Two things a naive regex gets wrong, both proved when this scan was first
 * written (2026-08-25):
 *  · "the nearest `<` before the match" is the WRONG element when the figure
 *    follows a closing tag. Hence the element stack.
 *  · "is there a `>` between?" cannot tell an attribute from content, because
 *    a JSX attribute expression contains `>` all the time (`a > 0`, `() =>`).
 *    Hence the brace/quote-aware walk to the real end of the tag.
 * A figure passed to a component as a PROP is in-attribute and not counted
 * here; the component that renders it is.
 */
function scanFor(src: string, token: string): Occurrence[] {
  const out: Occurrence[] = [];
  const stack: Array<{ name: string; open: string }> = [];
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
        if (src.startsWith(token, j)) {
          out.push({ index: j, kind: 'attribute', tag: name, open: '' });
        }
        j += 1;
      }
      const open = src.slice(i, j + 1);
      const selfClosing = open.trimEnd().endsWith('/>');
      if (closing) {
        for (let k = stack.length - 1; k >= 0; k -= 1) {
          if (stack[k]?.name === name) {
            stack.length = k;
            break;
          }
        }
      } else if (!selfClosing) {
        stack.push({ name, open });
      }
      i = j + 1;
      continue;
    }
    if (src.startsWith(token, i)) {
      const top = stack[stack.length - 1];
      out.push({ index: i, kind: 'content', tag: top?.name ?? '(none)', open: top?.open ?? '' });
      i += token.length;
      continue;
    }
    i += 1;
  }
  return out;
}

/** Does this opening tag ask for tabular numerals? */
const TABULAR = /\btabular-nums\b|\bstyles\.num\b/;

/** Every call that puts a peso figure on this screen — see `lib/php.ts`. */
const MONEY_TOKENS = ['formatPhp(', 'formatPhpRounded('] as const;

type Figure = { file: string; line: number; tag: string; tabular: boolean };

function census(): { tabular: Figure[]; body: Figure[]; pesos: number } {
  const tabular: Figure[] = [];
  const body: Figure[] = [];
  let pesos = 0;
  for (const file of walk(BUDGET_TREE, ['.tsx'])) {
    const src = code(file);
    // `<Peso …>` — this page's figure component. It renders through `Count`
    // (inline `font-variant-numeric: tabular-nums`) or its exact-centavo
    // fallback (same inline style), so every use is a tabular figure.
    pesos += src.match(/<Peso\b/g)?.length ?? 0;
    for (const f of MONEY_TOKENS.flatMap((t) => scanFor(src, t))) {
      if (f.kind === 'attribute') continue;
      const entry: Figure = {
        file: rel(file),
        line: src.slice(0, f.index).split('\n').length,
        tag: f.tag,
        tabular: TABULAR.test(f.open),
      };
      (entry.tabular ? tabular : body).push(entry);
    }
  }
  return { tabular, body, pesos };
}

test('the scan tells an enclosing element from an icon beside it', () => {
  const src = '<dd className="tabular-nums"><Icon className="h-4" />{formatPhp(x)}</dd>';
  const [hit] = scanFor(src, 'formatPhp(');
  assert.equal(hit?.tag, 'dd', 'the figure is enclosed by the <dd>, not by the self-closing icon before it');
  assert.ok(TABULAR.test(hit?.open ?? ''));
  const [bare] = scanFor('<p className="text-sm">{formatPhp(x)}</p>', 'formatPhp(');
  assert.equal(TABULAR.test(bare?.open ?? ''), false, 'a body-face figure is seen as one');
});

test('the census still SEES the screen', () => {
  const { tabular, body, pesos } = census();
  const total = tabular.length + body.length + pesos;
  assert.ok(
    total >= CENSUS_FLOOR,
    `the money census found only ${total} rendered figures (floor ${CENSUS_FLOOR}). ` +
      `A scan that stops matching reports a clean screen it never looked at — fix the scan, do not lower the floor.`,
  );
});

test('the summary renders its figures through <Peso>, which is tabular by construction', () => {
  const summary = code(join(BUDGET_TREE, '_components', 'budget-summary.tsx'));
  assert.ok((summary.match(/<Peso\b/g) ?? []).length >= 4, 'Target/Agreed/Paid/Owed are <Peso> figures');
  const peso = summary.slice(summary.indexOf('export function Peso('));
  const body = peso.slice(0, peso.indexOf('\n}\n'));
  assert.match(body, /<Count\b/, 'whole pesos go through Count (inline tabular numerals)');
  assert.match(body, /fontVariantNumeric: 'tabular-nums'/, 'the exact-centavo fallback is tabular too');
});

test('every money figure a person SCANS is tabular; the rest are billed as prose', () => {
  const { body } = census();
  const counted = new Map<string, number>();
  for (const f of body) counted.set(f.file, (counted.get(f.file) ?? 0) + 1);

  const billed = new Map(PROSE_BILL.map((b) => [b.file, b.count]));

  // Direction 1 — a non-tabular figure that nobody has justified.
  const unbilled = [...counted.entries()]
    .filter(([file, n]) => (billed.get(file) ?? 0) < n)
    .map(([file, n]) => `${file}: ${n} non-tabular figures, ${billed.get(file) ?? 0} billed`);
  assert.deepEqual(
    unbilled,
    [],
    'A money figure renders without tabular numerals and is not billed as prose. If it is a column a ' +
      'person scans, give it `tabular-nums` (or render it with <Peso>); if it is genuinely a sentence, ' +
      'add it to PROSE_BILL with the reason.',
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

// ---------------------------------------------------------------------------
// RULE C — the page does not say "wedding".
// ---------------------------------------------------------------------------

/**
 * Words a person can READ in a .tsx file: JSX text, and string / template
 * literals longer than one bare word. An identifier (`isWeddingBudget`), an
 * import path, or the data value `'wedding'` compared against `event_type` is
 * code, not copy — a guard that fired on those would cry wolf on every line of
 * the event-type backstop and teach people to skim it.
 */
function readableText(src: string): string[] {
  const out: string[] = [];
  const noImports = src.replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  // JSX text: between a tag's `>` and the next `<` or `{`. A run carrying `;`
  // or `=` is code that happened to sit between a comparison's `>` and a later
  // `<` (`pax > 0 ? … : null; … <section`), not something a person reads.
  for (const m of noImports.matchAll(/>([^<>{}]+)[<{]/g)) {
    const text = m[1] ?? '';
    // (`&rsquo;` carries a `;` and is copy — entities are set aside first.)
    if (!/[;=]/.test(text.replace(/&[a-z#0-9]+;/gi, ''))) out.push(text);
  }
  // String and template literals that carry more than one bare token.
  for (const m of noImports.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    const text = m[2] ?? '';
    if (/\s/.test(text.trim())) out.push(text);
  }
  return out;
}

test('rule C can see the sabotage it exists to catch', () => {
  assert.ok(readableText('<h2>What&rsquo;s your total wedding budget?</h2>').some((t) => /wedding/i.test(t)));
  assert.ok(readableText('placeholder="Wedding rings"').some((t) => /wedding/i.test(t)));
  // Code, not copy:
  assert.equal(readableText("const isWeddingBudget = (type ?? 'wedding') === 'wedding';").some((t) => /wedding/i.test(t)), false);
  assert.equal(readableText("import { isMuslimWedding } from '@/lib/chinese-wedding';").some((t) => /wedding/i.test(t)), false);
});

test('nothing a person reads on the Budget page says "wedding"', () => {
  const hits: string[] = [];
  for (const file of walk(BUDGET_TREE, ['.tsx'])) {
    for (const text of readableText(code(file))) {
      if (/\bwedding/i.test(text)) hits.push(`${rel(file)}: "${text.trim().slice(0, 80)}"`);
    }
  }
  assert.deepEqual(
    hits,
    [],
    'The Budget page serves every event type. Say "event" — or print the event\'s own kind from the ' +
      'event row — never "wedding" (owner word rule; BUDGET_PAGE_2026-10-08 §1).',
  );
});

// ---------------------------------------------------------------------------
// And the three things plan row B1 deleted stay deleted.
// ---------------------------------------------------------------------------

test('the setter form, the boxed stat tile and the pinned bar do not come back', () => {
  const page = code(join(BUDGET_TREE, 'page.tsx'));
  assert.doesNotMatch(page, /\bBudgetSetter\b/, 'the "What\'s your total … budget?" form is gone — Target edits in place');
  assert.doesNotMatch(page, /\bBudgetLiveSummaryCard\b|\bBudgetTopSummary\b|\bSummaryStat\b/, 'the boxed stat tile and the live card are gone');
  // Since B2 the page mounts <BudgetScreen>, which draws the summary rows.
  assert.match(page, /<BudgetScreen\b/, 'the page draws the budget screen');
  assert.match(code(join(BUDGET_TREE, '_components', 'budget-screen.tsx')), /<BudgetSummary\b/, 'whose summary is the rows component');
  const summary = code(join(BUDGET_TREE, '_components', 'budget-summary.tsx'));
  assert.doesNotMatch(summary, /sn-tile|sn-eye/, 'the summary is rows: no tile, no eyebrow');
  assert.doesNotMatch(summary, /position:\s*['"]?fixed|\bfixed inset-x-0\b/, 'no pinned bar');
  assert.match(summary, /setEventBudget\(/, 'Target saves through the same action the form used');
  assert.doesNotMatch(summary, /type="submit"|<form\b/, 'and there is no Save button — it saves as you type');
});
